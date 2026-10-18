import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Eye, EyeSlash, Drop, Check, NavigationArrow } from "@phosphor-icons/react";
import { api } from "../api";
import { visibilityMode } from "../map-visibility";
import "./MapVisibility.css";

export default forwardRef(function MapVisibility({ me, onSaved, onDismiss, onAuth }, ref) {
  const current = visibilityMode(me), [choice, setChoice] = useState(current);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [step, setStep] = useState("choice");
  const active = useRef(true), busyRef = useRef(false), content = useRef();
  useEffect(() => {
    content.current?.querySelector("input:checked")?.focus();
    return () => { active.current = false; };
  }, []);
  const dismiss = () => { if (!busyRef.current) onDismiss(); };
  useEffect(() => {
    if (step === "location") content.current?.querySelector("h2")?.focus();
    else content.current?.querySelector("input:checked")?.focus();
  }, [step]);
  useImperativeHandle(ref, () => ({ dismiss }));
  async function save(confirmedLocation = false) {
    if (busyRef.current) return;
    if (choice === "profile" && !me.registered) { onAuth(); return; }
    busyRef.current = true; setBusy(true); setError("");
    try {
      let point;
      if (choice !== "hidden") {
        if (!confirmedLocation) {
          let permission = "prompt";
          try { permission = (await navigator.permissions?.query({ name: "geolocation" }))?.state || "prompt"; } catch { /* Show explanation when permission state is unavailable. */ }
          if (!active.current) return;
          if (permission !== "granted") { setStep("location"); return; }
        }
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
  if (step === "location") return <div ref={content} className="visibility-editor visibility-permission" dir="rtl">
    <img src="/assets/shy-drop.webp" width="75" height="88" alt="" />
    <h2 id="visibility-title" tabIndex={-1}>برای این انتخاب، اجازهٔ مکان لازمه</h2>
    <p>انتخابت «{visibilityLabelForChoice(choice)}» بود. برای نمایش روی نقشه، باید مکانت رو با اجازهٔ مرورگر پیدا کنیم.</p>
    <ul><li>فقط مکان تقریبی دیده می‌شه.</li><li>ردیابی دائمی یا پس‌زمینه نداریم.</li><li>تا اجازه ندی، انتخاب قبلی‌ت عوض نمی‌شه.</li></ul>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="button button-primary" disabled={busy} onClick={() => save(true)}>{busy ? "داریم مکانت رو پیدا می‌کنیم…" : "اجازهٔ مکان و ذخیرهٔ انتخاب"}</button>
    <button className="visibility-keep" disabled={busy} onClick={() => { setError(""); setStep("choice"); }}>برگشت به انتخاب نمایش</button>
    <button className="visibility-keep" disabled={busy} onClick={dismiss}>فعلاً انتخاب قبلی بمونه</button>
  </div>;
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
    <button type="button" className="button button-primary" disabled={busy} onClick={() => save()}>{busy ? "داریم انتخابت رو آماده می‌کنیم…" : choice === "profile" && !me.registered ? "ورود برای نمایش پروفایل" : "ذخیرهٔ انتخاب"}</button>
    <button type="button" className="visibility-keep" disabled={busy} onClick={dismiss}>فعلاً همین‌طور بمونه</button>
  </div>;
});

function visibilityLabelForChoice(choice) { return choice === "profile" ? "با پروفایلم" : "بی‌نام برای دیگران"; }
