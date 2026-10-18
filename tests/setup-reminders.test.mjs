import test from "node:test";
import assert from "node:assert/strict";
import { socialProfile, cleanSocialLinks, socialFieldError } from "../lib/social-links.js";
import { reminderDue, pushReminderDue, REMINDER_INACTIVE_MS, REMINDER_COOLDOWN_MS } from "../src/reminder-policy.js";
import { sendCheckinReminders, reminderPreferences } from "../lib/reminders.js";
import reminders, { authorizedCron } from "../api/reminders.js";
import { storyWebsite } from "../src/story-branding.js";

test("social IDs and profile URLs become canonical HTTPS links without tracking", () => {
  assert.deepEqual(cleanSocialLinks({
    instagram: " @Ali.InRealLife ", telegram: "telegram.me/AliInRealLife/",
    x: "http://www.twitter.com/AliInRealLife_?s=21#bio", website: "example.org/about?lang=fa#contact",
  }), {
    instagram: "https://www.instagram.com/Ali.InRealLife", telegram: "https://t.me/AliInRealLife",
    x: "https://x.com/AliInRealLife_", website: "https://example.org/about?lang=fa#contact",
  });
  assert.equal(socialProfile("x", "@abc").handle, "abc");
  assert.equal(socialProfile("instagram", "https://instagram.com/%61li/").handle, "ali");
  assert.equal(socialFieldError("telegram", ""), "");
});

test("wrong platforms, posts, invitations and malformed social IDs cannot be saved", () => {
  for (const [kind, values] of Object.entries({
    instagram: [".ali", "ali.", "ali..a", "a".repeat(31), "ali-name", "stories", "https://instagram.com/p/ABC", "https://instagram.com/ali/posts", "https://x.com/ali", "https://instagram.com.evil.org/ali", "https://instagram.com:8443/ali"],
    telegram: ["12abc", "abc", "+abcd", "https://t.me/+abcdef", "https://t.me/joinchat/abc", "t.me/share", "t.me/ali/123"],
    x: ["a".repeat(16), "ali.a", "ali-a", "home", "x.com/ali/status/123", "x.com/intent", "https://twitter.com.evil.org/ali"],
  })) for (const value of values) {
    assert.throws(() => socialProfile(kind, value), undefined, `${kind}: ${value}`);
    assert.ok(socialFieldError(kind, value), `${kind}: inline error`);
  }
  for (const kind of ["instagram", "telegram", "x", "website"]) {
    for (const value of ["javascript:alert(1)", "data:text/html,x", "https://user:pass@example.org/ali", "al i", "ali\\name", "a\nli", "x".repeat(301)]) assert.throws(() => socialProfile(kind, value));
  }
  for (const value of ["localhost", "https://localhost/a", "https://127.0.0.1", "http://2130706433", "https://[::1]", "https://foo.local", "https://foo.internal", "https://example.org."]) assert.throws(() => socialProfile("website", value));
  assert.throws(() => cleanSocialLinks([]));
  assert.throws(() => cleanSocialLinks({ x: { url: "https://x.com/ali" } }));
});

test("inactivity uses completed check-ins, waits 48 hours and respects personal snooze/opt-out", () => {
  const now = Date.parse("2026-10-18T12:00:00Z"), old = new Date(now - REMINDER_INACTIVE_MS).toISOString();
  const user = { registered: true, createdAt: old, preferences: {} };
  assert.equal(reminderDue(user, now - 1), false);
  assert.equal(reminderDue(user, now), true);
  assert.equal(reminderDue({ ...user, lastDoneAt: new Date(now - 1000).toISOString() }, now), false);
  assert.equal(reminderDue({ ...user, registered: false }, now), false);
  assert.equal(reminderDue({ ...user, createdAt: "invalid" }, now), false);
  assert.equal(reminderDue({ ...user, preferences: { inApp: false } }, now), false);
  assert.equal(reminderDue({ ...user, preferences: { snoozedUntil: new Date(now + 1).toISOString() } }, now), false);
  assert.equal(reminderDue({ ...user, preferences: { snoozedUntil: new Date(now).toISOString() } }, now), true);
});

test("personal pushes require explicit opt-in and master permission, independent of inline cards", () => {
  const now = Date.now(), user = { registered: true, notificationsEnabled: true, createdAt: new Date(now - 3 * 864e5).toISOString(), preferences: { push: true, inApp: false } };
  assert.equal(pushReminderDue(user, now), true);
  for (const change of [{ registered: false }, { banned: true }, { notificationsEnabled: false }, { preferences: {} }, { preferences: { push: false } }, { lastDoneAt: new Date(now).toISOString() }, { lastSentAt: new Date(now - REMINDER_COOLDOWN_MS + 1).toISOString() }]) assert.equal(pushReminderDue({ ...user, ...change }, now), false);
  assert.equal(pushReminderDue({ ...user, lastSentAt: new Date(now - REMINDER_COOLDOWN_MS).toISOString() }, now), true);
  assert.deepEqual(reminderPreferences({}), { inApp: true, push: false, snoozedUntil: null });
});

test("scheduler rechecks consent, sends normal-urgency pushes, records only accepted deliveries and isolates errors", async () => {
  const claims = Array.from({ length: 13 }, (_, n) => ({ id: `qa-${n}`, attemptAt: "2026-10-18T12:00:00.123Z" }));
  const sent = [], marked = []; let active = 0, peak = 0;
  const result = await sendCheckinReminders({ ready: true,
    execute: async (sql, params) => {
      if (sql.startsWith("WITH due")) { assert.deepEqual(params, [25]); return claims; }
      if (sql.startsWith("SELECT id")) return params[0] === "qa-0" ? [] : [{ id: params[0] }];
      if (sql.startsWith("SELECT endpoint")) return [{ endpoint_hash: params[0], subscription: {} }];
      assert.ok(sql.startsWith("UPDATE users SET reminder_last_sent_at")); marked.push(params[0]); return [];
    },
    deliver: async (id, subscriptions, payload, send, options) => {
      assert.equal(send, undefined); assert.deepEqual(options, { urgency: "normal", ttl: 3600 });
      assert.equal(subscriptions.length, 1); assert.equal(payload.url, "/home?reminder=checkin");
      sent.push(id); active++; peak = Math.max(peak, active);
      await new Promise(resolve => setImmediate(resolve)); active--;
      if (id === "qa-1") throw Error("provider unavailable");
      return { accepted: id === "qa-2" ? 0 : 1 };
    },
  });
  assert.deepEqual(result, { claimed: 13, accepted: 10, skipped: 1, failed: 2 });
  assert.ok(peak <= 5 && peak > 1); assert.ok(!sent.includes("qa-0"));
  assert.equal(marked.length, 10); assert.ok(!marked.includes("qa-1") && !marked.includes("qa-2"));
  assert.deepEqual(await sendCheckinReminders({ ready: false, execute: () => { throw Error("should not claim"); } }), { claimed: 0, accepted: 0, skipped: 0, failed: 0 });
});

test("cron rejects absent/wrong credentials and non-GET requests before accessing the database", async () => {
  assert.equal(authorizedCron("Bearer correct", "correct"), true);
  for (const header of [undefined, "", "correct", "Bearer wrong", "Bearer correct "]) assert.equal(authorizedCron(header, "correct"), false);
  assert.equal(authorizedCron("Bearer ", ""), false);
  const original = process.env.CRON_SECRET;
  try {
    process.env.CRON_SECRET = "test-only-cron-secret";
    for (const [method, expected] of [["GET", 401], ["POST", 405]]) {
      const headers = {}, res = { setHeader: (key, value) => { headers[key] = value; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
      await reminders({ method, headers: {} }, res);
      assert.equal(res.code, expected); assert.equal(headers["Cache-Control"], "no-store");
    }
  } finally { if (original === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = original; }
});

test("story domain follows the configured public origin and is always lowercase", () => {
  assert.equal(storyWebsite("https://JISHOO.EXAMPLE/hello?invite=private#x", "https://preview.example"), "jishoo.example");
  assert.equal(storyWebsite(undefined, "https://jishoo.vercel.app"), "jishoo.vercel.app");
  assert.equal(storyWebsite("javascript:alert(1)", "http://localhost:4173"), "localhost:4173");
  assert.equal(storyWebsite("https://user:secret@example.org", "https://app.example.org"), "app.example.org");
  assert.equal(storyWebsite("invalid", "invalid"), "jishoo");
});
