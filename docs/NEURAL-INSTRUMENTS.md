# OpenTimbre Neural Instruments v0.5

## Implemented
- Upload PCM WAV with explicit MIDI note, velocity, rights declaration and instrument.
- Extract harmonic spectra from 12 windows per recording.
- Train a PyTorch 3→64→64→24 MLP for harmonic-envelope regression.
- Save model weights and metadata; list trained models.
- Generate playable WAV from a trained model via existing synthesis jobs API.
- In-app bilingual training screen and updated bilingual manuals.

## Limitations
- **No pretrained oud/saz model is included.** Requires user-owned recordings.
- Synthesizer is a small learned harmonic baseline, not DDSP, diffusion or sample-perfect instrument recreation.
- No learned attacks, noise, vibrato, string transitions or realistic articulations.
- No pitch-detection validation; user must supply correct MIDI note.
- Uploaded WAVs are memory-only; restart clears dataset. Models persist under OUTPUT_DIR/models.
- Training is synchronous request handled in a thread; not a production queue. No auth, quotas or multiuser isolation.
- No remote URL/repository training ingestion in this release. Only manually uploaded WAV.

## Run
`docker compose -f docker-compose.neural.yml up --build`
Visit http://localhost:8080. The backend is proxied through nginx to the synthesis container.

## API
- POST `/api/v1/neural/datasets/{instrument}/recordings` multipart file, midi, velocity, rights
- POST `/api/v1/neural/models/{instrument}/train`
- GET `/api/v1/neural/models`
- GET `/api/v1/neural/datasets`
- POST `/api/v1/synthesis/jobs` engine=`local-neural`, model_id=`...`

## Security
Only run on trusted local machines. Do not expose this unauthenticated API to the public internet. Never train on third-party recordings without the required rights.
