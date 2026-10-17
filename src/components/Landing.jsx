import React, { useEffect } from "react";
import "./Landing.css";

export default function Landing() {
  useEffect(() => { document.title = "جیشو — لحظه‌های کوچیک، رفاقت‌های قشنگ"; }, []);
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
          <p>«جیش دارم» یا «جیش کردم»؛ همین یه لحظهٔ ساده، یه لبخند برای دوستات. با آدمای خودت در تماس بمون و خاطره‌های کوچیکتون رو نگه دار.</p>
          <a className="landing-primary" href="/home">بریم جیشو <span aria-hidden="true">←</span></a>
          <small>بدون حساب هم می‌تونی شروع کنی. برای عضویت، دعوت یه دوست لازمه.</small>
        </div>
        <div className="landing-illustration" aria-label="قطرهٔ خجالتی و دوست‌داشتنی جیشو">
          <div className="landing-mascot-halo" />
          <img className="landing-shy" src="/assets/shy-drop.webp" width="420" height="420" alt="قطرهٔ آبی خجالتی جیشو" fetchPriority="high" />
          <span className="landing-doodle doodle-one" aria-hidden="true">♡</span><span className="landing-doodle doodle-two" aria-hidden="true">✦</span>
          <div className="landing-sample" aria-hidden="true"><img src="/assets/happy-drop.webp" width="48" height="48" alt="" /><span><small>یه لحظه از روزِ دوستت</small><strong>جیش کردم 💧</strong></span><b>یه لحظهٔ ساده، یه لبخند مشترک</b></div>
        </div>
      </section>
      <section className="landing-features" aria-label="توی جیشو چی داریم؟">
        <article><span aria-hidden="true">💛</span><h2>آدمای خودت</h2><p>با شناسه هم رو پیدا کنین، دوستی رو قبول کنین و جمع خودتون رو بسازین.</p></article>
        <article><span aria-hidden="true">🗺️</span><h2>این نزدیکا</h2><p>جیش‌های این نزدیکا رو ببین. خودت انتخاب کن پنهان بمونی یا با مکان تقریبی دیده بشی.</p></article>
        <article><span aria-hidden="true">💧</span><h2>یه استوری مخصوص تو</h2><p>آمار و خاطره‌هات با شخصیت‌های جیشو، آمادهٔ فرستادن برای دوستات و استوری‌کردن.</p></article>
      </section>
      <section className="landing-how" id="how">
        <div><span className="landing-eyebrow">پیچیده‌ش نکردیم</span><h2>با یه لحظهٔ ساده شروع می‌شه.</h2><p>جیشو یه بهونه‌ست که توی روزمرگی، از هم دور نشیم.</p></div>
        <ol><li><span>۱</span><div><h3>یه سر بزن</h3><p>مهمان شروع کن؛ جیشت رو ثبت کن و کارت خودت رو ببین.</p></div></li><li><span>۲</span><div><h3>با دعوت بیا تو جمع</h3><p>با گوگل و دعوت دوستت عضو شو. اسمت رو فقط موقع عضویت می‌پرسیم.</p></div></li><li><span>۳</span><div><h3>جمع خودت رو بساز</h3><p>دوستات رو پیدا کن، گروه بساز و لحظه‌های کوچیکتون رو شریک شو.</p></div></li></ol>
      </section>
      <section className="landing-privacy">
        <img src="/assets/shy-drop.webp" width="110" height="110" alt="" loading="lazy" />
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
    <footer className="landing-footer"><a className="landing-brand" href="/">جیشو 💧</a><nav aria-label="لینک‌های جیشو"><a href="/terms">شرایط استفاده</a><a href="/privacy">حریم خصوصی</a><a href="/support">پشتیبانی</a><a href="/install">نصب روی گوشی</a><a href="/changelog">تازه‌های جیشو</a></nav><small>یه لحظهٔ ساده، یه لبخند مشترک.</small></footer>
  </div>;
}
