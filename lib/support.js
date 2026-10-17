import { randomUUID } from "node:crypto";
import { query } from "./database.js";
import { rateLimit } from "./security.js";
export async function supportAction({ action, body, user, req, fail }) {
  if (
    ![
      "support-send",
      "admin-support",
      "admin-support-resolve",
      "admin-support-delete",
    ].includes(action)
  )
    return undefined;
  if (action === "support-send") {
    if (req.method !== "POST") fail(405, "درخواست معتبر نیست.");
    const message = String(body.message || "").trim(),
      contact = String(body.contact || "").trim();
    if (message.length < 10 || message.length > 3000 || contact.length > 254)
      fail(400, "پیامت رو بین ۱۰ تا ۳۰۰۰ حرف بنویس.");
    if (!(await rateLimit("support:" + user.id, 3, 3600)))
      fail(429, "پیام‌های قبلیت رسیده؛ کمی بعد دوباره امتحان کن.");
    const id = randomUUID();
    await query(
      "INSERT INTO support_requests(id,user_id,message,contact) VALUES($1,$2,$3,$4)",
      [id, user.id, message, contact],
    );
    return { reference: id.slice(0, 8) };
  }
  if (!user.registered || user.role !== "admin" || !user.session_admin_access)
    fail(403, "این بخش برای مدیریت فعاله.");
  if (action === "admin-support-delete") {
    if (req.method !== "POST") fail(405, "درخواست معتبر نیست.");
    await query("DELETE FROM support_requests WHERE id=$1", [body.id]);
    return { ok: true };
  }
  if (action === "admin-support-resolve") {
    if (req.method !== "POST" || typeof body.resolved !== "boolean")
      fail(400, "درخواست معتبر نیست.");
    await query("UPDATE support_requests SET resolved=$2 WHERE id=$1", [
      body.id,
      body.resolved,
    ]);
    return { ok: true };
  }
  return {
    requests: await query(
      "SELECT s.id,s.message,s.contact,s.resolved,s.created_at,u.name,u.handle FROM support_requests s LEFT JOIN users u ON u.id=s.user_id ORDER BY s.resolved,s.created_at DESC LIMIT 100",
    ),
  };
}
