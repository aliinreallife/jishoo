import React, { useState, useEffect } from "react";
import {
  GoogleLogo,
  LinkSimple,
  Phone,
  CheckCircle,
  CaretLeft,
} from "@phosphor-icons/react";
import { api } from "../api";
import "./GoogleAccount.css";
export function GoogleBanner({ auth, intent = "login", notify }) {
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
              ? "یه راه دیگه برای ورود"
              : "با گوگل، یه قدم راحت‌تر"}
          </strong>
          <small>
            {intent === "link"
              ? "گوگلت رو به همین حساب وصل کن."
              : "با دعوت عضو شو یا به حسابت برگرد؛ شماره می‌تونه بعداً وصل بشه."}
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
    [busy, setBusy] = useState(false);
  const auth = data.auth || {};
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
        شماره و گوگل وقتی وصل باشن، هر دو به همین دوست‌ها، آمار و پروفایل
        می‌رسن. حساب‌های جدا خودکار ادغام نمی‌شن.
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
      {!auth.phoneConnected && (
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
          <button
            type="button"
            className="text-link"
            disabled={busy || !auth.phoneConnected}
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
          </button>
        </div>
      ) : (
        <GoogleBanner auth={auth} intent="link" notify={notify} />
      )}
    </section>
  );
}
