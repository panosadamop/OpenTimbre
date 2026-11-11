# Architecture and Repository Layout

## Stack
- TypeScript strict mode, pnpm workspaces, Vite, React, accessible component primitives, Vitest, Playwright.
- Web Audio API for precise sample-buffer playback; Tone.js optional for transport, but the core must not depend on Tone-specific sample mapping.
- IndexedDB for local projects; audio decoding in browser via AudioContext.decodeAudioData.
- Node CLI for filesystem validation, SFZ generation and packaging.
- Optional native sfizz integration in a later phase, with its license and deployment constraints evaluated separately.

## Monorepo
```
apps/studio/
packages/core/                 # pure model, selection and scheduling logic
packages/web-audio/            # AudioContext playback and OfflineAudioContext render
packages/react/                # React hooks and UI adapters
packages/sfz/                  # SFZ generator and subset parser
packages/midi/                 # MIDI translation, optional dependency
packages/cli/                  # validate / generate-sfz / pack
instruments/demo-synthetic/    # clearly marked synthetic fixtures
examples/embedded-player/
docs/
```

## Data flow
WAV import -> decoder -> analysis/metadata -> instrument manifest -> selector -> voice scheduler -> Web Audio mixer -> speakers/offline WAV.

## Architecture boundaries
- Core selection logic is pure and testable without browser APIs.
- Browser-specific code lives only in web-audio and studio.
- Instrument JSON manifest is canonical; SFZ is a generated distribution artifact.
- Persist projects with schema version; migrations required for breaking changes.
- Separate metadata from binary samples; content-addressed hashes detect missing or duplicate assets.
- Never read or write arbitrary server filesystem paths from user-supplied manifests.

## Playback
Per-voice AudioBufferSourceNode -> GainNode envelope -> per-track gain/pan -> master bus -> destination. Create a new AudioBufferSourceNode per trigger. Schedule with AudioContext.currentTime; use a lookahead scheduler for timeline events. Track voices for stop/all-notes-off and polyphony limits.

## Security/performance
Validate file type by content, enforce import limits and user-visible warnings, sanitize names and relative paths, prevent zip-slip on pack import, never eval manifest fields. Cache decoded buffers with configurable memory budget and LRU policy. Defer loading non-required samples. Add cross-origin isolation only if truly needed.
