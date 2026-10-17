import { randomUUID } from "node:crypto";
import { query, transaction } from "./database.js";
import { encryptPhone, decryptPhone } from "./core.js";
import { rateLimit } from "./security.js";

// This proof can only be issued AFTER fresh Google verification in a link flow.
// Demo SMS, email text and client-supplied account IDs are never ownership proofs.
export async function prepareAccountMerge(user, target, identity, sessionHash) {
  if (!user.phone_hash || target.phone_hash || target.role !== "member" || target.banned)
    return false;
  const ownGoogle = await query("SELECT subject FROM auth_identities WHERE user_id=$1", [user.id]);
  if (ownGoogle.length) return false;
  await query(
    `INSERT INTO account_merge_proofs(session_hash,source_id,target_id,google_subject,email_cipher,expires_at)
     VALUES($1,$2,$3,$4,$5,NOW()+INTERVAL '10 minutes') ON CONFLICT(session_hash) DO UPDATE SET
     source_id=EXCLUDED.source_id,target_id=EXCLUDED.target_id,google_subject=EXCLUDED.google_subject,
     email_cipher=EXCLUDED.email_cipher,expires_at=EXCLUDED.expires_at`,
    [sessionHash, user.id, target.id, identity.subject, encryptPhone(identity.email)],
  );
  return true;
}

export async function pendingAccountMerge(user, sessionHash) {
  if (!sessionHash || !user.registered) return null;
  const rows = await query(
    `SELECT p.target_id,p.email_cipher,t.name,t.handle,
      (SELECT COUNT(*)::int FROM checkins WHERE user_id=t.id) AS checkins,
      (SELECT COUNT(*)::int FROM connections WHERE (user_a=t.id OR user_b=t.id) AND status='accepted') AS friends,
      (SELECT COUNT(*)::int FROM circle_members WHERE user_id=t.id AND status='accepted') AS groups
     FROM account_merge_proofs p JOIN users t ON t.id=p.target_id
     JOIN auth_identities a ON a.provider='google' AND a.subject=p.google_subject AND a.user_id=t.id
     WHERE p.session_hash=$1 AND p.source_id=$2 AND p.expires_at>NOW()
       AND t.registered AND NOT t.banned AND t.role='member' AND t.phone_hash IS NULL`,
    [sessionHash, user.id],
  );
  if (!rows[0]) return null;
  const row = rows[0];
  return {
    current: { name: user.name, handle: user.handle },
    other: { name: row.name, handle: row.handle, email: decryptPhone(row.email_cipher) },
    checkins: row.checkins, friends: row.friends, groups: row.groups,
  };
}

export async function cancelAccountMerge(user, sessionHash) {
  await query("DELETE FROM account_merge_proofs WHERE session_hash=$1 AND source_id=$2", [sessionHash, user.id]);
}

export async function confirmAccountMerge(user, sessionHash, confirmed, fail) {
  if (!user.registered || confirmed !== true)
    fail(400, "اول اتصال دو حسابت رو مرور و تایید کن.");
  if (user.role === "admin" && !user.session_admin_access)
    fail(403, "اول ورود خصوصی مدیریت رو کامل کن.");
  if (!(await rateLimit(`merge:${user.id}`, 3, 600)))
    fail(429, "چند دقیقه بعد دوباره امتحان کن.");
  const proof = (await query(
    "SELECT target_id,google_subject FROM account_merge_proofs WHERE session_hash=$1 AND source_id=$2 AND expires_at>NOW()",
    [sessionHash, user.id],
  ))[0];
  if (!proof) fail(409, "تایید گوگل منقضی شده؛ دوباره گوگلت رو وصل کن.", "merge_expired");
  const source = user.id, target = proof.target_id, noncePrefix = `m:${randomUUID()}:`;
  try {
    await transaction([
      ["SELECT id FROM users WHERE id IN($1,$2) ORDER BY id FOR UPDATE", [source, target]],
      ["SELECT token_hash FROM sessions WHERE token_hash=$1 AND user_id=$2 FOR UPDATE", [sessionHash, source]],
      ["SELECT session_hash FROM account_merge_proofs WHERE session_hash=$1 FOR UPDATE", [sessionHash]],
      // A failed guard aborts the entire transaction, including concurrent/replayed requests.
      [`SELECT 1 / (EXISTS(SELECT 1 FROM account_merge_proofs p
        JOIN sessions s ON s.token_hash=p.session_hash AND s.user_id=p.source_id AND s.expires_at>NOW()
        JOIN users a ON a.id=p.source_id JOIN users b ON b.id=p.target_id
        JOIN auth_identities i ON i.provider='google' AND i.subject=p.google_subject AND i.user_id=b.id
        WHERE p.session_hash=$1 AND a.id=$2 AND b.id=$3 AND a.id<>b.id AND p.expires_at>NOW()
          AND a.registered AND b.registered AND NOT a.banned AND NOT b.banned
          AND a.phone_hash IS NOT NULL AND b.phone_hash IS NULL AND b.role='member'
          AND (a.role<>'admin' OR s.admin_access) AND NOT EXISTS(SELECT 1 FROM auth_identities WHERE user_id=a.id)))::int`,
       [sessionHash, source, target]],
      // Keep the current public profile. Preserve the strongest subscription without doubling trials.
      [`UPDATE users a SET lifetime=a.lifetime OR b.lifetime,
        paid_until=GREATEST(a.paid_until,b.paid_until),trial_until=GREATEST(a.trial_until,b.trial_until),
        trial_days_bank=GREATEST(a.trial_days_bank,b.trial_days_bank),
        social_links=b.social_links||a.social_links,avatar_image=COALESCE(a.avatar_image,b.avatar_image),
        notifications_enabled=a.notifications_enabled AND b.notifications_enabled,
        invited_by=CASE WHEN a.invited_by=b.id THEN NULLIF(b.invited_by,a.id) ELSE a.invited_by END,
        created_at=LEAST(a.created_at,b.created_at),share_location=FALSE,discoverable=FALSE,
        location_lat=NULL,location_lng=NULL,location_updated_at=NULL
        FROM users b WHERE a.id=$1 AND b.id=$2`, [source, target]],
      ["UPDATE checkins SET user_id=$1,client_nonce=$3||id,location_lat=NULL,location_lng=NULL WHERE user_id=$2", [source, target, noncePrefix]],
      ["UPDATE checkins SET location_lat=NULL,location_lng=NULL WHERE user_id=$1", [source]],
      ["DELETE FROM pair_moments WHERE (user_a=$1 AND user_b=$2) OR(user_a=$2 AND user_b=$1)", [source, target]],
      [`WITH moved AS(SELECT id,CASE WHEN user_a=$2 THEN $1 ELSE user_a END AS a,
          CASE WHEN user_b=$2 THEN $1 ELSE user_b END AS b,event_a,event_b FROM pair_moments WHERE user_a=$2 OR user_b=$2)
        UPDATE pair_moments p SET user_a=LEAST(m.a,m.b),user_b=GREATEST(m.a,m.b),
          event_a=CASE WHEN m.a<m.b THEN m.event_a ELSE m.event_b END,
          event_b=CASE WHEN m.a<m.b THEN m.event_b ELSE m.event_a END FROM moved m WHERE p.id=m.id`, [source, target]],
      [`WITH moved AS(DELETE FROM connections WHERE user_a=$2 OR user_b=$2 RETURNING *),
        peers AS(SELECT *,CASE WHEN user_a=$2 THEN user_b ELSE user_a END AS peer FROM moved)
        INSERT INTO connections(id,user_a,user_b,requested_by,status,share_a,share_b,created_at)
        SELECT id,LEAST($1,peer),GREATEST($1,peer),CASE WHEN requested_by=$2 THEN $1 ELSE requested_by END,
          status,FALSE,FALSE,created_at FROM peers WHERE peer<>$1
        ON CONFLICT(user_a,user_b) DO UPDATE SET status=CASE WHEN connections.status='accepted' OR EXCLUDED.status='accepted' THEN 'accepted' ELSE connections.status END,
          share_a=FALSE,share_b=FALSE,created_at=LEAST(connections.created_at,EXCLUDED.created_at)`, [source, target]],
      ["UPDATE connections SET share_a=FALSE,share_b=FALSE WHERE user_a=$1 OR user_b=$1", [source]],
      [`WITH moved AS(DELETE FROM circle_members WHERE user_id=$2 RETURNING *)
        INSERT INTO circle_members(circle_id,user_id,status) SELECT circle_id,$1,status FROM moved
        ON CONFLICT(circle_id,user_id) DO UPDATE SET status=CASE WHEN circle_members.status='accepted' OR EXCLUDED.status='accepted' THEN 'accepted' ELSE circle_members.status END`, [source, target]],
      ["UPDATE circles SET owner_id=$1 WHERE owner_id=$2", [source, target]],
      ["DELETE FROM circle_members WHERE user_id=$1 AND circle_id IN(SELECT id FROM circles WHERE owner_id=$1)", [source]],
      [`INSERT INTO achievements(user_id,slug,level,progress,updated_at) SELECT $1,slug,level,progress,updated_at FROM achievements WHERE user_id=$2
        ON CONFLICT(user_id,slug) DO UPDATE SET level=GREATEST(achievements.level,EXCLUDED.level),progress=GREATEST(achievements.progress,EXCLUDED.progress)`, [source, target]],
      ["DELETE FROM achievements WHERE user_id=$1", [target]],
      [`WITH moved AS(DELETE FROM notification_preferences WHERE user_id=$2 RETURNING *)
        INSERT INTO notification_preferences(user_id,scope,scope_id,enabled) SELECT $1,scope,scope_id,enabled FROM moved
        WHERE scope<>'friend' OR scope_id NOT IN($1,$2) ON CONFLICT(user_id,scope,scope_id)
        DO UPDATE SET enabled=notification_preferences.enabled AND EXCLUDED.enabled`, [source, target]],
      [`WITH moved AS(DELETE FROM notification_preferences WHERE scope='friend' AND scope_id=$2 RETURNING *)
        INSERT INTO notification_preferences(user_id,scope,scope_id,enabled) SELECT user_id,scope,$1,enabled FROM moved WHERE user_id<>$1
        ON CONFLICT(user_id,scope,scope_id) DO UPDATE SET enabled=notification_preferences.enabled AND EXCLUDED.enabled`, [source, target]],
      [`WITH moved AS(DELETE FROM notifications WHERE user_id=$2 RETURNING *)
        INSERT INTO notifications(id,user_id,actor_id,kind,title,body,route,dedupe,read_at,created_at)
        SELECT id,$1,actor_id,kind,title,body,route,dedupe,read_at,created_at FROM moved
        ON CONFLICT(user_id,dedupe) DO UPDATE SET read_at=COALESCE(notifications.read_at,EXCLUDED.read_at)`, [source, target]],
      ["UPDATE notifications SET actor_id=$1 WHERE actor_id=$2", [source, target]],
      ["UPDATE users SET invited_by=$1 WHERE invited_by=$2 AND id NOT IN($1,$2)", [source, target]],
      [`UPDATE invites i SET uses=i.uses+COALESCE((SELECT SUM(uses)::int FROM invites WHERE inviter_id=$2),0)
        WHERE code=(SELECT invite_code FROM users WHERE id=$1 AND role<>'admin')`, [source, target]],
      ["UPDATE invites SET inviter_id=$1,active=FALSE WHERE inviter_id=$2", [source, target]],
      ["UPDATE support_requests SET user_id=$1 WHERE user_id=$2", [source, target]],
      ["UPDATE admin_audit SET actor_id=$1 WHERE actor_id=$2", [source, target]],
      ["UPDATE auth_identities SET user_id=$1,email_cipher=p.email_cipher FROM account_merge_proofs p WHERE provider='google' AND subject=p.google_subject AND auth_identities.user_id=$2 AND p.session_hash=$3", [source, target, sessionHash]],
      ["DELETE FROM push_subscriptions WHERE user_id IN($1,$2)", [source, target]],
      ["DELETE FROM admin_access_links WHERE user_id IN($1,$2)", [source, target]],
      ["DELETE FROM auth_challenges WHERE user_id IN($1,$2)", [source, target]],
      ["DELETE FROM oauth_states WHERE user_id IN($1,$2)", [source, target]],
      ["DELETE FROM pending_google WHERE session_hash=$1", [sessionHash]],
      ["DELETE FROM sessions WHERE user_id IN($1,$2) AND token_hash<>$3", [source, target, sessionHash]],
      ["UPDATE sessions SET admin_access=FALSE WHERE token_hash=$1", [sessionHash]],
      ["DELETE FROM account_merge_proofs WHERE source_id IN($1,$2) OR target_id IN($1,$2)", [source, target]],
      // Retain only a non-login handle alias, so old profile links keep working and cannot be claimed.
      [`UPDATE users SET registered=FALSE,banned=TRUE,merged_into=$1,name='حساب پیوندشده',avatar_seed='merged:'||id,
        avatar_image=NULL,phone_hash=NULL,phone_cipher=NULL,invite_code=NULL,invited_by=NULL,joined_invite_code=NULL,
        lifetime=FALSE,trial_until=NULL,paid_until=NULL,trial_days_bank=0,social_links='{}',
        share_location=FALSE,discoverable=FALSE,location_lat=NULL,location_lng=NULL,location_updated_at=NULL,
        notifications_enabled=FALSE,terms_version=NULL,terms_accepted_at=NULL WHERE id=$2`, [source, target]],
      ["INSERT INTO admin_audit(id,actor_id,action,target_id) VALUES($1,$2,'account-merge',$3)", [randomUUID(), source, target]],
    ]);
  } catch (error) {
    if (error.code === "22012") fail(409, "وضعیت حساب‌ها تغییر کرده؛ دوباره گوگلت رو تایید کن.", "merge_expired");
    throw error;
  }
  return (await query("SELECT * FROM users WHERE id=$1", [source]))[0];
}
