import { observeUpdateWorker } from "./updates";

let installPrompt = null;
export const isStandalone = () =>
  typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches ||
  navigator.standalone === true);
export const isAppleMobile = () =>
  typeof navigator !== "undefined" && (/iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
const changed = () => window.dispatchEvent(new Event("jishoo-install-change"));
if (typeof window !== "undefined") {
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  changed();
});
window.addEventListener("appinstalled", () => {
  installPrompt = null;
  changed();
});
}
export const canPromptInstall = () => Boolean(installPrompt) && !isStandalone();
export async function promptInstall() {
  if (!installPrompt) return false;
  const prompt = installPrompt;
  installPrompt = null;
  try {
    await prompt.prompt();
    const result = await prompt.userChoice;
    return result.outcome === "accepted";
  } catch {
    return false;
  } finally {
    changed();
  }
}
export function registerPwa() {
  if ("serviceWorker" in navigator && window.isSecureContext) {
    const register = () =>
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((r) => {
          observeUpdateWorker(r);
          r.update().catch(() => {});
        })
        .catch(() => {});
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }
}
