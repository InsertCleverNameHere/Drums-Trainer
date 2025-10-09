// metronomeCore.js
// Audio scheduling and metronome core logic (refactored from metronome.js)

let audioCtx = null;
let nextNoteTime = 0.0;
let currentBeat = 0;
let isRunning = false;
let schedulerTimer = null;

let bpm = 120;
let beatsPerBar = 4; // configurable beats-per-bar

// How far ahead to schedule (in seconds)
const scheduleAheadTime = 0.1;

// visual callback that can be registered by visuals.js
let onBeatVisual = () => {};

// allow visuals to register their callback
export function registerVisualCallback(cb) {
  if (typeof cb === "function") onBeatVisual = cb;
}

// core tick generator (plays short oscillator clicks)
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

  // call visual callback
  try {
    onBeatVisual(currentBeat, isAccent);
  } catch (e) {
    // swallow visual errors so audio keeps running
    console.error("Visual callback error:", e);
  }

  // Increment beat & time
  currentBeat++;
  const secondsPerBeat = 60.0 / bpm;
  nextNoteTime += secondsPerBeat;
}

// Scheduler loop
function scheduler() {
  if (!isRunning) return; // safety
  while (nextNoteTime < audioCtx.currentTime + scheduleAheadTime) {
    scheduleNote();
  }
  schedulerTimer = setTimeout(scheduler, 25);
}

// --- public functions ---
export function startMetronome(newBpm = 120) {
  if (isRunning) return;
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  bpm = Math.max(40, Math.min(240, newBpm)); // clamp to reasonable range for now
  currentBeat = 0;
  nextNoteTime = audioCtx.currentTime + 0.1;
  isRunning = true;
  scheduler();
  console.log(`Metronome started at ${bpm} BPM`);
}

export function stopMetronome() {
  isRunning = false;
  if (schedulerTimer) clearTimeout(schedulerTimer);
  schedulerTimer = null;
  console.log("Metronome stopped");
}

// --- beats-per-bar config
export function setBeatsPerBar(n) {
  beatsPerBar = Math.max(1, Math.round(n));
  console.log(`Beats per bar set to ${beatsPerBar}`);
}

export function getBeatsPerBar() {
  return beatsPerBar;
}

// optionally expose current bpm
export function getBpm() {
  return bpm;
}

// keep the module lightweight; other features (pause/resume, offsets, 1s cycle pause)
// will be implemented in Phase 1 extensions after modular refactor.