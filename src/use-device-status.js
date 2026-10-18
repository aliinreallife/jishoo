import { useEffect, useState } from "react";
import { pushStatus } from "./push";

// Reading Permissions API state never opens a native permission prompt.
export function useDeviceStatus(accountId) {
  const [push, setPush] = useState(false), [geolocation, setGeolocation] = useState("unknown");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true, permission;
    const changed = () => { if (active) setGeolocation(permission.state); };
    const read = async () => {
      pushStatus().then(value => { if (active) setPush(value); }).catch(() => {});
      try {
        const next = await navigator.permissions?.query({ name: "geolocation" });
        if (!active || !next) return;
        permission?.removeEventListener("change", changed);
        permission = next; permission.addEventListener("change", changed); changed();
      } catch { /* Some browsers do not expose geolocation permission state. */ }
    };
    read(); window.addEventListener("focus", read); window.addEventListener("jishoo:push-changed", read);
    return () => { active = false; window.removeEventListener("focus", read); window.removeEventListener("jishoo:push-changed", read); permission?.removeEventListener("change", changed); };
  }, [accountId, revision]);
  return { push, geolocation, refresh: () => setRevision(value => value + 1) };
}
