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
├── audioProfiles.js 🎧 Sound profile manager (Oscillator & Sample support)
├── grooveStorage.js 💾 LocalStorage layer for patterns and name lists
├── metronomeCore.js 🧠 Groove metronome core logic
├── patternScheduler.js 🥁 Rhythmic engine for programmed grooves
├── sampleLoader.js 📦 WAV asset fetcher and buffer cache
├── sessionEngine.js 🎛 Session lifecycle, timing, and pattern automation
├── simpleMetronome.js 🎚 Simple metronome UI controller
├── simpleMetronomeCore.js 🪘 Lightweight simple metronome audio core
├── uiController.js 🧩 Global UI binding and event management
├── utils.js ⚙️ Utility helpers (timing, randomization, formatting)
├── visuals.js 💡 Beat indicators and visual feedback
├── debug.js 🐛 Runtime debug system with category flags
├── constants.js 📦 Single source of truth for all constants
├── main.js 🚀 Entry point — initializes modules, handles profile sync
└── 📁 ui/
    ├── advancedMode.js 🔬 Simple/Advanced toggle, BPM step, chip row, stepper buttons
    ├── grooveEditor.js 🖋️ Pattern grid UI, State A/B logic, and chip list
    ├── theme.js 🌙 Dark mode toggle
    ├── hotkeys.js ⌨️ Keyboard shortcuts (dynamic step-aware)
    ├── sliders.js 🎚️ noUiSlider instances, blur-pair validation
    ├── controls.js 🎛️ Sound profiles, time signatures
    ├── panels.js 📋 Mode tabs, simple metronome panel
    └── wakeLock.js 🔒 Screen wake lock

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

## ✅ Phase 4 — COMPLETED (Documentation & Code Quality)

### ✅ Documentation

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

### ✅ UI Modularization

- [x] Split `uiController.js` from ~1800 → ~440 lines
- [x] Create `js/ui/theme.js` (~133 lines) — Dark mode & quantization
- [x] Create `js/ui/hotkeys.js` (~235 lines) — Keyboard shortcuts
- [x] Create `js/ui/sliders.js` (~308 lines) — BPM sliders & validation
- [x] Create `js/ui/controls.js` (~187 lines) — Sound profiles & time signatures
- [x] Create `js/ui/panels.js` (~234 lines) — Mode tabs & simple panel
- [x] Add JSDoc to all UI submodules
- [x] Update imports in dependent modules
- [x] Update documentation (ARCHITECTURE.md)
- [x] Automated testing setup (unit tests for utils.js)

### ⏳ Future Testing Work

- [ ] Visual regression tests

---

## 🚧 Phase 5 — Simple / Advanced Mode & Groove Editor

> **Branch:** `advancedmode`
> Phases 5.1 through 5.5 are delivered incrementally. Each phase is a
> self-contained, merge-ready unit. Phase 5.1 is the required foundation
> for all subsequent phases.

---

### ✅ Phase 5.1 — Simple / Advanced Mode Foundation — COMPLETED

#### Simple Mode (default)

- All existing behaviour is preserved exactly as-is
- BPM controls use the noUiSlider with hardcoded quantization step of 5
- Session controls (cycle duration, total cycles, total time) are **hidden**;
  session always runs until stopped with a fixed 60-second cycle time
- Sound profile, time signature, and subdivision controls are **hidden**
- Rhythmic Count-in toggle remains visible in both modes
- Groove names textarea remains visible in both modes (integral to the randomizer)
- A **collapsed chip / badge row** is displayed above the Start button in
  both the Groove Randomizer and Metronome tabs, showing the Advanced Mode
  settings currently in effect (e.g. `7/8 · Clave · Sixteenths`). Placement
  is consistent across both tabs. The row carries a tooltip: _"These settings
  carry over from Advanced Mode. Switch to Advanced to change them."_

#### Advanced Mode

- Toggle lives in the settings modal; persisted to `localStorage`
- **No sliders** — all BPM inputs are plain numeric fields
- Quantization is always enforced, but the step is user-defined:
  - A free numeric input labelled **"BPM Step (snap interval)"** replaces
    the hardcoded step of 5
  - Valid range: 1–150 (positive integers only); defaults to 5
  - Stored in `localStorage`; restored on page load
  - Wires up the existing `getUserQuantizationPreference()` TODO in
    `constants.js`
- A **"Snap to step"** toggle enables / disables quantization snapping.
  When off, any integer within 30–300 is accepted. When on, inputs and
  arrow key adjustments snap to the nearest multiple of the defined step.
  Applies to both the Groove Randomizer and Metronome tabs
- Arrow key BPM adjustment (↑ / ↓) steps by the user-defined quantization
  step instead of the hardcoded 5
- Min / max BPM margin enforcement adapts: minimum margin equals one
  quantization step (not hardcoded 5)
- Session controls revealed: cycle duration, total cycles, total time,
  and session limit mode selector
- Sound profile selector revealed (persists when switching back to Simple)
- Time signature and subdivision controls revealed (persist when switching
  back to Simple)
- **Restore to Defaults** button in the settings modal resets the entire
  app to first-launch state: clears all `localStorage`, resets dark mode
  to system preference, resets groove textarea, and resets all settings

#### Input validation overhaul (quantization-aware)

- All BPM inputs re-validate against the active quantization step whenever
  the step changes
- `sanitizeBpmRange()` already accepts a step parameter — this is wired to
  the live user preference
- Hard limits (30–300) remain enforced in all cases
- Tap tempo retains its own isolated fixed quantization
  (`TAP_TEMPO_QUANTIZATION = 5`); unaffected by user step setting

#### New module: `js/ui/advancedMode.js`

- Owns the Simple / Advanced toggle lifecycle
- Handles show / hide of all mode-gated DOM sections
- Manages the persistent-settings chip row (read, render, update)
- Exposes `isAdvancedMode()` for use by other modules

#### Delivered

- ✅ `js/ui/advancedMode.js` — new module, full implementation
- ✅ FUOC prevention — inline `<head>` script sets `data-theme` and `html.advanced-mode` synchronously
- ✅ Simple Mode: sliders, step=5, session/sound/timesig hidden, chip row visible
- ✅ Advanced Mode: steppers, user-defined step, all controls revealed, chip row populated
- ✅ Anchor-relative BPM grid — `simpleBpm` snaps on blur; `bpmMin`/`bpmMax` defer to play time
- ✅ Blur-pair deferral — margin correction only after both bpmMin/bpmMax blur
- ✅ `restoreDefaults()` — localStorage cleared, dark mode follows system preference on reload
- ✅ All settings persist across reload
- ✅ Tap tempo unaffected by custom step
- ✅ Arrow keys use dynamic step; margin guard uses step not hardcoded 5
- ✅ Tests: `advanced-mode.test.html`, `dark-mode.test.html`, updated `hotkeys.test.html`, updated `system-verification.js`

---

### ✅ Phase 5.2 — Groove Pattern Editor & Persistence — COMPLETED

#### The Sampler & Rhythmic Engine

- **Acoustic Drum Kit**: High-fidelity WAV samples for Kick, Snare, Hi-Hat, and Pedal.
- **Sample-Based Metronome**: New "Crossstick" profile using acoustic assets.
- **Pattern Scheduler**: Sample-accurate triggering of drum hits synced to the metronome clock.
- **Rhythmic Suppression**: Logic to silence the metronome "beep" when a pattern hit is active.

#### The Pattern Editor (Advanced Mode Only)

- **Two-State UI**: Seamless GSAP transition between raw Textarea (State A) and Interactive Chip List (State B).
- **Multi-Track Grid**: Sovereign rhythmic grid (HH, Kick, Snare, Pedal) with local Time Signature, Subdivision, and Measure controls.
- **Sovereign Overrides**: Patterns automatically override global metronome settings during playback and restore them on completion.
- **Visual Dashboard**: 4-row visualizer display synced to the pattern, featuring a vertical playhead and rhythmic color-coding.
- **User Preference**: A toggle to switch the visualizer between the 4-track Dashboard and the standard single-row view.

#### Persistence & Security

- **Smart Storage**: Persistent `localStorage` for both rhythmic patterns and the custom groove name list.
- **Replacement Mode**: Intelligent handling of the 100-pattern storage limit with non-intrusive overwrite flow.
- **Bidirectional Ownership**: Rigid mutual exclusivity between the Editor and the Metronome to prevent state corruption.
- **Audio Privacy**: Floating Mute/Unmute toggle with zero-flicker reload state and cross-panel synchronization.

#### Delivered

- ✅ `js/sampleLoader.js` & `js/patternScheduler.js` — Sampler and Rhythmic logic.
- ✅ `js/grooveStorage.js` — Data persistence layer.
- ✅ `js/ui/grooveEditor.js` — Full Editor UI and state machine.
- ✅ Overhauled `visuals.js` — Dual-mode rendering engine.
- ✅ Global AudioContext Unlocker in `main.js`.
- ✅ Integrated Mute logic with FUOC prevention.

---

### 🔮 Phase 5.3 — Default Groove Library

> **Estimated dev time: 1–2 days**
> **Requires:** Phase 5.2 complete

- Small bundled `defaultGrooves.json` with starter patterns
  (e.g. Rock 4/4, Bossa Nova, Funk, Shuffle)
- Users can load these as reference templates
- Read-only; cannot be overwritten, only copied to user grooves

---

### 🔮 Phase 5.4 — Accessibility Layer

> **Estimated dev time: 1–2 days**
> **Can run in parallel with 5.2 / 5.3**

- Keyboard-navigable controls (`Tab`, `Enter`) across all panels
- `aria-label` attributes on all interactive elements
- Beat grid circles include screen-reader descriptions
- Accent / normal beat colours verified for WCAG contrast and
  colour-blind safety

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
