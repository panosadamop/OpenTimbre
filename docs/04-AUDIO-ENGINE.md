# Audio Engine Specification

## Core algorithm
1. Resolve track instrument and articulation; fallback to `normal` only if configured.
2. Filter samples by MIDI key range and velocity range.
3. Prefer matching string/course when explicitly requested.
4. Choose nearest root pitch, subject to max repitch distance; never silently choose an unrelated articulation.
5. Cycle through round-robin takes for a compatible group; deterministic seed option for offline render.
6. Compute playbackRate = 2^(((eventMidi-rootMidi)*100 + eventCentsOffset-rootCents)/1200).
7. Schedule start/stop, attack/release envelope, per-note gain, track gain/pan.
8. Respect instrument-specific release behavior: plucked instruments ring naturally, note-off may damp only when selected; do not loop decay samples by default.

## API behavior
- `prepareInstrument(manifest, sampleResolver)` resolves and decodes needed buffers.
- `noteOn(event, whenSeconds)` returns a voice handle; `noteOff(handle, whenSeconds)` supports damping/release.
- `playSong(song, startTime)` schedules events with transport controls.
- `renderSong(song, options)` returns WAV Blob/Uint8Array, supports sample rate and tail seconds.
- `stopAll()` ramps voices to zero safely.

## Quality requirements
- No audible clicks on manual stop or retrigger; use short ramps.
- Support at least 32 simultaneous voices on a normal desktop browser, with graceful voice stealing and metrics.
- Handle absent sample gracefully and expose warning in UI.
- Playback speed changes also change sample duration/timbre; document limitation. High-quality independent time stretching is deferred.
- Offline renderer uses identical selection and gain rules as realtime engine; compare event timing in tests.
- Use a WAV encoder that writes correct RIFF chunks and byte lengths; test mono and stereo.

## SFZ export subset
Generate `sample`, `lokey`, `hikey`, `pitch_keycenter`, `lovel`, `hivel`, `seq_length`, `seq_position`, `volume`, and `ampeg_release` where appropriate. SFZ round-robin support depends on target sampler; validate on at least one real SFZ engine. Microtonal cents are stored in the JSON manifest and song event format; they are **not automatically portable** via plain SFZ/MIDI 1.0.
