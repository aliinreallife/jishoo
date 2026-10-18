// Read the same public origin used for invite/profile links. No deployment
// hostname belongs in the artwork renderer.
export function storyWebsite(publicUrl, fallbackOrigin = globalThis.location?.origin) {
  for (const value of [publicUrl, fallbackOrigin]) {
    try {
      const url = new URL(value);
      if (["https:", "http:"].includes(url.protocol) && !url.username && !url.password) return url.host.toLowerCase();
    } catch { /* Fall back to the current app origin. */ }
  }
  return "jishoo";
}
