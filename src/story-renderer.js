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
// Full-bleed backgrounds may reach the edges. Keep meaningful story content
// between 250px and 1580px, clear of social apps' account and reply controls.
export const STORY_SAFE_AREA = Object.freeze({ top: 250, bottom: 340, side: 80 });
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
function text(ctx, value, x, y, size, color = "#303044", weight = 700, align = "center", family = "JishooStory", maxWidth = 850) {
  ctx.font = `${weight} ${size}px ${family}, sans-serif`;
  while (size > 18 && ctx.measureText(String(value)).width > maxWidth) { size -= 2; ctx.font = `${weight} ${size}px ${family}, sans-serif`; }
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
function drop(ctx, x, y, size) {
  ctx.save(); ctx.translate(x, y); ctx.scale(size / 50, size / 50);
  ctx.beginPath(); ctx.moveTo(0, -25); ctx.bezierCurveTo(-7,-11,-20,3,-20,13); ctx.bezierCurveTo(-20,39,20,39,20,13); ctx.bezierCurveTo(20,3,7,-11,0,-25);
  ctx.fillStyle="#b8dbfa"; ctx.fill(); ctx.strokeStyle="#7caade"; ctx.lineWidth=2.5; ctx.stroke(); ctx.restore();
}

// Render once into a plain canvas. The preview, download and native share use
// this SAME PNG, avoiding Safari's inconsistent SVG foreignObject/DOM snapshots.
export async function renderStoryImage({ kind, format, theme, caption, data, moment, code, qr }) {
  const square = format === "square", height = square ? 1080 : 1920;
  const safeTop = square ? 0 : STORY_SAFE_AREA.top;
  const safeBottom = square ? height : height - STORY_SAFE_AREA.bottom;
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
  drop(ctx, square ? 95 : 100, square ? 61 : safeTop + 40, square ? 30 : 38);
  text(ctx, "jishoo", square ? 131 : 145, square ? 83 : safeTop + 70, square ? 44 : 48, "#8c79a4", 700, "left");
  text(ctx, "جیشو", 985, square ? 83 : safeTop + 70, square ? 50 : 58, "#8c79a4", 400, "right", "JishooStoryWordmark");
  const me = data.me, count = kind === "weekly" ? data.stats.week : data.stats.today;
  if (kind === "weekly") {
    ctx.save(); ctx.translate(540, square ? 555 : 940); ctx.rotate(-.055);
    const w = square ? 880 : 820, h = square ? 800 : 1060;
    ctx.shadowColor = "#70608122"; ctx.shadowBlur = 40; ctx.shadowOffsetY = 18;
    rounded(ctx, -w / 2, -h / 2, w, h, 58, "#fff9e7"); ctx.shadowColor = "transparent";
    text(ctx, "کارنامهٔ سبک‌شدن", 0, -h / 2 + (square ? 50 : 65), square ? 24 : 28, "#a48c59");
    text(ctx, `${me.registered ? me.name : "من"} این هفته`, 0, -h / 2 + (square ? 110 : 135), square ? 39 : 46, "#303044", 700, "center", "JishooStory", 740);
    const n = Math.min(Math.max(count, 1), 15);
    const step = square ? 128 : 140, size = n === 1 ? (square ? 205 : 300) : (square ? 100 : 118), top = square ? -220 : -310;
    for (let i = 0; i < n; i++) {
      const rowCount = Math.min(5, n - Math.floor(i / 5) * 5), x = (i % 5 - (rowCount - 1) / 2) * step;
      const y = top + Math.floor(i / 5) * (square ? 92 : 125);
      fitImage(ctx, count && i % 3 !== 1 ? happy : shy, x - size / 2, y, size, size);
    }
    const numberY = square ? 175 : 235;
    text(ctx, `${count.toLocaleString("fa-IR")} بار`, 0, numberY, square ? 130 : 175, "#292b37", 900, "center", "JishooStory", 740);
    text(ctx, count ? "سبک شدم!" : "هنوز شروع نکردم.", 0, numberY + (square ? 77 : 110), square ? 40 : 52);
    const punch = caption || "لحظه‌های کوچیک، حس‌های بزرگ.";
    let punchSize = square ? 23 : 27;
    let punchY = square ? 285 : 390;
    const punchBottom = square ? 350 : 452;
    let punchRows = lines(ctx, punch, punchSize, 760);
    while (punchSize > 18 && punchY + (punchRows.length - 1) * punchSize * 1.7 > punchBottom) {
      punchSize--; punchRows = lines(ctx, punch, punchSize, 760);
    }
    for (const row of punchRows) { text(ctx, row, 0, punchY, punchSize, "#a18c68", 400); punchY += punchSize * 1.7; }
    text(ctx, "جیشو", 0, square ? 390 : 508, square ? 34 : 44, "#595164", 400, "center", "JishooStoryWordmark");
    star(ctx, -345, square ? 200 : 285, square ? 25 : 30, "#f4d56a"); ctx.restore();
  } else {
    const pairKind = ["together", "back-to-back"].includes(kind);
    const stamps = { need: "یه مکث بین کارهام", checkin: "ماموریت با موفقیت انجام شد", invite: "این دعوت مال توئه", together: "رفاقت در یک سطح تازه", "back-to-back": "تایمینگمون حرف نداره" };
    if (stamps[kind]) { rounded(ctx, 240, square ? 112 : safeTop + 110, 600, square ? 52 : 60, 30, "#fffaf0aa"); text(ctx, stamps[kind], 540, square ? 147 : safeTop + 152, square ? 24 : 28, "#9e7d61"); }
    if (pair) fitImage(ctx, pair, square ? 180 : 120, square ? 175 : 430, square ? 720 : 840, square ? 465 : kind === "invite" ? 510 : 640);
    else fitImage(ctx, kind === "need" ? shy : happy, square ? 285 : 160, square ? 170 : 430, square ? 510 : 760, square ? 510 : 640);
    heart(ctx, pairKind || kind === "invite" ? 530 : 860, square ? 235 : 510, square ? 48 : 65, "#ee9aa9");
    star(ctx, square ? 890 : 940, square ? 480 : 920, square ? 27 : 38, "#f4cf62");
    const titleY = square ? (kind === "invite" ? 680 : 750) : (kind === "invite" ? 1000 : 1130);
    const end = paragraph(ctx, caption || headlines[kind] || headlines.checkin, titleY, square ? 60 : 78, kind === "invite" ? (square ? 125 : 200) : (square ? 170 : 260));
    const sub = pairKind ? `${me.name} و ${moment?.friend?.name || "دوستم"}` : kind === "need" ? "یه توقف کوتاه، بعد دوباره پیشتونم." : kind === "invite" ? "یه بهونه برای با هم بودن، هر روز." : `جیش‌های امروز من: ${count.toLocaleString("fa-IR")}`;
    const subY = Math.min(end + (square ? 5 : 10), square ? 920 : kind === "invite" ? 1225 : 1435);
    text(ctx, sub, 540, subY, square ? 27 : kind === "invite" ? 33 : 36, "#8e7d89", 400);
    if (pairKind) text(ctx, kind === "together" ? "یه دقیقه فاصله، یه خاطرهٔ مشترک." : "یکی بعد از اون یکی؛ همین‌قدر بامزه.", 540, subY + (square ? 37 : 54), square ? 23 : 30, "#9f8b9b", 400);
    if (kind === "invite") {
      const y = square ? 835 : 1280;
      ctx.beginPath(); ctx.moveTo(90, y); ctx.lineTo(990, y); ctx.strokeStyle = "#ad9bb555"; ctx.lineWidth = 2; ctx.stroke();
      if (qrImage) fitImage(ctx, qrImage, square ? 95 : 115, y + 25, square ? 130 : 190, square ? 130 : 190);
      text(ctx, me.registered ? "با دعوت من بیا تو جمع" : "تو هم بیا تو جمع", 650, y + (square ? 48 : 55), square ? 24 : 30, "#88708c", 700, "center", "JishooStory", 560);
      if (code) text(ctx, code, 650, y + (square ? 103 : 120), square ? 40 : 52, "#554260", 900, "center", "JishooStory", 560);
      text(ctx, code && me.registered ? "۷ روز پرمیوم برای هر دومون" : "یه لحظهٔ ساده، یه لبخند مشترک.", 650, y + (square ? 149 : 180), square ? 20 : 27, "#927a65", 400, "center", "JishooStory", 560);
    }
  }
  text(ctx, me.handle ? `@${me.handle}` : "jishoo", 95, square ? height - 39 : safeBottom - 60, square ? 20 : 25, "#8a7995", 400, "left", "JishooStory", 420);
  text(ctx, "jishoo.vercel.app", 985, square ? height - 39 : safeBottom - 60, square ? 20 : 25, "#8a7995", 400, "right", "JishooStory", 420);
  heart(ctx, square ? 325 : 250, square ? height - 17 : safeBottom - 22, square ? 14 : 20, "#d9a8b7");
  text(ctx, "یه لحظه از روزت، برای دوستات.", 540, square ? height - 12 : safeBottom - 15, square ? 17 : 25, "#9f8b9b", 400);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  canvas.width = canvas.height = 0;
  if (!blob) throw new Error("تصویر کارت آماده نشد؛ دوباره امتحان کن.");
  return blob;
}
