// Shared by server achievements, the personal collection and story exports.
export const streakMilestones = Object.freeze([
  { days: 3, label: "۳ روز", name: "جوانهٔ هر روز", motif: "sprout", color: "#6d9a77", light: "#e5f2cb", accent: "#b2cf86", shape: "shield" },
  { days: 7, label: "یک هفته", name: "هفتهٔ شکوفه", motif: "flower", color: "#b8798b", light: "#ffe0df", accent: "#e8a3b7", shape: "flower" },
  { days: 14, label: "دو هفته", name: "شب‌های ماه‌نشان", motif: "moon", color: "#8572b9", light: "#e9e0ff", accent: "#b5a3dc", shape: "scallop" },
  { days: 30, label: "یک ماه", name: "ماه‌رفیق", motif: "sun", color: "#bb8b35", light: "#fff1ad", accent: "#e9bf5f", shape: "sun" },
  { days: 60, label: "دو ماه", name: "دو ماهِ آفتابی", motif: "twins", color: "#679ea6", light: "#d9f2ef", accent: "#9acccd", shape: "heart" },
  { days: 90, label: "سه ماه", name: "فصلِ قطره‌ها", motif: "garden", color: "#9c79b0", light: "#f0ddf4", accent: "#c7a3d3", shape: "flower" },
  { days: 180, label: "شش ماه", name: "نیم‌سالِ درخشان", motif: "comet", color: "#6f8eb9", light: "#deebff", accent: "#a2bce2", shape: "shield" },
  { days: 365, label: "یک سال", name: "یک دور با خورشید", motif: "crown", color: "#b18b43", light: "#ffedba", accent: "#dac48c", shape: "scallop" },
].map(Object.freeze));
export function earnedStreakMilestones(best) {
  return streakMilestones.filter(item => item.days <= Math.max(0, Number(best) || 0));
}
export function streakMilestone(days) {
  return streakMilestones.find(item => item.days === Number(days)) || null;
}
export function shareableStreakMilestone(days, best) {
  const item = streakMilestone(days);
  return item && item.days <= Math.max(0, Number(best) || 0) ? item : null;
}
