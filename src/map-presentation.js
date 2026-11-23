export const activityWeight = (point) => Math.max(1, Number(point.count) || 1);
export const nearestLongitude = (longitude, center) => longitude + Math.round((center - longitude) / 360) * 360;

// Group visual collisions, rather than assuming different coordinates never overlap.
// Input coordinates remain unchanged; x/y are positions in the current viewport.
export function mapPresentation(points, zoom, width, height) {
  const visible = points.filter((point) => point.x >= 0 && point.x <= width && point.y >= 0 && point.y <= height);
  const parents = visible.map((_, index) => index), buckets = new Map();
  const find = (index) => { while (parents[index] !== index) { parents[index] = parents[parents[index]]; index = parents[index]; } return index; };
  visible.forEach((point, index) => {
    const x = Math.floor(point.x / 56), y = Math.floor(point.y / 56);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const other of buckets.get(`${x + dx}:${y + dy}`) || []) {
        if (Math.hypot(point.x - visible[other].x, point.y - visible[other].y) < 56) parents[find(index)] = find(other);
      }
    }
    const key = `${x}:${y}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(index);
  });
  const grouped = new Map();
  visible.forEach((point, index) => {
    const key = find(index);
    if (!grouped.has(key)) grouped.set(key, { points: [], count: 0, x: 0, y: 0 });
    const group = grouped.get(key), weight = activityWeight(point);
    group.points.push(point); group.count += weight; group.x += point.x * weight; group.y += point.y * weight;
  });
  const groups = [...grouped.values()].map((group) => ({ ...group, x: group.x / group.count, y: group.y / group.count }));
  const count = groups.reduce((sum, group) => sum + group.count, 0);
  const crowded = groups.filter((group) => group.count > 1).reduce((sum, group) => sum + group.count, 0);
  // Sparse areas keep their characters at every zoom. No fake activity or faint lone dots.
  const heat = zoom < 18 && count > 5 && (groups.some((group) => group.count >= 6) || (crowded >= 8 && crowded > count / 2));
  return { mode: heat ? "heat" : "characters", groups, visible, count };
}

// Spread small local groups in screen space. Stable participant keys keep
// the visual arrangement in place when a refresh returns a new check-in.
export function spreadLocalGroups(groups, width, height) {
  const placed = [];
  return groups.flatMap((group) => {
    if (group.points.length < 2 || group.points.length > 5 || group.count !== group.points.length) {
      placed.push(group);
      return group;
    }

    const points = [...group.points].sort((a, b) => String(a.markerKey || a.id).localeCompare(String(b.markerKey || b.id)));
    let seed = 0;
    for (const point of points) {
      for (const char of String(point.markerKey || point.id)) seed = (Math.imul(seed, 31) + char.codePointAt(0)) >>> 0;
    }

    const step = (2 * Math.PI) / points.length;
    const radius = 34 / Math.sin(step / 2);
    const padding = Math.ceil(radius) + 27;
    if (width < 2 * padding || height < 2 * padding) {
      placed.push(group);
      return group;
    }

    const x = Math.max(padding, Math.min(width - padding, group.x));
    const y = Math.max(padding, Math.min(height - padding, group.y));
    const blocked = placed.concat(groups.filter(other => other !== group));
    for (let attempt = 0; attempt < 8; attempt++) {
      const rotation = (seed % 360) * Math.PI / 180 + attempt * step / 8;
      const pins = points.map((point, index) => {
        const angle = rotation + index * step;
        return { points: [point], count: 1, x: x + Math.cos(angle) * radius, y: y + Math.sin(angle) * radius, anchor: group };
      });
      if (pins.every(pin => blocked.every(other => Math.hypot(pin.x - other.x, pin.y - other.y) >= 56))) {
        placed.push(...pins);
        return pins;
      }
    }
    placed.push(group);
    return group;
  });
}
