import React, { useState } from "react";
import { Fire, Snowflake, Drop, CaretDown } from "@phosphor-icons/react";
import { fa } from "../api";
import "./DailyStreak.css";

export default function DailyStreak({ streak }) {
  const [expanded, setExpanded] = useState(false);
  if (!streak) return null;
  return <section className="daily-streak" aria-label="زنجیرهٔ روزانه و فریز رایگان">
    <header><span className="streak-flame"><Fire size={29} weight="duotone" /></span><div><h2>{streak.current ? `${fa(streak.current)} روز پشت‌سرهم` : "قطره‌قطره، هر روز"}</h2><p>{streak.protectedYesterday ? "فریز دیروز از زنجیره‌ات مراقبت کرد." : streak.activeToday ? "قطرهٔ امروزت ثبت شد!" : "روزی یک «جیش کردم» برای ادامه کافیه."}</p></div><span className="streak-best">بهترین: {fa(streak.best)}</span></header>
    <div className="streak-week" aria-label="زنجیرهٔ این هفته، شنبه تا جمعه">{streak.week.map(day => <div key={day.day} className={`streak-day is-${day.state}`} aria-label={`${day.detail}؛ ${{ active: "ثبت شده", frozen: "با فریز حفظ شده", today: "فرصت ثبت امروز", future: "هنوز نرسیده", missed: "بدون ثبت" }[day.state]}`}><span>{day.label}</span><i>{day.state === "active" ? <Drop size={17} weight="fill" /> : day.state === "frozen" ? <Snowflake size={17} /> : day.state === "today" ? <span className="streak-today-dot" /> : <span className="streak-day-dot" />}</i></div>)}</div>
    <div className="streak-freezes"><span><Snowflake size={17} />فریز رایگان <strong>{fa(streak.charges)} از {fa(streak.capacity)}</strong></span><button aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>چطوریه؟ <CaretDown size={13} /></button></div>
    {streak.nextChargeIn > 0 && <p className="streak-recharge">{fa(streak.nextChargeIn)} روز فعالیت پشت‌سرهم تا شارژ رایگان بعدی</p>}
    {expanded && <div className="streak-explanation"><p>هر روز حداقل یک «جیش کردم» ثبت کن. چند بار ثبت‌کردن در یک روز، روز یا فریز اضافه نمی‌ده.</p><p>بعد از ۳ روز فعالیت پشت‌سرهم، یک فریز رایگان می‌گیری. با زنجیرهٔ ۲۱روزه، جای فریز دوم هم باز می‌شه و یک شارژ هدیه می‌گیری.</p><p>اگر یک روز جا بمونی، یک فریز خودکار خرج می‌شه؛ زنجیره‌ات حفظ می‌شه. بعد از مصرف، ۳ روز فعالیت پشت‌سرهم یک شارژ رو برمی‌گردونه.</p><p>فریزها همیشه رایگانن. روزها با ساعت ایران حساب می‌شن و برای ثبت امروز تا پایان روز فرصت داری.</p></div>}
  </section>;
}
