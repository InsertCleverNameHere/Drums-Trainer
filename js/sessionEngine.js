// sessionEngine.js
// Handles session lifecycle, cycle timing, countdowns, and button state logic

// === Imports ===
import * as utils from "./utils.js";
import * as visuals from "./visuals.js";
import { showNotice } from "./uiController.js";
import { debugLog } from "./debug.js";

let activeModeOwner = null; // "groove" | "simple" | null

/**
 * Sets the active mode owner (groove/simple/null).
 * Dispatches 'metronome:ownerChanged' event.
 *
 * @param {string|null} owner - 'groove', 'simple', or null
 * @returns {void}
 */
export function setActiveModeOwner(owner) {
  const newOwner = owner || null;

  // ✅ Only change if different (prevents spam)
  if (newOwner === activeModeOwner) {
    return; // No-op, don't dispatch event
  }

  const previous = activeModeOwner;
  activeModeOwner = newOwner;

  debugLog("ownership", `Owner changed: ${previous} → ${activeModeOwner}`);

  // dispatch a DOM event so other code can react immediately
  document.dispatchEvent(
    new CustomEvent("metronome:ownerChanged", {
      detail: { owner: activeModeOwner },
    })
  );
}

/**
 * Returns the current mode owner.
 *
 * @returns {string|null} 'groove', 'simple', or null
 */
export function getActiveModeOwner() {
  return activeModeOwner;
}

// === Internal State ===
let metronome = {};
let ui = {};
let sessionConfig = {};
let timers = {};
let flags = {};

/**
 * Initializes the session engine with metronome and UI dependencies.
 *
 * @param {Object} deps - Dependency injection object
 * @param {Object} deps.metronome - Metronome core functions
 * @param {Object} deps.ui - UI element references
 * @returns {void}
 */
export function initSessionEngine(deps) {
  // Store injected dependencies
  metronome = deps.metronome;
  ui = deps.ui;

  // Config options
  sessionConfig = {
    tempoSynced: false,
  };

  // Session state flags
  flags = {
    sessionActive: false,
    isPaused: false,
    isCountingIn: false,
    isFinishingBar: false,
    sessionEnding: false,
    cyclesDone: 0,
    remaining: 0,
    pausedRemaining: 0,
    sessionRemaining: 0,
  };

  // Timer handles
  timers = {
    activeTimer: null,
    sessionTimer: null,
    sessionInterval: null,
    visualCountdownTimer: null,
  };

  // Read persisted tempoSynced preference
  const stored = localStorage.getItem("tempoSyncedCountIn");
  sessionConfig.tempoSynced = stored === null ? false : stored === "true";

  // Wire checkbox if present
  const checkbox = document.getElementById("tempoSyncedToggle");
  if (checkbox) {
    checkbox.checked = sessionConfig.tempoSynced;
    checkbox.onchange = () => {
      sessionConfig.tempoSynced = !!checkbox.checked;
      localStorage.setItem(
        "tempoSyncedCountIn",
        sessionConfig.tempoSynced ? "true" : "false"
      );
      debugLog(
        "state",
        `tempoSyncedCountIn set to ${sessionConfig.tempoSynced}`
      );
    };
  } else {
    debugLog(
      "state",
      "⚠️ tempoSyncedToggle not found — no UI toggle available"
    );
  }
}

/**
 * Starts a groove training session.
 * Handles ownership claim, count-in, and cycle timing.
 *
 * @returns {void}
 * @example
 * window.sessionEngine.startSession();
 */
export function startSession() {
  // Ownership guard: refuse to start groove if another owner is active
  const currentOwner =
    typeof getActiveModeOwner === "function" ? getActiveModeOwner() : null;
  if (currentOwner && currentOwner !== "groove") {
    debugLog(
      "ownership",
      `⚠️ Cannot start groove session: owner is ${currentOwner}`
    );
    return false;
  }

  // Claim ownership for groove before starting playback
  if (typeof setActiveModeOwner === "function") {
    setActiveModeOwner("groove");
  }
  // Broadcast canonical owner change so other modules know immediately
  document.dispatchEvent(
    new CustomEvent("metronome:ownerChanged", { detail: { owner: "groove" } })
  );

  if (flags.sessionActive) {
    // ⏹️ Stop session if already running
    if (flags.isCountingIn || flags.isFinishingBar) {
      debugLog("state", "⚠️ Cannot stop during countdown or finishing bar");
      return;
    }
    stopSession("🛑 Stopped by user");
    ui.startBtn.textContent = "Start";
    ui.startBtn.disabled = false;
    return;
  }

  // ▶️ Start session
  flags.isRunning = true;
  flags.isPaused = false;
  flags.cyclesDone = 0;
  flags.sessionEnding = false;

  // Disable controls during count-in
  ui.startBtn.disabled = true;
  ui.pauseBtn.disabled = true;
  ui.nextBtn.disabled = true;
  ui.bpmMinEl.disabled = true;
  ui.bpmMaxEl.disabled = true;

  document.getElementById("groovePresetSelect").disabled = true;
  document.getElementById("grooveCustomNumerator").disabled = true;
  document.getElementById("grooveCustomDenominator").disabled = true;
  document.getElementById("grooveSubdivisionSelect").disabled = true;

  runCycle(); // handles count-in and re-enables buttons

  // Handle time-based session countdown
  const mode = ui.sessionModeEl.value;
  if (mode === "time") {
    const totalValue = parseInt(ui.totalTimeEl.value);
    const totalUnit = ui.totalTimeUnitEl.value;
    const totalSeconds = utils.convertToSeconds(totalValue, totalUnit);

    flags.sessionRemaining = totalSeconds;
    if (ui.sessionCountdownEl)
      ui.sessionCountdownEl.textContent = utils.formatTime(
        flags.sessionRemaining
      );

    if (timers.sessionInterval) clearInterval(timers.sessionInterval);

    timers.sessionInterval = setInterval(() => {
      if (flags.isPaused || flags.isCountingIn) {
        debugLog("state", "⏳ Session tick skipped — counting in or paused");
        return;
      }

      flags.sessionRemaining--;
      if (ui.sessionCountdownEl)
        ui.sessionCountdownEl.textContent = utils.formatTime(
          flags.sessionRemaining
        );

      if (flags.sessionRemaining <= 0) {
        clearInterval(timers.sessionInterval);
        timers.sessionInterval = null;

        setFinishingBar(true);
        flags.sessionEnding = true;
        ui.startBtn.textContent = "Stop";
        ui.startBtn.disabled = true;
        ui.pauseBtn.disabled = true;

        if (typeof metronome.requestEndOfCycle === "function") {
          debugLog(
            "state",
            "🟡 Session time reached — requesting end of current bar..."
          );
          metronome.requestEndOfCycle(() => {
            debugLog(
              "state",
              "✅ Final cycle finished cleanly — stopping session (time limit reached)."
            );
            setFinishingBar(false);
            flags.sessionEnding = false;
            stopSession("✅ Session complete (time limit reached)");
            ui.startBtn.textContent = "Start";
            ui.startBtn.disabled = false;
            ui.pauseBtn.disabled = true;
          });
        } else {
          debugLog(
            "state",
            "🔴 requestEndOfCycle not available — stopping immediately."
          );
          setFinishingBar(false);
          flags.sessionEnding = false;
          stopSession("✅ Session complete (time limit reached)");
          ui.startBtn.textContent = "Start";
          ui.startBtn.disabled = false;
          ui.pauseBtn.disabled = true;
        }
      }
    }, 1000);
  }
  // Disable groove slider when session is running
  if (typeof window.toggleGrooveSliderDisabled === "function") {
    window.toggleGrooveSliderDisabled(true);
  }
}

/**
 * Pauses the current session.
 *
 * @returns {void}
 */
export function pauseSession() {
  if (flags.isCountingIn || flags.isFinishingBar) {
    debugLog("state", "⚠️ Cannot pause during countdown or finishing bar");
    return;
  }

  if (flags.isPaused) {
    // ▶️ Resume
    flags.isPaused = false;
    metronome.resumeMetronome();

    timers.activeTimer = setInterval(() => {
      if (flags.isPaused) return;
      flags.remaining--;
      ui.countdownEl.textContent = utils.formatTime(flags.remaining);

      if (flags.remaining <= 0) {
        clearInterval(timers.activeTimer);
        setFinishingBar(true);
        ui.startBtn.textContent = "Stop";
        ui.startBtn.disabled = true;
        ui.pauseBtn.disabled = true;

        if (typeof metronome.requestEndOfCycle === "function") {
          metronome.requestEndOfCycle(() => {
            completeCycle();
          });
        } else {
          metronome.stopMetronome();
          completeCycle();
        }
      }
    }, 1000);

    ui.pauseBtn.textContent = "Pause";
    debugLog("state", "▶️ Resumed metronome");
  } else {
    // ⏸️ Pause
    flags.isPaused = true;
    metronome.pauseMetronome();

    clearInterval(timers.activeTimer);
    flags.pausedRemaining = flags.remaining;

    ui.pauseBtn.textContent = "Resume";
    debugLog(
      "state",
      `⏸️ Paused metronome at ${flags.pausedRemaining}s remaining`
    );
  }
}

/**
 * Skips to the next groove immediately.
 *
 * @returns {void}
 */
export function nextCycle() {
  if (!flags.sessionActive) return;

  if (flags.isCountingIn || flags.isFinishingBar) {
    debugLog("state", "⚠️ Cannot skip during countdown or finishing bar");
    return;
  }

  debugLog("state", "⏭️ Skipping to next cycle");

  metronome.pauseMetronome();
  metronome.resetPlaybackFlag(); // ✅ allows clean restart
  clearInterval(timers.activeTimer);
  timers.activeTimer = null;

  // Reset pause state so next cycle starts clean
  flags.isPaused = false;
  ui.pauseBtn.textContent = "Pause"; // Match original behavior

  runCycle(); // start next cycle directly
  // updateButtonStates(); // optional, once implemented
}

/**
 * Stops the session gracefully.
 *
 * @param {string} [message=''] - Reason for stopping
 * @returns {void}
 */
export function stopSession(message = "") {
  // Ownership release: clear active mode owner
  if (typeof setActiveModeOwner === "function") setActiveModeOwner(null);
  document.dispatchEvent(
    new CustomEvent("metronome:ownerChanged", { detail: { owner: null } })
  );
  flags.sessionActive = false;
  flags.isPaused = false;
  flags.isCountingIn = false;
  flags.isFinishingBar = false;
  flags.sessionEnding = false;
  flags.cyclesDone = 0;
  flags.remaining = 0;
  flags.pausedRemaining = 0;
  flags.sessionRemaining = 0;

  // Release ownership so other modes can start
  setActiveModeOwner(null);

  metronome.stopMetronome();

  clearInterval(timers.activeTimer);
  clearTimeout(timers.sessionTimer);
  if (timers.sessionInterval) clearInterval(timers.sessionInterval);
  timers.sessionInterval = null;

  if (timers.visualCountdownTimer) {
    clearInterval(timers.visualCountdownTimer);
    timers.visualCountdownTimer = null;
  }

  setFinishingBar(false);

  if (ui.startBtn) {
    ui.startBtn.textContent = "Start";
    ui.startBtn.disabled = false;
  }
  if (ui.pauseBtn) {
    ui.pauseBtn.disabled = true;
    ui.pauseBtn.textContent = "Pause";
  }
  if (ui.nextBtn) {
    ui.nextBtn.disabled = true;
  }

  if (ui.bpmMinEl) ui.bpmMinEl.disabled = false;
  if (ui.bpmMaxEl) ui.bpmMaxEl.disabled = false;

  if (document.getElementById("groovePresetSelect"))
    document.getElementById("groovePresetSelect").disabled = false;
  if (document.getElementById("grooveCustomNumerator"))
    document.getElementById("grooveCustomNumerator").disabled = false;
  if (document.getElementById("grooveCustomDenominator"))
    document.getElementById("grooveCustomDenominator").disabled = false;
  if (document.getElementById("grooveSubdivisionSelect"))
    document.getElementById("grooveSubdivisionSelect").disabled = false;

  if (ui.countdownEl) ui.countdownEl.textContent = "";
  if (ui.sessionCountdownEl) ui.sessionCountdownEl.textContent = "";

  visuals.updateCountdownBadge(document.getElementById("countdownBadge"), {
    step: "",
  });

  debugLog("state", message || "Session stopped");
  // Re-enable groove slider when session stops
  if (typeof window.toggleGrooveSliderDisabled === "function") {
    window.toggleGrooveSliderDisabled(false);
  }
}

// === Internal Helpers ===

/**
 * Starts a new cycle with randomized groove and BPM, handles count-in and timers.
 *
 * This is the heart of the session engine - it:
 * - Sanitizes BPM range
 * - Randomizes groove and tempo
 * - Plays count-in (if enabled)
 * - Starts metronome
 * - Manages cycle countdown
 *
 * @private
 * @returns {void}
 *
 * @example
 * // Called internally after session start or cycle completion
 * runCycle(); // Picks random groove, plays count-in, starts metronome
 */
function runCycle() {
  // Check the toggle status at the start of the cycle
  const checkbox = document.getElementById("tempoSyncedToggle");
  if (checkbox) {
    sessionConfig.tempoSynced = checkbox.checked;
    localStorage.setItem(
      "tempoSyncedCountIn",
      sessionConfig.tempoSynced ? "true" : "false"
    );
  }

  const mode = ui.sessionModeEl.value;
  const cyclesLimit = parseInt(ui.totalCyclesEl.value);

  if (mode === "cycles" && flags.cyclesDone >= cyclesLimit) {
    stopSession("✅ Session complete (cycles limit reached)");
    ui.startBtn.textContent = "Start";
    ui.startBtn.disabled = false;
    ui.pauseBtn.disabled = true;
    return;
  }
  if (mode === "time" && flags.sessionEnding) {
    stopSession("✅ Session complete (time limit reached)");
    return;
  }

  // ✅ Sanitize BPM range before randomization
  const originalMin = parseInt(ui.bpmMinEl.value);
  const originalMax = parseInt(ui.bpmMaxEl.value);

  const {
    bpmMin,
    bpmMax,
    step: quantStep,
  } = utils.sanitizeBpmRange(
    ui.bpmMinEl.value,
    ui.bpmMaxEl.value,
    utils.QUANTIZATION.groove
  );

  // reflect sanitized values in the UI so user sees auto-correction
  ui.bpmMinEl.value = bpmMin;
  ui.bpmMaxEl.value = bpmMax;

  // Notify user if the range was changed by quantization or clamping
  if (bpmMin !== originalMin || bpmMax !== originalMax) {
    if (typeof showNotice === "function") {
      showNotice(
        `🎚️ BPM range adjusted to ${bpmMin}–${bpmMax} (step=${quantStep})`
      );
    } else {
      debugLog(
        "state",
        `🎚️ BPM range adjusted to ${bpmMin}–${bpmMax} (step=${quantStep})`
      );
    }
  }

  // Use the sanitized range + existing groove text to get random groove & BPM
  const { bpm, groove } = utils.randomizeGroove(
    ui.groovesEl.value,
    bpmMin,
    bpmMax
  );

  // update the UI to reflect current groove and BPM
  ui.displayGroove.textContent = `Groove: ${groove}`;
  ui.displayBpm.textContent = `BPM: ${bpm}`;

  const durationValue = parseInt(ui.cycleDurationEl.value);
  const durationUnit = ui.cycleUnitEl.value;
  flags.remaining =
    durationUnit === "minutes" ? durationValue * 60 : durationValue;

  const startAfterCountIn = () => {
    metronome.startMetronome(bpm); // ✅ now allowed to start again
    flags.sessionActive = true;

    ui.startBtn.textContent = "Stop"; // Update button text to "Stop" in anticipation of stopping after the countdown

    const effectiveBpm =
      typeof metronome.getBpm === "function" ? metronome.getBpm() : bpm;
    ui.displayBpm.textContent = `BPM: ${effectiveBpm}`;

    ui.countdownEl.textContent = utils.formatTime(flags.remaining);
    clearInterval(timers.activeTimer);

    timers.activeTimer = setInterval(() => {
      if (flags.isPaused) return;
      flags.remaining--;
      ui.countdownEl.textContent = utils.formatTime(flags.remaining);

      if (flags.remaining <= 0) {
        clearInterval(timers.activeTimer);
        setFinishingBar(true);
        ui.startBtn.textContent = "Stop";
        ui.startBtn.disabled = true;
        ui.pauseBtn.disabled = true;

        if (typeof metronome.requestEndOfCycle === "function") {
          metronome.requestEndOfCycle(() => {
            completeCycle();
          });
        } else {
          metronome.stopMetronome();
          completeCycle();
        }
      }
    }, 1000);
  };

  if (timers.visualCountdownTimer) {
    clearInterval(timers.visualCountdownTimer);
    timers.visualCountdownTimer = null;
  }

  let step = 3;
  const interval = sessionConfig.tempoSynced ? 60000 / bpm : 1000;
  // Claim ownership so UI can block other modes during count-in and playback
  setActiveModeOwner("groove");
  flags.isCountingIn = true;
  ui.pauseBtn.disabled = true;
  ui.startBtn.disabled = true;
  ui.nextBtn.disabled = true;

  showCountdownVisual(step--);

  timers.visualCountdownTimer = setInterval(() => {
    if (step === 0) {
      clearInterval(timers.visualCountdownTimer);
      timers.visualCountdownTimer = null;

      flags.isCountingIn = false;
      ui.pauseBtn.disabled = false;
      ui.startBtn.disabled = false;
      ui.nextBtn.disabled = false;

      visuals.updateCountdownBadge(document.getElementById("countdownBadge"), {
        step: "",
        fadeOut: true,
      });
      return;
    }

    showCountdownVisual(step--);
  }, interval);

  if (typeof metronome.performCountIn === "function") {
    metronome
      .performCountIn(bpm, sessionConfig.tempoSynced)
      .then(startAfterCountIn)
      .catch((err) => {
        console.error("Count-in failed:", err);
        startAfterCountIn();
      });
  } else {
    startAfterCountIn();
  }
}

/**
 * Called after a cycle finishes — updates state and starts next if needed.
 *
 * Handles:
 * - Incrementing cycle counter
 * - Checking session limits
 * - Triggering next cycle or stopping
 *
 * @public
 * @returns {void}
 *
 * @example
 * // Called internally after cycle timer reaches zero
 * completeCycle(); // Increments counter, checks limits, continues or stops
 */
export function completeCycle() {
  debugLog("state", `Cycle complete: ${flags.cyclesDone + 1}`);
  setFinishingBar(false);
  flags.cyclesDone++;
  ui.cyclesDoneEl.textContent = flags.cyclesDone;

  const mode = ui.sessionModeEl.value;
  const cyclesLimit = parseInt(ui.totalCyclesEl.value);

  if (mode === "cycles" && flags.cyclesDone >= cyclesLimit) {
    stopSession("✅ Session complete (cycles limit reached)");
    ui.startBtn.textContent = "Start";
    ui.startBtn.disabled = false;
    ui.pauseBtn.disabled = true;
    return;
  }

  if (mode === "time" && flags.sessionEnding) {
    stopSession("✅ Session complete (time limit reached)");
    ui.startBtn.textContent = "Start";
    ui.startBtn.disabled = false;
    ui.pauseBtn.disabled = true;
    return;
  }

  runCycle(); // Start next cycle
}

/**
 * Toggles the finishing bar badge and disables Next button during final bar.
 *
 * Visual feedback that the current measure is ending and session will stop/continue
 * after the bar completes.
 *
 * @private
 * @param {boolean} flag - True to show badge and disable Next, false to hide
 * @returns {void}
 *
 * @example
 * setFinishingBar(true);  // Shows "Finishing bar..." badge
 * setFinishingBar(false); // Hides badge, re-enables Next button
 */
function setFinishingBar(flag) {
  debugLog("state", `Finishing bar: ${flag ? "ACTIVE" : "CLEARED"}`);
  flags.isFinishingBar = Boolean(flag);
  if (ui.finishingBadgeEl)
    ui.finishingBadgeEl.classList.toggle("visible", flags.isFinishingBar);

  if (ui.nextBtn) ui.nextBtn.disabled = flags.isFinishingBar; // 🔒 Disable Next button during finishing bar
}

/**
 * Updates countdown badge with current step (3, 2, 1).
 *
 * Delegates to visuals.js for animation handling.
 *
 * @private
 * @param {number} step - Count-in step (3, 2, or 1)
 * @returns {void}
 *
 * @example
 * showCountdownVisual(3); // Displays "3" with fade-in animation
 * showCountdownVisual(1); // Displays "1"
 */
function showCountdownVisual(step) {
  visuals.updateCountdownBadge(document.getElementById("countdownBadge"), {
    step,
    fadeIn: true,
  });
}

/**
 * Checks if a session is currently active.
 *
 * @public
 * @returns {boolean} True if session is running (even if paused), false otherwise
 *
 * @example
 * if (isSessionActive()) {
 *   console.log("Session in progress");
 * }
 */
export function isSessionActive() {
  return !!flags.sessionActive;
}
