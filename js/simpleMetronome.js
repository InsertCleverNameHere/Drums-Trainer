// js/simpleMetronome.js
// Simple metronome UI module backed by js/simpleMetronomeCore.js

import * as sessionEngine from "./sessionEngine.js";
import * as simpleCore from "./simpleMetronomeCore.js";
import { createVisualCallback } from "./visuals.js";
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
      console.info("simpleMetronome stopped because owner changed to", owner);
    } catch (err) {
      console.warn("simpleMetronome failed to stop on owner change:", err);
    }
  }
});

export function isRunning() {
  return running;
}

export function isPaused() {
  return paused;
}

export function getBpm() {
  return bpm;
}

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

export function start() {
  const owner =
    typeof sessionEngine.getActiveModeOwner === "function"
      ? sessionEngine.getActiveModeOwner()
      : null;
  if (owner && owner !== "simple") {
    console.warn("Cannot start simple metronome: owner is", owner);
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
      console.warn("simpleMetronomeCore.startMetronome missing");
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
  console.log("simpleMetronome started at BPM", bpm);
  return Promise.resolve(true);
}

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
  console.log("simpleMetronome stopped");
  toggleSliderDisabled(false);
}
