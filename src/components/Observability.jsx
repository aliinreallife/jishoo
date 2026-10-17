import React, { lazy, Suspense, useEffect, useState } from "react";
import { observabilityPage } from "../observability";

const analytics = import.meta.env.PROD && import.meta.env.VITE_VERCEL_ANALYTICS_ENABLED === "true";
const speed = import.meta.env.PROD && import.meta.env.VITE_VERCEL_SPEED_INSIGHTS_ENABLED === "true";
const VercelMetrics = lazy(() => import("./VercelMetrics"));

export default function Observability() {
  const [page, setPage] = useState(() => observabilityPage(location.href));
  useEffect(() => {
    if (!analytics && !speed) return;
    const update = () => setPage(observabilityPage(location.href));
    window.addEventListener("hashchange", update);
    window.addEventListener("popstate", update);
    window.addEventListener("jishoo:navigation", update);
    return () => {
      window.removeEventListener("hashchange", update);
      window.removeEventListener("popstate", update);
      window.removeEventListener("jishoo:navigation", update);
    };
  }, []);
  if ((!analytics && !speed) || page === null) return null;
  return <Suspense fallback={null}><VercelMetrics analytics={analytics} speed={speed} page={page} /></Suspense>;
}
