import { canonicalPath } from "./routing.js";
const appScreens = new Set(["home", "nearby", "friends", "profile", "settings", "stats", "streak", "notifications", "circle", "circles", "invite", "stories", "achievements"]);
const publicScreens = new Set(["/", "/terms", "/privacy", "/support", "/install", "/changelog", "/group"]);

// Page categories only: never use invite codes, account handles or group IDs.
export function observabilityPage(href) {
  const url = new URL(canonicalPath(href), "https://jishoo.vercel.app");
  const [screen, detail] = url.pathname.slice(1).split("/");
  if (url.searchParams.has("adminAccess") || /^\/(api|admin)(\/|$)/.test(url.pathname)) return null;
  if (url.searchParams.has("group")) return "/group";
  if (url.searchParams.has("invite") || screen === "join") return "/invite";
  if (url.pathname.startsWith("/u/")) return "/u/profile";
  if (url.pathname.startsWith("/app/")) {
    const [part, kind] = url.pathname.slice(5).split("/");
    if (part === "admin") return null;
    return appScreens.has(part) ? `/app/${part}${part === "stories" && ["need", "checkin", "weekly", "invite", "streak"].includes(kind) ? "/" + kind : ""}` : "/app/home";
  }
  if (appScreens.has(screen)) return `/app/${screen}${screen === "stories" && ["need", "checkin", "weekly", "invite", "streak"].includes(detail) ? "/" + detail : ""}`;
  return publicScreens.has(url.pathname) ? url.pathname : "/";
}

export function redactMetricEvent(event, currentHref) {
  if (observabilityPage(currentHref) === null) return null;
  const page = observabilityPage(event.url || currentHref);
  if (page === null) return null;
  return { ...event, url: new URL(page, new URL(currentHref).origin).href, ...(event.type === "vital" ? { route: page } : {}) };
}
