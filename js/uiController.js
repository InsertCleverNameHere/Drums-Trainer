// uiController.js
// Depends on metronomeCore functions passed in at init.

import * as utils from "./utils.js";
import * as sessionEngine from "./sessionEngine.js";
import { startSession } from "./sessionEngine.js";

let startMetronomeFn,
  stopMetronomeFn,
  setBeatsPerBarFn,
  getBeatsPerBarFn,
  getBpmFn;
let pauseMetronomeFn, resumeMetronomeFn, getPauseStateFn, requestEndOfCycleFn;
let performCountInFn;

export function initUI(deps) {
  // deps: { startMetronome, stopMetronome, setBeatsPerBar, pauseMetronome, resumeMetronome, getPauseState, getBeatsPerBar, getBpm }
  startMetronomeFn = deps.startMetronome;
  stopMetronomeFn = deps.stopMetronome;
  pauseMetronomeFn = deps.pauseMetronome;
  resumeMetronomeFn = deps.resumeMetronome;
  getPauseStateFn = deps.getPauseState;
  requestEndOfCycleFn = deps.requestEndOfCycle;
  performCountInFn = deps.performCountIn;
  setBeatsPerBarFn = deps.setBeatsPerBar;
  getBeatsPerBarFn = deps.getBeatsPerBar;
  getBpmFn = deps.getBpm;

  // avoid unused variable warnings in environments that run static checks
  // these helpers simply reference assigned functions so static analyzers won't flag them
  function _referencedDeps() {
    // intentionally no-op: these references are to satisfy linters
    void setBeatsPerBarFn;
    void getBeatsPerBarFn;
    void getPauseStateFn;
  }
  _referencedDeps();

  // DOM elements
  const startBtn = document.getElementById("startBtn");
  const nextBtn = document.getElementById("nextBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  pauseBtn.disabled = true; // Pause disabled until metronome starts
  nextBtn.disabled = true; // Next disabled until metronome starts
  const bpmMinEl = document.getElementById("bpmMin");
  const bpmMaxEl = document.getElementById("bpmMax");
  const groovesEl = document.getElementById("grooves");
  const displayBpm = document.getElementById("displayBpm");
  const displayGroove = document.getElementById("displayGroove");
  const countdownEl = document.getElementById("countdown");
  const cyclesDoneEl = document.getElementById("cyclesDone");
  const sessionModeEl = document.getElementById("sessionMode");
  const totalCyclesEl = document.getElementById("totalCycles");
  const totalTimeEl = document.getElementById("totalTime");
  const totalTimeUnitEl = document.getElementById("totalTimeUnit");
  const cycleDurationEl = document.getElementById("cycleDuration");
  const cycleUnitEl = document.getElementById("cycleUnit");
  const sessionCountdownEl = document.getElementById("sessionCountdown");
  const finishingBadgeEl = document.getElementById("finishingBadge");
  const tooltipTrigger = document.getElementById("tooltipTrigger");
  const tooltipDialog = document.getElementById("tooltipDialog");

  // read persisted preference; default to false (fixed count-in)
  const stored = localStorage.getItem("tempoSyncedCountIn");
  let tempoSynced = stored === null ? false : stored === "true";

  // Use the checkbox placed in `index.html` if present, otherwise skip UI wiring
  const tempoCheckbox = document.getElementById("tempoSyncedToggle");
  if (tempoCheckbox) {
    // initialize UI state
    tempoCheckbox.checked = tempoSynced;
    tempoCheckbox.onchange = () => {
      tempoSynced = !!tempoCheckbox.checked;
      localStorage.setItem(
        "tempoSyncedCountIn",
        tempoSynced ? "true" : "false"
      );
      console.info("tempoSyncedCountIn set to", tempoSynced);
    };
  } else {
    console.warn(
      "tempoSyncedToggle not found in DOM — count-in preference will still work but no UI toggle is available."
    );
  }

  // Wire up session start button
  startBtn.onclick = () => startSession();

  // Wire up pause and next cycle buttons
  pauseBtn.onclick = () => {
    sessionEngine.pauseSession();
  };

  nextBtn.onclick = () => {
    sessionEngine.nextCycle();
  };

  // Tooltip Logic
  function toggleTooltip() {
    const isVisible = tooltipDialog.classList.contains("visible");

    if (isVisible) {
      tooltipDialog.classList.remove("visible");
      clearTimeout(tooltipDialog._hideTimer);
    } else {
      tooltipDialog.classList.add("visible");
      tooltipDialog._hideTimer = setTimeout(() => {
        tooltipDialog.classList.remove("visible");
      }, 5000);
    }
  }

  // Close tooltip if clicked outside it
  document.addEventListener("click", (event) => {
    const clickedInsideTooltip = tooltipDialog.contains(event.target);
    const clickedTrigger = tooltipTrigger.contains(event.target);

    if (!clickedInsideTooltip && !clickedTrigger) {
      tooltipDialog.classList.remove("visible");
      clearTimeout(tooltipDialog._hideTimer);
    }
  });

  tooltipTrigger.onclick = toggleTooltip;

  // HOTKEYS LOGIC BELOW
  // --- Simple (Start, Pause, Next) Keyboard hotkeys (layout-independent)  ---
  document.addEventListener("keydown", (event) => {
    // Ignore keypresses when focused on text inputs, textareas, or contenteditable elements
    const active = document.activeElement;
    const isInputFocused =
      document.activeElement.tagName === "INPUT" ||
      document.activeElement.tagName === "TEXTAREA" ||
      document.activeElement.isContentEditable;
    if (isInputFocused) return;

    if (event.repeat) return; // Ignore repeated key presses

    switch (event.code) {
      case "Space": // Start/Stop
        event.preventDefault();
        if (!startBtn.disabled) startBtn.click();
        break;

      case "KeyP": // Pause/Resume
        if (!pauseBtn.disabled) pauseBtn.click();
        break;

      case "KeyN": // Next
        if (!nextBtn.disabled) nextBtn.click();
        break;

      case "KeyH":
        event.preventDefault();
        toggleTooltip();
        break;
    }
  });

  // --- Advanced Hotkeys: BPM adjustment (min/max) (Arrow Keys) ---
  let adjustingTarget = "min"; // "min" or "max"

  document.addEventListener("keydown", (event) => {
    // Ignore keypresses while typing or in editable areas
    const active = document.activeElement;
    const isInputFocused =
      active.tagName === "INPUT" ||
      active.tagName === "TEXTAREA" ||
      active.isContentEditable;
    if (isInputFocused) return;

    // Arrow navigation for selecting target BPM
    if (event.code === "ArrowRight") {
      adjustingTarget = "max";
      console.log("🎚️ Adjusting target: MAX BPM");
      return;
    }
    if (event.code === "ArrowLeft") {
      adjustingTarget = "min";
      console.log("🎚️ Adjusting target: MIN BPM");
      return;
    }

    // Handle Up/Down for BPM adjustment
    if (event.code === "ArrowUp" || event.code === "ArrowDown") {
      event.preventDefault();

      const bpmInput = adjustingTarget === "min" ? bpmMinEl : bpmMaxEl;
      let current = parseInt(bpmInput.value) || 0;

      // Fine-tune (Shift = ±1), else coarse (±5)
      const delta = event.shiftKey ? 1 : 5;
      const direction = event.code === "ArrowUp" ? 1 : -1;

      // Apply change and clamp to reasonable range
      current = utils.clamp(current + direction * delta, 30, 300);
      bpmInput.value = current;

      // Optional visual cue (flash input)
      bpmInput.classList.add("bpm-flash");
      setTimeout(() => bpmInput.classList.remove("bpm-flash"), 150);
    }
  });

  // expose a small API to check session state if needed later
  return {
    sessionActive: () => sessionActive,
  };
}
