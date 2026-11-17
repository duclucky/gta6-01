// The HUD: health bar, cash, wanted stars, speed, objective text, toast messages and a
// live circular minimap drawn on a 2D canvas (roads, beach, sea, player arrow, police,
// mission marker and stashes). All DOM ids match index.html.
import { CITY } from './config.js';

export function createHud() {
  const el = (id) => document.getElementById(id);
  return {
    root: el('hud'), stars: el('stars'), cash: el('cash'), healthFill: el('healthfill'),
    speedNum: el('speednum'), carName: el('carname'), objective: el('objective'),
    toast: el('toast'), minimap: el('minimap'),
    show() { this.root.classList.remove('hidden'); },
    hide() { this.root.classList.add('hidden'); },
    toastMessage(text, ms) {
      this.toast.textContent = text;
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => { this.toast.textContent = ''; }, ms || 2200);
    },
    update(state) {
      const filled = '★'.repeat(state.wanted);
      const empty = '☆'.repeat(Math.max(0, 5 - state.wanted));
      this.stars.textContent = filled + empty;
      this.cash.innerHTML = `$${Math.floor(state.cash).toLocaleString()}<small>LEO MARIN — PALMA BAY</small>`;
      this.healthFill.style.width = `${Math.max(0, state.health)}%`;
      this.healthFill.style.background = state.health > 50 ? 'linear-gradient(90deg,#37d67a,#a5e635)' : state.health > 25 ? 'linear-gradient(90deg,#e8a83a,#ffd23e)' : 'linear-gradient(90deg,#e84040,#ff7a5a)';
      this.speedNum.textContent = Math.round(Math.abs(state.speed) * 2.2);
      this.carName.textContent = state.inCar ? state.carName.toUpperCase() : 'ON FOOT';
      this.objective.innerHTML = state.objective ? `<b>${state.missionName || 'FREE ROAM'}</b><br>${state.objective}` : '<b>FREE ROAM</b><br>Explore Palma Bay. Press P for missions.';
    },
    drawMinimap(state) {
      const canvas = this.minimap;
      const ctx = canvas.getContext('2d');
      const size = canvas.width;
      const scale = size / (CITY.half * 2 + 90);
      const toMap = (x, z) => [size / 2 + x * scale, size / 2 + z * scale];
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = '#274b5e';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#3f7a4a';
      const [gx, gy] = toMap(-CITY.half, -CITY.half);
      ctx.fillRect(gx, gy, CITY.half * 2 * scale, CITY.half * 2 * scale);
      ctx.fillStyle = '#e8d29a';
      ctx.fillRect(gx, toMap(0, CITY.half)[1], CITY.half * 2 * scale, 46 * scale);
      ctx.fillStyle = '#1d7fa8';
      ctx.fillRect(0, toMap(0, CITY.half + 46)[1], size, size);
      ctx.strokeStyle = '#2e3138';
      ctx.lineWidth = 5;
      const pitch = 60;
      for (let i = -4; i <= 4; i += 1) {
        const [x1, y1] = toMap(i * pitch, -CITY.half);
        const [x2, y2] = toMap(i * pitch, CITY.half);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        const [x3, y3] = toMap(-CITY.half, i * pitch);
        const [x4, y4] = toMap(CITY.half, i * pitch);
        ctx.beginPath(); ctx.moveTo(x3, y3); ctx.lineTo(x4, y4); ctx.stroke();
      }
      if (state.marker) {
        const [mx, my] = toMap(state.marker.x, state.marker.z);
        ctx.fillStyle = '#ffd23e';
        ctx.beginPath(); ctx.arc(mx, my, 7, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(mx, my, 10, 0, Math.PI * 2); ctx.stroke();
      }
      for (const stash of state.stashes || []) {
        const [sx, sy] = toMap(stash.x, stash.z);
        ctx.fillStyle = '#37d67a';
        ctx.fillRect(sx - 3, sy - 3, 6, 6);
      }
      for (const cop of state.police || []) {
        const [px, py] = toMap(cop.x, cop.z);
        ctx.fillStyle = '#ff4040';
        ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill();
      }
      const [px, py] = toMap(state.player.x, state.player.z);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#10202e';
      ctx.beginPath();
      ctx.moveTo(px, py - 9);
      ctx.lineTo(px - 5, py + 5);
      ctx.lineTo(px + 5, py + 5);
      ctx.closePath();
      ctx.fill();
    },
  };
}
