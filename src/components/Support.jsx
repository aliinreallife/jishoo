import React, { useState } from "react";
import { ArrowRight, PaperPlaneTilt, CheckCircle } from "@phosphor-icons/react";
import { Mascot } from "./Mascot";
import { api } from "../api";
import "./Support.css";
export default function Support() {
  const [message, setMessage] = useState(""),
    [contact, setContact] = useState(""),
    [busy, setBusy] = useState(false),
    [reference, setReference] = useState(""),
    [error, setError] = useState("");
  return (
    <main className="support-page" dir="rtl">
      <a href="/" className="support-back">
        <ArrowRight size={22} />
        برگشت به جیشو
      </a>
      <Mascot size={145} />
      <h1>اینجاییم که بشنویم</h1>
      <p>
        اشکالی دیدی، پیشنهادی داری یا دربارهٔ حسابت کمکی می‌خوای؟ پیامت خصوصی
        برای مدیریت جیشو می‌ره.
      </p>
      {reference ? (
        <div className="support-sent" role="status">
          <CheckCircle size={32} />
          <h2>پیامت رسید 💛</h2>
          <p>
            کد پیگیری: <span dir="ltr">{reference}</span>
          </p>
          <p>اگر راه تماس گذاشتی، می‌تونیم پیگیری کنیم.</p>
        </div>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const r = await api("support-send", { message, contact });
              setReference(r.reference);
            } catch (e) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            پیامت
            <textarea
              required
              minLength={10}
              maxLength={3000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              placeholder="چی شده؟ برامون بنویس…"
            />
          </label>
          <label>
            راه تماس برای پاسخ (اختیاری)
            <input
              type="text"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              maxLength={254}
              placeholder="مثلاً ایمیل یا شناسهٔ تلگرام"
            />
          </label>
          <small>رمز، کد ورود یا لینک خصوصی مدیریت رو نفرست.</small>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="button button-lilac"
            disabled={busy || message.trim().length < 10}
          >
            <PaperPlaneTilt size={20} />
            {busy ? "در حال فرستادن…" : "فرستادن پیام"}
          </button>
        </form>
      )}
      <footer>
        <a href="/privacy">حریم خصوصی</a>
        <a href="/terms">شرایط استفاده</a>
      </footer>
    </main>
  );
}
