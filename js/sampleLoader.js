/**
 * @fileoverview Logic for loading and decoding WAV drum samples.
 * @module sampleLoader
 */

import { ensureAudio } from "./audioProfiles.js";
import { debugLog } from "./debug.js";

const SAMPLE_PATH = "./assets/audio/";
const SAMPLES = {
  kick: "kick.wav",
  snare: "snare.wav",
  hihat: "hh_closed.wav",
  HHPed: "hh_pedal.wav",
  xstick: "snare_xstick.wav",
};

const _bufferCache = {};

/**
 * Loads all drum samples into memory.
 *
 * If no context is provided, it just fetches the data to be decoded later.
 * @returns {Promise<void>}
 */
export async function loadDrumSamples() {
  const keys = Object.keys(SAMPLES);

  const loadTasks = keys.map(async (key) => {
    try {
      const response = await fetch(`${SAMPLE_PATH}${SAMPLES[key]}`);
      const arrayBuffer = await response.arrayBuffer();

      const ctx = ensureAudio();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      _bufferCache[key] = audioBuffer;
      debugLog("audio", `✅ Sample Loaded: ${key}`);
    } catch (e) {
      console.error(`❌ Failed to load sample [${key}]:`, e);
    }
  });

  await Promise.all(loadTasks);
}

/**
 * Returns the cached AudioBuffer for a specific instrument.
 */
export function getSampleBuffer(key) {
  return _bufferCache[key] || null;
}
