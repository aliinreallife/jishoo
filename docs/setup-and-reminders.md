# Setup, social validation and personal reminders

Version 0.7.3 adds a lazy Me-page setup card. The five choices are map visibility,
device location permission, device notifications, a social profile and a completed
first invitation. Hidden visibility satisfies location setup without prompting.
The optional notification/social/invite choices can be deferred; the small
account-scoped localStorage record contains only tutorial choices. Location is
never requested by reading the progress card or the Permissions API. For visible
map choices without an existing grant, the editor explains approximate location
before the explicit native permission button. Denial preserves existing consent.

`lib/social-links.js` is shared by the editor and API: handles, `@handles`, and
profile URLs normalize to HTTPS profile links. Wrong hosts, reserved routes,
posts, invitations, bad handle syntax, credentials and unsafe protocols are
blocked before saving and revalidated on the server. This checks syntax, not
account existence or ownership. Unrelated profile edits preserve existing links.

Version 0.7.4 adds Spotify user/artist profiles (including Spotify profile URIs),
platform icons, compact handle display, a scrollable form body and a fixed Save
footer. IDs and full URLs are still accepted and saved as canonical HTTPS URLs;
track/album/playlist links are rejected. Opening the editor focuses its heading
and keeps the native keyboard closed until an input is selected. The same mutual
social-sharing grant covers Spotify; it is not exposed in public profiles.

The quiet Home card is eligible 48 hours after the last completed check-in, or
account creation if none exist. A `need` record does not reset it. Its CTA queues
a **private** completed check-in through the existing three-second undo flow.
Snooze silences both personal reminder channels for seven days; disabling the
card through notification settings can leave an explicitly selected push active.
Personal push defaults to **off**, independently of the existing friend choices.
The device explanation, permission/subscription, account master preference and
explicit personal opt-in must succeed before the UI reports it enabled.

Vercel calls `GET /api/reminders` daily at `30 7 * * *` UTC (Hobby timing may
vary). `CRON_SECRET` is server-only and encrypted in Vercel; requests need its
bearer value and non-GET requests are rejected. VAPID configuration is also
required. No external scheduler, billing upgrade or analytics tracking is added.

The indexed candidate query atomically claims up to 25 registered, unbanned,
opted-in, inactive accounts with an active subscription. `FOR UPDATE SKIP LOCKED`
and a 24-hour attempt cooldown prevent duplicate concurrent claims. Consent,
snooze and completed activity are rechecked before delivery. Up to five account
deliveries run at once, fan out to their devices with normal urgency and one-hour
TTL, and accepted deliveries get a seven-day cooldown. Acceptance means a push
provider accepted it; OS presentation still depends on device/network settings.
Push content contains no friend activity, location or social links. The scheduler
does not create friend notices or check-ins. Account merging conservatively
preserves opt-outs and the latest cooldown/snooze. Account deletion removes the
preferences with its user row and subscriptions through existing deletion logic.

Story website stickers derive their lowercase host from bootstrap's `publicUrl`
(`PUBLIC_APP_URL`); no deployment hostname lives in the renderer. Both Story and
square layouts reserve a raised yellow sticker, curved pen arrow and explicit
«لینک برنامه» label above the tagline. Existing
100px top / 200px bottom Story safe areas and the shared preview/download/share
PNG remain intact. PWA, Apple installed title and Android branding use `jishoo`.
Previously installed app labels can depend on the OS manifest refresh cycle.

Verification:

- `npm test`: parser safety/normalization, eligibility/cooldown, authenticated cron,
  consent rechecks, bounded delivery and public-origin branding.
- `npm run test:browser`: heading focus, mobile setup/skip/denied GPS, invalid
  social inputs, personal push cancellation, private undo and full PNG digest
  equality with the preview for all story templates; installed branding.
- Protected QA preview: `scripts/setup_reminders_api_smoke.py` verifies real API
  scoping and SQL claims/concurrency using disposable signed Google members.
  It also merges a fictional legacy-phone QA account with a Google QA account
  and checks that personal reminder opt-outs/snooze survive explicit merging.
  Delivery is injected; no provider messages are sent. Account cleanup is in the
  script; the release operator separately removes the preview and bypass.
- Bundle budgets include the automatically rendered Home reminder and Me setup
  chunks, with existing limits preserved.
