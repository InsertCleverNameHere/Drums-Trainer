// main.js - simple bootstrap that wires modules together
import * as metronome from "./metronomeCore.js";
import { createVisualCallback } from "./visuals.js";
import { initUI } from "./uiController.js";
import * as utils from "./utils.js";
import { initSessionEngine } from "./sessionEngine.js";

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
// Register beat visualizer with metronome using beats-per-bar getter
metronome.registerVisualCallback(
  createVisualCallback(metronome.getBeatsPerBar)
);

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
// const appVersion = "v1.1.0"; legacy hardcoding, now handled dynamically via commits.json
const footerEl = document.getElementById("VersionNumber");
const versionKey = "lastSeenVersion";
const colorKey = "versionColor";
const messageKey = (status) =>
  status.includes("Update") ? "updateMsgCount" : "cachedMsgCount";

const hashKey = "lastSeenHash";

fetch("../versioning/commits.json")
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
      updateFooterMessage("Update Available", true);
    } else {
      updateFooterMessage();
    }
  })
  .catch((err) => {
    console.warn("Could not load commits.json:", err);
    updateFooterMessage(); // fallback
  });

// Get stored values (legacy)
//const storedVersion = localStorage.getItem(versionKey);
//const isNewVersion = storedVersion !== appVersion;
//let versionColor = localStorage.getItem(colorKey);

// Update color and reset counters if version changed
///if (isNewVersion || !versionColor) {
//versionColor = utils.generateColorFromVersion(appVersion);
//localStorage.setItem(colorKey, versionColor);
//localStorage.setItem(versionKey, appVersion);
//localStorage.setItem("cachedMsgCount", "0");
//localStorage.setItem("updateMsgCount", "0");
//}

// update footer message according to cache state
function updateFooterMessage(
  status = "✅ Cached Offline",
  showRefresh = false
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

  // ✅ Step 3: Add refresh button if needed
  if (!suppressMessage && showRefresh) {
    const refreshBtn = document.createElement("button");
    refreshBtn.textContent = "🔄 Update";
    refreshBtn.style.marginLeft = "12px";
    refreshBtn.style.fontSize = "1em";
    refreshBtn.style.padding = "2px 6px";
    refreshBtn.style.border = "none";
    refreshBtn.style.background = "transparent";
    refreshBtn.style.color = versionColor;
    refreshBtn.style.cursor = "pointer";
    refreshBtn.style.textDecoration = "underline";
    refreshBtn.style.verticalAlign = "baseline";
    refreshBtn.style.fontWeight = "bold";
    refreshBtn.style.transition = "color 0.3s ease";

    const hoverAccent = "#ff4d00";
    refreshBtn.onmouseover = () => {
      refreshBtn.style.color = hoverAccent;
    };
    refreshBtn.onmouseout = () => {
      refreshBtn.style.color = versionColor;
    };

    refreshBtn.onclick = () => location.reload(true);
    footerEl.appendChild(refreshBtn);
  }

  // ✅ Step 4: Fade out after 5 seconds
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
            updateFooterMessage("Update Available", true);
          } else {
            updateFooterMessage("Cached Offline");
          }
        }
      });
    });
  });
}
