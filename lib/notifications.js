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
  if (
    endpoint.protocol !== "https:" ||
    !(
      host === "fcm.googleapis.com" ||
      host === "web.push.apple.com" ||
      host === "updates.push.services.mozilla.com" ||
      host.endsWith(".push.services.mozilla.com")
    ) ||
    endpoint.username ||
    endpoint.password ||
    String(value.endpoint).length > 2000 ||
    !/^[A-Za-z0-9_-]{40,200}$/.test(value.keys?.p256dh || "") ||
    !/^[A-Za-z0-9_-]{16,100}$/.test(value.keys?.auth || "")
  )
    throw new Error("اشتراک اعلان این مرورگر پشتیبانی نمی‌شه.");
  return {
    endpoint: endpoint.href,
    keys: { p256dh: value.keys.p256dh, auth: value.keys.auth },
  };
}
export async function notifyUser(
  userId,
  { actorId = null, kind, title, body, route = "/#/home", dedupe },
) {
  const rows = await query(
    `INSERT INTO notifications(id,user_id,actor_id,kind,title,body,route,dedupe) SELECT $1,u.id,$3,$4,$5,$6,$7,$8 FROM users u WHERE u.id=$2 AND u.notifications_enabled AND NOT u.banned AND NOT EXISTS(SELECT 1 FROM notification_preferences p WHERE p.user_id=u.id AND p.scope='friend' AND p.scope_id=$3 AND NOT p.enabled) AND NOT EXISTS(SELECT 1 FROM circle_members m JOIN circles c ON c.id=m.circle_id JOIN notification_preferences p ON p.scope='circle' AND p.scope_id=c.id AND p.user_id=u.id WHERE c.owner_id=u.id AND m.user_id=$3 AND NOT p.enabled) ON CONFLICT(user_id,dedupe) DO NOTHING RETURNING id`,
    [randomUUID(), userId, actorId, kind, title, body, route, dedupe],
  );
  if (!rows[0] || !pushReady()) return;
  webpush.setVapidDetails(
    "https://jishoo.vercel.app",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
  const subscriptions = await query(
    "SELECT endpoint_hash,subscription FROM push_subscriptions WHERE user_id=$1",
    [userId],
  );
  await Promise.all(
    subscriptions.map(async (row) => {
      try {
        await webpush.sendNotification(
          row.subscription,
          JSON.stringify({
            title,
            body,
            url: route,
            tag: kind,
            icon: "/assets/app-icon-192.png",
          }),
          { TTL: 600, timeout: 5000 },
        );
      } catch (error) {
        if ([404, 410].includes(error.statusCode))
          await query(
            "DELETE FROM push_subscriptions WHERE user_id=$1 AND endpoint_hash=$2",
            [userId, row.endpoint_hash],
          );
      }
    }),
  );
}
export async function notifyFriends(user, event) {
  if (!user.registered || event.visibility !== "friends") return;
  const peers = await query(
    `SELECT CASE WHEN user_a=$1 THEN user_b ELSE user_a END AS id FROM connections WHERE status='accepted' AND (user_a=$1 OR user_b=$1)`,
    [user.id],
  );
  const bucket = Math.floor(+new Date(event.created_at) / 300000);
  await Promise.all(
    peers.map((peer) =>
      notifyUser(peer.id, {
        actorId: user.id,
        kind: "checkin",
        title:
          event.status === "need"
            ? `${user.name} هم‌جیش می‌خواد!`
            : `${user.name} گفت آخیش!`,
        body:
          event.status === "need"
            ? "یه بهونه‌ی کوچولو برای با هم بودن."
            : "یه خبر سبک از رفیقت.",
        route: "/#/friends",
        dedupe: `checkin:${user.id}:${event.status}:${bucket}`,
      }),
    ),
  );
}
export async function saveSubscription(userId, subscription) {
  const clean = cleanSubscription(subscription);
  await query(
    `INSERT INTO push_subscriptions(user_id,endpoint_hash,subscription) VALUES($1,$2,$3::jsonb) ON CONFLICT(user_id,endpoint_hash) DO UPDATE SET subscription=EXCLUDED.subscription`,
    [userId, hashToken(clean.endpoint), JSON.stringify(clean)],
  );
}
