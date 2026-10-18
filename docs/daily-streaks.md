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
added. Home and Stats show the same inventory and weekly states with a short
expandable explanation. There are no new push notifications for streaks.

Validation: `npm test` includes timezone boundaries, duplicate/invalid dates,
recharge and missed-day rules, the 21-day unlock and permanent capacity.
`scripts/streak_map_api_smoke.py` verifies SQL/API integration using disposable
owned accounts and signed history fixtures restricted to a protected preview.
The fixture is excluded from production deployments.
