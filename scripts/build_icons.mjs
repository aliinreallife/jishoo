// One generated master supplies browser, Apple, PWA, Android and push artwork.
import sharp from "sharp";
import { copyFile, readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const asset = name => resolve(root, "public/assets", name);
const master = await readFile(asset("brand-icon-master-v2.png"));
const character = await sharp(master).ensureAlpha().trim().png().toBuffer();
async function icon(name, size, background, extent = 0.9) {
  const art = await sharp(character).resize(Math.round(size * extent), Math.round(size * extent), { fit: "inside" }).png().toBuffer();
  const { width, height } = await sharp(art).metadata();
  const result = await sharp({ create: { width:size, height:size, channels:4, background } })
    .composite([{ input:art, left:Math.round((size-width)/2), top:Math.round((size-height)/2) }]).png().toBuffer();
  await writeFile(asset(name), result);
  return result;
}
await icon("favicon-v2-32.png", 32, "#00000000");
const favicon = await icon("favicon-v2-64.png", 64, "#00000000");
await icon("apple-touch-icon-v2.png", 180, "#fff9e6");
await icon("app-icon-v2-192.png", 192, "#fff9e6");
await icon("app-icon-v2-512.png", 512, "#fff9e6");
await icon("app-icon-v2-maskable-512.png", 512, "#fff9e6", 0.72);
const silhouette = await icon("notification-badge-v2.png", 96, "#00000000", 0.72);
const alpha = await sharp(silhouette).extractChannel("alpha").raw().toBuffer();
const white = Buffer.alloc(96*96*4, 255);
for (let i=0; i<alpha.length; i++) white[i*4+3] = alpha[i];
await sharp(white, { raw:{ width:96, height:96, channels:4 } }).png().toFile(asset("notification-badge-v2.png"));

// Keep old asset URLs consistent for older installed manifests and test fixtures.
await writeFile(asset("favicon-transparent.png"), favicon);
await copyFile(asset("brand-icon-master-v2.png"), asset("app-icon.png"));
await copyFile(asset("app-icon-v2-192.png"), asset("app-icon-192.png"));
await copyFile(asset("app-icon-v2-512.png"), asset("app-icon-512.png"));

// Conventional fallback for browsers that request /favicon.ico directly.
const ico = Buffer.alloc(22);
ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4);
ico[6] = 64; ico[7] = 64;
ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12);
ico.writeUInt32LE(favicon.length, 14); ico.writeUInt32LE(22, 18);
await writeFile(resolve(root,"public/favicon.ico"), Buffer.concat([ico,favicon]));
console.log("Generated consistent yellow icons from one transparent master.");
