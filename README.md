# 🥁 Random Groove Trainer & Metronome

A lightweight, offline-ready PWA for practicing drum grooves with randomized BPM ranges and precise audio timing.

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-brightgreen.svg)](https://insertclevernamehere.github.io/Drums-Trainer/)

---

## 🎯 Features

- **🎲 Groove Randomizer** — Practice transitions between grooves at varying tempos
- **🎵 Simple Metronome** — Accurate, feature-rich standalone metronome
- **🔬 Simple / Advanced Mode** — Simple mode for quick practice; Advanced Mode unlocks custom BPM step, full session controls, time signatures, and sound profiles
- **🎚️ Dual-Mode BPM Controls** — Sliders in Simple Mode; ± stepper buttons with user-defined quantization step in Advanced Mode
- **⏱️ Flexible Time Signatures** — Support for 4/4, 7/8, 6/8, 12/8, and custom signatures
- **🎼 Subdivision Support** — Quarter notes, eighths, sixteenths with visual hierarchy
- **🎧 Procedural Sound Profiles** — 5 sound options (Digital, Soft, Ping, Bubble, Clave)
- **⌨️ Keyboard Shortcuts** — Space, P, N, arrows, H for hands-free control
- **🌙 Dark Mode** — Auto-detects system preference, persists across sessions
- **🔒 Wake Lock** — Keep screen awake during practice (Settings menu)
- **📱 PWA Ready** — Install on any device, works fully offline
- **🔄 Auto-Updates** — Smart versioning with user-friendly update prompts
- **🎨 Hierarchical Version Colors** — Visual SemVer feedback with color inheritance

---

## 🚀 Quick Start

### 🌐 Use Online

Visit the live app: **[insertclevernamehere.github.io/Drums-Trainer](https://insertclevernamehere.github.io/Drums-Trainer/)**

### 💻 Run Locally

```bash
# Clone the repository
git clone https://github.com/InsertCleverNameHere/Drums-Trainer.git
cd Drums-Trainer

# Start a local server (any static server works)
npx live-server
# or
python -m http.server 8080

# Open in browser
# http://localhost:8080
```

### 📱 Install as PWA

1. Visit the app in Chrome/Edge
2. Click the install button in the address bar
3. Or use "Install App" button in the app footer

---

## 📚 Documentation

- **[Architecture Overview](docs/ARCHITECTURE.md)** — System design & module hierarchy
- **[API Reference](docs/API_REFERENCE.md)** — Public API documentation
- **[Debugging Guide](docs/DEBUGGING.md)** — Debug flags & profiling
- **[Visuals System](docs/VISUALS_SYSTEM.md)** — Phrase-based rendering details
- **[Versioning System](docs/VERSIONING.md)** — Auto-versioning & service worker
- **[Roadmap](docs/ROADMAP.md)** — Feature status & future plans

---

## ⌨️ Keyboard Shortcuts

| Key       | Action                                                                     |
| --------- | -------------------------------------------------------------------------- |
| `Space`   | Start/Stop metronome                                                       |
| `P`       | Pause/Resume                                                               |
| `N`       | Next groove (Groove mode only)                                             |
| `↑` / `↓` | Adjust BPM by active step (±5 in Simple Mode, ±user step in Advanced Mode) |
| `←` / `→` | Switch Min/Max BPM target (Groove mode)                                    |
| `H`       | Toggle settings & help dialog                                              |

---

## ⚙️ Settings Menu

Access the settings menu by pressing `H` or clicking the ⚙️ gear icon (top-right).

**Available Settings**:

- **Advanced Mode**: Unlocks manual BPM entry with custom quantization step, full session controls (cycle duration, total cycles, session time), time signature, and sound profile selectors
- **BPM Step** (Advanced Mode only): Sets the snap interval for BPM inputs and arrow key adjustments. Valid range: 1–150. Defaults to 5.
- **Reduce Motion**: Minimizes visual panning animations
- **Rhythmic Count-in**: Matches count-in speed to the incoming BPM (Groove mode only)
- **Keep Screen Awake**: Prevents screen dimming during practice sessions
  - Works on Android (Chrome), iOS (Safari 16.4+), and Desktop (Chrome/Edge)
  - Automatically reacquires when switching tabs
  - Persists across sessions
- **Restore to Defaults**: Clears all saved settings and returns to first-launch state

---

## 🎵 How It Works

### Groove Randomizer Mode

1. Set your BPM range (e.g., 60-120)
2. Enter groove names (one per line)
3. Choose session duration or cycle count
4. Press **Space** or tap **Start**
5. Practice transitions as grooves and tempos randomize

### Simple Metronome Mode

1. Set your desired BPM
2. Choose time signature and subdivisions
3. Press **Space** or tap **Start**
4. Use **Tap Tempo** to set BPM by tapping

### Version Updates

- **Visual feedback**: Version numbers use hierarchical colors based on update type
  - Major updates: All components change color
  - Minor updates: Minor + Patch components share new color
  - Patch updates: Only patch component gets new color
- **Smart styling**: Changed components are bold + underlined with glow effect
- **No disruption**: Updates happen seamlessly without cache invalidation

---

## 🧩 Project Structure

```bash
├── 📁 js/               # Core modules (ES6 modules)
│   ├── main.js          # Entry point
│   ├── metronomeCore.js # Groove audio scheduler
│   ├── simpleMetronomeCore.js # Simple metronome audio
│   ├── audioProfiles.js # Sound generation
│   ├── sessionEngine.js # Session lifecycle
│   ├── visuals.js       # Beat indicators
│   ├── uiController.js  # UI bindings
│   ├── utils.js         # Helpers
│   ├── constants.js     # Configuration
│   ├── debug.js         # Debug system
│   └── 📁 ui/
│       ├── advancedMode.js  # Simple/Advanced toggle, BPM step, chip row
│       ├── theme.js         # Dark mode
│       ├── hotkeys.js       # Keyboard shortcuts
│       ├── sliders.js       # BPM sliders & validation
│       ├── controls.js      # Sound profiles, time signatures
│       ├── panels.js        # Mode tabs, simple panel
│       └── wakeLock.js      # Screen wake lock
```

---

## 🛠️ Development

### Prerequisites

- Modern browser with Web Audio API support
- Static file server (live-server, http-server, etc.)

### Debug Mode

Enable debug logging in browser console:

```javascript
RGT.DEBUG.audio = true; // Audio scheduling
RGT.DEBUG.visuals = true; // Visual rendering
RGT.DEBUG.hotkeys = true; // Keyboard input
RGT.DEBUG.all = true; // Enable everything
```

See **[Debugging Guide](docs/DEBUGGING.md)** for details.

### Linting

```bash
npm install
npx eslint .
```

---

## 🎨 Credits

- **Favicon Icon**: [Tempo icons by Freepik - Flaticon](https://www.flaticon.com/free-icons/tempo)
- **PWA Icons**: [Metrónomo iconos by Freepik - Flaticon](https://www.flaticon.es/iconos-gratis/metronomo)

### Third-Party Libraries

- **[GSAP](https://greensock.com/gsap/)** (v3.x) — High-performance animations (GreenSock Standard License)
- **[noUiSlider](https://refreshless.com/nouislider/)** (v15.x) — Lightweight range slider (MIT License)

All bundled libraries are included for offline-first PWA functionality and comply with their respective licenses.

---

## 📄 License

This project is licensed under the **ISC License** — see [LICENSE](LICENSE) for details.

---

## 🤝 Contributing

Contributions are always welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See **[ROADMAP.md](docs/ROADMAP.md)** for planned features.

---

## 🐛 Issues

Found a bug? Have a feature request? Please [open an issue](https://github.com/InsertCleverNameHere/Drums-Trainer/issues).

---

## ⭐ Show Your Support

If you find this project helpful, give it a ⭐ on [GitHub](https://github.com/InsertCleverNameHere/Drums-Trainer)!

---

**Made with ❤️ for drummers, by drummers.**
