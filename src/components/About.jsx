import React, { useEffect } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import { productFacts } from "../product-facts";
import "./PublicBase.css";
import "./Legal.css";
import "./About.css";

export default function About() {
  useEffect(() => {
    // Also reveal source links on browsers that do not expand details for fragments.
    const reveal = () => {
      const id = location.hash.slice(1);
      if (id !== "english" && !id.startsWith("en-")) return;
      const target = document.getElementById(id);
      if (!target) return;
      document.getElementById("english").open = true;
      target.scrollIntoView();
    };
    reveal();
    addEventListener("hashchange", reveal);
    return () => removeEventListener("hashchange", reveal);
  }, []);
  return <main className="legal-page" dir="rtl">
    <header><a href="/" aria-label="برگشت به جیشو"><ArrowRight size={23} /></a><span dir="ltr">jishoo</span></header>
    <h1>جیشو چیست؟</h1>
    <p className="legal-intro">یه اپ اجتماعی برای جیش‌ها، دوست‌ها و خاطره‌های روزمره.</p>
    <nav className="about-topics" aria-label="موضوع‌های معرفی جیشو">{productFacts.map(fact => <a key={fact.id} href={`#${fact.id}`}>{fact.title}</a>)}</nav>
    {productFacts.map(fact => <section key={fact.id} id={fact.id}><h2>{fact.title}</h2><p>{fact.text}</p></section>)}
    <section><h2>از کجا شروع کنم؟</h2><p><a href="/home">جیشو رو باز کن</a> یا <a href="/install">راهنمای نصب روی گوشی</a> رو ببین. برای پرسش و پیشنهاد، <a href="/support">پشتیبانی</a> اینجاست.</p></section>
    <details className="about-english" lang="en" dir="ltr" id="english">
      <summary>About jishoo in English</summary>
      <div>{productFacts.map(fact => <section key={fact.id} id={`en-${fact.id}`}><h2>{fact.enTitle}</h2><p>{fact.en}</p></section>)}
        <p><a href="/about.md" type="text/markdown">Read the Markdown version</a> · <a href="/llms.txt" type="text/plain">Public documentation index</a></p>
      </div>
    </details>
    <footer><a href="/privacy">حریم خصوصی</a><a href="/terms">شرایط استفاده</a><a href="/changelog">تازه‌های جیشو</a><a href="/">برگشت به جیشو</a></footer>
  </main>;
}
