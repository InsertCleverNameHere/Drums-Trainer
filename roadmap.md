# Random Groove Trainer — Roadmap

## Core Philosophy
- **Lightweight-first:** No large assets, minimal dependencies.
- **Offline-ready:** Full caching via service worker.
- **Modular & maintainable:** Small JS modules for easy extension.
- **Musician-centered:** Clear visuals, accurate timing, minimal distractions.

---

## Project Structure (Text-Based Representation)

**index.html** — Main page  
**manifest.json** — PWA manifest  
**service-worker.js** — Offline caching  
**README.md**  
**ROADMAP.md** — This roadmap file  

**css/**
- styles.css — Global styles and responsive rules  

**js/**
- metronomeCore.js — Audio scheduling & Web Audio API logic  
- visuals.js — Beat circle creation, animation, color logic  
- uiController.js — Button events, input sync, countdown, summary  
- utils.js — Helper functions (BPM calculations, timing, random selection)  
- main.js — Imports modules, initializes app (optional)  

**assets/**
- icons/ — PWA icons for different resolutions  

> Notes:
> - Each JS module is small and cached individually.  
> - `metronomeCore.js` handles audio timing and sound logic.  
> - `visuals.js` manages beat circles and animations.  
> - `uiController.js` handles buttons, keyboard shortcuts, countdown, and summary.  
> - `utils.js` contains helper functions like BPM calculations and groove selection.  
> - `main.js`  wires all modules together.

---

## Phase 1 — Immediate / High Priority

### ✅ 1. Modular Refactor
- Split JS into the structure above.  
- Keeps code maintainable, prepares for future features.

### 2. Pause / Resume Functionality + Tempo-Synced Countdown Integration

**Goals:**
- Make the currently disabled Pause button functional.  
- Ensure the current measure plays to the end before pausing or switching cycles.  
- Integrate the 3-2-1 tempo-synced countdown into both start and cycle transitions.

**Behavior Details:**
- **Pause:** Stops all scheduling (audio + visual) and freezes the `cycleTimer` (remaining time is preserved).  
- **Resume:** Continues playback from the same beat and timing (does not restart the current measure).  
- **Cycle End Flow:**
  1. Current measure completes fully even if the `cycleTimer` reaches zero.  
  2. A short 1-second adjustment pause follows.  
  3. A **3-2-1 count-in** plays, using the *next* cycle’s BPM to determine timing (unless fixed mode selected).  
  4. The next cycle begins automatically.  
- **Initial Start:** When the user presses **Start**, the same 3-2-1 count-in runs before the first groove begins (if enabled).

**UI Flag / Toggle (Tempo vs Fixed count-in)**
- Add a user-facing toggle near the playback controls with label:  
  **“Tempo-synced Count-in”** (tooltip: *“When on, count-in ticks follow the selected BPM; when off, each step is 1 second.”*).
- **Modes:**
  - **Tempo-synced (default):** Count-in interval = `60_000 / BPM` ms (i.e., one beat long, so ticks align musically).
  - **Fixed:** Count-in interval = `1000` ms per step (3 → 2 → 1 each 1 second).
- Persist the flag in `localStorage`, e.g.:
  - Key: `tempoSyncedCountIn`  
  - Values: `'true'` or `'false'` (string) or `'tempo'` / `'fixed'` if you prefer.
- Behavior when toggled:
  - Updates the stored preference immediately.
  - Applies to every subsequent count-in (including Start, Resume, and between cycles). If toggled *during* an active count-in, the change applies on the next count-in.

### 3. Keyboard Shortcuts
- Space → Start/Stop  
- P → Pause/Resume  
- Arrow keys → Adjust BPM  
- N → Next groove  

### 4. Footer & Cache Version Log
- Display app version in footer.  
- Console log cache version for debugging:  
  ```js
  console.info("Random Groove Trainer v1.0.4 — Cached Offline");
  ```
- Plan for two footer messages for PWA updates:  
  1. **Update Available** — shows when a new version is detected.  
  2. **Updated / Cached** — shows when a new version has been cached successfully (appears for a few launches, then disappears).  
- Color-code version numbers in the footer for visibility.  
- Track shown messages via localStorage to prevent repeated display.

---

### Phase 2 — Functional Enhancements

1. **Procedural Sound Customization**  
   Accent / normal beats generated via Web Audio API (no WAV/MP3 files).

2. **Tap Tempo**  
   Minimal implementation: user taps button 3–4 times, BPM calculated from average interval.

3. **Input Validation**  
   Enforce `minBPM < maxBPM`, revert or correct gracefully.

4. **Dual-Point BPM Slider**  
   Sync with numeric min/max BPM inputs.

5. **Note Type & Time Signature Customization** ✅ *(new section)*  
   - Add support for selecting subdivision types: quarter notes, eighths, sixteenths (and optionally triplets).  
   - Allow compound and irregular time signatures (e.g., 6/8, 12/16).  
   - Display smaller circles for subdivisions (visual scaling: quarter > eighth > sixteenth).  
   - Keep timing accurate using an internal subdivision multiplier (e.g., 16ths = 4 sub-ticks per beat).  
   - **Optional:** Display phonation text under circles (e.g., “1 &” for eighths, “1 e & a” for sixteenths, etc.) to aid rhythmic counting.  
   - Maintain lightweight logic and visuals using only procedural generation (no audio or image assets).

---

## Phase 4 — Technical Enhancements

### 1. Performance Profiling & Max-BPM Clamping
- Detect timing drift; enforce safe maximum BPM.

### 2. Enhanced PWA Features
- Fullscreen launch on mobile.  
- Auto-update service worker.  
- Optional banner suppression.  
- Add “update available” and “updated” footer messages with version color-coding.

### 3. Settings Persistence
- Save user preferences (BPM range, grooves, beats/bar, countdown mode, etc.) to localStorage.

---

### Phase 5 — Mode System & Groove Customization

1. **Simple / Advanced Mode Toggle**
   - Add a clear toggle or switch in the UI to alternate between **Simple Mode** and **Advanced Mode**.
   - Mode preference is saved in `localStorage` and persists between sessions.
   - Transition between modes should not require a page reload.

2. **Simple Mode**
   - Streamlined interface for focused practice sessions.
   - **Features:**
     - Dual BPM slider (min/max) **clamped to multiples of 5**.
     - Time-based session setup (e.g., "Play for 10 minutes" only; no cycle count).
     - Clean single-row beat visual (quarter notes only).
     - Countdown before start (reuses global countdown logic).
     - Basic Start / Pause / Stop controls only.
   - Lightweight mode optimized for mobile and quick play.

3. **Advanced Mode**
   - Exposes full timing and visualization control for experienced users.
   - **Features:**
     - Manual BPM input (no rounding or clamping).
     - Fully customizable **time signatures** and **note subdivisions** (quarters, 8ths, 16ths, triplets, etc.).
     - Optional toggle to enforce the selected time signature or allow “mixed groove” patterns that break signature rules.
     - **Multi-row visualization:**
       - **Row 1:** Hi-Hat  
       - **Row 2:** Kick  
       - **Row 3:** Snare  
       - **Row 4:** Hi-Hat Control (open/close articulation)
     - Each groove pattern defines which hits trigger each instrument row.
     - Circles light up by row and are color-coded for instrument type.
     - Optional toggle to show/hide rows for performance optimization.

4. **Technical & Implementation Notes**
   - Maintain modular separation:  
     `simpleModeUI.js` and `advancedModeUI.js`, each building on shared logic from `uiController.js` and `metronomeCore.js`.
   - All visuals rendered procedurally (no static assets).
   - Must preserve the **lightweight-first** philosophy — ensure minimal impact on bundle size and load time.
   - Advanced mode visuals should degrade gracefully on mobile (e.g., simplified layout or fewer visible rows).

5. **Optional Future Enhancements**
   - “Custom Mode” combining elements of both simple and advanced configurations.
   - Per-groove visual layouts saved automatically to `localStorage`.
   - Shared groove library export/import for different users.

---

> **Notes:** Optional features like visual-only mode, presets, and “about” modals are deferred to keep the app lightweight.  
> All future additions should respect the offline-first, lightweight philosophy.
