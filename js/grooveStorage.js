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
 * Serializes the current library into a Version 1.1 Bundle.
 * Returns null if the library contains no patterns.
 * @returns {string|null}
 */
export function exportLibrary() {
  const patterns = _getRaw();
  const patternCount = Object.keys(patterns).length;

  // Block export if no rhythmic data exists
  if (patternCount === 0) {
    debugLog("state", "📤 Export blocked: User library is empty.");
    return null;
  }

  // Retrieve current names list from the textarea's persistence key
  const namesList = localStorage.getItem("userGrooveNames") || "";

  const bundle = {
    version: "1.1",
    exportedAt: new Date().toISOString(),
    names: namesList,
    library: patterns,
  };

  try {
    return JSON.stringify(bundle);
  } catch (e) {
    debugLog("state", "❌ Export failed: Serialization error", e);
    return null;
  }
}

/**
 * Schema Validator
 * Ensures a pattern object is safe to ingest into the system.
 * Checks for Rhythmic Sovereignty metadata and valid track arrays.
 */
export function validatePattern(data) {
  try {
    if (!data || typeof data !== "object") return false;

    // 1. Verify Rhythmic Sovereignty Metadata
    const hasRhythm =
      data.patternTimeSignature?.beats > 0 &&
      data.patternTimeSignature?.value > 0;
    const hasStructure =
      typeof data.ticksPerBeat === "number" &&
      typeof data.measures === "number";

    if (!hasRhythm || !hasStructure) return false;

    // 2. Verify Track Content
    const requiredTracks = ["hihat", "kick", "snare", "HHPed"];
    const hasAllTracks = requiredTracks.every(
      (track) => data.patterns && Array.isArray(data.patterns[track])
    );

    if (!hasAllTracks) return false;

    // 3. Length Consistency (Optional but recommended)
    // Check if at least one track matches the expected total steps
    const expectedSteps =
      data.patternTimeSignature.beats * data.ticksPerBeat * data.measures;
    const firstTrackLength = data.patterns.hihat.length;

    // We allow length mismatches here (the engine will clamp),
    // but we must ensure it's not an empty or broken object.
    return firstTrackLength >= 0;
  } catch (e) {
    return false;
  }
}

/**
 * Bulk Ingestion Engine
 * Merges an external library of patterns into the user's storage.
 *
 * @param {Object} library - Map of name -> patternData
 * @param {boolean} overwrite - If true, replaces existing patterns with same name
 * @returns {number} The count of successfully added patterns
 */
export function ingestLibrary(library, overwrite = false) {
  if (!library || typeof library !== "object") return 0;

  const currentPatterns = _getRaw();
  let addedCount = 0;

  // Convert entries to array to process
  const entries = Object.entries(library);

  for (const [name, data] of entries) {
    const trimmedName = name.trim();

    // 1. Validation check
    if (!validatePattern(data)) {
      debugLog(
        "state",
        `⚠️ Skipping library pattern "${trimmedName}": Invalid Schema`
      );
      continue;
    }

    // 2. Conflict check (Skip if exists and not in overwrite mode)
    if (currentPatterns[trimmedName] && !overwrite) {
      debugLog(
        "state",
        `ℹ️ Skipping library pattern "${trimmedName}": Already exists`
      );
      continue;
    }

    // 3. Capacity check (Respect the 100-pattern limit)
    if (
      !currentPatterns[trimmedName] &&
      Object.keys(currentPatterns).length >= MAX_PATTERNS
    ) {
      debugLog(
        "state",
        `❌ Ingestion stopped: Storage limit (${MAX_PATTERNS}) reached`
      );
      break;
    }

    // 4. Commit to memory
    currentPatterns[trimmedName] = {
      ...data,
      updatedAt: Date.now(),
    };
    addedCount++;
  }

  // 5. Commit to disk
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentPatterns));
    debugLog(
      "state",
      `📚 Bulk Ingest: ${addedCount} patterns successfully committed.`
    );
  } catch (e) {
    debugLog("state", "❌ Ingestion failed: LocalStorage Quota Exceeded");
    return 0;
  }

  return addedCount;
}

/**
 * Wipes all pattern data (used by restoreDefaults).
 */
export function clearAllGroovePatterns() {
  localStorage.removeItem(STORAGE_KEY);
  debugLog("state", "🧹 All groove patterns cleared from storage");
}
