# Visual System Architecture

## Overview

The metronome uses a phrase-based rendering system that displays up to 4 dots at a time, creating a consistent, readable viewport across all time signatures and tempos.

## Key Concepts

### Phrases

- **Definition**: Groups of up to 4 ticks that represent a logical musical unit
- **Example**: 4/4 with 16ths = 4 phrases of 4 ticks each
- **Example**: 7/8 = 2 phrases (4 ticks + 3 ticks)

### Intelligent Panning Mode (Default)

- **Goal**: Minimize visual disruption by only updating when necessary
- **Logic**:
  - If phrase patterns match completely → No update
  - If hierarchy matches but labels differ → Fade labels only
  - If structure differs → Full pan animation

### Forced Panning Mode

- **Goal**: Always animate for consistent visual rhythm
- **Logic**: Full pan animation at every phrase boundary

### Pattern Comparison

Compares two phrases on three levels:

1. **Count Match**: Same number of dots?
2. **Hierarchy Match**: Same size pattern (primary/secondary/tertiary)?
3. **Label Match**: Same phonation labels?

## Performance Characteristics

### Memory Usage

- **60-120 BPM**: < 2 MB growth per 5 minutes ✅
- **180-240 BPM**: 3-4 MB growth per 5 minutes ✅
- **300 BPM with 16ths**: ~6 MB per 3 minutes (edge case) ⚠️

Memory stabilizes after stopping (GSAP cleanup working correctly).

### Animation Performance

- **60 fps** maintained across all BPMs on modern hardware
- **BPM-scaled duration**: Faster tempos = shorter animations
- **GSAP compositor thread**: Smooth animations without main thread blocking

## Known Limitations

1. **High Subdivision Readability**: At 240+ BPM with 16th notes, individual dots blur together (human perception limit)
2. **Browser Extensions**: Chrome extensions (autofill, etc.) may add ~2-4 MB to heap snapshots
3. **Single-Phrase Edge Case**: In forced mode with no subdivisions, panning occurs every measure (intended behavior)

## Debugging

### Enable Verbose Logging

```javascript
// In visuals.js, line ~5
const DEBUG_VISUALS = true; // Set to true
```

This will log:

- Phrase boundary detections
- Pattern comparison results
- Decision logic (no update / label update / full pan)

### Memory Profiling

1. Chrome DevTools → Memory → Heap Snapshot
2. Take baseline before starting
3. Run metronome for 5 minutes
4. Take second snapshot
5. Compare: Look for < 5 MB growth at normal BPMs

### Common Issues

**Issue**: Dots don't update after changing subdivisions
**Fix**: Clear browser cache (Ctrl+Shift+R)

**Issue**: Memory grows linearly
**Fix**: Check for browser extensions interfering (test in incognito mode)

**Issue**: Animations stutter at high BPM
**Fix**: Normal behavior at 300+ BPM due to animation overlap
