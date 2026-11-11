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
