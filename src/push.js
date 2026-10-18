import { api } from "./api";
export const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
export const installed = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  navigator.standalone === true;
export const pushSupported = () =>
  window.isSecureContext &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;
export function pushEnvironment() {
  if (isIOS() && !installed()) return "install";
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  return "ready";
}
function applicationKey(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(
    atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4)),
    (c) => c.charCodeAt(0),
  );
}
async function worker() {
  await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
  let timer;
  try {
    return await Promise.race([
      (async () => {
        const registration = await navigator.serviceWorker.ready;
        const active = registration.active;
        if (active && active.state !== "activated")
          await new Promise((resolve, reject) => {
            const changed = () => {
              if (active.state === "activated") {
                active.removeEventListener("statechange", changed);
                resolve();
              } else if (active.state === "redundant") {
                active.removeEventListener("statechange", changed);
                reject(new Error("اعلان آماده نشد؛ دوباره امتحان کن."));
              }
            };
            active.addEventListener("statechange", changed);
            changed();
          });
        return registration;
      })(),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("اعلان آماده نشد؛ دوباره امتحان کن.")),
          15000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
export async function pushStatus() {
  if (!pushSupported() || Notification.permission !== "granted") return false;
  const registration = await navigator.serviceWorker.getRegistration("/");
  return Boolean(await registration?.pushManager.getSubscription());
}
export async function syncPush() {
  if (!pushSupported() || Notification.permission !== "granted") return false;
  const registration = await worker();
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return false;
  await api("push-subscribe", { subscription: subscription.toJSON() });
  return true;
}
export async function enablePush(key) {
  if (pushEnvironment() === "install")
    throw new Error(
      "روی آیفون، اول جیشو رو به صفحهٔ اصلی اضافه کن و از همون آیکن بازش کن.",
    );
  if (!pushSupported() || !key)
    throw new Error("اعلان سیستم روی این مرورگر آماده نیست.");
  // Called directly by the confirm button, preserving the browser's user gesture.
  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    throw new Error(
      "اجازهٔ اعلان داده نشده؛ از تنظیمات مرورگر برای جیشو فعالش کن.",
    );
  const registration = await worker();
  let subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    const current = subscription.options.applicationServerKey;
    const expected = applicationKey(key);
    if (
      current &&
      Array.from(new Uint8Array(current)).some((v, i) => v !== expected[i])
    ) {
      await subscription.unsubscribe();
      subscription = null;
    }
  }
  if (!subscription)
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationKey(key),
    });
  await api("push-subscribe", { subscription: subscription.toJSON() });
  window.dispatchEvent(new Event("jishoo:push-changed"));
  return true;
}
export async function disablePush() {
  if (!pushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    try {
      await api("push-unsubscribe", { endpoint: subscription.endpoint });
    } finally {
      await subscription.unsubscribe();
      window.dispatchEvent(new Event("jishoo:push-changed"));
    }
  }
}
export async function testPush() {
  return api("push-test", {});
}
