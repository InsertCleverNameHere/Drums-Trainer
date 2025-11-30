// js/simpleMetronome.js
/**
 * @fileoverview Simple metronome UI module backed by simpleMetronomeCore.js.
 * Manages UI state, button logic, and ownership coordination for the simple metronome panel.
 * @module simpleMetronome
 */

import * as sessionEngine from "./sessionEngine.js";
import * as simpleCore from "./simpleMetronomeCore.js";
import { createVisualCallback } from "./visuals.js";
import { debugLog } from "./debug.js";
import * as utils from "./utils.js";

export const core = simpleCore;

let running = false;
let paused = false;
let bpm = 120;
let visualRegistered = false;

// DOM helpers

// Helper for disabling the slider when the metronome is running
function toggleSliderDisabled(disabled) {
  if (typeof window.toggleSimpleSliderDisabled === "function") {
    window.toggleSimpleSliderDisabled(disabled);
  }
}

function getSimpleDisplayBpmEl() {
  return document.getElementById("simpleDisplayBpm");
}

// Update the simple panel BPM text
function updateSimpleDisplayBpm() {
  const el = getSimpleDisplayBpmEl();
  if (!el) return;
  el.textContent = `BPM: ${bpm || "—"}`;
}

/**
 * Initializes the simple metronome module.
 * 
 * @public
 * @param {Object} [opts={}] - Configuration options
 * @param {number} [opts.initialBpm] - Initial BPM value
 * @returns {void}
 * 
 * @example
 * initSimpleMetronome({ initialBpm: 120 });
 */
export function initSimpleMetronome(opts = {}) {
  if (opts.initialBpm) bpm = Number(opts.initialBpm) || bpm;

  // Expose for console/debugging
  window.simpleMetronome = window.simpleMetronome || {};
  window.simpleMetronome.setBpm = setBpm;
  window.simpleMetronome.getBpm = getBpm;
  window.simpleMetronome.isRunning = isRunning;
  window.simpleMetronome.isPaused = isPaused;
  window.simpleMetronome.start = start;
  window.simpleMetronome.pause = pause;
  window.simpleMetronome.resume = resume;
  window.simpleMetronome.stop = stop;
  window.simpleMetronome.core = simpleCore;
}

// Listen for explicit owner changes and stop if we lose ownership
document.addEventListener("metronome:ownerChanged", (e) => {
  const owner = e && e.detail && e.detail.owner;
  // if someone else became owner and we are running, stop to avoid audio conflicts
  if (owner && owner !== "simple" && running) {
    try {
      stop();
      debugLog(
        "ownership",
        "simpleMetronome stopped because owner changed to",
        owner
      );
    } catch (err) {
      debugLog(
        "ownership",
        "simpleMetronome failed to stop on owner change:",
        err
      );
    }
  }
});

/**
 * Checks if simple metronome is currently running.
 * 
 * @public
 * @returns {boolean} True if running (even if paused)
 * 
 * @example
 * if (isRunning()) {
 *   console.log('Simple metronome is active');
 * }
 */
export function isRunning() {
  return running;
}

/**
 * Checks if simple metronome is currently paused.
 * 
 * @public
 * @returns {boolean} True if paused
 * 
 * @example
 * if (isPaused()) {
 *   console.log('Simple metronome is paused');
 * }
 */
export function isPaused() {
  return paused;
}

/**
 * Returns current BPM.
 * 
 * @public
 * @returns {number} Current tempo
 * 
 * @example
 * const tempo = getBpm(); // 120
 */
export function getBpm() {
  return bpm;
}

/**
 * Updates tempo and syncs with UI input.
 * 
 * @public
 * @param {number} newBpm - New tempo (20-300)
 * @returns {number} Clamped BPM value
 * 
 * @example
 * setBpm(140); // Sets tempo to 140 BPM
 */
export function setBpm(newBpm) {
  const n = Number(newBpm);
  if (Number.isFinite(n) && n >= 20 && n <= 300) bpm = n;
  // Update display badge
  updateSimpleDisplayBpm();

  // Also sync the BPM input element so the UI reflects programmatic changes
  const bpmInput = document.getElementById("simpleBpm");
  if (bpmInput) {
    // Only update if different to avoid surprising the user while typing
    if (String(bpmInput.value) !== String(bpm)) {
      bpmInput.value = String(bpm);
      // Optionally notify listeners
      bpmInput.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  return bpm;
}

/**
 * Starts the simple metronome.
 * Claims ownership and starts audio core.
 * 
 * @public
 * @returns {Promise<boolean>} Success/failure
 * 
 * @example
 * await start(); // Starts metronome at current BPM
 */
export function start() {
  const owner =
    typeof sessionEngine.getActiveModeOwner === "function"
      ? sessionEngine.getActiveModeOwner()
      : null;
  if (owner && owner !== "simple") {
    debugLog(
      "ownership",
      `⚠️ Cannot start simple metronome: owner is ${owner}`
    );
    return Promise.resolve(false);
  }

  if (running && !paused) return Promise.resolve(true);

  // Claim ownership
  if (typeof sessionEngine.setActiveModeOwner === "function")
    sessionEngine.setActiveModeOwner("simple");
  // Broadcast canonical owner change for other modules and console-driven paths
  document.dispatchEvent(
    new CustomEvent("metronome:ownerChanged", { detail: { owner: "simple" } })
  );

  // Start audio core
  try {
    if (typeof simpleCore.startMetronome === "function") {
      simpleCore.startMetronome(bpm);
    } else {
      debugLog("audio", "⚠️ simpleMetronomeCore.startMetronome missing");
      return Promise.resolve(false);
    }
  } catch (err) {
    console.error("simpleMetronome core start failed:", err);
    return Promise.resolve(false);
  }

  running = true;
  paused = false;
  updateSimpleDisplayBpm();
  // Preserve simple-specific state event for UI consumers (moved below flag updates)
  document.dispatchEvent(
    new CustomEvent("simpleMetronome:state", {
      detail: { running: true, paused: false },
    })
  );
  toggleSliderDisabled(true);
  document.getElementById("simpleBpm").disabled = true;
  document.getElementById("simplePresetSelect").disabled = true;
  document.getElementById("simpleCustomNumerator").disabled = true;
  document.getElementById("simpleCustomDenominator").disabled = true;
  document.getElementById("simpleSubdivisionSelect").disabled = true;

  debugLog("audio", "simpleMetronome started at BPM", bpm);
  return Promise.resolve(true);
}

/**
 * Pauses the simple metronome.
 * 
 * @public
 * @returns {void}
 * 
 * @example
 * pause(); // Pauses playback
 */
export function pause() {
  if (!running || paused) return;
  if (typeof simpleCore.pauseMetronome === "function")
    simpleCore.pauseMetronome();
  paused = true;
  updateSimpleDisplayBpm();
  document.dispatchEvent(
    new CustomEvent("simpleMetronome:state", {
      detail: { running: !!running, paused: true },
    })
  );
  document.dispatchEvent(
    new CustomEvent("metronome:ownerChanged", { detail: { owner: "simple" } })
  );
}

/**
 * Resumes the simple metronome from paused state.
 * 
 * @public
 * @returns {void}
 * 
 * @example
 * resume(); // Resumes playback
 */
export function resume() {
  if (!running || !paused) return;
  if (typeof simpleCore.resumeMetronome === "function")
    simpleCore.resumeMetronome();
  paused = false;
  updateSimpleDisplayBpm();
  document.dispatchEvent(
    new CustomEvent("simpleMetronome:state", {
      detail: { running: !!running, paused: false },
    })
  );
  document.dispatchEvent(
    new CustomEvent("metronome:ownerChanged", { detail: { owner: "simple" } })
  );
}

/**
 * Stops the simple metronome and releases ownership.
 * 
 * @public
 * @returns {void}
 * 
 * @example
 * stop(); // Stops playback completely
 */
export function stop() {
  if (!running) return;
  if (typeof simpleCore.stopMetronome === "function")
    simpleCore.stopMetronome();
  running = false;
  paused = false;
  updateSimpleDisplayBpm();
  if (typeof sessionEngine.setActiveModeOwner === "function")
    sessionEngine.setActiveModeOwner(null);
  // Broadcast canonical owner cleared
  document.dispatchEvent(
    new CustomEvent("metronome:ownerChanged", { detail: { owner: null } })
  );
  // Preserve simple-specific state event for UI consumers
  document.dispatchEvent(
    new CustomEvent("simpleMetronome:state", {
      detail: { running: false, paused: false },
    })
  );
  debugLog("audio", "simpleMetronome stopped");
  toggleSliderDisabled(false);
  document.getElementById("simpleBpm").disabled = false;
  document.getElementById("simplePresetSelect").disabled = false;
  document.getElementById("simpleCustomNumerator").disabled = false;
  document.getElementById("simpleCustomDenominator").disabled = false;
  document.getElementById("simpleSubdivisionSelect").disabled = false;
}
