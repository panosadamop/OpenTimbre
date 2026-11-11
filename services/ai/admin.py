"""Admin endpoints. Role changes are deliberately CLI-only."""
from fastapi import APIRouter, Request, HTTPException
from auth import current,connect
router=APIRouter(prefix='/api/v1/admin',tags=['Administration'])
def require_admin(request):
    user=current(request)
    if not user or user.get('role')!='superadmin': raise HTTPException(403,'Superadmin required')
    return user
@router.get('/users')
def users(request:Request):
    require_admin(request)
    with connect() as db:
        rows=db.execute('SELECT u.id,u.email,u.name,u.provider,u.created_at,COALESCE(r.role,"user") AS role FROM users u LEFT JOIN roles r ON r.user_id=u.id ORDER BY u.id').fetchall()
    return {'users':[dict(row) for row in rows]}
@router.get('/summary')
def summary(request:Request):
    require_admin(request)
    with connect() as db:
        n=db.execute('SELECT COUNT(*) FROM users').fetchone()[0]
    return {'users':n}
