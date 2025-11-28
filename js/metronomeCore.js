// metronomeCore.js
// Audio scheduling and metronome core logic (refactored from metronome.js)
import { debugLog, DebugTimer } from "./debug.js";
import {
  ensureAudio,
  setNextNoteTime,
  playTick as playProfileTick,
} from "./audioProfiles.js";

let audioCtx = null;
let nextNoteTime = 0.0;
let tickIndex = 0; // continuous tick counter (0-based)
let isMetronomePlaying = false;
let schedulerTimer = null;
let endOfCycleRequested = false;
let onCycleComplete = null;

let bpm = 120;
// NEW: timeSignature object replaces beatsPerBar
let timeSignature = { beats: 4, value: 4 };
let ticksPerBeat = 1; // subdivisions per beat (1 = one tick per beat)

// How far ahead to schedule (in seconds)
const scheduleAheadTime = 0.1;

// short adjustment pause (ms) to wait after a cycle ends before notifying UI
const adjustmentPauseMs = 1700;

// visual callback that can be registered by visuals.js
let onBeatVisual = () => {};

// === Pause/Resume state tracking ===
let isPaused = false;
let pauseWallTime = 0; // audioCtx.currentTime snapshot when paused
let pauseAudioOffset = 0; // nextNoteTime offset preserved across pause

// Registers a visual callback to be triggered on each beat
export function registerVisualCallback(cb) {
  if (typeof cb === "function") onBeatVisual = cb;
}

// Delegates tick playback to the shared audioProfiles module
function playTick(isAccent) {
  setNextNoteTime(nextNoteTime);
  playProfileTick(isAccent);
}

// Schedule a single beat ahead of time
function scheduleNote() {
  const timer = new DebugTimer("scheduleNote", "audio");
  const totalTicksInMeasure = timeSignature.beats * ticksPerBeat;
  const tickInMeasure = tickIndex % totalTicksInMeasure;

  // Determine if this tick is a main beat (1, 2, 3...)
  const isMainBeat = tickInMeasure % ticksPerBeat === 0;

  // The primary accent is ALWAYS the very first tick of the measure.
  const isPrimaryAccent = tickInMeasure === 0;

  debugLog(
    "audio",
    `Scheduling tick ${tickIndex} (measure tick ${tickInMeasure})`
  );

  // --- CORRECTED LOGIC ---
  // We play a sound for EVERY tick.
  // The accent is only passed if it's a main beat.
  // This produces a strong DOWNBEAT, weaker main beats, and quietest subdivisions.
  playTick(isMainBeat ? isPrimaryAccent : false);

  // Safe visual callback with more detailed info
  try {
    onBeatVisual(tickIndex, isPrimaryAccent, isMainBeat);
  } catch (e) {
    console.error("Visual callback error:", e);
  }

  // Advance tick and schedule next tick
  tickIndex++;
  const durationOfOneBeat = (60.0 / bpm) * (4 / timeSignature.value);
  const secondsPerTick = durationOfOneBeat / ticksPerBeat;
  nextNoteTime += secondsPerTick;

  // If end-of-cycle requested, stop at the next bar boundary
  const nextMainBeatIndex = Math.floor(tickIndex / ticksPerBeat);
  if (
    endOfCycleRequested &&
    nextMainBeatIndex % timeSignature.beats === 0 &&
    tickIndex % ticksPerBeat === 0
  ) {
    endOfCycleRequested = false;
    isMetronomePlaying = false;

    if (schedulerTimer) {
      clearTimeout(schedulerTimer);
      schedulerTimer = null;
    }

    debugLog("state", "🟢 Cycle finished cleanly at bar boundary.");

    if (typeof onCycleComplete === "function") {
      try {
        debugLog(
          "state",
          `⏸️ Scheduling ${adjustmentPauseMs}ms adjustment pause before cycle-complete callback.`
        );
        setTimeout(() => {
          try {
            onCycleComplete();
          } catch (err) {
            console.error("onCycleComplete callback error:", err);
          }
        }, adjustmentPauseMs);
      } catch (err) {
        console.error("Failed to schedule onCycleComplete:", err);
      }
    }
  }
  timer.end();
}

// Continuously schedules beats ahead of time while metronome is active
function scheduler() {
  if (!isMetronomePlaying || isPaused) return;
  while (nextNoteTime < audioCtx.currentTime + scheduleAheadTime) {
    scheduleNote();
  }
  schedulerTimer = setTimeout(scheduler, 5);
}

// --- public functions ---
// Starts the metronome with the given BPM

export function startMetronome(newBpm = 120) {
  if (isMetronomePlaying) {
    debugLog("audio", "⚠️ Metronome already playing — start skipped");
    return;
  }
  audioCtx = ensureAudio();

  bpm = Math.max(20, Math.min(400, newBpm));
  tickIndex = 0;

  // UPDATED: Use the new formula for the initial tick scheduling
  const durationOfOneBeat = (60.0 / bpm) * (4 / timeSignature.value);
  const secondsPerTick = durationOfOneBeat / ticksPerBeat;
  nextNoteTime = audioCtx.currentTime + 0.1;

  isMetronomePlaying = true;
  isPaused = false;
  scheduler();
  debugLog(
    "audio",
    `Metronome started at ${bpm} BPM (ticksPerBeat=${ticksPerBeat})`
  );
}

// --- Count-in helper ---
// Plays a 3-2-1 count-in using the provided BPM to determine interval when
// tempoSynced is true. Returns a Promise that resolves when the count-in
// completes.
export function performCountIn(nextBpm = 120, tempoSynced = true) {
  const steps = 3;
  const intervalMs = tempoSynced ? 60000 / Math.max(1, nextBpm) : 1000;

  return new Promise((resolve) => {
    if (!audioCtx)
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    const now = audioCtx.currentTime + 0.02; // slight headroom
    for (let i = 0; i < steps; i++) {
      const t = now + (i * intervalMs) / 1000;
      const osc = audioCtx.createOscillator();
      const envelope = audioCtx.createGain();

      if (i === 0) {
        osc.frequency.value = 700;
        envelope.gain.value = 0.22;
        osc.type = "sine";
      } else if (i === 1) {
        osc.frequency.value = 1400;
        envelope.gain.value = 0.25;
        osc.type = "sine";
      } else {
        osc.frequency.value = 1600;
        envelope.gain.value = 0.3;
      }

      osc.connect(envelope);
      envelope.connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + (i === 1 ? 0.09 : 0.06));
    }

    setTimeout(() => resolve(), Math.ceil(intervalMs * steps) + 30);
  });
}

// Stops the metronome and clears scheduler
export function stopMetronome() {
  isMetronomePlaying = false;
  if (schedulerTimer) clearTimeout(schedulerTimer);
  schedulerTimer = null;
  debugLog("audio", "Metronome stopped");
}

export function resetPlaybackFlag() {
  // Necessary to handle restarting the metronome in new modules
  isMetronomePlaying = false;
}

// --- NEW time signature and subdivision config ---

export function setTimeSignature(beats, value) {
  // 🛡️ GUARD: Block changes during active playback
  if (isMetronomePlaying && !isPaused) {
    debugLog(
      "state",
      "⚠️ setTimeSignature blocked - Groove metronome is playing"
    );
    return;
  }

  debugLog(
    "state",
    `Time signature changing: ${timeSignature.beats}/${timeSignature.value} → ${beats}/${value}`
  );
  const newBeats = Math.max(1, Math.round(beats));
  const newValue = [2, 4, 8, 16].includes(value) ? value : 4; // Sanitize value

  // Preserve relative position in the new measure
  const currentTotalTicks = timeSignature.beats * ticksPerBeat;
  const newTotalTicks = newBeats * 1; // Subdivisions are reset

  const tickInOldMeasure = tickIndex % currentTotalTicks || 0;
  const progress = tickInOldMeasure / currentTotalTicks;
  tickIndex = Math.round(progress * newTotalTicks);

  // NEW: Only reset subdivisions if denominator changes
  const denominatorChanged = timeSignature.value !== newValue;

  timeSignature = { beats: newBeats, value: newValue };

  if (denominatorChanged) {
    setTicksPerBeat(1);
    debugLog(
      "state",
      `Time signature set to ${timeSignature.beats}/${timeSignature.value}, subdivisions reset`
    );
  } else {
    debugLog(
      "state",
      `Time signature set to ${timeSignature.beats}/${timeSignature.value}, subdivisions preserved`
    );
  }
  debugLog(
    "state",
    `Time signature changing: ${timeSignature.beats}/${timeSignature.value} → ${beats}/${value}`
  );
}

export function getTimeSignature() {
  return { ...timeSignature }; // Return a copy
}

export function setTicksPerBeat(n) {
  // 🛡️ GUARD: Block changes during active playback
  if (isMetronomePlaying && !isPaused) {
    debugLog(
      "state",
      "⚠️ setTicksPerBeat blocked - Groove metronome is playing"
    );
    return;
  }

  ticksPerBeat = Math.max(1, Math.round(n));
  debugLog("state", `Ticks per beat set to ${ticksPerBeat}`);
}

export function getTicksPerBeat() {
  return ticksPerBeat;
}

// expose current bpm
export function getBpm() {
  return bpm;
}

export function getPauseState() {
  return !!isPaused;
}

// --- Pause/Resume control ---
export function pauseMetronome() {
  if (!isMetronomePlaying || isPaused) return;
  isPaused = true;

  if (schedulerTimer) {
    clearTimeout(schedulerTimer);
    schedulerTimer = null;
  }

  pauseWallTime = audioCtx ? audioCtx.currentTime : 0;
  pauseAudioOffset = nextNoteTime - (audioCtx ? audioCtx.currentTime : 0);
  debugLog("audio", `⏸️ Metronome paused at ${pauseWallTime.toFixed(3)}s`);
}

export function resumeMetronome() {
  if (!isPaused || !audioCtx) return;
  isPaused = false;

  const resumeTime = audioCtx.currentTime;
  nextNoteTime = resumeTime + pauseAudioOffset;
  scheduler();
  debugLog("audio", "▶️ Metronome resumed after pause");
}

// --- Cycle completion handling ---
export function requestEndOfCycle(callback) {
  if (!isMetronomePlaying || endOfCycleRequested) return;

  endOfCycleRequested = true;
  if (typeof callback === "function") {
    onCycleComplete = callback;
  }

  debugLog(
    "state",
    `⏳ End-of-cycle requested — will stop at next bar boundary`
  );
}
// keep the module lightweight
