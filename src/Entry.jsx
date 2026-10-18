import React, { lazy, Suspense, useEffect } from "react";
import LoadingScreen from "./components/LoadingScreen";
import Landing from "./components/Landing";
const ReleasePage = lazy(() => import("./components/ReleasePage"));
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
    if (["/", "/changelog", "/privacy", "/terms", "/support", "/install"].includes(pathname) || pathname.startsWith("/u/")) return;
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex, nofollow";
    document.head.append(robots);
    return () => robots.remove();
  }, [pathname]);
  if (pathname === "/") return <Landing />;
  if (pathname === "/changelog") return <Suspense fallback={<LoadingScreen />}><ReleasePage /></Suspense>;
  return <Suspense fallback={<LoadingScreen />}><App /></Suspense>;
}
