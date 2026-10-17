import regular from "@fontsource/vazirmatn/files/vazirmatn-arabic-400-normal.woff2?url";
import bold from "@fontsource/vazirmatn/files/vazirmatn-arabic-700-normal.woff2?url";
import heavy from "@fontsource/vazirmatn/files/vazirmatn-arabic-900-normal.woff2?url";
import lalezar from "@fontsource/lalezar/files/lalezar-arabic-400-normal.woff2?url";

export const headlines = {
  need: "جیش دارم.\nالان برمی‌گردم!",
  checkin: "جیش کردم!\nیه کم سبک‌تر، یه کم خوشحال‌تر.",
  together: "ما حتی جیشمونم سینکه!",
  "back-to-back": "اول اون، بعد من.\nچه تیمی شدیم!",
  invite: "بیا تو جمعمون.\nاینجا لحظه‌های ساده مهمن.",
};
const assets = `${import.meta.env.BASE_URL}assets/`;
const images = new Map();
let fonts;
async function loadFonts() {
  if (!fonts) fonts = Promise.all([[regular, "JishooStory", "400"], [bold, "JishooStory", "700"], [heavy, "JishooStory", "900"], [lalezar, "JishooStoryWordmark", "400"]].map(async ([url, family, weight]) => {
    const font = new FontFace(family, `url("${url}")`, { weight });
    await font.load(); document.fonts.add(font);
  })).catch((error) => { fonts = null; throw error; });
  return fonts;
}
function bitmap(url) {
  if (!images.has(url)) images.set(url, new Promise((resolve, reject) => {
    const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = async () => { try { if (img.decode) await img.decode(); resolve(img); } catch (e) { images.delete(url); reject(e); } };
    img.onerror = () => { images.delete(url); reject(new Error("تصویر کارت آماده نشد؛ دوباره امتحان کن.")); };
    img.src = url;
  }));
  return images.get(url);
}
function rounded(ctx, x, y, w, h, r, fill) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
}
function text(ctx, value, x, y, size, color = "#303044", weight = 700, align = "center", family = "JishooStory") {
  ctx.font = `${weight} ${size}px ${family}, sans-serif`;
  while (size > 18 && ctx.measureText(String(value)).width > 850) { size -= 2; ctx.font = `${weight} ${size}px ${family}, sans-serif`; }
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = "alphabetic"; ctx.direction = /[\u0600-\u06ff]/.test(String(value)) ? "rtl" : "ltr"; ctx.fillText(String(value), x, y);
}
function lines(ctx, value, size, maxWidth) {
  ctx.font = `900 ${size}px JishooStory, sans-serif`;
  return String(value).split("\n").flatMap((line) => {
    const result = []; let row = "";
    for (const word of line.split(/\s+/)) {
      const candidate = row ? `${row} ${word}` : word;
      if (row && ctx.measureText(candidate).width > maxWidth) { result.push(row); row = ""; }
      if (ctx.measureText(word).width > maxWidth) {
        for (const char of word) { if (ctx.measureText(row + char).width > maxWidth) { result.push(row); row = ""; } row += char; }
      } else row = row ? `${row} ${word}` : word;
    }
    if (row) result.push(row); return result;
  });
}
function paragraph(ctx, value, y, size, budget, color = "#303044", maxWidth = 900) {
  let rows = lines(ctx, value, size, maxWidth);
  while (size > 30 && rows.length * size * 1.55 > budget) { size -= 2; rows = lines(ctx, value, size, maxWidth); }
  for (const row of rows) { text(ctx, row, 540, y, size, color, 900); y += size * 1.55; }
  return y;
}
function fitImage(ctx, img, x, y, width, height) {
  const scale = Math.min(width / img.naturalWidth, height / img.naturalHeight);
  const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
  ctx.drawImage(img, x + (width - w) / 2, y + (height - h) / 2, w, h);
}
function heart(ctx, x, y, size, color) {
  ctx.save(); ctx.translate(x, y); ctx.scale(size / 100, size / 100); ctx.beginPath();
  ctx.moveTo(0, 35); ctx.bezierCurveTo(-80, -15, -30, -65, 0, -30); ctx.bezierCurveTo(30, -65, 80, -15, 0, 35); ctx.fillStyle = color; ctx.fill(); ctx.restore();
}
function star(ctx, x, y, size, color) {
  ctx.beginPath(); for (let n = 0; n < 8; n++) { const r = n % 2 ? size * 0.23 : size; const a = n * Math.PI / 4; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; if (!n) ctx.moveTo(px, py); else ctx.lineTo(px, py); } ctx.closePath(); ctx.fillStyle = color; ctx.fill();
}

// Render once into a plain canvas. The preview, download and native share use
// this SAME PNG, avoiding Safari's inconsistent SVG foreignObject/DOM snapshots.
export async function renderStoryImage({ kind, format, theme, caption, data, moment, code, qr }) {
  const square = format === "square", height = square ? 1080 : 1920;
  await loadFonts();
  const [shy, happy, pair, qrImage] = await Promise.all([
    bitmap(assets + "shy-drop.webp"), bitmap(assets + "happy-drop.webp"),
    ["invite", "together", "back-to-back"].includes(kind) ? bitmap(assets + (kind === "back-to-back" ? "back-to-back-drops.webp" : "together-drops.webp")) : null,
    kind === "invite" && qr ? bitmap(qr) : null,
  ]);
  const canvas = document.createElement("canvas"); canvas.width = 1080; canvas.height = height;
  const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("مرورگرت نتونست تصویر کارت رو آماده کنه.");
  const colors = theme === "lavender" ? ["#d9cef5", "#f0eaff"] : theme === "sky" ? ["#d4e9fb", "#eff8ff"] : ["#fff2c8", "#fffae8"];
  const gradient = ctx.createLinearGradient(0, 0, 1080, height); gradient.addColorStop(0, colors[0]); gradient.addColorStop(1, colors[1]); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1080, height);
  heart(ctx, 950, height * .24, 82, "#ffffff55"); heart(ctx, 115, height * .71, 74, "#ffffff66"); star(ctx, 950, height * .67, 38, "#f1d27d77");
  text(ctx, "jishoo", 78, square ? 83 : 125, square ? 44 : 56, "#8c79a4", 700, "left");
  text(ctx, "جیشو", 990, square ? 83 : 125, square ? 50 : 65, "#8c79a4", 400, "right", "JishooStoryWordmark");
  const me = data.me, count = kind === "weekly" ? data.stats.week : data.stats.today;
  if (kind === "weekly") {
    ctx.save(); ctx.translate(540, square ? 555 : 990); ctx.rotate(-.055);
    const w = 880, h = square ? 740 : 1320;
    ctx.shadowColor = "#70608122"; ctx.shadowBlur = 40; ctx.shadowOffsetY = 18;
    rounded(ctx, -w / 2, -h / 2, w, h, 58, "#fff9e7"); ctx.shadowColor = "transparent";
    text(ctx, "کارنامهٔ سبک‌شدن", 0, -h / 2 + (square ? 50 : 85), square ? 24 : 30, "#a48c59");
    text(ctx, `${me.registered ? me.name : "من"} این هفته`, 0, -h / 2 + (square ? 110 : 165), square ? 39 : 54);
    const n = Math.min(Math.max(count, 1), 15);
    const step = square ? 128 : 150, size = n === 1 ? (square ? 205 : 340) : (square ? 100 : 140), top = square ? -220 : -410;
    for (let i = 0; i < n; i++) {
      const rowCount = Math.min(5, n - Math.floor(i / 5) * 5), x = (i % 5 - (rowCount - 1) / 2) * step;
      const y = top + Math.floor(i / 5) * (square ? 92 : 155);
      fitImage(ctx, count && i % 3 !== 1 ? happy : shy, x - size / 2, y, size, size);
    }
    const numberY = square ? 200 : 280;
    text(ctx, `${count.toLocaleString("fa-IR")} بار`, 0, numberY, square ? 146 : 230, "#292b37", 900);
    text(ctx, count ? "سبک شدم!" : "هنوز شروع نکردم.", 0, numberY + (square ? 65 : 100), square ? 44 : 65);
    const punch = caption || "لحظه‌های کوچیک، حس‌های بزرگ.";
    let punchSize = square ? 23 : 30;
    let punchY = numberY + (square ? 112 : 180);
    const punchBottom = h / 2 - (square ? 22 : 180);
    let punchRows = lines(ctx, punch, punchSize, 760);
    while (punchSize > 18 && punchY + (punchRows.length - 1) * punchSize * 1.7 > punchBottom) {
      punchSize--; punchRows = lines(ctx, punch, punchSize, 760);
    }
    for (const row of punchRows) { text(ctx, row, 0, punchY, punchSize, "#a18c68", 400); punchY += punchSize * 1.7; }
    if (!square) text(ctx, "جیشو", 0, h / 2 - 65, 85, "#595164", 400, "center", "JishooStoryWordmark");
    star(ctx, -355, square ? 200 : 350, square ? 25 : 40, "#f4d56a"); ctx.restore();
  } else {
    const pairKind = ["together", "back-to-back"].includes(kind);
    const stamps = { checkin: "ماموریت با موفقیت انجام شد", invite: "این دعوت مال توئه", together: "رفاقت در یک سطح تازه", "back-to-back": "تایمینگمون حرف نداره" };
    if (stamps[kind]) { rounded(ctx, 240, square ? 112 : 190, 600, square ? 52 : 70, 30, "#fffaf0aa"); text(ctx, stamps[kind], 540, square ? 147 : 238, square ? 24 : 30, "#9e7d61"); }
    if (pair) fitImage(ctx, pair, square ? 180 : 80, square ? 175 : 350, square ? 720 : 920, square ? 465 : 760);
    else fitImage(ctx, kind === "need" ? shy : happy, square ? 285 : 120, square ? 170 : 295, square ? 510 : 840, square ? 510 : 900);
    if (pairKind || kind === "invite") heart(ctx, 530, square ? 235 : 420, square ? 48 : 78, "#ee9aa9");
    star(ctx, square ? 890 : 950, square ? 480 : 900, square ? 27 : 42, "#f4cf62");
    const titleY = square ? (kind === "invite" ? 680 : 750) : (kind === "invite" ? 1220 : 1320);
    const end = paragraph(ctx, caption || headlines[kind] || headlines.checkin, titleY, square ? 60 : 88, kind === "invite" ? (square ? 125 : 260) : (square ? 170 : 340));
    if (kind !== "need") {
      const sub = pairKind ? `${me.name} و ${moment?.friend?.name || "دوستم"}` : kind === "invite" ? "یه بهونه برای با هم بودن، هر روز." : `جیش‌های امروز من: ${count.toLocaleString("fa-IR")}`;
      text(ctx, sub, 540, Math.min(end + (square ? 5 : 10), square ? 920 : 1635), square ? 27 : 38, "#8e7d89", 400);
    }
    if (kind === "invite") {
      const y = square ? 835 : 1540;
      ctx.beginPath(); ctx.moveTo(90, y); ctx.lineTo(990, y); ctx.strokeStyle = "#ad9bb555"; ctx.lineWidth = 2; ctx.stroke();
      if (qrImage) fitImage(ctx, qrImage, 95, y + 25, square ? 130 : 190, square ? 130 : 190);
      text(ctx, me.registered ? "با دعوت من بیا تو جمع" : "تو هم بیا تو جمع", 650, y + (square ? 48 : 65), square ? 24 : 33, "#88708c");
      if (code) text(ctx, code, 650, y + (square ? 103 : 140), square ? 40 : 58, "#554260", 900);
      text(ctx, code && me.registered ? "۷ روز پرمیوم برای هر دومون" : "یه لحظهٔ ساده، یه لبخند مشترک.", 650, y + (square ? 149 : 200), square ? 20 : 29, "#927a65", 400);
    }
  }
  text(ctx, me.handle ? `@${me.handle}` : "jishoo", 80, height - (square ? 39 : 105), square ? 20 : 27, "#8a7995", 400, "left");
  text(ctx, "jishoo.vercel.app", 1000, height - (square ? 39 : 105), square ? 20 : 27, "#8a7995", 400, "right");
  if (!square) text(ctx, "یه لحظه از روزت، برای دوستات.", 540, height - 38, 28, "#9f8b9b", 400);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  canvas.width = canvas.height = 0;
  if (!blob) throw new Error("تصویر کارت آماده نشد؛ دوباره امتحان کن.");
  return blob;
}
