import { randomUUID } from "node:crypto";
import webpush from "web-push";
import { query } from "./database.js";
import { hashToken } from "./core.js";

export const pushReady = () =>
  Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
export function cleanSubscription(value) {
  if (!value || typeof value !== "object")
    throw new Error("اشتراک اعلان معتبر نیست.");
  let endpoint;
  try {
    endpoint = new URL(value.endpoint);
  } catch {
    throw new Error("اشتراک اعلان معتبر نیست.");
  }
  const host = endpoint.hostname;
  const trusted =
    host === "fcm.googleapis.com" ||
    host === "web.push.apple.com" ||
    host === "updates.push.services.mozilla.com" ||
    host.endsWith(".push.services.mozilla.com") ||
    host.endsWith(".notify.windows.com");
  if (
    endpoint.protocol !== "https:" ||
    !trusted ||
    (endpoint.port && endpoint.port !== "443") ||
    endpoint.username ||
    endpoint.password ||
    endpoint.hash ||
    String(value.endpoint).length > 2000 ||
    !/^[A-Za-z0-9_-]{87}$/.test(value.keys?.p256dh || "") ||
    !/^[A-Za-z0-9_-]{22}$/.test(value.keys?.auth || "")
  )
    throw new Error("اشتراک اعلان این مرورگر پشتیبانی نمی‌شه.");
  const publicKey = Buffer.from(value.keys.p256dh, "base64url");
  if (
    publicKey.length !== 65 ||
    publicKey[0] !== 4 ||
    Buffer.from(value.keys.auth, "base64url").length !== 16
  )
    throw new Error("کلید اعلان معتبر نیست.");
  return {
    endpoint: endpoint.href,
    keys: { p256dh: value.keys.p256dh, auth: value.keys.auth },
  };
}
export async function deliverPush(userId, row, payload, { urgency = "high", ttl = 3600 } = {}) {
  if (!pushReady()) return { accepted: false, reason: "unconfigured" };
  webpush.setVapidDetails(
    process.env.PUBLIC_APP_URL || "https://jishoo.vercel.app",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
  let reason = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await webpush.sendNotification(
        row.subscription,
        JSON.stringify(payload),
        { TTL: ttl, urgency, timeout: 4000 },
      );
      await query(
        "UPDATE push_subscriptions SET last_attempt_at=NOW(),last_success_at=NOW(),last_error=NULL WHERE user_id=$1 AND endpoint_hash=$2",
        [userId, row.endpoint_hash],
      );
      return { accepted: true };
    } catch (error) {
      const status = error.statusCode;
      if ([404, 410].includes(status)) {
        await query(
          "DELETE FROM push_subscriptions WHERE user_id=$1 AND endpoint_hash=$2",
          [userId, row.endpoint_hash],
        );
        return { accepted: false, reason: "expired" };
      }
      reason = [400, 401, 403].includes(status)
        ? "configuration"
        : "provider_unavailable";
      if (attempt === 0 && (!status || status >= 500)) continue;
      break;
    }
  }
  await query(
    "UPDATE push_subscriptions SET last_attempt_at=NOW(),last_error=$3 WHERE user_id=$1 AND endpoint_hash=$2",
    [userId, row.endpoint_hash, reason],
  );
  // Deliberately exclude endpoint URLs, subscription keys and provider bodies.
  console.warn("[jishoo-push]", reason);
  return { accepted: false, reason };
}
export async function deliverToDevices(
  userId,
  subscriptions,
  payload,
  send = deliverPush,
  options = {},
) {
  const results = await Promise.allSettled(
    subscriptions.map((row) => send(userId, row, payload, options)),
  );
  const accepted = results.filter(
    (r) => r.status === "fulfilled" && r.value.accepted,
  ).length;
  return {
    devices: subscriptions.length,
    accepted,
    failed: subscriptions.length - accepted,
  };
}
export function notificationStatement(
  userId,
  { actorId = null, preferenceActorId = actorId, kind, title, body, route = "/home", dedupe },
  noticeId = null,
) {
  return [
    `INSERT INTO notifications(id,user_id,actor_id,kind,title,body,route,dedupe) SELECT $1,u.id,$3,$4,$5,$6,$7,$8 FROM users u WHERE u.id=$2 AND u.notifications_enabled AND NOT u.banned AND ($9::text IS NULL OR EXISTS(SELECT 1 FROM mutual_notices WHERE id=$9)) AND NOT EXISTS(SELECT 1 FROM notification_preferences p WHERE p.user_id=u.id AND p.scope='friend' AND p.scope_id=$10 AND NOT p.enabled) AND NOT EXISTS(SELECT 1 FROM circles c JOIN notification_preferences p ON p.scope='circle' AND p.scope_id=c.id AND p.user_id=u.id WHERE NOT p.enabled AND (c.owner_id=u.id OR (c.shared AND EXISTS(SELECT 1 FROM circle_members r WHERE r.circle_id=c.id AND r.user_id=u.id AND r.status='accepted'))) AND (c.owner_id=$10 OR EXISTS(SELECT 1 FROM circle_members a WHERE a.circle_id=c.id AND a.user_id=$10 AND a.status='accepted'))) ON CONFLICT(user_id,dedupe) DO NOTHING RETURNING id`,
    [randomUUID(), userId, actorId, kind, title, body, route, dedupe, noticeId, preferenceActorId],
  ];
}
export async function deliverNotification(userId, notificationId, { actorId = null, kind, title, body, route = "/home" }) {
  if (!pushReady()) return;
  const subscriptions = await query(
    "SELECT endpoint_hash,subscription FROM push_subscriptions WHERE user_id=$1",
    [userId],
  );
  return Promise.allSettled(
    subscriptions.map((row) =>
      deliverPush(userId, row, {
        title,
        body,
        url: route,
        tag: `${kind}:${actorId || notificationId}`,
      }),
    ),
  );
}
export async function notifyUser(userId, payload) {
  const rows = await query(...notificationStatement(userId, payload));
  if (rows[0]) return deliverNotification(userId, rows[0].id, payload);
}
export async function notifyFriends(user, event, skipPeers = new Set()) {
  if (!user.registered || event.visibility !== "friends") return;
  const peers = await query(
    `SELECT CASE WHEN user_a=$1 THEN user_b ELSE user_a END AS id FROM connections WHERE status='accepted' AND (user_a=$1 OR user_b=$1)`,
    [user.id],
  );
  // A burst of taps produces at most one notification of each kind per 5 minutes.
  const bucket = Math.floor(+new Date(event.created_at) / 300000);
  for (let start = 0; start < peers.length; start += 12)
    await Promise.allSettled(
      peers.slice(start, start + 12).filter(peer => !skipPeers.has(peer.id)).map((peer) =>
        notifyUser(peer.id, {
          actorId: user.id,
          kind: "checkin",
          title:
            event.status === "need"
              ? `${user.name} جیش داره!`
              : `${user.name} جیش کرد!`,
          body:
            event.status === "need"
              ? "دوستت جیشش رو ثبت کرده."
              : "رفیقت هم سبک شد 💧",
          route: "/friends",
          dedupe: `checkin:${user.id}:${event.status}:${bucket}`,
        }),
      ),
    );
}
export async function saveSubscription(userId, subscription) {
  const clean = cleanSubscription(subscription);
  // A device belongs to the currently signed-in account, never two accounts.
  await query(
    `INSERT INTO push_subscriptions(user_id,endpoint_hash,subscription) VALUES($1,$2,$3::jsonb) ON CONFLICT(endpoint_hash) DO UPDATE SET user_id=EXCLUDED.user_id,subscription=EXCLUDED.subscription`,
    [userId, hashToken(clean.endpoint), JSON.stringify(clean)],
  );
}
