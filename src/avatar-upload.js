export async function prepareAvatar(file) {
  if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("یک عکس JPG، PNG یا WebP انتخاب کن.");
  if (file.size > 8 * 1024 * 1024)
    throw new Error("یک عکس کوچک‌تر از ۸ مگابایت انتخاب کن.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const context = canvas.getContext("2d");
    context.fillStyle = "#fff9e9";
    context.fillRect(0, 0, 256, 256);
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    context.drawImage(
      image,
      (image.naturalWidth - side) / 2,
      (image.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      256,
      256,
    );
    return canvas.toDataURL("image/jpeg", 0.82);
  } catch {
    throw new Error("عکس باز نشد. یک عکس دیگه انتخاب کن.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
