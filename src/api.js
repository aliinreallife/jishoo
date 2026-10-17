export async function api(action, body, query = {}) {
  const response = await fetch(
    `/api/app?${new URLSearchParams({ action, ...query })}`,
    {
      method: body === undefined ? "GET" : "POST",
      credentials: "include",
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  );
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("ارتباط با جیشو برقرار نشد.");
  }
  if (!response.ok) {
    const error = new Error(data.message || "یه بار دیگه امتحان کن.");
    error.code = data.error;
    throw error;
  }
  return data;
}
export async function getInvite(code) {
  const response = await fetch(
    `/api/app?action=invite&code=${encodeURIComponent(code)}`,
    { credentials: "include" },
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "دعوت پیدا نشد.");
  return data;
}
export const fa = (number) => Number(number || 0).toLocaleString("fa-IR");
export const inviteGiftLabel = (invite) => invite?.lifetimeGift
  ? "پرمیوم همیشگی هدیه"
  : `${fa(invite?.bonusDays || 7)} روز پرمیوم هدیه`;
export function relativeTime(value) {
  if (!value) return "هنوز جیشی ثبت نکرده";
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(value)) / 60000),
  );
  return minutes < 1
    ? "همین الان"
    : minutes < 60
      ? `${fa(minutes)} دقیقه پیش`
      : minutes < 1440
        ? `${fa(Math.floor(minutes / 60))} ساعت پیش`
        : "چند روز پیش";
}
export const inviteUrl = (data, code) =>
  `${data?.publicUrl || "https://jishoo.vercel.app"}/${code ? "?invite=" + encodeURIComponent(code) : ""}`;
export async function copyText(text) {
  if (navigator.clipboard?.writeText)
    return navigator.clipboard.writeText(text);
  const input = document.createElement("textarea");
  input.value = text;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.append(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("کپی خودکار انجام نشد؛ لینک رو دستی کپی کن.");
}
