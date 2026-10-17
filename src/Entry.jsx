import React, { lazy, Suspense, useEffect, useState } from "react";
import Landing from "./components/Landing";
import { ReleasePage } from "./components/ReleaseNotes";

const App = lazy(() => import("./App"));
function destination() {
  const params = new URLSearchParams(location.search);
  if (location.pathname === "/changelog") return "releases";
  return location.pathname === "/" && !location.hash.startsWith("#/") &&
    !["invite", "group", "google", "adminAccess", "login"].some((key) => params.has(key))
    ? "landing" : "app";
}
export default function Entry() {
  const [view, setView] = useState(destination);
  useEffect(() => {
    const update = () => setView(destination());
    window.addEventListener("hashchange", update);
    window.addEventListener("popstate", update);
    return () => { window.removeEventListener("hashchange", update); window.removeEventListener("popstate", update); };
  }, []);
  if (view === "landing") return <Landing />;
  if (view === "releases") return <ReleasePage />;
  return <Suspense fallback={<div className="entry-loading"><img src="/assets/shy-drop.webp" alt="قطرهٔ خجالتی جیشو" /><p>داریم جیشو رو آماده می‌کنیم…</p></div>}><App /></Suspense>;
}
