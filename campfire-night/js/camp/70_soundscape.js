// © 2026 George Moussa. All rights reserved.
// CAMP 70. SOUNDSCAPE: where the sounds sit in the night. No keys, no prompts; it only listens to where you are.
//     - A forest reverb (generated, ~2.5 s, darker as it fades) that every one-shot goes through (Camp.setSfxBus).
//     - The fire is placed in space (HRTF): turn your head and it moves; behind you it goes duller.
//     - Live crackle on top of the studio's 8 s loop: pops by fuel, a hiss after fresh wood, now and then a loud pop that spits sparks.
//     - Footsteps on the head bob: grass, or gravel near the shore, louder when you jog.
//     - The pond laps at the nearest bit of shore, with a drip or a fish now and then.
//     - Wind gusts: the leaf bed swells (state.wind), the grass and trees sway faster, the fire throws a few more sparks.
(function () {
  if (!window.Camp) return;
  const C = Camp, { rand, clamp01, smooth, fireAt, player, state } = C;
  const REVERB_SEND = 0.32, FIRE_SEND = 0.1, POP_GAIN = 0.07, STEP_GAIN = 1;
  let A = null;                                                       // the audio graph, built once audio runs
  const fwd = new THREE.Vector3();

  function makeImpulse(ctx, secs) {                                    // decaying noise, low-passed harder as it fades, a few early tree reflections
    const sr = ctx.sampleRate, n = sr * secs | 0, buf = ctx.createBuffer(2, n, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch); let y = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr, a = 0.85 * Math.exp(-t * 5) + 0.12;          // the cutoff closes over the tail
        y += a * ((Math.random() * 2 - 1) - y);
        d[i] = y * Math.exp(-t * 2.7) * smooth(0, 0.012, t);
      }
      for (let k = 0; k < 7; k++) { const i = (rand(0.012, 0.09) * sr) | 0; d[i] += rand(-0.6, 0.6) * (1 - i / (0.1 * sr)); }
    }
    return buf;
  }
  function loopNoise(ctx, secs) { const src = ctx.createBufferSource(); src.buffer = makeNoise(ctx, secs); src.loop = true; return src; }
  function makeNoise(ctx, secs) {
    const n = ctx.sampleRate * secs | 0, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  function panner(ctx) {                                               // direction only: the level is set by hand (distance curves that feel right here)
    const p = ctx.createPanner();
    p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 1; p.rolloffFactor = 0;
    return p;
  }
  function place(p, x, y, z) { if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z); }

  function build(ctx) {
    // reverb bus: dry straight out + a send into the forest
    const bus = ctx.createGain(), conv = ctx.createConvolver(), send = ctx.createGain(), wet = ctx.createGain();
    conv.buffer = makeImpulse(ctx, 2.6); send.gain.value = REVERB_SEND; wet.gain.value = 1;
    bus.connect(audioOut); bus.connect(send); send.connect(conv); conv.connect(wet); wet.connect(audioOut);
    C.setSfxBus(bus);
    // the fire bed goes through a panner at the hearth (the core still sets fireGain's level by fuel and distance)
    const firePan = panner(ctx); place(firePan, fireAt.x, fireAt.y, fireAt.z);
    fireGain.disconnect(); fireGain.connect(firePan); firePan.connect(masterGain);
    const fireSend = ctx.createGain(); fireSend.gain.value = FIRE_SEND; firePan.connect(fireSend); fireSend.connect(conv);
    // live pops and the fresh-wood hiss feed fireGain, so fuel, distance and mute shape them for free
    const pops = ctx.createGain(); pops.gain.value = 1; pops.connect(fireGain);
    const hissSrc = loopNoise(ctx, 2.3), hissHP = ctx.createBiquadFilter(), hiss = ctx.createGain();
    hissHP.type = 'highpass'; hissHP.frequency.value = 4200; hiss.gain.value = 0;
    hissSrc.connect(hissHP); hissHP.connect(hiss); hiss.connect(fireGain); hissSrc.start();
    // pond lapping at the nearest shore (slow, uneven little waves)
    const lapSrc = loopNoise(ctx, 3.1), lapLP = ctx.createBiquadFilter(), lapBP = ctx.createBiquadFilter(), lap = ctx.createGain(), pondPan = panner(ctx);
    lapLP.type = 'lowpass'; lapLP.frequency.value = 650; lapBP.type = 'peaking'; lapBP.frequency.value = 320; lapBP.gain.value = 6; lap.gain.value = 0;
    lapSrc.connect(lapLP); lapLP.connect(lapBP); lapBP.connect(lap); lap.connect(pondPan); pondPan.connect(masterGain); lapSrc.start();
    const lapSend = ctx.createGain(); lapSend.gain.value = 0.15; pondPan.connect(lapSend); lapSend.connect(conv);
    return { ctx, bus, pops, hiss, lap, pondPan, nextPop: 0, nextDrip: 0, step: Math.floor(player.bob / (Math.PI / 2)), lastFuel: state.fuel, fresh: 0 };
  }

  // --- listener: the camera's ears
  function updateListener(ctx) {
    const L = ctx.listener, p = C.camera.position; C.camera.getWorldDirection(fwd);
    if (L.positionX) {
      L.positionX.value = p.x; L.positionY.value = p.y; L.positionZ.value = p.z;
      L.forwardX.value = fwd.x; L.forwardY.value = fwd.y; L.forwardZ.value = fwd.z; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
    } else { L.setPosition(p.x, p.y, p.z); L.setOrientation(fwd.x, fwd.y, fwd.z, 0, 1, 0); }
  }
  // stereo pan of a world point, for one-shots that use Camp.tone's pan
  function panOf(x, z) {
    C.camera.getWorldDirection(fwd);
    const dx = x - C.camera.position.x, dz = z - C.camera.position.z, d = Math.hypot(dx, dz) || 1;
    return Math.max(-0.9, Math.min(0.9, (-fwd.z * dx + fwd.x * dz) / d));   // right = (-fwd.z, fwd.x)
  }

  // --- fire: pops, the odd loud one, the hiss of fresh wood
  function pop(t, big) {
    const g = POP_GAIN * (big ? 3.2 : rand(0.2, 1) ** 2);
    C.noiseHit(t, big ? 0.05 : rand(0.006, 0.025), big ? rand(900, 1600) : rand(1800, 6500), big ? 1.2 : rand(1, 3), g, 'bandpass', A.pops);
    if (big) {
      for (let k = 0; k < 4; k++) C.noiseHit(t + 0.03 + k * rand(0.02, 0.06), rand(0.006, 0.015), rand(3000, 7000), 2, POP_GAIN * 0.5, 'bandpass', A.pops);
      if (C.burst) C.burst(5 + (Math.random() * 5 | 0), 0.75);       // you see the spit you heard
      C.flare(0.25);
    }
  }
  function updateFire(dt) {
    const ctx = A.ctx, now = ctx.currentTime, f = C.fireLevel(), ember = state.ember / C.T.EMBER_MIN;
    if (state.fuel > A.lastFuel + 3) A.fresh = 1;                      // wood just went on: it hisses and pops more for a while
    A.lastFuel = state.fuel; A.fresh = Math.max(0, A.fresh - dt / 25);
    A.hiss.gain.setTargetAtTime(f > 0 ? 0.05 * A.fresh * (0.6 + 0.4 * Math.sin(now * 2.3)) : 0, now, 0.3);
    const rate = f > 0 ? 0.8 + 6 * f + 6 * A.fresh + 8 * state.flare : 1.2 * ember;   // pops a second
    if (!A.nextPop) A.nextPop = now;
    while (A.nextPop < now + 0.1 && rate > 0.05) {
      const big = f > 0 && Math.random() < 0.025 + 0.04 * A.fresh;
      pop(Math.max(A.nextPop, now), big);
      A.nextPop += -Math.log(1 - Math.random()) / rate;              // Poisson: clumps and gaps like real wood
    }
    if (rate <= 0.05) A.nextPop = now + 0.5;
  }

  // --- footsteps on the head bob
  function updateSteps() {
    const step = Math.floor(player.bob / (Math.PI / 2));
    if (step === A.step) return; A.step = step;
    const speed = Math.hypot(player.vx, player.vz);
    if (player.sitting || speed < 0.4 || !C.sfx()) return;
    const t = A.ctx.currentTime, loud = STEP_GAIN * Math.min(1.4, 0.55 + speed * 0.3) * rand(0.8, 1.1);
    const shore = typeof pondDist === 'function' && pondDist(player.x, player.z) < 1.3;
    C.noiseHit(t, 0.07, rand(110, 160), 0.8, 0.09 * loud, 'lowpass');                  // the heel
    if (shore) for (let k = 0; k < 6; k++) C.noiseHit(t + rand(0, 0.07), rand(0.004, 0.012), rand(2500, 6000), 3, 0.05 * loud * rand(0.4, 1));
    else { C.noiseHit(t + 0.01, rand(0.12, 0.18), rand(2200, 3200), 0.7, 0.035 * loud); C.noiseHit(t + 0.03, 0.06, rand(5000, 7000), 1.5, 0.012 * loud); }
  }

  // --- the pond at the nearest bit of shore
  function updatePond(nowMs) {
    if (typeof POND === 'undefined') return;
    const ctx = A.ctx, now = ctx.currentTime;
    const nx = (player.x - POND.cx) / POND.rx, nz = (player.z - POND.cz) / POND.rz, d = Math.hypot(nx, nz) || 1;
    const sx = POND.cx + nx / d * POND.rx, sz = POND.cz + nz / d * POND.rz, dist = Math.hypot(player.x - sx, player.z - sz);
    place(A.pondPan, sx, 0.05, sz);
    const s = nowMs / 1000, wave = Math.max(0, Math.sin(s * 1.25 + Math.sin(s * 0.37) * 2)) ** 1.5;
    A.lap.gain.setTargetAtTime(0.35 * (0.25 + 0.75 * wave) / (1 + 0.18 * dist * dist), now, 0.12);
    if (now > A.nextDrip && C.sfx()) {                                // a drip, a fish, a frog going in
      const px = POND.cx + rand(-0.8, 0.8) * POND.rx, pz = POND.cz + rand(-0.8, 0.8) * POND.rz;
      const far = Math.hypot(player.x - px, player.z - pz), g = 0.05 / (1 + 0.05 * far * far), f0 = rand(700, 1300);
      C.tone(now, f0, f0 * rand(1.6, 2.2), 0.06, g, 'sine', panOf(px, pz));
      if (Math.random() < 0.3) C.noiseHit(now + 0.01, 0.25, 600, 0.8, g * 0.8);
      A.nextDrip = now + rand(5, 16);
    }
  }

  // --- wind gusts: sound, grass and trees, and the fire, on one slow curve
  function gustAt(s) { const g = Math.max(0, Math.sin(s * 0.11) * 0.6 + Math.sin(s * 0.27 + 1.3) * 0.4); return g * g; }
  function updateWind(dt, nowMs) {
    const g = gustAt(nowMs / 1000);
    state.wind = 1 + 0.5 * g;
    if (typeof windU !== 'undefined') windU.value += dt * 0.9 * g;    // the meadow and canopies sway faster in the gust
    if (g > 0.25) C.sparks(g * 0.6);
    return g;
  }

  C.use({
    name: 'soundscape', order: 70,
    reset() { if (A) { A.fresh = 0; A.lastFuel = state.fuel; } },
    frame(dt, nowMs) {
      updateWind(dt, nowMs);
      if (!A) { if (!C.sfx() || typeof fireGain === 'undefined' || !fireGain) return; A = build(audioCtx); }
      if (A.ctx.state !== 'running') return;
      updateListener(A.ctx);
      if (!state.running || state.paused) { A.lap.gain.setTargetAtTime(0, A.ctx.currentTime, 0.3); return; }
      updateFire(dt); updateSteps(); updatePond(nowMs);
    }
  });
  Object.assign(C.test, { soundscape: () => A && ({ fresh: +A.fresh.toFixed(2), lap: +A.lap.gain.value.toFixed(3), hiss: +A.hiss.gain.value.toFixed(3), wind: +state.wind.toFixed(2), step: A.step }), gust: gustAt, panOf });
})();
