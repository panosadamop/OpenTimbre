# Recording inspection — v1.0

Authenticated `POST /api/v1/recordings/analyze` accepts `multipart/form-data` field `file` (16/32-bit PCM WAV, mono/stereo, maximum 40 MB and 120 s). Returns duration, sample rate, peak/RMS levels, clipping fraction, estimated frequency, MIDI note, cents deviation, confidence and warnings.

Sign in to Studio, then try the endpoint in the API documentation (`http://localhost:8000/docs`). This is a **heuristic** for isolated monophonic notes; oud/saz harmonics and microtonal pitches can cause errors. It does not classify articulations or automatically repair recordings. Ensure you have rights before using third-party reference libraries.
