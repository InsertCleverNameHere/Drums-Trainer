// utils.js
// Small helper functions used by the UI and others

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
