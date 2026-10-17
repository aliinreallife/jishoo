import React, { useEffect, useState } from "react";
import { api, relativeTime } from "../api";
import { ChatCircleText, CheckCircle } from "@phosphor-icons/react";
export default function AdminSupport({ notify }) {
  const [requests, setRequests] = useState([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const load = () =>
    api("admin-support")
      .then((r) => setRequests(r.requests))
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  return (
    <section className="admin-support">
      <h2 className="admin-section-title">
        <ChatCircleText size={22} />
        پیام‌های پشتیبانی
      </h2>
      {error && <p className="form-error">{error}</p>}
      {!requests.length ? (
        <p className="soft-note">پیامی برای پیگیری نیست.</p>
      ) : (
        requests.map((r) => (
          <article key={r.id} className={r.resolved ? "resolved" : ""}>
            <header>
              <strong>{r.name || "مهمان"}</strong>
              <small>{relativeTime(r.created_at)}</small>
            </header>
            <p>{r.message}</p>
            {r.contact && <div dir="auto">راه تماس: {r.contact}</div>}
            <small dir="ltr">#{r.id.slice(0, 8)}</small>
            <button
              className="button button-secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api("admin-support-resolve", {
                    id: r.id,
                    resolved: !r.resolved,
                  });
                  await load();
                } catch (e) {
                  notify(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <CheckCircle size={18} />
              {r.resolved ? "بازکردن دوباره" : "رسیدگی شد"}
            </button>
            <button
              className="danger-text"
              disabled={busy}
              onClick={async () => {
                if (!confirm("این پیام برای همیشه حذف بشه؟")) return;
                setBusy(true);
                try {
                  await api("admin-support-delete", { id: r.id });
                  await load();
                } catch (e) {
                  notify(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              حذف پیام
            </button>
          </article>
        ))
      )}
    </section>
  );
}
