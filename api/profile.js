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
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("این پروفایل پیدا نشد.");
  }
}
