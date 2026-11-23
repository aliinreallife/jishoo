import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import { ArrowRight, Drop, Heart, Phone, ShieldCheck } from "@phosphor-icons/react";
import { Avatar } from "./Character";
import { Mascot, PairArt } from "./Mascot";
import Button from "./Button";
import { api, getInvite, fa, inviteGiftLabel } from "../api";
const GoogleBanner = lazy(() => import("./GoogleAccount").then(module => ({ default: module.GoogleBanner })));

export default function AuthWizard({ invitation, onComplete, onGuest, onWaiting, notify, authInfo, inviteOnly = true }) {
  const [stage, setStage] = useState(
      authInfo?.pendingGoogle ? (inviteOnly && authInfo.waitlisted && !invitation?.code ? "waiting" : inviteOnly ? "invite" : "register") : "entry",
    ),
    [phone, setPhone] = useState(authInfo?.waitlistPhone || ""),
    [challenge, setChallenge] = useState(null),
    [otp, setOtp] = useState(""),
    [ticket, setTicket] = useState(authInfo?.pendingGoogle ? "google" : ""),
    [name, setName] = useState(""),
    [code, setCode] = useState(invitation?.code || sessionStorage.getItem("jishoo:signup-invite") || ""),
    [invite, setInvite] = useState(invitation),
    [completed, setCompleted] = useState(null),
    [requiresInvite, setRequiresInvite] = useState(inviteOnly),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const mounted = useRef(true),
    verifying = useRef(false),
    inviteChecked = useRef(false);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );
  useEffect(() => {
    if (invitation?.code && !code) {
      setCode(invitation.code);
      setInvite(invitation);
    }
  }, [invitation?.code]);
  useEffect(() => {
    if (stage !== "invite" || inviteChecked.current) return;
    const candidate = invitation?.code || (authInfo?.pendingGoogle && code);
    if (!candidate) return;
    let active = true;
    setBusy(true);
    getInvite(candidate).then((value) => {
      if (!active) return;
      if (value.remaining === 0) throw new Error("این دعوت استفاده شده؛ از دوستت یه دعوت تازه بگیر.");
      inviteChecked.current = true;
      setInvite(value); setCode(value.code); setBusy(false);
      sessionStorage.setItem("jishoo:signup-invite", value.code);
      setStage(authInfo?.pendingGoogle ? "register" : "phone");
    }).catch((error) => active && setError(error.message)).finally(() => active && setBusy(false));
    return () => { active = false; };
  }, [invitation?.code, authInfo?.pendingGoogle, stage]);
  async function continueInvite(event) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const value = await getInvite(code.trim());
      if (value.remaining === 0) throw new Error("این دعوت استفاده شده؛ از دوستت یه دعوت تازه بگیر.");
      setInvite(value); setCode(value.code);
      sessionStorage.setItem("jishoo:signup-invite", value.code);
      setStage(authInfo?.pendingGoogle ? "register" : "phone");
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  async function start(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api("auth-start", { phone });
      if (!mounted.current) return;
      setChallenge(result);
      setOtp("");
      setStage("otp");
    } catch (e) {
      if (mounted.current) setError(e.message);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function verify(value) {
    if (verifying.current) return;
    verifying.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await api("auth-verify", {
        challengeId: challenge.challengeId,
        code: value,
        linkGoogle: Boolean(authInfo?.pendingGoogle),
      });
      if (!mounted.current) return;
      if (result.registered) {
        if (invite?.inviter && invite.inviter.id !== result.me.id) {
          setCompleted(result);
          setStage("connect");
        } else {
          onComplete(result);
          notify("خوش برگشتی!");
        }
      } else {
        setTicket(result.ticket);
        setRequiresInvite(result.inviteOnly);
        setStage("register");
      }
    } catch (e) {
      if (mounted.current) setError(e.message);
    } finally {
      verifying.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  useEffect(() => {
    if (stage !== "otp" || !challenge) return;
    const timer = setTimeout(() => {
      setOtp("123456");
      verify("123456");
    }, 1500);
    return () => clearTimeout(timer);
  }, [stage, challenge]);
  async function register(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api("register", {
        linkGoogle: Boolean(authInfo?.pendingGoogle),
        provider: ticket === "google" ? "google" : "phone",
        ticket,
        name,
        inviteCode: code,
        connectInviter: false,
      });
      if (!mounted.current) return;
      if (invite?.inviter) {
        setCompleted(result);
        setStage("connect");
      } else {
        onComplete(result);
        notify(
          `خوش اومدی ${result.me.name}! ${fa(result.bonusDays)} روز پرمیوم هدیه‌ات محفوظه.`,
        );
      }
    } catch (e) {
      if (mounted.current) setError(e.message);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function checkInvite() {
    if (!code.trim()) {
      setInvite(null);
      return;
    }
    try {
      setInvite(await getInvite(code.trim()));
      setError("");
    } catch (e) {
      setInvite(null);
      setError(e.message);
    }
  }
  return (
    <div className="auth-wizard">
      {stage === "entry" ? (
        <div className="auth-entry-step">
          <PairArt size={170} />
          <h2>بیا تو جیشو</h2>
          <p className="dialog-description">با گوگل ادامه بده. اگر قبلاً عضو شدی، مستقیم وارد حسابت می‌شی؛ برای عضویت تازه، دعوت یه دوست لازمه.</p>
          {invitation?.inviter && <div className="invite-auth-summary"><Avatar person={invitation.inviter} size={42} /><p>با دعوت {invitation.inviter.name}<strong>دعوتت رو بعد از گوگل بررسی می‌کنیم.</strong></p></div>}
          <Suspense fallback={null}><GoogleBanner auth={authInfo} intent="signup" inviteCode={invitation?.code || code} notify={notify} /></Suspense>
          <button className="text-link auth-guest-action" onClick={onGuest}>فعلاً مهمان باشم</button>
          <p className="auth-demo-note">دعوت نداری؟ بعد از گوگل می‌تونی وارد فهرست انتظار بشی. مهمان هم می‌تونی جیش ثبت کنی و استوری بسازی.</p>
        </div>
      ) : stage === "waiting" ? (
        <div className="auth-waiting-step">
          <Mascot size={120} />
          <h2>تو فهرست انتظاری</h2>
          <p className="dialog-description">وقتی نوبت دعوتت برسه، به ایمیلت اطلاع می‌دیم. می‌تونی از دوستی که عضو جیشوئه هم کد دعوت بگیری و زودتر بیای تو جمع.</p>
          <span className="waitlist-email" dir="ltr">{authInfo?.pendingGoogle}</span>
          <form onSubmit={async event => {
            event.preventDefault(); setBusy(true); setError("");
            try { const saved = await api("waitlist", { consent: true, phone }); onWaiting(saved); notify("شمارهٔ تماس برای دعوتت ذخیره شد."); }
            catch (error) { setError(error.message); }
            finally { setBusy(false); }
          }}>
            <label className="field-label">شماره برای اطلاع‌رسانی دعوت (اختیاری)<input type="tel" dir="ltr" autoComplete="tel" value={phone} onChange={event => setPhone(event.target.value)} placeholder="0912 123 4567" /></label>
            <p className="auth-demo-note">این شماره برای تماس دربارهٔ دعوتته؛ هنوز تایید نشده و راه ورود به حساب نیست.</p>
            {error && <p className="form-error" role="alert">{error}</p>}
            <Button secondary type="submit" disabled={busy || !phone.trim()}>{busy ? "داریم ذخیره می‌کنیم…" : "ذخیرهٔ شمارهٔ تماس"}</Button>
          </form>
          <Button lilac onClick={onGuest}>تا اون موقع، مهمان باشم</Button>
          <button className="text-link auth-guest-action" onClick={() => { setStage("invite"); setError(""); }}>از دوستم کد دعوت گرفتم</button>
        </div>
      ) : stage === "invite" ? (
        <div className="invite-first-step">
          <PairArt size={170} />
          <span className="little-pill">گوگلت تایید شد</span>
          <span className="waitlist-email" dir="ltr">{authInfo?.pendingGoogle}</span>
          <h2>کد دعوت داری؟</h2>
          <p className="dialog-description">برای عضویت، دعوت یکی از دوست‌هات لازمه. کدش رو اینجا بنویس؛ بعد فقط اسمت رو می‌پرسیم.</p>
          <form onSubmit={continueInvite}>
            <label className="field-label">کد دعوت<input aria-label="کد دعوت عضویت" autoCapitalize="characters" autoComplete="off" dir="ltr" maxLength={80} value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setInvite(null); setError(""); }} placeholder="کد دوستت" required /></label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <Button lilac type="submit" disabled={busy || !code.trim()}>{busy ? "داریم دعوتت رو بررسی می‌کنیم…" : "تایید دعوت و ادامه"}<Heart size={18} /></Button>
          </form>
          <button className="text-link auth-guest-action" disabled={busy} onClick={async () => {
            setBusy(true); setError("");
            try { const saved = await api("waitlist", { consent: true }); onWaiting(saved); setStage("waiting"); }
            catch (error) { setError(error.message); }
            finally { setBusy(false); }
          }}>دعوت ندارم؛ به فهرست انتظار بپیوندم</button>
          <p className="auth-demo-note">با پیوستن، ایمیل گوگلت رو برای اطلاع‌رسانی دعوت نگه می‌داریم. تا اون موقع می‌تونی مهمان باشی.</p>
          <button className="text-link" onClick={onGuest}>فعلاً مهمان باشم</button>
        </div>
      ) : stage === "phone" || stage === "login" ? (
        <>
          <div className="dialog-icon blue">
            {authInfo?.phoneLoginEnabled ? <Phone size={30} weight="duotone" /> : <Drop size={30} weight="duotone" />}
          </div>
          <h2>{authInfo?.phoneLoginEnabled ? "با شماره‌ت بیا تو جمع" : "خوش اومدی به جیشو"}</h2>
          <p className="dialog-description">
            {stage === "login" ? "رفاقت‌ها و آمارت منتظرته." : "دعوتت تایید شد؛ حالا حسابت رو بساز."}
          </p>
          {stage !== "login" && !invite && (
            <div className="invitation-required">
              <ShieldCheck size={20} />
              <div>
                <strong>ثبت‌نام فقط با دعوته</strong>
                <p>
                  برای حساب جدید، لینک یا کد یه دوست لازمه. کد نداری؟ همچنان
                  مهمان ما باش.
                </p>
              </div>
            </div>
          )}
          {stage === "phone" && invite && <div className="invite-auth-summary"><Avatar person={invite.inviter} size={42} /><p>{invite.inviter ? `با دعوت ${invite.inviter.name}` : "دعوتت تایید شد"}<strong>{inviteGiftLabel(invite)}</strong></p><button className="text-link" onClick={() => { setStage("invite"); setInvite(null); }}>تغییر دعوت</button></div>}
          {authInfo?.pendingGoogle ? (
            <div className="pending-google-note">
              گوگلت تایید شد.<span dir="ltr">{authInfo.pendingGoogle}</span>برای
              اتصال به حساب، شماره‌ت رو تایید کن. عضویت تازه هنوز به دعوت نیاز
              داره.
            </div>
          ) : (
            <Suspense fallback={null}>
              <GoogleBanner auth={authInfo} intent={stage === "login" ? "login" : "signup"} inviteCode={invite?.code || code} notify={notify} />
            </Suspense>
          )}
          {stage === "login" && <button className="text-link auth-back" onClick={() => { setStage("invite"); setError(""); }}>حساب ندارم؛ عضویت با دعوت</button>}
          {authInfo?.phoneLoginEnabled ? <><form onSubmit={start}>
            <label className="field-label">
              شماره موبایل
              <input
                autoComplete="tel"
                type="tel"
                inputMode="tel"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0912 123 4567"
                required
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <Button lilac type="submit" disabled={busy || !phone.trim()}>
              {busy
                ? "در حال آماده‌کردن ورود…"
                : authInfo?.pendingGoogle
                  ? "ادامه با شماره و اتصال گوگل"
                  : "دریافت کد ورود"}
              <ArrowRight size={18} />
            </Button>
          </form>
          <p className="auth-demo-note">
            نسخه‌ی آزمایشی: پیامکی ارسال نمی‌شه و کد خودکار تایید می‌شه.
          </p>
          </> : <p className="auth-demo-note">ورود با شماره فعلاً غیرفعاله. اگر از قبل وارد حسابتی، گوگلت رو از تنظیمات همون حساب وصل کن.</p>}
        </>
      ) : stage === "otp" ? (
        <>
          <Mascot size={100} mood="shy" />
          <h2>کد ورودت</h2>
          <p className="dialog-description">
            برای شماره <span dir="ltr">{challenge.maskedPhone}</span>
          </p>
          <label className="field-label otp-label">
            کد شش‌رقمی
            <input
              value={otp}
              onChange={(e) =>
                setOtp(e.target.value.replace(/[^0-9۰-۹]/g, "").slice(0, 6))
              }
              inputMode="numeric"
              autoComplete="one-time-code"
              dir="ltr"
              maxLength={6}
              placeholder="— — — — — —"
              aria-label="کد شش‌رقمی"
            />
          </label>
          <p className="auth-demo-note">
            حالت دمو؛ کد تا چند لحظه دیگه خودکار تایید می‌شه.
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <Button
            lilac
            disabled={busy || otp.length !== 6}
            onClick={() => verify(otp)}
          >
            {busy ? "در حال تایید…" : "تایید کد"}
          </Button>
          <button
            className="text-link auth-back"
            onClick={() => {
              setStage("phone");
              setError("");
            }}
          >
            ویرایش شماره
          </button>
        </>
      ) : stage === "connect" ? (
        <div className="invite-connect-step">
          <PairArt size={230} />
          <span className="little-pill">قدم دوم · دوستی با اجازهٔ تو</span>
          <h2>به {invite.inviter.name} وصل بشیم؟</h2>
          <p>
            {(completed.bonusDays || completed.lifetimeGift) ? "حسابت ساخته شد!" : "خوش برگشتی!"} با
            وصل‌شدن، حال‌و‌احوال دوستاتی هم رو می‌بینین. لینک‌های اجتماعی‌ت فقط با
            اجازهٔ جداگانه به اشتراک گذاشته می‌شن.
          </p>
          <Button
            lilac
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const relation = completed.friends.find(
                  (f) => f.id === invite.inviter.id,
                );
                if (relation?.status === "pending" && relation.incoming)
                  await api("connection-respond", {
                    id: relation.connectionId,
                    accept: true,
                  });
                else if (relation?.status !== "accepted")
                  await api("connection-request", {
                    handle: invite.inviter.handle,
                  });
                const updated = await api("bootstrap");
                onComplete(updated);
                notify(
                  updated.friends.some(
                    (f) =>
                      f.id === invite.inviter.id && f.status === "accepted",
                  )
                    ? "رفاقتتون شروع شد 💛"
                    : "درخواست دوستیت فرستاده شد.",
                );
              } catch (e) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            آره، به {invite.inviter.name} وصل بشم <Heart size={19} />
          </Button>
          <button
            className="text-link"
            disabled={busy}
            onClick={() => onComplete(completed)}
          >
            فعلاً نه؛ بعداً از درخواست‌های دوستی
          </button>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>
      ) : (
        <>
          {ticket === "google" && (
            <div className="pending-google-note">
              گوگلت تایید شد؛ اینجا فقط اسمت رو بنویس.
              <span dir="ltr">{authInfo?.pendingGoogle}</span>
            </div>
          )}
          <div className="name-character-preview">
            <Avatar
              name={name.trim() || "دوست تازه"}
              size={123}
              mood="shy"
              animate
            />
          </div>
          <h2>اسمت چیه؟</h2>
          <p className="dialog-description">
            شخصیتت از روی اسمت ساخته می‌شه؛ یه چهرهٔ مخصوص خودت.
          </p>
          {ticket === "google" && authInfo?.phoneLoginEnabled && (
            <button
              className="text-link"
              onClick={() => {
                setStage("phone");
                setTicket("");
              }}
            >
              از قبل با شماره عضو شدم؛ همون حساب رو وصل کنم
            </button>
          )}
          <form onSubmit={register}>
            <label className="field-label">
              اسمت
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                placeholder="مثلاً سارا"
                autoComplete="given-name"
                required
              />
            </label>
            {invite && (
              <div className="invite-auth-summary">
                {invite.inviter ? (
                  <Avatar person={invite.inviter} size={39} />
                ) : (
                  <Mascot size={39} />
                )}
                <p>
                  {invite.inviter
                    ? `با دعوت ${invite.inviter.name}`
                    : "دعوتِ شروع جیشو"}
                  <strong>دعوت تایید شده · {inviteGiftLabel(invite)}</strong>
                </p>
              </div>
            )}
            {invite && <button className="text-link change-invitation" type="button" onClick={() => { setStage("invite"); setError(""); }}>تغییر دعوت</button>}
            {error && (
              <p className="form-error" role="alert">{error}</p>
            )}
            <Button
              lilac
              type="submit"
              disabled={
                busy ||
                name.trim().length < 2 ||
                (requiresInvite && !code.trim()) ||
                invite?.remaining === 0
              }
            >
              {busy ? "داریم حسابت رو می‌سازیم…" : "ساخت حساب من"}
              <Heart size={19} weight="duotone" />
            </Button>
          </form>
          <p className="signup-legal">
            با ساخت حساب،{" "}
            <a href="/terms" target="_blank" rel="noreferrer">
              شرایط استفاده
            </a>{" "}
            و{" "}
            <a href="/privacy" target="_blank" rel="noreferrer">
              حریم خصوصی
            </a>{" "}
            رو می‌پذیری.
          </p>
          <p className="auth-demo-note">
            این روزها پرمیوم مهمون مایی. روزهای هدیه‌ات محفوظه و بعد از آزمایش
            شروع می‌شه.
          </p>
        </>
      )}
    </div>
  );
}
