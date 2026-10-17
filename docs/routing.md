# Page URLs

Jishoo uses React Router's BrowserRouter with a persistent App component. The
screen components and temporary dialogs retain their existing presentation.
`src/routing.js` owns page paths, legacy conversion and notification destinations.

- `/`: public landing. `#how` remains a section anchor.
- `/home`, `/nearby`, `/friends`, `/profile`, `/settings`, `/stats`,
  `/achievements`, `/notifications`, `/invite`, `/admin`: app screens.
- `/circle/:id`: a group. `/group?group=CODE&invite=CODE`: group invitation.
- `/stories` and `/stories/need|checkin|weekly|invite`: story workspace.
- `/join?invite=CODE`: invitation landing. Query parameters retain invitation
  and Google return context; ordinary screen navigation discards old flow state.
- `/u/:handle`: public profile, served by the existing metadata API.
- `/privacy`, `/terms`, `/support`, `/install`, `/changelog`: public pages.

Entry replaces recognized legacy hash routes (`/#/profile`, `/#profile`,
`/#/circle/ID`) in the current history entry. Old root query links also work.
Only known screen fragments are converted; normal page section anchors remain.
This compatibility must stay for installed PWAs, older Android builds, bookmarks,
QR images, shared invitations and notification records already stored in the DB.
No database migration or mass replacement of those records is necessary.

Settings is a route with the existing full-screen editor. Opening it through the
app records an internal history marker; close returns to the previous screen.
A direct settings link closes to `/profile`. Browser Back/Forward opens/closes
the editor. Drafts and pending undo remain in the persistent App, not keyed by URL.

Vercel rewrites only known app pages to index.html. Keep `/u/:handle` mapped to
the profile API, and keep APIs, OAuth, assets, manifest, service worker and Digital
Asset Links outside the SPA rewrites. Unknown server URLs should remain 404s.
Private app paths have X-Robots-Tag noindex and a matching client-side meta tag.

Google's authorized callback stays `/api/auth/google`. The validated return path
already accepts clean paths, query strings and section anchors. Session cookies,
PWA manifest id/scope, service worker location and push configuration are unchanged.
New PWA shortcuts start at `/home`; future Android builds use `/home?source=twa`.
Existing installed Android packages continue through the legacy converter.

Analytics uses the router location and keeps historical `/app/SCREEN` categories.
It removes handles, group identifiers and query strings, and excludes admin/API
traffic. Both Vercel collection flags remain off unless explicitly enabled.

Validate with `npm test`, `npm run build`, and `python3 scripts/routing_smoke.py`.
The browser test uses explicit synthetic API responses to isolate routing and
does not authenticate with Google or write any account data. Validate Vercel
rewrites and real backend access separately on a deployment before promotion.
