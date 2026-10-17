import React from "react";
import { CaretLeft, Heart, UsersThree } from "@phosphor-icons/react";
import { PairArt } from "./Mascot";
import { Avatar } from "./Character";
import { fa, relativeTime } from "../api";
import "./SharedMemories.css";

export default function SharedMemories({ moments, onOpen, onFindFriends }) {
  return (
    <section className="shared-memories" aria-labelledby="shared-memories-title">
      <header className="memories-heading">
        <div>
          <h2 id="shared-memories-title">خاطره‌های مشترک</h2>
          <p>لحظه‌های کوچیکی که با دوستات ساختی</p>
        </div>
        <span className="memories-count">
          <Heart size={17} weight="duotone" />
          {moments.length ? `${fa(moments.length)} خاطره` : "دونفره"}
        </span>
      </header>
      {moments.length ? (
        <div className="memory-cards">
          {moments.slice(0, 5).map((moment) => (
            <button
              key={moment.id}
              className={`memory-card ${moment.kind === "together" ? "memory-together" : "memory-sequence"}`}
              onClick={() => onOpen(moment)}
              aria-label={`دیدن خاطره با ${moment.friend.name}، ${moment.kind === "together" ? "با هم" : "پشت سر هم"}`}
            >
              <span className="memory-illustration" aria-hidden="true">
                <PairArt kind={moment.kind} size={100} />
              </span>
              <span className="memory-details">
                <span className="memory-kind">
                  {moment.kind === "together" ? "با هم، تو یه لحظه" : "یکی بعد از اون یکی"}
                </span>
                <strong>با {moment.friend.name}</strong>
                <span className="memory-person">
                  <Avatar person={moment.friend} size={23} />
                  <span>{relativeTime(moment.createdAt)}</span>
                </span>
              </span>
              <span className="memory-open" aria-hidden="true"><CaretLeft size={17} /></span>
            </button>
          ))}
        </div>
      ) : (
        <div className="memories-empty">
          <PairArt size={175} />
          <h3>جای اولین خاطره‌تون اینجاست</h3>
          <p>اگه نزدیک به هم جیش کنین، اینجا یه خاطرهٔ دونفره براتون می‌مونه.</p>
          <button onClick={onFindFriends}>
            <UsersThree size={19} />
            دوستات رو پیدا کن
            <CaretLeft size={16} />
          </button>
        </div>
      )}
    </section>
  );
}
