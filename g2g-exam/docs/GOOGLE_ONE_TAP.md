# Google One Tap

The login page offers Google's account prompt. The existing redirect login
button remains available when Google is blocked or chooses not to show it.
One Tap uses the existing GOOGLE_CLIENT_ID and shared server account/session
logic; no client secret is exposed to the browser.

In Google Cloud, open that OAuth web client and add the production origin
https://exam.g2gcareer.com to Authorized JavaScript origins. Keep the existing
authorized redirect URI for the fallback flow. Add other origins only if they
are actually used for this app. PUBLIC_URL must match the production origin.

The server verifies Google's ID token (signature, audience and expiry), email
verification, and a short-lived signed-cookie nonce. Credential submissions
must have the same Origin as PUBLIC_URL. Existing signup/domain/disabled-user
rules apply to both login methods.

Auto-select is off. Logout cancels One Tap and suppresses it for the current
page session. Google controls availability and presentation; do not promise
that the prompt appears on every browser visit.

Manual check: open the logged-out landing page with a Google session, accept
the prompt, confirm the same account/role, then logout. Also test dismissing
or blocking Google and using the original button. Never capture ID tokens.
