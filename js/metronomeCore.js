/* eslint-disable no-unused-vars */
// metronomeCore.js
// Audio scheduling and metronome core logic (refactored from metronome.js)
import { debugLog, DebugTimer } from "./debug.js";
import * as constants from "./constants.js";
import * as audioProfiles from "./audioProfiles.js";

let audioCtx = null;
let nextNoteTime = 0.0;
let tickIndex = 0; // continuous tick counter (0-based)
let isMetronomePlaying = false;
let schedulerTimer = null;
let endOfCycleRequested = false;
let onCycleComplete = null;

let bpm = 120;
let timeSignature = { beats: 4, value: 4 };
let ticksPerBeat = 1; // subdivisions per beat (1 = one tick per beat)
let _requestedMeasures = 1; // Used for end-of-cycle logic to determine how many measures to play before stopping

// How far ahead to schedule (in seconds)
const scheduleAheadTime = constants.AUDIO.LOOKAHEAD_S;

// short adjustment pause (ms) to wait after a cycle ends before notifying UI
const adjustmentPauseMs = constants.AUDIO.ADJUSTMENT_PAUSE_MS;

// visual callback that can be registered by visuals.js
let onBeatVisual = () => {};

// === Pause/Resume state tracking ===
let isPaused = false;
let pauseWallTime = 0; // audioCtx.currentTime snapshot when paused
let pauseAudioOffset = 0; // nextNoteTime offset preserved across pause

/**
 * Registers a visual callback to be triggered on each beat.
 *
 * @param {Function} cb - Callback function receiving (tickIndex, isPrimaryAccent, isMainBeat)
 * @returns {void}
 * @example
 * metronome.registerVisualCallback((tick, accent, beat) => {
 *   console.log(`Tick ${tick}, Accent: ${accent}`);
 * });
 */
export function registerVisualCallback(cb) {
  if (typeof cb === "function") onBeatVisual = cb;
}

// Delegates tick playback to the shared audioProfiles module
function playTick(isAccent) {
  audioProfiles.setNextNoteTime(nextNoteTime);
  audioProfiles.playTick(isAccent);
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

  // We play a sound for EVERY tick.
  // The accent is only passed if it's a main beat.
  // This produces a strong DOWNBEAT, weaker main beats, and quietest subdivisions.
  // If a pattern is active, the callback returns TRUE and we skip the standard beep.
  let isSuppressed = false;
  // Safe visual callback with more detailed info
  try {
    isSuppressed = onBeatVisual(
      tickIndex,
      isPrimaryAccent,
      isMainBeat,
      nextNoteTime
    );
  } catch (e) {
    console.error("Visual/Pattern callback error:", e);
  }

  if (!isSuppressed) {
    playTick(isMainBeat ? isPrimaryAccent : false);
  }

  // Advance tick and schedule next tick
  tickIndex++;
  const durationOfOneBeat = (60.0 / bpm) * (4 / timeSignature.value);
  const secondsPerTick = durationOfOneBeat / ticksPerBeat;
  nextNoteTime += secondsPerTick;

  // If end-of-cycle requested, stop at the next pattern boundary
  const nextMainBeatIndex = Math.floor(tickIndex / ticksPerBeat);
  // Default to 1 measure if not provided
  const targetMeasure = _requestedMeasures || 1;

  if (
    endOfCycleRequested &&
    nextMainBeatIndex % (timeSignature.beats * targetMeasure) === 0 &&
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

/**
 * Starts the groove metronome audio scheduler.
 *
 * @param {number} [newBpm=120] - Tempo in beats per minute (30-300, clamped to hard limits)
 * @returns {void}
 * @example
 * metronome.startMetronome(120);
 */
export function startMetronome(newBpm = 120) {
  if (isMetronomePlaying) {
    debugLog("audio", "⚠️ Metronome already playing — start skipped");
    return;
  }
  audioCtx = audioProfiles.ensureAudio();

  // Enforce hard limits (allow any integer within range)
  bpm = Math.max(
    constants.LIMITS.BPM.MIN,
    Math.min(constants.LIMITS.BPM.MAX, newBpm)
  );
  tickIndex = 0;

  // UPDATED: Use the new formula for the initial tick scheduling
  const durationOfOneBeat = (60.0 / bpm) * (4 / timeSignature.value);
  const secondsPerTick = durationOfOneBeat / ticksPerBeat;
  nextNoteTime = audioCtx.currentTime + constants.AUDIO.LOOKAHEAD_S;

  isMetronomePlaying = true;
  isPaused = false;
  scheduler();
  debugLog(
    "audio",
    `Metronome started at ${bpm} BPM (ticksPerBeat=${ticksPerBeat})`
  );
}

/**
 * Plays a 3-2-1 count-in using procedural audio.
 *
 * @param {number} [nextBpm=120] - Tempo for count-in timing
 * @param {boolean} [tempoSynced=true] - Use tempo-based intervals (true) or fixed 1s intervals (false)
 * @returns {Promise<void>} Resolves when count-in completes
 * @example
 * await metronome.performCountIn(120, true);
 * console.log('Count-in finished');
 */
export function performCountIn(nextBpm = 120, tempoSynced = true) {
  const steps = constants.AUDIO.COUNT_IN.STEPS;
  const intervalMs = tempoSynced
    ? 60000 / Math.max(1, nextBpm)
    : constants.AUDIO.COUNT_IN.FIXED_INTERVAL_MS;

  return new Promise((resolve) => {
    if (!audioCtx)
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    const now = audioCtx.currentTime + constants.AUDIO.COUNT_IN.HEADROOM_S;
    for (let i = 0; i < steps; i++) {
      const t = now + (i * intervalMs) / 1000;
      const osc = audioCtx.createOscillator();
      const envelope = audioCtx.createGain();

      if (i === 0) {
        osc.frequency.value = constants.AUDIO.COUNT_IN.FREQS[i];
        envelope.gain.value = constants.AUDIO.COUNT_IN.GAINS[i];
        osc.type = "sine";
      } else if (i === 1) {
        osc.frequency.value = constants.AUDIO.COUNT_IN.FREQS[i];
        envelope.gain.value = constants.AUDIO.COUNT_IN.GAINS[i];
        osc.type = "sine";
      } else {
        osc.frequency.value = constants.AUDIO.COUNT_IN.FREQS[i];
        envelope.gain.value = constants.AUDIO.COUNT_IN.GAINS[i];
      }

      osc.connect(envelope);
      envelope.connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + constants.AUDIO.COUNT_IN.STEP_DURATIONS[i]);
    }

    setTimeout(() => resolve(), Math.ceil(intervalMs * steps) + 30);
  });
}

/**
 * Stops the metronome and clears all timers.
 *
 * @returns {void}
 * @example
 * metronome.stopMetronome();
 */
export function stopMetronome() {
  isMetronomePlaying = false;
  if (schedulerTimer) clearTimeout(schedulerTimer);
  schedulerTimer = null;
  debugLog("audio", "Metronome stopped");
}

/**
 * Resets the playback flag (allows restarting after stop).
 *
 * @returns {void}
 * @internal Used by session engine to handle restart scenarios
 */
export function resetPlaybackFlag() {
  // Necessary to handle restarting the metronome in new modules
  isMetronomePlaying = false;
}

/**
 * Updates the time signature (e.g., 4/4, 7/8).
 * Blocked during active playback - must pause first.
 *
 * @param {number} beats - Numerator (1-16)
 * @param {number} value - Denominator (2, 4, 8, or 16)
 * @returns {void}
 * @example
 * metronome.setTimeSignature(7, 8); // 7/8 time
 */
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

/**
 * Returns the current time signature.
 *
 * @returns {{beats: number, value: number}} Time signature object
 * @example
 * const sig = metronome.getTimeSignature();
 * // { beats: 4, value: 4 }
 */
export function getTimeSignature() {
  return { ...timeSignature }; // Return a copy
}

/**
 * Sets subdivision level (1=none, 2=8ths, 4=16ths).
 * Blocked during active playback - must pause first.
 *
 * @param {number} n - Ticks per beat (1, 2, or 4)
 * @returns {void}
 * @example
 * metronome.setTicksPerBeat(4); // 16th note subdivisions
 */
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

/**
 * Returns the current subdivision level.
 *
 * @returns {number} Ticks per beat (1, 2, or 4)
 * @example
 * const ticks = metronome.getTicksPerBeat(); // 4 (16ths)
 */
export function getTicksPerBeat() {
  return ticksPerBeat;
}

/**
 * Returns the current tempo.
 *
 * @returns {number} Current BPM
 * @example
 * const tempo = metronome.getBpm(); // 120
 */
export function getBpm() {
  return bpm;
}

/**
 * Returns whether the metronome is currently paused.
 *
 * @returns {boolean} True if paused, false otherwise
 * @example
 * if (metronome.getPauseState()) console.log('Paused');
 */
export function getPauseState() {
  return !!isPaused;
}

/**
 * Pauses audio scheduling without resetting state.
 *
 * @returns {void}
 * @example
 * metronome.pauseMetronome();
 */
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

/**
 * Resumes audio scheduling from paused state.
 *
 * @returns {void}
 * @example
 * metronome.resumeMetronome();
 */
export function resumeMetronome() {
  if (!isPaused || !audioCtx) return;
  isPaused = false;

  const resumeTime = audioCtx.currentTime;
  nextNoteTime = resumeTime + pauseAudioOffset;
  scheduler();
  debugLog("audio", "▶️ Metronome resumed after pause");
}

/**
 * Requests graceful stop at next bar boundary.
 *
 * @param {Function} callback - Called after bar completes
 * @returns {void}
 * @example
 * metronome.requestEndOfCycle(() => {
 *   console.log('Bar finished cleanly');
 * });
 */
export function requestEndOfCycle(callback, measures = 1) {
  if (!isMetronomePlaying || endOfCycleRequested) return;

  endOfCycleRequested = true;
  _requestedMeasures = measures; // Store target measures locally
  if (typeof callback === "function") {
    onCycleComplete = callback;
  }

  debugLog(
    "state",
    `⏳ End-of-cycle requested — will stop at next bar boundary`
  );
}
