// Pedestrians: colourful walkers who stroll the sidewalks, turn at intersections, flee
// when a shot rings out nearby, and can be hit by a speeding car (which raises the wanted
// level). Each one is a small capsule figure with a bobbing walk.
import * as THREE from 'three';
import { CITY } from './config.js';
import { roadLines, collideBuildings } from './city.js';

const SHIRT_COLOURS = [0xe86a6a, 0x6aa8e8, 0x7ac87a, 0xe8d06a, 0xc07ae8, 0xe8e8e8, 0x6ad8d8];

export function createPedestrians(scene, rng, count) {
  const lines = roadLines();
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.38, 1.1, 8),
      new THREE.MeshLambertMaterial({ color: rng.pick(SHIRT_COLOURS) }),
    );
    body.position.y = 0.95;
    body.castShadow = true;
    group.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0xe8b88a }),
    );
    head.position.y = 1.75;
    head.castShadow = true;
    group.add(head);
    const x = rng.pick(lines) + rng.range(-8, 8);
    const z = rng.range(-CITY.half, CITY.half);
    group.position.set(x, 0, z);
    scene.add(group);
    peds.push({
      group, x, z, heading: rng.range(0, Math.PI * 2), speed: rng.range(1.2, 2.2),
      alive: true, fleeing: false, bob: rng.range(0, 6),
    });
  }
  return peds;
}

export function updatePedestrians(peds, dt, dangerPos, time, colliders) {
  for (const ped of peds) {
    if (!ped.alive) continue;
    let speed = ped.speed;
    if (dangerPos && Math.hypot(ped.x - dangerPos.x, ped.z - dangerPos.z) < 18) {
      ped.fleeing = true;
      speed = 4.5;
      ped.heading = Math.atan2(-(ped.x - dangerPos.x), -(ped.z - dangerPos.z));
    } else if (ped.fleeing && Math.random() < 0.01) {
      ped.fleeing = false;
    }
    if (Math.random() < 0.004) ped.heading += (Math.random() - 0.5) * 1.6;
    ped.x += -Math.sin(ped.heading) * speed * dt;
    ped.z += -Math.cos(ped.heading) * speed * dt;
    if (Math.abs(ped.x) > CITY.half - 4 || Math.abs(ped.z) > CITY.half - 4) ped.heading += Math.PI;
    collideBuildings(ped, 0.5, colliders || []);
    ped.group.position.set(ped.x, Math.abs(Math.sin(time * 6 + ped.bob)) * 0.06, ped.z);
    ped.group.rotation.y = ped.heading;
  }
}
