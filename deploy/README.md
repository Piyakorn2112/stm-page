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

## ⚠️ Cloudflare account caveat

A Cloudflare Tunnel only binds public hostnames for zones in the **same account**
as the tunnel. `srangtechmai.tech` is on Cloudflare but in a different account
than the homeserver's `cloudflared` origin cert (which authorizes `noboru.tech`).
To finish public routing, do **one** of:

- **API token** — provide a token for the `srangtechmai.tech` account
  (`Zone:DNS:Edit` + `Account:Cloudflare Tunnel:Edit`); the tunnel + DNS are then
  recreated in that account.
- **Interactive login** — `cloudflared tunnel login`, pick the `srangtechmai.tech`
  account; re-create the tunnel and `cloudflared tunnel route dns stm-page srangtechmai.tech`.
- **Move the zone** — transfer `srangtechmai.tech` into the `noboru.tech`
  Cloudflare account; the existing tunnel id then works unchanged.

After resolving, update `tunnel:`/`credentials-file:` in `cloudflared-config.yml`
if the tunnel id changed.

## Manual operations

```bash
# from the repo root on the homeserver checkout
docker compose -f deploy/docker-compose.yml up -d --build   # deploy
docker compose -f deploy/docker-compose.yml logs -f app      # app logs
docker compose -f deploy/docker-compose.yml logs -f cloudflared
docker compose -f deploy/docker-compose.yml down             # stop
```
