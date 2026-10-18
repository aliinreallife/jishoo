import React, { lazy, Suspense, useState } from "react";
import { Bell, Check, LinkSimple, Eye, NavigationArrow, Heart, CaretDown, CaretLeft } from "@phosphor-icons/react";
import { fa } from "../api";
import { visibilityLabel, visibilityMode } from "../map-visibility";
import { useDeviceStatus } from "../use-device-status";
import "./SetupProgress.css";
const PushPermission = lazy(() => import("./HomeNotifications").then(module => ({ default: module.PushPermission })));

function skippedChoices(key) {
  try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; }
}

export default function SetupProgress({ data, onMap, onSocial, onInvite, notify, refresh }) {
  const me = data.me, storageKey = `jishoo:setup-choices:${me.id}`;
  const [open, setOpen] = useState(false), [permission, setPermission] = useState(false);
  const [skipped, setSkipped] = useState(() => skippedChoices(storageKey));
  const device = useDeviceStatus(me.id), hidden = visibilityMode(me) === "hidden";
  if (!me.registered) return null;
  function skip(id) {
    const next = { ...skipped, [id]: true }; setSkipped(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Optional tutorial preference. */ }
  }
  const steps = [
    { id: "map", Icon: Eye, title: "چطور روی نقشه دیده بشم؟", detail: me.mapVisibilityReviewed ? visibilityLabel(visibilityMode(me)) : "پنهان، بی‌نام یا با پروفایلت؛ انتخاب با توئه", done: me.mapVisibilityReviewed, action: onMap },
    { id: "gps", Icon: NavigationArrow, title: "اجازهٔ مکان", detail: !me.mapVisibilityReviewed ? "اول انتخاب کن چطور دیده بشی" : hidden ? "پنهان می‌مونی؛ اجازهٔ مکان لازم نیست" : device.geolocation === "granted" ? "اجازهٔ این گوشی داده شده؛ مکان‌ها تقریبی‌ان" : "برای دیده‌شدن روی نقشه، با اجازهٔ تو", done: me.mapVisibilityReviewed && (hidden || device.geolocation === "granted"), action: onMap },
    { id: "notifications", Icon: Bell, title: "اعلان دوستام", detail: device.push && me.notificationsEnabled !== false ? "روی همین گوشی روشنه" : "فقط با اجازهٔ تو، حتی وقتی جیشو بسته‌ست", done: device.push && me.notificationsEnabled !== false, optional: true, action: () => setPermission(true) },
    { id: "social", Icon: LinkSimple, title: "من تو شبکه‌های اجتماعی", detail: "حداقل یه حساب؛ فقط با قبول دوطرفه دیده می‌شه", done: Object.values(me.socialLinks || {}).some(Boolean), optional: true, action: onSocial },
    { id: "invite", Icon: Heart, title: "دعوت اولین دوستت", detail: "وقتی با دعوتت عضو بشه، این قدم هم آماده‌ست", done: data.invitationQuota?.used > 0 || data.invited?.length > 0, optional: true, action: onInvite },
  ];
  const done = steps.filter(step => step.done || (step.optional && skipped[step.id])).length;
  const percent = Math.round(done / steps.length * 100), circumference = 2 * Math.PI * 25;
  return <section className="setup-progress" aria-label="آماده‌سازی جیشو">
    <button className="setup-progress-heading" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="setup-progress-steps">
      <span className="setup-ring" role="progressbar" aria-label="قدم‌های آماده‌سازی" aria-valuenow={done} aria-valuemax={steps.length} aria-valuemin={0} aria-valuetext={`${fa(done)} از ${fa(steps.length)} قدم`}>
        <svg viewBox="0 0 60 60" aria-hidden="true"><circle cx="30" cy="30" r="25" /><circle cx="30" cy="30" r="25" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - percent / 100)} /></svg>
        <b aria-hidden="true">{done === steps.length ? <Check size={24} weight="bold" /> : `${fa(percent)}٪`}</b>
      </span>
      <span><strong>{done === steps.length ? "جیشوی تو آماده‌ست!" : "جیشو رو به سلیقهٔ خودت بچین"}</strong><small>{fa(done)} از {fa(steps.length)} قدم · {open ? "جمع‌کردن راهنما" : "ادامهٔ آماده‌سازی"}</small></span>
      <CaretDown size={18} className={open ? "is-open" : ""} />
    </button>
    {open && <div id="setup-progress-steps" className="setup-steps">
      {steps.map(({ id, Icon, title, detail, done: enabled, action, optional }) => {
        const deferred = optional && skipped[id] && !enabled;
        return <div className={`setup-step ${enabled || deferred ? "is-done" : ""}`} key={id}>
          <button onClick={action} className="setup-step-action"><span className="setup-step-icon">{enabled || deferred ? <Check size={19} /> : <Icon size={21} />}</span><span><strong>{title}</strong><small>{deferred ? "فعلاً نمی‌خوای؛ هر وقت خواستی از همین‌جا شروع کن" : detail}</small></span><CaretLeft size={16} /></button>
          {optional && !enabled && !deferred && <button className="setup-step-skip" onClick={() => skip(id)} aria-label={`فعلاً ${title} رو نمی‌خوام`}>فعلاً نمی‌خوام</button>}
        </div>;
      })}
      <p>همه‌ش به انتخاب توئه؛ پنهان‌موندن و نخواستن اعلان هم یه انتخاب کامله.</p>
    </div>}
    {permission && <Suspense fallback={null}><PushPermission data={data} notify={notify} onClose={() => setPermission(false)} onEnabled={async () => { device.refresh(); await refresh(); }} /></Suspense>}
  </section>;
}
