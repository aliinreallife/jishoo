import React, { useState, useRef, useEffect } from "react";
import QRCode from "qrcode";
import { Drop, Sparkle, Heart, ShareNetwork, DownloadSimple, X, Check, CrownSimple, Copy } from "@phosphor-icons/react";
import { Mascot, PairArt } from "./Mascot";
import { renderStoryImage, headlines } from "../story-renderer";
import "./Stories.css";
import { fa, inviteUrl, copyText } from "../api";

export default function Stories({
  data,
  pendingInvite,
  onAuth,
  notify,
  initialMoment = null,
  initialKind = null,
  onClose,
  undo = null,
}) {
  const [kind, setKind] = useState(
      initialMoment?.kind || initialKind || "weekly",
    ),
    [format, setFormat] = useState("story"),
    [theme, setTheme] = useState(
      !initialMoment && (!initialKind || initialKind === "weekly")
        ? "lavender"
        : "lemon",
    ),
    [caption, setCaption] = useState(""),
    [selected, setSelected] = useState(Boolean(initialMoment || initialKind)),
    [qr, setQr] = useState(""),
    [image, setImage] = useState(null),
    [imageURL, setImageURL] = useState(""),
    [exportError, setExportError] = useState(""),
    [preparing, setPreparing] = useState(false);
  const editor = useRef(),
    previewStage = useRef(),
    generation = useRef(0);
  useEffect(() => {
    if (!selected || !editor.current || !previewStage.current) return;
    const stage = previewStage.current;
    const resize = () => {
      const height = format === "story" ? 1920 : 1080;
      const bounds = stage.getBoundingClientRect();
      const scale = Math.max(0.01, Math.min((bounds.width - 4) / 1080, (bounds.height - 4) / height, 0.46));
      stage.style.setProperty("--preview-width", `${1080 * scale}px`);
      stage.style.setProperty("--preview-height", `${height * scale}px`);
      stage.style.setProperty("--preview-scale", String(scale));
    };
    const viewport = () => {
      editor.current?.style.setProperty("--story-editor-height", `${Math.min(innerHeight, window.visualViewport?.height || innerHeight)}px`);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    viewport();
    resize();
    window.addEventListener("resize", viewport);
    window.visualViewport?.addEventListener("resize", viewport);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", viewport);
      window.visualViewport?.removeEventListener("resize", viewport);
    };
  }, [selected, format]);
  const moment = initialMoment || data.moments[0];
  const code =
    kind !== "invite"
      ? null
      : data.invitationQuota?.remaining === 0
        ? null
        : data.me.inviteCode ||
          (pendingInvite?.remaining !== 0 ? pendingInvite?.code : null);
  const url =
    !code && data.me.handle
      ? `${data.publicUrl}/u/${data.me.handle}`
      : inviteUrl(data, code);
  useEffect(() => {
    let active = true;
    if (kind !== "invite") {
      setQr("");
      return;
    }
    QRCode.toDataURL(url, {
      width: 180,
      margin: 1,
      color: { dark: "#303348", light: "#fff9e9" },
    }).then((value) => active && setQr(value));
    return () => {
      active = false;
    };
  }, [url, kind]);
  useEffect(() => {
    if (!selected || (kind === "invite" && !qr)) return;
    const version = ++generation.current;
    setImage(null);
    setPreparing(true);
    setExportError("");
    let active = true;
    (async () => {
      const blob = await renderStoryImage({ kind, format, theme, caption, data, moment, code, qr });
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
    theme,
    caption,
    format,
    data.stats.week,
    data.stats.today,
    data.me.name,
    code,
    moment?.id,
  ]);
  useEffect(() => {
    if (!image) { setImageURL(""); return; }
    const url = URL.createObjectURL(image); setImageURL(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);
  function download() {
    if (!image) return;
    const link = document.createElement("a");
    const objectURL = URL.createObjectURL(image);
    link.href = objectURL;
    link.download = `jishoo-${kind}-${format}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
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
          text: `${caption || headlines[kind] || "لحظه‌های ساده، دوستای نزدیک."}${kind === "invite" ? "\n" + url : ""}`,
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
            : "یه لحظهٔ ساده، یه لبخند مشترک.",
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
            <h1>لحظه‌ات رو استوری کن</h1>
            <p>کارت آماده، یه حس بامزه، یه دعوت دوستانه</p>
          </div>
          <ShareNetwork size={26} weight="duotone" />
        </header>
        <div className="story-selection-list">
          {[
            ["weekly", "اینهفته‌ی من", "تعداد جیش‌های این هفته"],
            ["checkin", "جیش کردم، سبک شدم!", "یه لحظه برای آدمای خودت"],
            [
              "need",
              "جیش دارم؛ الان برمی‌گردم!",
              "رفیقات رو با یه استوری صدا کن",
            ],
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
                <Mascot size={65} mood={key === "invite" ? "love" : "happy"} />
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
            <Mascot person={data.me} size={45} mood="love" />
            <Mascot size={45} mood="love" />
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
    <section className={`story-editor ${undo ? "with-undo" : ""}`} ref={editor}>
      {undo && <div className="story-undo-slot">{undo}</div>}
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
        <h1>کارت لحظهٔ من</h1>
        {kind === "invite" ? (
          <button onClick={shareLink} aria-label="اشتراک لینک دعوت">
            <ShareNetwork size={20} />
          </button>
        ) : (
          <span aria-hidden="true" />
        )}
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
      <div className="story-style-controls" aria-label="حال و هوای کارت">
        {[
          ["lemon", "آفتابی"],
          ["lavender", "یاسی"],
          ["sky", "آسمونی"],
        ].map(([key, label]) => (
          <button
            key={key}
            className={theme === key ? "active" : ""}
            aria-pressed={theme === key}
            onClick={() => setTheme(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="story-preview-stage" ref={previewStage}>
        <div className={`story-preview-wrap ${format}`}>
          <div className="story-preview-scale">
            {imageURL ? <img className="story-canvas story-raster-preview" data-kind={kind} src={imageURL} width="1080" height={format === "story" ? 1920 : 1080} alt={caption || headlines[kind] || "کارت آمار من"} /> : <div className="story-rendering" role="status">داریم کارتت رو می‌سازیم…</div>}
          </div>
        </div>
      </div>
      <label className="story-caption-field">
        متن روی کارت (اختیاری)
        <input
          aria-label="متن کارت اشتراک"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={100}
          placeholder={
            kind === "weekly"
              ? "لحظه‌های کوچیک، حس‌های بزرگ."
              : headlines[kind]?.replace(/\n/g, " ")
          }
        />
      </label>
      <div className="story-export-controls">
        <span className="export-state" role="status">
          {preparing
            ? "داریم تصویر رو آماده می‌کنیم…"
            : exportError
              ? exportError
              : image
                ? "کارت آماده‌ست؛ ذخیره کن یا بفرست."
                : "در حال آماده‌سازی…"}
        </span>
        <div className="story-export-actions">
          <button className="button button-lilac" onClick={shareImage} disabled={!image || preparing}>
            <ShareNetwork size={20} /> اشتراک تصویر
          </button>
          <button className="button button-secondary" onClick={download} disabled={!image || preparing}>
            <DownloadSimple size={19} /> ذخیره PNG
          </button>
        </div>
        <div className="story-secondary-buttons">
          {kind === "invite" && (
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
              <Copy size={17} /> کپی لینک دعوت
            </button>
          )}
        </div>
        {kind === "invite" && !data.me.registered && !code && (
          <small>کد دعوت شخصی بعد از عضویت ساخته می‌شه.</small>
        )}
      </div>
    </section>
  );
}
function ShieldNote() {
  return <Check size={22} />;
}
