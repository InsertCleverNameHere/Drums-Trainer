// main.js - simple bootstrap that wires modules together
import * as metronome from "./metronomeCore.js";
import { createVisualCallback } from "./visuals.js";
import * as utils from "./utils.js";
import * as sessionEngine from "./sessionEngine.js";
import * as simpleMetronome from "./simpleMetronome.js";
import * as uiController from "./uiController.js";

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
// We declare the callback variables here.
// They will be assigned and registered later in the script's execution flow
// to ensure all modules are loaded and ready, preventing race conditions.

let grooveVisualsCallback;
let simpleVisualsCallback;
// === Session Engine Setup ===
// Wire up session engine with metronome and UI dependencies
sessionEngine.initSessionEngine({
  metronome: {
    startMetronome: metronome.startMetronome,
    stopMetronome: metronome.stopMetronome,
    pauseMetronome: metronome.pauseMetronome,
    resumeMetronome: metronome.resumeMetronome,
    getPauseState: metronome.getPauseState,
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
uiController.initUI({
  startMetronome: metronome.startMetronome,
  stopMetronome: metronome.stopMetronome,
  pauseMetronome: metronome.pauseMetronome,
  resumeMetronome: metronome.resumeMetronome,
  getPauseState: metronome.getPauseState,
  getBpm: metronome.getBpm,
  requestEndOfCycle: metronome.requestEndOfCycle,
  performCountIn: metronome.performCountIn,
});

// 1. Initialize the Simple Metronome first...
simpleMetronome.initSimpleMetronome({
  initialBpm: 120,
  // tickCallback is no longer needed
});

// 2. NOW, ASSIGN and REGISTER the callbacks.
grooveVisualsCallback = createVisualCallback("groove");
simpleVisualsCallback = createVisualCallback("simple");

// Register the Groove callback
metronome.registerVisualCallback((tickIndex, isPrimaryAccent, isMainBeat) => {
  try {
    grooveVisualsCallback(tickIndex, isPrimaryAccent, isMainBeat);
  } catch (err) {
    console.error("Groove visuals callback error:", err);
  }
});

// Register the Simple callback
simpleMetronome.core.registerVisualCallback(
  (tickIndex, isPrimaryAccent, isMainBeat) => {
    try {
      simpleVisualsCallback(tickIndex, isPrimaryAccent, isMainBeat);
    } catch (err) {
      console.error("Simple visuals callback error:", err);
    }
  }
);

// 3. Now that everything is set up, initialize the UI controllers.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    uiController.initSoundProfileUI();
    uiController.initOwnershipGuards();
    uiController.initSimplePanelControls();
    uiController.initPanningModeUI();
    uiController.initTimeSignatureUI();
  });
} else {
  uiController.initSoundProfileUI();
  uiController.initOwnershipGuards();
  uiController.initSimplePanelControls();
  uiController.initPanningModeUI();
  uiController.initTimeSignatureUI();
}

// 4. Initialize the mode tabs.
uiController.initModeTabs(sessionEngine, simpleMetronome);

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

    // Always compute color from version (deterministic)
    versionColor = utils.generateColorFromVersion(appVersion);

    if (isNewVersion) {
      localStorage.setItem(versionKey, appVersion);
      localStorage.setItem("cachedMsgCount", "0");
      localStorage.setItem("updateMsgCount", "0");
    }

    const lastSeenHash = localStorage.getItem(hashKey);
    // Define an "actual update" as a scenario where a user has been here before
    //    (lastSeenHash is not null) AND the hash has changed.
    const isActualUpdate = lastSeenHash && latestHash !== lastSeenHash;

    // Use this new, smarter condition to decide which message to show.
    if (isActualUpdate) {
      // This block now ONLY runs for returning users with an outdated version.
      localStorage.setItem(hashKey, latestHash);
      uiController.updateFooterMessage(
        footerEl,
        appVersion,
        versionColor,
        "Update Available"
      );
    } else {
      // This block now correctly runs on the first visit, or if the user is up-to-date.
      // We still update the hash here for the first visit so the *next* check works.
      if (!lastSeenHash) {
        localStorage.setItem(hashKey, latestHash);
      }
      uiController.updateFooterMessage(footerEl, appVersion, versionColor);
    }
  })
  .catch((err) => {
    uiController.updateFooterMessage(footerEl, appVersion, versionColor); // fallback
  });

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
  });
}

// Check for updates button
const checkUpdatesBtn = document.getElementById("checkUpdatesBtn");
// === PWA Install Prompt Handling ===
const installBtn = document.getElementById("installBtn");
let deferredPrompt = null;

window.addEventListener("beforeinstallprompt", (e) => {
  // Prevent the default mini-infobar
  e.preventDefault();
  deferredPrompt = e;

  // Show the install button
  if (installBtn) {
    installBtn.style.display = "inline-block";
    installBtn.addEventListener("click", async () => {
      installBtn.style.display = "none"; // hide button after click
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response to install prompt: ${outcome}`);
      deferredPrompt = null;
    });
  }
});

uiController.initUpdateUI();
