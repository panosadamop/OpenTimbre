# OpenTimbre developer and extension guide

## Packages
- `packages/core`: instrument/song types, sample selection, pitch conversion.
- `packages/core/src/midi.ts`: minimal standard MIDI file reader/writer for basic note events. No pitch bend or tempo map preservation.
- `packages/core/src/tunings.ts`: pitch-class cents presets. Illustrative, not musicological definitions of makams.
- `packages/sfz`: basic SFZ region export. No comprehensive opcode coverage.
- `apps/studio`: React interface, browser audio, IndexedDB storage.
- `tools/generate-fixtures.mjs`: creates synthetic test samples.

## Local development
Node 22+, `npm install && npm run fixtures && npm run dev`. `npm test` runs available fixture checks. `npm run build` runs TypeScript checking and Vite production bundling. Docker is optional.

## Data contracts
Instrument JSON uses `schemaVersion:1`, `id`, `name`, `description`, `license`, and `samples[]` with `path`, `root`, `rootCents`, `lo`, `hi`, `velocityMin`, `velocityMax`, `roundRobin`, `articulation`. Song JSON uses `title`, `bpm`, and `notes[]` containing `midi`, `start`, `duration`, `velocity`, `cents`. Times are seconds.

## Production hardening backlog
Add schema validation, storage migrations, quota monitoring, sample packaging, MIDI tempo-map/pitch-bend support, real-time articulation selection, advanced SFZ compliance, integration/e2e tests, accessibility review, and security audit. Avoid labeling demo tones as authentic recordings.
