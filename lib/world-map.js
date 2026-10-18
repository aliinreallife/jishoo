import { query, transaction } from "./database.js";

const cacheLock = 177360192;
export async function invalidateWorldMap() {
  await transaction([
    ["SELECT pg_advisory_xact_lock($1)", [cacheLock]],
    ["DELETE FROM world_map_cache WHERE key='activity'"],
  ]);
}

async function snapshot() {
  const hit = await query("SELECT payload FROM world_map_cache WHERE key='activity' AND expires_at>NOW()");
  if (hit[0]) return hit[0].payload;
  const results = await transaction([
    ["SELECT pg_advisory_xact_lock($1)", [cacheLock]],
    [`INSERT INTO world_map_cache(key,payload,expires_at)
      SELECT 'activity',COALESCE(jsonb_agg(jsonb_build_object('lat',r.location_lat,'lng',r.location_lng,'status',r.status,'createdAt',r.created_at)),'[]'::jsonb),NOW()+INTERVAL '30 seconds'
      FROM (SELECT DISTINCT ON(e.user_id) e.user_id,e.location_lat,e.location_lng,e.status,e.created_at
        FROM checkins e JOIN users u ON u.id=e.user_id
        WHERE NOT u.banned AND u.share_location AND u.location_updated_at>NOW()-INTERVAL '1 hour'
        AND e.created_at>NOW()-INTERVAL '30 minutes' AND e.location_lat IS NOT NULL AND e.location_lng IS NOT NULL
        AND (e.visibility='friends' OR NOT u.registered)
        ORDER BY e.user_id,e.created_at DESC) r
      HAVING NOT EXISTS(SELECT 1 FROM world_map_cache WHERE key='activity' AND expires_at>NOW())
      ON CONFLICT(key) DO UPDATE SET payload=EXCLUDED.payload,expires_at=EXCLUDED.expires_at`],
    ["SELECT payload FROM world_map_cache WHERE key='activity'"],
  ]);
  return results[2][0]?.payload || [];
}

export function worldViewport(params) {
  const read = (name, fallback) => params.has(name) ? Number(params.get(name)) : fallback;
  const box = { south: read("south", -85), north: read("north", 85), west: read("west", -180), east: read("east", 180), zoom: read("zoom", 2) };
  if (!Object.values(box).every(Number.isFinite) || box.south < -90 || box.north > 90 || box.south > box.north || box.west < -180 || box.west > 180 || box.east < -180 || box.east > 180 || box.zoom < 0 || box.zoom > 19) throw new Error("محدودهٔ نقشه معتبر نیست.");
  return box;
}

export function clusterWorldActivity(rows, box) {
  const visible = rows.filter((row) => {
    const longitude = box.west <= box.east ? row.lng >= box.west && row.lng <= box.east : row.lng >= box.west || row.lng <= box.east;
    return longitude && row.lat >= box.south && row.lat <= box.north;
  });
  let step = Math.max(.002, 360 / 2 ** (Math.floor(box.zoom) + 3)), groups, limited = false;
  // Coarsen the whole view instead of dropping low-population areas at a cap.
  do {
    groups = new Map();
    for (const row of visible) {
      const x = Math.floor((row.lng + 180) / step), y = Math.floor((row.lat + 90) / step);
      const key = `world:${step}:${x}:${y}`;
      if (!groups.has(key)) groups.set(key, { id: key, lat: 0, lng: 0, count: 0, status: row.status, createdAt: row.createdAt, name: "یه نفر روی نقشه", isFriend: false, isMe: false });
      const item = groups.get(key);
      item.count++; item.lat += row.lat; item.lng += row.lng;
      if (+new Date(row.createdAt) >= +new Date(item.createdAt)) { item.createdAt = row.createdAt; item.status = row.status; }
    }
    if (groups.size <= 240) break;
    step *= 2; limited = true;
  } while (step <= 720);
  const activity = [...groups.values()].map((item) => ({
    ...item,
    // Input is already approximate. Keep the 0.002° privacy grid, but don't
    // displace a lone participant to the center of a continent-sized cell.
    lat: Math.round(item.lat / item.count / .002) * .002,
    lng: Math.round(item.lng / item.count / .002) * .002,
  }));
  return { activity, total: rows.length, inView: visible.length, limited, approximate: true, refreshSeconds: 30 };
}

export async function worldMap(params) {
  const viewport = worldViewport(params);
  return clusterWorldActivity(await snapshot(), viewport);
}
