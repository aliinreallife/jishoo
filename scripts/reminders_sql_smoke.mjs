// Invoked only by the protected-preview API test with its disposable QA IDs.
// Delivery is injected: no web-push provider is contacted.
import assert from "node:assert/strict";
import { query } from "../lib/database.js";
import { claimRemindersSQL, sendCheckinReminders } from "../lib/reminders.js";

const ids = JSON.parse(process.env.JISHOO_QA_IDS || "[]");
assert.equal(ids.length, 4);
assert.ok(ids.every(id => /^[-a-f0-9]{36}$/.test(id)));
const owned = await query(`SELECT u.id FROM users u JOIN auth_identities a ON a.user_id=u.id
  WHERE u.id=ANY($1::text[]) AND u.handle LIKE 'qa_%' AND u.name LIKE 'آزمایش%'
    AND u.role='member' AND a.provider='google' AND a.subject='qa-google-'||u.id`, [ids]);
assert.equal(owned.length, ids.length, "Only disposable, signed QA members are allowed");
const scoped = claimRemindersSQL.replace("WHERE u.registered", "WHERE u.id=ANY($2::text[]) AND u.registered");
try {
  await query(`UPDATE users SET created_at=NOW()-INTERVAL '4 days',notifications_enabled=TRUE,
    reminder_push_enabled=TRUE,reminder_snoozed_until=NULL,reminder_last_sent_at=NULL,reminder_last_attempt_at=NULL
    WHERE id=ANY($1::text[])`, [ids]);
  for (const id of ids) await query(`INSERT INTO push_subscriptions(user_id,endpoint_hash,subscription)
    VALUES($1,$2,'{}') ON CONFLICT DO NOTHING`, [id, "qa-reminder:" + id]);
  await query("UPDATE users SET reminder_snoozed_until=NOW()+INTERVAL '7 days' WHERE id=$1", [ids[1]]);
  await query("UPDATE users SET reminder_last_sent_at=NOW()-INTERVAL '1 day' WHERE id=$1", [ids[2]]);
  await query(`INSERT INTO checkins(id,user_id,status,visibility,client_nonce)
    VALUES(gen_random_uuid()::text,$1,'done','private','qa-reminder-recent')`, [ids[3]]);
  const results = await Promise.all([query(scoped, [25, ids]), query(scoped, [25, ids])]);
  const claims = results.flat();
  assert.equal(claims.length, 1); assert.equal(claims[0].id, ids[0]);
  assert.equal((await query("SELECT id FROM users WHERE id=$1 AND reminder_last_attempt_at=$2", [ids[0], claims[0].attemptAt])).length, 1, "Timestamp precision survives database/client round trip");
  assert.equal((await query(scoped, [25, ids])).length, 0);
  await query("UPDATE users SET reminder_last_attempt_at=NULL WHERE id=$1", [ids[0]]);
  let sent = 0;
  const report = await sendCheckinReminders({ ready: true,
    execute: (sql, params) => sql === claimRemindersSQL ? query(scoped, [...params, ids]) : query(sql, params),
    deliver: async id => { assert.equal(id, ids[0]); sent++; return { accepted: 1 }; },
  });
  assert.equal(report.accepted, 1); assert.equal(sent, 1);
  assert.equal((await query(scoped, [25, ids])).length, 0);
  assert.ok((await query("SELECT reminder_last_sent_at FROM users WHERE id=$1", [ids[0]]))[0].reminder_last_sent_at);
  console.log("PASS: Real SQL atomically claims only eligible QA accounts, avoids duplicate concurrent claims, respects snooze/recent activity/weekly cooldown and persists accepted delivery.");
} finally {
  await query("UPDATE users SET reminder_push_enabled=FALSE WHERE id=ANY($1::text[])", [ids]);
  await query("DELETE FROM push_subscriptions WHERE user_id=ANY($1::text[]) AND endpoint_hash LIKE 'qa-reminder:%'", [ids]);
}
