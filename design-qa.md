# Jishoo visual and interaction review

final result: passed

## Source and comparison evidence

The source visual truth is the user's original Persian mobile references in this conversation, with the retained canonical blue shy mascot at `public/assets/shy-drop.webp` (1280×1280). The follow-up brief explicitly restores that illustration language to actions, reactions and story cards, limits Blobatar to profile identity, removes the sharing tab and adds nearby discovery, invitations, achievements and administration. New community/admin screens are intentional extensions rather than pixel clones of an absent reference screen.

`artifacts/v3-design-comparison.png` is a single combined comparison: the canonical original mascot, the rejected avatar-based home screen (`artifacts/v2-home.png`), and the revised illustrated home (`artifacts/v3-home.png`). The comparison is 1259×920 pixels; both screen captures are 393×852 pixels at deviceScaleFactor 1. The standalone reference art is fitted into a 393px-wide reference panel rather than presented as an original full-screen mock. The old/new counters and guest seeds differ because these are isolated real sessions, not seeded sample history. No pixel-difference score or 1:1 full-screen reference match is claimed.

The source art and combined comparison were opened visually. Focused full-size captures were also opened for the need-result screen and story, profile upload, discovery, admin controls, invitation slots and social preview. The scene art (`happy-drop.webp`, `together-drops.webp`, `back-to-back-drops.webp`) was generated from the canonical raster reference; the paired blue/yellow and relieved-blue assets were visually inspected at full size. No handcrafted SVG/CSS drawings replace the illustration assets. Phosphor supplies interface icons; the requested Blobatar library supplies fallback profile avatars only.

## Findings and iteration history

1. **P1 — Avatar shapes replaced the brand characters.** The old home and stories used Blobatar as hero illustrations. Replaced action, result, story and promotional figures with the original shy droplet and matching relieved/paired raster illustrations. Identity areas retain uploaded photos or name-based avatars. Evidence: combined comparison, `v3-home.png`, `v3-need.png`, `v3-together.png`, `v3-together-story.png`.
2. **P1 — “I need to pee” had no useful result/share state.** Added a full illustrated reaction, playful copy, a direct share-card action and a nearby-buddy action. “I just peed” also opens its own illustrated reaction and matching card. Evidence: `v3-need.png`, `v3-need-story.png`, `v3-success.png`, `v3-done-story.png`. Both paths and keyboard dismissal passed in the browser.
3. **P2 — The sharing tab displaced the desired discovery flow.** Removed it from navigation and placed sharing in result screens, statistics, invitations and pair history. The central tab now finds opted-in nearby buddies. Evidence: `v3-home.png`, `v3-discover.png`; browser assertions verify five tabs and no share tab.
4. **P2 — A generic span rule faded the restored home art.** The first capture inherited `opacity:.53` from action subtitles (`v3-home-first.png`). Added an explicit opacity rule for mascot spans. The combined comparison and `v3-home.png` show the corrected full-color art.
5. **P2 — Invitation counts were below persistent navigation.** `v3-invitation-quota.png` placed the usage/remaining text below the initial visible area. Shortened the pair hero and moved the quota card ahead of the code card. The revised same-size capture `v3-invitation-quota-fixed.png` shows all three slots, usage, remaining count and share action above navigation. A focused browser assertion confirms that the count is in the viewport.
6. **P2 — The handle inherited RTL placement.** Applied an LTR direction to the handle label while preserving Persian layout. Public profiles and discovery already use explicit LTR handles. Profile sharing and server-rendered social metadata passed production verification.

All identified P1/P2 findings were fixed and recaptured. The final focused invitation review passed after the layout change. There are no remaining actionable P0/P1/P2 findings in the reviewed scope.

## Required fidelity surfaces

- **Fonts/typography:** Local Vazirmatn provides Persian shaping, clear 400–900 weight hierarchy and readable wrapping; Lalezar remains the display brand. Large reaction/story headings, smaller supporting copy and LTR handles are distinct. Exported PNGs embed local Persian fonts and preserve shaping.
- **Spacing/layout:** Cream rounded cards, subtle borders, fixed bottom navigation and safe-area spacing follow the references. Sharing uses a full-screen dialog with Escape/focus containment. Quota counts are visible in the initial mobile viewport. Larger admin/profile content scrolls while navigation remains available. No horizontal page overflow was observed at 320, 375, 393, 768 or 1440px widths.
- **Colors/tokens:** Warm cream, yellow, pastel blue, lavender, navy outlines and pink blush preserve the original palette. Story themes intentionally allow lemon, lavender or sky variations. Meaningful empty/locked/earned states use subdued or highlighted colors without fabricated activity.
- **Images/asset quality:** The blue shy silhouette, inward hands, blush, dark outline and yellow puddle are retained. The relieved mascot and differently colored pairs match that watercolor language. Raster art has transparent edges and uses contain sizing. Avatar photos are cropped separately and remain identity imagery. The app icon and 1200×630 social preview use the same brand art.
- **Copy/content:** Casual Persian reactions, invitation limits, inviter identity and both status stories are explicit. Three-slot usage reflects real successful registrations; admin invitations are individually one-use. Gift days are clearly described as saved during the free-premium test period. Profiles, invitation history, achievements and administration display database state. Phone verification is visibly a demo.

## Interaction evidence

- Locked dependency installation, production build and **nine logic tests passed**.
- **Ten baseline API scenarios passed**, including guest persistence, phone normalization/login, both referral gifts, authorization, social consent, check-in idempotency, approximate anonymous map activity, location revocation and both real pair timing intervals. The back-to-back test waits for the actual interval.
- **Ten community API scenarios passed**, including three-slot exhaustion, child slots, incoming inviter requests, one-use admin links (including personal links), reserved/unique handles, uploads, anti-farming achievement progress, per-friend/collection notification preferences, nearby opt-in/revocation, lifetime gifts, suspension, private admin elevation and one-use recovery/claims. Tests use and remove only their own disposable accounts.
- **Nine browser scenarios passed locally and against the production origin**: both contextual share flows; editable themes/captions and 1080×1920/1080×1080 PNGs; explicit invite-required signup; photos and fallback avatars; inviter cards and requests; discovery and friend markers; actual pair-story artwork; achievements/notifications/public profile metadata; admin invite creation and lifetime gifts; keyboard handling and five responsive widths. No page JavaScript errors or failed application assets/API requests were observed. Results are in `artifacts/smoke-results.json`.
- Production verification uses real HTTPS responses verified against the system CA and fulfilled to Chromium, whose trust store lacks the managed cloud proxy CA. It preserves the public origin, cookies, actual assets and live database responses. Certificate verification is not disabled.
- A focused local browser check registers `/sw.js` and confirms the active worker. The published icon/preview image and profile Open Graph metadata are present.

## Limits and P3 follow-up

- The active cloud network policy blocks external OpenStreetMap tile imagery. Real geolocation, activity, discovery, friend labels and location controls are tested; **basemap imagery is not visually verified here**. The saved cloud draft includes the tile host for later activation.
- Actual OS push delivery needs a real permitted browser/device and was not claimed by automated checks. VAPID configuration, the push worker, subscription validation and notification preferences are implemented. OS/browser settings control banners; iOS requires an installed web app. Arbitrary overlays over other apps are outside browser capabilities.
- Generated poses are an artistic continuation of the original mascot. Minor pose/texture differences are P3. Native share sheets depend on device support; PNG download is verified.
- SMS ownership verification, payment checkout, PWA installation/offline support and TWA packaging remain later stages.

## Implementation checklist

- [x] Restore canonical mascot art and generate matching activity/pair scenes.
- [x] Separate profile avatars/photos from story/hero illustrations.
- [x] Verify both status reactions, contextual sharing and actual PNG dimensions.
- [x] Verify invitation limits, admin permissions, profiles, achievements and notification controls.
- [x] Compare screenshots, fix P1/P2 findings and recapture focused evidence.
- [x] Keep the local preview available and verify the published application.


## October 17 follow-up

This revision supersedes the earlier five-tab navigation and large result-screen sharing controls. Four tabs now use **این نزدیکا** for the combined map/discovery flow. The two reactions have a small optional share icon, one close action and a global three-second undo. Need copy reads «جیش دارم. الان برمی‌گردم!»; there is no company request. The profile link is inside the share dialog only. New friend cards, explicit social permissions/mutes, accepted shared groups, real chart ranges and a droplet calendar use the existing cream/pastel palette. Terms and privacy have public reading pages. The favicon is an isolated yellow shy droplet with a transparent canvas; the blue home mascot remains unchanged.

Fresh captures are `v4-welcome.png`, `v4-undo-window.png`, `v4-need-result.png`, `v4-done-result.png`, `v4-friends.png`, `v4-friend-permissions.png`, `v4-shared-group.png`, `v4-group-link.png`, `v4-stats.png`, `v4-nearby-unified.png`, `v4-notifications.png`, `v4-terms.png` and `v4-privacy.png` under ignored `artifacts/`. Screenshot review caught visible screen-reader chart text; it is now visually hidden, and long-range labels are spaced apart. The browser checks exercise 320, 393, 768 and 1440 pixel widths. Group membership, friendship and social-link consent are separate decisions. The tests use disposable accounts and do not consume the owner's invitation.

Final screenshot review also caught uneven chart baselines when alternate month labels were omitted and markers hidden behind the expanded nearby panel. Reserved label space aligns every bar; the nearby panel now takes its own layout space so Leaflet resizes the visible map. Fresh screenshots confirm both corrections, and browser assertions check aligned bar tracks and markers above the panel.
