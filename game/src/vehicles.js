// Cars: building them from boxes, arcade driving for the player, and simple traffic that
// follows the road grid. A car is a group with body, cabin, wheels and headlights; traffic
// cars cruise one road line, turn at intersections, and wrap around the city edge.
import * as THREE from 'three';
import { CAR, CITY } from './config.js';
import { roadLines } from './city.js';

const CAR_COLOURS = [0xd84040, 0x4060d8, 0xe8c840, 0x40b060, 0xe8e8e8, 0x30343c, 0xc060c0, 0x40c0c0];
const NAMES = ['Sunrunner', 'Bay Cruiser', 'Palm GT', 'Coastline', 'Marina LX', 'Dune Buggy'];

export function buildCarMesh(colour) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: colour });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1c2c3c });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.7, 4.4), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 2.2), glassMat);
  cabin.position.set(0, 1.15, -0.2);
  cabin.castShadow = true;
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
  const wheels = [];
  for (const [x, z] of [[-1.0, 1.45], [1.0, 1.45], [-1.0, -1.45], [1.0, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.42, z);
    group.add(wheel);
    wheels.push(wheel);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
  for (const x of [-0.7, 0.7]) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), lightMat);
    light.position.set(x, 0.6, -2.22);
    group.add(light);
  }
  return { group, wheels };
}

export function createCar(scene, x, z, heading, colour, name) {
  const { group, wheels } = buildCarMesh(colour);
  group.position.set(x, 0, z);
  group.rotation.y = heading;
  scene.add(group);
  return {
    group, wheels, name: name || 'Car', colour,
    x, z, heading, speed: 0,
    damaged: false, smoke: null,
    parked: true, traffic: false, police: false,
  };
}

// Arcade player driving: W/S accelerate and brake, A/D steer (steering fades at low speed),
// Space is the handbrake, and the car slides a little sideways for feel.
export function drivePlayerCar(car, axis, handbrake, dt) {
  const forward = axis.z < 0;
  const back = axis.z > 0;
  if (forward) car.speed += CAR.accel * dt;
  else if (back) car.speed -= (car.speed > 0.5 ? CAR.brake : CAR.accel * 0.6) * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
  if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 26 * dt);
  car.speed = Math.max(-CAR.reverseMax, Math.min(CAR.maxSpeed, car.speed));
  const steerInput = axis.x;
  const steerFactor = Math.min(1, Math.abs(car.speed) / 8);
  car.heading += steerInput * CAR.steer * steerFactor * dt * Math.sign(car.speed || 1);
  const dx = -Math.sin(car.heading);
  const dz = -Math.cos(car.heading);
  car.x += dx * car.speed * dt;
  car.z += dz * car.speed * dt;
  car.x = Math.max(-CITY.half, Math.min(CITY.half, car.x));
  car.z = Math.max(-CITY.half, Math.min(CITY.half + 40, car.z));
  car.group.position.set(car.x, 0, car.z);
  car.group.rotation.y = car.heading;
  for (const wheel of car.wheels) wheel.rotation.x += car.speed * dt * 2;
  return Math.abs(car.speed);
}

export function createTraffic(scene, rng, count) {
  const lines = roadLines();
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const horizontal = rng.next() < 0.5;
    const line = rng.pick(lines);
    const along = rng.range(-CITY.half, CITY.half);
    const dir = rng.next() < 0.5 ? 1 : -1;
    const car = createCar(scene, horizontal ? along : line + (dir > 0 ? 2.5 : -2.5), horizontal ? line + (dir > 0 ? 2.5 : -2.5) : along, horizontal ? (dir > 0 ? -Math.PI / 2 : Math.PI / 2) : (dir > 0 ? Math.PI : 0), rng.pick(CAR_COLOURS), rng.pick(NAMES));
    car.parked = false;
    car.traffic = true;
    car.horizontal = horizontal;
    car.line = line;
    car.dir = dir;
    car.cruise = rng.range(9, 15);
    cars.push(car);
  }
  return cars;
}

export function updateTraffic(cars, dt, playerPos) {
  for (const car of cars) {
    if (car.stolen) continue;
    let speed = car.cruise;
    if (playerPos) {
      const dx = car.x - playerPos.x;
      const dz = car.z - playerPos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 12) speed = Math.min(speed, 4);
    }
    if (car.horizontal) {
      car.x += car.dir * speed * dt;
      if (car.x > CITY.half + 10) car.x = -CITY.half - 10;
      if (car.x < -CITY.half - 10) car.x = CITY.half + 10;
      car.z = car.line + (car.dir > 0 ? 2.5 : -2.5);
    } else {
      car.z += car.dir * speed * dt;
      if (car.z > CITY.half + 50) car.z = -CITY.half - 10;
      if (car.z < -CITY.half - 10) car.z = CITY.half + 50;
      car.x = car.line + (car.dir > 0 ? 2.5 : -2.5);
    }
    car.group.position.set(car.x, 0, car.z);
  }
}

// A parked car the player can steal, placed beside a road.
export function createParkedCars(scene, rng, count) {
  const lines = roadLines();
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const line = rng.pick(lines);
    const along = rng.range(-170, 170);
    const side = rng.next() < 0.5 ? 6.5 : -6.5;
    const horizontal = rng.next() < 0.5;
    const car = createCar(scene, horizontal ? along : line + side, horizontal ? line + side : along, horizontal ? 0 : Math.PI / 2, rng.pick(CAR_COLOURS), rng.pick(NAMES));
    car.parked = true;
    cars.push(car);
  }
  return cars;
}
