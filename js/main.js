/* eslint-disable no-unused-vars */
// main.js - simple bootstrap that wires modules together
import * as metronome from "./metronomeCore.js";
import { createVisualCallback, primeVisuals } from "./visuals.js";
import * as utils from "./utils.js";
import * as sessionEngine from "./sessionEngine.js";
import * as simpleMetronome from "./simpleMetronome.js";
import * as uiController from "./uiController.js";
import { initDarkMode } from "./ui/theme.js";
import {
  initSoundProfileUI,
  initPanningModeUI,
  initTimeSignatureUI,
} from "./ui/controls.js";
import { initModeTabs, initSimplePanelControls } from "./ui/panels.js";
import { debugLog } from "./debug.js";
import { Profiler } from "./profiler.js";

// Expose explicitly (redundant but safe)
window.Profiler = Profiler;

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

// Initialize cores (safe to do early - no DOM access)
simpleMetronome.initSimpleMetronome({ initialBpm: 120 });

// Declare callback variables at module scope
let grooveVisualsCallback;
let simpleVisualsCallback;

// Wait for DOM before creating/registering visual callbacks
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    // 1. Create visual callbacks (DOM is ready)
    grooveVisualsCallback = createVisualCallback("groove");
    simpleVisualsCallback = createVisualCallback("simple");

    // 2. Prime the visual containers
    primeVisuals("groove");
    primeVisuals("simple");

    // 3. Register callbacks with cores
    metronome.registerVisualCallback(grooveVisualsCallback);
    simpleMetronome.core.registerVisualCallback(simpleVisualsCallback);

    // 4. Initialize UI controllers
    initDarkMode();
    initSoundProfileUI();
    uiController.initOwnershipGuards();
    initSimplePanelControls();
    initPanningModeUI();
    initTimeSignatureUI();
    uiController.initAllUI(); // Hotkeys + sliders
  });
} else {
  // DOM already loaded, initialize immediately
  grooveVisualsCallback = createVisualCallback("groove");
  simpleVisualsCallback = createVisualCallback("simple");

  primeVisuals("groove");
  primeVisuals("simple");

  metronome.registerVisualCallback(grooveVisualsCallback);
  simpleMetronome.core.registerVisualCallback(simpleVisualsCallback);

  initDarkMode();
  initSoundProfileUI();
  uiController.initOwnershipGuards();
  initSimplePanelControls();
  initPanningModeUI();
  initTimeSignatureUI();
  uiController.initAllUI(); // Hotkeys + sliders
}

// 4. Initialize the mode tabs.
initModeTabs(sessionEngine, simpleMetronome);

// === Version Fetch & App Footer Handling ===
const footerEl = document.getElementById("VersionNumber");
const versionKey = "lastSeenVersion";
const hashKey = "lastSeenHash";

fetch("./commits.json", { cache: "no-store" })
  .then((res) => res.json())
  .then(({ latestHash, version }) => {
    appVersion = version;

    const storedVersion = utils.migrateStoredVersion(
      localStorage.getItem(versionKey)
    );
    const isNewVersion = storedVersion !== appVersion;

    // Store new version AFTER we've captured the previous one
    const previousVersion = storedVersion; // Capture before update

    if (isNewVersion) {
      localStorage.setItem(versionKey, appVersion);
      localStorage.setItem("cachedMsgCount", "0");
      localStorage.setItem("updateMsgCount", "0");
    }

    const lastSeenHash = localStorage.getItem(hashKey);
    const isActualUpdate = lastSeenHash && latestHash !== lastSeenHash;

    if (isActualUpdate) {
      localStorage.setItem(hashKey, latestHash);
      uiController.updateFooterMessage(
        footerEl,
        appVersion,
        previousVersion, // Pass previous for color comparison
        "Update Available"
      );
    } else {
      if (!lastSeenHash) {
        localStorage.setItem(hashKey, latestHash);
      }
      uiController.updateFooterMessage(
        footerEl,
        appVersion,
        previousVersion // Pass previous for color comparison
      );
    }
  })
  .catch((err) => {
    // Fallback: no previous version comparison on error
    uiController.updateFooterMessage(footerEl, appVersion, null);
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
    } catch (err) {
      /* empty */
    }

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
      debugLog("state", `PWA install prompt: user ${outcome}`);
      deferredPrompt = null;
    });
  }
});

uiController.initUpdateUI();
