import React, { useEffect, useRef, useState } from "react";
import { Heart, CaretLeft } from "@phosphor-icons/react";
import "./PromoLanding.css";
import Button from "./Button";
import { api, fa } from "../api";
import { normalizePromoCode } from "../promo-link";

// Loaded only when somebody opens /join?promo=CODE. The code survives Google
// OAuth and a newly created account, and one account can redeem it just once.
export default function PromoLanding({ code, registered, userId, onAuth, onDone, onDismiss }) {
  const pending = useRef(normalizePromoCode(code) || sessionStorage.getItem("jishoo:promo") || "");
  const attempted = useRef("");
  const [offer, setOffer] = useState(null);
  const [error, setError] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!code) return;
    const valid = normalizePromoCode(code);
    if (!valid) {
      pending.current = "";
      sessionStorage.removeItem("jishoo:promo");
      setError("این لینک معتبر نیست.");
      return;
    }
    pending.current = valid;
    sessionStorage.setItem("jishoo:promo", valid);
    setError("");
    setOffer(null);
    let active = true;
    api("promo-info", undefined, { code: valid })
      .then(result => { if (active) setOffer(result); })
      .catch(() => { if (active) setError("این لینک در دسترس نیست."); });
    return () => { active = false; };
  }, [code]);
  useEffect(() => {
    if (!registered || !pending.current) return;
    const promoCode = pending.current;
    const key = userId + ":" + promoCode;
    if (attempted.current === key) return;
    attempted.current = key;
    setRedeeming(true);
    api("promo-redeem", { code: promoCode })
      .then(result => {
        pending.current = "";
        sessionStorage.removeItem("jishoo:promo");
        onDone(result.banked
          ? "دسترسی ۳۰ روزه‌ات ثبت شد و بعد از دورهٔ آزمایشی شروع می‌شه."
          : "دسترسی ۳۰ روزه‌ات فعال شد.");
      })
      .catch(e => {
        if (e.code === "promo_already_redeemed") {
          pending.current = "";
          sessionStorage.removeItem("jishoo:promo");
          onDone("دسترسی برای همین حساب قبلاً ثبت شده.");
        } else setError("فعلاً دسترسی فعال نشد. دوباره امتحان کن.");
      })
      .finally(() => setRedeeming(false));
  }, [registered, userId, retry]);
  return (
    <section className="invite-landing promo-landing" aria-labelledby="promo-welcome-title">
      <div className="brand brand-small"><span>جیشو</span><Heart weight="fill" className="brand-heart" /></div>
      <img className="promo-welcome-art" src={`${import.meta.env.BASE_URL}assets/promo-welcome.webp`} width={560} height={560} alt="" />
      <h1 id="promo-welcome-title">به جیشو خوش اومدی</h1>
      {!registered && <p>با گوگل وارد شو یا حسابت رو بساز.</p>}
      {offer && !registered && (
        <p className="promo-availability">
          {offer.remaining ? `${fa(offer.remaining)} جای باقی‌مونده` : "ظرفیت این لینک پر شده."}
        </p>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      {registered ? (
        redeeming ? <p>داریم دسترسی‌ات رو فعال می‌کنیم…</p>
        : error && pending.current ? <Button lilac onClick={() => { attempted.current = ""; setError(""); setRetry(i => i + 1); }}>تلاش دوباره برای فعال‌سازی</Button>
        : <p>{error ? "این لینک قابل استفاده نیست." : "در حال بررسی دسترسی حسابت…"}</p>
      ) : (
        <Button lilac disabled={Boolean(offer && offer.remaining === 0)} onClick={onAuth}>
          ورود یا ساخت حساب <Heart size={19} />
        </Button>
      )}
      <button className="guest-enter-link" onClick={() => {
        pending.current = "";
        sessionStorage.removeItem("jishoo:promo");
        onDismiss();
      }}>فعلاً برم تو جیشو <CaretLeft size={16} /></button>
    </section>
  );
}
