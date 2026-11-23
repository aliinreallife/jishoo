import React from "react";
import { Heart, CaretLeft } from "@phosphor-icons/react";
import { Mascot, PairArt } from "./Mascot";
import Button from "./Button";
import { fa } from "../api";

// Only download this page for users who open a special promotion link.
export default function PromoLanding({ offer, error, registered, testing, redeeming, onAuth, onRetry, onDismiss }) {
  return (
    <section className="invite-landing promo-landing" aria-label="هدیهٔ ویژهٔ جیشو">
      <div className="brand brand-small"><span>جیشو</span><Heart weight="fill" className="brand-heart" /></div>
      <Mascot size={135} mood="happy" />
      <span className="little-pill">هدیهٔ ویژهٔ جیشو 💛</span>
      <h1>۳۰ روز پرمیوم، هدیهٔ تو!</h1>
      <PairArt size={210} />
      <p>با این لینک می‌تونی ۳۰ روز پرمیوم جیشو بگیری. این هدیه فقط برای ۹۲ حساب مختلفه و برای هر نفر یک‌بار فعال می‌شه.</p>
      {offer && <p className="invite-landing-gift">
        {fa(offer.remaining)} جای باقی‌مونده از {fa(offer.maxUses)} نفر
      </p>}
      {testing && <p className="auth-demo-note">
        پرمیوم در دورهٔ آزمایشی رایگانه؛ روزهای هدیه‌ات برای بعدش محفوظ می‌مونه.
      </p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {registered ? (
        redeeming ? <p>داریم هدیه‌ات رو فعال می‌کنیم…</p>
        : error ? <Button lilac onClick={onRetry}>تلاش دوباره برای فعال‌سازی</Button>
        : <p>در حال بررسی هدیهٔ حسابت…</p>
      ) : (
        <Button lilac disabled={Boolean(offer && offer.remaining === 0)} onClick={onAuth}>
          ورود یا عضویت و گرفتن هدیه <Heart size={19} />
        </Button>
      )}
      <button className="guest-enter-link" onClick={onDismiss}>
        فعلاً برم تو جیشو <CaretLeft size={16} />
      </button>
    </section>
  );
}
