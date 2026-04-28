/**
 * @fileoverview Data layer for user-defined groove patterns.
 * Handles localStorage persistence and 100-entry capacity.
 * @module grooveStorage
 */

import { debugLog } from "./debug.js";

const STORAGE_KEY = "userGroovePatterns";
const MAX_PATTERNS = 100;

/**
 * Internal helper to safely parse localStorage.
 * @private
 */
function _getRaw() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch (e) {
    debugLog("state", "⚠️ Failed to parse groove storage:", e);
    return {};
  }
}

/**
 * Retrieves a pattern by groove name.
 * @param {string} name
 * @returns {Object|null}
 */
export function getGroovePattern(name) {
  if (!name) return null;
  const patterns = _getRaw();
  return patterns[name.trim()] || null;
}

/**
 * Saves a groove pattern. Enforces 100-entry limit.
 * @param {string} name
 * @param {Object} data
 * @returns {{success: boolean, error: string|null}}
 */
export function setGroovePattern(name, data) {
  const patterns = _getRaw();
  const trimmedName = name.trim();

  // Cap Logic: If it's a NEW entry and we are at the limit, block it.
  if (!patterns[trimmedName] && Object.keys(patterns).length >= MAX_PATTERNS) {
    return { success: false, error: "FULL" };
  }

  patterns[trimmedName] = {
    ...data,
    updatedAt: Date.now(),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(patterns));
    return { success: true, error: null };
  } catch (e) {
    debugLog("state", "❌ QuotaExceededError in groove storage");
    return { success: false, error: "QUOTA_EXCEEDED" };
  }
}

/**
 * Deletes a saved pattern.
 * @param {string} name
 */
export function deleteGroovePattern(name) {
  if (!name) return;
  const patterns = _getRaw();
  delete patterns[name.trim()];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(patterns));
  debugLog("state", `🗑️ Deleted pattern: ${name}`);
}

export function hasGroovePattern(name) {
  return !!getGroovePattern(name);
}

export function getAllGrooveNames() {
  return Object.keys(_getRaw());
}

/**
 * Wipes all pattern data (used by restoreDefaults).
 */
export function clearAllGroovePatterns() {
  localStorage.removeItem(STORAGE_KEY);
  debugLog("state", "🧹 All groove patterns cleared from storage");
}
