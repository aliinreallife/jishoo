import React from "react";
import "./Landing.css";

export default function Landing() {
  return <div className="landing-page" dir="rtl">
    <a className="landing-skip" href="#landing-main">رفتن به محتوای اصلی</a>
    <header className="landing-header">
      <a href="/" className="landing-brand"><img src="/assets/favicon-v2-64.png" width="40" height="40" alt="" />جیشو</a>
      <nav aria-label="معرفی جیشو"><a href="#how">چطوریه؟</a><a href="/changelog">تازه‌ها</a><a className="landing-login" href="/home?login=1">ورود با گوگل</a></nav>
    </header>
    <main id="landing-main">
      <section className="landing-hero">
        <div className="landing-hero-copy">
          <span className="landing-eyebrow">یه جمع خودمونی، برای لحظه‌های معمولی</span>
          <h1>چیزای کوچیک،<br /><em>رفاقت‌های قشنگ.</em></h1>
          <p>جیشو یه اپ اجتماعی برای ثبت «جیش دارم» و «جیش کردم» با دوست‌هاست. آمارت رو ببین، کارت استوری بساز و خاطره‌های روزمره‌تون رو نگه دار.</p>
          <a className="landing-primary" href="/home">بریم جیشو <span aria-hidden="true">←</span></a>
          <small>بدون حساب هم می‌تونی شروع کنی. برای عضویت، دعوت یه دوست لازمه.</small>
        </div>
        <div className="landing-illustration" aria-label="قطرهٔ خجالتی و دوست‌داشتنی جیشو">
          <div className="landing-mascot-halo" />
          <img className="landing-shy" src="/assets/landing-shy-v1-640.webp" srcSet="/assets/landing-shy-v1-320.webp 320w, /assets/landing-shy-v1-640.webp 640w, /assets/landing-shy-v1-960.webp 960w" sizes="(max-width: 760px) 300px, 390px" width="420" height="420" alt="قطرهٔ آبی خجالتی جیشو" fetchPriority="high" />
          <span className="landing-doodle doodle-one" aria-hidden="true">♡</span><span className="landing-doodle doodle-two" aria-hidden="true">✦</span>
          <div className="landing-sample" aria-hidden="true"><img src="/assets/landing-happy-v1-128.webp" width="48" height="48" alt="" /><span><small>یه لحظه از روزِ دوستت</small><strong>جیش کردم 💧</strong></span><b>یه لحظهٔ ساده، یه لبخند مشترک</b></div>
        </div>
      </section>
      <section className="landing-features" aria-label="توی جیشو چی داریم؟">
        <article>
          <div className="landing-feature-preview feature-friends" aria-hidden="true">
            <span className="feature-message message-need">جیش دارم</span>
            <img src="/assets/landing-shy-v1-256.webp" width="108" height="108" alt="" loading="lazy" />
            <span className="feature-message message-done">جیش کردم</span>
          </div>
          <h2>دوستات رو پیدا کن</h2>
          <p>با آیدی هم رو پیدا کنین و گروه بسازین. لینک‌های اجتماعی هم فقط با قبول هر دوتون دیده می‌شن.</p>
          <a className="landing-feature-link" href="/friends">پیدا کردن دوست‌ها <span aria-hidden="true">←</span></a>
        </article>
        <article>
          <div className="landing-feature-preview feature-nearby" aria-hidden="true">
            <svg viewBox="0 0 280 132" fill="none"><path className="feature-road" d="M-10 101 290 27M66-10 114 146M193-10 227 146" /><path className="feature-road-center" d="M-10 101 290 27M66-10 114 146M193-10 227 146" /><circle cx="140" cy="79" r="29" fill="#bbdcf4" fillOpacity=".45" stroke="#97c1df" /><circle cx="140" cy="79" r="6" fill="#68a8e8" stroke="#fff" strokeWidth="3" /></svg>
            <img className="feature-map-drop" src="/assets/landing-shy-v1-128.webp" width="48" height="48" alt="" loading="lazy" />
            <span className="feature-map-label">این نزدیکا</span>
          </div>
          <h2>کی دور و برته؟</h2>
          <p>ثبت‌های نزدیکت رو روی نقشه ببین. مکان‌ها تقریبی‌ان؛ دیده‌شدن یا پنهان‌موندن هم دست خودته.</p>
          <a className="landing-feature-link" href="/nearby">یه نگاه به نقشه <span aria-hidden="true">←</span></a>
        </article>
        <article>
          <div className="landing-feature-preview feature-story" aria-hidden="true">
            <div className="feature-story-print"><span>jishoo</span><img src="/assets/landing-happy-v1-256.webp" width="76" height="76" alt="" loading="lazy" /><strong>جیش کردم!</strong></div>
            <span className="feature-story-note">این یکی می‌ره استوری</span>
            <svg viewBox="0 0 70 42" fill="none"><path d="M65 5C38 1 21 12 15 32m-5-13 5 14 14-6" /></svg>
          </div>
          <h2>یه کارت از روزت بساز</h2>
          <p>جیش امروز، آمار هفته یا زنجیرهٔ روزهات؛ هر کدوم یه کارت برای فرستادن به دوستات دارن.</p>
          <a className="landing-feature-link" href="/stories/checkin">دیدن یه کارت <span aria-hidden="true">←</span></a>
        </article>
      </section>
      <section className="landing-how" id="how">
        <div><span className="landing-eyebrow">پیچیده‌ش نکردیم</span><h2>با یه لحظهٔ ساده شروع می‌شه.</h2><p>جیشو یه بهونه‌ست که توی روزمرگی، از هم دور نشیم.</p></div>
        <ol><li><span>۱</span><div><h3>یه سر بزن</h3><p>مهمان شروع کن؛ جیشت رو ثبت کن و کارت خودت رو ببین.</p></div></li><li><span>۲</span><div><h3>با دعوت بیا تو جمع</h3><p>با گوگل و دعوت دوستت عضو شو. اسمت رو فقط موقع عضویت می‌پرسیم.</p></div></li><li><span>۳</span><div><h3>جمع خودت رو بساز</h3><p>دوستات رو پیدا کن، گروه بساز و لحظه‌های کوچیکتون رو شریک شو.</p></div></li></ol>
      </section>
      <section className="landing-privacy">
        <img src="/assets/landing-shy-v1-256.webp" width="110" height="110" alt="" loading="lazy" />
        <div><h2>هر چیزی، با اجازهٔ خودت.</h2><p>دیدن نقشه، مکانت رو منتشر نمی‌کنه. حساب‌های اجتماعی هم فقط با درخواست و قبول هر دو نفر قابل دیدنن. شماره و ایمیلت عمومی نیستن.</p><a href="/privacy">حریم خصوصی جیشو ←</a></div>
      </section>
      <section className="landing-faq"><h2>شاید سوال تو هم باشه</h2>
        <details><summary>برای شروع باید عضو بشم؟</summary><p>نه؛ مهمان هم می‌تونه جیشش رو ثبت کنه، آمار ببینه و استوری بسازه. برای دوستی و استفاده از حساب روی دستگاه‌های دیگه، با دعوت عضو شو.</p></details>
        <details><summary>جیشو رایگانه؟</summary><p>ثبت‌ها، دوست‌ها، گروه‌ها، آمار، نقشه و استوری شخصی همیشه رایگان می‌مونن. در دورهٔ آزمایشی، قابلیت‌های اضافهٔ پرمیوم هم برای همه فعاله.</p></details>
        <details><summary>بدون دعوت می‌شه عضو شد؟</summary><p>فعلاً عضویت فقط با دعوته؛ از یه دوست لینک یا کد دعوت بگیر. تا اون موقع مهمان مایی.</p></details>
        <details><summary>چطور روی گوشی نصبش کنم؟</summary><p>جیشو توی مرورگر هم کار می‌کنه. برای اضافه‌کردنش به صفحهٔ گوشی، <a href="/install">راهنمای نصب</a> رو ببین.</p></details>
      </section>
      <section className="landing-last"><h2>یه لحظه از روزت، برای دوستات.</h2><a className="landing-primary" href="/home">بریم تو جیشو ←</a><p>اگه دوستت دعوتت کرده، از همون لینک وارد شو.</p></section>
    </main>
    <footer className="landing-footer"><a className="landing-brand" href="/">جیشو 💧</a><nav aria-label="لینک‌های جیشو"><a href="/about">جیشو چیست؟</a><a href="/terms">شرایط استفاده</a><a href="/privacy">حریم خصوصی</a><a href="/support">پشتیبانی</a><a href="/install">نصب روی گوشی</a><a href="/changelog">تازه‌های جیشو</a></nav><small>یه لحظهٔ ساده، یه لبخند مشترک.</small></footer>
  </div>;
}
