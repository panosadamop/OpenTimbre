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

def features(audio,rate,midi):
    f0=440*2**((midi-69)/12)
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

def train(records,output_dir,epochs=180):
    import torch
    from torch import nn
    torch.manual_seed(17)
    X=[];Y=[]
    for midi,velocity,raw in records:
        audio,rate=decode_wav(raw)
        for t,coeff in features(audio,rate,midi):
            X.append([(midi-60)/36,(velocity-64)/64,t]);Y.append(coeff)
    if len(X)<12: raise ValueError('Insufficient training frames')
    model=nn.Sequential(nn.Linear(3,64),nn.Tanh(),nn.Linear(64,64),nn.Tanh(),nn.Linear(64,HARMONICS),nn.Softplus())
    optimizer=torch.optim.Adam(model.parameters(),lr=.007)
    x=torch.tensor(np.asarray(X),dtype=torch.float32);y=torch.tensor(np.asarray(Y),dtype=torch.float32)
    model.train()
    for _ in range(epochs):
        optimizer.zero_grad(); loss=((model(x)-y)**2).mean();loss.backward();optimizer.step()
    output_dir=Path(output_dir);output_dir.mkdir(parents=True,exist_ok=True)
    torch.save(model.state_dict(),output_dir/'weights.pt')
    metadata={'architecture':'harmonic-mlp-v1','harmonics':HARMONICS,'training_recordings':len(records),'epochs':epochs,'loss':float(loss.item()),'midi_min':min(r[0] for r in records),'midi_max':max(r[0] for r in records),'disclaimer':'Small learned harmonic model; quality depends on recordings; no pretrained timbre.'}
    (output_dir/'metadata.json').write_text(json.dumps(metadata,indent=2))
    return metadata

def render(model_dir,midi,velocity,duration,articulation,seed=42,rate=24000):
    import torch
    from torch import nn
    model=nn.Sequential(nn.Linear(3,64),nn.Tanh(),nn.Linear(64,64),nn.Tanh(),nn.Linear(64,HARMONICS),nn.Softplus())
    model.load_state_dict(torch.load(Path(model_dir)/'weights.pt',map_location='cpu',weights_only=True));model.eval()
    n=int(rate*duration); t=np.arange(n)/rate; f0=440*2**((midi-69)/12)
    # Predict envelope every 20ms and interpolate: CPU friendly.
    grid=np.linspace(0,1,max(4,int(duration*50)))
    with torch.no_grad():
        inputs=torch.tensor([[(midi-60)/36,(velocity-64)/64,float(v)] for v in grid],dtype=torch.float32)
        envelopes=np.expm1(model(inputs).numpy())/20
    rng=np.random.default_rng(seed); phases=rng.uniform(-.1,.1,HARMONICS)
    signal=np.zeros(n)
    for h in range(1,HARMONICS+1):
        if f0*h>=rate*.47:break
        amp=np.interp(np.clip(t/duration,0,1),grid,envelopes[:,h-1]);signal+=amp*np.sin(2*np.pi*f0*h*t+phases[h-1])
    signal*=np.minimum(1,t*130)*np.exp(-t*1.5)*np.clip(velocity/100,.1,1.3)
    if articulation=='muted':signal*=np.exp(-t*10)
    if articulation=='tremolo':signal*=.55+.45*np.maximum(0,np.sin(2*np.pi*9*t))
    signal*=np.minimum(1,np.maximum(0,(duration-t)*35))
    peak=max(float(np.max(np.abs(signal))),1e-8);signal=signal/peak*.76
    with io.BytesIO() as buf:
        with wave.open(buf,'wb') as w:
            w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate);w.writeframes((np.clip(signal,-1,1)*32767).astype('<i2').tobytes())
        return buf.getvalue()
