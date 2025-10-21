// sessionEngine.js
// Handles session lifecycle, cycle timing, countdowns, and button state logic

// === Imports ===
import * as utils from "./utils.js";
import * as visuals from "./visuals.js";
import { formatTime } from "./utils.js";

// === Internal State ===
let appMode = "trainer"; // or "metronome"
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
  ui.appModeEl = document.getElementById("appMode");

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
      console.info("tempoSyncedCountIn set to", sessionConfig.tempoSynced);
    };
  } else {
    console.warn("tempoSyncedToggle not found — no UI toggle available.");
  }
}

// Mode switch
ui.appModeEl = document.getElementById("appMode");
ui.appModeEl.onchange = (e) => {
  if (flags.sessionActive) {
    alert("Stop the metronome before switching modes.");
    e.target.value = appMode; // revert selection
    return;
  }
  appMode = e.target.value;
  updateUIForMode(appMode);
};

function updateUIForMode(mode) {
  const trainerElements = [
    ui.groovesEl,
    ui.totalCyclesEl,
    ui.totalTimeEl,
    ui.sessionModeEl,
    ui.cycleDurationEl,
    ui.cycleUnitEl,
    ui.cyclesDoneEl,
    ui.sessionCountdownEl,
    ui.displayGroove,
    ui.appModeEl,
  ];

  trainerElements.forEach((el) => {
    if (!el) return;
    const wrapper = el.closest("div");
    if (wrapper) {
      wrapper.style.display = mode === "trainer" ? "" : "none";
    }
  });

  // Optional: update labels or show a minimal BPM-only display
}

// === Public API ===
export function startSession() {
  ui.appModeEl.disabled = true;
  if (appMode === "metronome") {
    const bpmMin = parseInt(ui.bpmMinEl.value);
    const bpmMax = parseInt(ui.bpmMaxEl.value);
    const bpm = utils.randomizeBpm(bpmMin, bpmMax); // ✅ new helper

    metronome.startMetronome(bpm);
    flags.sessionActive = true;
    ui.startBtn.textContent = "Stop";
    ui.displayBpm.textContent = `BPM: ${bpm}`;
    return;
  }

  if (flags.sessionActive) {
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
      ui.sessionCountdownEl.textContent = utils.formatTime(
        flags.sessionRemaining
      );

    if (timers.sessionInterval) clearInterval(timers.sessionInterval);

    timers.sessionInterval = setInterval(() => {
      if (flags.isPaused || flags.isCountingIn) {
        console.log("⏳ Session tick skipped — counting in or paused");
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
            ui.pauseBtn.disabled = true;
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
          ui.pauseBtn.disabled = true;
        }
      }
    }, 1000);
  }
}

export function pauseSession() {
  if (flags.isCountingIn || flags.isFinishingBar) {
    console.warn("⏳ Cannot pause during countdown or finishing bar");
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
    console.log("▶️ Resumed metronome");
  } else {
    // ⏸️ Pause
    flags.isPaused = true;
    metronome.pauseMetronome();

    clearInterval(timers.activeTimer);
    flags.pausedRemaining = flags.remaining;

    ui.pauseBtn.textContent = "Resume";
    console.log(
      "⏸️ Paused metronome at " + flags.pausedRemaining + "s remaining"
    );
  }
}

export function nextCycle() {
  if (!flags.sessionActive) return;

  if (flags.isCountingIn || flags.isFinishingBar) {
    console.warn("⏭️ Cannot skip during countdown or finishing bar");
    return;
  }

  console.log("⏭️ Skipping to next cycle");

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

export function stopSession(message = "") {
  ui.appModeEl.disabled = false;
  flags.sessionActive = false;
  flags.isPaused = false;
  flags.isCountingIn = false;
  flags.isFinishingBar = false;
  flags.sessionEnding = false;
  flags.cyclesDone = 0;
  flags.remaining = 0;
  flags.pausedRemaining = 0;
  flags.sessionRemaining = 0;

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

  if (ui.countdownEl) ui.countdownEl.textContent = "";
  if (ui.sessionCountdownEl) ui.sessionCountdownEl.textContent = "";

  visuals.updateCountdownBadge(document.getElementById("countdownBadge"), {
    step: "",
  });

  console.log(message || "Session stopped");
}

// === Internal Helpers ===

// Starts a new cycle with randomized groove and BPM, handles count-in and timers
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

  const bpmMin = parseInt(ui.bpmMinEl.value);
  const bpmMax = parseInt(ui.bpmMaxEl.value);
  const { bpm, groove } = utils.randomizeGroove(
    ui.groovesEl.value,
    bpmMin,
    bpmMax
  );

  ui.displayGroove.textContent = `Groove: ${groove}`;

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

// Called after a cycle finishes — updates state and starts next if needed
export function completeCycle() {
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

// Toggles the finishing bar badge and disables Next button during final bar
function setFinishingBar(flag) {
  flags.isFinishingBar = Boolean(flag);
  if (ui.finishingBadgeEl)
    ui.finishingBadgeEl.classList.toggle("visible", flags.isFinishingBar);

  if (ui.nextBtn) ui.nextBtn.disabled = flags.isFinishingBar; // 🔒 Disable Next button during finishing bar
}

// Updates countdown badge with current step (3, 2, 1)
function showCountdownVisual(step) {
  visuals.updateCountdownBadge(document.getElementById("countdownBadge"), {
    step,
    fadeIn: true,
  });
}
