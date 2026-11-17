// Palma Bay itself: ground, roads on a grid, buildings, palm trees, beach and sea, the
// marina pier, the garage and the safehouse. All geometry is plain three.js boxes and
// cylinders with flat colours; no loaded assets. Roads are the lines x and z = multiples
// of the block pitch, so traffic and pedestrians can follow them by construction.
import * as THREE from 'three';
import { CITY, PALETTE } from './config.js';

export function roadLines() {
  const lines = [];
  const pitch = CITY.block + CITY.road;
  for (let i = -CITY.blocks; i <= CITY.blocks; i += 1) lines.push(i * pitch);
  return lines;
}

export function nearestRoadCoord(v) {
  const lines = roadLines();
  let best = lines[0];
  for (const line of lines) if (Math.abs(line - v) < Math.abs(best - v)) best = line;
  return best;
}

export function buildCity(scene, rng) {
  const colliders = [];
  const group = new THREE.Group();
  scene.add(group);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.half * 2 + 160, CITY.half * 2 + 160),
    new THREE.MeshLambertMaterial({ color: PALETTE.grass }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 60);
  ground.receiveShadow = true;
  group.add(ground);

  // Beach strip and sea beyond the south edge.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.half * 2 + 160, 46),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, CITY.half + 23);
  group.add(sand);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.half * 2 + 160, 220),
    new THREE.MeshLambertMaterial({ color: PALETTE.sea }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.01, CITY.half + 46 + 110);
  group.add(sea);

  // Roads: dark strips along every grid line, with pale centre dashes.
  const pitch = CITY.block + CITY.road;
  const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.road });
  const dashMat = new THREE.MeshLambertMaterial({ color: 0xd8d8c8 });
  for (const line of roadLines()) {
    for (const horizontal of [true, false]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(CITY.half * 2, CITY.road), roadMat);
      road.rotation.x = -Math.PI / 2;
      if (horizontal) road.rotation.z = Math.PI / 2;
      road.position.set(horizontal ? line : 0, 0.03, horizontal ? 0 : line);
      road.receiveShadow = true;
      group.add(road);
    }
    for (let d = -CITY.half + 10; d < CITY.half; d += 24) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.7), dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(d, 0.05, line);
      group.add(dash);
      const dash2 = dash.clone();
      dash2.position.set(line, 0.05, d);
      group.add(dash2);
    }
  }

  // Buildings fill each block between roads, with varied heights and colours.
  const buildingColours = [PALETTE.building, PALETTE.building2, PALETTE.building3, 0xc9b8d8, 0xa8c8b0];
  const buildingMat = buildingColours.map((c) => new THREE.MeshLambertMaterial({ color: c }));
  const windowMat = new THREE.MeshLambertMaterial({ color: 0x2c4a66 });
  for (let bx = -CITY.blocks; bx < CITY.blocks; bx += 1) {
    for (let bz = -CITY.blocks; bz < CITY.blocks; bz += 1) {
      const cx = bx * pitch + pitch / 2;
      const cz = bz * pitch + pitch / 2;
      if (Math.abs(cx) > CITY.half - 20 || Math.abs(cz) > CITY.half - 20) continue;
      const w = rng.range(18, 30);
      const d = rng.range(18, 30);
      const h = rng.range(9, 34);
      const building = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), rng.pick(buildingMat));
      building.position.set(cx, h / 2, cz);
      building.castShadow = true;
      building.receiveShadow = true;
      group.add(building);
      colliders.push({ x: cx, z: cz, hw: w / 2 + 0.6, hd: d / 2 + 0.6 });
      const windows = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, h * 0.55, 0.2), windowMat);
      windows.position.set(cx, h * 0.55, cz + d / 2 + 0.05);
      group.add(windows);
    }
  }

  // Palm trees along the beachfront avenue and scattered on sidewalks.
  const trunkMat = new THREE.MeshLambertMaterial({ color: PALETTE.trunk });
  const leafMat = new THREE.MeshLambertMaterial({ color: PALETTE.palm });
  function palm(x, z) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 7, 6), trunkMat);
    trunk.position.set(x, 3.5, z);
    trunk.castShadow = true;
    group.add(trunk);
    for (let i = 0; i < 5; i += 1) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.1, 3.4, 4), leafMat);
      const angle = (i / 5) * Math.PI * 2;
      leaf.position.set(x + Math.cos(angle) * 1.1, 7.4, z + Math.sin(angle) * 1.1);
      leaf.rotation.z = Math.cos(angle) * 0.9;
      leaf.rotation.x = -Math.sin(angle) * 0.9;
      group.add(leaf);
    }
  }
  for (let x = -180; x <= 180; x += 24) { palm(x, CITY.half - 8); palm(x + 12, -CITY.half + 8); }
  for (let i = 0; i < 18; i += 1) palm(rng.range(-180, 180), rng.range(-180, 180));

  // Marina pier jutting into the sea, and the garage + safehouse markers as buildings.
  const pier = new THREE.Mesh(new THREE.BoxGeometry(60, 1, 26), new THREE.MeshLambertMaterial({ color: 0x8a6a44 }));
  pier.position.set(120, 0.5, CITY.half + 58);
  pier.castShadow = true;
  group.add(pier);
  const garage = new THREE.Mesh(new THREE.BoxGeometry(20, 8, 14), new THREE.MeshLambertMaterial({ color: 0xe05545 }));
  garage.position.set(-150, 4, -150);
  garage.castShadow = true;
  group.add(garage);
  colliders.push({ x: -150, z: -150, hw: 10.6, hd: 7.6 });
  const safehouse = new THREE.Mesh(new THREE.BoxGeometry(18, 10, 14), new THREE.MeshLambertMaterial({ color: 0x4a90d9 }));
  safehouse.position.set(150, 5, 150);
  safehouse.castShadow = true;
  group.add(safehouse);
  colliders.push({ x: 150, z: 150, hw: 9.6, hd: 7.6 });

  return { group, colliders, garagePos: { x: -150, z: -132 }, safehousePos: { x: 150, z: 132 }, marinaPos: { x: 120, z: CITY.half + 58 } };
}

// Push a circle (player, pedestrian) out of building boxes so nobody walks through walls.
export function collideBuildings(pos, radius, colliders) {
  for (const c of colliders) {
    const dx = pos.x - c.x;
    const dz = pos.z - c.z;
    if (Math.abs(dx) < c.hw + radius && Math.abs(dz) < c.hd + radius) {
      const pushX = c.hw + radius - Math.abs(dx);
      const pushZ = c.hd + radius - Math.abs(dz);
      if (pushX < pushZ) pos.x = c.x + Math.sign(dx || 1) * (c.hw + radius);
      else pos.z = c.z + Math.sign(dz || 1) * (c.hd + radius);
    }
  }
  pos.x = Math.max(-CITY.half, Math.min(CITY.half, pos.x));
  pos.z = Math.max(-CITY.half, Math.min(CITY.half + 40, pos.z));
}
