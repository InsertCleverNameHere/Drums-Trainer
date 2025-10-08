# Random Groove Trainer — Roadmap

## Core Philosophy
- **Lightweight-first**: No large assets, minimal dependencies.  
- **Offline-ready**: Full caching via service worker.  
- **Modular & maintainable**: Small JS modules for easy extension.  
- **Musician-centered**: Clear visuals, accurate timing, minimal distractions.

---

## Phase 1 — Immediate / High Priority
1. **Modular Refactor**
   - Split JS into `metronomeCore.js`, `visuals.js`, `uiController.js`, `utils.js`.  
   - No feature changes, just structure for maintainability.

2. **Pause / Resume Functionality**
   - Make the currently disabled button functional.  
   - Pause stops scheduling and freezes countdown; Resume continues from same beat and timing.

3. **Keyboard Shortcuts**
   - Space → Start/Stop  
   - P → Pause/Resume  
   - Arrow keys → Adjust BPM  
   - N → Next groove

4. **Countdown Before Start**
   - Optional 1-bar visual/audio count-in before session begins.

5. **Footer & Cache Version Log**
   - Display version in footer.  
   - Console log cache version for debugging:  
     ```js
     console.info("Random Groove Trainer v1.0.4 — Cached Offline");
     ```

---

## Phase 2 — Functional Enhancements
1. **Procedural Sound Customization**
   - Accent / normal beats generated via Web Audio API (no WAV/MP3 files).

2. **Tap Tempo**
   - Minimal implementation: user taps button 3–4 times, BPM calculated from average interval.

3. **Input Validation**
   - Enforce `minBPM < maxBPM`, revert or correct gracefully.

4. **Dual-Point BPM Slider**
   - Sync with numeric min/max BPM inputs.

---

## Phase 3 — Visual & UX Improvements
1. **Dark Mode Toggle**
   - Mobile-friendly, persisted via `localStorage`.

2. **Cycle Summary Popup**
   - Show session stats: total cycles, total time, average BPM.

3. **Light Design Polish**
   - Subtle background gradients, hover effects, rounded buttons.  
   - Keep lightweight and performant.

---

## Phase 4 — Technical Enhancements
1. **Performance Profiling & Max-BPM Clamping**
   - Detect timing drift; enforce safe maximum BPM.

2. **Enhanced PWA Features**
   - Fullscreen launch on mobile.  
   - Auto-update service worker.  
   - Optional banner suppression.

3. **Settings Persistence**
   - Save user preferences (BPM range, grooves, beats/bar, etc.) to `localStorage`.

---

> Notes: Optional features like visual-only mode, presets, and “about” modals are intentionally deferred to keep the app simple and lightweight. All future additions should respect the offline-first, lightweight philosophy.