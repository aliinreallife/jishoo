import { createHash, timingSafeEqual } from "node:crypto";
import { initialize } from "../lib/database.js";
import { sendCheckinReminders } from "../lib/reminders.js";

export function authorizedCron(header, secret) {
  if (!secret || typeof header !== "string") return false;
  const hash = value => createHash("sha256").update(value).digest();
  return timingSafeEqual(hash(header), hash(`Bearer ${secret}`));
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({ error: "Method not allowed" }); }
  if (!process.env.CRON_SECRET) return res.status(503).json({ error: "Reminder scheduling is not configured" });
  if (!authorizedCron(req.headers.authorization, process.env.CRON_SECRET)) return res.status(401).json({ error: "Unauthorized" });
  try {
    await initialize();
    const result = await sendCheckinReminders();
    return res.status(200).json({ ok: true, ...result });
  } catch {
    return res.status(500).json({ error: "Reminder delivery could not complete" });
  }
}
