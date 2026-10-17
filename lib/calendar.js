const zone = "Asia/Tehran";
const gregorian = new Intl.DateTimeFormat("en-US-u-ca-gregory-nu-latn", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" });
const persian = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", { timeZone: zone, year: "numeric", month: "numeric", day: "numeric" });
const fields = (formatter, date) => Object.fromEntries(formatter.formatToParts(date).filter((p) => ["year", "month", "day"].includes(p.type)).map((p) => [p.type, Number(p.value)]));
export const dayDate = (key) => new Date(key + "T12:00:00Z");
export const addDays = (date, n) => new Date(+date + n * 86400000);
export function dayKey(date) {
  const p = fields(gregorian, date);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}
export const persianParts = (date) => fields(persian, date);
export function weekDays(date = new Date()) {
  const today = dayDate(dayKey(date)), offset = (today.getUTCDay() + 1) % 7;
  return Array.from({ length: 7 }, (_, i) => addDays(today, i - offset));
}
export function persianMonth(date = new Date(), offset = 0) {
  let start = addDays(dayDate(dayKey(date)), 1 - persianParts(date).day);
  for (let i = 0; i < Math.abs(offset); i++) {
    const next = addDays(start, offset > 0 ? 35 : -1);
    start = addDays(next, 1 - persianParts(next).day);
  }
  const parts = persianParts(start), days = [];
  for (let i = 0; i < 32; i++) {
    const current = addDays(start, i);
    if (persianParts(current).month !== parts.month) break;
    days.push(current);
  }
  return { start, days, year: parts.year, month: parts.month, label: start.toLocaleDateString("fa-IR-u-ca-persian", { month: "long", year: "numeric", timeZone: zone }), offset: (start.getUTCDay() + 1) % 7 };
}
export function periodTotals(daily, now = new Date()) {
  const week = new Set(weekDays(now).map(dayKey)), month = new Set(persianMonth(now).days.map(dayKey));
  return daily.reduce((total, row) => ({ week: total.week + (week.has(row.day) ? row.count : 0), month: total.month + (month.has(row.day) ? row.count : 0) }), { week: 0, month: 0 });
}
