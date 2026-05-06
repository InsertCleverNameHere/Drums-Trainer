# UI Modules Reference

## Overview

The `uiController.js` module has been successfully modularized from ~1800 lines into a clean, maintainable structure with clear separation of concerns.

---

## Module Structure

```bash
js/
├── uiController.js         (~440 lines)  Main orchestrator
└── ui/
    ├── advancedMode.js     (~500 lines)  Simple/Advanced toggle, step, chip, steppers
    ├── grooveEditor.js     (~450 lines)  Pattern grid, State A/B logic, list management
    ├── theme.js            (~133 lines)  Dark mode
    ├── hotkeys.js          (~235 lines)  Keyboard shortcuts (dynamic step-aware)
    ├── sliders.js          (~308 lines)  noUiSlider, blur-pair validation
    ├── controls.js         (~187 lines)  Sound profiles, time signatures
    ├── panels.js           (~234 lines)  Mode tabs, simple panel
    └── wakeLock.js         (~150 lines)  Screen wake lock
```

**Total Reduction**: 1800 → 1537 lines (with better organization and maintainability)

---

## Module Dependencies

### `uiController.js` (Orchestrator)

**Imports**:

- `debug.js` - Debug logging
- `constants.js` - Visual timing constants
- `sessionEngine.js` - Session lifecycle
- `simpleMetronome.js` - Simple metronome state
- All UI submodules (theme, hotkeys, sliders, controls, panels, wakeLock)

**Exports**:

- `initUI(deps)` - Initialize main UI
- `initOwnershipGuards()` - Prevent mode conflicts
- `updateFooterMessage()` - Version display
- `initMuteControl`
- `initUpdateUI()` - Update check UI
- `initAllUI()` - Initialize all submodules
- Re-exports: `initDarkMode`, `showNotice`, `initSoundProfileUI`, `initSimplePanelControls`, `initAdvancedMode`, `restoreDefaults`, `isAdvancedMode`, `getQuantizationStep`

**Responsibilities**:

- Session button wiring (Start, Pause, Next)
- Tooltip toggle logic
- Footer message updates
- Update check UI
- Simple metronome UI sync
- Ownership guards
- Audio Privacy (Mute) synchronization

---

### `js/ui/advancedMode.js`

**Imports**:

- `debug.js` - Debug logging
- `constants.js` - `BPM_STEP_LIMITS`, `getUserQuantizationPreference`
- `utils.js` - `sanitizeQuantizationStep`, `QUANTIZATION`

**Exports**:

- `initAdvancedMode()` - Full init (read state, DOM, wire listeners)
- `isAdvancedMode()` - Current mode boolean
- `getQuantizationStep()` - Current step (1–150)
- `getGrooveAnchor()` - `"min"` or `"max"`
- `getSimpleBpmAnchor()` / `setSimpleBpmAnchor(v)` - simpleBpm anchor
- `snapToGrid(value, step, anchor, min, max)` - Anchor-relative snap
- `restoreDefaults()` - Full reset + reload
- `isDashboardEnabled()`

**Responsibilities**:

- Toggle lifecycle: reads `localStorage.advancedMode`, applies `html.advanced-mode`
- User-defined BPM step: reads `localStorage.bpmQuantizationStep`, sanitizes to [1–150]
- Syncs `utils.QUANTIZATION.groove` so `randomizeGroove()` uses the live step
- Renders settings chip row in both panels (time-sig · profile · subdivision)
- Wires ± stepper buttons by synthesising `KeyboardEvent` on `window` (hotkeys pipeline reuse)
- Ownership guard: disables toggle/step/anchor controls during playback
- `_correctMarginIfViolated()`: adjusts bpmMin/bpmMax when a new step makes gap < step
- Management of `editing` state to the ownership guard for bidirectional lockout.
- Persistence and management of the Multi-track Dashboard preference.

**BPM grid rules**:

- `bpmMin`/`bpmMax`: hard-limit clamp only on blur; no snap. Margin enforced via blur-pair deferral in `sliders.js` (`checkGrooveMargin`). `lastValidValue` written only by `checkGrooveMargin`.
- `simpleBpm`: anchor-relative snap on blur. Anchor = last blurred simpleBpm value. Updated by `setSimpleBpmAnchor()` from `sliders.js`.

---

### `js/ui/grooveEditor.js`

**Imports**:

- `grooveStorage.js` - Data persistence
- `patternScheduler.js` - Audio sync
- `visuals.js` - Layout generator

**Exports**:

- `initGrooveEditor()` - Initialize A/B state, list restoration, and grid listeners.
- `updatePlayhead(tick)` - Drive visual highlight on the pattern grid.
- `forceStateA()` - Revert to textarea when switching to Simple Mode.

**Responsibilities**:

- State A/B Management: GSAP-powered transitions between raw textarea and chip list.
- Grid Rendering: Dynamic 4-track grid generation based on local rhythmic sovereignty.
- Data Reconciliation: Syncing local UI inputs with persistent pattern storage.
- Storage UX: "Replacement Mode" flow for handling the 100-pattern capacity limit.
- Ownership: Claiming `"editing"` owner state to lock metronome controls.

---

### `js/ui/theme.js`

**Imports**:

- `debug.js` - Debug logging
- `constants.js` - getUserQuantizationPreference
- `utils.js` - sanitizeQuantizationStep

**Exports**:

- `initDarkMode()` - Theme toggle system

**Responsibilities**:

- Dark mode toggle with system preference detection
- Theme persistence (localStorage)
- Icon animation on toggle

**Note**: Quantization is now owned by `advancedMode.js`. `initQuantization`, `getSafeQuantization`, and `getQuantizationLevel` are no longer exported from this module.

---

### `js/ui/hotkeys.js`

**Imports**:

- `debug.js` - Debug logging
- `constants.js` - Visual timing, input limits
- `sessionEngine.js` - Session state
- `simpleMetronome.js` - Simple metronome control
- `sliders.js` - showNotice
- `advancedMode.js` - `isAdvancedMode()`, `getQuantizationStep()`, `getSimpleBpmAnchor()`

**Exports**:

- `setupHotkeys()` - Register keyboard event listeners

**Private Functions**:

- `validateNumericInput(input)` - Validate and clamp inputs
- `adjustGrooveInput(delta)` - Adjust min/max BPM
- `adjustSimpleBpm(delta)` - Adjust simple metronome BPM

**Hotkey Mappings**:

- `Space` → Start/Stop (owner-aware)
- `P` → Pause/Resume (owner-aware)
- `N` → Next groove (Groove mode only)
- `H` → Toggle settings dialog
- `↑` / `↓` → Adjust BPM by active step (Simple Mode: 5; Advanced Mode: user-defined step). Blocked during playback.
- `←` / `→` → Switch Min/Max target (Groove panel only)

**State Management**:

- `_hotkeyLock` - Prevents rapid-fire hotkeys (120ms debounce)
- `window.__adjustingTarget` - Tracks "min" or "max" for arrow keys

---

### `js/ui/sliders.js`

**Imports**:

- `debug.js` - Debug logging
- `constants.js` - Input limits
- `utils.js` - sanitizePositiveInteger, sanitizeQuantizationStep

**Exports**:

- `initSliders()` - Create and wire up sliders
- `updateBpmInputSteps()` - Dynamic step attribute updates
- `showNotice(message, duration)` - Floating UI notifications

**Private Functions**:

- `validateNumericInput(input)` - Validate and sanitize inputs
- `attachInputValidation()` - Attach validation to all inputs
- `createMetronomeSlider(elementId, config)` - noUiSlider factory

**Global Functions** (exposed on window):

- `window.toggleGrooveSliderDisabled(disabled)` - Enable/disable groove slider
- `window.toggleSimpleSliderDisabled(disabled)` - Enable/disable simple slider

**Slider Features**:

- Dual-handle (Groove) and single-handle (Simple) sliders
- Active pip highlighting (red marker + bold text)
- Clickable pips for direct value selection
- Synced with numeric inputs (bidirectional)
- Disabled during playback

**Input Validation**:

- Numeric-only keyboard input and paste sanitization
- Hard-limit clamp [30–300] on blur for all BPM inputs
- **Blur-pair deferral** (`bpmMin`/`bpmMax`): margin cross-check (`checkGrooveMargin`) fires only after both fields have blurred. `lastValidValue` is written exclusively by `checkGrooveMargin` — not by `validateNumericInput` — to preserve a valid revert target across the deferred pair.
- **`simpleBpm` snap** (Advanced Mode only): `snapToGrid()` called on blur; `setSimpleBpmAnchor()` updates anchor on success.
- In Advanced Mode, slider writeback to numeric inputs is suppressed (input is source of truth).n

---

### `js/ui/controls.js`

**Imports**:

- `debug.js` - Debug logging
- `audioProfiles.js` - Sound profile management
- `simpleMetronome.js` - Simple metronome core

**Exports**:

- `initSoundProfileUI()` - Profile dropdown sync
- `initPanningModeUI()` - Panning toggle sync
- `initTimeSignatureUI()` - Time signature controls

**Sound Profile Features**:

- Synchronized dropdowns (Groove & Simple)
- Profiles: Digital, Soft, Ping, Bubble, Clave
- Persisted via localStorage (`activeSoundProfile`)

**Panning Mode Features**:

- Single "Reduce Motion" toggle in Settings
- Modes: Reduced Motion (Intelligent) vs Full Motion (Forced)
- Disabled during playback
- Persisted via localStorage (`intelligentPanningMode`)
- Dispatches `panningModeChanged` event for visuals.js

**Time Signature Features**:

- Preset selection (4/4, 3/4, 2/4, 6/8, 7/8, 12/8, custom)
- Custom numerator/denominator inputs
- Subdivision dropdown (none, 8ths, 16ths)
- Conditional subdivision visibility (only for denominator=4)
- Wired to both metronome cores (groove & simple)

---

### `js/ui/panels.js`

**Imports**:

- `debug.js` - Debug logging
- `sessionEngine.js` - Session lifecycle
- `simpleMetronome.js` - Simple metronome control
- `utils.js` - calculateTapTempo

**Exports**:

- `initModeTabs(sessionEngine, simpleMetronome)` - Mode switching logic
- `initSimplePanelControls()` - Simple metronome UI wiring

**Private Functions**:

- `setTabEnabled(tabEl, enabled)` - Enable/disable tabs
- `setActiveMode(mode, ...)` - Update panel visibility
- `updateSimpleUI()` - Sync simple metronome UI state

**Mode Tab Features**:

- Groove / Simple tab switching
- Owner-aware tab disabling
- Prevents switching during playback
- Responds to `metronome:ownerChanged` events

**Simple Panel Features**:

- Start/Stop/Pause button logic
- BPM input handling
- Tap tempo feature (weighted average, 5 BPM quantization)
- Slider enable/disable during playback
- State syncing via custom events

---

## Import Graph

```bash
main.js
  ↓
uiController.js
  ├─→ advancedMode.js ─→ debug, constants, utils
  ├─→ grooveEditor.js ─→ debug, grooveStorage, patternScheduler, visuals, advancedMode
  ├─→ theme.js ─────────→ debug, constants, utils
  ├─→ hotkeys.js ───────→ debug, constants, sessionEngine, simpleMetronome, sliders, advancedMode
  ├─→ sliders.js ───────→ debug, constants, utils, advancedMode
  ├─→ controls.js ──────→ debug, audioProfiles, simpleMetronome
  └─→ panels.js ────────→ debug, sessionEngine, simpleMetronome, utils
```

**Key Dependencies**:

- **sessionEngine.js** → imports `sliders.js` (for showNotice)
- **hotkeys.js** → imports `sliders.js` (for showNotice)
- **No circular dependencies** ✅

---

## External Dependencies

### Third-Party Libraries

- **noUiSlider** (v15.x) - Used by `sliders.js`
- **GSAP** (v3.x) - Used by `visuals.js` (not in UI modules)

### Browser APIs

- **localStorage** - Used by all modules for persistence
- **matchMedia** - Used by `theme.js` for system preference detection
- **Performance API** - Used by `utils.js` for tap tempo timing

---

## Event System

### Custom Events Dispatched

| Event                        | Module             | Payload                               | Purpose                                  |
| ---------------------------- | ------------------ | ------------------------------------- | ---------------------------------------- |
| `panningModeChanged`         | controls.js        | `{intelligent: boolean}`              | Notify visuals.js of mode change         |
| `metronome:ownerChanged`     | sessionEngine.js   | `{owner: string\|null}`               | Notify all modules of ownership change   |
| `simpleMetronome:state`      | simpleMetronome.js | `{running: boolean, paused: boolean}` | Notify UI of state change                |
| `toggleTooltip`              | uiController.js    | none                                  | Toggle help dialog                       |
| `metronome:timeSigChanged`   | controls.js        | {beats, value, ticksPerBeat}          | Notify Editor Grid to re-render          |
| `metronome:visalmodeChanged` | advancedMode.js    | {enabled: boolean}                    | Notify visuals.js to swap Dashboard mode |

### Custom Events Listened

| Event                        | Module                 | Handler                   |
| ---------------------------- | ---------------------- | ------------------------- |
| `DOMContentLoaded`           | theme.js               | initQuantization()        |
| `metronome:ownerChanged`     | controls.js, panels.js | Enable/disable controls   |
| `simpleMetronome:state`      | uiController.js        | Update simple panel UI    |
| `toggleTooltip`              | uiController.js        | Toggle tooltip visibility |
| `metronome:timeSigChanged`   | grooveEditor.js        | -                         |
| `metronome:visalmodeChanged` | visuals.js             | -                         |

---

## Global State Management

### Global Objects

- `window.QUANTIZATION` - Created by `theme.js`, used by `utils.js`
- `window.__adjustingTarget` - Created by `hotkeys.js`, tracks "min" or "max"

### Global Functions (on window)

- `window.toggleGrooveSliderDisabled(disabled)` - From `sliders.js`
- `window.toggleSimpleSliderDisabled(disabled)` - From `sliders.js`

### localStorage Keys

| Key                       | Module           | Type              | Purpose                         |
| ------------------------- | ---------------- | ----------------- | ------------------------------- |
| `darkMode`                | theme.js         | `"true"\|"false"` | Theme preference                |
| `intelligentPanningMode`  | controls.js      | `"true"\|"false"` | Reduce Motion preference        |
| `activeSoundProfile`      | controls.js      | string            | Active sound profile            |
| `lastSeenVersion`         | uiController.js  | string            | Version tracking                |
| `lastSeenHash`            | uiController.js  | string            | Hash tracking                   |
| `cachedMsgCount`          | uiController.js  | number            | Footer message suppression      |
| `updateMsgCount`          | uiController.js  | number            | Footer message suppression      |
| `wakeLockEnabled`         | wakeLock.js      | `"true"\|"false"` | Wake lock preference            |
| `advancedMode`            | advancedMode.js  | `"true"\|"false"` | Simple/Advanced mode preference |
| `bpmQuantizationStep`     | advancedMode.js  | number string     | User-defined BPM step (1–150)   |
| `grooveAnchor`            | advancedMode.js  | `"min"\|"max"`    | Groove grid anchor direction    |
| `userGrooveNames`         | grooveEditor.js  | string            | Persisted practice list content |
| `patternDashboardEnabled` | advancedMode.js  | `"true"\|"false"` | User visual preference (rows)   |
| `audioMuted`              | audioProfiles.js | `"true"\|"false"` | Audio privacy preference        |
| `grooveEditorState`       | grooveEditor.js  | `"text"\|"list"`  | State A/B UI choice persistence |

---

## Testing Checklist

### Automated Test Files

- `tests/advanced-mode.test.html` — `advancedMode.js` public API (snapToGrid, step, anchor)
- `tests/dark-mode.test.html` — `initDarkMode()` (saved pref, system default, toggle, auto-switch)
- `tests/hotkeys.test.html` — guard logic, ownership blocking, dynamic step in Advanced Mode
- `tests/uicontroller-modularization-tests.html` — export surface, removed exports confirmed absent

### End-to-End (system-verification.js)

Run in DevTools console against live page. Covers all of the below:

### Manual Verification Points

- [x] FUOC: `data-theme` and `html.advanced-mode` set before paint
- [x] Simple Mode: sliders visible, steppers hidden, chips empty, session/sound/timesig hidden
- [x] Advanced Mode: steppers visible, sliders hidden, chips populated, all controls revealed
- [x] BPM step input sanitizes to [1–150], persists, wires `utils.QUANTIZATION.groove`
- [x] Stepper ± buttons step by user-defined step; margin guard uses step not 5
- [x] `simpleBpm` blur snap (anchor-relative); anchor updates after each successful blur
- [x] `bpmMin`/`bpmMax` blur: hard clamp only; margin correction only after both fields blur
- [x] Settings chip row shows correct time-sig · profile · subdivision in both panels
- [x] `restoreDefaults()` clears localStorage, reloads, dark mode follows system preference
- [x] Hotkeys step by active step; blocked during playback
- [x] Ownership: tabs lock during playback, re-enable on stop
- [x] Tap tempo unaffected by custom step (always step=5)
- [ ] Visual regression tests
- [x] Mute Sync: Toggling mute on Groove panel updates Simple panel icon instantly.
- [x] Mute FUOC: Mute state persists through refresh with zero "White-to-Red" flicker.
- [x] State Persistence: Textarea list and "Confirm Names" state survive page reloads.
- [x] Sovereignty: Programmed 7/8 pattern overrides global 4/4 metronome and grays out controls.
- [x] Multi-measure: 2-bar pattern plays to end of 2nd bar before stopping cycle.
- [x] Replacement: Saving 101st pattern triggers chip-list "Confirm?" overwrite flow.
- [x] Exclusivity: Opening the Editor disables the metronome "Start" buttons (Owner: editing).

---

## Future Improvements

### Potential Enhancements

1. **Unit tests** for all UI modules (using Jest or Vitest)
2. **Visual regression tests** for slider/dropdown components
3. **TypeScript migration** for better type safety
4. **React migration** (if needed for advanced features)
5. **Accessibility audit** (WCAG 2.1 AA compliance)
6. **Performance profiling** (using Profiler.js)
7. **Bundle size optimization** (tree-shaking unused code)

### Known Limitations

- No undo/redo for UI changes
- No keyboard-only workflow (mouse required for some controls)
- No multi-language support
- No A/B testing for UI variations

---

## Troubleshooting

### Common Issues

**Issue**: Hotkeys stop working
**Solution**: Click outside any input field to remove focus

**Issue**: Sliders don't sync with inputs
**Solution**: Hard refresh (`Ctrl+Shift+R`) to clear cache

**Issue**: Dark mode doesn't persist
**Solution**: Check browser localStorage support

**Issue**: Tap tempo doesn't work
**Solution**: Ensure metronome is stopped (not paused)

**Issue**: Mode tabs won't switch
**Solution**: Check if a metronome is running (ownership conflict)

---

## Related Documentation

- [Architecture Overview](./ARCHITECTURE.md)
- [API Reference](./API_REFERENCE.md)
- [Debugging Guide](./DEBUGGING.md)
- [Development Roadmap](./ROADMAP.md)
