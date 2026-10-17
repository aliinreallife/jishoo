// Derive invitation ancestry from registered members, independently of friendships.
export function invitationForest(members) {
  const nodes = new Map(members.map((member) => [member.id, {
    ...member, parentId: member.invitedBy || null, children: [], descendants: 0, level: 0,
  }]));
  for (const node of nodes.values()) {
    if (node.parentId === node.id) { node.parentId = null; node.inconsistent = true; }
    else if (!nodes.has(node.parentId)) node.parentId = null;
  }
  // Merged/imported data must never cause a circular or recursive UI.
  const visited = new Map();
  for (const start of nodes.values()) {
    let current = start;
    const path = [];
    while (current && !visited.has(current.id)) {
      visited.set(current.id, 1); path.push(current);
      current = nodes.get(current.parentId);
    }
    if (current && visited.get(current.id) === 1) {
      current.parentId = null;
      current.inconsistent = true;
    }
    for (const item of path) visited.set(item.id, 2);
  }
  const roots = [];
  for (const node of nodes.values()) {
    const parent = nodes.get(node.parentId);
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const ordered = [...roots];
  for (let i = 0; i < ordered.length; i++) {
    const node = ordered[i];
    for (const child of node.children) {
      child.level = node.level + 1;
      ordered.push(child);
    }
  }
  for (let i = ordered.length - 1; i >= 0; i--) {
    const node = ordered[i];
    node.descendants = node.children.reduce((total, child) => total + child.descendants + 1, 0);
  }
  return { nodes, roots, levels: ordered.reduce((max, node) => Math.max(max, node.level), 0) };
}

export function invitationPath(nodes, id) {
  const path = [];
  for (let node = nodes.get(id); node; node = nodes.get(node.parentId)) path.push(node);
  return path.reverse();
}
