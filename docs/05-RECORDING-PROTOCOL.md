# Recording and Sample Production Protocol

## Setup
- Record genuine instruments dry, with no reverb, delay or compression baked in unless the pack explicitly documents it.
- Prefer WAV PCM 48 kHz / 24-bit; retain unprocessed masters and session metadata.
- Quiet room, stable microphone distance and angle, consistent input gain, no clipping.
- Record tuning/reference frequency and instrument configuration (oud courses or saz string groups).

## Capture matrix
- MVP: 12–24 representative pitches per instrument, 2–3 velocity layers, 2 round-robin takes.
- Full pack target: chromatic or musically meaningful note coverage, 3 velocity layers, 3+ round robins, special articulations as separate sets.
- Record each note with complete natural decay and adequate silence; capture downstroke/upstroke when relevant.
- For saz, note course and fret position; for fretless oud, record actual microtonal notes and ornamentation when feasible.
- Do not claim a specific sample count guarantees realism: validate musical passages by listening.

## Processing
1. Name original takes using instrument, course, MIDI note, velocity, articulation and take.
2. Remove DC offset and trim pre-roll conservatively without removing pick transient.
3. Apply short fades only where needed; preserve decay tails.
4. Analyze pitch, RMS/LUFS, peak, duration, noise floor; human-verify pitch.
5. Normalize conservatively and consistently; preserve intended differences between velocity layers.
6. Export derived WAV and metadata; calculate SHA-256; store original masters separately.
7. Listen for clicks, clipping, phase issues, unnatural re-pitching and noise.

## Naming example
`oud_course2_midi57_v2_normal_rr02.wav`

## Publication checklist
Written consent from performer/recordist; instrument and recording details; license and attribution; complete manifest; hashes; audio QA report; redistribution rights confirmed.
