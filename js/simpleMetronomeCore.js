// js/simpleMetronomeCore.js
// Lightweight isolated metronome core for the simple metronome panel.
// API-compatible with the existing metronomeCore functions used by the app.
import { debugLog, DebugTimer } from "./debug.js";
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

const scheduleAheadTime = 0.1;
const schedulerIntervalMs = 25;
const adjustmentPauseMs = 1700;

let onBeatVisual = () => {};
let endOfCycleRequested = false;
let onCycleComplete = null;

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

export function startMetronome(newBpm = 120) {
  if (isPlaying) {
    debugLog("audio", "⚠️ simpleMetronomeCore: already playing");
    return;
  }
  audioCtx = ensureAudio();
  bpm = Math.max(20, Math.min(400, Number(newBpm) || bpm));
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

export function stopMetronome() {
  stopInternalScheduling();
  debugLog("audio", "simpleMetronomeCore stopped");
}

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

export function resumeMetronome() {
  if (!isPaused || !audioCtx) return;
  isPaused = false;
  nextNoteTime = audioCtx.currentTime + pauseAudioOffset;
  scheduler();
  debugLog("audio", "▶️ simpleMetronomeCore resumed");
}

export function performCountIn(nextBpm = 120, tempoSynced = true) {
  const steps = 3;
  const intervalMs = tempoSynced ? 60000 / Math.max(1, nextBpm) : 1000;
  return new Promise((resolve) => {
    ensureAudio();
    const now = audioCtx.currentTime + 0.02;
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

export function requestEndOfCycle(callback) {
  if (!isPlaying || endOfCycleRequested) return;
  endOfCycleRequested = true;
  if (typeof callback === "function") onCycleComplete = callback;
  debugLog("state", "⏳ simpleMetronomeCore: end-of-cycle requested");
}

// --- NEW time signature and subdivision config ---

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

export function getTimeSignature() {
  return { ...timeSignature }; // Return a copy
}

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
  cdebugLog(
    "state",
    `simpleMetronomeCore: ticksPerBeat set to ${ticksPerBeat}`
  );
}

export function getTicksPerBeat() {
  return ticksPerBeat;
}

export function getBpm() {
  return bpm;
}

export function getPauseState() {
  return !!isPaused;
}

export function resetPlaybackFlag() {
  isPlaying = false;
}
