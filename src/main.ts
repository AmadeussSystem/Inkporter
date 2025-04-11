// --- Imports ---
import {
	Plugin, Notice, MarkdownView, Modal, App, Setting, PluginSettingTab,
	normalizePath, SliderComponent, TextComponent, Platform, ToggleComponent, debounce, TextAreaComponent
} from 'obsidian';

// --- Helper: Clamp function ---
function clamp(value: number, min: number = 0, max: number = 255): number {
	return Math.max(min, Math.min(max, Math.round(value)));
}

// --- Data Definitions (Full & Used for Generation) ---
// FULL Page Colors List (Expanded from provided CSS)
const PAGE_COLORS: Record<string, { name: string; value: string }> = {
	'white': { name: 'White', value: '#ffffff' },
	'manila': { name: 'Manila', value: '#f3deaf' },
	'blueprint': { name: 'Blueprint', value: '#3f76ed' },
	'pastel-yellow': { name: 'Pastel Yellow', value: '#fff9c4' },
	'pastel-pink': { name: 'Pastel Pink', value: '#f8bbd0' },
	'pastel-green': { name: 'Pastel Green', value: '#c8e6c9' },
	'pastel-blue': { name: 'Pastel Blue', value: '#bbdefb' },
	'pastel-lilac': { name: 'Pastel Lilac', value: '#e4b8f5' },
	'pastel-rose': { name: 'Pastel Rose', value: '#f5b8cc' },
	'pastel-mint': { name: 'Pastel Mint', value: '#b8f5d1' },
	'pastel-sky': { name: 'Pastel Sky', value: '#b8d7f5' },
	'pastel-lemon': { name: 'Pastel Lemon', value: '#f5f5b8' },
	'pastel-coral': { name: 'Pastel Coral', value: '#f5b8a4' },
	'pastel-lavender': { name: 'Pastel Lavender', value: '#d5b8f5' },
	'pastel-seafoam': { name: 'Pastel Seafoam', value: '#b8f5e1' },
	'pastel-apricot': { name: 'Pastel Apricot', value: '#f5c5b8' },
	'pastel-peach': { name: 'Pastel Peach', value: '#f5cdb8' },
	'pastel-tea-green': { name: 'Pastel Tea Green', value: '#ccf5b8' },
	'pastel-periwinkle': { name: 'Pastel Periwinkle', value: '#b8c3f5' },
	'pastel-cotton-candy': { name: 'Pastel Cotton Candy', value: '#f5b8e8' },
	'pastel-banana': { name: 'Pastel Banana', value: '#f5e4b8' },
	'pastel-cherry-blossom': { name: 'Pastel Cherry Blossom', value: '#f5b8da' },
	'pastel-aqua': { name: 'Pastel Aqua', value: '#b8f5f2' },
	'pastel-plum': { name: 'Pastel Plum', value: '#e5b8f5' },
	'pastel-papaya': { name: 'Pastel Papaya', value: '#f5c0b8' },
	'pastel-almond': { name: 'Pastel Almond', value: '#f5dcb8' },
	'pastel-sunflower': { name: 'Pastel Sunflower', value: '#f5e8b8' },
	'pastel-honeydew': { name: 'Pastel Honeydew', value: '#e5f5b8' },
	'pastel-moonstone': { name: 'Pastel Moonstone', value: '#b8e4f5' },
	'pastel-amber': { name: 'Pastel Amber', value: '#f5cbb8' },
	'pastel-mauve': { name: 'Pastel Mauve', value: '#f5b8cf' },
	'pastel-cyan': { name: 'Pastel Cyan', value: '#b8f0f5' },
	'pastel-cream': { name: 'Pastel Cream', value: '#f5e8d4' },
	'pastel-jade': { name: 'Pastel Jade', value: '#b8f5cc' },
	'pastel-caramel': { name: 'Pastel Caramel', value: '#f5dab8' },
	'pastel-salmon': { name: 'Pastel Salmon', value: '#f5b8a6' },
	'pastel-magenta': { name: 'Pastel Magenta', value: '#f5b8f1' },
	'pastel-denim': { name: 'Pastel Denim', value: '#b8bff5' },
	'pastel-sand': { name: 'Pastel Sand', value: '#f5e2b8' },
	'pastel-rust': { name: 'Pastel Rust', value: '#f5b8ba' },
	'pastel-lime': { name: 'Pastel Lime', value: '#d4f5b8' },
	'pastel-indigo': { name: 'Pastel Indigo', value: '#b8a9f5' },
	'pastel-grape': { name: 'Pastel Grape', value: '#c7b8f5' },
	'pastel-cerulean': { name: 'Pastel Cerulean', value: '#b8dff5' },
	'pastel-turquoise': { name: 'Pastel Turquoise', value: '#b8f5e8' },
	'pastel-powder-blue': { name: 'Pastel Powder Blue', value: '#d4e4f5' },
	'pastel-forest': { name: 'Pastel Forest', value: '#b8f5b9' },
	'pastel-blush': { name: 'Pastel Blush', value: '#f5bac9' },
	'pastel-olive': { name: 'Pastel Olive', value: '#d4f5b8' },
	'pastel-charcoal': { name: 'Pastel Charcoal', value: '#b8b8b8' },
};
// FULL Pen Colors List (REMOVED filter property)
const PEN_COLORS: Record<string, { name: string; value: string; }> = {
	'white': { name: 'White', value: '#edf1fc' },
	'gray': { name: 'Gray', value: '#5f5d58' },
	'black': { name: 'Black', value: '#26241f' },
	'red': { name: 'Red', value: '#e14a49' },
	'green': { name: 'Green', value: '#15b64f' },
	'blue': { name: 'Blue', value: '#3f76ed' },
	'light-blue': { name: 'Light Blue', value: '#54b6f8' },
	'purple': { name: 'Purple', value: '#9b4ff0' },
	'orange': { name: 'Orange', value: '#ff6f00' },
	'pink': { name: 'Pink', value: '#f50057' },
	'teal': { name: 'Teal', value: '#00897b' },
	'yellow': { name: 'Yellow', value: '#ffeb3b' },
	'brown': { name: 'Brown', value: '#6d4c41' },
	'neutral-black': { name: 'Neutral Black', value: '#272727' },
};

const PAGE_STYLE_CLASSES_CONFIG = {
	'page-lines': { lineSpacing: 24 },
	'page-grid': { gridSpacing: 32 },
	'page-dots': { dotSpacing: 15, gridSpacing: 15 },
};
const PAGE_STYLE_CLASSES = Object.keys(PAGE_STYLE_CLASSES_CONFIG);

// Classes for Autocomplete
const CSS_CLASSES_FOR_AUTOCOMPLETE = [
	...Object.keys(PAGE_COLORS).map(k => `page-${k}`),
	...Object.keys(PEN_COLORS).map(k => `pen-${k}`),
	...PAGE_STYLE_CLASSES,
	'embed-blueprint', 'embed-white', 'embed-manila',
];

// --- Interface Definitions ---
interface ProcessedImage { buffer: ArrayBuffer; fileName: string; }

interface InkporterSettings {
	// Image processing
	outputDirectory: string; fileNameTemplate: string; maxWidth: number; maxHeight: number; contrastAdjustment: number; alphaThreshold: number; featheringRange: number; invertProcessing: boolean; preserveInkColor: boolean; convertToGrayscale: boolean; useLuminosityForAlpha: boolean;
	// Helper File Generation
	generatedCssFileName: string; uniqueNoteTemplateFileName: string; cssHelperFileName: string; helperFileFolder: string; customCssSnippet: string;
}

const DEFAULT_SETTINGS: InkporterSettings = {
	// Image processing
	outputDirectory: 'FieldNotes',
	fileNameTemplate: 'ink-{date}-{shortId}',
	maxWidth: 0,
	maxHeight: 0,
	contrastAdjustment: 0,
	alphaThreshold: 180,
	featheringRange: 0,
	invertProcessing: false,
	preserveInkColor: false,
	convertToGrayscale: false,
	useLuminosityForAlpha: true,
	// Helper File Generation
	generatedCssFileName: 'inkporter-notebook-styles.css',
	uniqueNoteTemplateFileName: '(TEMPLATE) Inkporter Note.md',
	cssHelperFileName: 'Inkporter CSS Classes Helper.md',
	helperFileFolder: 'META/Templates',
	customCssSnippet: '',
};

// --- Plugin Class ---
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
		this.addCommand({
			id: 'inkporter-generate-helper-files',
			name: 'Generate Notebook CSS & Helper Files',
			callback: async () => { await this.generateHelperFiles(); }
		});
		this.addSettingTab(new InkporterSettingsTab(this.app, this));
	}

	// --- Image Processing Methods (Outputs Transparent PNG) ---
	private async runImageProcessing(forceFilePicker: boolean = false) {
		try {
			let p: ProcessedImage | null = null;
			new Notice('Inkporter: Processing started...', 2000);
			if (forceFilePicker || Platform.isMobile) {
				this.promptForFileAndProcess();
			} else {
				p = await this.processClipboardContent();
				if (p) { this.showPreviewAndSave(p); }
			}
		} catch (e) { this.handleError(e); }
	}
	private promptForFileAndProcess(): void {
		const i = document.createElement('input');
		i.type = 'file';
		i.accept = 'image/*';
		i.onchange = async (e) => {
			const f = (e.target as HTMLInputElement).files?.[0];
			if (!f) { new Notice('No file selected.'); i.remove(); return; }
			try {
				const b = await this.readFileAsArrayBuffer(f);
				const p = await this.processImage(b, f.name);
				if (p) { this.showPreviewAndSave(p); }
				else { new Notice('Inkporter: Processing failed.'); }
			} catch (e) { this.handleError(e); } finally { i.remove(); }
		};
		document.body.appendChild(i);
		i.style.display = 'none';
		i.click();
	}
	private readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
		return new Promise((res, rej) => {
			const r = new FileReader();
			r.onload = () => {
				if (r.result instanceof ArrayBuffer) { res(r.result); }
				else { rej(new Error('Read failed')); }
			};
			r.onerror = (e) => { rej(e); };
			r.readAsArrayBuffer(file);
		});
	}
	private async processClipboardContent(): Promise<ProcessedImage | null> {
		try {
			const items = await navigator.clipboard.read();
			for (const item of items) {
				for (const type of item.types) {
					if (type.startsWith('image/')) {
						try {
							const blob = await item.getType(type);
							const hint = type.split('/')[1] || 'png';
							const res = await this.processImage(await blob.arrayBuffer(), `clipboard-image.${hint}`);
							if (!res) new Notice('Inkporter: Processing failed.');
							return res;
						} catch (e) { console.warn(`Process fail ${type}:`, e); continue; }
					}
				}
			}
			new Notice('No image found.');
			return null;
		} catch (e) {
			if (e instanceof DOMException && /denied|secure/i.test(e.name)) { new Notice('Clipboard denied.'); }
			else if (e instanceof DOMException && e.name === 'NotFoundError') { new Notice('No image found.'); }
			else { throw e; }
			return null;
		}
	}
	private async processImage(buffer: ArrayBuffer, originalFileName: string = 'processed-image.png'): Promise<ProcessedImage | null> {
		return new Promise((resolve, reject) => {
			if (!buffer || buffer.byteLength === 0)
				return reject(new Error("Input empty."));
			const blob = new Blob([buffer]);
			const url = URL.createObjectURL(blob);
			const img = new Image();
			img.onload = async () => {
				URL.revokeObjectURL(url);
				const canvas = document.createElement('canvas');
				const ctx = canvas.getContext('2d', { willReadFrequently: true });
				if (!ctx) return reject(new Error('No ctx'));
				let cw = img.width;
				let ch = img.height;
				const { maxWidth, maxHeight } = this.settings;
				let tw = cw;
				let th = ch;
				let resize = false;
				if (maxWidth > 0 && cw > maxWidth) { tw = maxWidth; th = Math.round(ch * (maxWidth / cw)); resize = true; }
				if (maxHeight > 0 && th > maxHeight) { const hr = maxHeight / th; th = maxHeight; tw = Math.round(tw * hr); resize = true; }
				canvas.width = tw;
				canvas.height = th;
				cw = tw;
				ch = th;
				ctx.drawImage(img, 0, 0, cw, ch);
				let imgData: ImageData;
				try {
					imgData = ctx.getImageData(0, 0, cw, ch);
				} catch (e) { console.error("Get data fail:", e); return reject(new Error(`Get data fail: ${originalFileName}`)); }
				try {
					this.processPixelsForTransparency(imgData.data, cw, ch);
					ctx.putImageData(imgData, 0, 0);
				} catch (e) { console.error("Pixel process fail:", e); return reject(new Error("Pixel process fail")); }
				canvas.toBlob(async (b) => {
					if (!b) return reject(new Error('Blob fail'));
					try {
						const pBuf = await b.arrayBuffer();
						resolve({ buffer: pBuf, fileName: this.generateFileName() });
					} catch (e) { reject(new Error(`Buffer convert fail: ${e}`)); }
				}, 'image/png');
			};
			img.onerror = (e) => { URL.revokeObjectURL(url); console.error("Img load error:", e); reject(new Error(`Img load fail: ${originalFileName}`)); };
			img.src = url;
		});
	}
	private processPixelsForTransparency(data: Uint8ClampedArray, width: number, height: number) {
		const s = this.settings;
		const th = s.alphaThreshold;
		const inv = s.invertProcessing;
		const pc = s.preserveInkColor;
		const gs = s.convertToGrayscale;
		const lum = s.useLuminosityForAlpha;
		const con = s.contrastAdjustment;
		const fea = s.featheringRange;
		const cf = con !== 0 ? (259 * (con + 255)) / (255 * (259 - con)) : 1;
		for (let i = 0; i < data.length; i += 4) {
			let r = data[i], g = data[i + 1], b = data[i + 2];
			if (con !== 0) {
				r = clamp(cf * (r - 127.5) + 127.5);
				g = clamp(cf * (g - 127.5) + 127.5);
				b = clamp(cf * (b - 127.5) + 127.5);
			}
			const br = lum ? (0.299 * r + 0.587 * g + 0.114 * b) : (r + g + b) / 3;
			let ta = 0;
			if (inv) {
				if (br > th + fea) ta = 255;
				else if (br > th - fea && fea > 0) ta = clamp(255 * (br - (th - fea)) / (2 * fea));
			} else {
				if (br <= th - fea) ta = 255;
				else if (br <= th + fea && fea > 0) ta = clamp(255 * (1 - (br - (th - fea)) / (2 * fea)));
			}
			if (ta > 0) {
				data[i + 3] = ta;
				if (!pc && gs) {
					const gv = clamp(br);
					data[i] = gv;
					data[i + 1] = gv;
					data[i + 2] = gv;
				} else {
					data[i] = r;
					data[i + 1] = g;
					data[i + 2] = b;
				}
			} else { data[i + 3] = 0; }
		}
	}
	private showPreviewAndSave(processed: ProcessedImage) {
		new PreviewModal(this.app, processed, (c) => { if (c) this.saveAndInsertImage(processed); }).open();
	}
	private generateFileName(): string {
		const n = new Date();
		const ds = `${n.getFullYear()}${String(n.getMonth() + 1).padStart(2, '0')}${String(n.getDate()).padStart(2, '0')}`;
		const sid = crypto.randomUUID().slice(0, 8);
		const st = (this.settings.fileNameTemplate || DEFAULT_SETTINGS.fileNameTemplate).replace(/[/\\?%*:|"<>]/g, '-');
		return st.replace('{timestamp}', Date.now().toString()).replace('{date}', ds).replace('{shortId}', sid).replace('{uuid}', crypto.randomUUID());
	}
	private async saveAndInsertImage(image: ProcessedImage) {
		try {
			const od = normalizePath(this.settings.outputDirectory || DEFAULT_SETTINGS.outputDirectory);
			const fn = image.fileName || this.generateFileName();
			const fp = normalizePath(`${od}/${fn}.png`);
			if (!(await this.app.vault.adapter.exists(od))) {
				await this.app.vault.createFolder(od);
				new Notice(`Created dir: ${od}`);
			} else {
				const s = await this.app.vault.adapter.stat(od);
				if (s && s.type !== 'folder') { new Notice(`Path not dir: "${od}"`, 10000); return; }
			}
			await this.app.vault.adapter.writeBinary(fp, image.buffer);
			new Notice(`Saved: ${fp}`);
			const v = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (v && v.file) {
				const e = v.editor;
				const f = this.app.vault.getFileByPath(fp);
				if (f) {
					const lt = this.app.fileManager.generateMarkdownLink(f, v.file.path);
					e.replaceSelection(lt);
				} else { new Notice(`Ref fail: ${fp}`); }
			} else { new Notice('No active note.'); }
		} catch (e) { this.handleError(e); }
	}

	// --- Helper File Generation Methods ---

	private generateStaticCssSnippet(): string {
		let css = `/* Inkporter Notebook Styles (Generated) */\n`;
		css += `/* Based on styles by CyanVoxel - v2.2.3 */\n`;
		css += `/* Enable this snippet in Obsidian Appearance settings. */\n\n`;

		// --- Global Variables ---
		css += `:root {\n`;
		css += `  /* Base Pen Colors */\n`;
		for (const key in PEN_COLORS) { css += `  --pen-${key}: ${PEN_COLORS[key].value};\n`; }
		css += `  --neutral-pen-black: #272727;\n  --neutral-pen-black-trans: #27272722;\n\n`;
		css += `  /* Page Colors */\n`;
		for (const key in PAGE_COLORS) { css += `  --page-${key}: ${PAGE_COLORS[key].value};\n`; }
		css += `\n  /* Style Variables */\n`;
		css += `  --grid-size: ${PAGE_STYLE_CLASSES_CONFIG['page-grid'].gridSpacing || 32}px;\n`;
		css += `  --line-spacing: ${PAGE_STYLE_CLASSES_CONFIG['page-lines'].lineSpacing || 24}px;\n`;
		css += `  --dot-spacing: ${PAGE_STYLE_CLASSES_CONFIG['page-dots'].gridSpacing || 15}px;\n`;
		css += `}\n\n`;

		// --- Base Styles ---
		// Instead of restricting base styling to known page classes, we now use a generic selector
		// that matches any element whose class begins with "page-".
		css += `/* Base styles for all themed pages */\n`;
		css += `[class^="page-"], [class*=" page-"] {\n`;
		css += `  --text-normal: var(--accent-color);\n`;
		css += `  --text-muted: var(--accent-color);\n`;
		css += `  --text-faint: var(--accent-color-trans);\n`;
		css += `  --link-color: var(--pen-blue);\n`;
		css += `  --link-color-hover: var(--pen-light-blue);\n`;
		css += `  --link-unresolved-color: var(--pen-red);\n`;
		css += `  --hr-color: var(--accent-color-trans);\n`;
		css += `  --blockquote-border-color: var(--accent-color-trans);\n`;
		css += `  --embed-border-left: 2px solid var(--accent-color);\n`;
		css += `  --collapse-icon-color-collapsed: var(--accent-color);\n`;
		css += `  --checkbox-color: var(--accent-color);\n`;
		css += `  --checkbox-marker-color: var(--page-color);\n`;
		css += `  --checkbox-color-hover: var(--accent-color-trans);\n`;
		css += `  --checkbox-border-color: var(--accent-color);\n`;
		css += `  --checklist-done-color: var(--accent-color);\n`;
		css += `  --list-marker-color: var(--accent-color);\n`;
		css += `  --interactive-accent: var(--accent-color);\n`;
		css += `  --metadata-label-text-color: var(--accent-color);\n`;
		css += `  --metadata-input-text-color: var(--accent-color);\n`;
		css += `  --tag-color: var(--accent-color);\n`;
		css += `  --tag-background: var(--accent-color-trans);\n`;
		css += `  --pill-cover-hover: color-mix(in srgb, var(--accent-color) 60%, transparent);\n`;
		css += `  --background-modifier-border-focus: var(--accent-color);\n`;
		css += `  --background-modifier-border: var(--accent-color-trans);\n`;
		css += `  --background-modifier-hover: color-mix(in srgb, var(--accent-color) 60%, transparent);\n`;
		css += `  background-color: var(--page-color);\n`;
		css += `  color: var(--accent-color);\n`;
		css += `  font-weight: bold;\n`;
		css += `}\n\n`;

		// --- Individual Page Background Definitions ---
		css += `/* --- Page Background Definitions --- */\n`;
		for (const key in PAGE_COLORS) {
			const theme = PAGE_COLORS[key];
			const defaultPenKey = (key === 'blueprint') ? 'white' : 'neutral-black';
			let isDark = false;
			if (theme.value.startsWith('#')) {
				try {
					const r = parseInt(theme.value.substring(1, 3), 16);
					const g = parseInt(theme.value.substring(3, 5), 16);
					const b = parseInt(theme.value.substring(5, 7), 16);
					const brightness = (r * 299 + g * 587 + b * 114) / 1000;
					isDark = brightness < 128;
				} catch { }
			} else if (key === 'blueprint') { isDark = true; }
			css += `.page-${key} {\n`;
			css += `  --page-color: var(--page-${key});\n`;
			css += `  --accent-color: var(--pen-${defaultPenKey});\n`;
			css += `  --accent-color-trans: color-mix(in srgb, var(--accent-color) 15%, transparent);\n`;
			css += `  color-scheme: ${isDark ? 'dark' : 'light'};\n`;
			if (key === 'blueprint') {
				css += `  --link-color: color-mix(in srgb, var(--pen-light-blue) 60%, var(--pen-white));\n`;
				css += `  --link-color-hover: color-mix(in srgb, var(--pen-light-blue) 20%, var(--pen-white));\n`;
			}
			if (key === 'pastel-lilac') { css += `  box-shadow: 0px 4px 6px rgba(0, 0, 0, 0.1);\n`; }
			css += `}\n\n`;
		}

		// --- Pen Color Override Classes ---
		css += `/* --- Pen Color Overrides --- */\n`;
		for (const key in PEN_COLORS) {
			css += `.pen-${key} {\n`;
			css += `  --accent-color: var(--pen-${key});\n`;
			css += `  --accent-color-trans: color-mix(in srgb, var(--accent-color) 15%, transparent);\n`;
			css += `}\n\n`;
		}

		// --- Page Style Additions ---
		css += `/* --- Page Styles --- */\n`;
		css += `.page-lines {\n  background-image: linear-gradient(to bottom, var(--accent-color-trans) 1px, transparent 1px);\n  background-size: 100% var(--line-spacing);\n  line-height: var(--line-spacing);\n}\n\n`;
		css += `.page-grid {\n  background-image: linear-gradient(0deg, transparent 0px, var(--accent-color-trans) 1px, var(--accent-color-trans) 2px, transparent 3px), linear-gradient(90deg, transparent calc(var(--grid-size) - 3px), var(--accent-color-trans) calc(var(--grid-size) - 2px), var(--accent-color-trans) calc(var(--grid-size) - 1px), transparent var(--grid-size));\n  background-size: var(--grid-size) var(--grid-size);\n}\n\n`;
		css += `.page-dots {\n  background-image: radial-gradient(var(--accent-color-trans) 1px, transparent 1px);\n  background-size: var(--dot-spacing) var(--dot-spacing);\n}\n\n`;

		// --- Utility Classes ---
		css += `/* --- Utility Classes --- */\n`;
		css += `:is(${Object.keys(PAGE_COLORS).map(k => `.page-${k}`).join(', ')}) .internal-embed img {\n  background-color: var(--page-color);\n}\n`;
		css += `.embed-white img { background-color: var(--page-white); }\n`;
		css += `.embed-manila img { background-color: var(--page-manila); }\n`;
		css += `.embed-blueprint img { background-color: var(--page-blue); }\n\n`;

		// Append custom CSS snippet from settings if provided
		css += `/* ----- User Custom CSS ----- */\n`;
		css += this.settings.customCssSnippet || '';

		return css;
	}

	private async saveCssSnippet(cssContent: string): Promise<string> {
		const snippetDir = normalizePath(`${this.app.vault.configDir}/snippets`);
		const fileName = this.settings.generatedCssFileName || DEFAULT_SETTINGS.generatedCssFileName;
		const filePath = normalizePath(`${snippetDir}/${fileName}`);
		try {
			if (!await this.app.vault.adapter.exists(snippetDir)) {
				await this.app.vault.adapter.mkdir(snippetDir);
				new Notice(`Created CSS snippets dir: ${snippetDir}`);
			}
			const finalCss = cssContent + "\n\n/* ----- User Custom CSS ----- */\n" + (this.settings.customCssSnippet || '');
			await this.app.vault.adapter.write(filePath, finalCss); // Always overwrite
			return filePath;
		} catch (error) {
			console.error(`Error saving CSS snippet to ${filePath}:`, error);
			throw new Error(`Could not save CSS snippet.`);
		}
	}

	private async createUniqueNoteTemplate(): Promise<string> {
		const templateFileName = (this.settings.uniqueNoteTemplateFileName || DEFAULT_SETTINGS.uniqueNoteTemplateFileName).endsWith('.md')
			? this.settings.uniqueNoteTemplateFileName
			: `${this.settings.uniqueNoteTemplateFileName}.md`;
		const folderPath = normalizePath(this.settings.helperFileFolder || '');
		const filePath = normalizePath(folderPath ? `${folderPath}/${templateFileName}` : templateFileName);
		const content = `---
date: {{date}}T{{time}}
tags: []
cssclasses: [] # Add classes like [page-white, pen-blue, page-grid]
---

# {{title}}

`;
		try {
			if (folderPath && !(await this.app.vault.adapter.exists(folderPath))) {
				await this.app.vault.adapter.mkdir(folderPath);
				new Notice(`Created folder: ${folderPath}`);
			}
			await this.app.vault.adapter.write(filePath, content);
			return filePath;
		} catch (error) {
			console.error(`Error writing template file ${filePath}:`, error);
			throw new Error(`Could not write Unique Note template file at ${filePath}.`);
		}
	}

	private async createAutocompleteHelperFile(): Promise<void> {
		const templateFileName = (this.settings.cssHelperFileName || DEFAULT_SETTINGS.cssHelperFileName).endsWith('.md')
			? this.settings.cssHelperFileName
			: `${this.settings.cssHelperFileName}.md`;
		const folderPath = normalizePath(this.settings.helperFileFolder || '');
		const filePath = normalizePath(folderPath ? `${folderPath}/${templateFileName}` : templateFileName);

		let autocompleteClasses = [...CSS_CLASSES_FOR_AUTOCOMPLETE];
		const customCss = this.settings.customCssSnippet || '';
		const regex = /\.((?:page|pen)-[a-zA-Z0-9_-]+)/g;
		let match;
		while ((match = regex.exec(customCss)) !== null) {
			autocompleteClasses.push(match[1]);
		}
		autocompleteClasses = [...new Set(autocompleteClasses)];

		const classListYaml = autocompleteClasses.sort().map(c => `  - ${c}`).join('\n');

		const content = `---
date: {{date:YYYY-MM-DD}}
tags: [Meta, css-helper]
cssclasses:
${classListYaml}
---

<div style="display: none;">
  <i>This file enables CSS class autocomplete (including classes found in the 'Append Custom CSS' setting). Ensure '${this.settings.generatedCssFileName}' is enabled in Appearance Settings.</i>
</div>
`;
		try {
			if (folderPath && !(await this.app.vault.adapter.exists(folderPath))) {
				await this.app.vault.adapter.mkdir(folderPath);
			}
			await this.app.vault.adapter.write(filePath, content);
		} catch (error) {
			console.error(`Error writing helper file ${filePath}:`, error);
			this.handleError(new Error(`Could not write helper file.`));
		}
	}

	async generateHelperFiles() {
		try {
			new Notice('Inkporter: Generating helper files...');
			const cssContent = this.generateStaticCssSnippet();
			await this.saveCssSnippet(cssContent);
			await this.createUniqueNoteTemplate();
			await this.createAutocompleteHelperFile();
			new Notice(`Generated/Updated CSS snippet '${this.settings.generatedCssFileName}'. Enable it in Appearance.`, 10000);
			new Notice(`Created/Updated template '${this.settings.uniqueNoteTemplateFileName}' & helper '${this.settings.cssHelperFileName}' in '${this.settings.helperFileFolder || 'Vault Root'}'.`);
		} catch (error) { this.handleError(error); }
	}

	// --- Utility Methods ---
	private handleError(error: unknown) {
		const m = error instanceof Error ? error.message : 'Unknown error';
		new Notice(`Inkporter Error: ${m}`, 10000);
		console.error("Inkporter Error:", error);
	}
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}
	async saveSettings() {
		await this.saveData(this.settings);
	}
}

// --- Preview Modal ---
class PreviewModal extends Modal {
	private u: string | null = null;
	constructor(app: App, private i: ProcessedImage, private cb: (c: boolean) => void) {
		super(app);
	}
	onOpen() {
		const e = this.contentEl;
		e.empty();
		e.addClass('Inkporter-modal');
		e.createEl('h2', { text: 'Preview' });
		if (!this.i.buffer || this.i.buffer.byteLength === 0) {
			e.createEl('p', { text: 'Preview Error: Empty Buffer' });
			new Setting(e).addButton(b => b.setButtonText('Close').onClick(() => { this.cb(false); this.close(); }));
			return;
		}
		try {
			this.u = URL.createObjectURL(new Blob([this.i.buffer], { type: 'image/png' }));
			e.createEl('img', { attr: { src: this.u, alt: 'Preview' }, cls: 'Inkporter-preview-image' });
			new Setting(e).addButton(b => b.setButtonText('Insert').setCta().onClick(() => { this.cb(true); this.close(); }))
				.addButton(b => b.setButtonText('Cancel').onClick(() => { this.cb(false); this.close(); }));
		} catch (err) {
			e.createEl('p', { text: `Preview Error: ${err instanceof Error ? err.message : err}` });
			console.error("Preview Error:", err);
			new Setting(e).addButton(b => b.setButtonText('Close').onClick(() => { this.cb(false); this.close(); }));
		}
	}
	onClose() {
		if (this.u) { URL.revokeObjectURL(this.u); this.u = null; }
		this.contentEl.empty();
	}
}

// --- Settings Tab ---
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
		// --- Image Processing Settings ---
		containerEl.createEl('h3', { text: 'Image Processing' });
		new Setting(containerEl)
			.setName('Output directory')
			.setDesc('Folder for processed images (relative to vault root).')
			.addText(t => t.setPlaceholder(DEFAULT_SETTINGS.outputDirectory).setValue(this.plugin.settings.outputDirectory).onChange(async (v) => {
				this.plugin.settings.outputDirectory = v || DEFAULT_SETTINGS.outputDirectory;
				await this.plugin.saveSettings();
			}));
		new Setting(containerEl)
			.setName('File name template')
			.setDesc('Naming pattern for images. Placeholders: {timestamp}, {date}, {shortId}, {uuid}.')
			.addText(t => t.setPlaceholder(DEFAULT_SETTINGS.fileNameTemplate).setValue(this.plugin.settings.fileNameTemplate).onChange(async (v) => {
				this.plugin.settings.fileNameTemplate = v || DEFAULT_SETTINGS.fileNameTemplate;
				await this.plugin.saveSettings();
			}));
		new Setting(containerEl)
			.setName('Max Width')
			.setDesc('Resize image if wider than this (pixels). 0 = no limit.')
			.addText(t => t.setPlaceholder(DEFAULT_SETTINGS.maxWidth.toString() || '0 (No Limit)').setValue(this.plugin.settings.maxWidth.toString()).onChange(debounce(async (v) => {
				const n = parseInt(v, 10);
				this.plugin.settings.maxWidth = (!isNaN(n) && n >= 0) ? n : 0;
				await this.plugin.saveSettings();
				t.setValue(this.plugin.settings.maxWidth.toString());
			}, 500, true)));
		new Setting(containerEl)
			.setName('Max Height')
			.setDesc('Resize image if taller than this (pixels). 0 = no limit.')
			.addText(t => t.setPlaceholder(DEFAULT_SETTINGS.maxHeight.toString() || '0 (No Limit)').setValue(this.plugin.settings.maxHeight.toString()).onChange(debounce(async (v) => {
				const n = parseInt(v, 10);
				this.plugin.settings.maxHeight = (!isNaN(n) && n >= 0) ? n : 0;
				await this.plugin.saveSettings();
				t.setValue(this.plugin.settings.maxHeight.toString());
			}, 500, true)));
		this.createSliderSetting(containerEl, { name: 'Contrast Adjustment', desc: 'Pre-process image contrast (-100 to +100).', min: -100, max: 100, step: 1, settingKey: 'contrastAdjustment' });
		this.createSliderSetting(containerEl, { name: 'Alpha Threshold', desc: 'Transparency sensitivity (0=Transparent, 255=Opaque).', min: 0, max: 255, step: 1, settingKey: 'alphaThreshold' });
		this.createSliderSetting(containerEl, { name: 'Edge Feathering', desc: 'Soften ink edges (0-50 pixels). 0 = sharp edge.', min: 0, max: 50, step: 1, settingKey: 'featheringRange' });
		new Setting(containerEl)
			.setName('Process light on dark')
			.setDesc('Enable if the original image has light ink on dark background.')
			.addToggle(t => t.setValue(this.plugin.settings.invertProcessing).onChange(async (v) => {
				this.plugin.settings.invertProcessing = v;
				await this.plugin.saveSettings();
			}));
		let gsToggle: ToggleComponent | null = null;
		new Setting(containerEl)
			.setName('Preserve ink color')
			.setDesc('Keep the original ink color. If off, ink becomes black/gray.')
			.addToggle(t => t.setValue(this.plugin.settings.preserveInkColor).onChange(async (v) => {
				this.plugin.settings.preserveInkColor = v;
				await this.plugin.saveSettings();
				if (gsToggle) {
					gsToggle.setDisabled(v);
					if (v && this.plugin.settings.convertToGrayscale) {
						this.plugin.settings.convertToGrayscale = false;
						gsToggle.setValue(false);
						await this.plugin.saveSettings();
					}
				}
			}));
		new Setting(containerEl)
			.setName('Convert ink to grayscale')
			.setDesc('Convert non-preserved ink to grayscale (instead of black).')
			.addToggle(t => {
				gsToggle = t;
				t.setValue(this.plugin.settings.convertToGrayscale).setDisabled(this.plugin.settings.preserveInkColor)
					.onChange(async (v) => {
						if (!this.plugin.settings.preserveInkColor) {
							this.plugin.settings.convertToGrayscale = v;
							await this.plugin.saveSettings();
						}
					});
			});
		new Setting(containerEl)
			.setName('Use luminosity for brightness')
			.setDesc('Calculate brightness perceptually (usually better).')
			.addToggle(t => t.setValue(this.plugin.settings.useLuminosityForAlpha).onChange(async (v) => {
				this.plugin.settings.useLuminosityForAlpha = v;
				await this.plugin.saveSettings();
			}));

		// --- Helper File Generation Section ---
		containerEl.createEl('h3', { text: 'Notebook Styles Helper Generation' });
		containerEl.createEl('p', { text: 'Generate helper files to assist with using external notebook CSS themes. This creates a static CSS snippet (containing many common styles) and Markdown files for templates & autocomplete.' }).style.fontSize = 'var(--font-ui-small)';
		new Setting(containerEl)
			.setName('Generated CSS Filename')
			.setDesc('Name of the CSS snippet file saved in `.obsidian/snippets/`.')
			.addText(text => text.setPlaceholder(DEFAULT_SETTINGS.generatedCssFileName).setValue(this.plugin.settings.generatedCssFileName).onChange(debounce(async (value) => {
				this.plugin.settings.generatedCssFileName = value.endsWith('.css') ? value : `${value || DEFAULT_SETTINGS.generatedCssFileName}.css`;
				await this.plugin.saveSettings();
				text.setValue(this.plugin.settings.generatedCssFileName);
			}, 500, true)));
		new Setting(containerEl)
			.setName('Helper Files Folder')
			.setDesc('Vault folder for Markdown helper files (e.g., Utilities/Templates). Blank for vault root.')
			.addText(text => text.setPlaceholder(DEFAULT_SETTINGS.helperFileFolder || 'Vault Root').setValue(this.plugin.settings.helperFileFolder).onChange(debounce(async (value) => {
				this.plugin.settings.helperFileFolder = value.trim().replace(/^\/+|\/+$/g, '');
				await this.plugin.saveSettings();
				text.setValue(this.plugin.settings.helperFileFolder);
			}, 500, true)));
		new Setting(containerEl)
			.setName('Unique Note Template Filename')
			.setDesc('Name for the basic Markdown template file.')
			.addText(text => text.setPlaceholder(DEFAULT_SETTINGS.uniqueNoteTemplateFileName).setValue(this.plugin.settings.uniqueNoteTemplateFileName).onChange(debounce(async (value) => {
				this.plugin.settings.uniqueNoteTemplateFileName = value.endsWith('.md') ? value : `${value || DEFAULT_SETTINGS.uniqueNoteTemplateFileName}.md`;
				await this.plugin.saveSettings();
				text.setValue(this.plugin.settings.uniqueNoteTemplateFileName);
			}, 500, true)));
		new Setting(containerEl)
			.setName('CSS Helper Filename')
			.setDesc('Name for the Markdown file aiding CSS class autocomplete.')
			.addText(text => text.setPlaceholder(DEFAULT_SETTINGS.cssHelperFileName).setValue(this.plugin.settings.cssHelperFileName).onChange(debounce(async (value) => {
				this.plugin.settings.cssHelperFileName = value.endsWith('.md') ? value : `${value || DEFAULT_SETTINGS.cssHelperFileName}.md`;
				await this.plugin.saveSettings();
				text.setValue(this.plugin.settings.cssHelperFileName);
			}, 500, true)));

		// --- Custom CSS Snippet Area ---
		new Setting(containerEl)
			.setName('Append Custom CSS Rules')
			.setDesc('Add your own CSS rules here (e.g., define custom page/pen classes). These rules will be appended to the generated CSS snippet file. Classes defined here starting with `.page-` or `.pen-` will automatically be added to the autocomplete helper.')
			.addTextArea(text => {
				text.inputEl.rows = 10;
				text.inputEl.cols = 60;
				text.inputEl.style.width = '100%';
				text.inputEl.style.fontFamily = 'monospace';
				text.setPlaceholder('/* Example: */\n.page-my-sample {\n  --page-color: #DFFFD6;\n  color-scheme: light;\n  background-color: var(--page-color);\n color: var(--accent-color);\n}\n\n.pen-my-custom-pen {\n  --accent-color: #C71585;\n  --accent-color-trans: color-mix(in srgb, var(--accent-color) 15%, transparent);\n}')
					.setValue(this.plugin.settings.customCssSnippet)
					.onChange(debounce(async (value) => {
						this.plugin.settings.customCssSnippet = value;
						await this.plugin.saveSettings();
					}, 750));
			});

		// --- Generate Button ---
		new Setting(containerEl)
			.setName('Generate Helper Files')
			.setDesc('Create or overwrite the CSS snippet (including your appended custom CSS) and the two Markdown helper files.')
			.addButton(button => button
				.setButtonText("Generate Helper Files")
				.setTooltip(`Generates '${this.plugin.settings.generatedCssFileName}', '${this.plugin.settings.uniqueNoteTemplateFileName}', and '${this.plugin.settings.cssHelperFileName}'`)
				.onClick(async () => {
					button.setDisabled(true).setButtonText("Generating...");
					await this.plugin.generateHelperFiles();
					button.setDisabled(false).setButtonText("Generate Helper Files");
				}));

		const helpText = containerEl.createEl('p');
		helpText.innerHTML = `<b>Usage Steps:</b><br>1. Click "Generate Helper Files".<br>2. Go to <b>Settings → Appearance → CSS Snippets</b> and enable '<code>${this.plugin.settings.generatedCssFileName}</code>'.<br>3. Use the generated template ('<code>${this.plugin.settings.helperFileFolder}/${this.plugin.settings.uniqueNoteTemplateFileName}</code>') with a templating plugin.<br>4. When creating notes, edit the <code>cssclasses:</code> list. Autocomplete uses the helper file ('<code>${this.plugin.settings.helperFileFolder}/${this.plugin.settings.cssHelperFileName}</code>').`;
		helpText.style.marginTop = '1em';
		helpText.style.fontSize = 'var(--font-ui-small)';
	}

	private createSliderSetting(containerEl: HTMLElement, options: { name: string, desc: string, min: number, max: number, step: number, settingKey: keyof InkporterSettings }) {
		const s = new Setting(containerEl).setName(options.name).setDesc(options.desc);
		let sc: SliderComponent;
		let tc: TextComponent;
		const k = options.settingKey;
		s.addText(t => {
			tc = t;
			const cv = this.plugin.settings[k] as number ?? options.min;
			t.setValue(cv.toString()).setPlaceholder(options.min.toString()).onChange(debounce(async (v) => {
				const n = options.step === 1 ? parseInt(v, 10) : parseFloat(v);
				if (!isNaN(n) && n >= options.min && n <= options.max) {
					(this.plugin.settings[k] as number) = n;
					await this.plugin.saveSettings();
					if (sc) sc.setValue(n);
				} else {
					const rv = this.plugin.settings[k] as number ?? options.min;
					t.setValue(rv.toString());
					new Notice(`${options.name} must be ${options.min}-${options.max}.`);
				}
			}, 500, true));
		});
		s.addSlider(sl => {
			sc = sl;
			const cv = this.plugin.settings[k] as number ?? options.min;
			sl.setLimits(options.min, options.max, options.step).setValue(cv).onChange(async (v) => {
				(this.plugin.settings[k] as number) = v;
				await this.plugin.saveSettings();
				tc.setValue(v.toString());
			}).setDynamicTooltip();
		});
	}
}
