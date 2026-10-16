# جیشو · Jishoo

Persian RTL friendship web app with guest check-ins, deterministic [Blobatar](https://blobatar.dev/) characters, phone signup by invitation, nearby activity and downloadable story cards.

**Live website:** https://jishoo.vercel.app/

## Product behavior

- Guests can check in, see their real statistics, use the map and export ordinary stories without providing a name or phone number. A persistent, server-owned anonymous session keeps their history in the same browser.
- Signup asks for a phone number, shows an OTP step, then asks new users for their name and invitation code. Existing phone users return directly to their account. Signup upgrades the guest profile, preserving history.
- **OTP is explicitly a demo:** the screen auto-confirms after 1.5 seconds. No SMS is sent. Phone normalization and uniqueness prevent duplicate referral rewards, but demo OTP does not establish ownership of a number. Real SMS verification must be implemented before public authentication leaves testing.
- Named characters come from Blobatar's deterministic SVG library: different names produce different shapes and colors. Guests receive a stable random character. Shy, happy and love expressions follow the current activity. Original shy-droplet artwork remains in the brand panel and guest welcome illustration.
- Invitation links carry a personal code. New invited members and their inviter each earn seven premium days. While testing, these days are banked instead of expiring. Future open signup without an invitation earns three days.
- **Everyone has premium during testing**, including guests. Social-link sharing and pair moments require premium when testing ends. Basic check-ins, statistics, map, ordinary stories and invitations remain free. Payment checkout and billing are deferred until subscriptions are sold.
- Friend requests require mutual acceptance. An invitation can also connect the two people when the new user selects that option. Social links stay private until the owner grants access to a particular accepted friend; the owner can revoke access. There is no chat.
- Shared completed check-ins by premium connected friends produce a together moment within one minute, or a back-to-back moment within five minutes. Private check-ins do not create a pair moment.
- One Leaflet/OpenStreetMap map requests browser geolocation only after a user action. Viewing nearby activity does not publish the viewer's location. A separate opt-in publishes coarse coordinates; connected friends see names, other people see anonymous neighbors. Turning sharing off clears existing coordinate snapshots. Activity expires from the map after 30 minutes; sharing needs a fresh location within an hour.
- Weekly, check-in, invitation and pair story cards export actual 1080×1920 PNG stories or 1080×1080 posts. Persian fonts are embedded. QR codes open the invitation URL. Web Share supports native file sharing where available, with PNG download and copy-link fallbacks.
- Profile edits, friendships, personal friend collections, invitations, check-ins, counters and pair moments are stored in PostgreSQL. Users can delete their own account or guest history.

PWA installation/offline support and Android TWA packaging are reserved for the next stage.

## Stack and integrations

React 19 + Vite, Vazirmatn/Lalezar local fonts, Phosphor icons, Blobatar, Leaflet, QRCode and html-to-image. The Vercel Node.js function in `api/app.js` uses Neon serverless PostgreSQL. The project's dedicated **jishoo-db** database is connected through the Vercel Neon integration on its free plan in Frankfurt.

Sessions use HttpOnly, SameSite cookies, Secure on production; the database stores hashes of session tokens. Phone lookup uses an HMAC and stored phone values are AES-GCM encrypted. The API authorizes actions from the server session, validates inputs and social URLs, and checks origins. Secrets are server-only; Vite receives no database credentials. Demo OTP deliberately remains unsuitable for proving phone ownership.

## Local development

Requires Node.js 24 and npm. Install locked dependencies and run the pure logic tests:

```sh
npm ci --no-audit --no-fund --cache /workspace/.npm-cache
npm test
npm run build
```

For the prepared cloud environment, run the local frontend against the explicitly selected live testing backend:

```sh
JISHOO_API_PROXY=https://jishoo.vercel.app npm run dev -- --host 0.0.0.0 --port 4173 --strictPort
```

This starts Vite on 4173 and an API bridge on 3001. The bridge carries this browser's session to the selected backend; operations persist in the real testing database. It validates HTTPS using the system trust store.

For an independent development database, put server configuration in an ignored `.env.local` using `.env.example` as a template, then run `npm run dev`. Without a configured database or explicit bridge, a secure `VERCEL_TOKEN` binding can retrieve this project's development server variables through Vercel's official API; values stay in memory and are never logged. Allow the project's Neon hostname through the cloud network policy for direct database access.

`npm run preview` serves built frontend files only. It does not start the API. Deploy the web app and API together on Vercel for the complete application.

## Server configuration

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Private Neon connection string, provided by the Vercel integration |
| `APP_SECRET` | Private random key of at least 32 characters for phone HMAC/encryption |
| `TESTING_MODE` | `true` enables demo OTP and premium for everyone |
| `INVITE_ONLY` | `true` requires an invitation for new registrations |
| `PUBLIC_APP_URL` | Canonical public URL used by invitations and story QR codes |
| `BOOTSTRAP_INVITE_CODE` | Initial shareable invitation for the first account |

Tables and idempotent schema changes initialize on the first API request. Turning off testing activates banked invitation days on a user's next session; paid/trial time is preserved. Set `INVITE_ONLY=false` later to permit three-day non-invited registrations. Connect real SMS verification before disabling the demo gate: authentication fails closed when `TESTING_MODE` is false and no real SMS implementation is installed.

## Deploy and GitHub

Source repository: https://github.com/aliinreallife/jishoo

```sh
python3 scripts/deploy_vercel.py
```

The script uses the existing secure `VERCEL_TOKEN` binding with Vercel's official HTTPS API, uploads application source/assets and polls until ready. Production is the default target; `VERCEL_TARGET=preview` creates a preview. It uses the account's default team, or `VERCEL_TEAM_ID`. Ignored `.vercel/` files record identifiers and the owner’s initial invitation, never tokens. The Vercel project already has its database and server configuration.

Cloud environment configuration is separate from website publishing. The saved draft records installation/start instructions and required network hosts; reviewing, saving and publishing it activates those settings for future cloud tasks.

## Verification

```sh
npm test
npm run build
python3 scripts/api_smoke.py
python3 scripts/smoke.py
```

The API suite uses only new disposable QA accounts with fictional phone numbers and removes those accounts afterward. It checks invite-only signup, both rewards, existing-account login, social consent, relationship authorization, idempotent check-ins, map privacy, location revocation and both real pair timing intervals.

The browser suite requires Python Playwright, Pillow and Chromium, supplied by this cloud environment. It verifies guest flow, visible demo OTP/signup, profile/settings, map consent, PNG dimensions, navigation and five responsive widths. Set `JISHOO_TEST_INVITE_CODE` to an active invitation, or use the ignored owner's initial invitation file. `JISHOO_BASE_URL` and `CHROMIUM_EXECUTABLE_PATH` override browser defaults. Against production in this managed cloud proxy, use `JISHOO_BASE_URL=https://jishoo.vercel.app JISHOO_SYSTEM_HTTPS=1 python3 scripts/smoke.py`; the transport adapter verifies HTTPS using the system CA rather than disabling TLS.

Test screenshots/results belong in ignored `artifacts/`. External map tiles require browser Internet access and are separate from application-asset checks. See `design-qa.md` for visual evidence and verification limits.
