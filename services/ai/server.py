"""OpenTimbre synthesis jobs. No trained model is bundled; DSP is explicitly labelled."""
import asyncio, io, json, math, os, struct, time, uuid, wave, re
from pathlib import Path
from typing import Literal
import httpx
import numpy as np
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field, model_validator

from auth import router as auth_router, current as current_user
from fastapi import Request
from fastapi.responses import JSONResponse

app = FastAPI(title="OpenTimbre Synthesis API", version="0.5.0")
app.include_router(auth_router)
from workspace import router as workspace_router, conn as workspace_conn, fetch as workspace_fetch, ROOT as WORKSPACE_ROOT, owner as workspace_owner
app.include_router(workspace_router)
from admin import router as admin_router
app.include_router(admin_router)
@app.middleware("http")
async def require_login(request:Request,call_next):
    path=request.url.path
    if path.startswith('/api/') and not path.startswith('/api/auth/') and not current_user(request):
        return JSONResponse({'detail':'Authentication required'},status_code=401)
    return await call_next(request)
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:8080").split(","), allow_methods=["GET", "POST"], allow_headers=["Content-Type"])
ROOT = Path(os.getenv("OUTPUT_DIR", Path(__file__).parent / "output")); ROOT.mkdir(parents=True, exist_ok=True)
JOBS: dict[str,dict] = {}
MODEL_DIR=ROOT / "models"
MODEL_DIR.mkdir(exist_ok=True)
TRAINING: dict[str,list] = {}
class AutomationPoint(BaseModel):
    time: float = Field(ge=0,le=1)
    value: float

class Request(BaseModel):
    instrument: Literal["oud","saz"]
    midi: int = Field(ge=24,le=96)
    velocity: int = Field(default=90,ge=1,le=127)
    duration: float = Field(default=2.0,ge=0.15,le=8)
    articulation: Literal["sustain","tremolo","muted","staccato","legato","pluck"] = "sustain"
    cents: float = Field(default=0,ge=-1200,le=1200)
    seed: int = Field(default=42,ge=0,le=2147483647)
    engine: Literal["dsp","neural","local-neural"] = "dsp"
    rights: str = Field(default="User-generated synthetic audio")
    pitch_curve: list[AutomationPoint] = Field(default_factory=list,max_length=32)
    dynamics_curve: list[AutomationPoint] = Field(default_factory=list,max_length=32)
    @model_validator(mode='after')
    def validate_automation(self):
        for point in self.pitch_curve:
            if not -1200 <= point.value <= 1200: raise ValueError('Pitch bend must be within ±1200 cents')
        for point in self.dynamics_curve:
            if not 0 <= point.value <= 2: raise ValueError('Dynamics must be between 0 and 2')
        return self
    model_id: str = Field(default="",pattern=r"^[a-zA-Z0-9_-]*$",max_length=100)

def dsp_wav(r: Request) -> bytes:
    rate=24000; n=int(rate*r.duration); t=np.arange(n,dtype=np.float64)/rate
    from neural import interpolate_curve
    normalized=t/r.duration
    bend=interpolate_curve([(p.time,p.value) for p in r.pitch_curve],normalized,0)
    dynamic=interpolate_curve([(p.time,p.value) for p in r.dynamics_curve],normalized,1)
    f=440*2**((r.midi-69+(r.cents+bend)/100)/12)
    phase=2*np.pi*np.cumsum(f)/rate
    rng=np.random.default_rng(r.seed)
    weights=([1,.5,.28,.14,.07] if r.instrument=="oud" else [1,.68,.39,.23,.12,.07])
    y=np.zeros(n,dtype=np.float64)
    for i,w in enumerate(weights,1):
        y+=w*np.sin(phase*i+rng.uniform(-.03,.03))*np.exp(-t*(1.5+i*.27))
    attack=np.minimum(1,t*180)
    if r.articulation=="muted": y*=np.exp(-t*12)
    if r.articulation=="tremolo": y*=.55+.45*np.maximum(0,np.sin(2*np.pi*9*t))
    y*=attack*np.minimum(1,np.maximum(0,(r.duration-t)*25))*r.velocity/127*dynamic
    y=y/(max(1,float(np.max(np.abs(y)))))*.78
    with io.BytesIO() as out:
        with wave.open(out,"wb") as w:
            w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate)
            w.writeframes((np.clip(y,-1,1)*32767).astype('<i2').tobytes())
        return out.getvalue()

async def run_job(jid: str,r:Request,uid:int):
    job=JOBS[jid];job["status"]="running"
    try:
        if r.engine=="dsp":
            wav=await asyncio.to_thread(dsp_wav,r)
        elif r.engine=="local-neural":
            from neural import render
            model_path=MODEL_DIR / str(uid) / r.model_id
            if not r.model_id or not (model_path/"weights.pt").exists(): raise ValueError("Train and select a local model first")
            wav=await asyncio.to_thread(render,model_path,r.midi,r.velocity,r.duration,r.articulation,r.seed,cents=r.cents,pitch_curve=[(p.time,p.value) for p in r.pitch_curve],dynamics_curve=[(p.time,p.value) for p in r.dynamics_curve])
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
    return {"engines":{"dsp":{"available":True,"ai":False,"description":"Procedural plucked-string approximation"},"local-neural":{"available":any(MODEL_DIR.glob("*/*/weights.pt")),"ai":True,"description":"Locally trained harmonic MLP (PyTorch)"},"neural":{"available":bool(os.getenv("NEURAL_MODEL_ENDPOINT")),"ai":True,"description":"Requires separately deployed trained model"}},"model_version":os.getenv("NEURAL_MODEL_VERSION","not-configured")}

@app.post('/api/v1/synthesis/jobs',status_code=202)
async def submit(r:Request,request:__import__('fastapi').Request):
    uid=workspace_owner(request)
    if r.engine=="local-neural" and not (MODEL_DIR/str(uid)/r.model_id/"weights.pt").exists():
        raise HTTPException(422,"Select a trained local model")
    if r.engine=="neural" and not os.getenv("NEURAL_MODEL_ENDPOINT"):
        raise HTTPException(422,"Neural model not configured; use DSP or configure NEURAL_MODEL_ENDPOINT")
    jid=str(uuid.uuid4());JOBS[jid]={"id":jid,"owner":uid,"status":"queued","parameters":r.model_dump(),"provenance":{"engine":r.engine,"model_version":(r.model_id if r.engine=="local-neural" else os.getenv("NEURAL_MODEL_VERSION","external") if r.engine=="neural" else "procedural-dsp-v1"),"is_ai":r.engine!="dsp","rights":r.rights,"created_at":time.time()}}
    asyncio.create_task(run_job(jid,r,uid));return JOBS[jid]

@app.get('/api/v1/synthesis/jobs/{jid}')
def status(jid:str,request:__import__("fastapi").Request):
    if jid not in JOBS or JOBS[jid]["owner"]!=workspace_owner(request):raise HTTPException(404,"Unknown job")
    return JOBS[jid]

@app.get('/api/v1/synthesis/jobs/{jid}/audio')
def audio(jid:str,request:__import__("fastapi").Request):
    if jid not in JOBS or JOBS[jid]["owner"]!=workspace_owner(request):raise HTTPException(404,"Unknown job")
    if JOBS[jid]['status']!='completed':raise HTTPException(409,"Audio not ready")
    return Response((ROOT/f"{jid}.wav").read_bytes(),media_type="audio/wav",headers={"Content-Disposition":f'attachment; filename="opentimbre-{jid}.wav"'})


@app.get('/api/v1/neural/models')
def list_models(request:__import__('fastapi').Request):
    uid=workspace_owner(request)
    result=[]
    for path in (MODEL_DIR/str(uid)).glob('*/metadata.json'):
        try: result.append({'id':path.parent.name,**json.loads(path.read_text())})
        except (ValueError,OSError): pass
    return {'models':result}

@app.get('/api/v1/neural/datasets')
def dataset_counts(request:__import__('fastapi').Request):
    uid=workspace_owner(request)
    with workspace_conn() as db:
        rows=db.execute('SELECT library_id,COUNT(*) AS count FROM library_recordings WHERE owner=? GROUP BY library_id',(uid,)).fetchall()
    return {'libraries':{r['library_id']:r['count'] for r in rows},'note':'Persistent private workspace recordings'}

class TrainLibrary(BaseModel):
    library_id:str
    epochs:int=Field(default=180,ge=10,le=500)

@app.post('/api/v1/neural/train-library')
async def train_library(body:TrainLibrary,request:__import__('fastapi').Request):
    uid=workspace_owner(request)
    with workspace_conn() as db:
        library=workspace_fetch(db,uid,body.library_id)
        if library['kind']!='instrument':raise HTTPException(422,'Not an instrument library')
        instrument=json.loads(library['metadata']).get('instrument')
        if instrument not in ('oud','saz'):raise HTTPException(422,'Only oud and saz supported for training')
        rows=db.execute('SELECT i.filename,i.metadata,lr.velocity FROM library_recordings lr JOIN items i ON i.id=lr.recording_id AND i.owner=lr.owner WHERE lr.owner=? AND lr.library_id=?',(uid,body.library_id)).fetchall()
        if len(rows)<2:raise HTTPException(422,'Link at least two WAV recordings to this library')
        records=[]
        for row in rows:
            meta=json.loads(row['metadata'])
            if not row['filename']:raise HTTPException(422,'Missing recording file')
            records.append({'midi':int(meta['midi']),'velocity':int(meta.get('velocity',row['velocity'])),'cents':float(meta.get('cents',0)),'articulation':meta.get('articulation','sustain'),'raw':(WORKSPACE_ROOT/str(uid)/row['filename']).read_bytes()})
    from neural import decode_wav,features,train
    try:
        for record in records:
            audio,rate=decode_wav(record['raw']);features(audio,rate,record['midi'],record['cents'])
        model_id=instrument+'-'+uuid.uuid4().hex[:12]
        path=MODEL_DIR/str(uid)/model_id
        result=await asyncio.to_thread(train,records,path,body.epochs)
        result.update({'library_id':body.library_id,'instrument':instrument,'owner_scoped':True})
        (path/'metadata.json').write_text(json.dumps(result,indent=2))
        with workspace_conn() as db:
            db.execute('INSERT INTO trained_models VALUES(?,?,?,?,?,?)',(model_id,uid,body.library_id,instrument,json.dumps(result),int(time.time())));db.commit()
        return {'id':model_id,**result}
    except (ValueError,OSError) as exc:raise HTTPException(422,str(exc))
    except ImportError:raise HTTPException(503,'PyTorch unavailable')

@app.post('/api/v1/recordings/analyze')
async def analyze_recording(request: __import__('fastapi').Request, file: UploadFile = File(...)):
    """Authenticated WAV inspection: pitch estimate, level, clipping and quality warnings."""
    workspace_owner(request)
    if not file.filename or not file.filename.lower().endswith('.wav'):
        raise HTTPException(415,'Upload a PCM WAV file')
    content=await file.read(40_000_001)
    try:
        from audio_analysis import analyze_wav
        return analyze_wav(content)
    except ValueError as exc:
        raise HTTPException(422,str(exc)) from exc
