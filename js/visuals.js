/* eslint-disable no-unused-vars */

// js/visuals.js
// Phrase-based metronome visualizer with intelligent panning
//
// ARCHITECTURE:
// - Segments measures into 4-tick phrases for consistent viewport
// - Dual rendering modes: Intelligent (minimal updates) vs Forced (always pan)
// - Pattern comparison engine detects when phrase structures match
// - GSAP-powered animations with proper cleanup to prevent memory leaks
//
// PERFORMANCE:
// - Normal BPMs (60-120): ~1-2 MB memory growth per 5 minutes
// - Extreme BPMs (300+ with 16ths): ~6 MB per 3 minutes (acceptable)
// - No resize bugs due to transform-based positioning

import * as utils from "./utils.js";
import * as constants from "./constants.js";
import * as metronome from "./metronomeCore.js";
import * as simpleMetronome from "./simpleMetronome.js";
import { patternScheduler } from "./patternScheduler.js";
import * as advancedMode from "./ui/advancedMode.js";
import { getGroovePattern } from "./grooveStorage.js";
import { debugLog } from "./debug.js";

const BEATS_PER_PAGE = 8; // How many main beats to show at once.

/**
 * Internal Factory: Builds the DOM structure for a single beat/tick.
 * Consolidates duplicate logic from renderNewPhrase and primeVisuals.
 *
 * @private
 * @param {Object} dotInfo - Geometric data from generateMeasureLayout
 * @param {boolean} isPatternMode - Whether pattern dashboard is active
 * @param {string|null} trackID - Instrument ID (hihat, kick, etc.)
 * @param {number} stepIndex - Absolute tick index for sample data lookup
 * @param {boolean} showPhonation - Whether to render the label text
 */
function _createBeatElement(
  dotInfo,
  isPatternMode,
  trackID,
  stepIndex,
  showPhonation
) {
  const wrapper = document.createElement("div");
  wrapper.className = "beat-wrapper";

  const dot = document.createElement("div");
  if (isPatternMode) {
    dot.className = "pattern-dot";
    // Look up if this specific tick in the pattern is a "hit"
    if (patternScheduler.getStepData(trackID, stepIndex)) {
      dot.classList.add("active");
    }
  } else {
    dot.className = `beat-dot ${dotInfo.size}`;
    if (dotInfo.isAccent) dot.classList.add("accent");
  }
  wrapper.appendChild(dot);

  if (showPhonation) {
    const text = document.createElement("div");
    // Standard phonation uses visuals class; Dashboard uses pattern-label class
    text.className = isPatternMode
      ? "phonation-text pattern-label"
      : "phonation-text";
    text.textContent = dotInfo.label;
    wrapper.appendChild(text);
  }

  return wrapper;
}

/**
 * Renders a new phrase into the viewport with GSAP pan animation.
 *
 * CRITICAL: Must kill ALL GSAP tweens before clearing DOM to prevent memory leaks.
 * The killTweensOf calls ensure GSAP releases references to DOM nodes that are
 * about to be destroyed, allowing proper garbage collection.
 *
 * @param {HTMLElement} container - The beat indicator container
 * @param {Array} measureLayout - Full measure layout
 * @param {Object} phrase - Current phrase {start, end, length}
 * @param {Object} core - Metronome core for BPM
 * @param {Array} dotElements - Reference to dotElements array (will be updated)
 * @returns {Array} Updated dotElements array
 */
function renderNewPhrase(
  container,
  measureLayout,
  phrase,
  core,
  dotElements,
  panelId
) {
  // CRITICAL: Kill ALL GSAP animations in container, not just panning container
  const oldPanningContainer = container.querySelector(".panning-container");
  if (oldPanningContainer) {
    // Kill animations on container itself
    gsap.killTweensOf(oldPanningContainer);

    // Kill animations on ALL children (dots and text elements)
    const allDots = oldPanningContainer.querySelectorAll(".beat-dot");
    const allText = oldPanningContainer.querySelectorAll(".phonation-text");
    allDots.forEach((dot) => gsap.killTweensOf(dot));
    allText.forEach((text) => gsap.killTweensOf(text));
  }

  container.innerHTML = "";
  const panningContainer = document.createElement("div");
  panningContainer.className = "panning-container";
  panningContainer.style.display = "flex";
  // Determine if we're in pattern mode or standard mode (Respecting User Preference)
  const isPatternMode =
    panelId === "groove" &&
    patternScheduler.isActive() &&
    advancedMode.isDashboardEnabled();
  if (isPatternMode) {
    panningContainer.style.flexDirection = "column";
  }
  container.appendChild(panningContainer);

  // Extract the slice of dots for this phrase
  const phraseSlice = measureLayout.slice(phrase.start, phrase.end + 1);

  // Clear and rebuild dotElements cache
  dotElements.length = 0; // Clear array without losing reference

  const tracks = isPatternMode ? ["hihat", "kick", "snare", "HHPed"] : [null];
  const showPed = document.getElementById("toggleHHPed")?.checked ?? true;

  // Clear and rebuild dotElements cache (now a 2D array if in pattern mode)
  dotElements.length = 0;

  tracks.forEach((trackID) => {
    if (trackID === "HHPed" && !showPed) return;

    // Define dotParent outside the conditional to fix ReferenceError
    let dotParent = panningContainer;

    if (isPatternMode) {
      const row = document.createElement("div");
      row.className = "pattern-row";
      if (trackID) row.dataset.track = trackID;

      // Add Instrument Label
      const label = document.createElement("div");
      label.className = "pattern-row-label";
      const labelMap = { hihat: "HH", kick: "KI", snare: "SN", HHPed: "PD" };
      label.textContent = labelMap[trackID] || "";
      row.appendChild(label);

      panningContainer.appendChild(row);
      dotParent = row;
    }

    phraseSlice.forEach((dotInfo, i) => {
      const showPhonation =
        !isPatternMode || trackID === (showPed ? "HHPed" : "snare");
      const wrapper = _createBeatElement(
        dotInfo,
        isPatternMode,
        trackID,
        phrase.start + i,
        showPhonation
      );
      dotParent.appendChild(wrapper);
      dotElements.push(wrapper);
    });
  });

  // GSAP animation: slide in from right
  const bpm = core.getBpm();
  const duration = Math.max(0.08, Math.min(0.4, (60 / bpm) * 0.75));

  gsap.fromTo(
    panningContainer,
    { x: 50, opacity: 0 },
    { x: 0, opacity: 1, duration, ease: "power1.out" }
  );

  return dotElements; // Return updated array (though it's passed by reference)
}

/**
 * Updates only the phonation labels with slide animation.
 * Used when phrase hierarchy matches but labels differ (intelligent panning mode).
 *
 * OPTIMIZATION: This function provides a smoother experience than full re-renders
 * for cases like 4/4 16ths where the dot pattern repeats but labels change.
 *
 * @param {HTMLElement} container - The beat indicator container
 * @param {Array} measureLayout - Full measure layout
 * @param {Object} phrase - Current phrase {start, end, length}
 * @param {Array} cachedElements - Existing dotElements array (wrappers)
 */
function updatePhraseLabels(container, measureLayout, phrase, cachedElements) {
  const phraseSlice = measureLayout.slice(phrase.start, phrase.end + 1);

  // Safety check: ensure we have cached elements
  if (!cachedElements || cachedElements.length === 0) {
    debugLog("visuals", "⚠️ updatePhraseLabels called with no cached elements");
    return;
  }

  cachedElements.forEach((wrapper, i) => {
    // Safety: don't exceed phrase length
    if (i >= phraseSlice.length) return;

    const text = wrapper.querySelector(".phonation-text");
    if (!text) return;

    const newLabel = phraseSlice[i].label;

    // Skip if label hasn't changed (optimization)
    if (text.textContent === newLabel) return;

    // CRITICAL: Kill any existing animations on this text element
    gsap.killTweensOf(text);

    // Enhanced animation: slide out left, then slide in from right
    gsap.to(text, {
      x: -15,
      opacity: 0,
      duration: 0.12,
      ease: "power1.in",
      onComplete: () => {
        text.textContent = newLabel;
        gsap.fromTo(
          text,
          { x: 15, opacity: 0 },
          {
            x: 0,
            opacity: 1,
            duration: 0.12,
            ease: "power1.out",
          }
        );
      },
    });
  });
}

/**
 * Flashes the active dot within the current phrase.
 * Clears previous flashing state and applies new flash to the active tick.
 *
 * @param {HTMLElement} container - The beat indicator container
 * @param {number} tickInPhrase - Which tick in the phrase (0-3) is active
 * @param {Array} dotElements - Cached array of dot wrapper elements
 * @param {Array} measureLayout - Full measure layout for accessing dot info
 * @param {number} currentTickInMeasure - Absolute tick index in measure
 * @param {boolean} isPrimaryAccent - Whether this is the downbeat
 * @param {number} flashTimeoutRef - Reference to existing timeout to clear
 * @returns {number} New timeout ID for cleanup
 */
function flashActiveDot(
  container,
  tickInPhrase,
  dotElements,
  measureLayout,
  currentTickInMeasure,
  isPrimaryAccent,
  flashTimeoutRef,
  panelId
) {
  // Determine if we're in pattern mode or standard mode (Respecting User Preference)
  const isPatternMode =
    panelId === "groove" &&
    patternScheduler.isActive() &&
    advancedMode.isDashboardEnabled();
  clearTimeout(flashTimeoutRef);

  // 1. Unified cleanup of previous playhead and rhythmic color states
  container
    .querySelectorAll(".playing, .flashing, [class*='flash-']")
    .forEach((el) => {
      el.classList.remove(
        "playing",
        "flashing",
        "accent-flash",
        "normal-flash",
        "flash-primary",
        "flash-secondary",
        "flash-tertiary"
      );
    });

  if (isPatternMode) {
    // 2. Pattern Mode: Vertical Playhead logic
    // We add 2 because child(1) is the instrument label (HH, KI, etc.)
    const domIndex = tickInPhrase + 2;
    const dots = container.querySelectorAll(
      `.pattern-row > div:nth-child(${domIndex}) .pattern-dot`
    );
    const label = container.querySelector(
      `.pattern-row:last-child > div:nth-child(${domIndex}) .phonation-text`
    );

    dots.forEach((d) => d.classList.add("playing"));

    // Apply rhythmic colors to the bottom-row labels
    if (label) {
      label.classList.add(
        `flash-${measureLayout[currentTickInMeasure].colorClass}`
      );
    }
  } else {
    // 3. Standard Mode: Single Dot logic
    const activeWrapper = dotElements[tickInPhrase];
    if (!activeWrapper) return flashTimeoutRef;

    const dot = activeWrapper.children[0];
    const text = activeWrapper.children[1];
    const dotInfo = measureLayout[currentTickInMeasure];

    if (dot)
      dot.classList.add(
        "flashing",
        isPrimaryAccent ? "accent-flash" : "normal-flash"
      );
    if (text) text.classList.add(`flash-${dotInfo.colorClass}`);
  }

  // 4. Schedule automatic state removal
  return setTimeout(() => {
    container
      .querySelectorAll(".playing, .flashing, [class*='flash-']")
      .forEach((el) => {
        el.classList.remove(
          "playing",
          "flashing",
          "accent-flash",
          "normal-flash",
          "flash-primary",
          "flash-secondary",
          "flash-tertiary"
        );
      });
  }, constants.UX.TIMING.FLASH_MS);
}

/**
 * The main callback function registered with the metronome cores.
 */
export function createVisualCallback(panelId = "groove") {
  const containerId =
    panelId === "groove"
      ? "beat-indicator-container"
      : "beat-indicator-container-simple";

  // === STATE MANAGEMENT ===
  let lastRenderedSignature = "";
  let lastRenderedTicksPerBeat = -1;
  let flashTimeout = null;

  // === NEW STATE for phrase-based rendering ===
  let currentPhraseIndex = -1; // Which phrase (0-3 for 4/4 16ths) we're currently in
  let measureLayout = []; // Full measure layout from generateMeasureLayout
  let phrases = []; // Phrase segments from segmentIntoPhrases
  let intelligentPanning = true; // Current panning mode
  let dotElements = []; // Cache of DOM elements for current phrase (up to 4 wrappers)

  // === PANNING MODE EVENT LISTENER ===
  // Listen for toggle changes and update our local state
  document.addEventListener("panningModeChanged", (e) => {
    intelligentPanning = e.detail.intelligent;
    debugLog(
      "visuals",
      `🎯 [${panelId}] Panning mode changed to: ${
        intelligentPanning ? "Intelligent" : "Forced"
      }`
    );
  });

  // === INITIALIZE FROM LOCALSTORAGE ===
  // Read initial value on callback creation
  const stored = localStorage.getItem("intelligentPanningMode");
  const isValidStored = stored === "true" || stored === "false";
  intelligentPanning = isValidStored ? stored === "true" : true;
  debugLog(
    "visuals",
    `🎯 [${panelId}] Initial panning mode: ${
      intelligentPanning ? "Intelligent" : "Forced"
    }`
  );

  return (tickIndex, isPrimaryAccent, isMainBeat) => {
    try {
      const container = document.getElementById(containerId);
      if (!container) return;

      // Get the correct metronome core
      const core = panelId === "groove" ? metronome : simpleMetronome.core;
      // Safety check
      if (!core || typeof core.getTimeSignature !== "function") {
        return;
      }

      const timeSignature = core.getTimeSignature();
      const ticksPerBeat = core.getTicksPerBeat();
      const isPatternActive =
        panelId === "groove" && patternScheduler.isActive();

      let totalTicksInMeasure;
      let currentMeasures = 1; // Declare here so it's accessible below

      if (isPatternActive) {
        const pattern = getGroovePattern(
          document
            .getElementById("displayGroove")
            .textContent.replace("Groove: ", "")
            .replace("Preview: ", "")
        );
        currentMeasures = pattern?.measures || 1; // Update the shared variable
        totalTicksInMeasure =
          timeSignature.beats * ticksPerBeat * currentMeasures;
      } else {
        totalTicksInMeasure = timeSignature.beats * ticksPerBeat;
      }

      const signatureKey = `${timeSignature.beats}/${timeSignature.value}-${totalTicksInMeasure}`;

      if (totalTicksInMeasure === 0) return;

      const currentTickInMeasure = tickIndex % totalTicksInMeasure;
      // Only show the 4-row dashboard if active AND enabled in settings
      const showDashboard =
        isPatternActive && advancedMode.isDashboardEnabled();

      // Detect if we need to swap between Standard and Pattern mode
      const targetMode = showDashboard ? "pattern" : "standard";
      if (container.dataset.renderedMode !== targetMode) {
        container.dataset.renderedMode = targetMode;
        container.classList.toggle("pattern-mode", showDashboard);
        lastRenderedSignature = ""; // Force a re-render
      }

      // === Rebuild layout on signature or subdivision change ===
      if (
        signatureKey !== lastRenderedSignature ||
        ticksPerBeat !== lastRenderedTicksPerBeat
      ) {
        measureLayout = utils.generateMeasureLayout(
          timeSignature,
          ticksPerBeat,
          currentMeasures
        );
        phrases = utils.segmentIntoPhrases(totalTicksInMeasure);
        currentPhraseIndex = -1;

        // CRITICAL: Kill ALL GSAP animations before clearing DOM
        const oldPanningContainer =
          container.querySelector(".panning-container");
        if (oldPanningContainer) {
          gsap.killTweensOf(oldPanningContainer);
          const allElements = oldPanningContainer.querySelectorAll("*");
          allElements.forEach((el) => gsap.killTweensOf(el));
        }

        // Clear container to remove old dot hierarchy
        container.innerHTML = "";
        dotElements.length = 0;

        lastRenderedSignature = signatureKey;
        lastRenderedTicksPerBeat = ticksPerBeat;

        debugLog(
          "visuals",
          `🎼 [${panelId}] Layout rebuilt: ${signatureKey}, ${totalTicksInMeasure} ticks`
        );
        debugLog("visuals", `📊 [${panelId}] Phrases:`, phrases);
        debugLog(
          "visuals",
          `🔄 [${panelId}] Visual reset: container cleared, forcing re-render`
        );
      }

      // 1. Resolve Current State (Calculated once at the top)
      const newPhraseIndex = phrases.findIndex(
        (p) => currentTickInMeasure >= p.start && currentTickInMeasure <= p.end
      );

      if (newPhraseIndex === -1) {
        debugLog(
          "visuals",
          `[${panelId}] ⚠️ Tick ${currentTickInMeasure} not in any phrase!`
        );
        return;
      }

      const currentPhrase = phrases[newPhraseIndex];
      const tickInPhrase = currentTickInMeasure - currentPhrase.start;
      const isMeasureBoundary = currentTickInMeasure === 0;
      const shouldForceRender =
        !intelligentPanning && isMeasureBoundary && phrases.length === 1;

      // 2. Get Strategy from Arbiter
      const strategy = _getPhraseStrategy({
        isRealPhraseBoundary: newPhraseIndex !== currentPhraseIndex,
        shouldForceRender,
        intelligentPanning,
        isPatternActive,
        measureLayout,
        prevPhrase:
          phrases[
            currentPhraseIndex === -1 ? phrases.length - 1 : currentPhraseIndex
          ],
        currentPhrase,
        isFirstPhrase: currentPhraseIndex === -1,
      });

      // 3. Execute Decision
      if (strategy === "FULL_PAN") {
        dotElements = renderNewPhrase(
          container,
          measureLayout,
          currentPhrase,
          core,
          dotElements,
          panelId
        );
      } else if (strategy === "LABEL_UPDATE") {
        updatePhraseLabels(
          container,
          measureLayout,
          currentPhrase,
          dotElements
        );
      }

      currentPhraseIndex = newPhraseIndex;

      // === WITHIN-PHRASE: Ensure phrase is rendered and flash active dot ===
      // Skip fallback if pattern is active to prevent overwriting the 4-track grid
      if (!isPatternActive) {
        let panningContainer = container.querySelector(".panning-container");
        if (!panningContainer || panningContainer.children.length === 0) {
          // No phrase rendered yet - render current phrase without animation
          container.innerHTML = "";
          panningContainer = document.createElement("div");
          panningContainer.className = "panning-container";
          panningContainer.style.display = "flex";
          container.appendChild(panningContainer);

          const phraseSlice = measureLayout.slice(
            currentPhrase.start,
            currentPhrase.end + 1
          );
          dotElements.length = 0;

          phraseSlice.forEach((dotInfo) => {
            const wrapper = document.createElement("div");
            wrapper.className = "beat-wrapper";

            const dot = document.createElement("div");
            dot.className = `beat-dot ${dotInfo.size}`;
            if (dotInfo.isAccent) dot.classList.add("accent");

            const text = document.createElement("div");
            text.className = "phonation-text";
            text.textContent = dotInfo.label;

            wrapper.appendChild(dot);
            wrapper.appendChild(text);
            panningContainer.appendChild(wrapper);
            dotElements.push(wrapper);
          });

          // Center the container immediately (for NO UPDATE cases)
          gsap.set(panningContainer, { x: 0 });
        }
      }

      // === FLASH ACTIVE DOT (using tickInPhrase) ===
      flashTimeout = flashActiveDot(
        container,
        tickInPhrase,
        dotElements,
        measureLayout,
        currentTickInMeasure,
        isPrimaryAccent,
        flashTimeout,
        panelId
      );
    } catch (error) {
      console.error(`❌ Visual callback error [${panelId}]:`, error);
      console.error("Stack trace:", error.stack);
      // Don't rethrow - let metronome continue even if visuals break
    }
  };
}

/**
 * Primes the visual containers while the metronome is idle.
 * Now dashboard-aware for pattern previews.
 *
 * @param {string} [panelId="groove"]
 */
export function primeVisuals(panelId = "groove") {
  const containerId =
    panelId === "groove"
      ? "beat-indicator-container"
      : "beat-indicator-container-simple";
  const container = document.getElementById(containerId);
  if (!container) return;

  const core = panelId === "groove" ? metronome : simpleMetronome.core;
  const timeSignature = core.getTimeSignature();
  const ticksPerBeat = core.getTicksPerBeat();
  const isPatternMode =
    panelId === "groove" &&
    patternScheduler.isActive() &&
    advancedMode.isDashboardEnabled();

  // Calculate measures for the Idle layout: If we're in groove panel with an active pattern, use the pattern's measure count. Otherwise, default to 1 measure.
  let measures = 1;
  if (panelId === "groove" && patternScheduler.isActive()) {
    // We get the name of the groove currently shown in the UI status area
    const displayEl = document.getElementById("displayGroove");
    const grooveName = displayEl
      ? displayEl.textContent
          .replace("Groove: ", "")
          .replace("Preview: ", "")
          .trim()
      : "";

    const pattern = getGroovePattern(grooveName);
    measures = pattern?.measures || 1;
  }

  container.innerHTML = "";
  container.classList.toggle("pattern-mode", isPatternMode);

  const panningContainer = document.createElement("div");
  panningContainer.className = "panning-container";
  panningContainer.style.display = "flex";
  if (isPatternMode) panningContainer.style.flexDirection = "column";
  container.appendChild(panningContainer);

  const measureLayout = utils.generateMeasureLayout(
    timeSignature,
    ticksPerBeat,
    measures
  );
  const tracks = isPatternMode ? ["hihat", "kick", "snare", "HHPed"] : [null];
  const showPed = document.getElementById("toggleHHPed")?.checked ?? true;

  tracks.forEach((trackID) => {
    if (trackID === "HHPed" && !showPed) return;
    let dotParent = panningContainer;

    if (isPatternMode) {
      const row = document.createElement("div");
      row.className = "pattern-row";
      if (trackID) row.dataset.track = trackID; // Added identity for CSS coloring
      const label = document.createElement("div");
      label.className = "pattern-row-label";
      const labelMap = { hihat: "HH", kick: "KI", snare: "SN", HHPed: "PD" };
      label.textContent = labelMap[trackID] || "";
      row.appendChild(label);
      panningContainer.appendChild(row);
      dotParent = row;
    }

    measureLayout.forEach((dotInfo, i) => {
      const showPhonation =
        !isPatternMode || trackID === (showPed ? "HHPed" : "snare");
      const wrapper = _createBeatElement(
        dotInfo,
        isPatternMode,
        trackID,
        i,
        showPhonation
      );
      dotParent.appendChild(wrapper);
    });
  });
}

/**
 * Determines the rendering strategy based on the current state.
 * @private
 */
function _getPhraseStrategy(p) {
  const {
    isRealPhraseBoundary,
    shouldForceRender,
    intelligentPanning,
    isPatternActive,
    measureLayout,
    prevPhrase,
    currentPhrase,
    isFirstPhrase,
  } = p;

  // 1. Measure boundary in "Forced Panning" mode
  if (shouldForceRender) return "FULL_PAN";

  // 2. Stay in existing phrase if not at a boundary
  if (!isRealPhraseBoundary) return "NONE";

  // 3. Intelligent Panning Logic (Non-dashboard only)
  if (intelligentPanning && !isPatternActive) {
    const comparison = utils.comparePhrasePatterns(
      measureLayout,
      prevPhrase,
      currentPhrase
    );

    // Identical phrase (Common in 4/4 8ths or 4ths)
    if (comparison.labelMatch) {
      return isFirstPhrase ? "FULL_PAN" : "NONE";
    }

    // Structure matches but labels differ (Common in 4/4 16ths)
    if (comparison.hierarchyMatch) {
      return "LABEL_UPDATE";
    }
  }

  // 4. Default: Structure changed or Dashboard active
  return "FULL_PAN";
}

export function updateCountdownBadge(badgeEl, options = {}) {
  if (!badgeEl) return;
  const { step = "", fadeIn = false, fadeOut = false } = options;
  badgeEl.textContent = step;
  badgeEl.classList.remove("fade-in", "fade-out");
  void badgeEl.offsetWidth; // force reflow
  if (fadeIn) badgeEl.classList.add("fade-in");
  if (fadeOut) badgeEl.classList.add("fade-out");
}

export function clearCountdownBadge(badgeEl) {
  if (!badgeEl) return;
  badgeEl.textContent = "";
  badgeEl.classList.remove("fade-in");
  badgeEl.classList.add("fade-out");
}
