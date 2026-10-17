import "./Friends.css";
import React, { useState } from "react";
import {
  UserPlus,
  UsersThree,
  ArrowRight,
  Plus,
  Check,
  X,
  MagnifyingGlass,
  CaretLeft,
  BellSlash,
  Bell,
  ShareNetwork,
  LinkSimple,
  SignOut,
  Trash,
} from "@phosphor-icons/react";
import { Avatar } from "./Character";
import { PairArt } from "./Mascot";
import { fa, relativeTime } from "../api";
export default function Friends({
  data,
  group,
  onBack,
  onAdd,
  onCreate,
  onFriend,
  onRespond,
  onGroup,
  onInvite,
  onGroupRespond,
  onGroupLeave,
  onGroupDelete,
  onMute,
  busy,
  onAuth,
  onConnect,
  missingGroup,
}) {
  const [tab, setTab] = useState("friends"),
    [search, setSearch] = useState("");
  const accepted = data.friends.filter((f) => f.status === "accepted"),
    incoming = data.friends.filter((f) => f.status === "pending" && f.incoming),
    outgoing = data.friends.filter(
      (f) => f.status === "pending" && !f.incoming,
    ),
    pendingGroups = data.circles.filter((c) => c.pending);
  const matches = (p) =>
    !search.trim() ||
    `${p.name} ${p.handle || ""}`
      .toLocaleLowerCase()
      .includes(search.replace(/^@/, "").toLocaleLowerCase());
  const muted = (scope) =>
    data.notificationPreferences?.some(
      (p) => p.scope === "circle" && p.id === scope && !p.enabled,
    );
  if (missingGroup)
    return (
      <section className="page friends-hub">
        <button className="text-link" onClick={onBack}>
          <ArrowRight size={20} />
          برگشت به دوست‌ها
        </button>
        <div className="empty-state">
          <UsersThree size={45} />
          <h1>این گروه در دسترس نیست</h1>
          <p>شاید دعوت تغییر کرده یا عضو این گروه نیستی.</p>
        </div>
      </section>
    );
  if (group) {
    const people = [
      ...(group.shared
        ? [
            {
              id: group.ownerId,
              name: group.ownerName,
              handle: group.ownerHandle,
              avatarSeed: group.ownerAvatarSeed,
              avatarImage: group.ownerAvatarImage,
            },
          ]
        : []),
      ...group.people,
    ];
    return (
      <section className="page friends-hub group-detail">
        <header className="community-heading">
          <button aria-label="برگشت به دوست‌ها" onClick={onBack}>
            <ArrowRight size={22} />
          </button>
          <div>
            <h1>{group.name}</h1>
            <p>{group.shared ? "گروه مشترک دوست‌ها" : "فهرست خصوصی خودت"}</p>
          </div>
          <UsersThree size={28} />
        </header>
        {group.pending ? (
          <div className="group-join-card">
            <PairArt size={200} />
            <h2>{group.ownerName} دعوتت کرده</h2>
            <p>
              با عضویت، اسم و پروفایلت برای اعضا دیده می‌شه. خبرها و لینک‌های
              اجتماعی فقط با دوستی و اجازهٔ جداگانه نمایش داده می‌شن.
            </p>
            <button
              className="button button-lilac"
              disabled={busy}
              onClick={() => onGroupRespond(group, true)}
            >
              به گروه بپیوندم
            </button>
            <button
              className="text-link"
              disabled={busy}
              onClick={() => onGroupRespond(group, false)}
            >
              فعلاً نه
            </button>
          </div>
        ) : (
          <>
            <div className="group-summary">
              <span className="group-symbol purple">
                <UsersThree size={32} />
              </span>
              <div>
                <strong>{fa(group.members.length)} نفر در جمع</strong>
                <p>سازنده: {group.ownerName}</p>
              </div>
              {group.canManage && group.shared && (
                <button
                  aria-label="دعوت به گروه"
                  onClick={() => onInvite(group)}
                >
                  <UserPlus size={22} />
                </button>
              )}
            </div>
            <button
              className={`preference-action ${muted(group.id) ? "muted" : ""}`}
              disabled={busy}
              onClick={() =>
                onMute("circle", group.id, Boolean(muted(group.id)))
              }
            >
              {muted(group.id) ? <BellSlash size={24} /> : <Bell size={24} />}
              <span>
                <strong>
                  {muted(group.id)
                    ? "این گروه بی‌صداست"
                    : "خبرهای این گروه روشنه"}
                </strong>
                <small>
                  {muted(group.id)
                    ? "برای روشن‌کردن بزن"
                    : "برای بی‌صداکردن بزن"}
                </small>
              </span>
            </button>
            <div className="friends-card-list">
              {people.map((person) => {
                const friend = accepted.find((f) => f.id === person.id);
                return (
                  <div className="hub-person" key={person.id}>
                    <Avatar person={friend || person} size={52} />
                    <div>
                      <h2>{person.id === data.me.id ? "خودت" : person.name}</h2>
                      <span dir="ltr">@{person.handle}</span>
                      <p>
                        {friend?.latestStatus
                          ? `${friend.latestStatus === "need" ? "جیش داره" : "جیش کرده"} · ${relativeTime(friend.latestAt)}`
                          : person.id === data.me.id
                            ? "عضو این جمع"
                            : friend
                              ? "به هم وصلید"
                              : "عضویت گروه، دوستی خودکار نیست"}
                      </p>
                    </div>
                    {person.id !== data.me.id &&
                      (friend ? (
                        <button
                          aria-label={`تنظیمات ${person.name}`}
                          onClick={() => onFriend(friend)}
                        >
                          <CaretLeft size={22} />
                        </button>
                      ) : (
                        <button
                          className="compact-connect"
                          disabled={busy}
                          onClick={() => onConnect(person.handle)}
                        >
                          درخواست دوستی
                        </button>
                      ))}
                  </div>
                );
              })}
            </div>
            {group.invited?.length > 0 && (
              <div className="group-awaiting">
                <h2>منتظر جوابشونیم</h2>
                {group.invited.map((person) => (
                  <div key={person.id}>
                    <Avatar person={person} size={35} />
                    <span>{person.name}</span>
                    <small>دعوت فرستاده شده</small>
                  </div>
                ))}
              </div>
            )}
            <p className="soft-note">
              شماره و لینک‌های خصوصی با عضویت گروه به اشتراک گذاشته نمی‌شن.
            </p>
            {group.canManage && group.shared && (
              <button
                className="button button-lilac"
                onClick={() => onInvite(group)}
              >
                <ShareNetwork size={20} />
                دعوت با شناسه یا لینک گروه
              </button>
            )}
            {group.canManage ? (
              <button
                className="danger-text"
                onClick={() => onGroupDelete(group)}
              >
                <Trash size={17} />
                حذف گروه
              </button>
            ) : (
              <button
                className="danger-text"
                onClick={() => onGroupLeave(group)}
              >
                <SignOut size={17} />
                خروج از گروه
              </button>
            )}
          </>
        )}
      </section>
    );
  }
  return (
    <section className="page friends-hub">
      <header className="community-heading">
        <div>
          <h1>رفقای من</h1>
          <p>خبرهای کوچولو، آدم‌های آشنا.</p>
        </div>
        {data.me.registered && (
          <button
            className="add-friend-header"
            aria-label="افزودن دوست با شناسه"
            onClick={onAdd}
          >
            <UserPlus size={20} />
            <span>دوست تازه</span>
          </button>
        )}
      </header>
      {!data.me.registered ? (
        <div className="account-empty">
          <PairArt size={240} />
          <h2>جای دوستات اینجا خالیه</h2>
          <p>برای دوستی و گروه‌ها، با دعوت عضو شو.</p>
          <button className="button button-lilac" onClick={onAuth}>
            ورود یا عضویت
          </button>
        </div>
      ) : (
        <>
          <div className="friends-overview">
            <div>
              <Avatar person={data.me} size={47} />
              <strong>{fa(accepted.length)} دوست</strong>
            </div>
            <span>
              {fa(data.circles.filter((g) => !g.pending).length)} گروه
            </span>
          </div>
          {incoming.length + pendingGroups.length > 0 && (
            <button
              className="request-summary"
              onClick={() => setTab("requests")}
            >
              <UserPlus size={22} />
              <span>
                {fa(incoming.length + pendingGroups.length)} دعوت و درخواست تازه
                داری
              </span>
              <CaretLeft size={18} />
            </button>
          )}
          {accepted.filter((friend) => friend.linkConnection === "incoming").map((friend) => (
            <button key={friend.id} className="link-request-notice" onClick={() => onFriend(friend)}>
              <LinkSimple size={24} />
              <span>{friend.name} درخواست دیدن حساب‌ها رو فرستاده<small>دیدن درخواست و انتخاب تو</small></span>
              <CaretLeft size={18} />
            </button>
          ))}
          <div className="friends-tabs" role="group" aria-label="بخش‌های دوستی">
            {[
              ["friends", "دوست‌ها"],
              ["groups", "گروه‌ها"],
              [
                "requests",
                `درخواست‌ها${incoming.length + pendingGroups.length ? " " + fa(incoming.length + pendingGroups.length) : ""}`,
              ],
            ].map(([id, label]) => (
              <button
                key={id}
                aria-pressed={tab === id}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === "friends" && (
            <>
              <label className="friend-search">
                <MagnifyingGlass size={19} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="اسم یا شناسهٔ دوستت"
                  aria-label="جستجو در دوست‌ها"
                />
              </label>
              <div className="friends-card-list">
                {accepted.filter(matches).map((friend) => (
                  <button
                    className="hub-person connected-card"
                    key={friend.id}
                    onClick={() => onFriend(friend)}
                  >
                    <Avatar person={friend} size={57} />
                    <div>
                      <h2>{friend.name}</h2>
                      <span dir="ltr">@{friend.handle}</span>
                      <p>
                        {friend.latestStatus
                          ? `${friend.latestStatus === "need" ? "جیش داره" : "جیش کرده"} · ${relativeTime(friend.latestAt)}`
                          : "هنوز خبر تازه‌ای نداده"}
                      </p>
                    </div>
                    <CaretLeft size={20} />
                  </button>
                ))}
              </div>
              {!accepted.filter(matches).length && (
                <div className="empty-state compact-empty">
                  <PairArt size={180} />
                  <h2>{search ? "پیداش نکردیم" : "اولین رفیقت رو پیدا کن"}</h2>
                  <p>فقط شناسه‌ش رو بنویس؛ کد دعوت برای دوست‌شدن لازم نیست.</p>
                  <button className="button button-lilac" onClick={onAdd}>
                    افزودن با شناسه
                    <UserPlus size={19} />
                  </button>
                </div>
              )}
            </>
          )}
          {tab === "groups" && (
            <>
              <div className="section-heading">
                <h2>جمع‌های خودمونی</h2>
                <button className="text-link" onClick={onCreate}>
                  <Plus size={17} />
                  گروه تازه
                </button>
              </div>
              <div className="groups-list">
                {data.circles
                  .filter((c) => !c.pending)
                  .map((c) => (
                    <button
                      className="group-card"
                      key={c.id}
                      onClick={() => onGroup(c.id)}
                    >
                      <span className="group-symbol purple">
                        <UsersThree size={30} />
                      </span>
                      <div>
                        <h2>{c.name}</h2>
                        <p>
                          {fa(c.members.length)} نفر ·{" "}
                          {c.shared ? "گروه مشترک" : "فهرست خصوصی"}
                        </p>
                      </div>
                      <CaretLeft size={20} />
                    </button>
                  ))}
              </div>
              {!data.circles.filter((c) => !c.pending).length && (
                <div className="empty-state compact-empty">
                  <UsersThree size={45} />
                  <h2>یه جمع کوچولو بساز</h2>
                  <p>
                    دوست‌های دانشگاه، خانواده یا رفقای همیشگی؛ هر کدوم یه گروه.
                  </p>
                  <button className="button button-lilac" onClick={onCreate}>
                    ساخت گروه
                  </button>
                </div>
              )}
            </>
          )}
          {tab === "requests" && (
            <div className="friend-requests-panel">
              {incoming.map((friend) => (
                <div className="hub-person request-card" key={friend.id}>
                  <Avatar person={friend} size={48} />
                  <div>
                    <h2>{friend.name}</h2>
                    <span dir="ltr">@{friend.handle}</span>
                  </div>
                  <button
                    className="accept-request"
                    aria-label={`قبول درخواست ${friend.name}`}
                    disabled={busy}
                    onClick={() => onRespond(friend, true)}
                  >
                    <Check size={21} />
                  </button>
                  <button
                    aria-label={`رد درخواست ${friend.name}`}
                    disabled={busy}
                    onClick={() => onRespond(friend, false)}
                  >
                    <X size={21} />
                  </button>
                </div>
              ))}
              {pendingGroups.map((c) => (
                <button
                  className="group-request-card"
                  key={c.id}
                  onClick={() => onGroup(c.id)}
                >
                  <UsersThree size={25} />
                  <div>
                    <h2>دعوت به {c.name}</h2>
                    <p>از طرف {c.ownerName}</p>
                  </div>
                  <CaretLeft size={20} />
                </button>
              ))}
              {!!outgoing.length && (
                <h2 className="pending-heading">درخواست‌های تو</h2>
              )}
              {outgoing.map((friend) => (
                <div className="hub-person" key={friend.id}>
                  <Avatar person={friend} size={44} />
                  <div>
                    <h2>{friend.name}</h2>
                    <p>منتظر جواب دوستت</p>
                  </div>
                  <button
                    className="text-link"
                    disabled={busy}
                    onClick={() => onRespond(friend, false)}
                  >
                    لغو
                  </button>
                </div>
              ))}
              {!incoming.length &&
                !outgoing.length &&
                !pendingGroups.length && (
                  <div className="empty-state">
                    <HeartIllustration />
                    <h2>درخواست تازه‌ای نیست</h2>
                    <p>وقتی کسی دعوتت کنه، همین‌جا می‌بینیش.</p>
                  </div>
                )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
function HeartIllustration() {
  return <PairArt size={180} />;
}
