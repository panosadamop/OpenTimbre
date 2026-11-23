# Deploying OpenTimbre on Cloudflare

OpenTimbre has two parts:

| Part | What it is | Where it runs |
|---|---|---|
| **Studio** | React app built to `dist/` | Cloudflare Pages |
| **API** | FastAPI in `services/ai` (auth, roles, cloud workspace, synthesis, analysis, training) with SQLite and files on disk | **A server you control**: Cloudflare cannot run Python + SQLite |

Cloudflare Pages serves the Studio and its Pages Function (`functions/api/[[path]].js`) forwards every `/api/*` request to your API. The browser only ever talks to one origin, so session cookies and GitHub login work without CORS.

```
browser ──► https://opentimbre.pages.dev ───────────┬─ /*      → dist/ (Studio)
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

## 2. Deploy the Studio on Cloudflare Pages

1. In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to Git**. (If the screen offers "Import a repository" for Workers, use the **"Looking to deploy Pages? Get started"** link instead.)
2. Pick the `OpenTimbre` repository and set:

   | Setting | Value |
   |---|---|
   | Production branch | `main` |
   | Framework preset | None |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Root directory | *(leave empty)* |

   Node 22 is picked up from `.nvmrc`.
3. Under **Environment variables** (now, or later in **Settings → Variables and Secrets**), for both *Production* and *Preview*:

   | Variable | Value |
   |---|---|
   | `BACKEND_URL` | `https://api.example.com`, your API from step 1 |
   | `VITE_GOOGLE_CLIENT_ID` | *(optional)* Google sign-in client id, read at build time |

4. **Save and Deploy.** After you change a variable, redeploy (**Deployments → ⋯ → Retry deployment**), because variables only apply to new deployments.

What's in the repo for Pages:

- `functions/api/[[path]].js`: the `/api/*` proxy to `BACKEND_URL`.
- `public/_headers`: security headers, plus long-lived caching for hashed `/assets/*`.
- Unknown routes fall back to `index.html` automatically (Pages single-page-app mode), so you don't need a `_redirects` file.
- There is deliberately **no** `wrangler.toml`/`wrangler.jsonc`, so all settings stay editable in the dashboard.

**From your machine instead of Git** (direct upload):

```bash
npx wrangler login
npm run pages:deploy          # builds and uploads dist/ + functions/ to the "opentimbre" project
```

Set `BACKEND_URL` in the dashboard afterwards, as above.

**Test locally the way Pages runs it**, with the API on port 8000:

```bash
npm run build
npm run pages:dev             # http://localhost:8788
```

> **About the earlier error.** `WorkerResource.getWorkerResult: response missing default_environment.script` means the project was created through the **Workers** "Import a repository" flow, not Pages. Delete that project and create it again through **Pages → Connect to Git** as described above.

## 3. Check it

- `https://<your-site>/api/auth/me` → `401` (a `502 backend_not_configured` means `BACKEND_URL` is missing, and `502 backend_unreachable` means Cloudflare can't reach the API).
- Sign in with the superadmin, open **Administration**, upload a recording in **Cloud Workspace**, run the **Recording assistant**.

## 4. Social sign-in (optional)

- **GitHub**: create an OAuth app with callback URL `https://<your-site>/api/auth/github/callback`. Set `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` on the API.
- **Google**: create an OAuth web client with authorised JavaScript origin `https://<your-site>`. Set `GOOGLE_CLIENT_ID` on the API and `VITE_GOOGLE_CLIENT_ID` as a Cloudflare build variable.

## Custom domain

Add it under the Pages project's **Custom domains** tab, then update the GitHub/Google OAuth URLs to match.
