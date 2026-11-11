# OpenTimbre — Open Source Acoustic Instrument Platform

## Mission
Build a reusable, legally redistributable sample-library ecosystem for oud, saz/bağlama and other instruments, with a browser studio, TypeScript SDK, SFZ export, and microtonal playback. The first release is a working MVP, not a mockup.

## Components
1. **Sample library**: WAV recordings, JSON manifests, SFZ instruments, provenance and licenses.
2. **Web Studio**: React/TypeScript application for importing, inspecting, tagging, mapping, previewing and exporting samples.
3. **Playback SDK**: sample selection, velocity layers, round robin, cents offsets, scheduling, mixing, and offline WAV export.
4. **CLI**: validate instrument packs and generate SFZ files.

## Initial scope
Oud and saz are first-class instruments. Use a small **synthetic demo pack** generated locally for development only; it must be clearly labelled synthetic, never represented as a recorded instrument. Users supply genuine recordings. Include a demo song with 2 tracks and a custom tuning example.

## Quick start target
```bash
corepack enable
pnpm install
pnpm dev
pnpm test
pnpm build
```
Document Node LTS requirements in the actual repository. Provide `docker compose up --build` for the web studio. No credentials or paid APIs required.

## Specifications index
- [Product requirements](01-PRODUCT-REQUIREMENTS.md)
- [Architecture](02-ARCHITECTURE.md)
- [Data model](03-DATA-MODEL.md)
- [Audio engine](04-AUDIO-ENGINE.md)
- [Recording protocol](05-RECORDING-PROTOCOL.md)
- [Studio UX](06-STUDIO-UX.md)
- [API and SDK](07-API-SDK.md)
- [MIDI and tuning](08-MIDI-MICROTONAL.md)
- [Licensing](09-LICENSING.md)
- [Testing and acceptance](10-TESTING-ACCEPTANCE.md)
- [Delivery plan](11-IMPLEMENTATION-PLAN.md)
- [Claude implementation prompt](CLAUDE.md)
- [Task backlog](12-BACKLOG.md)

## Design principles
No false claims of sound realism; use real multi-samples when provided. Avoid hard-coded makam tuning assumptions. Do not bundle third-party samples unless redistribution rights are documented. Keep the format independent of the runtime.
