/**
 * @fileoverview Central arbiter for metronome and editor ownership.
 * Prevents multiple modes (Groove, Simple, Editor) from conflicting.
 *
 * @module ownership
 */

import { debugLog } from "./debug.js";

/** @type {string|null} Current owner: 'groove' | 'simple' | 'editing' | null */
let _activeModeOwner = null;

/**
 * Sets the active mode owner and dispatches a global state event.
 *
 * @param {string|null} owner - The new owner ID or null to release.
 */
export function setActiveModeOwner(owner) {
  const newOwner = owner || null;

  if (newOwner === _activeModeOwner) return;

  const previous = _activeModeOwner;
  _activeModeOwner = newOwner;

  debugLog("ownership", `Owner changed: ${previous} → ${_activeModeOwner}`);

  // Canonical event for UI reactivity across all modules
  document.dispatchEvent(
    new CustomEvent("metronome:ownerChanged", {
      detail: { owner: _activeModeOwner },
    })
  );
}

/**
 * Returns the current mode owner ID.
 *
 * @returns {string|null}
 */
export function getActiveModeOwner() {
  return _activeModeOwner;
}
