// audioProfiles.js
// Centralized WebAudio tick generator and sound profile manager
import { getSampleBuffer } from "./sampleLoader.js";
import { debugLog } from "./debug.js";

let audioCtx;
let nextNoteTime = 0; // The scheduling time will be managed externally by each metronome

// =========================
// Procedural sound profiles
// =========================
const SOUND_PROFILES = {
  digital: {
    waveform: "sine",
    freq: 1000,
    duration: 0.05,
    attack: 0.0,
    decay: 0.0,
    raw: true, // Original instant tick
  },
  soft: {
    waveform: "triangle",
    freq: 800,
    duration: 0.08,
    attack: 0.002,
    decay: 0.08,
  },
  ping: {
    waveform: "sine",
    freq: 2000,
    duration: 0.06,
    attack: 0.0001,
    decay: 0.05,
  },
  bubble: {
    waveform: "sine",
    freq: 500,
    duration: 0.07,
    attack: 0.002,
    decay: 0.06,
  },
  clave: {
    waveform: "square",
    freq: 1200,
    duration: 0.05,
    attack: 0.0005,
    decay: 0.04,
  },
  Xstick: {
    sample: "xstick", // Key to fetch from sampleLoader
    duration: 0.1, // Not used for samples but can be a fallback
  },
};

// Active profile state
let activeProfileName = "digital";

// =========================
// Public API
// =========================

/**
 * Initializes the shared AudioContext if it doesn't exist.
 *
 * @returns {AudioContext} Shared audio context instance
 */
export function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

/**
 * Syncs the scheduling time with metronome cores.
 *
 * @param {number} time - Audio context time for next tick
 * @returns {void}
 * @internal
 */
export function setNextNoteTime(time) {
  nextNoteTime = time;
}

/**
 * Sets the active sound profile.
 *
 * @param {string} name - Profile name (digital, soft, ping, bubble, clave)
 * @returns {void}
 * @example
 * setActiveProfile('soft');
 */
export function setActiveProfile(name) {
  if (SOUND_PROFILES[name]) {
    activeProfileName = name;
    debugLog("audio", `🎧 Active sound profile set to: ${name}`);
  } else {
    debugLog("audio", `⚠️ Unknown sound profile: ${name}`);
  }
}
/**
 * Returns the current active sound profile name.
 *
 * @returns {string} Active profile name
 */
export function getActiveProfile() {
  return activeProfileName;
}

/**
 * Returns list of all available sound profiles.
 *
 * @returns {string[]} Array of profile names
 * @example
 * const profiles = getAvailableProfiles();
 * // ['digital', 'soft', 'ping', 'bubble', 'clave']
 */
export function getAvailableProfiles() {
  return Object.keys(SOUND_PROFILES);
}

/**
 * Generates a procedural audio tick.
 *
 * @param {boolean} isAccent - True for accent (downbeat), false for normal
 * @returns {void}
 * @internal
 */
export function playTick(isAccent) {
  if (!audioCtx) return;

  const profileName = getActiveProfile();
  const profile = SOUND_PROFILES[profileName] || SOUND_PROFILES.digital;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  const baseFreq = profile.freq * (isAccent ? 2.0 : 1.0);
  const baseGain = isAccent ? 0.4 : 0.25;

  // --- Check if profile uses a sample or an oscillator ---
  if (profile.sample) {
    const buffer = getSampleBuffer(profile.sample);
    if (!buffer) return; // Fallback to silence if not loaded
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;

    // Loudness logic (1.0 for accent, 0.8 for normal)
    gain.gain.setValueAtTime(isAccent ? 1.0 : 0.8, nextNoteTime);

    source.connect(gain);
    gain.connect(audioCtx.destination);
    source.start(nextNoteTime);
  } else {
    // Standard procedural logic
    osc.type = profile.waveform;
    osc.frequency.setValueAtTime(baseFreq, nextNoteTime);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(nextNoteTime);
    osc.stop(nextNoteTime + profile.duration);
  }

  const now = nextNoteTime;

  if (profile.raw) {
    // 🚀 Legacy instant tick
    gain.gain.setValueAtTime(baseGain, now);
  } else {
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(
      baseGain,
      now + (profile.attack || 0.001)
    );
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + (profile.decay || profile.duration)
    );
  }
}

// Re-expose useful state for debugging
export const AudioProfiles = {
  ensureAudio,
  setNextNoteTime,
  setActiveProfile,
  getAvailableProfiles,
  playTick,
};
