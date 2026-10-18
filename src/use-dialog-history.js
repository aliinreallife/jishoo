import { useCallback, useRef } from "react";

// Ephemeral screens get real Back entries, without putting private state in URLs.
// Old entries after a reload cannot revive a confirmation or pending action.
export function useDialogHistory(location, navigate, baseDialog = null, accountId = null) {
  const owner = useRef();
  if (!owner.current || owner.current.accountId !== accountId) owner.current = { accountId, id: crypto.randomUUID() };
  const state = location.state?.jishooDialog;
  const overlay = state?.owner === owner.current.id ? state : null;
  const dialog = overlay?.name || baseDialog;
  const latest = useRef();
  latest.current = { location, overlay, dialog, baseDialog };
  const setDialog = useCallback((value) => {
    const current = latest.current;
    const name = typeof value === "function" ? value(current.dialog) : value;
    if (name === current.dialog) return;
    if (!name || name === current.baseDialog) {
      if (current.overlay) navigate(-1);
      return;
    }
    // Sharing is a child screen; automatic result/confirmation transitions
    // replace the current screen so Back never replays the previous action.
    const child = ["story", "momentStory"].includes(name) && current.overlay;
    const params = new URLSearchParams(current.location.search);
    params.delete("google"); params.delete("login");
    navigate(current.location.pathname + (params.size ? "?" + params : "") + current.location.hash, {
      replace: Boolean(current.overlay && !child),
      state: { ...current.location.state, jishooDialog: { owner: owner.current.id, name, depth: (current.overlay?.depth || 0) + (child || !current.overlay ? 1 : 0) } },
    });
  }, [navigate]);
  const closeAll = useCallback(() => {
    if (latest.current.overlay) navigate(-latest.current.overlay.depth);
  }, [navigate]);
  return { dialog, setDialog, overlay, closeAll };
}
