import torch
import cv2
import numpy as np
import segmentation_models_pytorch as smp
import math
import warnings
from fastapi import FastAPI, Request, Response
import uvicorn

app = FastAPI(title="Inkporter Neural Core API", description="Blazing fast local inference server for Obsidian")

print("Initializing PyTorch Model in Global RAM...")
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
model = smp.Unet(
    encoder_name="mobilenet_v2",
    encoder_weights=None,
    in_channels=3,
    classes=1,
    activation=None
).to(device)

try:
    with warnings.catch_warnings():
        warnings.simplefilter('ignore')
        model.load_state_dict(torch.load("inkporter_model_best.pth", map_location=device, weights_only=True))
    model.eval()
    print("[SUCCESS] Model successfully loaded into VRAM. Ready for 0-latency requests!")
except Exception as e:
    print(f"CRITICAL ERROR loading model: {e}")

@app.post("/extract")
@app.post("/extract/")
@app.post("/")
async def extract(request: Request, sensitivity: int = 50):
    try:
        # Read raw image bytes
        image_bytes = await request.body()
        if not image_bytes:
            return Response(content="No image data received. Make sure you are POSTing ArrayBuffer bytes.", status_code=400)
            
        nparr = np.frombuffer(image_bytes, np.uint8)
        if len(nparr) == 0:
            return Response(content="Empty numpy buffer.", status_code=400)
            
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            return Response(content=b"Error decoding image", status_code=400)

        # Map sensitivity (0-100)
        conf_threshold = 0.90 - (sensitivity / 100.0) * 0.45
        luma_threshold = 175 + (sensitivity / 100.0) * 65

        orig_h, orig_w = img.shape[:2]
        MAX_DIM = 2048
        if max(orig_h, orig_w) > MAX_DIM:
            scale = MAX_DIM / max(orig_h, orig_w)
            img = cv2.resize(img, (int(orig_w * scale), int(orig_h * scale)))
            orig_h, orig_w = img.shape[:2]
            
        if orig_h < 512 or orig_w < 512:
            img = cv2.resize(img, (max(512, orig_w), max(512, orig_h)))
            orig_h, orig_w = img.shape[:2]

        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        
        # Depth Filter Map
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        bg_illumination = cv2.GaussianBlur(gray, (91, 91), 0)
        norm_luma = cv2.divide(gray, bg_illumination, scale=255.0)

        # Sliding Window
        TILE_SIZE = 512
        OVERLAP = 128
        STRIDE = TILE_SIZE - OVERLAP

        mask_accumulator = np.zeros((orig_h, orig_w), dtype=np.float32)
        weight_accumulator = np.zeros((orig_h, orig_w), dtype=np.float32)

        y_steps = math.ceil((orig_h - TILE_SIZE) / STRIDE) + 1 if orig_h > TILE_SIZE else 1
        x_steps = math.ceil((orig_w - TILE_SIZE) / STRIDE) + 1 if orig_w > TILE_SIZE else 1

        batch_tensors = []
        batch_coords = []
        BATCH_SIZE = 4 # Optimized for preventing VRAM OOM on 4GB cards while accelerating logic

        def process_batch():
            if not batch_tensors: return
            batch_cat = torch.cat(batch_tensors, dim=0)
            with torch.no_grad():
                with torch.amp.autocast(device_type=device.type):
                    output = model(batch_cat)
                pred_masks = torch.sigmoid(output).squeeze(1).cpu().numpy()
                
            if len(batch_tensors) == 1:
                pred_masks = [pred_masks]
                
            for i, (y1, x1, actual_h, actual_w) in enumerate(batch_coords):
                mask_accumulator[y1:y1+actual_h, x1:x1+actual_w] += pred_masks[i][:actual_h, :actual_w]
                weight_accumulator[y1:y1+actual_h, x1:x1+actual_w] += 1.0
                
            batch_tensors.clear()
            batch_coords.clear()

        for y in range(y_steps):
            for x in range(x_steps):
                y1 = min(y * STRIDE, orig_h - TILE_SIZE)
                x1 = min(x * STRIDE, orig_w - TILE_SIZE)
                if y1 < 0: y1 = 0
                if x1 < 0: x1 = 0
                y2, x2 = min(y1 + TILE_SIZE, orig_h), min(x1 + TILE_SIZE, orig_w)
                
                tile = img_rgb[y1:y2, x1:x2]
                
                if tile.shape[0] < 512 or tile.shape[1] < 512:
                    padded = np.zeros((512, 512, 3), dtype=np.uint8)
                    padded[:tile.shape[0], :tile.shape[1]] = tile
                    process_tile = padded
                else:
                    process_tile = tile

                t_norm = process_tile.astype(np.float32) / 255.0
                t_norm = (t_norm - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]
                t_chw = t_norm.transpose(2, 0, 1)
                tensor = torch.from_numpy(t_chw).float().unsqueeze(0).to(device)

                batch_tensors.append(tensor)
                batch_coords.append((y1, x1, tile.shape[0], tile.shape[1]))
                
                if len(batch_tensors) >= BATCH_SIZE:
                    process_batch()
                    
        # Flush remaining
        process_batch()

        final_mask = mask_accumulator / np.maximum(weight_accumulator, 1.0)
        mask_blurred = cv2.GaussianBlur(final_mask, (3, 3), 0)
        mask_binary = (mask_blurred > 0.40).astype(np.uint8) * 255 

        # Filter Geometry
        num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(mask_binary, connectivity=8)
        mask_clean = np.zeros_like(mask_binary)

        for i in range(1, num_labels):
            area = stats[i, cv2.CC_STAT_AREA]
            if area < 40: continue
                
            bb_area = stats[i, cv2.CC_STAT_WIDTH] * stats[i, cv2.CC_STAT_HEIGHT]
            density = area / bb_area if bb_area > 0 else 0
                
            component_mask = (labels == i)
            avg_confidence = np.mean(final_mask[component_mask])
            avg_luma = np.mean(norm_luma[component_mask])
            
            if avg_confidence <= conf_threshold: continue 
            with warnings.catch_warnings():
                warnings.simplefilter('ignore')
                if avg_luma > luma_threshold: continue
            if area > 1000 and density > 0.40: continue
                
            mask_clean[component_mask] = 1

        # Render
        smooth_alpha = (final_mask * mask_clean)
        alpha_channel = (smooth_alpha * 255).astype(np.uint8)
        vector_rgb = np.zeros_like(img)
        result = np.dstack([vector_rgb, alpha_channel])

        h, w = result.shape[:2]
        if max(h, w) > 2500:
            scale = 2500 / max(h, w)
            result = cv2.resize(result, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)

        _, encoded_img = cv2.imencode('.png', result)
        return Response(content=encoded_img.tobytes(), media_type="image/png")
        
    except Exception as e:
        return Response(content=f"Error extracting ink: {str(e)}".encode(), status_code=500)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
