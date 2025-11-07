// visuals.js
// Responsible for creating beat dots and producing a callback to be registered with metronomeCore

// config
const BASE_DOT_SIZE = 64; // quarter note size
const EIGHTH_DOT_SIZE = 48;
const SIXTEENTH_DOT_SIZE = 36;

// Phonation patterns for different subdivision types
const PHONATION_PATTERNS = {
  1: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"], // quarters
  2: ["1", "&", "2", "&", "3", "&", "4", "&", "5", "&", "6", "&"], // eighths
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
  ], // sixteenths
};

function getPhonationLabel(tickIndex, ticksPerBeat, beatsPerBar) {
  const pattern = PHONATION_PATTERNS[ticksPerBeat] || PHONATION_PATTERNS[1];
  const totalTicks = beatsPerBar * ticksPerBeat;
  const index = tickIndex % totalTicks;

  // For patterns that don't cover all beats, extend them
  if (index >= pattern.length) {
    const beatNum = Math.floor(index / ticksPerBeat) + 1;
    const subTick = index % ticksPerBeat;
    if (subTick === 0) return String(beatNum);
    if (ticksPerBeat === 2) return "&";
    if (ticksPerBeat === 4) return ["e", "&", "a"][subTick - 1];
  }

  return pattern[index] || String(Math.floor(index / ticksPerBeat) + 1);
}

function getLabelColorClass(label) {
  // Determine color class based on phonation text
  if (/^\d+$/.test(label)) return "active-primary"; // Numbers (1, 2, 3, 4...)
  if (label === "&") return "active-and"; // "&" beats
  if (label === "e") return "active-e"; // "e" beats
  if (label === "a") return "active-a"; // "a" beats
  return "active-primary"; // Fallback
}

function getDotSizeClass(ticksPerBeat) {
  if (ticksPerBeat === 1) return "beat-dot-quarter";
  if (ticksPerBeat === 2) return "beat-dot-eighth";
  if (ticksPerBeat === 4) return "beat-dot-sixteenth";
  return "beat-dot-quarter"; // fallback
}

function ensureContainer(
  containerId = "beat-indicator-container",
  beatsPerBar = 4,
  ticksPerBeat = 1
) {
  const container = document.getElementById(containerId);
  if (!container) return null;

  const totalTicks = beatsPerBar * ticksPerBeat;
  const sizeClass = getDotSizeClass(ticksPerBeat);

  // Rebuild beat dots if the number doesn't match current configuration
  if (container.childElementCount !== totalTicks) {
    container.innerHTML = "";

    for (let i = 0; i < totalTicks; i++) {
      // Create wrapper for dot + label
      const wrapper = document.createElement("div");
      wrapper.className = "beat-wrapper";

      // Create dot
      const dot = document.createElement("div");
      dot.className = `beat-dot ${sizeClass}`;
      dot.dataset.index = String(i);

      // Create phonation label
      const label = document.createElement("div");
      label.className = "beat-label";
      label.textContent = getPhonationLabel(i, ticksPerBeat, beatsPerBar);

      wrapper.appendChild(dot);
      wrapper.appendChild(label);
      container.appendChild(wrapper);
    }
  } else {
    // Update existing dots if size class changed
    const wrappers = container.children;
    for (let i = 0; i < wrappers.length; i++) {
      const dot = wrappers[i].querySelector(".beat-dot");
      if (dot) {
        dot.className = `beat-dot ${sizeClass}`;
      }
      const label = wrappers[i].querySelector(".beat-label");
      if (label) {
        label.textContent = getPhonationLabel(i, ticksPerBeat, beatsPerBar);
      }
    }
  }

  return container;
}

// create and return the callback to register with metronomeCore
// New signature: callback(tickIndex, isAccent, tickInBeat)
export function createVisualCallback(getBeatsPerBar) {
  return (a, isAccent, tickInBeat) => {
    // Support legacy call-signature: (beat, isAccent)
    if (typeof tickInBeat === "undefined") {
      const legacyBeat = a;
      const beats = typeof getBeatsPerBar === "function" ? getBeatsPerBar() : 4;
      const container = ensureContainer("beat-indicator-container", beats, 1);
      if (!container) return;
      const beatIndex = ((legacyBeat % beats) + beats) % beats;
      const wrappers = container.children;

      // Reset all dots and labels
      for (let i = 0; i < wrappers.length; i++) {
        const dot = wrappers[i].querySelector(".beat-dot");
        const label = wrappers[i].querySelector(".beat-label");
        if (dot) {
          dot.style.backgroundColor = "#bfbfbf";
          dot.style.transform = "scale(1)";
          dot.style.opacity = "0.5";
        }
        if (label) {
          label.className = "beat-label"; // Remove all active classes
        }
      }

      const activeWrapper = wrappers[beatIndex];
      if (!activeWrapper) return;
      const activeDot = activeWrapper.querySelector(".beat-dot");
      const activeLabel = activeWrapper.querySelector(".beat-label");
      if (!activeDot) return;

      activeDot.style.backgroundColor = isAccent ? "#b22222" : "#006400";
      activeDot.style.transform = "scale(1.5)";
      activeDot.style.opacity = "1";

      // Light up the label with appropriate color
      if (activeLabel) {
        const colorClass = getLabelColorClass(activeLabel.textContent);
        activeLabel.className = `beat-label ${colorClass}`;
      }

      setTimeout(() => {
        activeDot.style.transform = "scale(1)";
        activeDot.style.opacity = "0.7";
        activeDot.style.backgroundColor = "#bfbfbf";
        if (activeLabel) {
          activeLabel.className = "beat-label"; // Remove active class
        }
      }, 120);
      return;
    }

    // New-style call: a = tickIndex, isAccent = boolean, tickInBeat = 0..ticksPerBeat-1
    const tickIndex = a;
    const beats = typeof getBeatsPerBar === "function" ? getBeatsPerBar() : 4;

    // Get ticksPerBeat from metronome API
    let ticksPerBeatLocal = 1;
    try {
      if (
        window.metronome &&
        typeof window.metronome.getTicksPerBeat === "function"
      ) {
        ticksPerBeatLocal = window.metronome.getTicksPerBeat();
        ticksPerBeatLocal = Math.max(
          1,
          Math.floor(Number(ticksPerBeatLocal) || 1)
        );
      }
    } catch (e) {
      ticksPerBeatLocal = 1;
    }

    const container = ensureContainer(
      "beat-indicator-container",
      beats,
      ticksPerBeatLocal
    );
    if (!container) return;

    const totalTicks = beats * ticksPerBeatLocal;
    const currentTickIndex =
      ((tickIndex % totalTicks) + totalTicks) % totalTicks;
    const wrappers = container.children;

    // Reset all dots and labels
    for (let i = 0; i < wrappers.length; i++) {
      const dot = wrappers[i].querySelector(".beat-dot");
      const label = wrappers[i].querySelector(".beat-label");
      if (dot) {
        dot.style.backgroundColor = "#bfbfbf";
        dot.style.transform = "scale(1)";
        dot.style.opacity = "0.5";
      }
      if (label) {
        label.className = "beat-label"; // Remove all active classes
      }
    }

    const activeWrapper = wrappers[currentTickIndex];
    if (!activeWrapper) return;
    const activeDot = activeWrapper.querySelector(".beat-dot");
    const activeLabel = activeWrapper.querySelector(".beat-label");
    if (!activeDot) return;

    // Accent beat (larger, different color)
    activeDot.style.backgroundColor = isAccent ? "#b22222" : "#006400";
    activeDot.style.transform = "scale(1.5)";
    activeDot.style.opacity = "1";

    // Light up the label with appropriate color
    if (activeLabel) {
      const colorClass = getLabelColorClass(activeLabel.textContent);
      activeLabel.className = `beat-label ${colorClass}`;
    }

    // Reset after short delay
    setTimeout(() => {
      activeDot.style.transform = "scale(1)";
      activeDot.style.opacity = "0.7";
      activeDot.style.backgroundColor = "#bfbfbf";
      if (activeLabel) {
        activeLabel.className = "beat-label"; // Remove active class
      }
    }, 120);
  };
}

// Flash the BPM input field
export function updateCountdownBadge(badgeEl, options = {}) {
  if (!badgeEl) return;

  const {
    step = "", // Text to show (or clear)
    fadeIn = false, // Apply fade-in animation
    fadeOut = false, // Apply fade-out animation
  } = options;

  badgeEl.textContent = step;

  // Reset animations
  badgeEl.classList.remove("fade-in", "fade-out");
  void badgeEl.offsetWidth; // force reflow

  if (fadeIn) badgeEl.classList.add("fade-in");
  if (fadeOut) badgeEl.classList.add("fade-out");
}

// Clear the countdown badge
export function clearCountdownBadge(badgeEl) {
  if (!badgeEl) return;
  badgeEl.textContent = "";
  badgeEl.classList.remove("fade-in");
  badgeEl.classList.add("fade-out");
}
