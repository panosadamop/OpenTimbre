# Quality, Testing and Definition of Done

## Automated
- Unit: pitch/cents math, sample selection, RR sequencing, velocity boundaries, invalid ranges, schema migration.
- Property-based: valid MIDI 0..127, cents offsets, monotonic pitch changes and no NaNs.
- Integration: import WAV, persist/reopen, decode, noteOn/off, missing sample, SFZ generation, deterministic ZIP.
- Audio: WAV header validity, rendered duration including tail, stereo channel correctness, peak clipping detection, timing tolerance.
- E2E Playwright: import fixture, edit map, audition, save/reload, render WAV, export SFZ pack, switch locale.
- Accessibility: axe automated checks and manual keyboard/screen-reader smoke tests.

## Test fixtures
Small locally generated **synthetic** WAV notes and deterministic expected JSON; never confuse fixtures with real instrument samples.

## Manual listening QA
With real oud/saz recordings, listen to scales, repeated notes, rapid phrases, microtonal intervals, staccato and sustained decays. Check attack preservation, unnatural pitch shifting, stuck notes and pops.

## Performance targets
At least 32 voices on a typical desktop browser; startup and import progress indicators; no long main-thread blocking on large sample imports. Measure and report actual browser/device performance rather than asserting it.

## Definition of Done
`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, E2E tests pass. README commands work on a clean machine. No hard-coded secrets. License and attribution tests pass. UI has no dead controls or placeholder functionality represented as complete.
