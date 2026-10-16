import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  lazy,
  Suspense,
} from "react";
import {
  House,
  UsersThree,
  User,
  MapPin,
  ShareNetwork,
  Drop,
  Sparkle,
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
  Confetti,
  Smiley,
  Bell,
  Medal,
  NavigationArrow,
} from "@phosphor-icons/react";
import { Avatar } from "./components/Character";
import { Mascot, PairArt } from "./components/Mascot";
import { prepareAvatar } from "./avatar-upload";
import {
  Admin,
  Discover,
  Achievements,
  InvitationQuota,
  Notifications,
  PublicProfile,
} from "./components/Community";
const Nearby = lazy(() => import("./components/Nearby"));
const Stories = lazy(() => import("./components/Stories"));
import { api, getInvite, fa, relativeTime, inviteUrl, copyText } from "./api";

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
  "discover",
  "achievements",
  "notifications",
  "admin",
  "publicProfile",
];
const readRoute = () => {
  const value = location.hash.replace(/^#\/?/, "").split("/")[0];
  if (!value && /^\/u\/[a-z0-9_]+\/?$/i.test(location.pathname))
    return "publicProfile";
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
function Modal({ children, onClose, className = "" }) {
  const dialog = useRef();
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.querySelector("button,input")?.focus();
    const escape = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("keydown", escape);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className={`overlay-backdrop ${className.includes("full") ? "full-overlay" : ""}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label="پنجره جیشو"
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
        <button
          className="icon-button close-dialog"
          onClick={onClose}
          aria-label="بستن"
        >
          <X size={21} />
        </button>
        {children}
      </section>
    </div>
  );
}
function StoryDialog({ children, onClose, label = "کارت اشتراک جیشو" }) {
  const dialog = useRef();
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.focus();
    const escape = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("keydown", escape);
      previous?.focus();
    };
  }, []);
  return (
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
          "button:not(:disabled),a[href]",
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
    </div>
  );
}
function Chart({ stats }) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.now() - (6 - index) * 86400000);
    const key = date.toLocaleDateString("en-CA", { timeZone: "Asia/Tehran" });
    return {
      label: date.toLocaleDateString("fa-IR", {
        weekday: "short",
        timeZone: "Asia/Tehran",
      }),
      count: stats.daily.find((d) => d.day === key)?.count || 0,
    };
  });
  const max = Math.max(...days.map((d) => d.count), 1);
  return (
    <div
      className="chart actual-chart"
      role="img"
      aria-label={`تعداد جیش هفت روز اخیر: ${days.map((d) => fa(d.count)).join("، ")}`}
    >
      {days.map((day, i) => (
        <div className="chart-column" key={i}>
          <div
            className="chart-bar"
            style={{ height: day.count ? `${(day.count / max) * 100}%` : "0%" }}
          />
          <span>{day.label}</span>
          {day.count > 0 && <small>{fa(day.count)}</small>}
        </div>
      ))}
    </div>
  );
}
function AuthWizard({ invitation, onComplete, notify }) {
  const [stage, setStage] = useState("phone"),
    [phone, setPhone] = useState(""),
    [challenge, setChallenge] = useState(null),
    [otp, setOtp] = useState(""),
    [ticket, setTicket] = useState(""),
    [name, setName] = useState(""),
    [code, setCode] = useState(invitation?.code || ""),
    [invite, setInvite] = useState(invitation),
    [connect, setConnect] = useState(false),
    [requiresInvite, setRequiresInvite] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const mounted = useRef(true),
    verifying = useRef(false);
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
      });
      if (!mounted.current) return;
      if (result.registered) {
        onComplete(result);
        notify("خوش برگشتی!");
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
        ticket,
        name,
        inviteCode: code,
        connectInviter: connect,
      });
      if (!mounted.current) return;
      onComplete(result);
      notify(
        `خوش اومدی ${result.me.name}! ${fa(result.bonusDays)} روز پرمیوم هدیه گرفتی.`,
      );
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
      {stage === "phone" ? (
        <>
          <div className="dialog-icon blue">
            <Phone size={30} weight="duotone" />
          </div>
          <h2>با شماره‌ت بیا تو جمع</h2>
          <p className="dialog-description">
            ورود با موبایل. اگه عضو جدیدی، دعوت دوستت رو لازم داری. مهمان هم
            همیشه می‌تونه جیش کنه.
          </p>
          {!invitation && (
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
          <form onSubmit={start}>
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
              {busy ? "در حال آماده‌کردن ورود…" : "دریافت کد ورود"}
              <ArrowRight size={18} />
            </Button>
          </form>
          <p className="auth-demo-note">
            نسخه‌ی آزمایشی: پیامکی ارسال نمی‌شه و کد خودکار تایید می‌شه.
          </p>
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
      ) : (
        <>
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
            شخصیتت از روی اسمت ساخته می‌شه؛ یه کوچولوی مخصوص خودت.
          </p>
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
                  <strong>۷ روز پرمیوم برای هر دوتون</strong>
                </p>
              </div>
            )}
            {invite?.inviter && (
              <label className="consent-label">
                <input
                  type="checkbox"
                  checked={connect}
                  onChange={(e) => setConnect(e.target.checked)}
                />
                با {invite.inviter.name} هم وصل بشم.
              </label>
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
        location.pathname.startsWith("/u/"),
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
    [period, setPeriod] = useState("هفته"),
    [friendCode, setFriendCode] = useState(""),
    [circleName, setCircleName] = useState(""),
    [circleMembers, setCircleMembers] = useState([]),
    [profileName, setProfileName] = useState(""),
    [profileHandle, setProfileHandle] = useState(""),
    [publicPerson, setPublicPerson] = useState(null),
    [socials, setSocials] = useState({}),
    [audience, setAudience] = useState("friends");
  const timer = useRef(),
    adminAccess = useRef(
      new URLSearchParams(location.search).get("adminAccess"),
    ),
    scroll = useRef(),
    inviteFromUrl = useRef(
      new URLSearchParams(location.search).get("invite") ||
        sessionStorage.getItem("jishoo:invite") ||
        "",
    );
  const notify = useCallback((text) => {
    setNotice(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(""), 3500);
  }, []);
  const refresh = useCallback(async () => {
    try {
      const value = await api("bootstrap");
      setData(value);
      setLoadError("");
      if (value.me.registered) setEntered(true);
      return value;
    } catch (error) {
      setLoadError(error.message);
    }
  }, []);
  useEffect(() => {
    refresh();
    return () => clearTimeout(timer.current);
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
      if (document.visibilityState === "visible" && !dialog) refresh();
    }, 20000);
    return () => clearInterval(interval);
  }, [entered, dialog, refresh]);
  useEffect(() => {
    const code = inviteFromUrl.current;
    if (!code) return;
    sessionStorage.setItem("jishoo:invite", code);
    getInvite(code)
      .then(setInvitation)
      .catch((error) => setInviteError(error.message));
  }, []);
  function navigate(next, id) {
    setScreen(next);
    if (next === "stories")
      setStoryKind(
        ["weekly", "checkin", "invite", "need"].includes(id) ? id : null,
      );
    if (id) setSelectedCircle(id);
    location.hash = "/" + next + (id ? "/" + id : "");
  }
  function openAuth() {
    setDialog("auth");
  }
  function openStory(kind) {
    setStoryKind(kind);
    setDialog("story");
  }
  function completeAuth(result) {
    setData(result);
    setEntered(true);
    setDialog(null);
    navigate(result.me.isAdmin ? "admin" : "home");
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
  async function checkin(status) {
    if (busy) return;
    setEntered(true);
    const result = await perform("checkin", {
      status,
      visibility: audience,
      nonce: crypto.randomUUID(),
    });
    if (!result) return;
    setData((current) => ({ ...current, stats: result.stats }));
    if (result.matches?.length) {
      setMoment(result.matches[0]);
      setDialog("moment");
      refresh();
    } else setDialog(status === "done" ? "success" : "need");
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
          text: "یه خبر کوچولو، یه جمع خوب. با دعوت من هر دومون ۷ روز پرمیوم می‌گیریم.",
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
  async function shareProfile() {
    if (!me.registered) {
      openAuth();
      return;
    }
    if (!me.handle) {
      openSettings();
      notify("اول یه شناسه‌ی کوچولو برای خودت انتخاب کن.");
      return;
    }
    const url = `${data.publicUrl}/u/${me.handle}`;
    try {
      if (navigator.share)
        await navigator.share({
          title: `${me.name} توی جیشو`,
          text: "یه خبر کوچولو، یه بهونه برای با هم بودن.",
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
  async function uploadAvatar(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const image = await prepareAvatar(file);
      const result = await api("avatar", { image });
      setData(result);
      notify("عکس پروفایلت آماده‌ست!");
    } catch (error) {
      notify(error.message);
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }
  async function requestFriend(e) {
    e.preventDefault();
    const result = await perform("connection-request", { code: friendCode });
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
      setData((current) => ({ ...current, friends: result.friends }));
      notify(accept ? "حالا به هم وصلید!" : "اتصال حذف شد.");
      if (!accept) setDialog(null);
    }
  }
  async function changeSocialSharing(friend, enabled) {
    const result = await perform("connection-share", {
      id: friend.connectionId,
      enabled,
    });
    if (result) {
      setData((current) => ({ ...current, friends: result.friends }));
      setSelectedFriend(result.friends.find((f) => f.id === friend.id));
      notify(
        enabled
          ? "لینک‌های تو برای این دوست قابل دیدن شد."
          : "لینک‌های تو برای این دوست پنهان شد.",
      );
    }
  }
  async function createCircle(e) {
    e.preventDefault();
    const result = await perform("circle-create", {
      name: circleName,
      members: circleMembers,
    });
    if (result) {
      setData((current) => ({ ...current, circles: result.circles }));
      setDialog(null);
      setCircleName("");
      setCircleMembers([]);
      notify("جمع خودت ساخته شد.");
    }
  }
  async function logout() {
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
    ["nearby", MapPin, "اطراف"],
    ["discover", UsersThree, "هم‌جیش"],
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
  ].includes(screen)
    ? "profile"
    : screen === "circle"
      ? "friends"
      : screen;
  const circle = data?.circles.find((x) => x.id === selectedCircle);
  const displayFriends =
    screen === "circle"
      ? accepted.filter((f) => circle?.members.includes(f.id))
      : accepted;
  return (
    <div className="desktop-stage">
      <aside className="desktop-brand" aria-hidden="true">
        <div className="desktop-brand-top">
          <Brand small />
          <span className="little-pill">بهونه‌ای برای با هم بودن</span>
        </div>
        <div className="desktop-story">
          <span className="eyebrow">
            <span />
            یه خبر کوچولو، یه حال خوب
          </span>
          <h2>
            دوستی، به همین
            <br />
            <span>سادگی.</span>
          </h2>
          <p>
            جیش کردی، خبر بده.
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
        className={`app-shell ${!entered ? "welcome-shell" : ""}`}
        dir="rtl"
      >
        {!data ? (
          <section className="loading-page">
            <img src={assets + "shy-drop.webp"} alt="قطره‌ی خجالتی جیشو" />
            <Brand small />
            <p>{loadError || "داریم جمعمون رو آماده می‌کنیم…"}</p>
            {loadError && <Button onClick={refresh}>دوباره امتحان کن</Button>}
          </section>
        ) : !entered ? (
          <section className="guest-welcome">
            <Brand small />
            {invitation && (
              <div className="welcome-invite-banner">
                {invitation.inviter ? (
                  <Avatar person={invitation.inviter} size={32} />
                ) : (
                  <Mascot size={39} />
                )}
                <span>
                  {invitation.inviter
                    ? `${invitation.inviter.name} دعوتت کرده!`
                    : "یه دعوت خصوصی از جیشو"}{" "}
                  <small>
                    {invitation.remaining === 0
                      ? "این دعوت پر شده؛ یه لینک تازه لازم داری."
                      : "دعوتت کرده به جمع دوستاش بپیوندی"}
                  </small>
                </span>
              </div>
            )}
            <img
              className="guest-door"
              src={assets + "guest-door.webp"}
              alt="قطره‌ی خجالتی زرد کنار درِ دستشویی"
            />
            <h1>بدون اکانت هم می‌شه جیش کرد.</h1>
            <p>جیش کن، به دوستات خبر بده، بعداً تصمیم بگیر.</p>
            <Button onClick={() => checkin("done")} disabled={busy}>
              جیش کردم <Sparkle size={21} weight="duotone" />
            </Button>
            <button
              className="guest-enter-link"
              onClick={() => setEntered(true)}
            >
              یه سر به جیشو بزن <CaretLeft size={15} />
            </button>
            <div className="guest-today">
              جیش‌های امروز: <strong>{fa(data.stats.today)}</strong>
            </div>
            <button className="guest-signup-link" onClick={openAuth}>
              ورود یا ساخت حساب <Phone size={17} />
            </button>
            <small>
              مهمان بودن همیشه رایگانه. فقط برای عضویت اسم می‌پرسیم.
            </small>
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
                      <p>الان چه خبر؟</p>
                    </div>
                    <div className="home-header-actions">
                      <button
                        className="icon-button notification-bell"
                        aria-label="خبرهای کوچولو"
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
                          <p>یه دعوت کوچولو، برای شروع یه رفاقت</p>
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
                  {data.testing && (
                    <button
                      className="testing-banner"
                      onClick={() => setDialog("premium")}
                    >
                      <CrownSimple size={14} weight="fill" /> توی آزمایش، همه
                      پرمیومن <CaretLeft size={13} />
                    </button>
                  )}
                  <div className="action-grid">
                    <button
                      className="action-card need-card"
                      onClick={() => checkin("need")}
                      disabled={busy}
                    >
                      <Mascot size={132} mood="shy" animate />
                      <strong>جیش دارم</strong>
                      <span>یه خبر کوچولو</span>
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
                      <span>آخیش! ثبتش کن</span>
                      <Sparkle
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
                      <span>خبرم برای دوست‌های وصل‌شده هم نمایش داده بشه</span>
                    </label>
                  )}
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
                                  <Sparkle weight="duotone" /> جیش کرد
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
                            : "مهمان هم می‌تونه خبر بده؛ برای وصل‌شدن به دوستات، با دعوت عضو شو."}
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
                      <h2>نزدیک من</h2>
                      <strong>خبرهای دور و برت</strong>
                      <p>با اجازه‌ی مکان، نقشه رو ببین</p>
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
              {screen === "discover" && (
                <Discover
                  data={data}
                  refresh={refresh}
                  notify={notify}
                  onMap={() => navigate("nearby")}
                  onAuth={openAuth}
                />
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
                <section className="page friends-page">
                  <Header
                    title={
                      screen === "circle"
                        ? circle?.name || "جمع من"
                        : "آدمای من"
                    }
                    subtitle={
                      screen === "circle"
                        ? "یه جمع از دوست‌های وصل‌شده"
                        : "هر اتصال، یه اجازه‌ی دوطرفه"
                    }
                    back={
                      screen === "circle"
                        ? () => navigate("friends")
                        : undefined
                    }
                    action={
                      screen === "friends" && me.registered ? (
                        <IconButton
                          icon={Plus}
                          label="وصل شدن به دوست"
                          onClick={() => setDialog("addFriend")}
                        />
                      ) : undefined
                    }
                  />
                  {screen === "circle" && circle && (
                    <label className="circle-notification-choice">
                      <Bell size={19} />
                      <span>خبرهای این جمع</span>
                      <input
                        type="checkbox"
                        checked={
                          !data.notificationPreferences?.some(
                            (p) =>
                              p.scope === "circle" &&
                              p.id === circle.id &&
                              !p.enabled,
                          )
                        }
                        disabled={busy}
                        onChange={(e) =>
                          notificationPreference(
                            "circle",
                            circle.id,
                            e.target.checked,
                          )
                        }
                      />
                    </label>
                  )}
                  {!me.registered ? (
                    <div className="account-empty">
                      <div className="pair-preview">
                        <PairArt size={245} />
                      </div>
                      <h2>آدمای خودت رو پیدا کن</h2>
                      <p>
                        با دعوت عضو شو تا به دوستات وصل بشی. جیش و آمار و استوری
                        مهمان همچنان رایگانه.
                      </p>
                      <Button lilac onClick={openAuth}>
                        عضویت با دعوت
                      </Button>
                    </div>
                  ) : (
                    <>
                      {pending.length > 0 && screen === "friends" && (
                        <div className="connection-requests">
                          <h2>می‌خوان بهت وصل بشن</h2>
                          {pending.map((friend) => (
                            <div className="request-card" key={friend.id}>
                              <Avatar person={friend} size={45} />
                              <strong>{friend.name}</strong>
                              <button
                                className="accept-request"
                                onClick={() => respondFriend(friend, true)}
                                disabled={busy}
                              >
                                <Check size={17} /> وصل شیم
                              </button>
                              <button
                                aria-label={`رد درخواست ${friend.name}`}
                                onClick={() => respondFriend(friend, false)}
                                disabled={busy}
                              >
                                <X size={19} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {displayFriends.length ? (
                        <div className="connected-list">
                          {displayFriends.map((friend) => (
                            <button
                              className="connected-card"
                              key={friend.id}
                              onClick={() => {
                                setSelectedFriend(friend);
                                setDialog("friend");
                              }}
                            >
                              <Avatar person={friend} size={59} mood="happy" />
                              <div>
                                <h2>{friend.name}</h2>
                                <p>
                                  {friend.latestStatus
                                    ? `${friend.latestStatus === "need" ? "جیش داره" : "جیش کرد"} · ${relativeTime(friend.latestAt)}`
                                    : "به هم وصلید؛ هنوز خبر تازه‌ای نیست."}
                                </p>
                                <span>
                                  {Object.keys(friend.socialLinks).length
                                    ? "لینک‌ها با اجازه‌ی دوستت در دسترسه"
                                    : "لینک‌ها خصوصی‌ان، مگر خودش بخواد."}
                                </span>
                              </div>
                              <CaretLeft size={18} />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="empty-state compact-empty">
                          <UsersThree size={46} weight="duotone" />
                          <h2>
                            {screen === "circle"
                              ? "این جمع هنوز دوستی نداره"
                              : "هنوز به کسی وصل نیستی"}
                          </h2>
                          <p>لینک دعوتت رو بفرست، یا کد دوستت رو وارد کن.</p>
                          {screen === "friends" && (
                            <Button lilac onClick={() => navigate("invite")}>
                              دعوت از دوستام
                              <ShareNetwork size={18} />
                            </Button>
                          )}
                        </div>
                      )}
                      {data.friends.some(
                        (f) => f.status === "pending" && !f.incoming,
                      ) &&
                        screen === "friends" && (
                          <p className="soft-note">
                            درخواستت فرستاده شده؛ منتظر جواب دوستتی.
                          </p>
                        )}
                      {screen === "friends" && (
                        <>
                          <div className="section-heading circles-heading">
                            <h2>جمع‌های من</h2>
                            <button
                              className="text-link"
                              onClick={() => setDialog("circle")}
                            >
                              <Plus size={15} /> جمع تازه
                            </button>
                          </div>
                          <div className="groups-list">
                            {data.circles.map((group) => (
                              <button
                                className="group-card"
                                key={group.id}
                                onClick={() => navigate("circle", group.id)}
                              >
                                <span className="group-symbol purple">
                                  <UsersThree weight="duotone" />
                                </span>
                                <div>
                                  <h2>{group.name}</h2>
                                  <p>{fa(group.members.length)} دوست</p>
                                  <div className="circle-avatars">
                                    {accepted
                                      .filter((f) =>
                                        group.members.includes(f.id),
                                      )
                                      .slice(0, 4)
                                      .map((f) => (
                                        <Avatar
                                          key={f.id}
                                          person={f}
                                          size={27}
                                        />
                                      ))}
                                  </div>
                                </div>
                                <CaretLeft size={20} />
                              </button>
                            ))}
                          </div>
                          {!data.circles.length && (
                            <p className="circles-empty">
                              دوست‌های دانشگاه، خانواده یا آدمای همیشگی رو برای
                              خودت دسته‌بندی کن.
                            </p>
                          )}
                          <Button
                            secondary
                            className="connect-code-button"
                            onClick={() => setDialog("addFriend")}
                          >
                            <UserPlus size={20} /> کد دوستم رو دارم
                          </Button>
                        </>
                      )}
                    </>
                  )}
                </section>
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
                            ? "همه‌ی قابلیت‌ها مهمون مائن."
                            : me.trialUntil
                              ? `هدیه‌ی تو تا ${new Date(me.trialUntil).toLocaleDateString("fa-IR")}`
                              : "خبر و نقشه و استوری همیشه رایگانه."}
                      </p>
                    </div>
                    <CaretLeft size={17} />
                  </button>
                  {data.testing && !me.lifetime && me.trialDaysSaved > 0 && (
                    <div className="saved-premium-card">
                      <CrownSimple size={23} weight="duotone" />
                      <div>
                        <strong>
                          {fa(me.trialDaysSaved)} روز هدیه‌ات محفوظه
                        </strong>
                        <p>
                          الان همه پرمیومن. روزهای هدیه‌ات بعد از پایان آزمایش
                          شروع می‌شن.
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
                        <h2>خبرها و اعلان‌ها</h2>
                        <p>با اجازه‌ی خودت، برای آدمای خودت</p>
                      </div>
                      <CaretLeft size={18} />
                    </button>
                  )}
                  {me.isAdmin && (
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
                      <h2>خبرهات با خودت بمونه</h2>
                      <p>
                        مهمان به همین مرورگر وصله. با شماره‌ت که عضو بشی،
                        می‌تونی از یه دستگاه دیگه هم برگردی.
                      </p>
                      <Button lilac onClick={openAuth}>
                        عضویت با دعوت
                        <Phone size={18} />
                      </Button>
                    </div>
                  )}
                  <div className="section-heading shared-heading">
                    <h2>خاطره‌های مشترک</h2>
                    <Heart size={18} weight="duotone" />
                  </div>
                  {data.moments.length ? (
                    <div className="shared-list">
                      {data.moments.slice(0, 5).map((item) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            setMoment(item);
                            setDialog("moment");
                          }}
                        >
                          <Avatar person={item.friend} size={36} mood="love" />
                          <strong>{item.friend.name}</strong>
                          <span>
                            {item.kind === "together" ? "با هم" : "پشت سر هم"}
                          </span>
                          <CaretLeft size={17} />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="no-moments">
                      وقتی تو و یه دوست وصل‌شده نزدیک به هم خبر بدین، خاطره‌ی
                      مشترکتون اینجا میاد.
                    </p>
                  )}
                </section>
              )}
              {screen === "stats" && (
                <section className="page stats-page">
                  <Header title="آمار جیشام" back={() => navigate("profile")} />
                  <div className="segmented">
                    {["هفته", "ماه", "همه‌وقت"].map((value) => (
                      <button
                        key={value}
                        className={period === value ? "active" : ""}
                        onClick={() => setPeriod(value)}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                  <div className="chart-card">
                    <strong className="total-count">
                      {fa(
                        period === "هفته"
                          ? data.stats.week
                          : period === "ماه"
                            ? data.stats.month
                            : data.stats.total,
                      )}
                    </strong>
                    <p>بار جیش کردی</p>
                    <Chart stats={data.stats} />
                    <div className="chart-foot">
                      <Drop size={20} weight="duotone" />
                      <span>نمودار ۷ روز اخیر · خبرهای واقعی خودت</span>
                    </div>
                  </div>
                  <div className="mood-card">
                    <h2>سهم حالت</h2>
                    <div className="mood-meter">
                      <span
                        style={{
                          width: `${data.stats.total + data.stats.need ? (data.stats.total / (data.stats.total + data.stats.need)) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <div className="mood-labels">
                      <span>
                        <Drop weight="duotone" />
                        <strong>{fa(data.stats.total)}</strong>
                        <small>جیش کردم</small>
                      </span>
                      <span>
                        <Drop weight="duotone" />
                        <strong>{fa(data.stats.need)}</strong>
                        <small>جیش دارم</small>
                      </span>
                    </div>
                  </div>
                  <Button
                    lilac
                    className="stats-share"
                    onClick={() => openStory("weekly")}
                  >
                    <ShareNetwork size={19} /> این هفته رو استوری کن
                  </Button>
                </section>
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
                    عضویت فعلاً با دعوت و شماره موبایله. دوستت می‌تونه اول مهمان
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
                      <Button secondary onClick={() => openStory("invite")}>
                        استوری با کد دعوت من
                        <Sparkle size={20} weight="duotone" />
                      </Button>
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
            <nav
              className="bottom-nav v2-nav"
              aria-label="ناوبری اصلی"
              dir="ltr"
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
            </nav>
          </>
        )}

        {dialog && !["story", "momentStory"].includes(dialog) && (
          <Modal
            onClose={() => setDialog(null)}
            className={
              ["success", "need", "moment"].includes(dialog)
                ? "success-dialog full"
                : ""
            }
          >
            {dialog === "auth" && (
              <AuthWizard
                invitation={invitation}
                onComplete={completeAuth}
                notify={notify}
              />
            )}
            {dialog === "need" && (
              <>
                <div className="reaction-kicker">
                  <Drop size={18} weight="duotone" /> وضعیت: فوری ولی خجالتی
                </div>
                <div className="need-reaction-art">
                  <Mascot size={255} animate />
                </div>
                <h1>
                  جیش دارم.
                  <br />
                  همراه می‌خوام!
                </h1>
                <p className="success-subtitle">
                  یه خبر کوچولو، یه بهونه برای با هم بودن.
                </p>
                <div className="reaction-sticker">
                  <Sparkle size={18} weight="fill" /> این یکی رو استوری کن،
                  رفیقتو پیدا کن.
                </div>
                <div className="success-buttons">
                  <Button lilac onClick={() => openStory("need")}>
                    <ShareNetwork size={19} /> استوریِ وضعیت اضطراری
                  </Button>
                  <Button
                    secondary
                    onClick={() => {
                      setDialog(null);
                      navigate("discover");
                    }}
                  >
                    کی همراهمه؟ <UsersThree size={19} />
                  </Button>
                  <button
                    className="text-link auth-back"
                    onClick={() => setDialog(null)}
                  >
                    فعلاً پیش خودمون بمونه
                  </button>
                </div>
              </>
            )}
            {dialog === "success" && (
              <>
                <div className="success-art personal-success">
                  <Mascot size={250} mood="happy" animate />
                  <Sparkle
                    size={32}
                    weight="duotone"
                    className="success-sparkle s-one"
                  />
                  <Confetti
                    size={33}
                    weight="duotone"
                    className="success-sparkle s-two"
                  />
                </div>
                <h1>آخیش… نجات پیدا کردم!</h1>
                <p className="success-subtitle">این حسِ سبک‌شدن باید ثبت شه.</p>
                <p className="success-time">همین الان · توی جیشو ثبت شد</p>
                <div className="today-card">
                  <p>جیش‌های امروزت</p>
                  <strong>
                    {fa(data.stats.today)}
                    <Drop size={27} weight="duotone" />
                  </strong>
                  <p className="success-small-note">
                    هر خبر کوچولو، یه لحظه‌ی سبک‌تر.
                  </p>
                </div>
                <div className="success-buttons">
                  <Button
                    lilac
                    onClick={() => {
                      setDialog(null);
                      openStory("checkin");
                    }}
                  >
                    این آخیش رو استوری کن
                    <ShareNetwork size={19} />
                  </Button>
                  <Button secondary onClick={() => setDialog(null)}>
                    عالیه!
                  </Button>
                  {!me.registered && (
                    <button className="text-link auth-back" onClick={openAuth}>
                      اگه خواستی، با دعوت عضو شو
                    </button>
                  )}
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
                    : "تا پنج دقیقه فاصله، یه اتفاق کوچولو."}
                </p>
                <div className="success-buttons">
                  <Button
                    lilac
                    onClick={() => {
                      setDialog("momentStory");
                    }}
                  >
                    استوری این خاطره
                    <ShareNetwork size={20} />
                  </Button>
                  <Button
                    secondary
                    onClick={() => {
                      const friend = accepted.find(
                        (f) => f.id === moment.friend.id,
                      );
                      if (friend) {
                        setSelectedFriend(friend);
                        setDialog("friend");
                      } else setDialog(null);
                    }}
                  >
                    دیدن ارتباطمون
                    <LinkSimple size={19} />
                  </Button>
                  <button
                    className="text-link auth-back"
                    onClick={() => setDialog(null)}
                  >
                    این هم می‌شه یه خاطره.
                  </button>
                </div>
              </>
            )}
            {dialog === "friend" && selectedFriend && (
              <>
                <div className="friend-dialog-head">
                  <Avatar person={selectedFriend} size={105} mood="happy" />
                  <h2>{selectedFriend.name}</h2>
                  <span>به هم وصلید</span>
                </div>
                <div className="friend-socials">
                  <h3>لینک‌های {selectedFriend.name}</h3>
                  {Object.keys(selectedFriend.socialLinks).length ? (
                    Object.entries(selectedFriend.socialLinks).map(
                      ([type, url]) => (
                        <a
                          key={type}
                          href={url}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          {
                            {
                              instagram: <InstagramLogo size={23} />,
                              telegram: <TelegramLogo size={23} />,
                              x: <XLogo size={23} />,
                              website: <LinkSimple size={23} />,
                            }[type]
                          }
                          <span>
                            {
                              {
                                instagram: "اینستاگرام",
                                telegram: "تلگرام",
                                x: "ایکس",
                                website: "سایت",
                              }[type]
                            }
                          </span>
                          <ArrowSquareOut size={18} />
                        </a>
                      ),
                    )
                  ) : (
                    <p>
                      لینک‌هاش خصوصی‌ان. اگه خودش بخواد، اینجا بهت نشون داده
                      می‌شن.
                    </p>
                  )}
                </div>
                <label className="social-sharing-choice">
                  <span>
                    لینک‌های من برای {selectedFriend.name} قابل دیدن باشه
                    <small>فقط برای همین دوست، هر وقت خواستی خاموشش کن.</small>
                  </span>
                  <input
                    type="checkbox"
                    className="toggle"
                    checked={selectedFriend.sharing}
                    onChange={(e) =>
                      changeSocialSharing(selectedFriend, e.target.checked)
                    }
                    disabled={busy || !me.premium}
                  />
                </label>
                <label className="social-sharing-choice">
                  <span>
                    اعلان‌های {selectedFriend.name}
                    <small>فقط خبرهای همین دوست</small>
                  </span>
                  <input
                    type="checkbox"
                    className="toggle"
                    checked={
                      !data.notificationPreferences?.some(
                        (p) =>
                          p.scope === "friend" &&
                          p.id === selectedFriend.id &&
                          !p.enabled,
                      )
                    }
                    disabled={busy}
                    onChange={(e) =>
                      notificationPreference(
                        "friend",
                        selectedFriend.id,
                        e.target.checked,
                      )
                    }
                  />
                </label>
                {!Object.keys(me.socialLinks || {}).length && (
                  <button
                    className="text-link auth-back"
                    onClick={openSettings}
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
            {dialog === "addFriend" && (
              <>
                <div className="dialog-icon purple">
                  <UserPlus size={30} weight="duotone" />
                </div>
                <h2>به یه دوست وصل شو</h2>
                <p className="dialog-description">
                  کد دعوت دوستت رو بنویس. وقتی درخواستت رو قبول کنه، به هم وصل
                  می‌شین.
                </p>
                <form onSubmit={requestFriend}>
                  <label className="field-label">
                    کد دوستت
                    <input
                      value={friendCode}
                      onChange={(e) =>
                        setFriendCode(e.target.value.toUpperCase())
                      }
                      placeholder="J-..."
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
                <h2>یه جمع برای خودت</h2>
                <p className="dialog-description">
                  دوست‌های وصل‌شده رو راحت‌تر پیدا کن. این دسته‌بندی فقط برای
                  خودته.
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
                    ساخت جمع
                    <Plus size={18} />
                  </Button>
                </form>
              </>
            )}
            {dialog === "settings" && (
              <>
                <h2>پروفایل خودت</h2>
                <p className="dialog-description">
                  اسم و لینک‌ها مال خودتن. هیچ لینکی بدون اجازه‌ی تو نمایش داده
                  نمی‌شه.
                </p>
                <form onSubmit={saveProfile}>
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
                      <small>یا شخصیت کوچولوی ساخته‌شده از اسمت</small>
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
                  {[
                    ["instagram", "اینستاگرام", "@username"],
                    ["telegram", "تلگرام", "@username"],
                    ["x", "ایکس", "@username"],
                    ["website", "وب‌سایت", "https://..."],
                  ].map(([key, label, placeholder]) => (
                    <label className="field-label social-field" key={key}>
                      {label}
                      <input
                        value={socials[key] || ""}
                        onChange={(e) =>
                          setSocials((current) => ({
                            ...current,
                            [key]: e.target.value,
                          }))
                        }
                        placeholder={placeholder}
                        dir="ltr"
                      />
                    </label>
                  ))}
                  <Button lilac type="submit" disabled={busy}>
                    ذخیره تغییرات
                    <Check size={19} />
                  </Button>
                </form>
                <button className="signout" onClick={logout} disabled={busy}>
                  <SignOut size={18} />
                  خروج از حساب
                </button>
                <button
                  className="delete-account-link"
                  onClick={() => setDialog("deleteAccount")}
                >
                  <Trash size={15} />
                  پاک‌کردن حساب و خبرهای من
                </button>
              </>
            )}
            {dialog === "guestSettings" && (
              <>
                <Avatar person={me} size={95} mood="shy" />
                <h2>مهمانِ خودمونی</h2>
                <p className="dialog-description">
                  جیش و آمار و استوری بدون عضویت کار می‌کنن. با یه دعوت، شماره‌ت
                  رو اضافه کن تا از دستگاه‌های دیگه هم برگردی.
                </p>
                <Button lilac onClick={openAuth}>
                  ورود یا عضویت با دعوت
                </Button>
                <button
                  className="delete-account-link"
                  onClick={() => setDialog("deleteAccount")}
                >
                  <Trash size={15} />
                  پاک‌کردن خبرهای مهمان
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
                    : "خبرهای روزانه، آمار، نقشه و استوری عادی همیشه رایگان می‌مونن."}
                </p>
                <div className="premium-features">
                  <p>
                    <Check size={19} />
                    جیش، آمار و نقشه — همیشه رایگان
                  </p>
                  <p>
                    <Check size={19} />
                    استوری و دعوت — همیشه رایگان
                  </p>
                  <p>
                    <CrownSimple size={19} />
                    اشتراک اختیاری لینک‌های اجتماعی
                  </p>
                  <p>
                    <CrownSimple size={19} />
                    خاطره‌های باهم و پشت‌سرهم
                  </p>
                </div>
                <div className="invite-rules">
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
                  {me.registered ? "حسابت پاک بشه؟" : "خبرهای مهمان پاک بشه؟"}
                </h2>
                <p className="dialog-description">
                  خبرها، ارتباط‌ها و اطلاعات خودت حذف می‌شن. این کار قابل برگشت
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
                data={data}
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
