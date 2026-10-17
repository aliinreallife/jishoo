import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  lazy,
  Suspense,
} from "react";
import { createPortal } from "react-dom";
import "./styles.css";
import "./v2.css";
import "./community.css";
import "./v3.css";
import "./readability.css";
import "./desktop-frame.css";
import { currentRelease, releaseStorageKey } from "./releases";
import { ReleaseNotes } from "./components/ReleaseNotes";
import {
  House,
  UsersThree,
  User,
  MapPin,
  ShareNetwork,
  Drop,
  Heart,
  Plus,
  X,
  ArrowRight,
  CaretLeft,
  CrownSimple,
  GearSix,
  Phone,
  Check,
  Copy,
  UserPlus,
  ShieldCheck,
  LinkSimple,
  ArrowSquareOut,
  InstagramLogo,
  TelegramLogo,
  XLogo,
  SignOut,
  Trash,
  Smiley,
  Bell,
  BellSlash,
  LockKey,
  ArrowCounterClockwise,
  Medal,
  NavigationArrow,
} from "@phosphor-icons/react";
import { Avatar } from "./components/Character";
import { Mascot, PairArt } from "./components/Mascot";
import { syncPush, disablePush } from "./push";
const AccountConnections = lazy(() => import("./components/GoogleAccount"));
const GoogleBanner = lazy(() =>
  import("./components/GoogleAccount").then((m) => ({
    default: m.GoogleBanner,
  })),
);
const Install = lazy(() => import("./components/Install"));
const InstallCard = lazy(() =>
  import("./components/Install").then((m) => ({ default: m.InstallCard })),
);
const Support = lazy(() => import("./components/Support"));
const Friends = lazy(() => import("./components/Friends"));
const Stats = lazy(() => import("./components/Stats"));
const Legal = lazy(() => import("./components/Legal"));
const GroupJoin = lazy(() => import("./components/GroupJoin"));
const PhotoEditor = lazy(() => import("./components/PhotoEditor"));
import InvitationQuota from "./components/InvitationQuota";
import SharedMemories from "./components/SharedMemories";
import SocialConnection, { SocialAccountFields } from "./components/SocialConnection";
const communityView = (name) => {
  const View = lazy(() =>
    import("./components/Community").then((module) => ({
      default: module[name],
    })),
  );
  return function DeferredCommunity(props) {
    return (
      <Suspense fallback={<LoadingSection />}>
        <View {...props} />
      </Suspense>
    );
  };
};
const Admin = communityView("Admin"),
  Achievements = communityView("Achievements"),
  Notifications = communityView("Notifications"),
  PublicProfile = communityView("PublicProfile");
const Nearby = lazy(() => import("./components/Nearby"));
const Stories = lazy(() => import("./components/Stories"));
const HomeNotifications = lazy(() => import("./components/HomeNotifications"));
import { api, getInvite, fa, relativeTime, inviteUrl, copyText, inviteGiftLabel } from "./api";

const assets = `${import.meta.env.BASE_URL}assets/`;
function LoadingSection() {
  return (
    <div className="section-loading" role="status">
      <Mascot size={74} mood="shy" />
      <p>داریم این قسمت رو آماده می‌کنیم…</p>
    </div>
  );
}
const routes = [
  "home",
  "nearby",
  "friends",
  "stories",
  "profile",
  "stats",
  "invite",
  "circle",
  "achievements",
  "notifications",
  "admin",
  "publicProfile",
  "groupJoin",
  "privacy",
  "terms",
  "support",
  "install",
];
const readRoute = () => {
  if (
    ["/privacy", "/terms", "/support", "/install"].includes(location.pathname)
  )
    return location.pathname.slice(1);
  if (new URLSearchParams(location.search).get("group") && !location.hash)
    return "groupJoin";
  const value = location.hash.replace(/^#\/?/, "").split("/")[0];
  if (!value && /^\/u\/[a-z0-9_]+\/?$/i.test(location.pathname))
    return "publicProfile";
  if (value === "discover") return "nearby";
  return routes.includes(value) ? value : "home";
};
const readStoryKind = () => {
  const value = location.hash.split("/")[2];
  return ["weekly", "checkin", "invite", "need"].includes(value) ? value : null;
};
function Button({ children, secondary, lilac, className = "", ...props }) {
  return (
    <button
      className={`button ${secondary ? "button-secondary" : lilac ? "button-lilac" : "button-primary"} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
function IconButton({ icon: Icon, label, ...props }) {
  return (
    <button className="icon-button" aria-label={label} {...props}>
      <Icon size={23} />
    </button>
  );
}
function Brand({ small = false }) {
  return (
    <div className={`brand ${small ? "brand-small" : ""}`}>
      <span>جیشو</span>
      <Heart weight="fill" className="brand-heart" />
    </div>
  );
}
function Header({ title, subtitle, back, action }) {
  return (
    <header className="page-header">
      {back ? (
        <IconButton icon={ArrowRight} label="برگشت" onClick={back} />
      ) : (
        <span className="header-spacer" />
      )}
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action || <span className="header-spacer" />}
    </header>
  );
}
function Modal({
  children,
  onClose,
  className = "",
  hideClose = false,
  fullscreen = false,
  labelledBy,
  focusTarget,
}) {
  const dialog = useRef();
  const [framed, setFramed] = useState(() => window.matchMedia("(min-width: 501px) and (min-height: 600px)").matches);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 501px) and (min-height: 600px)");
    const update = () => setFramed(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!fullscreen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [fullscreen]);
  useEffect(() => {
    const previous = document.activeElement;
    (dialog.current?.querySelector(focusTarget || "button:not(:disabled),input:not(:disabled)"))?.focus();
    const escape = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("keydown", escape);
      previous?.focus();
    };
  }, [focusTarget]);
  const content = (
    <div
      className={`overlay-backdrop ${className.includes("full") ? "full-overlay" : ""} ${fullscreen ? "viewport-overlay" : ""}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label="پنجره جیشو"
        aria-labelledby={labelledBy}
        className={`dialog ${className}`}
        onKeyDown={(e) => {
          if (e.key !== "Tab") return;
          const controls = e.currentTarget.querySelectorAll(
            "button:not(:disabled),input:not(:disabled),a[href]",
          );
          if (!controls.length) return;
          if (e.shiftKey && document.activeElement === controls[0]) {
            e.preventDefault();
            controls[controls.length - 1].focus();
          } else if (
            !e.shiftKey &&
            document.activeElement === controls[controls.length - 1]
          ) {
            e.preventDefault();
            controls[0].focus();
          }
        }}
      >
        {!hideClose && (
          <button
            className="icon-button close-dialog"
            onClick={onClose}
            aria-label="بستن"
          >
            <X size={21} />
          </button>
        )}
        {children}
      </section>
    </div>
  );
  return fullscreen ? createPortal(content, framed ? document.querySelector(".app-shell:not(.invite-fullscreen-shell)") || document.body : document.body) : content;
}
function CheckinUndo({ pending, onUndo, inline = false }) {
  return (
    <div
      className={`undo-checkin ${inline ? "undo-inline" : ""}`}
      role="status"
      aria-live="polite"
    >
      <span className="undo-countdown" aria-label={`${fa(pending.seconds)} ثانیه فرصت لغو`}>
        {fa(pending.seconds)}
      </span>
      <div>
        <strong>{pending.status === "done" ? "جیش کردم" : "جیش دارم"}</strong>
        <span>هنوز ثبت نشده</span>
      </div>
      <button onClick={onUndo}>
        <ArrowCounterClockwise size={18} />
        لغو ثبت
      </button>
    </div>
  );
}
function StoryDialog({ children, onClose, label = "کارت اشتراک جیشو" }) {
  const dialog = useRef();
  useEffect(() => {
    const previous = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    const escape = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("keydown", escape);
      previous?.focus();
      document.body.style.overflow = previousOverflow;
    };
  }, []);
  return createPortal(
    <div
      className="full-story-overlay"
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = event.currentTarget.querySelectorAll(
          "button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled)",
        );
        if (!controls.length) return;
        if (event.shiftKey && document.activeElement === controls[0]) {
          event.preventDefault();
          controls[controls.length - 1].focus();
        } else if (
          !event.shiftKey &&
          document.activeElement === controls[controls.length - 1]
        ) {
          event.preventDefault();
          controls[0].focus();
        }
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
function AuthWizard({ invitation, onComplete, notify, authInfo, inviteOnly = true }) {
  const [stage, setStage] = useState(
      inviteOnly ? "invite" : authInfo?.pendingGoogle ? "register" : "phone",
    ),
    [phone, setPhone] = useState(""),
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
      {stage === "invite" ? (
        <div className="invite-first-step">
          <PairArt size={190} />
          <span className="little-pill">قدم اول · دعوت به جمعمون</span>
          <h2>دعوتت رو وارد کن</h2>
          <p className="dialog-description">برای عضویت، کد یکی از دوستات رو وارد کن. بعد با گوگل ادامه می‌دی.</p>
          <form onSubmit={continueInvite}>
            <label className="field-label">کد دعوت<input aria-label="کد دعوت عضویت" autoCapitalize="characters" autoComplete="off" dir="ltr" maxLength={80} value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setInvite(null); setError(""); }} placeholder="کد دوستت" required /></label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <Button lilac type="submit" disabled={busy || !code.trim()}>{busy ? "داریم دعوتت رو بررسی می‌کنیم…" : "تایید دعوت و ادامه"}<Heart size={18} /></Button>
          </form>
          <button className="text-link auth-back" onClick={() => { setStage("login"); setBusy(false); setError(""); }}>قبلاً عضو شدم؛ ورود به حسابم</button>
          <p className="auth-demo-note">بدون دعوت هم مهمان مایی؛ ثبت جیش، آمار و استوری رایگانه.</p>
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
              گوگلت تایید شده. برای عضویت فقط اسمت و دعوت لازمه.
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
            <label className="field-label">
              {requiresInvite ? "کد دعوت" : "کد دعوت (اختیاری؛ ۷ روز هدیه)"}
              <input
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setInvite(null);
                }}
                onBlur={checkInvite}
                placeholder="کد دوستت"
                dir="ltr"
                required={requiresInvite}
              />
            </label>
            {requiresInvite && !code.trim() && (
              <p className="invite-required-help">
                برای ساخت حساب، کد یا لینک دعوت یکی از دوست‌هات لازمه.
              </p>
            )}
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
                  <strong>{inviteGiftLabel(invite)}</strong>
                </p>
              </div>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
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

export default function App() {
  const [data, setData] = useState(null),
    [loadError, setLoadError] = useState(""),
    [entered, setEntered] = useState(
      () =>
        localStorage.getItem("jishoo:v2-entered") === "true" ||
        location.pathname.startsWith("/u/") ||
        location.hash.startsWith("#/"),
    ),
    [screen, setScreen] = useState(readRoute),
    [storyKind, setStoryKind] = useState(readStoryKind),
    [dialog, setDialog] = useState(null),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [invitation, setInvitation] = useState(null),
    [inviteError, setInviteError] = useState(""),
    [moment, setMoment] = useState(null),
    [selectedFriend, setSelectedFriend] = useState(null),
    [selectedCircle, setSelectedCircle] = useState(
      () => location.hash.split("/")[2] || "",
    ),
    [friendCode, setFriendCode] = useState(""),
    [circleName, setCircleName] = useState(""),
    [circleMembers, setCircleMembers] = useState([]),
    [profileName, setProfileName] = useState(""),
    [profileHandle, setProfileHandle] = useState(""),
    [publicPerson, setPublicPerson] = useState(null),
    [socials, setSocials] = useState({}),
    [audience, setAudience] = useState("friends"),
    [photoFile, setPhotoFile] = useState(null),
    [pendingCheckin, setPendingCheckin] = useState(null),
    [groupHandle, setGroupHandle] = useState(""),
    [groupActionType, setGroupActionType] = useState("leave"),
    [inviteLanding, setInviteLanding] = useState(() =>
      Boolean(new URLSearchParams(location.search).get("invite")),
    );
  const pendingTimer = useRef(),
    returningVisitor = useRef(localStorage.getItem("jishoo:v2-entered") === "true"),
    releaseHandled = useRef(false),
    pendingRef = useRef(null),
    countdownTimer = useRef(),
    groupCode = useRef(new URLSearchParams(location.search).get("group") || ""),
    timer = useRef(),
    adminAccess = useRef(
      new URLSearchParams(location.search).get("adminAccess"),
    ),
    scroll = useRef(),
    lastRefresh = useRef(0),
    inviteFromUrl = useRef(
      new URLSearchParams(location.search).get("invite") ||
        sessionStorage.getItem("jishoo:invite") ||
        "",
    );
  const arrivingInvite = new URLSearchParams(location.search).get("invite");
  const inviteRecognition = !inviteLanding || !data?.me.registered ? null
    : arrivingInvite && data.me.inviteCode === arrivingInvite ? "own"
    : (arrivingInvite && data.me.joinedInviteCode === arrivingInvite) ||
      (invitation?.inviter && (data.me.invitedBy === invitation.inviter.id || data.friends.some((f) => f.id === invitation.inviter.id && f.status === "accepted"))) ? "accepted" : null;
  useEffect(() => {
    if (!inviteRecognition || screen === "groupJoin") return;
    const redirect = setTimeout(finishInviteLanding, 1400);
    return () => clearTimeout(redirect);
  }, [inviteRecognition, screen]);
  const notify = useCallback((text) => {
    setNotice(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(""), 3500);
  }, []);
  const refresh = useCallback(async () => {
    try {
      const value = await api("bootstrap");
      setData(value);
      lastRefresh.current = Date.now();
      setLoadError("");
      if (value.me.registered) setEntered(true);
      return value;
    } catch (error) {
      setLoadError(error.message);
    }
  }, []);
  useEffect(() => {
    if (!["terms", "privacy", "support", "install"].includes(readRoute()))
      refresh();
    return () => {
      clearTimeout(timer.current);
      clearTimeout(pendingTimer.current);
      clearInterval(countdownTimer.current);
    };
  }, []);
  useEffect(() => {
    const handle = location.pathname.match(/^\/u\/([a-z0-9_]+)\/?$/i)?.[1];
    if (handle)
      fetch(
        `/api/app?action=profile-public&handle=${encodeURIComponent(handle)}`,
        { credentials: "include" },
      )
        .then(async (r) => {
          const value = await r.json();
          if (!r.ok) throw new Error(value.message);
          setPublicPerson(value.profile);
        })
        .catch((e) => notify(e.message));
  }, []);
  useEffect(() => {
    if (!data?.me.registered || !adminAccess.current) return;
    const token = adminAccess.current;
    adminAccess.current = null;
    api("admin-redeem", { token })
      .then(async () => {
        await refresh();
        setEntered(true);
        navigate("admin");
        const params = new URLSearchParams(location.search);
        params.delete("adminAccess");
        history.replaceState(
          null,
          "",
          location.pathname +
            (params.size ? "?" + params.toString() : "") +
            "#/admin",
        );
        notify("خوش برگشتی، مدیر!");
      })
      .catch((e) => notify(e.message));
  }, [data?.me.registered]);
  useEffect(() => {
    if (
      !data?.me.registered ||
      data.me.isAdmin ||
      !invitation?.adminInvitation ||
      invitation.remaining === 0
    )
      return;
    const code = invitation.code;
    setInvitation(null);
    api("claim-admin", { code })
      .then(async () => {
        await refresh();
        setInviteLanding(false);
        navigate("admin");
        sessionStorage.removeItem("jishoo:invite");
        history.replaceState(null, "", location.pathname + "#/admin");
        notify("حساب مدیریتی‌ت آماده‌ست!");
      })
      .catch((error) => notify(error.message));
  }, [data?.me.registered, invitation?.code]);
  useEffect(() => {
    const change = () => {
      setScreen(readRoute());
      setStoryKind(readStoryKind());
      const parts = location.hash.split("/");
      if (parts[1] === "circle") setSelectedCircle(parts[2] || "");
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    localStorage.setItem("jishoo:v2-entered", String(entered));
  }, [entered]);
  useEffect(() => {
    scroll.current?.scrollTo({ top: 0 });
  }, [screen, entered]);
  useEffect(() => {
    if (!entered) return;
    const interval = setInterval(() => {
      if (document.visibilityState === "visible" && (!dialog || dialog === "friend")) refresh();
    }, dialog === "friend" || screen === "friends" ? 15000 : 60000);
    return () => clearInterval(interval);
  }, [entered, dialog, screen, refresh]);
  useEffect(() => {
    if (!data?.friends) return;
    setSelectedFriend((current) => current ? data.friends.find((f) => f.id === current.id) || null : null);
  }, [data?.friends]);
  useEffect(() => {
    if (!entered || !data?.me.registered) return;
    if (["friends", "circle", "notifications", "stats"].includes(screen)) refresh();
  }, [screen, selectedCircle, entered, data?.me.registered, refresh]);
  useEffect(() => {
    const resume = () => {
      if (
        entered &&
        !dialog &&
        document.visibilityState === "visible" &&
        Date.now() - lastRefresh.current > 15000
      )
        refresh();
    };
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [entered, dialog, refresh]);
  useEffect(() => {
    const code = inviteFromUrl.current;
    if (!code) return;
    sessionStorage.setItem("jishoo:invite", code);
    getInvite(code)
      .then(setInvitation)
      .catch((error) => setInviteError(error.message));
  }, []);
  useEffect(() => {
    if (!data) return;
    const params = new URLSearchParams(location.search);
    if (params.get("login") !== "1") return;
    params.delete("login");
    history.replaceState(null, "", location.pathname + (params.size ? "?" + params : "") + location.hash);
    setEntered(true);
    if (!data.me.registered) setDialog("auth");
  }, [data?.me.id]);
  useEffect(() => {
    if (!data || !entered || inviteLanding || releaseHandled.current || ["terms", "privacy", "support", "install"].includes(screen)) return;
    const seen = localStorage.getItem(releaseStorageKey);
    if (seen === currentRelease.version) { releaseHandled.current = true; return; }
    if (!seen && !returningVisitor.current && !data.me.registered) {
      localStorage.setItem(releaseStorageKey, currentRelease.version);
      releaseHandled.current = true;
      return;
    }
    if (!dialog && !pendingCheckin) setDialog("whatsNew");
  }, [data?.me.id, entered, inviteLanding, dialog, pendingCheckin, screen]);
  useEffect(() => {
    const params = new URLSearchParams(location.search),
      outcome = params.get("google");
    if (!outcome || !data) return;
    params.delete("google");
    history.replaceState(
      null,
      "",
      location.pathname +
        (params.size ? "?" + params.toString() : "") +
        location.hash,
    );
    if (outcome === "continue") {
      setDialog("auth");
      notify("گوگلت تایید شد؛ با یه دعوت، حسابت رو بساز.");
    } else if (outcome === "invite_required") {
      setDialog("auth");
      notify("با این گوگل هنوز عضو نشدی؛ اول دعوتت رو وارد کن.");
    } else if (outcome === "merge_required") {
      setEntered(true);
      setDialog("settings");
      notify("گوگلت یه حساب جدا داره؛ قبل از اتصال، هر دو حساب رو مرور کن.");
    } else if (outcome === "linked") notify("گوگلت به همین حساب وصل شد.");
    else if (outcome === "login") {
      setEntered(true);
      notify("خوش برگشتی!");
    } else if (outcome === "cancelled") notify("ورود با گوگل لغو شد.");
    else if (outcome === "conflict")
      notify("این گوگل یا این حساب از قبل یه اتصال دیگه داره.");
    else notify("ورود گوگل کامل نشد. دوباره امتحان کن.");
  }, [data?.me.id]);
  useEffect(() => {
    if (data?.me.registered) syncPush().catch(() => {});
  }, [data?.me.id, data?.me.registered]);
  function navigate(next, id) {
    if (next === "discover") next = "nearby";
    setScreen(next);
    if (next === "stories")
      setStoryKind(
        ["weekly", "checkin", "invite", "need"].includes(id) ? id : null,
      );
    if (id) setSelectedCircle(id);
    location.hash = "/" + next + (id ? "/" + id : "");
    window.dispatchEvent(new Event("jishoo:navigation"));
  }
  function finishInviteLanding() {
    setInviteLanding(false); setEntered(true); setInvitation(null);
    sessionStorage.removeItem("jishoo:invite"); inviteFromUrl.current = "";
    navigate("home");
    const params = new URLSearchParams(location.search); params.delete("invite");
    history.replaceState(null, "", location.pathname + (params.size ? "?" + params : "") + "#/home");
  }
  function openAuth() {
    setDialog("auth");
  }
  function dismissRelease() {
    localStorage.setItem(releaseStorageKey, currentRelease.version);
    releaseHandled.current = true;
    setDialog(null);
  }
  function openStory(kind) {
    setStoryKind(kind);
    setDialog("story");
  }
  function completeAuth(result) {
    setData(result);
    setEntered(true);
    setDialog(null);
    setInviteLanding(false);
    navigate(
      result.me.isAdmin
        ? "admin"
        : screen === "groupJoin" && groupCode.current
          ? "groupJoin"
          : "home",
    );
  }
  async function perform(action, body) {
    setBusy(true);
    try {
      return await api(action, body);
    } catch (error) {
      notify(error.message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  function undoCheckin() {
    if (!pendingRef.current) return;
    clearTimeout(pendingTimer.current);
    clearInterval(countdownTimer.current);
    pendingRef.current = null;
    setPendingCheckin(null);
    setBusy(false);
    setDialog(null);
    notify("ثبت لغو شد؛ چیزی برای دوستات فرستاده نشد.");
  }
  function checkin(status) {
    if (busy || pendingRef.current) return;
    clearTimeout(timer.current);
    setNotice("");
    const queued = {
      status,
      visibility: audience,
      nonce: crypto.randomUUID(),
      deadline: Date.now() + 3000,
    };
    pendingRef.current = queued;
    setPendingCheckin({ ...queued, seconds: 3 });
    setBusy(true);
    setEntered(true);
    setDialog(status === "done" ? "success" : "need");
    countdownTimer.current = setInterval(
      () =>
        setPendingCheckin((current) =>
          current
            ? {
                ...current,
                seconds: Math.max(
                  1,
                  Math.ceil((queued.deadline - Date.now()) / 1000),
                ),
              }
            : null,
        ),
      100,
    );
    pendingTimer.current = setTimeout(async () => {
      pendingRef.current = null;
      clearInterval(countdownTimer.current);
      setPendingCheckin({ ...queued, seconds: 0, saving: true });
      try {
        const result = await api("checkin", queued);
        setData((current) => ({ ...current, stats: result.stats }));
        if (result.matches?.length) {
          setMoment(result.matches[0]);
          setDialog((current) => current === "story" ? current : "moment");
          refresh();
        }
      } catch (error) {
        setDialog(null);
        notify(error.message);
      } finally {
        setPendingCheckin(null);
        setBusy(false);
      }
    }, 3000);
  }
  async function connectHandle(handle) {
    const result = await perform("connection-request", {
      handle: handle.trim(),
    });
    if (result) {
      setData((current) => ({ ...current, friends: result.friends }));
      notify("درخواست دوستیت فرستاده شد.");
    }
    return result;
  }
  async function groupMutation(action, body) {
    const result = await perform(action, body);
    if (result) {
      setData((current) => ({ ...current, circles: result.circles }));
      return result;
    }
  }
  function showGroupInvite(group) {
    setSelectedCircle(group.id);
    setGroupHandle("");
    setDialog("groupInvite");
  }
  async function shareGroupLink() {
    if (!circle?.inviteCode) return;
    const url = new URL(data.publicUrl);
    url.searchParams.set("group", circle.inviteCode);
    if (data.invitationQuota?.remaining !== 0 && me.inviteCode)
      url.searchParams.set("invite", me.inviteCode);
    try {
      if (navigator.share)
        await navigator.share({
          title: circle.name,
          text: `به گروه «${circle.name}» بیا.`,
          url: url.href,
        });
      else {
        await copyText(url.href);
        notify("لینک گروه کپی شد.");
      }
    } catch (e) {
      if (e.name !== "AbortError") notify(e.message);
    }
  }
  async function shareInvite() {
    if (data.invitationQuota?.remaining === 0) {
      notify("دعوت‌هات کامل شده؛ لینک پروفایلت رو بفرست.");
      await shareProfile();
      return;
    }
    const url = inviteUrl(data, data.me.inviteCode || invitation?.code);
    try {
      if (navigator.share)
        await navigator.share({
          title: "دعوت به جیشو",
          text: "جیشو با دوستات قشنگ‌تره. با دعوت من هر دومون ۷ روز پرمیوم می‌گیریم.",
          url,
        });
      else {
        await copyText(url);
        notify("لینک دعوت کپی شد.");
      }
    } catch (error) {
      if (error.name !== "AbortError") notify(error.message);
    }
  }
  function openSettings() {
    setProfileName(data.me.name);
    setProfileHandle(data.me.handle || "");
    setSocials(data.me.socialLinks || {});
    setDialog("settings");
  }
  async function saveProfile(e) {
    e.preventDefault();
    const result = await perform("profile", {
      name: profileName,
      ...(profileHandle.trim() ? { handle: profileHandle.trim() } : {}),
      socialLinks: socials,
    });
    if (result) {
      setData(result);
      setDialog(null);
      notify("پروفایلت ذخیره شد.");
    }
  }
  function openSocialAccounts() {
    setSocials(data.me.socialLinks || {});
    setDialog("socialAccounts");
  }
  async function saveSocialAccounts(event) {
    event.preventDefault();
    const result = await perform("profile", { socialLinks: socials });
    if (!result) return;
    setData(result);
    const friend = result.friends.find(friend => friend.id === selectedFriend?.id);
    setSelectedFriend(friend || null);
    setDialog(friend ? "friend" : null);
    notify("حساب‌های اجتماعی‌ت ذخیره شد.");
  }
  function shareProfile() {
    if (!me.registered) {
      openAuth();
      return;
    }
    setDialog("profileShare");
  }
  async function nativeShareProfile() {
    if (!me.registered) {
      openAuth();
      return;
    }
    if (!me.handle) {
      openSettings();
      notify("اول یه شناسهٔ مخصوص خودت برای خودت انتخاب کن.");
      return;
    }
    const url = `${data.publicUrl}/u/${me.handle}`;
    try {
      if (navigator.share)
        await navigator.share({
          title: `${me.name} توی جیشو`,
          text: "یه لحظه از روزت، برای دوستات.",
          url,
        });
      else {
        await copyText(url);
        notify("لینک پروفایلت کپی شد.");
      }
    } catch (e) {
      if (e.name !== "AbortError") notify(e.message);
    }
  }
  async function notificationPreference(scope, id, enabled) {
    const value = await perform("notification-pref", { scope, id, enabled });
    if (value) await refresh();
  }
  function uploadAvatar(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) setPhotoFile(file);
  }
  async function saveAvatar(image) {
    setBusy(true);
    try {
      setData(await api("avatar", { image }));
      setPhotoFile(null);
      notify("عکس پروفایلت آماده‌ست!");
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function requestFriend(e) {
    e.preventDefault();
    const result = await connectHandle(friendCode);
    if (result) {
      setData((current) => ({ ...current, friends: result.friends }));
      setFriendCode("");
      setDialog(null);
      notify("درخواست وصل‌شدن ثبت شد.");
    }
  }
  async function respondFriend(friend, accept) {
    const result = await perform("connection-respond", {
      id: friend.connectionId,
      accept,
    });
    if (result) {
      setData((current) => ({
        ...current,
        friends: result.friends,
        circles: result.circles || current.circles,
      }));
      notify(accept ? "رفاقتتون شروع شد 💛" : "اتصال حذف شد.");
      if (!accept) setDialog(null);
    }
  }
  async function changeSocialSharing(friend, operation) {
    const result = await perform("connection-share", {
      id: friend.connectionId,
      operation,
    });
    if (result) {
      setData((current) => ({ ...current, friends: result.friends }));
      setSelectedFriend(result.friends.find((f) => f.id === friend.id));
      if (operation === "accept" && !Object.values(me.socialLinks || {}).some(value => typeof value === "string" && value.trim())) {
        setDialog("socialSetup");
        return;
      }
      notify({
        request: "درخواستت فرستاده شد؛ منتظر قبول‌کردن دوستت می‌مونیم.",
        accept: "درخواست قبول شد؛ حساب‌های اضافه‌شده برای هم قابل دیدنن.",
        cancel: "درخواستت لغو شد.",
        decline: "درخواست رد شد؛ دوستی‌تون سر جاشه.",
        disconnect: "اشتراک حساب‌ها قطع شد؛ همچنان دوستین.",
      }[operation]);
    }
  }
  async function createCircle(e) {
    e.preventDefault();
    const result = await perform("circle-create", {
      name: circleName,
      members: circleMembers,
      shared: true,
    });
    if (result) {
      setData((current) => ({ ...current, circles: result.circles }));
      setDialog(null);
      setCircleName("");
      setCircleMembers([]);
      navigate("circle", result.id);
      notify("جمع خودت ساخته شد.");
    }
  }
  async function logout() {
    try {
      await disablePush();
    } catch {}
    const result = await perform("logout", {});
    if (result) {
      setEntered(false);
      setDialog(null);
      setInvitation(null);
      inviteFromUrl.current = "";
      sessionStorage.removeItem("jishoo:invite");
      history.replaceState(null, "", location.pathname);
      navigate("home");
      await refresh();
    }
  }
  const me = data?.me,
    accepted = data?.friends.filter((f) => f.status === "accepted") || [],
    pending =
      data?.friends.filter((f) => f.status === "pending" && f.incoming) || [];
  const tabs = [
    ["home", House, "خانه"],
    ["nearby", MapPin, "این نزدیکا"],
    ["friends", UsersThree, "دوست‌ها"],
    ["profile", User, "من"],
  ];
  const activeTab = [
    "stats",
    "invite",
    "achievements",
    "notifications",
    "admin",
    "publicProfile",
    "groupJoin",
    "privacy",
    "terms",
  ].includes(screen)
    ? "profile"
    : screen === "circle"
      ? "friends"
      : screen;
  const circle = data?.circles.find((x) => x.id === selectedCircle);
  if (screen === "install")
    return (
      <Suspense fallback={<LoadingSection />}>
        <Install />
      </Suspense>
    );
  if (screen === "support")
    return (
      <Suspense fallback={<LoadingSection />}>
        <Support />
      </Suspense>
    );
  if (screen === "privacy" || screen === "terms")
    return (
      <Suspense fallback={<LoadingSection />}>
        <Legal kind={screen} />
      </Suspense>
    );
  return (
    <div
      className={`desktop-stage ${inviteLanding ? "invite-fullscreen" : ""}`}
    >
      <aside className="desktop-brand" aria-hidden="true">
        <div className="desktop-brand-top">
          <Brand small />
          <span className="little-pill">بهونه‌ای برای با هم بودن</span>
        </div>
        <div className="desktop-story">
          <span className="eyebrow">
            <span />
            یه لحظهٔ ساده، یه لبخند مشترک
          </span>
          <h2>
            دوستی، به همین
            <br />
            <span>سادگی.</span>
          </h2>
          <p>
            یه لحظه از روزت، برای دوستات.
            <br />
            چیزای کوچیک، ما رو به هم نزدیک می‌کنن.
          </p>
          <img
            className="mascot desktop-mascot"
            src={assets + "shy-drop.webp"}
            alt=""
          />
        </div>
        <div className="desktop-foot">
          <ShieldCheck size={18} />
          <span>مکان تقریبی. ارتباط با اجازه‌ی خودت.</span>
          <span className="desktop-version">جیشو · بتا</span>
        </div>
      </aside>
      <main
        className={`app-shell ${!entered ? "welcome-shell" : ""} ${inviteLanding ? "invite-fullscreen-shell" : ""}`}
        dir="rtl"
      >
        {!data ? (
          <section className="loading-page">
            <img src={assets + "shy-drop.webp"} alt="قطره‌ی خجالتی جیشو" />
            <Brand small />
            <p>{loadError || "داریم جمعمون رو آماده می‌کنیم…"}</p>
            {loadError && <Button onClick={refresh}>دوباره امتحان کن</Button>}
          </section>
        ) : screen === "groupJoin" ? (
          <Suspense fallback={<LoadingSection />}>
            <GroupJoin
              code={groupCode.current}
              data={data}
              onAuth={openAuth}
              notify={notify}
              onBack={() => {
                setInviteLanding(false);
                setEntered(true);
                navigate("friends");
              }}
              onJoined={(r) => {
                setData((current) => ({ ...current, circles: r.circles }));
                setEntered(true);
                setInviteLanding(false);
                navigate("circle", r.id);
                notify("به گروه خوش اومدی.");
              }}
            />
          </Suspense>
        ) : inviteLanding ? (
          <section className={`invite-landing ${inviteRecognition ? "invite-status-screen" : ""}`}>
            <Brand small />
            {inviteRecognition ? <>
              <Mascot size={180} mood="happy" />
              <h1>{inviteRecognition === "own" ? "این دعوتِ خودته 💛" : "این دعوت رو قبلاً پذیرفتی 💛"}</h1>
              <p>داریم می‌بریمت تو جیشو؛ رفاقتت سر جاشه.</p>
              <Button lilac onClick={finishInviteLanding}>برم تو جیشو</Button>
            </> : invitation ? (
              <>
                <div className="inviter-spotlight">
                  {invitation.inviter ? (
                    <Avatar person={invitation.inviter} size={90} />
                  ) : (
                    <Mascot size={100} />
                  )}
                  <span>یه دعوت از طرف</span>
                  <h1>{invitation.inviter?.name || "جیشو"}</h1>
                  {invitation.inviter?.handle && (
                    <small dir="ltr">@{invitation.inviter.handle}</small>
                  )}
                </div>
                <h2>
                  {invitation.inviter
                    ? `${invitation.inviter.name} دوست داره اینجا باشی`
                    : "به جمع جیشو خوش اومدی"}{" "}
                  💛
                </h2>
                <PairArt size={225} />
                <div className="invite-landing-features">
                  <p>
                    <Drop size={21} />
                    «جیش دارم» یا «جیش کردم» رو ثبت کن.
                  </p>
                  <p>
                    <UsersThree size={21} />
                    دوستات رو پیدا کن و از حال‌و‌احوال هم دور نمونین.
                  </p>
                  <p>
                    <ShareNetwork size={21} />
                    با شخصیت‌های جیشو استوری آماده بساز.
                  </p>
                </div>
                <p className="invite-landing-gift">
                  {inviteGiftLabel(invitation)}
                  {!invitation.lifetimeGift && "؛ بعد از دورهٔ آزمایشی شروع می‌شه."}
                </p>
                {invitation.remaining === 0 && !me.registered ? (
                  <p className="form-error">
                    این دعوت استفاده شده؛ از دوستت یه دعوت تازه بگیر.
                  </p>
                ) : (
                  <Button
                    lilac
                    disabled={busy}
                    onClick={async () => {
                      setEntered(true);
                      if (!me.registered) {
                        openAuth();
                        return;
                      }
                      if (
                        invitation.inviter &&
                        invitation.inviter.id !== me.id
                      ) {
                        const result = await perform("connection-request", {
                          handle: invitation.inviter.handle,
                        });
                        if (!result) return;
                        setData((current) => ({
                          ...current,
                          friends: result.friends,
                        }));
                      }
                      setInviteLanding(false);
                      navigate("friends");
                    }}
                  >
                    {me.registered
                      ? "درخواست دوستی و دیدن جمعمون"
                      : "با این دعوت عضو بشم"}
                    <Heart size={19} />
                  </Button>
                )}
              </>
            ) : inviteError ? (
              <>
                <Mascot size={160} />
                <h1>این دعوت پیدا نشد</h1>
                <p className="form-error">{inviteError}</p>
              </>
            ) : (
              <LoadingSection />
            )}
            <button
              className="guest-enter-link"
              onClick={() => {
                setInviteLanding(false);
                setEntered(true);
              }}
            >
              فعلاً یه سر به جیشو بزنم <CaretLeft size={16} />
            </button>
            <small>عضویت و وصل‌شدن دو قدم جداست؛ انتخاب با توئه.</small>
          </section>
        ) : !entered ? (
          <section className="guest-welcome welcome-v4">
            <Brand small />
            <Mascot size={280} animate />
            <h1>یه لحظه از روزت، برای دوستات.</h1>
            <p>
              یه لحظه برای آدمای خودت،
              <br />
              یه حال خوب برای خودت.
            </p>
            <Button onClick={() => setEntered(true)}>
              شروع کنیم <ArrowRight size={20} />
            </Button>
            <button className="guest-signup-link" onClick={openAuth}>
              ورود یا عضویت <Phone size={17} />
            </button>
            <small>مهمان هم می‌تونی شروع کنی؛ عضویت برای بعد.</small>
            <div className="legal-links">
              <a href="/terms">شرایط استفاده</a>
              <span>·</span>
              <a href="/privacy">حریم خصوصی</a>
            </div>
            {inviteError && <p className="form-error">{inviteError}</p>}
          </section>
        ) : (
          <>
            <div
              className={`app-scroll ${screen === "nearby" ? "real-map-scroll" : ""}`}
              ref={scroll}
            >
              {screen === "home" && (
                <section className="page home v2-home">
                  <header className="home-header">
                    <div>
                      <h1>
                        {me.registered ? `سلام ${me.name}` : "سلام دوست تازه"}{" "}
                        <Smiley
                          size={23}
                          weight="duotone"
                          className="wave-icon"
                        />
                      </h1>
                      <p>حالت چطوره؟</p>
                    </div>
                    <div className="home-header-actions">
                      <button
                        className="icon-button notification-bell"
                        aria-label="حال‌و‌احوال دوستات"
                        onClick={() =>
                          me.registered ? navigate("notifications") : openAuth()
                        }
                      >
                        <Bell size={24} weight="duotone" />
                        {data.notifications?.some((n) => !n.readAt) && (
                          <span>
                            {fa(
                              data.notifications.filter((n) => !n.readAt)
                                .length,
                            )}
                          </span>
                        )}
                      </button>
                      <button
                        className="avatar-button"
                        aria-label="پروفایل من"
                        onClick={() => navigate("profile")}
                      >
                        <Avatar person={me} size={48} mood="shy" />
                      </button>
                    </div>
                  </header>
                  {invitation?.inviter &&
                    invitation.inviter.id !== me.id &&
                    !accepted.some((f) => f.id === invitation.inviter.id) && (
                      <div className="inline-invitation-card">
                        <Avatar person={invitation.inviter} size={49} />
                        <div>
                          <strong>{invitation.inviter.name} دعوتت کرده!</strong>
                          <p>یه شروع قشنگ برای رفاقت</p>
                        </div>
                        <button
                          disabled={
                            busy ||
                            data.friends.some(
                              (f) => f.id === invitation.inviter.id,
                            )
                          }
                          onClick={async () => {
                            if (!me.registered) {
                              openAuth();
                              return;
                            }
                            const value = await perform("connection-request", {
                              code: invitation.code,
                            });
                            if (value) {
                              await refresh();
                              navigate("friends");
                            }
                          }}
                        >
                          {data.friends.some(
                            (f) => f.id === invitation.inviter.id,
                          )
                            ? "درخواست در دوست‌ها"
                            : me.registered
                              ? "وصل شیم"
                              : "با دعوت بیام"}
                        </button>
                      </div>
                    )}
                  <div className="action-grid">
                    <button
                      className="action-card need-card"
                      onClick={() => checkin("need")}
                      disabled={busy}
                    >
                      <Mascot size={132} mood="shy" animate />
                      <strong>جیش دارم</strong>
                      <span>الان برمی‌گردم!</span>
                      <Drop
                        size={18}
                        weight="duotone"
                        className="action-corner"
                      />
                    </button>
                    <button
                      className="action-card done-card"
                      onClick={() => checkin("done")}
                      disabled={busy}
                    >
                      <Mascot size={132} mood="happy" animate />
                      <strong>جیش کردم</strong>
                      <span>سبک شدم!</span>
                      <Drop
                        size={19}
                        weight="duotone"
                        className="action-corner"
                      />
                    </button>
                  </div>
                  {me.registered && (
                    <label className="audience-choice">
                      <input
                        type="checkbox"
                        checked={audience === "friends"}
                        onChange={(e) =>
                          setAudience(e.target.checked ? "friends" : "private")
                        }
                      />
                      <span>دوست‌هام این جیش رو هم ببینن</span>
                    </label>
                  )}
                  <Suspense fallback={null}><HomeNotifications data={data} notify={notify} refresh={refresh} onSettings={() => navigate("notifications")} /></Suspense>
                  <section className="friends-section">
                    <div className="section-heading">
                      <h2>دوستات الان</h2>
                      <button
                        className="text-link"
                        onClick={() => navigate("friends")}
                      >
                        {accepted.length
                          ? `${fa(accepted.length)} دوست`
                          : "وصل شو"}{" "}
                        <CaretLeft size={13} />
                      </button>
                    </div>
                    {accepted.length ? (
                      accepted.slice(0, 4).map((friend) => (
                        <button
                          key={friend.id}
                          className="friend-row"
                          onClick={() => {
                            setSelectedFriend(friend);
                            setDialog("friend");
                          }}
                        >
                          <Avatar
                            person={friend}
                            size={43}
                            mood={
                              friend.latestStatus === "need" ? "shy" : "happy"
                            }
                          />
                          <span className="friend-identity">
                            <strong>{friend.name}</strong>
                            <small>{relativeTime(friend.latestAt)}</small>
                          </span>
                          {friend.latestStatus && (
                            <span
                              className={`friend-status ${friend.latestStatus}`}
                            >
                              {friend.latestStatus === "need" ? (
                                <>
                                  <Drop weight="duotone" /> جیش داره
                                </>
                              ) : (
                                <>
                                  <Drop weight="duotone" /> جیش کرد
                                </>
                              )}
                            </span>
                          )}
                        </button>
                      ))
                    ) : (
                      <div className="empty-friends-card">
                        <div>
                          <PairArt size={116} />
                        </div>
                        <p>
                          {me.registered
                            ? "با لینک دعوتت، آدمای خودت رو بیار تو جمع."
                            : "با دعوت عضو شو تا به دوستات وصل بشی."}
                        </p>
                        <button
                          onClick={() =>
                            me.registered ? navigate("invite") : openAuth()
                          }
                        >
                          {me.registered ? "دعوت از دوستام" : "عضویت با دعوت"}
                          <UserPlus size={17} />
                        </button>
                      </div>
                    )}
                  </section>
                  {pending.length > 0 && (
                    <button
                      className="pending-home"
                      onClick={() => navigate("friends")}
                    >
                      <UserPlus size={18} />
                      {fa(pending.length)} دوست منتظر جوابته
                      <CaretLeft size={15} />
                    </button>
                  )}
                  <button
                    className="nearby-card"
                    onClick={() => navigate("nearby")}
                  >
                    <div className="nearby-mini">
                      <MapPin size={33} weight="duotone" />
                      <Mascot size={38} />
                    </div>
                    <div>
                      <h2>این نزدیکا</h2>
                      <strong>آدم‌های همین دور و بر</strong>
                      <p>دیدن نقشه، مکانت رو با کسی به اشتراک نمی‌ذاره.</p>
                    </div>
                    <CaretLeft className="muted-icon" size={19} />
                  </button>
                  <div className="home-bottom">
                    <span>
                      <Drop size={15} weight="duotone" />
                      امروز {fa(data.stats.today)} بار سبک شدی
                    </span>
                    <button onClick={() => navigate("stats")}>
                      آمار من
                      <CaretLeft size={13} />
                    </button>
                  </div>
                </section>
              )}
              {screen === "nearby" && (
                <Suspense fallback={<LoadingSection />}>
                  <Nearby
                    me={me}
                    data={data}
                    refreshAccount={refresh}
                    onAuth={openAuth}
                    onConnect={connectHandle}
                    onSharingChanged={(value) =>
                      setData((current) => ({
                        ...current,
                        me: {
                          ...current.me,
                          shareLocation: value,
                          discoverable: value ? current.me.discoverable : false,
                        },
                      }))
                    }
                    notify={notify}
                  />
                </Suspense>
              )}
              {screen === "achievements" && (
                <Achievements
                  data={data}
                  onBack={() => navigate("profile")}
                  onShare={() => openStory("weekly")}
                />
              )}
              {screen === "notifications" && (
                <Notifications
                  data={data}
                  refresh={refresh}
                  notify={notify}
                  onBack={() => navigate("home")}
                  onNavigate={(route) => {
                    const value = route.split("#/")[1]?.split("/")[0];
                    navigate(routes.includes(value) ? value : "home");
                  }}
                />
              )}
              {screen === "admin" && (
                <Admin data={data} refresh={refresh} notify={notify} />
              )}
              {screen === "publicProfile" && (
                <PublicProfile
                  profile={publicPerson}
                  data={data}
                  busy={busy}
                  onBack={() => navigate("home")}
                  onConnect={async () => {
                    const value = await perform("connection-request", {
                      handle: publicPerson.handle,
                    });
                    if (value) {
                      await refresh();
                      notify("درخواستت رفت پیش دوستت!");
                      navigate("friends");
                    }
                  }}
                  onJoin={async () => {
                    try {
                      setInvitation(await getInvite(publicPerson.inviteCode));
                      openAuth();
                    } catch (error) {
                      notify(error.message);
                    }
                  }}
                />
              )}
              {(screen === "friends" || screen === "circle") && (
                <Suspense fallback={<LoadingSection />}>
                  <Friends
                    data={data}
                    group={screen === "circle" ? circle : null}
                    missingGroup={screen === "circle" && !circle}
                    busy={busy}
                    onBack={() => navigate("friends")}
                    onAdd={() => setDialog("addFriend")}
                    onCreate={() => setDialog("circle")}
                    onFriend={(friend) => {
                      setSelectedFriend(friend);
                      setDialog("friend");
                    }}
                    onRespond={respondFriend}
                    onGroup={(id) => navigate("circle", id)}
                    onInvite={showGroupInvite}
                    onGroupRespond={async (group, accept) => {
                      const r = await groupMutation("circle-respond", {
                        id: group.id,
                        accept,
                      });
                      if (r) {
                        notify(
                          accept ? "به گروه خوش اومدی." : "دعوت گروه رد شد.",
                        );
                        if (!accept) navigate("friends");
                      }
                    }}
                    onGroupLeave={(group) => {
                      setSelectedCircle(group.id);
                      setGroupActionType("leave");
                      setDialog("groupConfirm");
                    }}
                    onGroupDelete={(group) => {
                      setSelectedCircle(group.id);
                      setGroupActionType("delete");
                      setDialog("groupConfirm");
                    }}
                    onMute={notificationPreference}
                    onAuth={openAuth}
                    onConnect={connectHandle}
                  />
                </Suspense>
              )}
              {screen === "stories" && (
                <Suspense fallback={<LoadingSection />}>
                  <Stories
                    key={storyKind || "selection"}
                    initialKind={storyKind}
                    data={data}
                    pendingInvite={invitation}
                    onAuth={openAuth}
                    notify={notify}
                  />
                </Suspense>
              )}
              {screen === "profile" && (
                <section className="page profile-page v2-profile">
                  <div className="profile-top">
                    <IconButton
                      icon={GearSix}
                      label="تنظیمات پروفایل"
                      onClick={() =>
                        me.registered
                          ? openSettings()
                          : setDialog("guestSettings")
                      }
                    />
                    <div className="profile-avatar personal-character">
                      <Avatar person={me} size={125} mood="shy" animate />
                    </div>
                    <IconButton
                      icon={ShareNetwork}
                      label="اشتراک پروفایل من"
                      onClick={shareProfile}
                    />
                  </div>
                  <h1>{me.name}</h1>
                  <p className="handle" dir={me.handle ? "ltr" : undefined}>
                    {me.registered
                      ? me.handle
                        ? `@${me.handle}`
                        : "برای خودت یه شناسه انتخاب کن"
                      : "شخصیت مهمان؛ اسم لازم نیست"}
                  </p>
                  <div className="stats-row">
                    <span>
                      <strong>{fa(data.stats.week)}</strong>
                      <small>این هفته</small>
                    </span>
                    <span>
                      <strong>{fa(data.stats.today)}</strong>
                      <small>امروز</small>
                    </span>
                    <span>
                      <strong>{fa(data.stats.total)}</strong>
                      <small>همه‌وقت</small>
                    </span>
                  </div>
                  <Suspense fallback={null}>
                    <InstallCard />
                  </Suspense>
                  <button
                    className="premium-card"
                    onClick={() => setDialog("premium")}
                  >
                    <CrownSimple size={28} weight="duotone" />
                    <div>
                      <strong>
                        {me.lifetime
                          ? "پرمیوم همیشگی"
                          : data.testing
                            ? "پرمیوم برای همه فعاله"
                            : me.premium
                              ? "پرمیوم فعاله"
                              : "با جیشو، رایگان و راحت"}
                      </strong>
                      <p>
                        {me.lifetime
                          ? "یه هدیه‌ی همیشگی از جیشو، برای تو."
                          : data.testing
                            ? "تا پایان دورهٔ آزمایشی، همهٔ قابلیت‌ها فعاله."
                            : me.trialUntil
                              ? `هدیه‌ی تو تا ${new Date(me.trialUntil).toLocaleDateString("fa-IR")}`
                              : "ثبت جیش، نقشه و استوری همیشه رایگانه."}
                      </p>
                      <small className="premium-free-hint">ثبت جیش، دوست‌ها، گروه‌ها، آمار، نقشه و استوری شخصی همیشه رایگانن.</small>
                    </div>
                    <CaretLeft size={17} />
                  </button>
                  {data.testing && !me.lifetime && me.trialDaysSaved > 0 && (
                    <div className="saved-premium-card">
                      <span className="saved-premium-number">
                        {fa(me.trialDaysSaved)}
                        <small>روز هدیه</small>
                      </span>
                      <div>
                        <strong>هدیه‌ات برای بعد می‌مونه 💛</strong>
                        <p>
                          تا پایان دورهٔ آزمایشی، پرمیوم رایگانه. روزهای هدیه‌ات
                          بعدش شروع می‌شن؛ هنوز ازشون کم نمی‌شه.
                        </p>
                      </div>
                    </div>
                  )}
                  <button
                    className="profile-stats-link"
                    onClick={() => navigate("stats")}
                  >
                    <div>
                      <span className="eyebrow">یه نگاه به حال و احوالت</span>
                      <h2>آمار جیشام</h2>
                    </div>
                    <Drop size={30} weight="duotone" />
                    <CaretLeft size={20} />
                  </button>
                  <button
                    className="profile-community-link"
                    onClick={() => navigate("achievements")}
                  >
                    <Medal size={27} weight="duotone" />
                    <div>
                      <h2>قشنگی‌های کوچیک من</h2>
                      <p>لقب‌ها، سطح‌ها، قدم‌های واقعی</p>
                    </div>
                    <CaretLeft size={18} />
                  </button>
                  {me.registered && (
                    <button
                      className="profile-community-link"
                      onClick={() => navigate("notifications")}
                    >
                      <Bell size={26} weight="duotone" />
                      <div>
                        <h2>اعلان‌های من</h2>
                        <p>با اجازه‌ی خودت، برای آدمای خودت</p>
                      </div>
                      <CaretLeft size={18} />
                    </button>
                  )}
                  {(me.isAdmin || me.handle === "ali") && (
                    <button
                      className="profile-community-link admin-entry"
                      onClick={() => navigate("admin")}
                    >
                      <ShieldCheck size={27} weight="duotone" />
                      <div>
                        <h2>داشبورد مدیریت</h2>
                        <p>اعضا، دعوت‌ها و پرمیوم همیشگی</p>
                      </div>
                      <CaretLeft size={18} />
                    </button>
                  )}
                  {me.registered ? (
                    <button
                      className="profile-invite-card"
                      onClick={() => navigate("invite")}
                    >
                      <Heart size={27} weight="duotone" />
                      <div>
                        <h2>یه دوست بیار، با هم هدیه بگیرین</h2>
                        <p>۷ روز پرمیوم برای هر دوتون</p>
                      </div>
                      <CaretLeft size={18} />
                    </button>
                  ) : (
                    <div className="soft-signup-card">
                      <h2>لحظه‌هات با خودت بمونه</h2>
                      <p>
                        مهمان به همین مرورگر وصله. با گوگل که عضو بشی،
                        می‌تونی از یه دستگاه دیگه هم برگردی.
                      </p>
                      <Button lilac onClick={openAuth}>
                        عضویت با دعوت
                        <Phone size={18} />
                      </Button>
                    </div>
                  )}
                  <button className="profile-community-link" onClick={() => setDialog("whatsNew")}>
                    <ArrowCounterClockwise size={25} /><div><h2>تازه‌های جیشو</h2><p>چی عوض شده؟ ساده و کوتاه</p></div><CaretLeft size={18} />
                  </button>
                  <SharedMemories
                    moments={data.moments}
                    onOpen={(item) => {
                      setMoment(item);
                      setDialog("moment");
                    }}
                    onFindFriends={() =>
                      me.registered ? navigate("friends") : openAuth()
                    }
                  />
                </section>
              )}
              {screen === "stats" && (
                <Suspense fallback={<LoadingSection />}>
                  <Stats
                    data={data}
                    onBack={() => navigate("profile")}
                    onShare={() => openStory("weekly")}
                  />
                </Suspense>
              )}
              {screen === "invite" && (
                <section className="page invite-page">
                  <Header
                    title="یه دوست بیار تو جمع"
                    back={() => navigate("profile")}
                  />
                  <div className="invite-character-pair">
                    <PairArt size={295} />
                  </div>
                  <h2>با دعوتت، هر دوتون ۷ روز هدیه می‌گیرین.</h2>
                  <p className="invite-page-description">
                    عضویت فعلاً با دعوت و گوگله. دوستت می‌تونه اول مهمان
                    باشه؛ اسم فقط موقع ساخت حساب لازمه.
                  </p>
                  {me.registered && (
                    <InvitationQuota data={data} onShare={shareInvite} />
                  )}
                  {me.registered ? (
                    <>
                      <div className="invite-code-card">
                        <span>کد دعوت شخصی تو</span>
                        <strong dir="ltr">{me.inviteCode}</strong>
                        <button
                          aria-label="کپی کد دعوت"
                          onClick={async () => {
                            try {
                              await copyText(me.inviteCode);
                              notify("کد دعوت کپی شد.");
                            } catch (e) {
                              notify(e.message);
                            }
                          }}
                        >
                          <Copy size={20} />
                        </button>
                      </div>
                      <Button lilac onClick={shareInvite}>
                        <ShareNetwork size={20} /> فرستادن لینک دعوت
                      </Button>
                      <div className="invite-story-icon">
                        <span>کارت دعوتت</span>
                        <IconButton
                          icon={ShareNetwork}
                          label="اشتراک کارت دعوت"
                          onClick={() => openStory("invite")}
                        />
                      </div>
                    </>
                  ) : (
                    <Button lilac onClick={openAuth}>
                      عضویت با دعوت
                    </Button>
                  )}
                  <div className="invite-rules">
                    <CrownSimple size={21} weight="duotone" />
                    <p>
                      توی آزمایش، هر نفر سه دوست رو به جمع دعوت می‌کنه. دوست‌هات
                      هم هر کدوم سه دعوت دارن.
                    </p>
                  </div>
                  {me.registered && (
                    <div className="invited-members">
                      <h2>رفیق‌هایی که تو آوردی</h2>
                      {data.invited?.length ? (
                        data.invited.map((person) => (
                          <div key={person.id}>
                            <Avatar person={person} size={42} />
                            <div>
                              <strong>{person.name}</strong>
                              <span dir="ltr">
                                @{person.handle || "jishoo"}
                              </span>
                            </div>
                            <Heart size={17} weight="duotone" />
                          </div>
                        ))
                      ) : (
                        <p>اولین دوستت هنوز تو راهه. یه دعوت بفرست!</p>
                      )}
                    </div>
                  )}
                </section>
              )}
            </div>
            {screen !== "invite" && <nav
              className="bottom-nav v2-nav"
              aria-label="ناوبری اصلی"
              dir="rtl"
            >
              {tabs.map(([key, Icon, label]) => (
                <button
                  key={key}
                  className={activeTab === key ? "active" : ""}
                  aria-current={activeTab === key ? "page" : undefined}
                  onClick={() => navigate(key)}
                >
                  <span>
                    <Icon
                      size={23}
                      weight={activeTab === key ? "fill" : "regular"}
                    />
                  </span>
                  <small>{label}</small>
                </button>
              ))}
            </nav>}
          </>
        )}

        {dialog && !["story", "momentStory"].includes(dialog) && (
          <Modal
            hideClose={["success", "need", "socialSetup"].includes(dialog)}
            fullscreen={["success", "need", "auth", "friend", "settings", "socialAccounts", "profileShare", "groupInvite", "moment", "premium"].includes(dialog)}
            labelledBy={dialog === "socialSetup" ? "social-setup-title" : dialog === "socialAccounts" ? "social-accounts-title" : undefined}
            focusTarget={dialog === "socialSetup" ? ".social-setup-reminder button" : dialog === "socialAccounts" ? ".social-field input" : undefined}
            onClose={() => dialog === "whatsNew" ? dismissRelease() : setDialog(null)}
            className={
              ["success", "need"].includes(dialog)
                ? "success-dialog checkin-dialog full"
                : dialog === "moment"
                  ? "success-dialog page-dialog full"
                  : dialog === "whatsNew" ? "release-dialog"
                  : dialog === "friend" ? `page-dialog friend-page-dialog social-page-${selectedFriend?.linkConnection || "none"}`
                  : ["auth", "settings", "socialAccounts", "profileShare", "groupInvite", "premium"].includes(dialog) ? "page-dialog" : ""
            }
          >
            {dialog === "whatsNew" && <ReleaseNotes onClose={dismissRelease} />}
            {dialog === "auth" && (
              <AuthWizard
                invitation={invitation}
                authInfo={data.auth}
                inviteOnly={data.inviteOnly}
                onComplete={completeAuth}
                notify={notify}
              />
            )}
            {dialog === "profileShare" && (
              <div className="profile-share-dialog">
                <Avatar person={me} size={95} />
                <h2>یه لینک، برای پیدا کردن تو</h2>
                <p>
                  این لینک، پروفایل عمومیه؛ شماره و لینک‌های خصوصی‌ت توش نیست.
                </p>
                <input
                  aria-label="لینک پروفایل من"
                  dir="ltr"
                  readOnly
                  value={`${data.publicUrl}/u/${me.handle}`}
                  onFocus={(e) => e.target.select()}
                />
                <Button lilac onClick={nativeShareProfile}>
                  <ShareNetwork size={19} />
                  اشتراک پروفایلم
                </Button>
                <Button
                  secondary
                  onClick={async () => {
                    try {
                      await copyText(`${data.publicUrl}/u/${me.handle}`);
                      notify("لینک پروفایلت کپی شد.");
                    } catch (e) {
                      notify(e.message);
                    }
                  }}
                >
                  <Copy size={18} />
                  کپی لینک پروفایل
                </Button>
              </div>
            )}
            {(dialog === "need" || dialog === "success") && (
              <>
                <div className="reaction-toolbar">
                  <span>
                    <Drop size={17} weight="duotone" />
                    {pendingCheckin && !pendingCheckin.saving
                      ? "فرصت لغو داری"
                      : busy
                        ? "در حال ثبت…"
                        : "ثبت شد"}
                  </span>
                  <button
                    className="checkin-share"
                    aria-label="استوری این لحظه"
                    onClick={() =>
                      openStory(dialog === "need" ? "need" : "checkin")
                    }
                  ><ShareNetwork size={23} /></button>
                </div>
                <div className="checkin-content">
                  <div className="checkin-art">
                    <Mascot
                      size={250}
                      mood={dialog === "need" ? "shy" : "happy"}
                      animate
                    />
                  </div>
                  <h1>
                    {dialog === "need" ? (
                      <>
                        جیش دارم.
                        <br />
                        الان برمی‌گردم!
                      </>
                    ) : (
                      <>
                        جیش کردم.
                        <br />
                        سبک شدم!
                      </>
                    )}
                  </h1>
                  <p className="success-subtitle">
                    {audience === "private" || !me.registered
                      ? "فقط خودت این جیش رو می‌بینی."
                      : pendingCheckin
                        ? "بعد از ثبت، دوست‌های متصلت هم می‌بیننش."
                        : "دوست‌های متصلت می‌تونن این جیش رو ببینن."}
                  </p>
                  {dialog === "success" && (
                    <div className="today-card">
                      <p>جیش کردم‌های امروز</p>
                      <strong>
                        {fa(
                          data.stats.today +
                            (pendingCheckin?.status === "done" ? 1 : 0),
                        )}
                        <Drop size={27} weight="duotone" />
                      </strong>
                    </div>
                  )}
                </div>
                <div className="checkin-footer">
                  <div className="checkin-status-slot">
                    {pendingCheckin && !pendingCheckin.saving ? (
                      <CheckinUndo
                        pending={pendingCheckin}
                        onUndo={undoCheckin}
                        inline
                      />
                    ) : (
                      <p className="checkin-save-status" role="status">
                        {busy ? <Drop size={18} /> : <Check size={18} />}
                        {busy ? "داریم ثبت می‌کنیم…" : "ثبت شد."}
                      </p>
                    )}
                  </div>
                  <div className="success-buttons">
                    <Button lilac onClick={() => setDialog(null)}>
                      {dialog === "need" ? "باشه، الان برمی‌گردم" : "چه حس خوبی!"}
                    </Button>
                  </div>
                </div>
              </>
            )}
            {dialog === "moment" && moment && (
              <>
                <h2 className="moment-heading">
                  {moment.kind === "together"
                    ? "جیش با هم"
                    : "یکی بعد از اون یکی"}
                </h2>
                <div className="moment-characters">
                  <PairArt kind={moment.kind} size={330} />
                </div>
                <h1 className="moment-title">
                  {moment.kind === "together"
                    ? "شما باهم جیش کردید!"
                    : "شما پشت سر هم جیش کردید!"}
                </h1>
                <p className="friend-names">
                  {me.name} و {moment.friend.name}
                </p>
                <p className="moment-caption">
                  {moment.kind === "together"
                    ? "کمتر از یک دقیقه فاصله، یه خاطره‌ی مشترک."
                    : "تا پنج دقیقه فاصله، یه لحظهٔ مشترک."}
                </p>
                <div className="moment-quiet-actions">
                  <Button lilac onClick={() => setDialog(null)}>
                    چه خوب که با هم بودیم!
                  </Button>
                  <IconButton
                    icon={ShareNetwork}
                    label="اشتراک این خاطره"
                    onClick={() => setDialog("momentStory")}
                  />
                </div>
              </>
            )}
            {dialog === "friend" && selectedFriend && (
              <>
                <div className="friend-dialog-head">
                  <Avatar person={selectedFriend} size={105} mood="happy" />
                  <h2>{selectedFriend.name}</h2>
                  <span>دوستین</span>
                </div>
                <SocialConnection
                  friend={selectedFriend}
                  premium={me.premium}
                  busy={busy}
                  onChange={changeSocialSharing}
                />
                <button
                  className="preference-action"
                  disabled={busy}
                  onClick={() =>
                    notificationPreference(
                      "friend",
                      selectedFriend.id,
                      Boolean(
                        data.notificationPreferences?.some(
                          (p) =>
                            p.scope === "friend" &&
                            p.id === selectedFriend.id &&
                            !p.enabled,
                        ),
                      ),
                    )
                  }
                >
                  {data.notificationPreferences?.some(
                    (p) =>
                      p.scope === "friend" &&
                      p.id === selectedFriend.id &&
                      !p.enabled,
                  ) ? (
                    <BellSlash size={24} />
                  ) : (
                    <Bell size={24} />
                  )}
                  <span>
                    <strong>
                      {data.notificationPreferences?.some(
                        (p) =>
                          p.scope === "friend" &&
                          p.id === selectedFriend.id &&
                          !p.enabled,
                      )
                        ? `${selectedFriend.name} بی‌صداست`
                        : `اعلان‌های ${selectedFriend.name} روشنه`}
                    </strong>
                    <small>
                      با زدن این دکمه، اعلان‌هاش رو روشن یا بی‌صدا کن. دوستی و دسترسی به حساب‌های اجتماعی تغییر نمی‌کنه.
                    </small>
                  </span>
                </button>
                <button
                  className="danger-text"
                  onClick={() => setDialog("disconnect")}
                >
                  <UserPlus size={18} />
                  قطع دوستی با {selectedFriend.name}
                </button>
                {!Object.keys(me.socialLinks || {}).length && (
                  <button
                    className="text-link auth-back"
                    onClick={openSocialAccounts}
                  >
                    اول لینک‌های خودم رو اضافه کنم
                  </button>
                )}
                <p className="premium-feature-note">
                  <CrownSimple size={15} />
                  قابلیت پرمیوم؛ توی آزمایش برای همه فعاله.
                </p>
                <Button secondary onClick={() => setDialog(null)}>
                  برگشت
                </Button>
              </>
            )}
            {dialog === "socialSetup" && (
              <div className="social-setup-reminder">
                <Mascot size={92} />
                <h2 id="social-setup-title">هنوز حسابی اضافه نکردی</h2>
                <p className="dialog-description">
                  درخواست رو قبول کردی 💛 اگه دوست داری، حساب‌های خودت رو هم اضافه کن.
                </p>
                <p className="social-setup-privacy">
                  حساب‌هایی که اضافه کنی، برای دوست‌هایی که تبادل حساب‌ها رو باهاشون قبول کردی هم دیده می‌شن.
                </p>
                <Button lilac autoFocus onClick={openSocialAccounts}>
                  <LinkSimple size={20} /> افزودن حساب‌های من
                </Button>
                <Button secondary onClick={() => setDialog("friend")}>فعلاً نه</Button>
              </div>
            )}
            {dialog === "socialAccounts" && (
              <div className="social-account-editor">
                <div className="dialog-icon purple"><LinkSimple size={28} /></div>
                <h2 id="social-accounts-title">حساب‌های اجتماعی من</h2>
                <p className="dialog-description">
                  هر کدوم رو دوست داری اضافه کن؛ پُرکردن همه لازم نیست. دوست‌هایی که تبادل حساب‌ها رو باهاشون قبول کردی، لینک‌های ذخیره‌شده رو می‌بینن.
                </p>
                <form onSubmit={saveSocialAccounts}>
                  <SocialAccountFields value={socials} onChange={setSocials} autoFocus />
                  <Button lilac type="submit" disabled={busy}>ذخیره حساب‌ها <Check size={19} /></Button>
                </form>
                <Button secondary disabled={busy} onClick={() => setDialog("friend")}>برگشت</Button>
              </div>
            )}
            {dialog === "disconnect" && selectedFriend && (
              <>
                <Avatar person={selectedFriend} size={90} />
                <h2>دوستی رو قطع کنیم؟</h2>
                <p className="dialog-description">
                  دیگه وضعیت‌های هم رو نمی‌بینین و دسترسی به لینک‌های اجتماعی بسته
                  می‌شه. عضویت گروه‌ها جداست؛ هر وقت خواستی می‌تونی درخواست تازه
                  بفرستی.
                </p>
                <Button
                  disabled={busy}
                  onClick={() => respondFriend(selectedFriend, false)}
                >
                  قطع دوستی
                </Button>
                <Button
                  secondary
                  disabled={busy}
                  onClick={() => setDialog("friend")}
                >
                  برگشت
                </Button>
              </>
            )}
            {dialog === "groupInvite" && circle && (
              <>
                <div className="dialog-icon purple">
                  <UsersThree size={30} />
                </div>
                <h2>دعوت به {circle.name}</h2>
                <p className="dialog-description">
                  با شناسه دعوت بفرست، یا لینک گروه رو شریک شو. هر نفر خودش
                  عضویت رو انتخاب می‌کنه.
                </p>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const r = await groupMutation("circle-invite", {
                      id: circle.id,
                      handle: groupHandle,
                    });
                    if (r) {
                      setGroupHandle("");
                      notify("دعوت گروه فرستاده شد.");
                    }
                  }}
                >
                  <label className="field-label">
                    شناسهٔ دوست
                    <input
                      value={groupHandle}
                      onChange={(e) =>
                        setGroupHandle(e.target.value.toLowerCase())
                      }
                      placeholder="@sara"
                      dir="ltr"
                      required
                    />
                  </label>
                  <Button
                    lilac
                    disabled={busy || !groupHandle.trim()}
                    type="submit"
                  >
                    فرستادن دعوت
                  </Button>
                </form>
                <Button secondary disabled={busy} onClick={shareGroupLink}>
                  <ShareNetwork size={18} />
                  اشتراک لینک گروه
                </Button>
                <button
                  className="text-link"
                  disabled={busy}
                  onClick={async () => {
                    const r = await groupMutation("circle-rotate", {
                      id: circle.id,
                    });
                    if (r)
                      notify("لینک تازه آماده‌ست؛ لینک قبلی دیگه کار نمی‌کنه.");
                  }}
                >
                  ساخت لینک تازه و لغو لینک قبلی
                </button>
              </>
            )}
            {dialog === "groupConfirm" && circle && (
              <>
                <UsersThree size={48} />
                <h2>
                  {groupActionType === "delete"
                    ? "این گروه حذف بشه؟"
                    : "از گروه خارج می‌شی؟"}
                </h2>
                <p className="dialog-description">
                  {groupActionType === "delete"
                    ? "عضویت‌ها و لینک دعوت گروه حذف می‌شن؛ دوستی‌های فردی باقی می‌مونن."
                    : "پروفایلت از فهرست اعضا برداشته می‌شه؛ دوستی‌های فردی باقی می‌مونن."}
                </p>
                <Button
                  disabled={busy}
                  onClick={async () => {
                    const r = await groupMutation(
                      groupActionType === "delete"
                        ? "circle-delete"
                        : "circle-leave",
                      { id: circle.id },
                    );
                    if (r) {
                      setDialog(null);
                      navigate("friends");
                      notify(
                        groupActionType === "delete"
                          ? "گروه حذف شد."
                          : "از گروه خارج شدی.",
                      );
                    }
                  }}
                >
                  {groupActionType === "delete" ? "حذف گروه" : "خروج از گروه"}
                </Button>
                <Button
                  secondary
                  disabled={busy}
                  onClick={() => setDialog(null)}
                >
                  برگشت
                </Button>
              </>
            )}
            {dialog === "addFriend" && (
              <>
                <div className="dialog-icon purple">
                  <UserPlus size={30} weight="duotone" />
                </div>
                <h2>به یه دوست وصل شو</h2>
                <p className="dialog-description">
                  شناسهٔ دوستت رو وارد کن؛ مثلاً @sara. وقتی درخواستت رو قبول کنه،
                  به هم وصل می‌شین. برای دوست‌شدن کد دعوت لازم نیست.
                </p>
                <form onSubmit={requestFriend}>
                  <label className="field-label">
                    شناسهٔ دوستت
                    <input
                      value={friendCode}
                      onChange={(e) =>
                        setFriendCode(e.target.value.toLowerCase())
                      }
                      placeholder="@sara"
                      dir="ltr"
                      required
                    />
                  </label>
                  <Button
                    lilac
                    type="submit"
                    disabled={busy || !friendCode.trim()}
                  >
                    درخواست وصل‌شدن
                    <UserPlus size={19} />
                  </Button>
                </form>
                <Button
                  secondary
                  className="dialog-followup"
                  onClick={() => {
                    setDialog(null);
                    navigate("invite");
                  }}
                >
                  لینک خودم رو بفرستم
                </Button>
              </>
            )}
            {dialog === "circle" && (
              <>
                <h2>یه گروه خودمونی بساز</h2>
                <p className="dialog-description">
                  یه اسم انتخاب کن و دوستات رو دعوت کن. هر نفر خودش دعوت رو قبول
                  می‌کنه؛ عضویت گروه دوستی یا اجازهٔ لینک‌ها رو خودکار عوض
                  نمی‌کنه.
                </p>
                <form onSubmit={createCircle}>
                  <label className="field-label">
                    اسم جمع
                    <input
                      value={circleName}
                      onChange={(e) => setCircleName(e.target.value)}
                      maxLength={40}
                      placeholder="مثلاً بچه‌های دانشگاه"
                      required
                    />
                  </label>
                  <div className="circle-picker">
                    {accepted.map((friend) => (
                      <label key={friend.id}>
                        <input
                          type="checkbox"
                          checked={circleMembers.includes(friend.id)}
                          onChange={(e) =>
                            setCircleMembers((current) =>
                              e.target.checked
                                ? [...current, friend.id]
                                : current.filter((id) => id !== friend.id),
                            )
                          }
                        />
                        <Avatar person={friend} size={31} />
                        <span>{friend.name}</span>
                      </label>
                    ))}
                  </div>
                  <Button
                    lilac
                    type="submit"
                    disabled={busy || !circleName.trim()}
                  >
                    ساخت گروه
                    <Plus size={18} />
                  </Button>
                </form>
              </>
            )}
            {dialog === "settings" && (
              <>
                <h2>پروفایل خودت</h2>
                <Suspense fallback={null}>
                  <AccountConnections
                    data={data}
                    onUpdate={(value) => { setData(value); syncPush().catch(() => {}); }}
                    notify={notify}
                  />
                </Suspense>
                <p className="dialog-description">
                  لینک‌های اجتماعی فقط با درخواست و قبول هر دو نفر دیده می‌شن.
                  می‌تونی اشتراک لینک‌ها رو قطع کنی و همچنان دوست بمونی.
                </p>
                <form onSubmit={saveProfile}>
                  {photoFile && (
                    <Suspense fallback={<LoadingSection />}>
                      <PhotoEditor
                        file={photoFile}
                        busy={busy}
                        onSave={saveAvatar}
                        onCancel={() => setPhotoFile(null)}
                        notify={notify}
                      />
                    </Suspense>
                  )}
                  <div className="avatar-upload-row">
                    <Avatar person={me} size={68} />
                    <div>
                      <label className="upload-avatar-label">
                        {busy ? "آماده‌کردن عکس…" : "عکس خودمو بذارم"}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={uploadAvatar}
                          disabled={busy}
                        />
                      </label>
                      <small>یا شخصیت ساخته‌شده از اسمت</small>
                      {me.avatarImage && (
                        <button
                          type="button"
                          className="text-link"
                          disabled={busy}
                          onClick={async () => {
                            const value = await perform("avatar", {
                              image: null,
                            });
                            if (value) setData(value);
                          }}
                        >
                          برگشت به شخصیت من
                        </button>
                      )}
                    </div>
                  </div>
                  <label className="field-label">
                    اسمت
                    <input
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      maxLength={40}
                      required
                    />
                  </label>
                  <label className="field-label">
                    شناسه‌ی یکتا
                    <input
                      aria-label="شناسه‌ی یکتا"
                      value={profileHandle}
                      onChange={(e) =>
                        setProfileHandle(
                          e.target.value.toLowerCase().replace(/^@/, ""),
                        )
                      }
                      dir="ltr"
                      minLength={3}
                      maxLength={24}
                      placeholder="sara"
                    />
                    <small>
                      حداقل ۳ حرف انگلیسی؛ لینک پروفایلت با این شناسه ساخته
                      می‌شه.
                    </small>
                  </label>
                  <SocialAccountFields value={socials} onChange={setSocials} />
                  <Button lilac type="submit" disabled={busy}>
                    ذخیره تغییرات
                    <Check size={19} />
                  </Button>
                </form>
                <div className="legal-links">
                  <a href="/terms">شرایط استفاده</a>
                  <span>·</span>
                  <a href="/privacy">حریم خصوصی</a>
                </div>
                <button className="signout" onClick={logout} disabled={busy}>
                  <SignOut size={18} />
                  خروج از حساب
                </button>
                <button
                  className="delete-account-link"
                  onClick={() => setDialog("deleteAccount")}
                >
                  <Trash size={15} />
                  پاک‌کردن حساب و ثبت‌های من
                </button>
              </>
            )}
            {dialog === "guestSettings" && (
              <>
                <Avatar person={me} size={95} mood="shy" />
                <h2>مهمانِ خودمونی</h2>
                <p className="dialog-description">
                  جیش و آمار و استوری بدون عضویت کار می‌کنن. با یه دعوت و گوگل
                  عضو شو تا از دستگاه‌های دیگه هم برگردی.
                </p>
                <Button lilac onClick={openAuth}>
                  ورود یا عضویت با دعوت
                </Button>
                <button
                  className="delete-account-link"
                  onClick={() => setDialog("deleteAccount")}
                >
                  <Trash size={15} />
                  پاک‌کردن ثبت‌های مهمان
                </button>
              </>
            )}
            {dialog === "premium" && (
              <>
                <div className="dialog-icon purple">
                  <CrownSimple size={37} weight="duotone" />
                </div>
                <h2>
                  {me.lifetime
                    ? "همیشه مهمون جیشویی!"
                    : data.testing
                      ? "فعلاً همه مهمون مائن!"
                      : "پرمیوم جیشو"}
                </h2>
                <p className="dialog-description">
                  {data.testing
                    ? "تا آزمایش تموم نشده، همه‌ی کاربران و مهمان‌ها به قابلیت‌های پرمیوم دسترسی دارن."
                    : "ثبت جیش، آمار، نقشه و استوری شخصی همیشه رایگان می‌مونن."}
                </p>
                <section className="premium-feature-group premium-free" aria-label="امکانات همیشه رایگان">
                  <h3><Check size={21} /> همیشه رایگان می‌مونه</h3>
                  <p>برای این کارها، حتی بعد از دورهٔ آزمایشی، اشتراک لازم نیست.</p>
                  <ul>
                    <li>ثبت «جیش دارم» و «جیش کردم» و لغو ثبت</li>
                    <li>دوست‌ها، گروه‌ها و حال‌و‌احوال دوستات</li>
                    <li>آمار شخصی، نقشه و دیدن ثبت‌های اطراف</li>
                    <li>استوری‌های شخصی و فرستادن دعوت</li>
                  </ul>
                </section>
                <section className="premium-feature-group premium-extra" aria-label="امکانات پرمیوم">
                  <h3><CrownSimple size={21} /> قابلیت‌های اضافهٔ پرمیوم</h3>
                  <ul>
                    <li>تبادل حساب‌های اجتماعی با درخواست و قبول هر دو نفر</li>
                    <li>خاطره‌های «با هم» و «پشت سر هم» و کارت‌های اشتراک‌شون</li>
                  </ul>
                  {data.testing && <p>در دورهٔ آزمایشی، این‌ها هم برای همه رایگان فعاله.</p>}
                </section>
                <div className="invite-rules premium-trial-notice">
                  <Heart size={19} weight="fill" />
                  <p>
                    با دعوت: ۷ روز برای هر دو نفر. بعداً بدون دعوت: ۳ روز برای
                    عضو جدید. عضویت فعلاً فقط با دعوته.
                  </p>
                </div>
                <Button
                  lilac
                  onClick={() => {
                    setDialog(null);
                    me.registered ? navigate("invite") : openAuth();
                  }}
                >
                  {me.registered ? "یه دوست دعوت کنم" : "عضویت با دعوت"}
                </Button>
              </>
            )}
            {dialog === "deleteAccount" && (
              <>
                <div className="dialog-icon rose">
                  <Trash size={29} />
                </div>
                <h2>
                  {me.registered ? "حسابت پاک بشه؟" : "ثبت‌های مهمان پاک بشه؟"}
                </h2>
                <p className="dialog-description">
                  ثبت‌ها، ارتباط‌ها و اطلاعات خودت حذف می‌شن. این کار قابل برگشت
                  نیست.
                </p>
                <Button
                  className="danger-button"
                  onClick={async () => {
                    const result = await perform("delete-account", {});
                    if (result) {
                      setEntered(false);
                      setDialog(null);
                      await refresh();
                      notify("اطلاعات خودت پاک شد.");
                    }
                  }}
                  disabled={busy}
                >
                  بله، اطلاعات من پاک بشه
                </Button>
                <Button
                  secondary
                  className="dialog-followup"
                  onClick={() => setDialog(null)}
                >
                  نه، برگردیم
                </Button>
              </>
            )}
          </Modal>
        )}
        {(dialog === "story" || (dialog === "momentStory" && moment)) && (
          <StoryDialog
            label={
              dialog === "momentStory"
                ? "استوری خاطره‌ی مشترک"
                : "کارت اشتراک جیشو"
            }
            onClose={() => setDialog(null)}
          >
            <Suspense fallback={<LoadingSection />}>
              <Stories
                data={pendingCheckin?.status === "done" ? { ...data, stats: { ...data.stats, today: data.stats.today + 1, week: data.stats.week + 1 } } : data}
                undo={pendingCheckin && !pendingCheckin.saving ? <CheckinUndo pending={pendingCheckin} onUndo={undoCheckin} inline /> : null}
                pendingInvite={invitation}
                initialMoment={dialog === "momentStory" ? moment : null}
                initialKind={dialog === "story" ? storyKind : null}
                onClose={() => setDialog(null)}
                onAuth={openAuth}
                notify={notify}
              />
            </Suspense>
          </StoryDialog>
        )}
        {pendingCheckin &&
          !pendingCheckin.saving &&
          !["need", "success", "story", "momentStory"].includes(dialog) && (
            <CheckinUndo pending={pendingCheckin} onUndo={undoCheckin} />
          )}
        <div
          className={`toast ${notice ? "visible" : ""}`}
          role="status"
          aria-live="polite"
        >
          <Check size={20} />
          <span>{notice}</span>
        </div>
      </main>
      <span className="stage-note">
        زندگی همین لحظه‌های کوچیکه
        <Heart size={13} weight="fill" />
      </span>
    </div>
  );
}
