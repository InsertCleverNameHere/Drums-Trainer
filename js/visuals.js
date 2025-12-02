/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
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

import { debugLog } from "./debug.js";
import { VISUAL_TIMING } from "./constants.js";

const BEATS_PER_PAGE = 8; // How many main beats to show at once.

/**
 * Segments a measure into phrases of up to 4 ticks each.
 * Returns array of phrase objects with start/end indices.
 *
 * @param {number} totalTicks - Total number of ticks in the measure
 * @returns {Array<{start: number, end: number, length: number}>}
 *
 * Examples:
 *   4 ticks  → [{start:0, end:3, length:4}]
 *   16 ticks → [{start:0, end:3, length:4}, {start:4, end:7, length:4}, ...]
 *   7 ticks  → [{start:0, end:3, length:4}, {start:4, end:6, length:3}]
 */
function segmentIntoPhrases(totalTicks) {
  const phrases = [];
  let start = 0;

  while (start < totalTicks) {
    const remainingTicks = totalTicks - start;
    const phraseLength = Math.min(4, remainingTicks);

    phrases.push({
      start,
      end: start + phraseLength - 1,
      length: phraseLength,
    });

    start += phraseLength;
  }

  return phrases;
}

/**
 * Compares two phrase slices from measureLayout to detect differences.
 * Used by intelligent panning mode to decide: no update, label update, or full pan.
 *
 * @param {Array} layout - Complete measure layout from generateMeasureLayout
 * @param {Object} phrase1 - First phrase {start, end, length}
 * @param {Object} phrase2 - Second phrase {start, end, length}
 * @returns {{countMatch: boolean, hierarchyMatch: boolean, labelMatch: boolean}}
 *
 * Examples:
 *   4/4 16ths, phrase 0 vs 1: {countMatch: true, hierarchyMatch: true, labelMatch: false}
 *   7/8, phrase 0 vs 1: {countMatch: false, hierarchyMatch: false, labelMatch: false}
 */
function comparePhrasePatterns(layout, phrase1, phrase2) {
  // Extract slices from the full measure layout
  const slice1 = layout.slice(phrase1.start, phrase1.end + 1);
  const slice2 = layout.slice(phrase2.start, phrase2.end + 1);

  // Count match: Do both phrases have the same number of dots?
  const countMatch = slice1.length === slice2.length;

  // Hierarchy match: Do dots have the same size pattern?
  // (Only valid if counts match)
  const hierarchyMatch =
    countMatch && slice1.every((dot, i) => dot.size === slice2[i].size);

  // Label match: Do dots have the same phonation labels?
  // (Only valid if hierarchy matches)
  const labelMatch =
    hierarchyMatch && slice1.every((dot, i) => dot.label === slice2[i].label);

  return { countMatch, hierarchyMatch, labelMatch };
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
function renderNewPhrase(container, measureLayout, phrase, core, dotElements) {
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
  container.appendChild(panningContainer);

  // Extract the slice of dots for this phrase
  const phraseSlice = measureLayout.slice(phrase.start, phrase.end + 1);

  // Clear and rebuild dotElements cache
  dotElements.length = 0; // Clear array without losing reference

  // Create DOM elements for each dot in the phrase
  phraseSlice.forEach((dotInfo) => {
    const wrapper = document.createElement("div");
    wrapper.className = "beat-wrapper";

    const dot = document.createElement("div");
    dot.className = `beat-dot ${dotInfo.size}`;
    if (dotInfo.isAccent) {
      dot.classList.add("accent");
    }

    const text = document.createElement("div");
    text.className = "phonation-text";
    text.textContent = dotInfo.label;

    wrapper.appendChild(dot);
    wrapper.appendChild(text);
    panningContainer.appendChild(wrapper);

    // Cache the wrapper for later access
    dotElements.push(wrapper);
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
  flashTimeoutRef
) {
  // Clear any existing flash timeout
  clearTimeout(flashTimeoutRef);

  // Remove flashing state from previously flashed elements
  const prevFlashedDot = container.querySelector(".beat-dot.flashing");
  const prevFlashedText = container.querySelector(
    '.phonation-text[class*="flash-"]'
  );

  if (prevFlashedDot) {
    prevFlashedDot.classList.remove("flashing", "accent-flash", "normal-flash");
  }

  if (prevFlashedText) {
    prevFlashedText.className = "phonation-text";
  }

  // Get the active dot wrapper for this tick
  const activeWrapper = dotElements[tickInPhrase];
  if (!activeWrapper) {
    debugLog(
      "visuals",
      `[${panelId}] ⚠️ No wrapper found for tickInPhrase: ${tickInPhrase}`
    );
    return flashTimeoutRef;
  }

  const dot = activeWrapper.children[0];
  const text = activeWrapper.children[1];
  const dotInfo = measureLayout[currentTickInMeasure];

  // Safety check: ensure all elements exist
  if (!dot || !text || !dotInfo) {
    debugLog(
      "visuals",
      `[${panelId}] ⚠️ Missing elements for flash: dot=${!!dot}, text=${!!text}, dotInfo=${!!dotInfo}`
    );
    return flashTimeoutRef;
  }

  // Apply flashing state
  dot.classList.add("flashing");

  if (isPrimaryAccent) {
    dot.classList.add("accent-flash");
  } else {
    dot.classList.add("normal-flash");
  }

  text.classList.add(`flash-${dotInfo.colorClass}`);

  // Schedule flash removal after 120ms
  const newTimeout = setTimeout(() => {
    dot.classList.remove("flashing", "accent-flash", "normal-flash");
    text.className = "phonation-text";
  }, VISUAL_TIMING.FLASH_DURATION_MS);

  return newTimeout;
}

/**
 * The Layout Engine.
 * Takes the current time signature and subdivision and returns an array
 * of "virtual dot" objects representing the entire measure.
 */
function generateMeasureLayout(timeSignature, ticksPerBeat) {
  const layout = [];
  const { beats } = timeSignature;
  const totalTicksInMeasure = beats * ticksPerBeat;

  const phonationPatterns = {
    1: [
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
      "11",
      "12",
      "13",
      "14",
      "15",
      "16",
    ],
    2: [
      "1",
      "&",
      "2",
      "&",
      "3",
      "&",
      "4",
      "&",
      "5",
      "&",
      "6",
      "&",
      "7",
      "&",
      "8",
      "&",
    ],
    4: [
      "1",
      "e",
      "&",
      "a",
      "2",
      "e",
      "&",
      "a",
      "3",
      "e",
      "&",
      "a",
      "4",
      "e",
      "&",
      "a",
    ],
  };

  for (let i = 0; i < totalTicksInMeasure; i++) {
    const tickInBeat = i % ticksPerBeat;
    const currentBeat = Math.floor(i / ticksPerBeat);

    let size = "tertiary";
    let colorClass = "tertiary";

    // Determine size and color based on rhythmic hierarchy
    if (tickInBeat === 0) {
      // This is a main beat (1, 2, 3...)
      size = "primary";
      colorClass = "primary";
    } else if (ticksPerBeat === 4 && tickInBeat === 2) {
      // This is an "&" on a 16th grid
      size = "secondary";
      colorClass = "secondary";
    } else if (ticksPerBeat === 2 && tickInBeat === 1) {
      // This is an "&" on an 8th grid
      size = "secondary";
      colorClass = "secondary";
    }

    // Determine phonation label
    const pattern = phonationPatterns[ticksPerBeat] || phonationPatterns[1];
    const labelIndex = ticksPerBeat === 1 ? currentBeat : i;

    let label = pattern[labelIndex % pattern.length] || String(currentBeat + 1);
    if (ticksPerBeat === 1 && currentBeat >= pattern.length) {
      label = String(currentBeat + 1);
    }

    layout.push({
      size,
      label,
      colorClass,
      isAccent: i === 0,
    });
  }
  return layout;
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
      const core =
        panelId === "groove" ? window.metronome : window.simpleMetronome.core;
      // Safety check
      if (!core || typeof core.getTimeSignature !== "function") {
        return;
      }

      const timeSignature = core.getTimeSignature();
      const ticksPerBeat = core.getTicksPerBeat();
      const signatureKey = `${timeSignature.beats}/${timeSignature.value}`;
      const totalTicksInMeasure = timeSignature.beats * ticksPerBeat;

      if (totalTicksInMeasure === 0) return;

      const currentTickInMeasure = tickIndex % totalTicksInMeasure;

      // === NEW: REBUILD LAYOUT ON SIGNATURE OR SUBDIVISION CHANGE ===
      if (
        signatureKey !== lastRenderedSignature ||
        ticksPerBeat !== lastRenderedTicksPerBeat
      ) {
        measureLayout = generateMeasureLayout(timeSignature, ticksPerBeat);
        phrases = segmentIntoPhrases(totalTicksInMeasure);
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

      // === NEW: DETERMINE CURRENT PHRASE ===
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

      // NEW: Detect measure boundaries for forced mode single-phrase edge case
      const isMeasureBoundary = currentTickInMeasure === 0;
      const shouldForceRender =
        !intelligentPanning && isMeasureBoundary && phrases.length === 1;

      // === PHRASE BOUNDARY DETECTION & RENDERING ===
      // This is the core decision engine that determines when and how to update visuals.
      // Logic flow:
      // 1. Detect if we've crossed a phrase boundary OR forced render is needed
      // 2. Compare patterns (intelligent mode only)
      // 3. Choose rendering strategy: no update / label update / full pan
      // 4. Execute render and update internal state
      if (newPhraseIndex !== currentPhraseIndex || shouldForceRender) {
        const prevPhraseIndex = currentPhraseIndex;
        currentPhraseIndex = newPhraseIndex;

        // Only do pattern comparison if this is a real phrase change, not a forced render
        const isRealPhraseBoundary = newPhraseIndex !== prevPhraseIndex;

        debugLog(
          "visuals",
          `[${panelId}] \n🎯 === ${
            shouldForceRender ? "MEASURE" : "PHRASE"
          } BOUNDARY DETECTED ===`
        );

        if (isRealPhraseBoundary) {
          // This is an actual phrase boundary - normal logic applies
          const actualPrevIndex =
            prevPhraseIndex === -1 ? phrases.length - 1 : prevPhraseIndex;
          const prevPhrase = phrases[actualPrevIndex];

          if (prevPhraseIndex === -1) {
            debugLog(
              "visuals",
              `[${panelId}]   Previous phrase: -1 (first tick, comparing to phrase ${actualPrevIndex}: ticks ${prevPhrase.start}-${prevPhrase.end})`
            );
          } else {
            debugLog(
              "visuals",
              `[${panelId}]   Previous phrase: ${prevPhraseIndex} (ticks ${prevPhrase.start}-${prevPhrase.end})`
            );
          }

          debugLog(
            "visuals",
            `[${panelId}]   New phrase: ${newPhraseIndex} (ticks ${currentPhrase.start}-${currentPhrase.end})`
          );
          debugLog(
            "visuals",
            `[${panelId}]   Tick in new phrase: ${tickInPhrase}`
          );

          // === DECISION LOGIC ===
          if (intelligentPanning) {
            const comparison = comparePhrasePatterns(
              measureLayout,
              prevPhrase,
              currentPhrase
            );

            debugLog(
              "visuals",
              `[${panelId}]   Pattern comparison:`,
              comparison
            );

            if (comparison.labelMatch) {
              if (prevPhraseIndex === -1) {
                // First phrase ever - must render even if it matches the "previous" (last) phrase
                debugLog(
                  "visuals",
                  `[${panelId}]   ➡️ Decision: INITIAL RENDER (first phrase)`
                );
                dotElements = renderNewPhrase(
                  container,
                  measureLayout,
                  currentPhrase,
                  core,
                  dotElements
                );
              } else {
                debugLog(
                  "visuals",
                  `[${panelId}]   ➡️ Decision: NO UPDATE (complete match)`
                );
                // Keep existing phrase visible
              }
            } else if (comparison.hierarchyMatch) {
              debugLog(
                "visuals",
                `[${panelId}]   ➡️ Decision: LABEL UPDATE ONLY (hierarchy match)`
              );

              // Guard: ensure we have cached elements before attempting label update
              if (dotElements.length === 0) {
                debugLog(
                  "visuals",
                  `[${panelId}]   ⚠️ No cached elements yet - performing initial render instead`
                );
                dotElements = renderNewPhrase(
                  container,
                  measureLayout,
                  currentPhrase,
                  core,
                  dotElements
                );
              } else {
                updatePhraseLabels(
                  container,
                  measureLayout,
                  currentPhrase,
                  dotElements
                );
              }
            } else {
              debugLog(
                "visuals",
                `[${panelId}]   ➡️ Decision: FULL PAN (structure differs)`
              );
              dotElements = renderNewPhrase(
                container,
                measureLayout,
                currentPhrase,
                core,
                dotElements
              );
            }
          } else {
            // Forced mode with real phrase boundary
            debugLog(
              "visuals",
              `[${panelId}]   ➡️ Decision: FULL PAN (forced mode - phrase boundary)`
            );
            dotElements = renderNewPhrase(
              container,
              measureLayout,
              currentPhrase,
              core,
              dotElements
            );
          }
        } else if (shouldForceRender) {
          // This is NOT a phrase boundary, but a measure boundary in single-phrase forced mode
          debugLog(
            "visuals",
            `[${panelId}]   Measure boundary in single-phrase measure (phrase stays at ${newPhraseIndex})`
          );
          debugLog(
            "visuals",
            `[${panelId}]   Current phrase: ticks ${currentPhrase.start}-${currentPhrase.end}`
          );
          debugLog(
            "visuals",
            `[${panelId}]   ➡️ Decision: FULL PAN (forced mode - measure boundary)`
          );
          dotElements = renderNewPhrase(
            container,
            measureLayout,
            currentPhrase,
            core,
            dotElements
          );
        }

        debugLog(
          "visuals",
          `[${panelId}] ========================================\n`
        );
      }

      // === WITHIN-PHRASE: Ensure phrase is rendered and flash active dot ===
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

      // === FLASH ACTIVE DOT (using tickInPhrase) ===
      flashTimeout = flashActiveDot(
        container,
        tickInPhrase,
        dotElements,
        measureLayout,
        currentTickInMeasure,
        isPrimaryAccent,
        flashTimeout
      );
    } catch (error) {
      console.error(`❌ Visual callback error [${panelId}]:`, error);
      console.error("Stack trace:", error.stack);
      // Don't rethrow - let metronome continue even if visuals break
    }
  };
}

export function primeVisuals(panelId = "groove") {
  const containerId =
    panelId === "groove"
      ? "beat-indicator-container"
      : "beat-indicator-container-simple";
  const container = document.getElementById(containerId);
  if (!container) return;

  const core =
    panelId === "groove" ? window.metronome : window.simpleMetronome.core;
  if (!core || typeof core.getTimeSignature !== "function") return;

  const timeSignature = core.getTimeSignature();
  const ticksPerBeat = core.getTicksPerBeat();

  // This is the heavy, blocking code that we need to run upfront.
  container.innerHTML = "";
  const panningContainer = document.createElement("div");
  panningContainer.className = "panning-container";
  panningContainer.style.display = "flex";
  container.appendChild(panningContainer);
  const measureLayout = generateMeasureLayout(timeSignature, ticksPerBeat);

  measureLayout.forEach((dotInfo) => {
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
  });
}

// --- Keep the other functions from the original visuals.js ---
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
