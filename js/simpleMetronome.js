// js/simpleMetronome.js
// Simple metronome UI module backed by js/simpleMetronomeCore.js

import * as sessionEngine from "./sessionEngine.js";
import * as simpleCore from "./simpleMetronomeCore.js";
import { createVisualCallback } from "./visuals.js";

let running = false;
let paused = false;
let bpm = 120;
let visualRegistered = false;

// Helper for disabling the slider whenn the metronome is runnning
function toggleSliderDisabled(disabled) {
  const sliderEl = document.getElementById("simpleMetronomeSlider");
  if (sliderEl) {
    sliderEl.disabled = disabled;
    sliderEl.style.opacity = disabled ? 0.5 : 1.0;
    sliderEl.style.cursor = disabled ? "not-allowed" : "pointer";
  }
}

// DOM helpers
function getBeatsInputValue() {
  const el = document.getElementById("simpleBeatsPerBar");
  if (!el) return 4;
  const n = Number(el.value);
  return Number.isFinite(n) && n >= 1 ? Math.round(n) : 4;
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

function ensureSimpleDots() {
  const beats = getBeatsInputValue();
  // visuals.createVisualCallback uses default container id; we will register a small adapter below
  const container = document.getElementById("beat-indicator-container-simple");
  if (!container) return;
  if (container.childElementCount !== beats) {
    container.innerHTML = "";
    for (let i = 0; i < beats; i++) {
      const dot = document.createElement("div");
      dot.className = "beat-dot-simple";
      dot.dataset.index = String(i);
      container.appendChild(dot);
    }
  }
}

// Visual adapter for the simple panel (uses the same signature as core emits)
function simpleVisualAdapter(tickIndex, isAccent, tickInBeat) {
  const beats = getBeatsInputValue();
  ensureSimpleDots();
  updateSimpleDisplayBpm();
  const ticksPerBeatLocal =
    typeof simpleCore.getTicksPerBeat === "function"
      ? Math.max(1, Number(simpleCore.getTicksPerBeat()) || 1)
      : 1;
  const beat = Math.floor(tickIndex / Math.max(1, ticksPerBeatLocal));
  const beatIndex = ((beat % beats) + beats) % beats;
  const container = document.getElementById("beat-indicator-container-simple");
  if (!container) return;
  const dots = container.children;
  for (let i = 0; i < dots.length; i++) {
    dots[i].style.backgroundColor = "#bfbfbf";
    dots[i].style.transform = "scale(1)";
    dots[i].style.opacity = "0.6";
  }
  const active = dots[beatIndex];
  if (!active) return;
  active.style.backgroundColor = isAccent ? "#b22222" : "#006400";
  active.style.transform = "scale(1.25)";
  active.style.opacity = "1";
  setTimeout(() => {
    active.style.transform = "scale(1)";
    active.style.opacity = "0.7";
    active.style.backgroundColor = "#bfbfbf";
  }, 120);
}

export function initSimpleMetronome(opts = {}) {
  if (opts.initialBpm) bpm = Number(opts.initialBpm) || bpm;
  // ensure dots reflect initial beats input
  ensureSimpleDots();

  // wire input change to update beatsPerBar on the core
  const beatsEl = document.getElementById("simpleBeatsPerBar");
  if (beatsEl) {
    beatsEl.addEventListener("change", () => {
      const n = getBeatsInputValue();
      if (typeof simpleCore.setBeatsPerBar === "function")
        simpleCore.setBeatsPerBar(n);
      ensureSimpleDots();
    });
  }
  // 🎚️ Simple Metronome Slider sync
  const sliderEl = document.getElementById("simpleMetronomeSlider");
  const bpmInput = document.getElementById("simpleBpm");

  if (sliderEl && bpmInput) {
    // Initialize slider to match current BPM
    sliderEl.value = bpmInput.value;

    // When slider changes, update BPM input + logic
    sliderEl.addEventListener("input", () => {
      const newBpm = utils.clamp(Number(sliderEl.value), 20, 300);
      bpmInput.value = newBpm;
      setBpm(newBpm);
      updateSimpleDisplayBpm(newBpm);
      updateActiveTick(newBpm);
    });

    // Sync slider whenever BPM input changes (manual or programmatic)
    const syncSliderToInput = () => {
      const newBpm = utils.clamp(Number(bpmInput.value), 20, 300);
      sliderEl.value = newBpm;
      updateActiveTick(newBpm);
    };
    bpmInput.addEventListener("change", syncSliderToInput);
    bpmInput.addEventListener("input", syncSliderToInput);

    // 🎯 Click to jump on slider
    const sliderWrapper = document.querySelector(".bpm-slider-wrapper");
    if (sliderEl && bpmInput && sliderWrapper) {
      sliderWrapper.addEventListener("click", (e) => {
        // If the click was on a mark (or inside one), don't handle it here —
        // the mark-specific handler will run (and we want only that to run).
        if (e.target.closest && e.target.closest(".mark")) return;

        // ignore clicks directly on the thumb (to not interfere with dragging)
        if (e.target === sliderEl) return;

        const rect = sliderEl.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percent = utils.clamp(clickX / rect.width, 0, 1);
        const newBpm = Math.round(20 + percent * (300 - 20));

        sliderEl.value = newBpm;
        bpmInput.value = newBpm;
        setBpm(newBpm);
        updateSimpleDisplayBpm(newBpm);
        updateActiveTick(newBpm);
      });

      // 🎵 Click directly on a label mark to snap to its BPM
      sliderWrapper.addEventListener("click", (e) => {
        const mark = e.target.closest(".mark");
        if (mark && mark.dataset.bpm) {
          const newBpm = Number(mark.dataset.bpm);
          sliderEl.value = newBpm;
          bpmInput.value = newBpm;
          setBpm(newBpm);
          updateSimpleDisplayBpm(newBpm);
          updateActiveTick(newBpm);
          e.stopPropagation(); // prevent double-triggering the wrapper click
        }
      });
    }
  }

  function renderSliderMarks() {
    const marksContainer = document.getElementById("simpleBpmMarks");
    const slider = document.getElementById("simpleMetronomeSlider");
    const wrapper = document.querySelector(".bpm-slider-wrapper");
    if (!marksContainer || !slider || !wrapper) return;

    // BPM values to show
    const marks = [20, 40, 60, 90, 120, 150, 180, 210, 240, 270, 300];

    // Thumb width from CSS (keep in sync with CSS rule)
    const thumbPx = 16;
    const thumbRadius = thumbPx / 2;

    // Slider geometry and computed styles
    const sliderRect = slider.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();
    const computed = window.getComputedStyle(slider);

    // account for any border or padding the slider element might have
    const borderLeft = parseFloat(computed.borderLeftWidth) || 0;
    const borderRight = parseFloat(computed.borderRightWidth) || 0;
    const paddingLeft = parseFloat(computed.paddingLeft) || 0;
    const paddingRight = parseFloat(computed.paddingRight) || 0;

    // Visual track start/width: inset by half the thumb plus border/padding approximations
    const insetLeft = thumbRadius + borderLeft + paddingLeft;
    const insetRight = thumbRadius + borderRight + paddingRight;
    const trackStartX = sliderRect.left + insetLeft;
    const trackWidthPx = Math.max(0, sliderRect.width - insetLeft - insetRight);

    const min = Number(slider.min);
    const max = Number(slider.max);

    // Clear previous marks
    marksContainer.innerHTML = "";

    marks.forEach((value) => {
      if (!Number.isFinite(value) || value < min || value > max) return;

      const ratio = (value - min) / (max - min); // 0..1
      // page x coordinate of thumb center for this value
      const xPage = trackStartX + ratio * trackWidthPx;

      // convert to percent relative to wrapper width
      const percent = ((xPage - wrapperRect.left) / wrapperRect.width) * 100;
      const clampedPercent = Math.max(0, Math.min(100, percent));

      // label (clickable)
      const span = document.createElement("span");
      span.className = "mark";
      span.textContent = String(value);
      span.dataset.bpm = value; // add data-bpm for click snapping
      span.style.left = `${clampedPercent}%`;
      marksContainer.appendChild(span);

      // small vertical tick line
      const tick = document.createElement("i");
      tick.className = "tick";
      tick.style.left = `${clampedPercent}%`;
      marksContainer.appendChild(tick);
    });
  }

  function updateActiveTick(currentBpm) {
    const marksContainer = document.getElementById("simpleBpmMarks");
    if (!marksContainer) return;

    // find the tick closest to the current BPM
    const ticks = Array.from(marksContainer.querySelectorAll(".tick"));
    const marks = Array.from(marksContainer.querySelectorAll(".mark"));

    // remove any existing active class
    ticks.forEach((t) => t.classList.remove("active"));

    // find the mark whose bpm is closest to the current value
    let closestTick = null;
    let minDiff = Infinity;
    marks.forEach((m, i) => {
      const bpmVal = Number(m.dataset.bpm);
      const diff = Math.abs(bpmVal - currentBpm);
      if (diff < minDiff) {
        minDiff = diff;
        closestTick = ticks[i];
      }
    });

    if (closestTick) closestTick.classList.add("active");
  }

  // initial render + keep it responsive
  renderSliderMarks();
  updateActiveTick(bpm);
  window.addEventListener("resize", () => {
    renderSliderMarks();
    updateActiveTick(bpm);
  });

  window.addEventListener("load", () => {
    renderSliderMarks();
    updateActiveTick(bpm);
  });

  // Watch for panel visibility and render once it becomes visible
  (function watchPanelVisibilityAndRenderOnce() {
    const metronomePanel = document.getElementById("panel-metronome");
    if (!metronomePanel) return;

    // Helper to check if panel is visible and usable for measurements
    const panelIsVisible = (el) =>
      el &&
      el.offsetParent !== null &&
      getComputedStyle(el).display !== "none" &&
      el.getBoundingClientRect().width > 0;

    // If already visible now, just render and return
    if (panelIsVisible(metronomePanel)) {
      requestAnimationFrame(() => {
        renderSliderMarks();
        updateActiveTick(bpm);
      });
      return;
    }

    // Observe class/style attribute changes on the panel itself
    const observer = new MutationObserver((mutations) => {
      // one shot: when panel becomes visible, render and disconnect
      if (panelIsVisible(metronomePanel)) {
        // ensure layout paints before measuring
        requestAnimationFrame(() => {
          renderSliderMarks();
          updateActiveTick(bpm);
        });
        observer.disconnect();
      }
    });

    observer.observe(metronomePanel, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });

    // As a robust fallback, also listen for clicks that may toggle the panel.
    // This avoids edge-cases where an outer controller swaps DOM nodes instead of toggling attributes.
    const clickFallback = () => {
      setTimeout(() => {
        if (panelIsVisible(metronomePanel)) {
          renderSliderMarks();
          updateActiveTick(bpm);
          document.removeEventListener("click", clickFallback, true);
          observer.disconnect();
        }
      }, 20); // allow UI toggling to complete
    };
    document.addEventListener("click", clickFallback, true);
  })();

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
  if (Number.isFinite(n) && n >= 20 && n <= 400) bpm = n;
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

function registerVisualIfNeeded() {
  if (visualRegistered) return;
  if (typeof simpleCore.registerVisualCallback === "function") {
    simpleCore.registerVisualCallback(simpleVisualAdapter);
    visualRegistered = true;
  }
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

  // Disable slider while metronome is running
  toggleSliderDisabled(true);

  registerVisualIfNeeded();

  // Ensure core beats-per-bar reflects UI
  const beats = getBeatsInputValue();
  if (typeof simpleCore.setBeatsPerBar === "function")
    simpleCore.setBeatsPerBar(beats);

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
  console.log("simpleMetronome started at BPM", bpm);
  return Promise.resolve(true);
}

export function pause() {
  if (!running || paused) return;
  if (typeof simpleCore.pauseMetronome === "function")
    simpleCore.pauseMetronome();
  paused = true;
  // Disable slider while metronome is paused
  toggleSliderDisabled(true);
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

  // Preserve simple-specific state event for UI consumers
  document.dispatchEvent(
    new CustomEvent("simpleMetronome:state", {
      detail: { running: false, paused: false },
    })
  );

  // Re-enable slider after stopping
  toggleSliderDisabled(false);

  console.log("simpleMetronome stopped");
}
