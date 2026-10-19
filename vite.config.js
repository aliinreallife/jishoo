import { defineConfig, loadEnv } from "vite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { validRelease } from "./src/update-rules.js";
import { buildPublicSite } from "./lib/build-public-site.js";
import { publicOrigin, publicPages, pageMetadata, renderHead } from "./lib/seo.js";

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const policy = JSON.parse(readFileSync(new URL("./src/update-policy.json", import.meta.url), "utf8"));
const release = { version, buildId: randomUUID(), minimumSupportedVersion: policy.minimumSupportedVersion };
if (!validRelease(release)) throw new Error("The minimum supported version must not exceed the release version.");

export default defineConfig(({ mode, command }) => {
const origin = publicOrigin(process.env.PUBLIC_APP_URL || loadEnv(mode, process.cwd(), "PUBLIC_APP_URL").PUBLIC_APP_URL || undefined);
return {
  build: {
    manifest: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) return "react-vendor";
          if (/\/node_modules\/(react-router|react-router-dom)\//.test(id)) return "router-vendor";
          if (id.endsWith("/src/components/Mascot.jsx") || /\/@phosphor-icons\/react\/dist\/(csr|defs)\/(ArrowRight|ShareNetwork|ShieldCheck)\.es\.js$/.test(id)) return "ui-common";
        },
      },
    },
  },
  define: { __JISHOO_BUILD__: JSON.stringify({ version, buildId: release.buildId }) },
  plugins: [{
    name: "jishoo-release",
    transformIndexHtml(html, context) {
      const path = context.path === "/index.html" ? "/" : context.path;
      return renderHead(html, pageMetadata(path, origin), origin);
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split("?")[0] !== "/version.json") return next();
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-store");
        res.end(JSON.stringify(release));
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify(release) });
      this.emitFile({ type: "asset", fileName: "sw.js", source: readFileSync(new URL("./public/sw.js", import.meta.url), "utf8").replace("__JISHOO_BUILD_ID__", release.buildId) });
    },
    closeBundle() { if (command === "build") return buildPublicSite({ outDir: "dist", origin, release }); },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url, "http://localhost");
        if (url.pathname === "/index.html" || (url.pathname.endsWith(".html") && publicPages[url.pathname.slice(0, -5)])) {
          res.statusCode = 308; res.setHeader("Location", (url.pathname === "/index.html" ? "/" : url.pathname.slice(0, -5)) + url.search); res.end(); return;
        }
        if (/^\/(?:home|nearby|discover|friends|profile|settings|stats|streak|invite|achievements|notifications|admin|join|group|stories|circle|app|u)(\/|$)/.test(url.pathname) || url.pathname === "/app-shell.html") {
          res.setHeader("X-Robots-Tag", "noindex, nofollow");
          req.url = "/app-shell.html" + url.search;
        }
        next();
      });
    },
  }],
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    proxy: { "/api": { target: "http://127.0.0.1:3001", changeOrigin: false } },
  },
};
});
