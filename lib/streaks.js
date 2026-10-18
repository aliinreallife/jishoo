import { dayKey, weekDays } from "./calendar.js";

const dayMilliseconds = 86400000;
const ordinal = (day) => Math.floor(Date.parse(day + "T12:00:00Z") / dayMilliseconds);
const keyOf = (number) => new Date(number * dayMilliseconds).toISOString().slice(0, 10);
const validDay = (day) => typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(ordinal(day)) && keyOf(ordinal(day)) === day;

// Freezes are deterministic from server-recorded completed-check-in days.
// Replaying the same history cannot award extra charges or consume one twice.
export function dailyStreak(activeDays, now = new Date()) {
  const today = dayKey(now), todayNumber = ordinal(today);
  const days = [...new Set(activeDays.filter(validDay).filter(day => day <= today))].sort();
  const active = new Set(days), frozen = new Set();
  let current = 0, best = 0, charges = 0, capacity = 1, rechargeProgress = 0, last = null, used = 0;
  function miss(count, start) {
    if (count <= 0) return;
    const protectedDays = Math.min(charges, count);
    for (let i = 0; i < protectedDays; i++) frozen.add(keyOf(start + i));
    charges -= protectedDays; used += protectedDays; rechargeProgress = 0;
    if (protectedDays < count) current = 0;
  }
  for (const day of days) {
    const number = ordinal(day);
    if (last !== null) miss(number - last - 1, last + 1);
    current++; best = Math.max(best, current);
    if (capacity === 1 && best >= 21) {
      capacity = 2; charges = Math.min(2, charges + 1); rechargeProgress = 0;
    } else if (charges < capacity) {
      rechargeProgress++;
      if (rechargeProgress === 3) { charges++; rechargeProgress = 0; }
    } else rechargeProgress = 0;
    last = number;
  }
  // Today is still available: only completed, missed calendar days need a freeze.
  if (last !== null) miss(Math.max(0, todayNumber - last - 1), last + 1);
  return {
    current, best, charges, capacity, rechargeProgress,
    nextChargeIn: charges < capacity ? 3 - rechargeProgress : 0,
    secondSlotAt: capacity === 2 ? null : 21,
    activeToday: active.has(today), freezesUsed: used,
    protectedYesterday: frozen.has(keyOf(todayNumber - 1)), today,
    week: weekDays(now).map((date, index) => {
      const day = dayKey(date);
      return { day, label: ["ش", "ی", "د", "س", "چ", "پ", "ج"][index],
        detail: date.toLocaleDateString("fa-IR-u-ca-persian", { weekday: "long", month: "long", day: "numeric", timeZone: "Asia/Tehran" }),
        state: active.has(day) ? "active" : frozen.has(day) ? "frozen" : day > today ? "future" : day === today ? "today" : "missed" };
    }),
  };
}
