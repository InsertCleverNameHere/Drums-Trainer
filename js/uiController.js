/* eslint-disable no-unused-vars */
/**
 * @fileoverview Main UI controller - orchestrates UI modules and handles footer/updates.
 * Imports and initializes all UI submodules (theme, hotkeys, sliders, controls, panels).
 *
 * @module uiController
 */

import * as audioProfiles from "./audioProfiles.js";
import { VISUAL_TIMING } from "./constants.js";
import * as sessionEngine from "./sessionEngine.js";
import * as simpleMetronome from "./simpleMetronome.js";
import * as utils from "./utils.js";
import { debugLog } from "./debug.js";

// Import UI submodules
import { initDarkMode } from "./ui/theme.js";
import { setupHotkeys } from "./ui/hotkeys.js";
import { initSliders, updateBpmInputSteps, showNotice } from "./ui/sliders.js";
import {
  initSoundProfileUI,
  initPanningModeUI,
  initTimeSignatureUI,
} from "./ui/controls.js";
import { initModeTabs, initSimplePanelControls } from "./ui/panels.js";
import {
  initAdvancedMode,
  restoreDefaults,
  isAdvancedMode,
  getQuantizationStep,
} from "./ui/advancedMode.js";

// Re-export for external use
export { initDarkMode, showNotice, updateBpmInputSteps };
export { initSoundProfileUI, initPanningModeUI, initTimeSignatureUI };
export { initModeTabs, initSimplePanelControls };
export {
  initAdvancedMode,
  restoreDefaults,
  isAdvancedMode,
  getQuantizationStep,
};

/**
 * Initializes ownership guards to prevent mode conflicts.
 * Prevents Groove Start button from running when Simple owns playback.
 *
 * @returns {void}
 *
 * @example
 * initOwnershipGuards(); // Sets up ownership prevention
 */
export function initOwnershipGuards() {
  const startBtn = document.getElementById("startBtn");
  if (!startBtn) {
    debugLog("state", "⚠️ Start button not found for ownership guard");
    return;
  }

  startBtn.addEventListener(
    "click",
    (ev) => {
      const owner =
        typeof sessionEngine.getActiveModeOwner === "function"
          ? sessionEngine.getActiveModeOwner()
          : null;

      if (owner && owner !== "groove") {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        debugLog(
          "ownership",
          `🚫 Cannot start Groove metronome — current owner: ${owner}`
        );
        return;
      }
    },
    { capture: true }
  );
}

/**
 * Initializes main UI with metronome dependencies.
 * Wires up session controls, tooltips, and simple metronome UI sync.
 *
 * @param {Object} deps - Metronome core functions
 * @param {Function} deps.startMetronome - Start metronome
 * @param {Function} deps.stopMetronome - Stop metronome
 * @param {Function} deps.pauseMetronome - Pause metronome
 * @param {Function} deps.resumeMetronome - Resume metronome
 * @param {Function} deps.getPauseState - Get pause state
 * @param {Function} deps.requestEndOfCycle - Request end of cycle
 * @param {Function} deps.performCountIn - Perform count-in
 * @returns {Object} Session state API
 *
 * @example
 * initUI({
 *   startMetronome: metronome.startMetronome,
 *   stopMetronome: metronome.stopMetronome,
 *   // ...
 * });
 */
export function initUI(deps) {
  // Store dependencies (unused but kept for compatibility)
  const _deps = deps;

  // DOM elements
  const startBtn = document.getElementById("startBtn");
  const nextBtn = document.getElementById("nextBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const tooltipTrigger = document.getElementById("tooltipTrigger");
  const tooltipDialog = document.getElementById("tooltipDialog");

  pauseBtn.disabled = true;
  nextBtn.disabled = true;

  // Wire up session buttons
  startBtn.onclick = () => sessionEngine.startSession();
  pauseBtn.onclick = () => sessionEngine.pauseSession();
  nextBtn.onclick = () => sessionEngine.nextCycle();

  const settingsTrigger = document.getElementById("settingsTrigger");
  const settingsDialog = document.getElementById("settingsDialog");

  /**
   * Toggles settings dialog visibility.
   * 10s auto-hide timer only starts when pointer leaves the dialog.
   */

  function toggleSettings() {
    const isVisible = settingsDialog.classList.contains("visible");
    if (isVisible) {
      settingsDialog.classList.remove("visible");
      clearTimeout(settingsDialog._hideTimer);
    } else {
      settingsDialog.classList.add("visible");
      clearTimeout(settingsDialog._hideTimer);
      startSettingsHideTimer(); // Start timer immediately on open
    }
  }

  function startSettingsHideTimer() {
    clearTimeout(settingsDialog._hideTimer);
    settingsDialog._hideTimer = setTimeout(() => {
      settingsDialog.classList.remove("visible");
    }, 10000); // 10 seconds
  }

  function cancelSettingsHideTimer() {
    clearTimeout(settingsDialog._hideTimer);
  }

  document.addEventListener("toggleSettings", toggleSettings);

  if (settingsTrigger) {
    settingsTrigger.addEventListener("click", (ev) => {
      ev.stopPropagation();
      toggleSettings();
    });
  }

  // Start timer when pointer leaves the dialog
  if (settingsDialog) {
    // Cancel timer if pointer enters or touch starts inside dialog
    settingsDialog.addEventListener("pointerenter", (ev) => {
      cancelSettingsHideTimer();
    });
    settingsDialog.addEventListener("touchstart", (ev) => {
      cancelSettingsHideTimer();
    });
    // Restart timer if pointer leaves or touch ends outside dialog
    settingsDialog.addEventListener("pointerleave", (ev) => {
      if (settingsDialog.classList.contains("visible")) {
        startSettingsHideTimer();
      }
    });
    settingsDialog.addEventListener("touchend", (ev) => {
      if (settingsDialog.classList.contains("visible")) {
        startSettingsHideTimer();
      }
    });
  }

  // Close settings on outside click
  document.addEventListener("click", (event) => {
    if (!settingsDialog || !settingsTrigger) return;
    if (
      settingsDialog.contains(event.target) ||
      settingsTrigger.contains(event.target)
    )
      return;
    settingsDialog.classList.remove("visible");
    clearTimeout(settingsDialog._hideTimer);
  });

  const helpAccordion = document.getElementById("helpAccordion");
  if (helpAccordion) {
    const summary = helpAccordion.querySelector("summary");
    const contentItems = helpAccordion.querySelectorAll(
      ".details-content-wrapper > *"
    );

    summary.addEventListener("click", () => {
      // Check state BEFORE the attribute actually toggles
      const isOpening = !helpAccordion.hasAttribute("open");
      // KILL existing tweens to prevent state-clashing
      gsap.killTweensOf(contentItems);

      if (isOpening) {
        gsap.fromTo(
          contentItems,
          { opacity: 0, y: 10 },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            stagger: 0.05,
            ease: "power2.out",
            delay: 0.1, // Wait for the drawer to begin opening
          }
        );
      } else {
        gsap.to(contentItems, { opacity: 0, duration: 0.2, ease: "power2.in" });
      }
    });
  }
}

/**
 * Initializes the Audio Privacy (Mute) buttons across both panels.
 * Synchronizes state between buttons and reflects current localStorage preference.
 */
export function initMuteControl() {
  const muteBtns = document.querySelectorAll(".mute-toggle-btn");
  if (muteBtns.length === 0) return;

  /**
   * Updates all mute button icons and classes based on the current state.
   * @param {boolean} muted
   */
  const updateMuteUI = (muted) => {
    // Synchronize HTML attribute for the CSS engine
    if (muted) {
      document.documentElement.setAttribute("data-audio-muted", "true");
    } else {
      document.documentElement.removeAttribute("data-audio-muted");
    }

    muteBtns.forEach((btn) => {
      // We no longer strictly need the .muted class on the button itself,
      // but keeping it for potential CSS transitions or specific overrides
      btn.classList.toggle("muted", muted);
    });
  };

  // 1. Initial Sync: Reflect saved preference immediately on load
  updateMuteUI(audioProfiles.isMuted());

  // 2. Wire Clicks: Toggle state and sync all buttons
  muteBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent any parent click events

      const isCurrentlyMuted = audioProfiles.isMuted();
      const newState = !isCurrentlyMuted;

      // Update the logic/storage
      audioProfiles.setMuted(newState);

      // Update all buttons in the UI
      updateMuteUI(newState);

      debugLog(
        "state",
        `🔊 Audio Privacy toggled: ${newState ? "MUTED" : "UNMUTED"}`
      );
    });
  });
}

/**
 * Executes a synchronized vertical reel (slide + fade) for text updates.
 * @param {HTMLElement|HTMLElement[]} elements - Target element(s)
 * @param {string|string[]} newTexts - Content to apply
 */
export function animateTextUpdate(elements, newTexts) {
  const targets = Array.isArray(elements) ? elements : [elements];
  const contents = Array.isArray(newTexts) ? newTexts : [newTexts];

  gsap.killTweensOf(targets);
  const tl = gsap.timeline();

  tl.to(targets, {
    opacity: 0,
    y: -10,
    duration: 0.15,
    ease: "power2.in",
    onComplete: () => {
      targets.forEach((el, i) => {
        el.textContent = contents[i];
      });
      gsap.set(targets, { y: 10 });
    },
  }).to(targets, {
    opacity: 1,
    y: 0,
    duration: 0.3,
    ease: "power2.out",
    clearProps: "transform",
  });
}

/**
 * Updates footer with version message and hierarchical color animation.
 *
 * @param {HTMLElement} footerEl - Footer element
 * @param {string} appVersion - App version (e.g., 'v8.1.0')
 * @param {string|null} [previousVersion=null] - Previous version for color comparison
 * @param {string} [status='✅ Cached Offline'] - Status message
 * @returns {void}
 *
 * @example
 * updateFooterMessage(footerEl, 'v8.1.1', 'v8.1.0', 'Update Available');
 */
export function updateFooterMessage(
  footerEl,
  appVersion,
  previousVersion = null,
  status = "✅ Cached Offline"
) {
  if (!footerEl) footerEl = document.getElementById("VersionNumber");
  if (!footerEl) return;

  const messageKey = (s) =>
    s && s.includes("Update") ? "updateMsgCount" : "cachedMsgCount";

  const key = messageKey(status);
  const shownCount = parseInt(localStorage.getItem(key)) || 0;
  const suppressMessage = shownCount >= 3;

  // Generate styled version HTML with hierarchical colors
  const styledVersion = utils.getStyledVersionHTML(
    appVersion,
    previousVersion,
    true
  );

  const fullText = suppressMessage
    ? `🎵 Random Groove Trainer v${styledVersion}`
    : `🎵 Random Groove Trainer — ${status} v${styledVersion}`;

  footerEl.innerHTML = fullText;

  // Fade-in animation (existing logic)
  footerEl.style.opacity = "0";
  footerEl.style.visibility = "hidden";
  footerEl.style.transition = "opacity 1.2s ease";
  void footerEl.offsetWidth;
  footerEl.style.visibility = "visible";
  footerEl.style.opacity = "0.9";

  // Fade-out after display duration (existing logic)
  setTimeout(() => {
    footerEl.style.opacity = "0";
    setTimeout(() => {
      footerEl.classList.add("footer-hidden");
      footerEl.style.visibility = "hidden";
    }, VISUAL_TIMING.FOOTER_FADE_OUT_MS);
  }, VISUAL_TIMING.FOOTER_DISPLAY_MS);

  if (!suppressMessage) {
    localStorage.setItem(key, shownCount + 1);
  }
}

/**
 * Initializes update UI (check updates button and footer interactions).
 *
 * @returns {void}
 *
 * @example
 * initUpdateUI(); // Sets up update checking
 */
export function initUpdateUI() {
  const checkUpdatesBtn = document.getElementById("checkUpdatesBtn");
  const footerEl = document.getElementById("VersionNumber");
  if (!footerEl || !checkUpdatesBtn) return;

  // Hide footer when clicking outside
  document.addEventListener("click", (event) => {
    if (!footerEl || footerEl.classList.contains("footer-hidden")) return;
    const clickedElement = event.target;
    if (clickedElement.id === "checkUpdatesBtn") return;
    footerEl.style.opacity = "0";
    setTimeout(() => {
      footerEl.classList.add("footer-hidden");
      footerEl.style.visibility = "hidden";
    }, VISUAL_TIMING.FOOTER_FADE_OUT_MS);
  });

  // Check updates button
  checkUpdatesBtn.addEventListener("click", () => {
    const start = performance.now();
    let spinnerShown = false;

    // Offline detection
    if (!navigator.onLine) {
      footerEl.innerHTML = `⚠️ You're offline — cannot check for updates`;
      footerEl.style.opacity = "0";
      footerEl.style.visibility = "hidden";
      void footerEl.offsetWidth;
      footerEl.style.visibility = "visible";
      footerEl.style.opacity = "0.9";

      setTimeout(() => {
        footerEl.style.opacity = "0";
        setTimeout(() => {
          footerEl.classList.add("footer-hidden");
          footerEl.style.visibility = "hidden";
        }, VISUAL_TIMING.FOOTER_FADE_OUT_MS);
      }, VISUAL_TIMING.FOOTER_DISPLAY_MS);
      return;
    }

    // Show spinner if fetch takes longer than 300ms
    const spinnerTimeout = setTimeout(() => {
      checkUpdatesBtn.classList.add("loading");
      spinnerShown = true;
    }, 300);

    fetch("./commits.json", { cache: "no-store" })
      .then((res) => res.json())
      .then(({ latestHash, version }) => {
        clearTimeout(spinnerTimeout);

        const finish = () => {
          const storedHash = localStorage.getItem("lastSeenHash");
          const storedVersion = localStorage.getItem("lastSeenVersion");
          const isNewVersion =
            version !== storedVersion || latestHash !== storedHash;

          if (isNewVersion) {
            localStorage.setItem("lastSeenVersion", version);
            localStorage.setItem("lastSeenHash", latestHash);

            footerEl.innerHTML = `⟳ Update available — refreshing shortly...
              <button id="cancelReloadBtn" class="update-button">Cancel</button>`;

            footerEl.style.opacity = "0";
            footerEl.style.visibility = "hidden";
            void footerEl.offsetWidth;
            footerEl.style.visibility = "visible";
            footerEl.style.opacity = "0.9";

            const reloadTimeout = setTimeout(() => {
              location.reload();
            }, 5000);

            const cancelBtn = document.getElementById("cancelReloadBtn");
            if (cancelBtn) {
              cancelBtn.addEventListener("click", () => {
                clearTimeout(reloadTimeout);
                footerEl.innerHTML = `⟳ Update available — refresh canceled`;
                setTimeout(() => {
                  footerEl.style.opacity = "0";
                  setTimeout(() => {
                    footerEl.classList.add("footer-hidden");
                    footerEl.style.visibility = "hidden";
                  }, VISUAL_TIMING.FOOTER_FADE_OUT_MS);
                }, VISUAL_TIMING.FOOTER_CANCELED_DISPLAY_MS);
              });
            }
          } else {
            footerEl.innerHTML = `⟳ You're already on the latest version`;
            footerEl.style.opacity = "0";
            footerEl.style.visibility = "hidden";
            void footerEl.offsetWidth;
            footerEl.style.visibility = "visible";
            footerEl.style.opacity = "0.9";

            setTimeout(() => {
              footerEl.style.opacity = "0";
              setTimeout(() => {
                footerEl.classList.add("footer-hidden");
                footerEl.style.visibility = "hidden";
              }, VISUAL_TIMING.FOOTER_FADE_OUT_MS);
            }, VISUAL_TIMING.FOOTER_DISPLAY_MS);
          }

          if (spinnerShown) {
            setTimeout(() => {
              checkUpdatesBtn.classList.remove("loading");
            }, 300);
          }
        };

        if (spinnerShown) {
          setTimeout(finish, 300);
        } else {
          finish();
        }
      })
      .catch((err) => {
        clearTimeout(spinnerTimeout);
        debugLog("state", `⚠️ Manual update check failed: ${err.message}`);

        const showError = () => {
          footerEl.innerHTML = `⚠️ Could not check for updates — network error`;
          footerEl.style.opacity = "0";
          footerEl.style.visibility = "hidden";
          void footerEl.offsetWidth;
          footerEl.style.visibility = "visible";
          footerEl.style.opacity = "0.9";

          setTimeout(() => {
            footerEl.style.opacity = "0";
            setTimeout(() => {
              footerEl.classList.add("footer-hidden");
              footerEl.style.visibility = "hidden";
            }, VISUAL_TIMING.FOOTER_FADE_OUT_MS);
          }, VISUAL_TIMING.FOOTER_DISPLAY_MS);

          if (spinnerShown) {
            setTimeout(() => {
              checkUpdatesBtn.classList.remove("loading");
            }, 300);
          }
        };

        if (spinnerShown) {
          setTimeout(showError, 300);
        } else {
          showError();
        }
      });
  });
}

// Initialize all UI submodules
export function initAllUI() {
  setupHotkeys();
  initSliders();
}
