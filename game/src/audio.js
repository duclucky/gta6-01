// Synthesized sound only: no audio files, no network. A WebAudio graph builds the engine
// hum (sawtooth through a low-pass filter), the police siren (alternating tones), gunshots
// (noise burst), pickup blips and a simple two-bar bass loop. M toggles mute.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let muted = false;
  let musicStep = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      ctx = new AudioCtx();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = 420;
      engineOsc.connect(filter); filter.connect(engineGain); engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain); sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch { return false; }
  }

  function blip(freq, dur, type, vol) {
    if (!ensure() || muted) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol || 0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain); gain.connect(master);
    osc.start(); osc.stop(ctx.currentTime + dur);
  }

  function noiseBurst(dur, vol) {
    if (!ensure() || muted) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = vol || 0.4;
    src.connect(gain); gain.connect(master);
    src.start();
  }

  const audio = {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get muted() { return muted; },
    engine(speedRatio, inCar) {
      if (!ensure()) return;
      const target = muted || !inCar ? 0 : 0.05 + speedRatio * 0.09;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(55 + speedRatio * 140, ctx.currentTime, 0.1);
    },
    siren(on) {
      if (!ensure()) return;
      sirenGain.gain.setTargetAtTime(muted || !on ? 0 : 0.045, ctx.currentTime, 0.2);
      if (on) sirenOsc.frequency.setTargetAtTime(650 + 250 * Math.sin(performance.now() / 380), ctx.currentTime, 0.1);
    },
    gunshot() { noiseBurst(0.12, 0.5); },
    pickup() { blip(880, 0.12, 'sine', 0.3); blip(1320, 0.16, 'sine', 0.2); },
    cash() { blip(660, 0.1, 'triangle', 0.3); setTimeout(() => blip(990, 0.14, 'triangle', 0.3), 90); },
    crash() { noiseBurst(0.25, 0.5); },
    startMusic() {
      if (!ensure() || musicTimer) return;
      const bassNotes = [55, 55, 65.4, 49, 55, 55, 73.4, 82.4];
      musicTimer = setInterval(() => {
        if (muted || !ctx) return;
        const freq = bassNotes[musicStep % bassNotes.length];
        musicStep += 1;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle'; osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.16, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.42);
        osc.connect(gain); gain.connect(master);
        osc.start(); osc.stop(ctx.currentTime + 0.45);
      }, 240);
    },
  };
  return audio;
}
