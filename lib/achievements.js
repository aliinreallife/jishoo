import { query } from "./database.js";
import { activitySummary } from "./activity-summary.js";
import { streakMilestones } from "./streak-milestones.js";

const definitions = [
  {
    slug: "light_steps",
    name: "قدم‌های سبک",
    icon: "drop",
    levels: [1, 10, 50],
    names: ["قطره‌ی اول", "سبک‌بال", "ابرِ بی‌وزن"],
    description: "جیش‌کردن‌های ثبت‌شده، با فاصله و در روزهای واقعی.",
  },
  {
    slug: "good_days",
    name: "روزهای قشنگ",
    icon: "sun",
    levels: [3, 7, 30],
    names: ["سه‌روزه‌ی قشنگ", "رفیقِ هفته", "آدمِ همیشگی"],
    description: "روزهای متفاوتی که توی جیشو ثبت داشتی.",
  },
  {
    slug: "streak",
    name: "قرارِ هر روز",
    icon: "fire",
    levels: streakMilestones.map(item => item.days),
    names: streakMilestones.map(item => item.name),
    description: "روزی یک «جیش کردم»؛ هر قدم از سه روز تا یک سال، نشان خودش رو داره.",
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
    name: "هم‌زمانی‌های قشنگ",
    icon: "star",
    levels: [1, 3, 10],
    names: ["اولین هم‌زمانی", "تیمِ سبک", "رفیقِ سینک"],
    description: "خاطره‌های مشترک با دوست‌ها؛ برای هر دوست، روزی یک خاطره.",
  },
];

export async function getAchievements(userId, persist = true, { registered = true, activity } = {}) {
  const [summary, pairs, invites, stored] = await Promise.all([
    activity || activitySummary(userId),
    registered ? query(
      `SELECT COUNT(DISTINCT ((created_at AT TIME ZONE 'Asia/Tehran')::date::text || ':' || CASE WHEN user_a=$1 THEN user_b ELSE user_a END))::int AS n FROM pair_moments WHERE user_a=$1 OR user_b=$1`,
      [userId],
    ) : [],
    registered ? query(
      "SELECT COUNT(*)::int AS n FROM users WHERE invited_by=$1 AND registered",
      [userId],
    ) : [],
    registered ? query("SELECT slug,level,progress FROM achievements WHERE user_id=$1", [
      userId,
    ]) : [],
  ]);
  const { days, streak } = summary;
  const progress = {
    light_steps: days.reduce((n, d) => n + d.n, 0),
    good_days: days.length,
    streak: streak.best,
    inviter: invites[0]?.n || 0,
    together: pairs[0]?.n || 0,
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
