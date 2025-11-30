// utils.js
// Small helper functions used by the UI and others

// === Core metronome helpers ===
/**
 * @fileoverview Utility helper functions for the Random Groove Trainer.
 * @module utils
 */

import { debugLog } from "./debug.js";
import {
  BPM_HARD_LIMITS,
  TAP_TEMPO_QUANTIZATION,
  getUserQuantizationPreference,
} from "./constants.js";

/**
 * Returns a random integer between min and max (inclusive).
 * 
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Random integer
 */
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Quantizes a value to the nearest step.
 * 
 * @param {number} value - Value to quantize
 * @param {number} [step=5] - Quantization step
 * @returns {number} Quantized value
 */
export function quantizeToStep(value, step = 5) {
  return Math.round(value / step) * step;
}

/**
 * Sanitizes quantization step to valid range (1-100).
 * 
 * @param {number} value - Step value to sanitize
 * @returns {number} Clamped step value
 */
export function sanitizeQuantizationStep(value) {
  // Step must be 1–100, default to 5
  const step = sanitizePositiveInteger(value, {
    min: 1,
    max: 100,
    defaultValue: 5,
  });
  return Math.min(step, 100);
}

// Quantization defaults (groove uses this; tap tempo stays hardcoded to 5)
export const QUANTIZATION = {
  groove: 5,
};

/**
 * Converts time value to seconds.
 * 
 * @param {number} value - Time value
 * @param {string} unit - 'seconds', 'minutes', or 'hours'
 * @returns {number} Time in seconds
 */
export function convertToSeconds(value, unit) {
  const n = parseInt(value);
  if (isNaN(n) || n <= 0) return 0;
  if (unit === "minutes") return n * 60;
  if (unit === "hours") return n * 3600;
  return n;
}

/**
 * Clamps a value between min and max.
 * 
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped value
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Randomly selects a groove and BPM within specified ranges.
 * 
 * @param {string} groovesText - Newline-separated groove names
 * @param {number} bpmMin - Minimum BPM
 * @param {number} bpmMax - Maximum BPM
 * @returns {{bpm: number, groove: string}} Random groove and BPM
 * @example
 * const result = randomizeGroove('Rock\nFunk\nJazz', 60, 120);
 * // { bpm: 85, groove: 'Funk' }
 */
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

  const step = sanitizeQuantizationStep(QUANTIZATION.groove);

  // Quantize bpmMin and bpmMax to nearest valid multiples of step
  bpmMin = Math.ceil(bpmMin / step) * step;
  bpmMax = Math.floor(bpmMax / step) * step;

  // SAFETY NET — fixes empty BPM edge case near upper limit
  if (bpmMin > bpmMax) {
    bpmMin = Math.max(0, bpmMax - step);
  }

  // Ensure at least one quantization step difference
  if (bpmMax - bpmMin < step) {
    bpmMax = bpmMin + step;
    debugLog(
      "state",
      `⚠️ Adjusted BPM range to maintain at least one quantization step: ${bpmMin}-${bpmMax}`
    );
  }

  // Prevent exceeding hard max limit
  bpmMax = Math.min(bpmMax, 300);

  // Choose random BPM from valid quantized values
  const possibleBPMs = [];
  for (let bpm = bpmMin; bpm <= bpmMax; bpm += step) {
    possibleBPMs.push(bpm);
  }

  const randomBpm = pickRandom(possibleBPMs);

  const randomGroove =
    grooves.length > 0
      ? grooves[Math.floor(Math.random() * grooves.length)]
      : "No groove selected";

  debugLog(
    "state",
    `🎲 Groove randomizer → BPM: ${randomBpm}, Range: ${bpmMin}-${bpmMax}, Step: ${step}`
  );
  return { bpm: randomBpm, groove: randomGroove };
}

/**
 * Picks a random element from an array.
 * 
 * @param {Array} arr - Array to pick from
 * @returns {*} Random element or empty string if invalid
 */
export function pickRandom(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return "";
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Extracts a random groove name from multiline text.
 * 
 * @param {string} groovesText - Newline-separated groove names
 * @returns {string} Random groove name
 */
export function getGrooveNameFromText(groovesText) {
  if (!groovesText) return "No groove selected";

  // Split and sanitize
  const grooves = groovesText
    .split("\n")
    .map((g) => g.trim())
    .filter(Boolean);

  // Pick one at random
  const grooveName = pickRandom(grooves);

  return grooveName || "No groove selected";
}

/**
 * Formats seconds as human-readable time string.
 * 
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted time (e.g., '1h 23m 45s')
 * @example
 * formatTime(300); // '5m 0s'
 * formatTime(3665); // '1h 1m 5s'
 */
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

/**
 * Generates a unique color based on version string.
 * 
 * @param {string} version - Version string (e.g., 'v1.2.3')
 * @returns {string} Hex color code
 */
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

/**
 * Calculates BPM from tap timing (maintains internal state).
 * Resets after 1.5s idle.
 * 
 * @returns {number|null} Calculated BPM or null if <2 taps
 * @example
 * const bpm = calculateTapTempo(); // 120
 */
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

  // Tap tempo always uses fixed step=5 (rhythm-based)
  bpm = Math.round(bpm / TAP_TEMPO_QUANTIZATION) * TAP_TEMPO_QUANTIZATION;
  bpm = Math.max(BPM_HARD_LIMITS.MIN, Math.min(BPM_HARD_LIMITS.MAX, bpm));

  return bpm;
}

// =============================================================
// Input Sanitization Helpers
// =============================================================

/**
 * Sanitizes value to positive integer.
 * 
 * @param {string|number} value - Value to sanitize
 * @param {Object} options - Options object
 * @param {number} [options.min=1] - Minimum value
 * @param {number} [options.max=Infinity] - Maximum value
 * @param {number} [options.defaultValue=min] - Fallback value
 * @returns {number} Sanitized positive integer
 */
export function sanitizePositiveInteger(
  value,
  { min = 1, max = Infinity, defaultValue = min } = {}
) {
  if (typeof value === "string") value = value.trim();
  if (value === "" || value === null || value === undefined)
    return defaultValue;

  // Accept only whole nonzero positive numbers
  const regex = /^[1-9]\d*$/;
  if (!regex.test(value)) return defaultValue;

  let num = Number(value);
  if (Number.isNaN(num)) return defaultValue;
  if (num < min) return min;
  if (num > max) return max;
  return num;
}

/**
 * Sanitizes and quantizes BPM range.
 * 
 * @param {number} bpmMin - Minimum BPM
 * @param {number} bpmMax - Maximum BPM
 * @param {number} quantizationStep - Quantization step
 * @returns {{bpmMin: number, bpmMax: number, step: number}} Sanitized range
 * @example
 * const result = sanitizeBpmRange(32, 248, 5);
 * // { bpmMin: 35, bpmMax: 245, step: 5 }
 */
export function sanitizeBpmRange(bpmMin, bpmMax, quantizationStep) {
  // Use provided step, fallback to user preference, fallback to constant
  const step = quantizationStep || getUserQuantizationPreference();

  bpmMin = parseInt(bpmMin);
  bpmMax = parseInt(bpmMax);

  if (isNaN(bpmMin)) bpmMin = BPM_HARD_LIMITS.MIN;
  if (isNaN(bpmMax)) bpmMax = BPM_HARD_LIMITS.MAX;
  if (bpmMin > bpmMax) [bpmMin, bpmMax] = [bpmMax, bpmMin];

  // Quantize to step
  bpmMin = Math.ceil(bpmMin / step) * step;
  bpmMax = Math.floor(bpmMax / step) * step;

  if (bpmMin > bpmMax) bpmMin = Math.max(BPM_HARD_LIMITS.MIN, bpmMax - step);

  if (bpmMax - bpmMin < step) {
    bpmMax = bpmMin + step;
    debugLog(
      "state",
      `⚠️ Adjusted BPM range to maintain at least one quantization step: ${bpmMin}-${bpmMax}`
    );
  }

  // Enforce hard limits
  bpmMin = Math.max(BPM_HARD_LIMITS.MIN, bpmMin);
  bpmMax = Math.min(BPM_HARD_LIMITS.MAX, bpmMax);

  return { bpmMin, bpmMax, step };
}
