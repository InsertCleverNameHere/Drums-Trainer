# Visual System Architecture

## Overview

The metronome uses a phrase-based rendering system that displays up to 4 dots at a time, creating a consistent, readable viewport across all time signatures and tempos. It supports two distinct visual modes: **Standard Mode** (single-row Big Dots) and **Pattern Dashboard Mode** (4-row multi-track acoustic view).

## Key Concepts

### Phrases

- **Definition**: Groups of up to 4 ticks that represent a logical musical unit
- **Consistency**: In Dashboard mode, all 4 rows (tracks) are synchronized to the same phrase window.
- **Example**: 4/4 with 16ths = 4 phrases of 4 ticks each
- **Example**: 7/8 = 2 phrases (4 ticks + 3 ticks)

### Pattern Dashboard

- **Purpose**: Direct-visual feedback for programmed drum grooves.
- **Tracks**: Fixed rows for Hi-Hat (HH), Kick (KI), Snare (SN), and Pedal (PD).
- **Playhead**: A vertical column-based highlight that sweeps through all tracks simultaneously.

### Intelligent Panning Mode (Default)

- **Goal**: Minimize visual disruption by only updating when necessary
- **Logic**:
- Standard metronome:
  - If phrase patterns match completely → No update
  - If hierarchy matches but labels differ → Fade labels only
  - If structure differs → Full pan animation
- Pattern Mode: Automatically forces a Full Pan at every phrase boundary. This ensures that even if phonation labels are identical, the unique drum hits of the pattern are rendered correctly.
- Sovereignty: Rendering is branched via patternScheduler.isActive() && advancedMode.isDashboardEnabled()

### Forced Panning Mode

- **Goal**: Always animate for consistent visual rhythm
- **Logic**: Full pan animation at every phrase boundary

### Pattern Comparison

Compares two phrases on three levels:

1. **Count Match**: Same number of dots?
2. **Hierarchy Match**: Same size pattern (primary/secondary/tertiary)?
3. **Label Match**: Same phonation labels?

## 🥁 Pattern Dashboard Architecture

### Multi-Track Rendering

When a pattern is active, `visuals.js` transforms the `#beat-indicator-container` into a vertical stack of rows.

- **Fixed Sidebar**: Instrument labels (HH, KI, etc.) are absolute-positioned in a 70px left gutter.
- **Centered Grid**: Instrument dots use `justify-content: center` to align with the same center-point as the standard metronome dots.
- **Acoustic Colors**: Active hits use specific color-coding (Cyan, Red, Green, Yellow) for high-speed readability.

### Vertical Playhead

The dashboard uses an `:nth-child` selection strategy to drive the playhead.

- **Logic**: `tickInPhrase + 2` (Accounting for the sidebar label as the first child).
- **Sync**: Applies the `.playing` class to every track at once, creating a unified vertical bar.

## Performance Characteristics

### Memory Usage

- **Initial Baseline (with samples)**: ~14.7 MB 🟢
- **Standard Mode (Running)**: ~15.5 MB 🟢
- **Pattern Dashboard (Running)**: ~16.7 MB 🟢
- **DOM Stability**: Fixed at ~45 nodes during pattern playback (zero leak) ✅
- **Working Set Churn**: < 0.5 MB variation per cycle (GC-stable) ✅

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
