/* eslint-disable no-unused-vars */
/**
 * @fileoverview Lightweight performance profiler for detecting bottlenecks and memory leaks.
 * Tracks FPS, memory usage, and long tasks (>50ms operations).
 *
 * @module profiler
 * @example
 * // Start profiling with live overlay
 * Profiler.start({ overlay: true });
 *
 * // Run app for 60 seconds...
 *
 * // Stop and view report
 * Profiler.stop();
 * console.log(Profiler.report('markdown'));
 */

import { debugLog } from "./debug.js";

/**
 * Internal state tracking profiler status
 * @private
 * @type {boolean}
 */
let isRunning = false;

/**
 * Timestamp when profiling started (performance.now())
 * @private
 * @type {number}
 */
let startTime = 0;

/**
 * Collected performance metrics
 * @private
 * @typedef {Object} Metrics
 * @property {Array<{time: number, value: number}>} fps - FPS samples
 * @property {Array<{time: number, usedJSHeapSize: number, totalJSHeapSize: number}>} memory - Memory samples
 * @property {Array<{name: string, duration: number, time: number}>} longTasks - Long tasks (>50ms)
 * @property {Array} audioTicks - Audio scheduler ticks (reserved for future use)
 * @property {Array} visualUpdates - Visual render times (reserved for future use)
 */
let metrics = {
  fps: [],
  memory: [],
  longTasks: [],
  audioTicks: [],
  visualUpdates: [],
};

/**
 * Performance observer for long tasks
 * @private
 * @type {PerformanceObserver|null}
 */
let taskObserver = null;

/**
 * Performance monitoring and profiling system.
 * Auto-exposed to window for console access.
 *
 * @namespace Profiler
 * @global
 */
export const Profiler = {
  /**
   * Starts performance monitoring.
   *
   * @memberof Profiler
   * @param {Object} [config={}] - Configuration options
   * @param {boolean} [config.overlay=false] - Show real-time performance overlay
   * @returns {void}
   *
   * @example
   * // Start with overlay
   * Profiler.start({ overlay: true });
   *
   * @example
   * // Start without overlay
   * Profiler.start();
   */
  start(config = {}) {
    if (isRunning) return;

    isRunning = true;
    startTime = performance.now();
    metrics = {
      fps: [],
      memory: [],
      longTasks: [],
      audioTicks: [],
      visualUpdates: [],
    };

    startFPSMonitoring();

    if (performance.memory) {
      startMemoryMonitoring();
    }

    if (window.PerformanceObserver) {
      taskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 50) {
            metrics.longTasks.push({
              name: entry.name,
              duration: entry.duration,
              time: entry.startTime,
            });
          }
        }
      });
      taskObserver.observe({ entryTypes: ["longtask", "measure"] });
    }

    if (config.overlay) {
      createOverlay();
      startOverlayUpdates();
    }

    debugLog("timing", "🔬 Profiler started");
  },

  /**
   * Stops performance monitoring and finalizes metrics.
   *
   * @memberof Profiler
   * @returns {void}
   *
   * @example
   * Profiler.stop();
   */
  stop() {
    if (!isRunning) return;

    isRunning = false;
    stopFPSMonitoring();
    stopMemoryMonitoring();
    stopOverlayUpdates();

    if (taskObserver) {
      taskObserver.disconnect();
      taskObserver = null;
    }

    debugLog("timing", "🔬 Profiler stopped");
  },

  /**
   * Generates performance report.
   *
   * @memberof Profiler
   * @param {('json'|'markdown')} [format='json'] - Report format
   * @returns {Object|string} Performance summary object (JSON) or formatted markdown string
   *
   * @example
   * // Get JSON report
   * const report = Profiler.report('json');
   * console.log(report.fps.avg);
   *
   * @example
   * // Get Markdown report
   * const md = Profiler.report('markdown');
   * console.log(md);
   */
  report(format = "json") {
    const duration = performance.now() - startTime;
    const summary = generateSummary(metrics, duration);

    if (format === "markdown") {
      return generateMarkdownReport(summary);
    }
    return summary;
  },

  /**
   * Toggles real-time performance overlay visibility.
   * Creates overlay on first call if not started with `{ overlay: true }`.
   *
   * @memberof Profiler
   * @returns {void}
   *
   * @example
   * Profiler.toggleOverlay(); // Show
   * Profiler.toggleOverlay(); // Hide
   */
  toggleOverlay() {
    if (!overlayElement) {
      createOverlay();
      if (isRunning) {
        startOverlayUpdates();
      }
    } else {
      stopOverlayUpdates();
      removeOverlay();
    }
  },

  /**
   * Creates custom timing mark using Performance API.
   *
   * @memberof Profiler
   * @param {string} label - Mark label (used for measure() calls)
   * @returns {void}
   *
   * @example
   * Profiler.mark('operationStart');
   * // ... perform operation ...
   * Profiler.mark('operationEnd');
   * Profiler.measure('operation', 'operationStart', 'operationEnd');
   */
  mark(label) {
    performance.mark(label);
  },

  /**
   * Measures interval between two marks.
   * Results visible in Chrome DevTools Performance tab and captured as long tasks if >50ms.
   *
   * @memberof Profiler
   * @param {string} name - Measurement name (appears in performance timeline)
   * @param {string} startMark - Start mark label (from mark() call)
   * @param {string} endMark - End mark label (from mark() call)
   * @returns {void}
   *
   * @example
   * Profiler.mark('start');
   * // ... expensive operation ...
   * Profiler.mark('end');
   * Profiler.measure('myOperation', 'start', 'end');
   */
  measure(name, startMark, endMark) {
    performance.measure(name, startMark, endMark);
  },
};

// === FPS MONITORING ===

/**
 * Interval ID for FPS monitoring loop
 * @private
 * @type {number|null}
 */
let fpsInterval = null;

/**
 * Starts FPS monitoring using requestAnimationFrame.
 * Samples FPS every second and stores results in metrics.
 *
 * @private
 * @returns {void}
 */
function startFPSMonitoring() {
  let lastFrameTime = performance.now();
  let frameCount = 0;

  /**
   * Recursive frame measurement function
   * @private
   */
  function measureFrame() {
    if (!isRunning) return;

    frameCount++;
    const now = performance.now();
    const elapsed = now - lastFrameTime;

    if (elapsed >= 1000) {
      const fps = Math.round((frameCount * 1000) / elapsed);
      metrics.fps.push({ time: now, value: fps });
      frameCount = 0;
      lastFrameTime = now;
    }

    requestAnimationFrame(measureFrame);
  }

  requestAnimationFrame(measureFrame);
}

/**
 * Stops FPS monitoring (handled automatically when isRunning = false)
 * @private
 * @returns {void}
 */
function stopFPSMonitoring() {
  // Stops automatically when isRunning = false
}

// === MEMORY MONITORING ===

/**
 * Interval ID for memory sampling
 * @private
 * @type {number|null}
 */
let memoryInterval = null;

/**
 * Starts memory monitoring using performance.memory API (Chrome only).
 * Samples memory every second and stores results in metrics.
 *
 * @private
 * @returns {void}
 */
function startMemoryMonitoring() {
  memoryInterval = setInterval(() => {
    if (!isRunning) return;

    const mem = performance.memory;
    metrics.memory.push({
      time: performance.now(),
      usedJSHeapSize: mem.usedJSHeapSize,
      totalJSHeapSize: mem.totalJSHeapSize,
    });
  }, 1000);
}

/**
 * Stops memory monitoring and clears interval
 * @private
 * @returns {void}
 */
function stopMemoryMonitoring() {
  if (memoryInterval) {
    clearInterval(memoryInterval);
    memoryInterval = null;
  }
}

// === OVERLAY UI ===

/**
 * Reference to overlay DOM element
 * @private
 * @type {HTMLElement|null}
 */
let overlayElement = null;

/**
 * Interval ID for overlay updates
 * @private
 * @type {number|null}
 */
let overlayInterval = null;

/**
 * Creates real-time performance overlay UI.
 * Overlay shows FPS, memory, long tasks, and duration.
 *
 * @private
 * @returns {HTMLElement} Overlay element
 */
function createOverlay() {
  if (overlayElement) return overlayElement;

  const overlay = document.createElement("div");
  overlay.id = "profiler-overlay";
  overlay.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.85);
    color: #00ff00;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    padding: 12px;
    border-radius: 8px;
    z-index: 999999;
    min-width: 200px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    user-select: none;
  `;

  overlay.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 8px; color: #ffff00;">⚡ Performance Monitor</div>
    <div id="profiler-fps">FPS: --</div>
    <div id="profiler-memory">Memory: --</div>
    <div id="profiler-longtasks">Long Tasks: 0</div>
    <div id="profiler-duration" style="margin-top: 8px; color: #aaa;">Duration: 0s</div>
  `;

  document.body.appendChild(overlay);
  overlayElement = overlay;
  return overlay;
}

/**
 * Updates overlay UI with latest metrics.
 * Color-codes FPS (green=good, yellow=warning, red=critical).
 *
 * @private
 * @returns {void}
 */
function updateOverlay() {
  if (!overlayElement || !isRunning) return;

  const fpsEl = document.getElementById("profiler-fps");
  const memEl = document.getElementById("profiler-memory");
  const tasksEl = document.getElementById("profiler-longtasks");
  const durationEl = document.getElementById("profiler-duration");

  // FPS
  if (metrics.fps.length > 0) {
    const latestFPS = metrics.fps[metrics.fps.length - 1].value;
    const color =
      latestFPS >= 58 ? "#00ff00" : latestFPS >= 50 ? "#ffff00" : "#ff0000";
    fpsEl.innerHTML = `FPS: <span style="color: ${color}; font-weight: bold;">${latestFPS}</span>`;
  }

  // Memory
  if (metrics.memory.length > 0) {
    const latestMem = metrics.memory[metrics.memory.length - 1];
    const usedMB = (latestMem.usedJSHeapSize / 1048576).toFixed(1);
    memEl.innerHTML = `Memory: <span style="color: #00aaff;">${usedMB} MB</span>`;
  } else {
    memEl.innerHTML = 'Memory: <span style="color: #666;">N/A</span>';
  }

  // Long Tasks
  const taskCount = metrics.longTasks.length;
  const taskColor =
    taskCount === 0 ? "#00ff00" : taskCount < 5 ? "#ffff00" : "#ff0000";
  tasksEl.innerHTML = `Long Tasks: <span style="color: ${taskColor};">${taskCount}</span>`;

  // Duration
  const duration = ((performance.now() - startTime) / 1000).toFixed(1);
  durationEl.textContent = `Duration: ${duration}s`;
}

/**
 * Starts overlay update interval (500ms refresh rate)
 * @private
 * @returns {void}
 */
function startOverlayUpdates() {
  if (overlayInterval) return;
  overlayInterval = setInterval(updateOverlay, 500);
}

/**
 * Stops overlay updates and clears interval
 * @private
 * @returns {void}
 */
function stopOverlayUpdates() {
  if (overlayInterval) {
    clearInterval(overlayInterval);
    overlayInterval = null;
  }
}

/**
 * Removes overlay from DOM
 * @private
 * @returns {void}
 */
function removeOverlay() {
  if (overlayElement) {
    overlayElement.remove();
    overlayElement = null;
  }
}

// === REPORT GENERATION ===

/**
 * Generates performance summary from collected metrics.
 *
 * @private
 * @param {Metrics} metrics - Collected metrics object
 * @param {number} duration - Profiling duration in milliseconds
 * @returns {Object} Performance summary
 */
function generateSummary(metrics, duration) {
  return {
    duration: duration.toFixed(2) + "ms",
    fps: {
      avg: average(metrics.fps.map((f) => f.value)).toFixed(1),
      min: Math.min(...metrics.fps.map((f) => f.value)),
      max: Math.max(...metrics.fps.map((f) => f.value)),
      samples: metrics.fps.length,
    },
    memory:
      metrics.memory.length > 0
        ? {
            avgHeapUsed:
              (
                average(metrics.memory.map((m) => m.usedJSHeapSize)) / 1048576
              ).toFixed(2) + " MB",
            peakHeapUsed:
              (
                Math.max(...metrics.memory.map((m) => m.usedJSHeapSize)) /
                1048576
              ).toFixed(2) + " MB",
          }
        : null,
    longTasks: {
      count: metrics.longTasks.length,
      total:
        metrics.longTasks.reduce((sum, t) => sum + t.duration, 0).toFixed(2) +
        "ms",
      worst:
        metrics.longTasks.length > 0
          ? {
              name: metrics.longTasks.sort((a, b) => b.duration - a.duration)[0]
                .name,
              duration: metrics.longTasks[0].duration.toFixed(2) + "ms",
            }
          : null,
    },
  };
}

/**
 * Generates markdown-formatted performance report.
 *
 * @private
 * @param {Object} summary - Performance summary object
 * @returns {string} Markdown-formatted report
 */
function generateMarkdownReport(summary) {
  return `
# Performance Report

**Duration**: ${summary.duration}

## FPS
- **Average**: ${summary.fps.avg}
- **Min**: ${summary.fps.min}
- **Max**: ${summary.fps.max}
- **Samples**: ${summary.fps.samples}

## Memory
${
  summary.memory
    ? `
- **Avg Heap Used**: ${summary.memory.avgHeapUsed}
- **Peak Heap Used**: ${summary.memory.peakHeapUsed}
`
    : "_Not available in this browser_"
}

## Long Tasks (>50ms)
- **Count**: ${summary.longTasks.count}
- **Total Time**: ${summary.longTasks.total}
${
  summary.longTasks.worst
    ? `- **Worst**: ${summary.longTasks.worst.name} (${summary.longTasks.worst.duration})`
    : ""
}
  `.trim();
}

/**
 * Calculates average of numeric array.
 *
 * @private
 * @param {number[]} arr - Array of numbers
 * @returns {number} Average value (0 if empty array)
 */
function average(arr) {
  return arr.reduce((sum, val) => sum + val, 0) / arr.length || 0;
}

// === GLOBAL EXPOSURE ===

/**
 * Expose Profiler to window for console access
 * @global
 */
if (typeof window !== "undefined") {
  window.Profiler = Profiler;
}
