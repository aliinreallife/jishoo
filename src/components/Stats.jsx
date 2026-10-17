import "./Stats.css";
import React, { useState } from "react";
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
      key: key(d), label: d.toLocaleDateString("fa-IR-u-ca-persian", period === "week" ? { weekday: "short", timeZone: "Asia/Tehran" } : { day: "numeric", timeZone: "Asia/Tehran" }), count: counts.get(key(d)) || 0,
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
        <div
          className={`lovely-chart ${period}`}
          style={{ gridTemplateColumns: `repeat(${values.length}, minmax(0, 1fr))` }}
          aria-label="نمودار جیش کردم"
          role="img"
        >
          {values.map((v, i) => (
            <div
              className="lovely-column"
              key={v.key}
              title={`${v.label}: ${fa(v.count)} بار`}
            >
              <span className="lovely-chart-track">
                <i
                  style={{
                    height: v.count
                      ? `${Math.max(7, (v.count / max) * 100)}%`
                      : "3%",
                  }}
                  data-empty={!v.count}
                >
                  {v.count > 0 && period !== "month" && (
                    <Drop size={15} weight="fill" />
                  )}
                </i>
              </span>
              <small>
                {(
                  period === "all"
                    ? i % 2 === 0
                    : period !== "month" || i % 5 === 0 || i === values.length - 1
                )
                  ? v.label
                  : "\u00a0"}
              </small>
              <span className="sr-only">
                {v.label}: {fa(v.count)} بار
              </span>
            </div>
          ))}
        </div>
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
