import { Plugin, Notice, MarkdownView, Modal, App, Setting, PluginSettingTab, normalizePath, SliderComponent, TextComponent, Platform, ToggleComponent, debounce } from 'obsidian';

function clamp(value: number, min: number = 0, max: number = 255): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

interface ProcessedImage {
  buffer: ArrayBuffer;
  fileName: string;
}

interface InkporterSettings {
  outputDirectory: string;
  fileNameTemplate: string;
  maxWidth: number;
  maxHeight: number;
  contrastAdjustment: number;
  alphaThreshold: number;
  featheringRange: number;
  invertProcessing: boolean;
  preserveInkColor: boolean;
  convertToGrayscale: boolean;
  useLuminosityForAlpha: boolean;
}

const DEFAULT_SETTINGS: InkporterSettings = {
  outputDirectory: 'FieldNotes',
  fileNameTemplate: 'field-note-{date}-{shortId}',
  maxWidth: 0,
  maxHeight: 0,
  contrastAdjustment: 0,
  alphaThreshold: 180,
  featheringRange: 0,
  invertProcessing: false,
  preserveInkColor: false,
  convertToGrayscale: false,
  useLuminosityForAlpha: true,
};

export default class Inkporter extends Plugin {
  settings: InkporterSettings;

  async onload() {
    await this.loadSettings();

    this.addCommand({
      id: 'inkporter',
      name: Platform.isMobile ? 'Process image from file/clipboard' : 'Process image from clipboard',
      callback: async () => { this.runImageProcessing(false); }
    });

    this.addCommand({
      id: 'inkporter-file-picker',
      name: 'Process image from file',
      callback: async () => { this.runImageProcessing(true); }
    });

    this.addSettingTab(new InkporterSettingsTab(this.app, this));
  }

  private async runImageProcessing(forceFilePicker: boolean = false) {
      try {
          let processed: ProcessedImage | null = null;
          new Notice('Inkporter: Processing started...', 2000);
          if (forceFilePicker || Platform.isMobile) {
              this.promptForFileAndProcess();
          } else {
              processed = await this.processClipboardContent();
               if (processed) {
                  this.showPreviewAndSave(processed);
              } else {
                  // Notice handled in sub-functions
              }
          }
      } catch (error) {
          this.handleError(error);
      }
  }


  private promptForFileAndProcess(): void {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*';
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) { new Notice('No file selected.'); input.remove(); return; }
      try {
        const buffer = await this.readFileAsArrayBuffer(file);
        const processed = await this.processImage(buffer, file.name);
         if (processed) { this.showPreviewAndSave(processed); }
         else { new Notice('Inkporter: Processing failed or was cancelled.'); }
      } catch (error) { this.handleError(error); }
      finally { input.remove(); }
    };
    document.body.appendChild(input); input.style.display = 'none'; input.click();
  }

  private readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => { if (reader.result instanceof ArrayBuffer) { resolve(reader.result); } else { reject(new Error('Failed to read file as ArrayBuffer.')); }};
      reader.onerror = (error) => { reject(error); };
      reader.readAsArrayBuffer(file);
    });
   }

  private async processClipboardContent(): Promise<ProcessedImage | null> {
     try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            try {
              const blob = await item.getType(type);
              const fileNameHint = type.split('/')[1] || 'png';
              const result = await this.processImage(await blob.arrayBuffer(), `clipboard-image.${fileNameHint}`);
              if (!result) new Notice('Inkporter: Processing failed or was cancelled.');
              return result;
            } catch (error) { console.warn(`Failed to process image of type ${type}:`, error); continue; }
          }
        }
      }
      new Notice('No image found in clipboard.'); return null;
    } catch (error) {
      if (error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError')) { new Notice('Clipboard access denied.'); }
      else if (error instanceof DOMException && error.name === 'NotFoundError') { new Notice('No image found in clipboard.'); }
      else { throw error; }
      return null;
    }
  }

  private async processImage(buffer: ArrayBuffer, originalFileName: string = 'processed-image.png'): Promise<ProcessedImage | null> {
    return new Promise((resolve, reject) => {
      if (!buffer || buffer.byteLength === 0) return reject(new Error("Input image buffer is empty."));

      const blob = new Blob([buffer]);
      const objectUrl = URL.createObjectURL(blob);
      const img = new Image();

      img.onload = async () => {
        URL.revokeObjectURL(objectUrl);
        let canvas: HTMLCanvasElement = document.createElement('canvas');
        let ctx: CanvasRenderingContext2D | null = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return reject(new Error('Could not create canvas context'));

        let currentWidth = img.width;
        let currentHeight = img.height;

        const { maxWidth, maxHeight } = this.settings;
        let targetWidth = currentWidth;
        let targetHeight = currentHeight;
        let needsResize = false;

        if (maxWidth > 0 && currentWidth > maxWidth) {
            targetWidth = maxWidth;
            targetHeight = Math.round(currentHeight * (maxWidth / currentWidth));
            needsResize = true;
        }

        if (maxHeight > 0 && targetHeight > maxHeight) {
            const heightRatio = maxHeight / targetHeight;
            targetHeight = maxHeight;
            targetWidth = Math.round(targetWidth * heightRatio);
            needsResize = true;
        }


        if (needsResize) {
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
            currentWidth = targetWidth;
            currentHeight = targetHeight;
        } else {
            canvas.width = currentWidth;
            canvas.height = currentHeight;
            ctx.drawImage(img, 0, 0);
        }

        let imageData: ImageData;
        try {
            imageData = ctx.getImageData(0, 0, currentWidth, currentHeight);
        } catch (error) {
            console.error("Error getting ImageData:", error);
            return reject(new Error(`Could not get image data. Original: ${originalFileName}`));
        }

        try {
            this.processPixels(imageData.data, currentWidth, currentHeight);
            ctx.putImageData(imageData, 0, 0);
        } catch (pixelError) {
            console.error("Pixel processing failed:", pixelError);
            return reject(new Error("Failed during pixel processing stage."));
        }

        canvas.toBlob(async (finalBlob) => {
          if (!finalBlob) return reject(new Error('Failed to convert final canvas to blob'));
          try {
              const processedBuffer = await finalBlob.arrayBuffer();
               resolve({ buffer: processedBuffer, fileName: this.generateFileName() });
          } catch (conversionError) {
               reject(new Error(`Failed to convert processed blob to ArrayBuffer: ${conversionError}`));
          }
        }, 'image/png');
      };

      img.onerror = (errorEvent) => {
        URL.revokeObjectURL(objectUrl);
        console.error("Image loading error:", errorEvent);
        reject(new Error(`Failed to load image. Original: ${originalFileName}`));
      };
      img.src = objectUrl;
    });
  }


  private processPixels(data: Uint8ClampedArray, width: number, height: number) {
    const threshold = this.settings.alphaThreshold;
    const invert = this.settings.invertProcessing;
    const preserveColor = this.settings.preserveInkColor;
    const grayscale = this.settings.convertToGrayscale;
    const useLuminosity = this.settings.useLuminosityForAlpha;
    const contrast = this.settings.contrastAdjustment;
    const feather = this.settings.featheringRange;

    const contrastFactor = contrast !== 0 ? (259 * (contrast + 255)) / (255 * (259 - contrast)) : 1;

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      if (contrast !== 0) {
        r = clamp(contrastFactor * (r - 127.5) + 127.5);
        g = clamp(contrastFactor * (g - 127.5) + 127.5);
        b = clamp(contrastFactor * (b - 127.5) + 127.5);
      }

      const brightness = useLuminosity
        ? 0.299 * r + 0.587 * g + 0.114 * b
        : (r + g + b) / 3;

      let targetAlpha = 0;

      if (invert) {
        if (brightness > threshold + feather) {
          targetAlpha = 255;
        } else if (brightness > threshold - feather && feather > 0) {
          targetAlpha = clamp(255 * (brightness - (threshold - feather)) / (2 * feather));
        }
      } else {
        if (brightness <= threshold - feather) {
          targetAlpha = 255;
        } else if (brightness <= threshold + feather && feather > 0) {
          targetAlpha = clamp(255 * (1 - (brightness - (threshold - feather)) / (2 * feather)));
        }
      }

      const isEffectivelyInk = targetAlpha > 0;

      if (isEffectivelyInk) {
        data[i + 3] = targetAlpha;
        if (!preserveColor && grayscale) {
          const grayValue = clamp(brightness);
          data[i] = grayValue;
          data[i + 1] = grayValue;
          data[i + 2] = grayValue;
        } else {
           data[i] = r;
           data[i+1] = g;
           data[i+2] = b;
        }
      } else {
        data[i + 3] = 0;
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
      }
    }
  }

  private showPreviewAndSave(processed: ProcessedImage) {
      new PreviewModal(this.app, processed, (confirmed) => {
       if (confirmed) this.saveAndInsertImage(processed);
     }).open();
   }

  private generateFileName(): string {
    const now = new Date();
    const dateString = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const shortId = crypto.randomUUID().slice(0, 8);
    const safeTemplate = (this.settings.fileNameTemplate || DEFAULT_SETTINGS.fileNameTemplate).replace(/[/\\?%*:|"<>]/g, '-');
    return safeTemplate.replace('{timestamp}', Date.now().toString()).replace('{date}', dateString).replace('{shortId}', shortId).replace('{uuid}', crypto.randomUUID());
   }

  private async saveAndInsertImage(image: ProcessedImage) {
      try {
      const outputDir = normalizePath(this.settings.outputDirectory || DEFAULT_SETTINGS.outputDirectory);
      const fileName = image.fileName || this.generateFileName();
      const filePath = normalizePath(`${outputDir}/${fileName}.png`);
      if (!(await this.app.vault.adapter.exists(outputDir))) { await this.app.vault.createFolder(outputDir); new Notice(`Created directory: ${outputDir}`); }
      else { const stat = await this.app.vault.adapter.stat(outputDir); if (stat && stat.type !== 'folder') { new Notice(`Error: Output path "${outputDir}" is not a directory.`, 10000); return; } }
      await this.app.vault.adapter.writeBinary(filePath, image.buffer); new Notice(`Image saved to: ${filePath}`);
      const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (activeView && activeView.file) {
        const editor = activeView.editor; const file = this.app.vault.getFileByPath(filePath);
        if (file) { const linkText = this.app.fileManager.generateMarkdownLink(file, activeView.file.path); editor.replaceSelection(linkText); }
        else { new Notice(`Failed to get file reference for ${filePath}.`); }
      } else { new Notice('No active Markdown file to insert link.'); }
    } catch (error) { this.handleError(error); }
   }

  private handleError(error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    new Notice(`Inkporter Error: ${message}`, 10000); console.error("Inkporter Error:", error);
   }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
   }
  async saveSettings() {
    await this.saveData(this.settings);
   }
}

class PreviewModal extends Modal {
  private objectUrl: string | null = null;
  constructor(app: App, private image: ProcessedImage, private callback: (confirmed: boolean) => void) { super(app); }
  onOpen() {
    const { contentEl } = this; contentEl.empty(); contentEl.addClass('Inkporter-modal'); contentEl.createEl('h2', { text: 'Preview processed image' });
    if (!this.image.buffer || this.image.buffer.byteLength === 0) { contentEl.createEl('p', { text: 'Error: Unable to load preview (empty buffer).' }); new Setting(contentEl).addButton(btn => btn.setButtonText('Close').onClick(() => { this.callback(false); this.close(); })); return; }
    try {
        this.objectUrl = URL.createObjectURL(new Blob([this.image.buffer], { type: 'image/png' }));
        contentEl.createEl('img', { attr: { src: this.objectUrl, alt: 'Processed image preview' }, cls: 'Inkporter-preview-image' });
        new Setting(contentEl).addButton(btn => btn.setButtonText('Insert').setCta().onClick(() => { this.callback(true); this.close(); })).addButton(btn => btn.setButtonText('Cancel').onClick(() => { this.callback(false); this.close(); }));
    } catch (error) { contentEl.createEl('p', { text: `Error creating preview: ${error instanceof Error ? error.message : error}` }); console.error("Preview Modal Error:", error); new Setting(contentEl).addButton(btn => btn.setButtonText('Close').onClick(() => { this.callback(false); this.close(); })); }
  }
  onClose() { if (this.objectUrl) { URL.revokeObjectURL(this.objectUrl); this.objectUrl = null; } this.contentEl.empty(); }
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
    containerEl.createEl('h2', { text: 'Inkporter Settings' });

    containerEl.createEl('h3', { text: 'Input / Output' });
    new Setting(containerEl).setName('Output directory').setDesc('Where to store processed images (relative to vault root).')
      .addText(text => text.setPlaceholder(DEFAULT_SETTINGS.outputDirectory).setValue(this.plugin.settings.outputDirectory)
        .onChange(async (value) => { this.plugin.settings.outputDirectory = value || DEFAULT_SETTINGS.outputDirectory; await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName('File name template').setDesc('Placeholders: {timestamp}, {date}, {shortId}, {uuid}. Invalid chars replaced.')
      .addText(text => text.setPlaceholder(DEFAULT_SETTINGS.fileNameTemplate).setValue(this.plugin.settings.fileNameTemplate)
        .onChange(async (value) => { this.plugin.settings.fileNameTemplate = value || DEFAULT_SETTINGS.fileNameTemplate; await this.plugin.saveSettings(); }));


    containerEl.createEl('h3', { text: 'Resizing (Optional)' });
    new Setting(containerEl).setName('Max Width').setDesc('Resize image if wider than this (pixels). 0 disables.')
        .addText(text => text.setPlaceholder('0').setValue(this.plugin.settings.maxWidth.toString())
            .onChange(debounce(async (value) => {
                const num = parseInt(value, 10);
                this.plugin.settings.maxWidth = (!isNaN(num) && num >= 0) ? num : 0;
                await this.plugin.saveSettings();
                text.setValue(this.plugin.settings.maxWidth.toString());
            }, 500, true)));

    new Setting(containerEl).setName('Max Height').setDesc('Resize image if taller than this (pixels). 0 disables.')
        .addText(text => text.setPlaceholder('0').setValue(this.plugin.settings.maxHeight.toString())
            .onChange(debounce(async (value) => {
                const num = parseInt(value, 10);
                this.plugin.settings.maxHeight = (!isNaN(num) && num >= 0) ? num : 0;
                await this.plugin.saveSettings();
                text.setValue(this.plugin.settings.maxHeight.toString());
            }, 500, true)));


    containerEl.createEl('h3', { text: 'Pre-processing & Appearance' });
     this.createSliderSetting(containerEl, {
        name: 'Contrast Adjustment',
        desc: 'Adjust contrast before thresholding (-100 to +100). 0 = no change.',
        min: -100, max: 100, step: 1,
        settingKey: 'contrastAdjustment',
     });


    this.createSliderSetting(containerEl, {
        name: 'Alpha Threshold',
        desc: 'Controls sensitivity. Dark Ink: Pixels <= value are ink. Light Ink: Pixels > value are ink.',
        min: 0, max: 255, step: 1,
        settingKey: 'alphaThreshold',
     });

     this.createSliderSetting(containerEl, {
        name: 'Edge Feathering',
        desc: 'Soften edges around the threshold (0-50 pixels). 0 = hard edges.',
        min: 0, max: 50, step: 1,
        settingKey: 'featheringRange',
     });


    new Setting(containerEl).setName('Process light ink on dark background').setDesc('Enable for light ink/drawing on a dark background.')
      .addToggle(toggle => toggle.setValue(this.plugin.settings.invertProcessing)
        .onChange(async (value) => { this.plugin.settings.invertProcessing = value; await this.plugin.saveSettings(); }));


    containerEl.createEl('h3', { text: 'Color Options' });
    let grayscaleToggleComp: ToggleComponent | null = null;
    new Setting(containerEl).setName('Preserve original ink color').setDesc('Keep the ink pixels\' original color. Disables "Convert ink to grayscale".')
      .addToggle(toggle => toggle.setValue(this.plugin.settings.preserveInkColor)
        .onChange(async (value) => {
          this.plugin.settings.preserveInkColor = value; await this.plugin.saveSettings();
          if (grayscaleToggleComp) {
              grayscaleToggleComp.setDisabled(value);
              if (value && this.plugin.settings.convertToGrayscale) { this.plugin.settings.convertToGrayscale = false; grayscaleToggleComp.setValue(false); await this.plugin.saveSettings(); }
          }
        }));
    new Setting(containerEl).setName('Convert ink to grayscale').setDesc('Convert detected ink pixels to grayscale. Disabled if "Preserve original ink color" is on.')
      .addToggle(toggle => { grayscaleToggleComp = toggle; toggle.setValue(this.plugin.settings.convertToGrayscale).setDisabled(this.plugin.settings.preserveInkColor)
        .onChange(async (value) => { if (!this.plugin.settings.preserveInkColor) { this.plugin.settings.convertToGrayscale = value; await this.plugin.saveSettings(); }});
      });
    new Setting(containerEl).setName('Use luminosity for brightness').setDesc('Calculate brightness using luminosity (perceptual weighting) instead of simple average.')
      .addToggle(toggle => toggle.setValue(this.plugin.settings.useLuminosityForAlpha)
        .onChange(async (value) => { this.plugin.settings.useLuminosityForAlpha = value; await this.plugin.saveSettings(); }));

  }


  private createSliderSetting(containerEl: HTMLElement, options: { name: string, desc: string, min: number, max: number, step: number, settingKey: keyof InkporterSettings }) {
        const setting = new Setting(containerEl).setName(options.name).setDesc(options.desc);
        let sliderComp: SliderComponent;
        let textComp: TextComponent;
        const key = options.settingKey;

        setting.addText(text => {
            textComp = text;
            const currentValue = this.plugin.settings[key] as number ?? options.min;
            text.setValue(currentValue.toString())
                .setPlaceholder(options.min.toString())
                .onChange(debounce(async (value) => {
                    const num = options.step === 1 ? parseInt(value, 10) : parseFloat(value);
                    if (!isNaN(num) && num >= options.min && num <= options.max) {
                        (this.plugin.settings[key] as number) = num;
                        await this.plugin.saveSettings();
                        if (sliderComp) sliderComp.setValue(num);
                    } else {
                        const revertedValue = this.plugin.settings[key] as number ?? options.min;
                        text.setValue(revertedValue.toString());
                        new Notice(`${options.name} must be between ${options.min} and ${options.max}.`);
                    }
                }, 500, true));
        });

        setting.addSlider(slider => {
            sliderComp = slider;
            const currentValue = this.plugin.settings[key] as number ?? options.min;
            slider.setLimits(options.min, options.max, options.step)
                .setValue(currentValue)
                .onChange(async (value) => {
                    (this.plugin.settings[key] as number) = value;
                    await this.plugin.saveSettings();
                    textComp.setValue(value.toString());
                })
                .setDynamicTooltip();
        });
    }

}