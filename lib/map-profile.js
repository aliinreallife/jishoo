// Local-map identity is an explicit opt-in, except for an existing friendship
// or the viewer's own point. World-map aggregation never calls this function.
export function mapProfile(row, viewerId) {
  const own = row.user_id === viewerId;
  const visible = Boolean(row.registered && row.handle && (own || row.connection_id || row.discoverable));
  return {
    profileHandle: visible ? row.handle : null,
    profileKind: visible ? "profile" : row.registered ? "anonymous" : "guest",
    name: own ? "خودت" : visible ? row.name : row.registered ? "یه همسایه" : "مهمان جیشو",
    avatarSeed: visible || own ? row.avatar_seed : "neighbor:" + row.id,
    avatarImage: visible || own ? row.avatar_image || null : null,
  };
}
