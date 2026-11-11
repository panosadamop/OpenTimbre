# OpenTimbre — Local development (Windows / macOS / Linux)

## Prerequisites
Node.js 20+, npm, Python 3.10+, free ports 5173 and 8000. Neural training also requires PyTorch, which is not installed by the base setup.

## Windows (PowerShell)
```powershell
.\scripts\dev.ps1 setup
.\scripts\dev.ps1 backend
```
In another PowerShell window:
```powershell
.\scripts\dev.ps1 frontend
```
You can also use `scripts\dev.cmd setup` and the equivalent commands.

## macOS / Linux
```bash
./scripts/dev.sh setup
./scripts/dev.sh backend
```
In another terminal:
```bash
./scripts/dev.sh frontend
```

## Addresses
Studio: http://localhost:5173 · API docs: http://localhost:8000/docs. Vite proxies `/api` to the backend. Initial `setup` creates `.env` with a random secret and an isolated Python virtual environment.

## Commands
`setup`: install dependencies and generate demo fixtures · `frontend`: React/Vite · `backend`: FastAPI · `admin`: interactive superadmin setup · `test`: run tests · `build`: TypeScript/Vite production build.

## Neural training
Install `services/ai/requirements-neural.txt` into `.venv` separately, choosing an appropriate PyTorch CPU/GPU build. Basic local setup does not guarantee neural training availability.

## Security
Never commit `.env`, user data or trained models. Public deployment requires HTTPS, secure cookies, secret management, resource limits and additional security review.
