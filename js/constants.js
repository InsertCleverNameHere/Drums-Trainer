// js/constants.js
// ===================================
// Application Constants
// ===================================

// ===================================
// BPM Configuration
// ===================================

/**
 * Hard limits for BPM (never user-configurable)
 * These represent physical/practical boundaries
 */
export const BPM_HARD_LIMITS = {
  MIN: 30, // Below this is too slow for practical use
  MAX: 300, // Above this exceeds human timing precision
};

/**
 * Default BPM values for different contexts
 */
export const BPM_DEFAULTS = {
  SIMPLE_METRONOME: 120,
  GROOVE_MIN: 30,
  GROOVE_MAX: 60,
};

/**
 * BPM quantization step
 * NOTE: This will become user-configurable in future (stored in localStorage)
 * Current: 5 (multiples of 5 only)
 * Future: User can choose 1, 5, 10, etc.
 */
export const BPM_QUANTIZATION = {
  STEP: 5, // TODO: Replace with getUserQuantizationPreference() in future
};

/**
 * Tap tempo always uses fixed quantization (rhythm-based, not preference)
 */
export const TAP_TEMPO_QUANTIZATION = 5;

// ===================================
// Time Signature Limits
// ===================================

export const TIME_SIGNATURE_LIMITS = {
  BEATS_MIN: 1,
  BEATS_MAX: 16,
  ALLOWED_DENOMINATORS: [2, 4, 8, 16],
};

// ===================================
// Audio Scheduler Configuration
// ===================================

export const SCHEDULER_CONFIG = {
  SCHEDULE_AHEAD_TIME: 0.1, // seconds to schedule ahead
  SCHEDULER_INTERVAL_MS: 5, // how often to check schedule (ms)
  SIMPLE_SCHEDULER_INTERVAL_MS: 25, // how often to check simple scheduler (ms)
  ADJUSTMENT_PAUSE_MS: 1700, // pause after cycle end (ms)
};

// ===================================
// Visual Timing
// ===================================

/**
 * Durations for UI animations and visual feedback
 */
export const VISUAL_TIMING = {
  FLASH_DURATION_MS: 120, // beat dot/text flash duration
  INVALID_INPUT_FLASH_MS: 400, // red flash on invalid input
  BPM_CHANGE_FLASH_MS: 150, // yellow flash on BPM adjust
  HOTKEY_LOCK_MS: 120, // debounce for non-repeatable hotkeys
  FOOTER_FADE_OUT_MS: 600, // footer opacity transition
  FOOTER_DISPLAY_MS: 5000, // how long footer stays visible
  FOOTER_CANCELED_DISPLAY_MS: 4000, // footer display after cancel
};

// ===================================
// Count-in Configuration
// ===================================

/**
 * Count-in audio properties (performCountIn function)
 */
export const COUNT_IN_CONFIG = {
  STEPS: 3, // number of count-in beats (3-2-1)
  FIXED_INTERVAL_MS: 1000, // fixed interval when not tempo-synced
  HEADROOM_SECONDS: 0.02, // slight delay before first beep
  STEP_DURATIONS: [0.06, 0.09, 0.06], // duration per step (oscillator stop time)
  FREQUENCIES: [700, 1400, 1600], // frequencies for each step
  GAINS: [0.22, 0.25, 0.3], // gain values for each step
};

// ===================================
// UI Input Validation
// ===================================

/**
 * Defines limits for all numeric inputs
 * Uses BPM_HARD_LIMITS as source of truth
 */
export const INPUT_LIMITS = {
  bpmMin: {
    min: BPM_HARD_LIMITS.MIN,
    max: BPM_HARD_LIMITS.MAX,
    defaultValue: BPM_DEFAULTS.GROOVE_MIN,
  },
  bpmMax: {
    min: BPM_HARD_LIMITS.MIN,
    max: BPM_HARD_LIMITS.MAX,
    defaultValue: BPM_DEFAULTS.GROOVE_MAX,
  },
  simpleBpm: {
    min: BPM_HARD_LIMITS.MIN,
    max: BPM_HARD_LIMITS.MAX,
    defaultValue: BPM_DEFAULTS.SIMPLE_METRONOME,
  },
  cycleDuration: {
    min: 1,
    max: 9999,
    defaultValue: 60,
  },
  totalCycles: {
    min: 1,
    max: 9999,
    defaultValue: 5,
  },
  totalTime: {
    min: 1,
    max: 9999,
    defaultValue: 300,
  },
  grooveCustomNumerator: {
    min: TIME_SIGNATURE_LIMITS.BEATS_MIN,
    max: TIME_SIGNATURE_LIMITS.BEATS_MAX,
    defaultValue: 4,
  },
  grooveCustomDenominator: {
    min: 2,
    max: 16,
    defaultValue: 4,
    allowed: TIME_SIGNATURE_LIMITS.ALLOWED_DENOMINATORS,
  },
  simpleCustomNumerator: {
    min: TIME_SIGNATURE_LIMITS.BEATS_MIN,
    max: TIME_SIGNATURE_LIMITS.BEATS_MAX,
    defaultValue: 4,
  },
  simpleCustomDenominator: {
    min: 2,
    max: 16,
    defaultValue: 4,
    allowed: TIME_SIGNATURE_LIMITS.ALLOWED_DENOMINATORS,
  },
};

// ===================================
// Future: User Preferences (localStorage-backed)
// ===================================

/**
 * Placeholder for future user preference system
 *
 * TODO: Implement in Phase 4+
 * - Read from localStorage on app load
 * - Provide UI to change quantization step
 * - Update slider step attribute dynamically
 * - Update input validation rules
 * - Preserve tap tempo's fixed step=5
 */
export function getUserQuantizationPreference() {
  // Future implementation:
  // return parseInt(localStorage.getItem('bpmQuantizationStep')) || 5;
  return BPM_QUANTIZATION.STEP;
}
