import { pageMetadata, structuredData } from "../lib/seo";

export function updatePageHead(pathname) {
  const origin = document.querySelector('meta[name="jishoo:origin"]')?.content || location.origin;
  const setMeta = (attribute, key, value) => {
    let node = document.head.querySelector(`meta[${attribute}="${key}"]`);
    if (value === null) { node?.remove(); return; }
    if (!node) { node = document.createElement("meta"); node.setAttribute(attribute, key); document.head.append(node); }
    node.content = value;
  };
  // Public share previews retain their server-provided name and handle.
  if (pathname.startsWith("/u/") && document.querySelector('meta[property="og:type"]')?.content === "profile") { setMeta("name", "robots", "noindex, nofollow"); return; }
  const page = pageMetadata(pathname, origin);
  document.title = page.title;
  for (const [key, value] of Object.entries({ description: page.description, robots: page.robots, "twitter:card": "summary_large_image", "twitter:title": page.title, "twitter:description": page.description, "twitter:image": page.image, "twitter:image:alt": page.imageAlt })) setMeta("name", key, value);
  for (const [key, value] of Object.entries({ "og:type": page.type, "og:title": page.title, "og:description": page.description, "og:url": page.canonical, "og:site_name": "jishoo", "og:locale": "fa_IR", "og:image": page.image, "og:image:alt": page.imageAlt, "og:image:width": "1200", "og:image:height": "630" })) setMeta("property", key, value);
  document.head.querySelectorAll('link[rel="canonical"], script[type="application/ld+json"]').forEach(node => node.remove());
  if (page.canonical) {
    const link = document.createElement("link"); link.rel = "canonical"; link.href = page.canonical; document.head.append(link);
    const script = document.createElement("script"); script.type = "application/ld+json"; script.textContent = JSON.stringify(structuredData(pathname, origin)); document.head.append(script);
  }
}
