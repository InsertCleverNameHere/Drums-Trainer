// audioProfiles.js
// Centralized WebAudio tick generator and sound profile manager
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
};

// Active profile state
let activeProfileName = "digital";

// =========================
// Public API
// =========================

// Initialize shared audio context (if needed)
export function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

// Allows metronome cores to sync their scheduling time
export function setNextNoteTime(time) {
  nextNoteTime = time;
}

// Change the active profile dynamically
export function setActiveProfile(name) {
  if (SOUND_PROFILES[name]) {
    activeProfileName = name;
    debugLog("audio", `🎧 Active sound profile set to: ${name}`);
  } else {
    debugLog("audio", `⚠️ Unknown sound profile: ${name}`);
  }
}
export function getActiveProfile() {
  return activeProfileName;
}

// Retrieve list of all available profiles
export function getAvailableProfiles() {
  return Object.keys(SOUND_PROFILES);
}

// Core sound generation function
export function playTick(isAccent) {
  if (!audioCtx) return;

  const profileName = getActiveProfile();
  const profile = SOUND_PROFILES[profileName] || SOUND_PROFILES.digital;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  const baseFreq = profile.freq * (isAccent ? 2.0 : 1.0);
  const baseGain = isAccent ? 0.4 : 0.25;

  osc.type = profile.waveform;
  osc.frequency.setValueAtTime(baseFreq, nextNoteTime);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

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

  osc.start(now);
  osc.stop(now + profile.duration);
}

// Re-expose useful state for debugging
export const AudioProfiles = {
  ensureAudio,
  setNextNoteTime,
  setActiveProfile,
  getAvailableProfiles,
  playTick,
};
