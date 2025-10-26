# Random Groove Trainer — Roadmap

## Core Philosophy

- **Lightweight-first:** No large assets, minimal dependencies.
- **Offline-ready:** Full caching via service worker.
- **Modular & maintainable:** Small JS modules for easy extension.
- **Musician-centered:** Clear visuals, accurate timing, minimal distractions.

---

## Project Structure

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
└── main.js 🚀 Entry point — initializes modules, handles profile sync

📄 index.html 🧱 App shell — includes both Simple & Groove metronome panels
📄 manifest.json 📱 PWA metadata
📄 service-worker.js ⚡ Offline caching and update logic
📄 favicon.ico / icon-192.png / icon-512.png 🖼 App icons

📄 README.md 📘 Main documentation
📄 README-versioning.md 🗒 Versioning and release notes
📄 roadmap.md 🧭 Development roadmap and milestones
📄 versioningMode.json ⚙️ Semantic versioning configuration
📄 bumpVersion.js 🔧 Auto-increment build version script
📄 commits.json 🕓 Commit history data
📄 eslint.config.mjs ✅ Linting configuration
📄 package.json 📦 NPM project metadata
📄 package-lock.json 🔒 Locked dependency versions
📄 .gitignore 🚫 Git ignored files

> Notes:
>
> - Each JS module is small and cached individually.
> - `metronomeCore.js` handles audio timing and sound logic.
> - `visuals.js` manages beat circles and animations.
> - `uiController.js` handles buttons, keyboard shortcuts, countdown, and summary.
> - `utils.js` contains helper functions like BPM calculations and groove selection.
> - `main.js` wires all modules together.

---

## Phase 1 — Immediate / High Priority

### ✅ 1. Modular Refactor

- Split JS into the structure above.
- Keeps code maintainable, prepares for future features.

### ✅ 2. Pause / Resume Functionality + Tempo-Synced Countdown Integration

**Goals:**

- ✅ Make the currently disabled Pause button functional.
- ✅ Ensure the current measure plays to the end before pausing or switching cycles.
- ✅ Integrate the 3-2-1 tempo-synced countdown into both start and cycle transitions.

### ✅ 3. Keyboard Shortcuts

- ✅ Space → Start/Stop
- ✅ P → Pause/Resume
- ✅ Arrow keys → Adjust BPM
- ✅ N → Next groove

### ✅ 4. Footer & Cache Version Log

-✅ Move Hotkeys information from footer to a button that displays them on command, additionally make footer appear only briefly then disappear (maybe 10s?)

- ✅ Display app version in footer.
- ✅ Console log cache version for debugging:
  ```js
  console.info("Random Groove Trainer v1.0.4 — Cached Offline");
  ```
- Plan for two footer messages for PWA updates:
  1. ✅ **Update Available** — shows when a new version is detected.
  2. ✅ **Updated / Cached** — shows when a new version has been cached successfully (appears for a few launches, then disappears).
- ✅ Color-code version numbers in the footer for visibility.
- ✅ Track shown messages via localStorage to prevent repeated display.

- ### ✅ 🔢 Intelligent Versioning System

- ✅ Implement dynamic versioning using the latest GitHub commit hash.
- ✅ Automatically increment the minor version (e.g. `v2.0.1`, `v2.0.2`) when a new commit is detected.
- ✅ Store the last seen hash and minor version in `localStorage` to track changes across sessions.
- ✅ Display the current version in the footer and console log.
- ✅ Assign a distinct color to each version for visual recognition, rotating automatically when the version changes.
- ✅ Avoid color similarity using color distance logic and cache the last used color.
- ✅ Detect when a new version is available by comparing the latest commit hash to the stored one.
- ✅ Show a persistent “Update Available” banner when a new version is detected.
- ✅ Include a clickable “Update” button that forces a page refresh to load the latest version.
- ✅ Track message display via `localStorage` to avoid repeated alerts.

---

### Phase 2 — Functional Enhancements

1. ✅ **Procedural Sound Customization**  
   Accent / normal beats generated via Web Audio API (no WAV/MP3 files).

2. **Tap Tempo**  
   Minimal implementation: user taps button 3–4 times, BPM calculated from average interval.

3. **Input Validation**  
   Enforce `minBPM < maxBPM`, revert or correct gracefully.

4. **Dual-Point BPM Slider**  
   Sync with numeric min/max BPM inputs.

5. **Note Type & Time Signature Customization**
   - Add support for selecting subdivision types: quarter notes, eighths, sixteenths (and optionally triplets).
   - Allow compound and irregular time signatures (e.g., 6/8, 12/16).
   - Display smaller circles for subdivisions (visual scaling: quarter > eighth > sixteenth).
   - Keep timing accurate using an internal subdivision multiplier (e.g., 16ths = 4 sub-ticks per beat).
   - **Optional:** Display phonation text under circles (e.g., “1 &” for eighths, “1 e & a” for sixteenths, etc.) to aid rhythmic counting.
   - Maintain lightweight logic and visuals using only procedural generation (no audio or image assets).

---

## Phase 3 — Visual & UX Improvements

1. **Dark Mode Toggle**

   Mobile-friendly, persisted via `localStorage`.

2. **Cycle Summary Popup**

   Show session stats: total cycles, total time, average BPM.

3. **Light Design Polish**

   Subtle background gradients, hover effects, rounded buttons.

   Keep lightweight and performant.

## Phase 4 — Technical Enhancements

### 1. Performance Profiling & Max-BPM Clamping

- Detect timing drift; enforce safe maximum BPM.

### 2. Enhanced PWA Features

- Fullscreen launch on mobile.
- ✅ Auto-update service worker.
- Optional banner suppression.
- ✅ Add “update available” and “updated” footer messages with version color-coding.

### 3. Settings Persistence

- ✅ Save user preferences (BPM range, grooves, beats/bar, countdown mode, etc.) to localStorage.

---

### Phase 5 — Advanced Mode & Groove Editing

1. **Simple vs Advanced Mode Toggle**

   - Simple Mode:
     - Dual tempo slider (values clamped to multiples of 5).
     - Time-based sessions only (no cycles option).
     - Minimal interface: BPM range, total time, start/stop.
   - Advanced Mode:
     - Manual BPM input (any integer value).
     - Full time-signature and groove-definition options.
     - Optional enforcement toggle for grooves that differ from selected signature.
     - Four visual rows representing drum parts:
       - Hi-Hat / Cymbal
       - Kick
       - Snare
       - Hi-Hat Control (open/closed)
     - Each row displayed as a sequence of unlit circles the user can **tap or click** to activate beats.
     - Active circles light up and play in sync with the metronome.
     - Grooves are **not tied to a fixed BPM**, allowing them to be reused across tempo changes.

2. **Groove Pattern Editor**

   - Visual editor for defining patterns:
     - Click / tap to toggle hits on or off per instrument row.
     - Optional preview playback for quick testing.
     - Supports grooves that span **multiple measures** (e.g. Bossa Nova = 2 bars).
   - Add a small note reminding users that some grooves naturally require more than one measure.

3. **User Groove Persistence**

   - Users can **save, edit, rename, and delete** grooves.
   - Saved to `localStorage` as JSON (lightweight, offline-ready).
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
   - Automatically reload last-used groove at startup.
   - Optional _“Reset to Defaults”_ button.

4. **Default Groove Library (Optional Reference)**

   - Provide a small built-in JSON file (`defaultGrooves.json`) bundled with the PWA.
   - Contains several well-known starter patterns (e.g. Rock 4/4, Bossa Nova, Funk Groove).
   - Users can enable or import these as reference templates.

5. **Accessibility Layer (Lightweight)**
   - Keyboard-navigable controls (`Tab`, `Enter`).
   - `aria-label` attributes for all buttons and sliders.
   - Visuals (beat circles) include accessible text descriptions for screen readers.
   - Accent vs. normal beat colors chosen for **high contrast** and **color-blind safety**.

---

### Phase 6 — Groove Sharing, Import / Export, and Collaboration (Future)

1. **Export User Grooves**

   - Allow export of selected or all user-defined grooves as a single downloadable `.json` file.
   - Keeps structure consistent with `userGrooves` object used internally.

2. **Import Groove Files**

   - Enable drag-and-drop or file-picker import of JSON groove files.
   - Merge imported grooves with existing ones (prompt user on name conflicts).

3. **Share Groove Links (Optional)**

   - Generate a shareable JSON or encoded link (local only; no server).
   - Example: `groovetrainer.app#share=<encodedJSON>`

4. **Preset Management Tools**

   - Option to **backup / restore** grooves across browsers via manual file handling.
   - May later extend to QR-based sharing for mobile convenience.

5. **Privacy & Lightweight Principles**
   - No online accounts or cloud storage — all data remains client-side.
   - Import/export handled purely within the PWA sandbox.

---

> These phases maintain the lightweight, offline-first nature of Random Groove Trainer while opening the door to creative sharing and advanced rhythm editing.

---

> **Notes:** Optional features like visual-only mode, presets, and “about” modals are deferred to keep the app lightweight.  
> All future additions should respect the offline-first, lightweight philosophy.
