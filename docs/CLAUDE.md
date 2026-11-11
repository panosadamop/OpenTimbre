# CLAUDE — Autonomous Implementation Instructions

You are a principal full-stack TypeScript engineer, audio DSP engineer and open-source maintainer. Implement **OpenTimbre**, a production-minded local-first sample library studio and SDK, using the specification files in this directory as the authoritative requirements.

## First actions
1. Read README.md and every numbered specification. Summarize key decisions and resolve ambiguities conservatively in `docs/DECISIONS.md`.
2. Inspect the repository before changing files. If empty, create the pnpm monorepo described in `02-ARCHITECTURE.md`.
3. Build the smallest end-to-end working path: generate synthetic WAV fixture -> create manifest -> load in web engine -> play keyboard -> render short song -> download WAV -> generate SFZ.
4. Implement the remaining P0 requirements in milestone order, testing continuously.

## Hard constraints
- Implement **working code**, not a design-only scaffold. No fake audio, inert buttons, mock backend masquerading as production or placeholder screens.
- The synthetic fixture pack is for tests/demos only; NEVER label it a natural oud or saz recording.
- Use TypeScript strict mode, functional React, browser Web Audio API and pnpm workspaces. Keep DSP selection logic independent of React.
- Avoid paid APIs, credentials, external sample downloads and undisclosed network calls.
- Instrument JSON is canonical; generate SFZ from it. Do not claim full SFZ compatibility beyond implemented subset.
- Correctly implement per-note cents, recorded root cents, velocity layers, round robin and polyphony.
- Respect licensing; no third-party sample bundling without documented redistribution permission.
- Provide English and Greek UI, accessible keyboard controls and meaningful errors.
- Persist projects locally and make export/import backups available.
- Ensure ZIP extraction rejects traversal paths and malicious manifests.

## Deliverables
- Complete source tree, package scripts and lockfile.
- React Studio with pack manager, WAV import, mapper, keyboard, song timeline, tuning lab and export screen.
- Core/web-audio/sfz/cli packages with public typed APIs.
- Valid JSON Schema, sample manifest examples, synthetic fixture generator.
- Unit, integration, audio and Playwright E2E tests.
- Dockerfile, docker-compose.yml, GitHub Actions CI.
- README with macOS/Linux/Windows installation, troubleshooting and local development instructions.
- `docs/DECISIONS.md`, `docs/IMPLEMENTATION-STATUS.md`, `docs/KNOWN-LIMITATIONS.md`.
- MIT code LICENSE and sample licensing/provenance templates.

## Workflow
After each milestone: run install (if needed), lint, typecheck, unit tests and build; run browser E2E when available; fix failures before moving on. Maintain a truthful checklist of implemented versus pending features. When unable to execute a test, say exactly why and provide the command.

## Definition of success
A developer can clone the repository, run `pnpm install && pnpm dev`, open the app, import or use synthetic WAV fixtures, map notes, audition an instrument, load a song JSON, hear a multi-track arrangement with per-note microtonal offsets, export WAV and SFZ, close/reopen the project, and run tests successfully.

## Start now
Implement milestone M0 and M1 fully, then continue through M2–M3 without waiting for approval unless a decision materially affects security, legal rights, or architecture. Do not ask broad questions already answered by the specs. Explain any unavoidable tradeoffs and prioritize a functioning MVP.
