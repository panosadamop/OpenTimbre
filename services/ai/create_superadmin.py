"""Create/promote a superadmin securely: ADMIN_EMAIL=... python create_superadmin.py"""
import os,sys,getpass,time
from auth import connect,ph
email=os.getenv('ADMIN_EMAIL','').strip().lower()
if not email or '@' not in email: sys.exit('Set ADMIN_EMAIL to a valid address')
with connect() as db:
    row=db.execute('SELECT id FROM users WHERE email=?',(email,)).fetchone()
    if row:
        uid=row['id']; print('Promoting existing user:',email)
    else:
        password=os.getenv('ADMIN_PASSWORD') or getpass.getpass('New superadmin password (12+ characters): ')
        if len(password)<12:sys.exit('Password must be at least 12 characters')
        db.execute('INSERT INTO users(email,name,password,provider,created_at) VALUES(?,?,?,?,?)',(email,os.getenv('ADMIN_NAME','Superadmin'),ph.hash(password),'password',int(time.time())))
        uid=db.execute('SELECT id FROM users WHERE email=?',(email,)).fetchone()['id']
    db.execute('INSERT INTO roles(user_id,role) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET role=excluded.role',(uid,'superadmin'))
    db.commit()
print('Superadmin configured:',email,'(no password printed)')
