import React from "react";
import { ArrowRight } from "@phosphor-icons/react";
import { productFacts } from "../product-facts";
import "./PublicBase.css";
import "./Legal.css";

export default function About() {
  return <main className="legal-page" dir="rtl">
    <header><a href="/" aria-label="برگشت به جیشو"><ArrowRight size={23} /></a><span dir="ltr">jishoo</span></header>
    <h1>جیشو چیست؟</h1>
    <p className="legal-intro">یه اپ اجتماعی برای جیش‌ها، دوست‌ها و خاطره‌های روزمره.</p>
    {productFacts.map(fact => <section key={fact.title}><h2>{fact.title}</h2><p>{fact.text}</p></section>)}
    <section><h2>از کجا شروع کنم؟</h2><p><a href="/home">جیشو رو باز کن</a> یا <a href="/install">راهنمای نصب روی گوشی</a> رو ببین. برای پرسش و پیشنهاد، <a href="/support">پشتیبانی</a> اینجاست.</p></section>
    <footer><a href="/privacy">حریم خصوصی</a><a href="/terms">شرایط استفاده</a><a href="/changelog">تازه‌های جیشو</a><a href="/">برگشت به جیشو</a></footer>
  </main>;
}
