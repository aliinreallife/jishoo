import sharp from "sharp";
import { cleanAvatarImage } from "./core.js";
export async function sanitizeAvatar(value) {
  const clean = cleanAvatarImage(value);
  if (clean === null) return null;
  try {
    const image = sharp(Buffer.from(clean.split(",")[1], "base64"), {
      limitInputPixels: 1024 * 1024,
      failOn: "warning",
    });
    const meta = await image.metadata();
    if (meta.format !== "jpeg" || meta.width > 1024 || meta.height > 1024)
      throw new Error();
    const bytes = await image
      .rotate()
      .resize(320, 320, { fit: "cover" })
      .jpeg({ quality: 82 })
      .toBuffer();
    return `data:image/jpeg;base64,${bytes.toString("base64")}`;
  } catch {
    throw new Error("عکس آماده نشد؛ یک عکس دیگه انتخاب کن.");
  }
}
