# Debugging Guide

## 🐛 Debug System Overview

The app includes a runtime debug system that allows selective logging without modifying code or rebuilding.

---

## 🎛️ Debug Flags

Enable logging categories via browser console:

```javascript
// Enable individual categories
RGT.DEBUG.audio = true; // Audio scheduling, tick generation
RGT.DEBUG.visuals = true; // Visual rendering, panning decisions
RGT.DEBUG.ownership = true; // Mode ownership changes
RGT.DEBUG.hotkeys = true; // Keyboard input handling
RGT.DEBUG.timing = true; // Performance measurements (>16ms warnings)
RGT.DEBUG.state = true; // UI state transitions

// Enable all categories at once
RGT.DEBUG.all = true;

// Disable all
RGT.DEBUG.all = false;
RGT.DEBUG.audio = false; // etc.
```

### Category Details

| Category       | What It Logs                                                     |
| -------------- | ---------------------------------------------------------------- |
| `audio`        | Scheduler ticks, BPM changes, count-in audio                     |
| `visuals`      | Phrase boundaries, pattern comparisons, GSAP animations          |
| `ownership`    | Mode ownership claims/releases (groove/simple/null)              |
| `hotkeys`      | Keyboard events, target modes, blocked actions                   |
| `timing`       | Performance measurements (warns if >16.67ms)                     |
| `state`        | Button states, input validation, session lifecycle               |
| `advancedMode` | Mode toggles, step changes, chip rendering, dashboard preference |

---

## 📊 Common Debug Workflows

### 1. Audio Timing Issues

**Symptoms**: Clicks, drift, inconsistent tempo

**Debug**:

```javascript
RGT.DEBUG.audio = true;
RGT.DEBUG.timing = true;

// Start metronome, look for:
// - "Scheduling tick" messages every ~5-25ms
// - No timing warnings (>16ms)
// - Consistent nextNoteTime increments
```

**What to Check**:

- Are scheduler intervals consistent?
- Are any operations blocking the main thread?
- Is the browser throttling background tabs?

---

### 2. Visual Rendering Issues

**Symptoms**: Dots not updating, flash timing off, panning glitches

**Debug**:

```javascript
RGT.DEBUG.visuals = true;

// Start metronome, look for:
// - "PHRASE BOUNDARY DETECTED" messages
// - Pattern comparison results (countMatch, hierarchyMatch, labelMatch)
// - Decision logic (NO UPDATE, LABEL UPDATE ONLY, FULL PAN)
```

**What to Check**:

- Is intelligent panning mode enabled?
- Are phrase patterns being compared correctly?
- Are GSAP tweens being killed before DOM removal?

---

### 3. Mode Switching Conflicts

**Symptoms**: Can't start metronome, buttons disabled, ownership errors

**Debug**:

```javascript
RGT.DEBUG.ownership = true;
RGT.DEBUG.state = true;

// Try switching modes or starting metronomes:
// - "Owner changed: null → groove" (expected)
// - "Owner changed: null → editing" (entering pattern editor)
// - "Cannot start simple metronome: owner is editing" (expected conflict)
// - Check for unexpected ownership changes
```

**What to Check**:

- Is ownership being released properly on stop?
- Are guards preventing conflicting starts?
- Are tab disable states correct?

---

### 4. Hotkey Not Working

**Symptoms**: Keyboard shortcuts don't respond

**Debug**:

```javascript
RGT.DEBUG.hotkeys = true;

// Press hotkeys and check console:
// - "Key pressed: Space, owner: groove, target: groove"
// - "⚠️ BPM adjustment blocked - groove is active" (expected during playback)
// - "🎚️ Adjusting target: MAX BPM" (Left/Right arrows)
```

**What to Check**:

- Is focus inside an input field? (Hotkeys are disabled in inputs)
- Is ownership blocking the action?
- Is the hotkey lock preventing rapid presses?

---

### 5. Memory Leaks

**Symptoms**: Memory usage grows over time

**Debug**:

```javascript
RGT.DEBUG.timing = true;

// Chrome DevTools:
// 1. Memory → Heap Snapshot (baseline)
// 2. Run metronome for 5 minutes
// 3. Memory → Heap Snapshot (after)
// 4. Compare → Look for growing arrays/objects
```

**What to Check**:

- Are GSAP tweens being killed? (`gsap.killTweensOf()`)
- Are event listeners being removed?
- Are timers being cleared? (`clearTimeout`, `clearInterval`)

**Expected Memory Baseline**:

- **Footprint**: 15–18 MB (Baseline includes pre-cached WAV buffers).
- **Dashboard Mode**: Expect ~2 MB increase over standard mode.
- **Growth**: Negligible (< 1 MB per 10 minutes of practice).

**Leak Detection**:
If the node count reported by the "Churn Monitor" macro exceeds 50 during a 4/4 session, or if heap usage climbs consistently above 25 MB, verify that `gsap.killTweensOf` is reaching every container in `renderNewPhrase`.

### 6. Wake Lock Issues

**Issue**: Wake lock setting missing on mobile
**Cause**: API requires HTTPS or localhost (Secure Context).
**Solution**: Use Port Forwarding (`chrome://inspect`) or deploy to HTTPS.

**Issue**: "Released by system" log appearing twice
**Cause**: Event listener wasn't removed before manual release.
**Solution**: Fixed in `wakeLock.js` via `handleSystemRelease`.

---

### 7. Sampler & Pattern Sync Issues

**Symptoms**: No drum sounds, playhead missing, beeps still audible with patterns.

**Debug**:

1. Check if samples are loaded:
   `import('./js/sampleLoader.js').then(m => console.log(m.getSampleBuffer('kick')))`
2. Verify Handshake:
   `window.sessionEngine.getActiveModeOwner()` should return `"editing"` while editor is open.
3. Check Suppression:
   Start pattern. Visual callback must return `true` to silence default beep.

---

## 🧪 Console Macros

Useful shortcuts for testing tight timing scenarios:

### Quick Audio Test

```javascript
// Start groove metronome at specific BPM
window.metronome.startMetronome(120);

// Check current BPM
window.metronome.getBpm();

// Stop
window.metronome.stopMetronome();
```

### Visual Flash Timing Test

```javascript
// Measure beat dot flash duration
const measure = () => {
  const start = performance.now();
  const dot = document.querySelector(".beat-dot.flashing");
  const check = setInterval(() => {
    if (!document.querySelector(".beat-dot.flashing")) {
      console.log("Flash duration:", performance.now() - start, "ms");
      clearInterval(check);
    }
  }, 10);
};
// Start metronome, then run: measure();
```

### Scheduler Interval Test

```javascript
// Measure actual scheduler interval
let lastTick = performance.now();
const originalLog = console.log;
console.log = (...args) => {
  if (args[0]?.includes("Scheduling tick")) {
    const now = performance.now();
    console.log("Interval:", (now - lastTick).toFixed(2), "ms");
    lastTick = now;
  }
  originalLog(...args);
};
RGT.DEBUG.audio = true;
// Start metronome, watch intervals
```

### Count-in Timing Test

```javascript
// Measure count-in intervals
const times = [];
const originalCreate = window.AudioContext.prototype.createOscillator;
window.AudioContext.prototype.createOscillator = function () {
  const osc = originalCreate.call(this);
  const originalStart = osc.start.bind(osc);
  osc.start = (when) => {
    times.push(when);
    if (times.length === 3) {
      console.log("Count-in intervals:", [
        ((times[1] - times[0]) * 1000).toFixed(1) + "ms",
        ((times[2] - times[1]) * 1000).toFixed(1) + "ms",
      ]);
      times.length = 0;
    }
    return originalStart(when);
  };
  return osc;
};
// Start metronome with count-in enabled
```

### Pattern and Sample Tests

```javascript
// 1. Check if a pattern is active in the scheduler
import("./js/patternScheduler.js").then((m) =>
  console.log("Active:", m.patternScheduler.isActive())
);

// 2. Verify drum sample presence
import("./js/sampleLoader.js").then((m) => {
  const buf = m.getSampleBuffer("kick");
  console.log(buf ? "✅ Kick loaded" : "❌ Kick missing");
});

// 3. Test multi-measure end-of-cycle
// Start a 2-bar pattern, then run:
window.metronome.requestEndOfCycle(
  () => console.log("End of pattern reached"),
  2
);
```

### Ownership Test

```javascript
// Simulate ownership conflict
window.sessionEngine.setActiveModeOwner("groove");
window.simpleMetronome.start(); // Should fail with ownership error
window.sessionEngine.setActiveModeOwner(null); // Release
window.simpleMetronome.start(); // Should succeed
```

---

## 🔬 Performance Profiler

The app includes a lightweight performance profiler for detecting bottlenecks and memory leaks.

### Basic Usage

```javascript
// Start profiling with live overlay
Profiler.start({ overlay: true });

// Run metronome for 30-60 seconds...

// Stop and view report
Profiler.stop();
console.log(Profiler.report("markdown"));
```

### API Reference

| Method                      | Description                                                       |
| --------------------------- | ----------------------------------------------------------------- |
| `start(config)`             | Begin monitoring. Pass `{ overlay: true }` for real-time display. |
| `stop()`                    | Stop monitoring and finalize metrics.                             |
| `report(format)`            | Generate report (`'json'` or `'markdown'`).                       |
| `toggleOverlay()`           | Show/hide real-time performance overlay.                          |
| `mark(label)`               | Create custom timing mark.                                        |
| `measure(name, start, end)` | Measure interval between marks.                                   |

### Metrics Tracked

- **FPS** - Frame rate (target: 60fps)
  - Green: 58-60fps ✅
  - Yellow: 50-57fps ⚠️
  - Red: <50fps ❌

- **Memory** - Heap size (Chrome only)
  - Tracks `usedJSHeapSize` and `totalJSHeapSize`
  - Reports average and peak usage

- **Long Tasks** - Operations >50ms
  - Captures name, duration, and timestamp
  - Identifies blocking operations

### Example Output

```markdown
# Performance Report

**Duration**: 45230.45ms

## FPS

- **Average**: 59.8
- **Min**: 58
- **Max**: 60
- **Samples**: 45

## Memory

- **Avg Heap Used**: 12.34 MB
- **Peak Heap Used**: 15.67 MB

## Long Tasks (>50ms)

- **Count**: 2
- **Total Time**: 105.67ms
- **Worst**: scheduleNote (52.34ms)
```

### Performance Targets

| Metric        | Target     | Warning | Critical |
| ------------- | ---------- | ------- | -------- |
| FPS           | 60         | <58     | <50      |
| Memory Growth | <2 MB/5min | 2-5 MB  | >5 MB    |
| Long Tasks    | 0          | 1-5     | >5       |

### Common Profiling Scenarios

#### Test 1: Normal BPM (60-120)

```javascript
Profiler.start({ overlay: true });
// Run metronome at 120 BPM for 5 minutes
// Expected: FPS=60, Memory<2MB growth, LongTasks=0
```

#### Test 2: High BPM (180-240)

```javascript
Profiler.start({ overlay: true });
// Run metronome at 240 BPM with 16th subdivisions
// Expected: FPS=58-60, Memory<4MB growth, LongTasks<3
```

#### Test 3: Extreme BPM (300+)

```javascript
Profiler.start({ overlay: true });
// Run metronome at 300 BPM with 16th subdivisions
// Expected: FPS=55-60, Memory<6MB growth, LongTasks<10
```

### Troubleshooting

**Issue**: Overlay not appearing
**Solution**: Ensure profiler was started with `{ overlay: true }`, or call `Profiler.toggleOverlay()` manually.

**Issue**: Memory metrics show "N/A"
**Solution**: Memory API only available in Chrome-based browsers. Use Chrome/Edge for memory profiling.

**Issue**: No long tasks detected despite stuttering
**Solution**: Long tasks are only detected via `PerformanceObserver`. Check browser compatibility (Chrome 58+, Edge 79+).

---

## 🔍 Performance Profiling

### Chrome DevTools Performance Tab

1. Open DevTools → Performance
2. Click Record
3. Start metronome and let run for 10-20 seconds
4. Stop recording
5. Look for:
   - **Main thread activity**: Should be mostly idle except for scheduler ticks
   - **Long tasks**: Any yellow/red blocks >50ms indicate blocking
   - **Frame rate**: Should maintain 60fps (except at extreme BPMs)

### Memory Profiling

1. Open DevTools → Memory
2. Take heap snapshot (baseline)
3. Run metronome for 5 minutes
4. Take second snapshot
5. Compare snapshots:
   - Look for "Detached DOM tree" (indicates memory leak)
   - Check GSAP tween count (should be <10)
   - Verify no growing arrays/objects

---

## ⚠️ Common Issues & Solutions

### Issue: "Metronome already playing" Error

**Cause**: Audio core thinks it's running when it's not

**Solution**:

```javascript
// Reset playback flag
window.metronome.resetPlaybackFlag();
// Or reload page
location.reload();
```

---

### Issue: Dots Don't Update After Changing Subdivisions

**Cause**: Browser cache not cleared

**Solution**:

- Hard reload: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
- Or clear cache in DevTools → Network → Disable cache

---

### Issue: Hotkeys Stop Working

**Cause**: Focus is inside an input field

**Solution**:

- Click outside any input field
- Or press `Escape` to blur inputs

---

### Issue: Animations Stutter at High BPM

**Cause**: Animation overlap at 300+ BPM

**Solution**: This is expected behavior. At extreme tempos, animations can't complete before the next beat.

---

### Issue: Service Worker Won't Update

**Cause**: Browser caching old service worker

**Solution**:

1. DevTools → Application → Service Workers
2. Check "Update on reload"
3. Click "Unregister"
4. Hard reload (`Ctrl+Shift+R`)

---

### Issue: Footer Shows Wrong Version

**Cause**: `commits.json` not updated or cached

**Solution**:

```javascript
// Force fetch latest version
fetch("./commits.json", { cache: "no-store" })
  .then((r) => r.json())
  .then((d) => console.log("Latest version:", d.version));
```

---

## 🧰 Debugging Tools

### Browser Extensions (Recommended)

- **React DevTools** - Inspect component state (if migrating to React)
- **Redux DevTools** - Time-travel debugging (if adding Redux)
- **Lighthouse** - PWA auditing

### VSCode Extensions (Recommended)

- **ESLint** - Catch errors before runtime
- **Debugger for Chrome** - Set breakpoints in VSCode
- **Live Server** - Auto-reload on file changes

---

## 📚 Related Documentation

- [Architecture Overview](./ARCHITECTURE.md)
- [API Reference](./API_REFERENCE.md)
- [Visuals System](./VISUALS_SYSTEM.md)
- [Versioning System](./VERSIONING.md)
