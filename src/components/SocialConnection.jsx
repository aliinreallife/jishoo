import React, { useId, useState } from "react";
import { socialProfile, socialFieldError } from "../../lib/social-links";
import { LinkSimple, Check, CheckCircle, X, InstagramLogo, TelegramLogo, XLogo, SpotifyLogo, ArrowSquareOut } from "@phosphor-icons/react";
import "./SocialConnection.css";

const platforms = {
  instagram: [InstagramLogo, "اینستاگرام"],
  telegram: [TelegramLogo, "تلگرام"],
  x: [XLogo, "ایکس"],
  spotify: [SpotifyLogo, "اسپاتیفای"],
  website: [LinkSimple, "سایت"],
};

export function SocialAccountFields({ value, onChange, autoFocus = false }) {
  const prefix = useId(), [focused, setFocused] = useState(null);
  return [
    ["instagram", "اینستاگرام", "@username"],
    ["telegram", "تلگرام", "@username"],
    ["x", "ایکس", "@username"],
    ["spotify", "اسپاتیفای", "open.spotify.com/user/..."],
    ["website", "وب‌سایت", "example.com"],
  ].map(([key, label, placeholder], index) => {
    const input = value[key] || "", error = socialFieldError(key, input);
    const profile = !error && input.trim() ? socialProfile(key, input) : null;
    const url = profile?.url;
    const compact = profile && key !== "website" && (key !== "spotify" || url.includes("/user/")) ? `@${profile.handle}` : url || input;
    const [Icon] = platforms[key];
    return (
    <label className={`social-field social-field-${key} ${error ? "has-error" : ""}`} key={key}>
      <span className="social-field-mark" aria-hidden="true"><Icon size={23} weight="duotone" /></span>
      <span className="social-field-content">
      <span className="social-field-name">{label}</span>
      <input
        value={focused === key ? input : compact}
        aria-label={label}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${prefix}-${key}-error` : undefined}
        ref={node => node?.setCustomValidity(error)}
        onFocus={() => {
          setFocused(key);
          if (!error && compact !== input) onChange(current => ({ ...current, [key]: compact }));
        }}
        onChange={event => onChange(current => ({ ...current, [key]: event.target.value }))}
        onBlur={() => { setFocused(null); if (url && url !== input) onChange(current => ({ ...current, [key]: url })); }}
        placeholder={placeholder}
        dir="ltr"
        maxLength={300}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        inputMode={key === "website" ? "url" : "text"}
        autoFocus={autoFocus && index === 0}
      />
      {error && <small id={`${prefix}-${key}-error`} className="social-field-error">{error}</small>}
      </span>
      {url && <CheckCircle className="social-field-valid" size={19} weight="fill" aria-label="قالب معتبر" />}
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
