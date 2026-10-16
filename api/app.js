import { randomUUID } from "node:crypto";
import { query, transaction, initialize } from "../lib/database.js";
import {
  testingMode,
  inviteOnly,
  hashToken,
  randomToken,
  inviteCode,
  normalizeCode,
  normalizeName,
  normalizePhone,
  phoneHash,
  encryptPhone,
  premium,
  pairKind,
  approximateLocation,
  distanceKm,
  cleanSocialLinks,
} from "../lib/core.js";

class AppError extends Error {
  constructor(status, message, code = "invalid_request") {
    super(message);
    this.status = status;
    this.code = code;
  }
}
const fail = (status, message, code) => {
  throw new AppError(status, message, code);
};
const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
};
function cookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || "")
      .split(";")
      .map((x) => x.trim().split("="))
      .filter((x) => x.length === 2),
  );
}
function setSessionCookie(req, res, token) {
  const secure =
    process.env.VERCEL || req.headers["x-forwarded-proto"] === "https";
  res.setHeader(
    "Set-Cookie",
    `jishoo_session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=7776000${secure ? "; Secure" : ""}`,
  );
}
async function session(req, res) {
  let token = cookies(req).jishoo_session;
  if (token) {
    const rows = await query(
      "SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>NOW()",
      [hashToken(token)],
    );
    if (rows[0]) {
      let user = rows[0];
      if (!testingMode() && user.trial_days_bank > 0) {
        const active = await query(
          `UPDATE users SET trial_until=GREATEST(COALESCE(trial_until,NOW()),COALESCE(paid_until,NOW()),NOW())+trial_days_bank*INTERVAL '1 day',trial_days_bank=0 WHERE id=$1 AND trial_days_bank>0 RETURNING *`,
          [user.id],
        );
        user = active[0] || user;
      }
      return { user, tokenHash: hashToken(token) };
    }
  }
  token = randomToken();
  const id = randomUUID();
  const result = await transaction([
    [
      `INSERT INTO users(id,avatar_seed) VALUES($1,$2) RETURNING *`,
      [id, "guest:" + id],
    ],
    [
      `INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '90 days')`,
      [hashToken(token), id],
    ],
  ]);
  setSessionCookie(req, res, token);
  return { user: result[0][0], tokenHash: hashToken(token) };
}
function requireAccount(user) {
  if (!user.registered)
    fail(
      401,
      "این بخش برای دوست‌های عضو جیشوئه. با دعوت وارد شو.",
      "account_required",
    );
}
function requirePremium(user) {
  if (!premium(user))
    fail(
      403,
      "این قابلیت برای پرمیومه؛ جیش و آمار و استوری معمولی همیشه رایگانه.",
      "premium_required",
    );
}
function profile(user, own = false) {
  const p = {
    id: user.id,
    name: user.name,
    avatarSeed: user.avatar_seed,
    registered: user.registered,
    premium: premium(user),
  };
  if (own)
    Object.assign(p, {
      inviteCode: user.invite_code,
      trialUntil: user.trial_until,
      trialDaysSaved: user.trial_days_bank,
      socialLinks: user.social_links,
      shareLocation: user.share_location,
    });
  return p;
}
async function stats(userId) {
  const rows = await query(
    `SELECT COUNT(*) FILTER(WHERE status='done')::int AS total, COUNT(*) FILTER(WHERE status='done' AND (created_at AT TIME ZONE 'Asia/Tehran')::date=(NOW() AT TIME ZONE 'Asia/Tehran')::date)::int AS today, COUNT(*) FILTER(WHERE status='done' AND created_at>=NOW()-INTERVAL '7 days')::int AS week, COUNT(*) FILTER(WHERE status='done' AND created_at>=NOW()-INTERVAL '30 days')::int AS month, COUNT(*) FILTER(WHERE status='need')::int AS need FROM checkins WHERE user_id=$1`,
    [userId],
  );
  const daily = await query(
    `SELECT (created_at AT TIME ZONE 'Asia/Tehran')::date::text AS day, COUNT(*)::int AS count FROM checkins WHERE user_id=$1 AND status='done' AND created_at>=NOW()-INTERVAL '7 days' GROUP BY 1 ORDER BY 1`,
    [userId],
  );
  const latest = await query(
    "SELECT id,status,visibility,created_at FROM checkins WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1",
    [userId],
  );
  return { ...rows[0], daily, latest: latest[0] || null };
}
async function friends(user) {
  if (!user.registered) return [];
  const rows = await query(
    `SELECT c.*, u.id AS friend_id, u.name, u.avatar_seed, u.trial_until, u.paid_until, u.social_links, e.status AS latest_status,e.created_at AS latest_at FROM connections c JOIN users u ON u.id=CASE WHEN c.user_a=$1 THEN c.user_b ELSE c.user_a END LEFT JOIN LATERAL (SELECT status,created_at FROM checkins WHERE user_id=u.id AND visibility='friends' ORDER BY created_at DESC LIMIT 1) e ON TRUE WHERE c.user_a=$1 OR c.user_b=$1 ORDER BY c.created_at DESC`,
    [user.id],
  );
  return rows.map((r) => {
    const ownerSharing = user.id === r.user_a ? r.share_b : r.share_a;
    return {
      connectionId: r.id,
      id: r.friend_id,
      name: r.name,
      avatarSeed: r.avatar_seed,
      status: r.status,
      incoming: r.requested_by !== user.id,
      sharing: user.id === r.user_a ? r.share_a : r.share_b,
      socialLinks:
        r.status === "accepted" && ownerSharing && premium(user) && premium(r)
          ? r.social_links
          : {},
      latestStatus: r.status === "accepted" ? r.latest_status : null,
      latestAt: r.status === "accepted" ? r.latest_at : null,
    };
  });
}
async function moments(user) {
  if (!user.registered || !premium(user)) return [];
  const rows = await query(
    `SELECT m.*,u.id AS friend_id,u.name,u.avatar_seed FROM pair_moments m JOIN users u ON u.id=CASE WHEN m.user_a=$1 THEN m.user_b ELSE m.user_a END WHERE m.user_a=$1 OR m.user_b=$1 ORDER BY m.created_at DESC LIMIT 30`,
    [user.id],
  );
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    createdAt: r.created_at,
    friend: { id: r.friend_id, name: r.name, avatarSeed: r.avatar_seed },
  }));
}
async function circles(user) {
  if (!user.registered) return [];
  const rows = await query(
    `SELECT c.*,COALESCE(json_agg(m.user_id) FILTER(WHERE m.user_id IS NOT NULL),'[]') AS members FROM circles c LEFT JOIN circle_members m ON m.circle_id=c.id WHERE c.owner_id=$1 GROUP BY c.id ORDER BY c.created_at`,
    [user.id],
  );
  return rows.map((r) => ({ id: r.id, name: r.name, members: r.members }));
}
async function bootstrap(user) {
  const [s, f, m, c] = await Promise.all([
    stats(user.id),
    friends(user),
    moments(user),
    circles(user),
  ]);
  return {
    me: profile(user, true),
    stats: s,
    friends: f,
    moments: m,
    circles: c,
    testing: testingMode(),
    inviteOnly: inviteOnly(),
    publicUrl: process.env.PUBLIC_APP_URL || "https://jishoo.vercel.app",
  };
}
async function inviteInfo(code) {
  const rows = await query(
    `SELECT i.code,u.id,u.name,u.avatar_seed FROM invites i LEFT JOIN users u ON u.id=i.inviter_id WHERE i.code=$1 AND i.active`,
    [normalizeCode(code)],
  );
  if (!rows[0])
    fail(
      404,
      "کد دعوت پیدا نشد. از دوستت یه لینک تازه بگیر.",
      "invite_not_found",
    );
  return {
    code: rows[0].code,
    inviter: rows[0].id
      ? { id: rows[0].id, name: rows[0].name, avatarSeed: rows[0].avatar_seed }
      : null,
    bonusDays: 7,
  };
}
async function detectMoments(user, event) {
  if (
    !user.registered ||
    !premium(user) ||
    event.visibility !== "friends" ||
    event.status !== "done"
  )
    return [];
  const peers = await query(
    `SELECT u.*,e.id AS event_id,e.created_at AS event_at FROM connections c JOIN users u ON u.id=CASE WHEN c.user_a=$1 THEN c.user_b ELSE c.user_a END JOIN LATERAL (SELECT id,created_at FROM checkins WHERE user_id=u.id AND status='done' AND visibility='friends' AND created_at>=NOW()-INTERVAL '5 minutes' ORDER BY created_at DESC LIMIT 1) e ON TRUE WHERE c.status='accepted' AND (c.user_a=$1 OR c.user_b=$1)`,
    [user.id],
  );
  const result = [];
  for (const peer of peers) {
    const kind = pairKind(event.created_at, peer.event_at);
    if (!kind || !premium(peer)) continue;
    const [a, b] = [user.id, peer.id].sort(),
      [ea, eb] = [event.id, peer.event_id].sort();
    const inserted = await query(
      `INSERT INTO pair_moments(id,user_a,user_b,event_a,event_b,kind) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(event_a,event_b) DO NOTHING RETURNING *`,
      [randomUUID(), a, b, ea, eb, kind],
    );
    if (inserted[0])
      result.push({
        id: inserted[0].id,
        kind,
        createdAt: inserted[0].created_at,
        friend: profile(peer),
      });
  }
  return result;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  try {
    const url = new URL(req.url, "http://" + (req.headers.host || "localhost"));
    const action = url.searchParams.get("action") || "bootstrap";
    if (!["GET", "POST"].includes(req.method))
      fail(405, "این درخواست پشتیبانی نمی‌شود.");
    if (req.method === "POST") {
      if (
        !String(req.headers["content-type"] || "").includes("application/json")
      )
        fail(415, "درخواست معتبر نیست.");
      const origin = req.headers.origin;
      const expected = new Set([
        `https://${req.headers.host}`,
        `http://${req.headers.host}`,
        process.env.PUBLIC_APP_URL,
      ]);
      if (origin && !expected.has(origin))
        fail(403, "درخواست از آدرس مجاز نیست.");
    }
    let body = req.body || {};
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        fail(400, "درخواست معتبر نیست.");
      }
    }
    if (JSON.stringify(body).length > 16000) fail(413, "درخواست خیلی بزرگه.");
    await initialize();
    if (action === "health") {
      await query("SELECT 1");
      return json(res, 200, {
        ready: true,
        database: true,
        testing: testingMode(),
        inviteOnly: inviteOnly(),
      });
    }
    if (action === "invite" && req.method === "GET")
      return json(res, 200, await inviteInfo(url.searchParams.get("code")));
    const auth = await session(req, res);
    const user = auth.user;
    if (action === "bootstrap") return json(res, 200, await bootstrap(user));
    if (req.method !== "POST") fail(405, "این کار به درخواست امن نیاز داره.");

    if (action === "auth-start") {
      if (!testingMode())
        fail(
          503,
          "ورود پیامکی هنوز فعال نشده. در حال حاضر نسخه‌ی آزمایشی در دسترسه.",
          "sms_unconfigured",
        );
      let phone;
      try {
        phone = normalizePhone(body.phone);
      } catch (error) {
        fail(400, error.message);
      }
      const recent = await query(
        `SELECT COUNT(*)::int AS n FROM auth_challenges WHERE user_id=$1 AND created_at>NOW()-INTERVAL '10 minutes'`,
        [user.id],
      );
      if (recent[0].n >= 10) fail(429, "چند دقیقه بعد دوباره امتحان کن.");
      const id = randomToken();
      await query(
        `INSERT INTO auth_challenges(id,user_id,phone_hash,phone_cipher,expires_at) VALUES($1,$2,$3,$4,NOW()+INTERVAL '10 minutes')`,
        [id, user.id, phoneHash(phone), encryptPhone(phone)],
      );
      return json(res, 200, {
        challengeId: id,
        demo: true,
        maskedPhone: "•••• " + phone.slice(-4),
      });
    }
    if (action === "auth-verify") {
      if (!testingMode()) fail(503, "تایید پیامکی فعال نشده.");
      if (!/^[0-9۰-۹]{6}$/.test(String(body.code || "")))
        fail(400, "کد شش‌رقمی وارد کن.");
      const rows = await query(
        `UPDATE auth_challenges SET verified_at=NOW() WHERE id=$1 AND user_id=$2 AND expires_at>NOW() AND consumed_at IS NULL RETURNING *`,
        [body.challengeId, user.id],
      );
      if (!rows[0]) fail(400, "کد ورود منقضی شده؛ دوباره شماره‌ت رو وارد کن.");
      const existing = await query("SELECT * FROM users WHERE phone_hash=$1", [
        rows[0].phone_hash,
      ]);
      if (existing[0]) {
        await transaction([
          [
            "UPDATE sessions SET user_id=$1 WHERE token_hash=$2",
            [existing[0].id, auth.tokenHash],
          ],
          [
            "UPDATE checkins SET user_id=$1 WHERE user_id=$2 AND $1<>$2",
            [existing[0].id, user.id],
          ],
          [
            "UPDATE auth_challenges SET consumed_at=NOW() WHERE id=$1",
            [body.challengeId],
          ],
        ]);
        return json(res, 200, {
          registered: true,
          ...(await bootstrap(existing[0])),
        });
      }
      return json(res, 200, {
        registered: false,
        ticket: body.challengeId,
        inviteOnly: inviteOnly(),
      });
    }
    if (action === "register") {
      if (user.registered) fail(409, "حسابت قبلاً ساخته شده.");
      if (typeof body.ticket !== "string" || body.ticket.length > 100)
        fail(400, "اول شماره‌ت رو تایید کن.");
      const name = normalizeName(body.name);
      if (name.length < 2 || name.length > 40)
        fail(400, "اسمت رو بین ۲ تا ۴۰ حرف بنویس.");
      const code = normalizeCode(body.inviteCode),
        personalCode = inviteCode();
      if (inviteOnly() && !code)
        fail(
          400,
          "برای عضویت توی این مرحله، کد دعوت لازمه.",
          "invite_required",
        );
      if (code) await inviteInfo(code);
      const registered = await query(
        `WITH valid_invite AS (SELECT * FROM invites WHERE code=$1 AND active), ticket AS (SELECT * FROM auth_challenges WHERE id=$2 AND user_id=$3 AND verified_at IS NOT NULL AND consumed_at IS NULL AND expires_at>NOW()), joined AS (UPDATE users SET registered=TRUE,name=$4,avatar_seed=$4,phone_hash=ticket.phone_hash,phone_cipher=ticket.phone_cipher,invite_code=$5,invited_by=(SELECT inviter_id FROM valid_invite),trial_days_bank=CASE WHEN $7::boolean THEN CASE WHEN EXISTS(SELECT 1 FROM valid_invite) THEN 7 ELSE 3 END ELSE 0 END,trial_until=CASE WHEN $7::boolean THEN NULL ELSE NOW()+CASE WHEN EXISTS(SELECT 1 FROM valid_invite) THEN INTERVAL '7 days' ELSE INTERVAL '3 days' END END FROM ticket WHERE users.id=$3 AND NOT users.registered AND (NOT $6::boolean OR EXISTS(SELECT 1 FROM valid_invite)) RETURNING users.*), reward AS (UPDATE users SET trial_days_bank=CASE WHEN $7::boolean THEN trial_days_bank+7 ELSE trial_days_bank END,trial_until=CASE WHEN $7::boolean THEN trial_until ELSE GREATEST(COALESCE(trial_until,NOW()),COALESCE(paid_until,NOW()),NOW())+INTERVAL '7 days' END WHERE id=(SELECT invited_by FROM joined) RETURNING id), consume AS (UPDATE auth_challenges SET consumed_at=NOW() WHERE id=$2 AND EXISTS(SELECT 1 FROM joined) RETURNING id), personal_invite AS (INSERT INTO invites(code,inviter_id) SELECT $5,id FROM joined ON CONFLICT DO NOTHING RETURNING code), auto_connect AS (INSERT INTO connections(id,user_a,user_b,requested_by,status) SELECT $9,LEAST(id,invited_by),GREATEST(id,invited_by),invited_by,'accepted' FROM joined WHERE invited_by IS NOT NULL AND $8::boolean ON CONFLICT(user_a,user_b) DO UPDATE SET status='accepted' RETURNING id) SELECT * FROM joined`,
        [
          code,
          body.ticket,
          user.id,
          name,
          personalCode,
          inviteOnly(),
          testingMode(),
          body.connectInviter === true,
          randomUUID(),
        ],
      );
      if (!registered[0]) fail(400, "درخواست عضویت منقضی شده؛ دوباره وارد شو.");
      const fresh = registered[0];
      return json(res, 200, {
        bonusDays: code ? 7 : 3,
        ...(await bootstrap(fresh)),
      });
    }
    if (action === "checkin") {
      if (
        !["need", "done"].includes(body.status) ||
        typeof body.nonce !== "string" ||
        body.nonce.length > 80
      )
        fail(400, "خبر معتبر نیست.");
      const visibility =
        user.registered && body.visibility !== "private"
          ? "friends"
          : "private";
      const share =
        (!user.registered || visibility === "friends") &&
        user.share_location &&
        user.location_updated_at &&
        +new Date(user.location_updated_at) > Date.now() - 3600000;
      const rows = await query(
        `INSERT INTO checkins(id,user_id,status,visibility,client_nonce,location_lat,location_lng) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(user_id,client_nonce) DO UPDATE SET client_nonce=EXCLUDED.client_nonce RETURNING *`,
        [
          randomUUID(),
          user.id,
          body.status,
          visibility,
          body.nonce,
          share ? user.location_lat : null,
          share ? user.location_lng : null,
        ],
      );
      const matched = await detectMoments(user, rows[0]);
      return json(res, 200, {
        event: {
          id: rows[0].id,
          status: rows[0].status,
          createdAt: rows[0].created_at,
        },
        matches: matched,
        stats: await stats(user.id),
      });
    }
    if (action === "profile") {
      requireAccount(user);
      let links;
      try {
        links = cleanSocialLinks(body.socialLinks || {});
      } catch (error) {
        fail(400, error.message);
      }
      const name = normalizeName(body.name || user.name);
      if (name.length < 2 || name.length > 40) fail(400, "اسم معتبر نیست.");
      const rows = await query(
        "UPDATE users SET name=$2,avatar_seed=$2,social_links=$3::jsonb WHERE id=$1 RETURNING *",
        [user.id, name, JSON.stringify(links)],
      );
      return json(res, 200, await bootstrap(rows[0]));
    }
    if (action === "connection-request") {
      requireAccount(user);
      const info = await inviteInfo(body.code);
      if (!info.inviter || info.inviter.id === user.id)
        fail(400, "کد دوستت رو وارد کن.");
      const [a, b] = [user.id, info.inviter.id].sort();
      await query(
        `INSERT INTO connections(id,user_a,user_b,requested_by) VALUES($1,$2,$3,$4) ON CONFLICT(user_a,user_b) DO UPDATE SET status=CASE WHEN connections.requested_by<>$4 THEN 'accepted' ELSE connections.status END`,
        [randomUUID(), a, b, user.id],
      );
      return json(res, 200, { friends: await friends(user) });
    }
    if (action === "connection-respond") {
      requireAccount(user);
      if (body.accept)
        await query(
          `UPDATE connections SET status='accepted' WHERE id=$1 AND status='pending' AND requested_by<>$2 AND (user_a=$2 OR user_b=$2)`,
          [body.id, user.id],
        );
      else
        await query(
          "DELETE FROM connections WHERE id=$1 AND (user_a=$2 OR user_b=$2)",
          [body.id, user.id],
        );
      return json(res, 200, { friends: await friends(user) });
    }
    if (action === "connection-share") {
      requireAccount(user);
      requirePremium(user);
      if (typeof body.enabled !== "boolean") fail(400, "انتخاب معتبر نیست.");
      const rows = await query(
        `UPDATE connections SET share_a=CASE WHEN user_a=$2 THEN $3 ELSE share_a END,share_b=CASE WHEN user_b=$2 THEN $3 ELSE share_b END WHERE id=$1 AND status='accepted' AND (user_a=$2 OR user_b=$2) RETURNING id`,
        [body.id, user.id, Boolean(body.enabled)],
      );
      if (!rows[0]) fail(404, "اتصال فعال پیدا نشد.");
      return json(res, 200, { friends: await friends(user) });
    }
    if (action === "location") {
      if (typeof body.enabled !== "boolean") fail(400, "انتخاب معتبر نیست.");
      if (!body.enabled) {
        await transaction([
          [
            "UPDATE users SET share_location=FALSE,location_lat=NULL,location_lng=NULL,location_updated_at=NULL WHERE id=$1",
            [user.id],
          ],
          [
            "UPDATE checkins SET location_lat=NULL,location_lng=NULL WHERE user_id=$1",
            [user.id],
          ],
        ]);
      } else {
        let p;
        try {
          p = approximateLocation(body.lat, body.lng);
        } catch (error) {
          fail(400, error.message);
        }
        await query(
          "UPDATE users SET share_location=TRUE,location_lat=$2,location_lng=$3,location_updated_at=NOW() WHERE id=$1",
          [user.id, p.lat, p.lng],
        );
      }
      return json(res, 200, { enabled: Boolean(body.enabled) });
    }
    if (action === "nearby") {
      let p;
      try {
        p = approximateLocation(body.lat, body.lng);
      } catch (error) {
        fail(400, error.message);
      }
      const rows = await query(
        `SELECT e.*,u.name,u.avatar_seed,c.id AS connection_id FROM checkins e JOIN users u ON u.id=e.user_id LEFT JOIN connections c ON c.status='accepted' AND ((c.user_a=$1 AND c.user_b=u.id) OR (c.user_b=$1 AND c.user_a=u.id)) WHERE u.share_location AND u.location_updated_at>NOW()-INTERVAL '1 hour' AND e.created_at>NOW()-INTERVAL '30 minutes' AND e.location_lat BETWEEN $2-.04 AND $2+.04 AND e.location_lng BETWEEN $3-.05 AND $3+.05 ORDER BY e.created_at DESC LIMIT 150`,
        [user.id, p.lat, p.lng],
      );
      const seen = new Set();
      const activity = rows
        .filter(
          (r) =>
            distanceKm(p, { lat: r.location_lat, lng: r.location_lng }) <= 3,
        )
        .filter((r) => {
          if (seen.has(r.user_id)) return false;
          seen.add(r.user_id);
          return true;
        })
        .map((r) => ({
          id: r.id,
          status: r.status,
          createdAt: r.created_at,
          lat: r.location_lat,
          lng: r.location_lng,
          isFriend: Boolean(r.connection_id),
          isMe: r.user_id === user.id,
          name:
            r.user_id === user.id
              ? "خودت"
              : r.connection_id
                ? r.name
                : "یه همسایه",
          avatarSeed:
            r.connection_id || r.user_id === user.id
              ? r.avatar_seed
              : "neighbor:" + r.id,
        }));
      return json(res, 200, { activity, approximate: true });
    }
    if (action === "circle-create") {
      requireAccount(user);
      const name = normalizeName(body.name);
      if (!name || name.length > 40) fail(400, "اسم جمع معتبر نیست.");
      const allowed = (await friends(user))
        .filter((f) => f.status === "accepted")
        .map((f) => f.id);
      const members = [
        ...new Set(Array.isArray(body.members) ? body.members : []),
      ];
      if (members.some((id) => !allowed.includes(id)))
        fail(403, "فقط دوست‌های وصل‌شده رو می‌تونی اضافه کنی.");
      const id = randomUUID();
      await transaction([
        [
          "INSERT INTO circles(id,owner_id,name) VALUES($1,$2,$3)",
          [id, user.id, name],
        ],
        ...members.map((m) => [
          "INSERT INTO circle_members(circle_id,user_id) VALUES($1,$2)",
          [id, m],
        ]),
      ]);
      return json(res, 200, { circles: await circles(user) });
    }
    if (action === "delete-account") {
      await transaction([
        ["DELETE FROM pair_moments WHERE user_a=$1 OR user_b=$1", [user.id]],
        ["DELETE FROM connections WHERE user_a=$1 OR user_b=$1", [user.id]],
        [
          "DELETE FROM circle_members WHERE user_id=$1 OR circle_id IN (SELECT id FROM circles WHERE owner_id=$1)",
          [user.id],
        ],
        ["DELETE FROM circles WHERE owner_id=$1", [user.id]],
        ["DELETE FROM checkins WHERE user_id=$1", [user.id]],
        ["DELETE FROM auth_challenges WHERE user_id=$1", [user.id]],
        ["DELETE FROM sessions WHERE user_id=$1", [user.id]],
        ["DELETE FROM invites WHERE inviter_id=$1", [user.id]],
        ["UPDATE users SET invited_by=NULL WHERE invited_by=$1", [user.id]],
        ["DELETE FROM users WHERE id=$1", [user.id]],
      ]);
      res.setHeader(
        "Set-Cookie",
        "jishoo_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0",
      );
      return json(res, 200, { ok: true });
    }
    if (action === "logout") {
      await query("DELETE FROM sessions WHERE token_hash=$1", [auth.tokenHash]);
      res.setHeader(
        "Set-Cookie",
        "jishoo_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0",
      );
      return json(res, 200, { ok: true });
    }
    fail(404, "این بخش پیدا نشد.");
  } catch (error) {
    if (error instanceof AppError)
      return json(res, error.status, {
        error: error.code,
        message: error.message,
      });
    if (error.code === "23505")
      return json(res, 409, {
        error: "duplicate_account",
        message: "این شماره قبلاً عضو شده؛ با همون شماره وارد شو.",
      });
    console.error("[jishoo-api]", error.code || error.name);
    return json(res, 503, {
      error: "temporarily_unavailable",
      message: "الان ارتباط برقرار نشد؛ یه لحظه دیگه امتحان کن.",
    });
  }
}
