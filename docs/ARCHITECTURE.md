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

```
┌─────────────────────────────────────────────────────────┐
│                      index.html                         │
│                  (App Shell + UI)                       │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                      main.js                            │
│              (Bootstrap & Orchestration)                │
└─────────────────────────────────────────────────────────┘
         │              │              │              │
         ▼              ▼              ▼              ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│sessionEngine│ │uiController │ │  visuals.js │ │  utils.js   │
│    .js      │ │    .js      │ │             │ │             │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
         │              │              │
         ▼              ▼              ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ metronome   │ │  simple     │ │audioProfiles│
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

#### `js/ui/hotkeys.js`

**Purpose**: Global keyboard shortcuts

**Responsibilities**:

- Space, P, N, arrows, H hotkey handling
- Owner-aware routing (groove vs simple)
- BPM adjustment with margin enforcement
- Hotkey lock to prevent rapid-fire
- Input validation helpers

**Key Functions**:

- `setupHotkeys()` - Register all keyboard event listeners
- Private helpers: `validateNumericInput()`, `adjustGrooveInput()`, `adjustSimpleBpm()`

**Dependencies**: `debug.js`, `constants.js`, `sessionEngine.js`, `simpleMetronome.js`, `sliders.js`

---

#### `js/ui/sliders.js`

**Purpose**: BPM range sliders and input validation

**Responsibilities**:

- Dual-point and single-point noUiSlider initialization
- Active pip highlighting
- Clickable pips for direct value selection
- Numeric input validation with clamping
- Cross-check BPM min/max with 5 BPM margin
- UI notice system (floating notifications)

**Key Functions**:

- `initSliders()` - Create and wire up both sliders
- `updateBpmInputSteps()` - Dynamic step attribute updates
- `showNotice(message, duration)` - Floating UI notifications
- Private helpers: `validateNumericInput()`, `attachInputValidation()`, `createMetronomeSlider()`

**Dependencies**: `debug.js`, `constants.js`, `utils.js`, noUiSlider

---

#### `js/ui/controls.js`

**Purpose**: Sound profiles, panning mode, and time signature controls

**Responsibilities**:

- Synchronized sound profile dropdowns (Groove & Simple)
- Synchronized panning mode toggles
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
2. **`main.js`** executes:

   - Initializes cores (`metronomeCore`, `simpleMetronomeCore`)
   - Creates visual callbacks
   - Primes visual containers (prevents layout shift)
   - Registers callbacks with cores
   - Initializes UI modules (dark mode, sound profiles, etc.)
   - Fetches version from `commits.json`
   - Registers service worker

3. **User interaction** → UI events trigger state changes

---

### Groove Session Flow

```
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

```
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

- `sessionEngine.getActiveModeOwner()` returns: `"groove"` | `"simple"` | `null`
- Ownership is claimed before starting audio
- Ownership is released on stop/error
- UI guards prevent starting conflicting modes

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

3. **Hotkeys** (`uiController.js`):

   ```javascript
   if (owner && owner !== target) {
     showNotice("Cannot adjust BPM during playback");
     return;
   }
   ```

4. **Mode Tabs** (`uiController.js`):
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

### Automated Testing (Planned)

- Unit tests for `utils.js` helpers
- Integration tests for mode switching
- Visual regression tests for UI components

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

### Phase 5: Advanced Features

- Groove editor (visual beat grid)
- User-defined patterns (localStorage)
- Import/export groove files (JSON)
- QR code sharing

---

## 📚 Related Documentation

- [Debugging Guide](./DEBUGGING.md)
- [API Reference](./API_REFERENCE.md)
- [Visuals System](./VISUALS_SYSTEM.md)
- [Versioning System](./VERSIONING.md)
- [Development Roadmap](./ROADMAP.md)
