/**
 * @fileoverview Audio scheduler for groove patterns.
 * Generates procedural Kick, Snare, and Hi-Hat sounds.
 * @module patternScheduler
 */

import { ensureAudio, isMuted } from "./audioProfiles.js";
import { getSampleBuffer } from "./sampleLoader.js";

let _activePattern = null;
let _stepCount = 0;

export const patternScheduler = {
  load(patternObj) {
    _activePattern = patternObj;
    if (patternObj) {
      const ts = patternObj.patternTimeSignature || { beats: 4 };
      const ticks = patternObj.ticksPerBeat || 1;
      const measures = patternObj.measures || 1;
      _stepCount = ts.beats * ticks * measures;
    }
  },

  clear() {
    _activePattern = null;
    _stepCount = 0;
  },

  isActive() {
    return _activePattern !== null;
  },

  /**
   * Returns hit data for a specific track and step.
   * @param {string} track - hihat, kick, snare, or HHPed
   * @param {number} step - The absolute step index in the pattern
   * @returns {number} 1 for hit, 0 for rest
   */
  getStepData(track, step) {
    if (!_activePattern || !_activePattern.patterns[track]) return 0;
    return _activePattern.patterns[track][step] || 0;
  },

  /**
   * Called on every metronome tick.
   * @returns {boolean} True if audio was handled (suppress standard tick)
   */
  onTick(tickIndex, time) {
    if (!_activePattern || _stepCount === 0) return false;

    if (isMuted()) return true; // Suppress audio if muted, but still return true to keep metronome silent

    const audioCtx = ensureAudio();
    const currentStep = tickIndex % _stepCount;
    const p = _activePattern.patterns;

    // Trigger Samples
    if (p.hihat?.[currentStep]) this._playSample(audioCtx, "hihat", time);
    if (p.kick?.[currentStep]) this._playSample(audioCtx, "kick", time);
    if (p.snare?.[currentStep]) this._playSample(audioCtx, "snare", time);
    if (p.HHPed?.[currentStep]) this._playSample(audioCtx, "HHPed", time);

    return true;
  },

  _playSample(ctx, key, time) {
    const buffer = getSampleBuffer(key);
    if (!buffer) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(time);
  },
};
