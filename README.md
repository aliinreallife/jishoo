# جیشو · Jishoo

Persian RTL friendship web app with guest check-ins, deterministic [Blobatar](https://blobatar.dev/) characters, phone signup by invitation, nearby activity and downloadable story cards.

**Live website:** https://jishoo.vercel.app/

## Product behavior

- Guests can check in, see their real statistics, use the map and export ordinary stories without providing a name or phone number. A persistent, server-owned anonymous session keeps their history in the same browser.
- Signup asks for a phone number, shows an OTP step, then asks new users for their name and invitation code. Existing phone users return directly to their account. Signup upgrades the guest profile, preserving history.
- **OTP is explicitly a demo:** the screen auto-confirms after 1.5 seconds. No SMS is sent. Phone normalization and uniqueness prevent duplicate referral rewards, but demo OTP does not establish ownership of a number. Real SMS verification must be implemented before public authentication leaves testing.
- Blobatar is used only for profile avatars when no photo is uploaded. Members can upload or remove a photo; it is cropped and compressed in the browser to a 256px JPEG and stored in the dedicated database. Check-ins, friendship moments, stories and promotional graphics use the original illustrated droplet characters.
- A member's personal invitation link admits at most three new members during testing. Each of those members receives three invitations of their own. Successful registrations consume a slot atomically; opening a link does not. The invitation card shows the inviter, used/remaining slots and the real people who joined. Deleting an invited account does not refund a used slot.
- New invited members and their inviter each earn seven premium days. While testing, these days are banked instead of expiring. Future open signup without an invitation earns three days. Everyone stays premium while testing is enabled.
- **Everyone has premium during testing**, including guests. Social-link sharing and pair moments require premium when testing ends. Basic check-ins, statistics, map, ordinary stories and invitations remain free. Payment checkout and billing are deferred until subscriptions are sold.
- Invited members receive an incoming friend request from their inviter. They can accept after signup or explicitly choose to connect during signup. Existing members can request a connection through an exact handle, invitation link or public profile. Social links stay private until the owner grants access to a particular accepted friend; the owner can revoke access. There is no chat.
- Shared completed check-ins by premium connected friends produce a together moment within one minute, or a back-to-back moment within five minutes. Private check-ins do not create a pair moment.
- One Leaflet/OpenStreetMap map requests browser geolocation only after a user action. Viewing nearby activity does not publish the viewer's location. A separate opt-in publishes coarse coordinates; connected friends see names, other people see anonymous neighbors. Turning sharing off clears existing coordinate snapshots. Activity expires from the map after 30 minutes; sharing needs a fresh location within an hour.
- The single **این نزدیکا** tab combines the map and opt-in discovery within 3km. It offers connection requests by handle. Location and discoverability need separate user actions; revoking location removes discoverability. Markers in the same approximate grid cell use separate screen anchors, with a selectable cluster for larger crowds; the API never invents precise coordinates.
- Both “جیش دارم” and “جیش کردم” open illustrated result screens with a small optional share icon and one primary close action. A three-second undo prevents the event, notification and achievement write entirely. Sharing has no navigation tab. Weekly stats, invitations and past pair moments also open their matching cards. Cards have editable captions and three color themes; exported PNGs are 1080×1920 stories or 1080×1080 posts with embedded Persian fonts. QR codes use active invitations, falling back to the public profile once slots are exhausted. Web Share supports native file sharing with PNG download and copy-link fallbacks.
- Public profiles use `/u/handle`, with unique 3–24 character English handles. `ali` is reserved for the owner and assigned by the owner's private invitation. Social links remain consented friend data. Profile links have server-rendered social metadata and a locally generated 1200×630 preview image; the app has its own illustrated icon.
- Five achievement families each have three levels and cute Persian titles. Need-status taps earn no achievement points. Completed events count by distinct half-hour buckets, capped at eight per day; active/streak awards count unique server-dated days, invitations count real registered accounts, and pair awards count each friend only once per day. Earned levels persist; client-provided counters or timestamps cannot award them.
- In-app notifications and Web Push cover friend activity and invitations. Members can mute a person, a private collection, or all activity; system notifications are separately opt-in. Push subscriptions accept known browser push services, and stale subscriptions are removed. Actual lock-screen/banners are controlled by device/browser permission. iOS push requires an installed web app; installation support remains future work. There is no permission to draw an arbitrary overlay over other apps.
- The friends page has search, incoming/outgoing requests and shared groups. New groups invite selected friends pending acceptance; owners can also invite any exact handle or share/rotate a group link. Group membership does not grant friendship or private social links. Existing private collections stay private. Disconnecting removes social-link grants and private collection membership while shared group membership stays separate. Users can leave shared groups; owners can delete them.
- Statistics have actual seven-day, thirty-day and twelve-month chart ranges, with a 21-day droplet calendar. Counts use Tehran dates and server data. The public `/terms` and `/privacy` pages load without creating an account/session; new registrations record the current terms version.
- Profile edits, friendships, groups, invitations, check-ins, counters and pair moments are stored in PostgreSQL. Users can delete their own account or guest history.

## Administration

The owner joins through a private single-use invitation generated by `python3 scripts/provision_admin.py`. It assigns `ali` and opens the dashboard; an existing member can claim the same private invitation without recreating their account. Its capability is consumed once and the old public starter invitation is retired.

The dashboard shows real member/activity totals, searches members with server-side pagination, issues/revokes one-use member invitations without the normal three-slot limit, grants or revokes lifetime premium, suspends/reactivates members, and records administrative actions. Lifetime premium is a persistent entitlement respected after testing ends.

Admin access additionally requires an elevated session. Demo OTP login to an admin's phone does **not** elevate a new session. The current admin can generate a private one-use recovery link, bound to their account and expiring after 30 days, for another device. Recovery links and owner invitations are displayed only on request or saved in ignored `.vercel/` files; they must not be committed. Server-side provisioning uses a short-lived HMAC request plus a unique nonce, authenticated using server configuration retrieved through the existing Vercel credential binding. Public requests cannot mint owner invitations.

PWA installation/offline support and Android TWA packaging are reserved for the next stage.

## Stack and integrations

React 19 + Vite, Vazirmatn/Lalezar local fonts, Phosphor icons, Blobatar, Leaflet, QRCode, html-to-image and Web Push. The Vercel functions in `api/` use Neon serverless PostgreSQL. The project's dedicated **jishoo-db** database is connected through the Vercel Neon integration on its free plan in Frankfurt. VAPID keys are configured as server environment variables; the private key is never sent to the frontend.

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
| `VAPID_PUBLIC_KEY` | Browser push application key, safe to send to a subscribing browser |
| `VAPID_PRIVATE_KEY` | Private server key used to sign browser push delivery |

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
python3 scripts/community_smoke.py
python3 scripts/smoke.py
```

The API suites use only new disposable QA accounts with fictional phone numbers and remove those accounts afterward. They check signup/rewards, existing-account login, relationship authorization, map privacy, both real pair intervals, invitation exhaustion, admin capabilities, lifetime gifts, handles/photos, anti-farming achievements, discovery consent and notification preferences. QA invitations are provisioned separately; tests never consume the owner's invitation or reserve `ali`.

The current browser suite (`scripts/smoke.py`, implemented in `scripts/v4_smoke.py`) requires Python Playwright, Pillow and Chromium. It checks both undos, quiet reactions, handle-based friendships, social permissions/mutes, shared group acceptance and links, disconnect behavior, chart ranges, one nearby page, separated map markers, legal pages and four responsive widths. `scripts/improvements_smoke.py` additionally exercises photo cropping, signup/inviter decisions, contextual PNG export, permission explanations and the protected admin gate. It provisions its own QA invitations. `JISHOO_BASE_URL` and `CHROMIUM_EXECUTABLE_PATH` override browser defaults. Against production in this managed cloud proxy, use `JISHOO_BASE_URL=https://jishoo.vercel.app JISHOO_SYSTEM_HTTPS=1 python3 scripts/smoke.py`; the transport adapter verifies HTTPS using the system CA rather than disabling TLS. OS notification delivery needs a real permitted device and is not claimed by the automated suite.

Test screenshots/results belong in ignored `artifacts/`. External map tiles require browser Internet access and are separate from application-asset checks. See `design-qa.md` for visual evidence and verification limits.

## Background notifications and account controls

On Android Chrome, members can enable real Web Push from **Profile → Notifications**. A mascot explanation appears before the native browser permission prompt. The dedicated service worker displays friend activity even when no Jishoo tab is open. The notification screen sends its server-backed test to every subscribed device on the account, including when the current browser is not subscribed. It reports provider acceptance/failure counts separately from confirmed device display. Global, friend and circle mute settings apply to both the inbox and push. Delivery requires an Internet connection and permitted Chrome/system notifications; Android battery settings, Do Not Disturb and force-stopping Chrome can affect delivery. On iOS 16.4+, users must add Jishoo to their Home Screen and enable notifications from that installed app. The manifest provides this installation path; offline caching, TWA and billing remain future work.

Push subscriptions are restricted to supported HTTPS providers, bound to one account per endpoint and removed when expired. Sending uses high urgency, a one-hour TTL, bounded timeouts and a retry for transient failures. Vercel `waitUntil` keeps friend delivery alive after a check-in response, so saving activity does not wait on push providers. This is Web Push, not a native overlay service; there is no claim that it overrides device settings or guarantees delivery during provider outages.

Photo uploads now have a preview with drag, zoom, position sliders and rotation before confirmation. Client-side resizing bounds uploads; the server independently decodes, limits and re-encodes actual JPEGs to 320×320 and strips metadata. Only invite story cards include an invitation code, QR or invitation link. Other story cards keep the mascot, caption and optional public handle. The profile has one share button; its dialog contains the public link and copy/share controls. The browser favicon is a transparent yellow shy droplet; the main blue mascot stays unchanged.

Opening an invitation shows its sender, the app's main activities and clear membership/guest choices. After signup, a separate screen asks about friendship. Choosing later keeps the inviter's request pending. Existing members can also explicitly request a connection from the invitation landing screen.

The owner's dashboard is at `/#/admin`. Initial ownership still requires the private one-use owner invitation. Subsequent demo phone login does not elevate a session: the owner may use a private recovery link or the owner password. `python3 scripts/configure_admin_password.py` generates the initial password in an ignored, mode-0600 file and stores only a salted scrypt hash in encrypted Vercel environment settings. The password works only for the registered, active admin account `ali`; IP and account limits restrict attempts. Never commit `.vercel/` or print environment configuration.

Schema migrations use a persisted content/version check instead of replaying every DDL statement at each function cold start. Hot query indexes cover notifications, connections, referrals and authentication challenges. Variable fonts replace independent per-weight downloads; community/admin views, statistics, friend groups, legal pages and the photo editor load on demand. New screen styles load with their page. Foreground polling runs once per minute; friend/group navigation and returning to the app refresh current requests.

`python3 scripts/improvements_smoke.py` checks the revised photo, premium, profile, invitation, permission-explanation and story flows using disposable accounts. The notification request is instrumented in headless Chromium; the service worker itself activates, but an actual Android notification must still be confirmed on a permitted real device. See `security-performance-review.md` for the review and measured transfer results.
