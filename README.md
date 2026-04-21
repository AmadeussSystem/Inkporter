# Inkporter 📝➡️📓  
**Seamlessly digitize handwritten notes into Obsidian using an ultra-fast local Neural Engine.**

---

## Why Inkporter?
Tired of manually processing notebook scans? This plugin automates the workflow while adding powerful native Obsidian integration! Watch this video to understand the motivation behind the plugin:

<p align="center">
  <a href="https://www.youtube.com/watch?v=9T9VL8_i1Tg">
    <img src="https://img.youtube.com/vi/9T9VL8_i1Tg/maxresdefault.jpg" alt="Digitizing Field Notes inside Obsidian [Showcase]" />
  </a>
</p>


| Manual Process          | Inkporter V4 Automation            |
|-------------------------|--------------------------------------|
| 20min/page in Photoshop | Instant millisecond clipboard processing |
| Manual Background Erase | PyTorch Neural-Net math extraction     |
| Static file naming      | Smart filename templates             |

---

## 🚀 Installation & The Neural Engine

Inkporter relies on an incredibly powerful, self-hosted Neural API to instantly extract your handwriting without using cloud telemetry or expensive subscriptions.

**To use this Plugin, you must first install the Neural Engine on your machine.**

### 1. Download the Engine
Go to our official Engine Repository: [https://github.com/AmadeussSystem/Inkporter](https://github.com/AmadeussSystem/Inkporter) and follow the installation instructions to install PyTorch on your machine.

### 2. Configure the Plugin
Once you have cloned the Engine onto your computer:
1. Open this plugin's Settings in Obsidian.
2. Paste the folder path into the **Local Python Server Directory** box.
3. Hit `Ctrl/Cmd + P` and execute the **"Start Local Neural API Server"** command. Obsidian will silently boot the Python AI instance in the background!

---

## 🔧 Key Features

### ✂️ Intelligent Neural Isolation 
- Extracts true ink-strokes while magically mathematically dissolving away grid lines, bleed-through, and paper shadows!
- Preserves faint pencil markings while crushing dark margins.
- **Dynamic Sensitivity Slider** allowing you to push the boundaries of bleed-rejection vs faint-line-retention.

### 🖼️ Interactive Cropper Sandbox
When you paste an image, the plugin immediately halts and spins up an interactive sandbox with a checkerboard background so that transparent black ink remains highly visible against Obsidian Dark Mode. 
- Click and drag an interactive glowing box to perfectly crop out your notebook margins before saving!

### 📂 Smart Asset Management
```yaml
# File naming templates automatically manage your Vault imports:
filename_template: "note-{date}-{shortId}"

# Supported variables:
# - {date}: YYYYMMDD
# - {timestamp}: epoch ms
# - {shortId}: 8char random hash
# - {uuid}: v4 UUID
```

---

## 📎 Usage Workflow
1. **Boot** → `Start Local Neural API Server`
2. **Scan** → Copy a photo of handwriting to your clipboard.
3. **Import** → `Process neural extraction from clipboard` (`Ctrl/Cmd+Shift+V`)
4. **Crop** → Drag the boundary box in the preview popup.
5. **Insert** → Automatically saved as a flawless transparent vector into your vault!

---

## 🌐 Compatibility
| Environment  | Support          |
|--------------|------------------|
| Obsidian     | v1.4+            |
| Engine OS    | Win/Mac/Linux    |
| Native Mobile| UI Yes / Engine No |

*Note on Mobile:* The Plugin works on iOS/Android, but cell-phones cannot run the massive PyTorch models natively. If you leave the PyTorch Engine running on your Desktop PC, you can point your Mobile Obsidian plugin to your computer's local IP address (`http://192.168.x.x:8000`) to extract images wirelessly from your phone!

---

## 🤝 Contributing
Help improve multi-ink detection, batch processing, or UI mechanics!
See our [contribution guidelines](CONTRIBUTING.md).

## 📜 License  
MIT License - See [LICENSE](LICENSE).

## 💡 Why This Name?
**Inkporter** combines:
- **Ink** (handwritten notes)
- **Port** (transfer/carry into the digital realm)
- **-er** (active tool suffix)

---

## 🛣️ Support
Found a bug? Want to help keep the lights on for this open source architecture?

❤️ **Donate:** [GitHub Sponsors](https://github.com/sponsors/AmadeussSystem)  
📧 **Email:** [amadeussystem04@gmail.com](mailto:amadeussystem04@gmail.com)  
🔍 **GitHub Issues:** [Issue Tracker](https://github.com/AmadeussSystem/inkporter/issues)  
💬 **Discord ID:** [AmadeussSystem](https://discordapp.com/users/1100777573002264637)

---

> **From the Developer**  
> "This plugin was born from 47 hours spent cleaning up scans of my Moleskine notebooks. What started as a simple javascript threshold script evolved into an obsession with building a massive localized Neural-Network to perfectly bridge analog and digital knowledge. May your handwritten wisdom live forever in both paper and pixels!" - Ayush
