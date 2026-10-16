import { query } from "./database.js";

const definitions = [
  {
    slug: "light_steps",
    name: "قدم‌های سبک",
    icon: "drop",
    levels: [1, 10, 50],
    names: ["قطره‌ی اول", "سبک‌بال", "ابرِ بی‌وزن"],
    description: "خبرهای جیش کردم، با فاصله و در روزهای واقعی.",
  },
  {
    slug: "good_days",
    name: "روزهای قشنگ",
    icon: "sun",
    levels: [3, 7, 30],
    names: ["سه‌روزه‌ی قشنگ", "رفیقِ هفته", "آدمِ همیشگی"],
    description: "روزهای متفاوتی که یه خبر سبک ثبت کردی.",
  },
  {
    slug: "streak",
    name: "قرارِ هر روز",
    icon: "fire",
    levels: [3, 7, 30],
    names: ["سه قطره پشت هم", "هفته‌ی طلایی", "ماه‌رفیق"],
    description: "چند روز پشت هم، هر روز یه سر به جیشو بزن.",
  },
  {
    slug: "inviter",
    name: "جمع‌گرم‌کن",
    icon: "heart",
    levels: [1, 2, 3],
    names: ["دعوتِ اول", "دو تا رفیق", "جمع‌گرم‌کن"],
    description: "دوست‌هایی که با دعوت تو عضو شدن.",
  },
  {
    slug: "together",
    name: "هم‌جیشِ خوب",
    icon: "star",
    levels: [1, 3, 10],
    names: ["اولین هم‌جیش", "تیمِ سبک", "رفیقِ سینک"],
    description: "خاطره‌های مشترک با دوست‌ها؛ برای هر دوست، روزی یک خاطره.",
  },
];

export async function getAchievements(userId, persist = true) {
  const [days, pairs, invites, stored] = await Promise.all([
    query(
      `SELECT (created_at AT TIME ZONE 'Asia/Tehran')::date::text AS day,LEAST(8,COUNT(DISTINCT FLOOR(EXTRACT(EPOCH FROM created_at)/1800)))::int AS n FROM checkins WHERE user_id=$1 AND status='done' GROUP BY 1 ORDER BY 1 DESC`,
      [userId],
    ),
    query(
      `SELECT COUNT(DISTINCT ((created_at AT TIME ZONE 'Asia/Tehran')::date::text || ':' || CASE WHEN user_a=$1 THEN user_b ELSE user_a END))::int AS n FROM pair_moments WHERE user_a=$1 OR user_b=$1`,
      [userId],
    ),
    query(
      "SELECT COUNT(*)::int AS n FROM users WHERE invited_by=$1 AND registered",
      [userId],
    ),
    query("SELECT slug,level,progress FROM achievements WHERE user_id=$1", [
      userId,
    ]),
  ]);
  let streak = 0;
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Tehran",
  });
  let previous = +new Date(today + "T00:00:00Z");
  for (let i = 0; i < days.length; i++) {
    const timestamp = +new Date(days[i].day + "T00:00:00Z");
    if (i === 0 && previous - timestamp === 86400000) previous = timestamp;
    if (timestamp !== previous) break;
    streak++;
    previous -= 86400000;
  }
  const progress = {
    light_steps: days.reduce((n, d) => n + d.n, 0),
    good_days: days.length,
    streak,
    inviter: invites[0].n,
    together: pairs[0].n,
  };
  const items = definitions.map((def) => {
    const old = stored.find((s) => s.slug === def.slug);
    const count = Math.max(progress[def.slug], old?.progress || 0);
    const level = Math.max(
      def.levels.filter((n) => count >= n).length,
      old?.level || 0,
    );
    return {
      ...def,
      level,
      progress: count,
      title: def.names[Math.max(0, level - 1)],
      next: def.levels[level] || null,
    };
  });
  if (persist) {
    const params = [];
    const values = items.map((item, i) => {
      params.push(userId, item.slug, item.level, item.progress);
      return `($${i * 4 + 1},$${i * 4 + 2},$${i * 4 + 3},$${i * 4 + 4})`;
    });
    await query(
      `INSERT INTO achievements(user_id,slug,level,progress) VALUES ${values.join(",")} ON CONFLICT(user_id,slug) DO UPDATE SET level=GREATEST(achievements.level,EXCLUDED.level),progress=GREATEST(achievements.progress,EXCLUDED.progress),updated_at=NOW() WHERE achievements.level<EXCLUDED.level OR achievements.progress<EXCLUDED.progress`,
      params,
    );
  }
  return items;
}
