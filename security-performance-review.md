# Security, performance and interaction review

Reviewed the live Jishoo app and its source, then deployed the fixes to https://jishoo.vercel.app/. This is a scoped code and interaction review, not a complete penetration test or accessibility certification.

## Fixed security issues

- Upload validation now independently decodes JPEGs on the server with a one-megapixel input limit, re-encodes a 320×320 image and removes EXIF/camera/location metadata. Invalid/polyglot inputs, non-JPEGs, oversized requests and excessive dimensions are rejected.
- Push subscriptions accept only supported HTTPS provider hosts and valid browser key formats. Alternate ports, credentials, fragments and arbitrary destinations are rejected. A unique endpoint belongs to one signed-in account; account switching transfers ownership, and logout unsubscribes the device.
- Admin password login requires the active registered owner account `ali` and a matching salted scrypt hash. Regular members cannot become admins using the password. IP/account limits restrict guessing. The plaintext initial password stays in an ignored mode-0600 file; Vercel stores only the encrypted salted hash. The one-use owner invitation and recovery mechanism remain protected.
- Production serves a Content Security Policy, frame embedding protection, MIME sniffing protection, a referrer policy and restricted camera/microphone/geolocation policy. The push worker cannot redirect notification clicks to another origin.
- API mutations reject foreign origins, cross-site browser metadata, malformed object bodies and oversized payloads. Session/check-in limits reduce automated abuse. Existing relationship authorization, social-link consent, coarse-location revocation and invite admission limits were regression tested.
- `npm audit` reported zero known vulnerabilities across the installed production and development dependency tree at the time of this review.

## Measured performance

The same fresh mobile welcome flow was loaded before and after deployment using Chromium with the trusted HTTPS adapter. Response-body sizes below exclude images and API data. JavaScript/CSS are measured after transport decompression; these are resource-size measurements, not a promise of a particular network speed or Lighthouse score.

| Initial resources | Before | After | Change |
| --- | ---: | ---: | ---: |
| JavaScript | 415,135 bytes | 394,559 bytes | 5.0% smaller |
| CSS | 103,507 bytes | 98,040 bytes | 5.3% smaller |
| Fonts | 202,988 bytes | 132,960 bytes | 34.5% smaller |
| Font requests | 9 | 3 | 6 fewer requests |
| Combined above | 721,630 bytes | 625,559 bytes | 13.3% smaller |

Community/admin views and the photo editor load on demand. A variable font replaces separate weight downloads. Database initialization checks a persisted migration version instead of replaying every schema change and updating invitations on each function cold start. New indexes cover notification history, connections, invited users and auth challenges. Guest bootstrap skips unused notification/preference queries and achievement writes. Reading notifications uses a direct query. Visible foreground refreshes run once per minute rather than every 20 seconds.

Friend push delivery runs with Vercel `waitUntil`, so check-in responses do not wait for every recipient's push provider. Sends have bounded timeouts, a retry for transient failures, high urgency, a one-hour TTL and per-friend tags. Provider failures are recorded safely instead of being silently treated as successful delivery.

## Captured interaction steps

Fresh screenshots were captured before changes and inspected again after implementation. Evidence files are generated locally under ignored `artifacts/`; run `scripts/improvements_smoke.py` to regenerate the changed flows. The local visual report is `artifacts/security-performance-audit.md`.

1. **Profile and saved days — passed.** The old reserve copy was tiny and low contrast. The new gift card shows a large day count, readable explanation and explicit deferred start. Public profile sharing contains its link and copy/share buttons inside the share dialog. Evidence: `audit-before-profile.png`, `audit-after-profile.png`, `audit-after-profile-sharing.png`.
2. **Photo selection — passed.** The old native input immediately cropped and saved. The replacement previews the actual circular crop with drag, zoom, position and rotation, then requires confirmation. Labeled sliders offer a keyboard alternative to dragging. Evidence: `audit-before-photo.png`, `audit-after-photo-crop.png`.
3. **Invitation landing and friendship — passed.** A dedicated page shows the inviter, app benefits, gift timing, membership CTA and guest option. Signup and friendship are separate decisions; choosing later keeps the request pending. Existing members can also request a connection explicitly. Evidence: `audit-after-invitation-landing.png`, `audit-after-invitation-friend-choice.png`.
4. **Contextual stories — passed.** Need/done/weekly/pair stories omit invitation codes, invite URLs and QR links. Only invitation stories carry them. The disliked phrase was removed from the app. Actual PNG export was checked. Evidence: `audit-after-no-invite-story.png`, `audit-after-invite-story.png`, `audit-no-invite-story.png`.
5. **Background notifications — client/server checks passed; real-device receipt pending.** A mascot explanation appears before the native permission request. It explains purpose, privacy and opt-out. Blocked permissions and iPhone Home Screen requirements have specific guidance. A server-backed test reports provider acceptance separately from final device display. Evidence: `audit-before-notifications.png`, `audit-after-push-explanation.png`.

The changed screens were checked at 360, 393, 768 and 1440 pixels without horizontal overflow or page JavaScript errors. Native dialog focus containment and labeled controls were exercised. Screenshot inspection and these checks do not establish full WCAG conformance.

## Validation and limits

- 14 unit tests passed, including actual JPEG decoding/metadata removal, push destination validation, owner password authorization and a service-worker push event with no open app window.
- 10 baseline live API scenarios passed against the preview, including real simultaneous and back-to-back event timing.
- 10 community live API scenarios passed against the preview and production, including one-use invites, role boundaries, social consent, discovery, anti-farming, notification mutes and lifetime gifts.
- The targeted browser suite passed locally against the preview backend and against the production app with actual production security headers. It uses disposable QA accounts and never consumes the owner invitation.
- Production website/database health, exact built client asset, new social preview, installation manifest and no-cache push worker were verified.
- The notification permission call was instrumented in headless Chromium. The actual service worker activated locally; its push-event behavior was unit tested. This does not prove that an Android device received a message. On Android Chrome, enable notifications in Profile → Notifications, approve the explanation and browser prompt, then send a test. OS notifications, connectivity, battery restrictions and Do Not Disturb affect delivery. No SMS or native overlay delivery is claimed.
- **Testing limitation:** OTP intentionally auto-succeeds and sends no SMS. Phone possession is not verified in this mode. Keep this as a testing app until real SMS verification is implemented; the admin gate additionally requires a private capability or owner password.


## October 17 interaction and privacy update

The app now has four navigation tabs. **این نزدیکا** contains both the map and opt-in people discovery. Map markers within one coarse location cell use separate screen anchors; larger crowds use a count with a selectable list. Their stored/API coordinates remain approximate. The friend page now supports exact handles, incoming/outgoing requests, explicit disconnection and shared groups. Existing private collections are preserved.

Shared groups require acceptance. Owners can invite by handle or share a rotatable capability link; new account registration still requires its separate admission invitation. Group membership does not create friendships, reveal phone numbers, grant social links or show private check-ins. Pending invitations do not expose the accepted member list. Non-owners cannot manage links or invitations. Unfriending removes consent grants and private collection membership without silently removing shared group membership.

Both check-in actions wait three seconds before sending any API request. Undo prevents the event, friend notification and achievement update. Reactions use one close action and an optional share icon. The profile URL lives only in its share dialog. Statistics now have distinct real week/month/year chart ranges and a droplet calendar. Public terms/privacy routes do not bootstrap a browser session, and signup stores the terms version.

The notification test queries all subscriptions owned by the signed-in account and fans out independently to each device; one failure does not prevent other sends. Responses distinguish provider acceptance from device display. Existing background push, permission explanation and per-friend mute remain in place.

New page components and their CSS load on demand. Moving their styles out of the entry stylesheet avoided about 9.6 KB of extra initial CSS compared with bundling all new screen styles eagerly. The production build has a 393.4 KB main JavaScript asset and a 101.9 KB entry stylesheet (uncompressed); map, stats, friends, legal, story and admin components are separate chunks. These build sizes are not timing or Lighthouse measurements. Statistics queries run concurrently, and incoming requests refresh on social-page navigation or returning to the app instead of requiring a reload.

The transparent yellow favicon was generated from the shy mascot and visually inspected; the main blue illustration and social preview are retained. Validation for this revision includes 17 unit tests, the production build, live baseline API scenarios, the current browser flows and the photo/invitation/notification/story regression suite. Automated provider/worker tests still do not establish actual Android delivery. External basemap imagery and real-device push remain the same verification limits described above.


Fresh production welcome measurement for this revision: **393,410 bytes of JavaScript, 101,939 bytes of CSS and 132,960 bytes of fonts across three font requests** after transport decompression. The total is 628,309 bytes, 12.9% below the original 721,630-byte baseline above, and 0.4% above the preceding version while adding the new flows. The browser confirmed that map, friend, statistics and legal chunks were not requested on welcome. Images/API data are excluded; no page-load timing claim is made. The exact published main asset and transparent favicon matched the local build. All ten baseline and ten community API scenarios passed on the updated backend. Temporary QA deployment-access credentials were revoked after testing.


## Google and install security follow-up

Google OAuth uses server-held encrypted client configuration, PKCE, a browser-session-bound one-use state and nonce, and Google's signed verified identity. A new Google registration can omit phone while still consuming a valid invitation atomically with identity/referral creation. Phone linking uses a separate one-use challenge. Neither email matching nor linking automatically merges independent accounts. Google emails are encrypted and owner-only. Google-only users cannot remove their only login method. Admin Google linking needs an elevated session, and Google return always starts an ordinary session rather than elevating a demo-login admin.

Five additional logic checks bring the suite to 22: token issuer/audience/authorized-party/nonce/email/expiry rejection, safe return paths, valid Android signing fingerprints, environment-driven CARTO configuration and API/OAuth cache exclusion. Protected preview-only synthetic identity fixtures exercise actual Google-first signup and later phone linking without adding a production authentication bypass. The fixture is opt-in on preview deployments, requires a short-lived server-key signature, and targets only a matching anonymous session with a synthetic QA identity. It is not uploaded by normal production deployment.

The PWA worker caches public static assets and a public offline page, not private API responses or account HTML. The public support form persists bounded messages with per-session rate limiting, while listing, resolution and deletion require elevated admin authorization. The Android wrapper contains no Google secret or database credentials; the unsigned release artifacts need separate signing and Digital Asset Links configuration before distribution. Real Google consent and Android system behavior remain device/account checks; automated synthetic proofs are not evidence of a real person's Google login.
