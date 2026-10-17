import "./Friends.css";
import React, { useEffect, useState } from "react";
import { UsersThree, ArrowRight } from "@phosphor-icons/react";
import { Avatar } from "./Character";
import { PairArt } from "./Mascot";
import { api, fa } from "../api";
export default function GroupJoin({
  code,
  data,
  onAuth,
  onJoined,
  onBack,
  notify,
}) {
  const [group, setGroup] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    api("circle-info", undefined, { code })
      .then((r) => active && setGroup(r.group))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [code]);
  return (
    <section className="page group-link-landing">
      <button className="icon-button" aria-label="برگشت" onClick={onBack}>
        <ArrowRight size={22} />
      </button>
      {group ? (
        <>
          <Avatar person={group.owner} size={83} />
          <p>{group.owner.name} دعوتت کرده به</p>
          <h1>{group.name}</h1>
          <PairArt size={240} />
          <span className="little-pill">
            <UsersThree size={17} />
            {fa(group.members)} نفر در این جمع
          </span>
          <p>
            یه گروه برای دوست‌های خودمونی. با عضویت، پروفایلت برای اعضا دیده
            می‌شه؛ شماره، خبرهای خصوصی و لینک‌های اجتماعی خودکار به اشتراک
            گذاشته نمی‌شن.
          </p>
          <button
            className="button button-lilac"
            disabled={busy}
            onClick={async () => {
              if (!data.me.registered) {
                onAuth();
                return;
              }
              setBusy(true);
              try {
                const r = await api("circle-join", { code });
                onJoined(r);
              } catch (e) {
                notify(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {data.me.registered ? "به گروه بپیوندم" : "ورود یا عضویت با دعوت"}
          </button>
          <button className="text-link" onClick={onBack}>
            فعلاً نه
          </button>
          {!data.me.registered && (
            <small>
              عضویت حساب فعلاً به دعوت نیاز داره؛ عضویت گروه هم انتخاب جداگانهٔ
              توئه.
            </small>
          )}
        </>
      ) : (
        <>
          <UsersThree size={48} />
          <h1>
            {error ? "دعوت در دسترس نیست" : "داریم گروه رو پیدا می‌کنیم…"}
          </h1>
          <p>{error}</p>
        </>
      )}
    </section>
  );
}
