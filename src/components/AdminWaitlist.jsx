import React, { useState } from "react";
import { api, fa, relativeTime } from "../api";
import "./AdminWaitlist.css";

export default function AdminWaitlist() {
  const [open, setOpen] = useState(false), [result, setResult] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function load(offset = 0) {
    setBusy(true); setError("");
    try { setResult(await api("admin-waitlist", undefined, { offset })); }
    catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  return <section className="admin-waitlist">
    <button className="button button-secondary" aria-expanded={open} onClick={() => { setOpen(!open); if (!open) load(); }}>فهرست انتظار دعوت</button>
    {open && <><p>ایمیل‌ها با گوگل تایید شدن؛ شماره‌ها فقط برای تماس هستن و تایید نشده‌ن. ارسال خودکار ایمیل یا پیامک هنوز متصل نیست.</p>
      {busy && <p role="status">داریم فهرست رو می‌گیریم…</p>}{error && <p role="alert">{error}</p>}
      {result && <><strong>{fa(result.total)} نفر منتظر دعوت</strong><ul>{result.people.map(person => <li key={person.email}><span dir="ltr">{person.email}</span>{person.phone && <span dir="ltr">{person.phone}</span>}<small>{relativeTime(person.createdAt)}</small></li>)}</ul>
        <div className="admin-waitlist-pages"><button disabled={busy || result.offset === 0} onClick={() => load(Math.max(0, result.offset - 50))}>قبلی</button><button disabled={busy || !result.hasMore} onClick={() => load(result.offset + 50)}>بعدی</button></div></>}
    </>}
  </section>;
}
