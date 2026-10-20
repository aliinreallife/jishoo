import "./PublicBase.css";
import "./Legal.css";
import React, { useEffect } from "react";
import { ArrowRight, ShieldCheck, Scroll } from "@phosphor-icons/react";
const metricsActive = import.meta.env.PROD && (import.meta.env.VITE_VERCEL_ANALYTICS_ENABLED === "true" || import.meta.env.VITE_VERCEL_SPEED_INSIGHTS_ENABLED === "true");
const privacy = [
  [
    "چه اطلاعاتی نگه می‌داریم؟",
    "برای مهمان، شناسهٔ تصادفی نشست و ثبت‌هایی که خودت ثبت می‌کنی نگه داشته می‌شود. هنگام عضویت، نام، شناسهٔ یکتا و رابطهٔ دعوت ذخیره می‌شوند. عکس، لینک‌های اجتماعی، دوستی‌ها و گروه‌ها اختیاری‌اند. اگر گوگل را وصل کنی، شناسهٔ تاییدشدهٔ گوگل و ایمیل رمز‌شده برای ورود ذخیره می‌شوند و عمومی نیستند. رمز گوگل یا دسترسی به پیام‌های Gmail دریافت نمی‌کنیم. شماره به‌صورت رمز‌شده و اثر انگشت رمزنگاری‌شده برای یافتن حساب ذخیره می‌شود؛ در پروفایل عمومی نمایش داده نمی‌شود.",
  ],
  [
    "فهرست انتظار دعوت",
    "اگر بعد از تایید گوگل، پیوستن به فهرست انتظار را انتخاب کنی، ایمیل رمز‌شده و شناسهٔ گوگل برای اطلاع‌رسانی دعوت نگه داشته می‌شوند. می‌توانی یک شمارهٔ تماس اختیاری هم بدهی؛ این شماره تاییدشده نیست و به‌عنوان راه ورود به حساب متصل نمی‌شود. اطلاعات تماس عمومی نیستند و فقط مدیر مجاز برای ادارهٔ دعوت‌ها آن‌ها را می‌بیند. با عضویت از فهرست انتظار خارج می‌شوی؛ حذف حساب مهمان هم رکورد متعلق به آن را پاک می‌کند.",
  ],
  [
    "ورود با Google: چه می‌گیریم و چرا؟",
    "jishoo (جیشو) فقط دسترسی‌های openid و email را درخواست می‌کند. پس از تایید هویت در سرور، شناسهٔ یکتای حساب گوگل و ایمیل تاییدشده را برای ورود، یافتن حساب قبلی یا اتصال حساب با انتخاب خودت استفاده می‌کنیم. نام و عکس پروفایل جیشو را خودت جداگانه انتخاب می‌کنی. اگر فهرست انتظار را انتخاب کنی، ایمیل برای مدیریت دعوت و تماس دربارهٔ پیوستن نگه داشته می‌شود. به رمز گوگل، پیام‌های Gmail، مخاطب‌ها، فایل‌های Drive یا تقویمت دسترسی نمی‌خواهیم. توکن‌های ورود گوگل فقط برای بررسی همان ورود پردازش می‌شوند؛ access token، refresh token و ID token گوگل را برای استفادهٔ بعدی در پایگاه داده نگه نمی‌داریم.",
  ],
  [
    "استفاده و اشتراک داده‌های Google",
    "شناسه و ایمیل گوگل در پروفایل عمومی، نقشه، استوری یا برای دوست‌ها نمایش داده نمی‌شوند. این داده‌ها را نمی‌فروشیم، برای تبلیغات یا آموزش مدل‌های هوش مصنوعی استفاده نمی‌کنیم و به سرویس هوش مصنوعی نمی‌فرستیم. پردازش لازم برای ورود و نگهداری حساب روی سرورهای Vercel و پایگاه دادهٔ Neon انجام می‌شود. دسترسی انسانی به نیازهای پشتیبانی، مدیریت فهرست انتظارِ انتخابی، امنیت و تعهدات قانونی محدود می‌شود. استفاده و انتقال داده‌های دریافت‌شده از Google مطابق Google API Services User Data Policy، از جمله الزامات Limited Use، انجام می‌شود.",
  ],
  [
    "نگهداری و حذف اطلاعات Google",
    "ایمیل رمز‌شده و شناسهٔ گوگل تا زمانی که حساب یا درخواست فهرست انتظارت باقی است، برای همان هدف نگه داشته می‌شوند. تاییدهای موقت ورود ده دقیقه اعتبار دارند و پس از انقضا پذیرفته نمی‌شوند. با حذف حساب از من ← تنظیمات ← حذف حساب، اتصال گوگل و اطلاعات هویت مربوط به آن هم از پایگاه دادهٔ فعال حذف می‌شوند؛ رکورد فهرست انتظارِ متصل به حساب هم پاک می‌شود. اگر به حساب دسترسی نداری، از فرم عمومی پشتیبانی درخواست راهنمایی برای دسترسی یا حذف بده؛ ممکن است برای جلوگیری از حذف حساب فرد دیگر، اثبات مالکیت لازم باشد. می‌توانی اجازهٔ جیشو را در بخش اتصال‌های حساب Google هم برداری؛ این کار به‌تنهایی حساب و ثبت‌های جیشو را حذف نمی‌کند. گزارش‌های عملیاتی و پشتیبان‌های زیرساخت ممکن است طبق سیاست ارائه‌دهنده باقی بمانند و پاک‌شدن فوری همهٔ نسخه‌های پشتیبان را وعده نمی‌دهیم.",
  ],
  [
    "موقعیت مکانی چطور کار می‌کند؟",
    "اجازهٔ مرورگر برای دیدن اطراف، به‌تنهایی مکانت را برای دیگران منتشر نمی‌کند. نمایش مکان و حضور در فهرست «این نزدیکا» انتخاب‌های جداگانه‌اند. فقط هنگام درخواست مکان یا روشن‌کردن نمایش، موقعیت به شبکه‌ای تقریبی با فاصلهٔ حدود ۲۰۰ متر تبدیل می‌شود؛ ردیابی دائمی در پس‌زمینه نداریم. نشانگرهای یک محدوده ممکن است برای خوانایی از هم باز شوند و نقطهٔ دقیق افراد نیستند. با خاموش‌کردن نمایش مکان، مختصات ذخیره‌شدهٔ فعلی و ثبت‌های قبلی پاک می‌شوند. ثبت‌های ۳۰ دقیقهٔ اخیر و مکان‌های تازه‌تر از یک ساعت روی نقشه دیده می‌شوند.",
  ],
  [
    "چه کسی ثبت‌ها و لینک‌ها را می‌بیند؟",
    "ثبت «فقط من» خصوصی است. اگر نمایش مکان را روشن کنی، ثبت تقریبی تو روی نقشهٔ اطراف و نقشهٔ همه‌جا دیده می‌شود. نقشهٔ همه‌جا همیشه بی‌نام است؛ نام و عکس دوست‌ها در نمای نزدیک دیده می‌شوند؛ اگر نمایش با پروفایل را انتخاب کنی، پروفایلت از نشانگر نقشهٔ اطراف و فهرست آدم‌های نزدیک باز می‌شود. هم‌زمانی با افراد نزدیک فقط برای دو نفر اعلان بی‌نام می‌سازد و دوستی یا اجازهٔ دیدن حساب‌های اجتماعی ایجاد نمی‌کند. نام، شناسه، عکس و لقب‌های کسب‌شده می‌توانند در پروفایل عمومی دیده شوند. لینک پروفایل عمومی برای کسی که آن را دارد باز می‌شود؛ از موتورهای جست‌وجو می‌خواهیم پروفایل‌ها را فهرست نکنند. صفحه‌های معرفی عمومی سایت برای جست‌وجو و خواندن در دسترس‌اند و داده‌های خصوصی حساب را ندارند. حساب‌های اجتماعی فقط پس از درخواست یکی از دوست‌ها و قبول نفر دیگر برای هر دو قابل مشاهده‌اند. هر نفر می‌تواند اشتراک حساب‌ها را قطع کند و همچنان دوست بمانند. محتوایی که کسی قبلاً ذخیره کرده قابل پس‌گرفتن نیست.",
  ],
  [
    "گروه‌ها و دعوت‌ها",
    "عضویت گروه فقط پس از قبول دعوت یا انتخاب دکمهٔ پیوستن انجام می‌شود. اعضای گروه نام و پروفایل یکدیگر را می‌بینند؛ عضویت به‌تنهایی دوستی، دسترسی به شماره، ثبت خصوصی یا اجازهٔ لینک‌های اجتماعی ایجاد نمی‌کند. کسی که لینک گروه را دارد می‌تواند نام گروه، سازنده و تعداد اعضا را ببیند. سازنده می‌تواند لینک را عوض کند. فهرست‌های خصوصی قدیمی فقط برای صاحب فهرست دیده می‌شوند. دعوت‌کننده می‌تواند ببیند چه کسانی با دعوت او عضو شده‌اند؛ مدیر هم مسیر دعوتِ اعضا را برای ادارهٔ عضویت‌ها می‌بیند.",
  ],
  [
    "اعلان‌ها و دستگاه",
    "اعلان سیستم فقط با اجازهٔ خودت و مرورگر فعال می‌شود. آدرس و کلید اشتراک دستگاه برای فرستادن Web Push ذخیره می‌شوند. وقتی جیشو بسته است هم می‌توانی اعلان دوست‌ها را دریافت کنی. یادآوری شخصی پس از دو روز بدون ثبت کامل، داخل برنامه نشان داده می‌شود و جداگانه قابل خاموش‌کردن است؛ دریافت آن روی گوشی به انتخاب جداگانهٔ تو نیاز دارد و حداکثر هفته‌ای یک‌بار است. تنظیم یادآوری، زمان سکوت و زمان آخرین تلاش و ارسال برای رعایت انتخابت نگه داشته می‌شوند؛ این یادآوری برای دوست‌ها چیزی نمی‌فرستد. می‌توانی همهٔ اعلان‌ها، یک دوست یا یک گروه را بی‌صدا کنی یا اعلان دستگاه را خاموش کنی. متن اعلان ممکن است روی صفحهٔ قفل دیده شود؛ پیش‌نمایش را از تنظیمات گوشی کنترل کن.",
  ],
  [
    "سرویس‌های مورد استفاده",
    "Vercel میزبان برنامه و Neon میزبان پایگاه داده است. بسته به مرورگر، اعلان‌ها از سرویس‌های Google، Apple، Mozilla یا Microsoft عبور می‌کنند. نقشه از داده‌های OpenStreetMap و کاشی‌های روشن CARTO استفاده می‌کند و درخواست کاشی‌ها می‌تواند IP دستگاه و محدودهٔ نقشه را به CARTO نشان دهد. ورود اختیاری گوگل به سرویس هویت Google متصل می‌شود. شخصیت جایگزین عکس با کتابخانهٔ Blobatar داخل برنامه ساخته می‌شود؛ نامت برای ساخت آن به سایت Blobatar ارسال نمی‌شود.",
  ],
  [
    "آمار فنی بازدید و سرعت",
    `${metricsActive ? "بسته به ابزارهای فعال Vercel Analytics و Speed Insights، دستهٔ صفحه‌های دیده‌شده یا سنجه‌های فنی سرعت برای بهبود برنامه ثبت می‌شوند." : "اتصال Vercel Analytics و Speed Insights آماده است و جمع‌آوری فعلاً خاموش است. اگر فعال شود، دستهٔ صفحه‌های دیده‌شده و سنجه‌های فنی سرعت برای بهبود برنامه ثبت می‌شوند."} برنامه اطلاعات حساب یا متن فرم‌ها را به‌عنوان رویداد تحلیلی ارسال نمی‌کند. کد دعوت، شناسهٔ گروه و پارامترهای خصوصی از نشانی صفحهٔ گزارش‌شده حذف می‌شوند؛ مسیر مدیریت هم از این آمار کنار گذاشته می‌شود. این ابزارها برای تبلیغات یا ضبط صفحه استفاده نمی‌شوند.`,
  ],
  [
    "کوکی، نگهداری و حذف",
    "کوکی نشست امن برای ورود و ادامهٔ کار استفاده می‌شود؛ نشست‌ها تا ۹۰ روز اعتبار دارند. انتخاب ورود در ذخیره‌سازی مرورگر نگه داشته می‌شود. نسخهٔ نصب‌شده فقط فایل‌های عمومی برنامه و صفحهٔ آفلاین را ذخیره می‌کند؛ پاسخ‌های API و اطلاعات خصوصی حساب در کش آفلاین ذخیره نمی‌شوند. ثبت‌ها، دوستی‌ها، دعوت‌ها و اعلان‌ها تا زمان حذف حساب یا پاک‌سازی فنی نگه داشته می‌شوند؛ خواندن اعلان آن را حذف نمی‌کند. از تنظیمات پروفایل می‌توانی حساب یا ثبت‌های مهمان را حذف کنی و عکس، لینک یا نمایش مکان را جداگانه برداری. ارائه‌دهندگان زیرساخت ممکن است گزارش‌های عملیاتی و نسخه‌های پشتیبان را طبق سیاست خود نگه دارند. رمزنگاری شماره به معنی رمزنگاری سرتاسری همهٔ داده‌ها نیست.",
  ],
  [
    "نسخهٔ آزمایشی",
    "ورود و اتصال شماره فعلاً متوقف است. روش آزمایشی قبلی مالکیت واقعی شماره را تایید نمی‌کرد و برای اتصال حساب‌های جدا استفاده نمی‌شود. دسترسی مدیریت علاوه بر حساب مالک، به لینک خصوصی یا رمز مالک نیاز دارد. برای مقابله با سوءاستفاده، محدودیت درخواست با اثر انگشت رمزنگاری‌شدهٔ نشانی شبکه و حساب اعمال می‌شود.",
  ],
  [
    "پرسش و درخواست",
    "برای پرسش یا درخواست پشتیبانی، از پیوند پشتیبانی پایین صفحه استفاده کن. متن پیام و راه تماس اختیاری در پشتیبانی ذخیره می‌شود و فقط برای مدیریت قابل مشاهده است. برای حذف پیام می‌توانی کد پیگیری را در درخواست بعدی بنویسی؛ رمز، کد ورود یا لینک خصوصی مدیریت را نفرست.",
  ],
];
const terms = [
  [
    "دربارهٔ جیشو",
    "جیشو جایی برای ثبت لحظه‌های روزمره، دوستی، گروه‌ها و تصویرهای قابل اشتراک است. این برنامه ابزار پزشکی، تشخیص، درمان، اندازه‌گیری سلامت یا سرویس اضطراری نیست. آمار صرفاً ثبت‌های انتخابی خودت را نشان می‌دهد.",
  ],
  [
    "عضویت و استفاده",
    "مهمان می‌تواند بدون حساب از ثبت جیش و آمار استفاده کند. عضویت فعلاً به دعوت و حساب تاییدشدهٔ Google نیاز دارد. ورود و اتصال شماره موقتاً غیرفعال است؛ شماره‌های حساب‌های قبلی حفظ می‌شوند. از نشست قبلی حساب شماره‌ای می‌توانی گوگل را وصل کنی. یکی‌کردن دو حساب جدا فقط بعد از تایید تازهٔ گوگل و تایید صریح خودت انجام می‌شود؛ نام فقط هنگام ساخت حساب خواسته می‌شود. یک شماره برای یک حساب استفاده می‌شود. شناسه باید یکتا و حداقل سه حرف باشد. با ساخت حساب، این شرایط و حریم خصوصی را می‌پذیری. برای استفاده باید مجاز به پذیرش این شرایط طبق قوانین محل زندگی‌ات باشی؛ اگر نیاز به اجازهٔ سرپرست داری، پیش از عضویت آن را بگیر.",
  ],
  [
    "حساب و نسخهٔ آزمایشی",
    "ورود و اتصال شماره تا آماده‌شدن تایید امن متوقف است. تایید آزمایشی قبلی، مالکیت واقعی شماره را بررسی نمی‌کرد. کدهای دعوت و لینک‌های مدیریت را در اختیار افراد نامطمئن نگذار. امکانات و ظاهر نسخهٔ آزمایشی ممکن است تغییر کنند یا موقتاً در دسترس نباشند. مسئولیت نگهداری امن دستگاه و راه‌های دسترسی حسابت با توست.",
  ],
  [
    "دوستی، گروه و حریم خصوصی",
    "دوستی، پیوستن به گروه، نمایش موقعیت، اعلان و انتشار لینک‌های اجتماعی تصمیم‌های جداگانه‌اند. اجازهٔ کسی را برای افشای هویت، لینک خصوصی یا محتوای او دور نزن. می‌توانی دوستی را قطع کنی، از گروه خارج شوی و اشتراک‌گذاری را خاموش کنی. قطع دوستی، عضویت گروه را خودکار لغو نمی‌کند.",
  ],
  [
    "رفتار و محتوای مجاز",
    "از جیشو برای آزار، تهدید، جعل هویت، مزاحمت، ارسال درخواست‌های انبوه، انتشار محتوای غیرقانونی یا دسترسی به دادهٔ دیگران استفاده نکن. ثبت‌های تکراری برای گرفتن لقب امتیاز اضافه نمی‌دهند. مدیر می‌تواند برای رسیدگی به سوءاستفاده، حساب را محدود یا غیرفعال کند. محتوایی که بارگذاری یا منتشر می‌کنی باید متعلق به تو باشد یا اجازهٔ استفاده از آن را داشته باشی.",
  ],
  [
    "اشتراک‌گذاری تصویر و اعلان",
    "تصویر یا لینک را فقط وقتی خودت انتخاب کنی در سرویس دیگری منتشر می‌کنی. شبکهٔ اجتماعی مقصد قوانین مستقل دارد و کنترل نسخه‌های ذخیره‌شدهٔ دیگران با جیشو نیست. رسیدن و نمایش اعلان به اتصال، مجوز مرورگر و تنظیمات گوشی بستگی دارد و تضمین‌شده نیست.",
  ],
  [
    "دعوت و پرمیوم",
    "در دورهٔ آزمایشی، پرمیوم برای همه فعال است و پرداختی دریافت نمی‌شود. اعضای معمولی سه دعوت عضویت دارند؛ هر عضو جدید هم سه دعوت می‌گیرد. دعوت موفق برای هر دو نفر هفت روز هدیه ذخیره می‌کند و شمارش آن پس از پایان آزمایش شروع می‌شود. ثبت‌نام بدون دعوت فعلاً باز نیست؛ در صورت فعال‌شدن، هدیهٔ پایه سه روز خواهد بود. دسترسی مادام‌العمر فقط وقتی به حسابت داده شود ثبت می‌شود؛ دربارهٔ خرید یا قیمت آینده از قبل تعهدی ایجاد نمی‌شود.",
  ],
  [
    "داده‌ها، تغییرات و پشتیبانی",
    "روش نگهداری، اشتراک و حذف داده‌ها در حریم خصوصی توضیح داده شده است. می‌توانی استفاده را متوقف و حساب را از تنظیمات حذف کنی. تغییرات مهم شرایط در همین صفحه با تاریخ نسخه منتشر می‌شوند. برای درخواست پشتیبانی از پیوند زیر استفاده کن و اطلاعات خصوصی را عمومی نفرست.",
  ],
];
const privacyIds = ["data", "waitlist", "google", "google-use", "google-delete", "location", "sharing", "groups", "notifications", "services", "metrics", "retention", "testing", "support"];
function readingParagraphs(text) {
  const paragraphs = [];
  let current = "";
  for (const sentence of text.replace(/([.!؟])\s+/gu, "$1\n").split("\n")) {
    if (current && current.length + sentence.length > 280) {
      paragraphs.push(current);
      current = sentence;
    } else current += (current ? " " : "") + sentence;
  }
  if (current) paragraphs.push(current);
  return paragraphs;
}
function EnglishPrivacy() {
  return <details className="privacy-english" id="privacy-english" lang="en" dir="ltr">
    <summary><strong>English summary</strong><span>Google sign-in &amp; your data</span></summary>
    <section id="google-data" lang="en" dir="ltr">
        <h2>jishoo privacy policy: Google sign-in &amp; your data</h2>
        <p>jishoo (جیشو) is a Persian social web app for optional, manually entered bathroom check-ins with friends, personal statistics and shareable story cards. Its public information pages and guest mode do not require Google sign-in. Google sign-in identifies a returning member or a person choosing invitation-only signup or the waiting list.</p>
        <h3>Data accessed and purpose</h3>
        <p>We request only the <code>openid</code> and <code>email</code> scopes. After server-side verification, we use and store your Google account identifier and verified email address to authenticate you, find or link your jishoo account, and, only if you choose the waiting list, manage your invitation request and contact you about joining. You choose your jishoo name and profile photo separately. We do not request your Google password, Gmail messages, contacts, Drive files or calendar. Google access, refresh and ID tokens are not persisted for later use.</p>
        <h3>Storage, sharing and limited use</h3>
        <p>Your email is encrypted in the database, identity checks run on the server, and Google sign-in uses HTTPS. Vercel hosts the app and Neon hosts the database; they process the information needed to operate these features. Your Google identifier and email are not displayed to friends or included in public profiles, map markers or story cards. Human access is limited to necessary support, your opted-in waiting-list administration, security and legal obligations. We do not sell Google user data, use it for advertising or AI model training, or send it to AI services.</p>
        <p>jishoo’s use and transfer of information received from Google APIs will adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>, including the Limited Use requirements.</p>
        <h3>Retention, deletion and revoking access</h3>
        <p>We retain the Google identifier and encrypted email while your account or waiting-list entry remains, for the purposes above. Temporary sign-in proofs are valid for ten minutes and are rejected after expiry. Deleting your account through Me → Settings → Delete account removes its Google identity connection and associated waiting-list record from the active database. Infrastructure logs and backups may remain under the providers’ retention policies; we do not promise immediate erasure of every backup. If you cannot access your account, use our <a href="/support">public support form</a> for access or deletion help; proof of account ownership may be needed.</p>
        <p>You can also remove jishoo’s permission in <a href="https://myaccount.google.com/connections">your Google Account connections</a>. Revoking Google permission does not automatically delete your jishoo account or check-ins. The Persian sections above cover other app data: optional profile photos and social links, friendships and groups, check-ins, approximate location, push subscriptions, technical metrics, session cookies and support messages. This policy is maintained by the jishoo app operator; privacy questions and requests can be sent through <a href="/support">jishoo support</a>.</p>
      </section>
  </details>;
}
export default function Legal({ kind }) {
  const privatePage = kind === "privacy";
  useEffect(() => {
    if (!privatePage) return;
    const revealEnglish = () => {
      if (window.location.hash !== "#google-data") return;
      const target = document.getElementById("google-data");
      const disclosure = target?.closest("details");
      if (disclosure) { disclosure.open = true; target.scrollIntoView({ block: "start" }); }
    };
    revealEnglish();
    window.addEventListener("hashchange", revealEnglish);
    return () => window.removeEventListener("hashchange", revealEnglish);
  }, [privatePage]);
  const page = <main className={`legal-page${privatePage ? " privacy-page" : ""}`} dir="rtl">
    <header>
      <a href="/" aria-label="برگشت به جیشو"><ArrowRight size={23} /></a>
      <span><bdi lang="en">jishoo</bdi> · جیشو</span>
      {privatePage ? <ShieldCheck size={27} /> : <Scroll size={27} />}
    </header>
    <div className={privatePage ? "privacy-heading" : undefined}>
      <span className={privatePage ? "privacy-kicker" : "little-pill"}>{privatePage ? "جیشو و اطلاعات تو" : "شفاف، به زبون خودمونی"}</span>
      <h1>{privatePage ? "حریم خصوصی" : "شرایط استفاده"}</h1>
      {!privatePage && <p className="legal-version">نسخهٔ ۲ · ۲۵ مهر ۱۴۰۵ (۱۷ اکتبر ۲۰۲۶)</p>}
      <p className="legal-intro">{privatePage ? "چه اطلاعاتی نگه می‌داریم، کی می‌بینتش و چطور می‌تونی کنترلش کنی." : "برای اینکه جمعمون امن، روشن و خودمونی بمونه."}</p>
      {privatePage && <p className="legal-version">نسخهٔ ۶ · ۲۷ مهر ۱۴۰۵ (۱۹ اکتبر ۲۰۲۶)</p>}
    </div>
    {privatePage && <>
      <aside className="privacy-at-a-glance" aria-label="خلاصهٔ حریم خصوصی">
        <strong>در یک نگاه</strong>
        <ul><li>ایمیل گوگل و شماره‌ات عمومی نیستن.</li><li>نمایش مکان و لینک‌های اجتماعی با انتخاب خودته.</li><li>از تنظیمات می‌تونی حساب و اطلاعاتش رو حذف کنی.</li></ul>
      </aside>
      <nav className="privacy-shortcuts" aria-label="رفتن به بخش‌های حریم خصوصی">
        <a href="#privacy-google">ورود گوگل</a><a href="#privacy-location">مکان و نقشه</a><a href="#privacy-retention">نگهداری و حذف</a><a href="#privacy-support">پرسش و پشتیبانی</a>
      </nav>
      <EnglishPrivacy />
    </>}
    <div className={privatePage ? "privacy-reading" : undefined}>
      {(privatePage ? privacy : terms).map(([title, body], i) => <section key={title} id={privatePage ? "privacy-" + (privacyIds[i] || i) : undefined}>
        <h2>{privatePage ? <><span className="privacy-section-number" aria-hidden="true">{(i + 1).toLocaleString("fa-IR", { minimumIntegerDigits: 2 })}</span><span>{title}</span></> : <>{i + 1}. {title}</>}</h2>
        {(privatePage ? readingParagraphs(body) : [body]).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
      </section>)}
    </div>
    <footer>
      <a href={privatePage ? "/terms" : "/privacy"}>{privatePage ? "شرایط استفاده" : "حریم خصوصی"}</a>
      <a href="/support" target={privatePage ? undefined : "_blank"} rel={privatePage ? undefined : "noreferrer"}>پشتیبانی</a>
      <a href="/">برگشت به جیشو</a>
    </footer>
  </main>;
  return privatePage ? <div className="privacy-document">{page}</div> : page;
}
