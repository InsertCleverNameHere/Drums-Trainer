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

  if (container.childElementCount !== beatsPerBar) {
    container.innerHTML = "";
    for (let i = 0; i < beatsPerBar; i++) {
      const dot = document.createElement("div");
      dot.className = "beat-dot";
      // helpful dataset for debugging
      dot.dataset.index = String(i);
      container.appendChild(dot);
    }
  }
  return container;
}

// create and return the callback to register with metronomeCore
export function createVisualCallback(getBeatsPerBar) {
  // getBeatsPerBar is a function we call to check current beatsPerBar
  return (beat, isAccent) => {
    const beats = typeof getBeatsPerBar === "function" ? getBeatsPerBar() : 4;
    const container = ensureContainer("beat-indicator-container", beats);
    if (!container) return;

    const beatIndex = beat % beats;
    const dots = container.children;

    // Reset all dots quickly (clear previous highlights)
    for (let i = 0; i < dots.length; i++) {
      dots[i].style.backgroundColor = "#bfbfbf";
      dots[i].style.transform = "scale(1)";
      dots[i].style.opacity = "0.5";
    }

    // highlight current
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
      // keep the base color as neutral
      activeDot.style.backgroundColor = "#bfbfbf";
    }, 120);
  };
}

export function flashInput(el) {
  el.classList.remove("bpm-flash");
  void el.offsetWidth; // force reflow
  el.classList.add("bpm-flash");
  setTimeout(() => el.classList.remove("bpm-flash"), 150);
}
