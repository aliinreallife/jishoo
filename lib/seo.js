export const publicPages = {
  "/": { title: "جیشو (jishoo) | ثبت جیش، آمار و استوری با دوست‌ها", description: "جیشو یک اپ اجتماعی برای ثبت «جیش دارم» و «جیش کردم»، آمار شخصی و ساخت کارت استوری با دوست‌هاست. مهمان شروع کن؛ عضویت فعلاً با دعوت و گوگله." },
  "/about": { title: "جیشو چیست؟ امکانات، عضویت و حریم خصوصی | jishoo", description: "جیشو چطور کار می‌کند؟ ثبت‌های اختیاری، دوست‌ها، نقشهٔ تقریبی، آمار شمسی و کارت‌های استوری؛ همراه با روش عضویت و محدودیت‌های فعلی." },
  "/install": { title: "نصب جیشو روی اندروید و آیفون | jishoo", description: "راهنمای نصب وب‌اپ جیشو روی Android، iPhone و iPad؛ از Chrome یا Safari آن را به صفحهٔ اصلی اضافه کن. اعلان‌ها به اجازهٔ جداگانه نیاز دارند." },
  "/privacy": { title: "حریم خصوصی جیشو | jishoo", description: "بدان جیشو چه داده‌هایی نگه می‌دارد، مکان تقریبی چطور کار می‌کند، چه کسی لینک‌های اجتماعیت را می‌بیند و چطور حساب و داده‌هایت را حذف کنی." },
  "/terms": { title: "شرایط استفاده از جیشو | jishoo", description: "شرایط عضویت با دعوت، استفاده از جیشو، دوستی و گروه‌ها، اشتراک‌گذاری، هدیه‌های پرمیوم و نسخهٔ آزمایشی را بخوان." },
  "/support": { title: "پشتیبانی جیشو و فرستادن پیشنهاد | jishoo", description: "مشکل یا پیشنهادی دربارهٔ جیشو داری؟ پیام خصوصی برای پشتیبانی بفرست و کد پیگیری بگیر. راه تماس برای پاسخ اختیاری است." },
  "/changelog": { title: "تازه‌های جیشو و تغییرات نسخه‌ها | jishoo", description: "تغییرات و بهبودهای هر نسخهٔ جیشو را به زبان ساده بخوان؛ امکانات تازه، بهبود نقشه، حریم خصوصی و اشتراک‌گذاری." },
};
export const publicPaths = Object.keys(publicPages);

export function publicOrigin(value = "https://jishoo.vercel.app") {
  const url = new URL(value);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/" || (url.protocol !== "https:" && !(local && url.protocol === "http:"))) throw new Error("PUBLIC_APP_URL must be an HTTPS origin (or local HTTP for development).");
  return url.origin;
}

export function pageMetadata(pathname, origin) {
  const page = publicPages[pathname];
  return {
    title: page?.title || "jishoo | جیشو",
    description: page?.description || publicPages["/"].description,
    canonical: page ? origin + (pathname === "/" ? "/" : pathname) : null,
    reader: pathname === "/about" ? origin + "/about.md" : null,
    robots: page ? "index, follow, max-image-preview:large" : "noindex, nofollow",
    image: origin + "/assets/social-shy-v4.png",
    imageAlt: "قطرهٔ آبی خجالتی جیشو؛ اپ اجتماعی برای دوست‌ها",
    type: "website",
  };
}

export function structuredData(pathname, origin) {
  if (!publicPages[pathname]) return null;
  const site = { "@type": "WebSite", "@id": origin + "/#website", url: origin + "/", name: "jishoo", alternateName: "جیشو", inLanguage: "fa-IR" };
  const app = { "@type": "WebApplication", "@id": origin + "/#app", name: "jishoo", alternateName: "جیشو", url: origin + "/", description: publicPages["/"].description, applicationCategory: "SocialNetworkingApplication", operatingSystem: "Web, Android, iOS", inLanguage: "fa-IR", isAccessibleForFree: true, image: origin + "/assets/social-shy-v4.png" };
  const page = { "@type": pathname === "/about" ? "AboutPage" : "WebPage", "@id": origin + pathname + "#page", url: origin + pathname, name: publicPages[pathname].title, description: publicPages[pathname].description, inLanguage: "fa-IR", isPartOf: { "@id": site["@id"] }, about: { "@id": app["@id"] } };
  if (pathname === "/" || pathname === "/about") page.mainEntity = { "@id": app["@id"] };
  const breadcrumbs = pathname === "/" ? [] : [{ "@type": "BreadcrumbList", "@id": origin + pathname + "#breadcrumbs", itemListElement: [
    { "@type": "ListItem", position: 1, name: "jishoo", item: origin + "/" },
    { "@type": "ListItem", position: 2, name: page.name, item: page.url },
  ] }];
  if (breadcrumbs.length) page.breadcrumb = { "@id": breadcrumbs[0]["@id"] };
  return { "@context": "https://schema.org", "@graph": [site, app, page, ...breadcrumbs] };
}

export const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const safeJson = value => JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

export function renderHead(html, metadata, origin, data = null) {
  const clean = html
    .replace(/<title>[\s\S]*?<\/title>/gi, "")
    .replace(/<meta\b(?=[^>]*(?:name|property)=["'](?:description|robots|jishoo:origin|og:[^"']+|twitter:[^"']+)["'])[^>]*>/gi, "")
    .replace(/<link\b(?=[^>]*rel=["']canonical["'])[^>]*>/gi, "")
    .replace(/<link\b(?=[^>]*data-public-reader)[^>]*>/gi, "")
    .replace(/<script\b(?=[^>]*type=["']application\/ld\+json["'])[^>]*>[\s\S]*?<\/script>/gi, "");
  const meta = (attribute, key, value) => `<meta ${attribute}="${key}" content="${escapeHtml(value)}">`;
  const tags = [
    `<title>${escapeHtml(metadata.title)}</title>`,
    meta("name", "description", metadata.description), meta("name", "robots", metadata.robots), meta("name", "jishoo:origin", origin),
    ...(metadata.canonical ? [`<link rel="canonical" href="${escapeHtml(metadata.canonical)}">`, meta("property", "og:url", metadata.canonical)] : []),
    ...(metadata.reader ? [`<link rel="alternate" type="text/markdown" href="${escapeHtml(metadata.reader)}" data-public-reader>`] : []),
    meta("property", "og:type", metadata.type), meta("property", "og:site_name", "jishoo"), meta("property", "og:locale", "fa_IR"),
    meta("property", "og:title", metadata.title), meta("property", "og:description", metadata.description),
    meta("property", "og:image", metadata.image), meta("property", "og:image:alt", metadata.imageAlt), meta("property", "og:image:width", "1200"), meta("property", "og:image:height", "630"),
    meta("name", "twitter:card", "summary_large_image"), meta("name", "twitter:title", metadata.title), meta("name", "twitter:description", metadata.description), meta("name", "twitter:image", metadata.image), meta("name", "twitter:image:alt", metadata.imageAlt),
    ...(data ? [`<script type="application/ld+json">${safeJson(data)}</script>`] : []),
  ].join("\n");
  return clean.replace("</head>", tags + "\n</head>");
}
