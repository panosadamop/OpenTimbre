# OpenTimbre v0.9 — Personal Libraries and AI Training

1. Sign in to your account.
2. In Cloud Workspace create an **Oud** or **Saz** instrument library.
3. Upload at least two WAV files (PCM 16/32-bit, up to 15 seconds for training). Enter the correct MIDI pitch. More notes and velocities improve coverage.
4. Under “Link recordings to library”, select a library and a recording, then press “Link”. Ownership is enforced by the backend.
5. In Neural Instruments choose the instrument and your library, then select “Train model”.
6. In Instrument Generator choose Local Neural and enter the Model ID.

**Fields:** Library: training library. WAV: recording. MIDI: recorded pitch. Velocity: playing intensity (link defaults to 90). Model ID: private model identifier.

**Limitations:** oud/saz only, minimum two recordings, harmonic MLP baseline, no guarantee of realistic sound. Browser sampler sync is not automatic. Training is synchronous and may take time.
