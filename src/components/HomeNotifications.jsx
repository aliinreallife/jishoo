import React, { useEffect, useRef, useState } from "react";
import { Bell, Check, CaretLeft } from "@phosphor-icons/react";
import { Mascot } from "./Mascot";
import { enablePush, pushEnvironment, pushStatus } from "../push";
import { api } from "../api";
import "./HomeNotifications.css";
const Button = ({ children, ...props }) => <button className="button button-lilac" {...props}>{children}</button>;
export function PushPermission({ data, notify, onClose, onEnabled }) {
  const permissionDialog = useRef();
  const [busy, setBusy] = useState(false);
  const environment = pushEnvironment();
  useEffect(() => { permissionDialog.current?.showModal(); }, []);
  async function run(work) {
    setBusy(true);
    try { await work(); } catch (error) { notify(error.message); }
    finally { setBusy(false); }
  }
  return (
        <dialog
          ref={permissionDialog}
          className="push-permission-dialog"
          aria-labelledby="push-permission-title"
          onCancel={onClose}
        >
          <Mascot size={126} />
          <h2 id="push-permission-title">حالِ دوستات، حتی وقتی اینجا نیستی 💧</h2>
          <p>
            وقتی دوستت می‌گه «جیش کردم» یا می‌گه «جیش دارم»، یه اعلان روی گوشی
            می‌گیری؛ لازم نیست جیشو باز باشه.
          </p>
          <ul>
            <li>فقط اعلان آدمایی که بهشون وصلی</li>
            <li>بدون دسترسی به پیام‌ها یا برنامه‌های دیگه</li>
            <li>هر وقت بخوای، خاموش یا بی‌صداش کن</li>
          </ul>
          {environment === "install" ? (
            <div className="push-install-guide">
              <strong>روی آیفون این دو قدم لازمه</strong>
              <ol>
                <li>در Safari، دکمهٔ Share و بعد Add to Home Screen رو بزن.</li>
                <li>از آیکن جیشو روی صفحهٔ اصلی بیا و اعلان رو روشن کن.</li>
              </ol>
              <small>نیاز به iOS 16.4 یا جدیدتر داره.</small>
            </div>
          ) : environment === "blocked" ? (
            <p className="push-install-guide">
              اجازهٔ اعلان قبلاً بسته شده. در تنظیمات سایت مرورگر، Notifications
              رو روی Allow بذار، بعد برگرد.
            </p>
          ) : environment === "unsupported" ? (
            <p className="push-install-guide">
              این مرورگر اعلان پس‌زمینه رو پشتیبانی نمی‌کنه؛ روی اندروید از
              Chrome یا روی آیفون از نسخهٔ صفحهٔ اصلی استفاده کن.
            </p>
          ) : (
            <Button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await enablePush(data.vapidPublicKey);
                  if (data.me.notificationsEnabled === false) await api("notification-pref", { scope: "all", enabled: true });
                  onEnabled?.();
                  onClose();
                  notify("اعلان این دستگاه روشن شد. حالا یه اعلان تستی بفرست.");
                })
              }
            >
              باشه، اعلان دوستام رو روشن کن
              <Bell size={19} />
            </Button>
          )}
          <button
            className="text-link"
            disabled={busy}
            onClick={() => onClose()}
          >
            {environment === "ready" ? "فعلاً نه" : "فهمیدم"}
          </button>
        </dialog>
  );
}
export default function HomeNotifications({ data, notify, onSettings, refresh }) {
  const [active, setActive] = useState(false), [open, setOpen] = useState(false);
  useEffect(() => {
    let mounted = true;
    const update = () => pushStatus().then((value) => mounted && setActive(value)).catch(() => {});
    update(); window.addEventListener("focus", update);
    return () => { mounted = false; window.removeEventListener("focus", update); };
  }, [data.me.id]);
  if (!data.me.registered) return null;
  const enabled = active && data.me.notificationsEnabled !== false;
  return <>
    <button className={`home-notification-card ${enabled ? "enabled" : ""}`} onClick={() => enabled ? onSettings() : setOpen(true)}>
      <span className="home-notification-icon">{enabled ? <Check size={22} /> : <Bell size={24} weight="duotone" />}</span>
      <span><strong>{enabled ? "اعلان دوستات روشنه" : "دوستت سبک شد؟ تو هم لبخند بزن!"}</strong><small>{enabled ? "تنظیم و بی‌صداکردن اعلان‌ها" : "حتی وقتی جیشو بسته‌ست؛ با اجازهٔ خودت."}</small></span>
      <span className="home-notification-cta">{enabled ? "تنظیم" : "روشن کن"}<CaretLeft size={16} /></span>
    </button>
    {open && <PushPermission data={data} notify={notify} onClose={() => setOpen(false)} onEnabled={() => { setActive(true); refresh(); }} />}
  </>;
}
