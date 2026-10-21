import { initialize } from "../lib/database.js";
import { publicProfile } from "../lib/community.js";
import { publicOrigin, pageMetadata, renderHead } from "../lib/seo.js";
export default async function handler(req, res) {
  try {
    await initialize();
    const handle = new URL(req.url, "http://localhost").searchParams.get(
      "handle",
    );
    const { profile } = await publicProfile(handle, () => {
      throw new Error("missing");
    });
    const base = publicOrigin(process.env.PUBLIC_APP_URL);
    const response = await fetch(base + "/app-shell.html");
    if (!response.ok) throw new Error("unavailable");
    const metadata = { ...pageMetadata("/u/" + profile.handle, base), title: `${profile.name} (@${profile.handle}) توی جیشو`, description: "پروفایل جیشو؛ یه لحظه از روزت، برای دوستات.", canonical: `${base}/u/${profile.handle}`, type: "profile" };
    const html = renderHead(await response.text(), metadata, base);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=60, stale-while-revalidate=300",
    );
    res.statusCode = 200;
    res.end(html);
  } catch {
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    // No requested handle or private account data is reflected in the fallback.
    res.end(`<!doctype html><html lang="fa" dir="rtl"><head>
      <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <meta name="robots" content="noindex, nofollow"><title>پروفایل پیدا نشد | jishoo</title>
      <link rel="icon" href="/assets/favicon-v2-64.png">
      <style>body{margin:0;background:#fffcf5;color:#3d3d4d;font-family:Tahoma,Arial,sans-serif}main{max-width:420px;min-height:90vh;padding:24px;margin:auto;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;box-sizing:border-box}img{object-fit:contain}h1{font-size:23px;line-height:1.7}p{font-size:14px;line-height:2;color:#796c80}a{padding:14px 24px;margin-top:20px;background:#b1b9f2;border:1px solid #c4c9f3;border-radius:17px;box-shadow:0 4px 0 #959fdc;color:#454362;font-weight:bold;text-decoration:none;min-height:44px;box-sizing:border-box}a:focus-visible{outline:3px solid #9475ae;outline-offset:5px}</style>
      </head><body><main><span dir="ltr">jishoo</span><img src="/assets/shy-drop.webp" width="150" height="180" alt="قطرهٔ خجالتی جیشو">
      <h1>این پروفایل پیدا نشد.</h1><p>ممکنه آدرس عوض شده باشه یا این پروفایل دیگه در دسترس نباشه.</p>
      <a href="/home">برگشت به جیشو</a></main></body></html>`);
  }
}
