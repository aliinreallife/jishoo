# Jishoo visual and interaction verification

## Current scope

The updated web app follows both supplied Persian mobile references: warm cream surfaces, yellow check-in actions, lavender sharing accents, rounded cards, a shy guest character at the WC door, friendship moments and a purple weekly polaroid story. Personal characters now use the explicitly requested Blobatar library rather than identical droplet artwork. This changes their silhouette and facial detail deliberately; the original shy blue mascot remains in the desktop brand panel.

No sample friends, fabricated counters, simulated conversations or illustrated map are shown as live data. The current product uses real guest/account sessions and database history. Chat was removed as requested. PWA/TWA support and payment checkout are deferred.

## Visual evidence

Screenshots live in ignored `artifacts/` and can be regenerated with `scripts/smoke.py`:

- `v2-welcome.png`: optional account entry, generated yellow guest character and no name input.
- `v2-home.png`, `v2-home-320.png`, `v2-home-1440.png`: current activity, distinct Blobatar expressions, honest empty states and responsive brand panel.
- `v2-success.png`, `v2-together.png`: completed check-in and two connected, differently shaped characters in a real pair moment.
- `v2-otp.png`, `v2-signup.png`: visible demo phone verification followed by a name-generated character and invitation field.
- `v2-profile.png`, `v2-stats.png`, `v2-invite.png`, `v2-friends.png`, `v2-connection.png`: persisted profile, statistics, personal invitation and per-friend consent.
- `v2-story-editor.png`, `v2-invite-story.png`, `v2-together-story.png`: weekly, invitation and pair cards with QR links and export controls.
- `v2-story-export.png`, `v2-post-export.png`: actual PNG files verified at 1080×1920 and 1080×1080 pixels with embedded Persian fonts.
- `v2-nearby.png`, `v2-map-friend.png`: browser geolocation, separate publication opt-in and a labeled connected-friend marker.

Representative welcome, home, profile, signup, weekly export, pair moment, pair story and map-marker screenshots were visually opened during implementation. Primary viewport is 393×852 CSS pixels, with additional checks at 320×640, 375×667, 768×1024 and 1440×1000. This is a visual review against the references, not a pixel-difference score.

## Findings resolved

- A weekly story with a single check-in initially showed a tiny avatar. Single-character and two-character layouts now use larger figures.
- At common mobile heights, the story preview initially pushed secondary export controls below navigation. The preview now fits the available area; smaller screens retain scrolling.
- Invitation, check-in and weekly-statistics shortcuts initially opened the general card picker. They now open the matching card directly.
- The full-screen pair story needed keyboard containment and Escape dismissal. Its own dialog now traps focus and restores the prior focus on close.
- Initial map-centering code used Leaflet internal fields. The revised implementation uses the public map API and a maintained current-location marker.

## Verification and limits

- Seven pure logic tests verify phone normalization/encryption, pair timing boundaries, approximate coordinates, social URL validation, premium gating and deterministic/distinct Blobatar names.
- Ten API scenarios passed against the live Neon-backed Vercel API: guest access, invite-only demo signup, both referral gifts, mutual connections, link consent/revocation, collection membership, idempotent check-ins, approximate anonymous map activity, location revocation, existing-phone login and both real together/back-to-back intervals. The back-to-back scenario waits for the actual interval; it does not alter timestamps. Tests remove only their own disposable accounts.
- Ten browser scenarios passed locally against the real deployed testing API: guest flow/persistence, full-resolution PNG exports, geolocation/consent, phone/OTP/signup, profile/statistics/invites, removal of chat, invitation-link signup with both rewards, social consent, named map markers, real pair story/dialog behavior, five responsive widths and application-error checks. Results are in `artifacts/smoke-results.json`.
- Production browser verification uses the same suite against the public Vercel origin. In this managed proxy, a transport adapter fetches real HTTPS responses using the system CA trust store and forwards them to Chromium. It does not disable certificate checks or replace application data with fixtures.
- The cloud's active network policy blocks `tile.openstreetmap.org`; therefore **external basemap imagery is not visually verified here**. Browser geolocation, real nearby API data, friend labels, map controls and opt-in/revocation are verified. The application loads standard OpenStreetMap tiles with visible attribution; the saved cloud configuration draft includes the tile host for later activation.
- Native operating-system share sheets depend on device/browser support. Automated verification covers downloadable PNGs and the application fallbacks. Real SMS verification and subscription charging are intentionally inactive in testing.

No page JavaScript errors or failed application assets/API requests were observed in the passing suite. External map-tile requests are reported separately from application asset checks. No actionable blocking UI issue remains in the reviewed scope.
