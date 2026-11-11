import io, math, wave
import numpy as np
from audio_analysis import analyze_wav

def test_pitch_and_metadata():
    rate=24000
    t=np.arange(rate)/rate
    y=(.3*np.sin(2*np.pi*440*t)*32767).astype('<i2')
    out=io.BytesIO()
    with wave.open(out,'wb') as w:
        w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate);w.writeframes(y.tobytes())
    result=analyze_wav(out.getvalue())
    assert result['sample_rate']==rate
    assert abs(result['estimated_frequency_hz']-440)<5
    assert result['estimated_midi']==69
