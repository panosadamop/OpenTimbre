# OpenTimbre v1.3 — Expressive Synthesis

The Instrument Generator now sends optional `pitch_curve` and `dynamics_curve` automation to the synthesis API. Each curve has up to 32 `{time, value}` points, with normalized time (0–1). Pitch values are offsets in cents (−1200 to +1200); dynamics are multipliers (0–2). The API supports preset glissando, vibrato and dynamics envelopes, with integrated oscillator phase for continuous pitch movement.

Both procedural DSP and locally trained neural harmonic models accept automation. The neural harmonic MLP is **not** a learned performance-expression model; expressive automation is applied during rendering. More varied, labeled recordings are required for convincing timbre.

## Windows quick start
Install Node.js 20+ and Python (3.11/3.12 recommended for broad PyTorch compatibility). In PowerShell, from the extracted project root:

```powershell
.\scripts\dev.ps1 setup
.\.venv\Scripts\python.exe -m pip install -r services\ai\requirements-neural.txt
$env:ADMIN_EMAIL = 'admin@opentimbre.local'
.\scripts\dev.ps1 admin
```

The superadmin password is prompted (minimum 12 characters) for a new account. Existing accounts are promoted without resetting their password. There is **no default login**.

Run `./scripts/dev.ps1 backend` and `./scripts/dev.ps1 frontend` in separate PowerShell terminals. Open `http://localhost:5173` and sign in with the email/password you configured. Use the Recording Assistant → Cloud Library → Neural Training → Instrument Generator flow.

## Local development on macOS / Linux

```bash
./scripts/dev.sh setup
./.venv/bin/python -m pip install -r services/ai/requirements-neural.txt
ADMIN_EMAIL=admin@opentimbre.local ./scripts/dev.sh admin
```

Start backend and frontend in separate terminals with `./scripts/dev.sh backend` and `./scripts/dev.sh frontend`.

Known limitations: no real-time MIDI expressive streaming, no learned note-to-note transitions, and no completed Windows browser E2E verification.
