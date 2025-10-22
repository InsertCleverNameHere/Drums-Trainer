// main.js - simple bootstrap that wires modules together
import * as metronome from "./metronomeCore.js";
import { createVisualCallback } from "./visuals.js";
import { initUI } from "./uiController.js";
import * as utils from "./utils.js";
import { initSessionEngine } from "./sessionEngine.js";

// Expose for visuals and console debugging
window.metronome = metronome; // <-- add this line (or use Option B)

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
initSessionEngine({
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

checkUpdatesBtn.addEventListener("click", () => {
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

        // Cancel button logic
        document
          .getElementById("cancelReloadBtn")
          .addEventListener("click", () => {
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
