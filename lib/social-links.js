// Shared by the browser editor and the API. This validates profile-link syntax,
// not ownership, account existence, or whether a profile is public.
const rules = {
  instagram: {
    label: "اینستاگرام", origin: "https://www.instagram.com/",
    hosts: ["instagram.com", "www.instagram.com"],
    valid: value => /^[A-Za-z0-9_](?:[A-Za-z0-9_.]{0,28}[A-Za-z0-9_])?$/.test(value) && !value.includes(".."),
    help: "شناسهٔ اینستاگرام باید ۱ تا ۳۰ حرف، عدد، نقطه یا زیرخط باشه؛ نقطهٔ اول، آخر یا پشت‌سرهم مجاز نیست.",
    reserved: ["p", "reel", "reels", "stories", "explore", "direct", "accounts", "about", "legal", "developer", "developers", "web", "api", "directory", "challenge", "oauth", "emails", "settings", "nametag"],
  },
  telegram: {
    label: "تلگرام", origin: "https://t.me/", hosts: ["t.me", "www.t.me", "telegram.me", "www.telegram.me"],
    valid: value => /^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(value),
    help: "شناسهٔ تلگرام باید با حرف انگلیسی شروع بشه و ۴ تا ۳۲ حرف، عدد یا زیرخط داشته باشه.",
    reserved: ["share", "joinchat", "addstickers", "addemoji", "iv", "proxy", "login", "auth", "passport", "confirmphone", "setlanguage", "boost"],
  },
  x: {
    label: "ایکس", origin: "https://x.com/", hosts: ["x.com", "www.x.com", "twitter.com", "www.twitter.com"],
    valid: value => /^[A-Za-z0-9_]{1,15}$/.test(value),
    help: "شناسهٔ ایکس باید ۱ تا ۱۵ حرف انگلیسی، عدد یا زیرخط باشه؛ نقطه و خط تیره مجاز نیست.",
    reserved: ["home", "search", "explore", "notifications", "messages", "settings", "login", "logout", "signup", "intent", "share", "compose", "tos", "privacy", "account", "oauth", "hashtag", "i"],
  },
  spotify: {
    label: "اسپاتیفای", origin: "https://open.spotify.com/", hosts: ["open.spotify.com"],
    valid: value => /^[A-Za-z0-9._-]{1,100}$/.test(value) && ![".", ".."].includes(value),
    help: "شناسهٔ اسپاتیفای یا لینک مستقیم پروفایل حساب یا هنرمند رو وارد کن.",
    reserved: [],
  },
};
export const socialKinds = Object.freeze(["instagram", "telegram", "x", "spotify", "website"]);

export function socialProfile(kind, input) {
  if (typeof input !== "string") throw new Error("شناسه یا لینک معتبر وارد کن.");
  const value = input.trim();
  if (!value) return { url: "", handle: "" };
  if (value.length > 300) throw new Error("لینک خیلی طولانیه.");
  if (/[\\\u0000-\u0020\u007f]/.test(value)) throw new Error("شناسه یا لینک نباید فاصله یا نویسهٔ پنهان داشته باشه.");
  const rule = rules[kind];
  if (!rule && kind !== "website") throw new Error("این شبکهٔ اجتماعی پشتیبانی نمی‌شه.");
  const spotifyURI = kind === "spotify" && /^spotify:(user|artist):([A-Za-z0-9._-]{1,100})$/i.exec(value);
  if (spotifyURI) return socialProfile(kind, rule.origin + spotifyURI[1].toLowerCase() + "/" + spotifyURI[2]);
  const isURL = kind === "website" || value.includes(":") || value.includes("/") || rule.hosts.some(host => value.toLowerCase() === host);
  let handle = value.replace(/^@/, ""), prefix = kind === "spotify" ? "user/" : "";
  if (isURL) {
    let url;
    try { url = new URL(/^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`); }
    catch { throw new Error("لینک معتبر وارد کن؛ مثلاً https://example.com"); }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
      throw new Error("یک لینک عمومی با https وارد کن.");
    url.protocol = "https:";
    if (kind === "website") {
      const host = url.hostname.toLowerCase();
      if (!host.includes(".") || /[:\[\]]/.test(host) || /^\d+(?:\.\d+){0,3}$/.test(host) || /\.(?:localhost|local|internal|lan|test|invalid)$/.test(host) || host.endsWith("."))
        throw new Error("آدرس یک وب‌سایت عمومی وارد کن؛ آدرس محلی یا IP پذیرفته نمی‌شه.");
      return { url: url.href, handle: "" };
    }
    if (!rule.hosts.includes(url.hostname.toLowerCase()) || url.port)
      throw new Error(`این لینک برای ${rule.label} نیست. شناسه یا لینک پروفایل همون شبکه رو وارد کن.`);
    const parts = url.pathname.split("/").filter(Boolean);
    if (kind === "spotify") {
      if (/^intl-[a-z]{2}(?:-[a-z]{2})?$/i.test(parts[0] || "")) parts.shift();
      if (parts.length !== 2 || !["user", "artist"].includes(parts[0]))
        throw new Error("لینک پروفایل حساب یا هنرمند رو وارد کن؛ لینک آهنگ، آلبوم یا پلی‌لیست مناسب این قسمت نیست.");
      prefix = parts.shift() + "/";
    } else if (parts.length !== 1) throw new Error("لینک پروفایل رو وارد کن؛ لینک پست، استوری یا دعوت مناسب این قسمت نیست.");
    try { handle = decodeURIComponent(parts[0]); }
    catch { throw new Error("لینک پروفایل معتبر نیست."); }
  }
  if (!rule.valid(handle)) throw new Error(rule.help);
  if (kind === "spotify" && prefix === "artist/" && !/^[A-Za-z0-9]{22}$/.test(handle)) throw new Error("لینک پروفایل هنرمند اسپاتیفای معتبر نیست.");
  if (rule.reserved.includes(handle.toLowerCase()))
    throw new Error("این آدرس صفحهٔ یک حساب نیست؛ شناسه یا لینک پروفایل رو وارد کن.");
  return { url: rule.origin + prefix + handle, handle };
}

export function cleanSocialLinks(links = {}) {
  if (!links || typeof links !== "object" || Array.isArray(links)) throw new Error("حساب‌های اجتماعی معتبر نیستن.");
  const result = {};
  for (const kind of socialKinds) {
    const { url } = socialProfile(kind, links[kind] ?? "");
    if (url) result[kind] = url;
  }
  return result;
}

export function socialFieldError(kind, value) {
  try { socialProfile(kind, value || ""); return ""; }
  catch (error) { return error.message; }
}
