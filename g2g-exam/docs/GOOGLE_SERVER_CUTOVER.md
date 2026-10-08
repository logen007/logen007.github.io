# Google login and server persistence

Production uses `/api` and PostgreSQL on every route. `LocalRepository` remains
available only for static/local development without the Docker server config.
An API failure must show an error, never fall back to browser/demo data.

No browser-data import, reset, schema change, or media deletion belongs to this
cutover. Existing localStorage stays untouched and is ignored by production.
An old demo-only exam ID does not become a server exam; create a new server draft.

## Deployment and verification

- CI must pass before main is updated.
- The existing auto-deploy script takes a one-time private PostgreSQL backup at
  `$G2G_DEPLOY_STATE_DIR/pre-google-db-cutover.sql.gz` (default directory:
  `/var/lib/g2g-auto-deploy`) before restarting the G2G app. A failed dump blocks
  the cutover. No other service or volume is removed. Manual deployments must
  perform the backup in `DEPLOY-VPS.md` first.
- Reuse existing Google client/secret and callback configuration. Never expose
  them in frontend code. Callback:
  `https://exam.g2gcareer.com/api/auth/google/callback`.
- Production refuses to boot with a missing/default `COOKIE_SECRET`; preserve
  the existing private value rather than replacing it during deployment.
- Preserve the existing primary-master email mapping and stored server roles.
  No demo user or first-login user is promoted to master. New ordinary Google
  users receive student access; teacher approval remains server-controlled.
- `/api/health` must report a healthy database. `/api/auth/google` must redirect
  to Google. Anonymous `/api/state`, `/api/commit`, `/api/media/*` must reject
  access. Demo uploads are unavailable in production even with a stale env flag.
- Reload the app after deployment to discard old demo click handlers. Sign in
  as the real Google account, create a draft and reopen its link on another
  authenticated device to verify persistence. Final Google consent requires the
  user; a 302 to Google alone does not prove completed login.

## Rollback

Retain the PostgreSQL and upload volumes and the private backup. For a frontend
regression, revert the release's UI/config changes and redeploy the app only;
keep demo uploads disabled. Do not restore an old SQL dump over subsequent work
without explicit approval. Local demo data and server data remain separate.

Authentication follows Google's server-side OpenID Connect flow:
https://developers.google.com/identity/openid-connect/openid-connect
