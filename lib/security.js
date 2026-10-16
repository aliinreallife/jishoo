import { scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { query } from "./database.js";
import { hashToken } from "./core.js";
const derive = promisify(scrypt);
export async function verifyAdminPassword(
  password,
  encoded = process.env.ADMIN_PASSWORD_HASH,
) {
  if (
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 200 ||
    !encoded
  )
    return false;
  const [salt, hex] = encoded.split(":");
  if (!/^[a-f0-9]{32}$/.test(salt || "") || !/^[a-f0-9]{128}$/.test(hex || ""))
    return false;
  const actual = await derive(password, salt, 64);
  return timingSafeEqual(actual, Buffer.from(hex, "hex"));
}
export async function authorizeAdminPassword(user, password) {
  const valid = await verifyAdminPassword(password);
  return (
    valid &&
    user.role === "admin" &&
    user.handle === "ali" &&
    user.registered &&
    !user.banned
  );
}
export async function rateLimit(key, limit, seconds) {
  const rows = await query(
    `INSERT INTO rate_limits(key,hits,expires_at) VALUES($1,1,NOW()+$2*INTERVAL '1 second') ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN rate_limits.expires_at<NOW() THEN 1 ELSE rate_limits.hits+1 END,expires_at=CASE WHEN rate_limits.expires_at<NOW() THEN EXCLUDED.expires_at ELSE rate_limits.expires_at END RETURNING hits`,
    [hashToken(key + process.env.APP_SECRET), seconds],
  );
  return rows[0].hits <= limit;
}
