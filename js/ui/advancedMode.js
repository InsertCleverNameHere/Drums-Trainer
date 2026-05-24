/**
 * @fileoverview Simple / Advanced Mode toggle, BPM step management,
 * and persistent settings chip row.
 *
 * Public API:
 *   initAdvancedMode()                          — call once on DOMContentLoaded, before sliders/sound/timesig
 *   isAdvancedMode()                            — returns current mode as boolean
 *   getQuantizationStep()                       — returns current BPM step (1–150)
 *   getGrooveAnchor()                           — returns "min" | "max" (randomizer grid direction)
 *   getSimpleBpmAnchor()                        — returns the current simpleBpm anchor value
 *   setSimpleBpmAnchor(v)                       — updates the simpleBpm anchor (called by sliders.js on blur)
 *   snapToGrid(value, step, anchor, min, max)   — snaps a value to the nearest anchor-relative grid point
 *   restoreDefaults()                           — clears localStorage and reloads
 *
 * @module ui/advancedMode
 */

import { debugLog, DEBUG } from "../debug.js";
import {
  BPM_STEP_LIMITS,
  getUserQuantizationPreference,
} from "../constants.js";
import * as utils from "../utils.js";

// ── Internal state ───────────────────────────────────────────────
let _advanced = false; // mirrors localStorage['advancedMode']
let _step = 5; // mirrors localStorage['bpmQuantizationStep']
let _grooveAnchor = "min"; // "min" | "max" — persisted; randomizer grid direction only
let _simpleBpmAnchor = 120; // NOT persisted — captured each time Advanced Mode is enabled
let _dashboardEnabled = true; // Persisted mode visual choice
let _adjustingTarget = "min"; // "min" | "max" | "simple" — set on adjust button press, read by hotkeys.js to know which field to move

// ── Public API ───────────────────────────────────────────────────

export function isAdvancedMode() {
  return _advanced;
}
export function getQuantizationStep() {
  return _step;
}

/** Returns the current groove grid direction: "min" (default) or "max". */
export function getGrooveAnchor() {
  return _grooveAnchor;
}

/**
 * Returns the current simpleBpm anchor value.
 * Captured from the DOM when Advanced Mode is enabled; updated after each
 * successful simpleBpm blur. Not persisted to localStorage.
 */
export function getSimpleBpmAnchor() {
  return _simpleBpmAnchor;
}

/**
 * Updates the simpleBpm anchor to a new value.
 * Called by sliders.js after a successful simpleBpm blur-and-snap.
 * @param {number} v - The new anchor value.
 */
export function setSimpleBpmAnchor(v) {
  if (!isNaN(v)) _simpleBpmAnchor = v;
}

/**
 * Snaps a value to the nearest anchor-relative grid point.
 * Steps inward at hard limits (min/max) rather than clamping to an off-grid value.
 * Used exclusively for simpleBpm; bpmMin/bpmMax have no blur-time snap.
 *
 * @param {number} value  - Raw input value to snap.
 * @param {number} step   - Grid step size.
 * @param {number} anchor - Grid origin (last blurred simpleBpm value).
 * @param {number} min    - Hard lower limit (typically 30).
 * @param {number} max    - Hard upper limit (typically 300).
 * @returns {number} The nearest on-grid value within [min, max].
 */
export function snapToGrid(value, step, anchor, min, max) {
  return _snapToGrid(value, step, anchor, min, max);
}

/**
 * Reads stored preferences, applies DOM visibility, populates chip rows,
 * syncs settings controls, and wires all event listeners.
 * Must run after initDarkMode(), before initSoundProfileUI() and initAllUI().
 */
export function initAdvancedMode() {
  // 1. Read and sanitise stored state
  _advanced = localStorage.getItem("advancedMode") === "true";
  _step = utils.sanitizeQuantizationStep(
    parseInt(localStorage.getItem("bpmQuantizationStep"), 10)
  );
  _grooveAnchor =
    localStorage.getItem("grooveAnchor") === "max" ? "max" : "min";
  debugLog(
    "advancedMode",
    `init: advanced=${_advanced}, step=${_step}, grooveAnchor=${_grooveAnchor}`
  );
  // Default to true if never set
  _dashboardEnabled =
    localStorage.getItem("patternDashboardEnabled") !== "false";

  // 2. Sync utils.QUANTIZATION.groove so randomizeGroove() uses the live step
  utils.QUANTIZATION.groove = _step;

  // 3. Apply DOM visibility — instant on load, animated on toggle
  _applyModeInstant();

  // 4. Populate chip rows with current settings summary
  _renderChip();

  // 5. Sync settings modal controls to stored state
  const modeToggle = document.getElementById("advancedModeToggle");
  const stepInput = document.getElementById("bpmStepInput");
  if (modeToggle) modeToggle.checked = _advanced;
  if (stepInput) stepInput.value = _step;
  const anchorToggle = document.getElementById("grooveAnchorToggle");
  if (anchorToggle) anchorToggle.checked = _grooveAnchor === "max";

  const dashToggle = document.getElementById("patternDashboardToggle");
  if (dashToggle) dashToggle.checked = _dashboardEnabled;

  // 6. Wire event listeners
  _wireToggle(modeToggle);
  _wireStepInput(stepInput);
  _wireRestoreBtn();
  _wireOwnershipGuard();
  _wireAdjustButtons();
  _wireGrooveAnchorToggle(anchorToggle);
  _wireDashboardToggle(dashToggle);

  // 7. Re-render chip whenever a relevant setting changes
  document.addEventListener("advancedSettings:changed", _renderChip);

  // 8. Capture initial anchors from current DOM values
  _captureAnchors();
}

/**
 * Clears all localStorage keys, preserves dark mode preference, and reloads.
 * The one justified reload in the system — full state rebuild required.
 */
export function restoreDefaults() {
  // 1. Capture current theme to prevent visual jarring on reload
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";

  // 2. Total Wipe: This clears patterns, session settings, and our library seed flag.
  localStorage.clear();

  // 3. Restore the theme preference only
  localStorage.setItem("darkMode", isDark ? "true" : "false");

  debugLog(
    "advancedMode",
    "♻️ Factory Reset: Storage purged. Starter Kit will reload on boot."
  );

  // 4. Full reload is required to re-initialize all modules from zero
  location.reload();
}

export function getAdjustmentTarget() {
  return _adjustingTarget;
}

export function setAdjustmentTarget(target) {
  if (["min", "max", "simple"].includes(target)) {
    _adjustingTarget = target;
    debugLog("advancedMode", `🎯 Adjustment target set to: ${target}`);
  }
}

export function isDashboardEnabled(enabled) {
  return _dashboardEnabled;
}

// ── Private: anchor grid helpers ───────────────────────────────

/**
 * Snaps a value to the nearest anchor-relative grid point.
 * When the nearest grid point falls outside [min, max], steps inward
 * from the anchor rather than clamping to the boundary.
 *
 * @param {number} value  - Raw value to snap.
 * @param {number} step   - Grid step size.
 * @param {number} anchor - Grid origin.
 * @param {number} min    - Hard lower limit.
 * @param {number} max    - Hard upper limit.
 * @returns {number} On-grid value within [min, max].
 */
function _snapToGrid(value, step, anchor, min, max) {
  let snapped = Math.round((value - anchor) / step) * step + anchor;
  if (snapped < min) snapped = anchor + Math.ceil((min - anchor) / step) * step;
  if (snapped > max)
    snapped = anchor + Math.floor((max - anchor) / step) * step;
  return snapped;
}

/**
 * Reads the current simpleBpm DOM value and stores it as the snap anchor.
 * Called at init and whenever Advanced Mode is re-enabled.
 * bpmMin/bpmMax have no anchor — groove fields use no blur-time snap.
 */
function _captureAnchors() {
  const el = document.getElementById("simpleBpm");
  if (el) {
    const val = parseInt(el.value, 10);
    _simpleBpmAnchor = isNaN(val) ? 120 : val;
    debugLog(
      "advancedMode",
      `_captureAnchors: simpleBpmAnchor=${_simpleBpmAnchor}`
    );
  }
}

/**
 * Wires the grooveAnchorToggle checkbox.
 * Toggle changes persist to localStorage and take effect on the next Play press.
 * No DOM mutation or re-snap occurs on change — purely a grid direction setting.
 *
 * @param {HTMLInputElement|null} toggle - The #grooveAnchorToggle element.
 */
function _wireGrooveAnchorToggle(toggle) {
  if (!toggle) return;
  toggle.addEventListener("change", () => {
    _grooveAnchor = toggle.checked ? "max" : "min";
    localStorage.setItem("grooveAnchor", _grooveAnchor);
    debugLog("advancedMode", `grooveAnchor set to ${_grooveAnchor}`);
  });
}

function _wireDashboardToggle(toggle) {
  if (!toggle) return;
  toggle.addEventListener("change", () => {
    _dashboardEnabled = toggle.checked;
    localStorage.setItem("patternDashboardEnabled", _dashboardEnabled);
    debugLog(
      "advancedMode",
      `patternDashboardEnabled set to ${_dashboardEnabled}`
    );

    // Dispatch event so visuals.js can react if the metronome is idle
    document.dispatchEvent(
      new CustomEvent("metronome:visualModeChanged", {
        detail: { enabled: _dashboardEnabled },
      })
    );
  });
}

// ── Private: mode application ────────────────────────────────────

function _applyMode() {
  document.documentElement.classList.toggle("advanced-mode", _advanced);
  utils.QUANTIZATION.groove = _advanced ? _step : 5;

  const advancedEls = [...document.querySelectorAll(".advanced-only")];
  const simpleEls = [...document.querySelectorAll(".simple-only")];

  if (_advanced) {
    // Recede Simple elements (Outgoing)
    gsap.killTweensOf(simpleEls);
    gsap.to(simpleEls, {
      opacity: 0,
      scale: 0.96,
      y: 10,
      duration: 0.25,
      ease: "power2.in",
      onComplete: () => {
        simpleEls.forEach((el) => {
          el.classList.add("hidden");
          gsap.set(el, { clearProps: "all" });
        });
      },
    });

    // Approach Advanced elements (Incoming)
    advancedEls.forEach((el) => {
      el.classList.remove("hidden");
    });
    gsap.fromTo(
      advancedEls,
      { opacity: 0, scale: 1.04, y: -10 },
      {
        opacity: 1,
        scale: 1,
        y: 0,
        duration: 0.45,
        ease: "power2.out",
        stagger: 0.04,
        clearProps: "all",
      }
    );
  } else {
    // Recede Advanced elements (Outgoing)
    gsap.killTweensOf(advancedEls);
    gsap.to(advancedEls, {
      opacity: 0,
      scale: 0.96,
      y: 10,
      duration: 0.25,
      ease: "power2.in",
      stagger: 0.02,
      onComplete: () => {
        advancedEls.forEach((el) => {
          el.classList.add("hidden");
          gsap.set(el, { clearProps: "all" });
        });
      },
    });

    // Approach Simple elements (Incoming)
    simpleEls.forEach((el) => {
      el.classList.remove("hidden");
    });
    gsap.fromTo(
      simpleEls,
      { opacity: 0, scale: 1.04, y: -10 },
      {
        opacity: 1,
        scale: 1,
        y: 0,
        duration: 0.45,
        ease: "power2.out",
        stagger: 0.04,
        clearProps: "all",
      }
    );
  }

  debugLog(
    "advancedMode",
    `_applyMode: body.advanced-mode = ${_advanced}, QUANTIZATION.groove = ${utils.QUANTIZATION.groove}`
  );
}

function _applyModeInstant() {
  document.documentElement.classList.toggle("advanced-mode", _advanced);
  utils.QUANTIZATION.groove = _advanced ? _step : 5;
  // CSS handles display via .advanced-mode class — no animation needed
  debugLog(
    "advancedMode",
    `_applyModeInstant: body.advanced-mode = ${_advanced}, QUANTIZATION.groove = ${utils.QUANTIZATION.groove}`
  );
}

// ── Private: chip rendering ──────────────────────────────────────

function _renderChip() {
  const grooveChip = document.getElementById("groove-settings-chip");
  const simpleChip = document.getElementById("simple-settings-chip");
  if (!grooveChip && !simpleChip) return;

  const rawProfile = localStorage.getItem("activeSoundProfile") ?? "digital";
  const profile = rawProfile.charAt(0).toUpperCase() + rawProfile.slice(1);
  const subdivMap = { 1: "None", 2: "8th Notes", 4: "16th Notes" };
  const tip =
    "These settings carry over from Advanced Mode. Switch to Advanced to change them.";

  if (grooveChip) {
    const timeSigEl = document.getElementById("groovePresetSelect");
    const numEl = document.getElementById("grooveCustomNumerator");
    const denEl = document.getElementById("grooveCustomDenominator");
    const subdivEl = document.getElementById("grooveSubdivisionSelect");
    let timeSig = "4/4";
    if (timeSigEl) {
      timeSig =
        timeSigEl.value === "custom"
          ? `${numEl?.value ?? 4}/${denEl?.value ?? 4}`
          : timeSigEl.value;
    }
    const subdiv = subdivMap[subdivEl?.value ?? "1"] ?? "None";
    grooveChip.textContent = `${timeSig} · ${profile} · ${subdiv}`;
    grooveChip.title = tip;
  }

  if (simpleChip) {
    const timeSigEl = document.getElementById("simplePresetSelect");
    const numEl = document.getElementById("simpleCustomNumerator");
    const denEl = document.getElementById("simpleCustomDenominator");
    const subdivEl = document.getElementById("simpleSubdivisionSelect");
    let timeSig = "4/4";
    if (timeSigEl) {
      timeSig =
        timeSigEl.value === "custom"
          ? `${numEl?.value ?? 4}/${denEl?.value ?? 4}`
          : timeSigEl.value;
    }
    const subdiv = subdivMap[subdivEl?.value ?? "1"] ?? "None";
    simpleChip.textContent = `${timeSig} · ${profile} · ${subdiv}`;
    simpleChip.title = tip;
  }

  debugLog(
    "advancedMode",
    `_renderChip: groove="${grooveChip?.textContent}", simple="${simpleChip?.textContent}"`
  );
}

// ── Private: event wiring ────────────────────────────────────────

function _wireToggle(toggle) {
  if (!toggle) return;
  toggle.addEventListener("change", () => {
    const wasAdvanced = _advanced;
    _advanced = toggle.checked;
    localStorage.setItem("advancedMode", _advanced ? "true" : "false");

    // Sanitise BPM values when returning to Simple Mode
    if (wasAdvanced && !_advanced) {
      _sanitiseBpmForSimpleMode();
    }

    // Force editor back to Textarea state if it was in List state
    import("./grooveEditor.js").then((module) => {
      module.forceStateA();
    });

    _applyMode();

    // Re-capture simpleBpm anchor from current DOM value whenever Advanced Mode
    // is enabled. This picks up the sanitised value after a Simple-mode round-trip.
    if (!wasAdvanced && _advanced) {
      _captureAnchors();
    }

    _renderChip();

    // Sync slider step/margin to match the new mode (step=user pref in
    // Advanced, step=5 in Simple). Lazy import avoids circular dependency.
    import("./sliders.js").then(({ updateBpmInputSteps }) => {
      updateBpmInputSteps();
    });

    debugLog("advancedMode", `mode toggled: advanced=${_advanced}`);
  });
}

function _sanitiseBpmForSimpleMode() {
  const SIMPLE_STEP = 5;
  ["bpmMin", "bpmMax", "simpleBpm"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const val = parseInt(el.value, 10);
    if (isNaN(val)) return;
    const snapped = Math.round(val / SIMPLE_STEP) * SIMPLE_STEP;
    el.value = Math.max(30, Math.min(300, snapped));
    el.dataset.lastValidValue = el.value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
  debugLog(
    "advancedMode",
    "_sanitiseBpmForSimpleMode: BPM values quantized to step=5"
  );
}

function _wireStepInput(input) {
  if (!input) return;

  // Block non-digit keys while typing (allow navigation and edit keys)
  input.addEventListener("keydown", (e) => {
    const allowed = [
      "Backspace",
      "Delete",
      "Tab",
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Enter",
    ];
    if (!allowed.includes(e.key) && !/^\d$/.test(e.key)) e.preventDefault();
  });

  // Strip any non-digit characters that slip through (e.g. paste)
  input.addEventListener("input", () => {
    input.value = input.value.replace(/\D/g, "");
  });

  // Sanitise and persist on blur; reflect the clamped value back into the input
  input.addEventListener("blur", () => {
    _onStepChanged(input.value);
    input.value = _step;
  });
}

function _wireRestoreBtn() {
  const btn = document.getElementById("restoreDefaultsBtn");
  if (!btn) return;

  let confirmTimeout = null;

  btn.addEventListener("click", () => {
    if (btn.classList.contains("confirming")) {
      clearTimeout(confirmTimeout);
      restoreDefaults();
    } else {
      btn.classList.add("confirming");
      btn.textContent = "Tap again to confirm";
      confirmTimeout = setTimeout(() => {
        btn.classList.remove("confirming");
        btn.textContent = "Restore to Defaults";
      }, 4000);
    }
  });
}

function _wireOwnershipGuard() {
  document.addEventListener("metronome:ownerChanged", (e) => {
    const owner = e?.detail?.owner;
    const isPlaying = owner === "groove" || owner === "simple";
    const isEditing = owner === "editing";

    // 1. Editor controls: Disable ONLY if a metronome is playing
    const editorTargets = [
      "managePatternsBtn",
      "editGrooveNamesBtn",
      "saveGrooveBtn",
      "cancelGrooveBtn",
      "clearGrooveBtn",
      "deleteGrooveBtn",
      "patternDashboardToggle",
      "patNumerator",
      "patDenominator",
      "patSubdivision",
      "patMeasures",
      "toggleHHPed",
      "grooves",
    ];
    editorTargets.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.disabled = isPlaying;
    });

    // --- Add sweep for dynamic list buttons ---
    document.querySelectorAll(".edit-pattern-btn").forEach((btn) => {
      btn.disabled = isPlaying;
    });

    // 2. Metronome controls: Disable ONLY if editing a pattern
    const metronomeTargets = [
      "startBtn",
      "simpleStartBtn",
      "pauseBtn",
      "simplePauseBtn",
    ];
    metronomeTargets.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.disabled = isEditing;
    });

    // 3. Global Advanced controls: Disable if busy with EITHER
    ["advancedModeToggle", "bpmStepInput", "grooveAnchorToggle"].forEach(
      (id) => {
        const el = document.getElementById(id);
        if (el) el.disabled = isPlaying || isEditing;
      }
    );

    // 4. ± Stepper buttons: Disable if busy with EITHER
    document.querySelectorAll(".bpm-adjust-btn").forEach((btn) => {
      btn.disabled = isPlaying || isEditing;
    });

    // 5. Grid Cells: Logic guard inside grooveEditor.js handles this

    debugLog("advancedMode", `ownership guard: owner=${owner}`);
  });
}

/**
 * Wires the delegated click handler for all .bpm-adjust-btn elements.
 * Supports single-tap and long-press (hold) to rapidly increment/decrement BPM.
 * Synthesises ArrowUp/ArrowDown KeyboardEvents on window so the existing
 * hotkeys.js handler processes button clicks identically to key presses —
 * ownership guard, margin guard, flash animation, and setBpm call are
 * all inherited. For groove fields, sets window.__adjustingTarget first
 * so adjustGrooveInput moves the correct field.
 *
 * Does NOT update _simpleBpmAnchor — consistent with arrow key behaviour:
 * anchor updates only on blur, not during grid navigation.
 */

let _adjustButtonsWired = false;
let _repeatTimeout = null;
let _repeatInterval = null;

function _wireAdjustButtons() {
  if (_adjustButtonsWired) return;
  _adjustButtonsWired = true;

  const stopRepeat = () => {
    clearTimeout(_repeatTimeout);
    clearInterval(_repeatInterval);
    _repeatTimeout = null;
    _repeatInterval = null;
  };

  const handlePress = (e) => {
    const btn = e.target.closest(".bpm-adjust-btn");
    if (!btn || !_advanced) return;

    // Prevent context menu on long-press for mobile
    if (e.type === "touchstart" && e.cancelable) e.preventDefault();

    const target = btn.dataset.target;
    const delta = parseInt(btn.dataset.delta, 10);
    const code = delta > 0 ? "ArrowUp" : "ArrowDown";

    // Injection: Must set target BEFORE firing so hotkeys.js knows which field to move
    if (target === "min" || target === "max") {
      setAdjustmentTarget(target);
    }
    // For "simple", decideTarget() in hotkeys.js returns "simple" when
    // panel-metronome is visible, which it is when the stepper is shown.

    const fireAction = () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { code, bubbles: true, cancelable: true })
      );
    };

    // 1. Initial Pulse (Handles the single-tap)
    fireAction();

    // 2. Setup Auto-Repeat
    _repeatTimeout = setTimeout(() => {
      _repeatInterval = setInterval(fireAction, 60); // 60ms = fast but readable reel
    }, 400); // 400ms = delay before repeating starts
  };

  // Attach listeners to document for delegation
  document.addEventListener("mousedown", (e) => {
    if (e.button === 0) handlePress(e); // Only left-click
  });

  document.addEventListener("touchstart", handlePress, { passive: false });

  // Cleanup listeners on window to ensure we catch release even if mouse drifts
  window.addEventListener("mouseup", stopRepeat);
  window.addEventListener("touchend", stopRepeat);
  window.addEventListener("touchcancel", stopRepeat);

  // Mouseleave on the document ensures we stop if user drags out of the window
  document.addEventListener("mouseleave", stopRepeat);
}

// ── Private: step change cascade ─────────────────────────────────

function _onStepChanged(rawValue) {
  const newStep = utils.sanitizeQuantizationStep(parseInt(rawValue, 10));
  if (newStep === _step) return; // no change — skip cascade

  _step = newStep;
  localStorage.setItem("bpmQuantizationStep", String(_step));
  utils.QUANTIZATION.groove = _step;

  debugLog("advancedMode", `step changed to ${_step}`);

  // Correct groove BPM margin if the new step makes gap < step.
  // This is the only place BPM values are moved without direct user action.
  // No blur events are fired on BPM inputs — sliders sync via change dispatch
  // inside _correctMarginIfViolated only when a correction actually occurs.
  _correctMarginIfViolated();

  // Update slider step/margin to match the new quantization step.
  // Lazy import avoids circular dependency at module evaluation time.
  import("./sliders.js").then(({ updateBpmInputSteps }) => {
    updateBpmInputSteps();
  });
}

/**
 * Enforces gap >= _step between bpmMin and bpmMax after a step change.
 * Only fires when the current gap is less than the new step.
 * The non-anchor end is moved outward by one step; on wall collision,
 * both ends are repositioned to fit the step within [30, 300].
 *
 * Double-wall collision is impossible: 300 - 30 = 270 > 150 = step_max.
 *
 * @returns {void}
 */
function _correctMarginIfViolated() {
  const minEl = document.getElementById("bpmMin");
  const maxEl = document.getElementById("bpmMax");
  if (!minEl || !maxEl) return;

  const minVal = parseInt(minEl.value, 10);
  const maxVal = parseInt(maxEl.value, 10);
  if (isNaN(minVal) || isNaN(maxVal)) return;
  if (maxVal - minVal >= _step) return; // gap already sufficient — no correction

  debugLog(
    "advancedMode",
    `_correctMarginIfViolated: gap=${maxVal - minVal} < step=${_step}, anchor=${_grooveAnchor}`
  );

  if (_grooveAnchor === "min") {
    const candidate = minVal + _step;
    if (candidate <= 300) {
      // Normal: bpmMax moves up, bpmMin unchanged.
      // Stamp lastValidValue for both fields so the pair is consistent.
      // Without this, the anchor field retains a stale lastValidValue and
      // checkGrooveMargin can revert to it on the next blur, producing min > max.
      maxEl.value = String(candidate);
      maxEl.dataset.lastValidValue = String(candidate);
      minEl.dataset.lastValidValue = String(minVal);
      maxEl.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      // Ceiling collision: reposition both ends to [300-step, 300]
      const newMin = 300 - _step;
      minEl.value = String(newMin);
      minEl.dataset.lastValidValue = String(newMin);
      maxEl.value = "300";
      maxEl.dataset.lastValidValue = "300";
      minEl.dispatchEvent(new Event("change", { bubbles: true }));
      maxEl.dispatchEvent(new Event("change", { bubbles: true }));
    }
  } else {
    const candidate = maxVal - _step;
    if (candidate >= 30) {
      // Normal: bpmMin moves down, bpmMax unchanged.
      // Stamp lastValidValue for both fields so the pair is consistent.
      minEl.value = String(candidate);
      minEl.dataset.lastValidValue = String(candidate);
      maxEl.dataset.lastValidValue = String(maxVal);
      minEl.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      // Floor collision: reposition both ends to [30, 30+step]
      const newMax = 30 + _step;
      maxEl.value = String(newMax);
      maxEl.dataset.lastValidValue = String(newMax);
      minEl.value = "30";
      minEl.dataset.lastValidValue = "30";
      minEl.dispatchEvent(new Event("change", { bubbles: true }));
      maxEl.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  debugLog(
    "advancedMode",
    `_correctMarginIfViolated: corrected to bpmMin=${minEl.value}, bpmMax=${maxEl.value}`
  );
}

// ── Test / debug hook ────────────────────────────────────────────
// Exposed on window.__advancedMode only when DEBUG.advancedMode is true.
// Enable via: DEBUG.advancedMode = true
// The getter re-evaluates DEBUG.advancedMode at access time, so the flag
// can be flipped in the console without a reload.

if (typeof window !== "undefined") {
  Object.defineProperty(window, "__advancedMode", {
    get() {
      if (!DEBUG.advancedMode) {
        console.warn(
          "[advancedMode] Enable DEBUG.advancedMode to access internals"
        );
        return null;
      }
      return {
        getState: () => ({ _advanced, _step, _grooveAnchor, _simpleBpmAnchor }),
        getGrooveAnchor: () => _grooveAnchor,
        getSimpleBpmAnchor: () => _simpleBpmAnchor,
        applyMode: _applyMode,
        captureAnchors: _captureAnchors,
        renderChip: _renderChip,
        onStepChanged: _onStepChanged,
        correctMarginIfViolated: _correctMarginIfViolated,
        restoreDefaults,
      };
    },
  });
}
