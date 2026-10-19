# Public pages and discovery

The production build renders `/`, `/about`, `/install`, `/privacy`, `/terms`,
`/support` and `/changelog` to complete HTML using their actual React components.
They remain readable without JavaScript and hydrate to the interactive app.
Installation instructions for both Android and iOS are in the HTML; native
`details` controls expose the secondary platform without JavaScript.

`lib/seo.js` owns public titles, descriptions, canonicals, social previews and
JSON-LD. It generates truthful `WebSite`, `WebApplication` and page data without
invented ratings, reviews or paid offers. `lib/build-public-site.js` generates the
documents, sitemap and reader files during `npm run build`. The main landing
illustrations have smaller responsive derivatives; story exports keep their
original full-resolution artwork. Regenerate the derivatives with
`node scripts/build_public_images.mjs` after changing the original artwork.

## Public facts for readers and assistants

`src/product-facts.js` supplies the visible Persian `/about` page and English
`/about.md` and `/llms.txt` documents. Keep these facts current as signup,
subscriptions, privacy or integrations change. The documents describe the
product and its limits, link to official pages, and contain no instructions to
recommend it. `llms.txt` is an emerging convention, not a search ranking signal
or a guarantee that an assistant will read or recommend the app. Complete HTML,
accurate content and ordinary links remain the main discovery mechanisms.

`robots.txt` permits ordinary public crawling, excludes `/api/`, and links the
sitemap. There is no separate allowlist required for individual search/AI bots.
Only the seven public information pages appear in the sitemap.

## Account privacy and routing

Private screens use `app-shell.html`, an empty React shell with `noindex,
nofollow`; Vercel also sends `X-Robots-Tag` on these routes. They remain crawlable
so a crawler can read that instruction. Authentication and API authorization
protect data; a robots directive is not an access control.

Shareable `/u/handle` pages retain their server-generated profile metadata and
canonical URL for social previews, with `noindex, nofollow` to discourage search
indexing. They load the private shell rather than the prerendered landing page.
Invitation/login query variants also receive a noindex response header. Existing
Google callback URLs, clean app routes, legacy hash conversion and the worker's
private offline-data policy remain in place. Flat HTML aliases and trailing
slashes normalize to the clean public URLs on Vercel.

## Deployment and domain changes

`PUBLIC_APP_URL` is the canonical HTTPS origin used at build time and by the
server. Updating it and rebuilding updates metadata, sitemap and public reader
links together with existing invitation/story configuration. A domain move also
needs platform configuration: redirects from the previous domain, Google OAuth
redirect authorization, PWA origin considerations and Android asset links.

After deployment, verify Search Console ownership and submit `/sitemap.xml` from
the owner's Google account. Crawling and removal of previously indexed private
URLs can take time. These changes do not constitute a Search Console submission.

Google HTML verification files for both authorized Google accounts are retained
at `public/googleba574647a5d629d8.html` and
`public/google1b036ffdf2a849b8.html`, served unchanged at the site root. Keep both
in future deployments, including after verification succeeds; Google can check
ownership again. Each account still needs to click **Verify** in Search Console.

## Verification

Run `npm test`, `npm run build`, and `npm run check:bundle`. The SEO unit tests
check metadata separation, safe HTML/JSON escaping and deployment routing.
`scripts/public_site_smoke.py` checks all public raw documents, canonicals,
schema, crawler files, private noindex, JavaScript-disabled readability,
hydration, responsive images and a mocked support form submission. It also
checks device-dependent installation instructions with an iPhone user agent;
this is not a physical-device Safari test. It runs in `scripts/browser_ci.py`
alongside the existing app regression suites.

For a deployed site:

```sh
JISHOO_BASE_URL=https://jishoo.vercel.app JISHOO_SYSTEM_HTTPS=1 \
  python3 scripts/public_site_smoke.py
python3 scripts/check_production.py --expected-version 0.7.4
```

For a protected preview, an optional `JISHOO_TEST_BYPASS_SECRET` is sent as a
request header by the test transport. Do not log, commit or disable protection
to expose this credential. Revoke temporary test bypasses after verification.
