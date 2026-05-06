# Architecture Overview

## 🎯 Design Philosophy

The Random Groove Trainer follows these core principles:

1. **Modular Design**: Each module has a single responsibility
2. **Loose Coupling**: Modules communicate via clean APIs
3. **Web Audio First**: Precise timing via Web Audio API scheduler
4. **Offline-Ready**: Full PWA with service worker caching
5. **Progressive Enhancement**: Works without JS, enhanced with it

---

## 📊 Module Hierarchy

```bash
┌─────────────────────────────────────────────────────────┐
│                      index.html                         │
│  (App Shell — inline FUOC script sets data-theme,       │
│   audio-muted, and html.advanced-mode synchronously)    │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                      main.js                            │
│              (Bootstrap, Wiring, & Context Unlock)      │
└─────────────────────────────────────────────────────────┘
         │              │              │              │
         ▼              ▼              ▼              ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│sessionEngine│ │uiController │ │  visuals.js │ │  utils.js   │
│    .js      │ │    .js      │ │             │ │             │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
    │        │          │              │               │
    ▼        └──────────┼──────────────┤               ▼
┌─────────────┐         │        ┌─────────────┐ ┌─────────────┐
│grooveStorage│         │        │  pattern    │ │ sampleLoader│
│    .js      │         │        │ Scheduler.js│ │     .js     │
└─────────────┘         │        └─────────────┘ └─────────────┘
         │              │              │               │
         ▼              ▼              ▼               │
┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│ metronome   │ │  simple     │ │audioProfiles│<───────┘
│  Core.js    │ │Metronome.js │ │    .js      │
└─────────────┘ └─────────────┘ └─────────────┘
         │              │              │
         └──────────────┴──────────────┘
                        ▼
              ┌─────────────────┐
              │   Web Audio     │
              │   API Context   │
              └─────────────────┘
```

UI submodules (under `js/ui/`): `advancedMode.js`, `theme.js`, `hotkeys.js`, `sliders.js`, `controls.js`, `panels.js`, `wakeLock.js`

---

## 🧩 Module Responsibilities

### **Core Audio Modules**

#### `js/metronomeCore.js`

**Purpose**: Groove metronome audio scheduling engine

**Responsibilities**:

- Web Audio API scheduler (5ms lookahead)
- Beat/subdivision tick generation
- Time signature & tempo management
- Count-in audio generation
- Pause/resume state management

**Key Functions**:

- `startMetronome(bpm)` - Initialize audio scheduler
- `stopMetronome()` - Cleanup and stop
- `performCountIn(bpm, tempoSynced)` - 3-2-1 count-in
- `setTimeSignature(beats, value)` - Update time sig
- `setTicksPerBeat(n)` - Set subdivisions (1=none, 2=8ths, 4=16ths)
- `registerVisualCallback(cb)` - Connect visual renderer

**Dependencies**: `audioProfiles.js`, `debug.js`, `constants.js`

---

#### `js/simpleMetronomeCore.js`

**Purpose**: Standalone simple metronome (independent of groove mode)

**Responsibilities**:

- Isolated audio scheduling (25ms lookahead)
- Same timing precision as groove core
- Independent state management

**Key Functions**: Same API as `metronomeCore.js`

**Dependencies**: `audioProfiles.js`, `debug.js`, `constants.js`

---

#### `js/audioProfiles.js`

**Purpose**: Centralized sound generation and profile management

**Responsibilities**:

- Procedural tick generation (no audio files)
- Sound profile system (Digital, Soft, Ping, Bubble, Clave)
- Shared AudioContext singleton
- Accent vs. normal beat distinction

**Key Functions**:

- `ensureAudio()` - Initialize AudioContext
- `playTick(isAccent)` - Generate procedural tick
- `setActiveProfile(name)` - Switch sound profiles
- `getAvailableProfiles()` - List all profiles

**Dependencies**: `debug.js`

#### `js/sampleLoader.js`

**Purpose**: Management of acoustic WAV assets.
**Responsibilities**:

- Asynchronous fetching and decoding of drum samples.
- Memory caching of AudioBuffers for latency-free playback.
- Single-point asset manifest for the acoustic kit and WAV-based metronome profiles.

#### `js/patternScheduler.js`

**Purpose**: The rhythmic "brain" for programmed grooves.
**Responsibilities**:

- Mapping metronome ticks to pattern steps across multiple measures.
- Triggering sample playback with 1:1 synchronization to the metronome clock.
- Logic for suppressing standard metronome beeps when a drum hit is scheduled.

#### `js/grooveStorage.js`

**Purpose**: Persistent data layer for user-defined rhythms.
**Responsibilities**:

- LocalStorage CRUD operations for rhythmic patterns and metadata.
- Management of the 100-pattern capacity limit.
- Persistence of the user's custom groove name list.

---

### **Session Management**

#### `js/sessionEngine.js`

**Purpose**: Groove session lifecycle and timing

**Responsibilities**:

- Cycle timing (time-based or cycle-count)
- Session countdown management
- Ownership system (prevent mode conflicts)
- Pause/resume orchestration
- Finishing bar coordination

**Key Functions**:

- `startSession()` - Begin groove session
- `pauseSession()` - Pause current cycle
- `nextCycle()` - Skip to next groove
- `stopSession(message)` - End session gracefully
- `setActiveModeOwner(owner)` - Claim/release ownership

**Dependencies**: `metronomeCore.js`, `visuals.js`, `utils.js`, `debug.js`

---

### **UI & Interaction**

#### `js/uiController.js` (Orchestrator)

**Purpose**: Main UI orchestrator - coordinates all UI submodules

**Responsibilities**:

- Imports and initializes all UI submodules
- Session button wiring (Start, Pause, Next)
- Tooltip toggle logic
- Footer message updates
- Update check UI
- Simple metronome UI sync
- Ownership guards

**Key Functions**:

- `initUI(deps)` - Wire up session controls and tooltips
- `initOwnershipGuards()` - Prevent mode conflicts
- `updateFooterMessage()` - Version display with fade animation
- `initUpdateUI()` - Update check button and notifications
- `initAllUI()` - Initialize all submodules (hotkeys + sliders)

**Dependencies**: All UI submodules, `sessionEngine.js`, `simpleMetronome.js`

---

#### `js/ui/theme.js`

**Purpose**: Theme and quantization initialization

**Responsibilities**:

- Dark mode toggle with system preference detection
- Quantization setup and safety checks
- Theme persistence (localStorage)
- Icon animation on toggle

**Key Functions**:

- `initDarkMode()` - Theme toggle system
- `initQuantization()` - Setup quantization with auto-correction
- `getSafeQuantization()` - Get validated quantization settings
- `getQuantizationLevel()` - Get current level with fallback

**Dependencies**: `debug.js`, `constants.js`, `utils.js`

---

#### `js/ui/advancedMode.js`

**Purpose**: Simple / Advanced Mode toggle, BPM step management, and settings chip row

**Responsibilities**:

- Owns the `advancedMode` toggle lifecycle (read localStorage, apply `html.advanced-mode` class)
- Manages the `.bpm-step` user-defined quantization step (1–150, default 5)
- Manages the groove anchor direction (`"min"` | `"max"`) for anchor-relative grid alignment
- Tracks the `simpleBpmAnchor` (captured on Advanced Mode enable and each successful simpleBpm blur)
- Renders the persistent settings chip row showing current time-sig, profile, and subdivision
- Provides `snapToGrid()` — anchor-relative grid snap used by `sliders.js` on simpleBpm blur
- Wires ± stepper buttons (synthesises `KeyboardEvent` on `window` so hotkeys pipeline is reused)
- Disables all Advanced Mode controls during playback (ownership guard)
- `restoreDefaults()` — clears localStorage and reloads

**Key Functions**:

- `initAdvancedMode()` - Read state, apply DOM, wire all listeners (call once at startup)
- `isAdvancedMode()` - Returns current mode boolean
- `getQuantizationStep()` - Returns current step (1–150)
- `getGrooveAnchor()` - Returns `"min"` or `"max"`
- `getSimpleBpmAnchor()` / `setSimpleBpmAnchor(v)` - Anchor for simpleBpm grid
- `snapToGrid(value, step, anchor, min, max)` - Anchor-relative nearest-grid snap
- `restoreDefaults()` - Full localStorage clear + reload

**BPM grid design**:

- `bpmMin` / `bpmMax`: **no blur-time snap** — quantization deferred to play time (`runCycle`). Hard-limit clamp [30–300] only. Margin enforcement (gap ≥ step) fires via blur-pair deferral in `sliders.js`.
- `simpleBpm`: **anchor-relative snap on blur** — snaps to nearest `anchor + n*step` grid point. Anchor updates after each successful blur.

**Dependencies**: `debug.js`, `constants.js` (`BPM_STEP_LIMITS`), `utils.js`

---

#### `js/ui/hotkeys.js`

**Purpose**: Global keyboard shortcuts

**Responsibilities**:

- Space, P, N, arrows, H hotkey handling
- Owner-aware routing (groove vs simple)
- BPM adjustment with dynamic step (reads `advancedMode.getQuantizationStep()`, falls back to 5 in Simple Mode)
- Margin enforcement uses the live step, not a hardcoded value
- Hotkey lock to prevent rapid-fire
- Flash overlay animation via `.bpm-flash-overlay` sibling div (Firefox `@keyframes` fix)

**Key Functions**:

- `setupHotkeys()` - Register all keyboard event listeners
- Private helpers: `validateNumericInput()`, `adjustGrooveInput()`, `adjustSimpleBpm()`

**Dependencies**: `debug.js`, `constants.js`, `sessionEngine.js`, `simpleMetronome.js`, `sliders.js`, `advancedMode.js`

---

#### `js/ui/wakeLock.js`

**Purpose**: Screen wake lock lifecycle management

**Responsibilities**:

- Acquire/release wake lock via Screen Wake Lock API
- Handle visibility change events for auto-reacquisition
- Persist user preference via `localStorage`
- manage "System Release" events to prevent double-logging

**Key Functions**:

- `initWakeLock()` - Initialize and restore state
- `enableWakeLock()` - Acquire with retry logic
- `disableWakeLock()` - Release wake lock
- `isWakeLockSupported()` - Browser check
- `isWakeLockActive()` - Get current state

**Private Helpers**:

- `handleSystemRelease()` - Prevents double logging on release
- `handleVisibilityChange()` - Tab focus handler
- `reacquireWithRetry()` - Exponential backoff retry

**Dependencies**: `debug.js`

---

#### `js/ui/sliders.js`

**Purpose**: BPM range sliders and input validation

**Responsibilities**:

- Dual-point and single-point noUiSlider initialization
- Active pip highlighting
- Clickable pips for direct value selection
- Numeric input validation with hard-limit clamping [30–300]
- Blur-pair deferral: `bpmMin`/`bpmMax` margin cross-check fires only after both fields have blurred; `lastValidValue` is written only by `checkGrooveMargin`, not by `validateNumericInput`, to prevent premature revert targets
- `simpleBpm` blur triggers `advancedMode.snapToGrid()` in Advanced Mode; anchor updated via `setSimpleBpmAnchor()`
- Slider writeback suppressed in Advanced Mode (numeric input is source of truth)
- UI notice system (floating notifications)

**Key Functions**:

- `initSliders()` - Create and wire up both sliders
- `updateBpmInputSteps()` - Dynamic step attribute updates
- `showNotice(message, duration)` - Floating UI notifications
- Private helpers: `validateNumericInput()`, `attachInputValidation()`, `createMetronomeSlider()`

**Dependencies**: `debug.js`, `constants.js`, `utils.js`, `advancedMode.js`, noUiSlider

---

#### `js/ui/controls.js`

**Purpose**: Sound profiles, panning mode, and time signature controls

**Responsibilities**:

- Synchronized sound profile dropdowns (Groove & Simple)
- Single "Reduce Motion" toggle in settings menu
- Time signature preset and custom input handling
- Subdivision visibility logic
- Profile and mode persistence (localStorage)

**Key Functions**:

- `initSoundProfileUI()` - Profile dropdown sync and persistence
- `initPanningModeUI()` - Panning toggle sync and events
- `initTimeSignatureUI()` - Time signature controls for both panels

**Dependencies**: `debug.js`, `audioProfiles.js`, `simpleMetronome.js`

---

#### `js/ui/panels.js`

**Purpose**: Mode tabs and simple metronome panel

**Responsibilities**:

- Groove/Simple mode tab switching
- Tab enable/disable based on ownership
- Simple metronome Start/Stop/Pause button logic
- Tap tempo feature
- Slider enable/disable during playback

**Key Functions**:

- `initModeTabs(sessionEngine, simpleMetronome)` - Mode switching logic
- `initSimplePanelControls()` - Simple metronome UI wiring
- Private helpers: `setTabEnabled()`, `setActiveMode()`, `updateSimpleUI()`

**Dependencies**: `debug.js`, `sessionEngine.js`, `simpleMetronome.js`, `utils.js`

---

#### `js/ui/grooveEditor.js`

**Purpose**: Pattern editing UI and State A/B management.
**Responsibilities**:

- Managing the transition between raw textarea (State A) and interactive list (State B).
- Rendering the multi-track rhythmic grid based on local pattern sovereignty.
- Driving the visual playhead highlight in the editor grid.
- Handling "Replacement Mode" flow for managing storage capacity.
- Persisting the Editor's UI state (Text vs List) across reloads.

---

#### `js/simpleMetronome.js`

**Purpose**: Simple metronome panel controller

**Responsibilities**:

- UI state for simple metronome
- Start/stop/pause button logic
- BPM input handling
- Tap tempo feature

**Key Functions**:

- `start()` - Start simple metronome
- `stop()` - Stop playback
- `pause()` / `resume()` - Pause controls
- `setBpm(bpm)` - Update tempo

**Dependencies**: `simpleMetronomeCore.js`, `visuals.js`, `utils.js`

---

### **Visual Feedback**

#### `js/visuals.js`

**Purpose**: Beat indicators and visual animations

**Responsibilities**:

- Phrase-based rendering (4-tick viewport)
- Hierarchical dot sizing (primary/secondary/tertiary)
- Phonation text display ("1 e & a")
- Intelligent vs. forced panning modes
- GSAP-powered animations
- Memory-efficient DOM management

**Key Functions**:

- `createVisualCallback(panelId)` - Generate tick callback
- `primeVisuals(panelId)` - Pre-render initial state
- `updateCountdownBadge(el, options)` - 3-2-1 display

**Architecture Details**:

- Segments measures into 4-tick phrases
- Compares phrase patterns to minimize re-renders
- Uses GSAP for smooth panning animations
- Properly kills tweens to prevent memory leaks

**Dependencies**: `debug.js`, `constants.js`, GSAP

---

### **Utilities & Constants**

#### `js/utils.js`

**Purpose**: Pure helper functions

**Responsibilities**:

- BPM range sanitization
- Time formatting
- Groove randomization
- Input validation helpers
- Tap tempo calculation

**Key Functions**:

- `sanitizeBpmRange(min, max, step)` - Clamp & quantize
- `randomizeGroove(groovesText, bpmMin, bpmMax)` - Pick random groove/BPM
- `calculateTapTempo()` - Weighted average from taps
- `formatTime(seconds)` - Human-readable duration

**Dependencies**: `debug.js`, `constants.js`

---

#### `js/constants.js`

**Purpose**: Single source of truth for all magic numbers

**Categories**:

- `BPM_HARD_LIMITS` - Min/max BPM (30-300)
- `BPM_DEFAULTS` - Default values for inputs
- `TIME_SIGNATURE_LIMITS` - Valid time signatures
- `SCHEDULER_CONFIG` - Audio timing parameters
- `VISUAL_TIMING` - Animation durations
- `COUNT_IN_CONFIG` - Count-in audio properties
- `INPUT_LIMITS` - Validation rules for all inputs

**Dependencies**: None (pure constants)

---

#### `js/debug.js`

**Purpose**: Runtime debug control system

**Responsibilities**:

- Selective console logging
- Category-based debug flags
- Performance timing helpers

**Usage**:

```javascript
// In browser console:
DEBUG.audio = true; // Enable audio logs
DEBUG.visuals = true; // Enable visual logs
DEBUG.all = true; // Enable everything

// In code:
debugLog("audio", "Scheduling tick at", time);
```

**Dependencies**: None

---

## 🔄 Data Flow

### Startup Sequence

1. **`index.html`** loads → DOM ready

2. **`index.html`** inline `<head>` script runs **synchronously** before any CSS or JS:
   - Sets `data-theme` attribute (prevents dark-mode FUOC)
   - Adds `html.advanced-mode` class if `localStorage.advancedMode === "true"` (prevents mode-switch flicker)

3. **`main.js`** executes:
   - `initAdvancedMode()` — reads localStorage, applies mode class, wires toggle/step/chip
   - Initializes cores (`metronomeCore`, `simpleMetronomeCore`)
   - Creates visual callbacks and primes visual containers
   - Registers callbacks with cores
   - Initializes remaining UI modules (dark mode, sliders, sound profiles, etc.)
   - Fetches version from `commits.json`
   - Registers service worker

4. **User interaction** → UI events trigger state changes

---

### Groove Session Flow

```bash
User clicks "Start"
    ↓
sessionEngine.startSession()
    ↓
Claim ownership ("groove")
    ↓
performCountIn() → 3-2-1 beeps
    ↓
metronomeCore.startMetronome(bpm)
    ↓
Audio scheduler starts (5ms loop)
    ↓
Every tick:
  - playTick(isAccent) → Web Audio API
  - visualCallback(tickIndex, ...) → Update dots
    ↓
Cycle timer counts down
    ↓
Timer reaches zero → requestEndOfCycle()
    ↓
Wait for bar boundary
    ↓
sessionEngine.completeCycle()
    ↓
Check session mode:
  - Infinite → runCycle() (next groove)
  - Cycles → check limit → stop or continue
  - Time → check timer → stop or continue
```

---

### Simple Metronome Flow

```bash
User clicks "Start" (simple panel)
    ↓
simpleMetronome.start()
    ↓
Claim ownership ("simple")
    ↓
simpleMetronomeCore.startMetronome(bpm)
    ↓
Audio scheduler starts (25ms loop)
    ↓
Every tick:
  - playTick(isAccent) → Web Audio API
  - visualCallback(tickIndex, ...) → Update dots
    ↓
User clicks "Stop"
    ↓
simpleMetronome.stop()
    ↓
Release ownership (null)
```

---

## 🔒 Ownership System

**Purpose**: Prevent audio conflicts when switching modes

**Mechanism**:

- `sessionEngine.getActiveModeOwner()` returns: `"groove"` | `"simple"` | `editing` | `null`
- Ownership is claimed before starting audio
- Ownership is released on stop/error
- UI guards prevent starting conflicting modes
- Exclusivity : If the app is in `"editing"` mode, the metronomes cannot start. If a metronome is "groove" or "simple", the editor is locked.

**Enforcement Points**:

1. **Session Start** (`sessionEngine.js`):

   ```javascript
   if (owner && owner !== "groove") return false;
   setActiveModeOwner("groove");
   ```

2. **Simple Start** (`simpleMetronome.js`):

   ```javascript
   if (owner && owner !== "simple") return false;
   setActiveModeOwner("simple");
   ```

3. Editor Open (`"grooveEditor.js"`)

```javascript
if (owner === "groove" || owner === "simple") return;
setActiveModeOwner("editing");
```

4. **Hotkeys** (`uiController.js`):

   ```javascript
   if (owner && owner !== target) {
     showNotice("Cannot adjust BPM during playback");
     return;
   }
   ```

5. **Mode Tabs** (`uiController.js`):

   ```javascript
   if (owner === "groove") {
     disableTab("metronome");
   }
   ```

---

## 🎨 Visual System Architecture

See [`docs/VISUALS_SYSTEM.md`](./VISUALS_SYSTEM.md) for detailed documentation.

**Key Innovation**: Phrase-based rendering

- Segments measures into 4-tick phrases
- Only re-renders when pattern changes (intelligent mode)
- Uses GSAP for smooth panning animations
- Properly manages memory (kills tweens before DOM removal)

### **Pattern Dashboard Mode**

## When a pattern is active, the visualizer can switch from "Standard Big Dots" to a 4-track "Acoustic Dashboard" (Kick, Snare, HH, Pedal). This mode is user-configurable via Advanced Settings and uses the same phrase-based logic to maintain visual focus.

## 🎨 Hierarchical Version Color System

**Purpose**: Provide visual feedback on version update type using color inheritance

**Location**: `js/utils.js` (color generation), `js/uiController.js` (rendering)

### Color Hierarchy Rules

The version string (X.Y.Z) uses color inheritance based on SemVer change type:

1. **Major Change** (X.0.0):
   - All components display same new color
   - Major component bold + underlined
   - Example: `v7.5.3 → v8.0.0` - All red

2. **Minor Change** (X.Y.0):
   - Major component keeps original color
   - Minor + Patch share new color
   - Minor component bold + underlined
   - Example: `v8.0.0 → v8.1.0` - `8` red, `1.0` blue

3. **Patch Change** (X.Y.Z):
   - Major + Minor keep original colors
   - Patch gets new color
   - Patch component bold + underlined
   - Example: `v8.1.0 → v8.1.1` - `8.1` red, `1` blue

4. **Initial Display** (First Visit):
   - All components same color
   - No bold/underline

### Visual Enhancements

- **Font size**: Version string 50% larger than surrounding text (`1.5em`)
- **Glow effect**: Triple-layer text-shadow for visibility in dark mode
- **Typography**: Bold + solid underline on changed components
- **Color palette**: 30 vibrant colors optimized for light/dark mode

### Key Functions

- `parseVersion(version)` - Parses version string into components
- `getVersionColors(version, previousVersion)` - Determines hierarchical colors
- `getStyledVersionHTML(version, previousVersion, includeGlow)` - Generates styled HTML
- `migrateStoredVersion(storedVersion)` - Validates stored version format

### Implementation Notes

- **Deterministic colors**: Hash-based selection ensures same version always gets same color
- **Backward compatible**: Gracefully handles migration from old color system
- **SemVer ready**: Works with current hash-based versioning and future SemVer tags
- **No cache invalidation**: Smooth migration without requiring PWA reinstall

---

## 📦 Build & Deployment

### Development

- No build step required (native ES modules)
- Use `live-server` for local development
- Chrome DevTools for debugging

### Versioning

- Auto-incremented via GitHub Actions
- `bumpVersion.js` reads Git commit hash
- Updates `commits.json` and `service-worker.js`
- See [`docs/VERSIONING.md`](./VERSIONING.md)

### Service Worker

- Cache-first strategy for offline support
- Version-aware cache invalidation
- Special handling for `commits.json` (background update)

---

## 🧪 Testing Strategy

### Manual Testing

- Use `DEBUG` flags for runtime inspection
- Chrome DevTools Performance tab for timing analysis
- Memory profiler for leak detection

### Automated Testing (Implemented)

HTML test pages in `tests/`:

- `utils.test.html` — unit tests for all `utils.js` helpers
- `advanced-mode.test.html` — unit tests for `advancedMode.js` public API (`snapToGrid`, step sanitization, anchor management)
- `dark-mode.test.html` — unit tests for `initDarkMode()` (saved preference, system default, toggle, auto-switch)
- `hotkeys.test.html` — hotkey guard logic, ownership blocking, dynamic step in Advanced Mode
- `debug.test.html` — debug flag system
- `integration.test.html` — module ownership and state synchronization
- `uicontroller-modularization-tests.html` — export surface verification

### End-to-End Verification

`tests/system-verification.js` — paste into DevTools console against the live page. Covers:
FUOC prevention, settings modal, Simple Mode visibility/validation/blur-pair deferral, Advanced Mode toggle (DOM class, stepper/slider swap, chip), Advanced Mode BPM (stepper buttons, margin guard, simpleBpm snap), groove session lifecycle, tempo-synced timing, simple metronome ownership.

### Still Pending

- Visual regression tests

---

## 🔮 Future Architecture Plans

### Phase 4: UI Modularization ✅ COMPLETED

`uiController.js` has been successfully modularized from ~1800 lines into:

- ✅ `js/uiController.js` (~440 lines) - Main orchestrator
- ✅ `js/ui/theme.js` (~133 lines) - Dark mode & quantization
- ✅ `js/ui/hotkeys.js` (~235 lines) - Keyboard shortcuts
- ✅ `js/ui/sliders.js` (~308 lines) - BPM sliders & validation
- ✅ `js/ui/controls.js` (~187 lines) - Sound profiles & time signatures
- ✅ `js/ui/panels.js` (~234 lines) - Mode tabs & simple panel

**Benefits**:

- Improved code organization and maintainability
- Clear separation of concerns
- Easier testing and debugging
- Faster onboarding for new contributors

### Phase 5.1: Simple / Advanced Mode Foundation ✅ COMPLETED

- `js/ui/advancedMode.js` — new module, owns mode toggle, step, chip row, stepper buttons
- FUOC prevention via inline `<head>` script (synchronous class/attribute application)
- Simple Mode: sliders visible, session/sound/timesig controls hidden, step hardcoded to 5
- Advanced Mode: steppers visible, sliders hidden, all controls revealed, user-defined step
- Anchor-relative BPM grid for `simpleBpm`; blur-pair deferral for `bpmMin`/`bpmMax`
- Settings chip row shows current Advanced Mode settings in both panels
- `restoreDefaults()` — full localStorage clear + reload

### Phase 5.2+: Groove Editor, Persistence, Library, Accessibility

- See `docs/ROADMAP.md` for full Phase 5 plan

---

## 📚 Related Documentation

- [Debugging Guide](./DEBUGGING.md)
- [API Reference](./API_REFERENCE.md)
- [Visuals System](./VISUALS_SYSTEM.md)
- [Versioning System](./VERSIONING.md)
- [Development Roadmap](./ROADMAP.md)
