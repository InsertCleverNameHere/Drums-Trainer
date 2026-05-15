/**
 * @fileoverview Theme initialization module.
 * Handles dark mode toggle and system preference detection.
 *
 * @module ui/theme
 */

import { debugLog } from "../debug.js";

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

  btn.setAttribute(
    "aria-label",
    isDark ? "Switch to light mode" : "Switch to dark mode"
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

    btn.setAttribute(
      "aria-label",
      newIsDark ? "Switch to light mode" : "Switch to dark mode"
    );

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
