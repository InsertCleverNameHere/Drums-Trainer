// uiController.js
// Depends on metronomeCore functions passed in at init.

import * as utils from "./utils.js";
import * as sessionEngine from "./sessionEngine.js";
import * as simpleMetronome from "./simpleMetronome.js";
import * as audioProfiles from "./audioProfiles.js";

// =============================================================
// 🔒 Safe Quantization Helper
// =============================================================

export function getQuantizationLevel() {
  const q = window?.utils?.QUANTIZATION;
  if (!q || typeof q.groove !== "number" || q.groove <= 0) return 5;
  return q.groove;
}

// ============================
// 🎚️ Quantization Initializer
// ============================

// Ensure QUANTIZATION object exists globally
if (typeof window.QUANTIZATION === "undefined") {
  window.QUANTIZATION = { groove: 5 }; // default to a safe mid value
}

// Initialization function to sanitize and set defaults
export function initQuantization() {
  if (!window.QUANTIZATION) window.QUANTIZATION = {};

  // Auto-correct using utils.sanitizeQuantizationStep
  const safeGroove = utils.sanitizeQuantizationStep(window.QUANTIZATION.groove);
  if (safeGroove !== window.QUANTIZATION.groove) {
    console.warn(
      `⚠️ Corrected invalid QUANTIZATION.groove from ${window.QUANTIZATION.groove} → ${safeGroove}`
    );
    window.QUANTIZATION.groove = safeGroove;
  }
}

// --- Quantization Safety Wrapper ---
export function getSafeQuantization() {
  // Re-initialize if the global object doesn’t exist
  if (!window.QUANTIZATION) initQuantization();

  // Always sanitize and enforce the valid range
  const safeGroove = utils.sanitizeQuantizationStep(window.QUANTIZATION.groove);

  // If the sanitized value differs, fix it in place
  if (safeGroove !== window.QUANTIZATION.groove) {
    window.QUANTIZATION.groove = safeGroove;
    console.warn(
      `💡 Quantization groove corrected to safe value: ${safeGroove}`
    );
  }

  return window.QUANTIZATION;
}

// Auto-run after DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initQuantization);
} else {
  initQuantization();
}

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
    const other =
      window.__adjustingTarget === "max" ? bpmMinInput : bpmMaxInput;

    if (!adj || !other) return;

    const step = 5; // Always 5, no fine-tuning
    const cur = parseInt(adj.value, 10) || 0;
    const otherVal = parseInt(other.value, 10) || 0;
    const next = Math.max(30, Math.min(300, cur + delta * step));

    // Check if this change would violate the margin (5 BPM minimum)
    const margin = 5;
    if (window.__adjustingTarget === "min" && next >= otherVal - margin + 1) {
      return;
    }
    if (window.__adjustingTarget === "max" && next <= otherVal + margin - 1) {
      return;
    }

    // Apply validation and update the input
    adj.value = next;
    validateNumericInput(adj);

    // Trigger a change event to update the slider
    adj.dispatchEvent(new Event("change", { bubbles: true }));

    adj.classList.add("bpm-flash");
    setTimeout(() => adj.classList.remove("bpm-flash"), 150);
  };

  const adjustSimpleBpm = (delta) => {
    const el = document.getElementById("simpleBpm");
    if (!el) return;
    const cur =
      parseInt(el.value || el.getAttribute("value") || 120, 10) || 120;
    const step = 5; // Always 5, no fine-tuning
    const limits = INPUT_LIMITS[el.id];
    const next = Math.max(limits.min, Math.min(limits.max, cur + delta * step));
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
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };

  switch (code) {
    case "Space":
      if (target === "groove") {
        if (!grooveStartBtn || grooveStartBtn.disabled) break;
        grooveStartBtn.click();
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

      // 🖐️ Tap Tempo button: only active when metronome is fully stopped
      const tapBtn = document.getElementById("tapTempoBtn");
      if (tapBtn) {
        const isRunning = simpleMetronome.isRunning?.();
        const isPaused = simpleMetronome.isPaused?.();
        // Disable whenever running or paused — only allow tapping when fully stopped
        tapBtn.disabled = isRunning || isPaused;
      }
    } catch (e) {
      console.error("updateSimpleUI failed:", e);
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

  // Groove Beats-per-bar input wiring (was previously targeting non-existent "beatsPerBar")
  const grooveBeatsPerBarEl = document.getElementById("grooveBeatsPerBar");
  if (grooveBeatsPerBarEl && typeof setBeatsPerBarFn === "function") {
    const applyGrooveBeatsPerBar = () => {
      const v = Number(grooveBeatsPerBarEl.value);
      if (Number.isNaN(v)) return;
      const n = Math.max(1, Math.min(12, Math.round(v)));
      if (String(n) !== grooveBeatsPerBarEl.value)
        grooveBeatsPerBarEl.value = String(n);
      try {
        setBeatsPerBarFn(n); // calls metronomeCore.setBeatsPerBar
      } catch (e) {
        console.error("Error setting groove beats per bar:", e);
      }
    };

    grooveBeatsPerBarEl.addEventListener("change", applyGrooveBeatsPerBar);
    grooveBeatsPerBarEl.addEventListener("blur", applyGrooveBeatsPerBar);
    grooveBeatsPerBarEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") applyGrooveBeatsPerBar();
    });

    // initialize input from metronome state if available
    try {
      const current =
        typeof getBeatsPerBarFn === "function" ? getBeatsPerBarFn() : null;
      if (current != null && String(current) !== grooveBeatsPerBarEl.value)
        grooveBeatsPerBarEl.value = String(current);
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
  const profiles = audioProfiles.getAvailableProfiles();
  for (const p of profiles) {
    const label = p.charAt(0).toUpperCase() + p.slice(1);
    grooveProfileEl.appendChild(new Option(label, p));
    simpleProfileEl.appendChild(new Option(label, p));
  }

  // Sync both dropdowns + apply profile
  function syncProfileSelection(profileName) {
    grooveProfileEl.value = profileName;
    simpleProfileEl.value = profileName;
    audioProfiles.setActiveProfile(profileName);
    localStorage.setItem("activeSoundProfile", profileName); // Save to localStorage
    console.log(`🎚 Sound profile set to: ${profileName}`);
  }

  // Load persisted profile first
  const saved = localStorage.getItem("activeSoundProfile");
  const current = saved || audioProfiles.getActiveProfile() || "digital";
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

  // --- Tap Tempo logic ---
  const tapBtn = document.getElementById("tapTempoBtn");
  if (tapBtn) {
    tapBtn.classList.remove("tap-pulse");

    tapBtn.addEventListener("click", () => {
      const isRunning = simpleMetronome.isRunning?.();
      const isPaused = simpleMetronome.isPaused?.();
      if (isRunning && !isPaused) {
        console.warn("🚫 Tap tempo only works when stopped or paused.");
        return;
      }

      // 💡 Animate tap button
      tapBtn.classList.remove("tap-pulse");
      void tapBtn.offsetWidth;
      tapBtn.classList.add("tap-pulse");

      // ✅ Call our new internal-state-based util
      const newBpm = utils.calculateTapTempo();
      if (newBpm) {
        const bpmInput = document.getElementById("simpleBpm");
        bpmInput.value = newBpm;

        if (typeof simpleMetronome.setBpm === "function") {
          simpleMetronome.setBpm(newBpm);
          bpmInput.classList.add("bpm-flash");
          setTimeout(() => bpmInput.classList.remove("bpm-flash"), 150);
        }

        console.log(`🎯 Tap Tempo BPM set to ${newBpm}`);
      }
    });
  }

  // initialize UI immediately
  updateSimpleUI();
}

// -----------------------------------
// 🧭 Mode Tabs (Groove vs Metronome)
// -----------------------------------
export function initModeTabs(sessionEngine, simpleMetronome) {
  const tabGroove = document.getElementById("tab-groove");
  const tabMet = document.getElementById("tab-metronome");
  const panelGroove = document.getElementById("panel-groove");
  const panelMet = document.getElementById("panel-metronome");

  if (!tabGroove || !tabMet || !panelGroove || !panelMet) {
    console.warn("⚠️ Mode tab elements not found in DOM");
    return;
  }

  function setTabEnabled(tabEl, enabled) {
    if (!tabEl) return;
    tabEl.classList.toggle("disabled", !enabled);
    tabEl.disabled = !enabled;
  }

  function setActiveMode(mode) {
    const owner =
      typeof sessionEngine.getActiveModeOwner === "function"
        ? sessionEngine.getActiveModeOwner()
        : null;

    // Enforce explicit ownership first
    if (owner === "groove") {
      tabGroove.classList.add("active");
      tabMet.classList.remove("active");
      panelGroove.classList.remove("hidden");
      panelMet.classList.add("hidden");
      setTabEnabled(tabGroove, true);
      setTabEnabled(tabMet, false);
      return;
    }

    if (owner === "simple") {
      tabMet.classList.add("active");
      tabGroove.classList.remove("active");
      panelMet.classList.remove("hidden");
      panelGroove.classList.add("hidden");
      setTabEnabled(tabMet, true);
      setTabEnabled(tabGroove, false);
      return;
    }

    // No owner — fall back to runtime checks
    const grooveRunning =
      typeof sessionEngine.isSessionActive === "function" &&
      sessionEngine.isSessionActive();
    const simpleRunning =
      typeof simpleMetronome.isRunning === "function" &&
      simpleMetronome.isRunning();

    if (grooveRunning || simpleRunning) {
      if (grooveRunning) {
        tabGroove.classList.add("active");
        panelGroove.classList.remove("hidden");
        tabMet.classList.remove("active");
        panelMet.classList.add("hidden");
        setTabEnabled(tabGroove, true);
        setTabEnabled(tabMet, false);
      } else {
        tabMet.classList.add("active");
        panelMet.classList.remove("hidden");
        tabGroove.classList.remove("active");
        panelGroove.classList.add("hidden");
        setTabEnabled(tabMet, true);
        setTabEnabled(tabGroove, false);
      }
      return;
    }

    // Normal switching when idle
    tabGroove.classList.toggle("active", mode === "groove");
    tabMet.classList.toggle("active", mode === "metronome");
    panelGroove.classList.toggle("hidden", mode !== "groove");
    panelMet.classList.toggle("hidden", mode !== "metronome");
    setTabEnabled(tabGroove, true);
    setTabEnabled(tabMet, true);

    // If we are switching to the groove panel, trigger a re-render of the slider marks
    if (mode === "groove") {
      setTimeout(() => {
        renderGrooveSliderMarks();
        const currentValues = grooveSlider.noUiSlider.get().map(Number);
        updateGrooveActiveTicks(currentValues[0], currentValues[1]);
      }, 0);
    }
    if (mode === "metronome") {
      setTimeout(() => {
        renderSimpleSliderMarks();
        const currentValue = Number(simpleSlider.noUiSlider.get());
        updateSimpleActiveTick(currentValue);
      }, 0);
    }
  }

  // click handlers
  tabGroove.addEventListener("click", (e) => {
    if (tabGroove.classList.contains("disabled")) return;
    setActiveMode("groove");
  });
  tabMet.addEventListener("click", (e) => {
    if (tabMet.classList.contains("disabled")) return;
    setActiveMode("metronome");
  });

  // initial mode
  setActiveMode("groove");

  // respond to owner changes
  document.addEventListener("metronome:ownerChanged", (e) => {
    const owner = e?.detail?.owner;
    if (owner === "groove") {
      tabGroove.classList.add("active");
      panelGroove.classList.remove("hidden");
      tabMet.classList.remove("active");
      panelMet.classList.add("hidden");
      setTabEnabled(tabGroove, true);
      setTabEnabled(tabMet, false);
    } else if (owner === "simple") {
      tabMet.classList.add("active");
      panelMet.classList.remove("hidden");
      tabGroove.classList.remove("active");
      panelGroove.classList.add("hidden");
      setTabEnabled(tabMet, true);
      setTabEnabled(tabGroove, false);
    } else {
      setTabEnabled(tabGroove, true);
      setTabEnabled(tabMet, true);
    }
  });
}

// UI: footer / version display helper
// footerEl: DOM element for version display (can be obtained by caller or will be looked up internally)
// appVersion: version string (e.g. "v1.2.3")
// versionColor: hex color (string) to apply to version text
// status: optional status text, default "✅ Cached Offline"
export function updateFooterMessage(
  footerEl,
  appVersion,
  versionColor,
  status = "✅ Cached Offline"
) {
  // If caller didn't pass a footer element, try to find it
  if (!footerEl) footerEl = document.getElementById("VersionNumber");
  const messageKey = (s) =>
    s && s.includes("Update") ? "updateMsgCount" : "cachedMsgCount";

  const key = messageKey(status);
  const shownCount = parseInt(localStorage.getItem(key)) || 0;
  const suppressMessage = shownCount >= 3;

  // Defensive: if we don't have an appVersion yet, show a simple placeholder
  const versionText = appVersion || "";

  if (!footerEl) return;

  const fullText = suppressMessage
    ? `🎵 Random Groove Trainer <span style="color:${versionColor}">${versionText}</span>`
    : `🎵 Random Groove Trainer — ${status} <span style="color:${versionColor}">${versionText}</span>`;

  footerEl.innerHTML = fullText;

  // Step 1: Set initial hidden state
  footerEl.style.opacity = "0";
  footerEl.style.visibility = "hidden";
  footerEl.style.transition = "opacity 1.2s ease";

  // Force style flush so transition runs
  void footerEl.offsetWidth;

  // Step 2: Trigger fade-in
  footerEl.style.visibility = "visible";
  footerEl.style.opacity = "0.9";

  // Step 3: Fade out after 5 seconds
  setTimeout(() => {
    footerEl.style.opacity = "0";

    setTimeout(() => {
      footerEl.classList.add("footer-hidden");
      footerEl.style.visibility = "hidden";
    }, 600); // match transition duration
  }, 5000);

  if (!suppressMessage) {
    localStorage.setItem(key, shownCount + 1);
  }
  if (typeof window !== "undefined")
    window.updateFooterMessage = updateFooterMessage;
}

// =====================================
// Time Signature UI Initialization
// =====================================

export function initTimeSignatureUI() {
  // --- Helper function to wire up one set of controls ---
  const setupControls = (panelPrefix) => {
    const presetSelect = document.getElementById(`${panelPrefix}PresetSelect`);
    const customContainer = document.getElementById(
      `${panelPrefix}CustomTimeSignature`
    );
    const customNumerator = document.getElementById(
      `${panelPrefix}CustomNumerator`
    );
    const customDenominator = document.getElementById(
      `${panelPrefix}CustomDenominator`
    );
    const subdivisionContainer = document.getElementById(
      `${panelPrefix}SubdivisionContainer`
    );
    const subdivisionSelect = document.getElementById(
      `${panelPrefix}SubdivisionSelect`
    );

    // Determine which metronome core to control
    const core =
      panelPrefix === "groove" ? window.metronome : window.simpleMetronome.core;
    if (!core) {
      console.error(`Metronome core not found for prefix: ${panelPrefix}`);
      return;
    }

    // --- Main handler to update the metronome state ---
    const updateMetronomeState = () => {
      let beats, value;
      const presetValue = presetSelect.value;

      if (presetValue === "custom") {
        customContainer.classList.remove("hidden");
        beats = parseInt(customNumerator.value, 10);
        value = parseInt(customDenominator.value, 10);
      } else {
        customContainer.classList.add("hidden");
        [beats, value] = presetValue.split("/").map(Number);
      }

      core.setTimeSignature(beats, value);

      const updatedSignature = core.getTimeSignature();

      // Show/hide subdivision dropdown based on denominator
      if (updatedSignature.value === 4) {
        subdivisionContainer.classList.remove("hidden");
      } else {
        subdivisionContainer.classList.add("hidden");
        subdivisionSelect.value = "1";
        core.setTicksPerBeat(1);
      }
    };

    // --- Subdivision handler ---
    const updateSubdivision = () => {
      const multiplier = parseInt(subdivisionSelect.value, 10);
      core.setTicksPerBeat(multiplier);
    };

    // --- Attach Event Listeners ---
    presetSelect.addEventListener("change", updateMetronomeState);
    customNumerator.addEventListener("change", updateMetronomeState);
    customDenominator.addEventListener("change", updateMetronomeState);
    subdivisionSelect.addEventListener("change", updateSubdivision);

    // --- Initial setup call on load ---
    updateMetronomeState();
  };

  // --- Initialize both sets of controls ---
  setupControls("groove");
  setupControls("simple");
}

export function initUpdateUI() {
  const checkUpdatesBtn = document.getElementById("checkUpdatesBtn");
  const footerEl = document.getElementById("VersionNumber");
  if (!footerEl || !checkUpdatesBtn) return;

  // --- Hide footer when clicking outside it ---
  document.addEventListener("click", (event) => {
    if (!footerEl || footerEl.classList.contains("footer-hidden")) return;
    const clickedElement = event.target;
    if (clickedElement.id === "checkUpdatesBtn") return;
    footerEl.style.opacity = "0";
    setTimeout(() => {
      footerEl.classList.add("footer-hidden");
      footerEl.style.visibility = "hidden";
    }, 600);
  });

  // --- Check updates button (manual fetch + UI) ---
  checkUpdatesBtn.addEventListener("click", () => {
    const start = performance.now();
    let spinnerShown = false;

    // 🔌 Offline detection
    if (!navigator.onLine) {
      footerEl.innerHTML = `⚠️ You're offline — cannot check for updates`;
      footerEl.style.opacity = "0";
      footerEl.style.visibility = "hidden";
      void footerEl.offsetWidth;
      footerEl.style.visibility = "visible";
      footerEl.style.opacity = "0.9";

      setTimeout(() => {
        footerEl.style.opacity = "0";
        setTimeout(() => {
          footerEl.classList.add("footer-hidden");
          footerEl.style.visibility = "hidden";
        }, 600);
      }, 5000);
      return;
    }

    // Show spinner if fetch takes longer than 300ms
    const spinnerTimeout = setTimeout(() => {
      checkUpdatesBtn.classList.add("loading");
      spinnerShown = true;
    }, 300);

    fetch("./commits.json", { cache: "no-store" })
      .then((res) => res.json())
      .then(({ latestHash, version }) => {
        clearTimeout(spinnerTimeout);
        const elapsed = performance.now() - start;

        const finish = () => {
          const storedHash = localStorage.getItem("lastSeenHash");
          const storedVersion = localStorage.getItem("lastSeenVersion");
          const isNewVersion =
            version !== storedVersion || latestHash !== storedHash;

          if (isNewVersion) {
            localStorage.setItem("lastSeenVersion", version);
            localStorage.setItem("lastSeenHash", latestHash);

            footerEl.innerHTML = `⟳ Update available — refreshing shortly...
              <button id="cancelReloadBtn" class="update-button">Cancel</button>`;

            footerEl.style.opacity = "0";
            footerEl.style.visibility = "hidden";
            void footerEl.offsetWidth;
            footerEl.style.visibility = "visible";
            footerEl.style.opacity = "0.9";

            const reloadTimeout = setTimeout(() => {
              location.reload();
            }, 5000);

            const cancelBtn = document.getElementById("cancelReloadBtn");
            if (cancelBtn) {
              cancelBtn.addEventListener("click", () => {
                clearTimeout(reloadTimeout);
                footerEl.innerHTML = `⟳ Update available — refresh canceled`;
                setTimeout(() => {
                  footerEl.style.opacity = "0";
                  setTimeout(() => {
                    footerEl.classList.add("footer-hidden");
                    footerEl.style.visibility = "hidden";
                  }, 600);
                }, 4000);
              });
            }
          } else {
            footerEl.innerHTML = `⟳ You're already on the latest version`;
            footerEl.style.opacity = "0";
            footerEl.style.visibility = "hidden";
            void footerEl.offsetWidth;
            footerEl.style.visibility = "visible";
            footerEl.style.opacity = "0.9";

            setTimeout(() => {
              footerEl.style.opacity = "0";
              setTimeout(() => {
                footerEl.classList.add("footer-hidden");
                footerEl.style.visibility = "hidden";
              }, 600);
            }, 5000);
          }

          if (spinnerShown) {
            setTimeout(() => {
              checkUpdatesBtn.classList.remove("loading");
            }, 300); // keep spinner visible briefly
          }
        };

        if (spinnerShown) {
          setTimeout(finish, 300); // ensure spinner stays visible
        } else {
          finish();
        }
      })
      .catch((err) => {
        clearTimeout(spinnerTimeout);
        console.warn("Manual update check failed:", err);

        const showError = () => {
          footerEl.innerHTML = `⚠️ Could not check for updates — network error`;
          footerEl.style.opacity = "0";
          footerEl.style.visibility = "hidden";
          void footerEl.offsetWidth;
          footerEl.style.visibility = "visible";
          footerEl.style.opacity = "0.9";

          setTimeout(() => {
            footerEl.style.opacity = "0";
            setTimeout(() => {
              footerEl.classList.add("footer-hidden");
              footerEl.style.visibility = "hidden";
            }, 600);
          }, 5000);

          if (spinnerShown) {
            setTimeout(() => {
              checkUpdatesBtn.classList.remove("loading");
            }, 300);
          }
        };

        if (spinnerShown) {
          setTimeout(showError, 300);
        } else {
          showError();
        }
      });
  });
}

// =============================================================
// Input Validation Logic (strict numeric enforcement)
// =============================================================

// Define input constraints per field (from index.html)
const INPUT_LIMITS = {
  bpmMin: { min: 5, max: 300, defaultValue: 30 },
  bpmMax: { min: 5, max: 300, defaultValue: 60 },
  cycleDuration: { min: 1, max: 9999, defaultValue: 60 },
  totalCycles: { min: 1, max: 9999, defaultValue: 5 },
  totalTime: { min: 1, max: 9999, defaultValue: 300 },
  simpleBpm: { min: 20, max: 300, defaultValue: 120 },

  // --- NEW VALIDATION RULES ---
  grooveCustomNumerator: { min: 1, max: 16, defaultValue: 4 },
  grooveCustomDenominator: {
    min: 2,
    max: 16,
    defaultValue: 4,
    allowed: [2, 4, 8, 16],
  },
  simpleCustomNumerator: { min: 1, max: 16, defaultValue: 4 },
  simpleCustomDenominator: {
    min: 2,
    max: 16,
    defaultValue: 4,
    allowed: [2, 4, 8, 16],
  },
};

// Validate and sanitize numeric input
function validateNumericInput(input) {
  const id = input.id;
  if (!(id in INPUT_LIMITS)) return;

  const limits = INPUT_LIMITS[id];
  let sanitized = utils.sanitizePositiveInteger(input.value, limits);

  // --- NEW: Custom validation for allowed denominator values ---
  if (limits.allowed && !limits.allowed.includes(sanitized)) {
    // Find the closest allowed value
    sanitized = limits.allowed.reduce((prev, curr) => {
      return Math.abs(curr - sanitized) < Math.abs(prev - sanitized)
        ? curr
        : prev;
    });
    showNotice(`Beat unit must be 2, 4, 8, or 16. Corrected to ${sanitized}.`);
  }

  input.value = sanitized;
  input.dataset.lastValidValue = sanitized;
}

// Attach validation for all relevant inputs
function attachInputValidation() {
  Object.keys(INPUT_LIMITS).forEach((id) => {
    const input = document.getElementById(id);
    if (!input) return;

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

    input.addEventListener("paste", (e) => {
      const text = (e.clipboardData || window.clipboardData).getData("text");
      const limits = INPUT_LIMITS[id];
      const cleaned = utils.sanitizePositiveInteger(text, limits);
      if (cleaned === limits.defaultValue && !/^[1-9]\\d*$/.test(text)) {
        e.preventDefault();
        input.classList.add("invalid-flash");
        setTimeout(() => input.classList.remove("invalid-flash"), 400);
      } else {
        e.preventDefault();
        input.value = cleaned;
        input.dataset.lastValidValue = cleaned;
      }
    });

    // Only block invalid characters while typing, do NOT sanitize on every keystroke
    input.addEventListener("input", (e) => {
      // Remember last valid numeric characters but don't sanitize/clamp yet
      if (!/^\d*$/.test(input.value)) {
        input.value = input.value.replace(/\D+/g, "");
      }
    });

    // Sanitize fully only after user finishes typing
    input.addEventListener("blur", () => validateNumericInput(input));

    // Initialize
    validateNumericInput(input);
  });

  // Groove BPM cross-check
  const minInput = document.getElementById("bpmMin");
  const maxInput = document.getElementById("bpmMax");
  if (minInput && maxInput) {
    const adjustGrooveBpm = () => {
      const minVal = Number(minInput.value);
      const maxVal = Number(maxInput.value);
      const margin = 5;

      if (minVal >= maxVal - margin + 1) {
        // Values violate margin - revert to last valid values
        minInput.value =
          minInput.dataset.lastValidValue || INPUT_LIMITS.bpmMin.defaultValue;
        maxInput.value =
          maxInput.dataset.lastValidValue || INPUT_LIMITS.bpmMax.defaultValue;

        // Show notice to user
        showNotice("BPM range must be at least 5 apart");
      } else {
        // Values are valid - update last valid values
        minInput.dataset.lastValidValue = minVal;
        maxInput.dataset.lastValidValue = maxVal;
      }
    };
    minInput.addEventListener("change", adjustGrooveBpm);
    maxInput.addEventListener("change", adjustGrooveBpm);
  }
}

// Ensure validation is attached after DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", attachInputValidation);
} else {
  attachInputValidation();
}

// Show a notice message for BPM quantization correction
export function showNotice(message, duration = 2000) {
  let notice = document.querySelector(".ui-notice");
  if (!notice) {
    notice = document.createElement("div");
    notice.className = "ui-notice";
    document.body.appendChild(notice);
  }

  // Reset and apply fade-in
  notice.textContent = message;
  notice.classList.remove("hidden", "fade-out");
  notice.classList.add("show", "fade-in");

  // Auto-hide with fade-out
  setTimeout(() => {
    notice.classList.remove("fade-in");
    notice.classList.add("fade-out");
    setTimeout(() => {
      notice.classList.remove("show");
      notice.classList.add("hidden");
    }, 500); // matches fade-out animation duration
  }, duration);
}

// =============================================================
// Groove Metronome Dual-thumb Slider
// =============================================================

// Define renderSliderMarks in the module scope so it can be called by other functions
let grooveSlider; // Declare slider in module scope too
let bpmMinInput, bpmMaxInput; // And inputs
let ignoreSliderUpdate = false;

// Helper for disabling the groove slider when session is running
function toggleGrooveSliderDisabled(disabled) {
  const sliderEl = document.getElementById("groove-slider");
  const sliderContainer = document.getElementById("groove-slider-container");

  if (sliderEl && sliderEl.noUiSlider) {
    if (disabled) {
      sliderEl.noUiSlider.disable();
      // Add visual feedback
      if (sliderContainer) {
        sliderContainer.classList.add("disabled");
      }
    } else {
      sliderEl.noUiSlider.enable();
      // Remove visual feedback
      if (sliderContainer) {
        sliderContainer.classList.remove("disabled");
      }
    }
  }
}

// Expose globally for sessionEngine.js to use
window.toggleGrooveSliderDisabled = toggleGrooveSliderDisabled;

// =======================================
// Groove Metronome Slider Marks & Ticks)
// =======================================
function renderGrooveSliderMarks() {
  const marksContainer = document.getElementById("slider-numbers");
  const ticksContainer = document.getElementById("groove-ticks-container");

  if (!grooveSlider || !marksContainer || !ticksContainer) return;

  const sliderMin = 30;
  const sliderMax = 300;
  const marks = [];
  for (let i = sliderMin; i <= sliderMax; i += 30) marks.push(i);

  // Clear previous content
  marksContainer.innerHTML = "";
  ticksContainer.innerHTML = "";

  const sliderRect = grooveSlider.getBoundingClientRect();
  const containerRect = grooveSlider.parentElement.getBoundingClientRect();
  const computed = window.getComputedStyle(grooveSlider);
  const padLeft = parseFloat(computed.paddingLeft) || 7;
  const padRight = parseFloat(computed.paddingRight) || padLeft;

  // Calculate the slider's position within its container
  const sliderLeftOffset = sliderRect.left - containerRect.left;
  const innerWidth = Math.max(0, sliderRect.width - padLeft - padRight);

  // Position containers relative to the slider's actual position
  const relativeOffset = sliderRect.width * 0.0029; // 0.29% of slider width
  marksContainer.style.left = `${
    sliderLeftOffset + padLeft + relativeOffset
  }px`;
  marksContainer.style.width = `${innerWidth}px`;
  ticksContainer.style.left = `${
    sliderLeftOffset + padLeft + relativeOffset
  }px`;
  ticksContainer.style.width = `${innerWidth}px`;

  const range = sliderMax - sliderMin;

  marks.forEach((value) => {
    const ratio = (value - sliderMin) / range;
    const percent = ratio * 100;

    // Create the number mark
    const span = document.createElement("span");
    span.textContent = value;
    span.className = "slider-mark";
    span.style.position = "absolute";
    span.style.left = `${percent}%`;
    span.style.transform = "translateX(-50%)";

    span.addEventListener("click", () => {
      const current = grooveSlider.noUiSlider.get().map(Number);
      const d0 = Math.abs(current[0] - value);
      const d1 = Math.abs(current[1] - value);
      const idx = d0 <= d1 ? 0 : 1;
      const newVals = [...current];
      newVals[idx] = value;
      grooveSlider.noUiSlider.set(newVals);
    });

    marksContainer.appendChild(span);

    // Create separate tick element
    const tick = document.createElement("div");
    tick.className = "groove-tick";
    tick.style.left = `${percent}%`;
    tick.style.transform = "translateX(-50%)";
    ticksContainer.appendChild(tick);
  });
}

// =======================================
// Simple Metronome Slider Marks & Ticks)
// =======================================

function renderSimpleSliderMarks() {
  const marksContainer = document.getElementById("simple-slider-numbers");
  const ticksContainer = document.getElementById("simple-ticks-container");

  if (!simpleSlider || !marksContainer || !ticksContainer) return;

  const sliderMin = 30;
  const sliderMax = 300;
  const marks = [];
  for (let i = sliderMin; i <= sliderMax; i += 30) marks.push(i);

  // Clear previous content
  marksContainer.innerHTML = "";
  ticksContainer.innerHTML = "";

  const sliderRect = simpleSlider.getBoundingClientRect();
  const containerRect = simpleSlider.parentElement.getBoundingClientRect();
  const computed = window.getComputedStyle(simpleSlider);
  const padLeft = parseFloat(computed.paddingLeft) || 7;
  const padRight = parseFloat(computed.paddingRight) || padLeft;

  // Calculate the slider's position within its container
  const sliderLeftOffset = sliderRect.left - containerRect.left;
  const innerWidth = Math.max(0, sliderRect.width - padLeft - padRight);

  // Position containers relative to the slider's actual position
  const relativeOffset = sliderRect.width * 0.0029; // 0.29% of slider width
  marksContainer.style.left = `${
    sliderLeftOffset + padLeft + relativeOffset
  }px`;
  marksContainer.style.width = `${innerWidth}px`;
  ticksContainer.style.left = `${
    sliderLeftOffset + padLeft + relativeOffset
  }px`;
  ticksContainer.style.width = `${innerWidth}px`;

  const range = sliderMax - sliderMin;

  marks.forEach((value) => {
    const ratio = (value - sliderMin) / range;
    const percent = ratio * 100;

    // Create the number mark
    const span = document.createElement("span");
    span.textContent = value;
    span.className = "slider-mark";
    span.style.position = "absolute";
    span.style.left = `${percent}%`;
    span.style.transform = "translateX(-50%)";

    // Add click handler for marks
    span.addEventListener("click", (event) => {
      event.stopPropagation();
      simpleSlider.noUiSlider.set(value);
    });

    marksContainer.appendChild(span);

    // Create separate tick element
    const tick = document.createElement("div");
    tick.className = "groove-tick";
    tick.style.left = `${percent}%`;
    tick.style.transform = "translateX(-50%)";

    // Add click handler for ticks
    tick.addEventListener("click", (event) => {
      event.stopPropagation();
      simpleSlider.noUiSlider.set(value);
    });

    ticksContainer.appendChild(tick);
  });
}

function updateSimpleActiveTick(currentValue) {
  const ticks = document.querySelectorAll(
    "#simple-ticks-container .groove-tick"
  );
  const marks = document.querySelectorAll(
    "#simple-slider-numbers .slider-mark"
  );

  // Remove active class from all
  ticks.forEach((tick) => tick.classList.remove("active"));
  marks.forEach((mark) => mark.classList.remove("active"));

  // If no marks, return
  if (marks.length === 0) return;

  // Find closest mark to current value
  let closestMark = null;
  let closestTick = null;
  let minDistance = Infinity;

  marks.forEach((mark, index) => {
    const markValue = parseInt(mark.textContent);
    const tick = ticks[index];
    const distance = Math.abs(markValue - currentValue);

    if (distance < minDistance) {
      minDistance = distance;
      closestMark = mark;
      closestTick = tick;
    }
  });

  // Highlight closest mark and tick
  if (closestMark && closestTick) {
    closestTick.classList.add("active");
    closestMark.classList.add("active");
  }
}

function updateGrooveActiveTicks(minVal, maxVal) {
  const ticks = document.querySelectorAll(".groove-tick");
  const marks = document.querySelectorAll(".slider-mark");

  // Remove active class from all
  ticks.forEach((tick) => tick.classList.remove("active"));
  marks.forEach((mark) => mark.classList.remove("active"));

  // If no marks, return
  if (marks.length === 0) return;

  // Find closest mark to min value
  let minClosest = null;
  let minDistance = Infinity;

  // Find closest mark to max value
  let maxClosest = null;
  let maxDistance = Infinity;

  marks.forEach((mark, index) => {
    const markValue = parseInt(mark.textContent);
    const tick = ticks[index];

    // Calculate distance to min thumb
    const distToMin = Math.abs(markValue - minVal);
    if (distToMin < minDistance) {
      minDistance = distToMin;
      minClosest = { mark, tick, index };
    }

    // Calculate distance to max thumb
    const distToMax = Math.abs(markValue - maxVal);
    if (distToMax < maxDistance) {
      maxDistance = distToMax;
      maxClosest = { mark, tick, index };
    }
  });

  // Highlight closest to min (if found)
  if (minClosest) {
    minClosest.tick.classList.add("active");
    minClosest.mark.classList.add("active");
  }

  // Highlight closest to max (if found and different from min)
  if (maxClosest && maxClosest.index !== minClosest?.index) {
    maxClosest.tick.classList.add("active");
    maxClosest.mark.classList.add("active");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  bpmMinInput = document.getElementById("bpmMin");
  bpmMaxInput = document.getElementById("bpmMax");
  grooveSlider = document.getElementById("groove-slider");

  const quantizeToStep = (value, step = 5) =>
    Math.round(Number(value) / step) * step;

  const defaultMin = parseInt(bpmMinInput.value) || 30;
  const defaultMax = parseInt(bpmMaxInput.value) || 60;

  noUiSlider.create(grooveSlider, {
    start: [defaultMin, defaultMax],
    connect: true,
    range: { min: 30, max: 300 },
    step: 5,
    margin: 5,
    tooltips: false,
    orientation: "horizontal",
  });

  grooveSlider.noUiSlider.on("update", (values, handle) => {
    // Skip update if we're in the middle of a hotkey adjustment
    if (ignoreSliderUpdate) return;

    const [minVal, maxVal] = values.map((v) => quantizeToStep(v));
    bpmMinInput.value = minVal;
    bpmMaxInput.value = maxVal;

    // Update active ticks
    updateGrooveActiveTicks(minVal, maxVal);
  });

  // Sync slider values to input fields
  function syncSliderToInputs() {
    const minVal = Math.max(
      5,
      Math.min(300, parseInt(bpmMinInput.value) || 30)
    );
    const maxVal = Math.max(
      5,
      Math.min(300, parseInt(bpmMaxInput.value) || 60)
    );

    grooveSlider.noUiSlider.set([minVal, maxVal]);

    // Visual feedback
    const handles = document.querySelectorAll(".noUi-handle");
    handles.forEach((handle) => {
      handle.classList.add("slider-update");
      setTimeout(() => handle.classList.remove("slider-update"), 300);
    });
  }

  // Listen for changes on both BPM input fields
  bpmMinInput.addEventListener("change", syncSliderToInputs);
  bpmMaxInput.addEventListener("change", syncSliderToInputs);

  // Optional: Also sync on input for real-time feedback (but might be too frequent)
  // bpmMinInput.addEventListener('input', syncSliderToInputs);
  // bpmMaxInput.addEventListener('input', syncSliderToInputs);

  // Initial render
  renderGrooveSliderMarks();
  updateGrooveActiveTicks(defaultMin, defaultMax);

  // Guarded resize listener - update both sliders when their panels are visible
  window.addEventListener("resize", () => {
    const groovePanel = document.getElementById("panel-groove");
    const simplePanel = document.getElementById("panel-metronome");

    if (groovePanel && !groovePanel.classList.contains("hidden")) {
      renderGrooveSliderMarks();
      const currentValues = grooveSlider.noUiSlider.get().map(Number);
      updateGrooveActiveTicks(currentValues[0], currentValues[1]);
    }

    if (simplePanel && !simplePanel.classList.contains("hidden")) {
      renderSimpleSliderMarks();
      const currentValue = Number(simpleSlider.noUiSlider.get());
      updateSimpleActiveTick(currentValue);
    }
  });
});

// =============================================================
// Simple Metronome Single-thumb Slider (noUiSlider) - STEP 1
// =============================================================

let simpleSlider; // Declare slider in module scope

function initSimpleMetronomeSlider() {
  const simpleSliderEl = document.getElementById("simpleMetronomeSlider");
  const simpleBpmInput = document.getElementById("simpleBpm");

  if (!simpleSliderEl || !simpleBpmInput) return;

  noUiSlider.create(simpleSliderEl, {
    start: [parseInt(simpleBpmInput.value) || 120],
    connect: true,
    range: {
      min: 30,
      max: 300,
    },
    step: 5,
    tooltips: false,
    orientation: "horizontal",
  });

  simpleSlider = simpleSliderEl;

  // Update BPM input when slider changes
  simpleSliderEl.noUiSlider.on("update", (values, handle) => {
    const bpmValue = Math.round(values[handle]);
    simpleBpmInput.value = bpmValue;

    // Update active ticks for simple slider
    updateSimpleActiveTick(bpmValue);
  });

  // Sync slider when BPM input changes
  simpleBpmInput.addEventListener("change", () => {
    const newBpm = utils.clamp(Number(simpleBpmInput.value), 30, 300);
    simpleSliderEl.noUiSlider.set(newBpm);
  });

  // Initial render of marks
  renderSimpleSliderMarks();

  // Initial active tick update
  const initialBpm = parseInt(simpleBpmInput.value) || 120;
  updateSimpleActiveTick(initialBpm);

  console.log("Simple metronome noUiSlider initialized with marks");
}

// Helper for disabling the simple slider when metronome is running
function toggleSimpleSliderDisabled(disabled) {
  const sliderEl = document.getElementById("simpleMetronomeSlider");
  const sliderContainer = document.getElementById("simple-slider-container");
  const sliderWrapper = document.querySelector(
    "#panel-metronome .bpm-slider-wrapper"
  );

  if (sliderEl && sliderEl.noUiSlider) {
    if (disabled) {
      sliderEl.noUiSlider.disable();
      // Add visual feedback to both container and wrapper
      if (sliderContainer) {
        sliderContainer.classList.add("disabled");
      }
      if (sliderWrapper) {
        sliderWrapper.style.opacity = "0.5";
        sliderWrapper.style.cursor = "not-allowed";
      }
    } else {
      sliderEl.noUiSlider.enable();
      // Remove visual feedback from both container and wrapper
      if (sliderContainer) {
        sliderContainer.classList.remove("disabled");
      }
      if (sliderWrapper) {
        sliderWrapper.style.opacity = "1.0";
        sliderWrapper.style.cursor = "pointer";
      }
    }
  }
}

// Expose globally for simpleMetronome.js to use
window.toggleSimpleSliderDisabled = toggleSimpleSliderDisabled;

// Call the initialization
document.addEventListener("DOMContentLoaded", () => {
  initSimpleMetronomeSlider();
});
