// uiController.js
// Moved UI & session logic. Depends on metronomeCore functions passed in at init.

let startMetronomeFn,
  stopMetronomeFn,
  setBeatsPerBarFn,
  getBeatsPerBarFn,
  getBpmFn;
let pauseMetronomeFn, resumeMetronomeFn, getPauseStateFn, requestEndOfCycleFn;

export function initUI(deps) {
  // deps: { startMetronome, stopMetronome, setBeatsPerBar, pauseMetronome, resumeMetronome, getPauseState, getBeatsPerBar, getBpm }
  startMetronomeFn = deps.startMetronome;
  stopMetronomeFn = deps.stopMetronome;
  pauseMetronomeFn = deps.pauseMetronome;
  resumeMetronomeFn = deps.resumeMetronome;
  getPauseStateFn = deps.getPauseState;
  requestEndOfCycleFn = deps.requestEndOfCycle;
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
  const stopBtn = document.getElementById("stopBtn");
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

  let activeTimer = null;
  let sessionTimer = null; // legacy / reserved
  let sessionInterval = null; // per-second session countdown interval
  let sessionRemaining = 0; // seconds remaining for total session time
  let sessionEnding = false; // true when total-session time expired and we're waiting for finishing bar
  let cyclesDone = 0;
  let isRunning = false;
  let isFinishingBar = false; // True only while letting bar finish
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

  function runCycle() {
    const { bpm, groove } = randomizeGroove();

    // show groove immediately
    displayGroove.textContent = `Groove: ${groove}`;
    cyclesDoneEl.textContent = ++cyclesDone;

    // start the metronome (this may clamp bpm internally)
    startMetronomeFn(bpm);

    // read effective BPM that metronomeCore is actually using (post-clamp)
    const effectiveBpm = typeof getBpmFn === "function" ? getBpmFn() : bpm;
    displayBpm.textContent = `BPM: ${effectiveBpm}`;

    const durationValue = parseInt(cycleDurationEl.value);
    const durationUnit = cycleUnitEl.value;
    remaining = durationUnit === "minutes" ? durationValue * 60 : durationValue;

    countdownEl.textContent = remaining;
    clearInterval(activeTimer);

    activeTimer = setInterval(() => {
      if (isPaused) return; // Skip ticking while paused
      remaining--;
      countdownEl.textContent = remaining;

      if (remaining <= 0) {
        clearInterval(activeTimer);
        isFinishingBar = true; //Disable pause during the finishing bar

        if (typeof requestEndOfCycleFn === "function") {
          console.log("🟡 Requesting end of current cycle...");
          requestEndOfCycleFn(() => {
            console.log("✅ Cycle finished cleanly — moving to next.");
            isFinishingBar = false; //Allow pausing again

            const mode = sessionModeEl.value;
            const cyclesLimit = parseInt(totalCyclesEl.value);

            if (mode === "cycles" && cyclesDone >= cyclesLimit) {
              stopSession("✅ Session complete (cycles limit reached)");
            } else if (mode === "time" && sessionEnding) {
              // If the total session timer triggered this finishing bar, stop the session instead of starting a new cycle
              stopSession("✅ Session complete (time limit reached)");
            } else {
              setTimeout(runCycle, 1000);
            }
          });
        } else {
          stopMetronomeFn();
          isFinishingBar = false; //Allow pausing again
          setTimeout(runCycle, 1000);
        }
      }
    }, 1000);
  }

  function stopSession(message) {
    isRunning = false;
    stopMetronomeFn();
    clearInterval(activeTimer);
    clearTimeout(sessionTimer);
    startBtn.disabled = false;
    stopBtn.disabled = true;
    nextBtn.disabled = true;
    console.log(message || "Session stopped");
  }

  startBtn.onclick = () => {
    if (isRunning) return;
    isRunning = true;
    cyclesDone = 0;
    // ensure sessionEnding flag reset when starting
    sessionEnding = false;
    runCycle();
    startBtn.disabled = true;
    stopBtn.disabled = false;
    nextBtn.disabled = false;

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
        if (isPaused) return; // do not decrement while paused
        sessionRemaining--;
        if (sessionCountdownEl)
          sessionCountdownEl.textContent = String(sessionRemaining);

        if (sessionRemaining <= 0) {
          // stop the interval to avoid repeats
          clearInterval(sessionInterval);
          sessionInterval = null;

          // mark that we're finishing the bar so Pause is disabled
          isFinishingBar = true;
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
              isFinishingBar = false;
              sessionEnding = false;
              stopSession("✅ Session complete (time limit reached)");
            });
          } else {
            console.log(
              "🔴 requestEndOfCycle not available — stopping immediately."
            );
            isFinishingBar = false;
            sessionEnding = false;
            stopSession("✅ Session complete (time limit reached)");
          }
        }
      }, 1000);
    }
  };

  stopBtn.onclick = () => stopSession("🛑 Stopped by user");

  pauseBtn.onclick = () => {
    if (isFinishingBar) {
      console.warn("⏳ Cannot pause during finishing bar");
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
          isFinishingBar = true;
          if (typeof requestEndOfCycleFn === "function") {
            requestEndOfCycleFn(() => {
              console.log("✅ Cycle finished cleanly — moving to next.");
              isFinishingBar = false;
              runCycle();
            });
          } else {
            stopMetronomeFn();
            isFinishingBar = false;
            setTimeout(runCycle, 1000);
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
    stopMetronomeFn();
    clearInterval(activeTimer);
    runCycle();
  };

  // expose a small API to check running state if needed later
  return {
    isRunning: () => isRunning,
  };
}
