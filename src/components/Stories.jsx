import React, { useState, useRef, useEffect } from "react";
import { toBlob } from "html-to-image";
import QRCode from "qrcode";
import {
  Drop,
  Sparkle,
  Heart,
  ShareNetwork,
  DownloadSimple,
  X,
  Check,
  CrownSimple,
  Copy,
} from "@phosphor-icons/react";
import { Character } from "./Character";
import { fa, inviteUrl, copyText } from "../api";
import vazirRegular from "@fontsource/vazirmatn/files/vazirmatn-arabic-400-normal.woff2?url";
import vazirBold from "@fontsource/vazirmatn/files/vazirmatn-arabic-700-normal.woff2?url";
import vazirHeavy from "@fontsource/vazirmatn/files/vazirmatn-arabic-900-normal.woff2?url";
import lalezar from "@fontsource/lalezar/files/lalezar-arabic-400-normal.woff2?url";

let fontPromise;
function embeddedFonts() {
  return (fontPromise ||= Promise.all(
    [
      [vazirRegular, "Vazirmatn", 400],
      [vazirBold, "Vazirmatn", 700],
      [vazirHeavy, "Vazirmatn", 900],
      [lalezar, "Lalezar", 400],
    ].map(async ([url, family, weight]) => {
      const response = await fetch(url);
      if (!response.ok)
        throw new Error("فونت کارت آماده نشد. دوباره امتحان کن.");
      const data = await response.blob();
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(data);
      });
      return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};src:url('${base64}') format('woff2');}`;
    }),
  )
    .then((x) => x.join("\n"))
    .catch((error) => {
      fontPromise = null;
      throw error;
    }));
}
export function StoryCanvas({ kind, format, data, moment, code, qr }) {
  const me = data.me,
    s = data.stats,
    count = kind === "weekly" ? s.week : s.today;
  const pair = kind === "together" || kind === "back-to-back";
  return (
    <div className={`story-canvas story-${kind} format-${format}`} dir="rtl">
      <div className="story-brand">
        <Drop size={52} weight="duotone" />
        <span>jishoo</span>
        <span className="story-brand-fa">جیشو</span>
      </div>
      <div className="story-content">
        {kind === "weekly" ? (
          <div className="weekly-polaroid">
            <h2>{me.registered ? me.name : "من"} این هفته</h2>
            <div className={`story-character-grid count-${Math.min(count, 3)}`}>
              {Array.from(
                { length: Math.min(Math.max(count, 1), 18) },
                (_, i) => (
                  <Character
                    key={i}
                    person={me}
                    size={103}
                    mood={i % 3 === 0 ? "shy" : "happy"}
                  />
                ),
              )}
            </div>
            <strong className="story-number">
              {fa(count)}
              <span>بار</span>
            </strong>
            <p>جیش کردم.</p>
            <Sparkle size={76} weight="fill" className="polaroid-star" />
            <div className="story-wordmark">جیشو</div>
          </div>
        ) : (
          <>
            <div className={`story-hero-characters ${pair ? "pair" : ""}`}>
              <Character
                person={me}
                size={pair ? 340 : 520}
                mood={pair ? "love" : "happy"}
              />
              {pair && (
                <>
                  <Heart size={93} weight="fill" className="story-pair-heart" />
                  <Character
                    person={moment?.friend || { name: "دوستم" }}
                    size={340}
                    mood="love"
                  />
                </>
              )}
            </div>
            <h2>
              {kind === "invite"
                ? "یه خبر کوچیک، یه جمع خوب"
                : kind === "together"
                  ? "ما با هم جیش کردیم!"
                  : kind === "back-to-back"
                    ? "پشت سر هم سبک شدیم!"
                    : "آخیش! جیش کردم."}
            </h2>
            <p>
              {pair
                ? `${me.name} و ${moment?.friend?.name || "دوستم"}`
                : kind === "invite"
                  ? "با دعوت من، هر دومون ۷ روز پرمیوم می‌گیریم."
                  : `جیش‌های امروز من: ${fa(s.today)}`}
            </p>
            {pair && (
              <small>
                {kind === "together"
                  ? "کمتر از یک دقیقه فاصله، یه خاطره‌ی مشترک."
                  : "یکی بعد از اون یکی، یه اتفاق کوچولو."}
              </small>
            )}
          </>
        )}
      </div>
      <div className="story-invitation">
        <div>
          {code ? (
            <>
              <span>با کد من بیا تو جمعمون</span>
              <strong dir="ltr">{code}</strong>
              <p>۷ روز پرمیوم برای هر دومون</p>
            </>
          ) : (
            <>
              <strong>بدون حساب هم می‌شه جیش کرد.</strong>
              <p>جیش کن، به دوستات خبر بده.</p>
            </>
          )}
          <span dir="ltr" className="story-domain">
            jishoo.vercel.app
          </span>
        </div>
        {qr && <img className="story-qr" src={qr} alt="QR لینک جیشو" />}
      </div>
      <div className="story-bottom-line">
        <Heart size={30} weight="fill" /> زندگی همین لحظه‌های کوچیکه.
      </div>
    </div>
  );
}
export default function Stories({
  data,
  pendingInvite,
  onAuth,
  notify,
  initialMoment = null,
  initialKind = null,
  onClose,
}) {
  const [kind, setKind] = useState(
      initialMoment?.kind || initialKind || "weekly",
    ),
    [format, setFormat] = useState("story"),
    [selected, setSelected] = useState(Boolean(initialMoment || initialKind)),
    [qr, setQr] = useState(""),
    [image, setImage] = useState(null),
    [exportError, setExportError] = useState(""),
    [preparing, setPreparing] = useState(false);
  const card = useRef(),
    generation = useRef(0);
  const moment = initialMoment || data.moments[0];
  const code = data.me.inviteCode || pendingInvite?.code;
  const url = inviteUrl(data, code);
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(url, {
      width: 180,
      margin: 1,
      color: { dark: "#303348", light: "#fff9e9" },
    }).then((value) => active && setQr(value));
    return () => {
      active = false;
    };
  }, [url]);
  useEffect(() => {
    if (!selected || !qr || !card.current) return;
    const version = ++generation.current;
    setImage(null);
    setPreparing(true);
    setExportError("");
    let active = true;
    (async () => {
      await document.fonts.ready;
      const fontEmbedCSS = await embeddedFonts();
      const blob = await toBlob(card.current, {
        width: 1080,
        height: format === "story" ? 1920 : 1080,
        pixelRatio: 1,
        fontEmbedCSS,
        style: { transform: "none", transformOrigin: "top left" },
        skipAutoScale: true,
      });
      if (active && version === generation.current) {
        if (!blob) throw new Error("کارت آماده نشد.");
        setImage(blob);
      }
    })()
      .catch((error) => {
        if (active)
          setExportError(error.message || "کارت آماده نشد. دوباره امتحان کن.");
      })
      .finally(() => {
        if (active) setPreparing(false);
      });
    return () => {
      active = false;
    };
  }, [
    selected,
    qr,
    kind,
    format,
    data.stats.week,
    data.stats.today,
    data.me.name,
    code,
    moment?.id,
  ]);
  function download() {
    if (!image) return;
    const link = document.createElement("a");
    const objectURL = URL.createObjectURL(image);
    link.href = objectURL;
    link.download = `jishoo-${kind}-${format}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(objectURL), 10000);
    notify("تصویر کارت برای ذخیره آماده شد.");
  }
  async function shareImage() {
    if (!image) return;
    const file = new File([image], `jishoo-${kind}.png`, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: "جیشو",
          text: code ? `دعوت من به جیشو: ${code}` : "جیش کردم، خبر دادم!",
        });
        return;
      } catch (error) {
        if (error.name === "AbortError") return;
      }
    }
    download();
  }
  async function shareLink() {
    try {
      if (navigator.share)
        await navigator.share({
          title: "دعوت به جیشو",
          text: code
            ? "با دعوت من، هر دومون ۷ روز پرمیوم می‌گیریم."
            : "بدون حساب هم می‌شه جیش کرد.",
          url,
        });
      else {
        await copyText(url);
        notify("لینک جیشو کپی شد.");
      }
    } catch (error) {
      if (error.name !== "AbortError") notify(error.message);
    }
  }
  if (!selected)
    return (
      <section className="page stories-page">
        <header className="page-title">
          <div>
            <h1>خبرتو استوری کن</h1>
            <p>کارت آماده، شخصیت خودت، یه دعوت کوچولو</p>
          </div>
          <ShareNetwork size={26} weight="duotone" />
        </header>
        <div className="story-selection-list">
          {[
            ["weekly", "اینهفته‌ی من", "تعداد جیش‌های این هفته"],
            ["checkin", "آخیش، جیش کردم!", "یه خبر کوچولو برای دوستات"],
            ["invite", "دعوت به جمعمون", "کد دعوت و ۷ روز پرمیوم"],
          ].map(([key, title, description]) => (
            <button
              key={key}
              className={`story-selection-card ${key}`}
              onClick={() => {
                setKind(key);
                setSelected(true);
              }}
            >
              <div className="story-thumb">
                <Character
                  person={data.me}
                  size={65}
                  mood={key === "invite" ? "love" : "happy"}
                />
                {key === "weekly" && <strong>{fa(data.stats.week)}</strong>}
                {key === "invite" && <Heart size={22} weight="fill" />}
              </div>
              <div>
                <h2>{title}</h2>
                <p>{description}</p>
                <span>استوری و پست آماده‌ی اشتراک</span>
              </div>
              <ShareNetwork size={18} />
            </button>
          ))}
        </div>
        {moment && (
          <button
            className="moment-story-link"
            onClick={() => {
              setKind(moment.kind);
              setSelected(true);
            }}
          >
            <Character person={data.me} size={45} mood="love" />
            <Character person={moment.friend} size={45} mood="love" />
            <span>خاطره‌ی مشترکت با {moment.friend.name}</span>
            <ShareNetwork size={17} />
          </button>
        )}
        <div className="story-friendly-note">
          <ShieldNote />
          <p>
            استوری رو خودت به اشتراک می‌ذاری. چیزی خودکار برای کسی فرستاده
            نمی‌شه.
          </p>
        </div>
        {!data.me.registered && (
          <div className="soft-signup-card">
            <p>با یه دعوت عضو شو تا کارت‌هات کد دعوت خودت رو داشته باشن.</p>
            <button onClick={onAuth}>
              عضویت با دعوت <CrownSimple size={16} />
            </button>
          </div>
        )}
      </section>
    );
  return (
    <section className="story-editor">
      <header>
        <button
          aria-label="بستن کارت اشتراک"
          onClick={() => {
            if (onClose) onClose();
            else setSelected(false);
          }}
        >
          <X size={22} />
        </button>
        <h1>کارت خبر من</h1>
        <button onClick={shareLink} aria-label="اشتراک لینک دعوت">
          <ShareNetwork size={20} />
        </button>
      </header>
      <div className="segmented story-format">
        <button
          className={format === "story" ? "active" : ""}
          onClick={() => setFormat("story")}
        >
          استوری ۹:۱۶
        </button>
        <button
          className={format === "square" ? "active" : ""}
          onClick={() => setFormat("square")}
        >
          پست ۱:۱
        </button>
      </div>
      <div className={`story-preview-wrap ${format}`}>
        <div className="story-preview-scale" ref={card}>
          <StoryCanvas
            kind={kind}
            format={format}
            data={data}
            moment={moment}
            code={code}
            qr={qr}
          />
        </div>
      </div>
      <div className="story-export-controls">
        <span className="export-state" role="status">
          {preparing
            ? "داریم تصویر رو آماده می‌کنیم…"
            : exportError
              ? exportError
              : image
                ? "تصویر باکیفیت آماده‌ست."
                : "در حال آماده‌سازی…"}
        </span>
        <button
          className="button button-lilac"
          onClick={shareImage}
          disabled={!image || preparing}
        >
          <ShareNetwork size={20} /> اشتراک تصویر
        </button>
        <div className="story-secondary-buttons">
          <button onClick={download} disabled={!image}>
            <DownloadSimple size={17} /> ذخیره PNG
          </button>
          <button
            onClick={async () => {
              try {
                await copyText(url);
                notify("لینک دعوت کپی شد.");
              } catch (error) {
                notify(error.message);
              }
            }}
          >
            <Copy size={17} /> کپی لینک
          </button>
        </div>
        {!data.me.registered && !code && (
          <small>
            کارت مهمان لینک جیشو داره؛ کد شخصی بعد از عضویت ساخته می‌شه.
          </small>
        )}
      </div>
    </section>
  );
}
function ShieldNote() {
  return <Check size={22} />;
}
