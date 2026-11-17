// The three story missions for Ms. Duarte, plus free-roam side content. A mission is a
// small state machine: an ordered list of steps, each with a target position, a radius and
// a line of objective text. Completing the last step pays out and marks the mission done.
import { MISSIONS } from './config.js';

export function createMissionState() {
  return { active: -1, step: 0, timer: 0, done: [false, false, false], message: '' };
}

export function missionSteps(id, city) {
  if (id === 0) {
    return [
      { text: 'Steal a parked car. Walk up to one and press E.', target: null, radius: 0, kind: 'steal' },
      { text: 'Drive to the red garage on the north-west side. Lose the cops if you can.', target: city.garagePos, radius: 12, kind: 'reach' },
    ];
  }
  if (id === 1) {
    return [
      { text: 'Get in a car and pick up the package at the pier.', target: city.marinaPos, radius: 22, kind: 'reach' },
      { text: 'Deliver the package to the blue safehouse. Clock is ticking!', target: city.safehousePos, radius: 12, kind: 'reach', timed: 75 },
    ];
  }
  return [
    { text: 'Reach the marina vault and grab the cash.', target: city.marinaPos, radius: 22, kind: 'reach' },
    { text: 'Four stars! Escape to the blue safehouse without getting busted.', target: city.safehousePos, radius: 12, kind: 'escape' },
  ];
}

export function startMission(state, id) {
  state.active = id;
  state.step = 0;
  state.timer = 0;
  state.message = MISSIONS[id].brief;
  return MISSIONS[id];
}

export function currentStep(state, city) {
  if (state.active < 0) return null;
  return missionSteps(state.active, city)[state.step];
}

export function advanceMission(state, city) {
  const steps = missionSteps(state.active, city);
  state.step += 1;
  if (state.step >= steps.length) {
    const id = state.active;
    state.done[id] = true;
    state.active = -1;
    state.step = 0;
    return { completed: id, pay: MISSIONS[id].pay };
  }
  return null;
}

export function missionListText(state) {
  return MISSIONS.map((m, i) => {
    const status = state.done[i] ? 'DONE' : state.active === i ? 'IN PROGRESS' : 'AVAILABLE';
    return `${i + 1}. ${m.name} — $${m.pay} — ${status}<br><span style="color:#cfe3f2">${m.brief}</span>`;
  }).join('<br><br>');
}

// Free-roam side content: cash stashes, taxi fares and a chaos (rampage) bonus.
export function createSideContent() {
  return {
    stashes: [],
    taxi: { active: false, fare: 0, pickup: null, dropoff: null },
    chaos: 0,
  };
}
