import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";
import { publicPaths, pageMetadata, structuredData, renderHead, escapeHtml } from "./seo.js";
import { productFacts, factsUpdated } from "../src/product-facts.js";

export async function buildPublicSite({ outDir, origin, release }) {
  const directory = resolve(outDir);
  const template = await readFile(resolve(directory, "index.html"), "utf8");
  if (!template.includes('<div id="root"></div>')) throw new Error("The app HTML root is missing.");
  const manifest = JSON.parse(await readFile(resolve(directory, ".vite/manifest.json"), "utf8"));
  const cssFor = entry => {
    const files = new Set(), seen = new Set();
    function visit(key) {
      if (seen.has(key)) return;
      seen.add(key);
      const chunk = manifest[key];
      if (!chunk) throw new Error("Prerender entry missing: " + key);
      chunk.css?.forEach(file => files.add(file));
      chunk.imports?.forEach(visit);
    }
    visit(entry);
    return [...files].filter(file => !template.includes(`/${file}`)).map(file => `<link rel="stylesheet" href="/${file}">`).join("");
  };
  const shell = renderHead(template, pageMetadata("/app-shell", origin), origin).replace("</head>", '<link rel="preload" as="image" href="/assets/shy-drop.webp"></head>');
  await writeFile(resolve(directory, "app-shell.html"), shell);
  const server = await createServer({
    configFile: false, mode: "production", appType: "custom", base: "/",
    server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true, include: [] },
    define: { __JISHOO_BUILD__: JSON.stringify({ version: release.version, buildId: release.buildId }) },
  });
  try {
    const { renderPublicPage } = await server.ssrLoadModule("/src/prerender.jsx");
    for (const path of publicPaths) {
      const entry = path === "/" ? null : `src/components/${({ "/about": "About", "/privacy": "Legal", "/terms": "Legal", "/install": "Install", "/support": "Support", "/changelog": "ReleasePage" })[path]}.jsx`;
      let html = template.replace(/<noscript>[\s\S]*?<\/noscript>/i, "")
        .replace('<div id="root"></div>', `<div id="root" data-prerendered="${escapeHtml(path)}">${renderPublicPage(path)}</div>`);
      if (entry) html = html.replace("</head>", cssFor(entry) + "</head>");
      html = renderHead(html, pageMetadata(path, origin), origin, structuredData(path, origin));
      await writeFile(resolve(directory, path === "/" ? "index.html" : path.slice(1) + ".html"), html);
    }
  } finally { await server.close(); }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${publicPaths.map(path => `<url><loc>${escapeHtml(origin + path)}</loc></url>`).join("\n")}\n</urlset>\n`;
  // App pages remain crawlable so search crawlers can read their noindex headers.
  const robots = `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${origin}/sitemap.xml\n`;
  const links = publicPaths.map(path => `- [${pageMetadata(path, origin).title}](${origin + path})`).join("\n");
  const sections = productFacts.map(fact => `## ${fact.enTitle}\n\n${fact.en}`).join("\n\n");
  const about = `# jishoo (جیشو)\n\nOfficial product information. Updated: ${factsUpdated}.\n\n${sections}\n\n## Official sources\n\n${links}\n`;
  const llms = `# jishoo\n\n> jishoo (جیشو) is a Persian-language social web app for voluntary bathroom check-ins with friends, personal statistics and shareable story cards.\n\nOfficial website: ${origin}/\nPrimary language: Persian (fa-IR). Updated: ${factsUpdated}.\n\n## Product overview\n\n- [What jishoo is and how it works](${origin}/about): Public Persian explanation of the current features, access requirements and privacy choices.\n- [Product facts in Markdown](${origin}/about.md): English summary of the same facts for readers and retrieval tools.\n\n## Public documentation\n\n${links}\n\n## Current limits\n\nMembership is invitation-only with Google authentication; guest use is available. Phone login is disabled. Spotify support is a profile link, not an automatic listening integration. Premium is temporarily available to all during testing; this is not permanent premium for every account. The app is not a medical or diagnostic tool.\n\nOnly the linked public product pages and documentation describe the service for discovery. Account screens, member profile pages, private activity, invitation codes, social links and API responses are not product documentation. See the privacy policy for data-sharing choices.\n`;
  await Promise.all([
    writeFile(resolve(directory, "sitemap.xml"), sitemap), writeFile(resolve(directory, "robots.txt"), robots),
    writeFile(resolve(directory, "llms.txt"), llms), writeFile(resolve(directory, "about.md"), about),
  ]);
  console.log(`Prerendered ${publicPaths.length} public pages with metadata, sitemap and reader documentation.`);
}
