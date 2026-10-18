import { query } from "./database.js";
import { normalizePhone, phoneHash, encryptPhone, decryptPhone } from "./core.js";
import { rateLimit } from "./security.js";

export async function joinWaitlist(user, sessionHash, body, fail) {
  if (user.registered) fail(409, "تو از قبل عضو جیشویی.");
  if (body.consent !== true) fail(400, "برای اطلاع‌رسانی دعوت، تاییدت لازمه.");
  if (!(await rateLimit("waitlist:" + user.id, 5, 600))) fail(429, "کمی بعد دوباره امتحان کن.");
  let phone = null;
  if (body.phone != null && (typeof body.phone !== "string" || body.phone.length > 40)) fail(400, "شماره موبایل معتبر وارد کن.");
  if (body.phone?.trim()) {
    try { phone = normalizePhone(body.phone); }
    catch (error) { fail(400, error.message); }
  }
  // Only Google's verified, browser-bound identity supplies the email/subject.
  // A contact number is never a phone ownership proof or a login credential.
  const rows = await query(`INSERT INTO invitation_waitlist(google_subject,user_id,email_cipher,phone_hash,phone_cipher)
    SELECT subject,$2,email_cipher,$3,$4 FROM pending_google WHERE session_hash=$1 AND expires_at>NOW()
    ON CONFLICT(google_subject) DO UPDATE SET user_id=EXCLUDED.user_id,email_cipher=EXCLUDED.email_cipher,
    phone_hash=COALESCE(EXCLUDED.phone_hash,invitation_waitlist.phone_hash),phone_cipher=COALESCE(EXCLUDED.phone_cipher,invitation_waitlist.phone_cipher),updated_at=NOW()
    RETURNING phone_cipher`, [sessionHash, user.id, phone ? phoneHash(phone) : null, phone ? encryptPhone(phone) : null]);
  if (!rows[0]) fail(401, "برای فهرست انتظار، دوباره با گوگل ادامه بده.", "google_expired");
  return { joined: true, phone: rows[0].phone_cipher ? decryptPhone(rows[0].phone_cipher) : null };
}

export async function adminWaitlist(offset = 0) {
  const [rows, count] = await Promise.all([
    query("SELECT email_cipher,phone_cipher,created_at FROM invitation_waitlist ORDER BY created_at LIMIT 50 OFFSET $1", [offset]),
    query("SELECT COUNT(*)::int AS n FROM invitation_waitlist"),
  ]);
  return { total: count[0].n, offset, hasMore: offset + rows.length < count[0].n, people: rows.map(row => ({ email: decryptPhone(row.email_cipher), phone: row.phone_cipher ? decryptPhone(row.phone_cipher) : null, createdAt: row.created_at })) };
}
