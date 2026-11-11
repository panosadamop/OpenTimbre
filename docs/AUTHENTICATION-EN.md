# OpenTimbre — Authentication and registration

## Setup
1. Copy `.env.example` to `.env`.
2. Set a random `AUTH_SECRET` of at least 32 characters; never commit it.
3. Run `docker compose -f docker-compose.neural.yml up --build`.
4. Visit `http://localhost:8080` and select **Register**.

## Fields
- **Name:** display name used at registration.
- **Email:** unique account address.
- **Password:** minimum 12 characters when registering.
- **Sign in:** authenticate with email and password.
- **Register:** create an account.
- **Continue with GitHub:** GitHub OAuth authorization.
- **Google:** Google Identity Services button when configured.
- **Sign out:** clears the session cookie.

## Google setup
Create a Google Cloud OAuth Web Client and register your site under Authorized JavaScript origins. Set both `GOOGLE_CLIENT_ID` and `VITE_GOOGLE_CLIENT_ID` to the same client ID; the VITE variable is injected at frontend build time. Google ID tokens are verified server-side.

## GitHub setup
Create a GitHub OAuth App with callback `https://YOUR_DOMAIN/api/auth/github/callback` (local: `http://localhost:8080/api/auth/github/callback`). Configure `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.

## Security and limitations
Use HTTPS and `AUTH_COOKIE_SECURE=true` in production. SQLite is persisted in the Docker volume. Passwords are Argon2-hashed and sessions are HttpOnly cookies. Existing Studio browser storage is **not isolated per account**: avoid shared browsers for sensitive work. Before public deployment implement rate limiting, password reset, email verification, CSRF protection for state-changing endpoints and per-user access control for datasets/models/jobs. Do not expose port 8000 publicly.
