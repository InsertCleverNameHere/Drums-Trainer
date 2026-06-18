/**
 * @fileoverview Boundary Layer for external data exchange.
 * Handles Deep Linking, Clipboard API, and File Backup/Restore.
 *
 * @module ui/interop
 */

import { debugLog } from "../debug.js";
import { getActiveModeOwner } from "../ownership.js";
import * as notices from "./notices.js";
import * as grooveStorage from "../grooveStorage.js";
import * as utils from "../utils.js";
import * as metronome from "../metronomeCore.js";
import { patternScheduler } from "../patternScheduler.js";

// --- Internal Volatile State ---
let _isPreviewActive = false;
let _isPreviewPlaying = false;

/**
 * Returns whether a volatile (shared) groove is currently being previewed.
 */
export function isPreviewActive() {
  return _isPreviewActive;
}

/**
 * Manages the playback toggle for the preview mode.
 * @returns {boolean} New playing state
 */
export function togglePreviewPlayback() {
  const startBtn = document.getElementById("startBtn");
  if (_isPreviewPlaying) {
    metronome.stopMetronome();
    _isPreviewPlaying = false;
    if (startBtn) startBtn.textContent = "Start";
    debugLog("state", "🛑 Preview stopped");
  } else {
    // Shared grooves preview at a default comfortable tempo
    metronome.startMetronome(120);
    _isPreviewPlaying = true;
    if (startBtn) startBtn.textContent = "Stop";
    debugLog("state", "▶️ Preview playing");
  }
  return _isPreviewPlaying;
}

/**
 * Initializes the Import/Export UI logic.
 * Wires the "Backup Library" and "Restore Library" buttons.
 */
export function initInteropUI() {
  const exportBtn = document.getElementById("exportLibraryBtn");
  const importBtn = document.getElementById("importLibraryBtn");
  const fileIn = document.getElementById("importFileInput");

  if (!exportBtn || !importBtn || !fileIn) return;

  // 1. EXPORT: Generate JSON Blob and trigger browser download
  exportBtn.addEventListener("click", () => {
    const bundle = grooveStorage.exportLibrary();
    if (!bundle) {
      notices.showNotice("⚠️ Cannot export: Your library is empty.");
      return;
    }

    try {
      const blob = new Blob([bundle], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().split("T")[0];

      a.href = url;
      a.download = `rgt_backup_${date}.json`;
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        notices.showNotice("✅ Backup file created.");
      }, 100);
    } catch (e) {
      debugLog("state", "❌ Export UI Error", e);
      notices.showNotice("❌ Export failed.");
    }
  });

  // 2. IMPORT: Trigger native file picker with session guard
  importBtn.addEventListener("click", () => {
    const owner = getActiveModeOwner();
    if (owner) {
      notices.showNotice(`⚠️ Cannot import while ${owner} is active.`);
      return;
    }
    fileIn.click();
  });

  // 3. FILE SELECTION: Read JSON and pass to feasibility engine
  fileIn.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const bundle = JSON.parse(event.target.result);
        const report = grooveStorage.getImportReport(bundle);
        if (!report) throw new Error("Invalid Bundle Structure");
        handleImportReport(bundle, report);
      } catch (err) {
        notices.showNotice("❌ Invalid file format.");
        debugLog("state", "❌ Import Parser Error", err);
      }
      fileIn.value = ""; // Reset input
    };
    reader.readAsText(file);
  });
}

/**
 * Handles the feasibility report and displays the interactive mediation UI.
 */
export function handleImportReport(bundle, report) {
  const executeImport = (namesToImport) => {
    const success = grooveStorage.commitImport(bundle.library, namesToImport);
    if (success) {
      if (bundle.names) {
        const textarea = document.getElementById("grooves");
        if (textarea) {
          const existing = textarea.value
            .split("\n")
            .map((n) => n.trim())
            .filter(Boolean);
          const incoming = bundle.names
            .split("\n")
            .map((n) => n.trim())
            .filter(Boolean);
          incoming.forEach((name) => {
            if (!existing.includes(name)) existing.push(name);
          });
          textarea.value = existing.join("\n");
          textarea.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }
      notices.showNotice(`✅ Imported ${namesToImport.length} patterns.`);
      document.dispatchEvent(
        new CustomEvent("metronome:ownerChanged", { detail: { owner: null } })
      );
    }
    notices.hideInteractiveNotice();
  };

  let html = "";
  if (!report.canFit) {
    html = `<div style="margin-bottom: 12px; font-weight: 600;">❌ Storage Full: Not enough slots.</div><button id="import-cancel" style="width: 100%;">Cancel</button>`;
  } else if (report.collisions.length > 0) {
    html = `<div style="margin-bottom: 12px; font-weight: 600;">⚠️ Found ${report.collisions.length} duplicates. Proceed?</div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <button id="import-replace" style="background: var(--accent); color: white;">Replace My Patterns</button>
              <button id="import-merge">Keep Mine & Merge New</button>
              <button id="import-cancel">Cancel</button>
            </div>`;
  } else {
    html = `<div style="margin-bottom: 12px; font-weight: 600;">Import ${report.totalIncoming} new patterns?</div>
            <div style="display: flex; gap: 8px;">
              <button id="import-confirm" style="background: var(--accent); color: white; flex: 1;">Yes, Import</button>
              <button id="import-cancel" style="flex: 1;">Cancel</button>
            </div>`;
  }

  notices.showInteractiveNotice(html);

  const cancelBtn = document.getElementById("import-cancel");
  if (cancelBtn) cancelBtn.onclick = notices.hideInteractiveNotice;

  const confirmBtn = document.getElementById("import-confirm");
  if (confirmBtn)
    confirmBtn.onclick = () => executeImport(report.validIncoming);

  const replaceBtn = document.getElementById("import-replace");
  if (replaceBtn)
    replaceBtn.onclick = () => executeImport(report.validIncoming);

  const mergeBtn = document.getElementById("import-merge");
  if (mergeBtn) mergeBtn.onclick = () => executeImport(report.newItems);
}

/**
 * Checks for shared groove data in the URL hash.
 */
export function checkDeepLinks() {
  const hash = window.location.hash;
  const params = new URLSearchParams(window.location.search);

  // --- Handle Incoming Share Target (Query Params) ---
  const sharedUrl = params.get("share_url") || params.get("share_text");
  if (sharedUrl) {
    // Standardize: extract just the hash if a full URL was passed in
    const hashMatch = sharedUrl.match(/#share=([A-Za-z0-9\-_+$]+)/);
    const payload = hashMatch ? hashMatch[1] : sharedUrl;

    // Clear the query params to prevent re-triggering
    window.history.replaceState(null, null, window.location.pathname);

    const pattern = utils.decompressGroove(decodeURIComponent(payload));
    if (pattern) {
      handlePreviewMode(pattern);
      return true;
    }
  }

  // --- Handle Manual Hash Links ---
  if (!hash.startsWith("#share=")) return false;

  const compressedData = decodeURIComponent(hash.replace("#share=", ""));
  window.history.replaceState(null, null, window.location.pathname);

  const sharedPattern = utils.decompressGroove(compressedData);

  if (sharedPattern) {
    handlePreviewMode(sharedPattern);
    return true;
  } else {
    notices.showNotice("❌ Shared link is invalid or corrupted.");
    return false;
  }
}

/**
 * Loads a shared groove into a volatile preview state.
 */
export function handlePreviewMode(pattern) {
  const owner = getActiveModeOwner();
  if (owner) {
    notices.showNotice("⚠️ Busy: Stop metronome to preview shared groove.");
    return;
  }

  _isPreviewActive = true;
  patternScheduler.load(pattern);

  const pTS = pattern.patternTimeSignature || { beats: 4, value: 4 };
  metronome.setTimeSignature(parseInt(pTS.beats), parseInt(pTS.value));
  metronome.setTicksPerBeat(pattern.ticksPerBeat || 1);

  import("../visuals.js").then((m) => m.primeVisuals("groove"));

  const displayGroove = document.getElementById("displayGroove");
  if (displayGroove)
    displayGroove.textContent = `Preview: ${pattern.name || "Shared"}`;

  notices.showInteractiveNotice(`
    <div style="margin-bottom: 12px; font-weight: 600;">Previewing: "${pattern.name || "Shared"}"</div>
    <div style="display: flex; gap: 8px;">
      <button id="preview-save" style="background: var(--accent); color: white; flex: 1;">Save</button>
      <button id="preview-discard" style="flex: 1;">Discard</button>
    </div>
  `);

  const closePreview = () => {
    _isPreviewActive = false;
    _isPreviewPlaying = false;
    patternScheduler.clear();
    metronome.stopMetronome();
    const sBtn = document.getElementById("startBtn");
    if (sBtn) sBtn.textContent = "Start";
    if (displayGroove) displayGroove.textContent = "Groove: —";

    notices.hideInteractiveNotice();
    const needsSeed = !localStorage.getItem("rgt_library_seeded");
    if (needsSeed) notices.checkLibrarySeed();
  };

  document.getElementById("preview-discard").onclick = closePreview;

  document.getElementById("preview-save").onclick = () => {
    const pName = (pattern.name || "Shared").trim();
    const bundle = { library: { [pName]: pattern }, names: pName };
    const report = grooveStorage.getImportReport(bundle);

    if (report.collisions.length === 0 && report.canFit) {
      grooveStorage.commitImport(bundle.library, [pName]);
      const textarea = document.getElementById("grooves");
      if (textarea) {
        const names = textarea.value.split("\n").map((n) => n.trim());
        if (!names.includes(pName)) {
          textarea.value += (textarea.value.length > 0 ? "\n" : "") + pName;
          textarea.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }
      notices.showNotice(`✅ Saved "${pName}"`);
      document.dispatchEvent(
        new CustomEvent("metronome:ownerChanged", { detail: { owner: null } })
      );
      closePreview();
    } else {
      handleImportReport(bundle, report);
    }
  };
}

/**
 * Serializes a pattern and copies a shareable URL to the clipboard.
 */
export function copyGrooveLink(name) {
  const pattern = grooveStorage.getGroovePattern(name);
  if (!pattern) return;

  const shareObj = { ...pattern, name: name.trim() };
  const hash = utils.compressGroove(shareObj);
  const url = `${window.location.origin}${window.location.pathname}#share=${hash}`;

  navigator.clipboard
    .writeText(url)
    .then(() => notices.showNotice(`📋 Link copied for "${name}"`))
    .catch(() => notices.showNotice("❌ Failed to copy link."));
}

/**
 * Reads a link or raw hash from the clipboard and triggers the preview engine.
 */
export async function pasteFromClipboard() {
  try {
    const rawText = await navigator.clipboard.readText();
    const text = rawText.trim();
    const hashMatch = text.match(/#share=([A-Za-z0-9\-_+$]+)/);
    let finalHash = hashMatch ? hashMatch[1] : null;

    if (!finalHash && /^[A-Za-z0-9\-_+$]+$/.test(text)) {
      if (utils.decompressGroove(text)) finalHash = text;
    }

    if (finalHash) {
      window.location.hash = `share=${encodeURIComponent(finalHash)}`;
    } else {
      notices.showNotice("⚠️ No valid groove data found in clipboard.");
    }
  } catch (err) {
    notices.showNotice("❌ Clipboard access denied.");
  }
}
