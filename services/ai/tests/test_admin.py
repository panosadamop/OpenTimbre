"""User/role management: permissions, safeguards, session revocation and migration."""
import os, sqlite3, tempfile
from pathlib import Path

_tmp = tempfile.mkdtemp(prefix='ot-admin-test-')
os.environ.update(AUTH_SECRET='x' * 48, AUTH_DB_PATH=str(Path(_tmp) / 'auth.sqlite3'),
                  OUTPUT_DIR=_tmp, WORKSPACE_ROOT=str(Path(_tmp) / 'ws'))

# Simulate a v0.6–v0.9 database whose roles table has the old CHECK constraint.
_legacy = sqlite3.connect(os.environ['AUTH_DB_PATH'])
_legacy.execute('CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, password TEXT, provider TEXT NOT NULL, created_at INTEGER NOT NULL)')
_legacy.execute('CREATE TABLE roles (user_id INTEGER PRIMARY KEY, role TEXT NOT NULL CHECK(role IN ("user","superadmin")), FOREIGN KEY(user_id) REFERENCES users(id))')
_legacy.commit(); _legacy.close()

import pytest
from fastapi.testclient import TestClient
from auth import connect, ph
from server import app

PW = 'correct-horse-battery'

def make_user(email, role=None, name='Test'):
    with connect() as db:
        db.execute('INSERT INTO users(email,name,password,provider,created_at) VALUES(?,?,?,?,0)', (email, name, ph.hash(PW), 'password'))
        uid = db.execute('SELECT id FROM users WHERE email=?', (email,)).fetchone()['id']
        if role: db.execute('INSERT INTO roles(user_id,role) VALUES(?,?)', (uid, role))
        db.commit()
    return uid

def client_for(email, password=PW):
    c = TestClient(app)
    r = c.post('/api/auth/login', json={'email': email, 'password': password})
    assert r.status_code == 200, r.text
    return c

@pytest.fixture(scope='module')
def ids():
    return {'root': make_user('root@opentimbre.dev', 'superadmin'),
            'root2': make_user('root2@opentimbre.dev', 'superadmin'),
            'adm': make_user('adm@opentimbre.dev', 'admin'),
            'bob': make_user('bob@opentimbre.dev')}

def test_migration_removed_check_constraint(ids):
    with connect() as db:
        sql = db.execute("SELECT sql FROM sqlite_master WHERE name='roles'").fetchone()[0]
        names = {r[0] for r in db.execute('SELECT name FROM role_defs')}
    assert 'CHECK' not in sql
    assert {'superadmin', 'admin', 'user'} <= names

def test_me_includes_permissions(ids):
    me = client_for('bob@opentimbre.dev').get('/api/auth/me').json()
    assert me['role'] == 'user' and 'workspace.use' in me['permissions'] and 'users.view' not in me['permissions']

def test_regular_user_cannot_use_admin_api(ids):
    c = client_for('bob@opentimbre.dev')
    assert c.get('/api/v1/admin/users').status_code == 403
    assert c.post('/api/v1/admin/users', json={'email': 'x@opentimbre.dev', 'name': 'X'}).status_code == 403

def test_admin_can_manage_users_but_not_roles(ids):
    c = client_for('adm@opentimbre.dev')
    r = c.post('/api/v1/admin/users', json={'email': 'carol@opentimbre.dev', 'name': 'Carol'})
    assert r.status_code == 201 and len(r.json()['generated_password']) == 23
    carol = r.json()['id']
    assert c.patch(f'/api/v1/admin/users/{carol}', json={'name': 'Carol B'}).json()['name'] == 'Carol B'
    assert c.patch(f'/api/v1/admin/users/{carol}', json={'role': 'admin'}).status_code == 403
    assert c.post('/api/v1/admin/roles', json={'name': 'x1', 'label': 'X'}).status_code == 403
    # admins cannot touch superadmins
    assert c.patch(f'/api/v1/admin/users/{ids["root"]}', json={'disabled': True}).status_code == 403
    assert c.post(f'/api/v1/admin/users/{ids["root"]}/password', json={}).status_code == 403

def test_superadmin_safeguards(ids):
    c = client_for('root@opentimbre.dev')
    assert c.patch(f'/api/v1/admin/users/{ids["root"]}', json={'disabled': True}).status_code == 409
    assert c.patch(f'/api/v1/admin/users/{ids["root"]}', json={'role': 'user'}).status_code == 409
    assert c.delete(f'/api/v1/admin/users/{ids["root"]}').status_code == 409
    # demoting the other superadmin works while one remains…
    assert c.patch(f'/api/v1/admin/users/{ids["root2"]}', json={'role': 'admin'}).status_code == 200
    assert c.patch(f'/api/v1/admin/roles/superadmin', json={'label': 'God'}).status_code == 409
    assert c.delete('/api/v1/admin/roles/user').status_code == 409

def test_disable_and_password_reset_revoke_sessions(ids):
    root = client_for('root@opentimbre.dev')
    dave = make_user('dave@opentimbre.dev')
    d = client_for('dave@opentimbre.dev')
    assert d.get('/api/auth/me').status_code == 200
    assert root.patch(f'/api/v1/admin/users/{dave}', json={'disabled': True}).status_code == 200
    assert d.get('/api/auth/me').status_code == 401
    assert TestClient(app).post('/api/auth/login', json={'email': 'dave@opentimbre.dev', 'password': PW}).status_code == 403
    assert root.patch(f'/api/v1/admin/users/{dave}', json={'disabled': False}).status_code == 200
    d = client_for('dave@opentimbre.dev')
    new = root.post(f'/api/v1/admin/users/{dave}/password', json={}).json()['generated_password']
    assert d.get('/api/auth/me').status_code == 401
    client_for('dave@opentimbre.dev', new)

def test_custom_role_controls_feature_access(ids):
    root = client_for('root@opentimbre.dev')
    r = root.post('/api/v1/admin/roles', json={'name': 'listener', 'label': 'Listener', 'permissions': ['synthesis.use']})
    assert r.status_code == 201 and r.json()['permissions'] == ['synthesis.use']
    eve = make_user('eve@opentimbre.dev')
    assert root.patch(f'/api/v1/admin/users/{eve}', json={'role': 'listener'}).json()['role'] == 'listener'
    e = client_for('eve@opentimbre.dev')
    assert e.get('/api/v1/workspace/items').status_code == 403
    assert e.get('/api/v1/neural/models').status_code == 200
    # role in use cannot be deleted
    assert root.delete('/api/v1/admin/roles/listener').status_code == 409
    root.patch(f'/api/v1/admin/users/{eve}', json={'role': 'user'})
    assert root.delete('/api/v1/admin/roles/listener').status_code == 204

def test_no_privilege_escalation(ids):
    root = client_for('root@opentimbre.dev')
    root.post('/api/v1/admin/roles', json={'name': 'rolemgr', 'label': 'Role manager', 'permissions': ['users.view', 'users.manage', 'roles.manage']})
    frank = make_user('frank@opentimbre.dev', 'rolemgr')
    f = client_for('frank@opentimbre.dev')
    assert f.post('/api/v1/admin/roles', json={'name': 'sneaky', 'label': 'S', 'permissions': ['audit.view']}).status_code == 403
    assert f.patch(f'/api/v1/admin/users/{frank}', json={'role': 'admin'}).status_code == 409  # own role
    bob = ids['bob']
    assert f.patch(f'/api/v1/admin/users/{bob}', json={'role': 'admin'}).status_code == 403  # admin has audit.view
    assert f.patch(f'/api/v1/admin/users/{bob}', json={'role': 'superadmin'}).status_code == 403

def test_publish_requires_permission(ids):
    root = client_for('root@opentimbre.dev')
    root.post('/api/v1/admin/roles', json={'name': 'private', 'label': 'Private only', 'permissions': ['workspace.use']})
    gina = make_user('gina@opentimbre.dev', 'private')
    g = client_for('gina@opentimbre.dev')
    body = {'kind': 'instrument', 'title': 'Lib', 'metadata': {'instrument': 'oud', 'visibility': 'public', 'license': 'CC0-1.0'}}
    assert g.post('/api/v1/workspace/items', json=body).status_code == 403
    body['metadata']['visibility'] = 'private'
    assert g.post('/api/v1/workspace/items', json=body).status_code == 201

def test_delete_user_purges_workspace_and_audits(ids):
    root = client_for('root@opentimbre.dev')
    hank = make_user('hank@opentimbre.dev')
    h = client_for('hank@opentimbre.dev')
    h.post('/api/v1/workspace/items', json={'kind': 'song', 'title': 'S', 'metadata': {}})
    assert root.delete(f'/api/v1/admin/users/{hank}').status_code == 204
    assert h.get('/api/auth/me').status_code == 401
    log = root.get('/api/v1/admin/audit', params={'action': 'user.delete'}).json()
    assert log['entries'][0]['target_label'] == 'hank@opentimbre.dev'
    assert log['entries'][0]['details']['workspace_items'] == 1
    assert root.get('/api/v1/admin/audit', params={'action': 'auth.login'}).json()['total'] > 0
