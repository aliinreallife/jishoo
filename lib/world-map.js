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
  // A bounded grid keeps a world view small; zooming reveals finer anonymous dots.
  const step = Math.max(.002, 360 / 2 ** (Math.floor(box.zoom) + 3));
  const groups = new Map();
  for (const row of rows) {
    const longitude = box.west <= box.east ? row.lng >= box.west && row.lng <= box.east : row.lng >= box.west || row.lng <= box.east;
    if (!longitude || row.lat < box.south || row.lat > box.north) continue;
    const x = Math.floor((row.lng + 180) / step), y = Math.floor((row.lat + 90) / step);
    const key = `world:${step}:${x}:${y}`;
    let item = groups.get(key);
    if (!item) {
      item = { id: key, lat: Math.min(90, -90 + (y + .5) * step), lng: Math.min(180, -180 + (x + .5) * step), count: 0, status: "done", createdAt: row.createdAt, name: "یه نفر روی نقشه", isFriend: false, isMe: false };
      groups.set(key, item);
    }
    item.count++;
    if (+new Date(row.createdAt) >= +new Date(item.createdAt)) { item.createdAt = row.createdAt; item.status = row.status; }
  }
  const all = [...groups.values()].sort((a,b) => b.count-a.count || +new Date(b.createdAt)-+new Date(a.createdAt));
  return { activity: all.slice(0, 240), total: rows.length, inView: all.reduce((sum,row)=>sum+row.count,0), limited: all.length>240, approximate: true, refreshSeconds: 30 };
}

export async function worldMap(params) {
  const viewport = worldViewport(params);
  return clusterWorldActivity(await snapshot(), viewport);
}
