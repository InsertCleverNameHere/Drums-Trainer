# Debugging Guide

## 🐛 Debug System Overview

The app includes a runtime debug system that allows selective logging without modifying code or rebuilding.

---

## 🎛️ Debug Flags

Enable logging categories via browser console:

```javascript
// Enable individual categories
DEBUG.audio = true; // Audio scheduling, tick generation
DEBUG.visuals = true; // Visual rendering, panning decisions
DEBUG.ownership = true; // Mode ownership changes
DEBUG.hotkeys = true; // Keyboard input handling
DEBUG.timing = true; // Performance measurements (>16ms warnings)
DEBUG.state = true; // UI state transitions

// Enable all categories at once
DEBUG.all = true;

// Disable all
DEBUG.all = false;
DEBUG.audio = false; // etc.
```

### Category Details

| Category    | What It Logs                                            |
| ----------- | ------------------------------------------------------- |
| `audio`     | Scheduler ticks, BPM changes, count-in audio            |
| `visuals`   | Phrase boundaries, pattern comparisons, GSAP animations |
| `ownership` | Mode ownership claims/releases (groove/simple/null)     |
| `hotkeys`   | Keyboard events, target modes, blocked actions          |
| `timing`    | Performance measurements (warns if >16.67ms)            |
| `state`     | Button states, input validation, session lifecycle      |

---

## 📊 Common Debug Workflows

### 1. Audio Timing Issues

**Symptoms**: Clicks, drift, inconsistent tempo

**Debug**:

```javascript
DEBUG.audio = true;
DEBUG.timing = true;

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
DEBUG.visuals = true;

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
DEBUG.ownership = true;
DEBUG.state = true;

// Try switching modes or starting metronomes:
// - "Owner changed: null → groove" (expected)
// - "Cannot start simple metronome: owner is groove" (expected conflict)
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
DEBUG.hotkeys = true;

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
DEBUG.timing = true;

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

**Expected Memory Growth**:

- 60-120 BPM: <2 MB per 5 minutes ✅
- 180-240 BPM: 3-4 MB per 5 minutes ✅
- 300 BPM with 16ths: ~6 MB per 3 minutes (edge case) ⚠️

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
DEBUG.audio = true;
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

### Ownership Test

```javascript
// Simulate ownership conflict
window.sessionEngine.setActiveModeOwner("groove");
window.simpleMetronome.start(); // Should fail with ownership error
window.sessionEngine.setActiveModeOwner(null); // Release
window.simpleMetronome.start(); // Should succeed
```

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
