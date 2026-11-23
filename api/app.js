import { normalizePromoCode, resolvePromoCode } from "../lib/promo-codes.js";
import { activitySummary } from "../lib/activity-summary.js";
import { reminderPreferences } from "../lib/reminders.js";
import { joinWaitlist } from "../lib/waitlist.js";
import {
  authMethods,
  startGoogle,
  claimPendingGoogle,
  removeGoogle,
  phoneAuthEnabled,
} from "../lib/google-auth.js";
import { mapProfile } from "../lib/map-profile.js";
import { mapConfig } from "../lib/public-config.js";
import { confirmAccountMerge, cancelAccountMerge } from "../lib/account-merge.js";
import { periodTotals } from "../lib/calendar.js";
import { dailyStreak } from "../lib/streaks.js";
import { supportAction } from "../lib/support.js";
import { listGroups, groupAction, groupInfo } from "../lib/groups.js";
import { randomUUID } from "node:crypto";
import { waitUntil } from "@vercel/functions";
import { sanitizeAvatar } from "../lib/avatar.js";
import { rateLimit } from "../lib/security.js";
import { provisionOwner } from "../lib/provision.js";
import {
  getCommunity,
  communityAction,
  publicProfile,
} from "../lib/community.js";
import { notifyFriends, notifyUser } from "../lib/notifications.js";
import { notifyMutualMoments } from "../lib/mutual-moments.js";
import { worldMap, invalidateWorldMap } from "../lib/world-map.js";
import { query, transaction, initialize } from "../lib/database.js";
import {
  testingMode,
  inviteOnly,
  hashToken,
  randomToken,
  inviteCode,
  normalizeCode,
  normalizeName,
  normalizePhone,
  phoneHash,
  encryptPhone,
  premium,
  pairKind,
  approximateLocation,
  distanceKm,
  cleanSocialLinks,
  normalizeHandle,
} from "../lib/core.js";

class AppError extends Error {
  constructor(status, message, code = "invalid_request") {
    super(message);
    this.status = status;
    this.code = code;
  }
}
const fail = (status, message, code) => {
  throw new AppError(status, message, code);
};
const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
};
function cookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || "")
      .split(";")
      .map((x) => x.trim().split("="))
      .filter((x) => x.length === 2),
  );
}
function setSessionCookie(req, res, token) {
  const secure =
    process.env.VERCEL || req.headers["x-forwarded-proto"] === "https";
  res.setHeader(
    "Set-Cookie",
    `jishoo_session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=7776000${secure ? "; Secure" : ""}`,
  );
}
async function session(req, res) {
  let token = cookies(req).jishoo_session;
  if (token) {
    const rows = await query(
      "SELECT u.*,s.admin_access AS session_admin_access FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>NOW()",
      [hashToken(token)],
    );
    if (rows[0]) {
      let user = rows[0];
      if (user.banned)
        fail(403, "این حساب فعلاً غیرفعاله.", "account_suspended");
      if (!testingMode() && user.trial_days_bank > 0) {
        const active = await query(
          `UPDATE users SET trial_until=GREATEST(COALESCE(trial_until,NOW()),COALESCE(paid_until,NOW()),NOW())+trial_days_bank*INTERVAL '1 day',trial_days_bank=0 WHERE id=$1 AND trial_days_bank>0 RETURNING *`,
          [user.id],
        );
        user = active[0] || user;
        user.session_admin_access = rows[0].session_admin_access;
      }
      return { user, tokenHash: hashToken(token) };
    }
  }
  token = randomToken();
  if (
    !(await rateLimit(
      `new-session:${String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0]}`,
      120,
      3600,
    ))
  )
    fail(429, "یه کم بعد دوباره سر بزن.");
  const id = randomUUID();
  const result = await transaction([
    [
      `INSERT INTO users(id,avatar_seed) VALUES($1,$2) RETURNING *`,
      [id, "guest:" + id],
    ],
    [
      `INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '90 days')`,
      [hashToken(token), id],
    ],
  ]);
  setSessionCookie(req, res, token);
  return { user: result[0][0], tokenHash: hashToken(token) };
}
function requireAccount(user) {
  if (!user.registered)
    fail(
      401,
      "این بخش برای دوست‌های عضو جیشوئه. با دعوت وارد شو.",
      "account_required",
    );
}
function requirePremium(user) {
  if (!premium(user))
    fail(
      403,
      "این قابلیت برای پرمیومه؛ جیش و آمار و استوری معمولی همیشه رایگانه.",
      "premium_required",
    );
}
function profile(user, own = false) {
  const p = {
    id: user.id,
    name: user.name,
    avatarSeed: user.avatar_seed,
    avatarImage: user.avatar_image || null,
    handle: user.handle || null,
    lifetime: Boolean(user.lifetime),
    registered: user.registered,
    premium: premium(user),
  };
  if (own)
    Object.assign(p, {
      isAdmin: user.role === "admin" && user.session_admin_access === true,
      discoverable: user.discoverable,
      notificationsEnabled: user.notifications_enabled,
      inviteCode: user.invite_code,
      trialUntil: user.trial_until,
      trialDaysSaved: user.trial_days_bank,
      adminPasswordEnabled: Boolean(process.env.ADMIN_PASSWORD_HASH),
      socialLinks: user.social_links,
      shareLocation: user.share_location,
      mapVisibilityReviewed: Boolean(user.map_visibility_reviewed),
      createdAt: user.created_at,
      checkinReminders: reminderPreferences(user),
      invitedBy: user.invited_by,
      joinedInviteCode: user.joined_invite_code,
    });
  return p;
}
async function stats(userId, activity) {
  const [rows, history, latest] = await Promise.all([
    query(
      `SELECT COUNT(*) FILTER(WHERE status='done')::int AS total,COUNT(*) FILTER(WHERE status='done' AND (created_at AT TIME ZONE 'Asia/Tehran')::date=(NOW() AT TIME ZONE 'Asia/Tehran')::date)::int AS today,COUNT(*) FILTER(WHERE status='done' AND (created_at AT TIME ZONE 'Asia/Tehran')::date>=(NOW() AT TIME ZONE 'Asia/Tehran')::date-6)::int AS week,COUNT(*) FILTER(WHERE status='done' AND (created_at AT TIME ZONE 'Asia/Tehran')::date>=(NOW() AT TIME ZONE 'Asia/Tehran')::date-29)::int AS month,COUNT(*) FILTER(WHERE status='need')::int AS need,MAX(created_at) FILTER(WHERE status='done') AS "lastDoneAt"${activity ? "" : ",COALESCE(array_agg(DISTINCT TO_CHAR(created_at AT TIME ZONE 'Asia/Tehran','YYYY-MM-DD')) FILTER(WHERE status='done'),ARRAY[]::text[]) AS streak_days"} FROM checkins WHERE user_id=$1`,
      [userId],
    ),
    query(
      `SELECT 'day' AS kind,(created_at AT TIME ZONE 'Asia/Tehran')::date::text AS day,COUNT(*)::int AS count FROM checkins WHERE user_id=$1 AND status='done' AND created_at>NOW()-INTERVAL '13 months' GROUP BY 2 UNION ALL SELECT 'month' AS kind,TO_CHAR(created_at AT TIME ZONE 'Asia/Tehran','YYYY-MM') AS day,COUNT(*)::int AS count FROM checkins WHERE user_id=$1 AND status='done' AND created_at>NOW()-INTERVAL '1 year' GROUP BY 2 ORDER BY day`,
      [userId],
    ),
    query(
      "SELECT id,status,visibility,created_at FROM checkins WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1",
      [userId],
    ),
  ]);
  const { streak_days: activeDays, ...totals } = rows[0];
  return {
    ...totals,
    streak: activity ? (await activity).streak : dailyStreak(activeDays || []),
    ...periodTotals(history.filter((d) => d.kind === "day")),
    daily: history.filter((d) => d.kind === "day"),
    monthly: history.filter((d) => d.kind === "month"),
    latest: latest[0] || null,
  };
}
async function friends(user) {
  if (!user.registered) return [];
  const rows = await query(
    `SELECT c.*, u.id AS friend_id, u.name, u.handle, u.avatar_seed, u.avatar_image, u.lifetime, u.trial_until, u.paid_until, u.social_links, e.status AS latest_status,e.created_at AS latest_at FROM connections c JOIN users u ON u.id=CASE WHEN c.user_a=$1 THEN c.user_b ELSE c.user_a END LEFT JOIN LATERAL (SELECT status,created_at FROM checkins WHERE user_id=u.id AND visibility='friends' ORDER BY created_at DESC LIMIT 1) e ON TRUE WHERE c.user_a=$1 OR c.user_b=$1 ORDER BY c.created_at DESC`,
    [user.id],
  );
  return rows.map((r) => {
    const ownerSharing = user.id === r.user_a ? r.share_b : r.share_a;
    const mySharing = user.id === r.user_a ? r.share_a : r.share_b;
    return {
      connectionId: r.id,
      id: r.friend_id,
      name: r.name,
      handle: r.handle,
      avatarSeed: r.avatar_seed,
      avatarImage: r.avatar_image || null,
      status: r.status,
      incoming: r.requested_by !== user.id,
      sharing: mySharing,
      linkConnection: mySharing && ownerSharing ? "connected" : mySharing ? "outgoing" : ownerSharing ? "incoming" : "none",
      socialLinks:
        r.status === "accepted" && mySharing && ownerSharing && premium(user) && premium(r)
          ? r.social_links
          : {},
      latestStatus: r.status === "accepted" ? r.latest_status : null,
      latestAt: r.status === "accepted" ? r.latest_at : null,
    };
  });
}
async function moments(user) {
  if (!user.registered || !premium(user)) return [];
  const rows = await query(
    `SELECT m.*,u.id AS friend_id,u.name,u.avatar_seed,u.avatar_image FROM pair_moments m JOIN users u ON u.id=CASE WHEN m.user_a=$1 THEN m.user_b ELSE m.user_a END WHERE m.user_a=$1 OR m.user_b=$1 ORDER BY m.created_at DESC LIMIT 30`,
    [user.id],
  );
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    createdAt: r.created_at,
    friend: {
      id: r.friend_id,
      name: r.name,
      avatarSeed: r.avatar_seed,
      avatarImage: r.avatar_image || null,
    },
  }));
}
const circles = listGroups;
async function bootstrap(user, sessionHash) {
  const activity = activitySummary(user.id);
  const [s, f, m, c, community, authInfo] = await Promise.all([
    stats(user.id, activity),
    friends(user),
    moments(user),
    circles(user),
    getCommunity(user, activity),
    authMethods(user, sessionHash),
    // Observe shared-query failures immediately, even while an admin invite
    // rotation is still preparing the other consumer.
    activity,
  ]);
  return {
    me: profile(user, true),
    map: mapConfig(),
    auth: authInfo,
    stats: s,
    friends: f,
    moments: m,
    circles: c,
    testing: testingMode(),
    inviteOnly: inviteOnly(),
    publicUrl: process.env.PUBLIC_APP_URL || "https://jishoo.vercel.app",
    ...community,
  };
}
async function inviteInfo(code) {
  const rows = await query(
    `SELECT i.code,i.uses,i.max_uses,i.grant_admin,i.premium_days,i.premium_lifetime,u.id,u.name,u.handle,u.avatar_seed,u.avatar_image FROM invites i LEFT JOIN users u ON u.id=i.inviter_id WHERE i.code=$1 AND i.active`,
    [normalizeCode(code)],
  );
  if (!rows[0])
    fail(
      404,
      "کد دعوت پیدا نشد. از دوستت یه لینک تازه بگیر.",
      "invite_not_found",
    );
  return {
    code: rows[0].code,
    adminInvitation: Boolean(rows[0].grant_admin),
    remaining:
      rows[0].max_uses === null
        ? null
        : Math.max(0, rows[0].max_uses - rows[0].uses),
    inviter: rows[0].id
      ? {
          id: rows[0].id,
          name: rows[0].name,
          avatarSeed: rows[0].avatar_seed,
          avatarImage: rows[0].avatar_image || null,
          handle: rows[0].handle,
        }
      : null,
    bonusDays: rows[0].premium_lifetime ? 0 : rows[0].premium_days || 7,
    lifetimeGift: Boolean(rows[0].premium_lifetime),
  };
}
async function detectMoments(user, event) {
  if (
    !user.registered ||
    !premium(user) ||
    event.visibility !== "friends" ||
    event.status !== "done"
  )
    return [];
  const peers = await query(
    `SELECT u.*,e.id AS event_id,e.created_at AS event_at FROM connections c JOIN users u ON u.id=CASE WHEN c.user_a=$1 THEN c.user_b ELSE c.user_a END JOIN LATERAL (SELECT id,created_at FROM checkins WHERE user_id=u.id AND status='done' AND visibility='friends' AND created_at>=NOW()-INTERVAL '5 minutes' ORDER BY created_at DESC LIMIT 1) e ON TRUE WHERE c.status='accepted' AND NOT u.banned AND (c.user_a=$1 OR c.user_b=$1)`,
    [user.id],
  );
  const result = [];
  for (const peer of peers) {
    const kind = pairKind(event.created_at, peer.event_at);
    if (!kind || !premium(peer)) continue;
    const [a, b] = [user.id, peer.id].sort(),
      [ea, eb] = [event.id, peer.event_id].sort();
    const inserted = await query(
      `INSERT INTO pair_moments(id,user_a,user_b,event_a,event_b,kind) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(event_a,event_b) DO UPDATE SET kind=pair_moments.kind RETURNING *`,
      [randomUUID(), a, b, ea, eb, kind],
    );
    if (inserted[0])
      result.push({
        id: inserted[0].id,
        kind,
        createdAt: inserted[0].created_at,
        friend: profile(peer),
      });
  }
  return result;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  try {
    const url = new URL(req.url, "http://" + (req.headers.host || "localhost"));
    const action = url.searchParams.get("action") || "bootstrap";
    if (!["GET", "POST"].includes(req.method))
      fail(405, "این درخواست پشتیبانی نمی‌شود.");
    if (req.method === "POST") {
      if (req.headers["sec-fetch-site"] === "cross-site")
        fail(403, "درخواست از آدرس مجاز نیست.");
      if (
        !String(req.headers["content-type"] || "").includes("application/json")
      )
        fail(415, "درخواست معتبر نیست.");
      const origin = req.headers.origin;
      const expected = new Set([
        `https://${req.headers.host}`,
        `http://${req.headers.host}`,
        process.env.PUBLIC_APP_URL,
      ]);
      if (origin && !expected.has(origin))
        fail(403, "درخواست از آدرس مجاز نیست.");
    }
    let body = req.body || {};
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        fail(400, "درخواست معتبر نیست.");
      }
    }
    if (!body || typeof body !== "object" || Array.isArray(body))
      fail(400, "درخواست معتبر نیست.");
    if (JSON.stringify(body).length > (action === "avatar" ? 100000 : 16000))
      fail(413, "درخواست خیلی بزرگه.");
    if (
      ["auth-start", "auth-verify", "phone-link-start", "phone-link-verify"].includes(action) &&
      !phoneAuthEnabled()
    )
      fail(403, "ورود و اتصال شماره فعلاً غیرفعاله. با گوگل وارد شو.", "phone_auth_disabled");
    await initialize();
    if (
      action === "admin-login" &&
      !(await rateLimit(
        `admin-ip:${String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0]}`,
        12,
        900,
      ))
    )
      fail(429, "چند بار تلاش شد؛ ۱۵ دقیقه دیگه امتحان کن.");
    if (action === "health") {
      await query("SELECT 1");
      return json(res, 200, {
        ready: true,
        database: true,
        testing: testingMode(),
        inviteOnly: inviteOnly(),
      });
    }
    if (action === "promo-info" && req.method === "GET") {
      const code = normalizePromoCode(url.searchParams.get("code"));
      const canonical = resolvePromoCode(code, process.env.LAUNCH_PROMO_CODE);
      if (!canonical)
        fail(404, "کد هدیه معتبر نیست.", "promo_not_found");
      const offers = await query(
        "SELECT code,premium_days,max_uses,active,GREATEST(max_uses-uses,0)::int AS remaining FROM promo_codes WHERE code=$1",
        [canonical],
      );
      if (!offers[0] || !offers[0].active)
        fail(404, "این کد هدیه فعال نیست.", "promo_not_found");
      return json(res, 200, {
        code,
        premiumDays: offers[0].premium_days,
        maxUses: offers[0].max_uses,
        remaining: offers[0].remaining,
      });
    }
    if (action === "invite" && req.method === "GET")
      return json(res, 200, await inviteInfo(url.searchParams.get("code")));
    if (action === "owner-bootstrap")
      return json(res, 200, await provisionOwner(req, body, fail));
    if (action === "profile-public" && req.method === "GET")
      return json(
        res,
        200,
        await publicProfile(url.searchParams.get("handle"), fail),
      );
    if (action === "circle-info" && req.method === "GET")
      return json(
        res,
        200,
        await groupInfo(url.searchParams.get("code"), fail),
      );
    const auth = await session(req, res);
    const user = auth.user;

    if (action === "world-map") {
      requireAccount(user);
      requirePremium(user);
      if (req.method !== "GET") fail(405, "این نقشه با درخواست خواندن باز می‌شه.");
      try { return json(res, 200, await worldMap(url.searchParams)); }
      catch (error) { if (error.message === "محدودهٔ نقشه معتبر نیست.") fail(400, error.message); throw error; }
    }
    if (action === "bootstrap")
      return json(res, 200, await bootstrap(user, auth.tokenHash));
    if (["account-merge-confirm", "account-merge-cancel"].includes(action)) {
      if (req.method !== "POST") fail(405, "این کار به درخواست امن نیاز داره.");
      requireAccount(user);
      if (action === "account-merge-cancel") {
        await cancelAccountMerge(user, auth.tokenHash);
        return json(res, 200, await bootstrap(user, auth.tokenHash));
      }
      const merged = await confirmAccountMerge(user, auth.tokenHash, body.confirmed, fail);
      return json(res, 200, await bootstrap(merged, auth.tokenHash));
    }
    if (action === "waitlist") {
      if (req.method !== "POST") fail(405, "این کار به درخواست امن نیاز داره.");
      return json(res, 200, await joinWaitlist(user, auth.tokenHash, body, fail));
    }
    if (action === "google-start") {
      if (req.method !== "POST") fail(405, "درخواست معتبر نیست.");
      return json(res, 200, await startGoogle({ body, user, auth, fail }));
    }
    if (action === "google-disconnect") {
      if (req.method !== "POST") fail(405, "درخواست معتبر نیست.");
      return json(res, 200, await removeGoogle(user, fail));
    }
    if (action === "google-pending-cancel") {
      if (req.method !== "POST") fail(405, "درخواست معتبر نیست.");
      await query("DELETE FROM pending_google WHERE session_hash=$1", [
        auth.tokenHash,
      ]);
      return json(res, 200, { ok: true });
    }
    const support = await supportAction({ action, body, user, req, fail });
    if (support !== undefined) return json(res, 200, support);
    const groupResult = await groupAction({ action, body, user, req, fail });
    if (groupResult !== undefined) return json(res, 200, groupResult);
    const extra = await communityAction({
      action,
      body,
      user,
      auth,
      url,
      req,
      fail,
    });
    if (extra !== undefined) return json(res, 200, extra);
    if (req.method !== "POST") fail(405, "این کار به درخواست امن نیاز داره.");

    if (action === "phone-link-start") {
      requireAccount(user);
      if (!testingMode()) fail(503, "تایید پیامکی هنوز فعال نشده.");
      if (user.role === "admin" && !user.session_admin_access)
        fail(403, "اول ورود خصوصی مدیریت رو کامل کن.");
      let phone;
      try {
        phone = normalizePhone(body.phone);
      } catch (e) {
        fail(400, e.message);
      }
      if (!(await rateLimit("phone-link:" + user.id, 5, 600)))
        fail(429, "چند دقیقه بعد دوباره امتحان کن.");
      if (
        (
          await query("SELECT id FROM users WHERE phone_hash=$1 AND id<>$2", [
            phoneHash(phone),
            user.id,
          ])
        )[0]
      )
        fail(
          409,
          "این شماره به حساب دیگه‌ای وصله؛ حساب‌ها خودکار ادغام نمی‌شن.",
        );
      const id = randomToken();
      await query(
        "INSERT INTO auth_challenges(id,user_id,phone_hash,phone_cipher,purpose,expires_at) VALUES($1,$2,$3,$4,'link',NOW()+INTERVAL '10 minutes')",
        [id, user.id, phoneHash(phone), encryptPhone(phone)],
      );
      return json(res, 200, {
        challengeId: id,
        demo: true,
        maskedPhone: "•••• " + phone.slice(-4),
      });
    }
    if (action === "phone-link-verify") {
      requireAccount(user);
      if (!testingMode()) fail(503, "تایید پیامکی فعال نشده.");
      if (user.role === "admin" && !user.session_admin_access)
        fail(403, "اول ورود خصوصی مدیریت رو کامل کن.");
      if (!/^[0-9۰-۹]{6}$/.test(String(body.code || "")))
        fail(400, "کد شش‌رقمی وارد کن.");
      const result = await query(
        "WITH ticket AS(UPDATE auth_challenges SET consumed_at=NOW(),verified_at=NOW() WHERE id=$1 AND user_id=$2 AND purpose='link' AND expires_at>NOW() AND consumed_at IS NULL RETURNING *) UPDATE users SET phone_hash=ticket.phone_hash,phone_cipher=ticket.phone_cipher FROM ticket WHERE users.id=$2 RETURNING users.*",
        [body.challengeId, user.id],
      );
      if (!result[0]) fail(400, "کد اتصال منقضی شده.");
      result[0].session_admin_access = user.session_admin_access;
      return json(res, 200, await bootstrap(result[0], auth.tokenHash));
    }
    if (action === "auth-start") {
      if (!testingMode())
        fail(
          503,
          "ورود پیامکی هنوز فعال نشده. در حال حاضر نسخه‌ی آزمایشی در دسترسه.",
          "sms_unconfigured",
        );
      let phone;
      try {
        phone = normalizePhone(body.phone);
      } catch (error) {
        fail(400, error.message);
      }
      const recent = await query(
        `SELECT COUNT(*)::int AS n FROM auth_challenges WHERE user_id=$1 AND created_at>NOW()-INTERVAL '10 minutes'`,
        [user.id],
      );
      if (recent[0].n >= 10) fail(429, "چند دقیقه بعد دوباره امتحان کن.");
      const id = randomToken();
      await query(
        `INSERT INTO auth_challenges(id,user_id,phone_hash,phone_cipher,expires_at) VALUES($1,$2,$3,$4,NOW()+INTERVAL '10 minutes')`,
        [id, user.id, phoneHash(phone), encryptPhone(phone)],
      );
      return json(res, 200, {
        challengeId: id,
        demo: true,
        maskedPhone: "•••• " + phone.slice(-4),
      });
    }
    if (action === "auth-verify") {
      if (!testingMode()) fail(503, "تایید پیامکی فعال نشده.");
      if (!/^[0-9۰-۹]{6}$/.test(String(body.code || "")))
        fail(400, "کد شش‌رقمی وارد کن.");
      const rows = await query(
        `UPDATE auth_challenges SET verified_at=NOW() WHERE id=$1 AND user_id=$2 AND purpose='login' AND expires_at>NOW() AND consumed_at IS NULL RETURNING *`,
        [body.challengeId, user.id],
      );
      if (!rows[0]) fail(400, "کد ورود منقضی شده؛ دوباره شماره‌ت رو وارد کن.");
      const existing = await query("SELECT * FROM users WHERE phone_hash=$1", [
        rows[0].phone_hash,
      ]);
      if (existing[0]) {
        if (existing[0].banned) fail(403, "این حساب فعلاً غیرفعاله.");
        await transaction([
          [
            "UPDATE sessions SET user_id=$1,admin_access=FALSE WHERE token_hash=$2",
            [existing[0].id, auth.tokenHash],
          ],
          [
            "UPDATE checkins SET user_id=$1 WHERE user_id=$2 AND $1<>$2 AND $3=FALSE",
            [existing[0].id, user.id, user.registered],
          ],
          [
            "UPDATE auth_challenges SET consumed_at=NOW() WHERE id=$1",
            [body.challengeId],
          ],
        ]);
        if (body.linkGoogle === true)
          await claimPendingGoogle(existing[0].id, auth.tokenHash);
        return json(res, 200, {
          registered: true,
          ...(await bootstrap(existing[0], auth.tokenHash)),
        });
      }
      return json(res, 200, {
        registered: false,
        ticket: body.challengeId,
        inviteOnly: inviteOnly(),
      });
    }
    if (action === "register") {
      if (body.provider !== "google" && !phoneAuthEnabled())
        fail(403, "عضویت با شماره فعلاً غیرفعاله. با گوگل ادامه بده.", "phone_auth_disabled");
      if (user.registered) fail(409, "حسابت قبلاً ساخته شده.");
      if (typeof body.ticket !== "string" || body.ticket.length > 100)
        fail(400, "اول شماره‌ت رو تایید کن.");
      const name = normalizeName(body.name);
      if (name.length < 2 || name.length > 40)
        fail(400, "اسمت رو بین ۲ تا ۴۰ حرف بنویس.");
      const code = normalizeCode(body.inviteCode),
        personalCode = inviteCode();
      if (inviteOnly() && !code)
        fail(
          400,
          "برای عضویت توی این مرحله، کد دعوت لازمه.",
          "invite_required",
        );
      let registrationGiftDays = 3;
      if (code) {
        const info = await inviteInfo(code);
        registrationGiftDays = info.bonusDays;
        if (info.remaining === 0)
          fail(
            410,
            "این دعوت پر شده؛ از دوستت یه دعوت تازه بگیر.",
            "invite_exhausted",
          );
      }
      const registered = await query(
        `WITH candidate AS MATERIALIZED (SELECT id FROM users WHERE id=$3 AND NOT registered FOR UPDATE), ticket AS MATERIALIZED (SELECT id,phone_hash,phone_cipher FROM auth_challenges WHERE id=$2 AND user_id=$3 AND purpose='login' AND verified_at IS NOT NULL AND consumed_at IS NULL AND expires_at>NOW() AND NOT $11::boolean AND EXISTS(SELECT 1 FROM candidate) UNION ALL SELECT session_hash AS id,NULL::text AS phone_hash,NULL::text AS phone_cipher FROM pending_google WHERE session_hash=$10 AND expires_at>NOW() AND $11::boolean AND EXISTS(SELECT 1 FROM candidate)), valid_invite AS (UPDATE invites SET uses=uses+1 WHERE code=$1 AND active AND (max_uses IS NULL OR uses<max_uses) AND EXISTS(SELECT 1 FROM ticket) RETURNING *), joined AS (UPDATE users SET registered=TRUE,terms_version='2026-10-17',terms_accepted_at=NOW(),name=$4,avatar_seed=$4,handle=CASE WHEN COALESCE((SELECT grant_admin FROM valid_invite),FALSE) AND (SELECT reserved_handle FROM valid_invite)='ali' THEN 'ali' ELSE 'u'||SUBSTRING(REPLACE(users.id,'-',''),1,10) END,role=CASE WHEN COALESCE((SELECT grant_admin FROM valid_invite),FALSE) THEN 'admin' ELSE 'member' END,phone_hash=ticket.phone_hash,phone_cipher=ticket.phone_cipher,invite_code=$5,invited_by=(SELECT inviter_id FROM valid_invite),joined_invite_code=$1,lifetime=COALESCE((SELECT premium_lifetime FROM valid_invite),FALSE),trial_days_bank=CASE WHEN $7::boolean AND NOT COALESCE((SELECT premium_lifetime FROM valid_invite),FALSE) THEN CASE WHEN EXISTS(SELECT 1 FROM valid_invite) THEN COALESCE(NULLIF((SELECT premium_days FROM valid_invite),0),7) ELSE 3 END ELSE 0 END,trial_until=CASE WHEN $7::boolean OR COALESCE((SELECT premium_lifetime FROM valid_invite),FALSE) THEN NULL ELSE NOW()+(CASE WHEN EXISTS(SELECT 1 FROM valid_invite) THEN COALESCE(NULLIF((SELECT premium_days FROM valid_invite),0),7) ELSE 3 END)*INTERVAL '1 day' END FROM ticket WHERE users.id=$3 AND NOT users.registered AND (NOT $6::boolean OR EXISTS(SELECT 1 FROM valid_invite)) RETURNING users.*), google_identity AS (INSERT INTO auth_identities(provider,subject,user_id,email_cipher) SELECT 'google',p.subject,j.id,p.email_cipher FROM pending_google p CROSS JOIN joined j WHERE p.session_hash=$10 AND $11::boolean RETURNING user_id), google_consume AS (DELETE FROM pending_google WHERE session_hash=$10 AND EXISTS(SELECT 1 FROM google_identity) RETURNING session_hash), reward AS (UPDATE users SET trial_days_bank=CASE WHEN $7::boolean THEN trial_days_bank+7 ELSE trial_days_bank END,trial_until=CASE WHEN $7::boolean THEN trial_until ELSE GREATEST(COALESCE(trial_until,NOW()),COALESCE(paid_until,NOW()),NOW())+INTERVAL '7 days' END WHERE id=(SELECT invited_by FROM joined) RETURNING id), consume AS (UPDATE auth_challenges SET consumed_at=NOW() WHERE id=$2 AND EXISTS(SELECT 1 FROM joined) RETURNING id), personal_invite AS (INSERT INTO invites(code,inviter_id,max_uses) SELECT $5,id,CASE WHEN role='admin' THEN 1 WHEN $7::boolean THEN 3 ELSE NULL END FROM joined ON CONFLICT DO NOTHING RETURNING code), auto_connect AS (INSERT INTO connections(id,user_a,user_b,requested_by,status) SELECT $9,LEAST(id,invited_by),GREATEST(id,invited_by),invited_by,CASE WHEN $8::boolean THEN 'accepted' ELSE 'pending' END FROM joined WHERE invited_by IS NOT NULL ON CONFLICT(user_a,user_b) DO NOTHING RETURNING id), admin_session AS(UPDATE sessions SET admin_access=TRUE WHERE token_hash=$10 AND EXISTS(SELECT 1 FROM joined WHERE role='admin') RETURNING token_hash) SELECT * FROM joined`,
        [
          code,
          body.ticket,
          user.id,
          name,
          personalCode,
          inviteOnly(),
          testingMode(),
          body.connectInviter === true,
          randomUUID(),
          auth.tokenHash,
          body.provider === "google",
        ],
      );
      if (!registered[0]) fail(400, "درخواست عضویت منقضی شده؛ دوباره وارد شو.");
      const fresh = registered[0];
      await query("DELETE FROM invitation_waitlist WHERE google_subject IN(SELECT subject FROM auth_identities WHERE user_id=$1 AND provider='google')", [fresh.id]);
      if (body.linkGoogle === true && body.provider !== "google")
        await claimPendingGoogle(fresh.id, auth.tokenHash);
      if (fresh.role === "admin") fresh.session_admin_access = true;
      if (fresh.invited_by)
        await Promise.all([
          notifyUser(fresh.invited_by, {
            actorId: fresh.id,
            kind: "invite",
            title: `${fresh.name} با دعوتت اومد!`,
            body: "با دعوت تو اومد؛ یه رفاقت تازه در راهه.",
            route: "/invite",
            dedupe: `joined:${fresh.id}`,
          }),
          notifyUser(fresh.id, {
            actorId: fresh.invited_by,
            kind: "request",
            title: "یه دعوت، یه شروع دوستی",
            body: "دعوت‌کننده‌ت منتظره به هم وصل بشین.",
            route: "/friends",
            dedupe: `inviter:${fresh.invited_by}`,
          }),
        ]);
      return json(res, 200, {
        bonusDays: fresh.lifetime ? 0 : registrationGiftDays,
        lifetimeGift: fresh.lifetime,
        ...(await bootstrap(fresh)),
      });
    }
    if (action === "checkin") {
      if (!(await rateLimit(`checkin:${user.id}`, 20, 60)))
        fail(429, "ثبتت انجام شده؛ کمی صبر کن، بعد دوباره استفاده کن.");
      if (
        !["need", "done"].includes(body.status) ||
        typeof body.nonce !== "string" ||
        body.nonce.length > 80
      )
        fail(400, "ثبت معتبر نیست.");
      const visibility =
        user.registered && body.visibility !== "private"
          ? "friends"
          : "private";
      const share =
        (!user.registered || visibility === "friends") &&
        user.share_location &&
        user.location_updated_at &&
        +new Date(user.location_updated_at) > Date.now() - 3600000;
      const rows = await query(
        `INSERT INTO checkins(id,user_id,status,visibility,client_nonce,location_lat,location_lng) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(user_id,client_nonce) DO UPDATE SET client_nonce=EXCLUDED.client_nonce RETURNING *`,
        [
          randomUUID(),
          user.id,
          body.status,
          visibility,
          body.nonce,
          share ? user.location_lat : null,
          share ? user.location_lng : null,
        ],
      );
      const [matched, personalStats] = await Promise.all([
        detectMoments(user, rows[0]),
        stats(user.id),
        share ? invalidateWorldMap() : Promise.resolve(),
      ]);
      // Keep real provider delivery alive after the response without making
      // recording a check-in wait for every friend's push service.
      waitUntil(
        Promise.allSettled([
          notifyFriends(user, rows[0], new Set(matched.map(moment => moment.friend.id))),
          notifyMutualMoments(user, rows[0], matched),
        ]).then(results => {
          if (results.some(result => result.status === "rejected")) console.warn("[jishoo-push] background delivery failed");
        }),
      );
      return json(res, 200, {
        event: {
          id: rows[0].id,
          status: rows[0].status,
          createdAt: rows[0].created_at,
        },
        matches: matched,
        stats: personalStats,
      });
    }
    if (action === "avatar") {
      requireAccount(user);
      let image;
      try {
        image = await sanitizeAvatar(body.image);
      } catch (error) {
        fail(400, error.message);
      }
      const rows = await query(
        "UPDATE users SET avatar_image=$2 WHERE id=$1 RETURNING *",
        [user.id, image],
      );
      rows[0].session_admin_access = user.session_admin_access;
      return json(res, 200, await bootstrap(rows[0]));
    }
    if (action === "profile") {
      requireAccount(user);
      let links;
      try {
        links = body.socialLinks === undefined ? user.social_links : cleanSocialLinks(body.socialLinks);
      } catch (error) {
        fail(400, error.message);
      }
      const name = normalizeName(body.name || user.name);
      let handle = user.handle;
      if (body.handle !== undefined) {
        try {
          handle = normalizeHandle(body.handle);
        } catch (error) {
          fail(400, error.message);
        }
        if (
          ["ali", "admin", "jishoo", "api"].includes(handle) &&
          !(handle === "ali" && user.role === "admin" && user.handle === "ali")
        )
          fail(409, "این شناسه رزرو شده.", "handle_taken");
        if (user.role === "admin" && user.handle === "ali" && handle !== "ali")
          fail(400, "شناسه‌ی ali برای حساب مالک ثابته.");
        const conflict = await query(
          "SELECT id FROM users WHERE LOWER(handle)=$1 AND id<>$2",
          [handle, user.id],
        );
        if (conflict[0])
          fail(409, "این شناسه قبلاً انتخاب شده.", "handle_taken");
      }
      if (name.length < 2 || name.length > 40) fail(400, "اسم معتبر نیست.");
      const rows = await query(
        "UPDATE users SET name=$2,avatar_seed=$2,social_links=$3::jsonb,handle=$4 WHERE id=$1 RETURNING *",
        [user.id, name, JSON.stringify(links), handle],
      );
      rows[0].session_admin_access = user.session_admin_access;
      return json(res, 200, await bootstrap(rows[0]));
    }
    if (action === "connection-request") {
      requireAccount(user);
      if (body.handle) {
        try {
          body.handle = normalizeHandle(body.handle);
        } catch (error) {
          fail(400, error.message);
        }
      }
      const info = body.handle
        ? {
            inviter: (
              await query(
                "SELECT u.id,u.name FROM users matched JOIN users u ON u.id=COALESCE(matched.merged_into,matched.id) WHERE LOWER(matched.handle)=$1 AND u.registered AND NOT u.banned",
                [String(body.handle).toLowerCase()],
              )
            )[0],
          }
        : await inviteInfo(body.code);
      if (!info.inviter || info.inviter.id === user.id)
        fail(400, "کد دوستت رو وارد کن.");
      const [a, b] = [user.id, info.inviter.id].sort();
      await query(
        `INSERT INTO connections(id,user_a,user_b,requested_by) VALUES($1,$2,$3,$4) ON CONFLICT(user_a,user_b) DO UPDATE SET status=CASE WHEN connections.requested_by<>$4 THEN 'accepted' ELSE connections.status END`,
        [randomUUID(), a, b, user.id],
      );
      await notifyUser(info.inviter.id, {
        actorId: user.id,
        kind: "request",
        title: `${user.name} می‌خواد وصل بشین`,
        body: "یه رفیق تازه پشت دره.",
        route: "/friends",
        dedupe: `request:${user.id}`,
      });
      return json(res, 200, { friends: await friends(user) });
    }
    if (action === "connection-respond") {
      requireAccount(user);
      if (typeof body.accept !== "boolean") fail(400, "انتخاب معتبر نیست.");
      if (body.accept) {
        const accepted = await query(
          `UPDATE connections SET status='accepted' WHERE id=$1 AND status='pending' AND requested_by<>$2 AND (user_a=$2 OR user_b=$2) RETURNING id`,
          [body.id, user.id],
        );
        if (!accepted[0])
          fail(404, "این درخواست پیدا نشد یا قبلاً پاسخ داده شده.");
      } else {
        const relation = (
          await query(
            "SELECT * FROM connections WHERE id=$1 AND (user_a=$2 OR user_b=$2)",
            [body.id, user.id],
          )
        )[0];
        if (!relation) fail(404, "این اتصال پیدا نشد.");
        const peer =
          relation.user_a === user.id ? relation.user_b : relation.user_a;
        await transaction([
          [
            "DELETE FROM connections WHERE id=$1 AND (user_a=$2 OR user_b=$2)",
            [body.id, user.id],
          ],
          [
            `DELETE FROM circle_members m USING circles c WHERE m.circle_id=c.id AND NOT c.shared AND ((c.owner_id=$1 AND m.user_id=$2) OR (c.owner_id=$2 AND m.user_id=$1))`,
            [user.id, peer],
          ],
          [
            `DELETE FROM notification_preferences WHERE scope='friend' AND ((user_id=$1 AND scope_id=$2) OR (user_id=$2 AND scope_id=$1))`,
            [user.id, peer],
          ],
        ]);
      }
      return json(res, 200, {
        friends: await friends(user),
        circles: await circles(user),
      });
    }
    if (action === "connection-share") {
      requireAccount(user);
      const relation = (await query(
        "SELECT * FROM connections WHERE id=$1 AND status='accepted' AND (user_a=$2 OR user_b=$2)",
        [body.id, user.id],
      ))[0];
      if (!relation) fail(404, "این دوست پیدا نشد.");
      const mine = relation.user_a === user.id ? "share_a" : "share_b";
      const theirs = mine === "share_a" ? "share_b" : "share_a";
      let operation = body.operation;
      // Older clients still require both participants' consent before any link is returned.
      if (operation === undefined && typeof body.enabled === "boolean")
        operation = body.enabled ? relation[theirs] ? "accept" : "request" : "withdraw";
      if (!["request", "accept", "cancel", "decline", "disconnect", "withdraw"].includes(operation))
        fail(400, "انتخاب معتبر نیست.");
      const grants = ["request", "accept"].includes(operation);
      if (grants) {
        requirePremium(user);
        if (!(await rateLimit("social-request:" + user.id, 12, 600)))
          fail(429, "چند دقیقه بعد دوباره امتحان کن.");
      }
      const conditions = {
        request: "NOT share_a AND NOT share_b",
        accept: `${theirs} AND NOT ${mine}`,
        cancel: `${mine} AND NOT ${theirs}`,
        decline: `${theirs} AND NOT ${mine}`,
        disconnect: "share_a AND share_b",
        withdraw: "TRUE",
      };
      const rows = await query(
        `UPDATE connections SET ${grants ? `${mine}=TRUE` : "share_a=FALSE,share_b=FALSE"} WHERE id=$1 AND status='accepted' AND (user_a=$2 OR user_b=$2) AND (${conditions[operation]}) RETURNING id`,
        [body.id, user.id],
      );
      if (!rows[0]) fail(409, "این درخواست تغییر کرده؛ صفحه رو تازه کن.");
      if (grants) {
        const peerId = relation.user_a === user.id ? relation.user_b : relation.user_a;
        await notifyUser(peerId, {
          actorId: user.id,
          kind: "social-request",
          title: operation === "request" ? `${user.name} درخواست دیدن حساب‌ها رو فرستاد` : `${user.name} درخواستت رو قبول کرد`,
          body: operation === "request" ? "با قبول درخواست، حساب‌های اجتماعی‌تون برای هم قابل دیدن می‌شه." : "حالا هر دوتون می‌تونین حساب‌های اجتماعی هم رو ببینین.",
          route: "/friends",
          dedupe: `social:${relation.id}:${randomUUID()}`,
        });
      }
      return json(res, 200, { friends: await friends(user) });
    }
    if (action === "map-visibility") {
      if (!["hidden", "news", "profile"].includes(body.mode)) fail(400, "نمایش معتبر نیست.");
      const currentMode = user.share_location ? (user.discoverable ? "profile" : "news") : "hidden";
      if (body.reviewOnly === true || (body.mode === currentMode && body.mode !== "hidden" && body.lat === undefined && body.lng === undefined)) {
        await query("UPDATE users SET map_visibility_reviewed=TRUE WHERE id=$1", [user.id]);
        return json(res, 200, { mode: currentMode });
      }
      if (body.mode === "profile") requireAccount(user);
      if (body.mode === "hidden") {
        await transaction([
          ["UPDATE users SET share_location=FALSE,discoverable=FALSE,map_visibility_reviewed=TRUE,location_lat=NULL,location_lng=NULL,location_updated_at=NULL WHERE id=$1", [user.id]],
          ["UPDATE checkins SET location_lat=NULL,location_lng=NULL WHERE user_id=$1", [user.id]],
        ]);
        await invalidateWorldMap();
      } else {
        if (!(await rateLimit(`map-visibility:${user.id}`, 12, 60))) fail(429, "یه لحظه صبر کن، بعد دوباره انتخاب کن.");
        let point;
        try { point = approximateLocation(body.lat, body.lng); }
        catch (e) { fail(400, e.message); }
        await query("UPDATE users SET share_location=TRUE,discoverable=$2,map_visibility_reviewed=TRUE,location_lat=$3,location_lng=$4,location_updated_at=NOW() WHERE id=$1", [user.id, body.mode === "profile", point.lat, point.lng]);
      }
      return json(res, 200, { mode: body.mode });
    }
    if (action === "location") {
      if (typeof body.enabled !== "boolean") fail(400, "انتخاب معتبر نیست.");
      if (body.enabled && body.refreshOnly === true) {
        let point;
        try { point = approximateLocation(body.lat, body.lng); } catch (failure) { fail(400, failure.message); }
        const updated = await query("UPDATE users SET location_lat=$2,location_lng=$3,location_updated_at=NOW() WHERE id=$1 AND share_location=TRUE RETURNING id", [user.id, point.lat, point.lng]);
        return json(res, 200, { enabled: updated.length > 0 });
      }
      if (!body.enabled) {
        await transaction([
          [
            "UPDATE users SET share_location=FALSE,discoverable=FALSE,location_lat=NULL,location_lng=NULL,location_updated_at=NULL WHERE id=$1",
            [user.id],
          ],
          [
            "UPDATE checkins SET location_lat=NULL,location_lng=NULL WHERE user_id=$1",
            [user.id],
          ],
        ]);
        await invalidateWorldMap();
      } else {
        let p;
        try {
          p = approximateLocation(body.lat, body.lng);
        } catch (error) {
          fail(400, error.message);
        }
        await query(
          "UPDATE users SET share_location=TRUE,location_lat=$2,location_lng=$3,location_updated_at=NOW() WHERE id=$1",
          [user.id, p.lat, p.lng],
        );
      }
      return json(res, 200, { enabled: Boolean(body.enabled) });
    }
    if (action === "nearby") {
      let p;
      try {
        p = approximateLocation(body.lat, body.lng);
      } catch (error) {
        fail(400, error.message);
      }
      const rows = await query(
        `SELECT DISTINCT ON(e.user_id) e.*,u.name,u.avatar_seed,u.avatar_image,u.registered,u.handle,u.discoverable,c.id AS connection_id FROM checkins e JOIN users u ON u.id=e.user_id LEFT JOIN connections c ON c.status='accepted' AND ((c.user_a=$1 AND c.user_b=u.id) OR (c.user_b=$1 AND c.user_a=u.id)) WHERE NOT u.banned AND u.share_location AND (e.visibility='friends' OR NOT u.registered OR e.user_id=$1) AND u.location_updated_at>NOW()-INTERVAL '1 hour' AND e.created_at>NOW()-INTERVAL '30 minutes' AND e.location_lat BETWEEN $2-.04 AND $2+.04 AND e.location_lng BETWEEN $3-.05 AND $3+.05 ORDER BY e.user_id,e.created_at DESC`,
        [user.id, p.lat, p.lng],
      );
      const seen = new Set();
      const activity = rows
        .filter(
          (r) =>
            distanceKm(p, { lat: r.location_lat, lng: r.location_lng }) <= 3,
        )
        .filter((r) => {
          if (seen.has(r.user_id)) return false;
          seen.add(r.user_id);
          return true;
        })
        .map((r) => ({
          id: r.id,
          markerKey: hashToken(
            "map:" + user.id + ":" + r.user_id + ":" + process.env.APP_SECRET,
          ).slice(0, 16),
          status: r.status,
          createdAt: r.created_at,
          lat: r.location_lat,
          lng: r.location_lng,
          isFriend: Boolean(r.connection_id),
          isMe: r.user_id === user.id,
          ...mapProfile(r, user.id),
        }));
      return json(res, 200, { activity, approximate: true });
    }
    if (action === "delete-account") {
      if (user.role === "admin" && user.handle === "ali")
        fail(400, "حساب مدیر رو نمی‌شه از اینجا پاک کرد.");
      await transaction([
        ["DELETE FROM pair_moments WHERE user_a=$1 OR user_b=$1", [user.id]],
        ["DELETE FROM connections WHERE user_a=$1 OR user_b=$1", [user.id]],
        [
          "DELETE FROM circle_members WHERE user_id=$1 OR circle_id IN (SELECT id FROM circles WHERE owner_id=$1)",
          [user.id],
        ],
        ["DELETE FROM circles WHERE owner_id=$1", [user.id]],
        ["DELETE FROM checkins WHERE user_id=$1", [user.id]],
        ["DELETE FROM auth_challenges WHERE user_id=$1", [user.id]],
        ["DELETE FROM sessions WHERE user_id=$1", [user.id]],
        ["DELETE FROM invites WHERE inviter_id=$1", [user.id]],
        ["UPDATE users SET invited_by=NULL WHERE invited_by=$1", [user.id]],
        ["DELETE FROM users WHERE id=$1", [user.id]],
      ]);
      await invalidateWorldMap();
      res.setHeader(
        "Set-Cookie",
        "jishoo_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0",
      );
      return json(res, 200, { ok: true });
    }
    if (action === "logout") {
      await query("DELETE FROM sessions WHERE token_hash=$1", [auth.tokenHash]);
      res.setHeader(
        "Set-Cookie",
        "jishoo_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0",
      );
      return json(res, 200, { ok: true });
    }
    fail(404, "این بخش پیدا نشد.");
  } catch (error) {
    if (error instanceof AppError)
      return json(res, error.status, {
        error: error.code,
        message: error.message,
      });
    if (error.code === "23505")
      return json(res, 409, {
        error: "duplicate_account",
        message: "این شماره قبلاً عضو شده؛ با همون شماره وارد شو.",
      });
    console.error("[jishoo-api]", error.code || error.name);
    return json(res, 503, {
      error: "temporarily_unavailable",
      message: "الان ارتباط برقرار نشد؛ یه لحظه دیگه امتحان کن.",
    });
  }
}
