import React, { lazy, Suspense, useState } from "react";
import { Bell, BellSlash, Clock, X } from "@phosphor-icons/react";
import { api } from "../api";
import { reminderDue } from "../reminder-policy";
import { useDeviceStatus } from "../use-device-status";
import "./CheckinReminder.css";
const PushPermission = lazy(() => import("./HomeNotifications").then(module => ({ default: module.PushPermission })));

function useReminderControls(data, onChanged, notify) {
  const [busy, setBusy] = useState(false), [permission, setPermission] = useState(false);
  const preferences = data.me.checkinReminders || { inApp: true, push: false, snoozedUntil: null };
  async function save(update, message, extra) {
    setBusy(true);
    try {
      const result = await api("reminder-prefs", update); onChanged(result.preferences, extra);
      if (message) notify(message);
      return true;
    } catch (error) { notify(error.message); return false; }
    finally { setBusy(false); }
  }
  const prompt = permission && <Suspense fallback={null}><PushPermission purpose="reminder" data={data} notify={notify}
    onClose={() => setPermission(false)}
    onEnabled={async () => { if (!await save({ push: true, snoozeDays: 0 }, null, { notificationsEnabled: true })) throw new Error("انتخاب یادآوری ذخیره نشد؛ دوباره امتحان کن."); }}
  /></Suspense>;
  return { busy, preferences, save, prompt, askPush: () => setPermission(true) };
}

export default function CheckinReminder({ data, pending, onPrivateCheckin, onChanged, notify }) {
  const controls = useReminderControls(data, onChanged, notify);
  const due = reminderDue({ ...data.me, lastDoneAt: data.stats.lastDoneAt, preferences: controls.preferences });
  if (!due || pending) return null;
  return <aside className="checkin-reminder" aria-label="یادآوری ثبت شخصی">
    <button className="reminder-snooze" aria-label="یادآوری‌ها یک هفته ساکت باشن" disabled={controls.busy} onClick={() => controls.save({ snoozeDays: 7 }, "یادآوری‌ها یک هفته ساکتن.")}><X size={17} /></button>
    <img src="/assets/shy-drop.webp" width="46" height="58" alt="" />
    <div><strong>یه سر به حال‌و‌احوال خودت بزن</strong><p>چندروزه اینجا جیشی ثبت نکردی. اگه دلت خواست، می‌تونه فقط پیش خودت بمونه.</p></div>
    <button className="reminder-private" onClick={onPrivateCheckin}>فقط برای خودم ثبت کنم</button>
    <div className="reminder-links">
      {!controls.preferences.push && <button disabled={controls.busy} onClick={controls.askPush}><Bell size={15} /> روی گوشی هم یادم بنداز</button>}
      <button disabled={controls.busy} onClick={() => controls.save({ inApp: false, push: false }, "یادآوری‌های شخصی خاموش شدن.")}>دیگه یادآوری نکن</button>
    </div>
    {controls.prompt}
  </aside>;
}

export function ReminderSettings({ data, onChanged, notify }) {
  const controls = useReminderControls(data, onChanged, notify), device = useDeviceStatus(data.me.id);
  const snoozed = Date.parse(controls.preferences.snoozedUntil || "") > Date.now();
  return <section className="reminder-settings" aria-label="تنظیم یادآوری شخصی">
    <header><Clock size={23} /><h2>یادآوری آروم، برای خودم</h2></header>
    <p>بعد از دو روز بدون ثبت «جیش کردم». روی گوشی حداکثر هفته‌ای یک‌باره؛ چیزی برای دوستات فرستاده نمی‌شه.</p>
    <button className="reminder-setting" role="switch" aria-checked={controls.preferences.inApp} disabled={controls.busy} onClick={() => controls.save({ inApp: !controls.preferences.inApp })}>
      {controls.preferences.inApp ? <Bell size={21} /> : <BellSlash size={21} />}<span><strong>کارت داخل جیشو</strong><small>{controls.preferences.inApp ? "روشنه؛ فقط وقتی جیشو رو باز می‌کنی" : "خاموشه"}</small></span><b>{controls.preferences.inApp ? "روشن" : "خاموش"}</b>
    </button>
    <button className="reminder-setting" role="switch" aria-checked={controls.preferences.push} disabled={controls.busy} onClick={() => controls.preferences.push ? controls.save({ push: false }) : controls.askPush()}>
      {controls.preferences.push ? <Bell size={21} /> : <BellSlash size={21} />}<span><strong>یادآوری روی گوشی</strong><small>{controls.preferences.push ? data.me.notificationsEnabled === false ? "اعلان‌های کلی خاموشن" : device.push ? "حتی وقتی جیشو بسته‌ست" : "برای دستگاه‌های فعالی که اجازهٔ اعلان دارن" : "خاموشه؛ فقط با انتخاب جداگانهٔ تو"}</small></span><b>{controls.preferences.push ? "روشن" : "خاموش"}</b>
    </button>
    {controls.preferences.push && !device.push && <button className="reminder-setting-link" onClick={controls.askPush}>روی این گوشی هم روشن کن</button>}
    <button className="reminder-setting-link" disabled={controls.busy} onClick={() => controls.save({ snoozeDays: snoozed ? 0 : 7 })}>{snoozed ? `تا ${new Date(controls.preferences.snoozedUntil).toLocaleDateString("fa-IR")} ساکته؛ ادامه بدم` : "همهٔ یادآوری‌های شخصی، یک هفته ساکت"}</button>
    {controls.prompt}
  </section>;
}
