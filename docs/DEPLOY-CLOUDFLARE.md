# Deploying OpenTimbre on Cloudflare

OpenTimbre has two parts:

| Part | What it is | Where it runs |
|---|---|---|
| **Studio** | React app built to `dist/` | Cloudflare (Workers static assets or Pages) |
| **API** | FastAPI in `services/ai` (auth, roles, cloud workspace, synthesis, analysis, training) with SQLite and files on disk | **A server you control**: Cloudflare cannot run Python + SQLite |

Cloudflare serves the Studio and forwards every `/api/*` request to your API (`worker/proxy.js`). The browser only ever talks to one origin, so session cookies and GitHub login work without CORS.

```
browser ──► https://opentimbre.<you>.workers.dev ──┬─ /*      → dist/ (Studio)
                                                    └─ /api/* → BACKEND_URL (FastAPI)
```

Without the API, the Studio still loads, but the login screen cannot sign anyone in. The whole app sits behind login.

---

## 1. Host the API

Any host that runs a Docker container **with a persistent disk** works: a VPS, your Virtualmin server, Fly.io, Railway, Render (paid tier, for disks), etc.

```bash
docker build -t opentimbre-api services/ai
docker run -d --name opentimbre-api --restart unless-stopped \
  -p 127.0.0.1:8000:8000 \
  -v opentimbre-data:/data \
  -e AUTH_SECRET="$(python3 -c 'import secrets;print(secrets.token_urlsafe(48))')" \
  -e AUTH_COOKIE_SECURE=true \
  opentimbre-api
```

All state (users DB, workspace files, models) lives in `/data`. Back up that volume.

**Environment variables**

| Variable | Required | Notes |
|---|---|---|
| `AUTH_SECRET` | yes | Random 48+ byte secret. Changing it signs everyone out. |
| `AUTH_COOKIE_SECURE` | yes, set `true` | Cloudflare always serves HTTPS. |
| `GOOGLE_CLIENT_ID` | optional | Google sign-in. Also set `VITE_GOOGLE_CLIENT_ID` at build time (step 2). |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | optional | GitHub sign-in (step 4). |
| `NEURAL_MODEL_ENDPOINT`, `NEURAL_MODEL_VERSION` | optional | External trained model. |

Neural **training** needs PyTorch: build `services/ai/Dockerfile.neural` instead (a much larger image).

**Expose it over HTTPS with a hostname**, e.g. `https://api.example.com`. Cloudflare can't proxy to a bare IP address. Either:

- put a reverse proxy (Apache/Nginx/Caddy in Virtualmin) with a TLS certificate in front of `127.0.0.1:8000`, or
- use a **Cloudflare Tunnel** (`cloudflared tunnel --url http://localhost:8000`, or a named tunnel to `api.example.com`). It needs no open ports and works even from a home machine.

Allow uploads of at least **50 MB** in the reverse proxy (the Studio accepts recordings up to 40 MB). For Nginx: `client_max_body_size 50m;`.

**Create the first superadmin** inside the container:

```bash
docker exec -it opentimbre-api python create_superadmin.py
```

Check that the API responds: `curl https://api.example.com/api/auth/me` should return `401`.

## 2. Deploy the Studio on Cloudflare

### Option A: Workers (the dashboard's default "Import a repository" flow)

1. **Workers & Pages → Create → Import a repository** → pick `OpenTimbre`.
2. Settings:
   - Build command: `npm run build`
   - Deploy command: `npx wrangler deploy` (uses `wrangler.jsonc`)
   - Root directory: `/`
3. Deploy. Then open **Settings → Variables and Secrets**:
   - add **`BACKEND_URL`** = `https://api.example.com` (type: Text), and redeploy;
   - for Google sign-in, add the **build** variable `VITE_GOOGLE_CLIENT_ID` under Settings → Build → Variables.

From your machine, `npx wrangler login && npm run build && npx wrangler deploy` does the same thing.

> The error `WorkerResource.getWorkerResult: response missing default_environment.script` appeared because the repo had no `wrangler.jsonc` for this flow. It has one now. If a half-created Worker is left over from the failed attempt, delete it and import again.

### Option B: classic Pages

1. **Workers & Pages → Create → Pages → Connect to Git** (the "Looking to deploy Pages?" link) → `OpenTimbre`.
2. Framework preset: none · Build command: `npm run build` · Output directory: `dist`.
3. **Settings → Variables and Secrets**: `BACKEND_URL` = `https://api.example.com` (Production and Preview), plus `VITE_GOOGLE_CLIENT_ID` if used. Redeploy.

Pages runs `functions/api/[[path]].js` for `/api/*` and ignores `wrangler.jsonc`.

## 3. Check it

- `https://<your-site>/api/auth/me` → `401` (a `502 backend_not_configured` means `BACKEND_URL` is missing, and `502 backend_unreachable` means Cloudflare can't reach the API).
- Sign in with the superadmin, open **Administration**, upload a recording in **Cloud Workspace**, run the **Recording assistant**.

## 4. Social sign-in (optional)

- **GitHub**: create an OAuth app with callback URL `https://<your-site>/api/auth/github/callback`. Set `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` on the API.
- **Google**: create an OAuth web client with authorised JavaScript origin `https://<your-site>`. Set `GOOGLE_CLIENT_ID` on the API and `VITE_GOOGLE_CLIENT_ID` as a Cloudflare build variable.

## Custom domain

Add it under the Worker's **Settings → Domains & Routes** (or the Pages project's **Custom domains**), then update the GitHub/Google OAuth URLs to match.
