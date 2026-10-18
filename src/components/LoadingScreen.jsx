import React from "react";
import "./LoadingScreen.css";

export default function LoadingScreen({ compact = false, message = "داریم جیشو رو آماده می‌کنیم…", children }) {
  return <section className={`jishoo-loading ${compact ? "is-compact" : ""}`} role="status" dir="rtl" aria-live="polite">
    <img src="/assets/shy-drop.webp" alt="" width="128" height="128" />
    <strong>جیشو</strong>
    <p>{message}</p>
    {children}
  </section>;
}
