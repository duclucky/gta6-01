// The Palma Bay police: patrol cars that spawn at the city edge when the wanted level
// rises, chase the player, ram the player's car, and officers who chase on foot and
// arrest on contact. More stars means more cars, faster cars and a wider spawn.
import * as THREE from 'three';
import { CITY, WANTED_MAX } from './config.js';
import { buildCarMesh } from './vehicles.js';

export function createPolice(scene) {
  return { cars: [], officers: [], sirenOn: false };
}

function spawnPoliceCar(scene, rng, target) {
  const angle = rng.range(0, Math.PI * 2);
  const x = target.x + Math.cos(angle) * 70;
  const z = target.z + Math.sin(angle) * 70;
  const { group, wheels } = buildCarMesh(0x1c1c22);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.2, 4.42), new THREE.MeshLambertMaterial({ color: 0xffffff }));
  stripe.position.y = 0.72;
  group.add(stripe);
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff2020 });
  const beacon = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 0.5), beaconMat);
  beacon.position.y = 1.55;
  group.add(beacon);
  group.position.set(x, 0, z);
  scene.add(group);
  return {
    group, wheels, beacon, beaconMat, x, z,
    heading: 0, speed: 0, police: true, traffic: false, parked: false, damaged: false,
  };
}

function spawnOfficer(scene, x, z) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.4, 1.15, 8),
    new THREE.MeshLambertMaterial({ color: 0x1c2c4a }),
  );
  body.position.y = 0.95;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), new THREE.MeshLambertMaterial({ color: 0xe8b88a }));
  head.position.y = 1.78;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 10), new THREE.MeshLambertMaterial({ color: 0x101828 }));
  cap.position.y = 2.0;
  group.add(cap);
  group.position.set(x, 0, z);
  scene.add(group);
  return { group, x, z, heading: 0, alive: true, shootTimer: 0 };
}

export function updatePolice(police, scene, rng, dt, wanted, target, targetInCar, time) {
  const wantedCars = Math.min(wanted, 4);
  while (police.cars.length < wantedCars) police.cars.push(spawnPoliceCar(scene, rng, target));
  while (police.cars.length > wantedCars) {
    const car = police.cars.pop();
    scene.remove(car.group);
  }
  const wantedOfficers = wanted >= 2 && !targetInCar ? Math.min(wanted - 1, 3) : 0;
  while (police.officers.length < wantedOfficers) {
    police.officers.push(spawnOfficer(scene, target.x + rng.range(-25, 25), target.z + rng.range(-25, 25)));
  }
  while (police.officers.length > wantedOfficers) {
    const officer = police.officers.pop();
    scene.remove(officer.group);
  }
  police.sirenOn = wanted > 0;

  let rammed = false;
  for (const car of police.cars) {
    const dx = target.x - car.x;
    const dz = target.z - car.z;
    const dist = Math.hypot(dx, dz);
    const desired = Math.atan2(-dx, -dz);
    let diff = desired - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    const topSpeed = 24 + wanted * 4;
    car.speed = Math.min(topSpeed, car.speed + 18 * dt);
    if (dist < 4) {
      car.speed = Math.max(0, car.speed - 20 * dt);
      rammed = true;
    }
    car.x += -Math.sin(car.heading) * car.speed * dt;
    car.z += -Math.cos(car.heading) * car.speed * dt;
    car.x = Math.max(-CITY.half, Math.min(CITY.half, car.x));
    car.z = Math.max(-CITY.half, Math.min(CITY.half + 40, car.z));
    car.group.position.set(car.x, 0, car.z);
    car.group.rotation.y = car.heading;
    car.beaconMat.color.setHex(Math.sin(time * 9) > 0 ? 0xff2020 : 0x2040ff);
    for (const wheel of car.wheels) wheel.rotation.x += car.speed * dt * 2;
  }

  let arrested = false;
  let shotAt = false;
  for (const officer of police.officers) {
    const dx = target.x - officer.x;
    const dz = target.z - officer.z;
    const dist = Math.hypot(dx, dz);
    officer.heading = Math.atan2(-dx, -dz);
    const speed = 5.2;
    officer.x += -Math.sin(officer.heading) * speed * dt;
    officer.z += -Math.cos(officer.heading) * speed * dt;
    officer.group.position.set(officer.x, 0, officer.z);
    officer.group.rotation.y = officer.heading;
    if (dist < 1.6) arrested = true;
    officer.shootTimer -= dt;
    if (dist < 22 && dist > 4 && officer.shootTimer <= 0) {
      officer.shootTimer = 1.6;
      shotAt = true;
    }
  }
  return { rammed, arrested, shotAt };
}

export function clearPolice(police, scene) {
  for (const car of police.cars) scene.remove(car.group);
  for (const officer of police.officers) scene.remove(officer.group);
  police.cars = [];
  police.officers = [];
  police.sirenOn = false;
}
export { WANTED_MAX };
