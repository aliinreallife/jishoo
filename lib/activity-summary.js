import { query } from "./database.js";
import { dailyStreak } from "./streaks.js";

// A request-local promise lets statistics and achievements share the same
// trusted daily history without caching private results across requests.
export async function activitySummary(userId) {
  const days = await query(`SELECT (created_at AT TIME ZONE 'Asia/Tehran')::date::text AS day,
    LEAST(8,COUNT(DISTINCT FLOOR(EXTRACT(EPOCH FROM created_at)/1800)))::int AS n
    FROM checkins WHERE user_id=$1 AND status='done' GROUP BY 1 ORDER BY 1 DESC`, [userId]);
  return { days, streak: dailyStreak(days.map(row => row.day)) };
}
