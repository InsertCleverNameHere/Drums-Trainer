# UI Modules Reference

## Overview

The `uiController.js` module has been successfully modularized from ~1800 lines into a clean, maintainable structure with clear separation of concerns.

---

## Module Structure

```bash
js/
├── uiController.js         (~440 lines)  Main orchestrator
└── ui/
    ├── theme.js            (~133 lines)  Dark mode & quantization
    ├── hotkeys.js          (~235 lines)  Keyboard shortcuts
    ├── sliders.js          (~308 lines)  BPM sliders & validation
    ├── controls.js         (~187 lines)  Sound profiles & time signatures
    ├── panels.js           (~234 lines)  Mode tabs & simple panel
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
- `initUpdateUI()` - Update check UI
- `initAllUI()` - Initialize all submodules
- Re-exports from submodules for convenience

**Responsibilities**:

- Session button wiring (Start, Pause, Next)
- Tooltip toggle logic
- Footer message updates
- Update check UI
- Simple metronome UI sync
- Ownership guards

---

### `js/ui/theme.js`

**Imports**:

- `debug.js` - Debug logging
- `constants.js` - getUserQuantizationPreference
- `utils.js` - sanitizeQuantizationStep

**Exports**:

- `initDarkMode()` - Theme toggle system
- `initQuantization()` - Setup quantization
- `getSafeQuantization()` - Get validated settings
- `getQuantizationLevel()` - Get current level

**Responsibilities**:

- Dark mode toggle with system preference detection
- Quantization setup and safety checks
- Theme persistence (localStorage)
- Icon animation on toggle

**Auto-initialization**: Runs `initQuantization()` on DOM ready

---

### `js/ui/hotkeys.js`

**Imports**:

- `debug.js` - Debug logging
- `constants.js` - Visual timing, input limits
- `sessionEngine.js` - Session state
- `simpleMetronome.js` - Simple metronome control
- `sliders.js` - showNotice

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
- `H` → Toggle help dialog
- `↑` / `↓` → Adjust BPM ±5 (blocked during playback)
- `←` / `→` → Switch Min/Max target (Groove mode only)

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

- Numeric-only keyboard input
- Paste sanitization
- Real-time validation on blur
- Cross-check BPM min/max with 5 BPM margin

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
  ├─→ theme.js ────→ debug, constants, utils
  ├─→ hotkeys.js ──→ debug, constants, sessionEngine, simpleMetronome, sliders
  ├─→ sliders.js ──→ debug, constants, utils
  ├─→ controls.js ─→ debug, audioProfiles, simpleMetronome
  └─→ panels.js ───→ debug, sessionEngine, simpleMetronome, utils
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

| Event                    | Module             | Payload                               | Purpose                                |
| ------------------------ | ------------------ | ------------------------------------- | -------------------------------------- |
| `panningModeChanged`     | controls.js        | `{intelligent: boolean}`              | Notify visuals.js of mode change       |
| `metronome:ownerChanged` | sessionEngine.js   | `{owner: string\|null}`               | Notify all modules of ownership change |
| `simpleMetronome:state`  | simpleMetronome.js | `{running: boolean, paused: boolean}` | Notify UI of state change              |
| `toggleTooltip`          | uiController.js    | none                                  | Toggle help dialog                     |

### Custom Events Listened

| Event                    | Module                 | Handler                   |
| ------------------------ | ---------------------- | ------------------------- |
| `DOMContentLoaded`       | theme.js               | initQuantization()        |
| `metronome:ownerChanged` | controls.js, panels.js | Enable/disable controls   |
| `simpleMetronome:state`  | uiController.js        | Update simple panel UI    |
| `toggleTooltip`          | uiController.js        | Toggle tooltip visibility |

---

## Global State Management

### Global Objects

- `window.QUANTIZATION` - Created by `theme.js`, used by `utils.js`
- `window.__adjustingTarget` - Created by `hotkeys.js`, tracks "min" or "max"

### Global Functions (on window)

- `window.toggleGrooveSliderDisabled(disabled)` - From `sliders.js`
- `window.toggleSimpleSliderDisabled(disabled)` - From `sliders.js`

### localStorage Keys

| Key                      | Module          | Type              | Purpose                    |
| ------------------------ | --------------- | ----------------- | -------------------------- |
| `darkMode`               | theme.js        | `"true"\|"false"` | Theme preference           |
| `intelligentPanningMode` | controls.js     | `"true"\|"false"` | Reduce Motion preference   |
| `activeSoundProfile`     | controls.js     | string            | Active sound profile       |
| `lastSeenVersion`        | uiController.js | string            | Version tracking           |
| `lastSeenHash`           | uiController.js | string            | Hash tracking              |
| `cachedMsgCount`         | uiController.js | number            | Footer message suppression |
| `updateMsgCount`         | uiController.js | number            | Footer message suppression |
| `wakeLockEnabled`        | wakeLock.js     | `"true"\|"false"` | Wake lock preference       |

---

## Testing Checklist

### Manual Tests

- [ ] Dark mode toggle persists across page reloads
- [ ] Hotkeys work in both Groove and Simple modes
- [ ] BPM sliders sync with numeric inputs
- [ ] Sound profile changes apply to both modes
- [ ] Panning mode toggle disables during playback
- [ ] Time signature changes work for both modes
- [ ] Tap tempo calculates BPM correctly (4-6 taps)
- [ ] Mode tabs disable during playback
- [ ] Ownership prevents conflicting mode starts
- [ ] Footer messages display and auto-hide
- [ ] Update check button works (online/offline)

### Edge Cases

- [ ] Rapid hotkey presses (debounce working?)
- [ ] Invalid numeric input (clamping working?)
- [ ] BPM min >= max (margin enforcement working?)
- [ ] Switching modes during countdown (prevented?)
- [ ] Refreshing page mid-session (state lost correctly?)
- [ ] Corrupted localStorage values (auto-corrected?)

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
