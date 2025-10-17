// sessionEngine.js
// Handles session lifecycle, cycle timing, countdowns, and button state logic

// === Imports ===
import * as utils from "./utils.js";
import * as visuals from "./visuals.js";

// === Internal State ===
let metronome = {};
let ui = {};
let sessionConfig = {};
let timers = {};
let flags = {};

// === Setup ===
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
    isRunning: false,
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
      console.info("tempoSyncedCountIn set to", sessionConfig.tempoSynced);
    };
  } else {
    console.warn("tempoSyncedToggle not found — no UI toggle available.");
  }
}

// === Public API ===
export function startSession() {
  if (flags.isRunning) {
    // ⏹️ Stop session if already running
    if (flags.isCountingIn || flags.isFinishingBar) {
      console.warn("⏳ Cannot stop during countdown or finishing bar");
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

  runCycle(); // handles count-in and re-enables buttons

  // Handle time-based session countdown
  const mode = ui.sessionModeEl.value;
  if (mode === "time") {
    const totalValue = parseInt(ui.totalTimeEl.value);
    const totalUnit = ui.totalTimeUnitEl.value;
    const totalSeconds = utils.convertToSeconds(totalValue, totalUnit);

    flags.sessionRemaining = totalSeconds;
    if (ui.sessionCountdownEl)
      ui.sessionCountdownEl.textContent = String(flags.sessionRemaining);

    if (timers.sessionInterval) clearInterval(timers.sessionInterval);

    timers.sessionInterval = setInterval(() => {
      if (flags.isPaused || flags.isCountingIn) {
        console.log("⏳ Session tick skipped — counting in or paused");
        return;
      }

      flags.sessionRemaining--;
      if (ui.sessionCountdownEl)
        ui.sessionCountdownEl.textContent = String(flags.sessionRemaining);

      if (flags.sessionRemaining <= 0) {
        clearInterval(timers.sessionInterval);
        timers.sessionInterval = null;

        setFinishingBar(true);
        flags.sessionEnding = true;

        if (typeof metronome.requestEndOfCycle === "function") {
          console.log(
            "🟡 Session time reached — requesting end of current bar..."
          );
          metronome.requestEndOfCycle(() => {
            console.log(
              "✅ Final cycle finished cleanly — stopping session (time limit reached)."
            );
            setFinishingBar(false);
            flags.sessionEnding = false;
            stopSession("✅ Session complete (time limit reached)");
            ui.startBtn.textContent = "Start";
            ui.startBtn.disabled = false;
          });
        } else {
          console.log(
            "🔴 requestEndOfCycle not available — stopping immediately."
          );
          setFinishingBar(false);
          flags.sessionEnding = false;
          stopSession("✅ Session complete (time limit reached)");
          ui.startBtn.textContent = "Start";
          ui.startBtn.disabled = false;
        }
      }
    }, 1000);
  }
}

export function pauseSession() {
  // Handles pause/resume logic
}

export function nextCycle() {
  // Skips current cycle and starts next
}

export function stopSession(message = "") {
  // Stops session and resets state
}

// === Internal Helpers ===
function runCycle() {
  // Starts a new cycle, handles count-in and countdown
}

function completeCycle() {
  // Called when a cycle finishes
}

function setFinishingBar(flag) {
  // Toggles finishing bar state and updates UI
}

function showCountdownVisual(step) {
  // Triggers visual countdown badge
}

function updateButtonStates() {
  // Enables/disables buttons based on session state
}

function updateSessionCountdown() {
  // Handles total session countdown logic
}
