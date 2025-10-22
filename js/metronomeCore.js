// metronomeCore.js
// Audio scheduling and metronome core logic (refactored from metronome.js)

let audioCtx = null;
let nextNoteTime = 0.0;
let tickIndex = 0; // continuous tick counter (0-based)
// let currentBeat = 0;
let isMetronomePlaying = false;
let schedulerTimer = null;
let endOfCycleRequested = false;
let onCycleComplete = null;

let bpm = 120;
let beatsPerBar = 4; // configurable beats-per-bar
let ticksPerBeat = 1; // subdivisions per beat (1 = one tick per beat)

// How far ahead to schedule (in seconds)
const scheduleAheadTime = 0.1;

// short adjustment pause (ms) to wait after a cycle ends before notifying UI
// increased to 1700ms per request
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

// Generates a short audio tick (accented or regular)
function playTick(isAccent) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const envelope = audioCtx.createGain();

  // Accent = higher pitch & louder
  osc.frequency.value = isAccent ? 2000 : 1000;
  envelope.gain.value = isAccent ? 0.4 : 0.25;

  osc.connect(envelope);
  envelope.connect(audioCtx.destination);

  osc.start(nextNoteTime);
  osc.stop(nextNoteTime + 0.05);
}

// Schedule a single beat ahead of time
function scheduleNote() {
  // Compute beat and tick positions
  const beatNumber = Math.floor(tickIndex / ticksPerBeat); // 0-based beat number
  const tickInBeat = tickIndex % ticksPerBeat;

  // Accent occurs on first tick of first beat in a bar
  const isAccent = tickInBeat === 0 && beatNumber % beatsPerBar === 0;

  // Play audio only on primary beat ticks (tickInBeat === 0) for now
  if (tickInBeat === 0) {
    playTick(isAccent);
  }

  // Safe visual callback: provide tickIndex, isAccent, tickInBeat
  try {
    onBeatVisual(tickIndex, isAccent, tickInBeat);
  } catch (e) {
    console.error("Visual callback error:", e);
  }

  // Advance tick and schedule next tick
  tickIndex++;
  const secondsPerTick = 60.0 / (bpm * ticksPerBeat);
  nextNoteTime += secondsPerTick;

  // If end-of-cycle requested, stop at the next bar boundary (when nextBeat % beatsPerBar === 0)
  const nextBeat = Math.floor(tickIndex / ticksPerBeat);
  if (endOfCycleRequested && nextBeat % beatsPerBar === 0) {
    endOfCycleRequested = false;
    isMetronomePlaying = false;

    if (schedulerTimer) {
      clearTimeout(schedulerTimer);
      schedulerTimer = null;
    }

    console.log("🟢 Cycle finished cleanly at bar boundary.");

    if (typeof onCycleComplete === "function") {
      try {
        console.info(
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
}

// Continuously schedules beats ahead of time while metronome is active
function scheduler() {
  if (!isMetronomePlaying || isPaused) return;
  while (nextNoteTime < audioCtx.currentTime + scheduleAheadTime) {
    scheduleNote();
  }
  schedulerTimer = setTimeout(scheduler, 25);
}

// --- public functions ---
// Starts the metronome with the given BPM

export function startMetronome(newBpm = 120) {
  if (isMetronomePlaying) {
    console.warn("⚠️ Metronome already playing — start skipped");
    return;
  }
  if (!audioCtx)
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  bpm = Math.max(20, Math.min(400, newBpm));
  tickIndex = 0;
  const secondsPerTick = 60.0 / (bpm * ticksPerBeat);
  nextNoteTime = audioCtx.currentTime + 0.1;
  isMetronomePlaying = true;
  isPaused = false;
  scheduler();
  console.log(`Metronome started at ${bpm} BPM (ticksPerBeat=${ticksPerBeat})`);
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
  console.log("Metronome stopped");
}

export function resetPlaybackFlag() {
  // Necessary to handle restarting the metronome in new modules
  isMetronomePlaying = false;
}

// --- beats-per-bar and subdivision config
export function setBeatsPerBar(n) {
  const newBeats = Math.max(1, Math.round(n));

  // preserve current position: compute current beat and tick-in-beat
  const currentBeat = Math.floor(tickIndex / Math.max(1, ticksPerBeat));
  const tickInBeat = tickIndex % Math.max(1, ticksPerBeat);

  // compute new tickIndex so we remain at the same relative tick within the new bar
  const newBeatIndex = currentBeat % newBeats;
  tickIndex = newBeatIndex * Math.max(1, ticksPerBeat) + tickInBeat;

  beatsPerBar = newBeats;
  console.log(`Beats per bar set to ${beatsPerBar}`);

  // If visuals are registered, trigger a refresh immediately (safe no-op if not)
  try {
    // invoke visual callback with current tickIndex and accent state for immediate update
    const isAccent = tickInBeat === 0 && currentBeat % beatsPerBar === 0;
    onBeatVisual(tickIndex, isAccent, tickInBeat);
  } catch (e) {
    // swallow errors to avoid disrupting metronome logic
  }
}

export function getBeatsPerBar() {
  return beatsPerBar;
}

export function setTicksPerBeat(n) {
  ticksPerBeat = Math.max(1, Math.round(n));
  console.log(`Ticks per beat set to ${ticksPerBeat}`);
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
  console.info(`⏸️ Metronome paused at ${pauseWallTime.toFixed(3)}s`);
}

export function resumeMetronome() {
  if (!isPaused || !audioCtx) return;
  isPaused = false;

  const resumeTime = audioCtx.currentTime;
  nextNoteTime = resumeTime + pauseAudioOffset;
  scheduler();
  console.info("▶️ Metronome resumed after pause");
}

// --- Cycle completion handling ---
export function requestEndOfCycle(callback) {
  if (!isMetronomePlaying || endOfCycleRequested) return;

  endOfCycleRequested = true;
  if (typeof callback === "function") {
    onCycleComplete = callback;
  }

  console.log(`⏳ End-of-cycle requested — will stop at next bar boundary`);
}

// keep the module lightweight
