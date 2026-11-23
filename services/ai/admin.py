"""User, role and audit administration.

Safeguards enforced here (never trust the UI):
- every endpoint checks a specific permission;
- only a superadmin may create, modify or delete a superadmin, or grant the superadmin role;
- nobody can grant a role, or give a role permissions, beyond what they hold themselves;
- you cannot disable, delete or change the role of your own account;
- at least one active superadmin must always remain.
"""
import json, os, re, secrets, shutil, string, time
from pathlib import Path
from typing import Literal
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr, Field
from auth import PERMISSIONS, DEFAULT_ROLE, USER_SQL, audit, connect, ph, require, role_permissions

router=APIRouter(prefix='/api/v1/admin',tags=['Administration'])
ROLE_NAME=re.compile(r'^[a-z][a-z0-9_-]{1,31}$')
MODEL_DIR=Path(os.getenv('OUTPUT_DIR',str(Path(__file__).parent/'output')))/'models'

def generate_password():
    alphabet=string.ascii_letters+string.digits
    return '-'.join(''.join(secrets.choice(alphabet) for _ in range(5)) for _ in range(4))

def user_row(db,uid):
    row=db.execute(USER_SQL.replace('SELECT ','SELECT u.created_at,u.last_login,u.updated_at,',1)+' WHERE u.id=?',(uid,)).fetchone()
    if not row:raise HTTPException(404,'User not found')
    return row

def present_user(row):
    d={k:row[k] for k in ('id','email','name','provider','role','created_at','last_login','updated_at')}
    d['disabled']=bool(row['disabled'])
    return d

def role_def(db,name):
    row=db.execute('SELECT * FROM role_defs WHERE name=?',(name,)).fetchone()
    if not row:raise HTTPException(404,f'Role "{name}" not found')
    return row

def active_superadmins(db,excluding=None):
    q='SELECT COUNT(*) FROM users u JOIN roles r ON r.user_id=u.id WHERE r.role="superadmin" AND u.disabled=0'
    args=()
    if excluding is not None:q+=' AND u.id<>?';args=(excluding,)
    return db.execute(q,args).fetchone()[0]

def is_super(actor):return actor['role']=='superadmin'

def guard_target(actor,target):
    if target['role']=='superadmin' and not is_super(actor):
        raise HTTPException(403,'Only a superadmin can modify a superadmin account')

def guard_grant(db,actor,role_name):
    """Actor may assign `role_name` only if its permissions are a subset of their own."""
    perms=set(json.loads(role_def(db,role_name)['permissions']))
    if role_name=='superadmin' and not is_super(actor):raise HTTPException(403,'Only a superadmin can grant the superadmin role')
    excess=perms-set(actor['permissions'])
    if excess:raise HTTPException(403,'You cannot grant permissions you do not hold: '+', '.join(sorted(excess)))

def bump_sessions(db,uid):
    db.execute('UPDATE users SET token_version=token_version+1 WHERE id=?',(uid,))

# --------------------------------------------------------------------------
# Overview
# --------------------------------------------------------------------------

@router.get('/permissions')
def permissions(request:Request):
    require(request,'users.view')
    return {'permissions':[{'name':k,**v} for k,v in PERMISSIONS.items()]}

@router.get('/summary')
def summary(request:Request):
    require(request,'users.view')
    week=int(time.time())-7*86400
    with connect() as db:
        total,disabled,new,active=db.execute('SELECT COUNT(*),SUM(disabled),SUM(created_at>=?),SUM(COALESCE(last_login,0)>=?) FROM users',(week,week)).fetchone()
        roles=db.execute('SELECT COALESCE(r.role,"user") AS role,COUNT(*) AS n FROM users u LEFT JOIN roles r ON r.user_id=u.id GROUP BY 1').fetchall()
    return {'users':total,'disabled':disabled or 0,'new_7d':new or 0,'active_7d':active or 0,'by_role':{r['role']:r['n'] for r in roles}}

# --------------------------------------------------------------------------
# Users
# --------------------------------------------------------------------------

@router.get('/users')
def list_users(request:Request,q:str='',role:str='',status:Literal['','active','disabled']=''):
    require(request,'users.view')
    sql=USER_SQL.replace('SELECT ','SELECT u.created_at,u.last_login,u.updated_at,',1)+' WHERE 1=1'
    args:list=[]
    if q.strip():sql+=' AND (u.email LIKE ? OR u.name LIKE ?)';args+=[f'%{q.strip()}%']*2
    if role:sql+=' AND COALESCE(r.role,"user")=?';args.append(role)
    if status:sql+=' AND u.disabled=?';args.append(1 if status=='disabled' else 0)
    with connect() as db:
        rows=db.execute(sql+' ORDER BY u.id',args).fetchall()
    return {'users':[present_user(r) for r in rows]}

class CreateUser(BaseModel):
    email:EmailStr
    name:str=Field(min_length=1,max_length=100)
    password:str|None=Field(default=None,min_length=12,max_length=128)
    role:str=DEFAULT_ROLE

@router.post('/users',status_code=201)
def create_user(body:CreateUser,request:Request):
    actor=require(request,'users.manage')
    email=str(body.email).lower()
    with connect() as db:
        role_def(db,body.role)
        if body.role!=DEFAULT_ROLE:
            if 'roles.manage' not in actor['permissions']:raise HTTPException(403,'Assigning a role requires the roles.manage permission')
            guard_grant(db,actor,body.role)
        if db.execute('SELECT 1 FROM users WHERE email=?',(email,)).fetchone():raise HTTPException(409,'A user with this email already exists')
        password=body.password or generate_password()
        now=int(time.time())
        db.execute('INSERT INTO users(email,name,password,provider,created_at,updated_at) VALUES(?,?,?,?,?,?)',(email,body.name.strip(),ph.hash(password),'password',now,now))
        uid=db.execute('SELECT id FROM users WHERE email=?',(email,)).fetchone()['id']
        db.execute('INSERT INTO roles(user_id,role) VALUES(?,?)',(uid,body.role))
        audit(db,actor,'user.create','user',uid,email,role=body.role)
        db.commit()
        result=present_user(user_row(db,uid))
    if not body.password:result['generated_password']=password
    return result

class UpdateUser(BaseModel):
    name:str|None=Field(default=None,min_length=1,max_length=100)
    email:EmailStr|None=None
    role:str|None=None
    disabled:bool|None=None

@router.patch('/users/{uid}')
def update_user(uid:int,body:UpdateUser,request:Request):
    actor=require(request,'users.manage')
    with connect() as db:
        target=user_row(db,uid)
        guard_target(actor,target)
        changes={}
        if body.name is not None and body.name.strip()!=target['name']:
            db.execute('UPDATE users SET name=? WHERE id=?',(body.name.strip(),uid));changes['name']=body.name.strip()
        if body.email is not None and str(body.email).lower()!=target['email']:
            if target['provider']!='password':raise HTTPException(409,f'This account signs in with {target["provider"]}; its email cannot be changed')
            email=str(body.email).lower()
            if db.execute('SELECT 1 FROM users WHERE email=? AND id<>?',(email,uid)).fetchone():raise HTTPException(409,'A user with this email already exists')
            db.execute('UPDATE users SET email=? WHERE id=?',(email,uid));changes['email']=email
        if body.role is not None and body.role!=target['role']:
            if 'roles.manage' not in actor['permissions']:raise HTTPException(403,'Changing roles requires the roles.manage permission')
            if uid==actor['id']:raise HTTPException(409,'You cannot change your own role')
            role_def(db,body.role);guard_grant(db,actor,body.role)
            if target['role']=='superadmin' and not target['disabled'] and active_superadmins(db,excluding=uid)==0:
                raise HTTPException(409,'At least one active superadmin must remain')
            db.execute('INSERT INTO roles(user_id,role) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET role=excluded.role',(uid,body.role))
            changes['role']={'from':target['role'],'to':body.role}
        if body.disabled is not None and body.disabled!=bool(target['disabled']):
            if uid==actor['id']:raise HTTPException(409,'You cannot disable your own account')
            if body.disabled and target['role']=='superadmin' and active_superadmins(db,excluding=uid)==0:
                raise HTTPException(409,'At least one active superadmin must remain')
            db.execute('UPDATE users SET disabled=? WHERE id=?',(int(body.disabled),uid))
            if body.disabled:bump_sessions(db,uid)
            changes['disabled']=body.disabled
        if changes:
            db.execute('UPDATE users SET updated_at=? WHERE id=?',(int(time.time()),uid))
            for key,value in changes.items():
                action={'role':'user.role','disabled':'user.disable' if value is True else 'user.enable'}.get(key,'user.update')
                audit(db,actor,action,'user',uid,target['email'],**({key:value} if key not in ('disabled',) else {}))
            db.commit()
        return present_user(user_row(db,uid))

class PasswordReset(BaseModel):
    password:str|None=Field(default=None,min_length=12,max_length=128)

@router.post('/users/{uid}/password')
def reset_password(uid:int,body:PasswordReset,request:Request):
    actor=require(request,'users.manage')
    with connect() as db:
        target=user_row(db,uid);guard_target(actor,target)
        if target['provider']!='password':raise HTTPException(409,f'This account signs in with {target["provider"]} and has no password')
        password=body.password or generate_password()
        db.execute('UPDATE users SET password=?,updated_at=? WHERE id=?',(ph.hash(password),int(time.time()),uid))
        bump_sessions(db,uid)
        audit(db,actor,'user.password_reset','user',uid,target['email'],generated=not body.password)
        db.commit()
    return {'ok':True,**({'generated_password':password} if not body.password else {})}

@router.post('/users/{uid}/revoke-sessions')
def revoke_sessions(uid:int,request:Request):
    actor=require(request,'users.manage')
    with connect() as db:
        target=user_row(db,uid);guard_target(actor,target)
        bump_sessions(db,uid)
        audit(db,actor,'user.sessions_revoked','user',uid,target['email'])
        db.commit()
    return {'ok':True}

@router.delete('/users/{uid}',status_code=204)
def delete_user(uid:int,request:Request):
    actor=require(request,'users.manage')
    with connect() as db:
        target=user_row(db,uid);guard_target(actor,target)
        if uid==actor['id']:raise HTTPException(409,'You cannot delete your own account')
        if target['role']=='superadmin' and not target['disabled'] and active_superadmins(db,excluding=uid)==0:
            raise HTTPException(409,'At least one active superadmin must remain')
        from workspace import purge_owner
        removed=purge_owner(uid)
        shutil.rmtree(MODEL_DIR/str(uid),ignore_errors=True)
        db.execute('DELETE FROM roles WHERE user_id=?',(uid,))
        db.execute('DELETE FROM users WHERE id=?',(uid,))
        audit(db,actor,'user.delete','user',uid,target['email'],workspace_items=removed)
        db.commit()
    return Response(status_code=204)

# --------------------------------------------------------------------------
# Roles
# --------------------------------------------------------------------------

def present_role(db,row):
    count=db.execute('SELECT COUNT(*) FROM users u LEFT JOIN roles r ON r.user_id=u.id WHERE COALESCE(r.role,"user")=?',(row['name'],)).fetchone()[0]
    return {'name':row['name'],'label':row['label'],'description':row['description'],'permissions':[p for p in json.loads(row['permissions']) if p in PERMISSIONS],
            'builtin':bool(row['builtin']),'locked':row['name']=='superadmin','users':count,'created_at':row['created_at'],'updated_at':row['updated_at']}

@router.get('/roles')
def list_roles(request:Request):
    require(request,'users.view')
    with connect() as db:
        rows=db.execute('SELECT * FROM role_defs ORDER BY builtin DESC, CASE name WHEN "superadmin" THEN 0 WHEN "admin" THEN 1 WHEN "user" THEN 2 ELSE 3 END, label').fetchall()
        return {'roles':[present_role(db,r) for r in rows]}

def clean_permissions(actor,perms):
    unknown=[p for p in perms if p not in PERMISSIONS]
    if unknown:raise HTTPException(422,'Unknown permission: '+', '.join(unknown))
    excess=set(perms)-set(actor['permissions'])
    if excess:raise HTTPException(403,'You cannot grant permissions you do not hold: '+', '.join(sorted(excess)))
    return [p for p in PERMISSIONS if p in perms]  # canonical order, no duplicates

class CreateRole(BaseModel):
    name:str=Field(min_length=2,max_length=32)
    label:str=Field(min_length=1,max_length=60)
    description:str=Field(default='',max_length=240)
    permissions:list[str]=Field(default_factory=list)

@router.post('/roles',status_code=201)
def create_role(body:CreateRole,request:Request):
    actor=require(request,'roles.manage')
    name=body.name.strip().lower()
    if not ROLE_NAME.match(name):raise HTTPException(422,'Role id must be 2–32 characters: lowercase letters, digits, - or _, starting with a letter')
    perms=clean_permissions(actor,body.permissions)
    with connect() as db:
        if db.execute('SELECT 1 FROM role_defs WHERE name=?',(name,)).fetchone():raise HTTPException(409,'A role with this id already exists')
        now=int(time.time())
        db.execute('INSERT INTO role_defs(name,label,description,permissions,builtin,created_at,updated_at) VALUES(?,?,?,?,0,?,?)',(name,body.label.strip(),body.description.strip(),json.dumps(perms),now,now))
        audit(db,actor,'role.create','role',name,body.label.strip(),permissions=perms)
        db.commit()
        return present_role(db,role_def(db,name))

class UpdateRole(BaseModel):
    label:str|None=Field(default=None,min_length=1,max_length=60)
    description:str|None=Field(default=None,max_length=240)
    permissions:list[str]|None=None

@router.patch('/roles/{name}')
def update_role(name:str,body:UpdateRole,request:Request):
    actor=require(request,'roles.manage')
    with connect() as db:
        row=role_def(db,name)
        if name=='superadmin':raise HTTPException(409,'The superadmin role cannot be edited')
        changes={}
        if body.label is not None and body.label.strip()!=row['label']:changes['label']=body.label.strip()
        if body.description is not None and body.description.strip()!=row['description']:changes['description']=body.description.strip()
        if body.permissions is not None:
            perms=clean_permissions(actor,body.permissions)
            old=json.loads(row['permissions'])
            # Removing a permission the actor lacks would also be an escalation path in reverse; only touch what you hold.
            hidden=[p for p in old if p not in actor['permissions']]
            perms=[p for p in PERMISSIONS if p in set(perms)|set(hidden)]
            if name==actor['role'] and not set(['roles.manage']).issubset(perms):
                raise HTTPException(409,'You cannot remove roles.manage from your own role')
            if perms!=old:changes['permissions']=perms
        if changes:
            db.execute('UPDATE role_defs SET label=?,description=?,permissions=?,updated_at=? WHERE name=?',
                       (changes.get('label',row['label']),changes.get('description',row['description']),json.dumps(changes.get('permissions',json.loads(row['permissions']))),int(time.time()),name))
            audit(db,actor,'role.update','role',name,changes.get('label',row['label']),**changes)
            db.commit()
        return present_role(db,role_def(db,name))

@router.delete('/roles/{name}',status_code=204)
def delete_role(name:str,request:Request):
    actor=require(request,'roles.manage')
    with connect() as db:
        row=role_def(db,name)
        if row['builtin']:raise HTTPException(409,'Built-in roles cannot be deleted')
        n=db.execute('SELECT COUNT(*) FROM roles WHERE role=?',(name,)).fetchone()[0]
        if n:raise HTTPException(409,f'{n} user(s) still have this role. Assign them another role first.')
        db.execute('DELETE FROM role_defs WHERE name=?',(name,))
        audit(db,actor,'role.delete','role',name,row['label'])
        db.commit()
    return Response(status_code=204)

# --------------------------------------------------------------------------
# Audit log
# --------------------------------------------------------------------------

@router.get('/audit')
def audit_log(request:Request,q:str='',action:str='',limit:int=50,offset:int=0):
    require(request,'audit.view')
    limit=max(1,min(limit,200));offset=max(0,offset)
    sql=' FROM audit_log WHERE 1=1';args:list=[]
    if q.strip():sql+=' AND (actor_email LIKE ? OR target_label LIKE ?)';args+=[f'%{q.strip()}%']*2
    if action:sql+=' AND action LIKE ?';args.append(action.rstrip('*')+'%')
    with connect() as db:
        total=db.execute('SELECT COUNT(*)'+sql,args).fetchone()[0]
        rows=db.execute('SELECT *'+sql+' ORDER BY id DESC LIMIT ? OFFSET ?',args+[limit,offset]).fetchall()
    return {'total':total,'entries':[{**dict(r),'details':json.loads(r['details'] or '{}')} for r in rows]}
