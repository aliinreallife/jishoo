# Performance and automation — 0.7.1

## Measured downloads

Measured the built app in fresh mobile Chromium contexts (393×852), service workers blocked, identical synthetic account data and a 4× CPU throttle. Resources are decoded response bytes after the screen and fonts become ready. These measurements compare downloads and are not real-user Core Web Vitals or a claimed timing improvement. Short local timing samples varied; no percentage speed claim is based on them.

| Route | JavaScript before | JavaScript after | CSS before | CSS after |
| --- | ---: | ---: | ---: | ---: |
| `/` | 293,192 B | 282,931 B | 12,334 B | 11,102 B |
| `/home` | 510,327 B | 457,819 B | 153,730 B | 146,850 B |
| `/profile` | 518,921 B | 482,322 B | 154,679 B | 153,431 B |

Home downloads about 10.3% less JavaScript. Fonts remain 132,960 decoded bytes across three requested files. Screens keep the existing design and mascot assets. The complete changelog, signup wizard, social panel, invitation quota, shared memories and streak card load when used. The app and service-worker version metadata still bypass caching.

Compiled assets with content fingerprints now receive `public, max-age=31536000, immutable`. Stable React and router vendor chunks retained the same filenames across independent builds, including the release-number change. Unversioned public illustrations, HTML, release metadata and API responses do not receive that immutable policy. A repeat visitor can reuse the large vendor files across normal releases.

## Requests, database work and idle rendering

- Only simultaneous identical reads are shared; settled responses are never cached. Mutations advance a generation and invalidate pending-read reuse. Account refreshes discard an older generation after a write, preventing a late pre-edit response from reverting a saved profile. Location-based POST reads are distinguished from mutations and have keys that include their request body, in memory only.
- Statistics and achievements share one request-local daily-history query and streak calculation. Guests skip three member-only achievement queries; pending Google/waiting-list status uses one joined query. This removes four reads from guest bootstrap. A normal member keeps the same query count, while statistics avoid a second distinct-day aggregation and reuse the streak calculation. There is no cross-user server cache. Check-in responses still recalculate statistics after the write.
- An unchanged map poll retains the same activity array and Leaflet marker DOM. Changed status, counts, location or profile consent still replace affected data. Privacy revocation removes the profile action immediately. Avatar memoization avoids unrelated parent renders while its own eye animation remains active.
- Failed optional downloads have a branded recovery screen and an explicit retry. They do not trigger an automatic refresh or leave a blank app.

## Checks

`npm test` covers 56 unit/privacy/security contracts, including request-generation races, private map identity, unchanged activity, dependency accounting, image validation, Google token checks, notifications, streak freezes and invitation ancestry. Eight synthetic browser suites cover failed optional-download recovery, navigation/Back, Google-first signup, maps/density/privacy, seven map viewport sizes, touch forms, story PNG/native-share contracts, admin invitation graphs, social/photo flows and performance regressions. They use no database, Google, admin or Vercel secret.

Protected-preview tests with owned disposable accounts verified real SQL freeze history and achievements, member invitation concurrency, admin single-use links, waiting-list authorization, Google contact status and all map visibility modes. These tests are intentionally kept out of untrusted PR jobs. Their fixture is excluded from production and temporary accounts/access/previews are removed.

The full dependency audit reported zero known advisories. Workflow syntax was checked with actionlint 1.7.7 from its official release, verified against a pinned SHA-256 checksum. GitHub API requests were denied in this cloud session; hosted Actions execution was not observed here. Android packaging remains in its existing workflow and needs its runner's Android SDK; no local signed-Android-build claim is made.

## Automation

- **App checks:** PRs, pushes to main and manual runs; frozen npm install, workflow lint, unit checks, production build, initial-download budgets and eight browser suites. Results remain in the run summary and logs; optional failure screenshots and the bundle report are retained for two days. Successful checks do not upload screenshots.
- **Dependency security:** weekly/manual `npm audit`, failing on high/critical advisories.
- **Production health:** successful production-deployment events, a daily schedule or manual run; checks the canonical site, route refreshes, database health, matching app/worker release metadata and cache headers. It creates no user sessions or accounts. It does not publish or redeploy anything.
- **Dependabot:** weekly npm and pinned-action update PRs. Minor/patch npm updates are grouped; major updates remain reviewable separately. No automatic merge.
- **Android TWA:** preserved the existing build/signing behavior; pinned all action references, disabled persisted checkout credentials and fixed the runner image. It produces APK/AAB artifacts and does not publish to Play.

All jobs have read-only repository permissions. Untrusted PR checks receive no app secrets, use no `pull_request_target` execution and never deploy. Runtime and build use Node 24. The automation itself does not turn on paid GitHub services or change branch-protection settings.

## Reproduce

```sh
npm ci --no-audit --no-fund
npm test
npm run build
npm run check:bundle
python3 scripts/check_workflows.py
python3 -m pip install -r scripts/requirements-browser.txt
python3 -m playwright install --with-deps chromium
npm run test:browser
npm run check:production
```

The workflow-lint helper is for Linux x86_64; other platforms can run actionlint directly. `browser_ci.py` owns and stops its preview process; use `--port 4183` when port 4173 is occupied. Set `CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium` to use the cloud's installed Chromium. In a cloud workspace with a read-only home directory, use `npm ci --cache /tmp/jishoo-npm-cache --no-audit --no-fund`; integrity verification stays enabled.
