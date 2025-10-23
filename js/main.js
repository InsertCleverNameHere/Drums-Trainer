// main.js - simple bootstrap that wires modules together
import * as metronome from "./metronomeCore.js";
import { createVisualCallback } from "./visuals.js";
import { initUI } from "./uiController.js";
import * as utils from "./utils.js";
import * as sessionEngine from "./sessionEngine.js";
import * as simpleMetronome from "./simpleMetronome.js";

// Expose for visuals and console debugging
window.metronome = metronome; //

// set early to fetch from commits.json
let appVersion;
let versionColor;

// Grab all relevant DOM elements for UI and session control
// === DOM Elements ===
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const nextBtn = document.getElementById("nextBtn");
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

// === Metronome Setup ===
// Expose metronome module to DevTools for debugging (safe for dev)
window.metronome = window.metronome || metronome;

// Ensure window.metronome exists and expose safe getters for visuals and debugging
if (
  typeof metronome.getTicksPerBeat === "function" &&
  !window.metronome.getTicksPerBeat
)
  window.metronome.getTicksPerBeat = metronome.getTicksPerBeat;
if (
  typeof metronome.getBeatsPerBar === "function" &&
  !window.metronome.getBeatsPerBar
)
  window.metronome.getBeatsPerBar = metronome.getBeatsPerBar;
if (typeof metronome.getBpm === "function" && !window.metronome.getBpm)
  window.metronome.getBpm = metronome.getBpm;
if (
  typeof metronome.getPauseState === "function" &&
  !window.metronome.getPauseState
)
  window.metronome.getPauseState = metronome.getPauseState;

// Create visuals callback (backwards-compatible)
const visualsCallback = createVisualCallback(metronome.getBeatsPerBar);

// Adapter: translate metronome tick signature to visuals
metronome.registerVisualCallback((tickIndex, isAccent, tickInBeat) => {
  try {
    visualsCallback(tickIndex, isAccent, tickInBeat);
  } catch (err) {
    console.error("visuals callback error:", err);
  }
});

// === Session Engine Setup ===
// Wire up session engine with metronome and UI dependencies
sessionEngine.initSessionEngine({
  metronome: {
    startMetronome: metronome.startMetronome,
    stopMetronome: metronome.stopMetronome,
    pauseMetronome: metronome.pauseMetronome,
    resumeMetronome: metronome.resumeMetronome,
    getPauseState: metronome.getPauseState,
    getBeatsPerBar: metronome.getBeatsPerBar,
    getBpm: metronome.getBpm,
    requestEndOfCycle: metronome.requestEndOfCycle,
    performCountIn: metronome.performCountIn,
    resetPlaybackFlag: metronome.resetPlaybackFlag,
  },
  ui: {
    startBtn,
    pauseBtn,
    nextBtn,
    displayBpm,
    displayGroove,
    countdownEl,
    cyclesDoneEl,
    sessionModeEl,
    totalCyclesEl,
    totalTimeEl,
    totalTimeUnitEl,
    cycleDurationEl,
    cycleUnitEl,
    sessionCountdownEl,
    finishingBadgeEl,
    bpmMaxEl,
    bpmMinEl,
    groovesEl,
  },
});

// === UI Setup ===
// Initialize UI interactions and hotkeys with metronome functions
initUI({
  startMetronome: metronome.startMetronome,
  stopMetronome: metronome.stopMetronome,
  pauseMetronome: metronome.pauseMetronome,
  resumeMetronome: metronome.resumeMetronome,
  getPauseState: metronome.getPauseState,
  setBeatsPerBar: metronome.setBeatsPerBar,
  getBeatsPerBar: metronome.getBeatsPerBar,
  getBpm: metronome.getBpm,
  requestEndOfCycle: metronome.requestEndOfCycle,
  performCountIn: metronome.performCountIn,
});

// Initialize simple metronome with an optional tick visual hook
simpleMetronome.initSimpleMetronome({
  initialBpm: 120,
  // No direct visualTick dependency; emit a small DOM pulse if a dot element exists
  tickCallback: () => {
    const dot = document.getElementById("simpleMetronomeDot");
    if (!dot) return;
    dot.classList.add("pulse");
    setTimeout(() => dot.classList.remove("pulse"), 120);
  },
});

// Wire simple metronome panel controls
// Ensure simple metronome wiring runs after DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  const startBtn = document.getElementById("simpleStartBtn");
  const pauseBtn = document.getElementById("simplePauseBtn");
  const bpmEl = document.getElementById("simpleBpm");
  const ownerPanelEventTarget = document;

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

  if (!startBtn) {
    console.warn(
      "simpleStartBtn not found; check DOM ID or ensure this script runs after the element."
    );
    return;
  }

  startBtn.addEventListener("click", async (ev) => {
    ev.preventDefault();
    const owner =
      typeof sessionEngine.getActiveModeOwner === "function"
        ? sessionEngine.getActiveModeOwner()
        : null;
    if (owner && owner !== "simple") {
      console.warn("Cannot start simple metronome while", owner, "is active");
      return;
    }

    const running =
      typeof simpleMetronome.isRunning === "function" &&
      simpleMetronome.isRunning();
    const desiredBpm = bpmEl ? parseInt(bpmEl.value, 10) : null;
    if (desiredBpm) simpleMetronome.setBpm(desiredBpm);

    if (!running) {
      try {
        const result = await simpleMetronome.start();
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

  updateSimpleUI();
});

// --- Mode tabs with blocking while either metronome is active ---
const tabGroove = document.getElementById("tab-groove");
const tabMet = document.getElementById("tab-metronome");
const panelGroove = document.getElementById("panel-groove");
const panelMet = document.getElementById("panel-metronome");

// helper: visually enable/disable a tab
function setTabEnabled(tabEl, enabled) {
  if (!tabEl) return;
  tabEl.classList.toggle("disabled", !enabled);
  tabEl.disabled = !enabled;
}

// central mode switcher that blocks when either metronome is active
// central mode switcher that respects explicit active-mode ownership
function setActiveMode(mode) {
  // Query explicit owner first (set by sessionEngine.setActiveModeOwner)
  const owner =
    typeof sessionEngine.getActiveModeOwner === "function"
      ? sessionEngine.getActiveModeOwner()
      : null;

  // If an owner exists, force UI to that owner and prevent switching away
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

  // No owner: fall back to simple runtime checks (in case simpleMetronome exists)
  const grooveRunning =
    typeof sessionEngine.isSessionActive === "function" &&
    sessionEngine.isSessionActive();
  const simpleRunning =
    typeof simpleMetronome.isRunning === "function" &&
    simpleMetronome.isRunning();

  if (grooveRunning || simpleRunning) {
    // If runtime flags indicate activity but no explicit owner, keep UI on the running mode
    if (grooveRunning) {
      tabGroove.classList.add("active");
      tabMet.classList.remove("active");
      panelGroove.classList.remove("hidden");
      panelMet.classList.add("hidden");
      setTabEnabled(tabGroove, true);
      setTabEnabled(tabMet, false);
    } else {
      tabMet.classList.add("active");
      tabGroove.classList.remove("active");
      panelMet.classList.remove("hidden");
      panelGroove.classList.add("hidden");
      setTabEnabled(tabMet, true);
      setTabEnabled(tabGroove, false);
    }
    return;
  }

  // Normal switching when nothing is active
  tabGroove.classList.toggle("active", mode === "groove");
  tabMet.classList.toggle("active", mode === "metronome");
  panelGroove.classList.toggle("hidden", mode !== "groove");
  panelMet.classList.toggle("hidden", mode !== "metronome");
  setTabEnabled(tabGroove, true);
  setTabEnabled(tabMet, true);
}

// safe click handlers that ignore clicks when tab is disabled
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

// Listen for explicit owner changes from sessionEngine (and other modules)
document.addEventListener("metronome:ownerChanged", (e) => {
  const owner = e && e.detail && e.detail.owner;
  if (owner === "groove") {
    tabGroove.classList.add("active");
    panelGroove.classList.remove("hidden");
    tabMet.classList.remove("active");
    panelMet.classList.add("hidden");
    setTabEnabled(tabGroove, true);
    setTabEnabled(tabMet, false);
    return;
  }
  if (owner === "simple") {
    tabMet.classList.add("active");
    panelMet.classList.remove("hidden");
    tabGroove.classList.remove("active");
    panelGroove.classList.add("hidden");
    setTabEnabled(tabMet, true);
    setTabEnabled(tabGroove, false);
    return;
  }
  // owner === null: enable both tabs and keep current visible panel
  setTabEnabled(tabGroove, true);
  setTabEnabled(tabMet, true);
});

// === Version Log ===
const footerEl = document.getElementById("VersionNumber");
const versionKey = "lastSeenVersion";
const colorKey = "versionColor";
const messageKey = (status) =>
  status.includes("Update") ? "updateMsgCount" : "cachedMsgCount";

const hashKey = "lastSeenHash";

fetch("./commits.json", { cache: "no-store" })
  .then((res) => res.json())
  .then(({ latestHash, version }) => {
    appVersion = version;

    const storedVersion = localStorage.getItem(versionKey);
    const isNewVersion = storedVersion !== appVersion;
    versionColor = localStorage.getItem(colorKey);

    if (isNewVersion || !versionColor) {
      versionColor = utils.generateColorFromVersion(appVersion);
      localStorage.setItem(colorKey, versionColor);
      localStorage.setItem(versionKey, appVersion);
      localStorage.setItem("cachedMsgCount", "0");
      localStorage.setItem("updateMsgCount", "0");
    }

    const lastSeenHash = localStorage.getItem(hashKey);
    const hashChanged = latestHash !== lastSeenHash;

    if (hashChanged) {
      localStorage.setItem(hashKey, latestHash);
      updateFooterMessage("Update Available");
    } else {
      updateFooterMessage();
    }
  })
  .catch((err) => {
    console.warn("Could not load commits.json:", err);
    updateFooterMessage(); // fallback
  });

// update footer message according to cache state
function updateFooterMessage(
  status = "✅ Cached Offline"
  // showRefresh = false
) {
  const key = messageKey(status);
  const shownCount = parseInt(localStorage.getItem(key)) || 0;
  const suppressMessage = shownCount >= 3;

  console.info(`🎵 Random Groove Trainer ${appVersion} — ${status}`);

  if (!footerEl) return;

  const fullText = suppressMessage
    ? `🎵 Random Groove Trainer <span style="color:${versionColor}">${appVersion}</span>`
    : `🎵 Random Groove Trainer — ${status} <span style="color:${versionColor}">${appVersion}</span>`;

  footerEl.innerHTML = fullText;

  // Step 1: Set initial hidden state
  footerEl.style.opacity = "0";
  footerEl.style.visibility = "hidden";
  footerEl.style.transition = "opacity 1.2s ease";

  // 🔧 Force style flush
  void footerEl.offsetWidth; // This forces the browser to apply the above styles

  // Step 2: Trigger fade-in
  footerEl.style.visibility = "visible";
  footerEl.style.opacity = "0.9";

  // ✅ Step 3: Fade out after 5 seconds
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
}

// Service worker update detection
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./service-worker.js").then((reg) => {
    reg.addEventListener("updatefound", () => {
      const newWorker = reg.installing;
      newWorker.addEventListener("statechange", () => {
        if (newWorker.state === "installed") {
          if (navigator.serviceWorker.controller) {
            updateFooterMessage("Update Available");
          } else {
            updateFooterMessage("Cached Offline");
          }
        }
      });
    });
  });
}

// Check for updates button
const checkUpdatesBtn = document.getElementById("checkUpdatesBtn");

document.addEventListener("click", (event) => {
  const footerEl = document.getElementById("VersionNumber");

  if (!footerEl || footerEl.classList.contains("footer-hidden")) return;

  // Optional: prevent fade-out if the click was on the update button
  const clickedElement = event.target;
  if (clickedElement.id === "checkUpdatesBtn") return;

  // Trigger fade-out
  footerEl.style.opacity = "0";

  setTimeout(() => {
    footerEl.classList.add("footer-hidden");
    footerEl.style.visibility = "hidden";
  }, 600); // match transition duration
});

if (checkUpdatesBtn) {
  checkUpdatesBtn.addEventListener("click", () => {
    const footerEl = document.getElementById("VersionNumber");
    if (!footerEl) {
      console.warn("Update check aborted: footer element not found");
      return;
    }

    fetch("./commits.json", { cache: "no-store" })
      .then((res) => res.json())
      .then(({ latestHash, version }) => {
        const storedHash = localStorage.getItem("lastSeenHash");
        const storedVersion = localStorage.getItem("lastSeenVersion");

        const isNewVersion =
          version !== storedVersion || latestHash !== storedHash;

        if (isNewVersion) {
          localStorage.setItem("lastSeenVersion", version);
          localStorage.setItem("lastSeenHash", latestHash);

          footerEl.innerHTML = `⟳ Update available — refreshing shortly...
          <button id="cancelReloadBtn" class="update-button">Cancel</button>`;
          // Fade in footer
          footerEl.style.opacity = "0";
          footerEl.style.visibility = "hidden";
          void footerEl.offsetWidth;
          footerEl.style.visibility = "visible";
          footerEl.style.opacity = "0.9";

          // Schedule reload
          const reloadTimeout = setTimeout(() => {
            location.reload(true);
          }, 5000);

          // Cancel button logic (guard the cancel button exists before attaching listener)
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
      })
      .catch((err) => {
        console.warn("Manual update check failed:", err);
        const footerEl = document.getElementById("VersionNumber");
        if (!footerEl) return;
        footerEl.innerHTML = `⟳ Could not check for updates`;
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
      });
  });
} else {
}
