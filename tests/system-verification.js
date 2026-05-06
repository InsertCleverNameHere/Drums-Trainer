/* ==========================================================================
   RGT System Verification Suite — v2 (Phase 5.1 aware)
   -----------------------------------------------------------------------
   Runs as a console script against the live index.html page.
   Paste into DevTools console or inject via a bookmarklet.

   Sections:
     1. DOM & Assets          — critical elements, GSAP, visuals, FUOC
     2. Settings Modal        — open/close, toggles, Advanced Mode controls
     3. Simple Mode           — slider visible, chip hidden, BPM step=5,
                                blur-pair deferral (no snap on bpmMin/Max)
     4. Advanced Mode toggle  — DOM class, stepper visible, slider hidden,
                                chip populated, BPM step reads from input
     5. Advanced Mode BPM     — stepper ± buttons, step enforcement,
                                margin guard, simpleBpm blur snap
     6. Groove Session        — start/pause/resume/stop (Advanced Mode on)
     7. Timing                — tempo-synced count-in speed differential
     8. Simple Metronome      — tap tempo, start/stop, ownership guard
   ========================================================================== */

(async function runSystemVerification() {
  console.clear();
  console.log(
    "%cSYSTEM VERIFICATION v2 STARTING...",
    "color:#fff;background:#007bff;font-size:14px;font-weight:bold;padding:4px 8px;border-radius:4px;"
  );

  let passed = 0;
  let failed = 0;
  const S = "color:#007bff;font-weight:bold;margin-top:10px;";

  // ── Helpers ────────────────────────────────────────────────────────────────

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const assert = (condition, msg) => {
    if (condition) {
      console.log(`%c  ✅ ${msg}`, "color:#28a745;");
      passed++;
    } else {
      console.error(`%c  ❌ ${msg}`, "color:#dc3545;font-weight:bold;");
      failed++;
    }
  };

  const assertCritical = (condition, msg) => {
    if (condition) {
      console.log(`%c  ✅ ${msg}`, "color:#28a745;");
      passed++;
    } else {
      console.error(
        `%c  ❌ FATAL: ${msg}`,
        "color:#dc3545;font-weight:bold;font-size:1.1em;"
      );
      failed++;
      throw new Error(msg);
    }
  };

  // Click with brief visual highlight
  const click = async (selector, delayMs = 800) => {
    const el = document.querySelector(selector);
    if (!el) throw new Error(`click: element not found — ${selector}`);
    const orig = el.style.outline;
    el.style.outline = "2px solid #d63384";
    await wait(50);
    el.click();
    el.style.outline = orig;
    await wait(delayMs);
  };

  // Set input value and fire input + change + blur
  const type = async (selector, value, delayMs = 200) => {
    const el = document.querySelector(selector);
    if (!el) throw new Error(`type: element not found — ${selector}`);
    el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
    await wait(delayMs);
  };

  const selectOption = async (selector, value, delayMs = 200) => {
    const el = document.querySelector(selector);
    if (!el) throw new Error(`selectOption: element not found — ${selector}`);
    el.value = value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    await wait(delayMs);
  };

  // Visibility: element exists, not .hidden, has layout
  const isVisible = (selector) => {
    const el = document.querySelector(selector);
    if (!el) return false;
    const style = window.getComputedStyle(el);
    // An element is visible if it's not hidden, has dimensions, and isn't transparent
    return (
      !el.classList.contains("hidden") &&
      style.display !== "none" &&
      el.offsetHeight > 0
    );
  };

  // Polling Helper: Waits up to 'timeout' for element to appear
  const waitForVisible = async (selector, timeout = 2000) => {
    const start = performance.now();
    while (performance.now() - start < timeout) {
      if (isVisible(selector)) return true;
      await wait(50); // Check every 50ms
    }
    return false;
  };

  // Ownership Helper: Waits for metronome to release control
  const waitUntilIdle = async (timeout = 3000) => {
    const start = performance.now();
    while (performance.now() - start < timeout) {
      if (window.sessionEngine.getActiveModeOwner() === null) return true;
      await wait(100);
    }
    return false;
  };

  // Safe groove range setter (avoids transient min>max states)
  const setGrooveRange = async (targetMin, targetMax) => {
    const minEl = document.getElementById("bpmMin");
    const currentMin = parseInt(minEl.value) || 30;
    if (targetMin > currentMin) {
      await type("#bpmMax", String(targetMax));
      await type("#bpmMin", String(targetMin));
    } else {
      await type("#bpmMin", String(targetMin));
      await type("#bpmMax", String(targetMax));
    }
  };

  // Full count-in measurement helper
  const measureCountIn = async (minVal, maxVal) => {
    await setGrooveRange(minVal, maxVal);
    const badge = document.getElementById("countdownBadge");
    const startBtn = document.getElementById("startBtn");
    const start = performance.now();
    await click("#startBtn");
    while (
      badge.textContent.trim() === "" &&
      performance.now() - start < 1000
    ) {
      await wait(20);
    }
    while (badge.textContent.trim() !== "" || startBtn.disabled) {
      await wait(30);
      if (performance.now() - start > 8000) break;
    }
    const duration = performance.now() - start;
    if (startBtn.textContent === "Stop") await click("#startBtn");
    await wait(300);
    return duration;
  };

  // Ensure settings dialog is closed
  const closeSettings = async () => {
    const d = document.getElementById("settingsDialog");
    if (d && d.classList.contains("visible")) {
      await click("#settingsTrigger");
      await wait(200);
    }
  };

  // Force Simple Mode (for test isolation)
  const ensureSimpleMode = async () => {
    const toggle = document.getElementById("advancedModeToggle");
    if (!toggle) return;
    if (toggle.checked) {
      await click("#settingsTrigger");
      await wait(150);
      toggle.checked = false;
      toggle.dispatchEvent(new Event("change", { bubbles: true }));
      await wait(200);
      await closeSettings();
    }
  };

  // Force Advanced Mode (for test isolation)
  const ensureAdvancedMode = async () => {
    const toggle = document.getElementById("advancedModeToggle");
    if (!toggle) return;
    if (!toggle.checked) {
      await click("#settingsTrigger");
      await wait(150);
      toggle.checked = true;
      toggle.dispatchEvent(new Event("change", { bubbles: true }));
      await wait(200);
      await closeSettings();
    }
  };

  // ── Main test body ─────────────────────────────────────────────────────────
  try {
    // =========================================================================
    // 1. DOM & Assets
    // =========================================================================
    console.log(`\n%c📦 1. DOM & Assets`, S);

    // FUOC prevention: data-theme must be set by the inline <head> script,
    // before any stylesheet or JS runs. If the attribute is present now it
    // was set synchronously at parse time.
    assert(
      document.documentElement.hasAttribute("data-theme"),
      "FUOC: data-theme set synchronously by inline <head> script"
    );

    // If advancedMode was persisted, the class must also be present already.
    const storedAdvanced = localStorage.getItem("advancedMode") === "true";
    assert(
      !storedAdvanced ||
        document.documentElement.classList.contains("advanced-mode"),
      "FUOC: advanced-mode class set synchronously when stored=true"
    );

    // Critical elements — always present regardless of mode
    const criticalElements = [
      // Core controls
      "startBtn",
      "pauseBtn",
      "tapTempoBtn",
      // BPM inputs (always in DOM; visibility is CSS-controlled)
      "bpmMin",
      "bpmMax",
      "simpleBpm",
      // Groove panel
      "grooves",
      "panel-groove",
      "panel-metronome",
      "tab-groove",
      "tab-metronome",
      // Status
      "beat-indicator-container",
      "beat-indicator-container-simple",
      "countdownBadge",
      "countdownBadgeSimple",
      "displayBpm",
      "displayGroove",
      "simpleDisplayBpm",
      // Settings
      "settingsTrigger",
      "settingsDialog",
      "reduceMotionToggle",
      "tempoSyncedToggle",
      "wakeLockToggle",
      // Phase 5.1 — Advanced Mode controls
      "advancedModeToggle",
      "bpmStepInput",
      "grooveAnchorToggle",
      "restoreDefaultsBtn",
      "groove-settings-chip",
      "simple-settings-chip",
      "managePatternsBtn",
      "editGrooveNamesBtn",
      "groove-textarea-container",
      "groove-list-container",
      "groove-editor-panel",
      "saveGrooveBtn",
      "cancelGrooveBtn",
      "deleteGrooveBtn",
      "patNumerator",
      "patDenominator",
      "patSubdivision",
      "patMeasures",
      "patternDashboardToggle",
      // Phase 5.1 — stepper buttons exist (visibility is CSS-controlled)
      // checked via querySelectorAll below
    ];
    criticalElements.forEach((id) =>
      assert(document.getElementById(id), `#${id} exists in DOM`)
    );

    // Stepper buttons: 2 per panel (min/max for groove, simple for simple)
    const stepperBtns = document.querySelectorAll(".bpm-adjust-btn");
    assert(
      stepperBtns.length >= 4,
      `≥4 .bpm-adjust-btn elements present (got ${stepperBtns.length})`
    );

    // bpm-flash-overlay divs present (one per stepper input)
    const flashOverlays = document.querySelectorAll(".bpm-flash-overlay");
    assert(
      flashOverlays.length >= 2,
      `≥2 .bpm-flash-overlay elements present (got ${flashOverlays.length})`
    );

    // Visuals initialised
    const grooveVis = document.getElementById("beat-indicator-container");
    assert(
      grooveVis && grooveVis.children.length > 0,
      "Groove beat-indicator-container has children (visuals initialised)"
    );

    // Third-party libs
    assert(typeof window.gsap !== "undefined", "GSAP loaded");
    assert(typeof window.noUiSlider !== "undefined", "noUiSlider loaded");

    // =========================================================================
    // 2. Settings Modal
    // =========================================================================
    console.log(`\n%c⚙️  2. Settings Modal`, S);

    await ensureSimpleMode();

    // Open
    await click("#settingsTrigger");
    await wait(200);
    assert(
      document.getElementById("settingsDialog").classList.contains("visible"),
      "Settings dialog opens on trigger click"
    );

    // Advanced Mode toggle is present and unchecked in Simple Mode
    const advToggle = document.getElementById("advancedModeToggle");
    assert(
      advToggle && !advToggle.checked,
      "Advanced Mode toggle unchecked in Simple Mode"
    );

    // BPM step input is advanced-only — should be hidden in Simple Mode
    assert(
      !isVisible("#bpmStepInput"),
      "BPM step input hidden in Simple Mode (advanced-only)"
    );

    // Reduce Motion toggle present and functional
    const panToggle = document.getElementById("reduceMotionToggle");
    const originalPan = panToggle.checked;
    await click("#reduceMotionToggle");
    assert(
      localStorage.getItem("intelligentPanningMode") !== null,
      "Reduce Motion toggle persists to localStorage"
    );
    // Restore
    if (panToggle.checked !== originalPan) await click("#reduceMotionToggle");

    // Close via trigger
    await click("#settingsTrigger");
    await wait(200);
    assert(
      !document.getElementById("settingsDialog").classList.contains("visible"),
      "Settings dialog closes on second trigger click"
    );

    // Close via outside click
    await click("#settingsTrigger");
    await wait(200);
    document.body.click();
    await wait(200);
    assert(
      !document.getElementById("settingsDialog").classList.contains("visible"),
      "Settings dialog closes on outside click"
    );

    // =========================================================================
    // 3. Simple Mode behaviour
    // =========================================================================
    console.log(`\n%c🎚️  3. Simple Mode`, S);

    await ensureSimpleMode();

    // Groove slider visible, stepper hidden
    assert(
      isVisible("#groove-slider-container"),
      "Groove slider visible in Simple Mode"
    );
    assert(!isVisible(".bpm-stepper"), "BPM stepper hidden in Simple Mode");

    // Switch to Metronome tab to see its slider
    await click("#tab-metronome");
    assert(
      isVisible("#simple-slider-container"),
      "Simple slider visible in Simple Mode"
    );
    await click("#tab-groove"); // Switch back

    // Time signature / sound controls hidden (advanced-only)
    assert(
      !isVisible("#groovePresetSelect"),
      "Time signature controls hidden in Simple Mode"
    );
    assert(
      !isVisible("#soundProfileGroove"),
      "Sound profile controls hidden in Simple Mode"
    );

    // Chips are visible in Simple Mode to show carry-over settings
    const grooveChip = document.getElementById("groove-settings-chip");
    const isChipVisible =
      isVisible("#groove-settings-chip") &&
      grooveChip.textContent.trim() !== "";
    assert(
      isChipVisible,
      "groove-settings-chip visible and populated in Simple Mode (carrying over settings)"
    );

    // BPM validation: value above max gets clamped to 300
    await setGrooveRange(60, 120);
    const minEl = document.getElementById("bpmMin");
    // Blur-pair deferral: bpmMin and bpmMax don't snap on individual blur.
    // They ARE clamped to [30, 300] by validateNumericInput.
    // Type 500 — should clamp to 300 (hard limit), not revert to 60.
    await type("#bpmMin", "500");
    assert(
      parseInt(minEl.value) === 295,
      `bpmMin clamped to slider ceiling (got ${minEl.value}, expected 295 due to 5 BPM margin)`
    );
    // Restore
    await setGrooveRange(60, 120);

    // Blur-pair deferral: typing a value that crosses max triggers correction
    // only after BOTH fields have blurred. Type min=115 when max=120 (gap=5=step).
    // The margin guard should fire and correct on blur of the second field.
    // We simulate by blurring both in sequence via type().
    await type("#bpmMin", "115"); // gap=5=step, on the edge — correction needed
    await type("#bpmMax", "120"); // second blur triggers checkGrooveMargin
    await wait(100);
    const minAfter = parseInt(document.getElementById("bpmMin").value);
    const maxAfter = parseInt(document.getElementById("bpmMax").value);
    assert(
      maxAfter - minAfter >= 5,
      `Blur-pair margin guard: gap ≥ 5 after both blur (got min=${minAfter} max=${maxAfter})`
    );
    await setGrooveRange(60, 120);

    // =========================================================================
    // 4. Advanced Mode toggle
    // =========================================================================
    console.log(`\n%c🔬 4. Advanced Mode Toggle`, S);

    await ensureAdvancedMode();

    // DOM class applied
    assert(
      document.documentElement.classList.contains("advanced-mode"),
      "html.advanced-mode class present after enabling"
    );

    // Stepper buttons visible, slider hidden (groove)
    assert(isVisible(".bpm-stepper"), "BPM stepper visible in Advanced Mode");
    assert(
      !isVisible("#groove-slider-container"),
      "Groove slider hidden in Advanced Mode"
    );

    // Simple slider hidden
    assert(
      !isVisible("#simple-slider-container"),
      "Simple slider hidden in Advanced Mode"
    );

    // Time signature controls visible
    assert(
      isVisible("#groovePresetSelect"),
      "Time signature controls visible in Advanced Mode"
    );
    assert(
      isVisible("#soundProfileGroove"),
      "Sound profile controls visible in Advanced Mode"
    );

    // Chip populated
    await wait(100); // allow _renderChip to fire
    assert(
      grooveChip.textContent.trim().length > 0,
      `groove-settings-chip populated in Advanced Mode (got: "${grooveChip.textContent.trim()}")`
    );
    assert(
      document.getElementById("simple-settings-chip").textContent.trim()
        .length > 0,
      "simple-settings-chip populated in Advanced Mode"
    );

    // BPM step input visible in settings
    await click("#settingsTrigger");
    await wait(150);
    assert(
      isVisible("#bpmStepInput"),
      "BPM step input visible in Advanced Mode settings"
    );
    assert(
      isVisible("#grooveAnchorToggle"),
      "Groove anchor toggle visible in Advanced Mode settings"
    );
    await closeSettings();

    // =========================================================================
    // 5. Advanced Mode BPM behaviour
    // =========================================================================
    console.log(`\n%c🔢 5. Advanced Mode BPM`, S);

    // Ensure we're in Advanced Mode with a clean known step
    await ensureAdvancedMode();
    await click("#settingsTrigger");
    await wait(150);
    await type("#bpmStepInput", "10");
    // blur fires the step change
    document
      .getElementById("bpmStepInput")
      .dispatchEvent(new Event("blur", { bubbles: true }));
    await wait(200);
    await closeSettings();

    // Stepper + button on min field
    await setGrooveRange(60, 120);
    const plusMin = document.querySelector(
      '.bpm-adjust-btn[data-target="min"][data-delta="1"]'
    );
    assertCritical(plusMin, "Min + stepper button found");
    plusMin.click();
    await wait(100);
    assert(
      parseInt(document.getElementById("bpmMin").value) === 70,
      `Min + stepper increments by step=10 (60 → ${document.getElementById("bpmMin").value})`
    );

    // Stepper - button on max field
    const minusMax = document.querySelector(
      '.bpm-adjust-btn[data-target="max"][data-delta="-1"]'
    );
    assertCritical(minusMax, "Max − stepper button found");
    minusMax.click();
    await wait(100);
    assert(
      parseInt(document.getElementById("bpmMax").value) === 110,
      `Max − stepper decrements by step=10 (120 → ${document.getElementById("bpmMax").value})`
    );

    // Margin guard: gap = step = 10 → increment min blocked
    await setGrooveRange(60, 70); // gap exactly 10
    await wait(100);
    plusMin.click();
    await wait(100);
    assert(
      parseInt(document.getElementById("bpmMin").value) === 60,
      "Stepper blocked when gap = step (margin guard)"
    );

    // Switch to Metronome tab so stepper buttons are active
    await click("#tab-metronome");

    // simpleBpm freeform anchor: typing 123 should stay 123 and set the new anchor
    const simpleEl = document.getElementById("simpleBpm");
    simpleEl.value = "120";
    await type("#simpleBpm", "123");
    assert(
      parseInt(simpleEl.value) === 123,
      `simpleBpm accepts typed input freeform (123 → ${simpleEl.value})`
    );

    // Verify stepper uses the new anchor: 123 + step 10 = 133
    const plusBtn = document.querySelector(
      '.bpm-adjust-btn[data-target="simple"][data-delta="1"]'
    );
    plusBtn.click();
    await wait(100);
    assert(
      parseInt(simpleEl.value) === 133,
      `simpleBpm stepper uses new anchor (123 + 10 = ${simpleEl.value})`
    );

    // Switch back to Groove for Section 6
    await click("#tab-groove");

    // =========================================================================
    // 6. Groove Session Lifecycle (Advanced Mode)
    // =========================================================================
    console.log(`\n%c🥁 6. Groove Session`, S);

    await ensureAdvancedMode();
    await click("#tab-groove");
    assert(isVisible("#panel-groove"), "Groove panel visible");

    // Session controls visible in Advanced Mode
    assert(
      isVisible("#cycleDuration"),
      "cycleDuration visible in Advanced Mode"
    );
    assert(isVisible("#sessionMode"), "sessionMode visible in Advanced Mode");

    await type("#cycleDuration", "60");
    await click("#startBtn");
    await wait(300);

    assertCritical(
      document.getElementById("startBtn").disabled ||
        document.getElementById("startBtn").textContent === "Stop",
      "Groove session started (startBtn disabled or text=Stop)"
    );

    console.log("   ⏳ Verifying playback state...");
    await wait(3500);

    await click("#pauseBtn");
    assert(
      document.getElementById("pauseBtn").textContent === "Resume",
      "Pause toggles button to Resume"
    );
    await click("#pauseBtn");
    assert(
      document.getElementById("pauseBtn").textContent === "Pause",
      "Resume toggles button back to Pause"
    );

    await click("#startBtn"); // Stop
    await wait(300);
    assert(
      !document.getElementById("bpmMin").disabled,
      "Session stopped — bpmMin re-enabled"
    );
    assert(
      document.getElementById("startBtn").textContent === "Start",
      "startBtn back to Start after stop"
    );

    // =========================================================================
    // 7. Tempo-Synced Timing Verification
    // =========================================================================
    console.log(`\n%c⏱️  7. Timing`, S);

    // Force Step to 1 to prevent any margin collisions during timing check
    await click("#settingsTrigger");
    await type("#bpmStepInput", "1");
    document
      .getElementById("bpmStepInput")
      .dispatchEvent(new Event("blur", { bubbles: true }));
    // Ensure tempo-synced count-in is on
    await click("#settingsTrigger");
    await wait(200);
    const syncToggle = document.getElementById("tempoSyncedToggle");
    if (!syncToggle.checked) await click("#tempoSyncedToggle");
    await closeSettings();

    const durSlow = await measureCountIn(30, 35);
    console.log(`   30 BPM count-in: ${Math.round(durSlow)}ms`);

    const durFast = await measureCountIn(295, 300);
    console.log(`   300 BPM count-in: ${Math.round(durFast)}ms`);

    assertCritical(
      durFast < durSlow * 0.25,
      "High BPM count-in significantly faster than low BPM (tempo-synced)"
    );

    await setGrooveRange(60, 120);

    // =========================================================================
    // 8. Simple Metronome & Ownership
    // =========================================================================
    console.log(`\n%c🎵 8. Simple Metronome`, S);

    await click("#tab-metronome");

    // Tap Tempo
    const tapBtn = document.getElementById("tapTempoBtn");
    for (let i = 0; i < 6; i++) {
      tapBtn.click();
      await wait(500);
    }
    const tapResult = parseInt(document.getElementById("simpleBpm").value);
    assert(
      tapResult >= 115 && tapResult <= 125,
      `Tap Tempo accuracy: got ${tapResult} BPM (expected ~120)`
    );

    // Start simple metronome
    await click("#simpleStartBtn");
    await wait(200);
    assert(
      document.getElementById("simpleStartBtn").textContent === "Stop",
      "Simple Metronome started (button text = Stop)"
    );

    // Ownership guard: groove tab should be disabled
    const grooveTab = document.getElementById("tab-groove");
    assert(
      grooveTab.disabled || grooveTab.classList.contains("disabled"),
      "Groove tab disabled while Simple Metronome owns playback"
    );

    // Stop
    await click("#simpleStartBtn");
    await wait(200);
    assert(
      !grooveTab.disabled && !grooveTab.classList.contains("disabled"),
      "Groove tab re-enabled after Simple Metronome stops"
    );

    // =========================================================================
    // 9. Groove Editor & Persistence (Phase 5.2)
    // =========================================================================
    console.log(`\n%c📝 9. Groove Editor & Persistence`, S);

    // --- Ensure metronome is fully stopped before entering Editor tests ---
    await waitUntilIdle();

    await ensureAdvancedMode();
    const groovesArea = document.getElementById("grooves");
    const originalNames = groovesArea.value;
    const testName = "Verify_" + Date.now();

    // Test Name Persistence
    groovesArea.value = testName;
    groovesArea.dispatchEvent(new Event("input", { bubbles: true }));

    await click("#managePatternsBtn");
    // Wait for the chained animation (Textarea close -> List unhide)
    const listIsReady = await waitForVisible("#groove-list-container");
    assert(
      listIsReady,
      "State B: Interactive list is visible after transition"
    );

    // Check Ownership: Metronome Start should be disabled while Editing
    await click(".edit-pattern-btn");
    assert(
      window.sessionEngine.getActiveModeOwner() === "editing",
      "Ownership: 'editing' claimed correctly"
    );
    assert(
      document.getElementById("startBtn").disabled,
      "Start button blocked during edit session (Mutual Exclusivity)"
    );

    // Grid Interaction & Saving
    await click(".groove-cell", 100); // Toggle a cell
    await click("#saveGrooveBtn");
    assert(!isVisible("#groove-editor-panel"), "Editor closed after Save");
    assert(
      document.querySelector(".saved-badge"),
      "Saved badge (✓) appears in list after saving"
    );

    // =========================================================================
    // 10. Pattern Sovereignty & Dashboard (Phase 5.2)
    // =========================================================================
    console.log(`\n%c🥁 10. Pattern Sovereignty & Dashboard`, S);

    // Set 7/8 local rhythm in the editor
    await click(".edit-pattern-btn");
    const pDen = document.getElementById("patDenominator");
    pDen.value = "8";
    pDen.dispatchEvent(new Event("change"));
    await type("#patNumerator", "7");
    await click("#saveGrooveBtn");

    // Set high BPM for fast tick detection
    await type("#bpmMin", "180");
    await type("#bpmMax", "190");

    await click("#startBtn");
    console.log("   ⏳ Waiting for metronome pulse (2.5s)...");
    await wait(2500); // Account for count-in and first ticks

    // Verify Core Override
    const coreSig = window.metronome.getTimeSignature();
    assert(
      coreSig.beats === 7 && coreSig.value === 8,
      `Sovereignty: Metronome Core playing in ${coreSig.beats}/${coreSig.value}`
    );
    assert(
      document.getElementById("groovePresetSelect").disabled,
      "UI Lockout: Global rhythm controls locked"
    );

    // Dashboard Class Check
    const container = document.getElementById("beat-indicator-container");
    if (document.getElementById("patternDashboardToggle").checked) {
      assert(
        container.classList.contains("pattern-mode"),
        "Dashboard: .pattern-mode class applied to visualizer"
      );
    }

    await click("#startBtn"); // Stop
    await wait(1000);
    assert(
      !document.getElementById("groovePresetSelect").disabled,
      "UI Unlock: Global controls re-enabled after session stop"
    );

    // =========================================================================
    // 11. Audio Privacy (Mute) (Phase 5.2)
    // =========================================================================
    console.log(`\n%c🔇 11. Audio Privacy (Mute Sync)`, S);

    const initialMuteState =
      document.documentElement.hasAttribute("data-audio-muted");
    await click(".mute-toggle-btn");
    const afterMuteState =
      document.documentElement.hasAttribute("data-audio-muted");

    assert(
      initialMuteState !== afterMuteState,
      "Mute: HTML attribute toggled on <html>"
    );

    // Sync check on Metronome tab
    await click("#tab-metronome");
    const simpleMuteBtn = document.querySelector(
      "#metronomeVisualsSimple .mute-toggle-btn"
    );
    assert(
      simpleMuteBtn.classList.contains("muted") === afterMuteState,
      "Mute: Sync verified between Groove and Simple panels"
    );

    // Cleanup: Restore original state
    if (afterMuteState !== initialMuteState) await click(".mute-toggle-btn");
    await click("#tab-groove");
    await click("#editGrooveNamesBtn");
    groovesArea.value = originalNames;
    groovesArea.dispatchEvent(new Event("input", { bubbles: true }));

    // =========================================================================
    // Summary
    // =========================================================================
    console.log(`\n${"=".repeat(55)}`);
    console.log(`VERIFICATION COMPLETE`);
    console.log(`✅ Passed: ${passed}   ❌ Failed: ${failed}`);
    console.log(`${"=".repeat(55)}`);

    if (failed === 0) {
      document.body.style.transition = "border 0.2s";
      document.body.style.border = "8px solid #28a745";
      setTimeout(() => (document.body.style.border = "none"), 1500);
      console.log(
        "%cAll systems operational.",
        "font-size:16px;color:#28a745;font-weight:bold;"
      );
    } else {
      document.body.style.border = "8px solid #ffc107";
    }
  } catch (err) {
    console.error("\n❌ VERIFICATION ABORTED:", err.message);
    document.body.style.border = "8px solid #dc3545";
  }
})();
