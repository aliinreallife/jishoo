# Updating an open app or installed PWA

Every Vite build emits `/version.json` with a unique public build ID, package
version and minimum supported version. The same build ID is embedded in the
client and service worker, so ordinary frontend changes also produce a new
worker. This metadata contains no account information or environment secrets.
Vercel serves version metadata without browser/CDN caching. Page HTML is
revalidated; navigation stays network-first and the existing offline fallback
and Web Push handlers remain in place.

Visible clients check the small static metadata file at startup, every five
minutes, and on focus/resume (at most once per minute for resume events).
Hidden tabs stop periodic checks. These are static requests, not database
queries or function invocations. There is no automatic reload timer.

Normal releases show «نسخهٔ تازهٔ جیشو آماده‌ست», with Update and Later actions.
Later snoozes that build for an hour in this tab; a different build can prompt
again. The prompt waits for dialogs, profile edits, photo cropping, invitation
flows, stories, the Undo grace period and outstanding API mutations to finish.
Dirty inputs and other modal dialogs also block it. A late action during the
update's network check is rechecked before activation/reload.

Update verifies current metadata online, checks the service worker, explicitly
activates a waiting worker and reloads only the requesting tab. Other tabs are
never reloaded by `controllerchange`. The full current URL, invitation queries,
login cookie and browser history are retained. A new page navigation already
loads fresh HTML. Existing release notes appear once the new client has loaded.
Offline users can defer a normal update; failed checks never block the app.
Failed explicit updates show a retry message without reloading.

For a critical security/compatibility release, raise
`src/update-policy.json`'s `minimumSupportedVersion` to the first safe release,
and bump `package.json`/the lockfile and release notes normally. The build fails
if the policy is newer than the release. Older supported clients then show a
mandatory update dialog, after pending work is safe, with an explanation and no
Later action. Do not raise this value for ordinary visual or feature updates.
This is a client UX policy, not a substitute for server authorization or fixes.
Clients from before 0.4.1 do not have the update detector and need one normal
page reopening/reload to receive it.

The worker continues to use the existing bounded immutable asset cache. It
does not clear old chunks when another tab activates an update, or cache
version metadata, API responses, account HTML or OAuth callbacks. First install
activates normally; subsequent workers wait for explicit activation (or for all
old clients to close, per the browser's normal lifecycle).
