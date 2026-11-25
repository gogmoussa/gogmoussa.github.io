// © 2026 George Moussa. All rights reserved.
// CAMP 80. NIGHT AIR: the cold you can see.
//     - Pond mist: low banks drift over the water from about 01:00 and are thickest at first light (they take the dawn colour).
//     - Your breath: from about midnight a faint puff now and then in front of you, faster when you jog, warm-lit near the fire.
//     Pure looks: no keys, no prompts.
(function () {
  if (!window.Camp) return;
  const C = Camp, { rand, clamp01, smooth, state, player } = C;
  const MIST_N = 10, MIST_PEAK = 0.5, BREATH_PEAK = 0.4;     // the soft textures top out near 0.35 alpha

  function softTex(w, h, blobs) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d');
    for (let k = 0; k < blobs; k++) {
      const x = w * rand(0.25, 0.75), y = h * rand(0.4, 0.6), r = h * rand(0.28, 0.45);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; return t;
  }

  // --- pond mist
  const mistTex = softTex(256, 64, 9), mist = [], mistCol = new THREE.Color(), moonGrey = new THREE.Color(0x8c96a8), tmpC = new THREE.Color();
  for (let i = 0; i < MIST_N; i++) {
    const m = new THREE.SpriteMaterial({ map: mistTex, transparent: true, depthWrite: false, opacity: 0, fog: true });
    const s = new THREE.Sprite(m); s.visible = false; s.renderOrder = 4; scene.add(s);
    mist.push({ s, m, u: rand(-0.85, 0.85), v: rand(-0.7, 0.7), sp: rand(0.012, 0.03), ph: rand(0, 6.28), w: rand(2.6, 4.2) });
  }
  const mistAmt = (min) => smooth(230, 470, min);                     // 00:50 -> 04:50, and it stays for dawn
  function updateMist(dt, t) {
    if (typeof POND === 'undefined') return;
    const amt = state.running || state.done ? mistAmt(state.minutes) : 0;
    const on = amt > 0.01;
    // colour: the fog's own night colour lifted toward moonlit grey, then the horizon's dawn warmth
    mistCol.copy(scene.fog.color).lerp(moonGrey, 0.5);
    if (typeof skyUniforms !== 'undefined') mistCol.lerp(tmpC.copy(skyUniforms.uHorizon.value), 0.35 * smooth(C.T.NIGHT_MIN - 90, C.T.NIGHT_MIN, state.minutes));
    for (const b of mist) {
      b.s.visible = on; if (!on) continue;
      b.u += b.sp * dt * (state.wind || 1); if (b.u > 0.9) b.u = -0.9;   // drift across, wrap round
      const edge = 1 - smooth(0.6, 0.9, Math.hypot(b.u, b.v));          // thinner toward the shore
      b.s.position.set(POND.cx + b.u * POND.rx, 0.28 + 0.06 * Math.sin(t * 0.2 + b.ph), POND.cz + b.v * POND.rz);
      b.s.scale.set(b.w, b.w * 0.3, 1);
      b.m.color.copy(mistCol);
      b.m.opacity = MIST_PEAK * amt * edge * (0.75 + 0.25 * Math.sin(t * 0.13 + b.ph));
    }
  }

  // --- breath
  const breathTex = softTex(64, 64, 4), puffs = [], fwd = new THREE.Vector3(), warm = new THREE.Color(0xc89070), cold = new THREE.Color(0x9aa4b4);
  for (let i = 0; i < 3; i++) {
    const m = new THREE.SpriteMaterial({ map: breathTex, transparent: true, depthWrite: false, opacity: 0, fog: false });
    const s = new THREE.Sprite(m); s.visible = false; s.renderOrder = 6; scene.add(s);
    puffs.push({ s, m, age: 9, vel: new THREE.Vector3() });
  }
  let nextBreath = 0, head = 0;
  const coldAt = (min) => smooth(170, 330, min) * (1 - 0.5 * smooth(C.T.NIGHT_MIN - 60, C.T.NIGHT_MIN, min));
  function exhale(amt) {
    const p = puffs[head]; head = (head + 1) % puffs.length;
    C.camera.getWorldDirection(fwd);
    p.age = 0; p.k = amt;
    p.s.position.copy(C.camera.position).addScaledVector(fwd, 0.3); p.s.position.y -= 0.12;
    p.vel.copy(fwd).multiplyScalar(0.32); p.vel.y += 0.06;
    const nearFire = clamp01(1 - (C.dFire() - 1) / 3) * (C.fireLevel() > 0 ? 1 : 0.3);
    p.m.color.copy(cold).lerp(warm, nearFire * 0.7);
    p.s.visible = true;
  }
  function updateBreath(dt, nowMs) {
    const c = state.running && !state.paused ? coldAt(state.minutes) : 0;
    const speed = Math.hypot(player.vx, player.vz);
    if (c > 0.05 && nowMs > nextBreath) { exhale(c); nextBreath = nowMs + (speed > 2 ? rand(1600, 2200) : rand(3600, 4800)); }
    for (const p of puffs) {
      if (!p.s.visible) continue;
      p.age += dt; const u = p.age / 1.6;
      if (u >= 1) { p.s.visible = false; continue; }
      p.s.position.addScaledVector(p.vel, dt); p.vel.multiplyScalar(Math.exp(-dt * 1.8)); p.vel.y += 0.05 * dt;
      // keep up with a walking head so the puff does not fly backwards past you
      p.s.position.x += player.vx * dt * 0.8; p.s.position.z += player.vz * dt * 0.8;
      const sz = 0.08 + 0.4 * Math.sqrt(u); p.s.scale.set(sz, sz, 1);
      p.m.opacity = BREATH_PEAK * p.k * Math.min(1, p.age / 0.25) * (1 - u) * (1 - u);
    }
  }

  C.use({
    name: 'night-air', order: 80,
    reset() { nextBreath = 0; for (const p of puffs) p.s.visible = false; },
    frame(dt, nowMs) { updateMist(dt, nowMs / 1000); updateBreath(dt, nowMs); }
  });
  C.use({ name: 'air', order: 81,                                   // the air temperature row (the core's airTemp: crickets and breath follow it)
    hud: () => { const t = C.airTemp(state.minutes); return { label: 'Air', value: `${Math.round(t)} °C · ${Math.round(t * 9 / 5 + 32)} °F` }; } });
  Object.assign(C.test, { nightAir: () => ({ mist: +mistAmt(state.minutes).toFixed(2), cold: +coldAt(state.minutes).toFixed(2), breaths: puffs.filter((p) => p.s.visible).length }) });
})();
