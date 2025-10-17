// utils.js
// Small helper functions used by the UI

export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// converts unit user chooses to seconds for internal logic
export function convertToSeconds(value, unit) {
  const n = parseInt(value);
  if (isNaN(n) || n <= 0) return 0;
  if (unit === "minutes") return n * 60;
  if (unit === "hours") return n * 3600;
  return n;
}

// random BPM between min and max, integer step 1
export function randomBpm(minBpm, maxBpm) {
  minBpm = Math.round(Number(minBpm) || 30);
  maxBpm = Math.round(Number(maxBpm) || 60);
  if (minBpm > maxBpm) {
    // swap to be defensive
    const t = minBpm;
    minBpm = maxBpm;
    maxBpm = t;
  }
  return randomInt(minBpm, maxBpm);
}

export function pickRandom(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return "";
  return arr[Math.floor(Math.random() * arr.length)];
}
