/**
 * @fileoverview Global keyboard shortcuts and hotkey handling.
 * Manages Space, P, N, arrows, H hotkeys with owner-aware routing.
 *
 * @module ui/hotkeys
 */

import { debugLog } from "../debug.js";
import { VISUAL_TIMING, INPUT_LIMITS } from "../constants.js";
import * as sessionEngine from "../sessionEngine.js";
import * as simpleMetronome from "../simpleMetronome.js";
import { showNotice } from "./sliders.js";

// Hotkey state
let _hotkeyLock = false;
window.__adjustingTarget = window.__adjustingTarget || "min";

/**
 * Validates and updates numeric input with limits enforcement.
 *
 * @private
 * @param {HTMLInputElement} input - Input element to validate
 * @returns {void}
 */
function validateNumericInput(input) {
  const id = input.id;
  if (!(id in INPUT_LIMITS)) return;

  const limits = INPUT_LIMITS[id];
  const value = parseInt(input.value, 10);

  if (isNaN(value)) {
    input.value = limits.defaultValue;
    return;
  }

  const clamped = Math.max(limits.min, Math.min(limits.max, value));
  input.value = clamped;
  input.dataset.lastValidValue = clamped;
}

/**
 * Adjusts groove BPM input (min or max) by delta.
 * Enforces 5 BPM minimum margin between min/max.
 *
 * @private
 * @param {number} delta - Change amount (±1 for ±5 BPM)
 * @returns {void}
 */
function adjustGrooveInput(delta) {
  const bpmMinInput = document.getElementById("bpmMin");
  const bpmMaxInput = document.getElementById("bpmMax");
  const adj = window.__adjustingTarget === "max" ? bpmMaxInput : bpmMinInput;
  const other = window.__adjustingTarget === "max" ? bpmMinInput : bpmMaxInput;

  if (!adj || !other) return;

  const step = 5; // Always 5, no fine-tuning
  const cur = parseInt(adj.value, 10) || 0;
  const otherVal = parseInt(other.value, 10) || 0;
  const next = Math.max(30, Math.min(300, cur + delta * step));

  // Check if this change would violate the margin (5 BPM minimum)
  const margin = 5;
  if (window.__adjustingTarget === "min" && next >= otherVal - margin + 1) {
    return;
  }
  if (window.__adjustingTarget === "max" && next <= otherVal + margin - 1) {
    return;
  }

  // Apply validation and update the input
  adj.value = next;
  validateNumericInput(adj);

  // Trigger a change event to update the slider
  adj.dispatchEvent(new Event("change", { bubbles: true }));

  adj.classList.add("bpm-flash");
  setTimeout(
    () => adj.classList.remove("bpm-flash"),
    VISUAL_TIMING.FLASH_DURATION_MS
  );
}

/**
 * Adjusts simple metronome BPM by delta.
 *
 * @private
 * @param {number} delta - Change amount (±1 for ±5 BPM)
 * @returns {void}
 */
function adjustSimpleBpm(delta) {
  const el = document.getElementById("simpleBpm");
  if (!el) return;
  const cur = parseInt(el.value || el.getAttribute("value") || 120, 10) || 120;
  const step = 5; // Always 5, no fine-tuning
  const limits = INPUT_LIMITS[el.id];
  const next = Math.max(limits.min, Math.min(limits.max, cur + delta * step));
  el.value = next;

  if (
    typeof window.simpleMetronome !== "undefined" &&
    typeof window.simpleMetronome.setBpm === "function"
  ) {
    window.simpleMetronome.setBpm(next);
  } else if (
    typeof simpleMetronome !== "undefined" &&
    typeof simpleMetronome.setBpm === "function"
  ) {
    simpleMetronome.setBpm(next);
  }

  el.classList.add("bpm-flash");
  setTimeout(
    () => el.classList.remove("bpm-flash"),
    VISUAL_TIMING.BPM_CHANGE_FLASH_MS
  );
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * Determines target mode based on ownership and visible panels.
 *
 * @private
 * @returns {'groove'|'simple'} Target mode
 */
function decideTarget() {
  const owner =
    typeof sessionEngine.getActiveModeOwner === "function"
      ? sessionEngine.getActiveModeOwner()
      : null;

  // Owner wins
  if (owner === "groove") return "groove";
  if (owner === "simple") return "simple";

  // Fall back to visible panel
  const groovePanel = document.getElementById("panel-groove");
  const simplePanel = document.getElementById("panel-metronome");
  const grooveVisible =
    groovePanel && !groovePanel.classList.contains("hidden");
  const simpleVisible =
    simplePanel && !simplePanel.classList.contains("hidden");

  if (grooveVisible && !simpleVisible) return "groove";
  if (simpleVisible && !grooveVisible) return "simple";
  return "groove";
}

/**
 * Initializes global keyboard shortcuts.
 * Handles Space, P, N, arrows, H with owner-aware routing.
 *
 * @returns {void}
 *
 * @example
 * setupHotkeys(); // Registers keydown listener
 */
export function setupHotkeys() {
  window.addEventListener("keydown", (event) => {
    const active = document.activeElement;

    // Ignore if typing in input
    if (
      active &&
      (active.tagName === "INPUT" ||
        active.tagName === "TEXTAREA" ||
        active.isContentEditable)
    )
      return;

    const code = event.code;
    const allowRepeat = code === "ArrowUp" || code === "ArrowDown";
    if (event.repeat && !allowRepeat) return;

    const relevant = [
      "Space",
      "KeyP",
      "KeyN",
      "KeyH",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
    ];
    if (!relevant.includes(code)) return;

    // Hotkey lock for non-repeatable keys
    if (!allowRepeat) {
      if (_hotkeyLock) return;
      _hotkeyLock = true;
      setTimeout(() => (_hotkeyLock = false), VISUAL_TIMING.HOTKEY_LOCK_MS);
    }

    // Prevent default for navigation keys
    if (
      [
        "Space",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "KeyH",
      ].includes(code)
    )
      event.preventDefault();

    const owner =
      typeof sessionEngine.getActiveModeOwner === "function"
        ? sessionEngine.getActiveModeOwner()
        : null;

    const target = decideTarget();
    const grooveStartBtn = document.getElementById("startBtn");
    const grooveNextBtn = document.getElementById("nextBtn");

    debugLog(
      "hotkeys",
      `Key pressed: ${code}, owner: ${owner}, target: ${target}`
    );

    switch (code) {
      case "Space":
        debugLog("hotkeys", `Space pressed - ${target} mode`);
        if (target === "groove") {
          if (!grooveStartBtn || grooveStartBtn.disabled) break;
          grooveStartBtn.click();
        } else {
          (async () => {
            if (
              typeof simpleMetronome !== "undefined" &&
              typeof simpleMetronome.isRunning === "function" &&
              simpleMetronome.isRunning()
            ) {
              if (typeof simpleMetronome.stop === "function")
                simpleMetronome.stop();
            } else {
              const bpmEl = document.getElementById("simpleBpm");
              const bpm = bpmEl ? parseInt(bpmEl.value, 10) : null;
              if (bpm && typeof simpleMetronome.setBpm === "function")
                simpleMetronome.setBpm(bpm);
              if (typeof simpleMetronome.start === "function")
                await simpleMetronome.start();
            }
          })();
        }
        break;

      case "KeyP":
        debugLog("hotkeys", `P pressed - ${target} mode`);
        if (target === "groove") {
          if (typeof sessionEngine.pauseSession === "function")
            sessionEngine.pauseSession();
        } else {
          if (
            typeof simpleMetronome !== "undefined" &&
            typeof simpleMetronome.isPaused === "function" &&
            simpleMetronome.isPaused()
          ) {
            if (typeof simpleMetronome.resume === "function")
              simpleMetronome.resume();
          } else {
            if (
              typeof simpleMetronome !== "undefined" &&
              typeof simpleMetronome.pause === "function"
            )
              simpleMetronome.pause();
          }
        }
        break;

      case "KeyN":
        debugLog("hotkeys", `N pressed - ${target} mode`);
        if (grooveNextBtn && !grooveNextBtn.disabled) grooveNextBtn.click();
        break;

      case "KeyH":
        debugLog("hotkeys", `H pressed - ${target} mode`);
        document.dispatchEvent(new Event("toggleSettings"));
        break;

      case "ArrowRight":
      case "ArrowLeft": {
        // ✅ GUARD: Only allow target switching in Groove mode
        const groovePanel = document.getElementById("panel-groove");
        const isGrooveVisible =
          groovePanel && !groovePanel.classList.contains("hidden");

        if (!isGrooveVisible) {
          debugLog(
            "hotkeys",
            `⚠️ Left/Right arrow blocked - not in Groove mode`
          );
          return;
        }

        const newTarget = code === "ArrowRight" ? "max" : "min";
        window.__adjustingTarget = newTarget;
        debugLog(
          "hotkeys",
          `🎚️ Adjusting target: ${newTarget.toUpperCase()} BPM`
        );
        break;
      }

      case "ArrowUp":
      case "ArrowDown": {
        // ✅ GUARD: Block BPM changes during playback
        const owner = sessionEngine.getActiveModeOwner();
        if (owner) {
          debugLog("hotkeys", `⚠️ BPM adjustment blocked - ${owner} is active`);
          showNotice("⚠️ Cannot adjust BPM during playback");
          return;
        }

        const delta = code === "ArrowUp" ? +1 : -1;
        if (target === "groove") adjustGrooveInput(delta);
        else adjustSimpleBpm(delta);
        break;
      }
    }
  });
}
