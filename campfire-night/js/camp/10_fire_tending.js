// © 2026 George Moussa. All rights reserved.
// CAMP 10. FIRE TENDING: spark bursts out of the fire (C.burst, used by wood, marshmallows…) and F to poke it.
//     A poke throws sparks and lifts the flame; a low fire breathes a little longer, and embers take a flame again.
(function () {
  if (!window.Camp) return;
  const C = Camp, { rand, fireAt } = C;
  const POKE_MS = 2500, POKE_REACH = 2.8, EMBER_RELIGHT = 10, LOW_LIFT = 4;

  // sparks: one pool of points, recycled; colour fades to black (additive), so dead ones cost nothing on screen
  const N = 220, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), vel = new Float32Array(N * 3), life = new Float32Array(N), max = new Float32Array(N);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: goldGlowTex, size: 0.07, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  pts.frustumCulled = false; scene.add(pts);
  let head = 0, live = 0;
  C.burst = function (n, power, at) {
    const o = at || fireAt;
    for (let k = 0; k < n; k++) {
      const i = head; head = (head + 1) % N;
      pos[i * 3] = o.x + rand(-0.15, 0.15); pos[i * 3 + 1] = o.y + rand(-0.05, 0.1); pos[i * 3 + 2] = o.z + rand(-0.15, 0.15);
      vel[i * 3] = rand(-0.7, 0.7) * power; vel[i * 3 + 1] = rand(1.2, 3.4) * power; vel[i * 3 + 2] = rand(-0.7, 0.7) * power;
      life[i] = max[i] = rand(0.7, 2.2);
    }
    live = N;
  };
  function updateSparks(dt, t) {
    if (!live) return;
    let n = 0; const drag = Math.exp(-dt * 1.6);
    for (let i = 0; i < N; i++) {
      if (life[i] <= 0) { col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0; continue; }
      n++; life[i] -= dt;
      vel[i * 3] = vel[i * 3] * drag + Math.sin(t * 3 + i) * 0.4 * dt; vel[i * 3 + 2] *= drag;
      vel[i * 3 + 1] = vel[i * 3 + 1] * drag + 0.35 * dt;            // hot air keeps them rising, slowly
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      const a = Math.max(0, life[i] / max[i]), tw = 0.75 + 0.25 * Math.sin(t * 40 + i * 7);
      col[i * 3] = a * tw; col[i * 3 + 1] = 0.55 * a * a * tw; col[i * 3 + 2] = 0.15 * a * a * a;
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
    live = n;
  }

  // poke
  let pokeAt = 0, pokes = 0;
  const ready = () => performance.now() - pokeAt > POKE_MS;
  const inReach = () => C.player.sitting || C.dFire() < POKE_REACH;
  function poke() {
    if (!inReach() || !ready()) return;
    const s = C.state;
    if (s.fuel <= 0 && s.ember <= 0) { C.toast('Nothing left to stir. It needs wood.'); return; }
    pokeAt = performance.now(); pokes++;
    C.emit('poke', { embers: s.fuel <= 0 });
    if (s.fuel <= 0) { C.addFuel(EMBER_RELIGHT, 'quiet'); C.toast('You stir the embers. A small flame comes back.'); C.burst(40, 0.8); }
    else { C.burst(s.fuel > 35 ? 55 : 35, 1); if (s.fuel < 20) s.fuel += LOW_LIFT; }
    C.flare(0.7); sound();
  }
  function sound() {
    if (!C.sfx()) return; const t = audioCtx.currentTime;
    C.noiseHit(t, 0.18, 220, 1, 0.5);                                 // the stick knocks the wood
    for (let k = 0; k < 16; k++) C.noiseHit(t + 0.03 + Math.random() * 0.6, rand(0.01, 0.03), rand(2000, 6000), 4, 0.28 * rand(0.4, 1));
  }

  C.use({
    name: 'fire', order: 20,
    keys: 'F poke the fire',
    reset() { pokeAt = 0; pokes = 0; },
    key(e) { if (e.type === 'keydown' && e.code === 'KeyF' && !e.repeat && C.state.running && !C.state.paused) { poke(); return true; } return false; },
    target(ctx) {
      if (ctx.sitting || ctx.dFire > POKE_REACH || !ready() || !C.looking(C.HX, 0.4, C.HZ, 0.55)) return null;
      return { label: '<b>F</b> poke the fire', act: poke, prio: 0 };
    },
    frame(dt, nowMs) { updateSparks(dt, nowMs / 1000); },
    moments() { return []; }
  });
  C.test.poke = poke;
})();
