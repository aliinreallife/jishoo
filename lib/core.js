import {
  createHash,
  createHmac,
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
export { cleanSocialLinks } from "./social-links.js";

export const testingMode = () => process.env.TESTING_MODE === "true";
export const inviteOnly = () => process.env.INVITE_ONLY !== "false";
export const hashToken = (value) =>
  createHash("sha256").update(value).digest("hex");
export const randomToken = () => randomBytes(32).toString("base64url");
export const inviteCode = () =>
  "J-" + randomBytes(6).toString("hex").toUpperCase();
export const normalizeCode = (value) =>
  String(value || "")
    .trim()
    .toUpperCase();
export const normalizeName = (value) =>
  String(value || "")
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ");
export function normalizePhone(value) {
  let phone = String(value || "")
    .replace(/[۰-۹]/g, (c) => "۰۱۲۳۴۵۶۷۸۹".indexOf(c))
    .replace(/[٠-٩]/g, (c) => "٠١٢٣٤٥٦٧٨٩".indexOf(c))
    .replace(/[\s()-]/g, "");
  if (/^09\d{9}$/.test(phone)) phone = "+98" + phone.slice(1);
  else if (/^9\d{9}$/.test(phone)) phone = "+98" + phone;
  else if (phone.startsWith("00")) phone = "+" + phone.slice(2);
  if (!/^\+[1-9]\d{7,14}$/.test(phone))
    throw new Error("شماره موبایل معتبر وارد کن.");
  return phone;
}
function secret() {
  if (!process.env.APP_SECRET || process.env.APP_SECRET.length < 32)
    throw new Error("Server secret is not configured");
  return process.env.APP_SECRET;
}
export const phoneHash = (phone) =>
  createHmac("sha256", secret())
    .update("phone:" + phone)
    .digest("hex");
export function encryptPhone(phone) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    createHash("sha256").update(secret()).digest(),
    iv,
  );
  const ciphertext = Buffer.concat([
    cipher.update(phone, "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), ciphertext]
    .map((x) => x.toString("base64url"))
    .join(".");
}
export function decryptPhone(value) {
  const [iv, tag, ciphertext] = value
    .split(".")
    .map((x) => Buffer.from(x, "base64url"));
  const decipher = createDecipheriv(
    "aes-256-gcm",
    createHash("sha256").update(secret()).digest(),
    iv,
  );
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
export function premium(user, now = Date.now()) {
  return (
    testingMode() ||
    Boolean(user.lifetime) ||
    Boolean(user.paid_until && +new Date(user.paid_until) > now) ||
    Boolean(user.trial_until && +new Date(user.trial_until) > now)
  );
}

export function normalizeHandle(value) {
  const handle = String(value || "")
    .trim()
    .replace(/^@/, "")
    .toLowerCase();
  if (!/^[a-z][a-z0-9_]{2,23}$/.test(handle))
    throw new Error(
      "شناسه باید ۳ تا ۲۴ حرف انگلیسی، عدد یا زیرخط باشه و با حرف شروع بشه.",
    );
  return handle;
}
export function pairKind(a, b) {
  const gap = Math.abs(+new Date(a) - +new Date(b));
  return gap <= 60000 ? "together" : gap <= 300000 ? "back-to-back" : null;
}
export function approximateLocation(lat, lng) {
  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  )
    throw new Error("موقعیت معتبر نیست.");
  return {
    lat: Math.round(lat / 0.002) * 0.002,
    lng: Math.round(lng / 0.002) * 0.002,
  };
}
export function distanceKm(a, b) {
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat),
    dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}
export function cleanAvatarImage(value) {
  if (value === null) return null;
  if (
    typeof value !== "string" ||
    value.length > 90000 ||
    !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)
  )
    throw new Error("عکس معتبر انتخاب کن؛ عکس داخل برنامه کوچک می‌شه.");
  const bytes = Buffer.from(value.split(",")[1], "base64");
  if (
    bytes.length < 100 ||
    bytes[0] !== 0xff ||
    bytes[1] !== 0xd8 ||
    bytes[2] !== 0xff ||
    bytes.at(-2) !== 0xff ||
    bytes.at(-1) !== 0xd9
  )
    throw new Error("عکس آماده نشد. یک عکس دیگه انتخاب کن.");
  return value;
}
