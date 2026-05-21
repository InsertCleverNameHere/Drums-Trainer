/**
 * @fileoverview noUiSlider setup, input validation, and BPM range management.
 * Handles both dual-handle (groove) and single-handle (simple) sliders.
 *
 * @module ui/sliders
 */

import { debugLog } from "../debug.js";
import { INPUT_LIMITS, VISUAL_TIMING } from "../constants.js";
import * as utils from "../utils.js";
import * as advancedMode from "./advancedMode.js";

// Slider instances
let grooveSliderInstance = null;
let simpleSliderInstance = null;

/** @type {number|null} Internal timer for notice fade-out sequence */
let _noticeAutoTimer = null;
/** @type {number|null} Internal timer for final notice removal */
let _noticeHideTimer = null;

/**
 * Force-kills any active notice timers and clears visual state.
 * Essential for preventing background "toast" timers from closing
 * interactive dialogs.
 *
 * @returns {void}
 */
export function clearNotice() {
  const notice = document.querySelector(".ui-notice");
  if (!notice) return;

  if (_noticeAutoTimer) clearTimeout(_noticeAutoTimer);
  if (_noticeHideTimer) clearTimeout(_noticeHideTimer);
  _noticeAutoTimer = null;
  _noticeHideTimer = null;

  gsap.killTweensOf(notice);
  notice.classList.remove(
    "show",
    "fade-in",
    "fade-out",
    "hidden",
    "interactive",
    "auto"
  );
}

/**
 * Shows floating UI notice message.
 *
 * @param {string} message - Notice text
 * @param {number} [duration=2000] - Display duration in ms
 * @returns {void}
 *
 * @example
 * showNotice('⚠️ BPM range must be at least 5 apart');
 */
export function showNotice(message, duration = 2000) {
  let notice = document.querySelector(".ui-notice");
  if (!notice) {
    notice = document.createElement("div");
    notice.className = "ui-notice";
    document.body.appendChild(notice);
  }

  // Clear any existing notice or pending timers to prevent collisions
  clearNotice();

  notice.textContent = message;
  notice.classList.add("show", "fade-in", "auto");

  // Assign timers to tracked variables to allow cancellation
  _noticeAutoTimer = setTimeout(() => {
    notice.classList.remove("fade-in");
    notice.classList.add("fade-out");
    _noticeHideTimer = setTimeout(() => {
      notice.classList.remove("show", "auto");
      notice.classList.add("hidden");
    }, 500);
  }, duration);
}

/**
 * Validates and sanitizes numeric input against defined limits.
 *
 * @param {HTMLInputElement} input - Input element to validate
 * @returns {void}
 *
 * @example
 * const input = document.getElementById('bpmMin');
 * validateNumericInput(input); // Clamps to 30-300 range
 */
function validateNumericInput(input) {
  const id = input.id;
  if (!(id in INPUT_LIMITS)) return;

  const limits = INPUT_LIMITS[id];
  let sanitized = utils.sanitizePositiveInteger(input.value, limits);

  // Custom validation for allowed denominator values
  if (limits.allowed && !limits.allowed.includes(sanitized)) {
    // Find the closest allowed value
    sanitized = limits.allowed.reduce((prev, curr) => {
      return Math.abs(curr - sanitized) < Math.abs(prev - sanitized)
        ? curr
        : prev;
    });
    showNotice(`Beat unit must be 2, 4, 8, or 16. Corrected to ${sanitized}.`);
  }

  // In Advanced Mode, simpleBpm accepts any value in [30, 300] — no snap.
  // The clamped value becomes the new anchor so subsequent arrow key presses
  // step relative to whatever the user last typed.
  // bpmMin and bpmMax are also never snapped — quantization deferred to play time.
  if (id === "simpleBpm" && advancedMode.isAdvancedMode()) {
    advancedMode.setSimpleBpmAnchor(sanitized);
  }

  input.value = sanitized;
  // bpmMin/bpmMax: checkGrooveMargin is the sole owner of lastValidValue for
  // these two fields — it writes only after the margin cross-check passes.
  // Writing here would corrupt the revert target before the deferred check fires.
  if (id !== "bpmMin" && id !== "bpmMax") {
    input.dataset.lastValidValue = sanitized;
  }
}

/**
 * Attaches validation listeners to all numeric inputs.
 * Enforces INPUT_LIMITS constraints on keydown, paste, and blur.
 *
 * @returns {void}
 *
 * @example
 * attachInputValidation(); // Sets up validation for all inputs
 */
function attachInputValidation() {
  Object.keys(INPUT_LIMITS).forEach((id) => {
    const input = document.getElementById(id);
    if (!input) return;

    // Block non-numeric keys (except navigation)
    input.addEventListener("keydown", (e) => {
      if (
        e.ctrlKey ||
        e.metaKey ||
        [
          "Backspace",
          "Delete",
          "Tab",
          "ArrowLeft",
          "ArrowRight",
          "Enter",
        ].includes(e.key)
      )
        return;
      if (!/[0-9]/.test(e.key)) e.preventDefault();
    });

    // Sanitize pasted content
    input.addEventListener("paste", (e) => {
      const text = (e.clipboardData || window.clipboardData).getData("text");
      const limits = INPUT_LIMITS[id];
      const cleaned = utils.sanitizePositiveInteger(text, limits);

      if (cleaned === limits.defaultValue && !/^[1-9]\\d*$/.test(text)) {
        e.preventDefault();
        input.classList.add("invalid-flash");
        setTimeout(
          () => input.classList.remove("invalid-flash"),
          VISUAL_TIMING.INVALID_INPUT_FLASH_MS
        );
      } else {
        e.preventDefault();
        input.value = cleaned;
        // bpmMin/bpmMax: checkGrooveMargin is the sole owner of lastValidValue.
        // Writing here bypasses the margin cross-check and corrupts the revert
        // target. Let blur fire checkGrooveMargin to advance lastValidValue only
        // after the margin is confirmed safe — identical to the keyboard path.
        if (id !== "bpmMin" && id !== "bpmMax") {
          input.dataset.lastValidValue = cleaned;
        }
      }
    });

    // Allow typing without immediate validation
    input.addEventListener("input", (e) => {
      // Remove non-digits but don't clamp yet
      if (!/^\d*$/.test(input.value)) {
        input.value = input.value.replace(/\D+/g, "");
      }
    });

    // Validate on blur (when user finishes typing)
    input.addEventListener("blur", () => validateNumericInput(input));

    // Initialize with validation
    validateNumericInput(input);
  });

  // Groove BPM cross-check (enforce 5 BPM minimum margin)
  const minInput = document.getElementById("bpmMin");
  const maxInput = document.getElementById("bpmMax");

  if (minInput && maxInput) {
    /**
     * Checks the groove BPM margin after a blur on one of the two fields.
     * Deferred via setTimeout(0) so that if focus moves directly to the other
     * BPM field (blur-pair deferral), the check is skipped for that edit.
     *
     * On violation, BOTH fields are reverted to their lastValidValue. Reverting
     * only the edited field is unsafe: the other field may have drifted from its
     * own lastValidValue since the last confirmed-safe state (e.g. the user typed
     * into it without blurring, or _correctMarginIfViolated moved it). The LVV
     * pair is always written together and is guaranteed margin-safe, so reverting
     * both is the only operation that reliably restores a safe state.
     *
     * @param {HTMLInputElement} editedEl  - The field that just lost focus.
     * @param {HTMLInputElement} otherEl   - The complementary BPM field.
     */
    const checkGrooveMargin = (editedEl, otherEl) => {
      setTimeout(() => {
        // If focus moved directly to the other BPM field, the user is still
        // editing the pair — defer until they leave both fields entirely.
        if (document.activeElement === otherEl) return;

        const editedVal = Number(editedEl.value);
        const otherVal = Number(otherEl.value);
        const margin = advancedMode.isAdvancedMode()
          ? advancedMode.getQuantizationStep()
          : 5;

        const violated =
          editedEl === minInput
            ? editedVal >= otherVal - margin + 1
            : editedVal <= otherVal + margin - 1;

        if (violated) {
          // Revert both fields to their last confirmed-safe pair.
          // The LVV pair is always written together (by checkGrooveMargin's pass
          // branch and by _correctMarginIfViolated), so it is guaranteed to be
          // margin-safe. Reverting only editedEl would leave the pair in an
          // unsafe state if otherEl has drifted from its own LVV.
          minInput.value =
            minInput.dataset.lastValidValue ||
            String(INPUT_LIMITS.bpmMin.defaultValue);
          maxInput.value =
            maxInput.dataset.lastValidValue ||
            String(INPUT_LIMITS.bpmMax.defaultValue);
          showNotice(`BPM range must be at least ${margin} apart`);
        } else {
          // Both values are margin-safe — this is the only place that advances
          // lastValidValue for these two fields.
          editedEl.dataset.lastValidValue = String(editedVal);
          otherEl.dataset.lastValidValue = String(otherVal);
        }
      }, 0);
    };

    minInput.addEventListener("blur", () =>
      checkGrooveMargin(minInput, maxInput)
    );
    maxInput.addEventListener("blur", () =>
      checkGrooveMargin(maxInput, minInput)
    );
  }
}

/**
 * Creates noUiSlider instance with native pips and click handling.
 *
 * @param {string} elementId - Slider element ID
 * @param {Object} config - Slider configuration
 * @param {number[]} config.start - Initial value(s)
 * @param {boolean|string} config.connect - Connect bar style
 * @param {Function} [config.onUpdate] - Update callback
 * @returns {HTMLElement|null} Slider element
 *
 * @example
 * createMetronomeSlider('groove-slider', {
 *   start: [60, 120],
 *   connect: true,
 *   onUpdate: (values) => console.log(values)
 * });
 */
function createMetronomeSlider(elementId, config) {
  const sliderEl = document.getElementById(elementId);
  if (!sliderEl) return null;

  // Destroy existing instance
  if (sliderEl.noUiSlider) sliderEl.noUiSlider.destroy();

  noUiSlider.create(sliderEl, {
    start: config.start,
    connect: config.connect,
    range: { min: 30, max: 300 },
    step: config.step ?? 5,
    margin: config.margin ?? 5, // Safety margin (ignored if single handle)
    animate: true,
    animationDuration: 300,
    tooltips: false,

    // Native pips
    pips: {
      mode: "values",
      values: [30, 60, 90, 120, 150, 180, 210, 240, 270, 300],
      density: 100,
      stepped: false,
      filter: () => 1,
    },
  });

  // Store instance reference
  if (elementId === "groove-slider") {
    grooveSliderInstance = sliderEl.noUiSlider;
  } else {
    simpleSliderInstance = sliderEl.noUiSlider;
  }

  // Active pip highlighter
  const updateActivePips = (currentValues) => {
    sliderEl
      .querySelectorAll(".active-pip")
      .forEach((el) => el.classList.remove("active-pip"));
    sliderEl
      .querySelectorAll(".active-marker")
      .forEach((el) => el.classList.remove("active-marker"));

    currentValues.forEach((val) => {
      const numVal = Math.round(Number(val));
      const pipValues = [30, 60, 90, 120, 150, 180, 210, 240, 270, 300];
      const closest = pipValues.reduce((prev, curr) =>
        Math.abs(curr - numVal) < Math.abs(prev - numVal) ? curr : prev
      );

      const activePip = sliderEl.querySelector(
        `.noUi-value[data-value="${closest}"]`
      );
      if (activePip) {
        activePip.classList.add("active-pip");
        const marker = activePip.previousElementSibling;
        if (marker && marker.classList.contains("noUi-marker")) {
          marker.classList.add("active-marker");
        }
      }
    });
  };

  // Pip click handler
  const pips = sliderEl.querySelectorAll(".noUi-value");
  pips.forEach((pip) => {
    pip.addEventListener("click", function (e) {
      e.stopPropagation();
      const value = Number(this.getAttribute("data-value"));
      const rawValues = sliderEl.noUiSlider.get();

      // Handle dual-handle (groove) vs single-handle (simple)
      if (Array.isArray(rawValues)) {
        const current = rawValues.map(Number);
        const d0 = Math.abs(current[0] - value);
        const d1 = Math.abs(current[1] - value);
        const idx = d0 <= d1 ? 0 : 1;

        const newVals = [...current];
        newVals[idx] = value;
        sliderEl.noUiSlider.set(newVals);
      } else {
        sliderEl.noUiSlider.set(value);
      }
    });
  });

  // Update listener
  sliderEl.noUiSlider.on("update", (values, handle) => {
    updateActivePips(values);
    if (config.onUpdate) config.onUpdate(values, handle);
  });

  return sliderEl;
}

/**
 * Toggles groove slider enabled/disabled state.
 *
 * @param {boolean} disabled - True to disable, false to enable
 * @returns {void}
 *
 * @example
 * window.toggleGrooveSliderDisabled(true); // Disable during playback
 */
window.toggleGrooveSliderDisabled = (disabled) => {
  const wrapper = document.getElementById("groove-slider-wrapper");
  if (!grooveSliderInstance) return;

  if (disabled) {
    grooveSliderInstance.disable();
    wrapper.classList.add("disabled");
  } else {
    grooveSliderInstance.enable();
    wrapper.classList.remove("disabled");
  }
};

/**
 * Toggles simple slider enabled/disabled state.
 *
 * @param {boolean} disabled - True to disable, false to enable
 * @returns {void}
 *
 * @example
 * window.toggleSimpleSliderDisabled(true); // Disable during playback
 */
window.toggleSimpleSliderDisabled = (disabled) => {
  const wrapper = document.getElementById("simple-slider-wrapper");
  if (!simpleSliderInstance) return;

  if (disabled) {
    simpleSliderInstance.disable();
    wrapper.classList.add("disabled");
  } else {
    simpleSliderInstance.enable();
    wrapper.classList.remove("disabled");
  }
};

/**
 * Initializes both groove and simple sliders with input sync.
 * Attaches validation and sets up DOMContentLoaded listener.
 *
 * @returns {void}
 *
 * @example
 * initSliders(); // Sets up both sliders
 */
export function initSliders() {
  document.addEventListener("DOMContentLoaded", () => {
    // 1. Groove Slider (Range)
    const minInput = document.getElementById("bpmMin");
    const maxInput = document.getElementById("bpmMax");

    if (minInput && maxInput) {
      const grooveSlider = createMetronomeSlider("groove-slider", {
        start: [parseInt(minInput.value) || 30, parseInt(maxInput.value) || 60],
        connect: true,
        onUpdate: (values) => {
          if (!advancedMode.isAdvancedMode()) {
            minInput.value = Math.round(values[0]);
            maxInput.value = Math.round(values[1]);
          }
          // pip highlighting always runs regardless of mode
        },
      });

      const syncGroove = () => {
        if (grooveSlider && grooveSlider.noUiSlider) {
          grooveSlider.noUiSlider.set([minInput.value, maxInput.value]);
        }
      };
      minInput.addEventListener("change", syncGroove);
      maxInput.addEventListener("change", syncGroove);
    }

    // 2. Simple Slider (Single)
    const simpleInput = document.getElementById("simpleBpm");

    if (simpleInput) {
      const simpleSlider = createMetronomeSlider("simpleMetronomeSlider", {
        start: [parseInt(simpleInput.value) || 120],
        connect: "lower",
        onUpdate: (values) => {
          // In Advanced Mode the numeric input is source of truth;
          // silence writeback (same pattern as groove slider, C.3).
          if (!advancedMode.isAdvancedMode()) {
            simpleInput.value = Math.round(values[0]);
          }
        },
      });

      simpleInput.addEventListener("change", () => {
        if (simpleSlider && simpleSlider.noUiSlider) {
          simpleSlider.noUiSlider.set(simpleInput.value);
        }
      });
    }
  });

  // Attach input validation
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attachInputValidation);
  } else {
    attachInputValidation();
  }
}

/**
 * Updates BPM input step attributes based on user preference.
 *
 * @returns {void}
 *
 * @example
 * updateBpmInputSteps(); // Syncs step attribute with user preference
 */
export function updateBpmInputSteps() {
  // NOTE: HTML step attributes and data-dynamic-step removed from BPM inputs.
  // Native spinners are hidden via CSS; custom ± buttons are a planned replacement.
  // This function now only updates the noUiSlider instances.

  const sliderStep = advancedMode.isAdvancedMode()
    ? advancedMode.getQuantizationStep()
    : 5;

  if (grooveSliderInstance) {
    grooveSliderInstance.updateOptions(
      { step: sliderStep, margin: sliderStep },
      false
    );
  }

  if (simpleSliderInstance) {
    simpleSliderInstance.updateOptions({ step: sliderStep }, false);
  }

  debugLog("state", `Updated BPM slider steps to ${sliderStep}`);
}
