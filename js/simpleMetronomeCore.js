// js/simpleMetronomeCore.js
// Lightweight isolated metronome core for the simple metronome panel.
// API-compatible with the existing metronomeCore functions used by the app.

let audioCtx = null;
let nextNoteTime = 0;
let tickIndex = 0;
let schedulerTimer = null;
let isPlaying = false;
let isPaused = false;
let pauseAudioOffset = 0;

let bpm = 120;
let beatsPerBar = 4;
let ticksPerBeat = 1;

const scheduleAheadTime = 0.1;
const schedulerIntervalMs = 25;
const adjustmentPauseMs = 1700;

let onBeatVisual = () => {};
let endOfCycleRequested = false;
let onCycleComplete = null;

function ensureAudio() {
  if (!audioCtx)
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

export function registerVisualCallback(cb) {
  if (typeof cb === "function") onBeatVisual = cb;
}

function playTick(isAccent) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const envelope = audioCtx.createGain();

  // Match groove metronome: Accent = higher pitch & louder
  osc.frequency.value = isAccent ? 2000 : 1000;
  envelope.gain.value = isAccent ? 0.4 : 0.25;

  osc.connect(envelope);
  envelope.connect(audioCtx.destination);

  osc.start(nextNoteTime);
  osc.stop(nextNoteTime + 0.05);
}

function scheduleNote() {
  const beatNumber = Math.floor(tickIndex / ticksPerBeat);
  const tickInBeat = tickIndex % ticksPerBeat;
  const isAccent = tickInBeat === 0 && beatNumber % beatsPerBar === 0;

  if (tickInBeat === 0) playTick(isAccent);

  try {
    onBeatVisual(tickIndex, isAccent, tickInBeat);
  } catch (e) {
    console.error("simpleMetronomeCore visual callback error:", e);
  }

  tickIndex++;
  const secondsPerTick = 60.0 / (bpm * ticksPerBeat);
  nextNoteTime += secondsPerTick;

  const nextBeat = Math.floor(tickIndex / ticksPerBeat);
  if (endOfCycleRequested && nextBeat % beatsPerBar === 0) {
    endOfCycleRequested = false;
    stopInternalScheduling();
    if (typeof onCycleComplete === "function") {
      setTimeout(() => {
        try {
          onCycleComplete();
        } catch (err) {
          console.error("onCycleComplete error:", err);
        }
      }, adjustmentPauseMs);
    }
  }
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
    console.warn("simpleMetronomeCore: already playing");
    return;
  }
  ensureAudio();
  bpm = Math.max(20, Math.min(400, Number(newBpm) || bpm));
  tickIndex = 0;
  nextNoteTime = audioCtx.currentTime + 0.05;
  isPlaying = true;
  isPaused = false;
  scheduler();
  console.log(
    `simpleMetronomeCore started at ${bpm} BPM (ticksPerBeat=${ticksPerBeat})`
  );
}

export function stopMetronome() {
  stopInternalScheduling();
  console.log("simpleMetronomeCore stopped");
}

export function pauseMetronome() {
  if (!isPlaying || isPaused) return;
  isPaused = true;
  if (schedulerTimer) {
    clearTimeout(schedulerTimer);
    schedulerTimer = null;
  }
  pauseAudioOffset = nextNoteTime - (audioCtx ? audioCtx.currentTime : 0);
  console.info("simpleMetronomeCore paused");
}

export function resumeMetronome() {
  if (!isPaused || !audioCtx) return;
  isPaused = false;
  nextNoteTime = audioCtx.currentTime + pauseAudioOffset;
  scheduler();
  console.info("simpleMetronomeCore resumed");
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
  console.log("simpleMetronomeCore: end-of-cycle requested");
}

export function setBeatsPerBar(n) {
  const newBeats = Math.max(1, Math.round(n));
  const currentBeat = Math.floor(tickIndex / Math.max(1, ticksPerBeat));
  const tickInBeat = tickIndex % Math.max(1, ticksPerBeat);
  const newBeatIndex = currentBeat % newBeats;
  tickIndex = newBeatIndex * Math.max(1, ticksPerBeat) + tickInBeat;
  beatsPerBar = newBeats;
  try {
    const isAccent = tickInBeat === 0 && currentBeat % beatsPerBar === 0;
    onBeatVisual(tickIndex, isAccent, tickInBeat);
  } catch (e) {}
  console.log(`simpleMetronomeCore: beatsPerBar set to ${beatsPerBar}`);
}

export function getBeatsPerBar() {
  return beatsPerBar;
}

export function setTicksPerBeat(n) {
  ticksPerBeat = Math.max(1, Math.round(n));
  console.log(`simpleMetronomeCore: ticksPerBeat set to ${ticksPerBeat}`);
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
