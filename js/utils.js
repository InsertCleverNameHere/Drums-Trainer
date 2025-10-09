// utils.js
// Small helper functions used by the UI

export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// random BPM between min and max, integer step 1
export function randomBpm(minBpm, maxBpm) {
  minBpm = Math.round(Number(minBpm) || 30);
  maxBpm = Math.round(Number(maxBpm) || 60);
  if (minBpm > maxBpm) {
    // swap to be defensive
    const t = minBpm; minBpm = maxBpm; maxBpm = t;
  }
  return randomInt(minBpm, maxBpm);
}

export function pickRandom(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return "";
  return arr[Math.floor(Math.random() * arr.length)];
}