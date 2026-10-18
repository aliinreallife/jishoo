# Daily streaks and free freezes

A qualifying day has at least one server-recorded `done` check-in, including
private and guest check-ins. `need` does not qualify. Days use Asia/Tehran and
the UI week runs Saturday through Friday. Client dates, repeated taps and
refreshes cannot award extra days or charges. Existing completed history counts.

The first three consecutive active days earn one free charge, initially with
capacity one. Three consecutive active days after a consumed charge earn one
replacement, up to capacity. At a 21-active-day streak, capacity permanently
unlocks to two and one extra charge is gifted. Reaching the unlock and an
ordinary recharge on the same day cannot double-award. A full inventory does
not bank recharge progress. Freezes are free for every user, with no premium gate.

A missed completed calendar day automatically spends one available charge.
Today never spends a charge before it ends. A protected day preserves the
current count without adding an active day or recharge credit. A missed day
without a charge resets the current streak. Historical best and unlocked
capacity remain. This is an activity-day counter; frozen days bridge gaps.
Recharge requires actual consecutive active days after a gap.

Streaks are replayed deterministically from distinct server check-in dates in the
existing totals query. There is no client-writable ledger or mutable balance to
race. Repeated reads cannot consume the same freeze twice. Account deletion
removes history as usual; importing/merging trusted check-in history naturally
recomputes a single streak. No additional database query or background job was
added. Me has a compact clickable streak summary, opening the clean `/streak` page.
Home and Stats no longer repeat the full card. The dedicated page shows the
inventory, weekly states and a short expandable explanation. There are no new push notifications for streaks.

Validation: `npm test` includes timezone boundaries, duplicate/invalid dates,
recharge and missed-day rules, the 21-day unlock and permanent capacity.
`scripts/streak_map_api_smoke.py` verifies SQL/API integration using disposable
owned accounts and signed history fixtures restricted to a protected preview.
The fixture is excluded from production deployments.

## Milestone collection and sharing

The eight thresholds are 3, 7, 14, 30, 60, 90, 180 and 365 active streak days.
Months are explicitly described as 30 days in this collection; the year medal
uses 365 days. Each has its own silhouette, colors and motif (sprout, flower,
moon, sun, twins, garden, comet and crown). They use shared plain-canvas geometry
for the collection and exported image, with no new external assets or service.

The collection is available on Streak and Achievements. Earned badges use the
historical best and remain earned after a streak ends. The server's existing
`streak` achievement now uses the same freeze-aware best and eight thresholds,
preserving historical stored progress; other three-level achievements remain.
Repeated same-day events cannot advance the collection.

`/stories/streak` exports the actual current run. The optional `?milestone=60`
selects an already-earned badge, validated against the server-provided best;
unknown or unearned values fall back to the current run. Native sharing and
saving use the exact same PNG as the preview, 1080×1920 or 1080×1080. Portrait
cards retain 100 px top and 200 px bottom safe areas. These cards contain no
invitation codes or QR links. Closing returns to the originating Streak or
Achievements page; direct story links fall back to Streak. Routes have Vercel
rewrites, no-index headers and analytics categories without milestone query data.

`scripts/streak_page_ui_smoke.py` checks the move, route reloads, eight unique
badge images, persistent unlocks, gated share actions, current/earned exports,
exact PNG identity across preview/save/native share and short-screen layouts.
