import React, { useState, useEffect } from "react";
import {
  GoogleLogo,
  LinkSimple,
  Phone,
  CheckCircle,
  CaretLeft,
} from "@phosphor-icons/react";
import { api, fa } from "../api";
import "./GoogleAccount.css";
export function GoogleBanner({ auth, intent = "login", inviteCode, notify }) {
  const [busy, setBusy] = useState(false);
  if (!auth?.googleEnabled) return null;
  return (
    <div className="google-banner">
      <div className="google-banner-copy">
        <span className="google-mark">
          <img src="/assets/google-g.svg" width="25" height="25" alt="" />
        </span>
        <div>
          <strong>
            {intent === "link"
              ? "گوگل رو به همین حسابت وصل کن"
              : intent === "signup" ? "با گوگل عضو جیشو شو" : "به حسابت برگرد"}
          </strong>
          <small>
            {intent === "link"
              ? "بعدش از دستگاه‌های دیگه هم می‌تونی وارد همین پروفایل بشی."
              : intent === "signup" ? "حساب گوگلت رو انتخاب کن؛ بعد اسمت رو می‌پرسیم." : "همون حساب گوگلی رو انتخاب کن که قبلاً وصل کردی."}
          </small>
        </div>
      </div>
      <button
        type="button"
        className="google-auth-button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await api("google-start", {
              intent,
              inviteCode,
              returnTo: location.pathname + location.search + location.hash,
            });
            location.assign(r.url);
          } catch (e) {
            notify(e.message);
            setBusy(false);
          }
        }}
      >
        <img src="/assets/google-g.svg" width="20" height="20" alt="" />
        {busy
          ? "در حال رفتن به گوگل…"
          : intent === "link"
            ? "اتصال حساب Google"
            : "ادامه با Google"}
        <CaretLeft size={16} />
      </button>
    </div>
  );
}
export default function AccountConnections({ data, onUpdate, notify }) {
  const [phone, setPhone] = useState(""),
    [challenge, setChallenge] = useState(null),
    [code, setCode] = useState(""),
    [mergeReview, setMergeReview] = useState(false),
    [busy, setBusy] = useState(false);
  const auth = data.auth || {};
  const merge = auth.pendingMerge;
  useEffect(() => {
    if (!challenge?.demo) return;
    const timer = setTimeout(() => verify("123456"), 1500);
    return () => clearTimeout(timer);
  }, [challenge?.challengeId]);
  async function verify(value) {
    setBusy(true);
    try {
      onUpdate(
        await api("phone-link-verify", {
          challengeId: challenge.challengeId,
          code: value,
        }),
      );
      setChallenge(null);
      setPhone("");
      notify("شماره به همین حسابت وصل شد.");
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="account-connections">
      <h3>راه‌های ورود به حسابت</h3>
      <p>
        گوگلت رو به همین پروفایل وصل کن تا دوست‌ها و آمار این حساب رو از دستگاه‌های دیگه هم داشته باشی.
      </p>
      <div className="account-method">
        <Phone size={23} />
        <div>
          <strong>
            {auth.phoneConnected
              ? "شمارهٔ موبایل وصله"
              : "شمارهٔ موبایل وصل نیست"}
          </strong>
          {auth.phoneConnected && (
            <>
              <span className="account-phone-number" dir="ltr" aria-label="شماره موبایل من">
                {auth.phoneNumber || auth.phoneMasked}
              </span>
              <small>این شماره فقط برای خودت نمایش داده می‌شه.</small>
            </>
          )}
        </div>
        {auth.phoneConnected && <CheckCircle size={21} />}
      </div>
      {!auth.phoneLoginEnabled && <p className="phone-paused-note">ورود و اتصال شماره فعلاً غیرفعاله. شمارهٔ ذخیره‌شده‌ت حفظ می‌شه؛ برای ورود بعدی از گوگل استفاده کن.</p>}
      {merge && <section className="account-merge-card" aria-label="اتصال دو حساب من">
        <h4>دو حساب داری؛ می‌خوای یکی‌شون کنیم؟</h4>
        <p>این گوگل از قبل یه پروفایل جدا داره. بدون تاییدت، چیزی جابه‌جا نمی‌شه.</p>
        <div className="merge-profile"><strong>پروفایلی که نگه می‌داری</strong><span>{merge.current.name}</span><span dir="ltr">@{merge.current.handle}</span></div>
        <div className="merge-profile"><strong>حساب گوگلت</strong><span>{merge.other.name}</span><span dir="ltr">{merge.other.email}</span><small>{fa(merge.checkins)} ثبت · {fa(merge.friends)} دوست · {fa(merge.groups)} گروه</small></div>
        {mergeReview ? <>
          <ul>
            <li>آمار، دوست‌ها و گروه‌های دو حسابت جمع می‌شن. اسم و شناسهٔ پروفایل فعلی می‌مونه؛ لینک پروفایل قبلی هم به همین‌جا می‌رسه.</li>
            <li>بهترین اشتراکت حفظ می‌شه؛ روزهای آزمایشی و سهمیهٔ دعوت دو برابر نمی‌شن. برای دعوت بعدی از لینک همین پروفایل استفاده کن.</li>
            <li>نمایش روی نقشه خاموش می‌شه. اشتراک حساب‌های اجتماعی دوباره به قبول هر دو نفر نیاز داره.</li>
            <li>دستگاه‌های دیگه باید دوباره با گوگل وارد بشن. این اتصال قابل برگشت خودکار نیست.</li>
          </ul>
          <button className="button button-lilac" disabled={busy} onClick={async () => {
            setBusy(true);
            try {
              onUpdate(await api("account-merge-confirm", { confirmed: true }));
              setMergeReview(false);
              notify("دو حسابت یکی شدن؛ گوگلت حالا به همین پروفایل وصله.");
            } catch (e) { notify(e.message); }
            finally { setBusy(false); }
          }}>{busy ? "در حال اتصال…" : "بله، دو حسابم رو یکی کن"}</button>
        </> : <button className="button button-lilac" onClick={() => setMergeReview(true)}>مرور اتصال دو حساب</button>}
        <button className="text-link" disabled={busy} onClick={async () => {
          setBusy(true);
          try { onUpdate(await api("account-merge-cancel", {})); setMergeReview(false); }
          catch (e) { notify(e.message); }
          finally { setBusy(false); }
        }}>فعلاً جدا بمونن</button>
      </section>}
      {!auth.phoneConnected && auth.phoneLoginEnabled && (
        <form
          className="phone-link-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const r = await api("phone-link-start", { phone });
              setChallenge(r);
              setCode("");
            } catch (e) {
              notify(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            شماره موبایل
            <input
              type="tel"
              autoComplete="tel"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </label>
          {challenge ? (
            <>
              <label>
                کد اتصال
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  maxLength={6}
                  inputMode="numeric"
                  dir="ltr"
                />
              </label>
              <button
                type="button"
                className="button button-lilac"
                disabled={busy || code.length !== 6}
                onClick={() => verify(code)}
              >
                تایید و اتصال شماره
              </button>
              <small>
                تایید شماره فعلاً دمو است و خودکار انجام می‌شه؛ پیامک ارسال
                نمی‌شه.
              </small>
            </>
          ) : (
            <button className="button button-lilac" disabled={busy}>
              اتصال شماره به حساب
            </button>
          )}
        </form>
      )}
      {auth.googleConnected ? (
        <div className="connected-google">
          <div className="account-method">
            <GoogleLogo size={25} />
            <div>
              <strong>گوگل به همین حساب وصله</strong>
              <span dir="ltr">{auth.googleEmail}</span>
            </div>
            <CheckCircle size={21} />
          </div>
          {auth.phoneLoginEnabled ? <button
            type="button"
            className="text-link"
            disabled={busy || !auth.phoneConnected || !auth.phoneLoginEnabled}
            onClick={async () => {
              setBusy(true);
              try {
                await api("google-disconnect", {});
                onUpdate(await api("bootstrap"));
                notify("اتصال گوگل برداشته شد.");
              } catch (e) {
                notify(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            قطع اتصال گوگل
          </button> : <small className="phone-paused-note">گوگل تنها راه ورود فعالته؛ اتصالش رو نگه می‌داریم تا از حسابت بیرون نمونی.</small>}
        </div>
      ) : (
        !merge && <GoogleBanner auth={auth} intent="link" notify={notify} />
      )}
    </section>
  );
}
