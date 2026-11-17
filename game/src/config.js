// Every tuning number for Palma Bay in one place. The city is a grid of blocks on the
// XZ plane; the sea lies beyond the south edge (positive Z) and the marina sits on it.
export const STEP = 1 / 60;
export const CITY = { half: 200, block: 44, road: 16, blocks: 4 };
export const PLAYER = { walkSpeed: 7, sprintSpeed: 11, health: 100, radius: 0.9 };
export const CAR = { accel: 26, brake: 42, maxSpeed: 46, reverseMax: 14, steer: 1.9, grip: 6 };
export const TRAFFIC_COUNT = 10;
export const PED_COUNT = 16;
export const WANTED_MAX = 5;
export const SAVE_KEY = 'palma-bay.save.v1';
export const MISSIONS = [
  { id: 0, name: 'First Wheels', pay: 800, brief: 'Steal a parked car and reach the garage. Lose the one-star tail.' },
  { id: 1, name: 'Bayfront Run', pay: 1500, brief: 'Deliver the package across town before the clock runs out.' },
  { id: 2, name: 'The Big Score', pay: 5000, brief: 'Take the marina vault cash and escape with four stars on you.' },
];
export const PALETTE = {
  sky: 0x87c5e8, sun: 0xfff2cc, sea: 0x1d7fa8, sand: 0xe8d29a, grass: 0x4d8a4a,
  road: 0x2e3138, sidewalk: 0x9aa0a8, building: 0xd8c9a8, building2: 0xb8c4d0,
  building3: 0xe0a080, palm: 0x2f7a3a, trunk: 0x8a6a44,
};
