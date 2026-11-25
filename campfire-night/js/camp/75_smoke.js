// © 2026 George Moussa. All rights reserved.
// CAMP 75. SMOKE: a soft plume from the fire. Thin over a good blaze, thick right after fresh wood and over
//     smouldering embers (that is when real fires smoke most). Lit warm at the bottom by the flames, cool and grey higher up,
//     and it leans with the wind gusts from 70_soundscape (state.wind). Pure looks: no keys, no prompts.
(function () {
  if (!window.Camp) return;
  const C = Camp, { rand, clamp01, fireAt, state } = C;
  const N = 30, LIFE = [5.5, 8.5], RISE = 0.42, PEAK = 0.2;

  // one soft puff texture: a few overlapping blurry blobs so it is not a perfect disc
  function puffTex() {
    const s = 128, cv = document.createElement('canvas'); cv.width = cv.height = s;
    const g = cv.getContext('2d');
    for (let k = 0; k < 7; k++) {
      const x = s / 2 + rand(-18, 18), y = s / 2 + rand(-18, 18), r = rand(26, 46);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.32)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; return t;
  }
  const tex = puffTex();
  const warm = new THREE.Color(0x7a4e32), cool = new THREE.Color(0x353a43), ember = new THREE.Color(0x4a3428);   // dark: the composite lifts them a lot
  const puffs = [];
  for (let i = 0; i < N; i++) {
    const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0, fog: true, rotation: rand(0, 6.28) });
    const s = new THREE.Sprite(m); s.visible = false; s.renderOrder = 5; scene.add(s);
    puffs.push({ s, m, age: 0, life: 1, live: false, spin: rand(-0.25, 0.25), drift: rand(-0.06, 0.06), k: 1 });
  }
  let head = 0, carry = 0, lastFuel = state.fuel, fresh = 0;

  function emit(thick) {
    const p = puffs[head]; head = (head + 1) % N;
    p.live = true; p.age = 0; p.life = rand(...LIFE); p.k = thick;
    p.s.position.set(fireAt.x + rand(-0.12, 0.12), fireAt.y + 0.35, fireAt.z + rand(-0.12, 0.12));
    p.s.visible = true;
  }
  function smokiness() {
    const f = C.fireLevel(), em = state.ember / C.T.EMBER_MIN;
    if (f > 0) return 0.35 + 0.65 * fresh + 0.3 * (1 - f);         // a big clean blaze smokes least
    return 0.9 * em;                                                // smouldering
  }

  C.use({
    name: 'smoke', order: 75,
    reset() { fresh = 0; lastFuel = state.fuel; for (const p of puffs) { p.live = false; p.s.visible = false; } },
    frame(dt) {
      if (state.fuel > lastFuel + 3) fresh = 1;                     // wood just went on
      lastFuel = state.fuel; fresh = Math.max(0, fresh - dt / 30);
      const sm = state.running ? smokiness() : 0.4 * (C.fireLevel() > 0 ? 1 : 0);
      carry += dt * (sm > 0.02 ? 2.2 + 3 * sm : 0);                    // puffs a second
      while (carry >= 1) { carry -= 1; emit(sm); }
      const wind = (state.wind || 1) - 1, near = C.camera.position;
      for (const p of puffs) {
        if (!p.live) continue;
        p.age += dt; const u = p.age / p.life;
        if (u >= 1) { p.live = false; p.s.visible = false; continue; }
        const pos = p.s.position;
        pos.y += RISE * (1 - 0.55 * u) * dt;
        pos.x += (p.drift + 0.12 * u + 0.5 * wind * u) * dt;          // drifts off with the breeze, more as it cools
        pos.z += (p.drift * 0.6 - 0.05 * u) * dt;
        const size = 0.3 + 1.6 * Math.sqrt(u);
        p.s.scale.set(size, size, 1);
        p.m.rotation += p.spin * dt;
        const fade = Math.min(1, p.age / 0.7) * (1 - u) * (1 - u);
        // close to the camera it would fill the screen: fade it out instead of walking through a grey wall
        const dCam = pos.distanceTo(near), closeFade = clamp01((dCam - 0.6) / 1.2);
        p.m.opacity = PEAK * p.k * fade * closeFade;
        const lit = C.fireLevel() > 0 ? Math.max(0, 1 - u * 2.5) : 0;  // the flames light the lowest puffs
        p.m.color.copy(cool).lerp(C.fireLevel() > 0 ? warm : ember, Math.max(lit, 0.3 * (1 - u)));
      }
    }
  });
  Object.assign(C.test, { smoke: () => ({ live: puffs.filter((p) => p.live).length, fresh: +fresh.toFixed(2), smokiness: +smokiness().toFixed(2) }) });
})();
