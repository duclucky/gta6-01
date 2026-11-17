// Keyboard and mouse input. WASD moves and drives, mouse drag orbits the camera, a click
// shoots on foot. Edge-triggered actions (enter car, pause, mute, retry, confirm) are
// consumed once by the main loop through takeActions().
export const ACTION_ENTER = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_RETRY = 8;
export const ACTION_CONFIRM = 16;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseDown = false;
  let shootQueued = false;
  let dragX = 0;
  let dragY = 0;

  function onKeyDown(event) {
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'KeyE') actions |= ACTION_ENTER;
    if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    if (event.code === 'KeyM') actions |= ACTION_MUTE;
    if (event.code === 'KeyR') actions |= ACTION_RETRY;
    if (event.code === 'Enter' || event.code === 'Space') actions |= ACTION_CONFIRM;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
  }
  function onKeyUp(event) { keys.delete(event.code); }
  function onMouseDown(event) { mouseDown = true; dragX = event.clientX; dragY = event.clientY; }
  function onMouseMove(event) {
    if (!mouseDown) return;
    const dx = event.clientX - dragX;
    const dy = event.clientY - dragY;
    dragX = event.clientX; dragY = event.clientY;
    input.cameraYaw -= dx * 0.005;
    input.cameraPitch = Math.max(-0.1, Math.min(0.9, input.cameraPitch + dy * 0.004));
  }
  function onMouseUp(event) {
    if (mouseDown && Math.abs(event.clientX - dragX) < 4 && Math.abs(event.clientY - dragY) < 4) shootQueued = true;
    mouseDown = false;
  }

  const input = {
    cameraYaw: 0.6,
    cameraPitch: 0.42,
    takeActions() { const a = actions; actions = 0; return a; },
    takeShot() { const s = shootQueued; shootQueued = false; return s; },
    axis() {
      let x = 0; let z = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) z -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) z += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      return { x, z };
    },
    sprint() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    handbrake() { return keys.has('Space'); },
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  return input;
}
