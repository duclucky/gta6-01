// Palma Bay: boot and the one loop. The game moves between title, play, paused, mission
// complete and game over screens. The world advances in fixed 1/60 s steps; input, wanted
// level, police, missions, stashes, taxi fares and combat all update in stepWorld, which
// the screenshot staging reuses so a shot is a real moment of play, not a diorama.
//
// ?seed=N fixes the city layout. ?shot=start|drive|chase|mission stages that scene instead
// of running the loop, paints it a few times and sets window.__shotReady.
import * as THREE from 'three';
import { STEP, PLAYER, CAR, TRAFFIC_COUNT, PED_COUNT, SAVE_KEY, MISSIONS } from './config.js';
import { createRandom } from './random.js';
import { ACTION_ENTER, ACTION_PAUSE, ACTION_MUTE, ACTION_RETRY, ACTION_CONFIRM, createInput } from './input.js';
import { createAudio } from './audio.js';
import { buildCity, collideBuildings } from './city.js';
import { createCar, createTraffic, createParkedCars, drivePlayerCar, updateTraffic } from './vehicles.js';
import { createPedestrians, updatePedestrians } from './pedestrians.js';
import { createPolice, updatePolice, clearPolice } from './police.js';
import { createMissionState, startMission, currentStep, advanceMission, missionListText } from './missions.js';
import { createCombat, tryShoot, policeShotDamage } from './combat.js';
import { createHud } from './hud.js';
import { createRenderer, createEffects, updateCamera, makePlayerMesh, makeMarker } from './render.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const rng = createRandom(seed);
const view = createRenderer(canvas);
const { scene, camera } = view;
const input = createInput(canvas);
const audio = createAudio();
const hud = createHud();
const effects = createEffects(scene);
const city = buildCity(scene, rng);
const playerMesh = makePlayerMesh(scene);
const marker = makeMarker(scene, 0xffd23e);
marker.visible = false;

const state = {
  screen: 'title',
  player: { x: 0, z: 120, heading: Math.PI, health: PLAYER.health },
  car: null,
  cars: [],
  traffic: [],
  peds: [],
  police: createPolice(scene),
  cash: 250,
  wanted: 0,
  wantedTimer: 0,
  crimeTimer: 0,
  missions: createMissionState(),
  combat: createCombat(),
  best: 0,
  speed: 0,
  shake: 0,
  time: 0,
  stashes: [],
  taxi: { active: false, stage: 0, x: 0, z: 0, fare: 0 },
  chaos: 0,
  missionTimer: 0,
  autopilot: false,
};

function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const save = JSON.parse(raw);
    state.cash = save.cash || 250;
    state.best = save.best || 0;
    if (Array.isArray(save.done)) state.missions.done = save.done;
  } catch { /* Storage can be off: the save then lasts this visit only. */ }
}

function saveGame() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: Math.floor(state.cash),
      done: state.missions.done,
      best: Math.floor(state.best),
    }));
  } catch { /* ignore */ }
}

function announce(message) { status.textContent = message; }

function spawnStashes() {
  for (const stash of state.stashes) scene.remove(stash.mesh);
  state.stashes = [];
  const geo = new THREE.BoxGeometry(1.2, 0.9, 1.2);
  for (let i = 0; i < 6; i += 1) {
    const x = rng.range(-180, 180);
    const z = rng.range(-180, 180);
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0x37d67a, emissive: 0x1a5a2a }));
    mesh.position.set(x, 0.45, z);
    scene.add(mesh);
    state.stashes.push({ x, z, mesh, taken: false });
  }
}

function spawnWorld() {
  for (const car of [...state.cars, ...state.traffic]) scene.remove(car.group);
  for (const ped of state.peds) scene.remove(ped.group);
  clearPolice(state.police, scene);
  state.cars = createParkedCars(scene, rng, 8);
  state.traffic = createTraffic(scene, rng, TRAFFIC_COUNT);
  state.peds = createPedestrians(scene, rng, PED_COUNT);
  spawnStashes();
}

function resetGame() {
  state.player = { x: 0, z: 120, heading: Math.PI, health: PLAYER.health };
  state.car = null;
  state.wanted = 0;
  state.wantedTimer = 0;
  state.crimeTimer = 0;
  state.missions = createMissionState();
  state.combat = createCombat();
  state.speed = 0;
  state.shake = 0;
  state.chaos = 0;
  state.taxi = { active: false, stage: 0, x: 0, z: 0, fare: 0 };
  state.missionTimer = 0;
  playerMesh.visible = true;
  marker.visible = false;
  spawnWorld();
}

function setScreen(name) {
  state.screen = name;
  const show = (id, on) => document.getElementById(id).classList.toggle('hidden', !on);
  show('title', name === 'title');
  show('pause', name === 'paused');
  show('over', name === 'over');
  show('complete', name === 'complete');
  if (name === 'play') hud.show();
  else if (name === 'title' || name === 'over') hud.hide();
  if (name === 'paused') {
    document.getElementById('missionList').innerHTML = missionListText(state.missions);
  }
  if (name === 'title') {
    const done = state.missions.done.filter(Boolean).length;
    document.getElementById('saveLine').textContent = state.cash > 250 || done > 0
      ? `Saved: $${Math.floor(state.cash)} · ${done}/3 missions done · best score ${Math.floor(state.best)}`
      : '';
  }
}

function setWanted(level) {
  state.wanted = Math.max(0, Math.min(5, level));
  state.crimeTimer = 0;
}

function commitCrime(level) {
  if (level > state.wanted) setWanted(level);
  state.crimeTimer = 0;
}

function nearestCar(x, z, maxDist) {
  let best = null;
  let bestDist = maxDist;
  for (const car of [...state.cars, ...state.traffic]) {
    if (car === state.car) continue;
    const d = Math.hypot(car.x - x, car.z - z);
    if (d < bestDist) { best = car; bestDist = d; }
  }
  return best;
}

function nearestParkedCar(x, z) {
  let best = state.cars[0];
  let bestDist = Infinity;
  for (const car of state.cars) {
    const d = Math.hypot(car.x - x, car.z - z);
    if (d < bestDist) { best = car; bestDist = d; }
  }
  return best;
}

function enterCar(car) {
  if (!car) return false;
  if (car.traffic) commitCrime(2);
  else commitCrime(1);
  car.stolen = true;
  car.parked = false;
  car.traffic = false;
  state.car = car;
  state.player.x = car.x;
  state.player.z = car.z;
  playerMesh.visible = false;
  audio.cash();
  hud.toastMessage(`Stole the ${car.name}!`, 1800);
  announce(`Driving the ${car.name}.`);
  return true;
}

function exitCar() {
  const car = state.car;
  if (!car) return;
  car.speed = 0;
  state.car = null;
  state.player.x = car.x + Math.cos(car.heading) * 2.5;
  state.player.z = car.z - Math.sin(car.heading) * 2.5;
  state.player.heading = car.heading;
  playerMesh.visible = true;
  playerMesh.position.set(state.player.x, 0, state.player.z);
}

function playerPos() {
  return state.car ? { x: state.car.x, z: state.car.z } : state.player;
}

function damagePlayer(amount, cause) {
  state.player.health -= amount;
  state.shake = Math.min(1, state.shake + 0.5);
  audio.crash();
  if (state.player.health <= 0) {
    state.player.health = 0;
    gameOver(cause === 'arrest' ? 'BUSTED' : 'WASTED');
  }
}

function gameOver(kind) {
  saveGame();
  document.getElementById('overText').textContent = kind === 'BUSTED'
    ? `The Palma Bay police cuffed Leo on the street. Cash kept: $${Math.floor(state.cash)}. Ms. Duarte still wants her money.`
    : `Leo is down. Cash kept: $${Math.floor(state.cash)}. The city does not wait for anyone.`;
  setScreen('over');
  announce(`Game over. ${kind}.`);
}

function completeMission(result) {
  state.cash += result.pay;
  state.best = Math.max(state.best, state.cash);
  saveGame();
  audio.cash();
  document.getElementById('completeText').textContent =
    `${MISSIONS[result.completed].name} complete! Ms. Duarte paid $${result.pay}. Total cash: $${Math.floor(state.cash)}.`;
  setScreen('complete');
  announce(`Mission complete. Paid $${result.pay}.`);
}

function failMission(reason) {
  state.missions.active = -1;
  state.missions.step = 0;
  marker.visible = false;
  hud.toastMessage(reason, 3000);
  announce(reason);
}

function stepWorld(dt, autopilot) {
  state.time += dt;
  const axis = autopilot ? { x: 0, z: -1 } : input.axis();
  const pos = playerPos();

  // Player movement: on foot, or driving the current car.
  if (state.car) {
    const car = state.car;
    const prevX = car.x;
    const prevZ = car.z;
    const steer = autopilot && state.missions.active >= 0 ? steerToward(car) : axis.x;
    state.speed = drivePlayerCar(car, { x: steer, z: axis.z }, input.handbrake(), dt);
    // Cars cannot drive through buildings: bounce back to the previous spot.
    for (const c of city.colliders) {
      if (Math.abs(car.x - c.x) < c.hw + 2 && Math.abs(car.z - c.z) < c.hd + 2) {
        car.x = prevX;
        car.z = prevZ;
        car.speed *= 0.3;
        car.group.position.set(car.x, 0, car.z);
        state.shake = Math.max(state.shake, 0.25);
        break;
      }
    }
    if (Math.abs(car.speed) > 20 && Math.random() < 0.3) effects.dust(car.x, car.z);
    if (Math.abs(car.speed) > 30) audio.engine(Math.abs(car.speed) / CAR.maxSpeed, true);
    // Hitting a pedestrian while speeding is a crime.
    for (const ped of state.peds) {
      if (!ped.alive) continue;
      if (Math.hypot(ped.x - car.x, ped.z - car.z) < 2.2 && Math.abs(car.speed) > 6) {
        ped.alive = false;
        ped.group.visible = false;
        state.chaos += 1;
        commitCrime(Math.max(state.wanted, 2));
        state.shake = 0.6;
        audio.crash();
      }
    }
  } else {
    const speed = input.sprint() ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    const yaw = input.cameraYaw;
    const mx = axis.x * Math.cos(yaw) - axis.z * Math.sin(yaw);
    const mz = axis.x * Math.sin(yaw) + axis.z * Math.cos(yaw);
    const len = Math.hypot(mx, mz);
    if (len > 0.01) {
      state.player.x += (mx / len) * speed * dt;
      state.player.z += (mz / len) * speed * dt;
      state.player.heading = Math.atan2(-(mx / len), -(mz / len));
    }
    collideBuildings(state.player, PLAYER.radius, city.colliders);
    state.speed = len > 0.01 ? speed : 0;
    playerMesh.position.set(state.player.x, 0, state.player.z);
    playerMesh.rotation.y = state.player.heading;
    audio.engine(0, false);
  }

  // Shooting on foot. Clicks while driving are drained so they never fire on exit.
  const shotQueued = input.takeShot();
  if (!state.car && shotQueued) {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const origin = new THREE.Vector3(state.player.x, 1.5, state.player.z);
    const hit = tryShoot(state.combat, 0, origin, dir, state.police.officers);
    audio.gunshot();
    effects.spark(state.player.x - Math.sin(state.player.heading) * 1.2, 1.4, state.player.z - Math.cos(state.player.heading) * 1.2);
    if (hit) {
      state.chaos += 1;
      commitCrime(Math.min(5, state.wanted + 1));
      hud.toastMessage('Officer down! Heat rising.', 1600);
    }
  }

  // Traffic and pedestrians keep the city alive.
  updateTraffic(state.traffic, dt, pos);
  updatePedestrians(state.peds, dt, state.car ? null : pos, state.time, city.colliders);

  // Police chase, ram and arrest.
  const policeResult = updatePolice(state.police, scene, rng, dt, state.wanted, pos, !!state.car, state.time);
  audio.siren(state.police.sirenOn);
  if (policeResult.rammed && state.time - (state.lastRam || 0) > 1.2) {
    state.lastRam = state.time;
    if (state.car) {
      damagePlayer(6, 'ram');
      hud.toastMessage('Police rammed you!', 1200);
    } else {
      damagePlayer(10, 'ram');
    }
  }
  if (policeResult.arrested) gameOver('arrest');
  if (policeResult.shotAt && !state.car) {
    damagePlayer(policeShotDamage(14), 'shot');
    effects.spark(state.player.x, 1.4, state.player.z);
  }

  // Wanted level decays slowly when the heat is off.
  state.crimeTimer += dt;
  if (state.wanted > 0 && state.crimeTimer > 25) {
    state.wanted -= 1;
    state.crimeTimer = 0;
    hud.toastMessage('Heat cooling off...', 1500);
  }

  // Cash stashes.
  for (const stash of state.stashes) {
    if (stash.taken) continue;
    stash.mesh.rotation.y += dt;
    if (Math.hypot(stash.x - pos.x, stash.z - pos.z) < 3) {
      stash.taken = true;
      stash.mesh.visible = false;
      state.cash += 150;
      state.chaos += 0;
      audio.pickup();
      hud.toastMessage('Cash stash +$150', 1500);
    }
  }

  // Taxi fares: in free roam, in a car, a fare appears; reach the pickup, then the dropoff.
  if (state.missions.active < 0 && state.car && !state.taxi.active) {
    state.taxi.active = true;
    state.taxi.stage = 0;
    state.taxi.x = rng.range(-160, 160);
    state.taxi.z = rng.range(-160, 160);
    state.taxi.fare = 120;
  }
  if (state.taxi.active) {
    const d = Math.hypot(state.taxi.x - pos.x, state.taxi.z - pos.z);
    if (d < 8) {
      if (state.taxi.stage === 0) {
        state.taxi.stage = 1;
        state.taxi.x = rng.range(-160, 160);
        state.taxi.z = rng.range(-160, 160);
        hud.toastMessage('Passenger aboard! Drive to the dropoff.', 1800);
      } else {
        state.taxi.active = false;
        state.cash += state.taxi.fare;
        audio.cash();
        hud.toastMessage(`Fare complete +$${state.taxi.fare}`, 1800);
      }
    }
  }

  // Rampage bonus: every 5 chaos points pays out.
  if (state.chaos >= 5) {
    state.chaos -= 5;
    state.cash += 50;
    hud.toastMessage('RAMPAGE BONUS +$50', 1600);
  }

  // Missions.
  const step = currentStep(state.missions, city);
  if (step) {
    if (step.kind === 'steal' && state.car) {
      const done = advanceMission(state.missions, city);
      if (done) completeMission(done);
      else setWanted(1);
    } else if (step.kind === 'reach' || step.kind === 'escape') {
      const d = Math.hypot(step.target.x - pos.x, step.target.z - pos.z);
      if (d < step.radius) {
        if (state.missions.active === 2 && state.missions.step === 0) setWanted(4);
        const done = advanceMission(state.missions, city);
        if (done) completeMission(done);
        else if (state.missions.active === 2 && state.missions.step === 1) setWanted(4);
      }
    }
    if (step.timed) {
      state.missionTimer += dt;
      if (state.missionTimer > step.timed) failMission('Too slow! The package went to someone else.');
    }
    marker.visible = !!step.target;
    if (step.target) marker.position.set(step.target.x, 0, step.target.z);
  } else {
    marker.visible = !!state.taxi.active;
    if (state.taxi.active) marker.position.set(state.taxi.x, 0, state.taxi.z);
  }

  // Slow health regen out of combat.
  if (state.player.health < PLAYER.health && state.wanted === 0) {
    state.player.health = Math.min(PLAYER.health, state.player.health + 2 * dt);
  }
  state.shake = Math.max(0, state.shake - dt * 1.5);
  effects.update(dt);

  // HUD + minimap.
  const stepNow = currentStep(state.missions, city);
  hud.update({
    wanted: state.wanted,
    cash: state.cash,
    health: state.player.health,
    speed: state.speed,
    inCar: !!state.car,
    carName: state.car ? state.car.name : '',
    objective: stepNow ? stepNow.text + (stepNow.timed ? ` (${Math.max(0, Math.ceil(stepNow.timed - state.missionTimer))}s left)` : '')
      : state.taxi.active ? (state.taxi.stage === 0 ? 'Taxi: pick up the fare (yellow marker).' : 'Taxi: drop the passenger off (yellow marker).') : '',
    missionName: state.missions.active >= 0 ? MISSIONS[state.missions.active].name : '',
    player: pos,
    marker: stepNow && stepNow.target ? stepNow.target : state.taxi.active ? { x: state.taxi.x, z: state.taxi.z } : null,
    stashes: state.stashes.filter((s) => !s.taken),
    police: [...state.police.cars, ...state.police.officers],
  });
  hud.drawMinimap({
    player: pos,
    marker: stepNow && stepNow.target ? stepNow.target : state.taxi.active ? { x: state.taxi.x, z: state.taxi.z } : null,
    stashes: state.stashes.filter((s) => !s.taken),
    police: [...state.police.cars, ...state.police.officers],
  });
}

// Autopilot steering for screenshot drives: steer the car toward the mission marker.
function steerToward(car) {
  const step = currentStep(state.missions, city);
  const target = step && step.target ? step.target : { x: 0, z: 0 };
  const desired = Math.atan2(-(target.x - car.x), -(target.z - car.z));
  let diff = desired - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return Math.max(-1, Math.min(1, diff * 1.5));
}

const game = {
  state,
  resetGame,
  setScreen,
  setWanted,
  nearestParkedCar,
  enterCar,
  stepWorld,
};

// Small debug hook for automated playtests: read-only snapshot of the live state.
window.__palma = {
  snapshot() {
    const pos = playerPos();
    return {
      screen: state.screen, x: pos.x, z: pos.z, health: state.player.health,
      cash: state.cash, wanted: state.wanted, inCar: !!state.car,
      speed: state.speed, mission: state.missions.active, step: state.missions.step,
      done: state.missions.done, policeCars: state.police.cars.length,
      officers: state.police.officers.length, peds: state.peds.filter((p) => p.alive).length,
      traffic: state.traffic.length, stashes: state.stashes.filter((s) => !s.taken).length,
    };
  },
  teleportCar() {
    const car = nearestParkedCar(state.player.x, state.player.z);
    if (car) { state.player.x = car.x + 2; state.player.z = car.z; return true; }
    return false;
  },
  teleportTo(x, z) {
    if (state.car) { state.car.x = x; state.car.z = z; }
    else { state.player.x = x; state.player.z = z; }
    return true;
  },
  setCar(x, z, heading) {
    if (!state.car) return false;
    state.car.x = x; state.car.z = z; state.car.heading = heading;
    state.car.group.position.set(x, 0, z);
    state.car.group.rotation.y = heading;
    return true;
  },
};

function runShot(name) {
  stageShot(game, name);
  const pos = playerPos();
  const heading = state.car ? state.car.heading : state.player.heading;
  camera.position.set(pos.x + Math.sin(heading + Math.PI) * 13, 8, pos.z + Math.cos(heading + Math.PI) * 13);
  camera.lookAt(pos.x, 1.6, pos.z);
  let painted = 0;
  function paint() {
    hud.show();
    if (name === 'start') hud.hide();
    view.renderer.render(scene, camera);
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  loadSave();
  resetGame();
  setScreen('title');
  audio.startMusic();
  let accumulator = 0;
  let last = performance.now();
  const MAX_FRAME = 0.25;

  document.getElementById('playBtn').addEventListener('click', () => {
    audio.unlock();
    resetGame();
    setScreen('play');
    startMission(state.missions, 0);
    state.missionTimer = 0;
    hud.toastMessage('Mission 1: First Wheels — steal a car!', 3000);
    announce('Mission 1 started. Steal a parked car.');
  });
  document.getElementById('continueBtn').addEventListener('click', () => {
    audio.unlock();
    resetGame();
    setScreen('play');
    announce('Free roam. Explore Palma Bay.');
  });
  document.getElementById('resumeBtn').addEventListener('click', () => setScreen('play'));
  document.getElementById('quitBtn').addEventListener('click', () => { saveGame(); setScreen('title'); });
  document.getElementById('retryBtn').addEventListener('click', () => {
    const id = state.missions.active >= 0 ? state.missions.active : 0;
    resetGame();
    setScreen('play');
    startMission(state.missions, id);
    state.missionTimer = 0;
  });
  document.getElementById('overTitleBtn').addEventListener('click', () => setScreen('title'));
  document.getElementById('completeBtn').addEventListener('click', () => setScreen('play'));
  document.getElementById('missionBtn').addEventListener('click', () => {
    const list = document.getElementById('missionList');
    list.innerHTML = '';
    MISSIONS.forEach((m, i) => {
      const btn = document.createElement('button');
      btn.className = 'btn ghost';
      btn.textContent = `${state.missions.done[i] ? '✓ ' : ''}${i + 1}. ${m.name} — $${m.pay}`;
      btn.addEventListener('click', () => {
        resetGame();
        setScreen('play');
        startMission(state.missions, i);
        state.missionTimer = 0;
        hud.toastMessage(`Mission ${i + 1}: ${m.name}`, 2500);
      });
      list.appendChild(btn);
      list.appendChild(document.createElement('br'));
    });
  });

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      hud.toastMessage(muted ? 'Muted (M)' : 'Sound on (M)', 1200);
    }
    if (state.screen === 'title' && (actions & ACTION_CONFIRM)) {
      document.getElementById('playBtn').click();
      return;
    }
    if (state.screen === 'over' && (actions & ACTION_CONFIRM)) {
      document.getElementById('retryBtn').click();
      return;
    }
    if (state.screen === 'complete' && (actions & ACTION_CONFIRM)) {
      setScreen('play');
      return;
    }
    if (actions & ACTION_PAUSE) {
      if (state.screen === 'play') setScreen('paused');
      else if (state.screen === 'paused') setScreen('play');
      return;
    }
    if (state.screen !== 'play') return;
    if (actions & ACTION_RETRY && state.missions.active >= 0) {
      const id = state.missions.active;
      resetGame();
      startMission(state.missions, id);
      state.missionTimer = 0;
      hud.toastMessage('Mission restarted', 1500);
      return;
    }
    if (actions & ACTION_ENTER) {
      if (state.car) exitCar();
      else {
        const car = nearestCar(state.player.x, state.player.z, 5);
        if (car) enterCar(car);
        else hud.toastMessage('No car nearby — walk closer and press E.', 1400);
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (state.screen === 'play') {
      while (accumulator >= STEP) {
        stepWorld(STEP, false);
        accumulator -= STEP;
        if (state.screen !== 'play') break;
      }
    } else {
      accumulator = 0;
      if (state.screen === 'title') {
        state.time += 1 / 60;
        updateTraffic(state.traffic, 1 / 60, null);
        updatePedestrians(state.peds, 1 / 60, null, state.time, city.colliders);
        effects.update(1 / 60);
      }
    }
    const pos = playerPos();
    const heading = state.car ? state.car.heading : state.player.heading;
    updateCamera(camera, pos, heading, input.cameraYaw, input.cameraPitch, 1 / 60, state.shake);
    view.renderer.render(scene, camera);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.screen === 'play') setScreen('paused');
  });
  announce('Palma Bay. Press Start Engine to play.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
