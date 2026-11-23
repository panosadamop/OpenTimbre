# Contributing to OpenTimbre

Thanks for wanting to help. OpenTimbre is a young, open-source studio for instruments that live between the keys (oud, saz, tzouras, bouzouki, kanun, ney…), and every contribution shapes it. You don't have to write code to make a difference.

## Ways to contribute

| You can… | Start here |
|---|---|
| **Record an instrument**: openly licensed samples others can play | [Contributing recordings](#contributing-recordings) |
| **Write code**: DSP, React UI, SFZ export, Python backend, tests | [Development setup](#development-setup) |
| **Test and report**: try it with your instrument and your tuning | [Reporting bugs](#reporting-bugs-and-ideas) |
| **Translate and document**: English/Greek manuals, new languages | [Documentation and translation](#documentation-and-translation) |

Not sure where to start? Open an issue describing what you'd like to work on. We're happy to point you somewhere useful.

## Ground rules

- Be kind and assume good faith. Critique code and ideas, not people.
- **Be honest about sound.** Synthetic and procedural audio must never be presented as a real oud, saz or any other natural recording. The bundled `instruments/demo-synthetic` pack is for demos and tests only.
- **Respect licensing.** Code is MIT. Recordings belong to their owners and must carry an explicit licence. Never add third-party samples without documented permission to redistribute them.
- **No hidden network calls or paid APIs.** OpenTimbre is local-first.
- **Never commit secrets or user data**: `.env`, `local-data/`, `*.sqlite3` databases, trained models or uploaded recordings.

## Development setup

Requirements: Node.js 22+, npm, Python 3.10+.

**Windows (PowerShell)**
```powershell
.\scripts\dev.ps1 setup      # npm install, Python venv, .env with a random secret, demo fixtures
.\scripts\dev.ps1 backend    # FastAPI on http://localhost:8000
.\scripts\dev.ps1 frontend   # in a second window: Studio on http://localhost:5173
```

**macOS / Linux**
```bash
./scripts/dev.sh setup
./scripts/dev.sh backend
./scripts/dev.sh frontend    # in a second terminal
```

To create the first superadmin account, run `admin` (`.\scripts\dev.ps1 admin` or `./scripts/dev.sh admin`). Neural training also needs PyTorch: install `services/ai/requirements-neural.txt` into `.venv` separately. See [docs/LOCAL-DEVELOPMENT-EN.md](docs/LOCAL-DEVELOPMENT-EN.md) for details.

### Project layout

```
apps/studio/src/   React + TypeScript Studio (Web Audio playback, editors, admin UI)
packages/core      instrument model, sample selection, tuning (no React)
packages/sfz       SFZ export
services/ai/       FastAPI backend: auth, roles, cloud workspace, synthesis, analysis, neural training
functions/api/     Cloudflare Pages Function proxying /api to the backend
instruments/       synthetic demo instrument (instrument.json + WAVs)
docs/              specifications, guides and EN/EL manuals
tests/             frontend/core tests (node --test)
```

### Before you open a pull request

Run all of these and make sure they pass:

```bash
./scripts/dev.sh test     # npm test + backend pytest   (Windows: .\scripts\dev.ps1 test)
./scripts/dev.sh build    # strict TypeScript check + production build
```

Also:

- **Test the change in the running app**, not just in unit tests. For UI changes, include a screenshot or a short clip in the PR.
- Add or update tests for behaviour you change. The backend enforces permissions in the API, so test those rules there, not just in the UI.
- Keep DSP and sample-selection logic independent of React.
- Use TypeScript strict mode and functional components. Match the style of the surrounding code.
- New user-facing text should exist in **English and Greek**.
- Update the relevant docs (`docs/*-EN.md` / `*-EL.md`, `docs/IMPLEMENTATION-STATUS.md`) when behaviour changes, and be truthful about what's implemented versus pending.

## Pull request workflow

1. Fork the repository and create a branch from `main`, e.g. `fix/velocity-layers` or `feat/turkish-ui`.
2. Keep each PR focused on one thing. Small PRs get reviewed faster.
3. Write clear commit messages in the imperative mood ("Add round-robin to sampler", not "added stuff").
4. Open the PR with what changed, why, and how you tested it. Link the issue it closes (`Closes #12`).
5. A maintainer will review it. Expect questions; they're part of making it good.

By submitting a contribution, you agree that your code is licensed under the project's [MIT License](LICENSE).

## Contributing recordings

Recordings are the most valuable thing OpenTimbre can't generate itself.

1. **Open an issue first** describing the instrument, tuning, number of notes and velocity layers, and the licence you plan to use. We recommend CC0 or CC BY 4.0.
2. Follow the recording protocol in [docs/05-RECORDING-PROTOCOL.md](docs/05-RECORDING-PROTOCOL.md): WAV, consistent levels and room, one note per file, root note and cents offset documented.
3. Describe the pack with an `instrument.json` (see `instruments/demo-synthetic/instrument.json` and [docs/03-DATA-MODEL.md](docs/03-DATA-MODEL.md)).
4. Include provenance: who played it, on what instrument, where and when, plus the licence text. See [docs/09-LICENSING.md](docs/09-LICENSING.md).
5. Only submit recordings **you made yourself** or have written permission to relicense.

Large packs may be hosted separately and linked from a manifest instead of being committed to this repository. We'll work that out in the issue.

## Reporting bugs and ideas

Search the existing issues first. For a bug, include:

- what you did, what you expected, and what happened instead;
- OS, browser and version, and whether you ran it via `npm run dev`, Docker or a deployment;
- console errors and backend logs, if any;
- for audio problems: the instrument, note, cents value and tuning, and a short recording if you can.

Feature ideas are welcome. Explain the musical problem you want solved, not only the solution.

## Documentation and translation

- Manuals live in `docs/manual/` and are served in the app from `public/manual/`. Update **both** copies when you edit a manual.
- English and Greek docs come in `-EN` / `-EL` pairs. Keep them in sync, or note in your PR which one needs a follow-up translation.
- Want OpenTimbre in Turkish, Arabic, Persian or another language? Open an issue first so we can agree on how to structure the translation strings.

## Security

Please **don't** report security vulnerabilities in public issues. Contact the maintainers privately via the email on their GitHub profile, or use GitHub's private vulnerability reporting if it's enabled. Give us a reasonable time to fix the problem before disclosing it.

---

Thank you for helping OpenTimbre give a voice to more instruments. 🎶
