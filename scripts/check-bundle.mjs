import { readFile, mkdir, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { resolve } from "node:path";

export function collectChunkFiles(manifest, roots) {
  const visited = new Set(), files = new Set();
  function visit(key) {
    if (visited.has(key)) return;
    const chunk = manifest[key];
    if (!chunk) throw Error(`Missing build entry: ${key}`);
    visited.add(key); files.add(chunk.file);
    chunk.css?.forEach(file => files.add(file));
    chunk.imports?.forEach(visit);
  }
  roots.forEach(visit);
  return [...files];
}

export async function checkBundle() {
  const manifest = JSON.parse(await readFile("dist/.vite/manifest.json", "utf8"));
  const entry = name => {
    const key = Object.keys(manifest).find(key => manifest[key].name === name);
    if (!key) throw Error(`The ${name} chunk is missing.`);
    return key;
  };
  const app = entry("App");
  const routes = [
    { name: "landing", roots: ["index.html"], js: 100000, css: 4500 },
    { name: "home", roots: ["index.html", app, "src/components/HomeNotifications.jsx"], js: 151000, css: 34000 },
    { name: "profile", roots: ["index.html", app, entry("DailyStreak"), entry("SharedMemories")], js: 158000, css: 36500 },
  ];
  const reports = [];
  for (const route of routes) {
    const report = { route: route.name, js: 0, css: 0, jsRaw: 0, cssRaw: 0, files: [] };
    for (const file of collectChunkFiles(manifest, route.roots)) {
      if (!/\.(js|css)$/.test(file)) continue;
      const data = await readFile(resolve("dist", file));
      const type = file.endsWith(".js") ? "js" : "css";
      report[type] += gzipSync(data, { level: 9 }).length;
      report[type + "Raw"] += data.length;
      report.files.push(file);
    }
    report.budget = { js: route.js, css: route.css };
    reports.push(report);
    console.log(`${route.name}: JS ${report.js} / ${route.js} B gzip; CSS ${report.css} / ${route.css} B gzip`);
  }
  const homeFiles = reports.find(report => report.route === "home").files;
  for (const name of ["AuthWizard", "Nearby", "Stories", "AdminInvitationGraph", "ReleasePage"]) {
    if (homeFiles.some(file => file.includes("/" + name + "-"))) throw Error(`${name} must stay out of the initial home download.`);
  }
  for (const name of ["react-vendor", "router-vendor"]) {
    const chunk = Object.values(manifest).find(chunk => chunk.name === name);
    if (!chunk || !/-[\w-]{8}\.js$/.test(chunk.file)) throw Error(`${name} must have a content fingerprint.`);
  }
  await mkdir("artifacts", { recursive: true });
  await writeFile("artifacts/bundle-report.json", JSON.stringify(reports, null, 2) + "\n");
  if (reports.some(report => report.js > report.budget.js || report.css > report.budget.css)) throw Error("Initial-download budget exceeded. Inspect artifacts/bundle-report.json before changing a budget.");
  return reports;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) await checkBundle();
