import React, { lazy, Suspense, useEffect } from "react";
import LoadingScreen from "./components/LoadingScreen";
import Landing from "./components/Landing";
import PublicPage, { isPublicPage } from "./public-pages";
import { useLocation, useNavigate } from "react-router-dom";
import { canonicalPath } from "./routing";

const App = lazy(() => import("./App"));
export default function Entry() {
  const current = useLocation(), navigate = useNavigate();
  const path = canonicalPath(current.pathname + current.search + current.hash);
  const pathname = path.split(/[?#]/)[0];
  useEffect(() => {
    if (path !== current.pathname + current.search + current.hash) navigate(path, { replace: true, state: current.state });
  }, [path, current, navigate]);
  useEffect(() => {
    let active = true;
    if (isPublicPage(pathname)) {
      const canonical = document.querySelector('link[rel="canonical"]');
      if (!canonical || new URL(canonical.href).pathname !== pathname) import("./page-head").then(module => { if (active) module.updatePageHead(pathname); }).catch(() => {});
    } else {
      let robots = document.head.querySelector('meta[name="robots"]');
      if (!robots) { robots = document.createElement("meta"); robots.name = "robots"; document.head.append(robots); }
      robots.content = "noindex, nofollow";
      if (!pathname.startsWith("/u/") || document.querySelector('meta[property="og:type"]')?.content !== "profile") {
        document.title = "jishoo | جیشو";
        document.head.querySelectorAll('link[rel="canonical"], link[data-public-reader], script[type="application/ld+json"], meta[property="og:url"]').forEach(node => node.remove());
      }
    }
    return () => { active = false; };
  }, [pathname]);
  if (pathname === "/") return <Landing />;
  if (isPublicPage(pathname)) return <PublicPage pathname={pathname} />;
  return <Suspense fallback={<LoadingScreen />}><App /></Suspense>;
}
