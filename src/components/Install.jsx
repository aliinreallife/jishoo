import React, { useEffect, useState } from "react";
import {
  DownloadSimple,
  ShareNetwork,
  PlusSquare,
  CheckCircle,
  ArrowRight,
  DeviceMobile,
} from "@phosphor-icons/react";
import { Mascot } from "./Mascot";
import {
  isStandalone,
  isAppleMobile,
  canPromptInstall,
  promptInstall,
} from "../pwa";
import "./Install.css";
export function InstallCard() {
  const [, update] = useState(0);
  useEffect(() => {
    const listener = () => update((n) => n + 1);
    window.addEventListener("jishoo-install-change", listener);
    return () => window.removeEventListener("jishoo-install-change", listener);
  }, []);
  if (isStandalone())
    return (
      <div className="install-card installed">
        <CheckCircle size={25} />
        <div>
          <strong>جیشو همین‌جاست 💛</strong>
          <small>نسخهٔ نصب‌شده رو باز کردی.</small>
        </div>
      </div>
    );
  return (
    <div className="install-card">
      <Mascot size={66} />
      <div>
        <strong>یه جا روی صفحهٔ اصلیت</strong>
        <small>جیشو رو راحت‌تر باز کن؛ بدون گشتن تو تب‌ها.</small>
      </div>
      <a
        className="install-cta"
        href="/install"
        onClick={async (e) => {
          if (canPromptInstall()) {
            e.preventDefault();
            await promptInstall();
          }
        }}
      >
        <DownloadSimple size={18} />
        {isAppleMobile() ? "راهنمای نصب" : "نصب جیشو"}
      </a>
    </div>
  );
}
export default function Install() {
  const [prompt, setPrompt] = useState(canPromptInstall()),
    [installed, setInstalled] = useState(isStandalone()),
    [busy, setBusy] = useState(false);
  const ios = isAppleMobile();
  useEffect(() => {
    const change = () => {
      setPrompt(canPromptInstall());
      setInstalled(isStandalone());
    };
    window.addEventListener("jishoo-install-change", change);
    return () => window.removeEventListener("jishoo-install-change", change);
  }, []);
  return (
    <main className="install-page" dir="rtl">
      <a className="install-back" href="/">
        <ArrowRight size={22} />
        برگشت به جیشو
      </a>
      <Mascot size={180} />
      <span className="little-pill">کوچولو، دم دست، روی گوشی تو</span>
      <h1>{installed ? "جیشو نصب شده!" : "جیشو، کنار اپ‌های دیگه‌ت"}</h1>
      <p>
        روی صفحهٔ اصلیت یه جای کوچیک برای جیشو بذار. حسابت و دوستات همون‌جا
        منتظرتن.
      </p>
      {installed ? (
        <div className="install-complete">
          <CheckCircle size={34} />
          از همون آیکن جیشو وارد شو.
        </div>
      ) : (
        <>
          {prompt && !ios && (
            <button
              className="button button-lilac"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  if (await promptInstall()) setInstalled(true);
                } finally {
                  setBusy(false);
                  setPrompt(canPromptInstall());
                }
              }}
            >
              <DownloadSimple size={22} />
              {busy ? "در حال نصب…" : "نصب جیشو روی گوشی"}
            </button>
          )}
          <div className="install-steps">
            <h2>{ios ? "نصب روی آیفون و آیپد" : "نصب در Chrome اندروید"}</h2>
            {ios ? (
              <>
                <p>
                  <b>۱</b>
                  <span>
                    این صفحه رو در <strong>Safari</strong> باز کن.
                  </span>
                </p>
                <p>
                  <b>۲</b>
                  <span>
                    دکمهٔ اشتراک‌گذاری <ShareNetwork size={19} /> رو بزن.
                  </span>
                </p>
                <p>
                  <b>۳</b>
                  <span>
                    <strong>Add to Home Screen</strong> <PlusSquare size={19} />{" "}
                    رو انتخاب کن، بعد <strong>Add</strong>.
                  </span>
                </p>
              </>
            ) : (
              <>
                <p>
                  <b>۱</b>
                  <span>منوی سه‌نقطهٔ Chrome رو باز کن.</span>
                </p>
                <p>
                  <b>۲</b>
                  <span>
                    <strong>Install app</strong> یا{" "}
                    <strong>Add to Home screen</strong> رو بزن.
                  </span>
                </p>
                <p>
                  <b>۳</b>
                  <span>نصب رو تایید کن و از آیکن جیشو وارد شو.</span>
                </p>
              </>
            )}
          </div>
        </>
      )}
      <div className="install-note">
        <DeviceMobile size={25} />
        <p>
          اعلان‌ها جداگانه و فقط با اجازهٔ تو روشن می‌شن.
          {ios
            ? " روی آیفون، بعد از نصب، جیشو رو از صفحهٔ اصلی باز کن و از پروفایل اعلان‌ها رو فعال کن."
            : ""}{" "}
          برای خبرهای تازه و ثبت فعالیت به اینترنت نیاز داری.
        </p>
      </div>
      <a className="button button-secondary" href="/">
        برگشت به جیشو
      </a>
    </main>
  );
}
