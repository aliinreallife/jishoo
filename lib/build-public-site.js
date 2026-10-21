import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";
import { publicPaths, pageMetadata, structuredData, renderHead, escapeHtml } from "./seo.js";
import { discoveryDocuments } from "./discovery.js";

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

  await Promise.all(Object.entries(discoveryDocuments(origin)).map(([name, content]) => writeFile(resolve(directory, name), content)));
  console.log(`Prerendered ${publicPaths.length} public pages with metadata, sitemap and reader documentation.`);
}
