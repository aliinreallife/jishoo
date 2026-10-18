// Share only simultaneous reads. Settled results are never cached, and a write
// changes the generation so another account/action cannot reuse an older read.
export function createRequestCoordinator() {
  const pending = new Map();
  let revision = 0;
  function invalidate() { revision++; pending.clear(); }
  return {
    revision: () => revision,
    async run(key, mutation, load) {
      if (mutation) {
        invalidate();
        try { return await load(); }
        finally { invalidate(); }
      }
      if (pending.has(key)) return pending.get(key);
      const task = Promise.resolve().then(load);
      pending.set(key, task);
      try { return await task; }
      finally { if (pending.get(key) === task) pending.delete(key); }
    },
  };
}
