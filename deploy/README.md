# Deploy

Production deployment of the Srang Tech Mai site to the **homeserver** (Ubuntu
24.04, Docker) on the tailnet, fronted by a **Cloudflare Tunnel** at
`srangtechmai.tech`. Pushing to the **`deploy`** branch auto-builds and restarts
the container via a self-hosted GitHub Actions runner.

## Pieces

| File | Role |
|------|------|
| `../Dockerfile` | Multi-stage build of the Next.js `standalone` server (non-root, slim). |
| `docker-compose.yml` | `app` (Next.js) + `cloudflared` (named tunnel) on a private bridge net. The app publishes **no host port**; the tunnel reaches it at `app:3000`. |
| `cloudflared-config.yml` | Tunnel id + ingress (`srangtechmai.tech`, `www` → `app:3000`). Non-secret; the credentials JSON stays on the host. |
| `../.github/workflows/deploy.yml` | On push to `deploy`, the self-hosted runner rebuilds & restarts the stack. |

## Flow

```
git push origin deploy
        │
        ▼
GitHub Actions (push:deploy)  ──►  self-hosted runner on homeserver
                                          │  docker compose up -d --build
                                          ▼
                          stm_page_app  ◄── stm_page_tunnel ──► Cloudflare edge ──► srangtechmai.tech
```

## Host prerequisites (one-time)

1. **Tunnel credentials** at `CF_CREDS_DIR` (default `/home/piyakorn/stm-deploy/cloudflared`):
   - `<tunnel-id>.json` (from `cloudflared tunnel create stm-page`)
   - `cert.pem` (cloudflared origin cert)
2. **Self-hosted runner** registered on `Piyakorn2112/stm-page` with labels
   `self-hosted,stm-page`, running as a persistent service.
3. **DNS**: `srangtechmai.tech` + `www` must be proxied CNAMEs to
   `<tunnel-id>.cfargotunnel.com` **in the same Cloudflare account as the tunnel**
   (see caveat below).

## Cloudflare account note

A Cloudflare Tunnel only binds public hostnames for zones in the **same account**
as the tunnel. `srangtechmai.tech` lives in its own Cloudflare account (separate
from the homeserver's `noboru.tech` cert), so the tunnel above
(`adc21b2b-…`) was created **in the srangtechmai.tech account** via the Cloudflare
API, with its credentials JSON staged at `CF_CREDS_DIR`. The `srangtechmai.tech`
and `www` records are proxied CNAMEs to `<tunnel-id>.cfargotunnel.com` in that
account. If the tunnel is ever recreated, update `tunnel:`/`credentials-file:`
here and the credentials JSON on the host to match.

## Manual operations

```bash
# from the repo root on the homeserver checkout
docker compose -f deploy/docker-compose.yml up -d --build   # deploy
docker compose -f deploy/docker-compose.yml logs -f app      # app logs
docker compose -f deploy/docker-compose.yml logs -f cloudflared
docker compose -f deploy/docker-compose.yml down             # stop
```
