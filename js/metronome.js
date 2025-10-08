// metronome.js
// Lightweight, high-precision metronome using Web Audio API

let audioCtx = null;
let nextNoteTime = 0.0;
let currentBeat = 0;
let isRunning = false;
let schedulerTimer = null;

let bpm = 120;
let beatsPerBar = 4;

// How far ahead to schedule (in seconds)
const scheduleAheadTime = 0.1;

// --- Visual Callback ---
let onBeatVisual = (beat, isAccent) => {
  const container = document.getElementById("beat-indicator-container");
  if (!container) return;
  // Lazy initialize circles if not already created
  if (container.childElementCount !== beatsPerBar) {
    container.innerHTML = "";
    for (let i = 0; i < beatsPerBar; i++) {
      const dot = document.createElement("div");
      dot.className = "beat-dot";
      container.appendChild(dot);
    }
  }

  // Normalize beat index (e.g., 0 → 0–3 loop)
  const beatIndex = beat % beatsPerBar;
  const dots = container.children;

  // Reset all dots
  for (let i = 0; i < dots.length; i++) {
    dots[i].style.backgroundColor = "";
    dots[i].style.transform = "scale(1)";
    dots[i].style.opacity = "0.4";
  }

  // Highlight current dot
  const activeDot = dots[beatIndex];
  activeDot.style.backgroundColor = isAccent ? "#b22222" : "#006400";
  activeDot.style.transform = "scale(1.4)";
  activeDot.style.opacity = "1";

  // Reset it slightly after
  setTimeout(() => {
    activeDot.style.transform = "scale(1)";
    activeDot.style.opacity = "0.7";
  }, 100);
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

// ✅ export the visual element
export { onBeatVisual };