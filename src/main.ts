import { Plugin, Notice, MarkdownView, Modal, App } from 'obsidian';

const Jimp = require('jimp');

interface ProcessedImage {
  buffer: ArrayBuffer;
  fileName: string;
}

export default class FieldNoteDigitizer extends Plugin {
  async onload() {
    this.addCommand({
      id: 'field-note-digitizer',
      name: 'Field Note Digitizer',
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "v" }],
      callback: async () => {
        try {
          const processed = await this.processClipboardContent();
          if (processed) {
            new PreviewModal(this.app, processed, (confirmed) => {
              if (confirmed) this.saveAndInsertImage(processed);
            }).open();
          }
        } catch (error) {
          new Notice(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    });
  }

  private async processClipboardContent(): Promise<ProcessedImage | null> {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type);
            return this.processImage(await blob.arrayBuffer());
          }
        }
      }
      throw new Error('No image found in clipboard');
    } catch (error) {
      throw new Error(`Clipboard error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async processImage(buffer: ArrayBuffer): Promise<ProcessedImage> {
    try {
      const image = await new Promise<any>((resolve, reject) => {
        new Jimp(Buffer.from(buffer), (err: Error | null, img: any) => {
          err ? reject(err) : resolve(img);
        });
      });

      image.scan(0, 0, image.bitmap.width, image.bitmap.height,
        (x: number, y: number, idx: number) => {
          // Calculate luminance-preserved grayscale
          const r = image.bitmap.data[idx];
          const g = image.bitmap.data[idx + 1];
          const b = image.bitmap.data[idx + 2];
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;

          // Apply inverse threshold at 200 for alpha channel
          const alpha = gray <= 200 ? 255 : 0;

          // Preserve original color values
          image.bitmap.data[idx] = r;
          image.bitmap.data[idx + 1] = g;
          image.bitmap.data[idx + 2] = b;
          image.bitmap.data[idx + 3] = alpha;
        });

      const pngBuffer = await image.getBufferAsync(Jimp.MIME_PNG);
      return {
        buffer: new Uint8Array(pngBuffer).buffer,
        fileName: `field-note-${Date.now()}.png`
      };
    } catch (error) {
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
    contentEl.addClass('fieldnote-digitizer-modal'); // Add modal container class

    // Create title
    contentEl.createEl('h2', { 
      text: 'Preview Processed Image',
      cls: 'modal-title' // Use Obsidian's built-in modal title class
    });

    // Create image preview
    this.objectUrl = URL.createObjectURL(new Blob([this.image.buffer]));
    contentEl.createEl('img', {
      cls: 'digitizer-preview-image', // Apply your custom image class
      attr: { src: this.objectUrl }
    });

    // Create button container
    const buttonContainer = contentEl.createDiv({ 
      cls: 'digitizer-button-container' // Apply your button container class
    });

    // Create Insert button
    const insertBtn = buttonContainer.createEl('button', {
      text: 'Insert',
      cls: 'mod-cta' // Use Obsidian's mod-cta class for primary action
    });
    insertBtn.addEventListener('click', () => {
      this.callback(true);
      this.close();
    });

    // Create Cancel button
    const cancelBtn = buttonContainer.createEl('button', {
      text: 'Cancel'
    });
    cancelBtn.addEventListener('click', () => {
      this.callback(false);
      this.close();
    });
  }

  onClose() {
    URL.revokeObjectURL(this.objectUrl);
  }
}