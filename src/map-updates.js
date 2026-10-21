const eventName = "jishoo:map-changed";
const relevant = new Set(["checkin", "location", "map-visibility", "connection-request", "connection-respond", "delete-account"]);

export function announceMapChange(action) {
  if (!relevant.has(action)) return;
  window.dispatchEvent(new Event(eventName));
  try {
    const channel = new BroadcastChannel(eventName);
    channel.postMessage("refresh"); // No status, identity or location crosses tabs.
    channel.close();
  } catch { /* Older browsers still refresh through polling and focus. */ }
}

export function subscribeMapChanges(update) {
  window.addEventListener(eventName, update);
  let channel;
  try { channel = new BroadcastChannel(eventName); channel.onmessage = update; } catch {}
  return () => { window.removeEventListener(eventName, update); channel?.close(); };
}

export const participantKey = point => point.markerKey || point.id;
export function refreshedSelection(current, incoming) {
  return current ? incoming.find(point => participantKey(point) === participantKey(current)) || null : null;
}
