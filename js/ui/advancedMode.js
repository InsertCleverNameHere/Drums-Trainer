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

  // 2. Sync utils.QUANTIZATION.groove so randomizeGroove() uses the live step
  utils.QUANTIZATION.groove = _step;

  // 3. Apply DOM visibility (body.advanced-mode class)
  _applyMode();

  // 4. Populate chip rows with current settings summary
  _renderChip();

  // 5. Sync settings modal controls to stored state
  const modeToggle = document.getElementById("advancedModeToggle");
  const stepInput = document.getElementById("bpmStepInput");
  if (modeToggle) modeToggle.checked = _advanced;
  if (stepInput) stepInput.value = _step;
  const anchorToggle = document.getElementById("grooveAnchorToggle");
  if (anchorToggle) anchorToggle.checked = _grooveAnchor === "max";

  // 6. Wire event listeners
  _wireToggle(modeToggle);
  _wireStepInput(stepInput);
  _wireRestoreBtn();
  _wireOwnershipGuard();
  _wireGrooveAnchorToggle(anchorToggle);

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
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  localStorage.clear();
  localStorage.setItem("darkMode", prefersDark ? "true" : "false");
  location.reload();
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

// ── Private: mode application ────────────────────────────────────

function _applyMode() {
  document.body.classList.toggle("advanced-mode", _advanced);
  // Keep randomizer step in sync with the active mode.
  // Simple Mode always uses step=5; Advanced Mode uses the user preference.
  utils.QUANTIZATION.groove = _advanced ? _step : 5;
  debugLog(
    "advancedMode",
    `_applyMode: body.advanced-mode = ${_advanced}, QUANTIZATION.groove = ${utils.QUANTIZATION.groove}`
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
    const isPlaying = e?.detail?.owner !== null;
    ["advancedModeToggle", "bpmStepInput", "grooveAnchorToggle"].forEach(
      (id) => {
        const el = document.getElementById(id);
        if (el) el.disabled = isPlaying;
      }
    );
    debugLog("advancedMode", `ownership guard: isPlaying=${isPlaying}`);
  });
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
