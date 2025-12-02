/**
 * @fileoverview Mode tabs and simple metronome panel controls.
 * Manages groove/simple panel switching and simple metronome UI state.
 * 
 * @module ui/panels
 */

import { debugLog } from "../debug.js";
import * as sessionEngine from "../sessionEngine.js";
import * as simpleMetronome from "../simpleMetronome.js";
import * as utils from "../utils.js";

/**
 * Enables/disables a mode tab.
 * 
 * @private
 * @param {HTMLElement} tabEl - Tab element
 * @param {boolean} enabled - True to enable, false to disable
 * @returns {void}
 */
function setTabEnabled(tabEl, enabled) {
  if (!tabEl) return;
  tabEl.classList.toggle("disabled", !enabled);
  tabEl.disabled = !enabled;
}

/**
 * Sets active mode and updates panel visibility.
 * 
 * @private
 * @param {string} mode - 'groove' or 'metronome'
 * @param {HTMLElement} tabGroove - Groove tab element
 * @param {HTMLElement} tabMet - Metronome tab element
 * @param {HTMLElement} panelGroove - Groove panel element
 * @param {HTMLElement} panelMet - Metronome panel element
 * @returns {void}
 */
function setActiveMode(mode, tabGroove, tabMet, panelGroove, panelMet) {
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
}

/**
 * Initializes mode tabs (Groove vs Metronome).
 * Handles tab switching and ownership-based tab disabling.
 * 
 * @param {Object} sessionEngine - Session engine module
 * @param {Object} simpleMetronome - Simple metronome module
 * @returns {void}
 * 
 * @example
 * initModeTabs(sessionEngine, simpleMetronome);
 */
export function initModeTabs(sessionEngine, simpleMetronome) {
  const tabGroove = document.getElementById("tab-groove");
  const tabMet = document.getElementById("tab-metronome");
  const panelGroove = document.getElementById("panel-groove");
  const panelMet = document.getElementById("panel-metronome");

  if (!tabGroove || !tabMet || !panelGroove || !panelMet) {
    debugLog("state", "⚠️ Mode tab elements not found in DOM");
    return;
  }

  // Click handlers
  tabGroove.addEventListener("click", (e) => {
    if (tabGroove.classList.contains("disabled")) return;
    setActiveMode("groove", tabGroove, tabMet, panelGroove, panelMet);
  });
  
  tabMet.addEventListener("click", (e) => {
    if (tabMet.classList.contains("disabled")) return;
    setActiveMode("metronome", tabGroove, tabMet, panelGroove, panelMet);
  });

  // Initial mode
  setActiveMode("groove", tabGroove, tabMet, panelGroove, panelMet);

  // Respond to owner changes
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

/**
 * Updates simple metronome UI state.
 * 
 * @private
 * @returns {void}
 */
function updateSimpleUI() {
  const running =
    typeof simpleMetronome.isRunning === "function" &&
    simpleMetronome.isRunning();
  const paused =
    typeof simpleMetronome.isPaused === "function" &&
    simpleMetronome.isPaused();

  const startBtn = document.getElementById("simpleStartBtn");
  const pauseBtn = document.getElementById("simplePauseBtn");
  const tapBtn = document.getElementById("tapTempoBtn");

  if (startBtn) {
    startBtn.textContent = running ? "Stop" : "Start";
    startBtn.disabled = false;
  }
  
  if (pauseBtn) {
    pauseBtn.disabled = !running;
    pauseBtn.textContent = paused ? "Resume" : "Pause";
  }

  // Tap Tempo button: only active when fully stopped
  if (tapBtn) {
    const isRunning = simpleMetronome.isRunning?.();
    const isPaused = simpleMetronome.isPaused?.();
    tapBtn.disabled = isRunning || isPaused;
  }
}

/**
 * Initializes simple metronome panel controls.
 * Handles start/stop/pause buttons and tap tempo.
 * 
 * @returns {void}
 * 
 * @example
 * initSimplePanelControls(); // Sets up simple metronome UI
 */
export function initSimplePanelControls() {
  const startBtn = document.getElementById("simpleStartBtn");
  const pauseBtn = document.getElementById("simplePauseBtn");
  const bpmEl = document.getElementById("simpleBpm");
  const tapBtn = document.getElementById("tapTempoBtn");

  if (!startBtn) {
    debugLog(
      "state",
      "⚠️ simpleStartBtn not found; check DOM ID or ensure this script runs after the element."
    );
    return;
  }

  // Start/Stop button
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

  // Pause/Resume button
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

  // Tap Tempo button
  if (tapBtn) {
    tapBtn.classList.remove("tap-pulse");

    tapBtn.addEventListener("click", () => {
      const isRunning = simpleMetronome.isRunning?.();
      const isPaused = simpleMetronome.isPaused?.();
      
      if (isRunning && !isPaused) {
        debugLog("hotkeys", "⚠️ Tap tempo only works when stopped or paused");
        return;
      }

      // Animate tap button
      tapBtn.classList.remove("tap-pulse");
      void tapBtn.offsetWidth;
      tapBtn.classList.add("tap-pulse");

      // Calculate tempo from taps
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

  // Listen for state changes
  document.addEventListener("simpleMetronome:state", (ev) => {
    updateSimpleUI();
  });

  document.addEventListener("metronome:ownerChanged", () => {
    setTimeout(updateSimpleUI, 0);
  });

  // Initialize UI
  updateSimpleUI();
}
