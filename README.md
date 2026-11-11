# OpenTimbre Studio 0.2.0

Open-source, local-first instrument sample mapping and playback studio. React + TypeScript + Web Audio. Includes **synthetic demo** only; import your own oud, saz, or other WAV recordings.

## Quick start

Requires Node.js 22+.

```bash
npm install
npm run fixtures
npm run dev
```

Open http://localhost:5173. To test: `npm test`. To build: `npm run build`. Docker: `docker compose up --build`, then http://localhost:8080.

## Manuals
- [Ελληνικό εγχειρίδιο](docs/manual/USER-MANUAL-EL.md)
- [English user manual](docs/manual/USER-MANUAL-EN.md)
- [Ελληνικός οδηγός ανάπτυξης](docs/manual/DEVELOPER-GUIDE-EL.md)
- [English developer guide](docs/manual/DEVELOPER-GUIDE-EN.md)

## Implemented
- WAV sample import, note/velocity mapping and sample audition
- Microtonal cents adjustment and illustrative tuning presets
- Song event editing, MIDI import/export for basic note events
- Offline WAV rendering and JSON/SFZ export
- Browser-local IndexedDB workspace save/restore
- English/Greek navigation switch and bilingual detailed manuals

## Known limitations
- No built-in real oud/saz recordings, no direct microphone recording UI, no sample ZIP bundling.
- MIDI does not encode per-note cents/pitch bends; use Song JSON and WAV for microtonal fidelity.
- SFZ export is a basic subset; paths must be reconstructed with WAV files.
- Browser-local storage is not a backup; export your work and keep original WAV files.
- Advanced DAW functions, full i18n, complete sample validation and production hardening remain future work.

Software MIT; audio recordings are separately licensed by their respective owners. Do not redistribute third-party samples without permission.

## In-app manuals / Ενσωματωμένα εγχειρίδια
Open the **Guide / Οδηγός** page and select User Manual or Developer Guide. The displayed document follows the app's English/Greek language toggle. Use the search field, section contents, and Markdown download button. Documents are served locally from `public/manual/`, without any external service.


## Sources & Synthesis (new)
Open **Sources & Synthesis** to save external library references, inspect OpenTimbre-compatible HTTPS/GitHub `instrument.json` manifests, compare root-note coverage and import manifest metadata. GitHub repository lookup expects `instrument.json` at the default branch root; browser CORS and repository layout can limit retrieval. Full repo/ZIP ingestion is not supported.

Generate physically inspired synthetic oud or saz WAVs without any recordings, then audition them in Player. This is additive DSP **not a trained AI model**. See `docs/AI-SYNTHESIS-ROADMAP.md` for a genuine AI implementation path. Manuals in the Guide UI have been updated in Greek and English.


## v0.4 Synthesis backend
Run `docker compose up --build` for Studio at http://localhost:8080 and synthesis API at http://localhost:8000. For local development, start `uvicorn server:app --reload` from `services/ai` after installing `requirements.txt`, then `npm install && npm run dev` at project root. The Vite dev server proxies `/api` to port 8000. **DSP is not AI**; neural inference requires your own trained endpoint. See `docs/AI-SYNTHESIS-ROADMAP.md`.


## Neural Instruments v0.5
Run `docker compose -f docker-compose.neural.yml up --build`. See `docs/NEURAL-INSTRUMENTS.md`. This is a trainable harmonic neural baseline, not a pretrained realistic oud/saz model.


## Authentication (v0.6 development)
Email/password registration and login (Argon2 + SQLite + HttpOnly session cookie), Google ID-token login, and GitHub OAuth. See `docs/AUTHENTICATION-EN.md` and `docs/AUTHENTICATION-EL.md`. Copy `.env.example` to `.env` and configure `AUTH_SECRET` before launching. **Not production-ready**: see security limitations in the manuals.

## Cloud Workspace v0.7
Authenticated users can save/load compositions and upload/download private WAV recordings from the **Cloud Workspace** menu. Backend metadata is stored in SQLite and recordings in per-user directories on the persistent synthesis output volume. See `docs/CLOUD-WORKSPACE-EL.md` and `docs/CLOUD-WORKSPACE-EN.md` for endpoints and security limitations. Existing neural training/models are not yet user-isolated; do not deploy this development version publicly.

## v0.8 — Cloud instrument packs, superadmin and demo instruments

See [Greek instructions](docs/RELEASE-v0.8-EL.md) and [English instructions](docs/RELEASE-v0.8-EN.md). Run `npm run fixtures` to generate nine procedural demo instruments. Configure a superadmin through the interactive backend CLI; **no preset password is shipped**. Public catalogue publishes only opted-in instrument metadata; recordings remain private. Neural training and jobs still need per-user isolation before public deployment.

## v0.9 Workspace → AI Training

See `docs/LIBRARY-TRAINING-EL.md` and `docs/LIBRARY-TRAINING-EN.md`. Training uses persistent, user-owned WAV recordings linked to instrument libraries; generated models are stored per account.

## Cross-platform local development / Τοπική ανάπτυξη

Use `scripts/dev.ps1 setup` on Windows PowerShell or `./scripts/dev.sh setup` on macOS/Linux, then run `backend` and `frontend` in separate terminals. See [English guide](docs/LOCAL-DEVELOPMENT-EN.md) / [Ελληνικός οδηγός](docs/LOCAL-DEVELOPMENT-EL.md).

## Recording analysis / Ανάλυση ηχογραφήσεων

Authenticated API `POST /api/v1/recordings/analyze` inspects PCM WAV pitch and recording levels. See [EN](docs/AUDIO-ANALYSIS-EN.md) / [EL](docs/AUDIO-ANALYSIS-EL.md). This is a heuristic analysis API, not a trained audio restoration model or a new Studio screen.
