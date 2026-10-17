const appScreens = new Set(["home", "nearby", "friends", "profile", "stats", "notifications", "circle", "circles", "invite", "stories", "achievements"]);
const publicScreens = new Set(["/", "/terms", "/privacy", "/support", "/install", "/changelog", "/invite", "/group"]);

// Page categories only: never use invite codes, account handles or group IDs.
export function observabilityPage(href) {
  const url = new URL(href, "https://jishoo.vercel.app");
  const [screen, detail] = url.hash.replace(/^#\//, "").split("/");
  if (url.searchParams.has("adminAccess") || screen === "admin" || /^\/(api|admin)(\/|$)/.test(url.pathname)) return null;
  if (url.searchParams.has("invite")) return "/invite";
  if (url.searchParams.has("group")) return "/group";
  if (url.pathname.startsWith("/u/")) return "/u/profile";
  if (url.pathname.startsWith("/app/")) {
    const [part, kind] = url.pathname.slice(5).split("/");
    if (part === "admin") return null;
    return appScreens.has(part) ? `/app/${part}${part === "stories" && ["need", "checkin", "weekly", "invite"].includes(kind) ? "/" + kind : ""}` : "/app/home";
  }
  if (url.hash.startsWith("#/")) return `/app/${appScreens.has(screen) ? screen : "home"}${screen === "stories" && ["need", "checkin", "weekly", "invite"].includes(detail) ? "/" + detail : ""}`;
  return publicScreens.has(url.pathname) ? url.pathname : "/";
}

export function redactMetricEvent(event, currentHref) {
  if (observabilityPage(currentHref) === null) return null;
  const page = observabilityPage(event.url || currentHref);
  if (page === null) return null;
  return { ...event, url: new URL(page, new URL(currentHref).origin).href, ...(event.type === "vital" ? { route: page } : {}) };
}
