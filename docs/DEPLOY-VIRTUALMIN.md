# Deploying the OpenTimbre API on a Virtualmin server

This runs the FastAPI backend (`services/ai`) as a systemd service behind Apache on a Virtualmin server. The Studio itself is hosted on Cloudflare Pages (see [DEPLOY-CLOUDFLARE.md](DEPLOY-CLOUDFLARE.md)), whose `/api/*` proxy forwards requests here through `BACKEND_URL`.

```
browser ──► Cloudflare Pages ── /api/* ──► https://api.example.com (Apache, Virtualmin) ──► 127.0.0.1:8000 (uvicorn)
```

You need root (SSH) access. Replace `api.example.com`, `opentimbre` and `you@example.com` with your own values.

## 1. Create the domain in Virtualmin

1. **Create Virtual Server** for `api.example.com`, as a sub-server or with its own Unix user. This guide assumes user `opentimbre` with home `/home/opentimbre`.
2. **DNS**: add an A record for `api` pointing to the server's IP. If your DNS is on Cloudflare, either DNS-only or proxied works. If proxied, set SSL/TLS mode to **Full (strict)**.
3. **SSL**: **Server Configuration → SSL Certificate → Let's Encrypt → Request certificate**.

## 2. Install the code

```bash
# as root: Python 3.10+ (use dnf on RHEL/Alma/Rocky)
apt install -y python3 python3-venv python3-pip git

su - opentimbre
git clone https://github.com/panosadamop/OpenTimbre.git app
python3 -m venv venv
venv/bin/pip install -r app/services/ai/requirements.txt
mkdir -p data
```

## 3. Configuration

Create `/home/opentimbre/opentimbre.env`:

```bash
# Generate with: python3 -c "import secrets;print(secrets.token_urlsafe(48))"
AUTH_SECRET=REPLACE_WITH_RANDOM_SECRET
AUTH_COOKIE_SECURE=true
OUTPUT_DIR=/home/opentimbre/data
AUTH_DB_PATH=/home/opentimbre/data/auth.sqlite3
WORKSPACE_ROOT=/home/opentimbre/data/workspaces
# Optional sign-in providers:
# GITHUB_CLIENT_ID=
# GITHUB_CLIENT_SECRET=
# GOOGLE_CLIENT_ID=
```

```bash
chmod 600 /home/opentimbre/opentimbre.env
```

`AUTH_SECRET` must be at least 32 characters long. Changing it signs everyone out.

## 4. Run it as a service

As root, create `/etc/systemd/system/opentimbre-api.service`:

```ini
[Unit]
Description=OpenTimbre API
After=network.target

[Service]
User=opentimbre
WorkingDirectory=/home/opentimbre/app/services/ai
EnvironmentFile=/home/opentimbre/opentimbre.env
ExecStart=/home/opentimbre/venv/bin/uvicorn server:app --host 127.0.0.1 --port 8000 --workers 1 --proxy-headers --forwarded-allow-ips 127.0.0.1
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now opentimbre-api
curl -i http://127.0.0.1:8000/api/auth/me     # expect 401
```

Keep `--workers 1`: synthesis jobs are tracked in memory and the data is stored in SQLite. If port 8000 is already in use, pick another port here and in step 5.

## 5. Apache reverse proxy

Enable the proxy modules (on Debian/Ubuntu; RHEL-family systems usually have them on already):

```bash
a2enmod proxy proxy_http headers && systemctl reload apache2
```

In Virtualmin go to **Web Configuration → Edit Directives** (or **Services → Configure SSL Website → Edit Directives**) for the **SSL (port 443)** site, add the following and save:

```apache
ProxyPreserveHost On
ProxyPass        / http://127.0.0.1:8000/ timeout=600
ProxyPassReverse / http://127.0.0.1:8000/
RequestHeader set X-Forwarded-Proto "https"
LimitRequestBody 52428800
```

- `timeout=600` covers long requests such as model training.
- `LimitRequestBody` allows 50 MB uploads (the Studio accepts recordings up to 40 MB).

Optionally, redirect HTTP to HTTPS with **Web Configuration → Website Redirects**.

Check it from your own machine:

```bash
curl -i https://api.example.com/api/auth/me    # expect 401
```

## 6. Create the first superadmin

```bash
su - opentimbre
set -a; . ./opentimbre.env; set +a
cd app/services/ai
ADMIN_EMAIL=you@example.com ../../../venv/bin/python create_superadmin.py
```

The script asks for a password of 12+ characters. If the email already belongs to a user, that user is promoted instead. Manage everyone else from the Studio's **Administration** tab.

## 7. Connect Cloudflare Pages

In the Pages project go to **Settings → Variables and Secrets** and set `BACKEND_URL` = `https://api.example.com` for both Production and Preview. Then use **Deployments → ⋯ → Retry deployment**, open the site and sign in.

For GitHub sign-in, use the OAuth callback URL `https://<your-pages-domain>/api/auth/github/callback`.

## Maintenance

| Task | Command |
|---|---|
| Update | `su - opentimbre -c "cd app && git pull && ../venv/bin/pip install -r services/ai/requirements.txt"` then `systemctl restart opentimbre-api` (the database migrates itself on startup) |
| Logs | `journalctl -u opentimbre-api -f` |
| Status / restart | `systemctl status opentimbre-api` / `systemctl restart opentimbre-api` |
| Backups | Include `/home/opentimbre/data` and `opentimbre.env` in Virtualmin's scheduled backups. Back up `data/auth.sqlite3` before every update. |

**Neural training (optional).** Install CPU-only PyTorch with `/home/opentimbre/venv/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu` and restart the service. It needs several GB of disk and uses a lot of CPU while training.

## Troubleshooting

| Symptom | Cause |
|---|---|
| Studio shows `backend_not_configured` | `BACKEND_URL` is not set in Pages, or the site wasn't redeployed after setting it. |
| `backend_unreachable` / 502 from Pages | DNS, certificate or Apache proxy problem. Check `curl https://api.example.com/api/auth/me` from outside. |
| 503 from Apache | The service isn't running: `systemctl status opentimbre-api`, `journalctl -u opentimbre-api`. |
| Login succeeds but you're immediately signed out | `AUTH_COOKIE_SECURE=true` requires HTTPS end to end through the Pages domain, which Pages always uses. Check the browser's cookies for `opentimbre_session`. |
| Upload fails with 413 | Raise `LimitRequestBody` in Apache. |
| Service exits with an `AUTH_SECRET` error | The secret is missing or shorter than 32 characters. |
