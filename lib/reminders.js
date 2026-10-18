import { query } from "./database.js";
import { deliverToDevices, pushReady } from "./notifications.js";

export function reminderPreferences(user) {
  return { inApp: user.reminder_in_app_enabled !== false, push: Boolean(user.reminder_push_enabled), snoozedUntil: user.reminder_snoozed_until || null };
}

export async function saveReminderPreferences(userId, body) {
  const has = key => Object.hasOwn(body, key);
  if (!["inApp", "push", "snoozeDays"].some(has)
      || ["inApp", "push"].some(key => has(key) && typeof body[key] !== "boolean")
      || (has("snoozeDays") && ![0, 7].includes(body.snoozeDays)))
    throw new Error("انتخاب یادآوری معتبر نیست.");
  const rows = await query(`UPDATE users SET
    reminder_in_app_enabled=COALESCE($2,reminder_in_app_enabled),
    reminder_push_enabled=COALESCE($3,reminder_push_enabled),
    reminder_snoozed_until=CASE WHEN $4::int=0 THEN NULL WHEN $4::int=7 THEN NOW()+INTERVAL '7 days' ELSE reminder_snoozed_until END
    WHERE id=$1 RETURNING *`, [userId, has("inApp") ? body.inApp : null, has("push") ? body.push : null, has("snoozeDays") ? body.snoozeDays : null]);
  return reminderPreferences(rows[0]);
}

// Claim attempts atomically. A failed delivery may retry the next day; accepted
// deliveries are limited to once a week. SKIP LOCKED prevents overlapping cron
// invocations from selecting the same account.
export const claimRemindersSQL = `WITH due AS (
  SELECT u.id FROM users u
  WHERE u.registered AND NOT u.banned AND u.notifications_enabled AND u.reminder_push_enabled
    AND (u.reminder_snoozed_until IS NULL OR u.reminder_snoozed_until<=NOW())
    AND (u.reminder_last_sent_at IS NULL OR u.reminder_last_sent_at<=NOW()-INTERVAL '7 days')
    AND (u.reminder_last_attempt_at IS NULL OR u.reminder_last_attempt_at<=NOW()-INTERVAL '24 hours')
    AND COALESCE((SELECT MAX(c.created_at) FROM checkins c WHERE c.user_id=u.id AND c.status='done'),u.created_at)<=NOW()-INTERVAL '48 hours'
    AND EXISTS(SELECT 1 FROM push_subscriptions p WHERE p.user_id=u.id)
  ORDER BY u.reminder_last_attempt_at NULLS FIRST,u.id LIMIT $1 FOR UPDATE OF u SKIP LOCKED
) UPDATE users u SET reminder_last_attempt_at=DATE_TRUNC('milliseconds',NOW()) FROM due WHERE u.id=due.id
  RETURNING u.id,u.reminder_last_attempt_at AS "attemptAt"`;

export async function sendCheckinReminders({ execute = query, deliver = deliverToDevices, ready = pushReady() } = {}) {
  if (!ready) return { claimed: 0, accepted: 0, skipped: 0, failed: 0 };
  const claims = await execute(claimRemindersSQL, [25]);
  const result = { claimed: claims.length, accepted: 0, skipped: 0, failed: 0 };
  async function send(claim) {
    try {
      // Recheck opt-out/snooze and recent activity immediately before delivery.
      const allowed = await execute(`SELECT id FROM users u WHERE id=$1 AND registered AND NOT banned
        AND notifications_enabled AND reminder_push_enabled AND reminder_last_attempt_at=$2
        AND (reminder_snoozed_until IS NULL OR reminder_snoozed_until<=NOW())
        AND COALESCE((SELECT MAX(c.created_at) FROM checkins c WHERE c.user_id=u.id AND c.status='done'),u.created_at)<=NOW()-INTERVAL '48 hours'`, [claim.id, claim.attemptAt]);
      if (!allowed.length) { result.skipped++; return; }
      const subscriptions = await execute("SELECT endpoint_hash,subscription FROM push_subscriptions WHERE user_id=$1", [claim.id]);
      const delivery = await deliver(claim.id, subscriptions, {
        title: "یه سر به جیشو بزن 💧", body: "چندروزه اینجا ثبت نداشتی. اگه دلت خواست، یه جیش فقط برای خودت ثبت کن.",
        url: "/home?reminder=checkin", tag: "jishoo-checkin-reminder",
      }, undefined, { urgency: "normal", ttl: 3600 });
      if (delivery.accepted) {
        await execute("UPDATE users SET reminder_last_sent_at=$2 WHERE id=$1 AND reminder_last_attempt_at=$2", [claim.id, claim.attemptAt]);
        result.accepted++;
      } else result.failed++;
    } catch { result.failed++; }
  }
  // Bound simultaneous provider calls and database work on small deployments.
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(5, claims.length) }, async () => {
    while (next < claims.length) await send(claims[next++]);
  }));
  return result;
}
