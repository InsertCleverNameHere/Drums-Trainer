/* eslint-disable no-unused-vars */
/**
 * @fileoverview Main UI controller - orchestrates UI modules and handles footer/updates.
 * Imports and initializes all UI submodules (theme, hotkeys, sliders, controls, panels).
 *
 * @module uiController
 */

import * as audioProfiles from "./audioProfiles.js";
import { VISUAL_TIMING } from "./constants.js";
import * as metronome from "./metronomeCore.js";
import * as sessionEngine from "./sessionEngine.js";
import * as simpleMetronome from "./simpleMetronome.js";
import * as utils from "./utils.js";
import * as grooveStorage from "./grooveStorage.js";
import * as notices from "./ui/notices.js";
import * as interop from "./ui/interop.js";
import { patternScheduler } from "./patternScheduler.js";
import { getActiveModeOwner } from "./ownership.js";
import { debugLog } from "./debug.js";

// Import UI submodules
import { initDarkMode } from "./ui/theme.js";
import { setupHotkeys } from "./ui/hotkeys.js";
import { initSliders, updateBpmInputSteps } from "./ui/sliders.js";
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
export { initDarkMode, updateBpmInputSteps };
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
      const owner = getActiveModeOwner();
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
  startBtn.onclick = () => {
    if (interop.isPreviewActive()) {
      interop.togglePreviewPlayback();
    } else {
      sessionEngine.startSession();
    }
  };
  pauseBtn.onclick = () => sessionEngine.pauseSession();
  nextBtn.onclick = () => sessionEngine.nextCycle();

  const settingsTrigger = document.getElementById("settingsTrigger");
  const settingsDialog = document.getElementById("settingsDialog");

  /**
   * Toggles settings dialog visibility.
   * 10s auto-hide timer only starts when pointer leaves the dialog.
   */

  // ── Focus trap helpers ─────────────────────────────────────────────────────
  const FOCUSABLE_SELECTORS =
    'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]';

  function _getFocusableInDialog() {
    // Ensure we only find elements when the dialog is VISIBLE
    if (!settingsDialog.classList.contains("visible")) return [];

    return [...settingsDialog.querySelectorAll(FOCUSABLE_SELECTORS)].filter(
      (el) => !el.closest(".hidden") && el.offsetWidth > 0 // Ensure element is rendered
    );
  }

  function openSettings() {
    settingsDialog.classList.add("visible");
    settingsTrigger.setAttribute("aria-expanded", "true");
    clearTimeout(settingsDialog._hideTimer);
    startSettingsHideTimer();
    // Move focus to first focusable element inside dialog
    requestAnimationFrame(() => {
      const first = _getFocusableInDialog()[0];
      if (first) first.focus();
    });
  }

  function closeSettings() {
    settingsDialog.classList.remove("visible");
    settingsTrigger.setAttribute("aria-expanded", "false");
    clearTimeout(settingsDialog._hideTimer);
    // Return focus to the trigger that opened the dialog
    settingsTrigger.focus();
  }

  function toggleSettings() {
    settingsDialog.classList.contains("visible")
      ? closeSettings()
      : openSettings();
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
    // Keyboard activation: the trigger is a <div> with role=button, so Enter
    // and Space must be handled explicitly.
    settingsTrigger.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        toggleSettings();
      }
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
    // Only execute if the settings dialog is actually visible.
    // This prevents focus theft from dropdowns and other inputs.
    if (!settingsDialog.classList.contains("visible")) return;

    if (!settingsDialog || !settingsTrigger) return;
    if (
      settingsDialog.contains(event.target) ||
      settingsTrigger.contains(event.target)
    )
      return;
    closeSettings();
  });

  // Focus trap: Tab cycles within the dialog; Escape closes it.
  if (settingsDialog) {
    settingsDialog.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeSettings();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = _getFocusableInDialog();
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });
  }

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
  initSessionControlsUI();
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
 * Handles the animated transitions for the Session Command Center.
 * Manages tray expansion and cross-fading between parameter units.
 */
export function initSessionControlsUI() {
  const sessionMode = document.getElementById("sessionMode");
  const tray = document.getElementById("sessionDetailTray");
  const unitCycles = document.getElementById("unitTotalCycles");
  const unitTime = document.getElementById("unitTotalTime");

  if (!sessionMode || !tray || !unitCycles || !unitTime) return;

  let currentMode = sessionMode.value;

  const updateTray = (animate = true) => {
    const nextMode = sessionMode.value;
    const isInfinite = nextMode === "infinite";
    const toShow = nextMode === "cycles" ? unitCycles : unitTime;
    const toHide = nextMode === "cycles" ? unitTime : unitCycles;

    if (animate) {
      if (isInfinite) {
        // 1. Collapse the tray
        gsap.to(tray, {
          maxHeight: 0,
          opacity: 0,
          marginTop: 0,
          duration: 0.25,
          ease: "power2.in",
        });
      } else {
        // 2. Expand or Cross-fade
        const isOpening = currentMode === "infinite"; // If coming from infinite, we are opening the tray

        if (isOpening) {
          // If the tray was closed, snap content and slide open
          toHide.style.display = "none";
          toShow.style.display = "flex";
          toShow.style.opacity = "1";
          gsap.to(tray, {
            maxHeight: 120, // Enough room for the fixed 100px tray
            opacity: 1,
            marginTop: 10,
            duration: 0.25,
            ease: "expo.out",
          });
        } else {
          // If tray was already open, perform a cross-fade sequence
          gsap.killTweensOf([unitCycles, unitTime]);
          const tl = gsap.timeline();
          tl.to(toHide, {
            opacity: 0,
            y: -5,
            duration: 0.2,
            onComplete: () => {
              toHide.style.display = "none";
              toShow.style.display = "flex";
            },
          }).fromTo(
            toShow,
            { opacity: 0, y: 5 },
            { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" }
          );
        }
      }
    } else {
      // Instant update for initial load
      tray.style.maxHeight = isInfinite ? "0" : "120px";
      tray.style.opacity = isInfinite ? "0" : "1";
      tray.style.marginTop = isInfinite ? "0" : "10px";
      unitCycles.style.display = nextMode === "cycles" ? "flex" : "none";
      unitTime.style.display = nextMode === "time" ? "flex" : "none";
    }
    currentMode = nextMode;
  };

  sessionMode.addEventListener("change", () => updateTray(true));

  // Initial check (no animation on boot)
  updateTray(false);
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
    notices.clearNotice();
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

/**
 * Initializes all UI submodules (hotkeys, sliders, and interop).
 *
 * @returns {void}
 */
export function initAllUI() {
  setupHotkeys();
  initSliders();
  interop.initInteropUI();
}
