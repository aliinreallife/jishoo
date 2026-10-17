import "./Stats.css";
import React, { useState, useEffect } from "react";
import {
  ArrowRight,
  ShareNetwork,
  Drop,
  Heart,
  CalendarBlank,
} from "@phosphor-icons/react";
import { Mascot } from "./Mascot";
import { fa } from "../api";
import { dayKey, weekDays, persianMonth, persianParts } from "../../lib/calendar.js";
const key = dayKey;
function TrendChart({ values, period }) {
  const latest = Math.max(0, values.findLastIndex((row) => row.count > 0));
  const [selected, setSelected] = useState(latest);
  useEffect(() => setSelected(latest), [period, latest]);
  const index = Math.min(selected, values.length - 1), current = values[index];
  const max = Math.max(1, ...values.map((row) => row.count));
  const points = values.map((row, i) => ({ x: 34 + i * 572 / Math.max(1, values.length - 1), y: 168 - row.count / max * 126 }));
  const recordedPoints = points.filter((_, i) => !values[i].future);
  const last = recordedPoints.at(-1);
  const path = recordedPoints.reduce((value, point, i) => i ? `${value} C${points[i-1].x + (point.x-points[i-1].x)/2},${points[i-1].y} ${points[i-1].x + (point.x-points[i-1].x)/2},${point.y} ${point.x},${point.y}` : `M${point.x},${point.y}`, "");
  const choose = (event) => {
    const box = event.currentTarget.getBoundingClientRect();
    setSelected(Math.max(0, Math.min(values.length - 1, Math.round(((event.clientX-box.left)/box.width*640 - 34)/572 * (values.length-1)))));
  };
  return <div className="stats-trend">
    <div className="trend-readout" aria-live="polite"><span>{current.detail || current.label}</span><strong>{current.future ? <small>این روز هنوز نرسیده</small> : <>{fa(current.count)} <small>بار سبک شدی</small></>}</strong></div>
    <svg viewBox="0 0 640 205" role="img" aria-label={`روند جیش کردم؛ ${current.detail || current.label}: ${current.future ? "هنوز نرسیده" : fa(current.count) + " بار"}`} onPointerMove={choose} onClick={choose}>
      <defs><linearGradient id="stats-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8cc5f9" stopOpacity=".48"/><stop offset="100%" stopColor="#cbe7ff" stopOpacity=".04"/></linearGradient></defs>
      {[42,105,168].map((y) => <line key={y} x1="34" x2="606" y1={y} y2={y} stroke="#eadfcd" strokeDasharray="5 8" />)}
      <path d={`${path} L${last.x},168 L34,168 Z`} fill="url(#stats-area)" />
      {recordedPoints.length === 1 && <rect x={last.x-12} y={last.y} width="24" height={Math.max(1,168-last.y)} rx="12" fill="url(#stats-area)" />}
      <line x1={last.x} x2="606" y1="168" y2="168" stroke="#dfd9e5" strokeDasharray="4 7" />
      <path d={path} fill="none" stroke="#80b7ef" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((point,i) => (period === "week" || i === index) && <circle key={values[i].key} cx={point.x} cy={values[i].future ? 168 : point.y} opacity={values[i].future ? .4 : 1} r={i===index ? 8 : 5} fill={i===index ? "#ffe16d" : "#fffdf6"} stroke={i===index ? "#d7b747" : "#80b7ef"} strokeWidth="3" />)}
      <line x1={points[index].x} x2={points[index].x} y1="30" y2="172" stroke="#c0b0cf" strokeDasharray="4 7" />
      {values.map((row,i) => (period === "week" || i===0 || i===values.length-1 || i % (period === "month" ? 5 : 2)===0) && <text key={row.key} x={points[i].x} y="199" textAnchor="middle" fill="#a08f8a" fontSize={period==="week" ? 20 : 18} fontFamily="Vazirmatn">{row.label}</text>)}
    </svg>
    <div className="trend-navigation"><button aria-label="نقطهٔ قبلی نمودار" disabled={index===0} onClick={() => setSelected(index-1)}>→</button><span>روی نمودار بزن یا نقطه‌ها رو ورق بزن</span><button aria-label="نقطهٔ بعدی نمودار" disabled={index===values.length-1} onClick={() => setSelected(index+1)}>←</button></div>
    <ol className="sr-only">{values.map((row) => <li key={row.key}>{row.detail || row.label}: {row.future ? "هنوز نرسیده" : fa(row.count) + " بار"}</li>)}</ol>
  </div>;
}
export default function Stats({ data, onBack, onShare }) {
  const [period, setPeriod] = useState("week");
  const s = data.stats, now = new Date(), currentMonth = persianMonth(now);
  const counts = new Map(s.daily.map((row) => [row.day, row.count]));
  const values = period === "all"
    ? Array.from({ length: 12 }, (_, i) => {
      const month = persianMonth(now, i - 11);
      return { key: `${month.year}-${month.month}`, label: month.start.toLocaleDateString("fa-IR-u-ca-persian", { month: "short", timeZone: "Asia/Tehran" }), count: month.days.reduce((sum, d) => sum + (counts.get(key(d)) || 0), 0) };
    })
    : (period === "week" ? weekDays(now) : currentMonth.days).map((d) => ({
      key: key(d), future: key(d) > key(now), detail: d.toLocaleDateString("fa-IR-u-ca-persian", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Tehran" }), label: d.toLocaleDateString("fa-IR-u-ca-persian", period === "week" ? { weekday: "short", timeZone: "Asia/Tehran" } : { day: "numeric", timeZone: "Asia/Tehran" }), count: counts.get(key(d)) || 0,
    }));
  const total = period === "all" ? s.total : values.reduce((sum, row) => sum + row.count, 0), max = Math.max(1, ...values.map((row) => row.count));
  const calendar = currentMonth.days.map((d) => ({ key: key(d), count: counts.get(key(d)) || 0, day: persianParts(d).day, label: d.toLocaleDateString("fa-IR-u-ca-persian", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Tehran" }) }));
  const padding = (7 - (currentMonth.offset + calendar.length) % 7) % 7;
  return (
    <section className="page lovely-stats">
      <header className="community-heading">
        <button onClick={onBack} aria-label="برگشت">
          <ArrowRight size={23} />
        </button>
        <div>
          <h1>قصهٔ قطره‌هات</h1>
          <p>لحظه‌های کوچیک، حالِ خوبِ خودت.</p>
        </div>
        <button onClick={onShare} aria-label="اشتراک آمار هفته">
          <ShareNetwork size={23} />
        </button>
      </header>
      <div className="stats-period" role="group" aria-label="بازهٔ آمار">
        {[
          ["week", "هفته"],
          ["month", "ماه"],
          ["all", "همه‌وقت"],
        ].map(([id, label]) => (
          <button
            key={id}
            aria-pressed={period === id}
            onClick={() => setPeriod(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="stats-hero-card">
        <div>
          <span>
            {period === "week"
              ? "این هفته"
              : period === "month"
                ? "این ماه"
                : "از اولین قطره"}
          </span>
          <strong>{fa(total)}</strong>
          <h2>{total ? "لحظهٔ سبک‌تر" : "قصه تازه شروع می‌شه"}</h2>
          <p>
            {total
              ? "لحظه‌هایی که برای خودت نگه داشتی."
              : "هر وقت خواستی، اولین جیشت رو ثبت کن."}
          </p>
        </div>
        <Mascot mood={total ? "happy" : "shy"} size={150} />
        <Heart className="stats-floating-heart" size={21} weight="fill" />
      </div>
      <div className="lovely-chart-card">
        <div className="section-heading">
          <h2>ردپای قطره‌ها</h2>
          <span>
            {period === "week"
              ? "شنبه تا جمعه"
              : period === "month"
                ? currentMonth.label
                : "۱۲ ماه شمسی اخیر"}
          </span>
        </div>
        <TrendChart values={values} period={period} />
        {!total && (
          <p className="stats-zero-note">
            اینجا با ثبت‌های واقعی تو رنگ می‌گیره 💧
          </p>
        )}
      </div>
      <div className="stats-mini-grid">
        <div>
          <Drop size={25} weight="duotone" />
          <strong>{fa(s.today)}</strong>
          <span>جیش کردمِ امروز</span>
        </div>
        <div>
          <CalendarBlank size={25} weight="duotone" />
          <strong>
            {fa(calendar.filter((d) => d.count > 0).length)}
          </strong>
          <span>روزهای فعالِ این ماه</span>
        </div>
      </div>
      <div className="drop-calendar">
        <div className="section-heading">
          <h2>یه تکه از روزهات</h2>
          <span>{currentMonth.label}</span>
        </div>
        <div className="calendar-weekdays" aria-label="روزهای هفته از شنبه تا جمعه">{["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="drop-calendar-grid">
          {Array.from({ length: currentMonth.offset }, (_, i) => <span key={`before-${i}`} aria-hidden="true" />)}
          {calendar.map((d) => (
            <div
              key={d.key}
              className={d.count ? "has-drops" : ""}
              title={`${d.label} · ${fa(d.count)} بار`}
              aria-label={`${d.label}، ${fa(d.count)} بار`}
            >
              <b>{fa(d.day)}</b>
              <Drop size={25} weight={d.count ? "fill" : "regular"} />
              <small>{d.count ? fa(d.count) : "·"}</small>
            </div>
          ))}
          {Array.from({ length: padding }, (_, i) => <span key={`after-${i}`} aria-hidden="true" />)}
        </div>
        <p>هر قطره، یه سر زدن به حالِ خودت.</p>
      </div>
      <p className="stats-privacy-note">
        این آمار برای خودته؛ فقط با انتخاب تو به تصویر اشتراک تبدیل می‌شه.
      </p>
    </section>
  );
}
