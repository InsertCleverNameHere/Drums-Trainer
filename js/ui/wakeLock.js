/**
 * @fileoverview Screen Wake Lock management for preventing screen dimming during practice.
 * Handles wake lock lifecycle, visibility change reacquisition, and state persistence.
 * Provides visual feedback via glow effect on settings trigger button.
 *
 * @module ui/wakeLock
 * @requires debug
 */

import { debugLog } from "../debug.js";

/**
 * Wake lock state object.
 *
 * @typedef {Object} WakeLockState
 * @property {boolean} enabled - Whether wake lock is enabled (user preference)
 * @property {boolean} active - Whether wake lock is currently held
 * @property {WakeLockSentinel|null} sentinel - Wake lock sentinel object (if active)
 * @property {number} retryCount - Number of reacquisition attempts
 * @private
 */

/**
 * Internal wake lock state.
 *
 * @type {WakeLockState}
 * @private
 */
let wakeLockState = {
  enabled: false,
  active: false,
  sentinel: null,
  retryCount: 0,
};

/**
 * Maximum number of reacquisition attempts on failure.
 *
 * @constant {number}
 * @private
 */
const MAX_RETRY_ATTEMPTS = 3;

/**
 * Base retry delay in milliseconds (doubles with each attempt).
 *
 * @constant {number}
 * @private
 */
const BASE_RETRY_DELAY_MS = 1000;

/**
 * localStorage key for wake lock preference.
 *
 * @constant {string}
 * @private
 */
const STORAGE_KEY = "wakeLockEnabled";

/**
 * Internal handler for system-initiated releases (e.g., Alt-Tab, low battery).
 * Defined separately so it can be removed during manual release to prevent double logging.
 *
 * @private
 */
function handleSystemRelease() {
  debugLog("state", "🔓 Wake lock released by system");
  wakeLockState.active = false;
  wakeLockState.sentinel = null;
}

/**
 * Initializes the wake lock system and restores previous state from localStorage.
 * Attaches visibility change handler for auto-reacquisition on tab focus.
 * Hides toggle UI if browser doesn't support Screen Wake Lock API.
 *
 * @returns {void}
 */
export function initWakeLock() {
  // Check browser support
  if (!isWakeLockSupported()) {
    debugLog("state", "⚠️ Wake Lock API not supported in this browser");
    hideWakeLockUI();
    return;
  }

  // Get UI elements
  const toggle = document.getElementById("wakeLockToggle");
  const trigger = document.getElementById("settingsTrigger");

  if (!toggle || !trigger) {
    debugLog("state", "⚠️ Wake lock UI elements not found in DOM");
    return;
  }

  // Restore state from localStorage
  const stored = localStorage.getItem(STORAGE_KEY);
  wakeLockState.enabled = stored === "true";

  // Update UI
  toggle.checked = wakeLockState.enabled;

  // Acquire wake lock if enabled
  if (wakeLockState.enabled) {
    enableWakeLock();
  }

  // Attach event listeners
  toggle.addEventListener("change", handleToggleChange);
  document.addEventListener("visibilitychange", handleVisibilityChange);

  debugLog(
    "state",
    `🔒 Wake lock initialized (enabled: ${wakeLockState.enabled})`
  );
}

/**
 * Acquires screen wake lock to prevent display from sleeping.
 * Auto-retries on failure with exponential backoff (max 3 attempts).
 * Updates glow indicator on success.
 *
 * @returns {Promise<boolean>} True if wake lock acquired successfully, false otherwise
 */
export async function enableWakeLock() {
  if (!isWakeLockSupported()) return false;

  try {
    wakeLockState.sentinel = await navigator.wakeLock.request("screen");
    wakeLockState.active = true;
    wakeLockState.enabled = true;
    wakeLockState.retryCount = 0;

    // Persist preference
    localStorage.setItem(STORAGE_KEY, "true");

    // Attach the named listener for system releases
    wakeLockState.sentinel.addEventListener("release", handleSystemRelease);

    debugLog("state", "🔒 Wake lock acquired");
    return true;
  } catch (err) {
    debugLog("state", `⚠️ Wake lock acquisition failed: ${err.message}`);
    wakeLockState.active = false;
    wakeLockState.sentinel = null;

    // Retry with exponential backoff
    if (wakeLockState.retryCount < MAX_RETRY_ATTEMPTS) {
      return await reacquireWithRetry(wakeLockState.retryCount);
    }

    return false;
  }
}

/**
 * Releases the active wake lock and updates UI state.
 * Removes glow indicator from settings trigger button.
 * Prevents double logging by removing the system release listener first.
 *
 * @returns {void}
 */
export function disableWakeLock() {
  if (wakeLockState.sentinel) {
    // Remove the listener BEFORE releasing to prevent "released by system" log
    wakeLockState.sentinel.removeEventListener("release", handleSystemRelease);

    wakeLockState.sentinel.release();
    wakeLockState.sentinel = null;
  }

  wakeLockState.active = false;
  wakeLockState.enabled = false;
  wakeLockState.retryCount = 0;

  // Persist preference
  localStorage.setItem(STORAGE_KEY, "false");

  debugLog("state", "🔓 Wake lock released");
}

/**
 * Checks if the Screen Wake Lock API is supported in the current browser.
 *
 * @returns {boolean} True if API is available, false otherwise
 */
export function isWakeLockSupported() {
  return "wakeLock" in navigator;
}

/**
 * Returns the current wake lock state.
 *
 * @returns {boolean} True if wake lock is currently active, false otherwise
 */
export function isWakeLockActive() {
  return wakeLockState.active;
}

/**
 * Handles tab visibility changes to reacquire wake lock when tab becomes visible.
 * Automatically releases when tab is hidden (browser behavior).
 * Only reacquires if wake lock is enabled in user preferences.
 *
 * @private
 * @returns {void}
 */
function handleVisibilityChange() {
  if (document.visibilityState === "visible" && wakeLockState.enabled) {
    if (!wakeLockState.active) {
      debugLog("state", "🔄 Tab visible - reacquiring wake lock");
      enableWakeLock();
    }
  }
}

/**
 * Handles wake lock toggle checkbox change events.
 * Enables or disables wake lock based on checkbox state.
 *
 * @private
 * @param {Event} event - Change event from checkbox
 * @returns {void}
 */
function handleToggleChange(event) {
  const isChecked = event.target.checked;

  if (isChecked) {
    enableWakeLock();
  } else {
    disableWakeLock();
  }
}

/**
 * Attempts to reacquire wake lock with exponential backoff on failure.
 * Uses doubling delay strategy: 1s, 2s, 4s for retry attempts.
 *
 * @private
 * @param {number} retryCount - Current retry attempt (0-based)
 * @returns {Promise<boolean>} Success/failure of reacquisition
 */
async function reacquireWithRetry(retryCount) {
  wakeLockState.retryCount = retryCount + 1;
  const delay = BASE_RETRY_DELAY_MS * Math.pow(2, retryCount);

  debugLog(
    "state",
    `⏳ Retrying wake lock acquisition in ${delay}ms (attempt ${wakeLockState.retryCount}/${MAX_RETRY_ATTEMPTS})`
  );

  await new Promise((resolve) => setTimeout(resolve, delay));

  return enableWakeLock();
}

/**
 * Hides wake lock toggle UI when browser doesn't support the API.
 * Removes toggle from settings dialog to avoid confusion.
 *
 * @private
 * @returns {void}
 */
function hideWakeLockUI() {
  const toggle = document.getElementById("wakeLockToggle");
  if (toggle) {
    const settingsGroup = toggle.closest(".settings-group");
    if (settingsGroup) {
      settingsGroup.style.display = "none";
    }
  }
}
