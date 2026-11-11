# SDK and CLI Contracts

## TypeScript example
```ts
import { createAudioEngine, type Song, type InstrumentManifest } from '@opentimbre/web-audio';
const engine = await createAudioEngine({ audioContext: new AudioContext() });
await engine.loadInstrument(manifest as InstrumentManifest, async path => fetch(`/packs/oud/${path}`).then(r => r.arrayBuffer()));
await engine.resumeFromUserGesture();
const voice = engine.noteOn({ instrumentId: manifest.id, midiNote: 57, velocity: 88, centsOffset: -30, articulation: 'normal' });
engine.noteOff(voice);
const wav = await engine.renderSong(song as Song, { sampleRate: 48000, tailSeconds: 2 });
```
This is a **target API contract**, not code that exists yet. The implementation must use typed errors, disposal methods and an explicit audio unlock lifecycle.

## Packages
- `@opentimbre/core`: data types, validation, sample selection, tuning math.
- `@opentimbre/web-audio`: decoding, voice management, scheduling and rendering.
- `@opentimbre/react`: hooks for instrument/player state.
- `@opentimbre/sfz`: deterministic SFZ generation.
- `@opentimbre/cli`: commands and diagnostics.

## CLI
```bash
opentimbre validate ./instruments/oud
opentimbre sfz ./instruments/oud --out ./dist/oud.sfz
opentimbre pack ./instruments/oud --out ./dist/oud-pack.zip
```
CLI must return non-zero on invalid manifests and include machine-readable `--json` diagnostics. Export files deterministically (stable ordering, no absolute paths). Add checksums and reproducibility tests.

## Compatibility
ESM-first builds, exported type declarations, Node LTS support for CLI, modern Chrome/Firefox/Safari for web. Do not bundle samples into npm packages; distribute instrument packs separately.
