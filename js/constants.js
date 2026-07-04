/**
 * @fileoverview Single Source of Truth for RGT Specification.
 */

// --- 1. SYSTEM PHYSICS (Hard Boundaries) ---
export const LIMITS = {
  BPM: { MIN: 30, MAX: 300 },
  TIME_SIG: { BEATS_MAX: 16, DENOMINATORS: [2, 4, 8, 16] },
  STEP: { MIN: 1, MAX: 150, DEFAULT: 5 },
  STORAGE: { MAX_GROOVES: 100 },
  // Consolidated from the old INPUT_LIMITS
  INPUT: {
    bpmMin: { min: 30, max: 300, defaultValue: 30 },
    bpmMax: { min: 30, max: 300, defaultValue: 60 },
    simpleBpm: { min: 30, max: 300, defaultValue: 120 },
    cycleDuration: { min: 1, max: 9999, defaultValue: 60 },
    totalCycles: { min: 1, max: 9999, defaultValue: 5 },
    totalTime: { min: 1, max: 9999, defaultValue: 300 },
    grooveCustomNumerator: { min: 1, max: 16, defaultValue: 4 },
    grooveCustomDenominator: {
      min: 2,
      max: 16,
      defaultValue: 4,
      allowed: [2, 4, 8, 16],
    },
    simpleCustomNumerator: { min: 1, max: 16, defaultValue: 4 },
    simpleCustomDenominator: {
      min: 2,
      max: 16,
      defaultValue: 4,
      allowed: [2, 4, 8, 16],
    },
  },
};

// --- 2. AUDIO ENGINE POLICY (Temporal Logic) ---
export const AUDIO = {
  LOOKAHEAD_S: 0.1,
  TIMER_INTERVAL_MS: 25,
  ADJUSTMENT_PAUSE_MS: 1700,
  COUNT_IN: {
    STEPS: 3,
    HEADROOM_S: 0.02,
    FIXED_INTERVAL_MS: 1000,
    STEP_DURATIONS: [0.06, 0.09, 0.06],
    FREQS: [700, 1400, 1600],
    GAINS: [0.22, 0.25, 0.3],
  },
};

// --- 3. UX & INTERFACE POLICY (Timing & Interaction) ---
export const UX = {
  TIMING: {
    FLASH_MS: 120,
    NOTICE_TOAST_MS: 2000,
    DIALOG_AUTOHIDE_MS: 10000,
    FOOTER_FADE_OUT_MS: 600,
    FOOTER_DISPLAY_MS: 5000,
    FOOTER_CANCELED_MS: 4000,
    UPDATE_SPINNER_MS: 300,
    INVALID_INPUT_FLASH_MS: 400,
    STAGGER_S: 0.1,
  },
  // Visual system phrase pre-rendering behavior.
  // NOTE: These values may require tuning based on manual testing across devices.
  VISUALS: {
    PHRASE_PRERENDER: {
      MIN_LEAD_MS: 220, // Minimum time the new phrase should be settled before audio sounds
      OUTGOING_FLASH_RESERVE_MS: 150, // Time protected to ensure the previous tick's flash is visible
      MAX_LOOKBACK_TICKS: 4, // Hard ceiling on how many ticks early we begin preparation
    },
  },
  DEBOUNCE: {
    HOTKEY_MS: 120,
  },
  TAP_TEMPO: {
    TIMEOUT_MS: 1500,
    MAX_WINDOW: 3,
    DECAY_WEIGHT: 0.18,
    QUANTIZATION_STEP: 5,
  },
};

// --- 4. FACTORY DEFAULTS (Initial State) ---
export const DEFAULTS = {
  BPM: 120,
  GROOVE_RANGE: { MIN: 30, MAX: 60 },
  SOUND_PROFILE: "digital",
};

// --- 5. PERSISTENCE MAP (Storage Keys) ---
export const STORAGE_KEYS = {
  THEME: "darkMode",
  ADVANCED_MODE: "advancedMode",
  BPM_STEP: "bpmQuantizationStep",
  GROOVE_ANCHOR: "grooveAnchor",
  DASHBOARD: "patternDashboardEnabled",
  SOUND_PROFILE: "activeSoundProfile",
  MUTE: "audioMuted",
  LIBRARY_SEEDED: "rgt_library_seeded",
  GROOVE_PATTERNS: "userGroovePatterns",
  GROOVE_NAMES: "userGrooveNames",
  EDITOR_STATE: "grooveEditorState",
  COUNT_IN_SYNC: "tempoSyncedCountIn",
};
