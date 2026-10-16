import { api } from "./api";
export const pushSupported = () =>
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;
function applicationKey(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(
    atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4)),
    (c) => c.charCodeAt(0),
  );
}
export async function enablePush(key) {
  if (!pushSupported() || !key)
    throw new Error(
      "اعلان سیستم روی این مرورگر در دسترس نیست؛ خبرها داخل جیشو می‌مونن.",
    );
  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    throw new Error(
      "اجازه‌ی اعلان داده نشده. از تنظیمات مرورگر می‌تونی فعالش کنی.",
    );
  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription)
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationKey(key),
    });
  await api("push-subscribe", { subscription: subscription.toJSON() });
  return true;
}
export async function disablePush() {
  if (!pushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    await api("push-unsubscribe", { endpoint: subscription.endpoint });
    await subscription.unsubscribe();
  }
}
