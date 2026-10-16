import React, { useEffect, useState } from "react";
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
import { Mascot, PairArt } from "./Mascot";
import { api, copyText, fa, relativeTime } from "../api";
import { enablePush, disablePush, pushSupported } from "../push";

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
export function InvitationQuota({ data, onShare }) {
  const quota = data.invitationQuota;
  if (!quota) return null;
  return (
    <div className="invitation-quota-card">
      <div className="quota-top">
        <Heart size={24} weight="duotone" />
        <strong>
          {quota.limit === null
            ? "دعوت برای جمعِ بزرگ‌تر"
            : quota.limit === 3
              ? "سه دعوت، سه رفیق تازه"
              : "یه دعوت، یه رفیق تازه"}
        </strong>
      </div>
      {quota.limit !== null && (
        <div className="invite-slot-characters">
          {Array.from({ length: quota.limit }, (_, i) => (
            <span key={i} className={i < quota.used ? "used" : "available"}>
              <Mascot size={63} mood={i < quota.used ? "happy" : "shy"} />
              <small>{i < quota.used ? "اومده تو جمع" : "منتظر رفیق"}</small>
            </span>
          ))}
        </div>
      )}
      <p>
        {quota.limit === null
          ? `${fa(quota.used)} دوست با دعوتت اومدن`
          : `${fa(quota.used)} دعوت استفاده شده · ${fa(quota.remaining)} دعوت باقی مونده`}
      </p>
      {onShare && (
        <button onClick={onShare} disabled={quota.remaining === 0}>
          <ShareNetwork size={17} />
          {quota.remaining === 0 ? "هر سه رفیقت رسیدن!" : "دعوت بعدی رو بفرستم"}
        </button>
      )}
    </div>
  );
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
        <Medal size={28} weight="duotone" />
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
        تکرارِ پشت‌سرهمِ خبرها امتیاز اضافه نمی‌ده؛ «جیش دارم» هم راه میان‌بُرِ
        لقب‌ها نیست.
      </p>
      <Button onClick={onShare}>
        <ShareNetwork size={19} /> این هفته‌مو استوری کنم
      </Button>
    </section>
  );
}
export function Discover({ data, refresh, notify, onMap, onAuth }) {
  const [people, setPeople] = useState([]),
    [point, setPoint] = useState(null),
    [searched, setSearched] = useState(false),
    [error, setError] = useState("");
  const [busy, run] = useWork(notify);
  function locate() {
    setError("");
    if (!navigator.geolocation) {
      setError("مکان‌یابی روی این مرورگر در دسترس نیست.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const p = { lat: coords.latitude, lng: coords.longitude };
        setPoint(p);
        find(p);
      },
      () => setError("برای پیدا کردن هم‌جیش‌های اطراف، اجازه‌ی مکان لازمه."),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }
  const find = (p) =>
    run(async () => {
      const value = await api("discover", p);
      setPeople(value.people);
      setSearched(true);
    });
  return (
    <section className="page discover-page">
      <header className="community-heading">
        <div>
          <h1>کی همراهمه؟</h1>
          <p>یه هم‌جیش از همین نزدیکی پیدا کن.</p>
        </div>
        <UsersThree size={30} weight="duotone" />
      </header>
      <div className="discover-hero">
        <PairArt size={250} />
        <span className="tiny-badge">
          <MapPin size={13} /> نزدیک، با اجازه‌ی خودتون
        </span>
      </div>
      {!data.me.registered ? (
        <div className="soft-signup-card">
          <h2>رفیقِ راه می‌خوای؟</h2>
          <p>
            برای وصل‌شدن، با دعوت عضو شو. مهمان هم می‌تونه جیش کنه و استوری
            بذاره.
          </p>
          <Button onClick={onAuth}>عضویت با دعوت</Button>
        </div>
      ) : (
        <>
          <div className="discover-consent">
            <label>
              <span>
                من هم توی لیست هم‌جیش‌ها باشم
                <small>با اسم و موقعیت تقریبی، برای آدمای این نزدیکی</small>
              </span>
              <input
                type="checkbox"
                checked={Boolean(data.me.discoverable && data.me.shareLocation)}
                disabled={busy}
                onChange={(event) => {
                  const enabled = event.target.checked;
                  run(async () => {
                    if (enabled) {
                      if (!point) {
                        notify("اول اطرافت رو پیدا کن تا مکانت مشخص بشه.");
                        locate();
                        return;
                      }
                      await api("location", { ...point, enabled: true });
                    }
                    await api("discoverable", { enabled });
                    await refresh();
                  });
                }}
              />
            </label>
          </div>
          <Button
            disabled={busy}
            onClick={() => (point ? find(point) : locate())}
          >
            <MapPin size={19} />
            {busy
              ? "داریم دور و برت رو می‌بینیم…"
              : point
                ? "هم‌جیش‌های اطراف رو تازه کن"
                : "پیدا کردن هم‌جیش‌های اطراف"}
          </Button>
          {error && <p className="form-error">{error}</p>}
          <div className="discover-list">
            {people.map((person) => (
              <article className="discover-person" key={person.id}>
                <Avatar person={person} size={59} />
                <div>
                  <h2>{person.name}</h2>
                  <span dir="ltr">@{person.handle || "jishoo"}</span>
                  <p>
                    {person.activity === "need"
                      ? "جیش داره؛ شاید همراهمون بشه!"
                      : person.activity === "done"
                        ? "تازه یه آخیش گفته"
                        : "یه رفیق این نزدیکی"}
                  </p>
                  <small>{person.distance}</small>
                </div>
                <button
                  disabled={busy || person.connection !== null}
                  onClick={() =>
                    run(async () => {
                      await api("connection-request", {
                        handle: person.handle,
                      });
                      await refresh();
                      await find(point);
                      notify("درخواستت رفت پیشش!");
                    })
                  }
                >
                  {person.connection === "accepted" ? (
                    "وصلید"
                  ) : person.connection === "pending" ? (
                    person.incoming ? (
                      "منتظر جواب تو"
                    ) : (
                      "درخواست رفت"
                    )
                  ) : (
                    <>
                      <Plus size={17} />
                      وصل شیم
                    </>
                  )}
                </button>
              </article>
            ))}
          </div>
          {searched && !people.length && (
            <div className="empty-state compact-empty">
              <Mascot size={110} />
              <h2>هنوز هم‌جیشی این نزدیکی نیست</h2>
              <p>دعوتت کنجکاوشون می‌کنه؛ یه رفیق رو بیار تو جمع.</p>
            </div>
          )}
          <button className="text-link map-link" onClick={onMap}>
            <MapPin size={17} /> خبرها رو روی نقشه ببینم
          </button>
        </>
      )}
    </section>
  );
}
export function Notifications({ data, refresh, notify, onBack, onNavigate }) {
  const [push, setPush] = useState(false);
  const [busy, run] = useWork(notify);
  useEffect(() => {
    if (pushSupported())
      navigator.serviceWorker
        .getRegistration("/")
        .then((r) => r?.pushManager.getSubscription())
        .then((s) => setPush(Boolean(s)));
  }, []);
  return (
    <section className="page notification-page">
      <header className="community-heading">
        <button onClick={onBack} aria-label="برگشت">
          <ArrowRight size={22} />
        </button>
        <div>
          <h1>خبرهای کوچولو</h1>
          <p>از آدمای خودت باخبر بمون.</p>
        </div>
        <Bell size={26} weight="duotone" />
      </header>
      <div className="notification-settings">
        <label>
          <span>
            خبرهای دوستام<small>اعلان‌های داخل جیشو</small>
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
        <label>
          <span>
            اعلان روی گوشی و کامپیوتر
            <small>
              {push
                ? "فعاله؛ حتی وقتی جیشو باز نیست"
                : pushSupported()
                  ? "با اجازه‌ی مرورگر فعال می‌شه"
                  : "اعلان سیستم روی این مرورگر در دسترس نیست"}
            </small>
          </span>
          <input
            type="checkbox"
            checked={push}
            disabled={busy || !pushSupported() || !data.vapidPublicKey}
            onChange={(e) => {
              const enabled = e.target.checked;
              run(async () => {
                if (enabled) await enablePush(data.vapidPublicKey);
                else await disablePush();
                setPush(enabled);
                notify(
                  enabled ? "اعلان‌های جیشو روشن شد." : "اعلان سیستم خاموش شد.",
                );
              });
            }}
          />
        </label>
      </div>
      <p className="soft-note">
        نمایش روی صفحه یا روی برنامه‌های دیگه رو تنظیمات گوشی و مرورگر تعیین
        می‌کنه. برای هر دوست و هر جمع هم می‌تونی اعلان‌ها رو جدا خاموش کنی.
      </p>
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
          <h2>هنوز خبری نیست</h2>
          <p>وقتی رفیقت اومد یا خبری داد، اینجا می‌بینیش.</p>
        </div>
      )}
    </section>
  );
}
export function Admin({ data, notify, refresh }) {
  const [dashboard, setDashboard] = useState(null),
    [created, setCreated] = useState(""),
    [search, setSearch] = useState(""),
    [offset, setOffset] = useState(0);
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
          <p>این بخش با لینک خصوصیِ یک‌بارمصرف مدیر باز می‌شه.</p>
        </div>
      </section>
    );
  return (
    <section className="page admin-page">
      <header className="community-heading">
        <div>
          <h1>پشت‌صحنه‌ی جیشو</h1>
          <p>سلام مدیر؛ جمعمون چه خبره؟</p>
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
              [dashboard.totals.today, "خبر در ۲۴ ساعت"],
              [dashboard.totals.lifetime, "پرمیوم همیشگی"],
              [dashboard.totals.suspended, "حساب غیرفعال"],
            ].map(([count, label]) => (
              <div key={label}>
                <strong>{fa(count)}</strong>
                <small>{label}</small>
              </div>
            ))}
          </div>
          <div className="admin-invite-box">
            <h2>دعوت خصوصی، فقط برای یک نفر</h2>
            <p>
              دعوت‌های مدیر سهمیه‌ی سه‌نفره ندارن؛ هر لینک بعد از یک عضویت مصرف
              می‌شه.
            </p>
            <Button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const value = await api("admin-invite", {});
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
      <p>یه خبر کوچولو، یه بهونه برای با هم بودن.</p>
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
