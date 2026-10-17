import { initialize } from "../lib/database.js";
import { publicProfile } from "../lib/community.js";
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export default async function handler(req, res) {
  try {
    await initialize();
    const handle = new URL(req.url, "http://localhost").searchParams.get(
      "handle",
    );
    const { profile } = await publicProfile(handle, () => {
      throw new Error("missing");
    });
    const base = process.env.PUBLIC_APP_URL || "https://jishoo.vercel.app";
    const response = await fetch(base + "/index.html");
    if (!response.ok) throw new Error("unavailable");
    let html = await response.text();
    const title = escape(`${profile.name} (@${profile.handle}) توی جیشو`);
    const description = escape(
      "یه لحظه از روزت، برای دوستات. بیا تو جمع جیشو.",
    );
    const image = base + "/assets/social-shy-v4.png";
    html = html
      .replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`)
      .replace(
        /<meta\s+(?:property|name)="(?:og:[^"]+|twitter:[^"]+)"[^>]*>/g,
        "",
      );
    html = html.replace(
      "</head>",
      `<meta property="og:type" content="profile"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:url" content="${base}/u/${profile.handle}"><meta property="og:image" content="${image}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${image}"></head>`,
    );
    res.setHeader("Content-Type", "text/html; charset=utf-8");
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
