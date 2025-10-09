// uiController.js
// Moved UI & session logic. Depends on metronomeCore functions passed in at init.

let startMetronomeFn, stopMetronomeFn, setBeatsPerBarFn, getBeatsPerBarFn, getBpmFn;

export function initUI(deps) {
  // deps: { startMetronome, stopMetronome, setBeatsPerBar, getBeatsPerBar, getBpm }
  startMetronomeFn = deps.startMetronome;
  stopMetronomeFn = deps.stopMetronome;
  setBeatsPerBarFn = deps.setBeatsPerBar;
  getBeatsPerBarFn = deps.getBeatsPerBar;
  getBpmFn = deps.getBpm;

  // DOM elements
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const nextBtn = document.getElementById('nextBtn');
  const pauseBtn = document.getElementById('pauseBtn'); // left disabled for now (Phase 1 later)
  const bpmMinEl = document.getElementById('bpmMin');
  const bpmMaxEl = document.getElementById('bpmMax');
  const groovesEl = document.getElementById('grooves');
  const displayBpm = document.getElementById('displayBpm');
  const displayGroove = document.getElementById('displayGroove');
  const countdownEl = document.getElementById('countdown');
  const cyclesDoneEl = document.getElementById('cyclesDone');
  const sessionModeEl = document.getElementById('sessionMode');
  const totalCyclesEl = document.getElementById('totalCycles');
  const totalTimeEl = document.getElementById('totalTime');
  const totalTimeUnitEl = document.getElementById('totalTimeUnit');
  const cycleDurationEl = document.getElementById('cycleDuration');
  const cycleUnitEl = document.getElementById('cycleUnit');

  let activeTimer = null;
  let sessionTimer = null;
  let cyclesDone = 0;
  let isRunning = false;

  function randomizeGroove() {
    const grooves = groovesEl.value.split('\n').map(g => g.trim()).filter(Boolean);
    const bpmMin = parseInt(bpmMinEl.value);
    const bpmMax = parseInt(bpmMaxEl.value);
    // use simple random BPM logic (keeps multiples-of-5 behavior from earlier)
    const randomBpm = Math.floor((Math.random() * (bpmMax - bpmMin + 5)) / 5) * 5 + bpmMin;
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
    const effectiveBpm = typeof getBpmFn === 'function' ? getBpmFn() : bpm;
    displayBpm.textContent = `BPM: ${effectiveBpm}`;

    const durationValue = parseInt(cycleDurationEl.value);
    const durationUnit = cycleUnitEl.value;
    let remaining = durationUnit === 'minutes' ? durationValue * 60 : durationValue;

    countdownEl.textContent = remaining;
    clearInterval(activeTimer);
    activeTimer = setInterval(() => {
      remaining--;
      countdownEl.textContent = remaining;
      if (remaining <= 0) {
        clearInterval(activeTimer);
        stopMetronomeFn();
        const mode = sessionModeEl.value;
        if (mode === 'cycles' && cyclesDone >= parseInt(totalCyclesEl.value)) {
          stopSession('✅ Session complete (cycles limit reached)');
        } else {
          // per your later note: current measure should play to end and then pause 1s before next cycle
          // For now (modular refactor only) we keep previous behavior: immediate next cycle
          runCycle();
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
    console.log(message || 'Session stopped');
  }

  startBtn.onclick = () => {
    if (isRunning) return;
    isRunning = true;
    cyclesDone = 0;
    runCycle();
    startBtn.disabled = true;
    stopBtn.disabled = false;
    nextBtn.disabled = false;
    const mode = sessionModeEl.value;
    if (mode === 'time') {
      const totalValue = parseInt(totalTimeEl.value);
      const totalUnit = totalTimeUnitEl.value;
      let totalSeconds = totalValue;
      if (totalUnit === 'minutes') totalSeconds *= 60;
      else if (totalUnit === 'hours') totalSeconds *= 3600;
      sessionTimer = setTimeout(() => {
        stopSession('✅ Session complete (time limit reached)');
      }, totalSeconds * 1000);
    }
  };

  stopBtn.onclick = () => stopSession('🛑 Stopped by user');

  nextBtn.onclick = () => {
    if (!isRunning) return;
    stopMetronomeFn();
    clearInterval(activeTimer);
    runCycle();
  };

  // expose a small API to check running state if needed later
  return {
    isRunning: () => isRunning
  };
}