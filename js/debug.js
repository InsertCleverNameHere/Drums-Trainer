// js/debug.js
/**
 * Global debug flag system for selective console logging.
 * Enable via browser console: `DEBUG.audio = true` or `DEBUG.all = true`
 *
 * @module debug
 */

export const DEBUG = {
  visuals: false, // Visual rendering (dots, panning, phrase boundaries)
  audio: false, // Web Audio scheduling, tick generation
  ownership: false, // Mode ownership changes (groove/simple/null)
  hotkeys: false, // Keyboard input handling
  timing: false, // Performance measurements (> 16.67ms warnings)
  state: false, // UI state transitions (buttons, inputs)
  all: false, // Master override (enables everything)
};

// Expose to window for console access
if (typeof window !== "undefined") {
  window.DEBUG = DEBUG;
  console.info(
    "🐛 Debug system loaded. Use DEBUG.audio = true to enable logging."
  );
}

/**
 * Conditional logging based on debug flags.
 *
 * @param {string} category - One of: visuals, audio, ownership, hotkeys, timing, state
 * @param {...any} args - Arguments to pass to console.log
 *
 * @example
 * debugLog('audio', 'Scheduling tick at', nextNoteTime);
 * // Only logs if DEBUG.audio or DEBUG.all is true
 */
export function debugLog(category, ...args) {
  if (DEBUG.all || DEBUG[category]) {
    const timestamp = performance.now().toFixed(2);
    console.log(`[${timestamp}ms] [${category.toUpperCase()}]`, ...args);
  }
}

/**
 * Always log warnings (not affected by debug flags).
 * Use for actionable issues that developers should see.
 */
export function debugWarn(category, ...args) {
  console.warn(`[${category.toUpperCase()}]`, ...args);
}

/**
 * Performance measurement helper.
 * Warns if operation exceeds threshold (default: 1 frame @ 60fps).
 */
export class DebugTimer {
  constructor(label, category = "timing") {
    this.label = label;
    this.category = category;
    this.start = performance.now();
  }

  end(threshold = 16.67) {
    const elapsed = performance.now() - this.start;
    if (DEBUG.timing || DEBUG.all) {
      debugLog(this.category, `${this.label} took ${elapsed.toFixed(2)}ms`);
    }
    if (elapsed > threshold) {
      debugWarn(
        this.category,
        `⚠️ ${this.label} exceeded threshold: ${elapsed.toFixed(2)}ms`
      );
    }
    return elapsed;
  }
}
