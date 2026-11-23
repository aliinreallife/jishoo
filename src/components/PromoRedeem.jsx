import React, { useState } from "react";
import { api } from "../api";

// The promotion belongs to an authenticated account, never to a browser session.
// The server checks eligibility, enforces capacity, and applies the entitlement.
export default function PromoRedeem({ registered, testing, onRedeemed, notify }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!registered) return <p className="auth-demo-note">برای استفاده از کد هدیه، اول عضو جیشو شو.</p>;
  async function redeem(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const gift = await api("promo-redeem", { code: code.trim().toUpperCase() });
      setCode("");
      await onRedeemed();
      notify(gift.banked
        ? "۳۰ روز پرمیوم به هدیه‌های محفوظت اضافه شد 💛"
        : "۳۰ روز پرمیوم برای حسابت فعال شد 💛");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={redeem} className="premium-promo-form">
      <label className="field-label" htmlFor="jishoo-promo-code">کد هدیهٔ پرمیوم</label>
      <input
        id="jishoo-promo-code"
        aria-label="کد هدیهٔ پرمیوم"
        dir="ltr"
        autoCapitalize="characters"
        autoComplete="off"
        maxLength={40}
        value={code}
        disabled={busy}
        onChange={event => setCode(event.target.value.toUpperCase())}
        placeholder="J-XXXXXXXXXXXX"
        required
      />
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button button-lilac" type="submit" disabled={busy || !code.trim()}>
        {busy ? "در حال فعال‌سازی…" : "فعال‌کردن هدیه"}
      </button>
      {testing && <p className="auth-demo-note">روزهای هدیه تا پایان دورهٔ آزمایشی ذخیره می‌مونن.</p>}
    </form>
  );
}
