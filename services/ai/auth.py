"""OpenTimbre authentication: SQLite identities, secure cookies, Google and GitHub OAuth."""
import os, sqlite3, secrets, time, re
from pathlib import Path
from urllib.parse import urlencode
import httpx
import jwt
from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr, Field
from pwdlib import PasswordHash
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

router=APIRouter(prefix="/api/auth",tags=["Authentication"])
DB=Path(os.getenv("AUTH_DB_PATH",str(Path(__file__).parent/'output'/'auth.sqlite3')))
DB.parent.mkdir(parents=True,exist_ok=True)
SECRET=os.getenv('AUTH_SECRET','')
if len(SECRET)<32:
    raise RuntimeError('Set AUTH_SECRET to a random secret of at least 32 characters')
SECURE=os.getenv('AUTH_COOKIE_SECURE','false').lower()=='true'
COOKIE='opentimbre_session'
ph=PasswordHash.recommended()

def connect():
    db=sqlite3.connect(DB,timeout=15)
    db.row_factory=sqlite3.Row
    db.execute('PRAGMA journal_mode=WAL')
    db.execute('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, password TEXT, provider TEXT NOT NULL, created_at INTEGER NOT NULL)')
    db.execute('CREATE TABLE IF NOT EXISTS roles (user_id INTEGER PRIMARY KEY, role TEXT NOT NULL CHECK(role IN ("user","superadmin")), FOREIGN KEY(user_id) REFERENCES users(id))')
    db.commit()
    return db

def session(response,user):
    token=jwt.encode({'sub':str(user['id']),'exp':int(time.time())+86400,'iat':int(time.time())},SECRET,algorithm='HS256')
    response.set_cookie(COOKIE,token,httponly=True,secure=SECURE,samesite='lax',max_age=86400,path='/')

def current(request):
    token=request.cookies.get(COOKIE)
    if not token:return None
    try:
        uid=int(jwt.decode(token,SECRET,algorithms=['HS256'])['sub'])
        with connect() as db:
            row=db.execute('SELECT u.id,u.email,u.name,u.provider,COALESCE(r.role,"user") AS role FROM users u LEFT JOIN roles r ON r.user_id=u.id WHERE u.id=?',(uid,)).fetchone()
            return dict(row) if row else None
    except (jwt.PyJWTError,ValueError,KeyError):return None

class Register(BaseModel):
    email:EmailStr
    name:str=Field(min_length=1,max_length=100)
    password:str=Field(min_length=12,max_length=128)
class Login(BaseModel):
    email:EmailStr
    password:str
class GoogleToken(BaseModel):
    credential:str

@router.post('/register',status_code=201)
def register(body:Register,response:Response):
    email=str(body.email).lower()
    with connect() as db:
        if db.execute('SELECT 1 FROM users WHERE email=?',(email,)).fetchone():raise HTTPException(409,'Account already exists')
        db.execute('INSERT INTO users(email,name,password,provider,created_at) VALUES(?,?,?,?,?)',(email,body.name.strip(),ph.hash(body.password),'password',int(time.time())))
        db.commit()
        user=dict(db.execute('SELECT id,email,name,provider FROM users WHERE email=?',(email,)).fetchone())
    session(response,user)
    return user

@router.post('/login')
def login(body:Login,response:Response):
    with connect() as db: row=db.execute('SELECT * FROM users WHERE email=?',(str(body.email).lower(),)).fetchone()
    if not row or not row['password'] or not ph.verify(body.password,row['password']):raise HTTPException(401,'Invalid credentials')
    user={k:row[k] for k in ('id','email','name','provider')}
    session(response,user)
    return user

@router.get('/me')
def me(request:Request):
    user=current(request)
    if not user:raise HTTPException(401,'Not authenticated')
    return user

@router.post('/logout')
def logout(response:Response):
    response.delete_cookie(COOKIE,path='/')
    return {'ok':True}

def social_user(email,name,provider):
    with connect() as db:
        row=db.execute('SELECT id,email,name,provider FROM users WHERE email=?',(email.lower(),)).fetchone()
        if row:
            if row['provider']!=provider:raise HTTPException(409,'Email already registered with another sign-in method')
            return dict(row)
        db.execute('INSERT INTO users(email,name,password,provider,created_at) VALUES(?,?,?,?,?)',(email.lower(),name,None,provider,int(time.time())))
        db.commit()
        return dict(db.execute('SELECT id,email,name,provider FROM users WHERE email=?',(email.lower(),)).fetchone())

@router.post('/google')
def google_login(body:GoogleToken,response:Response):
    client=os.getenv('GOOGLE_CLIENT_ID','')
    if not client:raise HTTPException(503,'Google login not configured')
    try: claims=id_token.verify_oauth2_token(body.credential,google_requests.Request(),client)
    except (ValueError,Exception):raise HTTPException(401,'Invalid Google token')
    if not claims.get('email_verified'):raise HTTPException(401,'Google email not verified')
    user=social_user(claims['email'],claims.get('name',claims['email']),'google')
    session(response,user)
    return user

@router.get('/github/start')
def github_start():
    client=os.getenv('GITHUB_CLIENT_ID','')
    if not client:raise HTTPException(503,'GitHub login not configured')
    state=secrets.token_urlsafe(32)
    url='https://github.com/login/oauth/authorize?'+urlencode({'client_id':client,'scope':'read:user user:email','state':state})
    response=RedirectResponse(url)
    response.set_cookie('ot_oauth_state',state,httponly=True,secure=SECURE,samesite='lax',max_age=600,path='/api/auth/github')
    return response

@router.get('/github/callback')
async def github_callback(request:Request,code:str='',state:str=''):
    expected=request.cookies.get('ot_oauth_state')
    if not expected or not secrets.compare_digest(state,expected) or not code:raise HTTPException(400,'Invalid OAuth state')
    client=os.getenv('GITHUB_CLIENT_ID',''); secret=os.getenv('GITHUB_CLIENT_SECRET','')
    if not client or not secret:raise HTTPException(503,'GitHub login not configured')
    async with httpx.AsyncClient(timeout=15) as http:
        result=await http.post('https://github.com/login/oauth/access_token',data={'client_id':client,'client_secret':secret,'code':code,'state':state},headers={'Accept':'application/json'})
        result.raise_for_status()
        token=result.json().get('access_token')
        if not token:raise HTTPException(401,'GitHub authorization failed')
        headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json'}
        profile=await http.get('https://api.github.com/user',headers=headers)
        emails=await http.get('https://api.github.com/user/emails',headers=headers)
        profile.raise_for_status();emails.raise_for_status()
        verified=[e for e in emails.json() if e.get('verified')]
        email=next((e['email'] for e in verified if e.get('primary')),verified[0]['email'] if verified else None)
        if not email:raise HTTPException(400,'A verified GitHub email is required')
        name=profile.json().get('name') or profile.json().get('login') or email
    user=social_user(email,name,'github')
    response=RedirectResponse('/')
    session(response,user)
    response.delete_cookie('ot_oauth_state',path='/api/auth/github')
    return response
