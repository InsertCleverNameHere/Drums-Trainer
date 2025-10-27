// utils.js
// Small helper functions used by the UI and others

// === Core metronome helpers ===
// Returns a random integer between min and max (inclusive)
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Converts unit user chooses (minutes or hours) to seconds for internal logic
export function convertToSeconds(value, unit) {
  const n = parseInt(value);
  if (isNaN(n) || n <= 0) return 0;
  if (unit === "minutes") return n * 60;
  if (unit === "hours") return n * 3600;
  return n;
}

// Clamps a value between a minimum and maximum range
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// Randomly selects a groove and BPM within the specified ranges
export function randomizeGroove(groovesText, bpmMin, bpmMax) {
  const grooves = groovesText
    .split("\n")
    .map((g) => g.trim())
    .filter(Boolean);

  bpmMin = parseInt(bpmMin);
  bpmMax = parseInt(bpmMax);

  if (isNaN(bpmMin)) bpmMin = 30;
  if (isNaN(bpmMax)) bpmMax = 60;
  if (bpmMin > bpmMax) [bpmMin, bpmMax] = [bpmMax, bpmMin];

  const randomBpm =
    Math.floor((Math.random() * (bpmMax - bpmMin + 5)) / 5) * 5 + bpmMin;
  const randomGroove =
    grooves.length > 0
      ? grooves[Math.floor(Math.random() * grooves.length)]
      : "No groove selected";

  return { bpm: randomBpm, groove: randomGroove };
}

// Picks a random element from an array (returns empty string if invalid)
export function pickRandom(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return "";
  return arr[Math.floor(Math.random() * arr.length)];
}

// Time unit helpers
export function formatTime(seconds) {
  if (seconds < 60) return `${seconds}s`;

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [];
  if (hrs > 0) parts.push(`${hrs}h`);
  if (mins > 0 || hrs > 0) parts.push(`${mins}m`);
  parts.push(`${secs}s`);

  return parts.join(" ");
}

// === Meta app helpers ===

// Version coloring:
// Generates a unique HSL color based on version string
export function generateColorFromVersion(version) {
  const palette = [
    "#e6194b",
    "#3cb44b",
    "#ffe119",
    "#4363d8",
    "#f58231",
    "#911eb4",
    "#46f0f0",
    "#f032e6",
    "#bcf60c",
    "#fabebe",
    "#008080",
    "#e6beff",
    "#9a6324",
    "#fffac8",
    "#800000",
    "#aaffc3",
    "#808000",
    "#ffd8b1",
    "#000075",
    "#808080",
  ];

  // Simple hash to index into palette
  let hash = 0;
  for (let i = 0; i < version.length; i++) {
    hash = version.charCodeAt(i) + ((hash << 5) - hash);
  }

  const index = Math.abs(hash) % palette.length;
  return palette[index];
}

// === Tap tempo logic ===
export function calculateTapTempo() {
  const now = performance.now();
  if (!calculateTapTempo._taps) calculateTapTempo._taps = [];
  if (!calculateTapTempo._lastTap) calculateTapTempo._lastTap = 0;

  const taps = calculateTapTempo._taps;
  const TAP_TIMEOUT = 1500;
  const MAX_WINDOW = 3; // fewer = faster response

  // reset after idle
  if (
    calculateTapTempo._lastTap &&
    now - calculateTapTempo._lastTap > TAP_TIMEOUT
  )
    taps.length = 0;

  calculateTapTempo._lastTap = now;
  taps.push(now);
  if (taps.length < 2) return null;
  if (taps.length > MAX_WINDOW) taps.shift();

  const intervals = [];
  for (let i = 1; i < taps.length; i++) intervals.push(taps[i] - taps[i - 1]);

  // fast decay weighting
  const decay = 0.18;
  let w = 1,
    totalW = 0,
    weightedSum = 0;
  for (let i = intervals.length - 1; i >= 0; i--) {
    weightedSum += intervals[i] * w;
    totalW += w;
    w *= decay;
  }

  let avg = weightedSum / totalW;

  // slight predictive bias toward most recent interval
  const last = intervals[intervals.length - 1];
  avg = avg * 0.92 + last * 0.08;

  let bpm = 60000 / avg;

  // quantize + clamp
  bpm = Math.round(bpm / 5) * 5;
  bpm = Math.max(40, Math.min(bpm, 400));

  return bpm;
}

// === Global debug exposure (optional for macros) ===
if (typeof window !== "undefined") {
  window.utils = {
    randomInt,
    convertToSeconds,
    clamp,
    randomizeGroove,
    pickRandom,
    formatTime,
    generateColorFromVersion,
    calculateTapTempo,
  };
}
