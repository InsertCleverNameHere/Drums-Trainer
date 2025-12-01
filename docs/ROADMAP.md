# Random Groove Trainer — Roadmap

## Core Philosophy

- **Lightweight-first:** No large assets, minimal dependencies.
- **Offline-ready:** Full caching via service worker.
- **Modular & maintainable:** Small JS modules for easy extension.
- **Musician-centered:** Clear visuals, accurate timing, minimal distractions.

---

## Project Structure

```bash
📁 .github/
└── 📁 workflows/
    └── versioning.yml 🔁 Automated version bump workflow

📁 css/
└── styles.css 🎨 Main stylesheet (layout, theme, dropdowns)

📁 js/
├── audioProfiles.js 🎧 Procedural sound profiles (Digital, Soft, Ping, Bubble, Clave)
├── metronomeCore.js 🧠 Groove metronome core logic
├── sessionEngine.js 🎛 Session lifecycle, timing, and ownership
├── simpleMetronome.js 🎚 Simple metronome UI controller
├── simpleMetronomeCore.js 🪘 Lightweight simple metronome audio core
├── uiController.js 🧩 Global UI binding and event management
├── utils.js ⚙️ Utility helpers (timing, randomization, formatting)
├── visuals.js 💡 Beat indicators and visual feedback
├── debug.js 🐛 Runtime debug system with category flags
├── constants.js 📦 Single source of truth for all constants
└── main.js 🚀 Entry point — initializes modules, handles profile sync

📄 index.html 🧱 App shell — includes both Simple & Groove metronome panels
📄 manifest.json 📱 PWA metadata
📄 service-worker.js ⚡ Offline caching and update logic
📄 favicon.ico / icon-192.png / icon-512.png 🖼 App icons

📁 docs/ 📚 Documentation
├── ARCHITECTURE.md — System design & module hierarchy
├── API_REFERENCE.md — Public API documentation
├── DEBUGGING.md — Debug flags & profiling guide
├── VISUALS_SYSTEM.md — Phrase-based rendering details
├── VERSIONING.md — Version bump & service worker logic
└── ROADMAP.md — This file

📄 README.md 📘 Main project documentation
📄 versioningMode.json ⚙️ Semantic versioning configuration
📄 bumpVersion.js 🔧 Auto-increment build version script
📄 commits.json 🕓 Commit history data
📄 eslint.config.mjs ✅ Linting configuration
📄 package.json 📦 NPM project metadata
📄 package-lock.json 🔒 Locked dependency versions
📄 .gitignore 🚫 Git ignored files
```

---

## ✅ Phase 1-3 — COMPLETED

### ✅ 1. Modular Refactor

- Split JS into clean module structure
- Maintains code quality, prepares for future features

### ✅ 2. Pause / Resume Functionality + Tempo-Synced Countdown Integration

- Functional Pause button
- Ensures current measure plays to the end before pausing or switching cycles
- 3-2-1 tempo-synced countdown integrated into both start and cycle transitions

### ✅ 3. Keyboard Shortcuts

- Space → Start/Stop
- P → Pause/Resume
- Arrow keys → Adjust BPM
- N → Next groove
- H → Toggle help/hotkeys dialog

### ✅ 4. Footer & Cache Version Log

- Hotkeys information moved to on-demand dialog
- Footer displays app version and appears briefly (auto-hides after 10s)
- **Update Available** message when new version detected
- **Updated / Cached** message for successful cache updates
- Color-coded version numbers for visibility
- Tracks shown messages via localStorage to prevent repeated display

### ✅ 5. Intelligent Versioning System

- Dynamic versioning using latest GitHub commit hash
- Auto-increments minor version when new commit detected
- Stores last seen hash and minor version in localStorage
- Displays current version in footer with console logging
- Assigns distinct color to each version (rotating automatically)
- Avoids color similarity using color distance logic
- Detects new version by comparing latest commit hash
- Shows persistent "Update Available" banner with clickable "Update" button
- Tracks message display via localStorage

### ✅ 6. Procedural Sound Customization

- Accent / normal beats generated via Web Audio API (no WAV/MP3 files)
- Sound profiles: Digital, Soft, Ping, Bubble, Clave
- Synchronized dropdowns in both Groove and Simple modes

### ✅ 7. Tap Tempo

- Minimal implementation: user taps button 3–4 times
- BPM calculated from weighted average interval
- Adaptive decay weighting for responsive feel

### ✅ 8. Input Validation

- Enforces `minBPM < maxBPM` with 5 BPM minimum margin
- Reverts or corrects invalid inputs gracefully
- Real-time validation on blur/change events

### ✅ 9. Dual-Point BPM Slider

- Native noUiSlider implementation with unified styling
- Syncs with numeric min/max BPM inputs
- Active pip highlighting for current BPM values
- Clickable pips for direct value selection

### ✅ 10. Note Type & Time Signature Customization

- Support for quarter notes, eighths, sixteenths
- Compound and irregular time signatures (6/8, 7/8, 12/8, etc.)
- Smaller circles for subdivisions (visual scaling: quarter > eighth > sixteenth)
- Accurate timing using internal subdivision multiplier
- Phonation text under circles ("1 &" for eighths, "1 e & a" for sixteenths)
- Lightweight logic with procedural generation only (no assets)

### ✅ 11. Dark Mode Toggle

- Mobile-friendly, persisted via localStorage
- Smooth transitions between themes
- Respects system preference on first visit

### ✅ 12. Light Design Polish

- Subtle background gradients
- Hover effects and rounded buttons
- Maintains lightweight and performant design

### ✅ 13. Enhanced PWA Features

- Standalone launch on mobile
- Auto-update service worker
- "Update available" and "updated" footer messages with version color-coding

### ✅ 14. Settings Persistence

- Saves user preferences (BPM range, grooves, beats/bar, countdown mode, etc.) to localStorage

### ✅ 15. Debug System

- Runtime debug control via `DEBUG` flags
- Category-based logging (audio, visuals, ownership, hotkeys, timing, state)
- Performance timing helpers with threshold warnings

---

## 🚧 Phase 4 — CURRENT (Documentation & Code Quality)

### 🔄 In Progress

- [x] Create `/docs` folder structure
- [x] `docs/ARCHITECTURE.md` — System design & module hierarchy
- [x] `docs/API_REFERENCE.md` — Public API documentation
- [x] `docs/DEBUGGING.md` — Debug flags & profiling guide
- [x] Move `VISUALS_SYSTEM.md` → `docs/`
- [x] Move `VERSIONING.md` → `docs/`
- [x] Update `ROADMAP.md` (this file) → `docs/`
- [x] Add JSDoc comments to all core modules
- [x] Update root `README.md` to reference new docs structure
- [x] Performance profiling & max-BPM clamping

### ⏳ Pending

- [ ] Automated testing setup (unit tests for utils.js)
- [ ] Visual regression tests

---

## 🔮 Phase 5 — Advanced Mode & Groove Editing (Future)

### 1. Simple vs Advanced Mode Toggle

- **Simple Mode**:
  - Dual tempo slider (values clamped to multiples of 5)
  - Time-based sessions only (no cycles option)
  - Minimal interface: BPM range, total time, start/stop
- **Advanced Mode**:
  - Manual BPM input (any integer value)
  - Full time-signature and groove-definition options
  - Optional enforcement toggle for grooves that differ from selected signature
  - Four visual rows representing drum parts:
    - Hi-Hat / Cymbal
    - Kick
    - Snare
    - Hi-Hat Control (open/closed)
  - Each row displayed as a sequence of unlit circles the user can **tap or click** to activate beats
  - Active circles light up and play in sync with the metronome
  - Grooves are **not tied to a fixed BPM**, allowing them to be reused across tempo changes

### 2. Groove Pattern Editor

- Visual editor for defining patterns:
  - Click / tap to toggle hits on or off per instrument row
  - Optional preview playback for quick testing
  - Supports grooves that span **multiple measures** (e.g. Bossa Nova = 2 bars)
- Add a small note reminding users that some grooves naturally require more than one measure

### 3. User Groove Persistence

- Users can **save, edit, rename, and delete** grooves
- Saved to `localStorage` as JSON (lightweight, offline-ready)
- Example stored structure:

  ```json
  {
    "userGrooves": {
      "My Funk Groove": {
        "timeSignature": "4/4",
        "patterns": {
          "hihat": [1, 0, 1, 0, 1, 0, 1, 0],
          "snare": [0, 0, 1, 0, 0, 0, 1, 0],
          "kick": [1, 0, 0, 0, 1, 0, 0, 1]
        },
        "measures": 1
      }
    }
  }
  ```

- Automatically reload last-used groove at startup
- Optional _"Reset to Defaults"_ button

### 4. Default Groove Library (Optional Reference)

- Provide a small built-in JSON file (`defaultGrooves.json`) bundled with the PWA
- Contains several well-known starter patterns (e.g. Rock 4/4, Bossa Nova, Funk Groove)
- Users can enable or import these as reference templates

### 5. Accessibility Layer (Lightweight)

- Keyboard-navigable controls (`Tab`, `Enter`)
- `aria-label` attributes for all buttons and sliders
- Visuals (beat circles) include accessible text descriptions for screen readers
- Accent vs. normal beat colors chosen for **high contrast** and **color-blind safety**

---

## 🌐 Phase 6 — Groove Sharing, Import / Export, and Collaboration (Future)

### 1. Export User Grooves

- Allow export of selected or all user-defined grooves as a single downloadable `.json` file
- Keeps structure consistent with `userGrooves` object used internally

### 2. Import Groove Files

- Enable drag-and-drop or file-picker import of JSON groove files
- Merge imported grooves with existing ones (prompt user on name conflicts)

### 3. Share Groove Links (Optional)

- Generate a shareable JSON or encoded link (local only; no server)
- Example: `groovetrainer.app#share=<encodedJSON>`

### 4. Preset Management Tools

- Option to **backup / restore** grooves across browsers via manual file handling
- May later extend to QR-based sharing for mobile convenience

### 5. Privacy & Lightweight Principles

- No online accounts or cloud storage — all data remains client-side
- Import/export handled purely within the PWA sandbox

---

> These phases maintain the lightweight, offline-first nature of Random Groove Trainer while opening the door to creative sharing and advanced rhythm editing.

---

> **Notes:** Optional features like visual-only mode, presets, and "about" modals are deferred to keep the app lightweight.
> All future additions should respect the offline-first, lightweight philosophy.
