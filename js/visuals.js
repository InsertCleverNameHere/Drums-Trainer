// visuals.js
// Responsible for creating beat dots and producing a callback to be registered with metronomeCore

// config
const BASE_DOT_SIZE = 64; // current size used in your UI (adjust if you change CSS)

function ensureContainer(
  containerId = "beat-indicator-container",
  beatsPerBar = 4
) {
  const container = document.getElementById(containerId);
  if (!container) return null;

  // Rebuild beat dots if the number doesn't match current beatsPerBar
  if (container.childElementCount !== beatsPerBar) {
    container.innerHTML = "";
    for (let i = 0; i < beatsPerBar; i++) {
      const dot = document.createElement("div");
      dot.className = "beat-dot";
      // helpful dataset for debugging
      dot.dataset.index = String(i);
      // explicit sizing from BASE_DOT_SIZE to avoid relying solely on CSS
      dot.style.width = `${BASE_DOT_SIZE}px`;
      dot.style.height = `${BASE_DOT_SIZE}px`;
      container.appendChild(dot);
    }
  }
  return container;
}

// create and return the callback to register with metronomeCore
// New signature: callback(tickIndex, isAccent, tickInBeat)
// This function remains backwards-compatible by also accepting (beat, isAccent)
export function createVisualCallback(getBeatsPerBar) {
  // getBeatsPerBar is a function we call to check current beatsPerBar
  return (a, isAccent, tickInBeat) => {
    // Support legacy call-signature: (beat, isAccent)
    // If the third argument is undefined, caller used legacy signature
    if (typeof tickInBeat === "undefined") {
      const legacyBeat = a;
      const beats = typeof getBeatsPerBar === "function" ? getBeatsPerBar() : 4;
      const container = ensureContainer("beat-indicator-container", beats);
      if (!container) return;
      const beatIndex = ((legacyBeat % beats) + beats) % beats;
      const dots = container.children;
      // Reset all dots
      for (let i = 0; i < dots.length; i++) {
        dots[i].style.backgroundColor = "#bfbfbf";
        dots[i].style.transform = "scale(1)";
        dots[i].style.opacity = "0.5";
      }
      const activeDot = dots[beatIndex];
      if (!activeDot) return;
      activeDot.style.backgroundColor = isAccent ? "#b22222" : "#006400";
      activeDot.style.transform = "scale(1.5)";
      activeDot.style.opacity = "1";
      setTimeout(() => {
        activeDot.style.transform = "scale(1)";
        activeDot.style.opacity = "0.7";
        activeDot.style.backgroundColor = "#bfbfbf";
      }, 120);
      return;
    }

    // New-style call: a = tickIndex, isAccent = boolean, tickInBeat = 0..ticksPerBeat-1
    const tickIndex = a;
    const beats = typeof getBeatsPerBar === "function" ? getBeatsPerBar() : 4;
    const container = ensureContainer("beat-indicator-container", beats);
    if (!container) return;

    // Determine beat from tickIndex; try to read ticksPerBeat from metronome API if available
    let ticksPerBeatLocal = 1;
    try {
      // Defensive: if window.metronome exists but getter is missing, fall back to 1
      if (
        window.metronome &&
        typeof window.metronome.getTicksPerBeat === "function"
      ) {
        ticksPerBeatLocal = window.metronome.getTicksPerBeat();
        // guard against non-numeric returns
        ticksPerBeatLocal = Math.max(
          1,
          Math.floor(Number(ticksPerBeatLocal) || 1)
        );
      } else {
        ticksPerBeatLocal = 1;
      }
    } catch (e) {
      ticksPerBeatLocal = 1;
    }

    const beat = Math.floor(tickIndex / Math.max(1, ticksPerBeatLocal));
    const beatIndex = ((beat % beats) + beats) % beats;
    const dots = container.children;

    // Reset all dots quickly (clear previous highlights)
    for (let i = 0; i < dots.length; i++) {
      dots[i].style.backgroundColor = "#bfbfbf";
      dots[i].style.transform = "scale(1)";
      dots[i].style.opacity = "0.5";
    }

    const activeDot = dots[beatIndex];
    if (!activeDot) return;

    // Accent beat (larger, different color)
    activeDot.style.backgroundColor = isAccent ? "#b22222" : "#006400";
    activeDot.style.transform = "scale(1.5)";
    activeDot.style.opacity = "1";

    // reset after short delay
    setTimeout(() => {
      activeDot.style.transform = "scale(1)";
      activeDot.style.opacity = "0.7";
      activeDot.style.backgroundColor = "#bfbfbf";
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
