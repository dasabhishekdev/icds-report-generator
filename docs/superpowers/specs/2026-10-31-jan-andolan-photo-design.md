# Jan Andolan photo and Poshan portal shortcut — design

Date: 2026-10-31 · Status: approved, awaiting spec review

## Goal

Anganwadi workers submit Jan Andolan activity photos on the Poshan Abhiyaan portal
(<https://poshanabhiyaan.gov.in>). Phone photos are usually too large for the portal. The ICDS app
will shrink a photo to at most 1.5 MB, download it to the phone, keep a copy on the server, and give
a one-tap way to reach the portal with the worker's portal login ready to copy.

Workers use phones (the ICDS PWA). The portal is filled in by the worker by hand; the app does not
automate the portal.

## Findings about the portal (checked 2026-10-31)

- React SPA. Login is username + password only — no captcha, no OTP. After login it routes to
  `/addactivityparticipation` (the Activity Participation form).
- Form: state, district, project, AWC, level, organizer, theme, activity, event date, male/female
  counts (children, adults, adolescent girls), description, one photo.
- Photo: PNG or JPEG only; a file over 2,000,000 bytes is rejected before anything else. The portal
  then compresses it itself to about 1 MB and at most 1920 px on the longest side.
- `X-Frame-Options: SAMEORIGIN` — it cannot be embedded, and browsers do not let our site fill
  another site's form. Automatic filling would need server-side headless Chrome (fragile, may be
  IP-blocked) or a browser extension (not available on mobile Chrome). Rejected in favour of the
  assisted flow.

## Out of scope

- Logging in to, filling, or submitting the portal form automatically.
- Literally lossless compression (a 30 MB photo cannot become 1.5 MB without re-encoding).
- Keeping EXIF metadata (GPS, camera) in the compressed photo.

## User flow

1. Worker opens the new **Jan Andolan** tab (or the PWA app-icon shortcut).
2. **Choose photo** — any image the browser can decode, up to 30 MB. Larger files are refused with
   a message.
3. The photo is compressed on the phone. The screen shows original vs compressed size and
   dimensions and a preview.
4. The compressed photo downloads automatically, named
   `AWC_<centre number>_JanAndolan_<YYYY-MM-DD>_<HHmm>.jpg` (`.png` when a small PNG is kept
   unchanged), and is uploaded to the server
   (S3, or the disk volume when `S3_BUCKET` is empty).
5. The portal card below shows the saved portal username and password with **Copy** buttons
   (password hidden behind a show/hide toggle) and two links that open in a new tab:
   - **Open Poshan portal login** → `https://poshanabhiyaan.gov.in/login`
   - **Open Jan Andolan submission** → `https://poshanabhiyaan.gov.in/addactivityparticipation`
     (the portal redirects to login when the worker is not signed in).
   The card explains the order (copy username → open portal → paste → come back → copy password)
   and suggests letting Chrome save the password on the portal.
   If no portal login is saved, the card links to Settings instead.
6. **Saved photos** (link from the Jan Andolan screen) lists earlier photos by month with a
   thumbnail, **Download again** and **Delete**.

## Compression (client side)

Runs in the browser so a 30 MB original is never sent over mobile data. Implemented with
`createImageBitmap` (applies EXIF orientation) and `OffscreenCanvas.convertToBlob` in a Web Worker,
so the page stays responsive.

Constants: `MAX_INPUT = 30 * 1024 * 1024` bytes, `MAX_OUTPUT = 1_500_000` bytes,
`MIN_QUALITY = 0.80`, `MIN_LONG_SIDE = 1920` px, `MAX_CANVAS_PIXELS = 16_777_216` (iOS Safari limit).

Algorithm:

1. If the input is JPEG or PNG and at most `MAX_OUTPUT`, keep the original bytes unchanged.
2. Start at the original dimensions, reduced only if width × height exceeds `MAX_CANVAS_PIXELS`.
3. At the current dimensions, binary-search JPEG quality in `[MIN_QUALITY, 0.95]` (about 6 steps)
   for the highest quality whose output is ≤ `MAX_OUTPUT`.
4. If one exists, use it. Otherwise scale the dimensions by `sqrt(MAX_OUTPUT / sizeAtMinQuality) × 0.95`,
   never below `MIN_LONG_SIDE` on the longest side, and repeat step 3.
5. If at `MIN_LONG_SIDE` even `MIN_QUALITY` is too large, search quality in `[0.5, MIN_QUALITY)` at
   that size. If nothing fits, report an error.

The result is usually 1–1.5 MB. It can be smaller when quality 0.95 already fits well under the
limit (simple or small photos); the app never pads a file to reach 1 MB.

The search is a pure function, `chooseEncoding(dims, encode)`, where `encode(width, height, quality)`
returns the output size. It is unit-tested with a fake encoder; the canvas/worker wrapper is thin.

A thumbnail (longest side 320 px, quality 0.7) is produced from the same bitmap for the list page.

## Server

### Photos

- Collection `photos`, index `{ userId: 1, month: 1, createdAt: -1 }`:
  `{ _id, userId, month, createdAt, takenAt, name, size, width, height, originalSize,
  originalWidth, originalHeight, contentType, storage, key, thumbKey }`.
- Storage keys: `users/<userId>/photos/<YYYY-MM>/<photoId>/<name>` and `…/thumb.jpg`, written
  with the existing `ReportStorage` (`server/src/reports/storage.ts`).
- Routes (all require a session and filter on `userId`):
  - `POST /api/photos` — JSON `{ name, takenAt, width, height, originalSize, originalWidth,
    originalHeight, contentType, image, thumb }`, where `image` and `thumb` are base64. The decoded
    image must be ≤ 2,000,000 bytes and start with a JPEG or PNG signature matching `contentType`;
    the thumbnail must be a JPEG ≤ 100 KB. File names are built by the server from the centre
    number and timestamp, not taken from the request. Rate-limited.
  - `GET /api/photos?month=YYYY-MM` — newest first, at most 200.
  - `GET /api/photos/:id/file` and `GET /api/photos/:id/thumb` — stream from storage.
  - `DELETE /api/photos/:id` — removes both files and the document.
- New routes live in `server/src/photos/routes.ts`, registered from `app.ts`.

### Portal login

- Collection `portalLogins`, unique index on `userId`:
  `{ userId, username, password: { iv, tag, data }, updatedAt }`.
- The password is encrypted with AES-256-GCM using `PORTAL_SECRET` (64 hex characters) from the
  environment; a fresh random IV for every save. Kept out of `settings` because settings are sent
  to the browser with every data load.
- Routes:
  - `GET /api/portal-login` — `{ username, password }` for the signed-in user, or 404. Rate-limited.
  - `PUT /api/portal-login` — `{ username, password }` (each 1–100 characters). 503 when
    `PORTAL_SECRET` is not configured.
  - `DELETE /api/portal-login`.
- `config.ts` reads `PORTAL_SECRET`; `.env.example`, `docker-compose.yml` and the README document it;
  `scripts/deploy.sh` appends a random `PORTAL_SECRET=$(openssl rand -hex 32)` to an existing `.env`
  that lacks one (the current deploy only creates `.env` when it is missing).

## Client

- `src/pages/JanAndolanPage.tsx` — choose photo, progress, result, portal card.
- `src/pages/SavedPhotosPage.tsx` — list by month, thumbnails, download, delete.
- `src/components/PortalLoginCard.tsx` — Settings card for entering the portal login (kept out of
  the 612-line `SettingsPage.tsx`, which only renders it).
- `src/lib/compressImage.ts` (pure `chooseEncoding` + worker wrapper), `src/lib/compressImage.worker.ts`.
- `src/api/photos.ts`, `src/api/portalLogin.ts` following `src/api/reports.ts`.
- Routes `/jan-andolan` and `/jan-andolan/saved` in `App.tsx`; sixth nav item (Camera icon) in
  `Layout.tsx`, mobile bar becomes `grid-cols-6`.
- PWA manifest `shortcuts` entry "Jan Andolan photo" → `/#/jan-andolan` in `vite.config.ts`.
- All new labels in `src/i18n/strings.ts` in Bengali and English.

## Errors

- Input over 30 MB, or not decodable → message, nothing uploaded.
- Compression cannot reach 1.5 MB → message suggesting a smaller photo.
- Upload fails → the photo has still downloaded; the screen says it was not saved to the server and
  offers **Retry upload**.
- No portal login saved → the card links to Settings; the portal links still work.
- `PORTAL_SECRET` missing on the server → Settings shows that saving the portal login is unavailable.

## Tests

- `src/lib/compressImage.test.ts` — `chooseEncoding`: small input kept; full size when it fits at
  ≥ 0.80; downscale when needed and never below 1920 px; canvas pixel cap; error when nothing fits.
- `server/test/photos.test.ts` — upload/list/download/delete; over-2 MB and wrong-signature uploads
  rejected; another user's photo returns 404.
- `server/test/portalLogin.test.ts` — save and read back; stored document has no plaintext password;
  per-user isolation; 503 without `PORTAL_SECRET`.
