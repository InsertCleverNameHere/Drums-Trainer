// visuals.js
// Responsible for creating beat dots and producing a callback to be registered with metronomeCore

// config

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

function ensureCenteredOverlay() {
  let overlay = document.getElementById("countin-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "countin-overlay";
    overlay.setAttribute("aria-hidden", "true");
    // visual presentation moved to CSS for more reliable timing
    overlay.className = "countin-overlay";
    document.body.appendChild(overlay);
  }
  return overlay;
}

// create and return the callback to register with metronomeCore
export function createVisualCallback(getBeatsPerBar) {
  // getBeatsPerBar is a function we call to check current beatsPerBar
  const overlay = ensureCenteredOverlay();
  document.addEventListener("countin:tick", (e) => {
    try {
      const step = e.detail && e.detail.step ? e.detail.step : null;
      if (!step) return;
      // Use CSS-only animation: set content and toggle .show class briefly
      overlay.textContent = String(step);
      overlay.classList.remove("show");
  // force reflow to restart animation
  void overlay.offsetWidth;
      overlay.classList.add("show");
    } catch (err) {
      console.debug("countin visual handler error:", err);
    }
  });
  return (beat, isAccent) => {
    const beats = typeof getBeatsPerBar === "function" ? getBeatsPerBar() : 4;
    const container = ensureContainer("beat-indicator-container", beats);
    if (!container) return;

    const beatIndex = beat % beats;
    const dots = container.children;

    // reset all dots quickly
    for (let i = 0; i < dots.length; i++) {
      dots[i].style.backgroundColor = "#bfbfbf";
      dots[i].style.transform = "scale(1)";
      dots[i].style.opacity = "0.5";
    }

    // highlight current
    const activeDot = dots[beatIndex];
    if (!activeDot) return;

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
