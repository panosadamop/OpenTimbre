"""Per-user cloud workspace. SQLite metadata and private files; no public URLs."""
import json, os, sqlite3, uuid, time
from pathlib import Path
from fastapi import APIRouter, Request, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
from pydantic import BaseModel, Field
from auth import current

router=APIRouter(prefix='/api/v1/workspace',tags=['Workspace'])
ROOT=Path(os.getenv('WORKSPACE_ROOT',str(Path(__file__).parent/'output'/'workspaces'))).resolve()
ROOT.mkdir(parents=True,exist_ok=True)
DB=ROOT/'workspace.sqlite3'
MAX_FILE=40*1024*1024

def conn():
    db=sqlite3.connect(DB,timeout=15);db.row_factory=sqlite3.Row
    db.execute('PRAGMA journal_mode=WAL')
    db.execute('CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, owner INTEGER NOT NULL, kind TEXT NOT NULL, title TEXT NOT NULL, metadata TEXT NOT NULL, filename TEXT, bytes INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL, updated INTEGER NOT NULL)')
    db.execute('CREATE INDEX IF NOT EXISTS owner_kind ON items(owner,kind)')
    db.execute('CREATE TABLE IF NOT EXISTS library_recordings (owner INTEGER NOT NULL, library_id TEXT NOT NULL, recording_id TEXT NOT NULL, velocity INTEGER NOT NULL DEFAULT 90, PRIMARY KEY(owner,library_id,recording_id))')
    db.execute('CREATE TABLE IF NOT EXISTS trained_models (id TEXT PRIMARY KEY, owner INTEGER NOT NULL, library_id TEXT NOT NULL, instrument TEXT NOT NULL, metadata TEXT NOT NULL, created INTEGER NOT NULL)')
    db.commit();return db

def owner(req):
    user=current(req)
    if not user:raise HTTPException(401,'Authentication required')
    return int(user['id'])

def fetch(db,uid,item_id):
    row=db.execute('SELECT * FROM items WHERE id=? AND owner=?',(item_id,uid)).fetchone()
    if row is None:raise HTTPException(404,'Item not found')
    return row

def present(row):
    d=dict(row);d['metadata']=json.loads(d['metadata']);d.pop('owner',None);d.pop('filename',None);return d

class Item(BaseModel):
    kind:str=Field(pattern='^(song|instrument|model-reference)$')
    title:str=Field(min_length=1,max_length=160)
    metadata:dict=Field(default_factory=dict)

@router.get('/items')
def list_items(request:Request,kind:str|None=None):
    uid=owner(request)
    if kind and kind not in ('song','instrument','model-reference','recording'):raise HTTPException(422,'Invalid kind')
    with conn() as db:
        rows=db.execute('SELECT * FROM items WHERE owner=?'+(' AND kind=?' if kind else '')+' ORDER BY updated DESC', (uid,kind) if kind else (uid,)).fetchall()
    return {'items':[present(x) for x in rows]}

@router.post('/items',status_code=201)
def create_item(request:Request,item:Item):
    uid=owner(request);now=int(time.time());iid=uuid.uuid4().hex
    payload=json.dumps(item.metadata,ensure_ascii=False)
    if len(payload)>1_000_000:raise HTTPException(413,'Metadata too large')
    with conn() as db:
        db.execute('INSERT INTO items VALUES (?,?,?,?,?,?,?,?,?)',(iid,uid,item.kind,item.title,payload,None,0,now,now));db.commit()
        row=fetch(db,uid,iid)
    return present(row)

@router.put('/items/{iid}')
def update_item(iid:str,request:Request,item:Item):
    uid=owner(request);payload=json.dumps(item.metadata,ensure_ascii=False)
    if len(payload)>1_000_000:raise HTTPException(413,'Metadata too large')
    with conn() as db:
        old=fetch(db,uid,iid)
        if old['kind']=='recording' or old['kind']!=item.kind:raise HTTPException(422,'Item kind cannot be changed')
        db.execute('UPDATE items SET title=?,metadata=?,updated=? WHERE id=? AND owner=?',(item.title,payload,int(time.time()),iid,uid));db.commit()
        row=fetch(db,uid,iid)
    return present(row)

@router.delete('/items/{iid}',status_code=204)
def delete_item(iid:str,request:Request):
    uid=owner(request)
    with conn() as db:
        row=fetch(db,uid,iid)
        db.execute('DELETE FROM library_recordings WHERE owner=? AND (library_id=? OR recording_id=?)',(uid,iid,iid))
        db.execute('DELETE FROM items WHERE id=? AND owner=?',(iid,uid));db.commit()
    if row['filename']:
        (ROOT/str(uid)/row['filename']).unlink(missing_ok=True)
    return Response(status_code=204)

@router.post('/recordings',status_code=201)
async def upload_recording(request:Request,file:UploadFile=File(...),title:str=Form('Recording'),instrument:str=Form('oud'),midi:int=Form(60),rights:str=Form('Private - all rights reserved')):
    uid=owner(request)
    if instrument not in ('oud','saz','other') or not 0<=midi<=127 or not rights.strip():raise HTTPException(422,'Invalid metadata')
    raw=await file.read(MAX_FILE+1)
    if len(raw)>MAX_FILE:raise HTTPException(413,'Recording exceeds 40 MB')
    if len(raw)<44 or raw[:4]!=b'RIFF' or raw[8:12]!=b'WAVE':raise HTTPException(422,'Only RIFF WAV files are supported')
    iid=uuid.uuid4().hex;directory=ROOT/str(uid);directory.mkdir(mode=0o700,parents=True,exist_ok=True)
    name=iid+'.wav';(directory/name).write_bytes(raw)
    now=int(time.time());meta=json.dumps({'instrument':instrument,'midi':midi,'rights':rights,'original_name':file.filename})
    try:
        with conn() as db:
            db.execute('INSERT INTO items VALUES (?,?,?,?,?,?,?,?,?)',(iid,uid,'recording',title[:160],meta,name,len(raw),now,now));db.commit()
            row=fetch(db,uid,iid)
    except Exception:
        (directory/name).unlink(missing_ok=True);raise
    return present(row)

@router.get('/recordings/{iid}/audio')
def get_recording(iid:str,request:Request):
    uid=owner(request)
    with conn() as db:row=fetch(db,uid,iid)
    if row['kind']!='recording' or not row['filename']:raise HTTPException(404,'Recording not found')
    path=ROOT/str(uid)/row['filename']
    if not path.is_file():raise HTTPException(404,'Recording missing')
    return Response(path.read_bytes(),media_type='audio/wav',headers={'Content-Disposition':f'attachment; filename="{iid}.wav"','Cache-Control':'private, no-store'})

# Public catalogue exposes only explicitly published instrument metadata, never private WAV files.
@router.get('/catalogue')
def catalogue():
    with conn() as db:
        rows=db.execute("SELECT id,title,metadata,updated FROM items WHERE kind='instrument' ORDER BY updated DESC").fetchall()
    result=[]
    for row in rows:
        meta=json.loads(row['metadata'])
        if meta.get('visibility')=='public' and meta.get('license') in ('CC0-1.0','CC-BY-4.0','MIT'):
            result.append({'id':row['id'],'title':row['title'],'metadata':meta,'updated':row['updated']})
    return {'items':result}

class LinkRecording(BaseModel):
    recording_id:str
    velocity:int=Field(default=90,ge=1,le=127)

@router.get('/libraries/{library_id}/recordings')
def library_recordings(library_id:str,request:Request):
    uid=owner(request)
    with conn() as db:
        library=fetch(db,uid,library_id)
        if library['kind']!='instrument':raise HTTPException(422,'Not an instrument library')
        rows=db.execute("SELECT i.id,i.title,i.metadata,lr.velocity FROM library_recordings lr JOIN items i ON i.id=lr.recording_id AND i.owner=lr.owner WHERE lr.owner=? AND lr.library_id=? ORDER BY i.created",(uid,library_id)).fetchall()
    return {'recordings':[{'id':r['id'],'title':r['title'],'metadata':json.loads(r['metadata']),'velocity':r['velocity']} for r in rows]}

@router.post('/libraries/{library_id}/recordings',status_code=201)
def link_recording(library_id:str,request:Request,body:LinkRecording):
    uid=owner(request)
    with conn() as db:
        library=fetch(db,uid,library_id);recording=fetch(db,uid,body.recording_id)
        if library['kind']!='instrument' or recording['kind']!='recording':raise HTTPException(422,'Expected library and recording')
        if json.loads(library['metadata']).get('instrument')!=json.loads(recording['metadata']).get('instrument'):
            raise HTTPException(422,'Instrument mismatch')
        db.execute('INSERT INTO library_recordings(owner,library_id,recording_id,velocity) VALUES(?,?,?,?) ON CONFLICT(owner,library_id,recording_id) DO UPDATE SET velocity=excluded.velocity',(uid,library_id,body.recording_id,body.velocity));db.commit()
    return {'linked':True}

@router.delete('/libraries/{library_id}/recordings/{recording_id}',status_code=204)
def unlink_recording(library_id:str,recording_id:str,request:Request):
    uid=owner(request)
    with conn() as db:
        if fetch(db,uid,library_id)['kind']!='instrument':raise HTTPException(422,'Not a library')
        db.execute('DELETE FROM library_recordings WHERE owner=? AND library_id=? AND recording_id=?',(uid,library_id,recording_id));db.commit()
    return Response(status_code=204)
