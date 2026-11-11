"""Lightweight pitch and recording quality inspection. Not articulation recognition."""
import io, wave
import numpy as np

def analyze_wav(raw: bytes):
    if len(raw)>40_000_000: raise ValueError('File exceeds 40 MB')
    try:
        with wave.open(io.BytesIO(raw),'rb') as wav:
            rate=wav.getframerate(); channels=wav.getnchannels(); width=wav.getsampwidth(); frames=wav.getnframes()
            if width not in (2,4) or channels not in (1,2): raise ValueError('Use 16/32-bit PCM mono/stereo WAV')
            if frames==0 or rate<8000 or rate>192000: raise ValueError('Invalid sample rate or empty audio')
            raw_frames=wav.readframes(frames)
    except (wave.Error,EOFError) as exc: raise ValueError('Invalid PCM WAV') from exc
    dtype='<i2' if width==2 else '<i4'
    audio=np.frombuffer(raw_frames,dtype=dtype).astype(np.float64)/(2**(8*width-1))
    audio=audio.reshape(-1,channels).mean(axis=1)
    peak=float(np.max(np.abs(audio)))
    rms=float(np.sqrt(np.mean(audio**2)))
    clipping=float(np.mean(np.abs(audio)>=.999))
    duration=len(audio)/rate
    if duration>120: raise ValueError('Recording exceeds 120 seconds')
    # Analyze strongest short window after attack, with FFT harmonic product score.
    size=min(len(audio),max(2048,int(rate*.25)))
    start=min(max(0,int(rate*.08)),max(0,len(audio)-size))
    segment=audio[start:start+size]
    if len(segment)<1024 or rms<.0002:
        pitch=None; confidence=0.0
    else:
        segment=segment-np.mean(segment)
        segment=segment*np.hanning(len(segment))
        # Autocorrelation via FFT: efficient even at high sample rates.
        nfft=1 << (2*len(segment)-1).bit_length()
        spectrum=np.fft.rfft(segment,n=nfft)
        ac=np.fft.irfft(spectrum*np.conjugate(spectrum),n=nfft)[:len(segment)]
        low=max(1,int(rate/1200)); high=min(len(ac)-1,int(rate/55))
        values=ac[low:high+1]/max(ac[0],1e-12)
        peaks=np.where((values[1:-1]>values[:-2]) & (values[1:-1]>=values[2:]))[0]+1
        strong=peaks[values[peaks] >= max(.30, float(np.max(values[peaks]))*.85)] if len(peaks) else np.array([],dtype=int)
        lag=low+int(strong[0] if len(strong) else np.argmax(values))
        confidence=float(np.clip(ac[lag]/max(ac[0],1e-12),0,1))
        pitch=rate/lag if confidence>=.25 else None
    midi=round(69+12*np.log2(pitch/440)) if pitch else None
    cents=round(float(1200*np.log2(pitch/(440*2**((midi-69)/12)))),1) if pitch else None
    warnings=[]
    if clipping>.001: warnings.append('Possible clipping')
    if rms<.005: warnings.append('Low recording level')
    if pitch is None: warnings.append('Pitch could not be estimated reliably')
    return {'sample_rate':rate,'channels':channels,'duration_seconds':round(duration,3),'peak_dbfs':round(float(20*np.log10(max(peak,1e-12))),2),'rms_dbfs':round(float(20*np.log10(max(rms,1e-12))),2),'clipped_fraction':round(clipping,5),'estimated_frequency_hz':round(pitch,2) if pitch else None,'estimated_midi':midi,'deviation_cents':cents,'pitch_confidence':round(confidence,3),'warnings':warnings,'disclaimer':'Heuristic monophonic pitch estimate; verify by ear. Not an AI articulation classifier.'}
