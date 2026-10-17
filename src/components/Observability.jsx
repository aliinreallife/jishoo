import React, { lazy, Suspense } from "react";
import { observabilityPage } from "../observability";
import { useLocation } from "react-router-dom";

const analytics = import.meta.env.PROD && import.meta.env.VITE_VERCEL_ANALYTICS_ENABLED === "true";
const speed = import.meta.env.PROD && import.meta.env.VITE_VERCEL_SPEED_INSIGHTS_ENABLED === "true";
const VercelMetrics = lazy(() => import("./VercelMetrics"));

export default function Observability() {
  const current = useLocation();
  const page = observabilityPage(current.pathname + current.search + current.hash);
  if ((!analytics && !speed) || page === null) return null;
  return <Suspense fallback={null}><VercelMetrics analytics={analytics} speed={speed} page={page} /></Suspense>;
}
