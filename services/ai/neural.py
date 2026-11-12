"""Small trainable harmonic-envelope neural synthesizer. Requires PyTorch.
This is a research baseline, NOT a pretrained realistic oud/saz model.
"""
import io, json, math, wave
from pathlib import Path
import numpy as np

HARMONICS=24

def decode_wav(raw):
    with wave.open(io.BytesIO(raw), 'rb') as w:
        if w.getcomptype() != 'NONE' or w.getsampwidth() not in (2,4):
            raise ValueError('Upload uncompressed PCM 16/32-bit WAV')
        rate=w.getframerate(); channels=w.getnchannels()
        if channels not in (1,2) or rate<8000 or rate>96000: raise ValueError('Unsupported channels/rate')
        if w.getnframes()>rate*15: raise ValueError('Maximum recording duration is 15s')
        rawdata=w.readframes(w.getnframes()); dtype='<i2' if w.getsampwidth()==2 else '<i4'
        audio=np.frombuffer(rawdata,dtype=dtype).astype(np.float64)/(32768 if dtype=='<i2' else 2147483648)
        return audio.reshape(-1,channels).mean(axis=1),rate

def features(audio,rate,midi,cents=0.0):
    f0=440*2**((midi-69+cents/100)/12)
    if f0*HARMONICS>=rate/2: raise ValueError('Sample rate too low for harmonic extraction')
    duration=min(len(audio)/rate,2.0)
    if duration<0.12: raise ValueError('Recording too short')
    rows=[]
    for relative in np.linspace(.08,.85,12):
        center=int(relative*duration*rate); length=min(8192,max(1024,int(rate*.09)))
        start=max(0,min(len(audio)-length,center-length//2))
        frame=audio[start:start+length]
        if len(frame)<length:continue
        spec=np.abs(np.fft.rfft(frame*np.hanning(length)))
        freq=np.fft.rfftfreq(length,1/rate)
        harmonics=[]
        for h in range(1,HARMONICS+1):
            idx=np.argmin(np.abs(freq-f0*h));harmonics.append(float(max(spec[max(0,idx-1):idx+2])))
        h=np.asarray(harmonics); h/=max(np.max(h),1e-8)
        rows.append((relative,np.log1p(20*h).astype(np.float32)))
    return rows

ARTICULATIONS = ('sustain', 'tremolo', 'muted', 'staccato', 'legato', 'pluck')

def _network(input_dim=10):
    import torch.nn as nn
    return nn.Sequential(nn.Linear(input_dim,96),nn.Tanh(),nn.Linear(96,96),nn.Tanh(),nn.Linear(96,HARMONICS),nn.Softplus())

def _condition(midi,velocity,cents,articulation,t):
    if articulation not in ARTICULATIONS:
        raise ValueError('Unsupported articulation: '+str(articulation))
    return [(midi-60)/36,(velocity-64)/64,float(t),float(cents)/100]+[float(articulation==a) for a in ARTICULATIONS]

def train(records,output_dir,epochs=180):
    """Records are dicts: midi, velocity, cents, articulation, raw WAV.
    Backwards compatible with (midi, velocity, raw) tuples.
    """
    import torch
    torch.manual_seed(17)
    X=[];Y=[];articulations=set();cents_values=[];midis=[]
    for record in records:
        if isinstance(record,dict):
            midi=int(record['midi']);velocity=int(record['velocity']);raw=record['raw']
            cents=float(record.get('cents',0));articulation=record.get('articulation','sustain')
        else:
            midi,velocity,raw=record;cents=0.;articulation='sustain'
        if not -1200<=cents<=1200:raise ValueError('Cents out of range')
        audio,rate=decode_wav(raw)
        for t,coeff in features(audio,rate,midi,cents):
            X.append(_condition(midi,velocity,cents,articulation,t));Y.append(coeff)
        articulations.add(articulation);cents_values.append(cents);midis.append(midi)
    if len(X)<12:raise ValueError('Insufficient training frames')
    model=_network();optimizer=torch.optim.Adam(model.parameters(),lr=.005)
    x=torch.tensor(np.asarray(X),dtype=torch.float32);y=torch.tensor(np.asarray(Y),dtype=torch.float32)
    model.train()
    for _ in range(epochs):
        optimizer.zero_grad();loss=((model(x)-y)**2).mean();loss.backward();optimizer.step()
    output_dir=Path(output_dir);output_dir.mkdir(parents=True,exist_ok=True)
    torch.save(model.state_dict(),output_dir/'weights.pt')
    metadata={'architecture':'harmonic-mlp-v2-conditioned','input_dim':10,'harmonics':HARMONICS,
      'training_recordings':len(records),'epochs':epochs,'loss':float(loss.item()),
      'midi_min':min(midis),'midi_max':max(midis),'cents_min':min(cents_values),
      'cents_max':max(cents_values),'trained_articulations':sorted(articulations),
      'supported_articulations':list(ARTICULATIONS),
      'disclaimer':'Research harmonic MLP; unrepresented articulations and pitch ranges are extrapolations.'}
    (output_dir/'metadata.json').write_text(json.dumps(metadata,indent=2))
    return metadata

def interpolate_curve(points, positions, default):
    """Piecewise-linear expressive automation; points are [normalized_time, value]."""
    if not points:
        return np.full_like(positions, default, dtype=float)
    points=sorted(points, key=lambda x: x[0])
    return np.interp(positions, [v[0] for v in points], [v[1] for v in points],
                     left=points[0][1], right=points[-1][1])

def render(model_dir,midi,velocity,duration,articulation,seed=42,rate=24000,cents=0.0,pitch_curve=None,dynamics_curve=None):
    import torch
    model_dir=Path(model_dir)
    metadata=json.loads((model_dir/'metadata.json').read_text())
    if metadata.get('architecture')=='harmonic-mlp-v2-conditioned':
        model=_network()
        condition=lambda t:_condition(midi,velocity,cents,articulation,t)
    else:
        # Existing v1 models remain loadable; their training ignored cents/articulation.
        from torch import nn
        model=nn.Sequential(nn.Linear(3,64),nn.Tanh(),nn.Linear(64,64),nn.Tanh(),nn.Linear(64,HARMONICS),nn.Softplus())
        condition=lambda t:[(midi-60)/36,(velocity-64)/64,float(t)]
    model.load_state_dict(torch.load(model_dir/'weights.pt',map_location='cpu',weights_only=True));model.eval()
    n=int(rate*duration);t=np.arange(n)/rate
    normalized=t/duration
    bend=interpolate_curve(pitch_curve,normalized,0.0)
    dynamics=interpolate_curve(dynamics_curve,normalized,1.0)
    # Phase integration (rather than instantaneous phase multiplication) avoids clicks
    # when bends and glissandi change over time.
    f0=440*2**((midi-69+(cents+bend)/100)/12)
    phase=2*np.pi*np.cumsum(f0)/rate
    grid=np.linspace(0,1,max(4,int(duration*50)))
    grid_bend=interpolate_curve(pitch_curve,grid,0.0)
    with torch.no_grad():
        inputs=torch.tensor([condition(v) if metadata.get('architecture')!='harmonic-mlp-v2-conditioned' else
            _condition(midi,velocity,cents+float(grid_bend[i]),articulation,v) for i,v in enumerate(grid)],dtype=torch.float32)
        envelopes=np.expm1(np.clip(model(inputs).numpy(),0,12))/20
    rng=np.random.default_rng(seed);phases=rng.uniform(-.1,.1,HARMONICS)
    signal=np.zeros(n)
    for h in range(1,HARMONICS+1):
        if np.min(f0)*h>=rate*.47:break
        amp=np.interp(normalized,grid,envelopes[:,h-1])
        # Suppress harmonics beyond Nyquist during upward pitch bends.
        amp=np.where(f0*h<rate*.47,amp,0.0)
        signal+=amp*np.sin(h*phase+phases[h-1])
    signal*=np.minimum(1,t*130)*np.exp(-t*1.5)*np.clip(velocity/100,.1,1.3)
    if articulation=='muted':signal*=np.exp(-t*10)
    if articulation=='staccato':signal*=np.exp(-t*8)
    if articulation=='tremolo':signal*=.55+.45*np.maximum(0,np.sin(2*np.pi*9*t))
    signal*=dynamics
    signal*=np.minimum(1,np.maximum(0,(duration-t)*35))
    peak=max(float(np.max(np.abs(signal))),1e-8)
    # Keep absolute dynamics between generated notes when possible.
    signal=signal/max(peak,1.0)*.76
    with io.BytesIO() as buf:
        with wave.open(buf,'wb') as w:
            w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate)
            w.writeframes((np.clip(signal,-1,1)*32767).astype('<i2').tobytes())
        return buf.getvalue()
