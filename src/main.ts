import { Plugin, Notice, MarkdownView, Modal, App } from 'obsidian';

// Use CommonJS require for Jimp compatibility
const Jimp = require('jimp');

interface ProcessedImage {
  buffer: ArrayBuffer;
  fileName: string;
}

export default class FieldNoteDigitizer extends Plugin {
  async onload() {
    console.log('[FieldNote] Starting plugin initialization');
    this.addCommand({
      id: 'field-note-digitizer',
      name: 'Field Note Digitizer',
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
          new Notice(`Digitization Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    });
  }

  private async processClipboardContent(): Promise<ProcessedImage | null> {
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
      throw new Error(`Clipboard error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async processImage(buffer: ArrayBuffer): Promise<ProcessedImage> {
    console.log('[FieldNote] Processing image');
    try {
      const image = await new Promise<any>((resolve, reject) => {
        new Jimp(Buffer.from(buffer), (err: Error | null, img: any) => {
          if (err) reject(err);
          else resolve(img);
        });
      });

      image.grayscale();

      image.scan(0, 0, image.bitmap.width, image.bitmap.height, 
        (x: number, y: number, idx: number) => {
          const brightness = image.bitmap.data[idx];
          const alpha = brightness > 200 ? 0 : 255;
          image.bitmap.data[idx] = 255;     // R
          image.bitmap.data[idx + 1] = 255; // G
          image.bitmap.data[idx + 2] = 255; // B
          image.bitmap.data[idx + 3] = alpha; // A
        });

      const pngBuffer = await image.getBufferAsync('image/png');
      const arrayBuffer = new Uint8Array(pngBuffer).buffer;

      return {
        buffer: arrayBuffer,
        fileName: `field-note-${Date.now()}.png`
      };
    } catch (error) {
      console.error('[FieldNote] Image processing error:', error);
      throw new Error(`Image processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
    const img = contentEl.createEl('img', {
      attr: { src: this.objectUrl, style: 'max-width: 100%;' }
    });
    
    const buttons = contentEl.createDiv({ cls: 'modal-button-container' });
    
    const insertBtn = buttons.createEl('button', {
      text: 'Insert',
      cls: 'mod-cta'
    });
    insertBtn.addEventListener('click', () => {
      this.callback(true);
      this.close();
    });

    const cancelBtn = buttons.createEl('button', { text: 'Cancel' });
    cancelBtn.addEventListener('click', () => {
      this.callback(false);
      this.close();
    });
  }

  onClose() {
    URL.revokeObjectURL(this.objectUrl);
  }
}