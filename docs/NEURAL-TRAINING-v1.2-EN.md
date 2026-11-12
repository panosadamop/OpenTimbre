# OpenTimbre v1.2 — Microtonal & Articulation Conditioned Training

The Recording Assistant stores `midi`, `cents`, `velocity`, and `articulation`. Training reads linked private library WAV files and conditions a 10-input harmonic MLP on MIDI, velocity, relative time, cents, and six one-hot articulations. The Generator exposes cents and six articulation choices. Existing v1 model checkpoints remain loadable.

**Limitations:** This is an experimental harmonic model, not realistic neural instrument cloning. No audio-based articulation detection, glissando trajectory synthesis, training job queue, or production-grade resource limits. Unrepresented notes/articulations are extrapolations.
