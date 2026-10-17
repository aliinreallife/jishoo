import React, { useEffect, useState, useRef, lazy, Suspense } from "react";
import {
  Bell,
  BellSlash,
  MapPin,
  UsersThree,
  Heart,
  Drop,
  Flame,
  Sun,
  Star,
  Medal,
  Copy,
  Plus,
  CrownSimple,
  ShieldCheck,
  ShareNetwork,
  ArrowRight,
  Check,
} from "@phosphor-icons/react";
import { Avatar } from "./Character";
import { PushPermission } from "./HomeNotifications";
import { Mascot, PairArt } from "./Mascot";
import { api, copyText, fa, relativeTime } from "../api";
import {
  enablePush,
  disablePush,
  pushSupported,
  pushEnvironment,
  pushStatus,
  syncPush,
  testPush,
} from "../push";

const AdminSupport = lazy(() => import("./AdminSupport"));
const AdminInvitationTree = lazy(() => import("./AdminInvitationTree"));

const Button = ({ children, ...props }) => (
  <button className="button button-lilac" {...props}>
    {children}
  </button>
);
function useWork(notify) {
  const [busy, setBusy] = useState(false);
  const run = async (work) => {
    setBusy(true);
    try {
      return await work();
    } catch (error) {
      notify(error.message);
    } finally {
      setBusy(false);
    }
  };
  return [busy, run];
}
export function Achievements({ data, onBack, onShare }) {
  const icons = { drop: Drop, sun: Sun, fire: Flame, heart: Heart, star: Star };
  return (
    <section className="page achievements-page">
      <header className="community-heading">
        <button aria-label="برگشت" onClick={onBack}>
          <ArrowRight size={22} />
        </button>
        <div>
          <h1>قشنگی‌های کوچیک من</h1>
          <p>قدم‌های واقعی، لقب‌های بامزه</p>
        </div>
        <button onClick={onShare} aria-label="اشتراک آمار هفته">
          <ShareNetwork size={23} />
        </button>
      </header>
      <div className="achievement-intro">
        <Mascot size={125} mood="happy" />
        <strong>
          {fa((data.achievements || []).reduce((sum, a) => sum + a.level, 0))}{" "}
          سطحِ قشنگ
        </strong>
        <p>
          هر لقب سه سطح داره. روزهای فعال و رفاقت واقعی، قفلشون رو باز می‌کنن.
        </p>
      </div>
      <div className="achievement-list">
        {(data.achievements || []).map((a) => {
          const Icon = icons[a.icon] || Star;
          return (
            <article
              key={a.slug}
              className={`achievement-card ${a.level ? "earned" : "locked"}`}
            >
              <span className="achievement-icon">
                <Icon size={30} weight="duotone" />
              </span>
              <div>
                <span className="achievement-level">
                  {a.level ? `سطح ${fa(a.level)} از ۳` : "هنوز اول راه"}
                </span>
                <h2>{a.level ? a.title : a.name}</h2>
                <p>{a.description}</p>
                <div className="achievement-meter">
                  <span
                    style={{
                      width: `${Math.min(100, (a.progress / (a.next || a.levels.at(-1))) * 100)}%`,
                    }}
                  />
                </div>
                <small>
                  {a.next
                    ? `${fa(a.progress)} از ${fa(a.next)} تا سطح بعد`
                    : "هر سه سطح رو گرفتی!"}
                </small>
              </div>
            </article>
          );
        })}
      </div>
      <p className="soft-note">
        تکرارِ پشت‌سرهمِ ثبت‌ها امتیاز اضافه نمی‌ده؛ «جیش دارم» هم راه میان‌بُرِ
        لقب‌ها نیست.
      </p>
    </section>
  );
}
export function Notifications({ data, refresh, notify, onBack, onNavigate }) {
  const [push, setPush] = useState(false),
    [explain, setExplain] = useState(false),
    [delivery, setDelivery] = useState("");
  const [busy, run] = useWork(notify);
  const environment = pushEnvironment();
  useEffect(() => {
    let active = true;
    pushStatus()
      .then((value) => {
        if (active) setPush(value);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  async function sendTest() {
    setDelivery("");
    await syncPush();
    const result = await testPush();
    setDelivery(
      `سرویس اعلان برای ${fa(result.delivered)} دستگاه از ${fa(result.devices)} دستگاه پیام رو قبول کرد.${result.failed ? ` ${fa(result.failed)} دستگاه نیاز به بررسی اجازه یا اتصال داره.` : ""} نمایش نهایی به تنظیمات هر دستگاه بستگی داره.`,
    );
  }
  return (
    <section className="page notification-page">
      <header className="community-heading">
        <button onClick={onBack} aria-label="برگشت">
          <ArrowRight size={22} />
        </button>
        <div>
          <h1>حال‌و‌احوال دوستات</h1>
          <p>با آدمای خودت در ارتباط بمون.</p>
        </div>
        <Bell size={26} weight="duotone" />
      </header>
      <div className="notification-settings">
        <label>
          <span>
            اعلان‌های دوستام<small>روشن یا خاموش برای داخل جیشو و روی گوشی</small>
          </span>
          <input
            type="checkbox"
            checked={data.me.notificationsEnabled !== false}
            disabled={busy}
            onChange={(e) =>
              run(async () => {
                await api("notification-pref", {
                  scope: "all",
                  enabled: e.target.checked,
                });
                await refresh();
              })
            }
          />
        </label>
        <div className="device-push-card">
          <Mascot size={86} />
          <div>
            <h2>جیشو بسته‌ست؟ رفاقت بازه!</h2>
            <p>حتی وقتی توی جیشو نیستی، اعلان جیش‌کردن دوستات می‌رسه.</p>
          </div>
          <span className={`push-device-state ${push ? "active" : ""}`}>
            {push
              ? "اشتراک این دستگاه فعاله"
              : environment === "install"
                ? "یه قدم تا اعلان روی آیفون"
                : "اعلان این دستگاه خاموشه"}
          </span>
          <Button
            disabled={busy || !data.vapidPublicKey}
            onClick={() => setExplain(true)}
          >
            {push ? "راهنما و تنظیم اعلان" : "اعلان دوستام رو روشن کن"}
            <Bell size={18} />
          </Button>
          <button
            className="button button-secondary"
            disabled={busy || !data.vapidPublicKey}
            onClick={() => run(sendTest)}
          >
            اعلان تستی روی همهٔ دستگاه‌ها
          </button>
          <small>
            برای همهٔ دستگاه‌هایی که با این حساب اعلان رو روشن کردن؛ لازم نیست
            جیشو باز باشه.
          </small>
          {push && (
            <button
              className="text-link"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await disablePush();
                  setPush(false);
                  setDelivery("");
                  notify("اعلان این دستگاه خاموش شد.");
                })
              }
            >
              خاموش‌کردن روی این دستگاه
            </button>
          )}
          {delivery && (
            <p className="push-delivery-result" role="status">
              {delivery}
            </p>
          )}
          {!data.me.notificationsEnabled && (
            <p className="form-error">
              حال‌و‌احوال دوستات خاموشه؛ گزینهٔ بالایی رو هم روشن کن.
            </p>
          )}
        </div>
      </div>
      <p className="soft-note">
        فقط دوست‌های متصلت، با اجازهٔ خودت. هر دوست یا جمع رو هم می‌تونی جدا
        بی‌صدا کنی. برای نمایش روی صفحهٔ قفل، اعلان‌های جیشو رو در تنظیمات گوشی
        مجاز کن.
      </p>
      {explain && <PushPermission data={data} notify={notify} onClose={() => setExplain(false)} onEnabled={() => setPush(true)} />}
      {!!data.notifications?.length && (
        <button
          className="text-link"
          onClick={() =>
            run(async () => {
              await api("notifications-read", {});
              await refresh();
            })
          }
        >
          <Check size={16} /> همه رو خوندم
        </button>
      )}
      <div className="notification-list">
        {(data.notifications || []).map((item) => (
          <button
            className={`notification-item ${item.readAt ? "read" : "unread"}`}
            key={item.id}
            onClick={() => {
              api("notifications-read", {})
                .then(refresh)
                .catch(() => {});
              onNavigate(item.route);
            }}
          >
            <span>
              <Bell size={21} weight="duotone" />
            </span>
            <div>
              <h2>{item.title}</h2>
              <p>{item.body}</p>
              <small>{relativeTime(item.createdAt)}</small>
            </div>
          </button>
        ))}
      </div>
      {!data.notifications?.length && (
        <div className="empty-state compact-empty">
          <Mascot size={120} />
          <h2>اینجا فعلاً آرومه</h2>
          <p>شروع رفاقت‌ها و جیش‌های دوستات رو اینجا می‌بینی.</p>
        </div>
      )}
    </section>
  );
}
export function Admin({ data, notify, refresh }) {
  const [dashboard, setDashboard] = useState(null),
    [created, setCreated] = useState(""),
    [search, setSearch] = useState(""),
    [offset, setOffset] = useState(0),
    [inviteGift, setInviteGift] = useState("normal"),
    [password, setPassword] = useState("");
  const [busy, run] = useWork(notify);
  const load = async () =>
    setDashboard(await api("admin", undefined, { q: search, offset }));
  useEffect(() => {
    if (!data.me.isAdmin) return;
    const timer = setTimeout(() => run(load), 180);
    return () => clearTimeout(timer);
  }, [data.me.isAdmin, search, offset]);
  if (!data.me.isAdmin)
    return (
      <section className="page">
        <div className="empty-state">
          <ShieldCheck size={48} />
          <h1>ورود خصوصی مدیر</h1>
          <p>
            با حساب گوگل مدیرت وارد شو، بعد رمز خصوصی مدیریت رو بنویس.
          </p>
          <form
            className="admin-password-form"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await api("admin-login", { password });
                setPassword("");
                await refresh();
                notify("به پشت‌صحنه خوش اومدی.");
              });
            }}
          >
            <label className="field-label">
              رمز مدیر
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={12}
                maxLength={200}
                dir="ltr"
              />
            </label>
            <Button disabled={busy || !data.me.registered || !password}>
              ورود به داشبورد
            </Button>
          </form>
          {!data.me.registered && (
            <small>
              اول وارد حساب گوگل مدیر شو. این رمز فقط برای همون حساب کار می‌کنه.
            </small>
          )}
        </div>
      </section>
    );
  return (
    <section className="page admin-page">
      <header className="community-heading">
        <div>
          <h1>پشت‌صحنه‌ی جیشو</h1>
          <p>سلام مدیر؛ نگاهی به جمعمون بنداز.</p>
        </div>
        <ShieldCheck size={28} weight="duotone" />
      </header>
      {!dashboard ? (
        <p>داریم جمعمون رو می‌شماریم…</p>
      ) : (
        <>
          <div className="admin-totals">
            {[
              [dashboard.totals.members, "عضو"],
              [dashboard.totals.today, "ثبت در ۲۴ ساعت"],
              [dashboard.totals.lifetime, "پرمیوم همیشگی"],
              [dashboard.totals.suspended, "حساب غیرفعال"],
            ].map(([count, label]) => (
              <div key={label}>
                <strong>{fa(count)}</strong>
                <small>{label}</small>
              </div>
            ))}
          </div>
          <Suspense fallback={<p>داریم درخت دعوت‌ها رو آماده می‌کنیم…</p>}>
            <AdminInvitationTree />
          </Suspense>
          <div className="admin-invite-box">
            <h2>دعوت خصوصی، فقط برای یک نفر</h2>
            <p>
              دعوت‌های مدیر سهمیه‌ی سه‌نفره ندارن؛ هر لینک بعد از یک عضویت مصرف
              می‌شه.
            </p>
            <label className="admin-gift-picker">
              پرمیوم همراه این دعوت
              <select aria-label="پرمیوم همراه دعوت" value={inviteGift} onChange={(e) => setInviteGift(e.target.value)}>
                <option value="normal">دعوت معمولی · ۷ روز هدیه</option>
                <option value="30">۳۰ روز پرمیوم</option>
                <option value="90">۹۰ روز پرمیوم</option>
                <option value="365">یک سال پرمیوم</option>
                <option value="lifetime">پرمیوم همیشگی</option>
              </select>
              <small>هدیه با عضویت همون یک نفر فعال می‌شه. روزهای مدت‌دار در دورهٔ آزمایشی محفوظ می‌مونن.</small>
            </label>
            <Button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const value = await api("admin-invite", {
                    giftDays: ["normal", "lifetime"].includes(inviteGift) ? 0 : Number(inviteGift),
                    giftLifetime: inviteGift === "lifetime",
                  });
                  setCreated(value.url);
                  await load();
                })
              }
            >
              <Plus size={18} /> ساخت لینک یک‌بارمصرف
            </Button>
            {created && (
              <div className="admin-created-link">
                <input
                  aria-label="لینک خصوصی ساخته‌شده"
                  value={created}
                  readOnly
                  dir="ltr"
                />
                <button
                  onClick={() =>
                    copyText(created)
                      .then(() => notify("لینک کپی شد."))
                      .catch((e) => notify(e.message))
                  }
                >
                  <Copy size={18} />
                  کپی
                </button>
              </div>
            )}
          </div>
          <div className="admin-link-list">
            {dashboard.invites.map((invite) => (
              <div key={invite.code}>
                <code>{invite.code}</code>
                <small>{invite.premium_lifetime ? "پرمیوم همیشگی" : `${fa(invite.premium_days || 7)} روز پرمیوم`}</small>
                <span>
                  {!invite.active
                    ? "لغوشده"
                    : invite.uses >= 1
                      ? "مصرف‌شده"
                      : "آماده‌ی یک دوست"}
                </span>
                {invite.active && invite.uses === 0 && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await api("admin-invite-revoke", { code: invite.code });
                        await load();
                      })
                    }
                  >
                    لغو دعوت
                  </button>
                )}
              </div>
            ))}
          </div>
          <h2 className="admin-section-title">آدمای جمع</h2>
          <input
            className="admin-search"
            aria-label="جستجوی اعضا"
            placeholder="اسم یا شناسه‌ی دوستت"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOffset(0);
            }}
          />
          <div className="admin-user-list">
            {dashboard.users
              .filter((u) =>
                `${u.name} ${u.handle}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((user) => (
                <article key={user.id}>
                  <div>
                    <h3>{user.name}</h3>
                    <span dir="ltr">@{user.handle || "بدون شناسه"}</span>
                    {user.role === "admin" && <small>مدیر</small>}
                  </div>
                  <label>
                    <span>
                      <CrownSimple size={16} /> پرمیوم همیشگی
                    </span>
                    <input
                      type="checkbox"
                      checked={user.lifetime}
                      disabled={busy}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        run(async () => {
                          await api("admin-user", {
                            id: user.id,
                            operation: "lifetime",
                            enabled,
                          });
                          await load();
                          await refresh();
                        });
                      }}
                    />
                  </label>
                  {user.role !== "admin" && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          await api("admin-user", {
                            id: user.id,
                            operation: "suspend",
                            enabled: !user.banned,
                          });
                          await load();
                        })
                      }
                    >
                      {user.banned ? "فعال‌کردن حساب" : "غیرفعال‌کردن حساب"}
                    </button>
                  )}
                </article>
              ))}
          </div>
          <div className="admin-pagination">
            {offset > 0 && (
              <button
                disabled={busy}
                onClick={() => setOffset(Math.max(0, offset - 50))}
              >
                آدمای قبلی
              </button>
            )}
            {dashboard.hasMore && (
              <button disabled={busy} onClick={() => setOffset(offset + 50)}>
                آدمای بیشتر
              </button>
            )}
          </div>
          <button
            className="button button-secondary admin-recovery"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const value = await api("admin-recovery", {});
                setCreated(value.url);
                notify("لینک ورود خصوصی ساخته شد؛ فقط یک بار کار می‌کنه.");
              })
            }
          >
            ساخت لینک ورود خصوصی برای خودم
          </button>
          <p className="soft-note">
            لینک ورود مدیر خصوصی و یک‌بارمصرفه؛ برای ورود دوباره از یک دستگاه
            دیگه نگهش دار. بعد از ۳۰ روز منقضی می‌شه.
          </p>
          <Suspense fallback={null}>
            <AdminSupport notify={notify} />
          </Suspense>
          <details className="admin-audit">
            <summary>کارهای اخیر مدیریت</summary>
            {dashboard.audit.map((item, i) => (
              <p key={i}>
                {item.action} · {relativeTime(item.created_at)}
              </p>
            ))}
          </details>
        </>
      )}
    </section>
  );
}
export function PublicProfile({
  profile,
  data,
  onConnect,
  onJoin,
  onBack,
  busy,
}) {
  if (!profile)
    return (
      <section className="page">
        <p>داریم دوستت رو پیدا می‌کنیم…</p>
      </section>
    );
  return (
    <section className="page public-profile-page">
      <button className="text-link" onClick={onBack}>
        <ArrowRight size={19} /> برو به جیشو
      </button>
      <Avatar person={profile} size={140} />
      <h1>{profile.name}</h1>
      <span className="public-handle" dir="ltr">
        @{profile.handle}
      </span>
      <p>یه لحظه از روزت، برای دوستات.</p>
      <div className="public-achievements">
        {profile.achievements.map((a) => (
          <span key={a.slug}>
            <Medal size={17} weight="duotone" />
            {a.title} · سطح {fa(a.level)}
          </span>
        ))}
      </div>
      {data.me.registered ? (
        <Button
          disabled={busy || profile.id === data.me.id}
          onClick={onConnect}
        >
          <UsersThree size={18} /> به هم وصل شیم
        </Button>
      ) : (
        <>
          <Button disabled={!profile.inviteCode} onClick={onJoin}>
            با دعوت {profile.name} بیام تو جمع
          </Button>
          {!profile.inviteCode && (
            <small>دعوت‌های دوستت پر شده؛ می‌تونی مهمان باشی.</small>
          )}
        </>
      )}
      <PairArt size={260} />
    </section>
  );
}
