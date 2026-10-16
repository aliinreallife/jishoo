import { neon } from "@neondatabase/serverless";

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
];
let initialization;
export function initialize() {
  if (!initialization)
    initialization = (async () => {
      await transaction(schema.map((text) => [text]));
      if (process.env.BOOTSTRAP_INVITE_CODE)
        await query(
          "INSERT INTO invites(code) VALUES($1) ON CONFLICT DO NOTHING",
          [process.env.BOOTSTRAP_INVITE_CODE],
        );
    })().catch((error) => {
      initialization = undefined;
      throw error;
    });
  return initialization;
}
