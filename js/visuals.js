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
 * Computes how many ticks of lookback are needed to satisfy lead time requirements.
 * Pure arithmetic function: (N * perTickMs) + lookaheadMs >= minLeadMs
 *
 * @private
 * @param {number} secondsPerTick - Current temporal width of one tick
 * @param {number} lookaheadS - Audio scheduler lookahead in seconds
 * @param {number} minLeadMs - Target minimum lead time in milliseconds
 * @param {number} maxLookback - Hard ceiling for tick lookback
 * @returns {number} Required ticks [0...maxLookback]
 */
function _ticksNeededForLeadTime(
  secondsPerTick,
  lookaheadS,
  minLeadMs,
  maxLookback
) {
  const perTickMs = secondsPerTick * 1000;
  const lookaheadMs = lookaheadS * 1000;

  // Minimal N such that lead time is satisfied
  let n = Math.ceil((minLeadMs - lookaheadMs) / perTickMs);

  return Math.max(0, Math.min(maxLookback, n));
}

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
 * Pure construction: Builds a new .panning-container and its child dots/rows.
 * Does NOT touch the live DOM.
 *
 * @private
 * @returns {{element: HTMLElement, dotElements: HTMLElement[]}}
 */
function _buildPhraseContainer(measureLayout, phrase, panelId) {
  const panningContainer = document.createElement("div");
  panningContainer.className = "panning-container pending-overlay";

  const isPatternMode =
    panelId === "groove" &&
    patternScheduler.isActive() &&
    advancedMode.isDashboardEnabled();

  if (isPatternMode) {
    panningContainer.style.flexDirection = "column";
  }

  const phraseSlice = measureLayout.slice(phrase.start, phrase.end + 1);
  const builtDots = [];
  const tracks = isPatternMode ? ["hihat", "kick", "snare", "HHPed"] : [null];
  const showPed = document.getElementById("toggleHHPed")?.checked ?? true;

  tracks.forEach((trackID) => {
    if (trackID === "HHPed" && !showPed) return;

    let dotParent = panningContainer;

    if (isPatternMode) {
      const row = document.createElement("div");
      row.className = "pattern-row";
      if (trackID) row.dataset.track = trackID;

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
      builtDots.push(wrapper);
    });
  });

  return { element: panningContainer, dotElements: builtDots };
}

/**
 * Attaches the built phrase to the DOM and triggers the entrance animation.
 * Caps duration to the available lookback budget
 *
 * @private
 */
function _animateIncomingPhrase(
  container,
  built,
  bpm,
  lookbackUsed,
  secondsPerTick
) {
  // 1. Subordinate the "Past": Find the currently active container and dim it
  const activeContainer = container.querySelector(
    ".panning-container:not(.pending-overlay)"
  );
  if (activeContainer) {
    gsap.to(activeContainer, {
      opacity: 0.35,
      duration: 0.25,
      ease: "power2.out",
    });
  }

  container.appendChild(built.element);

  const beatBasedDuration = Math.max(0.08, Math.min(0.4, (60 / bpm) * 0.75));
  const lookaheadS = constants.AUDIO.LOOKAHEAD_S;
  const reserveS =
    constants.UX.VISUALS.PHRASE_PRERENDER.OUTGOING_FLASH_RESERVE_MS / 1000;

  const availableBudgetS =
    lookbackUsed * secondsPerTick + lookaheadS - reserveS;
  const duration = Math.max(
    0.05,
    Math.min(beatBasedDuration, availableBudgetS)
  );

  // 2. Highlight the "Future": New phrase enters at 100% opacity
  gsap.fromTo(
    built.element,
    { x: 50, opacity: 0 },
    { x: 0, opacity: 1, duration, ease: "power1.out" }
  );
}
/**
 * Swaps the current phrase with the pre-rendered one.
 * Kills old animations and settles the new container into the flow.
 *
 * @private
 * @param {HTMLElement} container - The main beat indicator container
 * @param {Object} built - The result from _buildPhraseContainer {element, dotElements}
 * @param {Array} dotElementsRef - The closure's dotElements array to be updated
 */
function _promotePendingToActive(container, built, dotElementsRef) {
  // 1. Identify and cleanup the OLD container(s)
  const oldContainers = container.querySelectorAll(
    ".panning-container:not(.pending-overlay)"
  );

  oldContainers.forEach((old) => {
    gsap.killTweensOf(old);
    const allChildren = old.querySelectorAll("*");
    allChildren.forEach((child) => gsap.killTweensOf(child));
    old.remove();
  });

  // 2. Promote the NEW container
  built.element.classList.remove("pending-overlay");

  // 3. Sync the dotElements reference so flashing hits the new targets
  dotElementsRef.length = 0;
  built.dotElements.forEach((el) => dotElementsRef.push(el));
}

/**
 * Orchestrates an immediate phrase swap (fallback scenario).
 * Used when the system cannot pre-render early or during initial load.
 *
 * @param {HTMLElement} container - The main beat indicator container
 * @param {Array} measureLayout - Full measure layout data
 * @param {Object} phrase - Current phrase segment {start, end, length}
 * @param {Object} core - The metronome core for temporal math
 * @param {Array} dotElements - Reference to closure dotElements (updated by reference)
 * @param {string} panelId - 'groove' or 'simple'
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
  const bpm = core.getBpm();
  const timeSignature = core.getTimeSignature();
  const ticksPerBeat = core.getTicksPerBeat();
  const secondsPerTick =
    ((60 / bpm) * (4 / timeSignature.value)) / ticksPerBeat;

  // 1. Build (Off-DOM)
  const built = _buildPhraseContainer(measureLayout, phrase, panelId);

  // 2. Cold Start Check
  // If the container has no active (non-overlay) content, we perform an instant
  // insertion to prevent the 50ms "rattle" jitter on the first beat.
  const hasActiveContent = !!container.querySelector(
    ".panning-container:not(.pending-overlay)"
  );

  if (!hasActiveContent) {
    // Instant Insertion
    container.appendChild(built.element);
    _promotePendingToActive(container, built, dotElements);
  } else {
    // Mid-session Fallback: Animate overlay, then promote
    _animateIncomingPhrase(container, built, bpm, 0, secondsPerTick);
    _promotePendingToActive(container, built, dotElements);
  }

  return dotElements;
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

  // === PENDING (PRE-RENDERED) STATE ===
  let pendingPhraseContainer = null; // the off-DOM-but-attached .panning-container being prepared early
  let pendingPhraseIndex = -1; // which phrase index pendingPhraseContainer corresponds to
  let pendingDotElements = []; // dotElements equivalent for the pending container

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

      const core = panelId === "groove" ? metronome : simpleMetronome.core;
      if (!core || typeof core.getTimeSignature !== "function") return;

      // 1. TEMPORAL MATH
      const bpm = core.getBpm();
      const timeSignature = core.getTimeSignature();
      const ticksPerBeat = core.getTicksPerBeat();
      const isPatternActive =
        panelId === "groove" && patternScheduler.isActive();
      const secondsPerTick =
        ((60 / bpm) * (4 / timeSignature.value)) / ticksPerBeat;

      let totalTicksInMeasure;
      let currentMeasures = 1;

      if (isPatternActive) {
        const displayEl = document.getElementById("displayGroove");
        const grooveName = displayEl?.textContent
          .replace("Groove: ", "")
          .replace("Preview: ", "")
          .trim();
        const pattern = getGroovePattern(grooveName);
        currentMeasures = pattern?.measures || 1;
        totalTicksInMeasure =
          timeSignature.beats * ticksPerBeat * currentMeasures;
      } else {
        totalTicksInMeasure = timeSignature.beats * ticksPerBeat;
      }

      const signatureKey = `${timeSignature.beats}/${timeSignature.value}-${totalTicksInMeasure}`;
      if (totalTicksInMeasure === 0) return;

      // --- MODE SWITCH DETECTION ---
      // Detect if we need to swap between Standard and Pattern (Dashboard) mode.
      const showDashboard =
        isPatternActive && advancedMode.isDashboardEnabled();
      const targetMode = showDashboard ? "pattern" : "standard";

      if (container.dataset.renderedMode !== targetMode) {
        container.dataset.renderedMode = targetMode;
        container.classList.toggle("pattern-mode", showDashboard);
        // Force a layout rebuild by clearing the signature key
        lastRenderedSignature = "";
        debugLog("visuals", `🔄 [${panelId}] Mode changed to: ${targetMode}`);
      }

      const currentTickInMeasure = tickIndex % totalTicksInMeasure;

      // 2. LAYOUT RESET GUARD
      if (
        signatureKey !== lastRenderedSignature ||
        ticksPerBeat !== lastRenderedTicksPerBeat
      ) {
        // --- Memory Safety: Kill all existing tweens before clearing DOM ---
        const activeContainers =
          container.querySelectorAll(".panning-container");
        activeContainers.forEach((c) => {
          gsap.killTweensOf(c);
          c.querySelectorAll("*").forEach((child) => gsap.killTweensOf(child));
        });

        measureLayout = utils.generateMeasureLayout(
          timeSignature,
          ticksPerBeat,
          currentMeasures
        );
        phrases = utils.segmentIntoPhrases(totalTicksInMeasure);

        container.innerHTML = "";
        dotElements.length = 0;

        // --- IMMEDIATE RESTORATION (The Fix) ---
        // Determine which phrase the current tick belongs to and render it immediately.
        // This ensures the dots appear as soon as a setting is changed.
        const initialPhraseIdx = phrases.findIndex(
          (p) =>
            currentTickInMeasure >= p.start && currentTickInMeasure <= p.end
        );

        renderNewPhrase(
          container,
          measureLayout,
          phrases[initialPhraseIdx],
          core,
          dotElements,
          panelId
        );

        // Synchronize indices and discard stale pre-renders
        currentPhraseIndex = initialPhraseIdx;
        pendingPhraseContainer = null;
        pendingPhraseIndex = -1;
        pendingDotElements = [];

        lastRenderedSignature = signatureKey;
        lastRenderedTicksPerBeat = ticksPerBeat;
      }
      const newPhraseIndex = phrases.findIndex(
        (p) => currentTickInMeasure >= p.start && currentTickInMeasure <= p.end
      );
      const currentPhrase = phrases[newPhraseIndex];
      const isBoundaryTick = newPhraseIndex !== currentPhraseIndex;

      // 3. PRE-RENDER TRIGGER
      const ticksUntilBoundary = currentPhrase.end - currentTickInMeasure;
      const requiredLookback = _ticksNeededForLeadTime(
        secondsPerTick,
        constants.AUDIO.LOOKAHEAD_S,
        constants.UX.VISUALS.PHRASE_PRERENDER.MIN_LEAD_MS,
        constants.UX.VISUALS.PHRASE_PRERENDER.MAX_LOOKBACK_TICKS
      );

      // Trigger if we are exactly at the lookback tick and have nothing pending
      if (
        ticksUntilBoundary === requiredLookback &&
        pendingPhraseContainer === null
      ) {
        const nextIdx = (newPhraseIndex + 1) % phrases.length;
        const nextPhrase = phrases[nextIdx];

        // Only pre-build if the NEXT phrase would result in a FULL_PAN
        const nextStrategy = _getPhraseStrategy({
          isRealPhraseBoundary: true,
          shouldForceRender: !intelligentPanning && phrases.length === 1,
          intelligentPanning,
          isPatternActive,
          measureLayout,
          prevPhrase: currentPhrase,
          currentPhrase: nextPhrase,
          isFirstPhrase: false,
        });

        if (nextStrategy === "FULL_PAN") {
          const built = _buildPhraseContainer(
            measureLayout,
            nextPhrase,
            panelId
          );
          pendingPhraseContainer = built.element;
          pendingDotElements = built.dotElements;
          pendingPhraseIndex = nextIdx;
          _animateIncomingPhrase(
            container,
            built,
            bpm,
            requiredLookback,
            secondsPerTick
          );
          debugLog(
            "visuals",
            `🏗️ [${panelId}] Pre-rendered phrase ${nextIdx} early.`
          );
        }
      }

      // 4. BOUNDARY RESOLUTION
      if (isBoundaryTick) {
        // Use the pre-rendered phrase if it matches the current boundary
        if (pendingPhraseContainer && pendingPhraseIndex === newPhraseIndex) {
          _promotePendingToActive(
            container,
            {
              element: pendingPhraseContainer,
              dotElements: pendingDotElements,
            },
            dotElements
          );
          pendingPhraseContainer = null;
          pendingPhraseIndex = -1;
          pendingDotElements = [];
          debugLog(
            "visuals",
            `✅ [${panelId}] Promoted pending phrase ${newPhraseIndex}`
          );
        } else {
          // Fallback: The immediate orchestrator
          const strategy = _getPhraseStrategy({
            isRealPhraseBoundary: true,
            shouldForceRender: !intelligentPanning && phrases.length === 1,
            intelligentPanning,
            isPatternActive,
            measureLayout,
            prevPhrase:
              phrases[
                currentPhraseIndex === -1
                  ? phrases.length - 1
                  : currentPhraseIndex
              ],
            currentPhrase,
            isFirstPhrase: currentPhraseIndex === -1,
          });

          if (strategy === "FULL_PAN") {
            renderNewPhrase(
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
        }
        currentPhraseIndex = newPhraseIndex;
      }

      // 5. FLASH ACTIVE DOT
      const tickInPhrase = currentTickInMeasure - currentPhrase.start;
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
