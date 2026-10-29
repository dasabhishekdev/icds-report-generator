# ICDS Report Generator

Offline-first web app for an Anganwadi centre: daily attendance, automatic ration/cost calculation and the four monthly ICDS registers (Fuel & Spices, Nutrition Voucher, SNP Veg & Egg, Stock & Consumption) as Excel or PDF on A4/A3.

All data stays in the browser (IndexedDB). Settings → Data has backup/restore.

## Develop

```bash
npm ci
npm run dev        # http://localhost:5173
npm test           # report calculations reproduce the Sep 2026 AWC 547 registers
npm run build
```

## Container

`Dockerfile` builds the app (running the tests) and serves `dist/` from an unprivileged nginx on port 8080. The container joins the shared Docker network `web`; public routing for `icds.educoreva.com` lives in the hosting repo (`nginx/conf.d/icds.conf`).

```bash
docker network create web   # only if the hosting router is not running locally
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
# → http://localhost:8084
```

## CI/CD

`.github/workflows/ci-cd.yml`:

- **Pull requests / pushes to `main`** — install, typecheck, unit tests, build, container build and smoke test.
- **Push to `main`** (or manual run) — after verification, `scripts/ci-deploy.sh` rsyncs the repo to the VPS and runs `scripts/deploy.sh`, which builds the image, health-checks `icds-web` over network `web`, and rolls back to the previous image if verification fails.

### One-time setup

GitHub → Settings → Secrets and variables → Actions:

| Kind | Name | Value |
|------|------|-------|
| Secret | `PROD_SSH_HOST` | VPS IP |
| Secret | `PROD_SSH_USER` | `deploy` |
| Secret | `PROD_SSH_PRIVATE_KEY` | Deploy SSH private key |
| Secret | `PROD_SSH_PASSPHRASE` | Key passphrase, if any |
| Secret | `ICDS_APP_DIR` | Optional, defaults to `$HOME/icds-report-generator` |
| Variable | `PROD_SSH_KNOWN_HOSTS` | Verified `known_hosts` line for the VPS |

`ICDS_APP_DIR` is intentionally not `PROD_APP_DIR`: the upload uses `rsync --delete`, so it must never point at another app's directory.

VPS: the `deploy` user needs Docker and the hosting router running (`~/hosting`, which creates network `web`).

DNS (Cloudflare, zone `educoreva.com`): `A icds → VPS IP`, proxied — same Flexible setup as `abhishek-das.educoreva.com`. For origin HTTPS, issue a certificate and enable `icds.ssl.conf.disabled` in the hosting repo.

### Manual deploy on the VPS

```bash
cd ~/icds-report-generator && bash scripts/deploy.sh
```
