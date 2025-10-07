// metronome.js
// Lightweight, high-precision metronome using Web Audio API

let audioCtx = null;
let nextNoteTime = 0.0;
let currentBeat = 0;
let isRunning = false;
let schedulerTimer = null;

let bpm = 120;
let beatsPerBar = 4; // configurable beats-per-bar (time signature top number)

// How far ahead to schedule (in seconds)
const scheduleAheadTime = 0.1;

// Callback for visuals (set from your UI code)
let onBeatVisual = (beat, isAccent) => {
  const el = document.getElementById("beat-indicator");
  if (!el) return;
  el.style.backgroundColor = isAccent ? "#ff4040" : "#eee";
  setTimeout(() => (el.style.backgroundColor = ""), 100);
};

// --- core tick generator ---
function playTick(isAccent) {
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
  onBeatVisual(currentBeat, isAccent);

  // Increment beat & time
  currentBeat++;
  const secondsPerBeat = 60.0 / bpm;
  nextNoteTime += secondsPerBeat;
}

// Scheduler loop
function scheduler() {
  while (nextNoteTime < audioCtx.currentTime + scheduleAheadTime) {
    scheduleNote();
  }
  schedulerTimer = setTimeout(scheduler, 25); // check every 25ms
}

// --- public functions ---
export function startMetronome(newBpm = 120) {
  if (isRunning) return;
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  bpm = Math.max(40, Math.min(240, newBpm)); // clamp to user-defined range
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

// --- beats-per-bar configuration ---
export function setBeatsPerBar(n) {
  beatsPerBar = Math.max(1, Math.round(n));
  console.log(`Beats per bar set to ${beatsPerBar}`);
}

export function getBeatsPerBar() {
  return beatsPerBar;
}