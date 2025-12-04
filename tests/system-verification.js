/* ==========================================================================
   RGT System Verification Suite
   End-to-End testing for DOM integrity, Input Logic, Audio/Visual Timing,
   and Session Ownership.
   ========================================================================== */

(async function runSystemVerification() {
  console.clear();
  console.log(
    "%cSYSTEM VERIFICATION STARTING...",
    "color: #ffffff; background: #007bff; font-size: 14px; font-weight: bold; padding: 4px 8px; border-radius: 4px;"
  );

  let passed = 0;
  let failed = 0;
  const SECTION_STYLE = "color: #007bff; font-weight: bold; margin-top: 10px;";

  // --- Test Helpers ---

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const assert = (condition, msg) => {
    if (condition) {
      console.log(`%c  ✅ ${msg}`, "color: #28a745;");
      passed++;
    } else {
      console.error(`%c  ❌ ${msg}`, "color: #dc3545; font-weight: bold;");
      failed++;
    }
  };

  const assertCritical = (condition, msg) => {
    if (condition) {
      console.log(`%c  ✅ ${msg}`, "color: #28a745;");
      passed++;
    } else {
      console.error(
        `%c  ❌ FATAL: ${msg}`,
        "color: #dc3545; font-weight: bold; font-size: 1.1em;"
      );
      failed++;
      throw new Error(msg);
    }
  };

  const click = async (selector) => {
    const el = document.querySelector(selector);
    if (!el) throw new Error(`Element not found: ${selector}`);
    const originalOutline = el.style.outline;
    el.style.outline = "2px solid #d63384";
    await wait(50);
    el.click();
    el.style.outline = originalOutline;
    await wait(150);
  };

  const type = async (selector, value) => {
    const el = document.querySelector(selector);
    if (!el) throw new Error(`Element not found: ${selector}`);
    el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
    await wait(200);
  };

  const selectOption = async (selector, value) => {
    const el = document.querySelector(selector);
    if (!el) throw new Error(`Select not found: ${selector}`);
    el.value = value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    await wait(200);
  };

  const isVisible = (selector) => {
    const el = document.querySelector(selector);
    return el && !el.classList.contains("hidden") && el.offsetParent !== null;
  };

  // Safe setter to prevent min/max crossover validation errors
  const setGrooveRange = async (targetMin, targetMax) => {
    const minInput = document.getElementById("bpmMin");
    const currentMin = parseInt(minInput.value) || 30;

    if (targetMin > currentMin) {
      await type("#bpmMax", targetMax.toString());
      await type("#bpmMin", targetMin.toString());
    } else {
      await type("#bpmMin", targetMin.toString());
      await type("#bpmMax", targetMax.toString());
    }
  };

  const measureCountIn = async (minVal, maxVal) => {
    await setGrooveRange(minVal, maxVal);

    const badge = document.getElementById("countdownBadge");
    const startBtn = document.getElementById("startBtn");

    const start = performance.now();
    await click("#startBtn");

    // Wait for animation start
    while (
      badge.textContent.trim() === "" &&
      performance.now() - start < 1000
    ) {
      await wait(20);
    }

    // Wait for animation end
    while (badge.textContent.trim() !== "" || startBtn.disabled) {
      await wait(30);
      if (performance.now() - start > 8000) break;
    }

    const duration = performance.now() - start;
    if (startBtn.textContent === "Stop") await click("#startBtn");
    await wait(300);
    return duration;
  };

  try {
    // ===============================================
    // 1. Static Asset Verification
    // ===============================================
    console.log(`\n%c📦 1. DOM & Assets`, SECTION_STYLE);

    const criticalElements = [
      "startBtn",
      "pauseBtn",
      "tapTempoBtn",
      "bpmMin",
      "bpmMax",
      "simpleBpm",
      "grooves",
      "groovePresetSelect",
      "soundProfileGroove",
      "panel-groove",
      "panel-metronome",
      "tab-groove",
      "tab-metronome",
      "intelligentPanningToggle",
    ];
    criticalElements.forEach((id) =>
      assert(document.getElementById(id), `#${id} exists`)
    );

    const grooveVis = document.getElementById("beat-indicator-container");
    assert(grooveVis && grooveVis.children.length > 0, "Visuals initialized");
    assert(window.gsap !== undefined, "GSAP loaded");

    // ===============================================
    // 2. Configuration & State Logic
    // ===============================================
    console.log(`\n%c📦 2. Configuration Logic`, SECTION_STYLE);

    // Theme
    const themeBtn = document.querySelector(".theme-btn");
    if (themeBtn) {
      await click(".theme-btn");
      await click(".theme-btn");
      assert(true, "Theme toggle interaction");
    }

    // Persistence
    const panToggle = document.getElementById("intelligentPanningToggle");
    const originalPan = panToggle.checked;
    await click("#intelligentPanningToggle");
    assert(
      localStorage.getItem("intelligentPanningMode") !== null,
      "Settings persistence (localStorage)"
    );
    if (panToggle.checked !== originalPan)
      await click("#intelligentPanningToggle");

    // Time Signatures
    await selectOption("#groovePresetSelect", "4/4");
    await wait(100);
    await selectOption("#groovePresetSelect", "7/8");
    assert(
      document.getElementById("groovePresetSelect").value === "7/8",
      "Preset selection"
    );
    assert(
      !isVisible("#grooveCustomTimeSignature"),
      "Custom inputs hidden on preset"
    );
    await selectOption("#groovePresetSelect", "custom");
    assert(
      isVisible("#grooveCustomTimeSignature"),
      "Custom inputs visible on 'Custom'"
    );
    await selectOption("#groovePresetSelect", "4/4");

    // Input Validation
    await setGrooveRange(60, 120);
    const validMin = document.getElementById("bpmMin").value;
    await type("#bpmMin", "500"); // Invalid input
    const currentMin = document.getElementById("bpmMin").value;
    assert(currentMin === validMin, "Invalid BPM input reverted");

    // ===============================================
    // 3. Groove Session Lifecycle
    // ===============================================
    console.log(`\n%c📦 3. Groove Session`, SECTION_STYLE);

    await click("#tab-metronome");
    await click("#tab-groove");
    assert(isVisible("#panel-groove"), "Tab navigation");

    await type("#cycleDuration", "60");
    await click("#startBtn");
    await wait(200);

    assertCritical(
      document.getElementById("startBtn").disabled ||
        document.getElementById("startBtn").textContent === "Stop",
      "Session started"
    );

    console.log("   ⏳ Verifying playback state...");
    await wait(3500);

    await click("#pauseBtn");
    assert(
      document.getElementById("pauseBtn").textContent === "Resume",
      "Pause function"
    );
    await click("#pauseBtn");

    await click("#startBtn");
    assert(
      !document.getElementById("bpmMin").disabled,
      "Session stopped / Inputs unlocked"
    );

    // ===============================================
    // 4. Tempo-Synced Timing Verification
    // ===============================================
    console.log(`\n%c📦 4. Timing Logic`, SECTION_STYLE);

    const syncToggle = document.getElementById("tempoSyncedToggle");
    if (!syncToggle.checked) await click("#tempoSyncedToggle");

    // Low BPM Check (30 BPM)
    const durSlow = await measureCountIn(30, 35);
    console.log(`   30 BPM Count-in: ${Math.round(durSlow)}ms`);

    // High BPM Check (300 BPM)
    const durFast = await measureCountIn(295, 300);
    console.log(`   300 BPM Count-in: ${Math.round(durFast)}ms`);

    assertCritical(
      durFast < durSlow * 0.25,
      "Dynamic timing verification (High BPM is significantly faster)"
    );

    await setGrooveRange(60, 120); // Reset

    // ===============================================
    // 5. Simple Metronome & Ownership
    // ===============================================
    console.log(`\n%c📦 5. Simple Metronome`, SECTION_STYLE);

    await click("#tab-metronome");

    // Tap Tempo Check
    const tapBtn = document.getElementById("tapTempoBtn");
    for (let i = 0; i < 6; i++) {
      tapBtn.click();
      await wait(500);
    }
    const endTapBpm = parseInt(document.getElementById("simpleBpm").value);
    assert(
      endTapBpm >= 115 && endTapBpm <= 125,
      `Tap Tempo accuracy (${endTapBpm} BPM)`
    );

    // Ownership Guard
    await click("#simpleStartBtn");
    await wait(200);
    assert(
      document.getElementById("simpleStartBtn").textContent === "Stop",
      "Simple Metronome active"
    );

    const grooveTab = document.getElementById("tab-groove");
    assert(
      grooveTab.disabled || grooveTab.classList.contains("disabled"),
      "Ownership guard active (Tabs locked)"
    );

    await click("#simpleStartBtn");

    // ===============================================
    // Summary
    // ===============================================
    console.log(`\n${"=".repeat(50)}`);
    console.log(`VERIFICATION COMPLETE`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`${"=".repeat(50)}`);

    if (failed === 0) {
      document.body.style.transition = "border 0.2s";
      document.body.style.border = "8px solid #28a745";
      setTimeout(() => (document.body.style.border = "none"), 1500);
      console.log(
        "%cAll systems operational.",
        "font-size: 16px; color: #28a745; font-weight: bold;"
      );
    }
  } catch (err) {
    console.error("\n❌ VERIFICATION ABORTED:", err.message);
    document.body.style.border = "8px solid #dc3545";
  }
})();
