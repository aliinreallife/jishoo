import { readFile, writeFile, copyFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  await readFile(resolve(root, "public/manifest.webmanifest"), "utf8"),
);
const xml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "\\'");
const icon = manifest.icons.find(icon => icon.sizes === "512x512" && icon.type === "image/png" && icon.purpose?.split(" ").includes("maskable"))
  || manifest.icons.find(icon => icon.sizes === "512x512" && icon.type === "image/png");
if (!icon || !icon.src.startsWith("/assets/") || icon.src.includes(".."))
  throw Error("A local public 512px PNG icon is required.");
await copyFile(
  resolve(root, "public" + icon.src),
  resolve(root, "android/app/src/main/res/drawable/jishoo_icon.png"),
);
const color = /^#[a-f0-9]{6}$/i.test(manifest.theme_color)
  ? manifest.theme_color
  : "#fff9e6";
await writeFile(
  resolve(root, "android/app/src/main/res/values/colors.xml"),
  `<resources><color name="cream">${color}</color></resources>\n`,
);
await writeFile(
  resolve(root, "android/app/src/main/res/values/branding.xml"),
  `<resources><string name="app_name">${xml(manifest.short_name || manifest.name)}</string></resources>\n`,
);
console.log("Android branding synchronized with the PWA manifest.");
