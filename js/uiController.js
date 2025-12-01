// uiController.js
// Depends on metronomeCore functions passed in at init.

import { debugLog } from "./debug.js";
import {
  INPUT_LIMITS,
  getUserQuantizationPreference,
  VISUAL_TIMING,
} from "./constants.js";
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
  if (!window.QUANTIZATION)
    window.QUANTIZATION = { groove: getUserQuantizationPreference() };

  // Auto-correct using utils.sanitizeQuantizationStep
  const safeGroove = utils.sanitizeQuantizationStep(window.QUANTIZATION.groove);
  if (safeGroove !== window.QUANTIZATION.groove) {
    debugLog(
      "state",
      `⚠️ Corrected invalid QUANTIZATION.groove from ${window.QUANTIZATION.groove} → ${safeGroove}`
    );
    window.QUANTIZATION.groove = safeGroove;
  }
}

// =========================
// 🌙 Dark Mode Toggle
// =========================

export function initDarkMode() {
  const btn = document.querySelector(".theme-btn");
  const sunIcon = document.querySelector(".sun-svg");
  const moonIcon = document.querySelector(".moon-svg");

  if (!btn || !sunIcon || !moonIcon) {
    debugLog("state", "⚠️ Dark mode button elements not found in DOM");
    return;
  }

  // Detect system preference
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  // Check localStorage for saved preference
  const saved = localStorage.getItem("darkMode");

  // Determine initial state
  let isDark;
  if (saved === null) {
    // First visit - use system preference
    isDark = prefersDark;
    localStorage.setItem("darkMode", isDark ? "true" : "false");
  } else {
    isDark = saved === "true";
  }

  // Apply initial theme (inline script already set data-theme, just verify icons)
  document.documentElement.setAttribute(
    "data-theme",
    isDark ? "dark" : "light"
  );

  debugLog(
    "state",
    `🌙 Dark mode initialized: ${isDark ? "ON" : "OFF"} (${
      saved !== null ? "saved preference" : "system default"
    })`
  );

  // Click handler
  btn.addEventListener("click", () => {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const newIsDark = currentTheme !== "dark";

    // Add spin animation to active icon
    const activeIcon = newIsDark ? moonIcon : sunIcon;
    activeIcon.classList.add("animated");

    // Toggle theme
    document.documentElement.setAttribute(
      "data-theme",
      newIsDark ? "dark" : "light"
    );
    localStorage.setItem("darkMode", newIsDark ? "true" : "false");

    debugLog("state", `🌙 Dark mode toggled: ${newIsDark ? "ON" : "OFF"}`);

    // Remove animation after it completes
    setTimeout(() => {
      activeIcon.classList.remove("animated");
    }, 500);
  });

  // Listen for system preference changes
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", (e) => {
      // Only auto-switch if user hasn't manually set preference
      const saved = localStorage.getItem("darkMode");
      if (saved === null) {
        document.documentElement.setAttribute(
          "data-theme",
          e.matches ? "dark" : "light"
        );
        debugLog(
          "state",
          `🌙 Dark mode auto-switched to system preference: ${
            e.matches ? "ON" : "OFF"
          }`
        );
      }
    });
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
    debugLog(
      "state",
      `⚠️ Quantization groove corrected to safe value: ${safeGroove}`
    );
  }

  return {
    groove: getUserQuantizationPreference(),
  };
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
    debugLog("state", "⚠️ Start button not found for ownership guard");
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
        debugLog(
          "ownership",
          `🚫 Cannot start Groove metronome — current owner: ${owner}`
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
    setTimeout(() => (_hotkeyLock = false), VISUAL_TIMING.HOTKEY_LOCK_MS);
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
    setTimeout(
      () => adj.classList.remove("bpm-flash"),
      VISUAL_TIMING.FLASH_DURATION_MS
    );
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
    setTimeout(
      () => el.classList.remove("bpm-flash"),
      VISUAL_TIMING.BPM_CHANGE_FLASH_MS
    );
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };

  debugLog(
    "hotkeys",
    `Key pressed: ${code}, owner: ${owner}, target: ${target}`
  );
  switch (code) {
    case "Space":
      debugLog("hotkeys", `Space pressed - ${target} mode`);
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
      debugLog("hotkeys", `P pressed - ${target} mode`);
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
      debugLog("hotkeys", `N pressed - ${target} mode`);
      if (grooveNextBtn && !grooveNextBtn.disabled) grooveNextBtn.click();
      break;

    case "KeyH":
      debugLog("hotkeys", `H pressed - ${target} mode`);
      document.dispatchEvent(new Event("toggleTooltip"));
      break;

    case "ArrowRight":
    case "ArrowLeft": {
      // ✅ GUARD: Only allow target switching in Groove mode
      const groovePanel = document.getElementById("panel-groove");
      const isGrooveVisible =
        groovePanel && !groovePanel.classList.contains("hidden");

      if (!isGrooveVisible) {
        debugLog("hotkeys", `⚠️ Left/Right arrow blocked - not in Groove mode`);
        return;
      }

      const newTarget = code === "ArrowRight" ? "max" : "min";
      window.__adjustingTarget = newTarget;
      debugLog(
        "hotkeys",
        `🎚️ Adjusting target: ${newTarget.toUpperCase()} BPM`
      );
      break;
    }

    case "ArrowUp":
    case "ArrowDown": {
      // ✅ GUARD: Block BPM changes during playback
      const owner = sessionEngine.getActiveModeOwner();
      if (owner) {
        debugLog("hotkeys", `⚠️ BPM adjustment blocked - ${owner} is active`);
        showNotice("⚠️ Cannot adjust BPM during playback");
        return;
      }

      const delta = code === "ArrowUp" ? +1 : -1;
      if (target === "groove") adjustGrooveInput(delta);
      else adjustSimpleBpm(delta);
      break;
    }
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
      debugLog("state", "tempoSyncedCountIn set to", tempoSynced);
    };
  } else {
    debugLog(
      "state",
      "⚠️ tempoSyncedToggle not found in DOM — count-in preference will still work but no UI toggle is available."
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
    debugLog("state", "⚠️ Sound profile dropdowns not found in DOM");
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
    debugLog("state", `🎚 Sound profile set to: ${profileName}`);
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

// -----------------------------
// 🎧 Panning Mode Toggles
// -----------------------------
/**
 * Initialize panning mode toggles for both groove and simple panels.
 * Keeps toggles synchronized and persists preference.
 */
export function initPanningModeUI() {
  const grooveToggle = document.getElementById("intelligentPanningToggle");
  const simpleToggle = document.getElementById(
    "intelligentPanningToggleSimple"
  );

  if (!grooveToggle || !simpleToggle) {
    debugLog("state", "⚠️ Panning mode toggles not found in DOM");
    return;
  }

  // Load persisted preference (default: true = intelligent)
  const stored = localStorage.getItem("intelligentPanningMode");
  // Validate stored value - only accept "true" or "false"
  const isValidStored = stored === "true" || stored === "false";
  const intelligentPanning = isValidStored ? stored === "true" : true;

  // If corrupted, fix it immediately
  if (!isValidStored && stored !== null) {
    debugLog(
      "state",
      "⚠️ Corrupted intelligentPanningMode value, resetting to default (true)"
    );
    localStorage.setItem("intelligentPanningMode", "true");
  }

  // Initialize both toggles
  grooveToggle.checked = intelligentPanning;
  simpleToggle.checked = intelligentPanning;

  // Sync function
  function syncToggles(sourceValue) {
    grooveToggle.checked = sourceValue;
    simpleToggle.checked = sourceValue;
    localStorage.setItem(
      "intelligentPanningMode",
      sourceValue ? "true" : "false"
    );

    // Dispatch event for visuals.js to listen to
    document.dispatchEvent(
      new CustomEvent("panningModeChanged", {
        detail: { intelligent: sourceValue },
      })
    );

    debugLog(
      "state",
      `🎯 Panning mode: ${sourceValue ? "Intelligent" : "Forced"}`
    );
  }

  // Wire up listeners
  grooveToggle.addEventListener("change", () =>
    syncToggles(grooveToggle.checked)
  );
  simpleToggle.addEventListener("change", () =>
    syncToggles(simpleToggle.checked)
  );

  // Disable toggles during playback
  document.addEventListener("metronome:ownerChanged", (e) => {
    const owner = e?.detail?.owner;
    const isPlaying = owner !== null;
    grooveToggle.disabled = isPlaying;
    simpleToggle.disabled = isPlaying;
  });
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
    debugLog(
      "state",
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
      debugLog(
        "state",
        `🚫 Cannot start simple metronome while ${owner} is active`
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
        debugLog("hotkeys", "⚠️ Tap tempo only works when stopped or paused");
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

        debugLog("state", `🎯 Tap Tempo BPM set to ${newBpm}`);
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
    debugLog("state", "⚠️ Mode tab elements not found in DOM");
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

    // ✅ CLEANUP: We removed the manual render calls here.
    // Native noUiSlider handles its own rendering when the container becomes visible.
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
    }, VISUAL_TIMING.FOOTER_FADE_OUT_MS); // match transition duration
  }, VISUAL_TIMING.FOOTER_DISPLAY_MS);

  if (!suppressMessage) {
    localStorage.setItem(key, shownCount + 1);
  }
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
      panelPrefix === "groove" ? window.metronome : simpleMetronome.core;
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
    }, VISUAL_TIMING.FOOTER_FADE_OUT_MS);
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
        }, VISUAL_TIMING.FOOTER_FADE_OUT_MS);
      }, VISUAL_TIMING.FOOTER_DISPLAY_MS);
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
                  }, VISUAL_TIMING.FOOTER_FADE_OUT_MS);
                }, VISUAL_TIMING.FOOTER_CANCELED_DISPLAY_MS);
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
              }, VISUAL_TIMING.FOOTER_FADE_OUT_MS);
            }, VISUAL_TIMING.FOOTER_DISPLAY_MS);
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
        debugLog("state", `⚠️ Manual update check failed: ${err.message}`);

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
            }, VISUAL_TIMING.FOOTER_FADE_OUT_MS);
          }, VISUAL_TIMING.FOOTER_DISPLAY_MS);

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
        setTimeout(
          () => input.classList.remove("invalid-flash"),
          VISUAL_TIMING.INVALID_INPUT_FLASH_MS
        );
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
// 🎚️ Unified Native Metronome Slider Factory
// =============================================================

/**
 * Creates a slider using native noUiSlider pips.
 * Handles both Single (Simple) and Dual (Groove) sliders.
 */

let grooveSliderInstance = null;
let simpleSliderInstance = null;

function createMetronomeSlider(elementId, config) {
  const sliderEl = document.getElementById(elementId);
  if (!sliderEl) return null;

  // Safety: Destroy existing instance
  if (sliderEl.noUiSlider) sliderEl.noUiSlider.destroy();

  noUiSlider.create(sliderEl, {
    start: config.start,
    connect: config.connect,
    range: { min: 30, max: 300 },
    step: 5,
    margin: 5, // Safety margin (ignored if single handle)
    animate: true,
    animationDuration: 300,
    tooltips: false,

    // ✅ NATIVE PIPS
    pips: {
      mode: "values",
      values: [30, 60, 90, 120, 150, 180, 210, 240, 270, 300],
      density: 100,
      stepped: false,
      filter: () => 1,
    },
  });
  if (elementId === "groove-slider") {
    grooveSliderInstance = sliderEl.noUiSlider;
  } else {
    simpleSliderInstance = sliderEl.noUiSlider;
  }
  // 🎨 Active Pip Highlighter
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

  // 🖱️ CLICK HANDLER (ADAPTED FROM OLD IMPLEMENTATION)
  const pips = sliderEl.querySelectorAll(".noUi-value");
  pips.forEach((pip) => {
    pip.addEventListener("click", function (e) {
      e.stopPropagation();
      const value = Number(this.getAttribute("data-value"));

      // Get raw values from slider
      const rawValues = sliderEl.noUiSlider.get();

      // CHECK: Is this a Range (Array) or Single (Number)?
      if (Array.isArray(rawValues)) {
        // --- LOGIC PORTED FROM YOUR OLD IMPLEMENTATION ---
        const current = rawValues.map(Number); // Ensure numbers: [30, 60]

        const d0 = Math.abs(current[0] - value); // Dist to min
        const d1 = Math.abs(current[1] - value); // Dist to max

        // If d0 is closer (or equal), move handle 0. Otherwise move handle 1.
        const idx = d0 <= d1 ? 0 : 1;

        const newVals = [...current];
        newVals[idx] = value; // Update only the target handle

        sliderEl.noUiSlider.set(newVals);
        // -------------------------------------------------
      } else {
        // Simple Slider (Single Handle)
        sliderEl.noUiSlider.set(value);
      }
    });
  });

  // Update Listener
  sliderEl.noUiSlider.on("update", (values, handle) => {
    updateActivePips(values);
    if (config.onUpdate) config.onUpdate(values, handle);
  });

  return sliderEl;
}

// =============================================================
// 🚀 Initialization & Global Helpers
// =============================================================

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

document.addEventListener("DOMContentLoaded", () => {
  // 1. Groove Slider (Range)
  const minInput = document.getElementById("bpmMin");
  const maxInput = document.getElementById("bpmMax");

  if (minInput && maxInput) {
    const grooveSlider = createMetronomeSlider("groove-slider", {
      start: [parseInt(minInput.value) || 30, parseInt(maxInput.value) || 60],
      connect: true,
      onUpdate: (values) => {
        minInput.value = Math.round(values[0]);
        maxInput.value = Math.round(values[1]);
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
        simpleInput.value = Math.round(values[0]);
      },
    });

    simpleInput.addEventListener("change", () => {
      if (simpleSlider && simpleSlider.noUiSlider) {
        simpleSlider.noUiSlider.set(simpleInput.value);
      }
    });
  }
});

/**
 * Updates BPM input step attributes based on user preference
 * TODO: Call this when user changes quantization setting in future
 */
export function updateBpmInputSteps() {
  const step = getUserQuantizationPreference();

  const inputs = [
    document.getElementById("bpmMin"),
    document.getElementById("bpmMax"),
    document.getElementById("simpleBpm"),
  ];

  inputs.forEach((input) => {
    if (input?.hasAttribute("data-dynamic-step")) {
      input.setAttribute("step", step);
    }
  });

  // Also update noUiSlider configurations if they support dynamic step
  // TODO: Research if noUiSlider supports runtime step changes
  debugLog("state", `Updated BPM input steps to ${step}`);
}
