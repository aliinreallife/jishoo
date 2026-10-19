import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { publicOrigin, publicPaths, pageMetadata, structuredData, renderHead, safeJson } from "../lib/seo.js";

test("public metadata uses the configured origin and distinct titles for real public pages", () => {
  const origin = publicOrigin("https://jishoo.example/");
  const pages = publicPaths.map(path => pageMetadata(path, origin));
  assert.equal(new Set(pages.map(page => page.title)).size, publicPaths.length);
  assert.equal(new Set(pages.map(page => page.description)).size, publicPaths.length);
  for (const [index, page] of pages.entries()) {
    assert.equal(page.canonical, origin + publicPaths[index]);
    assert.equal(page.image, origin + "/assets/social-shy-v4.png");
    assert.match(page.robots, /^index,/);
  }
  for (const invalid of ["https://user:pass@example.com", "https://example.com/path", "https://example.com/?secret=1", "https://example.com/#fragment", "http://example.com", "javascript:alert(1)"]) assert.throws(() => publicOrigin(invalid));
  assert.equal(publicOrigin("http://localhost:4173"), "http://localhost:4173");
});

test("account, activity, invitation and member-profile pages never inherit public indexing or schema", () => {
  for (const path of ["/home", "/profile", "/nearby", "/join", "/admin", "/u/ali", "/stories/checkin", "/app-shell"]) {
    assert.equal(pageMetadata(path, "https://jishoo.example").canonical, null);
    assert.match(pageMetadata(path, "https://jishoo.example").robots, /^noindex,/);
    assert.equal(structuredData(path, "https://jishoo.example"), null);
  }
  const graph = structuredData("/", "https://jishoo.example")["@graph"];
  assert.equal(graph.find(row => row["@type"] === "WebSite").name, "jishoo");
  assert.ok(graph.every(row => !row.aggregateRating && !row.review && !row.offers));
});

test("server-generated share metadata escapes profile text and removes stale homepage metadata", () => {
  const template = '<html><head><title>old</title><meta name="description" content="old"><meta property="og:url" content="old"><link rel="canonical" href="old"><script type="application/ld+json">{}</script></head><body><div id="root"></div></body></html>';
  const metadata = { ...pageMetadata("/u/test", "https://jishoo.example"), title: '</title><script>alert("x")</script>', description: 'quote" & <tag>', canonical: 'https://jishoo.example/u/test', type: 'profile' };
  const html = renderHead(template, metadata, "https://jishoo.example");
  assert.ok(!html.includes('<script>alert'));
  assert.ok(!html.includes('content="old"'));
  assert.match(html, /&lt;\/title&gt;&lt;script&gt;/);
  assert.equal((html.match(/rel="canonical"/g) || []).length, 1);
  assert.equal((html.match(/name="description"/g) || []).length, 1);
  assert.ok(!html.includes('application/ld+json'));
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  assert.ok(html.includes('<div id="root"></div>'));
  assert.ok(!safeJson({ text: '</script><script>bad</script>' }).includes('</script>'));
});

test("deployment routes serve public documents separately from private app shells", async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  for (const path of publicPaths.filter(path => path !== '/')) assert.equal(config.rewrites.find(rule => rule.source === path)?.destination, path + '.html');
  for (const rule of config.rewrites.filter(rule => /:screen|\/stories\/:|\/circle\/:|\/app\//.test(rule.source))) assert.equal(rule.destination, '/app-shell.html');
  assert.ok(config.headers.find(rule => rule.source === '/u/:handle')?.headers.some(header => header.key === 'X-Robots-Tag' && header.value.includes('noindex')));
  assert.ok(config.redirects.some(rule => rule.source === '/index.html' && rule.destination === '/'));
  assert.equal(config.trailingSlash, false);
});
