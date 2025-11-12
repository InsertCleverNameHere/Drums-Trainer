// js/visuals.js
// Procedural, hierarchical, and paginated metronome visualizer.

// --- Configuration ---
const BEATS_PER_PAGE = 8; // How many main beats to show at once.

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
  let lastRenderedSignature = "";
  let lastRenderedTicksPerBeat = -1;

  // --- We need a way to clear timeouts to prevent glitches ---
  let flashTimeout = null;

  return (tickIndex, isPrimaryAccent, isMainBeat) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    // 2. THIS IS THE BRUTE FORCE FIX.
    //    We look up the correct core from the global scope on EVERY tick.
    //    This bypasses any closure or module binding issues.
    const core =
      panelId === "groove" ? window.metronome : window.simpleMetronome.core;

    // --- Add a safety check ---
    if (!core || typeof core.getTimeSignature !== "function") {
      // If the core isn't ready for any reason, just stop. Do not crash.
      return;
    }
    const timeSignature = core.getTimeSignature();
    const ticksPerBeat = core.getTicksPerBeat();
    const signatureKey = `${timeSignature.beats}/${timeSignature.value}`;

    const totalTicksInMeasure = timeSignature.beats * ticksPerBeat;
    if (totalTicksInMeasure === 0) return;

    const currentTickInMeasure = tickIndex % totalTicksInMeasure;
    const currentBeat = Math.floor(currentTickInMeasure / ticksPerBeat);

    // --- Performance: Redraw DOM elements only when the structure changes ---
    if (
      signatureKey !== lastRenderedSignature ||
      ticksPerBeat !== lastRenderedTicksPerBeat
    ) {
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
        if (dotInfo.isAccent) {
          dot.classList.add("accent");
        }

        const text = document.createElement("div");
        text.className = "phonation-text";
        text.textContent = dotInfo.label;

        wrapper.appendChild(dot);
        wrapper.appendChild(text);
        panningContainer.appendChild(wrapper);
      });

      lastRenderedSignature = signatureKey;
      lastRenderedTicksPerBeat = ticksPerBeat;
    }

    // --- Clear any previous flash timeouts to prevent glitches ---
    clearTimeout(flashTimeout);
    const allWrappers = container.children[0]?.children;

    // Find and remove all previous flashing classes
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

    // --- Apply new flashing classes ---
    const activeWrapper = allWrappers[currentTickInMeasure];
    if (activeWrapper) {
      const dot = activeWrapper.children[0];
      const text = activeWrapper.children[1];

      const measureLayout = generateMeasureLayout(timeSignature, ticksPerBeat);
      const dotInfo = measureLayout[currentTickInMeasure];

      if (dot && text && dotInfo) {
        // --- DOT FLASHING LOGIC ---
        dot.classList.add("flashing");

        // Apply RED for the primary accent, and GREEN for EVERYTHING else.
        if (isPrimaryAccent) {
          dot.classList.add("accent-flash"); // Red flash for beat 1
        } else {
          dot.classList.add("normal-flash"); // Green flash for ALL other ticks
        }

        // --- PHONATION TEXT FLASHING LOGIC (This remains the same) ---
        // The text color is still based on the dot's hierarchy.
        text.classList.add(`flash-${dotInfo.colorClass}`);

        // --- CLEANUP TIMEOUT ---
        // Set a timeout to remove all possible flashing classes from both elements.
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
