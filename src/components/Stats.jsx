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
const key = (date) =>
  date.toLocaleDateString("en-CA", { timeZone: "Asia/Tehran" });
export default function Stats({ data, onBack, onShare }) {
  const [period, setPeriod] = useState("week");
  const s = data.stats,
    now = new Date(),
    [year, month] = key(now).split("-").map(Number);
  const values =
    period === "all"
      ? Array.from({ length: 12 }, (_, i) => {
          const d = new Date(Date.UTC(year, month - 12 + i, 15));
          const k = key(d).slice(0, 7);
          return {
            key: k,
            label: d.toLocaleDateString("fa-IR-u-ca-gregory", {
              month: "short",
              timeZone: "Asia/Tehran",
            }),
            count: s.monthly?.find((x) => x.day === k)?.count || 0,
          };
        })
      : Array.from({ length: period === "week" ? 7 : 30 }, (_, i) => {
          const d = new Date(
            Date.now() - ((period === "week" ? 6 : 29) - i) * 86400000,
          );
          return {
            key: key(d),
            label: d.toLocaleDateString(
              "fa-IR",
              period === "week"
                ? { weekday: "short", timeZone: "Asia/Tehran" }
                : { day: "numeric", timeZone: "Asia/Tehran" },
            ),
            count: s.daily.find((x) => x.day === key(d))?.count || 0,
          };
        });
  const total =
      period === "week" ? s.week : period === "month" ? s.month : s.total,
    max = Math.max(1, ...values.map((v) => v.count));
  const calendar = Array.from({ length: 21 }, (_, i) => {
    const d = new Date(Date.now() - (20 - i) * 86400000);
    return {
      key: key(d),
      count: s.daily.find((x) => x.day === key(d))?.count || 0,
      label: d.toLocaleDateString("fa-IR", {
        day: "numeric",
        month: "long",
        timeZone: "Asia/Tehran",
      }),
    };
  });
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
              ? "خبرهای کوچولویی که خودت ثبت کردی."
              : "هر وقت خواستی، اولین خبرت رو ثبت کن."}
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
              ? "۷ روز اخیر"
              : period === "month"
                ? "۳۰ روز اخیر"
                : "۱۲ ماه میلادی اخیر"}
          </span>
        </div>
        <div
          className={`lovely-chart ${period}`}
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
                    : period !== "month" || i % 5 === 0 || i === 29
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
            اینجا با خبرهای واقعی تو رنگ می‌گیره 💧
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
            {fa(
              s.daily.filter(
                (d) =>
                  d.count > 0 &&
                  d.day >= key(new Date(Date.now() - 29 * 86400000)),
              ).length,
            )}
          </strong>
          <span>روزهای فعالِ این ماه</span>
        </div>
      </div>
      <div className="drop-calendar">
        <div className="section-heading">
          <h2>یه تکه از روزهات</h2>
          <span>۲۱ روز اخیر</span>
        </div>
        <div className="drop-calendar-grid">
          {calendar.map((d) => (
            <div
              key={d.key}
              className={d.count ? "has-drops" : ""}
              title={`${d.label} · ${fa(d.count)} بار`}
              aria-label={`${d.label}، ${fa(d.count)} بار`}
            >
              <Drop size={25} weight={d.count ? "fill" : "regular"} />
              <small>{d.count ? fa(d.count) : "·"}</small>
            </div>
          ))}
        </div>
        <p>هر قطره، یه سر زدن کوچولو به خودت.</p>
      </div>
      <p className="stats-privacy-note">
        این آمار برای خودته؛ فقط با انتخاب تو به تصویر اشتراک تبدیل می‌شه.
      </p>
    </section>
  );
}
