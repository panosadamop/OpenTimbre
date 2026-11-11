#!/usr/bin/env python3
"""Cross-platform OpenTimbre local development launcher (stdlib only)."""
import argparse, os, pathlib, secrets, shutil, subprocess, sys, venv
ROOT=pathlib.Path(__file__).resolve().parents[1]
BACKEND=ROOT/'services'/'ai'
VENV=ROOT/'.venv'
PYTHON=VENV/('Scripts/python.exe' if os.name=='nt' else 'bin/python')

def run(args,cwd=ROOT):
    print('+', ' '.join(map(str,args)),flush=True)
    command = list(map(str, args))
    # On Windows npm is installed as npm.cmd; subprocess without shell
    # cannot resolve the bare 'npm' executable.
    if os.name == 'nt' and command[0].lower() in ('npm', 'npx'):
        executable = shutil.which(command[0] + '.cmd') or shutil.which(command[0])
        if not executable:
            raise SystemExit(f'{command[0]} not found. Install Node.js and reopen your terminal.')
        command[0] = executable
    subprocess.run(command, cwd=cwd, check=True)

def setup():
    if not shutil.which('npm'): raise SystemExit('Node.js/npm missing: install Node.js 20+ first')
    if sys.version_info < (3,10): raise SystemExit('Python 3.10+ required')
    if not PYTHON.exists():
        print('Creating isolated Python environment...')
        venv.EnvBuilder(with_pip=True).create(VENV)
    envfile=ROOT/'.env'
    if not envfile.exists():
        template=(ROOT/'.env.example').read_text(encoding='utf8')
        template=template.replace('REPLACE_WITH_RANDOM_48_BYTE_SECRET',secrets.token_urlsafe(48))
        envfile.write_text(template,encoding='utf8')
        print('Created local .env with generated secret (do not commit).')
    run([PYTHON,'-m','pip','install','-r',BACKEND/'requirements.txt'])
    run(['npm','install'])
    run(['npm','run','fixtures'])
    print('Setup complete. Use scripts/dev.py backend and scripts/dev.py frontend in separate terminals.')

def load_env():
    p=ROOT/'.env'
    if not p.exists(): raise SystemExit('Missing .env. Run setup first.')
    for line in p.read_text(encoding='utf8').splitlines():
        line=line.strip()
        if line and not line.startswith('#') and '=' in line:
            key,value=line.split('=',1)
            os.environ.setdefault(key.strip(),value.strip().strip('"').strip("'"))

def main():
    parser=argparse.ArgumentParser(description='OpenTimbre cross-platform development')
    parser.add_argument('command',choices=['setup','frontend','backend','test','build','admin'])
    args=parser.parse_args()
    if args.command=='setup': setup();return
    if args.command in ('backend','admin'):
        load_env()
        if not PYTHON.exists(): raise SystemExit('Run setup first')
        os.environ.setdefault('AUTH_DB_PATH',str(ROOT/'local-data'/'auth.sqlite3'))
        os.environ.setdefault('OUTPUT_DIR',str(ROOT/'local-data'))
        (ROOT/'local-data').mkdir(exist_ok=True)
        if args.command=='backend':
            os.chdir(BACKEND)
            os.execv(str(PYTHON),[str(PYTHON),'-m','uvicorn','server:app','--host','127.0.0.1','--port','8000','--reload']) if os.name!='nt' else run([PYTHON,'-m','uvicorn','server:app','--host','127.0.0.1','--port','8000','--reload'],BACKEND)
        else: run([PYTHON,'create_superadmin.py'],BACKEND)
    elif args.command=='frontend': run(['npm','run','dev'])
    elif args.command=='test':
        run(['npm','test']);run([PYTHON,'-m','pytest','-q','tests'],BACKEND)
    elif args.command=='build': run(['npm','run','build'])
if __name__=='__main__': main()
