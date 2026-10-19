import sharp from "sharp";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "../public/assets");
for (const [name, widths] of [["shy", [128, 256, 320, 640, 960]], ["happy", [128, 256]]]) {
  for (const width of widths) {
    const path = resolve(root, `landing-${name}-v1-${width}.webp`);
    await sharp(resolve(root, `${name}-drop.webp`)).resize(width, width, { fit: "inside", withoutEnlargement: true }).webp({ quality: 84, effort: 6 }).toFile(path);
    console.log(`Generated landing-${name}-v1-${width}.webp`);
  }
}
