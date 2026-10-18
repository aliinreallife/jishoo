// One URL vocabulary for navigation, old bookmarks and stored notifications.
export const screens = new Set([
  "home", "nearby", "friends", "stories", "profile", "settings", "stats", "streak",
  "invite", "circle", "achievements", "notifications", "admin", "privacy",
  "terms", "support", "install",
]);
const storyKinds = new Set(["weekly", "checkin", "invite", "need", "streak"]);
const aliases = { discover: "nearby", groupJoin: "group", publicProfile: "home" };
const decode = value => { try { return decodeURIComponent(value); } catch { return value; } };

export function screenPath(screen, detail) {
  const name = aliases[screen] || screen;
  if (name === "group") return "/group";
  if (!screens.has(name)) return "/home";
  if (name === "stories") return `/stories${storyKinds.has(detail) ? "/" + detail : ""}`;
  return `/${name}${name === "circle" && detail ? "/" + encodeURIComponent(detail) : ""}`;
}

export function canonicalPath(href) {
  const url = new URL(href, "https://jishoo.vercel.app");
  let path = url.pathname.replace(/\/$/, "") || "/";
  // Only old screen fragments are routes. Ordinary page anchors stay anchors.
  const fragment = url.hash.replace(/^#\/?/, "").split("/");
  const legacy = (url.hash.startsWith("#/") || path === "/") &&
    (screens.has(fragment[0]) || Object.hasOwn(aliases, fragment[0]));
  if (legacy) {
    path = screenPath(fragment[0], fragment[1]);
    url.hash = "";
  } else if (path.startsWith("/app/")) {
    const [screen, detail] = path.slice(5).split("/");
    if (screens.has(screen) || Object.hasOwn(aliases, screen)) {
      path = screenPath(screen, detail ? decode(detail) : undefined);
    }
  }
  if (path === "/discover") path = "/nearby";
  // Older invite/Google/TWA links started at the public landing page.
  if (["/", "/home"].includes(path) && url.searchParams.has("group")) path = "/group";
  else if (["/", "/home"].includes(path) && url.searchParams.has("invite")) path = "/join";
  else if (path === "/" && url.searchParams.has("adminAccess")) path = "/admin";
  else if (path === "/" && ["login", "google"].some(key => url.searchParams.has(key))) path = "/home";
  return path + url.search + url.hash;
}

export function readPage(href) {
  const url = new URL(canonicalPath(href), "https://jishoo.vercel.app");
  const [name, detail] = url.pathname.slice(1).split("/");
  if (name === "u") return { screen: "publicProfile", handle: detail || "" };
  if (name === "group") return { screen: "groupJoin" };
  if (name === "join") return { screen: "home" };
  return {
    screen: screens.has(name) ? name : "home",
    storyKind: name === "stories" && storyKinds.has(detail) ? detail : null,
    circleId: name === "circle" && detail ? decode(detail) : "",
  };
}

export function notificationPath(value, origin) {
  try {
    const url = new URL(value, origin);
    if (url.origin !== origin || /^\/(api|\.well-known)(\/|$)/.test(url.pathname)) return "/home";
    return canonicalPath(url.href);
  } catch { return "/home"; }
}
