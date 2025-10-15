// uiController.js
// Moved UI & session logic. Depends on metronomeCore functions passed in at init.

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
  pauseBtn.disabled = false; // enabled
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

  let activeTimer = null;
  let sessionTimer = null; // legacy / reserved
  let sessionInterval = null; // per-second session countdown interval
  let visualCountdownTimer = null; // timer for visual countdown
  let sessionRemaining = 0; // seconds remaining for total session time
  let sessionEnding = false; // true when total-session time expired and we're waiting for finishing bar
  let cyclesDone = 0;
  let isRunning = false;
  let isFinishingBar = false; // True only while letting bar finish
  let isCountingIn = false; // True while counting down
  let isPaused = false;
  let pausedRemaining = 0;
  let remaining = 0;

  function randomizeGroove() {
    const grooves = groovesEl.value
      .split("\n")
      .map((g) => g.trim())
      .filter(Boolean);
    const bpmMin = parseInt(bpmMinEl.value);
    const bpmMax = parseInt(bpmMaxEl.value);
    // use simple random BPM logic (keeps multiples-of-5 behavior from earlier)
    const randomBpm =
      Math.floor((Math.random() * (bpmMax - bpmMin + 5)) / 5) * 5 + bpmMin;
    const randomGroove = grooves[Math.floor(Math.random() * grooves.length)];
    return { bpm: randomBpm, groove: randomGroove };
  }

  function setFinishingBar(flag) {
    isFinishingBar = Boolean(flag);
    // show/hide badge
    if (finishingBadgeEl)
      finishingBadgeEl.classList.toggle("visible", isFinishingBar);

    if (isFinishingBar) {
      startBtn.textContent = "Stop"; // 🔁 show "Stop" while finishing
      startBtn.disabled = true;
      pauseBtn.disabled = true;
    } else {
      startBtn.textContent = "Start"; // restore label when finishing ends
      startBtn.disabled = false;
      pauseBtn.disabled = true; // keep pause disabled until next cycle
    }
  }

  function showCountdownVisual(step) {
    const badge = document.getElementById("countdownBadge");
    if (!badge) return;
    badge.textContent = step;
    // Remove previous animation classes
    badge.classList.remove("fade-in", "fade-out");
    void badge.offsetWidth; // force reflow
    // Apply fade-in
    badge.classList.add("fade-in");
  }

  function runCycle() {
    const mode = sessionModeEl.value;
    const cyclesLimit = parseInt(totalCyclesEl.value);

    // ✅ Check session limits BEFORE doing anything
    if (mode === "cycles" && cyclesDone >= cyclesLimit) {
      stopSession("✅ Session complete (cycles limit reached)");
      startBtn.textContent = "Start"; // 🔁 restore label
      startBtn.disabled = false; // re-enable button
      pauseBtn.disabled = true; // keep pause disabled
      return;
    }
    if (mode === "time" && sessionEnding) {
      stopSession("✅ Session complete (time limit reached)");
      return;
    }

    const { bpm, groove } = randomizeGroove();

    // show groove immediately
    displayGroove.textContent = `Groove: ${groove}`;
    cyclesDoneEl.textContent = ++cyclesDone;

    const durationValue = parseInt(cycleDurationEl.value);
    const durationUnit = cycleUnitEl.value;
    remaining = durationUnit === "minutes" ? durationValue * 60 : durationValue;

    // If a performCountIn function is available, run it first using the next
    // cycle's BPM and the tempoSynced preference. Otherwise start immediately.
    const startAfterCountIn = () => {
      startMetronomeFn(bpm);

      // read effective BPM that metronomeCore is actually using (post-clamp)
      const effectiveBpm = typeof getBpmFn === "function" ? getBpmFn() : bpm;
      displayBpm.textContent = `BPM: ${effectiveBpm}`;

      // ✅ Start countdown only after metronome starts
      countdownEl.textContent = remaining;
      clearInterval(activeTimer);

      activeTimer = setInterval(() => {
        if (isPaused) return;
        remaining--;
        countdownEl.textContent = remaining;

        if (remaining <= 0) {
          clearInterval(activeTimer);
          setFinishingBar(true);

          if (typeof requestEndOfCycleFn === "function") {
            requestEndOfCycleFn(() => {
              setFinishingBar(false);
              runCycle(); // next cycle
            });
          } else {
            stopMetronomeFn();
            setFinishingBar(false);
            runCycle();
          }
        }
      }, 1000);
    };

    // Clear any previous visual countdown
    if (visualCountdownTimer) {
      clearInterval(visualCountdownTimer);
      visualCountdownTimer = null;
    }

    // Visual countdown (minimal)
    let step = 3;
    const interval = tempoSynced ? 60000 / bpm : 1000;
    // setup to disable buttons while counting in
    isCountingIn = true;
    pauseBtn.disabled = true;
    startBtn.disabled = true;
    nextBtn.disabled = true;
    // Show first step immediately
    showCountdownVisual(step--);

    visualCountdownTimer = setInterval(() => {
      if (step === 0) {
        clearInterval(visualCountdownTimer);
        visualCountdownTimer = null;

        isCountingIn = false;
        pauseBtn.disabled = false;
        startBtn.disabled = false;
        nextBtn.disabled = false;

        const badge = document.getElementById("countdownBadge");
        if (badge) badge.textContent = "";
        if (badge) {
          badge.classList.remove("fade-in");
          badge.classList.add("fade-out");
        }
        return;
      }

      showCountdownVisual(step--);
    }, interval);

    if (typeof performCountInFn === "function") {
      performCountInFn(bpm, tempoSynced)
        .then(startAfterCountIn)
        .catch((err) => {
          console.error("Count-in failed:", err);
          startAfterCountIn();
        });
    } else {
      startAfterCountIn();
    }
  }

  function stopSession(message) {
    isRunning = false;
    stopMetronomeFn();
    clearInterval(activeTimer);
    clearTimeout(sessionTimer);
    if (sessionInterval) clearInterval(sessionInterval);
    sessionInterval = null;
    sessionRemaining = 0;
    sessionEnding = false;
    cyclesDone = 0;
    setFinishingBar(false);
    startBtn.disabled = true;
    nextBtn.disabled = true;
    console.log(message || "Session stopped");
    // safeguard for visual countdown
    if (visualCountdownTimer) {
      clearInterval(visualCountdownTimer);
      visualCountdownTimer = null;
    }
    const badge = document.getElementById("countdownBadge");
    if (badge) badge.textContent = "";

    // Restore Start button state
    startBtn.textContent = "Start";
    startBtn.disabled = false;
    pauseBtn.disabled = true;
  }

  startBtn.onclick = () => {
    if (isRunning) {
      // ⏹️ Stop
      if (isCountingIn || isFinishingBar) {
        console.warn("⏳ Cannot stop during countdown or finishing bar");
        return;
      }

      stopSession("🛑 Stopped by user");
      startBtn.textContent = "Start";
      startBtn.disabled = false;
      return;
    }
    // ▶️ Start
    isRunning = true;
    isPaused = false;
    cyclesDone = 0;
    sessionEnding = false;

    // Disable all controls during count-in
    startBtn.disabled = true;
    pauseBtn.disabled = true; // stays disabled until metronome starts
    nextBtn.disabled = true;

    runCycle(); // handles re-enabling buttons after count-in
    startBtn.textContent = "Stop"; // show "Stop" as soon as metronome starts

    const mode = sessionModeEl.value;
    if (mode === "time") {
      const totalValue = parseInt(totalTimeEl.value);
      const totalUnit = totalTimeUnitEl.value;
      let totalSeconds = totalValue;

      if (totalUnit === "minutes") totalSeconds *= 60;
      else if (totalUnit === "hours") totalSeconds *= 3600;
      // use a visible per-second countdown for the total session time and pause it when user pauses
      sessionRemaining = totalSeconds;
      if (sessionCountdownEl)
        sessionCountdownEl.textContent = String(sessionRemaining);

      // clear any existing interval
      if (sessionInterval) clearInterval(sessionInterval);

      sessionInterval = setInterval(() => {
        if (isPaused || isCountingIn) {
          console.log("⏳ Session tick skipped — counting in or paused");
          return; // ⏸️ Skip while paused or counting in
        }
        sessionRemaining--;
        if (sessionCountdownEl)
          sessionCountdownEl.textContent = String(sessionRemaining);

        if (sessionRemaining <= 0) {
          // stop the interval to avoid repeats
          clearInterval(sessionInterval);
          sessionInterval = null;

          // mark that we're finishing the bar so Pause is disabled
          setFinishingBar(true);
          // indicate that the session ended and we're waiting for the finishing bar
          sessionEnding = true;

          if (typeof requestEndOfCycleFn === "function") {
            console.log(
              "🟡 Session time reached — requesting end of current bar..."
            );
            requestEndOfCycleFn(() => {
              console.log(
                "✅ Final cycle finished cleanly — stopping session (time limit reached)."
              );
              setFinishingBar(false);
              sessionEnding = false;
              stopSession("✅ Session complete (time limit reached)");
              startBtn.textContent = "Start";
              startBtn.disabled = false;
            });
          } else {
            console.log(
              "🔴 requestEndOfCycle not available — stopping immediately."
            );
            setFinishingBar(false);
            sessionEnding = false;
            stopSession("✅ Session complete (time limit reached)");
            startBtn.textContent = "Start";
            startBtn.disabled = false;
          }
        }
      }, 1000);
    }
  };

  pauseBtn.onclick = () => {
    if (isCountingIn || isFinishingBar) {
      console.warn("⏳ Cannot pause during countdown or finishing bar");
      return;
    }

    if (isPaused) {
      // ▶️ Resume
      isPaused = false;
      resumeMetronomeFn();

      // Resume countdown
      activeTimer = setInterval(() => {
        if (isPaused) return;
        remaining--;
        countdownEl.textContent = remaining;
        if (remaining <= 0) {
          clearInterval(activeTimer);
          setFinishingBar(true);
          if (typeof requestEndOfCycleFn === "function") {
            requestEndOfCycleFn(() => {
              console.log("✅ Cycle finished cleanly — moving to next.");
              setFinishingBar(false);
              // metronomeCore has already waited 1s; proceed to next cycle
              runCycle();
            });
          } else {
            stopMetronomeFn();
            setFinishingBar(false);
            // metronomeCore will include the adjustment pause; start next cycle now
            runCycle();
          }
        }
      }, 1000);

      pauseBtn.textContent = "Pause";
      console.log("▶️ Resumed metronome");
    } else {
      // ⏸️ Pause
      isPaused = true;
      pauseMetronomeFn();

      // Stop the countdown timer
      clearInterval(activeTimer);
      pausedRemaining = remaining; // remember where we left off

      pauseBtn.textContent = "Resume";
      console.log("⏸️ Paused metronome at " + pausedRemaining + "s remaining");
    }
  };

  nextBtn.onclick = () => {
    if (!isRunning) return;

    if (isCountingIn) {
      console.warn("⏳ Cannot skip during countdown");
      return;
    }

    stopMetronomeFn();
    clearInterval(activeTimer);
    runCycle();
  };

  // HOTKEYS LOGIC BELOW
  // --- Simple Keyboard hotkeys (layout-independent) ---
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
        else if (!startBtn.disabled) startBtn.click();
        break;

      case "KeyP": // Pause/Resume
        if (!pauseBtn.disabled) pauseBtn.click();
        break;

      case "KeyN": // Next
        if (!nextBtn.disabled) nextBtn.click();
        break;
    }
  });

  // --- Advanced Hotkeys: BPM adjustment (min/max) ---
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
      current = Math.min(300, Math.max(30, current + direction * delta));
      bpmInput.value = current;

      // Optional visual cue (flash input)
      bpmInput.classList.add("bpm-flash");
      setTimeout(() => bpmInput.classList.remove("bpm-flash"), 150);
    }
  });

  // expose a small API to check running state if needed later
  return {
    isRunning: () => isRunning,
  };
}
