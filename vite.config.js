import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { validRelease } from "./src/update-rules.js";

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const policy = JSON.parse(readFileSync(new URL("./src/update-policy.json", import.meta.url), "utf8"));
const release = { version, buildId: randomUUID(), minimumSupportedVersion: policy.minimumSupportedVersion };
if (!validRelease(release)) throw new Error("The minimum supported version must not exceed the release version.");

export default defineConfig({
  build: {
    manifest: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) return "react-vendor";
          if (/\/node_modules\/(react-router|react-router-dom)\//.test(id)) return "router-vendor";
        },
      },
    },
  },
  define: { __JISHOO_BUILD__: JSON.stringify({ version, buildId: release.buildId }) },
  plugins: [{
    name: "jishoo-release",
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
  }],
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    proxy: { "/api": { target: "http://127.0.0.1:3001", changeOrigin: false } },
  },
});
