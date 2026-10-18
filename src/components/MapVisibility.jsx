import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Eye, EyeSlash, Drop, Check, NavigationArrow } from "@phosphor-icons/react";
import { api } from "../api";
import { visibilityMode } from "../map-visibility";
import "./MapVisibility.css";

export default forwardRef(function MapVisibility({ me, onSaved, onDismiss, onAuth }, ref) {
  const current = visibilityMode(me), [choice, setChoice] = useState(current);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const active = useRef(true), busyRef = useRef(false), content = useRef();
  useEffect(() => {
    content.current?.querySelector("input:checked")?.focus();
    return () => { active.current = false; };
  }, []);
  const dismiss = () => { if (!busyRef.current) onDismiss(); };
  useImperativeHandle(ref, () => ({ dismiss }));
  async function save() {
    if (busyRef.current) return;
    if (choice === "profile" && !me.registered) { onAuth(); return; }
    busyRef.current = true; setBusy(true); setError("");
    try {
      let point;
      if (choice !== "hidden" && choice !== current) {
        if (!navigator.geolocation) throw new Error("مکان‌یابی روی این مرورگر در دسترس نیست؛ می‌تونی پنهان بمونی.");
        point = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(
          ({ coords }) => resolve({ lat: coords.latitude, lng: coords.longitude }),
          () => reject(new Error("مکانت پیدا نشد یا اجازه ندادی. انتخاب قبلی‌ت تغییری نکرده.")),
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
        ));
      }
      if (!active.current) return;
      const result = await api("map-visibility", { mode: choice, ...point });
      if (active.current) onSaved(result.mode, point);
    } catch (failure) { if (active.current) setError(failure.message); }
    finally { busyRef.current = false; if (active.current) setBusy(false); }
  }
  return <div ref={content} className="visibility-editor" dir="rtl">
    <img src="/assets/shy-drop.webp" width="68" height="78" alt="" />
    <h2 id="visibility-title">خودت انتخاب کن چطور دیده بشی</h2>
    <p className="visibility-intro">دیدن نقشه، مکانت رو منتشر نمی‌کنه.</p>
    <fieldset disabled={busy}>
      <legend className="sr-only">نمایش من روی نقشه</legend>
      {[
        ["hidden", "پنهان", "روی نقشه دیده نمی‌شی؛ هنوز می‌تونی اطرافت رو ببینی.", EyeSlash],
        ["news", "بی‌نام برای دیگران", "ثبتت با مکان تقریبی دیده می‌شه؛ دوست‌هات می‌تونن بشناسنت.", Drop],
        ["profile", "با پروفایلم", "آدم‌های نزدیک پروفایلت رو می‌بینن؛ نقشهٔ همه‌جا همچنان بی‌نامه.", Eye],
      ].map(([value, label, detail, Icon]) => <label className={`visibility-choice ${choice === value ? "is-selected" : ""}`} key={value}>
        <input type="radio" name="map-visibility" value={value} checked={choice === value} onChange={() => setChoice(value)} />
        <Icon size={25} aria-hidden="true" />
        <span><strong>{label}</strong><small>{detail}</small></span>
        {choice === value && <Check className="visibility-check" size={18} aria-hidden="true" />}
      </label>)}
    </fieldset>
    <p className="visibility-settings-note">هر وقت خواستی از «من ← تنظیمات ← نمایش روی نقشه» عوضش کن.</p>
    {choice !== "hidden" && choice !== current && <p className="visibility-location-note"><NavigationArrow size={17} /> برای این انتخاب، اجازهٔ مکان ازت می‌گیریم؛ جای دقیق کسی نمایش داده نمی‌شه.</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <button type="button" className="button button-primary" disabled={busy} onClick={save}>{busy ? "داریم انتخابت رو آماده می‌کنیم…" : choice === "profile" && !me.registered ? "ورود برای نمایش پروفایل" : "ذخیرهٔ انتخاب"}</button>
    <button type="button" className="visibility-keep" disabled={busy} onClick={dismiss}>فعلاً همین‌طور بمونه</button>
  </div>;
});
