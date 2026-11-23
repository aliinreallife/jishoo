import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  lazy,
  Suspense,
} from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { readPage, screenPath, notificationPath } from "./routing";
import { useDialogHistory } from "./use-dialog-history";
import "./styles.css";
import "./v2.css";
import "./community.css";
import "./v3.css";
import "./readability.css";
import "./desktop-frame.css";
import "./tab-layout.css";
import "./flow-fixes.css";
import LoadingScreen from "./components/LoadingScreen";
import "./components/MapVisibility.css";
import { visibilityMode, visibilityLabel } from "./map-visibility";
import { cleanSocialLinks, socialFieldError, socialKinds } from "../lib/social-links";
import { currentRelease, releaseStorageKey } from "./current-release";
import { ReleaseNotes } from "./components/ReleaseNotes";
const DailyStreak = lazy(() => import("./components/DailyStreak"));
const AuthWizard = lazy(() => import("./components/AuthWizard"));
const PromoRedeem = lazy(() => import("./components/PromoRedeem"));
const PromoLanding = lazy(() => import("./components/PromoLanding"));
import Button from "./components/Button";
import { blockUpdates } from "./updates";
import {
  House,
  Camera,
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
const Install = lazy(() => import("./components/Install"));
const InstallCard = lazy(() =>
  import("./components/Install").then((m) => ({ default: m.InstallCard })),
);
const Support = lazy(() => import("./components/Support"));
const Friends = lazy(() => import("./components/Friends"));
const Stats = lazy(() => import("./components/Stats"));
const StreakPage = lazy(() => import("./components/StreakPage"));
const Legal = lazy(() => import("./components/Legal"));
const GroupJoin = lazy(() => import("./components/GroupJoin"));
const PhotoEditor = lazy(() => import("./components/PhotoEditor"));
const MapVisibility = lazy(() => import("./components/MapVisibility"));
const InvitationQuota = lazy(() => import("./components/InvitationQuota"));
const SharedMemories = lazy(() => import("./components/SharedMemories"));
const SocialConnection = lazy(() => import("./components/SocialConnection"));
const SocialAccountFields = lazy(() => import("./components/SocialConnection").then(module => ({ default: module.SocialAccountFields })));
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
const SetupProgress = lazy(() => import("./components/SetupProgress"));
const CheckinReminder = lazy(() => import("./components/CheckinReminder"));
import { api, apiRevision, getInvite, fa, relativeTime, inviteUrl, copyText, inviteGiftLabel } from "./api";
import { normalizePromoCode } from "./promo-link";

const assets = `${import.meta.env.BASE_URL}assets/`;
function LoadingSection() { return <LoadingScreen compact message="داریم این قسمت رو آماده می‌کنیم…" />; }
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
  const dialog = useRef(), close = useRef(onClose);
  close.current = onClose;
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
      if (e.key === "Escape") close.current();
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
export default function App() {
  const routeLocation = useLocation(), routerNavigate = useNavigate();
  const page = readPage(routeLocation.pathname + routeLocation.search + routeLocation.hash);
  const screen = page.screen === "settings" ? "profile" : page.screen;
  const groupCode = new URLSearchParams(routeLocation.search).get("group") || "";
  const arrivingPromo = new URLSearchParams(routeLocation.search).get("promo") || "";
  const publicPage = ["terms", "privacy", "support", "install"].includes(screen);
  const [data, setData] = useState(null),
    [loadError, setLoadError] = useState(""),
    // Entry owns the public landing; every app URL opens its requested screen.
    [entered, setEntered] = useState(true),
    [storyKind, setStoryKind] = useState(page.storyKind),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [invitation, setInvitation] = useState(null),
    [inviteError, setInviteError] = useState(""),
    [promoLanding, setPromoLanding] = useState(() => Boolean(new URLSearchParams(location.search).get("promo"))),
    [promoInfo, setPromoInfo] = useState(null),
    [promoError, setPromoError] = useState(""),
    [promoRedeeming, setPromoRedeeming] = useState(false),
    [promoRetry, setPromoRetry] = useState(0),
    [moment, setMoment] = useState(null),
    [selectedFriend, setSelectedFriend] = useState(null),
    [dialogCircle, setSelectedCircle] = useState(""),
    [friendCode, setFriendCode] = useState(""),
    [circleName, setCircleName] = useState(""),
    [circleMembers, setCircleMembers] = useState([]),
    [profileName, setProfileName] = useState(""),
    [profileHandle, setProfileHandle] = useState(""),
    [publicPerson, setPublicPerson] = useState(null),
    [publicError, setPublicError] = useState(""),
    [socials, setSocials] = useState({}),
    [audience, setAudience] = useState("friends"),
    [photoFile, setPhotoFile] = useState(null),
    [mapStart, setMapStart] = useState(null),
    [pendingCheckin, setPendingCheckin] = useState(null),
    [groupHandle, setGroupHandle] = useState(""),
    [groupActionType, setGroupActionType] = useState("leave"),
    [inviteLanding, setInviteLanding] = useState(() =>
      Boolean(new URLSearchParams(location.search).get("invite")),
    );
  const selectedCircle = page.circleId || dialogCircle;
  const { dialog, setDialog: setDialogState, overlay, closeAll: closeDialogs } = useDialogHistory(routeLocation, routerNavigate,
    page.screen === "settings" && data ? (data.me.registered ? "settings" : "guestSettings") : null, data?.me.id);
  const updateBlocked = !publicPage && ((!data && !loadError) || Boolean(dialog) || busy || Boolean(pendingCheckin) || inviteLanding || promoLanding || ["stories", "groupJoin"].includes(screen));
  useLayoutEffect(() => {
    if (updateBlocked) return blockUpdates();
  }, [updateBlocked]);
  const mapMemory = useRef({ userId: null, state: {} });
  if (mapMemory.current.userId !== data?.me.id) mapMemory.current = { userId: data?.me.id, state: {} };
  function goBack(fallback = "profile") {
    if ((routeLocation.state?.appFrom || routeLocation.state?.settingsFrom) && window.history.state?.idx > 0) routerNavigate(-1);
    else routerNavigate(screenPath(fallback), { replace: true });
  }
  function closeSettings() { goBack("profile"); }
  function setDialog(value) {
    if (value === null && dialog === "photo") setPhotoFile(null);
    if (value === null && page.screen === "settings" && !overlay) closeSettings();
    else setDialogState(value);
  }
  const returningVisitor = useRef(localStorage.getItem("jishoo:v2-entered") === "true"),
    releaseHandled = useRef(false),
    pendingRef = useRef(null),
    timer = useRef(),
    usedAdminAccess = useRef(null),
    scroll = useRef(),
    profilePhotoInput = useRef(),
    visibilityEditor = useRef(),
    visibilityReturn = useRef(null),
    visibilityPrompted = useRef(new Set()),
    lastRefresh = useRef(0),
    promoPending = useRef(normalizePromoCode(new URLSearchParams(location.search).get("promo")) || sessionStorage.getItem("jishoo:promo") || ""),
    promoAttempt = useRef(""),
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
      const revision = apiRevision();
      const value = await api("bootstrap");
      if (revision !== apiRevision()) return;
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
    if (!arrivingPromo || new URLSearchParams(routeLocation.search).has("invite")) return;
    setPromoLanding(true);
    const code = normalizePromoCode(arrivingPromo);
    if (!code) {
      promoPending.current = "";
      sessionStorage.removeItem("jishoo:promo");
      setPromoError("لینک هدیه معتبر نیست.");
      return;
    }
    promoPending.current = code;
    sessionStorage.setItem("jishoo:promo", code);
    setPromoInfo(null);
    setPromoError("");
    let active = true;
    api("promo-info", undefined, { code })
      .then(offer => { if (active) setPromoInfo(offer); })
      .catch(error => { if (active) setPromoError(error.message); });
    return () => { active = false; };
  }, [arrivingPromo]);
  useEffect(() => {
    if (!data?.me.registered || !promoPending.current) return;
    const code = promoPending.current;
    const claimKey = data.me.id + ":" + code;
    if (promoAttempt.current === claimKey) return;
    promoAttempt.current = claimKey;
    setPromoRedeeming(true);
    api("promo-redeem", { code })
      .then(async gift => {
        promoPending.current = "";
        sessionStorage.removeItem("jishoo:promo");
        setPromoError("");
        await refresh();
        notify(gift.banked
          ? "۳۰ روز پرمیوم هدیه‌ات ذخیره شد و بعد از دورهٔ آزمایشی شروع می‌شه 💛"
          : "۳۰ روز پرمیوم جیشو برات فعال شد 💛");
        setPromoLanding(false);
        const params = new URLSearchParams(location.search);
        params.delete("promo");
        routerNavigate("/home" + (params.size ? "?" + params : ""), { replace: true });
      })
      .catch(error => {
        if (error.code === "promo_already_redeemed") {
          promoPending.current = "";
          sessionStorage.removeItem("jishoo:promo");
          setPromoLanding(false);
          routerNavigate("/home", { replace: true });
          notify("این هدیه قبلاً برای همین حساب فعال شده 💛");
        } else setPromoError(error.message);
      })
      .finally(() => setPromoRedeeming(false));
  }, [data?.me.id, data?.me.registered, arrivingPromo, promoRetry]);
  useEffect(() => {
    if (!publicPage && !data) refresh();
  }, [publicPage, refresh]);
  useEffect(() => {
    return () => {
      clearTimeout(timer.current);
    };
  }, []);
  useEffect(() => {
    const handle = page.handle;
    let active = true;
    setPublicPerson(null); setPublicError("");
    if (handle) Promise.all([
      fetch(`/api/app?action=profile-public&handle=${encodeURIComponent(handle)}`, { credentials: "include" }).then(async response => {
        const value = await response.json();
        if (!response.ok) throw new Error(value.message);
        return value;
      }), refresh(),
    ]).then(([value]) => { if (active) setPublicPerson(value.profile); })
      .catch(error => active && setPublicError(error.message));
    return () => { active = false; };
  }, [page.handle, refresh]);
  useEffect(() => {
    const token = new URLSearchParams(routeLocation.search).get("adminAccess");
    if (!data?.me.registered || !token || usedAdminAccess.current === token) return;
    usedAdminAccess.current = token;
    api("admin-redeem", { token })
      .then(async () => {
        await refresh();
        setEntered(true);
        const params = new URLSearchParams(location.search);
        params.delete("adminAccess");
        routerNavigate("/admin" + (params.size ? "?" + params : ""), { replace: true });
        notify("خوش برگشتی، مدیر!");
      })
      .catch((e) => notify(e.message));
  }, [data?.me.registered, routeLocation.search]);
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
        sessionStorage.removeItem("jishoo:invite");
        routerNavigate("/admin", { replace: true });
        notify("حساب مدیریتی‌ت آماده‌ست!");
      })
      .catch((error) => notify(error.message));
  }, [data?.me.registered, invitation?.code]);
  useEffect(() => {
    if (screen === "stories") setStoryKind(page.storyKind);
    if (page.screen === "settings" && data) {
      setProfileName(data.me.name);
      setProfileHandle(data.me.handle || "");
      setSocials(data.me.socialLinks || {});
    }
  }, [routeLocation.pathname, data?.me.id]);
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
    if (["friends", "circle", "notifications", "stats", "streak"].includes(screen)) refresh();
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
    const code = arrivingInvite || inviteFromUrl.current;
    setInviteLanding(Boolean(arrivingInvite));
    if (!code) return;
    let active = true;
    inviteFromUrl.current = code;
    setInviteError("");
    sessionStorage.setItem("jishoo:invite", code);
    getInvite(code)
      .then(value => active && setInvitation(value))
      .catch((error) => active && setInviteError(error.message));
    return () => { active = false; };
  }, [arrivingInvite]);
  useEffect(() => {
    if (!data) return;
    const params = new URLSearchParams(location.search);
    if (params.get("login") !== "1") return;
    params.delete("login");
    routerNavigate(location.pathname + (params.size ? "?" + params : "") + location.hash, { replace: true, state: routeLocation.state });
    setEntered(true);
    if (!data.me.registered) setDialog("auth");
  }, [data?.me.id]);
  useEffect(() => {
    if (!data || !entered || inviteLanding || promoLanding || page.screen === "settings" || releaseHandled.current || ["nearby", "terms", "privacy", "support", "install"].includes(screen)) return;
    const seen = localStorage.getItem(releaseStorageKey);
    if (seen === currentRelease.version) { releaseHandled.current = true; return; }
    if (!seen && !returningVisitor.current && !data.me.registered) {
      localStorage.setItem(releaseStorageKey, currentRelease.version);
      releaseHandled.current = true;
      return;
    }
    if (!dialog && !pendingCheckin) setDialog("whatsNew");
  }, [data?.me.id, entered, inviteLanding, promoLanding, dialog, pendingCheckin, screen]);
  useEffect(() => {
    if (screen !== "nearby" || !data || data.me.mapVisibilityReviewed !== false || dialog || pendingCheckin || visibilityPrompted.current.has(data.me.id)) return;
    visibilityPrompted.current.add(data.me.id);
    openMapVisibility();
  }, [screen, data?.me.id, data?.me.mapVisibilityReviewed, dialog, pendingCheckin]);
  useEffect(() => {
    const params = new URLSearchParams(location.search),
      outcome = params.get("google");
    if (!outcome || !data) return;
    params.delete("google");
    routerNavigate(location.pathname + (params.size ? "?" + params : "") + location.hash, { replace: true, state: routeLocation.state });
    if (outcome === "continue") {
      setDialog("auth");
      notify(data.inviteOnly ? "گوگلت تایید شد؛ دعوت داری یا بریم فهرست انتظار؟" : "گوگلت تایید شد؛ فقط اسمت رو وارد کن.");
    } else if (outcome === "invite_required") {
      setDialog("auth");
      notify("با این گوگل هنوز عضو نشدی؛ اول دعوتت رو وارد کن.");
    } else if (outcome === "merge_required") {
      setEntered(true);
      openSettings();
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
    // Query state belongs to its flow, rather than leaking into every page.
    routerNavigate(screenPath(next, id) + (next === "groupJoin" ? location.search : ""), {
      replace: Boolean(overlay),
      state: { appFrom: routeLocation.pathname + routeLocation.search },
    });
  }
  function finishInviteLanding() {
    setInviteLanding(false); setEntered(true); setInvitation(null);
    sessionStorage.removeItem("jishoo:invite"); inviteFromUrl.current = "";
    const params = new URLSearchParams(location.search); params.delete("invite");
    routerNavigate("/home" + (params.size ? "?" + params : ""), { replace: true });
  }
  function openAuth() {
    setDialog("auth");
  }
  function openMapVisibility() {
    visibilityReturn.current = page.screen === "settings" ? "settings" : null;
    setDialogState("mapVisibility");
  }
  function finishMapVisibility(mode, point) {
    setData(current => ({ ...current, me: { ...current.me, shareLocation: mode !== "hidden", discoverable: mode === "profile", mapVisibilityReviewed: true } }));
    if (point) {
      setMapStart(point);
      mapMemory.current.state.position = point;
      if (mapMemory.current.state.cameras) delete mapMemory.current.state.cameras.local;
    }
    setDialogState(null);
  }
  function keepMapVisibility() {
    const mode = visibilityMode(data.me);
    finishMapVisibility(mode);
    // Dismissing explains the current preference; it never publishes location.
    api("map-visibility", { mode, reviewOnly: true }).catch(() => {});
  }
  function dismissRelease() {
    localStorage.setItem(releaseStorageKey, currentRelease.version);
    releaseHandled.current = true;
    setDialog(null);
  }
  function shareStreak(days) {
    routerNavigate("/stories/streak" + (days ? "?milestone=" + days : ""), { state: { streakShareFrom: screen === "achievements" ? "/achievements" : "/streak" } });
  }
  function closeStreakStory() {
    if (["/streak", "/achievements"].includes(routeLocation.state?.streakShareFrom)) routerNavigate(-1);
    else routerNavigate("/streak", { replace: true });
  }
  function openStory(kind) {
    setStoryKind(kind);
    setDialog("story");
  }
  function completeAuth(result) {
    setData(result);
    setEntered(true);
    setInviteLanding(false);
    navigate(
      result.me.isAdmin
        ? "admin"
        : screen === "groupJoin" && groupCode
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
  async function checkin(status, visibility = audience) {
    if (busy || pendingRef.current) return;
    clearTimeout(timer.current);
    setNotice("");
    const queued = { status, visibility, nonce: crypto.randomUUID() };
    pendingRef.current = queued;
    setPendingCheckin(queued);
    setBusy(true);
    setEntered(true);
    setDialog(status === "done" ? "success" : "need");
    try {
      const result = await api("checkin", queued);
      setData(current => ({ ...current, stats: result.stats }));
      if (result.matches?.length) {
        setMoment(result.matches[0]);
        setDialog(current => current === "story" ? current : "moment");
        refresh();
      }
    } catch (error) {
      setDialog(null);
      notify(error.message);
    } finally {
      pendingRef.current = null;
      setPendingCheckin(null);
      setBusy(false);
    }
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
    const url = new URL("/group", data.publicUrl);
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
    if (page.screen === "settings") return;
    routerNavigate("/settings", { state: { settingsFrom: routeLocation.pathname + routeLocation.search } });
  }
  async function saveProfile(e) {
    e.preventDefault();
    const result = await perform("profile", {
      name: profileName,
      ...(profileHandle.trim() ? { handle: profileHandle.trim() } : {}),
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
  function openMySocialAccounts() {
    if (!me.registered) { openAuth(); return; }
    setSelectedFriend(null);
    openSocialAccounts();
  }
  async function saveSocialAccounts(event) {
    event.preventDefault();
    let socialLinks;
    try { socialLinks = cleanSocialLinks(socials); }
    catch (error) { notify(error.message); event.currentTarget.querySelector('[aria-invalid="true"]')?.focus(); return; }
    const result = await perform("profile", { socialLinks });
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
  function updateReminderPreferences(preferences, extra = {}) {
    setData(current => ({ ...current, me: { ...current.me, ...extra, checkinReminders: preferences } }));
  }
  function uploadAvatar(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) { setPhotoFile(file); setDialog("photo"); }
  }
  async function saveAvatar(image) {
    setBusy(true);
    try {
      setData(await api("avatar", { image }));
      setPhotoFile(null);
      setDialog(null);
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
      setMapStart(null);
      setInvitation(null);
      inviteFromUrl.current = "";
      sessionStorage.removeItem("jishoo:invite");
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
  ].reverse();
  const activeTab = [
    "stats",
    "streak",
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
      className={`desktop-stage ${inviteLanding || promoLanding ? "invite-fullscreen" : ""}`}
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
          <ShieldCheck size={19} />
          <span>مکانت تقریبیه؛ نمایش پروفایل با انتخاب خودته.</span>
        </div>
      </aside>
      <main
        className={`app-shell ${!entered ? "welcome-shell" : ""} ${inviteLanding || promoLanding ? "invite-fullscreen-shell" : ""}`}
        dir="rtl"
      >
        {!data ? (
          <LoadingScreen message={loadError || "داریم جمعمون رو آماده می‌کنیم…"}>
            {loadError && <Button onClick={refresh}>دوباره امتحان کن</Button>}
          </LoadingScreen>
        ) : screen === "groupJoin" ? (
          <Suspense fallback={<LoadingSection />}>
            <GroupJoin
              code={groupCode}
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
        ) : promoLanding && !inviteLanding ? (
          <Suspense fallback={<LoadingSection />}>
            <PromoLanding
              offer={promoInfo}
              error={promoError}
              registered={me.registered}
              testing={data.testing}
              redeeming={promoRedeeming}
              onAuth={() => { setEntered(true); openAuth(); }}
              onRetry={() => {
                promoAttempt.current = "";
                setPromoError("");
                setPromoRetry(value => value + 1);
              }}
              onDismiss={() => {
                setPromoLanding(false);
                promoPending.current = "";
                sessionStorage.removeItem("jishoo:promo");
                routerNavigate("/home", { replace: true });
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
                <section className="page home v2-home tab-page">
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
                  {me.registered && <Suspense fallback={null}><CheckinReminder data={data} pending={Boolean(pendingCheckin)} onChanged={updateReminderPreferences} notify={notify} onPrivateCheckin={() => { setAudience("private"); checkin("done", "private"); }} /></Suspense>}
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
                    onPremium={() => setDialog("premium")}
                    onConnect={connectHandle}
                    startingPosition={mapStart}
                    memory={mapMemory.current.state}
                    onProfile={(handle) => {
                      const friend = accepted.find(person => person.handle === handle);
                      if (friend) { setSelectedFriend(friend); setDialog("friend"); }
                      else navigate(handle === me.handle ? "profile" : "publicProfile", handle);
                    }}
                    onVisibility={openMapVisibility}
                    onInvite={() => me.registered ? navigate("invite") : openAuth()}
                    notify={notify}
                  />
                </Suspense>
              )}
              {screen === "achievements" && (
                <Achievements
                  data={data}
                  onBack={() => goBack("profile")}
                  onShare={() => openStory("weekly")}
                  onShareStreak={shareStreak}
                />
              )}
              {screen === "notifications" && (
                <Notifications
                  data={data}
                  refresh={refresh}
                  notify={notify}
                  onReminderChange={updateReminderPreferences}
                  onBack={() => goBack("home")}
                  onNavigate={(route) => {
                    routerNavigate(notificationPath(route, location.origin), { state: { appFrom: routeLocation.pathname + routeLocation.search } });
                  }}
                />
              )}
              {screen === "admin" && (
                <Admin data={data} refresh={refresh} notify={notify} />
              )}
              {screen === "publicProfile" && (
                <PublicProfile
                  profile={publicPerson}
                  error={publicError}
                  data={data}
                  busy={busy}
                  onBack={() => goBack("home")}
                  onConnect={async () => {
                    const connection = data.friends.find(friend => friend.id === publicPerson.id);
                    if (connection?.status === "accepted") { setSelectedFriend(connection); setDialog("friend"); return; }
                    const accepting = connection?.status === "pending" && connection.incoming;
                    const value = await perform(accepting ? "connection-respond" : "connection-request", accepting ? { id: connection.connectionId, accept: true } : { handle: publicPerson.handle });
                    if (value) {
                      await refresh();
                      notify(accepting ? "حالا با هم دوستید!" : "درخواستت رفت پیش دوستت!");
                    }
                  }}
                  onJoin={async () => {
                    try {
                      setInvitation(publicPerson.inviteCode ? await getInvite(publicPerson.inviteCode) : null);
                      openAuth();
                    } catch (error) { notify(error.message); }
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
                    onBack={() => goBack("friends")}
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
                  {page.storyKind === "streak" ? <StoryDialog label="کارت زنجیرهٔ من" onClose={closeStreakStory}><Stories
                    key={"streak-" + routeLocation.search}
                    initialKind="streak"
                    initialMilestone={new URLSearchParams(routeLocation.search).get("milestone")}
                    data={data} pendingInvite={invitation} onAuth={openAuth} notify={notify}
                    onClose={closeStreakStory}
                  /></StoryDialog> : <Stories
                    key={storyKind || "selection"}
                    initialKind={storyKind}
                    data={data}
                    pendingInvite={invitation}
                    onAuth={openAuth}
                    notify={notify}
                  />}
                </Suspense>
              )}
              {screen === "profile" && (
                <section className="page profile-page v2-profile tab-page">
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
                    <button className="profile-avatar personal-character profile-avatar-picker" aria-label="تغییر عکس پروفایل" onClick={()=>me.registered ? profilePhotoInput.current?.click() : openAuth()}>
                      <Avatar person={me} size={125} mood="shy" animate />
                      <span className="profile-camera-badge"><Camera size={19}/></span>
                    </button>
                    <input ref={profilePhotoInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadAvatar} hidden aria-label="انتخاب عکس پروفایل"/>
                    <IconButton
                      icon={ShareNetwork}
                      label="اشتراک پروفایل من"
                      onClick={shareProfile}
                    />
                  </div>
                  <h1>{me.name}</h1>
                  {me.avatarImage && <button className="text-link reset-profile-character" disabled={busy} onClick={async()=>{const value=await perform("avatar",{image:null});if(value)setData(value);}}>برگشت به شخصیت خودم</button>}
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
                  {me.registered && <Suspense fallback={null}><SetupProgress key={me.id} data={data} notify={notify} refresh={refresh} onMap={openMapVisibility} onSocial={openMySocialAccounts} onInvite={() => navigate("invite")} /></Suspense>}
                  <Suspense fallback={null}><DailyStreak streak={data.stats.streak} onOpen={() => navigate("streak")} /></Suspense>
                  <button className="profile-community-link profile-map-visibility" onClick={openMapVisibility}>
                    <MapPin size={26} weight="duotone" />
                    <div><h2>نمایش من روی نقشه</h2><p>انتخاب دیده‌شدن، همیشه دست خودته</p></div>
                    <span className="visibility-summary">{visibilityLabel(visibilityMode(me))}</span>
                    <CaretLeft size={17} />
                  </button>
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
                      <small className="premium-free-hint">ثبت جیش، دوست‌ها، گروه‌ها، آمار، نقشهٔ اطراف و استوری شخصی همیشه رایگانن.</small>
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
                  <button className="profile-community-link" onClick={openMySocialAccounts}>
                    <LinkSimple size={26}/><div><h2>من تو شبکه‌های اجتماعی</h2><p>حساب‌هات؛ با اجازهٔ خودت برای دوستات</p></div><CaretLeft size={18}/>
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
                  <Suspense fallback={<LoadingSection />}> <SharedMemories
                    moments={data.moments}
                    onOpen={(item) => {
                      setMoment(item);
                      setDialog("moment");
                    }}
                    onFindFriends={() =>
                      me.registered ? navigate("friends") : openAuth()
                    }
                  /> </Suspense>
                </section>
              )}
              {screen === "streak" && <Suspense fallback={<LoadingSection />}><StreakPage data={data} onBack={() => goBack("profile")} onShare={shareStreak} /></Suspense>}
              {screen === "stats" && (
                <Suspense fallback={<LoadingSection />}>
                  <Stats
                    data={data}
                    onBack={() => goBack("profile")}
                    onShare={() => openStory("weekly")}
                  />
                </Suspense>
              )}
              {screen === "invite" && (
                <section className="page invite-page">
                  <Header
                    title="یه دوست بیار تو جمع"
                    back={() => goBack("profile")}
                  />
                  <div className="invite-character-pair">
                    <PairArt size={295} />
                  </div>
                  <h2>با دعوت تو، ۷ روز هدیه برای هر دوتون!</h2>
                  <p className="invite-page-description">
                    عضویت فعلاً با دعوت و گوگله. دوستت می‌تونه اول مهمان
                    باشه؛ اسم فقط موقع ساخت حساب لازمه.
                  </p>
                  {me.registered && (
                    <Suspense fallback={null}><InvitationQuota data={data} onShare={shareInvite} /></Suspense>
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
            hideClose={["success", "need", "socialSetup", "socialAccounts"].includes(dialog)}
            fullscreen={["success", "need", "auth", "friend", "settings", "socialAccounts", "photo", "profileShare", "groupInvite", "moment", "premium"].includes(dialog)}
            labelledBy={dialog === "whatsNew" ? "release-title" : dialog === "mapVisibility" ? "visibility-title" : dialog === "socialSetup" ? "social-setup-title" : dialog === "socialAccounts" ? "social-accounts-title" : undefined}
            focusTarget={dialog === "whatsNew" ? "#release-title" : dialog === "socialSetup" ? ".social-setup-reminder button" : dialog === "socialAccounts" ? "#social-accounts-title" : undefined}
            onClose={() => dialog === "mapVisibility" ? visibilityEditor.current?.dismiss() : dialog === "whatsNew" ? dismissRelease() : setDialog(null)}
            className={
              ["success", "need"].includes(dialog)
                ? "success-dialog checkin-dialog full"
                : dialog === "moment"
                  ? "success-dialog page-dialog full"
                  : dialog === "whatsNew" ? "release-dialog"
                  : dialog === "mapVisibility" ? "map-visibility-dialog"
                  : dialog === "friend" ? `page-dialog friend-page-dialog social-page-${selectedFriend?.linkConnection || "none"}`
                  : dialog === "socialAccounts" ? "page-dialog social-accounts-page"
                  : ["auth", "settings", "socialAccounts", "photo", "profileShare", "groupInvite", "premium"].includes(dialog) ? "page-dialog" : ""
            }
          >
            {dialog === "whatsNew" && <ReleaseNotes onClose={dismissRelease} />}
            {dialog === "mapVisibility" && <Suspense fallback={<LoadingSection />}><MapVisibility ref={visibilityEditor} me={me} onSaved={finishMapVisibility} onDismiss={keepMapVisibility} onAuth={openAuth} /></Suspense>}
            {dialog === "auth" && (
              <Suspense fallback={<LoadingSection />}> <AuthWizard
                invitation={invitation}
                authInfo={data.auth}
                inviteOnly={data.inviteOnly}
                onComplete={completeAuth}
                onWaiting={saved => setData(current => ({ ...current, auth: { ...current.auth, waitlisted: true, waitlistPhone: saved.phone } }))}
                onGuest={() => { setEntered(true); setInviteLanding(false); navigate("home"); }}
                notify={notify}
              /> </Suspense>
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
                  <span role="status" aria-live="polite">
                    {pendingCheckin ? <Drop size={17} weight="duotone" /> : <Check size={17} />}
                    {pendingCheckin ? "در حال ثبت…" : "ثبت شد"}
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
                <Suspense fallback={<LoadingSection />}> <SocialConnection
                  friend={selectedFriend}
                  premium={me.premium}
                  busy={busy}
                  onChange={changeSocialSharing}
                /> </Suspense>
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
                <header className="social-editor-header">
                  <span className="social-editor-symbol"><LinkSimple size={23} /></span>
                  <div><span>یه راه دیگه برای پیدا کردنم</span><h2 id="social-accounts-title" tabIndex={-1}>من تو شبکه‌های اجتماعی</h2></div>
                  <button className="social-editor-back" aria-label="برگشت" onClick={() => setDialog(selectedFriend ? "friend" : null)}><ArrowRight size={23} /></button>
                </header>
                <form onSubmit={saveSocialAccounts} className="social-editor-form">
                  <div className="social-editor-scroll">
                    <p className="social-editor-intro">شناسه یا لینک پروفایلت رو بذار؛ هر کدوم رو که دوست داری.</p>
                    <div className="social-editor-fields"><Suspense fallback={<LoadingSection />}><SocialAccountFields value={socials} onChange={setSocials} /></Suspense></div>
                    <div className="social-editor-privacy"><ShieldCheck size={23} /><p><strong>فقط با قبولِ هر دوتون</strong><span>لینک‌هات فقط برای دوست‌هایی باز می‌شن که تبادل حساب‌ها رو با هم قبول کردین. هر وقت خواستی، دسترسی رو قطع کن.</span></p></div>
                  </div>
                  <footer className="social-editor-actions">
                    <Button lilac type="submit" disabled={busy || socialKinds.some(kind => socialFieldError(kind, socials[kind]))}>ذخیره حساب‌ها <Check size={19} /></Button>
                    <small>همه‌ش اختیاریه؛ بعداً هم می‌تونی عوضش کنی.</small>
                  </footer>
                </form>
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
                <button className="settings-map-visibility" onClick={openMapVisibility}>
                  <MapPin size={23} /><span>نمایش من روی نقشه</span><small>{visibilityLabel(visibilityMode(me))}</small><CaretLeft size={17} />
                </button>
                <Suspense fallback={null}>
                  <AccountConnections
                    data={data}
                    onUpdate={(value) => { setData(value); syncPush().catch(() => {}); }}
                    notify={notify}
                  />
                </Suspense>
                <form onSubmit={saveProfile}>
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
            {dialog === "photo" && photoFile && <Suspense fallback={<LoadingSection/>}><PhotoEditor file={photoFile} busy={busy} onSave={saveAvatar} onCancel={()=>{setPhotoFile(null);setDialog(null);}} notify={notify}/></Suspense>}
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
                    <li>آمار شخصی و نقشهٔ اطراف</li>
                    <li>استوری‌های شخصی و فرستادن دعوت</li>
                  </ul>
                </section>
                <section className="premium-feature-group premium-extra" aria-label="امکانات پرمیوم">
                  <h3><CrownSimple size={21} /> قابلیت‌های اضافهٔ پرمیوم</h3>
                  <ul>
                    <li>تبادل حساب‌های اجتماعی با درخواست و قبول هر دو نفر</li>
                    <li>نقشهٔ همه‌جا، با ثبت‌های بی‌نام</li>
                    <li>خاطره‌های «با هم» و «پشت سر هم» و کارت‌های اشتراک‌شون</li>
                  </ul>
                  {data.testing && <p>در دورهٔ آزمایشی، این‌ها هم برای همه رایگان فعاله.</p>}
                </section>
                <Suspense fallback={null}>
                  <PromoRedeem registered={me.registered} testing={data.testing} onRedeemed={refresh} notify={notify} />
                </Suspense>
                <div className="invite-rules premium-trial-notice">
                  <Heart size={19} weight="fill" />
                  <p>
                    با دعوت: ۷ روز برای هر دو نفر. بدون دعوت: ۳ روز برای عضو جدید.
                    {data.inviteOnly ? " عضویت فعلاً با دعوته." : " فعلاً می‌تونی بدون دعوت عضو بشی."}
                  </p>
                </div>
                <Button
                  lilac
                  onClick={() => {
                    me.registered ? navigate("invite") : openAuth();
                  }}
                >
                  {me.registered ? "یه دوست دعوت کنم" : data.inviteOnly ? "عضویت با دعوت" : "عضویت بدون دعوت"}
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
    </div>
  );
}
