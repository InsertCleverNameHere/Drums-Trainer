/**
 * @fileoverview Global keyboard shortcuts and hotkey handling.
 * Manages Space, P, N, arrows, H hotkeys with owner-aware routing.
 *
 * @module ui/hotkeys
 */

import { debugLog } from "../debug.js";
import * as constants from "../constants.js";
import * as sessionEngine from "../sessionEngine.js";
import * as simpleMetronome from "../simpleMetronome.js";
import { showNotice } from "./notices.js";
import * as advancedMode from "./advancedMode.js";
import { getActiveModeOwner } from "../ownership.js";

// Hotkey state
let _hotkeyLock = false;

/**
 * Validates and updates numeric input with limits enforcement.
 *
 * @private
 * @param {HTMLInputElement} input - Input element to validate
 * @returns {void}
 */
function validateNumericInput(input) {
  const id = input.id;
  if (!(id in constants.LIMITS.INPUT)) return;

  const limits = constants.LIMITS.INPUT[id];
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
 * Triggers the accent-coloured flash overlay on the input cell.
 * Animates a sibling .bpm-flash-overlay div instead of the input itself,
 * because Firefox does not run @keyframes animations on replaced form
 * elements (input[type=number]).
 *
 * @private
 * @param {HTMLInputElement} inputEl
 */
function _triggerFlashOverlay(inputEl) {
  const overlay = inputEl.parentElement?.querySelector(".bpm-flash-overlay");
  if (!overlay) return;
  // Force a reflow so re-triggering the animation on rapid presses works.
  overlay.classList.remove("animating");
  void overlay.offsetWidth;
  overlay.classList.add("animating");
  overlay.addEventListener(
    "animationend",
    () => overlay.classList.remove("animating"),
    { once: true }
  );
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
  const target = advancedMode.getAdjustmentTarget();
  const adj = target === "max" ? bpmMaxInput : bpmMinInput;
  const other = target === "max" ? bpmMinInput : bpmMaxInput;

  if (!adj || !other) return;

  const step = advancedMode.isAdvancedMode()
    ? advancedMode.getQuantizationStep()
    : 5;
  const cur = parseInt(adj.value, 10) || 0;
  const otherVal = parseInt(other.value, 10) || 0;
  const next = Math.max(30, Math.min(300, cur + delta * step));

  // Check if this change would violate the margin constraint
  const margin = step; // margin always equals step
  if (
    advancedMode.getAdjustmentTarget() === "min" &&
    next >= otherVal - margin + 1
  ) {
    return;
  }
  if (
    advancedMode.getAdjustmentTarget() === "max" &&
    next <= otherVal + margin - 1
  ) {
    return;
  }

  // Apply validation and update the input
  adj.value = next;
  validateNumericInput(adj);

  // Trigger a change event to update the slider
  adj.dispatchEvent(new Event("change", { bubbles: true }));

  _triggerFlashOverlay(adj);
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
  const step = advancedMode.isAdvancedMode()
    ? advancedMode.getQuantizationStep()
    : 5;
  const limits = constants.LIMITS.INPUT[el.id];

  // In Advanced Mode clamp to the anchor-relative grid floor/ceiling so arrow
  // keys cannot overshoot into values that would be silently un-snapped on blur.
  // In Simple Mode use the hard limits unchanged.
  let effectiveMin = limits.min;
  let effectiveMax = limits.max;
  if (advancedMode.isAdvancedMode()) {
    const anchor = advancedMode.getSimpleBpmAnchor();
    effectiveMin = anchor + Math.ceil((limits.min - anchor) / step) * step;
    effectiveMax = anchor + Math.floor((limits.max - anchor) / step) * step;
  }

  const next = Math.max(
    effectiveMin,
    Math.min(effectiveMax, cur + delta * step)
  );
  if (next === cur) return; // already at grid boundary — do nothing
  el.value = next;

  simpleMetronome.setBpm(next);

  _triggerFlashOverlay(el);
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * Determines target mode based on ownership and visible panels.
 *
 * @private
 * @returns {'groove'|'simple'} Target mode
 */
function decideTarget() {
  const owner = getActiveModeOwner();
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
      setTimeout(() => (_hotkeyLock = false), constants.UX.DEBOUNCE.HOTKEY_MS);
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

    const owner = getActiveModeOwner();

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
          if (simpleMetronome.isRunning()) {
            simpleMetronome.stop();
          } else {
            const bpmEl = document.getElementById("simpleBpm");
            const bpm = bpmEl ? parseInt(bpmEl.value, 10) : 120;
            simpleMetronome.setBpm(bpm);
            simpleMetronome.start();
          }
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
        // ✅ GUARD: If focus is on a tab, let the tablist keydown handler take over
        if (document.activeElement?.getAttribute("role") === "tab") return;

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
        advancedMode.setAdjustmentTarget(newTarget);
        debugLog(
          "hotkeys",
          `🎚️ Adjusting target: ${newTarget.toUpperCase()} BPM`
        );
        break;
      }

      case "ArrowUp":
      case "ArrowDown": {
        // ✅ GUARD: Block BPM changes during playback
        const owner = getActiveModeOwner();
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
