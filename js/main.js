// main.js - simple bootstrap that wires modules together
import * as metronome from './metronomeCore.js';
import { createVisualCallback } from './visuals.js';
import { initUI } from './uiController.js';
import * as utils from './utils.js';

// register visuals (pass the getter so visuals can read beatsPerBar)
metronome.registerVisualCallback(createVisualCallback(metronome.getBeatsPerBar));

// init UI with metronome functions
initUI({
  startMetronome: metronome.startMetronome,
  stopMetronome: metronome.stopMetronome,
  setBeatsPerBar: metronome.setBeatsPerBar,
  getBeatsPerBar: metronome.getBeatsPerBar,
  getBpm: metronome.getBpm // <-- fixed key name
});

// optional console version log (update as you bump the version)
console.info("Random Groove Trainer v1.0.4 — Cached Offline");