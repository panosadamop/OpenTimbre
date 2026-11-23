"""OpenTimbre authentication: SQLite identities, roles/permissions, secure cookies, Google and GitHub OAuth."""
import os, sqlite3, secrets, time, json
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

# --------------------------------------------------------------------------
# Permission catalogue and built-in roles
# --------------------------------------------------------------------------

PERMISSIONS={
    'workspace.use':      {'group':'studio','en':'Cloud workspace','el':'Cloud workspace','description':'Save songs, upload recordings and manage instrument libraries.'},
    'catalogue.publish':  {'group':'studio','en':'Publish to catalogue','el':'Δημοσίευση στον κατάλογο','description':'Make instrument library metadata public.'},
    'synthesis.use':      {'group':'studio','en':'Synthesis','el':'Σύνθεση ήχου','description':'Run DSP and neural synthesis jobs.'},
    'neural.train':       {'group':'studio','en':'Neural training','el':'Εκπαίδευση μοντέλων','description':'Train neural models on linked recordings.'},
    'recordings.analyze': {'group':'studio','en':'Recording analysis','el':'Ανάλυση ηχογραφήσεων','description':'Use the AI recording assistant.'},
    'users.view':         {'group':'admin','en':'View users','el':'Προβολή χρηστών','description':'See the user list and account details.'},
    'users.manage':       {'group':'admin','en':'Manage users','el':'Διαχείριση χρηστών','description':'Create, edit, disable, reset passwords and delete users.'},
    'roles.manage':       {'group':'admin','en':'Manage roles','el':'Διαχείριση ρόλων','description':'Create and edit roles, and assign roles to users.'},
    'audit.view':         {'group':'admin','en':'View activity log','el':'Προβολή ιστορικού','description':'See the audit log of sign-ins and admin actions.'},
}
STUDIO=[p for p,v in PERMISSIONS.items() if v['group']=='studio']
BUILTIN_ROLES={
    'superadmin':{'label':'Superadmin','description':'Full access to everything. Cannot be edited.','permissions':list(PERMISSIONS)},
    'admin':{'label':'Administrator','description':'Manages user accounts and sees the activity log.','permissions':STUDIO+['users.view','users.manage','audit.view']},
    'user':{'label':'User','description':'Default role for new accounts.','permissions':list(STUDIO)},
}
DEFAULT_ROLE='user'
_migrated:set[str]=set()

def _migrate(db):
    db.execute('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, password TEXT, provider TEXT NOT NULL, created_at INTEGER NOT NULL)')
    cols={r[1] for r in db.execute('PRAGMA table_info(users)')}
    for col,ddl in (('disabled','INTEGER NOT NULL DEFAULT 0'),('token_version','INTEGER NOT NULL DEFAULT 0'),('last_login','INTEGER'),('updated_at','INTEGER')):
        if col not in cols: db.execute(f'ALTER TABLE users ADD COLUMN {col} {ddl}')
    # v0.6 created roles with CHECK(role IN ("user","superadmin")); custom roles need it gone.
    old=db.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='roles'").fetchone()
    if old and 'CHECK' in (old[0] or ''):
        db.execute('CREATE TABLE roles_new (user_id INTEGER PRIMARY KEY, role TEXT NOT NULL, FOREIGN KEY(user_id) REFERENCES users(id))')
        db.execute('INSERT INTO roles_new(user_id,role) SELECT user_id,role FROM roles')
        db.execute('DROP TABLE roles')
        db.execute('ALTER TABLE roles_new RENAME TO roles')
    db.execute('CREATE TABLE IF NOT EXISTS roles (user_id INTEGER PRIMARY KEY, role TEXT NOT NULL, FOREIGN KEY(user_id) REFERENCES users(id))')
    db.execute('CREATE TABLE IF NOT EXISTS role_defs (name TEXT PRIMARY KEY, label TEXT NOT NULL, description TEXT NOT NULL DEFAULT "", permissions TEXT NOT NULL, builtin INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)')
    db.execute('CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, actor_id INTEGER, actor_email TEXT, action TEXT NOT NULL, target_type TEXT, target_id TEXT, target_label TEXT, details TEXT NOT NULL DEFAULT "{}")')
    db.execute('CREATE INDEX IF NOT EXISTS audit_at ON audit_log(at DESC)')
    now=int(time.time())
    for name,r in BUILTIN_ROLES.items():
        db.execute('INSERT OR IGNORE INTO role_defs(name,label,description,permissions,builtin,created_at,updated_at) VALUES(?,?,?,?,1,?,?)',(name,r['label'],r['description'],json.dumps(r['permissions']),now,now))
    # Superadmin always holds every permission, including ones added in later versions.
    db.execute('UPDATE role_defs SET permissions=?,builtin=1 WHERE name="superadmin"',(json.dumps(list(PERMISSIONS)),))
    db.commit()

def connect():
    db=sqlite3.connect(DB,timeout=15)
    db.row_factory=sqlite3.Row
    db.execute('PRAGMA journal_mode=WAL')
    if str(DB) not in _migrated:
        _migrate(db); _migrated.add(str(DB))
    return db

def role_permissions(db,role):
    row=db.execute('SELECT permissions FROM role_defs WHERE name=?',(role,)).fetchone()
    if not row:  # role row missing (e.g. deleted out-of-band): fall back to the default role
        row=db.execute('SELECT permissions FROM role_defs WHERE name=?',(DEFAULT_ROLE,)).fetchone()
    return [p for p in json.loads(row['permissions']) if p in PERMISSIONS] if row else []

def audit(db,actor,action,target_type=None,target_id=None,target_label=None,**details):
    db.execute('INSERT INTO audit_log(at,actor_id,actor_email,action,target_type,target_id,target_label,details) VALUES(?,?,?,?,?,?,?,?)',
               (int(time.time()),actor['id'] if actor else None,actor['email'] if actor else None,action,target_type,None if target_id is None else str(target_id),target_label,json.dumps(details)))

# --------------------------------------------------------------------------
# Sessions
# --------------------------------------------------------------------------

def session(response,user):
    now=int(time.time())
    token=jwt.encode({'sub':str(user['id']),'tv':int(user.get('token_version') or 0),'exp':now+86400,'iat':now},SECRET,algorithm='HS256')
    response.set_cookie(COOKIE,token,httponly=True,secure=SECURE,samesite='lax',max_age=86400,path='/')

USER_SQL='SELECT u.id,u.email,u.name,u.provider,u.disabled,u.token_version,COALESCE(r.role,"user") AS role FROM users u LEFT JOIN roles r ON r.user_id=u.id'

def current(request):
    """The signed-in user with role and permissions, or None. Disabled accounts and revoked tokens yield None."""
    token=request.cookies.get(COOKIE)
    if not token:return None
    try:
        claims=jwt.decode(token,SECRET,algorithms=['HS256'])
        uid=int(claims['sub'])
        with connect() as db:
            row=db.execute(USER_SQL+' WHERE u.id=?',(uid,)).fetchone()
            if not row or row['disabled'] or int(claims.get('tv',0))!=row['token_version']:return None
            user={k:row[k] for k in ('id','email','name','provider','role')}
            user['permissions']=role_permissions(db,row['role'])
            return user
    except (jwt.PyJWTError,ValueError,KeyError):return None

def require(request,*perms):
    """Return the current user if they hold every permission in `perms`, else raise 401/403."""
    user=current(request)
    if not user:raise HTTPException(401,'Authentication required')
    missing=[p for p in perms if p not in user['permissions']]
    if missing:raise HTTPException(403,'Missing permission: '+', '.join(missing))
    return user

def _signed_in(db,row,response,method):
    if row['disabled']:
        audit(db,{'id':row['id'],'email':row['email']},'auth.login_blocked','user',row['id'],row['email'],method=method);db.commit()
        raise HTTPException(403,'This account is disabled. Contact an administrator.')
    db.execute('UPDATE users SET last_login=? WHERE id=?',(int(time.time()),row['id']))
    audit(db,{'id':row['id'],'email':row['email']},'auth.login','user',row['id'],row['email'],method=method);db.commit()
    session(response,dict(row))
    return {k:row[k] for k in ('id','email','name','provider')}

# --------------------------------------------------------------------------
# Endpoints
# --------------------------------------------------------------------------

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
        db.execute('INSERT INTO users(email,name,password,provider,created_at,last_login) VALUES(?,?,?,?,?,?)',(email,body.name.strip(),ph.hash(body.password),'password',int(time.time()),int(time.time())))
        row=db.execute('SELECT * FROM users WHERE email=?',(email,)).fetchone()
        audit(db,{'id':row['id'],'email':email},'auth.register','user',row['id'],email)
        db.commit()
    session(response,dict(row))
    return {k:row[k] for k in ('id','email','name','provider')}

@router.post('/login')
def login(body:Login,response:Response):
    email=str(body.email).lower()
    with connect() as db:
        row=db.execute('SELECT * FROM users WHERE email=?',(email,)).fetchone()
        if not row or not row['password'] or not ph.verify(body.password,row['password']):
            audit(db,None,'auth.login_failed','user',row['id'] if row else None,email);db.commit()
            raise HTTPException(401,'Invalid credentials')
        return _signed_in(db,row,response,'password')

@router.get('/me')
def me(request:Request):
    user=current(request)
    if not user:raise HTTPException(401,'Not authenticated')
    return user

@router.post('/logout')
def logout(response:Response):
    response.delete_cookie(COOKIE,path='/')
    return {'ok':True}

def social_user(email,name,provider,response):
    with connect() as db:
        row=db.execute('SELECT * FROM users WHERE email=?',(email.lower(),)).fetchone()
        if row:
            if row['provider']!=provider:raise HTTPException(409,'Email already registered with another sign-in method')
        else:
            db.execute('INSERT INTO users(email,name,password,provider,created_at) VALUES(?,?,?,?,?)',(email.lower(),name,None,provider,int(time.time())))
            row=db.execute('SELECT * FROM users WHERE email=?',(email.lower(),)).fetchone()
            audit(db,{'id':row['id'],'email':row['email']},'auth.register','user',row['id'],row['email'],method=provider)
            db.commit()
        return _signed_in(db,row,response,provider)

@router.post('/google')
def google_login(body:GoogleToken,response:Response):
    client=os.getenv('GOOGLE_CLIENT_ID','')
    if not client:raise HTTPException(503,'Google login not configured')
    try: claims=id_token.verify_oauth2_token(body.credential,google_requests.Request(),client)
    except (ValueError,Exception):raise HTTPException(401,'Invalid Google token')
    if not claims.get('email_verified'):raise HTTPException(401,'Google email not verified')
    return social_user(claims['email'],claims.get('name',claims['email']),'google',response)

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
    response=RedirectResponse('/')
    social_user(email,name,'github',response)
    response.delete_cookie('ot_oauth_state',path='/api/auth/github')
    return response
