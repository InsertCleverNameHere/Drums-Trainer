// uiController.js
// Depends on metronomeCore functions passed in at init.

import * as utils from "./utils.js";
import * as sessionEngine from "./sessionEngine.js";
import * as simpleMetronome from "./simpleMetronome.js";
import {
  setActiveProfile,
  getAvailableProfiles,
  getActiveProfile,
} from "./audioProfiles.js";

// --- Ownership Guards ---
// Prevents Groove Start button from running when another mode (e.g., Simple Metronome) owns playback
export function initOwnershipGuards() {
  const startBtn = document.getElementById("startBtn");
  if (!startBtn) {
    console.warn("⚠️ Start button not found for ownership guard");
    return;
  }

  startBtn.addEventListener(
    "click",
    (ev) => {
      const owner =
        typeof sessionEngine.getActiveModeOwner === "function"
          ? sessionEngine.getActiveModeOwner()
          : null;

      if (owner && owner !== "groove") {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        console.warn(
          "🚫 Cannot start Groove metronome — current owner:",
          owner
        );
        return;
      }
      // If no conflict, allow other listeners to proceed normally
    },
    { capture: true }
  );
}

// Hotkey handling early
let _hotkeyLock = false;
window.__adjustingTarget = window.__adjustingTarget || "min";
let adjustingTarget = "min";

// Global hotkeys: owner-first; arrows repeatable
window.addEventListener("keydown", (event) => {
  const active = document.activeElement;
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

  if (!allowRepeat) {
    if (_hotkeyLock) return;
    _hotkeyLock = true;
    setTimeout(() => (_hotkeyLock = false), 120);
  }

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

  const owner =
    typeof sessionEngine.getActiveModeOwner === "function"
      ? sessionEngine.getActiveModeOwner()
      : null;

  // Decide target: owner wins, then visible panel
  const groovePanel = document.getElementById("panel-groove");
  const simplePanel = document.getElementById("panel-metronome");
  const grooveVisible =
    groovePanel && !groovePanel.classList.contains("hidden");
  const simpleVisible =
    simplePanel && !simplePanel.classList.contains("hidden");

  const decideTarget = () => {
    if (owner === "groove") return "groove";
    if (owner === "simple") return "simple";
    if (grooveVisible && !simpleVisible) return "groove";
    if (simpleVisible && !grooveVisible) return "simple";
    return "groove";
  };

  const target = decideTarget();

  const grooveStartBtn = document.getElementById("startBtn");
  const grooveNextBtn = document.getElementById("nextBtn");

  const adjustGrooveInput = (delta) => {
    const bpmMinInput = document.getElementById("bpmMin");
    const bpmMaxInput = document.getElementById("bpmMax");
    const adj = window.__adjustingTarget === "max" ? bpmMaxInput : bpmMinInput;
    if (!adj) return;
    const step = event.shiftKey ? 1 : 5;
    const cur = parseInt(adj.value, 10) || 0;
    const next = Math.max(30, Math.min(300, cur + delta * step));
    adj.value = next;
    adj.classList.add("bpm-flash");
    setTimeout(() => adj.classList.remove("bpm-flash"), 150);
  };

  const adjustSimpleBpm = (delta) => {
    const el = document.getElementById("simpleBpm");
    if (!el) return;
    const cur =
      parseInt(el.value || el.getAttribute("value") || 120, 10) || 120;
    const step = event.shiftKey ? 1 : 5; // default ±5, Shift = ±1
    const next = Math.max(20, Math.min(400, cur + delta * step));
    el.value = next;
    if (
      typeof window.simpleMetronome !== "undefined" &&
      typeof window.simpleMetronome.setBpm === "function"
    ) {
      window.simpleMetronome.setBpm(next);
    } else if (
      typeof simpleMetronome !== "undefined" &&
      typeof simpleMetronome.setBpm === "function"
    ) {
      simpleMetronome.setBpm(next);
    }
    el.classList.add("bpm-flash");
    setTimeout(() => el.classList.remove("bpm-flash"), 150);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };

  switch (code) {
    case "Space":
      if (target === "groove") {
        if (grooveStartBtn && !grooveStartBtn.disabled) grooveStartBtn.click();
      } else {
        (async () => {
          if (
            typeof simpleMetronome !== "undefined" &&
            typeof simpleMetronome.isRunning === "function" &&
            simpleMetronome.isRunning()
          ) {
            if (typeof simpleMetronome.stop === "function")
              simpleMetronome.stop();
          } else {
            const bpmEl = document.getElementById("simpleBpm");
            const bpm = bpmEl ? parseInt(bpmEl.value, 10) : null;
            if (bpm && typeof simpleMetronome.setBpm === "function")
              simpleMetronome.setBpm(bpm);
            if (typeof simpleMetronome.start === "function")
              await simpleMetronome.start();
          }
        })();
      }
      break;

    case "KeyP":
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
      if (grooveNextBtn && !grooveNextBtn.disabled) grooveNextBtn.click();
      break;

    case "KeyH":
      document.dispatchEvent(new Event("toggleTooltip"));
      break;

    case "ArrowRight":
      window.__adjustingTarget = "max";
      console.log("🎚️ Adjusting target: MAX BPM");
      break;

    case "ArrowLeft":
      window.__adjustingTarget = "min";
      console.log("🎚️ Adjusting target: MIN BPM");
      break;

    case "ArrowUp":
      if (target === "groove") adjustGrooveInput(+1);
      else adjustSimpleBpm(+1);
      break;

    case "ArrowDown":
      if (target === "groove") adjustGrooveInput(-1);
      else adjustSimpleBpm(-1);
      break;
  }
});

// Control other parts of the UI
let startMetronomeFn,
  stopMetronomeFn,
  setBeatsPerBarFn,
  getBeatsPerBarFn,
  getBpmFn;
let pauseMetronomeFn, resumeMetronomeFn, getPauseStateFn, requestEndOfCycleFn;
let performCountInFn;

export function initUI(deps) {
  // deps: { startMetronome, stopMetronome, setBeatsPerBar, pauseMetronome, resumeMetronome, getPauseState, getBeatsPerBar, getBpm }
  // assign deps with defensive fallbacks to window.metronome if needed
  startMetronomeFn = deps.startMetronome;
  stopMetronomeFn = deps.stopMetronome;
  pauseMetronomeFn = deps.pauseMetronome;
  resumeMetronomeFn = deps.resumeMetronome;
  getPauseStateFn = deps.getPauseState;
  requestEndOfCycleFn = deps.requestEndOfCycle;
  performCountInFn = deps.performCountIn;

  // primary setter/getter may be missing from deps if init order differs;
  // prefer deps first, then fall back to global window.metronome
  setBeatsPerBarFn = deps.setBeatsPerBar;
  getBeatsPerBarFn = deps.getBeatsPerBar;
  getBpmFn = deps.getBpm;

  if (
    typeof setBeatsPerBarFn !== "function" &&
    typeof window !== "undefined" &&
    window.metronome &&
    typeof window.metronome.setBeatsPerBar === "function"
  ) {
    setBeatsPerBarFn = window.metronome.setBeatsPerBar;
  }
  if (
    typeof getBeatsPerBarFn !== "function" &&
    typeof window !== "undefined" &&
    window.metronome &&
    typeof window.metronome.getBeatsPerBar === "function"
  ) {
    getBeatsPerBarFn = window.metronome.getBeatsPerBar;
  }
  if (
    typeof getBpmFn !== "function" &&
    typeof window !== "undefined" &&
    window.metronome &&
    typeof window.metronome.getBpm === "function"
  ) {
    getBpmFn = window.metronome.getBpm;
  }

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

  // inside initUI, after DOM element setup
  function updateSimpleUI() {
    try {
      const running =
        typeof simpleMetronome !== "undefined" &&
        typeof simpleMetronome.isRunning === "function"
          ? simpleMetronome.isRunning()
          : false;
      const paused =
        typeof simpleMetronome !== "undefined" &&
        typeof simpleMetronome.isPaused === "function"
          ? simpleMetronome.isPaused()
          : false;

      // If your Pause button is the shared pauseBtn or a separate simplePauseBtn, update both safely
      if (typeof pauseBtn !== "undefined" && pauseBtn !== null) {
        // If groove owns playback, pauseBtn may be controlled elsewhere; only enable when simple is running and owner is simple
        const owner =
          typeof sessionEngine.getActiveModeOwner === "function"
            ? sessionEngine.getActiveModeOwner()
            : null;
        const enableForSimple =
          running && (owner === "simple" || owner === null);
        pauseBtn.disabled = !enableForSimple;
        pauseBtn.textContent = paused ? "Resume" : "Pause";
      }

      // If you have a dedicated simplePauseBtn element, update it similarly:
      const simplePauseBtn = document.getElementById("simplePauseBtn");
      if (simplePauseBtn) {
        simplePauseBtn.disabled = !running;
        simplePauseBtn.textContent = paused ? "Resume" : "Pause";
      }

      // Ensure the Start/Stop button text is also consistent if you have a simpleStartBtn
      const simpleStartBtn = document.getElementById("simpleStartBtn");
      if (simpleStartBtn) {
        simpleStartBtn.textContent = running ? "Stop" : "Start";
        simpleStartBtn.disabled = false;
      }
    } catch (e) {
      throw e;
    }
  }

  // Listen for state events from simpleMetronome
  document.addEventListener("simpleMetronome:state", (ev) => {
    updateSimpleUI();
  });

  // Also refresh on owner changes (sessionEngine may emit this elsewhere)
  document.addEventListener("metronome:ownerChanged", () => {
    updateSimpleUI();
  });

  // Ensure initial sync
  updateSimpleUI();

  // Beats-per-bar input wiring
  const beatsPerBarEl = document.getElementById("beatsPerBar");
  if (beatsPerBarEl && typeof setBeatsPerBarFn === "function") {
    const applyBeatsPerBar = () => {
      const v = Number(beatsPerBarEl.value);
      if (Number.isNaN(v)) return;
      const n = Math.max(1, Math.min(12, Math.round(v)));
      if (String(n) !== beatsPerBarEl.value) beatsPerBarEl.value = String(n);
      try {
        setBeatsPerBarFn(n);
      } catch (e) {
        throw e;
      }
    };

    beatsPerBarEl.addEventListener("change", applyBeatsPerBar);
    beatsPerBarEl.addEventListener("blur", applyBeatsPerBar);
    beatsPerBarEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") applyBeatsPerBar();
    });

    // initialize input from metronome state if available
    try {
      const current =
        typeof getBeatsPerBarFn === "function" ? getBeatsPerBarFn() : null;
      if (current != null && String(current) !== beatsPerBarEl.value)
        beatsPerBarEl.value = String(current);
    } catch (e) {}
  }

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
  startBtn.onclick = () => sessionEngine.startSession();

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

  document.addEventListener("toggleTooltip", toggleTooltip);
  // Make the tooltipTrigger button toggle the tooltip reliably
  if (tooltipTrigger) {
    tooltipTrigger.addEventListener("click", (ev) => {
      ev.stopPropagation(); // prevent document click handler from closing it immediately
      toggleTooltip();
    });
  }

  // Close tooltip if clicked outside it
  document.addEventListener("click", (event) => {
    if (!tooltipDialog || !tooltipTrigger) return;
    if (
      tooltipDialog.contains(event.target) ||
      tooltipTrigger.contains(event.target)
    )
      return;
    tooltipDialog.classList.remove("visible");
    clearTimeout(tooltipDialog._hideTimer);
  });

  // expose a small API to check session state if needed later
  return {
    sessionActive: () => sessionActive,
  };
}

// -----------------------------
// 🎧 Sound Profile Dropdowns
// -----------------------------
/**
 * Initialize sound profile dropdowns for both groove and simple panels.
 * Populates <select> elements and keeps them synchronized.
 */
export function initSoundProfileUI() {
  const grooveProfileEl = document.getElementById("soundProfileGroove");
  const simpleProfileEl = document.getElementById("soundProfileSimple");

  if (!grooveProfileEl || !simpleProfileEl) {
    console.warn("⚠️ Sound profile dropdowns not found in DOM");
    return;
  }

  // Populate both dropdowns dynamically
  const profiles = getAvailableProfiles();
  for (const p of profiles) {
    const label = p.charAt(0).toUpperCase() + p.slice(1);
    grooveProfileEl.appendChild(new Option(label, p));
    simpleProfileEl.appendChild(new Option(label, p));
  }

  // Sync both dropdowns + apply profile
  function syncProfileSelection(profileName) {
    grooveProfileEl.value = profileName;
    simpleProfileEl.value = profileName;
    setActiveProfile(profileName);
    localStorage.setItem("activeSoundProfile", profileName); // Save to localStorage
    console.log(`🎚 Sound profile set to: ${profileName}`);
  }

  // Load persisted profile first
  const saved = localStorage.getItem("activeSoundProfile");
  const current = saved || getActiveProfile() || "digital";
  syncProfileSelection(current);

  // Wire up listeners on both dropdowns
  grooveProfileEl.addEventListener("change", (e) =>
    syncProfileSelection(e.target.value)
  );
  simpleProfileEl.addEventListener("change", (e) =>
    syncProfileSelection(e.target.value)
  );
}

// -----------------------------------
// 🥁 Simple Metronome Panel Controls
// -----------------------------------
export function initSimplePanelControls() {
  const startBtn = document.getElementById("simpleStartBtn");
  const pauseBtn = document.getElementById("simplePauseBtn");
  const bpmEl = document.getElementById("simpleBpm");
  const ownerPanelEventTarget = document;

  if (!startBtn) {
    console.warn(
      "⚠️ simpleStartBtn not found; check DOM ID or ensure this script runs after the element."
    );
    return;
  }

  function updateSimpleUI() {
    const running =
      typeof simpleMetronome.isRunning === "function" &&
      simpleMetronome.isRunning();
    const paused =
      typeof simpleMetronome.isPaused === "function" &&
      simpleMetronome.isPaused();

    if (startBtn) {
      startBtn.textContent = running ? "Stop" : "Start";
      startBtn.disabled = false;
    }
    if (pauseBtn) {
      pauseBtn.disabled = !running;
      pauseBtn.textContent = paused ? "Resume" : "Pause";
    }
  }

  // --- Event wiring ---
  startBtn.addEventListener("click", async (ev) => {
    ev.preventDefault();
    const owner =
      typeof sessionEngine.getActiveModeOwner === "function"
        ? sessionEngine.getActiveModeOwner()
        : null;
    if (owner && owner !== "simple") {
      console.warn(
        "🚫 Cannot start simple metronome while",
        owner,
        "is active"
      );
      return;
    }

    const running =
      typeof simpleMetronome.isRunning === "function" &&
      simpleMetronome.isRunning();
    const desiredBpm = bpmEl ? parseInt(bpmEl.value, 10) : null;
    if (desiredBpm) simpleMetronome.setBpm(desiredBpm);

    if (!running) {
      try {
        await simpleMetronome.start();
      } catch (err) {
        console.error("simpleMetronome.start() threw:", err);
      }
    } else {
      try {
        simpleMetronome.stop();
      } catch (err) {
        console.error("simpleMetronome.stop() threw:", err);
      }
    }

    updateSimpleUI();
  });

  if (pauseBtn) {
    pauseBtn.addEventListener("click", () => {
      if (
        typeof simpleMetronome.isPaused === "function" &&
        simpleMetronome.isPaused()
      ) {
        simpleMetronome.resume();
      } else {
        simpleMetronome.pause();
      }
      updateSimpleUI();
    });
  }

  ownerPanelEventTarget.addEventListener("metronome:ownerChanged", () => {
    setTimeout(updateSimpleUI, 0);
  });

  // initialize UI immediately
  updateSimpleUI();

  console.log("✅ Simple metronome panel initialized");
}
