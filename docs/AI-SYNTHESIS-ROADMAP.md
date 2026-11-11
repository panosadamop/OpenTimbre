# AI Synthesis — implementation status v0.4

Implemented: FastAPI async synthesis jobs; validated request fields; status polling; WAV download; browser audition and import; engine capabilities; provenance (model version, rights, DSP-vs-AI distinction); optional neural inference HTTP adapter; Docker; bilingual in-app instructions.

**No pretrained neural oud/saz model is bundled.** DSP mode is an approximation, not machine learning. Neural mode only becomes available after the operator deploys a legally trained model that accepts JSON and returns WAV bytes. Set `NEURAL_MODEL_ENDPOINT` and `NEURAL_MODEL_VERSION` on the synthesis service. No external audio is uploaded by default.

Limitations: in-memory job queue (lost on restart); local output files; no authentication; no dataset training pipeline; no objective pitch/quality metrics or expert validation; no persistence of provenance within the instrument manifest. These are required before a public production deployment. The backend must not be exposed directly to the internet without authentication, quotas and a durable job queue. Use trusted neural endpoints only.

## Neural adapter contract
POST JSON `{instrument, midi, velocity, duration, articulation, seed, engine}` to `NEURAL_MODEL_ENDPOINT`; return `audio/wav` RIFF/WAVE bytes. Model deployment, weights and training-data licensing are the operator's responsibility.
