<div align="center">
  <h1>🖋️ Inkporter</h1>
  <p><strong>A lightning-fast Neural Handwriting Extraction Microservice for Obsidian.</strong></p>
  <img src="https://img.shields.io/badge/Plugin-Obsidian-7a2e9d.svg" alt="Obsidian" />
  <img src="https://img.shields.io/badge/Engine-PyTorch-ee4c2c.svg" alt="PyTorch" />
  <img src="https://img.shields.io/badge/API-FastAPI-009688.svg" alt="FastAPI" />
</div>

<br/>

Inkporter is a two-part system designed for students, researchers, and writers. It uses a custom-trained **PyTorch U-Net Neural Network** to instantly mathematically extract handwriting from your physical notebooks, stripping away bleed-through, grid lines, and paper texture. 

It preserves faint pencil strokes and outputs raw ink on a purely transparent bounding box, directly inserted into your Obsidian Vault!

## ✨ Capabilities

- **Zero-Latency Mathematical Extraction:** A self-hosted Python FastAPI microservice keeps the heavy neural-net loaded in your GPU VRAM, shrinking processing times from 10+ seconds down to milliseconds.
- **Interactive Cropper Sandbox:** Upon pasting an image, Inkporter intercepts the clipboard and gives you an interactive Canvas UI with a transparent checkerboard. Draw a bounding box to surgically crop your handwriting margins before it touches your note!
- **Auto-Boot Subprocess Wrapper:** You don't need to manually run the python server every time. The Obsidian Plugin uses Electron to silently spin up the backend when you enter the Vault!
- **Dynamic Sensitivity Slider:** Control exactly how aggressive the algorithm is at preserving faint pencil markings versus stripping away heavy dark grid lines. 

---

## 🚀 Installation Guide

Because PyTorch is massive and highly dependent on your specific hardware (e.g., NVIDIA GPU vs Mac Silicon), the core engine must be set up locally once before you can use the Obsidian Plugin.

### Part 1: Installing the Neural Engine (This Repository)

1. **Prerequisites:** Ensure you have [Python 3.9+](https://www.python.org/downloads/) installed on your machine.
2. **Clone the Engine:** Download or `git clone` this repository to a permanent location on your hard drive (e.g., `Documents/Inkporter-Engine`).
3. **Install Dependencies:** Open your terminal inside the folder and run:
   ```bash
   pip install -r requirements.txt
   ```
   > 🔴 **CRITICAL FOR WINDOWS/LINUX USERS:** To get millisecond extraction speeds, you **must** install the GPU-accelerated version of PyTorch. If you have an NVIDIA GPU, uninstall standard torch and replace it with:
   > `pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118`

### Part 2: Configuring the Obsidian Plugin

1. Download **Inkporter** from the Obsidian Community Plugins store (or install the latest release ZIP into your `.obsidian/plugins` folder).
2. Enable the Plugin and go to its Settings tab.
3. Under the **🧠 Inkporter Engine Setup** section, paste the absolute path to the directory where you saved this repository into the **Local Python Server Directory** box.

---

## ⚡ How to Use It

You never have to touch a terminal again once things are installed!

1. Open Obsidian and hit `Ctrl/Cmd + P` to open the Command Palette.
2. Type and run: **"Start Local Neural API Server"**. 
   *(Obsidian will silently boot up the background API. You'll see a green notification when it's online).*
3. Copy a photo of your handwriting to your clipboard.
4. Hit `Ctrl/Cmd + P` and run: **"Process neural extraction from clipboard"**. 
5. Instantly crop your text in the pop-up modal, hit **Insert**, and you're done!

---

## 🛠️ Architecture & Under the Hood

The architecture consists of a `FastAPI` instance hosting a binary `inkporter_model_best.pth` file. When you paste an image, the Obsidian Typescript plugin parses the clip boundary and fires an asynchronous `HTTP POST` carrying the byte buffer directly to `http://127.0.0.1:8000/extract`. 

OpenCV decodes the array, runs it through the U-Net inference layers, dynamically applies luminosity-based alpha thresh-holding mapped to your settings slider, and immediately returns a transparent PNG stream!

<br />

<div align="center">
  <h3>❤️ Support the Development</h3>
  <p>If this plugin saved you thousands of hours of digitizing notes, consider supporting the developer!</p>
  <a href="https://github.com/sponsors/AmadeussSystem">Donate on GitHub Sponsors</a>
</div>
