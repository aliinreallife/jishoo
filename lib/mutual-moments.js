import { randomUUID } from "node:crypto";
import { query, transaction } from "./database.js";
import { pairKind, distanceKm } from "./core.js";
import { notificationStatement, deliverNotification } from "./notifications.js";

const minute = 60000;
export const nearbyMomentRadius = 3;
export function nearbyMomentEligible(user, event, now = Date.now()) {
  return Boolean(user.registered && !user.banned && user.share_location &&
    +new Date(user.location_updated_at) > now - 60 * minute &&
    event.status === "done" && event.visibility === "friends" &&
    Number.isFinite(event.location_lat) && Number.isFinite(event.location_lng) &&
    Math.abs(now - +new Date(event.created_at)) <= 5 * minute);
}
export function nearbyMomentKind(event, peer) {
  const point = { lat: event.location_lat, lng: event.location_lng };
  const other = { lat: peer.location_lat, lng: peer.location_lng };
  if (![point.lat, point.lng, other.lat, other.lng].every(Number.isFinite) || distanceKm(point, other) > nearbyMomentRadius) return null;
  return pairKind(event.created_at, peer.event_at);
}

export function mutualPayload(scope, kind, peer) {
  const together = kind === "together";
  if (scope === "nearby") return {
    actorId: null, kind: "nearby-moment", route: "/nearby",
    title: together ? "یه هم‌زمانی توی این نزدیکا 💧" : "پشت سر هم، توی این نزدیکا 💧",
    body: together ? "هم‌زمان با تو، یه نفر همین حوالی جیش کرد!" : "یه نفر همین حوالی، تا پنج دقیقه قبل یا بعد از تو جیش کرد.",
  };
  return {
    actorId: peer.id, kind: "friend-moment", route: "/profile",
    title: together ? `تو و ${peer.name} با هم جیش کردین 💧` : `تو و ${peer.name} پشت سر هم جیش کردین 💧`,
    body: together ? "تو فاصلهٔ یک دقیقه، یه خاطرهٔ مشترک ساختین." : "با فاصلهٔ حداکثر پنج دقیقه، یه لحظهٔ مشترک ساختین.",
  };
}

// The cooldown claim and both inbox records commit together. Concurrent/replayed
// check-ins cannot create a second pair of alerts, including across a minute edge.
export async function queueMutualNotice(scope, kind, user, peer, event, db = transaction) {
  const id = randomUUID(), [a, b] = [user.id, peer.id].sort();
  const cooldown = scope === "nearby" ? 30 : 5;
  const first = { ...mutualPayload(scope, kind, peer), dedupe: "mutual:" + id };
  const second = { ...mutualPayload(scope, kind, user), dedupe: "mutual:" + id };
  const results = await db([
    [`INSERT INTO mutual_notices(id,scope,user_a,user_b,matched_at)
      SELECT $1,$2,a.id,b.id,$5::timestamptz FROM users a JOIN users b ON b.id=$4
      WHERE a.id=$3 AND a.registered AND b.registered AND NOT a.banned AND NOT b.banned
      AND (($2='friend' AND EXISTS(SELECT 1 FROM connections c WHERE c.user_a=a.id AND c.user_b=b.id AND c.status='accepted'))
        OR ($2='nearby' AND a.share_location AND b.share_location AND a.location_updated_at>NOW()-INTERVAL '1 hour' AND b.location_updated_at>NOW()-INTERVAL '1 hour'
          AND NOT EXISTS(SELECT 1 FROM connections c WHERE c.user_a=a.id AND c.user_b=b.id AND c.status='accepted')
          AND (SELECT COUNT(*) FROM checkins e WHERE e.id IN($7,$8) AND e.status='done' AND e.visibility='friends' AND e.location_lat IS NOT NULL AND e.location_lng IS NOT NULL)=2))
      ON CONFLICT(scope,user_a,user_b) DO UPDATE SET id=EXCLUDED.id,matched_at=EXCLUDED.matched_at
      WHERE mutual_notices.matched_at<=EXCLUDED.matched_at-$6*INTERVAL '1 minute' RETURNING id`,
      [id, scope, a, b, event.created_at, cooldown, event.id || null, peer.event_id || null]],
    notificationStatement(user.id, { ...first, preferenceActorId:peer.id }, id),
    notificationStatement(peer.id, { ...second, preferenceActorId:user.id }, id),
  ]);
  return [
    ...(results[1][0] ? [{ userId: user.id, notificationId: results[1][0].id, payload: first }] : []),
    ...(results[2][0] ? [{ userId: peer.id, notificationId: results[2][0].id, payload: second }] : []),
  ];
}

export async function nearbyMomentPeers(user, event) {
  if (!nearbyMomentEligible(user, event)) return [];
  const rows = await query(
    `SELECT DISTINCT ON(e.user_id) u.id,e.id AS event_id,e.created_at AS event_at,e.location_lat,e.location_lng
     FROM checkins e JOIN users u ON u.id=e.user_id
     WHERE e.user_id<>$1 AND u.registered AND NOT u.banned AND u.share_location
     AND u.location_updated_at>NOW()-INTERVAL '1 hour' AND e.status='done' AND e.visibility='friends'
     AND e.created_at BETWEEN $2::timestamptz-INTERVAL '5 minutes' AND $2::timestamptz+INTERVAL '5 minutes'
     AND e.location_lat BETWEEN $3-.04 AND $3+.04 AND e.location_lng BETWEEN $4-.05 AND $4+.05
     AND NOT EXISTS(SELECT 1 FROM connections c WHERE c.status='accepted' AND ((c.user_a=$1 AND c.user_b=u.id) OR(c.user_b=$1 AND c.user_a=u.id)))
     ORDER BY e.user_id,e.created_at DESC LIMIT 100`,
    [user.id, event.created_at, event.location_lat, event.location_lng],
  );
  return rows.filter(peer => nearbyMomentKind(event, peer));
}

export async function notifyMutualMoments(user, event, friends, { findNearby = nearbyMomentPeers, queue = queueMutualNotice, deliver = deliverNotification } = {}) {
  let peers = [];
  try { peers = await findNearby(user, event); }
  catch { console.warn("[jishoo-mutual] nearby matching unavailable"); }
  const pairs = [
    ...friends.map(moment => ({ scope: "friend", kind: moment.kind, peer: moment.friend })),
    ...peers.map(peer => ({ scope: "nearby", kind: nearbyMomentKind(event, peer), peer })),
  ];
  const jobs = [];
  for (let start = 0; start < pairs.length; start += 8) {
    const queued = await Promise.allSettled(pairs.slice(start, start + 8).map(pair => queue(pair.scope, pair.kind, user, pair.peer, event)));
    jobs.push(...queued.filter(result => result.status === "fulfilled").flatMap(result => result.value));
    if (queued.some(result => result.status === "rejected")) console.warn("[jishoo-mutual] inbox delivery failed");
  }
  // Commit all inbox records before waiting on device providers. A slow device
  // must not prevent later participants from getting their inbox record.
  await Promise.allSettled(jobs.map(job => deliver(job.userId, job.notificationId, job.payload)));
}
