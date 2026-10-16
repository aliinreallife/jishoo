export async function loadAvatar(file) {
  if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error(
      "یک عکس JPG، PNG یا WebP انتخاب کن. عکس HEIC رو اول به JPG تبدیل کن.",
    );
  if (file.size > 8 * 1024 * 1024)
    throw new Error("یک عکس کوچک‌تر از ۸ مگابایت انتخاب کن.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (
      !image.naturalWidth ||
      image.naturalWidth * image.naturalHeight > 32000000
    )
      throw new Error();
    return image;
  } catch {
    throw new Error("عکس باز نشد یا خیلی بزرگه. یک عکس دیگه انتخاب کن.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
export function drawAvatar(
  image,
  canvas,
  { zoom = 1, x = 0, y = 0, rotation = 0 } = {},
) {
  const angle = ((rotation % 360) + 360) % 360;
  const turned = angle === 90 || angle === 270;
  const w = turned ? image.naturalHeight : image.naturalWidth;
  const h = turned ? image.naturalWidth : image.naturalHeight;
  const side = Math.min(w, h) / zoom;
  const left = ((w - side) / 2) * (1 + x);
  const top = ((h - side) / 2) * (1 + y);
  const c = canvas.getContext("2d");
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = "#fff9e9";
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.scale(canvas.width / side, canvas.height / side);
  c.translate(w / 2 - left, h / 2 - top);
  c.rotate((angle * Math.PI) / 180);
  c.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
  c.setTransform(1, 0, 0, 1, 0, 0);
}
export async function prepareAvatar(file, options = {}) {
  const image = await loadAvatar(file);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 320;
  drawAvatar(image, canvas, options);
  let quality = 0.86,
    result;
  do {
    result = canvas.toDataURL("image/jpeg", quality);
    quality -= 0.1;
  } while (result.length > 85000 && quality > 0.45);
  return result;
}
