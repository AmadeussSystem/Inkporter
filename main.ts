import { Plugin, Notice, MarkdownView, TFile, Modal, App } from 'obsidian';

interface ProcessedImage {
  buffer: ArrayBuffer;
  fileName: string;
}

export default class FieldNoteDigitizer extends Plugin {
  private cv: typeof import('@techstark/opencv-js') | null = null;

  async onload() {
    console.log('[FieldNote] Starting plugin initialization');
    try {
      await this.loadOpenCV();
      console.log('[FieldNote] OpenCV loaded successfully');
      
      this.addCommand({
        id: 'digitize-field-note',
        name: 'Digitize Field Note',
        hotkeys: [{ modifiers: ["Mod", "Shift"], key: "v" }],
        callback: async () => {
          try {
            console.log('[FieldNote] Command triggered');
            const processed = await this.processClipboardContent();
            if (processed) {
              new PreviewModal(this.app, processed, (confirmed) => {
                if (confirmed) this.saveAndInsertImage(processed);
              }).open();
            }
          } catch (error) {
            console.error('[FieldNote] Command error:', error);
            new Notice(`Digitization Error: ${error.message}`);
          }
        }
      });
    } catch (error) {
      console.error('[FieldNote] Initialization failed:', error);
      new Notice(`Plugin failed to initialize: ${error.message}`);
    }
  }

  private async loadOpenCV(): Promise<void> {
    console.log('[FieldNote] Starting OpenCV load');
    return new Promise((resolve, reject) => {
      if (this.cv) return resolve();

      // Remove existing script if present
      const existingScript = document.getElementById('opencv-js-script');
      if (existingScript) existingScript.remove();

      const script = document.createElement('script');
      script.id = 'opencv-js-script';
      script.async = true;
      script.defer = true;
      
      const cdnUrls = [
        'https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.10.0-release.1/dist/opencv.min.js',
        'https://unpkg.com/@techstark/opencv-js@4.10.0-release.1/dist/opencv.min.js'
      ];

      let currentCdnIndex = 0;
      let retryCount = 0;
      const maxRetries = 3;

      const tryLoad = () => {
        script.src = cdnUrls[currentCdnIndex];
        console.log(`[FieldNote] Trying CDN: ${cdnUrls[currentCdnIndex]}`);

        script.onload = () => {
          console.log('[FieldNote] Script load event received');
          let checkCount = 0;
          const maxChecks = 30;
          const checkInterval = 100;

          const checkCV = () => {
            checkCount++;
            console.log(`[FieldNote] CV check ${checkCount}/${maxChecks}`);
            
            if ((window as any).cv) {
              console.log('[FieldNote] CV object detected');
              this.cv = (window as any).cv;
              
              if (this.cv.Mat && this.cv.imread) {
                console.log('[FieldNote] OpenCV API validated');
                if (typeof this.cv.onRuntimeInitialized === 'function') {
                  console.log('[FieldNote] Waiting for runtime init');
                  this.cv.onRuntimeInitialized = () => {
                    console.log('[FieldNote] Runtime initialized');
                    resolve();
                  };
                } else {
                  console.log('[FieldNote] Runtime already ready');
                  resolve();
                }
              } else {
                console.warn('[FieldNote] Missing core OpenCV components');
                reject(new Error('Incomplete OpenCV initialization'));
              }
            } else if (checkCount < maxChecks) {
              setTimeout(checkCV, checkInterval);
            } else if (retryCount < maxRetries) {
              retryCount++;
              console.log(`[FieldNote] Retrying (${retryCount}/${maxRetries})`);
              currentCdnIndex = (currentCdnIndex + 1) % cdnUrls.length;
              tryLoad();
            } else {
              reject(new Error('OpenCV failed to load'));
            }
          };

          checkCV();
        };

        script.onerror = (err) => {
          console.error('[FieldNote] Script load error:', err);
          if (retryCount < maxRetries) {
            retryCount++;
            console.log(`[FieldNote] CDN retry (${retryCount}/${maxRetries})`);
            currentCdnIndex = (currentCdnIndex + 1) % cdnUrls.length;
            tryLoad();
          } else {
            reject(new Error('All CDN attempts failed'));
          }
        };
      };

      console.log('[FieldNote] Starting load process');
      tryLoad();
      document.head.appendChild(script);
    });
  }

  private async processClipboardContent(): Promise<ProcessedImage> {
    console.log('[FieldNote] Processing clipboard');
    try {
      const clipboardItems = await navigator.clipboard.read();
      console.log(`[FieldNote] Found ${clipboardItems.length} clipboard items`);

      for (const item of clipboardItems) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            console.log('[FieldNote] Found image:', type);
            const blob = await item.getType(type);
            return this.processImage(await blob.arrayBuffer());
          }
        }
      }
      throw new Error('No image in clipboard');
    } catch (error) {
      console.error('[FieldNote] Clipboard error:', error);
      throw new Error(`Clipboard error: ${error.message}`);
    }
  }

  private async processImage(buffer: ArrayBuffer): Promise<ProcessedImage> {
    console.log('[FieldNote] Processing image');
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = async () => {
        try {
          const src = this.imageToMat(img);
          const processed = this.applyProcessingPipeline(src);
          const output = await this.matToBuffer(processed);
          
          resolve({
            buffer: output,
            fileName: `field-note-${Date.now()}.png`
          });
        } catch (error) {
          reject(error);
        }
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(new Blob([buffer]));
    });
  }

  private imageToMat(img: HTMLImageElement): any {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    return this.cv.imread(canvas);
  }

  private applyProcessingPipeline(src: any): any {
    try {
      const gray = new this.cv.Mat();
      this.cv.cvtColor(src, gray, this.cv.COLOR_RGBA2GRAY);

      const thresholded = new this.cv.Mat();
      this.cv.threshold(gray, thresholded, 200, 255, this.cv.THRESH_BINARY_INV);

      const rgbaFromThreshold = new this.cv.Mat();
      this.cv.cvtColor(thresholded, rgbaFromThreshold, this.cv.COLOR_GRAY2RGBA);

      const channels = new this.cv.MatVector();
      this.cv.split(rgbaFromThreshold, channels);

      const alphaChannel = thresholded.clone();
      channels.set(3, alphaChannel);

      const rgba = new this.cv.Mat();
      this.cv.merge(channels, rgba);

      // Cleanup
      [src, gray, thresholded, rgbaFromThreshold, alphaChannel].forEach(m => m.delete());
      channels.delete();

      return rgba;
    } catch (error) {
      console.error('[FieldNote] Processing error:', error);
      throw error;
    }
  }

  private async matToBuffer(mat: any): Promise<ArrayBuffer> {
    const canvas = document.createElement('canvas');
    this.cv.imshow(canvas, mat);
    mat.delete();
    return new Promise((resolve) => {
      canvas.toBlob(async (blob) => resolve(await blob.arrayBuffer()), 'image/png');
    });
  }

  private async saveAndInsertImage(image: ProcessedImage) {
    const outputDir = 'FieldNotes';
    const filePath = `${outputDir}/${image.fileName}`;

    if (!await this.app.vault.adapter.exists(outputDir)) {
      await this.app.vault.createFolder(outputDir);
    }

    await this.app.vault.adapter.writeBinary(filePath, image.buffer);

    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView) {
      activeView.editor.replaceSelection(`![[${filePath}]]`);
    }
  }
}

class PreviewModal extends Modal {
  private objectUrl: string;

  constructor(
    app: App,
    private image: ProcessedImage,
    private callback: (confirmed: boolean) => void
  ) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: 'Preview Digitized Note' });

    this.objectUrl = URL.createObjectURL(new Blob([this.image.buffer]));
    contentEl.createEl('img', { 
      attr: { src: this.objectUrl, class: 'fieldnote-preview' } 
    });

    const buttons = contentEl.createDiv('fieldnote-buttons');
    buttons.createEl('button', { 
      text: 'Insert', 
      cls: 'mod-cta',
      click: () => { this.callback(true); this.close(); }
    });
    buttons.createEl('button', { 
      text: 'Cancel',
      click: () => { this.callback(false); this.close(); }
    });
  }

  onClose() {
    URL.revokeObjectURL(this.objectUrl);
  } 
}