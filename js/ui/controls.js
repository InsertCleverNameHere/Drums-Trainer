/**
 * @fileoverview Sound profiles, panning mode, and time signature controls.
 * Manages synchronized dropdowns and toggles for both groove and simple panels.
 * 
 * @module ui/controls
 */

import { debugLog } from "../debug.js";
import * as audioProfiles from "../audioProfiles.js";
import * as simpleMetronome from "../simpleMetronome.js";

/**
 * Initializes sound profile dropdowns for both groove and simple panels.
 * Populates dropdowns, syncs selections, and persists active profile.
 * 
 * @returns {void}
 * 
 * @example
 * initSoundProfileUI(); // Sets up synchronized profile dropdowns
 */
export function initSoundProfileUI() {
  const grooveProfileEl = document.getElementById("soundProfileGroove");
  const simpleProfileEl = document.getElementById("soundProfileSimple");

  if (!grooveProfileEl || !simpleProfileEl) {
    debugLog("state", "⚠️ Sound profile dropdowns not found in DOM");
    return;
  }

  // Populate both dropdowns dynamically
  const profiles = audioProfiles.getAvailableProfiles();
  for (const p of profiles) {
    const label = p.charAt(0).toUpperCase() + p.slice(1);
    grooveProfileEl.appendChild(new Option(label, p));
    simpleProfileEl.appendChild(new Option(label, p));
  }

  /**
   * Syncs both dropdowns and applies active profile.
   * 
   * @param {string} profileName - Profile name (digital, soft, ping, bubble, clave)
   * @returns {void}
   */
  function syncProfileSelection(profileName) {
    grooveProfileEl.value = profileName;
    simpleProfileEl.value = profileName;
    audioProfiles.setActiveProfile(profileName);
    localStorage.setItem("activeSoundProfile", profileName);
    debugLog("state", `🎚 Sound profile set to: ${profileName}`);
  }

  // Load persisted profile first
  const saved = localStorage.getItem("activeSoundProfile");
  const current = saved || audioProfiles.getActiveProfile() || "digital";
  syncProfileSelection(current);

  // Wire up listeners on both dropdowns
  grooveProfileEl.addEventListener("change", (e) =>
    syncProfileSelection(e.target.value)
  );
  simpleProfileEl.addEventListener("change", (e) =>
    syncProfileSelection(e.target.value)
  );
}

/**
 * Initializes panning mode toggles for both groove and simple panels.
 * Keeps toggles synchronized and persists preference.
 * 
 * @returns {void}
 * 
 * @example
 * initPanningModeUI(); // Sets up synchronized panning toggles
 */
export function initPanningModeUI() {
  const grooveToggle = document.getElementById("intelligentPanningToggle");
  const simpleToggle = document.getElementById(
    "intelligentPanningToggleSimple"
  );

  if (!grooveToggle || !simpleToggle) {
    debugLog("state", "⚠️ Panning mode toggles not found in DOM");
    return;
  }

  // Load persisted preference (default: true = intelligent)
  const stored = localStorage.getItem("intelligentPanningMode");
  const isValidStored = stored === "true" || stored === "false";
  const intelligentPanning = isValidStored ? stored === "true" : true;

  // Fix corrupted storage
  if (!isValidStored && stored !== null) {
    debugLog(
      "state",
      "⚠️ Corrupted intelligentPanningMode value, resetting to default (true)"
    );
    localStorage.setItem("intelligentPanningMode", "true");
  }

  // Initialize both toggles
  grooveToggle.checked = intelligentPanning;
  simpleToggle.checked = intelligentPanning;

  /**
   * Syncs both toggles and dispatches change event.
   * 
   * @param {boolean} sourceValue - New toggle state
   * @returns {void}
   */
  function syncToggles(sourceValue) {
    grooveToggle.checked = sourceValue;
    simpleToggle.checked = sourceValue;
    localStorage.setItem(
      "intelligentPanningMode",
      sourceValue ? "true" : "false"
    );

    // Dispatch event for visuals.js
    document.dispatchEvent(
      new CustomEvent("panningModeChanged", {
        detail: { intelligent: sourceValue },
      })
    );

    debugLog(
      "state",
      `🎯 Panning mode: ${sourceValue ? "Intelligent" : "Forced"}`
    );
  }

  // Wire up listeners
  grooveToggle.addEventListener("change", () =>
    syncToggles(grooveToggle.checked)
  );
  simpleToggle.addEventListener("change", () =>
    syncToggles(simpleToggle.checked)
  );

  // Disable toggles during playback
  document.addEventListener("metronome:ownerChanged", (e) => {
    const owner = e?.detail?.owner;
    const isPlaying = owner !== null;
    grooveToggle.disabled = isPlaying;
    simpleToggle.disabled = isPlaying;
  });
}

/**
 * Initializes time signature controls for both groove and simple panels.
 * Handles preset selection, custom inputs, and subdivision visibility.
 * 
 * @returns {void}
 * 
 * @example
 * initTimeSignatureUI(); // Sets up time signature dropdowns and inputs
 */
export function initTimeSignatureUI() {
  /**
   * Sets up controls for one panel (groove or simple).
   * 
   * @param {string} panelPrefix - 'groove' or 'simple'
   * @returns {void}
   */
  const setupControls = (panelPrefix) => {
    const presetSelect = document.getElementById(`${panelPrefix}PresetSelect`);
    const customContainer = document.getElementById(
      `${panelPrefix}CustomTimeSignature`
    );
    const customNumerator = document.getElementById(
      `${panelPrefix}CustomNumerator`
    );
    const customDenominator = document.getElementById(
      `${panelPrefix}CustomDenominator`
    );
    const subdivisionContainer = document.getElementById(
      `${panelPrefix}SubdivisionContainer`
    );
    const subdivisionSelect = document.getElementById(
      `${panelPrefix}SubdivisionSelect`
    );

    // Determine which metronome core to control
    const core =
      panelPrefix === "groove" ? window.metronome : simpleMetronome.core;
    if (!core) {
      console.error(`Metronome core not found for prefix: ${panelPrefix}`);
      return;
    }

    /**
     * Updates metronome state from UI inputs.
     * 
     * @returns {void}
     */
    const updateMetronomeState = () => {
      let beats, value;
      const presetValue = presetSelect.value;

      if (presetValue === "custom") {
        customContainer.classList.remove("hidden");
        beats = parseInt(customNumerator.value, 10);
        value = parseInt(customDenominator.value, 10);
      } else {
        customContainer.classList.add("hidden");
        [beats, value] = presetValue.split("/").map(Number);
      }

      core.setTimeSignature(beats, value);
      const updatedSignature = core.getTimeSignature();

      // Show/hide subdivision dropdown based on denominator
      if (updatedSignature.value === 4) {
        subdivisionContainer.classList.remove("hidden");
      } else {
        subdivisionContainer.classList.add("hidden");
        subdivisionSelect.value = "1";
        core.setTicksPerBeat(1);
      }
    };

    /**
     * Updates subdivision multiplier.
     * 
     * @returns {void}
     */
    const updateSubdivision = () => {
      const multiplier = parseInt(subdivisionSelect.value, 10);
      core.setTicksPerBeat(multiplier);
    };

    // Attach event listeners
    presetSelect.addEventListener("change", updateMetronomeState);
    customNumerator.addEventListener("change", updateMetronomeState);
    customDenominator.addEventListener("change", updateMetronomeState);
    subdivisionSelect.addEventListener("change", updateSubdivision);

    // Initial setup
    updateMetronomeState();
  };

  // Initialize both panels
  setupControls("groove");
  setupControls("simple");
}
