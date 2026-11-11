# Data Model and JSON Contracts

## Instrument manifest (version 1)
```json
{
  "schemaVersion": 1,
  "id": "org.example.oud.demo",
  "name": "Oud Demo",
  "instrumentType": "oud",
  "version": "0.1.0",
  "author": "Example Author",
  "license": "CC0-1.0",
  "recording": {"sampleRateHz": 48000, "bitDepth": 24, "channels": 1, "microphone": "unspecified"},
  "tuning": {"name": "recording tuning", "courses": [], "referenceA4Hz": 440},
  "samples": [
    {"id":"oud-a3-mf-rr1","path":"samples/oud-a3-mf-rr1.wav","sha256":"<64 hex characters>","rootMidi":57,"rootCents":0,"lowMidi":56,"highMidi":58,"velocityLow":41,"velocityHigh":90,"articulation":"normal","roundRobinGroup":"a3-mf","roundRobinIndex":1,"stringId":null,"position":null,"gainDb":0,"trimStartMs":0,"trimEndMs":null}
  ]
}
```
The example is illustrative and contains no actual audio asset. A real manifest MUST contain a valid hash. Use JSON Schema and runtime validation (e.g. Zod) with identical semantics.

## Song JSON
```json
{
  "schemaVersion": 1,
  "title": "Demo Song",
  "bpm": 90,
  "timeSignature": [4,4],
  "tracks": [
    {"id":"t1","instrumentId":"org.example.oud.demo","gainDb":0,"pan":0,"events":[{"id":"n1","midiNote":57,"startBeat":0,"durationBeats":1,"velocity":85,"centsOffset":-25,"articulation":"normal"}]}
  ]
}
```

## Semantics
- MIDI note numbers use middle C = 60; pitch = 440 * 2^((midi-69+cents/100)/12).
- `rootCents` is the measured deviation of a recorded sample from its nominal MIDI pitch; do not confuse with event `centsOffset`.
- `startBeat` is quarter-note beats; 0-based; `durationBeats` > 0.
- `pan` ranges -1..1; `velocity` 1..127; sample velocity bands must not overlap within the same articulation/root/round-robin grouping unless explicitly configured.
- Path must be pack-relative POSIX path with no `..`, leading slash, drive prefix or URL.
- Hashes and author/license are mandatory for distributable packs.
- Store optional performance metadata: pick direction, string/course, fret, damping, recording session, take, notes.

## Versioning
Use semantic versions for packs, integer `schemaVersion` for file formats, migration functions and fixture tests. Unknown future schema versions fail with an actionable message.
