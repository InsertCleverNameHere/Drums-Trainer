/**
 * @fileoverview Central service for user notifications and interactive prompts.
 * @module ui/notices
 */

import { debugLog } from "../debug.js";
import { VISUAL_TIMING } from "../constants.js";
import { ingestLibrary } from "../grooveStorage.js";

/** @type {number|null} Internal timer for notice fade-out sequence */
let _noticeAutoTimer = null;
/** @type {number|null} Internal timer for final notice removal */
let _noticeHideTimer = null;

/**
 * Clears active timers and force-kills GSAP animations on the notice element.
 */
export function clearNotice() {
  const notice = document.querySelector(".ui-notice");
  if (!notice) return;

  if (_noticeAutoTimer) clearTimeout(_noticeAutoTimer);
  if (_noticeHideTimer) clearTimeout(_noticeHideTimer);
  _noticeAutoTimer = _noticeHideTimer = null;

  gsap.killTweensOf(notice);
  notice.classList.remove(
    "show",
    "fade-in",
    "fade-out",
    "hidden",
    "interactive",
    "auto"
  );
}

/**
 * Displays a standard auto-fading toast notification.
 */
export function showNotice(message, duration = 2000) {
  let notice =
    document.querySelector(".ui-notice") ||
    Object.assign(document.createElement("div"), { className: "ui-notice" });
  if (!notice.parentElement) document.body.appendChild(notice);

  clearNotice();

  notice.textContent = message;
  notice.classList.add("show", "fade-in", "auto");

  _noticeAutoTimer = setTimeout(() => {
    if (notice.classList.contains("interactive")) return;
    notice.classList.replace("fade-in", "fade-out");
    _noticeHideTimer = setTimeout(() => {
      if (notice.classList.contains("interactive")) return;
      notice.classList.remove("show", "auto");
      notice.classList.add("hidden");
    }, 500);
  }, duration);
}

/**
 * Standard entrance for interactive dialogs (Import, Preview, Welcome).
 * @param {string} html - Inner HTML for the notice.
 */
export function showInteractiveNotice(html) {
  const noticeEl = document.getElementById("uiNotice");
  if (!noticeEl) return;

  clearNotice();
  noticeEl.innerHTML = html;
  noticeEl.classList.remove("hidden");
  noticeEl.classList.add("interactive");

  gsap.fromTo(
    noticeEl,
    { y: -20, opacity: 0 },
    { y: 5, opacity: 1, duration: 0.5, ease: "back.out(1.7)" }
  );
}

/**
 * Standard exit for interactive dialogs.
 */
export function hideInteractiveNotice() {
  const noticeEl = document.getElementById("uiNotice");
  if (!noticeEl || !noticeEl.classList.contains("interactive")) return;

  gsap.to(noticeEl, {
    y: -20,
    opacity: 0,
    duration: 0.3,
    onComplete: () => {
      if (noticeEl.classList.contains("interactive")) {
        noticeEl.classList.add("hidden");
        noticeEl.classList.remove("interactive");
      }
    },
  });
}

/**
 * Migrated from grooveStorage.js: Handles initial library seeding prompt.
 */
export function checkLibrarySeed() {
  const LIBRARY_SEED_KEY = "rgt_library_seeded";
  if (localStorage.getItem(LIBRARY_SEED_KEY)) return;

  fetch("./defaultGrooves.json")
    .then((res) => res.json())
    .then((data) => {
      const html = `
        <div style="margin-bottom: 12px; font-weight: 600;">
          Welcome: would you like to use the default grooves with actual drum sounds?
        </div>
        <div style="display: flex; gap: 8px; justify-content: center;">
          <button id="seed-yes" style="background: var(--accent); color: white; min-height: 36px; padding: 0 16px;">Yes</button>
          <button id="seed-no" style="min-height: 36px; padding: 0 16px;">No</button>
        </div>
      `;
      showInteractiveNotice(html);

      const libNames = Object.keys(data.library).join("\n");
      const finalize = () => {
        localStorage.setItem(LIBRARY_SEED_KEY, "true");
        hideInteractiveNotice();
      };

      document.getElementById("seed-yes").onclick = () => {
        ingestLibrary(data.library, false);
        localStorage.setItem("userGrooveNames", libNames);
        const el = document.getElementById("grooves");
        if (el) el.value = libNames;
        finalize();
      };

      document.getElementById("seed-no").onclick = () => {
        localStorage.setItem("userGrooveNames", libNames);
        const el = document.getElementById("grooves");
        if (el) el.value = libNames;
        finalize();
      };
    })
    .catch((err) => debugLog("state", "Library seed check skipped", err));
}
