# Jan Andolan Photo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compress Jan Andolan photos on the phone to ≤ 1.5 MB, download and store them, and give a
shortcut to the Poshan Abhiyaan portal with the worker's saved (encrypted) portal login.

**Architecture:** Compression runs in a Web Worker (`createImageBitmap` + `OffscreenCanvas`) around a
pure, unit-tested search function. The API stores photos through the existing `ReportStorage`
(S3 or disk) and portal logins AES-256-GCM-encrypted in MongoDB. Two new pages, one Settings card.

**Tech Stack:** React 19, Vite 8 (module workers), Fastify 5, MongoDB driver 7, zod 4, vitest 4,
Node `crypto`.

Spec: `docs/superpowers/specs/2026-10-31-jan-andolan-photo-design.md`

## Global Constraints

- Input ≤ 30 × 1024 × 1024 bytes; output ≤ 1,500,000 bytes; server rejects images > 2,000,000 bytes.
- Quality search `[0.80, 0.95]`; dimensions never below 1920 px longest side; canvas ≤ 16,777,216 px.
- JPEG/PNG ≤ 1,500,000 bytes kept unchanged.
- File name `AWC_<centre number>_JanAndolan_<YYYY-MM-DD>_<HHmm>.<jpg|png>`, time in Asia/Kolkata.
- Portal URLs: `https://poshanabhiyaan.gov.in/login`, `https://poshanabhiyaan.gov.in/addactivityparticipation`.
- `PORTAL_SECRET` = 64 hex characters; without it saving a portal login answers 503.
- Every query filters on `userId`; request bodies are JSON; every string in Bengali and English.

---

### Task 1: Encoding search (pure)

**Files:** Create `src/lib/imageEncoding.ts`, `src/lib/imageEncoding.test.ts`

**Produces:**
- `ENCODING_LIMITS` `{ maxOutput, minQuality, maxQuality, floorQuality, minLongSide, maxCanvasPixels }`
- `fitCanvas(d: Dims, maxPixels: number): Dims`
- `chooseEncoding<T extends { size: number }>(d: Dims, encode: (w, h, q) => Promise<T>, limits?)
  : Promise<{ result: T; width; height; quality }>` — throws `EncodingError` when nothing fits.
- `scaleToLongSide(d: Dims, longSide: number): Dims`

Tests (fake encoder, size = w × h × q × k): fits at full size with highest quality; downscales but
not below 1920; pixel cap applied first; uses floor quality at 1920 as last resort; throws when
nothing fits; small originals (< 1920) go straight to floor-quality search.

- [ ] Write failing tests · run `npx vitest run src/lib/imageEncoding.test.ts` (FAIL)
- [ ] Implement · run again (PASS) · commit

### Task 2: Shared photo file naming

**Files:** Create `src/domain/photoName.ts`, `src/domain/photoName.test.ts`

**Produces:** `photoFileName(centreNumber: string, capturedAt: Date, contentType: 'image/jpeg' | 'image/png'): string`,
`photoMonth(capturedAt: Date): string` (YYYY-MM in Asia/Kolkata).

Tests: IST conversion across midnight (2026-10-31T19:00Z → `2026-11-01_0030`), unsafe characters in
the centre number, `.png` extension.

### Task 3: Server — portal login (encrypted)

**Files:** Create `server/src/portal/crypto.ts`, `server/src/portal/routes.ts`,
`server/test/portalLogin.test.ts`; modify `server/src/config.ts`, `server/src/db.ts`,
`server/src/app.ts`, `.env.example`, `docker-compose.yml`, `scripts/deploy.sh`.

**Produces:** `GET /api/portal-login` → `{ available: boolean, login: { username, password } | null }`;
`PUT /api/portal-login` `{ username, password }` → 204 (503 without secret);
`DELETE /api/portal-login` → 204. `Config.portalSecret?: Buffer`.

Tests: round trip; raw Mongo doc has no plaintext; per-user isolation; 503 without secret;
validation 400; 401 without session; invalid `PORTAL_SECRET` rejected by `loadConfig`.

### Task 4: Server — photos

**Files:** Create `server/src/photos/routes.ts`, `server/test/photos.test.ts`; modify
`server/src/db.ts`, `server/src/app.ts`.

**Produces:** `POST /api/photos` (201, `PublicPhoto`), `GET /api/photos?month=`, `GET /api/photos/:id/file`,
`GET /api/photos/:id/thumb`, `DELETE /api/photos/:id`.
`PublicPhoto = { id, month, name, size, width, height, originalSize, originalWidth, originalHeight,
contentType, capturedAt, createdAt, storage }`.

Tests: upload/list/download/delete with disk storage; > 2 MB rejected; bad signature rejected; PNG
accepted with `.png` name; other user gets 404; 401 without session.

### Task 5: Client — compression worker and APIs

**Files:** Create `src/lib/compressImage.worker.ts`, `src/lib/compressPhoto.ts`, `src/api/photos.ts`,
`src/api/portalLogin.ts`.

**Produces:** `compressPhoto(file: File): Promise<CompressedPhoto>` with
`CompressedPhoto = { image: Blob; thumb: Blob; contentType; width; height; originalWidth; originalHeight; originalSize; quality: number | null; kept: boolean }`;
throws `PhotoError` with `code: 'tooBig' | 'unreadable' | 'cannotFit'`.
`photosApi.{ list, upload, remove, fileUrl, thumbUrl }`, `portalLoginApi.{ get, save, remove }`.

### Task 6: Client — pages, Settings card, navigation

**Files:** Create `src/pages/JanAndolanPage.tsx`, `src/pages/SavedPhotosPage.tsx`,
`src/components/PortalShortcutCard.tsx`, `src/components/PortalLoginCard.tsx`; modify
`src/App.tsx`, `src/components/Layout.tsx`, `src/pages/SettingsPage.tsx`, `src/i18n/strings.ts`,
`vite.config.ts` (manifest shortcut), `README.md`.

Checks: `npm run typecheck`, `npm test`, `npm run build`; manual run in the browser with a large
photo.
