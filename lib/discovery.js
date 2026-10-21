import { productFacts, factsUpdated } from "../src/product-facts.js";
import { publicOrigin, publicPaths, pageMetadata, escapeHtml } from "./seo.js";

// Derive the reader documents from the same facts as the public About page.
// Private screens and member data are deliberately not inputs to this build.
export function discoveryDocuments(value) {
  const origin = publicOrigin(value);
  const links = publicPaths.map(path => `- [${pageMetadata(path, origin).title}](${origin + path})`).join("\n");
  const sections = productFacts.map(fact => `## ${fact.enTitle}\n\n${fact.en}\n\n[Source on the public About page](${origin}/about#en-${fact.id})`).join("\n\n");
  const about = `# jishoo (جیشو)\n\nOfficial product information. Primary language: Persian (fa-IR). Facts updated: ${factsUpdated}.\n\n${sections}\n\n## Official sources\n\n${links}\n`;
  const limits = ["signup", "friends", "pricing", "purpose"].map(id => productFacts.find(fact => fact.id === id).en).join("\n\n");
  const llms = `# jishoo\n\n> jishoo (جیشو) is a Persian-language social web app for voluntary bathroom check-ins with friends, personal statistics and shareable story cards.\n\nOfficial website: ${origin}/\nPrimary language: Persian (fa-IR). Facts updated: ${factsUpdated}.\n\n## Product overview\n\n- [What jishoo is and how it works](${origin}/about): Public Persian explanation and an expandable English summary of the current features, access requirements and privacy choices.\n- [Product facts in Markdown](${origin}/about.md): English version of those same facts, with links to their public sources.\n\n## Public documentation\n\n${links}\n\n## Current limits\n\n${limits}\n\nOnly the linked public product pages and documentation describe the service for discovery. Account screens, member profile pages, private activity, invitation codes, social links and API responses are not product documentation. See the privacy policy for data-sharing choices.\n`;
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${publicPaths.map(path => `<url><loc>${escapeHtml(origin + path)}</loc></url>`).join("\n")}\n</urlset>\n`;
  // Leave public and noindex app pages crawlable, so robots directives can be read.
  const robots = `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${origin}/sitemap.xml\n`;
  return { "about.md": about, "llms.txt": llms, "sitemap.xml": sitemap, "robots.txt": robots };
}
