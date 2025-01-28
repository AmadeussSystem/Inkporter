# Inkporter 📝➡️📓  
**Seamlessly digitize handwritten notes into Obsidian with smart ink isolation and adaptive theming**

---

## Why Inkporter?
Tired of manually processing notebook scans? This plugin automates the workflow from this  while adding powerful Obsidian integration:

<iframe title="BEST of BOTH Worlds? Digitizing Field Notes inside Obsidian [Showcase]" src="https://www.youtube.com/embed/9T9VL8_i1Tg?feature=oembed" height="113" width="200" allowfullscreen="" allow="fullscreen" style="width: 100%; height: 100%; aspect-ratio: 4 / 3;"></iframe>

| Manual Process          | Inkporter Automation         |
|-------------------------|------------------------------|
| 20min/page in Photoshop | Instant clipboard processing |
| Manual CSS theming      | Auto-adaptive ink colors     |
| Static file naming      | Smart filename templates     |
| No OCR integration      | Optional text extraction     |

---

## 🚀 Installation

### Via Obsidian
1. **Settings** → **Community plugins** → **Browse**
2. Search "Inkporter" → Install

### Manual
1. Download the latest release.
2. Copy to `vault/.obsidian/plugins`.

---

## 🔧 Key Features

### ✂️ Intelligent Ink Isolation
![Alpha Threshold Demo](https://example.com/alpha-demo.gif)  
- Real-time preview of processed images
- Dual threshold modes:
  - **Luminosity mode** (perceptual brightness)
  - **Simple RGB average**
- Grayscale conversion option

### 🌈 Dynamic Theming
```css
/* Apply to note CSS classes */
.inkporter-scan {
  --ink-color: var(--text-normal);
  --paper-color: var(--background-primary);
  filter: contrast(120%);
}
```

### 📂 Smart Asset Management
```yaml
# File naming templates
filename_template: "note-{date}-{shortId}"
# Supported variables:
# - {date}: YYYYMMDD
# - {timestamp}: epoch ms
# - {shortId}: 8char hash
# - {uuid}: v4 UUID
```

---

## 📎 Usage Workflow
1. **Scan** → Import via clipboard (`Ctrl/Cmd+Shift+V`)
2. **Preview** → Adjust settings in real-time
3. **Insert** → Automatically saved to vault
4. **Style** → Apply CSS classes for theming

![Workflow Demo](https://example.com/workflow-screencast.gif)

---

## ⚙️ Configuration
```javascript
// Settings structure
{
  outputDirectory: "InkporterScans", // Save location
  alphaThreshold: 200,              // 0-255 darkness cutoff
  fileNameTemplate: "note-{date}-{shortId}",
  convertToGrayscale: false,        // B/W conversion
  useLuminosityForAlpha: true       // Perceptual vs simple
}
```

---

## 🌐 Compatibility
| Environment  | Support          |
|--------------|------------------|
| Obsidian     | v1.4+            |
| OS           | Win/Mac/Linux    |
| Mobile       | iOS/Android*     |
| Scanners     | Any clipboard    |

*Mobile requires clipboard permission.

---

## 🚧 Work-in-Progress Notice 📝

<div class="warning" style="padding: 15px; background: #fff3cd; border-radius: 5px; border-left: 5px solid #ffc107; margin: 20px 0;">

⚠️ **Heads Up!** This plugin is currently in **beta development**.  
While fully functional, you might encounter:

- Occasional edge cases with low-contrast scans
- Limited support for colored inks (best with **black/dark pens**)
- Slight variations in ink detection accuracy

**Optimal Results When:**
- 📜 Using **light-colored paper** (white/cream)
- ✍️ Writing with **high-contrast ink** (black/dark blue)
- 💡 Scanning in **bright, even lighting**

*Why?* The alpha threshold detection works best with clear light/dark separation. We're working on:
- Dark background support 🎨
- Multi-ink color detection 🔍
- Adaptive lighting compensation 💡

[Follow development progress →](https://github.com/AmadeussSystem/inkporter/milestones)

</div>

---

## 🤝 Contributing
Help improve:
- Mobile scanning UX
- Multi-ink detection
- Batch processing

See our [contribution guidelines](CONTRIBUTING.md).

---

## 📜 License  
MIT License - See [LICENSE](LICENSE).

---

## 💡 Why This Name?
**Inkporter** combines:
- **Ink** (handwritten notes)
- **Port** (transfer/carry)
- **-er** (active tool suffix)

Represents "carrying ink into digital" while sounding like a professional tool.

---

## 🛣️ Support
Found a bug? Have feature ideas?  
📧 [your@email.com](mailto:amadeussystem04@gmail.com)  
🔍 [GitHub Issues](https://github.com/AmadeussSystem/inkporter/issues)  
💬 [Discord ID](https://discordapp.com/users/1100777573002264637)

---

> **From the Developer**  
> "This plugin was born from 47 hours spent cleaning up scans of my Moleskine notebooks. What started as a simple threshold script became an obsession with perfectly bridging analog and digital note-taking. May your handwritten wisdom live forever in both paper and pixels!" - Ayush

