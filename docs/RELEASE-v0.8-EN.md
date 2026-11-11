# OpenTimbre v0.8 — Users, libraries and demos

## Superadmin
No default credentials are bundled. Configure `AUTH_SECRET` (at least 32 random characters) in `.env`. Run in the backend container:

```bash
 docker compose -f docker-compose.neural.yml exec -e ADMIN_EMAIL=admin@example.org synthesis python create_superadmin.py
```

Enter a strong password (minimum 12 characters) at the prompt. An existing account is promoted; a missing one is created. The Administration page lists users and is restricted to superadmins. Role changes are intentionally CLI-only.

## Personal libraries
Cloud Workspace stores songs, WAV recordings and instrument-pack metadata. Choose `Private` or `Public metadata` and a license. The public catalogue lists only explicitly published CC0 / CC BY instrument metadata. WAV files remain private and **are not distributed**. Neural jobs still use shared storage and must be isolated before multi-user production deployment.

## Demo instruments
Choose among 9 procedural demos in Player. Run `npm run fixtures` to generate WAV assets. These are DSP approximations, not authentic recordings or trained neural models. Rebuild the Docker image after generating fixtures.
