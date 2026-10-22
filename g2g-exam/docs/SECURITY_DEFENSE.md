# Application defense

Owner: `server/src/application-defense.js`, registered before auth and application
handlers in `server/src/index.js`. These are additional defenses, not a replacement
for authorization, safe SQL, origin checks, upload validation or backups. No claim
of preventing every attack, a full WAF, penetration testing or DDoS protection.

## Implemented layer

- Browser write-context guard (1.4.2) extends the existing exact Origin allowlist
  in `server/src/request-origin.js`. Production POST/PUT/PATCH/DELETE without
  Origin reject Sec-Fetch-Site cross-site/same-site/unknown values before handler
  work. Explicit trusted Origins still allow approved integrations; opaque,
  malformed or untrusted Origins cannot be rescued by same-origin metadata.
  Missing-Origin same-origin/none contexts and clients lacking both headers
  preserve compatibility. GET/HEAD/OPTIONS and local preview are unchanged.
  This is defense in depth: scripts outside a browser can spoof metadata and
  must still authenticate/authorize. Legacy clients without both headers remain
  a documented limitation; no complete-CSRF or real-browser attack claim.

- API token buckets per client IP, per process: general API capacity 600, refill
  20/second; auth capacity 60, refill 1/second; media API capacity 40, refill
  1/second. Paths/query variants share their class budget. A request costs one
  token. Aggregate API capacity 2400, refill 200/second bounds identifier churn.
- Rejections occur in onRequest before auth/DB/body parsing/handler work, return
  HTTP429, Retry-After seconds and no-store. No permanent IP ban or account lock.
  Static assets/media exclusions and OPTIONS are not counted; existing CORS
  and origin guards still apply. These defaults require real workload tuning,
  especially a school behind one NAT; isolated tests are not load benchmarks.
  The 600 burst preserves the existing 200-student simultaneous-submit regression
  after its setup traffic, which exceeded the initial 240-token candidate.
- Public HTML/fallback traffic budget (1.4.3): capacity 600/refill 10 per second
  per peer; separate aggregate capacity 1200/refill 100 per second. Login pages,
  runtime config and random scan/fallback paths share it. Unknown `/api/` paths
  still use the API budget. Page tokens AND the client-tracking table are separate
  from API tokens/table so page-identifier churn cannot force API overflow.
  Bundles/source/specs/fonts, local/shared media prefixes, favicon and legacy CSS
  are excluded; this does NOT rate-limit all public bytes. Static/media floods,
  slow connections and bandwidth saturation still need edge/proxy protection.
- Each API/page client table is bounded at 10,000 entries (20,000 total), swept lazily once/minute for
  10-minute idle entries. New clients at capacity share a class overflow bucket,
  never evicting existing exhausted budgets. Restart resets all in-memory budgets;
  replicas have separate budgets. No distributed enforcement is claimed.
- Rate-limit warning signals are bounded aggregate counts once/minute, without
  extra IPs, full URLs, bodies or credentials. This is a log signal, not an alert
  service and not proof that a rejected client is malicious.
- Request URL logging strips every query/fragment, including OAuth codes and
  image signatures. Existing remote-address/path logging remains; this is not
  whole-log anonymization or a secret-scanning guarantee.
- Error logging (1.4.1) uses `server/src/error-reporting.js`: only fixed event,
  operation, bounded HTTP status and an explicit allowlist of operational error
  codes. Never serialize the original exception/message/stack/cause/config/body.
  Applied to the HTTP handler, monitor, expiry, AI, email and garbage-collection
  workers. The existing 4xx client validation contract remains; 5xx stays generic.
  This intentionally sacrifices raw stack/provider detail in operational logs.
  It is not a review of every stored error/status field or all external output.
- Response headers: nosniff, strict-origin-when-cross-origin, DENY framing and
  minimal CSP frame-ancestors/object-src/base-uri. No restrictive script-src,
  COOP/COEP, camera/microphone policy or HSTS added without compatibility evidence.
  The minimal CSP is not full XSS prevention. Existing Google login/Picker frame
  sources and inline scripts are not prohibited by it.

## Trust boundary / release prerequisites

IP enforcement uses Fastify request.ip, not a separately parsed forwarding header.
With TRUST_PROXY=false, forged X-Forwarded-For cannot change the peer budget
(injection regression included). With TRUST_PROXY=true the deployment operator
must verify the entire trusted proxy chain strips/overwrites spoofed forwarding
headers and the origin is unreachable directly. The repository compose binds to
127.0.0.1, but that does not establish the running VPS configuration. No live
proxy/firewall verification was performed in this task. Do not claim spoof-safe
per-IP enforcement in production until this boundary is verified.

Before release: HIGH quality gate and exact-candidate protected CI must pass;
registry errors are blockers, not clean audits. Inspect live trusted-proxy setup
with operator access before claiming reliable per-IP enforcement. On 22 October,
the owner explicitly authorized application-only release via GitHub auto-deploy
without waiting for SSH; proxy/origin trust remains unverified, not a resolved
security finding. No infrastructure change is included. No production attack
traffic, secrets, DB mutation or infrastructure changes are part of these tests.
Rollback is a normal revert PR, no schema migration. Rollback removes only these
new headers/quotas, not existing authorization/origin/upload protections.

## Next layers (not implemented)

1. Confirm reverse-proxy trust, TLS, private origin and network ACLs; add edge
   connection/upload limits and managed WAF/DDoS controls with operator approval.
2. Build strict CSP from actual script/frame/connect usage, initially report-only;
   verify Google/Sheet/login compatibility without exposing tokens in reports.
3. Independently review ownership/IDOR, session revocation, upload streaming and
   SSRF boundaries; retain existing SQL/security tests and patch audited libraries.
4. Configure alert delivery, log retention, restore drills, incident runbook and
   secret scanning. Do not expose a public security dashboard or raw logs.

## Verification / references

`node tests/application-defense.test.mjs` exercises real Fastify injection with
synthetic clocks/clients: budgets, refill/rollback, bounded churn/cleanup,
aggregate cap, no handler side effects on 429, trusted-peer negative and headers.
It does not run a browser, real Google, a live DB or a traffic/load test.
The public-page tests also cover path/query churn, HTML 429/no-store, a separate
page aggregate and tracking table, static/media exclusions, and 200 peers sharing
one IP during entry. A normal HEAD on production returned no Cloudflare-specific
headers; that is not proof that no CDN/WAF exists. Provider configuration remains
unverified. No production flood or rate-limit exhaustion test was sent.

Error-log regression: an isolated synthetic provider exception with credential
sentinels in config/headers/body/message/cause was logged by the previous handler
(`logLeaks:true`, client generic 500). `tests/error-reporting.test.mjs` exercises
real Fastify/Pino and now confirms no sentinel reaches logs, including circular
objects, while normal 4xx validation stays usable. No evidence of an actual
production credential leak was established; existing logs were not downloaded.

Write-context regression: the previous production policy accepted synthetic
cross-site/same-site POSTs missing Origin (two fixture-handler writes). The updated
`tests/request-origin.test.mjs` rejects them and malformed metadata across unsafe
methods and content types before side effects, while exercising explicit trusted
sources, GET callback and legacy/local compatibility. No live attack was attempted
and no actual account compromise was established.

Candidate verification (22 October 2026): HIGH ran 37/38 checks
successfully, including 200 concurrent submitted attempts behind the same peer
IP; backend dependency audit returned npm HTTP503. This is incomplete, not a
clean security audit. A read-only SSH attempt timed out, so live proxy/origin
trust could not be verified. Subsequent exact-candidate GitHub Actions run
39716883144 passed both check and dependency-audit. Web audit returned zero
advisories in the local run only. Required checks must pass again on the final
combined candidate; SSH is not needed for the existing main auto-deploy path.

- https://fastify.dev/docs/latest/Reference/Server/#trustproxy
- https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
