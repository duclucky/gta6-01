// Rendering: the three.js scene, sun and sky, shadows, the chase camera that follows the
// player on foot or in a car, and the particle effects (dust puffs, damage smoke, muzzle
// sparks). The camera sits behind the player's heading and eases toward it.
import * as THREE from 'three';
import { PALETTE } from './config.js';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(0x9fc8e0, 260, 620);
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
  const sun = new THREE.DirectionalLight(PALETTE.sun, 1.6);
  sun.position.set(120, 180, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -220;
  sun.shadow.camera.right = 220;
  sun.shadow.camera.top = 220;
  sun.shadow.camera.bottom = -220;
  sun.shadow.camera.far = 600;
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xbfd9e8, 0.75));
  const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x3a5a3a, 0.5);
  scene.add(hemi);
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  return { renderer, scene, camera, sun };
}

export function createEffects(scene) {
  const particles = [];
  const geo = new THREE.SphereGeometry(0.18, 6, 5);
  function puff(x, y, z, colour, life) {
    const mat = new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.85 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    particles.push({ mesh, life: life || 0.6, age: 0, vy: 1.2 });
  }
  return {
    dust(x, z) { puff(x + (Math.random() - 0.5), 0.3, z + (Math.random() - 0.5), 0xcbb98a, 0.5); },
    smoke(x, y, z) { puff(x, y, z, 0x555555, 1.1); },
    spark(x, y, z) { for (let i = 0; i < 4; i += 1) puff(x, y, z, 0xffd23e, 0.25); },
    update(dt) {
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.age += dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.material.opacity = Math.max(0, 0.85 * (1 - p.age / p.life));
        if (p.age >= p.life) { scene.remove(p.mesh); p.mesh.material.dispose(); particles.splice(i, 1); }
      }
    },
  };
}

// Chase camera: behind and above the target, looking slightly ahead of it.
export function updateCamera(camera, target, heading, yaw, pitch, dt, shake) {
  const camYaw = heading + Math.PI + yaw * 0.35;
  const dist = 13;
  const height = 5.5 + pitch * 4;
  const tx = target.x + Math.sin(camYaw) * dist;
  const tz = target.z + Math.cos(camYaw) * dist;
  const k = 1 - Math.pow(0.0001, dt);
  camera.position.x += (tx - camera.position.x) * k;
  camera.position.y += (height - camera.position.y) * k;
  camera.position.z += (tz - camera.position.z) * k;
  if (shake > 0.01) {
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake;
  }
  camera.lookAt(target.x, 1.6, target.z);
}

export function makePlayerMesh(scene) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.4, 1.15, 8),
    new THREE.MeshLambertMaterial({ color: 0x2a6a4a }),
  );
  body.position.y = 0.95;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshLambertMaterial({ color: 0xe8b88a }));
  head.position.y = 1.8;
  head.castShadow = true;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.14, 10), new THREE.MeshLambertMaterial({ color: 0x10202e }));
  cap.position.y = 2.02;
  group.add(cap);
  scene.add(group);
  return group;
}

export function makeMarker(scene, colour) {
  const group = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 30, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.28, side: THREE.DoubleSide }),
  );
  beam.position.y = 15;
  group.add(beam);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(3, 0.28, 8, 24),
    new THREE.MeshBasicMaterial({ color: colour }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.25;
  group.add(ring);
  scene.add(group);
  return group;
}
