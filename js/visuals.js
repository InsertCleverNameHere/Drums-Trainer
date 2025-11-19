// js/visuals.js
// Procedural, hierarchical, and paginated metronome visualizer.

// --- Configuration ---
// --- Configuration ---
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
 * Clears existing dots and creates up to 4 new dots for the current phrase.
 *
 * @param {HTMLElement} container - The beat indicator container
 * @param {Array} measureLayout - Full measure layout
 * @param {Object} phrase - Current phrase {start, end, length}
 * @param {Object} core - Metronome core for BPM
 * @param {Array} dotElements - Reference to dotElements array (will be updated)
 * @returns {Array} Updated dotElements array
 */
function renderNewPhrase(container, measureLayout, phrase, core, dotElements) {
  // Clear existing content
  container.innerHTML = "";

  // Create new panning container
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

  // === OLD STATE (keeping for now) ===
  let lastRenderedSignature = "";
  let lastRenderedTicksPerBeat = -1;
  let flashTimeout = null;
  let dotPositions = [];

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
    console.log(
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
  console.log(
    `🎯 [${panelId}] Initial panning mode: ${
      intelligentPanning ? "Intelligent" : "Forced"
    }`
  );

  return (tickIndex, isPrimaryAccent, isMainBeat) => {
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
    const currentBeat = Math.floor(currentTickInMeasure / ticksPerBeat);

    // === NEW: REBUILD LAYOUT ON SIGNATURE CHANGE ===
    if (
      signatureKey !== lastRenderedSignature ||
      ticksPerBeat !== lastRenderedTicksPerBeat
    ) {
      measureLayout = generateMeasureLayout(timeSignature, ticksPerBeat);
      phrases = segmentIntoPhrases(totalTicksInMeasure);
      currentPhraseIndex = -1; // Force rebuild on next boundary
      lastRenderedSignature = signatureKey;
      lastRenderedTicksPerBeat = ticksPerBeat;

      console.log(
        `🎼 [${panelId}] Layout rebuilt: ${signatureKey}, ${totalTicksInMeasure} ticks`
      );
      console.log(`📊 [${panelId}] Phrases:`, phrases);
    }

    // === NEW: DETERMINE CURRENT PHRASE ===
    const newPhraseIndex = phrases.findIndex(
      (p) => currentTickInMeasure >= p.start && currentTickInMeasure <= p.end
    );

    if (newPhraseIndex === -1) {
      console.warn(
        `⚠️ [${panelId}] Tick ${currentTickInMeasure} not in any phrase!`
      );
      return;
    }

    const currentPhrase = phrases[newPhraseIndex];
    const tickInPhrase = currentTickInMeasure - currentPhrase.start;

    // === PHRASE BOUNDARY DETECTION & RENDERING ===
    if (newPhraseIndex !== currentPhraseIndex) {
      const prevPhraseIndex = currentPhraseIndex;
      currentPhraseIndex = newPhraseIndex;

      const actualPrevIndex =
        prevPhraseIndex === -1 ? phrases.length - 1 : prevPhraseIndex;

      const prevPhrase = phrases[actualPrevIndex];

      console.log(`\n🎯 [${panelId}] === PHRASE BOUNDARY DETECTED ===`);

      if (prevPhraseIndex === -1) {
        console.log(
          `   Previous phrase: -1 (first tick, comparing to phrase ${actualPrevIndex}: ticks ${prevPhrase.start}-${prevPhrase.end})`
        );
      } else {
        console.log(
          `   Previous phrase: ${prevPhraseIndex} (ticks ${prevPhrase.start}-${prevPhrase.end})`
        );
      }

      console.log(
        `   New phrase: ${newPhraseIndex} (ticks ${currentPhrase.start}-${currentPhrase.end})`
      );
      console.log(`   Tick in new phrase: ${tickInPhrase}`);

      // === DECISION LOGIC ===
      if (intelligentPanning) {
        const comparison = comparePhrasePatterns(
          measureLayout,
          prevPhrase,
          currentPhrase
        );

        console.log(`   Pattern comparison:`, comparison);

        if (comparison.labelMatch) {
          console.log(`   ➡️ Decision: NO UPDATE (complete match)`);
          // Don't render - keep existing phrase visible
        } else if (comparison.hierarchyMatch) {
          console.log(`   ➡️ Decision: LABEL UPDATE ONLY (hierarchy match)`);
          // TODO Step 4D: updatePhraseLabels
          // For now, do full pan as fallback
          dotElements = renderNewPhrase(
            container,
            measureLayout,
            currentPhrase,
            core,
            dotElements
          );
        } else {
          console.log(`   ➡️ Decision: FULL PAN (structure differs)`);
          dotElements = renderNewPhrase(
            container,
            measureLayout,
            currentPhrase,
            core,
            dotElements
          );
        }
      } else {
        console.log(`   ➡️ Decision: FULL PAN (forced mode)`);
        dotElements = renderNewPhrase(
          container,
          measureLayout,
          currentPhrase,
          core,
          dotElements
        );
      }
      console.log(`========================================\n`);
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
    clearTimeout(flashTimeout);

    const prevFlashedDot = container.querySelector(".beat-dot.flashing");
    const prevFlashedText = container.querySelector(
      '.phonation-text[class*="flash-"]'
    );
    if (prevFlashedDot) {
      prevFlashedDot.classList.remove(
        "flashing",
        "accent-flash",
        "normal-flash"
      );
    }
    if (prevFlashedText) {
      prevFlashedText.className = "phonation-text";
    }

    const activeWrapper = dotElements[tickInPhrase];
    if (activeWrapper) {
      const dot = activeWrapper.children[0];
      const text = activeWrapper.children[1];
      const dotInfo = measureLayout[currentTickInMeasure];

      if (dot && text && dotInfo) {
        dot.classList.add("flashing");
        if (isPrimaryAccent) {
          dot.classList.add("accent-flash");
        } else {
          dot.classList.add("normal-flash");
        }
        text.classList.add(`flash-${dotInfo.colorClass}`);

        flashTimeout = setTimeout(() => {
          dot.classList.remove("flashing", "accent-flash", "normal-flash");
          text.className = "phonation-text";
        }, 120);
      }
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
