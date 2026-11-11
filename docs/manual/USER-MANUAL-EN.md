# OpenTimbre — Complete User Manual (English)

**Version:** 0.2.0 · **Mode:** local web studio · **Status:** development release, not production certified.

## 1. Purpose and limitations

OpenTimbre imports real WAV note recordings, maps MIDI key zones, plays basic melodies, saves browser-local workspaces and exports WAV/JSON/SFZ/MIDI. The included demo uses **synthetic** audio, not real oud or saz. It is not a multitrack recording DAW, does not automatically trim/normalize recordings, and does not provide cloud collaboration, full SFZ compatibility, or complete MIDI 2.0/MPE. MIDI import/export does not preserve microtonal pitch bends.

## 2. Recording equipment

**Minimum:** well-maintained oud or saz, quiet room, computer, 24-bit USB audio interface, condenser microphone, microphone stand, XLR cable, closed-back headphones and recording software (e.g. Audacity or Reaper). If your microphone needs phantom power, enable 48 V according to the manufacturer's guidance. Optional: acoustic panels, second microphone, chromatic tuner, metronome.

**Target:** mono PCM WAV, 24-bit, 48 kHz, recorded dry (no reverb, compression, limiter or EQ). Retain untouched raw masters. Browsers can decode common WAV formats but you should verify playback.

## 3. Oud and saz recording protocol

1. Document tuning, string, position, plectrum, temperature and session date. Retune regularly.
2. Position the microphone around 20–40 cm from the instrument, pointing between bridge and fingerboard rather than directly at the sound hole. Listen and adjust before fixing the position.
3. Set gain so loud notes peak around -12 to -6 dBFS without clipping. Reduce room and equipment noise.
4. Record **three velocity layers** (soft/medium/hard) and **three independent takes** (round robin) for each pitch. Allow full natural decay and 0.2–0.5 s of clean lead-in.
5. Record upstrokes, downstrokes, tremolo, muted notes and slides separately. For saz, capture alternate strings/positions where timbre differs.
6. Listen for clicks, rattles, clipping and noise. Trim carefully and apply short fades without removing the attack or decay.
7. Export each take to a separate WAV with consistent naming, such as `oud_D4_soft_rr01_down.wav` or `saz_G3_hard_rr02_up.wav`.
8. Record MIDI root pitch (e.g. C4=60), pitch deviation in cents, velocity layer, technique, string and license. String/position metadata can initially live in a separate CSV.

**First session:** 12–24 pitches × 3 velocity layers × 3 takes = 108–216 WAV files per instrument. Start with a smaller quality-control subset.

## 4. Installation and startup

Requires Node.js 22+ and npm. From the project root run `npm install`, `npm run fixtures`, `npm run dev`, then visit `http://localhost:5173`. Build with `npm run build`, test with `npm test`. Alternatively run `docker compose up --build` and visit `http://localhost:8080`.

## 5. End-to-end workflow

1. In **Play**, click Load demo instrument to check audio output.
2. In **Library**, set instrument name/license, first root note, then import your WAV recordings.
3. Edit Root, Low, High, velocity layers and Root cents. Avoid overlapping zones unless you intend alternate takes.
4. In **Play**, audition keys and choose a tuning preset.
5. In **Song**, add/edit note events, press Play song and review the arrangement.
6. Click **Save workspace**. In **Export**, export WAV, song JSON, instrument JSON and SFZ. Always keep original WAV backups.

## 6. Detailed pages and field reference

### Global

| Field | Values | Explanation |
|---|---|---|
| Save workspace | IndexedDB | Browser-local storage of instrument, WAV and song |
| Clear saved | IndexedDB | Delete stored workspace after confirmation |
| Ελληνικά / English | Toggle | Switch main navigation language; some technical labels remain English |

### Player

| Field | Values | Explanation |
|---|---|---|
| Pitch offset | -100 to +100 cents | Pitch adjustment for newly triggered notes |
| Velocity | 1–127 | MIDI note velocity and playback amplitude |
| Tuning / scale | Equal, Quarter-tone, Uşşak demo | Additional cents offset by pitch class; presets are illustrative |

### Library

| Field | Values | Explanation |
|---|---|---|
| Instrument name | Text | Name of sample pack |
| Sample license | Text | Recording license; verify ownership |
| First MIDI root note | 0–127 | First root note for batch WAV import |
| Choose WAV files | WAV, up to 40 MB/file | Import and decode recordings |
| Import instrument.json | JSON | Import metadata; WAV files must be added separately |
| Sample | Text | Recording filename |
| Root | 0–127 | MIDI note originally recorded |
| Low | 0–127 | Lowest MIDI note covered by sample |
| High | 0–127 | Highest MIDI note covered by sample |
| Vel min | 0–127 | Lowest velocity layer |
| Vel max | 0–127 | Highest velocity layer |
| Root cents | Cents | Original sample deviation from equal temperament |
| RR | Integer ≥0 | Alternate take index; engine provides basic cycling |
| Articulation | Text | Technique e.g. sustain; Player currently requests sustain |

### Song

| Field | Values | Explanation |
|---|---|---|
| Song title | Text | Composition title |
| BPM | 20–300 | Tempo for MIDI conversion; note event times are seconds |
| Note (MIDI) | 0–127 | MIDI pitch (60=middle C) |
| Start (s) | Seconds ≥0 | Note start time |
| Length (s) | Seconds >0 | Note duration |
| Velocity | 1–127 | Velocity of each note |
| Cents | Number | Per-note microtonal offset |
| Import MIDI | SMF .mid | Import basic note-on/off events; pitch bends not preserved |
| Export MIDI | SMF .mid | Export equal-tempered notes; cents are not encoded |

### Export

| Field | Values | Explanation |
|---|---|---|
| Export WAV | WAV file | Offline song rendering |
| Export JSON | instrument.json | Instrument metadata without embedded audio |
| Export SFZ | instrument.sfz | Basic SFZ definition; copy WAVs to matching paths |
| Export song JSON | song.json | Editable note events |
| Import song JSON | song.json | Load composition |

## 7. Troubleshooting

- **No sound:** click a key first (browser audio requires user interaction); check audio output and mapped MIDI/velocity ranges.
- **Missing sample:** reimport WAVs after importing a manifest. JSON metadata does not contain audio.
- **Wrong pitch:** verify Root, Root cents, Low/High and tuning preset.
- **MIDI loses cents:** use Song JSON to preserve microtonal information and WAV for final sound.
- **Workspace save fails:** browser storage quota may be exhausted or private mode may block persistence. Export JSON and keep WAV files outside the browser.
- **SFZ cannot locate WAV:** preserve relative `samples/...` paths and the expected directory structure.

## 8. Rights, security and backups

Use only recordings you are entitled to use. The software license does not automatically apply to audio samples. IndexedDB storage is specific to a browser/profile and can disappear if site data is cleared. Keep backups of WAVs, JSON and exported audio. Do not import untrusted files.

## 9. Suggested future development

Automatic pitch detection, waveform editor, batch mapping by filename, advanced round robin, articulation keyswitches, loop points, multitrack arranging, MPE/MTS, Scala import and bundled ZIP sample packs. These are **not** claimed as completed features in this release.
### Sources & Synthesis
Use **Sources & Synthesis** to register external libraries for reference, corrections or future import.
- **Source name**: descriptive label. **HTTPS URL / GitHub repo**: external link.
- **Purpose**: Reference, Correction, or Import candidate.
- **License**: actual license or Unknown. **Notes**: observations, issues and corrections.
- **Save source**: stores the record locally in this browser. **Inspect instrument.json**: fetches a compatible HTTPS manifest if CORS allows.
- **Open local manifest**: read a JSON manifest without WAV files. **Manifest comparison**: sample counts and missing MIDI root notes.
- **Use manifest**: replaces metadata only, not audio.
- **Instrument / Lowest / Highest MIDI note**: set the synthetic instrument and pitch range.
- **Generate & load synthetic samples**: synthesizes WAVs and loads them in Player. This is physical-inspired synthesis, NOT a trained AI model.
**Limitations**: No full repository/ZIP ingestion, no authentic timbre reconstruction from a text prompt. Third-party licenses must be reviewed independently.


## AI / DSP Generator (v0.4)
Open **Sources & Synthesis → Instrument generation**. Start the Python synthesis service (`docker compose up --build` or `cd services/ai && pip install -r requirements.txt && uvicorn server:app --reload`). Select Engine (DSP = not AI; Neural requires your own deployed trained model), Instrument (oud/saz), MIDI note (24–96), Velocity (1–127), Duration (0.15–8 seconds), Articulation (sustain/tremolo/muted), Seed (reproducibility), and Rights/provenance (your description of permitted use). Select Generate WAV; watch the job status, audition with the audio player, Download WAV, or Import to Library. Save Workspace after import. Neural mode is disabled until the backend reports a configured model. Generated timbre is not a guarantee of acoustic authenticity.


## Neural Instruments training (v0.5)
Open **Sources & Synthesis → Neural Instruments**. Select the instrument, a PCM WAV recording, its actual MIDI note, velocity (1–127), and a rights declaration. Upload each recording, then select **Train model**. At least two WAV recordings are required (16/32-bit PCM, 8–96 kHz, max 15 seconds and 5 MB each). The backend trains a small neural network to predict 24 harmonic amplitudes; it is not a neural audio codec and realistic timbre is not guaranteed. Under Instrument Generator choose **Local Neural** and select the model ID. Record many clean notes and velocities for better generalization. Uploads are stored only in process memory; trained model weights persist in the Docker volume. Install locally with `pip install -r services/ai/requirements-neural.txt`, or start with `docker compose -f docker-compose.neural.yml up --build`.
