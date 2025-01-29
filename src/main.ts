import { Plugin, Notice, MarkdownView, Modal, App, Setting, PluginSettingTab, normalizePath, SliderComponent, TextComponent } from 'obsidian';

interface ProcessedImage {
  buffer: ArrayBuffer;
  fileName: string;
}

interface InkporterSettings {
  outputDirectory: string;
  alphaThreshold: number;
  fileNameTemplate: string;
  convertToGrayscale: boolean;
  useLuminosityForAlpha: boolean;
}

const DEFAULT_SETTINGS: InkporterSettings = {
  outputDirectory: 'FieldNotes',
  alphaThreshold: 180,
  fileNameTemplate: 'field-note-{date}-{shortId}',
  convertToGrayscale: false,
  useLuminosityForAlpha: true
};

export default class Inkporter extends Plugin {
  settings:InkporterSettings;

  async onload() {
    await this.loadSettings();
    
    this.addCommand({
      id: 'inkporter',
      name: 'Process Image from Clipboard',
      callback: async () => {
        try {
          const processed = await this.processClipboardContent();
          if (processed) {
            new PreviewModal(this.app, processed, (confirmed) => {
              if (confirmed) this.saveAndInsertImage(processed);
            }).open();
          }
        } catch (error) {
          this.handleError(error);
        }
      }
    });

    this.addSettingTab(new InkporterSettingsTab(this.app, this));
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
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        new Notice('Clipboard access denied. Please enable clipboard permissions.');
      } else {
        this.handleError(error);
      }
      return null;
    }
  }

  private async processImage(buffer: ArrayBuffer): Promise<ProcessedImage> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        if (!ctx) {
          reject(new Error('Could not create canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        this.processPixels(data);

        ctx.putImageData(imageData, 0, 0);

        canvas.toBlob(async (blob) => {
          if (!blob) {
            reject(new Error('Failed to convert canvas to blob'));
            return;
          }
          resolve({
            buffer: await blob.arrayBuffer(),
            fileName: this.generateFileName()
          });
        }, 'image/png');
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(new Blob([buffer]));
    });
  }

  private processPixels(data: Uint8ClampedArray) {
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      const brightness = this.settings.useLuminosityForAlpha
        ? 0.299 * r + 0.587 * g + 0.114 * b
        : (r + g + b) / 3;

      if (this.settings.convertToGrayscale) {
        data[i] = data[i + 1] = data[i + 2] = brightness;
      }

      data[i + 3] = brightness <= this.settings.alphaThreshold ? 255 : 0;
    }
  }

  private generateFileName(): string {
    const now = new Date();
    const dateString = now.toISOString().slice(0, 10).replace(/-/g, '');
    const shortId = self.crypto.randomUUID().slice(0, 8);

    return this.settings.fileNameTemplate
      .replace('{timestamp}', Date.now().toString())
      .replace('{date}', dateString)
      .replace('{shortId}', shortId)
      .replace('{uuid}', self.crypto.randomUUID());
  }

  private async saveAndInsertImage(image: ProcessedImage) {
    try {
      const outputDir = normalizePath(this.settings.outputDirectory);
      const filePath = `${outputDir}/${image.fileName}.png`;

      if (!await this.app.vault.adapter.exists(outputDir)) {
        await this.app.vault.createFolder(outputDir);
      }

      await this.app.vault.adapter.writeBinary(filePath, image.buffer);

      const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (activeView) {
        activeView.editor.replaceSelection(`![[/${filePath}]]`);
      }
    } catch (error) {
      this.handleError(error);
    }
  }

  private handleError(error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    new Notice(`Inkporter Error: ${message}`);
    console.error(error);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
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
    contentEl.addClass('Inkporter-modal');

    contentEl.createEl('h2', { text: 'Preview Processed Image' });

    this.objectUrl = URL.createObjectURL(new Blob([this.image.buffer]));
    const img = contentEl.createEl('img', {
      attr: { src: this.objectUrl, alt: 'Processed image preview' },
      cls: 'Inkporter-preview-image'
    });
    

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText('Insert')
        .setCta()
        .onClick(() => {
          this.callback(true);
          this.close();
        }))
      .addButton(btn => btn
        .setButtonText('Cancel')
        .onClick(() => {
          this.callback(false);
          this.close();
        }));
  }

  onClose() {
    URL.revokeObjectURL(this.objectUrl);
  }
}

class InkporterSettingsTab extends PluginSettingTab {
  plugin: Inkporter;

  constructor(app: App, plugin: Inkporter) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName('Output directory')
      .setDesc('Where to store processed images')
      .addText(text => text
        .setValue(this.plugin.settings.outputDirectory)
        .onChange(async (value) => {
          this.plugin.settings.outputDirectory = value;
          await this.plugin.saveSettings();
        }));

    const alphaSetting = new Setting(containerEl)
      .setName('Alpha threshold')
      .setDesc('Pixels darker than this value will become opaque (0-255)');

    let sliderComponent: SliderComponent;
    let textComponent: TextComponent;

    alphaSetting.addSlider(slider => {
      sliderComponent = slider;
      slider
        .setLimits(0, 255, 1)
        .setValue(this.plugin.settings.alphaThreshold)
        .onChange(async (value) => {
          this.plugin.settings.alphaThreshold = value;
          await this.plugin.saveSettings();
          textComponent.setValue(value.toString());
        })
        .setDynamicTooltip();
    });

    alphaSetting.addText(text => {
      textComponent = text;
      text
        .setValue(this.plugin.settings.alphaThreshold.toString())
        .setPlaceholder('0-255')
        .onChange(async (value) => {
          const num = parseInt(value, 10);
          if (!isNaN(num) && num >= 0 && num <= 255) {
            this.plugin.settings.alphaThreshold = num;
            await this.plugin.saveSettings();
            sliderComponent.setValue(num);
          }
        });
    });

    new Setting(containerEl)
      .setName('File name template')
      .setDesc('Available placeholders: {timestamp}, {date}, {shortId}, {uuid}')
      .addText(text => text
        .setValue(this.plugin.settings.fileNameTemplate)
        .onChange(async (value) => {
          this.plugin.settings.fileNameTemplate = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Convert to grayscale')
      .setDesc('Convert image to grayscale before processing')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.convertToGrayscale)
        .onChange(async (value) => {
          this.plugin.settings.convertToGrayscale = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Use luminosity for alpha')
      .setDesc('Use luminosity (perceptual brightness) for alpha calculation')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.useLuminosityForAlpha)
        .onChange(async (value) => {
          this.plugin.settings.useLuminosityForAlpha = value;
          await this.plugin.saveSettings();
        }));
  }
}