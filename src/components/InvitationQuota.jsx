import React, { useLayoutEffect, useRef } from "react";
import { Check, Heart, ShareNetwork } from "@phosphor-icons/react";
import { Mascot, PairArt } from "./Mascot";
import { fa } from "../api";
import "./InvitationTicket.css";

function InvitationTicket({ used }) {
  const ticket = useRef(null);
  const previousUsed = useRef(used);

  useLayoutEffect(() => {
    const from = previousUsed.current;
    previousUsed.current = used;
    if (from >= used || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const faces = ticket.current.querySelectorAll(".invite-ticket-face");
    for (let slot = from; slot < used; slot++) {
      faces[slot]?.animate([
        { opacity: 1, transform: "translateY(0) rotate(0)" },
        { opacity: 1, transform: "translateY(-5px) rotate(-4deg)", offset: 0.32 },
        { opacity: 0, transform: "translate(-12px, 22px) rotate(12deg)" },
      ], { duration: 540, easing: "ease-in-out", delay: (slot - from) * 90 });
    }
  }, [used]);

  return (
    <div className="invite-ticket" ref={ticket} aria-hidden="true">
      {[<Mascot size={65} />, <PairArt size={80} />, <Mascot size={65} mood="happy" />].map((art, slot) => (
        <div className="invite-ticket-stub" key={slot} data-used={slot < used}>
          <Check size={24} weight="bold" className="invite-ticket-check" />
          <div className="invite-ticket-face">
            {art}
            <Heart size={13} weight="fill" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function InvitationQuota({ data, onShare }) {
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
      {quota.limit === 3 && <InvitationTicket used={quota.used} />}
      {quota.limit !== null && quota.limit !== 3 && (
        <div className="invite-slot-characters">
          {Array.from({ length: quota.limit }, (_, i) => (
            <span key={i} className={i < quota.used ? "used" : "available"}>
              <Mascot size={63} mood={i < quota.used ? "happy" : "shy"} />
              <small>{i < quota.used ? "اومده تو جمع" : "منتظر رفیق"}</small>
            </span>
          ))}
        </div>
      )}
      <p aria-live={quota.limit === 3 ? "polite" : undefined}>
        {quota.limit === null
          ? `${fa(quota.used)} دوست با دعوتت اومدن`
          : `${fa(quota.used)} دعوت استفاده شده · ${fa(quota.remaining)} دعوت باقی مونده`}
      </p>
      {onShare && quota.limit !== 3 && (
        <button onClick={onShare} disabled={quota.remaining === 0}>
          <ShareNetwork size={17} />
          {quota.remaining === 0 ? "دعوت‌هات کامل شد!" : "دعوت بعدی رو بفرستم"}
        </button>
      )}
    </div>
  );
}
