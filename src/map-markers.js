// Offset icon anchors, never coordinates: several people can share a privacy
// grid cell without pretending we know their exact physical position.
export function markerOffsets(items) {
  const groups = new Map();
  for (const item of items) {
    const key = `${item.lat}:${item.lng}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  const offsets = new Map();
  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) =>
      String(a.markerKey || a.id).localeCompare(String(b.markerKey || b.id)),
    );
    sorted.forEach((item, i) => {
      const angle = (2 * Math.PI * i) / sorted.length,
        radius = sorted.length === 1 ? 0 : sorted.length === 2 ? 31 : 48;
      offsets.set(item.id, {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        cluster: sorted.length > 8 ? sorted : null,
      });
    });
  }
  return offsets;
}
