export const REMINDER_INACTIVE_MS = 48 * 60 * 60 * 1000;
export const REMINDER_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export function reminderDue({ registered, createdAt, lastDoneAt, preferences = {} }, now = Date.now()) {
  if (!registered || preferences.inApp === false) return false;
  const last = Date.parse(lastDoneAt || createdAt || "");
  const snoozed = Date.parse(preferences.snoozedUntil || "");
  return Number.isFinite(last) && now - last >= REMINDER_INACTIVE_MS && !(snoozed > now);
}

export function pushReminderDue(user, now = Date.now()) {
  if (!user.registered || user.banned || !user.notificationsEnabled || !user.preferences?.push) return false;
  const last = Date.parse(user.lastDoneAt || user.createdAt || "");
  const snoozed = Date.parse(user.preferences.snoozedUntil || "");
  const sent = Date.parse(user.lastSentAt || "");
  return Number.isFinite(last) && now - last >= REMINDER_INACTIVE_MS && !(snoozed > now)
    && !(Number.isFinite(sent) && now - sent < REMINDER_COOLDOWN_MS);
}
