import React, { lazy, Suspense } from "react";
import LoadingScreen from "./components/LoadingScreen";
const pages = {
  "/about": lazy(() => import("./components/About")),
  "/install": lazy(() => import("./components/Install")),
  "/privacy": lazy(() => import("./components/Legal")),
  "/terms": lazy(() => import("./components/Legal")),
  "/support": lazy(() => import("./components/Support")),
  "/changelog": lazy(() => import("./components/ReleasePage")),
};
export const isPublicPage = pathname => pathname === "/" || Object.hasOwn(pages, pathname);
export default function PublicPage({ pathname }) {
  const Page = pages[pathname];
  return <Suspense fallback={<LoadingScreen />}><Page kind={pathname.slice(1)} /></Suspense>;
}
