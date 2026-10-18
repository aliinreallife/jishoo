import React, { useId } from "react";
import { socialProfile, socialFieldError } from "../../lib/social-links";
import { LinkSimple, Check, X, InstagramLogo, TelegramLogo, XLogo, ArrowSquareOut } from "@phosphor-icons/react";
import "./SocialConnection.css";

const platforms = {
  instagram: [InstagramLogo, "اینستاگرام"],
  telegram: [TelegramLogo, "تلگرام"],
  x: [XLogo, "ایکس"],
  website: [LinkSimple, "سایت"],
};

export function SocialAccountFields({ value, onChange, autoFocus = false }) {
  const prefix = useId();
  return [
    ["instagram", "اینستاگرام", "@username"],
    ["telegram", "تلگرام", "@username"],
    ["x", "ایکس", "@username"],
    ["website", "وب‌سایت", "https://..."],
  ].map(([key, label, placeholder], index) => {
    const input = value[key] || "", error = socialFieldError(key, input);
    const url = !error && input.trim() ? socialProfile(key, input).url : "";
    return (
    <label className="field-label social-field" key={key}>
      {label}
      <input
        value={input}
        aria-label={label}
        aria-invalid={Boolean(error)}
        aria-describedby={`${prefix}-${key}-help`}
        ref={node => node?.setCustomValidity(error)}
        onChange={event => onChange(current => ({ ...current, [key]: event.target.value }))}
        onBlur={() => { if (url && url !== input) onChange(current => ({ ...current, [key]: url })); }}
        placeholder={placeholder}
        dir="ltr"
        maxLength={300}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        inputMode={key === "website" ? "url" : "text"}
        autoFocus={autoFocus && index === 0}
      />
      <small id={`${prefix}-${key}-help`} className={error ? "social-field-error" : "social-field-help"}>
        {error || (url ? <><span>لینک پروفایل:</span> <span dir="ltr">{url}</span></> : key === "website" ? "آدرس وب‌سایتت؛ با https یا بدون اون." : "شناسه با @ یا بدون اون، یا لینک پروفایلت.")}
      </small>
    </label>
  ); });
}

export default function SocialConnection({ friend, premium, busy, onChange }) {
  const state = friend.linkConnection || "none";
  const action = (operation) => onChange(friend, operation);
  return (
    <section className={`social-connection social-${state}`} aria-label="اشتراک حساب‌های اجتماعی">
      <header><LinkSimple size={23} /><h3>حساب‌های اجتماعی، با اجازهٔ هر دوتون</h3></header>
      {state === "none" && <>
        <p>برای {friend.name} درخواست بفرست. با قبول‌کردن، لینک‌های اجتماعی‌تون برای هم باز می‌شه. تا اون موقع چیزی به اشتراک گذاشته نمی‌شه.</p>
        <button className="button button-lilac" disabled={busy || !premium} onClick={() => action("request")}>درخواست دیدن حساب‌ها</button>
      </>}
      {state === "outgoing" && <>
        <strong>درخواستت برای {friend.name} فرستاده شد</strong>
        <p>بعد از قبول‌کردنِ دوستت، حساب‌های اجتماعی‌تون برای هم قابل دیدن می‌شه.</p>
        <button className="button button-secondary" disabled={busy} onClick={() => action("cancel")}>لغو درخواست</button>
      </>}
      {state === "incoming" && <>
        <strong>{friend.name} درخواست دیدن حساب‌ها رو فرستاده</strong>
        <p>با قبول‌کردن، لینک‌های اجتماعی‌تون برای هم باز می‌شه. می‌تونی بعداً اشتراک رو قطع کنی و همچنان دوست بمونی.</p>
        <div className="social-consent-actions">
          <button className="button button-lilac" disabled={busy || !premium} onClick={() => action("accept")}><Check size={18} />قبول درخواست</button>
          <button className="button button-secondary" disabled={busy} onClick={() => action("decline")}><X size={18} />فعلاً نه</button>
        </div>
      </>}
      {state === "connected" && <>
        <strong>حساب‌های اجتماعی‌تون برای هم قابل دیدنه</strong>
        <p>هر وقت خواستی می‌تونی فقط اشتراک حساب‌ها رو قطع کنی؛ همچنان دوست می‌مونین و از حال‌و‌احوال هم دور نمی‌مونین.</p>
        <div className="friend-socials">
          {Object.entries(friend.socialLinks).length ? Object.entries(friend.socialLinks).map(([type, url]) => {
            const [Icon, label] = platforms[type] || platforms.website;
            return <a key={type} href={url} target="_blank" rel="noreferrer noopener"><Icon size={23} /><span>{label}</span><ArrowSquareOut size={18} /></a>;
          }) : <p>{premium ? `${friend.name} هنوز حسابی به پروفایلش اضافه نکرده.` : "برای دیدن حساب‌ها، پرمیوم لازمه."}</p>}
        </div>
        <button className="button button-secondary" disabled={busy} onClick={() => action("disconnect")}>قطع اشتراک حساب‌ها</button>
      </>}
    </section>
  );
}
