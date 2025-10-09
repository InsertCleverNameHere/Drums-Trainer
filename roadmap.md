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
- **Pause:** Stops all scheduling (audio + visual) and freezes the cycle timer (formerly called “countdown”).
- **Resume:** Continues playback from the same beat and timing without restarting the current measure.
- **Cycle End Flow:**
  1. Current measure completes fully even if the timer reaches zero.  
  2. A short 1-second pause follows to let the user adjust.  
  3. A **tempo-synced 3-2-1 count-in** plays, using the next cycle’s BPM to determine timing.  
  4. The next cycle begins automatically.
- **Initial Start:** When the user presses **Start**, the same 3-2-1 count-in runs before the first groove begins (if enabled).

**User Options:**
- Add a toggle button or checkbox in the UI labeled “Count-in before start.”
- If enabled, plays the 3-2-1 before any new start or cycle.
- The count-in adapts dynamically to BPM (faster at higher tempos).

**Technical Notes:**
- Implement count-in using lightweight Web Audio beeps and matching visual flashes.
- Use existing `cycleTimer` and `cycleRemaining` variables for timekeeping instead of creating new overlapping timers.
- Ensure state is consistent between Pause/Resume, Start, and Cycle transitions.

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

## Phase 2 — Functional Enhancements

### 1. Procedural Sound Customization
- Accent / normal beats generated via Web Audio API (no WAV/MP3 files).

### 2. Tap Tempo
- Minimal implementation: user taps button 3–4 times, BPM calculated from average interval.

### 3. Input Validation
- Enforce `minBPM < maxBPM`, revert or correct gracefully.

### 4. Dual-Point BPM Slider
- Sync with numeric min/max BPM inputs.

---

## Phase 3 — Visual & UX Improvements

### 1. Dark Mode Toggle
- Mobile-friendly, persisted via localStorage.

### 2. Cycle Summary Popup
- Show session stats: total cycles, total time, average BPM.

### 3. Light Design Polish
- Subtle background gradients, hover effects, rounded buttons.  
- Keep lightweight and performant.

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

> **Notes:** Optional features like visual-only mode, presets, and “about” modals are deferred to keep the app lightweight.  
> All future additions should respect the offline-first, lightweight philosophy.
