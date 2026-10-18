const sameRecord = (a, b) => {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => Object.is(a[key], b[key]));
};

// Map responses are flat public marker records. Keep the existing array when
// a poll changes nothing, so Leaflet keeps its layers, canvases and focus.
export function stableActivity(previous, incoming) {
  const byId = new Map(previous.map(row => [row.id, row]));
  const next = incoming.map(row => {
    const old = byId.get(row.id);
    return old && sameRecord(old, row) ? old : row;
  });
  return previous.length === next.length && next.every((row, index) => row === previous[index]) ? previous : next;
}
