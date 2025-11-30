// js/simpleMetronomeCore.js
// Lightweight isolated metronome core for the simple metronome panel.
// API-compatible with the existing metronomeCore functions used by the app.
import { debugLog, DebugTimer } from "./debug.js";
import {
  BPM_HARD_LIMITS,
  BPM_DEFAULTS,
  SCHEDULER_CONFIG,
  COUNT_IN_CONFIG,
} from "./constants.js";
import {
  playTick as playProfileTick,
  ensureAudio,
  setNextNoteTime,
} from "./audioProfiles.js";

let audioCtx = null;
let nextNoteTime = 0;
let tickIndex = 0;
let schedulerTimer = null;
let isPlaying = false;
let isPaused = false;
let pauseAudioOffset = 0;

let bpm = 120;
// NEW: timeSignature object replaces beatsPerBar
let timeSignature = { beats: 4, value: 4 };
let ticksPerBeat = 1;

const scheduleAheadTime = SCHEDULER_CONFIG.SCHEDULE_AHEAD_TIME;
const schedulerIntervalMs = SCHEDULER_CONFIG.SIMPLE_SCHEDULER_INTERVAL_MS;
const adjustmentPauseMs = SCHEDULER_CONFIG.ADJUSTMENT_PAUSE_MS;

let onBeatVisual = () => {};
let endOfCycleRequested = false;
let onCycleComplete = null;

/**
 * Registers a visual callback to be triggered on each beat.
 * 
 * @param {Function} cb - Callback function receiving (tickIndex, isPrimaryAccent, isMainBeat)
 * @returns {void}
 */
export function registerVisualCallback(cb) {
  if (typeof cb === "function") onBeatVisual = cb;
}

function playTick(isAccent) {
  // Always ensure the shared audio context exists
  audioCtx = ensureAudio();
  setNextNoteTime(nextNoteTime);
  playProfileTick(isAccent);
}

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

function scheduler() {
  if (!isPlaying || isPaused) return;
  while (nextNoteTime < audioCtx.currentTime + scheduleAheadTime) {
    scheduleNote();
  }
  schedulerTimer = setTimeout(scheduler, schedulerIntervalMs);
}

function stopInternalScheduling() {
  isPlaying = false;
  if (schedulerTimer) {
    clearTimeout(schedulerTimer);
    schedulerTimer = null;
  }
}

/**
 * Starts the simple metronome audio scheduler.
 * 
 * @param {number} [newBpm=120] - Tempo in beats per minute (30-300)
 * @returns {void}
 */
export function startMetronome(newBpm = 120) {
  if (isPlaying) {
    debugLog("audio", "⚠️ simpleMetronomeCore: already playing");
    return;
  }
  audioCtx = ensureAudio();
  // Enforce hard limits (allow any integer within range)
  bpm = Math.max(
    BPM_HARD_LIMITS.MIN,
    Math.min(BPM_HARD_LIMITS.MAX, Number(newBpm) || bpm)
  );
  tickIndex = 0;

  // UPDATED: Use the new formula for the initial tick scheduling
  const durationOfOneBeat = (60.0 / bpm) * (4 / timeSignature.value);
  const secondsPerTick = durationOfOneBeat / ticksPerBeat;
  nextNoteTime = audioCtx.currentTime + 0.1;

  isPlaying = true;
  isPaused = false;
  scheduler();
  debugLog(
    "audio",
    `simpleMetronomeCore started at ${bpm} BPM (ticksPerBeat=${ticksPerBeat})`
  );
}

/**
 * Stops the simple metronome and clears all timers.
 * 
 * @returns {void}
 */
export function stopMetronome() {
  stopInternalScheduling();
  debugLog("audio", "simpleMetronomeCore stopped");
}

/**
 * Pauses audio scheduling without resetting state.
 * 
 * @returns {void}
 */
export function pauseMetronome() {
  if (!isPlaying || isPaused) return;
  isPaused = true;
  if (schedulerTimer) {
    clearTimeout(schedulerTimer);
    schedulerTimer = null;
  }
  pauseAudioOffset = nextNoteTime - (audioCtx ? audioCtx.currentTime : 0);
  debugLog("audio", "⏸️ simpleMetronomeCore paused");
}

/**
 * Resumes audio scheduling from paused state.
 * 
 * @returns {void}
 */
export function resumeMetronome() {
  if (!isPaused || !audioCtx) return;
  isPaused = false;
  nextNoteTime = audioCtx.currentTime + pauseAudioOffset;
  scheduler();
  debugLog("audio", "▶️ simpleMetronomeCore resumed");
}

/**
 * Plays a 3-2-1 count-in using procedural audio.
 * 
 * @param {number} [nextBpm=120] - Tempo for count-in timing
 * @param {boolean} [tempoSynced=true] - Use tempo-based intervals
 * @returns {Promise<void>} Resolves when count-in completes
 */
export function performCountIn(nextBpm = 120, tempoSynced = true) {
  const steps = COUNT_IN_CONFIG.STEPS;
  const intervalMs = tempoSynced
    ? 60000 / Math.max(1, nextBpm)
    : COUNT_IN_CONFIG.FIXED_INTERVAL_MS;
  return new Promise((resolve) => {
    ensureAudio();
    const now = audioCtx.currentTime + COUNT_IN_CONFIG.HEADROOM_SECONDS;
    for (let i = 0; i < steps; i++) {
      const t = now + (i * intervalMs) / 1000;
      const osc = audioCtx.createOscillator();
      const envelope = audioCtx.createGain();
      if (i === 0) {
        osc.frequency.value = COUNT_IN_CONFIG.FREQUENCIES[i];
        envelope.gain.value = COUNT_IN_CONFIG.GAINS[i];
        osc.type = "sine";
      } else if (i === 1) {
        osc.frequency.value = COUNT_IN_CONFIG.FREQUENCIES[i];
        envelope.gain.value = COUNT_IN_CONFIG.GAINS[i];
        osc.type = "sine";
      } else {
        osc.frequency.value = COUNT_IN_CONFIG.FREQUENCIES[i];
        envelope.gain.value = COUNT_IN_CONFIG.GAINS[i];
      }
      osc.connect(envelope);
      envelope.connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + COUNT_IN_CONFIG.STEP_DURATIONS[i]);
    }
    setTimeout(() => resolve(), Math.ceil(intervalMs * steps) + 30);
  });
}

/**
 * Requests graceful stop at next bar boundary.
 * 
 * @param {Function} callback - Called after bar completes
 * @returns {void}
 */
export function requestEndOfCycle(callback) {
  if (!isPlaying || endOfCycleRequested) return;
  endOfCycleRequested = true;
  if (typeof callback === "function") onCycleComplete = callback;
  debugLog("state", "⏳ simpleMetronomeCore: end-of-cycle requested");
}

/**
 * Updates the time signature (e.g., 4/4, 7/8).
 * Blocked during active playback.
 * 
 * @param {number} beats - Numerator (1-16)
 * @param {number} value - Denominator (2, 4, 8, or 16)
 * @returns {void}
 */
export function setTimeSignature(beats, value) {
  // 🛡️ GUARD: Block changes during active playback
  if (isPlaying && !isPaused) {
    debugLog(
      "state",
      "⚠️ setTimeSignature blocked - Simple metronome is playing"
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
    `Time signature set to ${timeSignature.beats}/${timeSignature.value}`
  );
}

/**
 * Returns the current time signature.
 * 
 * @returns {{beats: number, value: number}} Time signature object
 */
export function getTimeSignature() {
  return { ...timeSignature }; // Return a copy
}

/**
 * Sets subdivision level (1=none, 2=8ths, 4=16ths).
 * Blocked during active playback.
 * 
 * @param {number} n - Ticks per beat
 * @returns {void}
 */
export function setTicksPerBeat(n) {
  // 🛡️ GUARD: Block changes during active playback
  if (isPlaying && !isPaused) {
    debugLog(
      "state",
      "⚠️ setTicksPerBeat blocked - Simple metronome is playing"
    );
    return;
  }

  ticksPerBeat = Math.max(1, Math.round(n));
  debugLog("state", `simpleMetronomeCore: ticksPerBeat set to ${ticksPerBeat}`);
}

/**
 * Returns the current subdivision level.
 * 
 * @returns {number} Ticks per beat
 */
export function getTicksPerBeat() {
  return ticksPerBeat;
}

/**
 * Returns the current tempo.
 * 
 * @returns {number} Current BPM
 */
export function getBpm() {
  return bpm;
}

/**
 * Returns whether the metronome is paused.
 * 
 * @returns {boolean} True if paused
 */
export function getPauseState() {
  return !!isPaused;
}

/**
 * Resets the playback flag.
 * 
 * @returns {void}
 * @internal
 */
export function resetPlaybackFlag() {
  isPlaying = false;
}
