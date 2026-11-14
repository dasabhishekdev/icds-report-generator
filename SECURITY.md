# Security Policy

This app stores personal data about mothers and children and encrypted portal credentials, so security reports are taken seriously.

## Reporting a vulnerability

Please do **not** open a public issue. Instead, report it privately:

- Use GitHub's [private vulnerability reporting](https://github.com/dasabhishekdev/icds-report-generator/security/advisories/new), or
- Email abhishekdas_dev@outlook.com with the subject "ICDS security".

Include the affected version or commit, steps to reproduce, and the impact you expect. You should get an acknowledgement within a few days. Please give us reasonable time to release a fix before disclosing the issue publicly.

## Supported versions

Only the latest commit on `master` (what runs at icds.educoreva.com) receives security fixes.

## Self-hosting checklist

- Serve the app over HTTPS and keep `COOKIE_SECURE=true`.
- Use a long random `MONGO_ROOT_PASSWORD` and `PORTAL_SECRET`, and keep `.env` out of version control.
- Keep MongoDB on a private network; do not publish port 27017.
- Back up the database regularly (`scripts/backup-mongo.sh`) and store backups securely.
