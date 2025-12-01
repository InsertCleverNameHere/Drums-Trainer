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

#### `js/uiController.js`

**Purpose**: Global UI bindings and event handling

**Responsibilities**:

- Input validation (numeric, BPM ranges)
- Hotkey system (Space, P, N, arrows, H)
- Dark mode toggle
- Sound profile UI sync
- Mode tab switching
- Slider initialization (noUiSlider)
- Time signature dropdown logic
- Footer/version display
- Update notifications

**Key Functions**:

- `initUI(deps)` - Wire up all UI events
- `initDarkMode()` - Theme system
- `initSoundProfileUI()` - Profile dropdowns
- `initOwnershipGuards()` - Prevent mode conflicts
- `initModeTabs()` - Groove/Simple switching
- `initTimeSignatureUI()` - Time sig controls
- `showNotice(message)` - Floating UI notifications

**Dependencies**: All modules (orchestrates everything)

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

### Phase 4: UI Modularization

Break `uiController.js` (~1800 lines) into:

- `js/ui/theme.js`
- `js/ui/hotkeys.js`
- `js/ui/sliders.js`
- `js/ui/inputs.js`
- `js/ui/modals.js`
- `js/ui/tabs.js`
- `js/ui/footer.js`
- `js/ui/panels.js`
- `js/ui/timeSignature.js`

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
