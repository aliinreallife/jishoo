import { randomUUID } from "node:crypto";
import { query, transaction } from "./database.js";
import {
  hashToken,
  randomToken,
  inviteCode,
  normalizeHandle,
  approximateLocation,
  distanceKm,
  premium,
} from "./core.js";
import { getAchievements } from "./achievements.js";
import {
  pushReady,
  saveSubscription,
  deliverToDevices,
} from "./notifications.js";
import { rateLimit, authorizeAdminPassword } from "./security.js";

const person = (u) => ({
  id: u.id,
  name: u.name,
  handle: u.handle,
  avatarSeed: u.avatar_seed,
  avatarImage: u.avatar_image || null,
});
export async function getCommunity(user) {
  const adminSession =
    user.role === "admin" && user.session_admin_access === true;
  if (adminSession && user.invite_code) {
    const current = (
      await query("SELECT active,uses,max_uses FROM invites WHERE code=$1", [
        user.invite_code,
      ])
    )[0];
    if (current && current.max_uses !== 1) {
      await query("UPDATE invites SET max_uses=1 WHERE code=$1", [
        user.invite_code,
      ]);
      current.max_uses = 1;
    }
    if (
      !current ||
      !current.active ||
      (current.max_uses !== null && current.uses >= current.max_uses)
    ) {
      const code = inviteCode();
      const rotated = await transaction([
        [
          "INSERT INTO invites(code,inviter_id,max_uses) VALUES($1,$2,1)",
          [code, user.id],
        ],
        [
          "UPDATE users SET invite_code=$2 WHERE id=$1 RETURNING invite_code",
          [user.id, code],
        ],
      ]);
      user.invite_code = rotated[1][0].invite_code;
    }
  }
  const [
    achievements,
    invites,
    notifications,
    preferences,
    invited,
    adminUses,
  ] = await Promise.all([
    getAchievements(user.id, user.registered),
    user.registered
      ? query("SELECT uses,max_uses FROM invites WHERE code=$1", [
          user.invite_code,
        ])
      : [],
    user.registered
      ? query(
          'SELECT id,kind,title,body,route,read_at AS "readAt",created_at AS "createdAt" FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 40',
          [user.id],
        )
      : [],
    user.registered
      ? query(
          "SELECT scope,scope_id AS id,enabled FROM notification_preferences WHERE user_id=$1",
          [user.id],
        )
      : [],
    user.registered
      ? query(
          "SELECT id,name,handle,avatar_seed,avatar_image,created_at FROM users WHERE invited_by=$1 AND registered ORDER BY created_at DESC LIMIT 100",
          [user.id],
        )
      : [],
    adminSession
      ? query(
          "SELECT COALESCE(SUM(uses),0)::int AS n FROM invites WHERE inviter_id=$1",
          [user.id],
        )
      : [],
  ]);
  const invitation = invites[0];
  return {
    achievements,
    notifications,
    notificationPreferences: preferences,
    vapidPublicKey: pushReady() ? process.env.VAPID_PUBLIC_KEY : null,
    invitationQuota: user.registered
      ? {
          used: adminSession ? adminUses[0].n : invitation?.uses || 0,
          limit: adminSession ? null : invitation ? invitation.max_uses : 3,
          remaining:
            adminSession || invitation?.max_uses === null
              ? null
              : Math.max(
                  0,
                  (invitation?.max_uses ?? 3) - (invitation?.uses || 0),
                ),
        }
      : null,
    invited: invited.map((u) => ({ ...person(u), joinedAt: u.created_at })),
  };
}
export async function publicProfile(rawHandle, fail) {
  let handle;
  try {
    handle = normalizeHandle(rawHandle);
  } catch {
    fail(404, "این پروفایل پیدا نشد.");
  }
  const rows = await query(
    "SELECT * FROM users WHERE LOWER(handle)=$1 AND registered AND NOT banned",
    [handle],
  );
  if (!rows[0]) fail(404, "این پروفایل پیدا نشد.");
  const user = rows[0];
  const [achievements, invites] = await Promise.all([
    getAchievements(user.id, false),
    query("SELECT code,uses,max_uses FROM invites WHERE code=$1 AND active", [
      user.invite_code,
    ]),
  ]);
  const invite = invites[0];
  return {
    profile: {
      ...person(user),
      achievements: achievements.filter((a) => a.level > 0),
      inviteCode:
        invite && (invite.max_uses === null || invite.uses < invite.max_uses)
          ? invite.code
          : null,
    },
  };
}
export async function communityAction({
  action,
  body,
  user,
  auth,
  url,
  req,
  fail,
}) {
  const supported = [
    "discover",
    "discoverable",
    "notifications",
    "notifications-read",
    "notification-pref",
    "push-subscribe",
    "push-unsubscribe",
    "push-test",
    "admin-login",
    "admin",
    "admin-invite",
    "admin-invite-revoke",
    "admin-user",
    "admin-recovery",
    "admin-redeem",
    "claim-admin",
  ];
  if (!supported.includes(action)) return undefined;
  if (!user.registered)
    fail(401, "با دعوت عضو شو تا به دوست‌ها وصل بشی.", "account_required");
  const readOnly = ["notifications", "admin"];
  if (!readOnly.includes(action) && req.method !== "POST")
    fail(405, "این کار به درخواست امن نیاز داره.");
  if (action === "notifications")
    return {
      notifications: await query(
        'SELECT id,kind,title,body,route,read_at AS "readAt",created_at AS "createdAt" FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 40',
        [user.id],
      ),
    };
  if (action === "notifications-read") {
    await query(
      "UPDATE notifications SET read_at=NOW() WHERE user_id=$1 AND read_at IS NULL",
      [user.id],
    );
    return { ok: true };
  }
  if (action === "notification-pref") {
    if (typeof body.enabled !== "boolean") fail(400, "انتخاب معتبر نیست.");
    if (body.scope === "all")
      await query("UPDATE users SET notifications_enabled=$2 WHERE id=$1", [
        user.id,
        body.enabled,
      ]);
    else {
      if (!["friend", "circle"].includes(body.scope))
        fail(400, "انتخاب معتبر نیست.");
      const target =
        body.scope === "friend"
          ? await query(
              "SELECT id FROM connections WHERE (user_a=$1 AND user_b=$2) OR (user_a=$2 AND user_b=$1)",
              [user.id, body.id],
            )
          : await query(
              "SELECT c.id FROM circles c WHERE c.id=$2 AND (c.owner_id=$1 OR (c.shared AND EXISTS(SELECT 1 FROM circle_members m WHERE m.circle_id=c.id AND m.user_id=$1 AND m.status='accepted')))",
              [user.id, body.id],
            );
      if (!target[0]) fail(404, "این دوست یا جمع پیدا نشد.");
      await query(
        "INSERT INTO notification_preferences(user_id,scope,scope_id,enabled) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,scope,scope_id) DO UPDATE SET enabled=EXCLUDED.enabled",
        [user.id, body.scope, body.id, body.enabled],
      );
    }
    return { ok: true };
  }
  if (action === "push-subscribe") {
    if (!pushReady()) fail(503, "اعلان مرورگر هنوز آماده نیست.");
    try {
      await saveSubscription(user.id, body.subscription);
    } catch (error) {
      fail(400, error.message);
    }
    return { ok: true };
  }
  if (action === "push-unsubscribe") {
    if (typeof body.endpoint !== "string") fail(400, "اشتراک معتبر نیست.");
    await query(
      "DELETE FROM push_subscriptions WHERE user_id=$1 AND endpoint_hash=$2",
      [user.id, hashToken(body.endpoint)],
    );
    return { ok: true };
  }
  if (action === "push-test") {
    if (!pushReady()) fail(503, "سرویس اعلان هنوز آماده نیست.");
    if (!(await rateLimit(`push-test:${user.id}`, 3, 60)))
      fail(429, "یه دقیقه صبر کن، بعد دوباره تست کن.");
    const subscriptions = await query(
      "SELECT endpoint_hash,subscription FROM push_subscriptions WHERE user_id=$1",
      [user.id],
    );
    if (!subscriptions.length)
      fail(
        404,
        "هنوز دستگاهی برای اعلان ثبت نشده؛ روی یکی از دستگاه‌هات اعلان رو روشن کن.",
      );
    const result = await deliverToDevices(user.id, subscriptions, {
      title: "یه خبر کوچولو از جیشو 💧",
      body: "این اعلان تستیه؛ روی همهٔ دستگاه‌های فعال حسابت فرستاده شده.",
      url: "/#/notifications",
      tag: "jishoo-test",
    });
    if (!result.accepted)
      fail(
        503,
        "هیچ سرویس اعلانی پیام رو قبول نکرد؛ اجازهٔ اعلان دستگاه‌هات رو بررسی کن.",
        "push_delivery_failed",
      );
    return {
      accepted: true,
      devices: result.devices,
      delivered: result.accepted,
      failed: result.failed,
    };
  }
  if (action === "admin-login") {
    if (!(await rateLimit(`admin-account:${user.id}`, 5, 900)))
      fail(429, "چند بار تلاش شد؛ ۱۵ دقیقه دیگه امتحان کن.");
    if (!(await authorizeAdminPassword(user, body.password)))
      fail(403, "رمز یا حساب مدیر معتبر نیست.");
    await query(
      "UPDATE sessions SET admin_access=TRUE WHERE token_hash=$1 AND user_id=$2",
      [auth.tokenHash, user.id],
    );
    await query(
      "INSERT INTO admin_audit(id,actor_id,action) VALUES($1,$2,'password-login')",
      [randomUUID(), user.id],
    );
    return { ok: true };
  }
  if (action === "discoverable") {
    if (typeof body.enabled !== "boolean") fail(400, "انتخاب معتبر نیست.");
    if (body.enabled && !user.share_location)
      fail(400, "اول در نقشه، نمایش موقعیت تقریبی رو روشن کن.");
    await query("UPDATE users SET discoverable=$2 WHERE id=$1", [
      user.id,
      body.enabled,
    ]);
    return { enabled: body.enabled };
  }
  if (action === "discover") {
    let point;
    try {
      point = approximateLocation(body.lat, body.lng);
    } catch (error) {
      fail(400, error.message);
    }
    const rows = await query(
      `SELECT u.id,u.name,u.handle,u.avatar_seed,u.avatar_image,u.location_lat,u.location_lng,c.status,c.requested_by,e.status AS activity,e.created_at AS activity_at FROM users u LEFT JOIN connections c ON (c.user_a=$1 AND c.user_b=u.id) OR(c.user_b=$1 AND c.user_a=u.id) LEFT JOIN LATERAL(SELECT status,created_at FROM checkins WHERE user_id=u.id AND visibility='friends' AND created_at>NOW()-INTERVAL '30 minutes' ORDER BY created_at DESC LIMIT 1)e ON TRUE WHERE u.id<>$1 AND u.registered AND NOT u.banned AND u.discoverable AND u.share_location AND u.location_updated_at>NOW()-INTERVAL '1 hour' AND u.location_lat BETWEEN $2-.04 AND $2+.04 AND u.location_lng BETWEEN $3-.05 AND $3+.05 ORDER BY e.created_at DESC NULLS LAST LIMIT 60`,
      [user.id, point.lat, point.lng],
    );
    return {
      people: rows
        .filter(
          (u) =>
            distanceKm(point, { lat: u.location_lat, lng: u.location_lng }) <=
            3,
        )
        .map((u) => ({
          ...person(u),
          connection: u.status || null,
          incoming: u.requested_by !== user.id,
          activity: u.activity,
          activityAt: u.activity_at,
          distance: "کمتر از ۳ کیلومتر",
        })),
    };
  }
  if (action === "admin-redeem") {
    if (typeof body.token !== "string" || body.token.length > 150)
      fail(400, "لینک معتبر نیست.");
    const result = await query(
      `WITH redeemed AS(UPDATE admin_access_links SET consumed_at=NOW() WHERE token_hash=$1 AND user_id=$2 AND consumed_at IS NULL AND expires_at>NOW() RETURNING user_id) UPDATE sessions SET admin_access=TRUE WHERE token_hash=$3 AND user_id IN(SELECT user_id FROM redeemed) RETURNING token_hash`,
      [hashToken(body.token), user.id, auth.tokenHash],
    );
    if (!result[0]) fail(403, "لینک ورود مدیر مصرف شده یا منقضی شده.");
    return { ok: true };
  }
  if (action === "claim-admin") {
    if (typeof body.code !== "string" || body.code.length > 150)
      fail(400, "دعوت معتبر نیست.");
    const rows = await query(
      `WITH candidate AS MATERIALIZED(SELECT id FROM users WHERE id=$1 FOR UPDATE),claimed AS(UPDATE invites SET uses=uses+1 WHERE code=$2 AND active AND grant_admin AND (max_uses IS NULL OR uses<max_uses) AND EXISTS(SELECT 1 FROM candidate) RETURNING reserved_handle),joined AS(UPDATE users SET role='admin',handle=COALESCE((SELECT reserved_handle FROM claimed),handle) WHERE id=$1 AND EXISTS(SELECT 1 FROM claimed) RETURNING id),elevated AS(UPDATE sessions SET admin_access=TRUE WHERE token_hash=$3 AND user_id IN(SELECT id FROM joined) RETURNING token_hash) SELECT id FROM joined`,
      [user.id, body.code.trim().toUpperCase(), auth.tokenHash],
    );
    if (!rows[0]) fail(403, "دعوت خصوصی مصرف شده یا معتبر نیست.");
    return { ok: true };
  }
  if (user.role !== "admin" || user.session_admin_access !== true)
    fail(403, "این بخش فقط برای مدیر با ورود خصوصی فعاله.", "admin_required");
  if (action === "admin") {
    const search = String(url.searchParams.get("q") || "")
      .trim()
      .slice(0, 80);
    const offset = Math.max(
      0,
      Math.min(
        100000,
        Number.parseInt(url.searchParams.get("offset") || "0", 10) || 0,
      ),
    );
    const [totals, users, invites, audit] = await Promise.all([
      query(
        `SELECT (SELECT COUNT(*)::int FROM users WHERE registered) AS members,(SELECT COUNT(*)::int FROM users WHERE lifetime AND registered) AS lifetime,(SELECT COUNT(*)::int FROM checkins WHERE created_at>NOW()-INTERVAL '1 day') AS today,(SELECT COUNT(*)::int FROM users WHERE banned) AS suspended`,
      ),
      query(
        "SELECT id,name,handle,role,lifetime,banned,created_at,invite_code FROM users WHERE registered AND ($1='' OR name ILIKE $2 OR handle ILIKE $2) ORDER BY created_at DESC LIMIT 50 OFFSET $3",
        [search, "%" + search + "%", offset],
      ),
      query(
        "SELECT code,active,uses,max_uses,created_at FROM invites WHERE inviter_id=$1 AND max_uses=1 AND NOT grant_admin ORDER BY created_at DESC LIMIT 50",
        [user.id],
      ),
      query(
        "SELECT action,target_id,created_at FROM admin_audit ORDER BY created_at DESC LIMIT 25",
      ),
    ]);
    return {
      totals: totals[0],
      users,
      invites,
      audit,
      offset,
      hasMore: users.length === 50,
    };
  }
  if (action === "admin-invite") {
    const code = inviteCode();
    await transaction([
      [
        "INSERT INTO invites(code,inviter_id,max_uses) VALUES($1,$2,1)",
        [code, user.id],
      ],
      [
        "INSERT INTO admin_audit(id,actor_id,action,target_id) VALUES($1,$2,'invite-create',$3)",
        [randomUUID(), user.id, code],
      ],
    ]);
    return { code, url: `${process.env.PUBLIC_APP_URL}/?invite=${code}` };
  }
  if (action === "admin-invite-revoke") {
    const changed = await query(
      "UPDATE invites SET active=FALSE WHERE code=$1 AND inviter_id=$2 AND max_uses=1 AND NOT grant_admin RETURNING code",
      [body.code, user.id],
    );
    if (!changed[0]) fail(404, "این دعوت پیدا نشد.");
    return { ok: true };
  }
  if (action === "admin-recovery") {
    const token = randomToken();
    await query(
      "INSERT INTO admin_access_links(token_hash,user_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '30 days')",
      [hashToken(token), user.id],
    );
    return {
      url: `${process.env.PUBLIC_APP_URL}/?adminAccess=${token}`,
      singleUse: true,
      expiresInDays: 30,
    };
  }
  if (action === "admin-user") {
    if (
      !["lifetime", "suspend"].includes(body.operation) ||
      typeof body.enabled !== "boolean"
    )
      fail(400, "درخواست معتبر نیست.");
    const target = (
      await query("SELECT id,role FROM users WHERE id=$1 AND registered", [
        body.id,
      ])
    )[0];
    if (!target) fail(404, "این عضو پیدا نشد.");
    if (body.operation === "suspend" && target.role === "admin")
      fail(400, "حساب مدیر رو نمی‌شه از اینجا غیرفعال کرد.");
    const column = body.operation === "lifetime" ? "lifetime" : "banned";
    await transaction([
      [`UPDATE users SET ${column}=$2 WHERE id=$1`, [body.id, body.enabled]],
      [
        "INSERT INTO admin_audit(id,actor_id,action,target_id) VALUES($1,$2,$3,$4)",
        [randomUUID(), user.id, `${body.operation}:${body.enabled}`, body.id],
      ],
    ]);
    if (body.operation === "suspend")
      await query("UPDATE invites SET active=$2 WHERE inviter_id=$1", [
        body.id,
        !body.enabled,
      ]);
    if (body.operation === "suspend" && body.enabled)
      await transaction([
        [
          "UPDATE users SET share_location=FALSE,discoverable=FALSE,location_lat=NULL,location_lng=NULL,location_updated_at=NULL WHERE id=$1",
          [body.id],
        ],
        [
          "UPDATE checkins SET location_lat=NULL,location_lng=NULL WHERE user_id=$1",
          [body.id],
        ],
      ]);
    return { ok: true };
  }
}
