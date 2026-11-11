# Delivery Plan

## Milestone M0 — Foundation
Monorepo, strict TS, formatting, CI, Vite/React app, packages, README, sample schema, synthetic fixture generator. Exit: clean install/build/test.

## Milestone M1 — Playable Engine
Sample selection, decoding, voice lifecycle, polyphony, envelopes, pitch offsets, keyboard, audio unlock. Exit: 12-sample synthetic fixture plays from UI; unit tests pass.

## Milestone M2 — Pack Studio
WAV import, waveform analysis, metadata editor, IndexedDB persistence, pack export/import, validation. Exit: restart browser and recover pack.

## Milestone M3 — Composition and Export
Song JSON, multi-track transport, scheduling, offline WAV render, SFZ export, CLI validation. Exit: demo song plays and renders reproducibly.

## Milestone M4 — Traditional Instrument Fidelity
Real oud/saz recording sessions, quality review, round robin, articulations, string/course mapping, custom tuning and Scala import. Exit: musician-reviewed instrument packs with documented rights.

## Milestone M5 — Release
E2E, accessibility, packaging, Docker, documentation, GitHub CI, release artifacts and public demos. Exit: fresh clone and reproducible release.

## Implementation rules
Each milestone ends with working code, tests, screenshots or CLI output, known limitations and next tasks. Do not skip validation to accelerate UI. Keep scope explicit; prioritize an end-to-end thin slice before adding advanced features.
