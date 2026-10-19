import { validRelease, updateRequired } from "./update-rules";

const current = __JISHOO_BUILD__;
const listeners = new Set(), blockers = new Set(), dirtyInputs = new Map();
const snoozeKey = "jishoo:update-later";
let latest = null, registration = null, started = false, applying = false;
let error = "", lastCheck = 0, checking = null, deferred = null, domBlocked = false;
const initialSnapshot = { available: false, blocked: true, online: typeof navigator !== "undefined" && navigator.onLine !== false, applying: false };
let snapshot = initialSnapshot;
const inputValue = (input) => input.isContentEditable ? input.textContent : ["checkbox", "radio"].includes(input.type) ? input.checked : input.value;

function publish() {
  snapshot = {
    available: Boolean(latest && latest.buildId !== current.buildId),
    mandatory: Boolean(latest && updateRequired(current.version, latest)),
    blocked: blockers.size > 0 || domBlocked,
    deferred: Boolean(deferred && latest && deferred.buildId === latest.buildId && deferred.until > Date.now()),
    online: navigator.onLine, applying, error,
  };
  listeners.forEach((listener) => listener());
}
export const subscribeUpdates = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };
export const getUpdateState = () => snapshot;
export const getServerUpdateState = () => initialSnapshot;

// Also used by API mutations, so updates cannot interrupt saves outside App.
export function blockUpdates() {
  const token = Symbol();
  blockers.add(token); publish();
  return () => { blockers.delete(token); publish(); };
}

function inspectPage() {
  for (const [input, original] of dirtyInputs) {
    const value = inputValue(input);
    if (!input.isConnected || value === original) dirtyInputs.delete(input);
  }
  const modal = [...document.querySelectorAll('[aria-modal="true"], .overlay-backdrop')]
    .some((node) => !node.closest("[data-app-update]") && node.getClientRects().length);
  const blocked = modal || dirtyInputs.size > 0;
  if (blocked !== domBlocked) { domBlocked = blocked; publish(); }
}

async function readRelease() {
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch("/version.json", { cache: "no-store", credentials: "omit", signal: controller.signal });
    if (!response.ok) throw new Error("version_unavailable");
    const value = await response.json();
    if (!validRelease(value)) throw new Error("invalid_version");
    return value;
  } finally { clearTimeout(timeout); }
}

export async function checkForUpdate(force = false) {
  if (!navigator.onLine || document.visibilityState !== "visible") return;
  if (checking) return checking;
  if (!force && Date.now() - lastCheck < 60000) return;
  lastCheck = Date.now();
  checking = (async () => {
    try { latest = await readRelease(); publish(); }
    catch { /* Offline and deployment failures must never break the app. */ }
    finally { checking = null; }
  })();
  return checking;
}

export function observeUpdateWorker(value) {
  registration = value;
  const inspect = () => {
    if (value.waiting) checkForUpdate(true);
    const installing = value.installing;
    installing?.addEventListener("statechange", () => {
      if (installing.state === "installed") checkForUpdate(true);
    });
  };
  value.addEventListener("updatefound", inspect);
  inspect();
}

function waitForWorker(worker, target, timeoutMs) {
  if (worker.state === target) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const finish = (failure) => {
      clearTimeout(timeout); worker.removeEventListener("statechange", changed);
      failure ? reject(new Error("worker_activation_failed")) : resolve();
    };
    const changed = () => {
      if (worker.state === target) finish(false);
      else if (worker.state === "redundant") finish(true);
    };
    const timeout = setTimeout(() => finish(true), timeoutMs);
    worker.addEventListener("statechange", changed); changed();
  });
}

export async function applyUpdate() {
  inspectPage();
  if (applying || snapshot.blocked || !navigator.onLine) return;
  applying = true; error = ""; publish();
  try {
    latest = await readRelease();
    if (latest.buildId === current.buildId) return;
    if (!registration && "serviceWorker" in navigator) registration = await navigator.serviceWorker.getRegistration("/");
    if (registration) {
      // HTML is network-first, so a failed worker check does not require a forced reload.
      await registration.update().catch(() => {});
      if (registration.installing) await waitForWorker(registration.installing, "installed", 10000);
      inspectPage();
      if (snapshot.blocked) throw new Error("busy");
      if (registration.waiting) {
        const waiting = registration.waiting;
        waiting.postMessage({ type: "JISHOO_SKIP_WAITING", buildId: latest.buildId });
        await waitForWorker(waiting, "activated", 10000);
      }
    }
    inspectPage();
    if (snapshot.blocked || !navigator.onLine) throw new Error("busy");
    // Reload only this tab, preserving its complete URL and login session.
    window.location.reload();
  } catch {
    error = "به‌روزرسانی انجام نشد؛ کارت رو تموم کن و دوباره امتحان کن.";
  } finally { applying = false; publish(); }
}

export function deferUpdate() {
  if (!latest || updateRequired(current.version, latest)) return;
  deferred = { buildId: latest.buildId, until: Date.now() + 60 * 60 * 1000 };
  try { sessionStorage.setItem(snoozeKey, JSON.stringify(deferred)); } catch {}
  publish();
}

export function startUpdates() {
  if (started) return;
  started = true;
  try { deferred = JSON.parse(sessionStorage.getItem(snoozeKey)); } catch {}
  const rememberInput = (event) => {
    const input = event.target;
    if (!input.matches?.('input:not([type=hidden]):not([type=button]):not([type=submit]), textarea, [contenteditable="true"]') || input.closest("[data-app-update]")) return;
    if (!dirtyInputs.has(input)) dirtyInputs.set(input, inputValue(input));
  };
  document.addEventListener("beforeinput", rememberInput, true);
  document.addEventListener("focusin", rememberInput, true);
  document.addEventListener("input", inspectPage, true);
  document.addEventListener("change", inspectPage, true);
  const observer = new MutationObserver(inspectPage);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-modal"] });
  const resume = () => {
    inspectPage();
    if (navigator.onLine && document.visibilityState === "visible" && Date.now() - lastCheck >= 60000) {
      checkForUpdate(); registration?.update().catch(() => {});
    }
  };
  window.addEventListener("focus", resume);
  window.addEventListener("pageshow", resume);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") resume(); });
  window.addEventListener("online", () => { publish(); checkForUpdate(true); });
  window.addEventListener("offline", publish);
  navigator.serviceWorker?.addEventListener("controllerchange", () => checkForUpdate(true));
  setInterval(() => {
    if (document.visibilityState === "visible" && navigator.onLine) {
      publish(); checkForUpdate(true); registration?.update().catch(() => {});
    }
  }, 5 * 60 * 1000);
  publish(); checkForUpdate();
}
