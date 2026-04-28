/**
 * @fileoverview Audio scheduler for groove patterns.
 * Generates procedural Kick, Snare, and Hi-Hat sounds.
 * @module patternScheduler
 */

import { ensureAudio } from "./audioProfiles.js";

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
   * Called on every metronome tick.
   * @returns {boolean} True if audio was handled (suppress standard tick)
   */
  onTick(tickIndex, time) {
    if (!_activePattern || _stepCount === 0) return false;

    const audioCtx = ensureAudio();
    const currentStep = tickIndex % _stepCount;
    const p = _activePattern.patterns;
    let playedSomething = false;

    // Hi-Hat (Filtered Square)
    if (p.hihat?.[currentStep]) {
      this._playHH(audioCtx, time, 0.05); // Short decay
      playedSomething = true;
    }

    // Kick (Sine Sweep 60Hz -> 30Hz)
    if (p.kick?.[currentStep]) {
      this._playKick(audioCtx, time);
      playedSomething = true;
    }

    // Snare (White Noise)
    if (p.snare?.[currentStep]) {
      this._playSnare(audioCtx, time);
      playedSomething = true;
    }

    // Hi-Hat Pedal (Filtered Square, longer)
    if (p.HHPed?.[currentStep]) {
      this._playHH(audioCtx, time, 0.2); // Longer wash
      playedSomething = true;
    }

    // High-frequency "playhead" highlight handled by grooveEditor.js via DOM
    return playedSomething;
  },

  _playKick(ctx, time) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(60, time);
    osc.frequency.exponentialRampToValueAtTime(30, time + 0.1);
    gain.gain.setValueAtTime(0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.15);
  },

  _playSnare(ctx, time) {
    const bufferSize = ctx.sampleRate * 0.1;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 1000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start(time);
  },

  _playHH(ctx, time, decay) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = "square";
    filter.type = "highpass";
    filter.frequency.value = 8000;
    gain.gain.setValueAtTime(0.2, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + decay);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + decay);
  },
};
