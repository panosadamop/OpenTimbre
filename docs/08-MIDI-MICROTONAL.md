# MIDI, Microtonality and Makam

## Canonical pitch
Use MIDI note number + signed cents offset. Frequency formula: `f = referenceA4 * 2 ** ((midi - 69 + cents / 100) / 12)`. Store reference frequency in tuning metadata.

## Scale models
- 12-TET default.
- 24-TET generic equal-quarter-tone preset (not equivalent to every makam).
- User-defined cents per scale degree or absolute MIDI pitch.
- Scala `.scl` parsing with documented handling of ratios/cents and octave; `.kbm` keyboard mapping as P1.
- Named makam templates only with clear provenance, version and editorial disclaimer; users can modify degrees.

## MIDI compatibility
- MIDI 1.0 note events do not carry arbitrary per-note cents.
- For MIDI export, allow standard note-only export with warning, or MPE/pitch-bend-per-channel strategy where compatible. Validate bend range and channel allocation; avoid bends affecting unrelated simultaneous notes.
- Retain microtonal fidelity in native Song JSON and rendered WAV.
- Imported MIDI defaults to 12-TET unless explicit mapping supplied.

## Timing
Song events use quarter-note beat units. Convert beats to seconds with tempo map; MVP supports constant BPM. Ensure simultaneous events and note overlaps remain deterministic.

## Tests
Verify A4=440 Hz, A4 + 50 cents, -35 cents offset, round-trip Scala parsing, conflicting MPE channel allocation and export warnings.
