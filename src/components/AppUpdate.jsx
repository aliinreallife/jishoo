import React, { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ArrowClockwise } from "@phosphor-icons/react";
import { applyUpdate, deferUpdate, getUpdateState, getServerUpdateState, subscribeUpdates } from "../updates";
import "./AppUpdate.css";

export default function AppUpdate() {
  const state = useSyncExternalStore(subscribeUpdates, getUpdateState, getServerUpdateState);
  const dialog = useRef();
  const visible = state.available && !state.blocked && (state.mandatory || !state.deferred);
  useEffect(() => {
    if (!visible || !state.mandatory) return;
    const previous = document.activeElement, node = dialog.current;
    node?.querySelector("button")?.focus();
    const contain = (event) => {
      if (event.key === "Tab") { event.preventDefault(); node?.querySelector("button")?.focus(); }
      if (event.key === "Escape") event.preventDefault();
    };
    const keepFocus = (event) => { if (!node?.contains(event.target)) node?.querySelector("button")?.focus(); };
    const siblings = [...(node?.closest("[data-app-update]")?.parentElement?.children || [])].filter((sibling) => !sibling.hasAttribute("data-app-update"));
    const inert = siblings.map((sibling) => sibling.inert);
    siblings.forEach((sibling) => { sibling.inert = true; });
    document.addEventListener("keydown", contain);
    document.addEventListener("focusin", keepFocus);
    return () => {
      document.removeEventListener("keydown", contain);
      document.removeEventListener("focusin", keepFocus);
      siblings.forEach((sibling, index) => { sibling.inert = inert[index]; });
      if (previous?.isConnected) previous.focus();
    };
  }, [visible, state.mandatory]);
  if (!visible) return null;
  const frame = document.querySelector(".app-shell");
  return createPortal(
    <div data-app-update className={`app-update ${frame ? "is-framed" : ""} ${state.mandatory ? "is-required" : ""}`} dir="rtl">
      <section ref={dialog} className="app-update-card" role={state.mandatory ? "alertdialog" : "region"}
        aria-modal={state.mandatory ? "true" : undefined} aria-labelledby="app-update-title" aria-describedby="app-update-description">
        <img src="/assets/shy-drop.webp" alt="" width="52" height="60" />
        <div className="app-update-copy" aria-live="polite">
          <h2 id="app-update-title">نسخهٔ تازهٔ جیشو آماده‌ست</h2>
          <p id="app-update-description">{state.mandatory ? "برای ادامه، جیشو رو به‌روز کن. این نسخه برای امنیت یا درست کارکردن برنامه لازمه." : "هر وقت آماده‌ای، با یه بار تازه‌کردن بیا تو نسخهٔ جدید."}</p>
        </div>
        {(!state.online || state.error) && <p className="app-update-error" role="status">{!state.online ? "برای به‌روزرسانی، اول به اینترنت وصل شو." : state.error}</p>}
        <div className="app-update-actions">
          <button type="button" className="app-update-accept" disabled={state.applying || !state.online} onClick={applyUpdate}>
            <ArrowClockwise size={18} aria-hidden="true" />{state.applying ? "در حال آماده‌کردن…" : "به‌روزرسانی"}
          </button>
          {!state.mandatory && <button type="button" className="app-update-later" disabled={state.applying} onClick={deferUpdate}>بعداً</button>}
        </div>
      </section>
    </div>, frame || document.body,
  );
}
