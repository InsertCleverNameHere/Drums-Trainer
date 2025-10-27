// main.js - simple bootstrap that wires modules together
import * as metronome from "./metronomeCore.js";
import { createVisualCallback } from "./visuals.js";
import * as utils from "./utils.js";
import * as sessionEngine from "./sessionEngine.js";
import * as simpleMetronome from "./simpleMetronome.js";
import {
  initSoundProfileUI,
  initOwnershipGuards,
  initUI,
  initSimplePanelControls,
  initModeTabs,
} from "./uiController.js";

// Expose for visuals and console debugging
window.metronome = metronome;
window.sessionEngine = sessionEngine;

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
// Protect groove start with explicit ownership checks
if (typeof metronome.startMetronome === "function") {
  const _origStartMetronome = metronome.startMetronome.bind(metronome);
}

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

// Initialize sound profile UI, ownership guards, and simple panel safely
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initSoundProfileUI();
    initOwnershipGuards();
    initSimplePanelControls();
  });
} else {
  initSoundProfileUI();
  initOwnershipGuards();
  initSimplePanelControls();
}

// Initialize simple metronome core (UI handled separately)
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

// // --- Mode tabs with blocking while either metronome is active ---
initModeTabs(sessionEngine, simpleMetronome);

// === Version Fetch & App Footer Handling ===
// Fetch latest commit hash + app version to display in footer
// and detect if a new version is available for the service worker.
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
    updateFooterMessage(); // fallback
  });

// Updates footer version message with smooth fade-in/out transitions.
// Suppresses repeated notifications after showing a few times.
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

// === Service Worker Integration ===
// Registers service worker on page load and sends current version/hash
// so it can update its cache when new versions are released.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    // Register service worker and ensure it's aware of the current app version

    const reg = await navigator.serviceWorker.register("./service-worker.js");

    // Send version info to SW on page load
    try {
      // Send latest version info (from commits.json) to the active SW instance
      const response = await fetch("./commits.json", { cache: "no-store" });
      const { version, latestHash } = await response.json();

      if (reg.active) {
        reg.active.postMessage({
          type: "VERSION_INFO",
          version,
          hash: latestHash,
        });
      }
    } catch (err) {}

    // === Manual Update Button Logic ===
    // Checks if a newer version exists and triggers a refresh if found.
    // Handles “Cancel refresh” gracefully to avoid disruptive reloads.

    // Optional: update manually via checkUpdatesBtn
    const checkBtn = document.getElementById("checkUpdatesBtn");
    if (checkBtn) {
      checkBtn.addEventListener("click", () => {
        reg.update();
      });
    }
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

    footerEl.innerHTML = `⟳ Checking for updates...`; // Update footer immediately
    footerEl.style.opacity = "0";
    footerEl.style.visibility = "hidden";
    void footerEl.offsetWidth;
    footerEl.style.visibility = "visible";
    footerEl.style.opacity = "0.9";

    fetch("./commits.json", { cache: "no-store" })
      .then((res) => res.json())
      .then(({ latestHash, version }) => {
        const storedHash = localStorage.getItem("lastSeenHash");
        const storedVersion = localStorage.getItem("lastSeenVersion");

        const isNewVersion =
          version !== storedVersion || latestHash !== storedHash;

        if (isNewVersion) {
          // Update stored version and hash
          localStorage.setItem("lastSeenVersion", version);
          localStorage.setItem("lastSeenHash", latestHash);

          footerEl.innerHTML = `⟳ Update available — refreshing shortly...
          <button id="cancelReloadBtn" class="update-button">Cancel</button>`;

          // Fade in footer
          footerEl.style.opacity = "0";
          footerEl.style.visibility = "hidden";
          void footerEl.offsetWidth; // Trigger reflow to ensure visibility transition
          footerEl.style.visibility = "visible";
          footerEl.style.opacity = "0.9";

          // Schedule reload
          const reloadTimeout = setTimeout(() => {
            location.reload(true);
          }, 5000);

          // Cancel button logic
          const cancelBtn = document.getElementById("cancelReloadBtn");
          if (cancelBtn) {
            cancelBtn.addEventListener("click", () => {
              clearTimeout(reloadTimeout); // Cancel the scheduled reload

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
}
