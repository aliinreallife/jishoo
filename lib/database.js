import { neon } from "@neondatabase/serverless";
import { createHash } from "node:crypto";

let client;
export function sql() {
  if (!process.env.DATABASE_URL) throw new Error("Database is not configured");
  return (client ||= neon(process.env.DATABASE_URL));
}
export const query = (text, params = []) => sql().query(text, params);
export const transaction = (statements) =>
  sql().transaction(
    statements.map(([text, params = []]) => sql().query(text, params)),
  );

const schema = [
  `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, registered BOOLEAN NOT NULL DEFAULT FALSE, name TEXT NOT NULL DEFAULT 'مهمان', avatar_seed TEXT NOT NULL, phone_hash TEXT UNIQUE, phone_cipher TEXT, invite_code TEXT UNIQUE, invited_by TEXT REFERENCES users(id), trial_until TIMESTAMPTZ, paid_until TIMESTAMPTZ, social_links JSONB NOT NULL DEFAULT '{}', share_location BOOLEAN NOT NULL DEFAULT FALSE, location_lat DOUBLE PRECISION, location_lng DOUBLE PRECISION, location_updated_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_days_bank INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_image TEXT`,
  `CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS invites (code TEXT PRIMARY KEY, inviter_id TEXT REFERENCES users(id), active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS auth_challenges (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), phone_hash TEXT NOT NULL, phone_cipher TEXT NOT NULL, verified_at TIMESTAMPTZ, consumed_at TIMESTAMPTZ, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS connections (id TEXT PRIMARY KEY, user_a TEXT NOT NULL REFERENCES users(id), user_b TEXT NOT NULL REFERENCES users(id), requested_by TEXT NOT NULL REFERENCES users(id), status TEXT NOT NULL DEFAULT 'pending', share_a BOOLEAN NOT NULL DEFAULT FALSE, share_b BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(user_a, user_b), CHECK(user_a < user_b))`,
  `CREATE TABLE IF NOT EXISTS checkins (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), status TEXT NOT NULL CHECK(status IN ('need','done')), visibility TEXT NOT NULL CHECK(visibility IN ('private','friends')), client_nonce TEXT NOT NULL, location_lat DOUBLE PRECISION, location_lng DOUBLE PRECISION, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(user_id, client_nonce))`,
  `CREATE INDEX IF NOT EXISTS checkins_recent ON checkins (created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS checkins_user ON checkins (user_id, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS pair_moments (id TEXT PRIMARY KEY, user_a TEXT NOT NULL REFERENCES users(id), user_b TEXT NOT NULL REFERENCES users(id), event_a TEXT NOT NULL REFERENCES checkins(id), event_b TEXT NOT NULL REFERENCES checkins(id), kind TEXT NOT NULL CHECK(kind IN ('together','back-to-back')), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(event_a, event_b))`,
  `CREATE TABLE IF NOT EXISTS circles (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS circle_members (circle_id TEXT NOT NULL REFERENCES circles(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id), PRIMARY KEY(circle_id,user_id))`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member', ADD COLUMN IF NOT EXISTS handle TEXT, ADD COLUMN IF NOT EXISTS lifetime BOOLEAN NOT NULL DEFAULT FALSE, ADD COLUMN IF NOT EXISTS banned BOOLEAN NOT NULL DEFAULT FALSE, ADD COLUMN IF NOT EXISTS discoverable BOOLEAN NOT NULL DEFAULT FALSE, ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE`,
  `CREATE UNIQUE INDEX IF NOT EXISTS users_handle ON users(LOWER(handle)) WHERE handle IS NOT NULL`,
  `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS admin_access BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE invites ADD COLUMN IF NOT EXISTS max_uses INTEGER, ADD COLUMN IF NOT EXISTS uses INTEGER NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS grant_admin BOOLEAN NOT NULL DEFAULT FALSE, ADD COLUMN IF NOT EXISTS reserved_handle TEXT`,
  `ALTER TABLE invites ADD COLUMN IF NOT EXISTS premium_days INTEGER NOT NULL DEFAULT 0 CHECK(premium_days BETWEEN 0 AND 3650), ADD COLUMN IF NOT EXISTS premium_lifetime BOOLEAN NOT NULL DEFAULT FALSE`,
  `UPDATE invites i SET max_uses=CASE WHEN u.role='admin' THEN 1 WHEN ${process.env.TESTING_MODE === "true" ? "TRUE" : "FALSE"} THEN 3 ELSE NULL END,uses=CASE WHEN u.role='admin' THEN i.uses ELSE GREATEST(i.uses,(SELECT COUNT(*)::int FROM users r WHERE r.invited_by=u.id)) END FROM users u WHERE u.invite_code=i.code`,
  `CREATE TABLE IF NOT EXISTS achievements(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,slug TEXT NOT NULL,level INTEGER NOT NULL DEFAULT 0,progress INTEGER NOT NULL DEFAULT 0,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(user_id,slug))`,
  `CREATE TABLE IF NOT EXISTS notification_preferences(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,scope TEXT NOT NULL,scope_id TEXT NOT NULL,enabled BOOLEAN NOT NULL DEFAULT TRUE,PRIMARY KEY(user_id,scope,scope_id))`,
  `CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,kind TEXT NOT NULL,title TEXT NOT NULL,body TEXT NOT NULL,route TEXT NOT NULL DEFAULT '/home',dedupe TEXT NOT NULL,read_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(user_id,dedupe))`,
  `CREATE TABLE IF NOT EXISTS push_subscriptions(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,endpoint_hash TEXT NOT NULL,subscription JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(user_id,endpoint_hash))`,
  `CREATE TABLE IF NOT EXISTS admin_access_links(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at TIMESTAMPTZ NOT NULL,consumed_at TIMESTAMPTZ)`,
  `CREATE TABLE IF NOT EXISTS admin_audit(id TEXT PRIMARY KEY,actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,action TEXT NOT NULL,target_id TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS setup_nonces(nonce TEXT PRIMARY KEY,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
  `ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS last_success_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS last_error TEXT`,
  `DELETE FROM push_subscriptions a USING push_subscriptions b WHERE a.endpoint_hash=b.endpoint_hash AND (a.created_at,a.user_id)<(b.created_at,b.user_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS push_endpoint_owner ON push_subscriptions(endpoint_hash)`,
  `CREATE INDEX IF NOT EXISTS notifications_user_recent ON notifications(user_id,created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS connections_a ON connections(user_a,status)`,
  `CREATE INDEX IF NOT EXISTS connections_b ON connections(user_b,status)`,
  `CREATE INDEX IF NOT EXISTS users_invited_by ON users(invited_by) WHERE registered`,
  `CREATE INDEX IF NOT EXISTS users_invitation_order ON users(created_at,id) WHERE registered`,
  `CREATE INDEX IF NOT EXISTS auth_challenges_user_recent ON auth_challenges(user_id,created_at DESC)`,
  `ALTER TABLE circles ADD COLUMN IF NOT EXISTS shared BOOLEAN NOT NULL DEFAULT FALSE, ADD COLUMN IF NOT EXISTS join_code TEXT UNIQUE`,
  `ALTER TABLE circle_members ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'accepted'`,
  `CREATE INDEX IF NOT EXISTS circle_members_user ON circle_members(user_id,status)`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_version TEXT, ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ`,
  `CREATE TABLE IF NOT EXISTS auth_identities(provider TEXT NOT NULL,subject TEXT NOT NULL,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,email_cipher TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(provider,subject),UNIQUE(user_id,provider))`,
  `CREATE TABLE IF NOT EXISTS oauth_states(state_hash TEXT PRIMARY KEY,session_hash TEXT NOT NULL REFERENCES sessions(token_hash) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,intent TEXT NOT NULL,nonce_hash TEXT NOT NULL,verifier TEXT NOT NULL,return_path TEXT NOT NULL,expires_at TIMESTAMPTZ NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS pending_google(session_hash TEXT PRIMARY KEY REFERENCES sessions(token_hash) ON DELETE CASCADE,subject TEXT NOT NULL,email_cipher TEXT NOT NULL,expires_at TIMESTAMPTZ NOT NULL)`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS merged_into TEXT REFERENCES users(id) ON DELETE CASCADE`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS joined_invite_code TEXT`,
  `CREATE TABLE IF NOT EXISTS account_merge_proofs(session_hash TEXT PRIMARY KEY REFERENCES sessions(token_hash) ON DELETE CASCADE,source_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,target_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,google_subject TEXT NOT NULL,email_cipher TEXT NOT NULL,expires_at TIMESTAMPTZ NOT NULL)`,
  `ALTER TABLE auth_challenges ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'login'`,
  `CREATE TABLE IF NOT EXISTS support_requests(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id) ON DELETE SET NULL,message TEXT NOT NULL,contact TEXT NOT NULL DEFAULT '',resolved BOOLEAN NOT NULL DEFAULT FALSE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS rate_limits(key TEXT PRIMARY KEY,hits INTEGER NOT NULL,expires_at TIMESTAMPTZ NOT NULL)`,
];
let initialization;
export function initialize() {
  if (!initialization)
    initialization = (async () => {
      // A cold function checks one small version record instead of replaying
      // every DDL statement and updating every invitation on every cold start.
      const version = createHash("sha256")
        .update(schema.join("\n") + process.env.TESTING_MODE)
        .digest("hex");
      await query(
        "CREATE TABLE IF NOT EXISTS app_migrations(version TEXT PRIMARY KEY,applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())",
      );
      const applied = await query(
        "SELECT version FROM app_migrations WHERE version=$1",
        [version],
      );
      if (applied[0]) return;
      await transaction([
        ["SELECT pg_advisory_xact_lock(177360191)"],
        ...schema.map((text) => [text]),
      ]);
      if (process.env.TESTING_MODE === "true")
        await query(
          "UPDATE users SET trial_days_bank=trial_days_bank+GREATEST(0,CEIL(EXTRACT(EPOCH FROM(trial_until-NOW()))/86400)::int),trial_until=NULL WHERE registered AND trial_until IS NOT NULL",
        );
      if (process.env.BOOTSTRAP_INVITE_CODE)
        await query(
          "INSERT INTO invites(code) VALUES($1) ON CONFLICT DO NOTHING",
          [process.env.BOOTSTRAP_INVITE_CODE],
        );
      await query(
        "INSERT INTO app_migrations(version) VALUES($1) ON CONFLICT DO NOTHING",
        [version],
      );
    })().catch((error) => {
      initialization = undefined;
      throw error;
    });
  return initialization;
}
