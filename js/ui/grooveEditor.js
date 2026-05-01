/**
 * @fileoverview UI Controller for the Groove Pattern Editor.
 * Handles the two-state textarea transition and rhythmic grid rendering.
 * @module ui/grooveEditor
 */

import * as grooveStorage from "../grooveStorage.js";
import { patternScheduler } from "../patternScheduler.js";
import { showNotice } from "./sliders.js";
import { isAdvancedMode } from "./advancedMode.js";
import { generateMeasureLayout } from "../visuals.js";
import { debugLog } from "../debug.js";

// --- Internal State ---
let _currentBeats = 4;
let _currentValue = 4;
let _currentTicks = 1;
let _currentStepCount = 0;
let _activeGrooveName = null;
let _localPattern = null; // Temporary state before saving
let _groovesTextArea = null;
let _pendingSaveData = null; // --- Stores data while user picks a groove to replace ---
let _pendingSaveName = null; // --- Stores the target name while user picks a groove to replace ---
let _isReplacementMode = false; // --- Flag for the list state ---

// Helper to get local rhythmic values
function _getLocalRhythm() {
  const num = document.getElementById("patNumerator");
  const den = document.getElementById("patDenominator");
  const sub = document.getElementById("patSubdivision");
  const bars = document.getElementById("patMeasures");

  return {
    beats: parseInt(num?.value || 4, 10),
    value: parseInt(den?.value || 4, 10),
    ticksPerBeat: parseInt(sub?.value || 1, 10),
    measures: parseInt(bars?.value || 1, 10),
  };
}

/**
 * Initializes the Editor UI, wires state triggers, and grid interactions.
 */
export function initGrooveEditor() {
  const confirmBtn = document.getElementById("managePatternsBtn"); // "Confirm Names"
  const changeBtn = document.getElementById("editGrooveNamesBtn");
  _groovesTextArea = document.getElementById("grooves"); // "Change Names"

  if (!confirmBtn || !changeBtn) return;

  // --- Restore saved names from storage ---
  const savedNames = localStorage.getItem("userGrooveNames");
  if (savedNames) {
    _groovesTextArea.value = savedNames;
  }

  // --- Persist names on every change ---
  _groovesTextArea.addEventListener("input", () => {
    localStorage.setItem("userGrooveNames", _groovesTextArea.value);
  });

  // 1. State A -> B (Textarea to List)
  confirmBtn.addEventListener("click", () => _toggleState("list"));

  // 2. State B -> A (List to Textarea)
  changeBtn.addEventListener("click", () => _toggleState("text"));

  // 3. Editor Actions
  document.getElementById("saveGrooveBtn").onclick = _saveActivePattern;
  document.getElementById("cancelGrooveBtn").onclick = _closeEditor;
  document.getElementById("clearGrooveBtn").onclick = _clearGrid;
  document.getElementById("deleteGrooveBtn").onclick = _deleteSavedPattern;

  // 4. Track Toggles
  document.getElementById("toggleHHPed").addEventListener("change", (e) => {
    const track = document.querySelector('.groove-track[data-track="HHPed"]');
    if (track) track.classList.toggle("hidden", !e.target.checked);
  });

  // 5. Listen for rhythm changes to re-render grid
  document.addEventListener("metronome:timeSigChanged", (e) => {
    _currentBeats = e.detail.beats;
    _currentValue = e.detail.value;
    _currentTicks = e.detail.ticksPerBeat;
    if (_activeGrooveName) _renderGrid();
  });

  // 6. Listen for rhythm changes to re-render grid
  ["patNumerator", "patDenominator", "patSubdivision", "patMeasures"].forEach(
    (id) => {
      document.getElementById(id).addEventListener("change", _renderGrid);
    }
  );

  // --- Restore last used Editor State (Text vs List) ---
  const savedState = localStorage.getItem("grooveEditorState") || "text";
  if (savedState === "list" && isAdvancedMode()) {
    _applyStateInstant("list");
  }
}

/**
 * Swaps UI visibility between raw textarea and interactive list.
 */
function _toggleState(mode) {
  // Persist TextArea state
  localStorage.setItem("grooveEditorState", mode);
  const textContainer = document.getElementById("groove-textarea-container");
  const listContainer = document.getElementById("groove-list-container");
  const editorPanel = document.getElementById("groove-editor-panel");

  if (mode === "list") {
    _rebuildInteractiveList();
    gsap.to(textContainer, {
      opacity: 0,
      height: 0,
      duration: 0.3,
      onComplete: () => {
        textContainer.classList.add("hidden");
        listContainer.classList.remove("hidden");
        gsap.fromTo(
          listContainer,
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: 0.4 }
        );
      },
    });
  } else {
    _activeGrooveName = null;
    _isReplacementMode = false; // Reset replacement mode if toggling back to text
    editorPanel.classList.remove("visible"); // Close editor on exit
    gsap.to(listContainer, {
      opacity: 0,
      y: 10,
      duration: 0.3,
      onComplete: () => {
        listContainer.classList.add("hidden");
        textContainer.classList.remove("hidden");
        gsap.to(textContainer, { opacity: 1, height: "auto", duration: 0.4 });
      },
    });
  }
}

/**
 * Parses the textarea and builds the interactive list items.
 */
function _rebuildInteractiveList() {
  const list = document.getElementById("groove-interactive-list");
  // Use the module-level reference for consistency
  const grooves = _groovesTextArea.value.split("\n").filter((g) => g.trim());

  list.innerHTML = "";
  grooves.forEach((name) => {
    const li = document.createElement("li");
    li.className = "groove-list-item";
    const exists = grooveStorage.hasGroovePattern(name);

    // Determine button label and action based on mode
    let btnLabel = exists ? "Edit Pattern" : "Add Pattern";
    if (_isReplacementMode) btnLabel = exists ? "Replace Pattern" : "Select";

    li.innerHTML = `
      <span class="groove-name-label">${name}</span>
      <div class="groove-item-actions">
        <button class="edit-pattern-btn" ${_isReplacementMode && !exists ? "disabled" : ""}>${btnLabel}</button>
        ${exists ? '<span class="saved-badge">✓</span>' : ""}
      </div>
    `;

    li.querySelector(".edit-pattern-btn").onclick = (e) => {
      if (_isReplacementMode) {
        const btn = e.target;
        if (btn.classList.contains("confirming")) {
          _executeReplacement(name);
        } else {
          // Reset any other buttons in "confirming" state
          list.querySelectorAll(".confirming").forEach((b) => {
            b.classList.remove("confirming");
            b.textContent = "Replace Pattern";
          });

          btn.classList.add("confirming");
          btn.textContent = "Confirm?";
          // Auto-reset after 3 seconds
          setTimeout(() => {
            btn.classList.remove("confirming");
            btn.textContent = "Replace Pattern";
          }, 3000);
        }
      } else {
        _openEditor(name);
      }
    };
    list.appendChild(li);
  });
}

/**
 * Loads a pattern and opens the grid panel.
 */
function _openEditor(name) {
  // --- Gatekeeper: Prevent entry if metronome is playing ---
  const owner =
    typeof window.sessionEngine?.getActiveModeOwner === "function"
      ? window.sessionEngine.getActiveModeOwner()
      : null;
  if (owner === "groove" || owner === "simple") return;

  _activeGrooveName = name;
  document.getElementById("groove-editor-groove-name").textContent = name;

  const saved = grooveStorage.getGroovePattern(name);

  // Clear any visual playhead highlight from previous editor session
  const grid = document.getElementById("groove-editor-grid");
  if (grid) {
    grid
      .querySelectorAll(".playing")
      .forEach((el) => el.classList.remove("playing"));
  }

  if (saved) {
    _localPattern = JSON.parse(JSON.stringify(saved.patterns));
    // Sync local inputs to saved metadata
    document.getElementById("patNumerator").value =
      saved.patternTimeSignature.beats;
    document.getElementById("patDenominator").value =
      saved.patternTimeSignature.value;
    document.getElementById("patSubdivision").value = saved.ticksPerBeat || 1;
    document.getElementById("patMeasures").value = saved.measures || 1;
    _updateHint("Pattern loaded from storage.");
  } else {
    _localPattern = { hihat: [], kick: [], snare: [], HHPed: [] };
    // Start with global metronome settings as defaults
    const globalSig = window.metronome.getTimeSignature();
    document.getElementById("patNumerator").value = globalSig.beats;
    document.getElementById("patDenominator").value = globalSig.value;
    document.getElementById("patSubdivision").value =
      window.metronome.getTicksPerBeat();
    document.getElementById("patMeasures").value = 1;
    _updateHint("New pattern (unsaved)");
  }

  _renderGrid();
  document.getElementById("groove-editor-panel").classList.add("visible");

  // Update Delete button state
  document.getElementById("deleteGrooveBtn").disabled = !saved;

  // Claim ownership to block metronome starts while editing
  if (typeof window.sessionEngine?.setActiveModeOwner === "function") {
    window.sessionEngine.setActiveModeOwner("editing");
  }
}

/**
 * Renders the 4 instrument rows based on rhythmic state.
 */
function _renderGrid() {
  const grid = document.getElementById("groove-editor-grid");
  const rhythm = _getLocalRhythm();
  const stepCount = rhythm.beats * rhythm.ticksPerBeat * rhythm.measures;
  _currentStepCount = stepCount; // Store for later use in tick scheduling
  const tracks = ["hihat", "kick", "snare", "HHPed"];

  gsap.killTweensOf(grid.querySelectorAll(".groove-cell"));
  grid.innerHTML = "";

  // --- NEW: Phonation Labels Header Row ---
  const labelsRow = document.createElement("div");
  labelsRow.className = "groove-track labels-header";

  const spacer = document.createElement("span");
  spacer.className = "groove-track-label"; // Fixed width spacer
  labelsRow.appendChild(spacer);

  const labelsCont = document.createElement("div");
  labelsCont.className = "groove-track-cells labels-container";

  // Use visuals.js logic to get labels for one measure
  const layout = generateMeasureLayout(
    { beats: rhythm.beats, value: rhythm.value },
    rhythm.ticksPerBeat
  );

  // Repeat labels for total measure count
  for (let m = 0; m < rhythm.measures; m++) {
    layout.forEach((item) => {
      const label = document.createElement("span");
      label.className = "groove-cell-label";
      label.textContent = item.label;
      labelsCont.appendChild(label);
    });
  }
  labelsRow.appendChild(labelsCont);
  grid.appendChild(labelsRow);

  tracks.forEach((trackID) => {
    const row = document.createElement("div");
    row.className = "groove-track";
    row.dataset.track = trackID;

    const label = document.createElement("span");
    label.className = "groove-track-label";
    label.textContent =
      trackID === "HHPed" ? "HP" : trackID.substring(0, 2).toUpperCase();

    const cellsCont = document.createElement("div");
    cellsCont.className = "groove-track-cells";

    for (let i = 0; i < stepCount; i++) {
      const btn = document.createElement("button");
      btn.className = "groove-cell";
      btn.dataset.step = i;
      if (i % _currentTicks === 0) btn.classList.add("beat-start");
      if (i === 0) btn.classList.add("downbeat");

      if (_localPattern[trackID]?.[i]) btn.classList.add("active");

      btn.onclick = () => {
        btn.classList.toggle("active");
        if (!_localPattern[trackID]) _localPattern[trackID] = [];

        // Ensure pattern array is reconciled with current grid size before writing
        while (_localPattern[trackID].length < stepCount) {
          _localPattern[trackID].push(0);
        }

        _localPattern[trackID][i] = btn.classList.contains("active") ? 1 : 0;
      };

      cellsCont.appendChild(btn);
    }

    row.appendChild(label);
    row.appendChild(cellsCont);
    grid.appendChild(row);
  });

  // Ensure HH Pedal visibility matches checkbox
  const showPed = document.getElementById("toggleHHPed").checked;
  grid
    .querySelector('[data-track="HHPed"]')
    .classList.toggle("hidden", !showPed);
}

function _saveActivePattern() {
  const rhythm = _getLocalRhythm(); // Snapshots live UI values
  const data = {
    patternTimeSignature: { beats: rhythm.beats, value: rhythm.value },
    ticksPerBeat: rhythm.ticksPerBeat,
    measures: rhythm.measures,
    patterns: _localPattern,
  };

  const result = grooveStorage.setGroovePattern(_activeGrooveName, data);
  if (result.success) {
    showNotice(`Pattern saved for ${_activeGrooveName}`);
    _updateHint("Saved");
    _rebuildInteractiveList();
    _closeEditor();
    document.getElementById("deleteGrooveBtn").disabled = false;
  } else if (result.error === "FULL") {
    // Enter Replacement Mode
    _pendingSaveData = data;
    _pendingSaveName = _activeGrooveName; // Store the name of the pattern we're trying to save for reference in the replacement flow
    _isReplacementMode = true;
    _closeEditor(); // Close current grid
    _rebuildInteractiveList(); // Redraw list with "Replace" buttons
    showNotice("⚠️ Storage Full. Delete a groove pattern to save this one.");
  }
}

function _closeEditor() {
  _activeGrooveName = null;
  const panel = document.getElementById("groove-editor-panel");
  panel.classList.remove("visible");

  // Release ownership so metronome can start again
  if (typeof window.sessionEngine?.setActiveModeOwner === "function") {
    window.sessionEngine.setActiveModeOwner(null);
  }

  debugLog("state", "Closed groove editor");
}

function _clearGrid() {
  _localPattern = { hihat: [], kick: [], snare: [], HHPed: [] };
  _renderGrid();
}

let _deleteConfirmTimeout = null;

function _deleteSavedPattern() {
  const btn = document.getElementById("deleteGrooveBtn");

  // 1. Always kill any pending timeout immediately
  if (_deleteConfirmTimeout) {
    clearTimeout(_deleteConfirmTimeout);
    _deleteConfirmTimeout = null;
  }

  if (btn.classList.contains("confirming")) {
    // 2. SECOND CLICK (Confirm Action)
    grooveStorage.deleteGroovePattern(_activeGrooveName);
    _localPattern = { hihat: [], kick: [], snare: [], HHPed: [] };
    _renderGrid();
    _rebuildInteractiveList();
    _closeEditor();

    showNotice(`Deleted ${_activeGrooveName}`);

    // 3. Reset button visual state
    btn.classList.remove("confirming");
    btn.textContent = "Delete Saved";
  } else {
    // 4. FIRST CLICK (Enter Confirming State)
    btn.classList.add("confirming");
    btn.textContent = "Tap to Confirm";

    _deleteConfirmTimeout = setTimeout(() => {
      btn.classList.remove("confirming");
      btn.textContent = "Delete Saved";
      _deleteConfirmTimeout = null; // Clear reference
    }, 3000);
  }
}

function _updateHint(msg) {
  document.getElementById("groove-editor-hint").textContent = msg;
}

/**
 * Updates the visual playhead highlight on the grid.
 * @param {number} tickIndex - Current continuous tick from the metronome.
 */
export function updatePlayhead(tickIndex) {
  // Only proceed if editor is open and we have steps
  if (!_activeGrooveName || _currentStepCount === 0) return;

  const step = tickIndex % _currentStepCount;
  const grid = document.getElementById("groove-editor-grid");

  // 1. Remove highlight from previous step
  const prev = grid.querySelectorAll(".groove-cell.playing");
  prev.forEach((el) => el.classList.remove("playing"));

  // 2. Highlight all tracks at the current step
  const currentCells = grid.querySelectorAll(
    `.groove-cell[data-step="${step}"]`
  );
  currentCells.forEach((el) => el.classList.add("playing"));
}

/**
 * Forces the editor back to the raw textarea state (State A).
 * Used when switching to Simple Mode.
 * @public
 */
export function forceStateA() {
  _toggleState("text");
}

/**
 * Applies UI state (text vs list) instantly without animations.
 * Used only during initialization to prevent layout flicker.
 * @private
 */
function _applyStateInstant(mode) {
  const textContainer = document.getElementById("groove-textarea-container");
  const listContainer = document.getElementById("groove-list-container");

  if (mode === "list") {
    _rebuildInteractiveList();
    textContainer.classList.add("hidden");
    listContainer.classList.remove("hidden");
  } else {
    listContainer.classList.add("hidden");
    textContainer.classList.remove("hidden");
  }
}

/**
 * Deletes the chosen pattern and saves the pending one.
 * @private
 */
function _executeReplacement(nameToReplace) {
  grooveStorage.deleteGroovePattern(nameToReplace);

  // Use the preserved name, not the cleared active name
  const result = grooveStorage.setGroovePattern(
    _pendingSaveName,
    _pendingSaveData
  );

  if (result.success) {
    showNotice(`Replaced ${nameToReplace} with ${_pendingSaveName}`);
    _isReplacementMode = false;
    _pendingSaveData = null;
    _pendingSaveName = null;
    _rebuildInteractiveList();
  }
}
