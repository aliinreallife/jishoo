# Nearby, worldwide map and shared notifications

Nearby continues to use a 3 km radius, approximate coordinates and the last
30 minutes of map-visible activity. Its two tabs keep the map mounted while
switching to a list of nearby profiles that opted into discovery. Only the
visible tab's data is polled, every 5 seconds while visible and online. Focus and
network return refresh local activity. Panning local maps does not query the
database. The local query chooses the latest eligible event per person before
deduplication, so repeated taps do not crowd out other people.

## Map presentation and consent

The map has no permanent bottom summary card. The viewport person count and an
explicit refresh icon/status sit above the map, including fetch/offline states.
The old world count is labelled as belonging to the previous view until the new
viewport response arrives. Tapping a character opens a compact, dismissible
selection sheet. Selected data disappears when the participant disappears.
Confirmed empty views retain the same empty-state card during background refresh;
loading only changes the refresh indicator. Counts and marker presentation derive
from the same response during render, avoiding transient false emptiness. A new
location or world viewport must receive a matching response before claiming it is
empty.

Screen-space collision grouping drives the presentation. Up to five people keep
visible characters at any zoom. Larger crowded views use a weighted butter,
peach and lilac canvas heatmap; zooming reveals characters. At the closest zoom,
coincident positions retain a count and open a list rather than inventing exact
locations. Widely spaced participants may remain characters even on a broad
view. There is no fabricated activity in empty/sparse views. Canvas work is
limited to map/data changes, DPR is capped at 1.5, and map controls retain 44 px
targets. No extra density service or paid API is used.

The first map visit explains Hidden, Anonymous and Profile options. A persisted
review flag is separate from consent, and existing choices remain unchanged.
Keeping the current choice only acknowledges this explanation. A new publishing
choice requests geolocation explicitly; merely viewing nearby data never opts
someone into sharing. The editor is available on Me, in profile settings and
through a small visibility button in the map header. It is outside the map
canvas, so it cannot overlap permission prompts, empty notices or selected pins. Location refreshes cannot reactivate an account
hidden from another tab. World activity stays anonymous in every visibility mode.

The premium worldwide view requires a registered account and server-checked
premium access. It never returns names, handles, photos, user IDs or social links.
Zoom-dependent cells are filtered to the viewport; at most 240 weighted cells
are returned. If needed, cells coarsen instead of discarding people. Their
approximate centroids keep a lone participant near their actual city, including
at low zoom. The viewport count is the number of people, not the cell count. People who hide map sharing,
private registered check-ins, stale locations and suspended members are excluded.
The initial world view works without granting the viewer location permission.
Global availability does not expand nearby profile discovery beyond 3 km.

One anonymous snapshot is cached in Neon for 30 seconds and shared by all
viewers. A transaction advisory lock prevents simultaneous cache rebuilds.
Hiding, deleting or merging an account, and suspending a member, invalidate this
cache. Existing clients clear removed markers on their next refresh. Browsers
pause polling when hidden, refresh global data every 30 seconds, and debounce
viewport changes by 400 ms. The API remains private/no-store; personal account
responses are never placed in this shared cache.

At 30 simultaneous viewers, stationary world maps generate about 3,600 map
requests per hour, plus navigation/viewport changes. The global snapshot rebuilds
at most about 120 times per hour rather than once for every viewer's refresh.
This is a practical small-app workload, not a dollar quote or a guarantee of free
hosting. Map tiles, database compute, Vercel functions/transfer and existing quotas
still apply. Thirty viewers for one hour daily is about 108,000 refreshes/month;
continuous 24/7 use is about 2.6 million. No paid plan is enabled automatically.

Registered friends sharing a done check-in keep the existing pair rules:
up to 60 seconds is together; up to 5 minutes is back-to-back. Shared moments
notify both people and replace the redundant ordinary check-in alert for that
pair. Friend/group/global notification preferences are honored.

Registered non-friends can receive an anonymous nearby coincidence when both
shared a done check-in, both have fresh opted-in map locations, and they are
within 3 km and 5 minutes. No friendship, social-link consent, public profile
or friend achievement is created by this coincidence. Guest/private/hidden
check-ins do not produce these alerts. The notification links to `/nearby` and
does not identify the other person, event, marker or coordinates.

Both inbox inserts and a rolling per-pair cooldown claim commit together. The
cooldown is 5 minutes for friend alerts and 30 minutes for anonymous nearby
alerts, shared across both directions, including concurrent requests and retries.
Web Push fans out to the enabled devices of each eligible recipient in Vercel's
background lifetime; provider/OS delivery still depends on permission, network
and device settings. Repeated taps cannot bypass the per-pair cooldown.

Admin graphs use lazy-loaded React Flow (`@xyflow/react`, MIT) with Dagre layout;
only admins download this bundle. A graph renders up to 200 loaded members at a
time; search, branch focus, pagination and the accessible tree list remain.

Subscription gifts, lifetime changes, account suspension/reactivation, invitation
revocation and private recovery-link creation show a themed confirmation with
the affected person/link and effect. Cancel and Escape send no mutation. The API
also requires `confirmed: true` after verifying an elevated admin session, so an
older cached admin interface cannot silently perform these actions. Normal
seven-day invitation creation remains one click.

## Compact map layout

Permission and empty-state cards dock 12 px above the attribution instead of
reserving an 83 px bottom gap for a floating visibility button. The location
prompt is a single explicit action with a mascot, short explanation and yellow
arrow; before the first geolocation it states that the map shows Tehran and that
viewing does not publish the viewer. A denied/unavailable location replaces the
helper copy inline, without adding a nested scrolling panel. The empty state
keeps its invitation action in a compact row. Neither card scrolls internally.

Zoom controls remain on the left and the location control has its own position
on the right. Before geolocation, the permission card supplies that action.
Nearby/list tabs, visible count, automatic-refresh status, viewport/camera state,
consent behavior and attribution remain. The main tabs keep their shared top
inset. World anonymity is stated in the existing status line.

`scripts/map_layout_smoke.py` checks permission, denied and empty states across
seven viewport sizes, including 320×568 and the short desktop phone frame. It
measures card/viewport scrolling, controls/card intersections, 44 px controls,
map height and bottom spacing; screenshots and geometry live in ignored
`artifacts/`. `JISHOO_LAYOUT_CAPTURE_ONLY=1` records a comparison baseline without
claiming those geometry checks passed. Basemap imagery in synthetic UI tests is
an explicitly neutral fixture; these checks measure actual application layout.

## Immediate check-ins and profile entry

Check-ins send immediately, without a countdown or an undo overlay. An in-flight
guard prevents repeated taps; failures show an error rather than a saved state.
Sharing remains available while the request runs. Completed responses invalidate
map data in open same-origin tabs through a signal containing no identity,
status or coordinates. Polling remains paused when hidden/offline. If an older
read is in progress when that signal arrives, its result is discarded and a
new read follows it. Local polling is five seconds; world polling stays thirty
seconds. Shared check-ins invalidate the world snapshot instead of waiting for
its old TTL to expire. These are refresh intervals, not guaranteed delivery times.

Selection follows the viewer-scoped participant key, not a changing event ID.
Fresh status and revoked profile permission update the open sheet; expired or
hidden participants remove it. Accepted friends can open each other's local-map
profiles even in anonymous mode, provided location sharing is enabled. Strangers
can open profiles only with profile opt-in. Hidden, anonymous non-friends, guest
and worldwide identities are not made public. Nearby list identities now open
profiles too, including friends; public profiles show outgoing, incoming and
accepted friendship states without repeatedly sending requests. Social-link
consent remains separate and mutual.
