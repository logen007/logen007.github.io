# Private R2 media — staged migration

Scope: shared image/audio delivery only; no provider/level/part specification changes.
Default OFF. Existing URLs, local uploads, copy and GC behavior remain authoritative.
No Cloudflare Worker is deployed: `media-worker.js` is a browser service worker,
restricted to same-origin GET `/uploads/<name>` with no query. It does not cache
HTML, sessions, API data, answers or submissions.

## Readers / writers

- Teachers upload to VPS as before; local save succeeds independently of R2.
- When enabled, one background scan (10 seconds after startup, then every 5 minutes)
  mirrors files sequentially. PUT + HEAD metadata/size verification precedes use.
- Content-addressed remote keys prevent overwriting a published object. A local
  manifest is namespaced by account/bucket, and survives container restarts.
- Existing exam URLs and local files are never rewritten/deleted by migration.
- Authenticated media GET opts into a short-lived signed R2 redirect only through
  the browser delivery layer. Normal URLs and unsupported browsers retain VPS.
- Signed URLs remain reusable for 45 minutes, expire after 60 minutes. A new
  authorized request renews them; no credentials are returned to the frontend.
- Same current login requirement as `/uploads` is preserved. This does not add
  per-exam entitlement checks. Signed URLs are bearer links and remain usable
  until expiry; do not log/share their query strings. CORS is not authorization.

## Failure and rollback

- Missing config/manifest/file or unverified copy: serve local immediately.
- Remote HTTP/network/CORS failure or no headers within 4 seconds: try VPS;
  use VPS for 5 minutes within that service-worker instance to avoid repeated waits.
- Partial download interruption/stall: resume from VPS using a validated byte
  range, keeping the same audio element and existing play-once state. At most
  one stream recovery; missing range metadata or failed local source is an error.
- The existing preloader streams files with concurrency 2, current/next sections
  first, and pauses scheduling in hidden tabs. No full-media JS blob cache.
- Rollback: set `R2_MEDIA_ENABLED=false`, restart app. Already installed browser
  workers also receive local files. No DB restoration required.
- Local GC continues as before. Remote orphan cleanup is deliberately NOT enabled
  in this migration; no remote delete privileges or destructive sweep required.
  Deleted local files cannot receive new signed URLs, but existing signed URLs
  may still work until expiry. Review retention before activating production.

## Activation prerequisites (not completed automatically)

1. Enable R2 subscription in the user's Cloudflare account. User completes billing
   or contractual acceptance. Create a PRIVATE Standard bucket; keep `r2.dev`
   and public bucket custom domains disabled.
2. Store bucket-scoped R2 credentials only in server environment/secret storage.
   Set `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`.
   Never commit credentials or paste them in chat. Set enabled=true on staging first.
3. Bucket CORS (replace origin for staging):

```json
[{"AllowedOrigins":["https://exam.g2gcareer.com"],"AllowedMethods":["GET","HEAD"],"AllowedHeaders":["Range"],"ExposeHeaders":["Content-Length","Content-Range","Accept-Ranges","ETag"],"MaxAgeSeconds":3600}]
```

4. Verify a sample signed GET, HEAD through SDK, byte-range GET, upload/copy,
   cold load and warmed Next/Back. Test Chrome/Safari/mobile and service-worker
   first load/control lifecycle. Simulate R2 403/404/5xx, missing CORS, header stall,
   interrupted audio stream, logout and deleted local file. No public media access.
5. Verify deploy with flag OFF first. Enable for staging, complete browser tests,
   then production outside an active exam window. Keep VPS originals.

## Validation status

Automated tests mock storage/HTTP failures; they do not establish real R2 CORS,
browser media behavior, or 500-student capacity. Live activation requires account
access and an actual bucket. No load test against the production website.

Dependency audit on 2026-10-12 reports existing high-severity advisories in
`@fastify/static` and `nodemailer` (not the new AWS SDK packages). Fixes require
major-version upgrades; those unrelated upgrades are not bundled into this
storage migration. Review separately before claiming a clean security audit.
