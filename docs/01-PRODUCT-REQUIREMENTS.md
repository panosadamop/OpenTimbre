# Product Requirements (PRD)

## Users
- Recording musicians creating sample packs.
- Composers previewing generated songs with natural instrument sounds.
- Developers embedding the SDK in web apps.
- DAW users importing SFZ packs.

## MVP features (P0)
- Create/open an instrument pack with name, author, instrument family, tuning, license and version.
- Import local WAV files using browser file picker/drag and drop; inspect waveform, duration, channels, sample rate and peak level.
- Tag samples by root MIDI note, key range, velocity range, articulation, string/course, fret/position and round-robin index.
- Display playable keyboard with note-on/off, velocity and cents controls; allow user gesture to unlock AudioContext.
- Play sequences defined as JSON note events, including multiple tracks, tempo and timeline transport.
- Instrument engine chooses an eligible sample by pitch, velocity, articulation and round-robin; nearest-root repitch only as fallback, with configurable maximum semitone distance.
- Import/export instrument manifest JSON and generate SFZ v1-compatible mapping for core note/velocity/round-robin features.
- Export mixed composition as WAV offline with audible tails and correct duration.
- Local-first persistence via IndexedDB for project metadata and audio blobs; explicit import/export backup.
- Error states for missing files, invalid manifests, unsupported codecs and audio initialization.
- Responsive, keyboard-accessible UI, Greek and English strings.

## P1
- MIDI file import/export, per-note cents and scale mapping; Scala .scl import; optional .kbm mapping.
- Instrument pack browser, multiple articulations, release samples, pedal or string-specific behaviors.
- Batch sample processing with non-destructive trim, fade and normalization preview.
- CLI pack validation and reproducible SFZ generation.

## P2
- Desktop integration, plugin-host integration, advanced articulations and physical-model hybrid sound.
- Collaborative publishing and public pack registry (requires service infrastructure and moderation).
- AI-assisted tagging (explicit opt-in, never invent labels without confirmation).

## Non-goals for MVP
- DAW VST3/AU plugin binaries; guaranteed exact reproduction of all SFZ extensions; AI music generation; MP3 encoding; cloud account system; mobile native applications.

## Acceptance criteria
A user can import 12 WAV files, map them to notes and velocities, save/reopen a project, play a 2-track song with microtonal note offsets, render a WAV, export a portable pack and load its SFZ in a compatible external sampler. No sample data is silently uploaded.
