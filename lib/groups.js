import { randomUUID } from "node:crypto";
import { query, transaction } from "./database.js";
import { normalizeName, normalizeHandle, randomToken } from "./core.js";
import { notifyUser } from "./notifications.js";
import { rateLimit } from "./security.js";
const person = (u) => ({
  id: u.id,
  name: u.name,
  handle: u.handle,
  avatarSeed: u.avatar_seed,
  avatarImage: u.avatar_image || null,
});
export async function listGroups(user) {
  if (!user.registered) return [];
  const rows = await query(
    `SELECT c.*,mine.status AS my_status,o.name AS owner_name,o.handle AS owner_handle,o.avatar_seed AS owner_avatar_seed,o.avatar_image AS owner_avatar_image,COALESCE((SELECT json_agg(json_build_object('id',u.id,'name',u.name,'handle',u.handle,'avatarSeed',u.avatar_seed,'avatarImage',u.avatar_image,'status',m.status)) FROM circle_members m JOIN users u ON u.id=m.user_id WHERE m.circle_id=c.id AND NOT u.banned AND (c.owner_id=$1 OR mine.status='accepted') AND (m.status='accepted' OR c.owner_id=$1)),'[]') AS people FROM circles c JOIN users o ON o.id=c.owner_id LEFT JOIN circle_members mine ON mine.circle_id=c.id AND mine.user_id=$1 WHERE NOT o.banned AND (c.owner_id=$1 OR (c.shared AND mine.user_id=$1)) ORDER BY c.created_at DESC`,
    [user.id],
  );
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    shared: c.shared,
    ownerId: c.owner_id,
    ownerName: c.owner_name,
    ownerHandle: c.owner_handle,
    ownerAvatarSeed: c.owner_avatar_seed,
    ownerAvatarImage: c.owner_avatar_image || null,
    canManage: c.owner_id === user.id,
    pending: c.my_status === "pending",
    inviteCode: c.owner_id === user.id ? c.join_code : null,
    members: [
      ...(c.shared ? [c.owner_id] : []),
      ...c.people.filter((p) => p.status === "accepted").map((p) => p.id),
    ],
    people: c.people.filter((p) => p.status === "accepted"),
    invited:
      c.owner_id === user.id
        ? c.people.filter((p) => p.status === "pending")
        : [],
  }));
}
export async function groupInfo(code, fail) {
  if (typeof code !== "string" || !/^[A-Za-z0-9_-]{20,80}$/.test(code))
    fail(404, "این دعوت گروه پیدا نشد.");
  const rows = await query(
    `SELECT c.id,c.name,u.id AS owner_id,u.name AS owner_name,u.handle,u.avatar_seed,u.avatar_image,(SELECT COUNT(*)::int FROM circle_members WHERE circle_id=c.id AND status='accepted')+1 AS members FROM circles c JOIN users u ON u.id=c.owner_id WHERE c.shared AND c.join_code=$1 AND NOT u.banned`,
    [code],
  );
  if (!rows[0]) fail(404, "این دعوت گروه منقضی شده یا عوض شده.");
  const c = rows[0];
  return {
    group: {
      id: c.id,
      name: c.name,
      members: c.members,
      owner: person({ ...c, id: c.owner_id, name: c.owner_name }),
    },
  };
}
export async function groupAction({ action, body, user, req, fail }) {
  if (
    ![
      "circle-create",
      "circle-invite",
      "circle-respond",
      "circle-join",
      "circle-leave",
      "circle-delete",
      "circle-rotate",
    ].includes(action)
  )
    return undefined;
  if (!user.registered)
    fail(401, "برای گروه‌های دوستی، اول وارد حسابت شو.", "account_required");
  if (req.method !== "POST") fail(405, "این کار به درخواست امن نیاز داره.");
  if (action === "circle-create") {
    const name = normalizeName(body.name);
    if (!name || name.length > 40)
      fail(400, "اسم گروه باید بین ۱ تا ۴۰ حرف باشه.");
    const members = [
      ...new Set(Array.isArray(body.members) ? body.members : []),
    ];
    if (members.length > 25) fail(400, "هر بار حداکثر ۲۵ دوست رو دعوت کن.");
    const allowed = await query(
      `SELECT CASE WHEN user_a=$1 THEN user_b ELSE user_a END AS id FROM connections WHERE status='accepted' AND (user_a=$1 OR user_b=$1)`,
      [user.id],
    );
    if (members.some((id) => !allowed.some((p) => p.id === id)))
      fail(
        403,
        "از دوست‌های متصلت انتخاب کن؛ بعداً با شناسه یا لینک هم می‌تونی دعوت کنی.",
      );
    if (!(await rateLimit("groups:" + user.id, 10, 3600)))
      fail(429, "گروه‌های زیادی ساختی؛ یه کم بعد دوباره امتحان کن.");
    const id = randomUUID(),
      shared = body.shared === true;
    await transaction([
      [
        `INSERT INTO circles(id,owner_id,name,shared,join_code) VALUES($1,$2,$3,$4,$5)`,
        [id, user.id, name, shared, shared ? randomToken() : null],
      ],
      ...members.map((m) => [
        `INSERT INTO circle_members(circle_id,user_id,status) VALUES($1,$2,$3)`,
        [id, m, shared ? "pending" : "accepted"],
      ]),
    ]);
    if (shared)
      await Promise.all(
        members.map((m) =>
          notifyUser(m, {
            actorId: user.id,
            kind: "group",
            title: `${user.name} به «${name}» دعوتت کرد`,
            body: "عضویت با انتخاب خودته؛ دوست‌شدن و لینک‌های اجتماعی جدا هستن.",
            route: "/#/circle/" + id,
            dedupe: "group-invite:" + id + ":" + m,
          }),
        ),
      );
    return { id, circles: await listGroups(user) };
  }
  if (action === "circle-join") {
    const { group } = await groupInfo(body.code, fail);
    const count = await query(
      "SELECT COUNT(*)::int AS n FROM circle_members WHERE circle_id=$1",
      [group.id],
    );
    if (count[0].n >= 100) fail(400, "این گروه فعلاً پر شده.");
    if (group.owner.id !== user.id)
      await query(
        `INSERT INTO circle_members(circle_id,user_id,status) VALUES($1,$2,'accepted') ON CONFLICT(circle_id,user_id) DO UPDATE SET status='accepted'`,
        [group.id, user.id],
      );
    return { id: group.id, circles: await listGroups(user) };
  }
  const rows = await query(
    `SELECT c.*,mine.status AS my_status FROM circles c LEFT JOIN circle_members mine ON mine.circle_id=c.id AND mine.user_id=$1 WHERE c.id=$2 AND (c.owner_id=$1 OR (c.shared AND mine.user_id=$1))`,
    [user.id, body.id],
  );
  const c = rows[0];
  if (!c) fail(404, "این گروه در دسترس تو نیست.");
  if (action === "circle-respond") {
    if (typeof body.accept !== "boolean" || c.my_status !== "pending")
      fail(400, "دعوت منتظر پاسخ پیدا نشد.");
    if (body.accept)
      await query(
        `UPDATE circle_members SET status='accepted' WHERE circle_id=$1 AND user_id=$2 AND status='pending'`,
        [c.id, user.id],
      );
    else
      await query(
        "DELETE FROM circle_members WHERE circle_id=$1 AND user_id=$2",
        [c.id, user.id],
      );
  } else if (action === "circle-leave") {
    if (c.owner_id === user.id) fail(400, "سازنده می‌تونه گروه رو حذف کنه.");
    await transaction([
      [
        "DELETE FROM circle_members WHERE circle_id=$1 AND user_id=$2",
        [c.id, user.id],
      ],
      [
        "DELETE FROM notification_preferences WHERE scope='circle' AND scope_id=$1 AND user_id=$2",
        [c.id, user.id],
      ],
    ]);
  } else {
    if (c.owner_id !== user.id)
      fail(403, "فقط سازندهٔ گروه می‌تونه دعوت‌ها رو مدیریت کنه.");
    if (action === "circle-invite") {
      if (!c.shared)
        fail(400, "این فهرست قدیمی خصوصیه؛ برای دعوت، یه گروه مشترک بساز.");
      if (!(await rateLimit("group-invites:" + user.id, 20, 3600)))
        fail(429, "دعوت‌های زیادی فرستادی؛ یه کم بعد دوباره امتحان کن.");
      let handle;
      try {
        handle = normalizeHandle(body.handle);
      } catch (e) {
        fail(400, e.message);
      }
      const peers = await query(
        "SELECT u.id FROM users matched JOIN users u ON u.id=COALESCE(matched.merged_into,matched.id) WHERE matched.handle=$1 AND u.registered AND NOT u.banned",
        [handle],
      );
      const peer = peers[0];
      if (!peer || peer.id === user.id) fail(404, "شناسهٔ یه دوست رو وارد کن.");
      const inserted = await query(
        `INSERT INTO circle_members(circle_id,user_id,status) SELECT $1,$2,'pending' WHERE (SELECT COUNT(*) FROM circle_members WHERE circle_id=$1)<100 ON CONFLICT DO NOTHING RETURNING user_id`,
        [c.id, peer.id],
      );
      if (inserted[0])
        await notifyUser(peer.id, {
          actorId: user.id,
          kind: "group",
          title: `${user.name} به «${c.name}» دعوتت کرد`,
          body: "دعوت رو ببین و خودت تصمیم بگیر.",
          route: "/#/circle/" + c.id,
          dedupe: "group-invite:" + c.id + ":" + peer.id,
        });
      else if (
        !(
          await query(
            "SELECT 1 FROM circle_members WHERE circle_id=$1 AND user_id=$2",
            [c.id, peer.id],
          )
        )[0]
      )
        fail(400, "این گروه به سقف اعضا رسیده.");
    } else if (action === "circle-rotate")
      await query("UPDATE circles SET join_code=$2 WHERE id=$1", [
        c.id,
        randomToken(),
      ]);
    else if (action === "circle-delete")
      await transaction([
        [
          "DELETE FROM notification_preferences WHERE scope='circle' AND scope_id=$1",
          [c.id],
        ],
        ["DELETE FROM circles WHERE id=$1", [c.id]],
      ]);
  }
  return { circles: await listGroups(user) };
}
