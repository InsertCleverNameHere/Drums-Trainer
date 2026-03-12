/**
 * @fileoverview Simple / Advanced Mode toggle, BPM step management,
 * and persistent settings chip row.
 *
 * Public API:
 *   initAdvancedMode()      — call once on DOMContentLoaded, before sliders/sound/timesig
 *   isAdvancedMode()        — returns current mode as boolean
 *   getQuantizationStep()   — returns current BPM step (1–150)
 *   restoreDefaults()       — clears localStorage and reloads
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

// ── Public API ───────────────────────────────────────────────────

export function isAdvancedMode() {
  return _advanced;
}
export function getQuantizationStep() {
  return _step;
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
  debugLog("advancedMode", `init: advanced=${_advanced}, step=${_step}`);

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

  // 6. Wire event listeners
  _wireToggle(modeToggle);
  _wireStepInput(stepInput);
  _wireRestoreBtn();
  _wireOwnershipGuard();

  // 7. Re-render chip whenever a relevant setting changes
  document.addEventListener("advancedSettings:changed", _renderChip);
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
    const numEl    = document.getElementById("grooveCustomNumerator");
    const denEl    = document.getElementById("grooveCustomDenominator");
    const subdivEl = document.getElementById("grooveSubdivisionSelect");
    let timeSig = "4/4";
    if (timeSigEl) {
      timeSig = timeSigEl.value === "custom"
        ? `${numEl?.value ?? 4}/${denEl?.value ?? 4}`
        : timeSigEl.value;
    }
    const subdiv = subdivMap[subdivEl?.value ?? "1"] ?? "None";
    grooveChip.textContent = `${timeSig} · ${profile} · ${subdiv}`;
    grooveChip.title = tip;
  }

  if (simpleChip) {
    const timeSigEl = document.getElementById("simplePresetSelect");
    const numEl    = document.getElementById("simpleCustomNumerator");
    const denEl    = document.getElementById("simpleCustomDenominator");
    const subdivEl = document.getElementById("simpleSubdivisionSelect");
    let timeSig = "4/4";
    if (timeSigEl) {
      timeSig = timeSigEl.value === "custom"
        ? `${numEl?.value ?? 4}/${denEl?.value ?? 4}`
        : timeSigEl.value;
    }
    const subdiv = subdivMap[subdivEl?.value ?? "1"] ?? "None";
    simpleChip.textContent = `${timeSig} · ${profile} · ${subdiv}`;
    simpleChip.title = tip;
  }

  debugLog("advancedMode",
    `_renderChip: groove="${grooveChip?.textContent}", simple="${simpleChip?.textContent}"`);
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
    ["advancedModeToggle", "bpmStepInput"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.disabled = isPlaying;
    });
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

  // Re-validate all BPM inputs against the new step
  ["bpmMin", "bpmMax", "simpleBpm"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.dispatchEvent(new Event("blur", { bubbles: true }));
  });

  // Update step attributes on data-dynamic-step inputs.
  // Lazy import avoids a circular dependency at module evaluation time
  // (sliders.js will import advancedMode.js for isAdvancedMode / getQuantizationStep).
  import("./sliders.js").then(({ updateBpmInputSteps }) => {
    updateBpmInputSteps();
  });

  // Re-enforce groove BPM cross-check margin with new step
  const minEl = document.getElementById("bpmMin");
  if (minEl) minEl.dispatchEvent(new Event("change", { bubbles: true }));
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
        getState: () => ({ _advanced, _step }),
        applyMode: _applyMode,
        renderChip: _renderChip,
        onStepChanged: _onStepChanged,
        restoreDefaults,
      };
    },
  });
}
