// Combat on foot: a simple pistol with a short cooldown. Clicking fires a ray from the
// camera through the crosshair; a hit on a police officer or a rival removes them and
// raises heat. Police officers shoot back on a timer when close enough.
export function createCombat() {
  return { cooldown: 0, shotsFired: 0, hits: 0 };
}

export function tryShoot(combat, dt, origin, direction, targets) {
  combat.cooldown -= dt;
  if (combat.cooldown > 0) return null;
  combat.cooldown = 0.28;
  combat.shotsFired += 1;
  let best = null;
  let bestDist = 60;
  for (const target of targets) {
    if (!target.alive) continue;
    const dx = target.x - origin.x;
    const dy = 1.2 - origin.y;
    const dz = target.z - origin.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist > bestDist) continue;
    const dot = (dx * direction.x + dy * direction.y + dz * direction.z) / dist;
    if (dot > 0.985) { best = target; bestDist = dist; }
  }
  if (best) {
    combat.hits += 1;
    best.alive = false;
    if (best.group) best.group.visible = false;
    return best;
  }
  return null;
}

export function policeShotDamage(distance) {
  if (distance > 24) return 0;
  return 4 + Math.round((24 - distance) / 4);
}
