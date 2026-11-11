"""OpenTimbre synthesis jobs. No trained model is bundled; DSP is explicitly labelled."""
import asyncio, io, json, math, os, struct, time, uuid, wave
from pathlib import Path
from typing import Literal
import httpx
import numpy as np
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field

app = FastAPI(title="OpenTimbre Synthesis API", version="0.5.0")
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:8080").split(","), allow_methods=["GET", "POST"], allow_headers=["Content-Type"])
ROOT = Path(os.getenv("OUTPUT_DIR", Path(__file__).parent / "output")); ROOT.mkdir(parents=True, exist_ok=True)
JOBS: dict[str,dict] = {}
MODEL_DIR=ROOT / "models"
MODEL_DIR.mkdir(exist_ok=True)
TRAINING: dict[str,list] = {}
class Request(BaseModel):
    instrument: Literal["oud","saz"]
    midi: int = Field(ge=24,le=96)
    velocity: int = Field(default=90,ge=1,le=127)
    duration: float = Field(default=2.0,ge=0.15,le=8)
    articulation: Literal["sustain","tremolo","muted"] = "sustain"
    seed: int = Field(default=42,ge=0,le=2147483647)
    engine: Literal["dsp","neural","local-neural"] = "dsp"
    rights: str = Field(default="User-generated synthetic audio")
    model_id: str = ""

def dsp_wav(r: Request) -> bytes:
    rate=24000; n=int(rate*r.duration); t=np.arange(n,dtype=np.float64)/rate
    rng=np.random.default_rng(r.seed); f=440*2**((r.midi-69)/12)
    weights=([1,.5,.28,.14,.07] if r.instrument=="oud" else [1,.68,.39,.23,.12,.07])
    y=np.zeros(n,dtype=np.float64)
    for i,w in enumerate(weights,1):
        y+=w*np.sin(2*np.pi*f*i*t+rng.uniform(-.03,.03))*np.exp(-t*(1.5+i*.27))
    attack=np.minimum(1,t*180)
    if r.articulation=="muted": y*=np.exp(-t*12)
    if r.articulation=="tremolo": y*=.55+.45*np.maximum(0,np.sin(2*np.pi*9*t))
    y*=attack*np.minimum(1,np.maximum(0,(r.duration-t)*25))*r.velocity/127
    y=y/(max(1,float(np.max(np.abs(y)))))*.78
    with io.BytesIO() as out:
        with wave.open(out,"wb") as w:
            w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate)
            w.writeframes((np.clip(y,-1,1)*32767).astype('<i2').tobytes())
        return out.getvalue()

async def run_job(jid: str,r:Request):
    job=JOBS[jid];job["status"]="running"
    try:
        if r.engine=="dsp":
            wav=await asyncio.to_thread(dsp_wav,r)
        elif r.engine=="local-neural":
            from neural import render
            model_path=MODEL_DIR / r.model_id
            if not r.model_id or not (model_path/"weights.pt").exists(): raise ValueError("Train and select a local model first")
            wav=await asyncio.to_thread(render,model_path,r.midi,r.velocity,r.duration,r.articulation,r.seed)
        else:
            endpoint=os.getenv("NEURAL_MODEL_ENDPOINT","")
            if not endpoint: raise ValueError("No trained neural model configured. Set NEURAL_MODEL_ENDPOINT to a trusted WAV-producing inference service.")
            if not endpoint.startswith(("http://127.0.0.1:","http://localhost:","https://")):
                raise ValueError("Neural endpoint must be local or HTTPS")
            async with httpx.AsyncClient(timeout=120) as client:
                response=await client.post(endpoint,json=r.model_dump(exclude={"rights"}));response.raise_for_status()
                if len(response.content)>30_000_000: raise ValueError("Neural WAV exceeds 30 MB")
                wav=response.content
                if not (wav[:4]==b"RIFF" and wav[8:12]==b"WAVE"): raise ValueError("Model returned invalid WAV")
        (ROOT/f"{jid}.wav").write_bytes(wav)
        job.update(status="completed",download_url=f"/api/v1/synthesis/jobs/{jid}/audio",completed_at=time.time())
    except Exception as e: job.update(status="failed",error=str(e))

@app.get('/api/v1/synthesis/capabilities')
def capabilities():
    return {"engines":{"dsp":{"available":True,"ai":False,"description":"Procedural plucked-string approximation"},"local-neural":{"available":any(MODEL_DIR.glob("*/weights.pt")),"ai":True,"description":"Locally trained harmonic MLP (PyTorch)"},"neural":{"available":bool(os.getenv("NEURAL_MODEL_ENDPOINT")),"ai":True,"description":"Requires separately deployed trained model"}},"model_version":os.getenv("NEURAL_MODEL_VERSION","not-configured")}

@app.post('/api/v1/synthesis/jobs',status_code=202)
async def submit(r:Request):
    if r.engine=="local-neural" and not (MODEL_DIR/r.model_id/"weights.pt").exists():
        raise HTTPException(422,"Select a trained local model")
    if r.engine=="neural" and not os.getenv("NEURAL_MODEL_ENDPOINT"):
        raise HTTPException(422,"Neural model not configured; use DSP or configure NEURAL_MODEL_ENDPOINT")
    jid=str(uuid.uuid4());JOBS[jid]={"id":jid,"status":"queued","parameters":r.model_dump(),"provenance":{"engine":r.engine,"model_version":(r.model_id if r.engine=="local-neural" else os.getenv("NEURAL_MODEL_VERSION","external") if r.engine=="neural" else "procedural-dsp-v1"),"is_ai":r.engine!="dsp","rights":r.rights,"created_at":time.time()}}
    asyncio.create_task(run_job(jid,r));return JOBS[jid]

@app.get('/api/v1/synthesis/jobs/{jid}')
def status(jid:str):
    if jid not in JOBS:raise HTTPException(404,"Unknown job")
    return JOBS[jid]

@app.get('/api/v1/synthesis/jobs/{jid}/audio')
def audio(jid:str):
    if jid not in JOBS:raise HTTPException(404,"Unknown job")
    if JOBS[jid]['status']!='completed':raise HTTPException(409,"Audio not ready")
    return Response((ROOT/f"{jid}.wav").read_bytes(),media_type="audio/wav",headers={"Content-Disposition":f'attachment; filename="opentimbre-{jid}.wav"'})


@app.get('/api/v1/neural/models')
def list_models():
    result=[]
    for path in MODEL_DIR.glob('*/metadata.json'):
        try: result.append({'id':path.parent.name,**json.loads(path.read_text())})
        except (ValueError,OSError): pass
    return {'models':result}

@app.post('/api/v1/neural/datasets/{instrument}/recordings')
async def upload_recording(instrument:Literal['oud','saz'],file:UploadFile=File(...),midi:int=Form(...),velocity:int=Form(90),rights:str=Form(...)):
    if not 24<=midi<=96 or not 1<=velocity<=127:raise HTTPException(422,'Invalid note or velocity')
    if not rights.strip():raise HTTPException(422,'Rights declaration required')
    raw=await file.read(5_000_001)
    if len(raw)>5_000_000:raise HTTPException(413,'Max 5MB per recording')
    try:
        from neural import decode_wav,features
        audio,rate=decode_wav(raw);features(audio,rate,midi)
    except Exception as exc:raise HTTPException(422,str(exc))
    TRAINING.setdefault(instrument,[]).append((midi,velocity,raw))
    return {'instrument':instrument,'recordings':len(TRAINING[instrument]),'note':midi,'rights':rights}

@app.post('/api/v1/neural/models/{instrument}/train')
async def train_model(instrument:Literal['oud','saz']):
    records=TRAINING.get(instrument,[])
    if len(records)<2:raise HTTPException(422,'Upload at least two WAV recordings first')
    try:
        import torch
        from neural import train
        version=instrument+'-'+uuid.uuid4().hex[:8]
        result=await asyncio.to_thread(train,records,MODEL_DIR/version)
        return {'id':version,**result}
    except ImportError:raise HTTPException(503,'PyTorch unavailable; install neural requirements')
    except Exception as exc:raise HTTPException(422,str(exc))

@app.get('/api/v1/neural/datasets')
def dataset_counts():return {'counts':{k:len(v) for k,v in TRAINING.items()},'note':'Uploaded training WAVs are held in process memory and lost on restart; trained models persist on volume.'}
