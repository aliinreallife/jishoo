import React from "react";
import { Heart, ShareNetwork } from "@phosphor-icons/react";
import { Mascot } from "./Mascot";
import { fa } from "../api";
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
