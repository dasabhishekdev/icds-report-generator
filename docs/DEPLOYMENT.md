# Deployment

How the reference instance at [icds.educoreva.com](https://icds.educoreva.com) is deployed. Use it as a template for your own server; the domain, network names and paths are specific to that instance.

## Containers

| Container | Image stage | Network | Role |
|-----------|-------------|---------|------|
| `icds-web` | `web` (nginx, unprivileged) | `web`, `icds-internal` | Serves the SPA and proxies `/api` to the API |
| `icds-api` | `api` (Node 22 + Chromium) | `icds-internal` | Fastify API and report generation |
| `icds-mongo` | `mongo:7` | `icds-internal` | Data, in the `icds-mongo-data` volume |

`icds-web` listens on `8080` and joins an external Docker network called `web`, where a separate reverse proxy (the "hosting router") terminates HTTPS and routes the public domain to `icds-web:8080`. If you do not have such a router, create the network with `docker network create web` and put your own proxy in front, or publish `icds-web` directly with `docker-compose.local.yml`.

Session cookies are `Secure`, so the site must be served over HTTPS (set `COOKIE_SECURE=false` only for plain `http://localhost`).

## CI/CD

`.github/workflows/ci-cd.yml` runs only for `master`:

- **Pull requests to `master`**: install, typecheck, unit + API + PDF tests against a MongoDB service, build, then a full container-stack smoke test (health checks, a real registration and a generated report through `icds-web`).
- **Push to `master`** (or a manual run on `master`) in the upstream repository: the same verification, then deploy. `scripts/ci-deploy.sh` rsyncs the repo to the VPS and runs `scripts/deploy.sh`, which builds both images, waits for `icds-web`/`icds-api`/`icds-mongo` to be healthy, smoke-tests through network `web`, and rolls back both images if verification fails.

Forks run the verification job only. To deploy from a fork, change the `github.repository` condition on the `deploy` job and add the secrets below.

### Secrets and variables

GitHub → Settings → Secrets and variables → Actions:

| Kind | Name | Value |
|------|------|-------|
| Secret | `PROD_SSH_HOST` | VPS IP or host name |
| Secret | `PROD_SSH_USER` | Deploy user, e.g. `deploy` |
| Secret | `PROD_SSH_PRIVATE_KEY` | Deploy SSH private key |
| Secret | `PROD_SSH_PASSPHRASE` | Key passphrase, if any |
| Secret | `ICDS_APP_DIR` | Optional, defaults to `$HOME/icds-report-generator` |
| Variable | `PROD_SSH_KNOWN_HOSTS` | Verified `known_hosts` line for the VPS |

`ICDS_APP_DIR` is intentionally not `PROD_APP_DIR`: the upload uses `rsync --delete`, so it must never point at another app's directory. The VPS-only `.env` and `backups/` are excluded from the upload and therefore never deleted.

### Server prerequisites

The deploy user needs Docker, OpenSSL and the `web` Docker network. On first deploy `scripts/deploy.sh` creates `.env` from `.env.example` with a random MongoDB password and `PORTAL_SECRET`; keep that file safe, it is the only copy.

## Operations

```bash
cd ~/icds-report-generator
bash scripts/deploy.sh          # manual deploy
bash scripts/backup-mongo.sh    # gzip dump into backups/, keeps 30 days (schedule with cron)
```

Set `ALLOW_REGISTRATION=false` in `.env` and redeploy to stop new sign-ups.

## Report storage

Set `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` in `.env` (plus `S3_ENDPOINT` / `S3_FORCE_PATH_STYLE=true` for S3-compatible services such as Cloudflare R2) and redeploy. The IAM user only needs `s3:PutObject`, `s3:GetObject` and `s3:DeleteObject` on `arn:aws:s3:::<bucket>/<S3_PREFIX>/*`. Without `S3_BUCKET`, reports and photos are kept in the `icds-reports-data` volume.

## Android app

`android/` is a Trusted Web Activity generated with Bubblewrap from `android/twa-manifest.json`; it opens the hosted site. The package id (`com.educoreva.icds`), host and `public/.well-known/assetlinks.json` belong to the reference instance; change all three and sign with your own keystore for your own build. The keystore and its passwords are gitignored and must never be committed. `scripts/publish-android.ts` uploads a built APK for the public download page.
