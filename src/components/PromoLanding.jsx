import React, { useEffect, useRef, useState } from "react";
import { Heart, CaretLeft } from "@phosphor-icons/react";
import { Mascot, PairArt } from "./Mascot";
import Button from "./Button";
import { api, fa } from "../api";
import { normalizePromoCode } from "../promo-link";

// Loaded only when somebody opens /join?promo=CODE. The code survives Google
// OAuth and a newly created account, and one account can redeem it just once.
export default function PromoLanding({ code, registered, userId, testing, onAuth, onDone, onDismiss }) {
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
      setError("لینک هدیه معتبر نیست.");
      return;
    }
    pending.current = valid;
    sessionStorage.setItem("jishoo:promo", valid);
    setError("");
    setOffer(null);
    let active = true;
    api("promo-info", undefined, { code: valid })
      .then(result => { if (active) setOffer(result); })
      .catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [code]);
  useEffect(() => {
    if (!registered || !pending.current) return;
    const giftCode = pending.current;
    const key = userId + ":" + giftCode;
    if (attempted.current === key) return;
    attempted.current = key;
    setRedeeming(true);
    api("promo-redeem", { code: giftCode })
      .then(gift => {
        pending.current = "";
        sessionStorage.removeItem("jishoo:promo");
        onDone(gift, false);
      })
      .catch(e => {
        if (e.code === "promo_already_redeemed") {
          pending.current = "";
          sessionStorage.removeItem("jishoo:promo");
          onDone(null, true);
        } else setError(e.message);
      })
      .finally(() => setRedeeming(false));
  }, [registered, userId, retry]);
  return (
    <section className="invite-landing promo-landing" aria-label="هدیهٔ ویژهٔ جیشو">
      <div className="brand brand-small"><span>جیشو</span><Heart weight="fill" className="brand-heart" /></div>
      <Mascot size={135} mood="happy" />
      <span className="little-pill">هدیهٔ ویژهٔ جیشو 💛</span>
      <h1>۳۰ روز پرمیوم، هدیهٔ تو!</h1>
      <PairArt size={210} />
      <p>با این لینک می‌تونی ۳۰ روز پرمیوم جیشو بگیری. این هدیه فقط برای ۹۲ حساب مختلفه و برای هر نفر یک‌بار فعال می‌شه.</p>
      {offer && <p className="invite-landing-gift">{fa(offer.remaining)} جای باقی‌مونده از {fa(offer.maxUses)} نفر</p>}
      {testing && <p className="auth-demo-note">پرمیوم در دورهٔ آزمایشی رایگانه؛ روزهای هدیه‌ات برای بعدش محفوظ می‌مونه.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {registered ? (
        redeeming ? <p>داریم هدیه‌ات رو فعال می‌کنیم…</p>
        : error && pending.current ? <Button lilac onClick={() => { attempted.current = ""; setError(""); setRetry(i => i + 1); }}>تلاش دوباره برای فعال‌سازی</Button>
        : <p>{error ? "این لینک قابل استفاده نیست." : "در حال بررسی هدیهٔ حسابت…"}</p>
      ) : (
        <Button lilac disabled={Boolean(offer && offer.remaining === 0)} onClick={onAuth}>
          ورود یا عضویت و گرفتن هدیه <Heart size={19} />
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
