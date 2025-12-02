/**
 * @fileoverview Theme and quantization initialization module.
 * Handles dark mode toggle, system preference detection, and quantization setup.
 * 
 * @module ui/theme
 */

import { debugLog } from "../debug.js";
import { getUserQuantizationPreference } from "../constants.js";
import * as utils from "../utils.js";

/**
 * Gets the current quantization level with safety fallback.
 * 
 * @returns {number} Quantization level (default: 5)
 * 
 * @example
 * const level = getQuantizationLevel(); // 5
 */
export function getQuantizationLevel() {
  const q = window?.utils?.QUANTIZATION;
  if (!q || typeof q.groove !== "number" || q.groove <= 0) return 5;
  return q.groove;
}

/**
 * Initializes quantization with safety checks and auto-correction.
 * Creates global QUANTIZATION object if missing.
 * 
 * @returns {void}
 * 
 * @example
 * initQuantization(); // Sets up QUANTIZATION.groove
 */
export function initQuantization() {
  // Ensure QUANTIZATION object exists globally
  if (typeof window.QUANTIZATION === "undefined") {
    window.QUANTIZATION = { groove: 5 }; // default to a safe mid value
  }

  if (!window.QUANTIZATION)
    window.QUANTIZATION = { groove: getUserQuantizationPreference() };

  // Auto-correct using utils.sanitizeQuantizationStep
  const safeGroove = utils.sanitizeQuantizationStep(window.QUANTIZATION.groove);
  if (safeGroove !== window.QUANTIZATION.groove) {
    debugLog(
      "state",
      `⚠️ Corrected invalid QUANTIZATION.groove from ${window.QUANTIZATION.groove} → ${safeGroove}`
    );
    window.QUANTIZATION.groove = safeGroove;
  }
}

/**
 * Gets safe quantization settings with re-initialization fallback.
 * 
 * @returns {{groove: number}} Quantization settings object
 * 
 * @example
 * const settings = getSafeQuantization();
 * console.log(settings.groove); // 5
 */
export function getSafeQuantization() {
  // Re-initialize if the global object doesn't exist
  if (!window.QUANTIZATION) initQuantization();

  // Always sanitize and enforce the valid range
  const safeGroove = utils.sanitizeQuantizationStep(window.QUANTIZATION.groove);

  // If the sanitized value differs, fix it in place
  if (safeGroove !== window.QUANTIZATION.groove) {
    window.QUANTIZATION.groove = safeGroove;
    debugLog(
      "state",
      `⚠️ Quantization groove corrected to safe value: ${safeGroove}`
    );
  }

  return {
    groove: getUserQuantizationPreference(),
  };
}

/**
 * Initializes dark mode toggle with system preference detection and persistence.
 * Handles theme switching, localStorage sync, and system preference changes.
 * 
 * @returns {void}
 * 
 * @example
 * initDarkMode(); // Sets up theme toggle button
 */
export function initDarkMode() {
  const btn = document.querySelector(".theme-btn");
  const sunIcon = document.querySelector(".sun-svg");
  const moonIcon = document.querySelector(".moon-svg");

  if (!btn || !sunIcon || !moonIcon) {
    debugLog("state", "⚠️ Dark mode button elements not found in DOM");
    return;
  }

  // Detect system preference
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  // Check localStorage for saved preference
  const saved = localStorage.getItem("darkMode");

  // Determine initial state
  let isDark;
  if (saved === null) {
    // First visit - use system preference
    isDark = prefersDark;
    localStorage.setItem("darkMode", isDark ? "true" : "false");
  } else {
    isDark = saved === "true";
  }

  // Apply initial theme (inline script already set data-theme, just verify icons)
  document.documentElement.setAttribute(
    "data-theme",
    isDark ? "dark" : "light"
  );

  debugLog(
    "state",
    `🌙 Dark mode initialized: ${isDark ? "ON" : "OFF"} (${
      saved !== null ? "saved preference" : "system default"
    })`
  );

  // Click handler
  btn.addEventListener("click", () => {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const newIsDark = currentTheme !== "dark";

    // Add spin animation to active icon
    const activeIcon = newIsDark ? moonIcon : sunIcon;
    activeIcon.classList.add("animated");

    // Toggle theme
    document.documentElement.setAttribute(
      "data-theme",
      newIsDark ? "dark" : "light"
    );
    localStorage.setItem("darkMode", newIsDark ? "true" : "false");

    debugLog("state", `🌙 Dark mode toggled: ${newIsDark ? "ON" : "OFF"}`);

    // Remove animation after it completes
    setTimeout(() => {
      activeIcon.classList.remove("animated");
    }, 500);
  });

  // Listen for system preference changes
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", (e) => {
      // Only auto-switch if user hasn't manually set preference
      const saved = localStorage.getItem("darkMode");
      if (saved === null) {
        document.documentElement.setAttribute(
          "data-theme",
          e.matches ? "dark" : "light"
        );
        debugLog(
          "state",
          `🌙 Dark mode auto-switched to system preference: ${
            e.matches ? "ON" : "OFF"
          }`
        );
      }
    });
}

// Auto-run quantization after DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initQuantization);
} else {
  initQuantization();
}
