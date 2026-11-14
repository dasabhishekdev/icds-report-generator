# Contributing

Thanks for helping improve ICDS Report Generator. Bug reports, register layouts for other states, translations, documentation and code are all welcome.

## Before you start

- For anything larger than a small fix, open an issue first so we can agree on the approach.
- Never include real beneficiary data (names, dates of birth, Aadhaar or phone numbers) in issues, screenshots, test fixtures or sample data. Use made-up values.
- By contributing you agree that your contributions are licensed under the [MIT License](LICENSE).

## Development setup

Follow [Getting started](README.md#getting-started) in the README. In short:

```bash
npm ci
docker run -d --name icds-dev-mongo -p 127.0.0.1:27017:27017 mongo:7
MONGO_URL=mongodb://127.0.0.1:27017/icds COOKIE_SECURE=false PORTAL_SECRET=$(openssl rand -hex 32) npm run dev:api
npm run dev
```

## Making a change

1. Fork the repository and create a branch from `master`.
2. Keep the change focused; one pull request per fix or feature.
3. Add or update tests next to the code you change (`src/**/*.test.ts` for the engine and reports, `server/test/` for the API).
4. Run the checks CI runs:

   ```bash
   npm run typecheck
   MONGO_URL=mongodb://127.0.0.1:27017 npm test
   npm run build
   ```

5. Open a pull request against `master` and fill in the template.

## Conventions

- TypeScript everywhere; keep `npm run typecheck` clean.
- Calculation and report logic belongs in `src/domain/` and `src/reports/` so the browser preview and the server output stay identical.
- Validate every API input with zod schemas in `server/src/schemas.ts`, and scope every database query to the signed-in user.
- User-facing text goes through `src/i18n/strings.ts` with both Bengali (`bn`) and English (`en`).
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/), e.g. `fix(reports): …`, `feat(attendance): …`.

## Reporting bugs

Use the bug report template. Include the month, which register, A4 or A3, PDF or Excel, and what you expected versus what you got. A screenshot of the register with names blurred helps.
