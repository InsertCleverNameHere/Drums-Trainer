// metronomeCore.js
// Audio scheduling and metronome core logic (refactored from metronome.js)

let audioCtx = null;
let nextNoteTime = 0.0;
let currentBeat = 0;
let isMetronomePlaying = false;
let schedulerTimer = null;
let endOfCycleRequested = false;
let targetBarEnd = null;
let onCycleComplete = null;

let bpm = 120;
let beatsPerBar = 4; // configurable beats-per-bar

// How far ahead to schedule (in seconds)
const scheduleAheadTime = 0.1;

// short adjustment pause (ms) to wait after a cycle ends before notifying UI
// increased to 1700ms per request
const adjustmentPauseMs = 1700;

// visual callback that can be registered by visuals.js
let onBeatVisual = () => {};

// === Pause/Resume state tracking ===
let isPaused = false;
let pauseTime = 0;

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
  const isAccent = currentBeat % beatsPerBar === 0;
  playTick(isAccent);

  // call visual callback safely
  try {
    onBeatVisual(currentBeat, isAccent);
  } catch (e) {
    console.error("Visual callback error:", e);
  }

  // Increment beat and time
  currentBeat++;
  const secondsPerBeat = 60.0 / bpm;
  nextNoteTime += secondsPerBeat;

  // If end-of-cycle was requested, stop at next bar boundary and notify UI
  if (endOfCycleRequested && currentBeat % beatsPerBar === 0) {
    endOfCycleRequested = false;
    isMetronomePlaying = false;

    if (schedulerTimer) {
      clearTimeout(schedulerTimer);
      schedulerTimer = null;
    }

    console.log("🟢 Cycle finished cleanly at bar boundary.");

    // notify UI
    // invoke the UI callback after a short adjustment pause so visuals and
    // user can take a breath before any count-in / next-cycle logic runs.
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

  bpm = Math.max(40, Math.min(240, newBpm)); // clamp to reasonable range for now
  currentBeat = 0;
  nextNoteTime = audioCtx.currentTime + 0.1;
  isMetronomePlaying = true;
  isPaused = false;
  scheduler();
  console.log(`Metronome started at ${bpm} BPM`);
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

      // Make 3 & 2 distinct from the regular metronome ticks.
      // Step indices: 0 -> '3', 1 -> '2', 2 -> '1'
      if (i === 0) {
        // '3' — lower, short click
        osc.frequency.value = 700;
        envelope.gain.value = 0.22;
        osc.type = "sine";
      } else if (i === 1) {
        // '2' — mid, slightly longer
        osc.frequency.value = 1400;
        envelope.gain.value = 0.25;
        osc.type = "sine";
      } else {
        // '1' — final accent; restore previous, slightly lower pitch so it's
        // distinct but not too high (matches earlier behavior)
        osc.frequency.value = 1600;
        envelope.gain.value = 0.3;
        // leave osc.type as default for a familiar timbre
      }

      osc.connect(envelope);
      envelope.connect(audioCtx.destination);
      osc.start(t);
      // stop shortly after; give a touch more for middle tick
      osc.stop(t + (i === 1 ? 0.09 : 0.06));
    }

    // resolve slightly after the last scheduled tick
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

// --- beats-per-bar config
export function setBeatsPerBar(n) {
  beatsPerBar = Math.max(1, Math.round(n));
  console.log(`Beats per bar set to ${beatsPerBar}`);
}
export function getBeatsPerBar() {
  return beatsPerBar;
}
// expose current bpm
export function getBpm() {
  return bpm;
}

// --- Pause/Resume control ---
export function pauseMetronome() {
  if (!isMetronomePlaying || isPaused) return;
  isPaused = true;

  // Stop scheduling new beats but let current one finish
  if (schedulerTimer) {
    clearTimeout(schedulerTimer);
    schedulerTimer = null;
  }
  pauseTime = audioCtx.currentTime;
  console.info(`⏸️ Metronome paused at ${pauseTime.toFixed(3)}s`);
}

export function resumeMetronome() {
  if (!isPaused || !audioCtx) return;
  isPaused = false;

  const resumeTime = audioCtx.currentTime;
  const offset = resumeTime - pauseTime;

  // Adjust timing so it stays in sync
  nextNoteTime += offset;
  scheduler(); // restart scheduler loop
  console.info("▶️ Metronome resumed after pause");
}
// --- Cycle completion handling ---
export function requestEndOfCycle(callback) {
  if (!isMetronomePlaying || endOfCycleRequested) return;

  // Calculate the target bar to stop after finishing this one
  // targetBarEnd is informational only; not used in scheduling logic for now
  const currentBar = Math.floor(currentBeat / beatsPerBar);
  targetBarEnd = currentBar + 1;
  endOfCycleRequested = true;

  if (typeof callback === "function") {
    onCycleComplete = callback;
  }

  console.log(`⏳ Will stop at end of bar #${targetBarEnd}`);
}

// keep the module lightweight
