import {
	Plugin, Notice, MarkdownView, Modal, App, Setting, PluginSettingTab,
	normalizePath, Platform, requestUrl, TextComponent
} from 'obsidian';

// --- Interface Definitions ---
interface ProcessedImage { buffer: ArrayBuffer; fileName: string; }

interface InkporterSettings {
	outputDirectory: string; 
	fileNameTemplate: string; 
	maxWidth: number; 
	maxHeight: number; 
	apiServerUrl: string;
	aiExtractionSensitivity: number;
    pythonServerDirectory: string;
    targetHardware: string;
}

const DEFAULT_SETTINGS: InkporterSettings = {
	outputDirectory: 'FieldNotes',
	fileNameTemplate: 'ink-{date}-{shortId}',
	maxWidth: 0,
	maxHeight: 0,
	apiServerUrl: 'http://127.0.0.1:8000',
	aiExtractionSensitivity: 50,
    pythonServerDirectory: '',
    targetHardware: 'auto'
};

// --- Plugin Class ---
export default class Inkporter extends Plugin {
	settings: InkporterSettings;
    activeServerProcess: any = null;
    serverStatus: 'STOPPED' | 'STARTING' | 'RUNNING' | 'ERROR' = 'STOPPED';
    settingsTab: InkporterSettingsTab;

	async onload() {
		await this.loadSettings();
        const ribbonIconEl = this.addRibbonIcon('scissors', 'Inkporter: Extract Image from File', (evt: MouseEvent) => {
			this.runImageProcessing(true);
		});
		ribbonIconEl.addClass('inkporter-ribbon-class');

		this.addCommand({
			id: 'inkporter',
			name: Platform.isMobile ? 'Process image from file/clipboard' : 'Process neural extraction from clipboard',
			callback: async () => { this.runImageProcessing(false); }
		});
		this.addCommand({
			id: 'inkporter-file-picker',
			name: 'Process neural extraction from file',
            hotkeys: [{ modifiers: ["Mod", "Alt"], key: "I" }],
			callback: async () => { this.runImageProcessing(true); }
		});
		this.addCommand({
            id: 'inkporter-start-server',
            name: 'Start Local Neural API Server',
            callback: () => { this.startNeuralServer(); }
        });
		this.settingsTab = new InkporterSettingsTab(this.app, this);
		this.addSettingTab(this.settingsTab);
        
        this.registerEvent(this.app.workspace.on('quit', () => this.stopNeuralServer()));
	}
    
    async onunload() {
        this.stopNeuralServer();
    }

    // --- Neural Server Launcher ---
    public startNeuralServer() {
        if (Platform.isMobile) {
            new Notice("Server cannot be hosted natively on iOS/Android."); return; 
        }
        try {
            const { spawn } = require('child_process');
            const path = require('path');
            const fs = require('fs');

            let cwdPath = this.settings.pythonServerDirectory.trim();
            const basePath = (this.app.vault.adapter as any).getBasePath?.() || '';

            if (!cwdPath) {
                if (!basePath) { new Notice("Error: Cannot resolve working directory."); return; }
                cwdPath = path.join(basePath, this.manifest.dir, 'engine');
            }
            
            const isWin = process.platform === "win32";
            let executable = 'python';
            const venvPath = path.join(cwdPath, '.venv');
            if (fs.existsSync(venvPath)) {
                executable = isWin ? path.join(venvPath, 'Scripts', 'python.exe') : path.join(venvPath, 'bin', 'python');
            }
            
            if (this.activeServerProcess) {
                new Notice("Neural API Server is already running!"); return;
            }
            
            this.serverStatus = 'STARTING';
            this.settingsTab?.display();
            new Notice(`Inkporter: Spinning up Neural Server in ${cwdPath}...`);
            this.activeServerProcess = spawn(executable, ['-m', 'uvicorn', 'inkporter_server:app', '--host', '0.0.0.0', '--port', '8000'], { cwd: cwdPath });
            
            this.activeServerProcess.stdout?.on('data', (data: any) => {
                const msg = data.toString();
                console.log("[Neural Core]: ", msg);
                if (msg.includes("Application startup complete") || msg.includes("Uvicorn running on")) {
                    this.serverStatus = 'RUNNING';
                    this.settingsTab?.display();
                    new Notice("Neural API Server Online and Ready!", 5000);
                }
            });
            this.activeServerProcess.stderr?.on('data', (data: any) => { 
                const msg = data.toString();
                if (msg.includes("Application startup complete") || msg.includes("Uvicorn running on")) {
                    console.log("[Neural Core]: ", msg);
                    this.serverStatus = 'RUNNING';
                    this.settingsTab?.display();
                    new Notice("Neural API Server Online and Ready!", 5000);
                } else {
                    console.warn("[Neural Core Warning]: ", msg); 
                    if (msg.toLowerCase().includes("error") || msg.toLowerCase().includes("failed") || msg.toLowerCase().includes("exception")) {
                        this.serverStatus = 'ERROR';
                        this.settingsTab?.display();
                    }
                }
            });
            this.activeServerProcess.on('close', (code: number) => {
                this.activeServerProcess = null;
                if (this.serverStatus !== 'STOPPED') this.serverStatus = 'ERROR';
                this.settingsTab?.display();
            });
            this.activeServerProcess.on('error', (err: any) => { 
                console.error(err); 
                this.activeServerProcess = null;
                this.serverStatus = 'ERROR';
                this.settingsTab?.display();
                new Notice(`Error launching server: ${err.message}`); 
            });
        } catch (e) {
            console.error(e);
            this.serverStatus = 'ERROR';
            this.settingsTab?.display();
            new Notice("Failed to launch child process. Are you in a restricted environment?");
        }
    }
    
    public stopNeuralServer() {
        if (this.activeServerProcess) {
            try {
                if (process.platform === 'win32') {
                    const { exec } = require('child_process');
                    exec(`taskkill /pid ${this.activeServerProcess.pid} /T /F`);
                } else {
                    this.activeServerProcess.kill('SIGINT');
                }
                this.activeServerProcess = null;
                this.serverStatus = 'STOPPED';
                this.settingsTab?.display();
                new Notice("Neural API Server Stopped.");
            } catch (e) { console.error(e); }
        }
    }

	// --- Image Processing Methods ---
	public async installEngine() {
        if (Platform.isMobile) { new Notice("Installation is Desktop-only."); return; }
        
        const { exec } = require('child_process');
        const path = require('path');
        const fs = require('fs');

        const basePath = (this.app.vault.adapter as any).getBasePath?.();
        if (!basePath) return new Notice("Failed to resolve vault path");
        
        const engineDir = path.join(basePath, this.manifest.dir, 'engine');
        if (!fs.existsSync(engineDir)) {
            fs.mkdirSync(engineDir, { recursive: true });
        }

        const isWin = process.platform === "win32";
        const target = this.settings.targetHardware;

        const launchNativeTerminal = (torchArgs: string) => {
            if (isWin) {
                const batPath = path.join(engineDir, "install_engine.bat");
                const batContent = `@echo off
echo ========================================================
echo INKPORTER NEURAL ENGINE INSTALLER
echo ========================================================
echo.
echo Step 1: Downloading Neural Framework from GitHub...
if not exist inkporter_server.py curl -L -O https://raw.githubusercontent.com/AmadeussSystem/Inkporter/master/engine/inkporter_server.py
if not exist requirements.txt curl -L -O https://raw.githubusercontent.com/AmadeussSystem/Inkporter/master/engine/requirements.txt
if not exist inkporter_model_best.pth curl -L -O https://raw.githubusercontent.com/AmadeussSystem/Inkporter/master/engine/inkporter_model_best.pth
if %errorlevel% neq 0 (
    echo [ERROR] Failed to download neural binaries from GitHub.
    pause
    exit /b %errorlevel%
)
echo.
echo Step 2: Creating python environment (.venv) with Global inherit...
if not exist .venv (
    python -m venv .venv --copies --system-site-packages
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to create .venv. 
        echo Ensure Python 3.9+ is installed and on your system PATH.
        pause
        exit /b %errorlevel%
    )
) else (
    echo [.venv already exists, skipping creation...]
)
echo.
echo [Diagnostics]
call .venv\\Scripts\\python.exe -c "import sys; print('Python Version:', sys.version)"
call .venv\\Scripts\\python.exe -c "import struct; print('Architecture:', struct.calcsize('P') * 8, 'bit')"
echo.
echo Step 2: Downloading PyTorch and API Dependencies...
call .venv\\Scripts\\python.exe -m pip install --upgrade pip
call .venv\\Scripts\\pip install torch torchvision torchaudio ${torchArgs}
if %errorlevel% neq 0 (
    echo [ERROR] PyTorch installation failed.
    pause
    exit /b %errorlevel%
)
call .venv\\Scripts\\pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [ERROR] FastAPI requirements failed.
    pause
    exit /b %errorlevel%
)
echo.
echo ========================================================
echo SUCCESS! INKPORTER ENGINE FULLY DEPLOYED!
echo You may safely close this window and start the server!
echo ========================================================
pause
`;
                fs.writeFileSync(batPath, batContent);
                exec(`start "" "${batPath}"`, { cwd: engineDir });
                new Notice("Engine Installer launched in a separate OS Terminal window!");
            } else {
                const shPath = path.join(engineDir, "install_engine.sh");
                const shContent = `#!/bin/bash
echo "========================================================"
echo "INKPORTER NEURAL ENGINE INSTALLER"
echo "========================================================"
echo ""
echo "Step 1: Downloading Neural Framework from GitHub..."
if [ ! -f "inkporter_server.py" ]; then curl -L -O https://raw.githubusercontent.com/AmadeussSystem/Inkporter/master/engine/inkporter_server.py; fi
if [ ! -f "requirements.txt" ]; then curl -L -O https://raw.githubusercontent.com/AmadeussSystem/Inkporter/master/engine/requirements.txt; fi
if [ ! -f "inkporter_model_best.pth" ]; then curl -L -O https://raw.githubusercontent.com/AmadeussSystem/Inkporter/master/engine/inkporter_model_best.pth; fi
if [ $? -ne 0 ]; then
    echo "[ERROR] Failed to download neural binaries."
    read -p "Press Enter to close..."
    exit 1
fi
echo ""
echo "Step 2: Creating python environment (.venv) with Global inherit..."
if [ ! -d ".venv" ]; then
    python3 -m venv .venv --system-site-packages
    if [ $? -ne 0 ]; then
        echo "[ERROR] Failed to create .venv."
        echo "Ensure Python 3.9+ is installed."
        read -p "Press Enter to close..."
        exit 1
    fi
else
    echo "[.venv already exists, skipping creation...]"
fi
echo ""
echo "[Diagnostics]"
.venv/bin/python -c "import sys; print('Python Version:', sys.version)"
.venv/bin/python -c "import struct; print('Architecture:', struct.calcsize('P') * 8, 'bit')"
echo ""
echo "Step 2: Downloading PyTorch and API Dependencies..."
source .venv/bin/activate
pip install --upgrade pip
pip install torch torchvision torchaudio ${torchArgs}
if [ $? -ne 0 ]; then
    echo "[ERROR] PyTorch installation failed."
    read -p "Press Enter to close..."
    exit 1
fi
pip install -r requirements.txt
if [ $? -ne 0 ]; then
    echo "[ERROR] FastAPI requirements failed."
    read -p "Press Enter to close..."
    exit 1
fi
echo ""
echo "========================================================"
echo "SUCCESS! INKPORTER ENGINE FULLY DEPLOYED!"
echo "You may safely close this window and start the server!"
echo "========================================================"
read -p "Press Enter to close..."
`;
                fs.writeFileSync(shPath, shContent);
                fs.chmodSync(shPath, '755');
                if (process.platform === 'darwin') {
                    exec(`open -a Terminal.app "${shPath}"`, { cwd: engineDir });
                } else {
                    exec(`x-terminal-emulator -e bash "${shPath}"`, { cwd: engineDir });
                }
                new Notice("Engine Installer launched in a separate OS Terminal window!");
            }
        };

        if (target === 'nvidia' || target === 'auto') {
            exec('nvidia-smi', (smiErr: any, stdout: string) => {
                if (!smiErr) {
                    let torchArgs = "--extra-index-url https://download.pytorch.org/whl/cu121";
                    const match = stdout.match(/CUDA Version:\s*(\d+\.\d+)/);
                    if (match && match[1]) {
                        const ver = parseFloat(match[1]);
                        if (ver < 12.1) {
                            torchArgs = "--extra-index-url https://download.pytorch.org/whl/cu118";
                        }
                    }
                    launchNativeTerminal(torchArgs);
                } else if (target === 'auto' && process.platform === 'darwin') {
                    launchNativeTerminal("");
                } else {
                    if (target === 'nvidia') {
                        launchNativeTerminal("--extra-index-url https://download.pytorch.org/whl/cu121");
                    } else {
                        launchNativeTerminal("--extra-index-url https://download.pytorch.org/whl/cpu");
                    }
                }
            });
        } else if (target === 'mac') {
            launchNativeTerminal("");
        } else if (target === 'cpu') {
            launchNativeTerminal("--index-url https://download.pytorch.org/whl/cpu");
        }
    }

	private async runImageProcessing(forceFilePicker: boolean = false) {
		try {
			let p: ProcessedImage | null = null;
			new Notice('Inkporter: Submitting to Neural API...', 2000);
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
				const hw = this.settings.targetHardware;
                const msg = hw === 'cpu' ? "Extracting Ink... (This may take 3-5 seconds on CPU)" : "Extracting Ink... (Hardware Accelerated)";
                new Notice(msg, 4000);
                
                const b = await this.readFileAsArrayBuffer(f);
				const p = await this.processImage(b, f.name);
				if (p) { this.showPreviewAndSave(p); }
				else { new Notice('Inkporter: Neural Processing failed.'); }
			} catch (err) { this.handleError(err); } finally { i.remove(); }
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
							const hw = this.settings.targetHardware;
                            const msg = hw === 'cpu' ? "Extracting Ink... (This may take 3-5 seconds on CPU)" : "Extracting Ink... (Hardware Accelerated)";
                            new Notice(msg, 4000);
							const res = await this.processImage(await blob.arrayBuffer(), `clipboard-image.${hint}`);
							if (!res) new Notice('Inkporter: API fetch failed.');
							return res;
						} catch (e) { console.warn(`Process fail ${type}:`, e); continue; }
					}
				}
			}
			new Notice('No image found on clipboard.');
			return null;
		} catch (e) {
			if (e instanceof DOMException && /denied|secure/i.test(e.name)) { new Notice('Clipboard access denied.'); }
			else if (e instanceof DOMException && e.name === 'NotFoundError') { new Notice('No image found.'); }
			else { throw e; }
			return null;
		}
	}
	private async processImage(buffer: ArrayBuffer, originalFileName: string = 'processed-image.png'): Promise<ProcessedImage | null> {
		return new Promise(async (resolve, reject) => {
			if (!buffer || buffer.byteLength === 0) return reject(new Error("Input empty."));
            
            // Pre-process local bounding/scale before handing off to server to shave bandwidth
            const blob = new Blob([buffer]);
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = async () => {
                URL.revokeObjectURL(url);
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) return reject(new Error('No Canvas Context'));
                let cw = img.width, ch = img.height;
                const { maxWidth, maxHeight } = this.settings;
                let tw = cw, th = ch, resize = false;
                if (maxWidth > 0 && cw > maxWidth) { tw = maxWidth; th = Math.round(ch * (maxWidth / cw)); resize = true; }
                if (maxHeight > 0 && th > maxHeight) { const hr = maxHeight / th; th = maxHeight; tw = Math.round(tw * hr); resize = true; }
                canvas.width = tw; canvas.height = th;
                ctx.drawImage(img, 0, 0, tw, th);
                
                canvas.toBlob(async (b) => {
                    if (!b) return reject(new Error('Blob encode failed'));
                    try {
                        const localBuf = await b.arrayBuffer();
                        let serverUrl = this.settings.apiServerUrl.replace(/\/$/, "");
                        if (serverUrl.endsWith("/extract")) serverUrl = serverUrl.substring(0, serverUrl.length - 8);
                        const targetUrl = `${serverUrl}/extract?sensitivity=${this.settings.aiExtractionSensitivity}`;
                        
                        const response = await requestUrl({
                            url: targetUrl,
                            method: 'POST',
                            body: localBuf,
                            contentType: 'application/octet-stream',
                            throw: true
                        });
                        resolve({ buffer: response.arrayBuffer, fileName: this.generateFileName() });
                        
                    } catch (apiErr: any) {
                        console.error("API Integration failed:", apiErr);
                        let m = `Failed to reach Neural API. Is the Python Server running?`;
                        if (apiErr.status === 404) m += " (404 Error: Incorrect URL)";
                        if (apiErr.status === 500) m += " (500 Error: Server Exception)";
                        reject(new Error(m));
                    }
                }, "image/png");
            };
            img.onerror = (e) => reject(new Error("Failed to decode clipboard image into canvas"));
            img.src = url;
		});
	}
	private showPreviewAndSave(processed: ProcessedImage) {
		new PreviewModal(this.app, processed, (c, croppedBuffer) => { 
            if (c) {
                if (croppedBuffer) {
                    this.saveAndInsertImage({ buffer: croppedBuffer, fileName: processed.fileName });
                } else {
                    this.saveAndInsertImage(processed);
                }
            }
        }).open();
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
			}
			await this.app.vault.adapter.writeBinary(fp, image.buffer);
			new Notice(`Neural Extraction Saved: ${fp}`);
			const v = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (v && v.file) {
				const e = v.editor;
				const f = this.app.vault.getFileByPath(fp);
				if (f) {
					let lt = this.app.fileManager.generateMarkdownLink(f, v.file.path);
                    if (!lt.startsWith('!')) lt = '!' + lt;
					e.replaceSelection(lt);
				}
			}
		} catch (e) { this.handleError(e); }
	}

	private handleError(error: unknown) {
		const m = error instanceof Error ? error.message : 'Unknown error';
		new Notice(`Inkporter Error: ${m}`, 10000);
		console.error("Inkporter Error:", error);
	}
	async loadSettings() { this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()); }
	async saveSettings() { await this.saveData(this.settings); }
}

// --- Preview Modal with Interactive Cropper ---
class PreviewModal extends Modal {
	private url: string | null = null;
    private img: HTMLImageElement | null = null;
    
    // Cropper state
    private isDragging = false;
    private mStartX = 0; private mStartY = 0;
    private mCurrX = 0; private mCurrY = 0;
    private cropBox: {x: number, y: number, w: number, h: number} | null = null;
    
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D | null = null;

	constructor(app: App, private originalImage: ProcessedImage, private callback: (confirmed: boolean, croppedBuffer: ArrayBuffer | null) => void) {
		super(app);
	}
	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('Inkporter-modal');
        contentEl.createEl('style', {text: `
            .Inkporter-modal { max-width: 90vw !important; max-height: 90vh !important; }
            .ip-canvas-container { 
                position: relative; margin-top: 10px; border: 2px solid var(--background-modifier-border);
                border-radius: 4px; cursor: crosshair; overflow: hidden;
                /* Light Checkerboard background so black ink is visible */
                background-image: linear-gradient(45deg, #ccc 25%, transparent 25%),
                                  linear-gradient(135deg, #ccc 25%, transparent 25%),
                                  linear-gradient(45deg, transparent 75%, #ccc 75%),
                                  linear-gradient(135deg, transparent 75%, #ccc 75%);
                background-size: 20px 20px;
                background-position: 0 0, 10px 0, 10px -10px, 0px 10px;
                background-color: #eee;
            }
            .ip-canvas { display: block; width: 100%; height: auto; max-height: 60vh; }
        `});
        
		contentEl.createEl('h2', { text: 'Extraction Preview (Click & Drag to Crop)' });
        
		if (!this.originalImage.buffer || this.originalImage.buffer.byteLength === 0) {
			contentEl.createEl('p', { text: 'Preview Error: Empty Buffer' });
			new Setting(contentEl).addButton(b => b.setButtonText('Close').onClick(() => { this.callback(false, null); this.close(); }));
			return;
		}
		try {
			this.url = URL.createObjectURL(new Blob([this.originalImage.buffer], { type: 'image/png' }));
            this.img = new Image();
            this.img.onload = () => this.setupCanvas();
            this.img.onerror = () => { contentEl.createEl('p', { text: 'Failed to decode neural image payload.'}); }
            this.img.src = this.url;
            
            const cc = contentEl.createDiv({ cls: 'ip-canvas-container' });
            this.canvas = cc.createEl('canvas', { cls: 'ip-canvas' });
            this.ctx = this.canvas.getContext('2d');
            
			new Setting(contentEl)
                .addButton(b => b.setButtonText('Reset Crop').onClick(() => { this.cropBox = null; this.redraw(); }))
                .addButton(b => b.setButtonText('Insert').setCta().onClick(() => { this.handleInsert(); }))
				.addButton(b => b.setButtonText('Cancel').onClick(() => { this.callback(false, null); this.close(); }));
		} catch (err) {
			contentEl.createEl('p', { text: `Preview Error: ${err instanceof Error ? err.message : err}` });
			new Setting(contentEl).addButton(b => b.setButtonText('Close').onClick(() => { this.callback(false, null); this.close(); }));
		}
	}
    
    private setupCanvas() {
        if (!this.img || !this.ctx) return;
        this.canvas.width = this.img.width;
        this.canvas.height = this.img.height;
        
        this.canvas.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            const pos = this.getMousePos(e);
            this.mStartX = pos.x; this.mStartY = pos.y;
            this.mCurrX = pos.x; this.mCurrY = pos.y;
            this.cropBox = null;
            this.redraw();
        });
        this.canvas.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            const pos = this.getMousePos(e);
            this.mCurrX = pos.x; this.mCurrY = pos.y;
            this.redraw();
        });
        window.addEventListener('mouseup', () => {
            if (this.isDragging) {
                this.isDragging = false;
                if (Math.abs(this.mCurrX - this.mStartX) > 10 && Math.abs(this.mCurrY - this.mStartY) > 10) {
                    this.cropBox = {
                        x: Math.min(this.mStartX, this.mCurrX),
                        y: Math.min(this.mStartY, this.mCurrY),
                        w: Math.abs(this.mCurrX - this.mStartX),
                        h: Math.abs(this.mCurrY - this.mStartY)
                    };
                } else { this.cropBox = null; }
                this.redraw();
            }
        });
        this.redraw();
    }
    
    private getMousePos(evt: MouseEvent) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        return { x: (evt.clientX - rect.left) * scaleX, y: (evt.clientY - rect.top) * scaleY };
    }
    
    private redraw() {
        if (!this.ctx || !this.img) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(this.img, 0, 0);
        
        let cx = 0, cy = 0, cw = 0, ch = 0;
        let drawing = false;
        
        if (this.isDragging) {
            cx = Math.min(this.mStartX, this.mCurrX); cy = Math.min(this.mStartY, this.mCurrY);
            cw = Math.abs(this.mCurrX - this.mStartX); ch = Math.abs(this.mCurrY - this.mStartY);
            drawing = true;
        } else if (this.cropBox) {
            cx = this.cropBox.x; cy = this.cropBox.y; cw = this.cropBox.w; ch = this.cropBox.h;
            drawing = true;
        }
        
        if (drawing && cw > 0 && ch > 0) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            this.ctx.fillRect(0, 0, this.canvas.width, cy);
            this.ctx.fillRect(0, cy, cx, ch);
            this.ctx.fillRect(cx + cw, cy, this.canvas.width - cx - cw, ch);
            this.ctx.fillRect(0, cy + ch, this.canvas.width, this.canvas.height - cy - ch);
            
            this.ctx.strokeStyle = '#00ff00';
            this.ctx.lineWidth = Math.max(2, this.canvas.width / 500); 
            this.ctx.strokeRect(cx, cy, cw, ch);
        }
    }
    
    private handleInsert() {
        if (this.cropBox && this.img) {
            const expCanvas = document.createElement('canvas');
            expCanvas.width = this.cropBox.w; expCanvas.height = this.cropBox.h;
            const expCtx = expCanvas.getContext('2d');
            if (expCtx) {
                expCtx.drawImage(this.img, this.cropBox.x, this.cropBox.y, this.cropBox.w, this.cropBox.h, 0, 0, this.cropBox.w, this.cropBox.h);
                expCanvas.toBlob(async (b) => {
                    if (b) {
                        const arr = await b.arrayBuffer();
                        this.callback(true, arr);
                    } else { this.callback(true, null); }
                    this.close();
                }, 'image/png');
                return;
            }
        }
        this.callback(true, null);
        this.close();
    }

	onClose() {
		if (this.url) { URL.revokeObjectURL(this.url); this.url = null; }
		this.contentEl.empty();
	}
}



// --- Settings Tab ---
class InkporterSettingsTab extends PluginSettingTab {
	plugin: Inkporter;
	constructor(app: App, plugin: Inkporter) { super(app, plugin); this.plugin = plugin; }
	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl('h2', { text: 'Inkporter Configuration' });
        
        // --- Setup Guide ---
        const setupDiv = containerEl.createDiv({ cls: 'inkporter-setup-guide' });
        setupDiv.style.padding = "15px";
        setupDiv.style.backgroundColor = "var(--background-secondary)";
        setupDiv.style.borderRadius = "8px";
        setupDiv.style.marginBottom = "20px";
        setupDiv.style.border = "1px solid var(--background-modifier-border)";
        
        setupDiv.createEl('h3', { text: '🤖 1-Click Engine Installer', cls: 'inkporter-setup-title', attr: { style: "margin-top: 0px;" }});
        setupDiv.createEl('p', { text: 'Inkporter bundles an incredibly powerful Neural Engine. Click the button below to silently create a highly isolated Python Environment and install PyTorch without touching a terminal. (Requires Python 3.9+ installed on your computer)' });
        
        new Setting(setupDiv)
            .setName('Select Local AI Hardware Accelerator')
            .setDesc('Crucial: If you are on an Intel/AMD workstation or a weak laptop, please explicitly choose CPU Only. The NVIDIA payload download size is massive. (2.5GB).')
            .addDropdown(d => {
                d.addOption('auto', '🔧 Auto-Detect Hardware');
                d.addOption('nvidia', '🚀 NVIDIA RTX/GTX GPU (CUDA)');
                d.addOption('mac', '🍎 Apple Silicon (M1/M2/M3 Mac)');
                d.addOption('cpu', '🐢 Basic CPU Only (Intel/AMD)');
                d.setValue(this.plugin.settings.targetHardware);
                d.onChange(async (v) => { this.plugin.settings.targetHardware = v; await this.plugin.saveSettings(); });
            });

        const btnDiv = setupDiv.createDiv({ attr: { style: "display: flex; gap: 10px; margin-top: 15px;" }});
        const installBtn = btnDiv.createEl('button', { text: '⚡ Install Python Engine', cls: 'mod-cta' });
        installBtn.onclick = () => this.plugin.installEngine();
        
        const donateBtn = btnDiv.createEl('button', { text: 'Support the Developer ❤️' });
        donateBtn.onclick = () => window.open('https://github.com/sponsors/AmadeussSystem', '_blank');
        // --- Server Dashboard ---
        const dashboardDiv = containerEl.createDiv({ cls: 'inkporter-server-dashboard' });
        dashboardDiv.style.padding = "15px";
        dashboardDiv.style.backgroundColor = "var(--background-secondary)";
        dashboardDiv.style.borderRadius = "8px";
        dashboardDiv.style.marginBottom = "20px";
        dashboardDiv.style.border = "1px solid var(--background-modifier-border-hover)";
        dashboardDiv.style.display = "flex";
        dashboardDiv.style.flexDirection = "column";
        dashboardDiv.style.gap = "10px";
        
        let statusColor = "var(--text-muted)";
        let statusText = "Stopped";
        if (this.plugin.serverStatus === 'RUNNING') { statusColor = "#00ff00"; statusText = "Online & Ready"; }
        else if (this.plugin.serverStatus === 'STARTING') { statusColor = "#eeff00"; statusText = "Booting up..."; }
        else if (this.plugin.serverStatus === 'ERROR') { statusColor = "#ff4444"; statusText = "Error! Check Console."; }
        
        const headerRow = dashboardDiv.createDiv({ attr: { style: "display: flex; justify-content: space-between; align-items: center;" }});
        headerRow.createEl('h3', { text: '🖥️ Neural Server Dashboard', attr: { style: "margin: 0;" }});
        
        const badge = headerRow.createDiv({ attr: { style: `padding: 4px 10px; border-radius: 12px; font-weight: bold; font-size: 13px; background: rgba(0,0,0,0.5); color: ${statusColor}; border: 1px solid ${statusColor}` }});
        badge.innerText = `Status: ${statusText}`;

        const controlDiv = dashboardDiv.createDiv({ attr: { style: "display: flex; gap: 10px; margin-top: 5px;" }});
        
        const startBtn = controlDiv.createEl('button', { text: '▶️ Start Backend', cls: 'mod-cta' });
        if (this.plugin.serverStatus === 'RUNNING' || this.plugin.serverStatus === 'STARTING') startBtn.disabled = true;
        startBtn.onclick = () => this.plugin.startNeuralServer();

        const stopBtn = controlDiv.createEl('button', { text: '🛑 Stop Server' });
        if (this.plugin.serverStatus === 'STOPPED') stopBtn.disabled = true;
        stopBtn.onclick = () => this.plugin.stopNeuralServer();

        const restartBtn = controlDiv.createEl('button', { text: '🔄 Restart' });
        if (this.plugin.serverStatus === 'STOPPED') restartBtn.disabled = true;
        restartBtn.onclick = () => { 
            this.plugin.stopNeuralServer(); 
            new Notice("Rebooting Server...");
            setTimeout(() => { this.plugin.startNeuralServer(); }, 1500); 
        };

		containerEl.createEl('h3', { text: 'API Server Endpoint' });
		new Setting(containerEl)
			.setName('Neural API Server URL')
			.setDesc('Host and PORT of your running Python Server (e.g., http://localhost:8000)')
			.addText(t => t.setValue(this.plugin.settings.apiServerUrl).onChange(async (v) => {
				this.plugin.settings.apiServerUrl = v; await this.plugin.saveSettings();
			}));
        
        new Setting(containerEl)
            .setName('Local Python Server Directory (Override)')
            .setDesc('Leave completely blank to organically use the built-in Engine folder. Only write a path here if you want to bypass the native Engine and target an advanced external directory.')
            .addText(t => t.setValue(this.plugin.settings.pythonServerDirectory).setPlaceholder('Leave empty for embedded').onChange(async (v) => {
                this.plugin.settings.pythonServerDirectory = v; await this.plugin.saveSettings();
            }));

        const s = new Setting(containerEl).setName('AI Extraction Sensitivity').setDesc('0 = Max Bleed Reject, 100 = Max Faint Pencil Preserved.');
        const k = 'aiExtractionSensitivity';
        let tc: TextComponent;
		s.addText(t => {
			tc = t;
			t.setValue(this.plugin.settings[k].toString()).onChange(async (v) => {
				const n = parseInt(v, 10);
				if (!isNaN(n) && n >= 0 && n <= 100) { this.plugin.settings[k] = n; await this.plugin.saveSettings(); }
			});
		});
		s.addSlider(sl => {
			sl.setLimits(0, 100, 1).setValue(this.plugin.settings[k]).onChange(async (v) => {
				this.plugin.settings[k] = v; await this.plugin.saveSettings(); tc.setValue(v.toString());
			}).setDynamicTooltip();
		});
        
		containerEl.createEl('h3', { text: 'Image Output' });
		new Setting(containerEl)
			.setName('Output directory')
			.setDesc('Folder for processed images (relative to vault root).')
			.addText(t => t.setPlaceholder(DEFAULT_SETTINGS.outputDirectory).setValue(this.plugin.settings.outputDirectory).onChange(async (v) => {
				this.plugin.settings.outputDirectory = v || DEFAULT_SETTINGS.outputDirectory; await this.plugin.saveSettings();
			}));
		new Setting(containerEl)
			.setName('File name template')
			.setDesc('Naming pattern for images. Placeholders: {timestamp}, {date}, {shortId}, {uuid}.')
			.addText(t => t.setPlaceholder(DEFAULT_SETTINGS.fileNameTemplate).setValue(this.plugin.settings.fileNameTemplate).onChange(async (v) => {
				this.plugin.settings.fileNameTemplate = v || DEFAULT_SETTINGS.fileNameTemplate; await this.plugin.saveSettings();
			}));
		new Setting(containerEl)
			.setName('Max Resolution Bound (Pixels)')
			.setDesc('Pre-scales image locally to max width before API submission to save network limits. 0 = Unbounded.')
			.addText(t => t.setPlaceholder(DEFAULT_SETTINGS.maxWidth.toString()).setValue(this.plugin.settings.maxWidth.toString()).onChange(async (v) => {
				const n = parseInt(v, 10);
				this.plugin.settings.maxWidth = (!isNaN(n) && n >= 0) ? n : 0;
                this.plugin.settings.maxHeight = this.plugin.settings.maxWidth;
				await this.plugin.saveSettings();
			}));
	}
}
