# ICDS Report Generator

Multi-user web platform for Anganwadi centres: daily attendance with submit/check-in, automatic ration and cost calculation, and the four monthly ICDS registers (Fuel & Spices, Nutrition Voucher, SNP Veg & Egg, Stock & Consumption) as Excel or PDF on A4/A3.

Each worker registers their own account. A new account receives the default injection — per-head norms, rates, age categories and fuel items derived from the AWC 547 September 2026 registers — while the centre name, number and worker name are their own. Data is stored per user in MongoDB; every query is scoped to the signed-in user.

## Architecture

| Part | Where | Notes |
|------|-------|-------|
| SPA (React + Vite + Tailwind, PWA) | `src/` | Calculation engine and report builders run in the browser |
| API (Fastify + MongoDB driver) | `server/` | Cookie sessions, scrypt passwords, strict zod validation, per-user collections |
| Containers | `Dockerfile`, `docker-compose.yml` | `icds-web` (nginx, joins network `web`), `icds-api` and `icds-mongo` on private `icds-internal` |

Public routing for `icds.educoreva.com` lives in the hosting repo (`nginx/conf.d/icds.conf`) and points at `icds-web:8080`, which serves the app and proxies `/api` to the API.

## Develop

```bash
npm ci
docker run -d --name icds-dev-mongo -p 127.0.0.1:27017:27017 mongo:7
MONGO_URL=mongodb://127.0.0.1:27017/icds COOKIE_SECURE=false npm run dev:api   # API on :4000
npm run dev                                                                    # app on :5173, proxies /api
MONGO_URL=mongodb://127.0.0.1:27017 npm test   # engine/report tests + API tests (API tests skip without MONGO_URL)
npm run build                                  # dist/ (app) and dist-server/index.cjs (API bundle)
```

## Containers

```bash
cp .env.example .env            # set MONGO_ROOT_PASSWORD (hex) and COOKIE_SECURE=false for http://localhost
docker network create web       # only if the hosting router is not running locally
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
# → http://localhost:8084
```

## CI/CD

`.github/workflows/ci-cd.yml`:

- **Pull requests / pushes to `main`** — install, typecheck, unit + API tests against a MongoDB service, build, then a full container-stack smoke test (health checks and a real registration through `icds-web`).
- **Push to `main`** (or manual run) — after verification, `scripts/ci-deploy.sh` rsyncs the repo to the VPS and runs `scripts/deploy.sh`, which builds both images, waits for `icds-web`/`icds-api`/`icds-mongo` to be healthy, smoke-tests through network `web`, and rolls back both images if verification fails. MongoDB data persists in the `icds-mongo-data` volume.

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

`ICDS_APP_DIR` is intentionally not `PROD_APP_DIR`: the upload uses `rsync --delete`, so it must never point at another app's directory. The VPS-only `.env` and `backups/` are excluded from the upload and therefore never deleted.

VPS: the `deploy` user needs Docker, OpenSSL and the hosting router running (`~/hosting`, which creates network `web`). On first deploy `scripts/deploy.sh` creates `.env` with a random MongoDB password; keep that file safe — it is the only copy.

DNS (Cloudflare, zone `educoreva.com`): `A icds → VPS IP`, proxied — same Flexible setup as `abhishek-das.educoreva.com`. Session cookies are `Secure`, so the site must be reached over HTTPS (Cloudflare provides it).

### Operations

```bash
cd ~/icds-report-generator
bash scripts/deploy.sh          # manual deploy
bash scripts/backup-mongo.sh    # gzip dump into backups/, keeps 30 days (schedule with cron)
```

Set `ALLOW_REGISTRATION=false` in `.env` and redeploy to stop new sign-ups.
