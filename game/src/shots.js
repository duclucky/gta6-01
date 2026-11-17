// Screenshot staging behind ?shot=start|drive|chase|mission (with &seed=N). Each scene
// plays the real rules forward for a few seconds from a seeded world, then parks the
// camera on a lively frame: the title over the city, a drive with the HUD and minimap,
// a three-star chase with police cars closing in, and a mission in progress with its
// objective marker. Cars are staged on road lines heading along them, so the frame shows
// the street, traffic and the city, not a building wall. The same seed gives the same frame.
import { STEP } from './config.js';
import { startMission } from './missions.js';

// Put the player's car on a road line, heading along it (heading PI/2 drives west).
function placeCarOnRoad(game, x, z) {
  const car = game.state.car;
  car.x = x;
  car.z = z;
  car.heading = Math.PI / 2;
  car.speed = 0;
  car.group.position.set(x, 0, z);
  car.group.rotation.y = car.heading;
}

export function stageShot(game, name) {
  game.resetGame();
  game.setScreen('play');
  const G = game.state;
  if (name === 'start') {
    game.setScreen('title');
    G.player.x = 0; G.player.z = 150;
    G.player.heading = Math.PI;
    for (let i = 0; i < 90; i += 1) game.stepWorld(STEP, true);
    return;
  }
  if (name === 'drive') {
    const car = game.nearestParkedCar(G.player.x, G.player.z);
    game.enterCar(car);
    placeCarOnRoad(game, 60, 0);
    G.car.speed = 22;
    for (let i = 0; i < 150; i += 1) game.stepWorld(STEP, true);
    return;
  }
  if (name === 'chase') {
    const car = game.nearestParkedCar(G.player.x, G.player.z);
    game.enterCar(car);
    placeCarOnRoad(game, 80, 0);
    G.car.speed = 26;
    game.setWanted(3);
    for (let i = 0; i < 180; i += 1) game.stepWorld(STEP, true);
    return;
  }
  // Mission 1 in progress: driving west along the -120 road toward the red garage.
  startMission(G.missions, 0);
  const car = game.nearestParkedCar(G.player.x, G.player.z);
  game.enterCar(car);
  placeCarOnRoad(game, -60, -120);
  game.setWanted(1);
  G.car.speed = 20;
  for (let i = 0; i < 90; i += 1) game.stepWorld(STEP, true);
}
