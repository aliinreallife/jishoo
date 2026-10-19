import React, { Suspense } from "react";
import { renderToString } from "react-dom/server";
import Landing from "./components/Landing";
import About from "./components/About";
import Install from "./components/Install";
import Legal from "./components/Legal";
import Support from "./components/Support";
import ReleasePage from "./components/ReleasePage";
const pages = { "/about": About, "/install": Install, "/privacy": Legal, "/terms": Legal, "/support": Support, "/changelog": ReleasePage };
export function renderPublicPage(pathname) {
  const Page = pages[pathname];
  return renderToString(pathname === "/" ? <Landing /> : <Suspense fallback={null}><Page kind={pathname.slice(1)} /></Suspense>);
}
