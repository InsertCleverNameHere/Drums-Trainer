// js/simpleMetronome.js
// Minimal standalone simple metronome module for Step 3
import * as sessionEngine from "./sessionEngine.js";

let running = false;
let paused = false;
let bpm = 120;
let timer = null;
let tickCallback = null;

export function initSimpleMetronome(opts = {}) {
  tickCallback =
    typeof opts.tickCallback === "function" ? opts.tickCallback : null;
  if (opts.initialBpm) bpm = opts.initialBpm;
}

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
  bpm = Number(newBpm) || bpm;
}

function clearTicker() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export function start() {
  // Prevent start if another owner already holds playback
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
  sessionEngine.setActiveModeOwner("simple");

  running = true;
  sessionEngine.setActiveModeOwner &&
    sessionEngine.setActiveModeOwner("simple");
  document.dispatchEvent(
    new CustomEvent("simpleMetronome:state", {
      detail: { running: true, paused: false },
    })
  );
  paused = false;
  if (
    typeof sessionEngine !== "undefined" &&
    typeof sessionEngine.setActiveModeOwner === "function"
  ) {
    sessionEngine.setActiveModeOwner("simple");
  }
  document.dispatchEvent(
    new CustomEvent("simpleMetronome:state", {
      detail: { running: true, paused: false },
    })
  );

  const intervalMs = Math.round(60000 / bpm);
  clearTicker();
  timer = setInterval(() => {
    try {
      if (typeof tickCallback === "function") tickCallback();
    } catch (err) {}
  }, intervalMs);

  console.log("simpleMetronome started at BPM", bpm);
  return Promise.resolve(true);
}

export function pause() {
  if (!running || paused) return;
  paused = true;
  document.dispatchEvent(
    new CustomEvent("simpleMetronome:state", {
      detail: { running: !!running, paused: true },
    })
  );
  clearTicker();
}

export function resume() {
  if (!running || !paused) return;
  paused = false;
  document.dispatchEvent(
    new CustomEvent("simpleMetronome:state", {
      detail: { running: !!running, paused: false },
    })
  );
  // restart ticker
}

export function stop() {
  if (!running) return;
  running = false;
  sessionEngine.setActiveModeOwner && sessionEngine.setActiveModeOwner(null);
  document.dispatchEvent(
    new CustomEvent("simpleMetronome:state", {
      detail: { running: false, paused: false },
    })
  );
  paused = false;
  if (
    typeof sessionEngine !== "undefined" &&
    typeof sessionEngine.setActiveModeOwner === "function"
  ) {
    sessionEngine.setActiveModeOwner(null);
  }
  document.dispatchEvent(
    new CustomEvent("simpleMetronome:state", {
      detail: { running: false, paused: false },
    })
  );
  clearTicker();
  sessionEngine.setActiveModeOwner(null);
  console.log("simpleMetronome stopped");
}
