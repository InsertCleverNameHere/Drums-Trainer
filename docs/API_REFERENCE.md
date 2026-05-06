# API Reference

## 🎯 Public APIs

This document covers all functions intended for external use (console debugging, module imports, etc.).

---

## 🎵 metronomeCore.js

### `startMetronome(bpm)`

Starts the groove metronome audio scheduler.

**Parameters**:

- `bpm` (Number): Tempo in beats per minute (30-300)

**Returns**: `void`

**Example**:

```javascript
window.metronome.startMetronome(120);
```

**Behavior**:

- Clamps BPM to hard limits (30-300)
- Resets tick index to 0
- Initializes AudioContext if needed
- Starts 5ms scheduler loop

---

### `stopMetronome()`

Stops the metronome and clears all timers.

**Parameters**: None

**Returns**: `void`

**Example**:

```javascript
window.metronome.stopMetronome();
```

---

### `pauseMetronome()`

Pauses audio scheduling without resetting state.

**Parameters**: None

**Returns**: `void`

**Example**:

```javascript
window.metronome.pauseMetronome();
```

---

### `resumeMetronome()`

Resumes audio scheduling from paused state.

**Parameters**: None

**Returns**: `void`

**Example**:

```javascript
window.metronome.resumeMetronome();
```

---

### `setTimeSignature(beats, value)`

Updates time signature (e.g., 4/4, 7/8).

**Parameters**:

- `beats` (Number): Numerator (1-16)
- `value` (Number): Denominator (2, 4, 8, or 16)

**Returns**: `void`

**Example**:

```javascript
window.metronome.setTimeSignature(7, 8); // 7/8 time
```

**Guards**: Blocked during active playback (must pause first)

---

### `setTicksPerBeat(n)`

Sets subdivision level (1=none, 2=8ths, 4=16ths).

**Parameters**:

- `n` (Number): Ticks per beat (1, 2, or 4)

**Returns**: `void`

**Example**:

```javascript
window.metronome.setTicksPerBeat(4); // 16th note subdivisions
```

**Guards**: Blocked during active playback (must pause first)

---

### `getBpm()`

Returns current tempo.

**Parameters**: None

**Returns**: `Number` - Current BPM

**Example**:

```javascript
const tempo = window.metronome.getBpm(); // 120
```

---

### `getTimeSignature()`

Returns current time signature object.

**Parameters**: None

**Returns**: `Object` - `{ beats: Number, value: Number }`

**Example**:

```javascript
const sig = window.metronome.getTimeSignature();
// { beats: 4, value: 4 }
```

---

### `getTicksPerBeat()`

Returns current subdivision level.

**Parameters**: None

**Returns**: `Number` - Ticks per beat (1, 2, or 4)

**Example**:

```javascript
const ticks = window.metronome.getTicksPerBeat(); // 4 (16ths)
```

---

### `performCountIn(bpm, tempoSynced)`

Plays 3-2-1 count-in beeps.

**Parameters**:

- `bpm` (Number): Tempo for count-in
- `tempoSynced` (Boolean): Use tempo-based intervals (true) or fixed 1s intervals (false)

**Returns**: `Promise<void>` - Resolves when count-in completes

**Example**:

```javascript
await window.metronome.performCountIn(120, true);
console.log("Count-in finished");
```

---

### `registerVisualCallback(callback)`

Registers a function to be called on every tick.

**Parameters**:

- `callback` (Function): `(tickIndex, isPrimaryAccent, isMainBeat) => void`

**Returns**: `void`

**Example**:

```javascript
window.metronome.registerVisualCallback((tick, accent, beat) => {
  console.log(`Tick ${tick}, Accent: ${accent}, Beat: ${beat}`);
});
```

---

### `requestEndOfCycle(callback, measures = 1)`

Requests graceful stop at the next pattern boundary.

**Parameters**:

- `callback` (Function): Called after the boundary is reached
- `measures` (Number): Optional. Number of bars to complete before stopping (default: 1)

**Returns**: `void`

**Example**:

```javascript
window.metronome.requestEndOfCycle(() => {
  console.log("Bar finished cleanly");
});
```

---

## 🎚️ simpleMetronome.js

### `start()`

Starts the simple metronome.

**Parameters**: None

**Returns**: `Promise<Boolean>` - Success/failure

**Example**:

```javascript
await window.simpleMetronome.start();
```

---

### `stop()`

Stops the simple metronome.

**Parameters**: None

**Returns**: `void`

**Example**:

```javascript
window.simpleMetronome.stop();
```

---

### `pause()` / `resume()`

Pause/resume simple metronome.

**Parameters**: None

**Returns**: `void`

**Example**:

```javascript
window.simpleMetronome.pause();
window.simpleMetronome.resume();
```

---

### `setBpm(bpm)`

Updates tempo (30-300).

**Parameters**:

- `bpm` (Number): New tempo

**Returns**: `Number` - Clamped BPM value

**Example**:

```javascript
window.simpleMetronome.setBpm(140);
```

---

### `getBpm()`

Returns current tempo.

**Parameters**: None

**Returns**: `Number` - Current BPM

**Example**:

```javascript
const tempo = window.simpleMetronome.getBpm();
```

---

### `isRunning()`

Checks if metronome is active.

**Parameters**: None

**Returns**: `Boolean`

**Example**:

```javascript
if (window.simpleMetronome.isRunning()) {
  console.log("Metronome is running");
}
```

---

### `isPaused()`

Checks if metronome is paused.

**Parameters**: None

**Returns**: `Boolean`

**Example**:

```javascript
if (window.simpleMetronome.isPaused()) {
  console.log("Metronome is paused");
}
```

---

## 🎛️ sessionEngine.js

### `startSession()`

Starts a groove training session.

**Parameters**: None

**Returns**: `void`

**Example**:

```javascript
window.sessionEngine.startSession();
```

**Behavior**:

- Claims ownership ("groove")
- Reads UI settings (BPM range, grooves, session mode)
- Randomizes groove & BPM
- Plays count-in (if enabled)
- Starts metronome

---

### `pauseSession()`

Pauses current session.

**Parameters**: None

**Returns**: `void`

**Example**:

```javascript
window.sessionEngine.pauseSession();
```

---

### `nextCycle()`

Skips to next groove immediately.

**Parameters**: None

**Returns**: `void`

**Example**:

```javascript
window.sessionEngine.nextCycle();
```

---

### `stopSession(message)`

Stops session gracefully.

**Parameters**:

- `message` (String, optional): Reason for stopping

**Returns**: `void`

**Example**:

```javascript
window.sessionEngine.stopSession("User stopped");
```

---

### `isSessionActive()`

Checks if a session is running.

**Parameters**: None

**Returns**: `Boolean`

**Example**:

```javascript
if (window.sessionEngine.isSessionActive()) {
  console.log("Session in progress");
}
```

---

### `getActiveModeOwner()`

Returns current mode owner.

**Parameters**: None

**Returns**: `String | null` - `"groove"`, `"simple"`, or `null`

**Example**:

```javascript
const owner = window.sessionEngine.getActiveModeOwner();
// "groove", "simple", or null
```

---

### `setActiveModeOwner(owner)`

Claims/releases mode ownership.

**Parameters**:

- `owner` (String | null): `"groove"`, `"simple"`, or `null`

**Returns**: `void`

**Example**:

```javascript
window.sessionEngine.setActiveModeOwner("groove");
// Later...
window.sessionEngine.setActiveModeOwner(null); // Release
```

---

### `isSessionCountingIn()`

Checks if the session is currently in the 3-2-1 countdown phase.

**Parameters**: None

**Returns**: `Boolean`

---

## 🎨 visuals.js

### `createVisualCallback(panelId)`

Creates a visual callback for a metronome panel.

**Parameters**:

- `panelId` (String): `"groove"` or `"simple"`

**Returns**: `Function` - Callback for tick events

**Example**:

```javascript
import { createVisualCallback } from "./visuals.js";

const callback = createVisualCallback("groove");
window.metronome.registerVisualCallback(callback);
```

**Note**: Called automatically by `main.js` during initialization.

---

### `primeVisuals(panelId)`

Pre-renders initial visual state to prevent layout shift.

**Parameters**:

- `panelId` (String): `"groove"` or `"simple"`

**Returns**: `void`

**Example**:

```javascript
import { primeVisuals } from "./visuals.js";
primeVisuals("groove");
```

**Note**: Called automatically by `main.js` during initialization.

---

## 🔊 audioProfiles.js

### `setActiveProfile(name)`

Switches sound profile.

**Parameters**:

- `name` (String): `"digital"`, `"soft"`, `"ping"`, `"bubble"`, or `"clave"`

**Returns**: `void`

**Example**:

```javascript
// Not exposed globally, but used internally by UI dropdowns
import { setActiveProfile } from "./audioProfiles.js";
setActiveProfile("soft");
```

---

### `getActiveProfile()`

Returns current sound profile name.

**Parameters**: None

**Returns**: `String` - Profile name

**Example**:

```javascript
import { getActiveProfile } from "./audioProfiles.js";
const profile = getActiveProfile(); // "digital"
```

---

### `getAvailableProfiles()`

Lists all sound profiles.

**Parameters**: None

**Returns**: `Array<String>` - Profile names

**Example**:

```javascript
import { getAvailableProfiles } from "./audioProfiles.js";
const profiles = getAvailableProfiles();
// ["digital", "soft", "ping", "bubble", "clave"]
```

---

### `isMuted()`

Returns the current global audio privacy state.

**Parameters**: None

**Returns**: `Boolean`

---

### `setMuted(val)`

Toggles global audio suppression. Syncs state to `localStorage`.

**Parameters**:

- `val` (Boolean): True to silence all audio (metronome and patterns)

---

## 🛠️ utils.js

### `sanitizeBpmRange(bpmMin, bpmMax, quantizationStep)`

Clamps and quantizes BPM range.

**Parameters**:

- `bpmMin` (Number): Minimum BPM
- `bpmMax` (Number): Maximum BPM
- `quantizationStep` (Number): Quantization step (default: 5)

**Returns**: `Object` - `{ bpmMin: Number, bpmMax: Number, step: Number }`

**Example**:

```javascript
import { sanitizeBpmRange } from "./utils.js";
const result = sanitizeBpmRange(32, 248, 5);
// { bpmMin: 35, bpmMax: 245, step: 5 }
```

---

### `randomizeGroove(groovesText, bpmMin, bpmMax)`

Picks random groove and BPM from range.

**Parameters**:

- `groovesText` (String): Newline-separated groove names
- `bpmMin` (Number): Minimum BPM
- `bpmMax` (Number): Maximum BPM

**Returns**: `Object` - `{ bpm: Number, groove: String }`

**Example**:

```javascript
import { randomizeGroove } from "./utils.js";
const result = randomizeGroove("Rock\nFunk\nJazz", 60, 120);
// { bpm: 85, groove: "Funk" }
```

---

### `calculateTapTempo()`

Calculates BPM from tap timing (internal state).

**Parameters**: None

**Returns**: `Number | null` - BPM or null if <2 taps

**Example**:

```javascript
import { calculateTapTempo } from "./utils.js";
const bpm = calculateTapTempo(); // 120
```

**Note**: Maintains internal tap history. Resets after 1.5s idle.

---

### `formatTime(seconds)`

Formats seconds as human-readable string.

**Parameters**:

- `seconds` (Number): Duration in seconds

**Returns**: `String` - Formatted time (e.g., "1h 23m 45s")

**Example**:

```javascript
import { formatTime } from "./utils.js";
formatTime(300); // "5m 0s"
formatTime(3665); // "1h 1m 5s"
```

---

## 🔒 wakeLock.js

### `initWakeLock()`

Initializes wake lock system and restores state.

**Parameters**: None
**Returns**: `void`

### `enableWakeLock()`

Acquires screen wake lock. Retries on failure.

**Parameters**: None
**Returns**: `Promise<boolean>`

### `disableWakeLock()`

Releases active wake lock.

**Parameters**: None
**Returns**: `void`

### `isWakeLockSupported()`

Checks browser support.

**Parameters**: None
**Returns**: `boolean`

### `isWakeLockActive()`

Returns current state.

**Parameters**: None
**Returns**: `boolean`

---

## 🐛 debug.js

### `DEBUG` (Object)

Global debug flag object.

**Properties**:

- `audio` (Boolean): Audio scheduling logs
- `visuals` (Boolean): Visual rendering logs
- `ownership` (Boolean): Mode ownership logs
- `hotkeys` (Boolean): Keyboard input logs
- `timing` (Boolean): Performance timing logs
- `state` (Boolean): UI state transition logs
- `all` (Boolean): Master enable/disable

**Example**:

```javascript
DEBUG.audio = true; // Enable audio logs
DEBUG.all = true; // Enable everything
DEBUG.all = false; // Disable everything
```

---

### `debugLog(category, ...args)`

Conditional console.log based on debug flags.

**Parameters**:

- `category` (String): Debug category
- `...args` (Any): Arguments to log

**Returns**: `void`

**Example**:

```javascript
import { debugLog } from "./debug.js";
debugLog("audio", "Scheduling tick at", time);
// Only logs if DEBUG.audio === true
```

---

### `DebugTimer` (Class)

Performance timing helper.

**Constructor**:

- `label` (String): Timer label
- `category` (String): Debug category (default: "timing")

**Methods**:

- `end(threshold)`: Stop timer, warn if exceeded threshold

**Example**:

```javascript
import { DebugTimer } from "./debug.js";

const timer = new DebugTimer("Heavy operation", "timing");
// ... do work ...
timer.end(16.67); // Warns if >16.67ms (1 frame @ 60fps)
```

---

## 📦 constants.js

All exports are read-only constants. See [`constants.js`](../js/constants.js) for full list.

**Key exports**:

- `BPM_HARD_LIMITS` - `{ MIN: 30, MAX: 300 }`
- `BPM_DEFAULTS` - Default BPM values
- `INPUT_LIMITS` - Validation rules for all inputs
- `SCHEDULER_CONFIG` - Audio timing parameters
- `VISUAL_TIMING` - Animation durations
- `COUNT_IN_CONFIG` - Count-in audio properties

---

## 💾 grooveStorage.js

### `getGroovePattern(name)`

Returns the saved pattern object for a specific groove name.

### `setGroovePattern(name, data)`

Saves a pattern. Enforces a 100-pattern capacity.

**Returns**: `{ success: boolean, error: "FULL" | "QUOTA_EXCEEDED" | null }`

### `deleteGroovePattern(name)`

Removes a pattern from storage.

---

## 🥁 patternScheduler.js

### `onTick(tickIndex, time)`

Determines if drum hits occur on the current tick and triggers audio.

**Returns**: `Boolean` - True if a pattern is active (used to suppress the digital metronome beep).

---

## 📦 sampleLoader.js

### `loadDrumSamples()`

Fetches and decodes the acoustic WAV kit into memory. Returns a `Promise`.

### `getSampleBuffer(key)`

Returns the decoded `AudioBuffer` for an instrument (kick, snare, hihat, HHPed, xstick).

---

## 📚 Related Documentation

- [Architecture Overview](./ARCHITECTURE.md)
- [Debugging Guide](./DEBUGGING.md)
- [Visuals System](./VISUALS_SYSTEM.md)Here is the `docs/API_REFERENCE.md` file.
