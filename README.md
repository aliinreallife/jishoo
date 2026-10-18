# جیشو · Jishoo

Persian RTL friendship web app with guest check-ins, deterministic [Blobatar](https://blobatar.dev/) characters, Google-first invitation-only signup, nearby activity and downloadable story cards.

**Live website:** https://jishoo.vercel.app/

## Product behavior

- Guests can check in, see their real statistics, use the map and export ordinary stories without providing a name or phone number. A persistent, server-owned anonymous session keeps their history in the same browser.
- Signup is invitation-only. Google is visible first for everyone. Returning members sign in directly; a new verified identity then validates an active invitation and provides only a name. Without an invitation, users can explicitly join the waiting list with their verified Google email, add one optional contact phone number and keep using guest mode. Waiting-list phone numbers are unverified contact data, never login proofs. Only elevated admins can read the paginated waiting list; automatic email/SMS delivery needs a separate provider. Phone login and phone linking are paused on both the client and server. Existing phone sessions keep their profile and may connect Google. Signup upgrades the guest profile, preserving history.
- `PHONE_AUTH_ENABLED=false` is the default across all Vercel targets. The old demo OTP can only be enabled with both `TESTING_MODE=true` and `PHONE_AUTH_ENABLED=true`; it is unsuitable as proof of account ownership. Real SMS verification is required before enabling public phone authentication.
- Blobatar is used only for profile avatars when no photo is uploaded. Members can upload or remove a photo; it is cropped and compressed in the browser to a 256px JPEG and stored in the dedicated database. Check-ins, friendship moments, stories and promotional graphics use the original illustrated droplet characters.
- A member's personal invitation link admits at most three new members during testing. Each of those members receives three invitations of their own. Successful registrations consume a slot atomically; opening a link does not. The invitation card shows the inviter, used/remaining slots and the real people who joined. Deleting an invited account does not refund a used slot.
- New invited members and their inviter each earn seven premium days. While testing, these days are banked instead of expiring. Future open signup without an invitation earns three days. Everyone stays premium while testing is enabled.
- **Everyone has premium during testing**, including guests. Social-link sharing and pair moments require premium when testing ends. Basic check-ins, statistics, map, ordinary stories and invitations remain free. Payment checkout and billing are deferred until subscriptions are sold.
- Invited members receive an incoming friend request from their inviter. They can accept after signup or explicitly choose to connect during signup. Existing members can request a connection through an exact handle, invitation link or public profile. Social accounts require an explicit request from one accepted friend and acceptance from the other. Neither side receives links while pending. Either can disconnect social sharing for both while keeping the friendship. There is no chat.
- Shared completed check-ins by premium connected friends produce a together moment within one minute, or a back-to-back moment within five minutes. Private check-ins do not create a pair moment.
- One Leaflet map with CARTO Light/Positron **without labels** requests browser geolocation only after a user action. Viewing nearby activity does not publish the viewer's location. The map keeps its full dimensions after geolocation; its compact options panel can be collapsed with «فقط نقشه» and restored without changing sharing, markers, zoom or camera position. A separate opt-in publishes coarse coordinates; connected friends see names, other people see anonymous neighbors. Turning sharing off clears existing coordinate snapshots. Activity expires from the map after 30 minutes; sharing needs a fresh location within an hour.
- The single **این نزدیکا** tab combines the map and opt-in discovery within 3km. It offers connection requests by handle. Three direct visibility modes select hidden, anonymous activity or a named profile. Selecting the profile enables the necessary coarse-location and discovery consent together; hiding clears both. Markers in the same approximate grid cell use separate screen anchors, with a selectable cluster for larger crowds; the API never invents precise coordinates.
- Both “جیش دارم” and “جیش کردم” open illustrated result screens with an optional story icon on a colored background and one primary continue action. A three-second undo prevents the event, notification and achievement write entirely. The contextual story icon is available immediately during undo; the editor keeps its undo control, and pending completed counts are included in the PNG. Cancelling still prevents the app event and notification; exporting an image does not commit a check-in. Sharing has no navigation tab. Weekly stats, invitations and past pair moments also open their matching cards. Cards have editable captions and three color themes. The editor scales its preview to the available viewport while keeping PNG save/share controls visible without scrolling, including landscape; ordinary cards use the former white footer-panel space for larger artwork, and invite cards keep their code/QR in a transparent footer; exported PNGs are 1080×1920 stories or 1080×1080 posts with loaded local Persian fonts. Canvas rendering waits for all bitmap mascots/fonts; preview, download and native sharing use the exact same PNG bytes to avoid Safari DOM-snapshot omissions. QR codes use active invitations, falling back to the public profile once slots are exhausted. Web Share supports native file sharing with PNG download and copy-link fallbacks.
- Public profiles use `/u/handle`, with unique 3–24 character English handles. `ali` is reserved for the owner and assigned by the owner's private invitation. Social links remain consented friend data. Profile links have server-rendered social metadata and a locally generated 1200×630 preview image; the app has its own illustrated icon.
- Five achievement families each have three levels and cute Persian titles. Need-status taps earn no achievement points. Completed events count by distinct half-hour buckets, capped at eight per day; active/streak awards count unique server-dated days, invitations count real registered accounts, and pair awards count each friend only once per day. Earned levels persist; client-provided counters or timestamps cannot award them.
- In-app notifications and Web Push cover friend activity and invitations. Members can mute a person, a private collection, or all activity; system notifications are separately opt-in. Push subscriptions accept known browser push services, and stale subscriptions are removed. Actual lock-screen/banners are controlled by device/browser permission. iOS push requires an installed web app; the install guide explains the steps. There is no permission to draw an arbitrary overlay over other apps.
- The friends page has search, incoming/outgoing requests and shared groups. New groups invite selected friends pending acceptance; owners can also invite any exact handle or share/rotate a group link. Group membership does not grant friendship or private social links. Existing private collections stay private. Disconnecting removes social-link grants and private collection membership while shared group membership stays separate. Users can leave shared groups; owners can delete them.
- Statistics use Saturday–Friday weeks, the actual current Shamsi month, twelve Shamsi months and a full Persian month calendar, including leap-year Esfand. Counts use Tehran dates and server data. The public `/terms` and `/privacy` pages load without creating an account/session; new registrations record the current terms version.
- Profile edits, friendships, groups, invitations, check-ins, counters and pair moments are stored in PostgreSQL. Users can delete their own account or guest history.

## Administration

The owner joins through a private single-use invitation generated by `python3 scripts/provision_admin.py`. It assigns `ali` and opens the dashboard; an existing member can claim the same private invitation without recreating their account. Its capability is consumed once and the old public starter invitation is retired.

The dashboard shows real member/activity totals, searches members with server-side pagination, issues/revokes one-use member invitations without the normal three-slot limit, includes 30/90/365-day or lifetime premium in single-use signup invitations, grants or revokes lifetime premium for existing members, suspends/reactivates members, and records administrative actions. Lifetime premium is a persistent entitlement respected after testing ends. A gifted invitation stores its entitlement on the server; signup consumes the one-use invitation and grants the recipient entitlement atomically, including Google-first signup. A day gift replaces the usual seven-day recipient gift and is banked during testing. Client signup fields cannot grant premium. `scripts/consent_gifts_smoke.py` verifies gift authorization, concurrent redemption, mutual link consent and revocation.

Admin access additionally requires an elevated session. Demo OTP login to an admin's phone does **not** elevate a new session. The current admin can generate a private one-use recovery link, bound to their account and expiring after 30 days, for another device. Recovery links and owner invitations are displayed only on request or saved in ignored `.vercel/` files; they must not be committed. Server-side provisioning uses a short-lived HMAC request plus a unique nonce, authenticated using server configuration retrieved through the existing Vercel credential binding. Public requests cannot mint owner invitations.

PWA installation is available from Profile or `/install`, with a native Android prompt when supported and a Safari/iPhone guide. The worker caches public assets and a dedicated offline page, never account API responses. Android TWA builds are automated with `.github/workflows/android.yml`; see `android/README.md` for signing, Digital Asset Links and distribution requirements.

## Stack and integrations

React 19 + Vite, Vazirmatn/Lalezar local fonts, Phosphor icons, Blobatar, Leaflet, QRCode, Canvas2D story rendering and Web Push. The Vercel functions in `api/` use Neon serverless PostgreSQL. The project's dedicated **jishoo-db** database is connected through the Vercel Neon integration on its free plan in Frankfurt. VAPID keys are configured as server environment variables; the private key is never sent to the frontend.

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
| `GOOGLE_CLIENT_ID` | Google web OAuth client identifier, configured server-side |
| `GOOGLE_CLIENT_SECRET` | Encrypted server-only Google OAuth secret; never a Vite variable |
| `CARTO_KEY` | Optional CARTO tile key, inserted into the public browser tile URL at runtime |
| `ANDROID_PACKAGE_ID` | TWA package, defaults to `app.jishoo.twa` |
| `ANDROID_SHA256_CERTIFICATES` | Comma-separated SHA-256 signing fingerprints for Digital Asset Links |
| `VAPID_PUBLIC_KEY` | Browser push application key, safe to send to a subscribing browser |
| `VAPID_PRIVATE_KEY` | Private server key used to sign browser push delivery |

Tables and idempotent schema changes initialize on the first API request. Turning off testing activates banked invitation days on a user's next session; paid/trial time is preserved. Set `INVITE_ONLY=false` later to permit three-day non-invited registrations. Connect real SMS verification before enabling phone authentication outside testing; phone OTP fails closed when `TESTING_MODE` is false. Google uses real server-side identity verification independently.

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

On Android Chrome, members can enable real Web Push from **Profile → Notifications**. A mascot explanation appears before the native browser permission prompt. The dedicated service worker displays friend activity even when no Jishoo tab is open. The notification screen sends its server-backed test to every subscribed device on the account, including when the current browser is not subscribed. It reports provider acceptance/failure counts separately from confirmed device display. Global, friend and circle mute settings apply to both the inbox and push. Delivery requires an Internet connection and permitted Chrome/system notifications; Android battery settings, Do Not Disturb and force-stopping Chrome can affect delivery. On iOS 16.4+, users must add Jishoo to their Home Screen and enable notifications from that installed app. The manifest and install guide provide this installation path. The public offline fallback does not cache private account responses. Billing remains future work.

Push subscriptions are restricted to supported HTTPS providers, bound to one account per endpoint and removed when expired. Sending uses high urgency, a one-hour TTL, bounded timeouts and a retry for transient failures. Vercel `waitUntil` keeps friend delivery alive after a check-in response, so saving activity does not wait on push providers. This is Web Push, not a native overlay service; there is no claim that it overrides device settings or guarantees delivery during provider outages.

Photo uploads now have a preview with drag, zoom, position sliders and rotation before confirmation. Client-side resizing bounds uploads; the server independently decodes, limits and re-encodes actual JPEGs to 320×320 and strips metadata. Only invite story cards include an invitation code, QR or invitation link. Other story cards keep the mascot, caption and optional public handle. The profile has one share button; its dialog contains the public link and copy/share controls. The browser favicon is a transparent yellow shy droplet; Apple, PWA, Android and push icons use the same yellow character from one transparent master. Apple/install icons use an opaque cream backing, with a separate maskable Android variant and monochrome push badge. Versioned asset paths and the service-worker cache upgrade avoid stale blue icons. The main blue mascot stays unchanged. Run `node scripts/build_icons.mjs` and `node scripts/sync_android.mjs` after updating the icon master.

Opening an invitation shows its sender, the app's main activities and clear membership/guest choices. After signup, a separate screen asks about friendship. Choosing later keeps the inviter's request pending. Existing members can also explicitly request a connection from the invitation landing screen.

The owner's dashboard is at `/admin`. Admin one-use invitation codes are never included in public profiles. Initial ownership still requires the private one-use owner invitation. Subsequent demo phone login does not elevate a session: the owner may use a private recovery link or the owner password. `python3 scripts/configure_admin_password.py` generates the initial password in an ignored, mode-0600 file and stores only a salted scrypt hash in encrypted Vercel environment settings. The password works only for the registered, active admin account `ali`; IP and account limits restrict attempts. Never commit `.vercel/` or print environment configuration.

Schema migrations use a persisted content/version check instead of replaying every DDL statement at each function cold start. Hot query indexes cover notifications, connections, referrals and authentication challenges. Variable fonts replace independent per-weight downloads; community/admin views, statistics, friend groups, legal pages and the photo editor load on demand. New screen styles load with their page. Foreground polling runs once per minute; friend/group navigation and returning to the app refresh current requests.

`python3 scripts/improvements_smoke.py` checks the revised photo, premium, profile, invitation, permission-explanation and story flows using disposable accounts. The notification request is instrumented in headless Chromium; the service worker itself activates, but an actual Android notification must still be confirmed on a permitted real device. See `security-performance-review.md` for the review and measured transfer results.


## Google login and account linking

Authorize exactly `https://jishoo.vercel.app/api/auth/google` as a redirect URI in the Google Cloud **web** OAuth client. `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are encrypted Vercel server settings. Google login redirects through an authorization-code flow with PKCE, a ten-minute one-use state bound to the initiating browser session, and a nonce. The server verifies Google's RS256 ID token signature, audience, authorized party, issuer, age/expiry, verified email and nonce. Scopes are only `openid email`; no Gmail message access or refresh-token storage is requested.

Each verified Google subject belongs to one member account, and each account has at most one Google identity and one uniquely indexed phone number. A new verified Google identity registers with an invitation and name while leaving phone fields empty. Waiting-list contacts are encrypted, keyed by verified Google subject, updated idempotently and removed on signup or deletion of the owning guest account. Identity creation, invitation consumption and referral rewards are atomic. Existing phone members use **Profile → Settings → Login methods** from their already signed-in device to connect Google. Their full phone number remains owner-only. Google cannot be disconnected while phone login is paused, preventing lockout. Admin linking requires an elevated session; Google login itself never grants admin elevation.

If the verified Google identity already owns a separate Google-only member account, the existing phone session receives a short-lived, session-bound merge review. A second explicit confirmation merges both histories, friends, groups and premium entitlements into the current phone profile. It revokes other sessions, clears location and private social grants, and retains the old handle as a non-login alias. Admin, banned and phone-linked target accounts cannot be merged this way. Email matching or demo SMS never authorizes a merge. Without an existing phone session, recovery needs a separately verified support process.

Real Google consent/return must be checked on a signed-in browser after the Google Cloud redirect is authorized. Automated checks verify cryptography, callback state handling and actual database registration/linking using disposable preview-only synthetic identities. They do not claim to log into a person's real Google account. Phone verification remains disabled.

For the latter integration tests, `JISHOO_QA_GOOGLE_FIXTURES=1 VERCEL_TARGET=preview python3 scripts/deploy_vercel.py` uploads a protected preview-only fixture. It requires a short-lived server-key HMAC bound to an exact browser session, permits only owned synthetic QA identities/handles, and refuses production. Legacy-phone preparation uses fictional reserved numbers; merge proofs can only target these synthetic accounts. Normal deployments do not include it. `scripts/auth_integration.py` exercises Google-first signup, invite gating, optional phone linking, same-account return, one-use/purpose-bound proofs, callback session binding, explicit linking and private support management. Delete its temporary deployment and revoke its task-created deployment-access key when finished. Never use the owner invitation for QA.

## Support and installation

`/terms` and `/privacy` now link to the public `/support` form rather than the private GitHub repository. Guests and members can submit a bounded private message with an optional reply contact. The elevated dashboard lists support messages and lets the owner resolve or delete them. Messages are not shown publicly. No outbound email is sent automatically.

Personal invitation links open as full-screen documents with native page scrolling. The shorter-phone browser check verifies that the join action remains reachable. On phones, the app and its dialogs use the viewport. On desktops at least 501px wide and 600px high, version 0.2.4 restores the original 414px mobile frame with the decorative desktop sidebar; dialogs stay inside that frame. The standalone invitation landing and story export workspace retain the full viewport. Need/done reactions have one optional share icon and one continue action. Both use the same undo component in a reserved footer area; illustration/details scroll independently on short screens. The three-second undo keeps the same position in both reactions, does not move the continue action when it expires, and remains available as a snackbar if dismissed early. No check-in or notification is sent before that window expires. Bottom navigation reads right to left, with Home on the right and Profile on the left.

Profile shared memories use illustrated cards with the friend, time and moment type. Each opens the existing memory and sharing actions. The empty state explains how memories appear and leads to finding friends or invitation signup. `scripts/experience_smoke.py` verifies viewport sizing and matching undo/action positions in portrait, landscape and desktop, support delivery through the admin interface, and support access control.

`/install` works without creating a browser session. Android uses the native install prompt if Chrome exposes it, with menu instructions as a fallback. iPhone/iPad users get the Safari Share → Add to Home Screen guide. The service worker preserves background push and gives a public offline explanation when a navigation has no network. It excludes `/api/` and OAuth callbacks from caching and does not store authenticated page responses.

The Android workflow was validated locally with a full JDK 17, Gradle 8.13 and Android API/build-tools 36 using checksum-verified official downloads and the system CA store. An installable debug APK plus unsigned release APK/AAB were generated. The GitHub workflow can sign release outputs once its documented keystore secrets are configured. Website trust requires the installed app's signing certificate in `ANDROID_SHA256_CERTIFICATES`; without it `/.well-known/assetlinks.json` returns `[]` and Chrome keeps its browser fallback. This is build automation, not Google Play publication or a claim of physical-device verification.

`scripts/display_smoke.py` verifies full-number owner visibility and privacy boundaries, stable map geometry and collapse/restore, clear free/premium groups, story controls at four viewport sizes, unclipped canvases and real full-resolution PNG exports in both formats.


## Version 0.2.0 entry and QA

`/` is a lightweight public landing page and makes no private API calls. The app loads on `/#/home`, invitation links and other app routes; installed PWA start URLs remain unchanged. `/changelog` is public, and a local per-browser version acknowledgement shows returning users one simple Persian release popup. Update `src/releases.js` when publishing user-visible changes. Reopening an already accepted personal/group invitation displays its accepted state and redirects into the app without consuming another slot. Invitation documents and friend social-request dialogs use the full viewport.

The default paused-phone release is checked with `scripts/security_release_smoke.py` and its `release_visual_smoke.py` helper against a protected QA preview. The signed fixture can prepare synthetic Google and legacy-phone accounts and browser-bound merge proofs, but is never uploaded to production. Tests remove their own accounts. Older scripts using `new_ticket()` target the historical demo flow and are not appropriate for a default paused-phone deployment. Revoke only QA-created protection keys and delete the matching preview deployments afterward.

Repeated clicks do not directly affect Google Search rankings or Google login reputation. Check-in nonces prevent retry duplication, server burst limits reject excessive writes, achievements use bounded server-derived activity, and notifications are throttled. These protections limit inflated counts, friend spam and hosting costs.


## Version 0.2.1 interaction update

Nearby activity and discovery update every eight seconds while the map is visible, with immediate refresh on focus/network return, parallel reads, and no overlapping requests or camera changes. Polling stops when leaving the page; background/offline timers make no requests. The manual refresh control is replaced by a quiet automatic-update label.

Home includes a direct notification setup card. It opens the same illustrated explanation as Notifications, then calls the browser permission request only after explicit confirmation. Installed iOS, denied permissions and unsupported browsers get the matching instructions. Enabling explicitly also restores the account-wide activity preference; friend/group mutes stay unchanged. Device delivery still requires real-device confirmation.

Blobatar fallback avatars blink and look around; on fine-pointer devices their eyes follow the pointer. The library stops gaze and CSS motion for reduced-motion preferences. Uploaded photos and the main droplet illustrations keep their separate rendering. Statistics now use a filled trend chart with real per-day/month values, tappable pointer inspection, keyboard-accessible previous/next controls and a complete screen-reader data list.

`scripts/revisions_smoke.py` checks invitation gating, native-permission gesture timing, profile gaze/reduced motion, real chart counts, cross-account map updates and sharing during undo using owned preview-only QA identities. `scripts/release_visual_smoke.py` checks restored PNGs, both formats, fitted viewports and invitation replay. Neither fixture nor temporary access keys belong in production.

## Version 0.2.2 readability

`src/readability.css` defines the shared UI type scale. Version 0.2.3 moderates the increase to 14px body/actions, 12.5px explanations, 11.5px metadata and 16px form inputs (retained to prevent iOS focus zoom). Section headings are 16px and home action titles 22px. Supporting text keeps its darker contrast. These styles cover home, signup, map, friendship consent, profile, notifications and the story editor. Public landing, support, legal and release pages use the same readability principles. Persian guidance explains invitation entry, location visibility, mutual social-link acceptance and when saved premium days begin.

Chart dates use HTML labels outside the SVG so they retain their readable size as the graph shrinks. Compact weekday labels have full accessible names; the Shamsi Saturday–Friday calendar and screen-reader data list remain available. Story artwork and PNG typography use their separate canvas scale.

`scripts/readability_smoke.py after` captures owned-account screens, checks critical explanation sizes and horizontal overflow at four viewport sizes, verifies reachable map controls and leaving during a zoom, and checks the public pages at phone and desktop widths. Leaflet's active zoom transition finishes before map teardown to avoid a delayed callback reading a removed map pane. Run the suite against the protected preview fixture described above. `scripts/release_visual_smoke.py` additionally checks all four story types in both formats, immediate sharing/undo and exact preview/export PNG identity.

## Story margins for social apps

Portrait exports remain 1080×1920, with full-bleed backgrounds. Version 0.2.5 uses 100px at the top and 200px at the bottom, recovering 200px versus the former 250px at both ends. The extra space separates the existing illustration/text elements and allows a taller weekly poster. All meaningful content—branding, mascots, captions, names, stats, invitation code/QR and profile signature—stays between y=100 and y=1720, with 80px side margins. The selected margins are within the ordinary-Story ranges the user supplied from Hootsuite (100–250px top, 200–250px bottom). Meta’s separate ad guidance must not be applied as organic Story measurements. Source pages were blocked from this environment, so the user supplied the relevant excerpts; controls still vary by device. See [research notes](docs/story-layout-research.md) for the attempted sources and limits. Square exports retain their own 1080×1080 layout. The weekly card adapts its text spacing to keep the count, label and caption separate.

`python3 scripts/story_safe_area_smoke.py` runs against the local Vite frontend and a real backend using one disposable guest. It checks the smaller UI scale, responsive editors in both formats, and preview/download/native-share PNG byte identity. Render-only fixtures exercise all six card types, long Persian/Latin captions, names and weekly counts using real loaded fonts/mascots. Actual canvas glyph/image bounds must stay inside the story margins; oriented text bounds must not overlap. A contact sheet simulates account and reply overlays for visual review. These are simulated overlays, not a claim of testing the Instagram app or a physical iPhone. Use `--render-only` for focused canvas checks. The suite never registers members, consumes invitations or changes phone authentication.

## Invitation ancestry

The admin dashboard includes a searchable invitation tree with direct invite counts, descendant counts, generation labels, expandable branches and clickable ancestry. The `admin-invitation-tree` read endpoint requires an elevated admin session and returns only completed members' names, handles, avatars, parent IDs, join dates and suspension flags. It does not expose contact details or invitation codes. Results load 500 at a time; partial trees are labeled. Roots render in batches of 20 and deep branches can be focused separately. A partial `(created_at,id)` index supports the ordered query. The Home testing-premium banner is removed; testing access and saved premium days remain unchanged.

## Vercel Analytics and Speed Insights

The Vite app uses `@vercel/analytics/react` and `@vercel/speed-insights/react`. Collection is disabled by default and currently configured off in Vercel production, preview and development. After upgrading or restoring quota, enable the desired Vercel product and set these public build variables to `true`, then redeploy:

- `VITE_VERCEL_ANALYTICS_ENABLED`
- `VITE_VERCEL_SPEED_INSIGHTS_ENABLED`

False/unset flags load neither provider script nor the lazy SDK chunk. Enabled production builds use same-origin provider scripts, categorized hash-route page views, 10% Speed Insights sampling and `beforeSend` filtering. Invite/group codes, account handles and query strings are removed from page URLs. Admin/API routes and URLs containing an admin-access token are excluded. No account, form or check-in data is sent as custom events. Privacy-page wording reflects the build flags. Enabling collection remains subject to Vercel's project settings and quota; this setup does not upgrade the plan or bypass usage limits.

`python3 scripts/icon_smoke.py` uses a fresh browser context to verify migration from the previous public icon cache, preservation of unrelated storage, new favicon/Apple references and icon rendering without a network connection. Installed launcher icons remain subject to the OS update schedule; existing home-screen shortcuts may need to be added again.

## Empty social-account reminder

After a successful acceptance of a social-account sharing request, a member with no saved social links sees a compact mascot reminder. They can skip without changing the accepted relationship, or open a focused four-field social-account editor. Its privacy note explains that saved links are visible to all friends with mutually accepted sharing. Saving edits only social links; cancel keeps drafts private. The main profile form reuses the same fields. Merely viewing or declining a request, or accepting with an existing account, does not open the reminder. The server remains the authority for link validation and mutual consent.

`python3 scripts/social_accounts_smoke.py` uses the protected QA identity fixture and three disposable members to check the reminder at four viewport sizes, keyboard focus, skip/cancel/save, unsafe-link rejection, unchanged name/handle and continued privacy from friends without social-sharing consent. All QA accounts are deleted afterward.


### Navigation and local map privacy

Ephemeral dialogs use same-URL browser history state, scoped to the current in-memory app/account. Back closes a child story before its parent moment; reload cannot revive a pending confirmation. Actual page navigation records its origin with a safe direct-entry fallback. Map cameras, scope, local GPS and map/list choice stay in account-scoped memory across tab changes; they are not saved to browser storage. Local map profile actions are authorized in the server payload: accepted friends, the registered owner, or registered people who chose profile visibility. Anonymous strangers and guests have no profile link. Hidden activity is excluded; world aggregation always strips identity. `scripts/navigation_signup_ui_smoke.py` covers browser behavior and `scripts/invite_profile_api_smoke.py` uses owned preview identities to check invitation races, waiting-list authorization and map identity boundaries.


## Automated checks and performance

GitHub [App checks](https://github.com/aliinreallife/jishoo/actions/workflows/ci.yml) runs frozen installation, workflow lint, unit checks, a production build, download budgets and eight synthetic browser suites for PRs and main. No app/DB/OAuth/deployment secret is needed. [Dependency security](https://github.com/aliinreallife/jishoo/actions/workflows/dependencies.yml) audits weekly; Dependabot proposes reviewable updates. [Production health](https://github.com/aliinreallife/jishoo/actions/workflows/production.yml) checks the live site daily and after successful production-deployment events without creating accounts or publishing anything. The existing [Android TWA build](https://github.com/aliinreallife/jishoo/actions/workflows/android.yml) remains available manually and for its original branding/build paths. All action references are pinned and jobs use read-only repository permissions.

Use Node 24 (`.node-version`), `npm run build`, `npm run check:bundle`, and `npm test`. For the browser suite install `scripts/requirements-browser.txt`, run `python3 -m playwright install --with-deps chromium`, then `npm run test:browser`. See [the performance report](docs/performance.md) for measurements, cache policy, backend changes, the workflow/check commands and their scope.
