// © 2026 George Moussa. All rights reserved.
// ============================================================================
// CAMP 55. FISHING WITH THE MULTITOOL: at the shore, C unslings George's multitool (10i) and turns it into a rod.
//     The spear tip telescopes out into a three-piece mast, the rope coil is the line, the brass hook carries the
//     glowing pommel gem as a lure (night fishing: the fish come to the light).
//     C again: hold to wind up, let go to cast. Watch the gem: small dips are nibbles (wait), a deep pull under is
//     the bite (C now). Then hold C to reel, let go when it surges or the hook slips. Every fish goes back.
//     Hold C with nothing on to reel the lure in. Walk away from the shore or sit down and it folds back up.
//     While the rod is out, the multitool is hidden on George's back (third person).
// ============================================================================
(function () {
  if (!window.Camp) return;
  const C = Camp, { rand, clamp01 } = C;
  const WATER_Y = LAKE_Y + 0.012, G = 9.8;
  const ROD = { ext: 0.75, seg: 0.46, wind: 900, speed: [4, 11], hang: 0.32 };            // ext: seconds to telescope
  const FIGHT = { reel: 1.35, run: 0.8, slip: 0.7, land: 1.45, far: 17 };
  const SHORE = 1.65;                                                                  // pondDist at which the rod is offered
  const SPECIES = [                                                                    // len in cm; from/to in night minutes
    { name: 'perch', len: [15, 28], from: 0, to: 540, w: 5, color: 0x6f7c3a },
    { name: 'trout', len: [24, 44], from: 0, to: 540, w: 2, dawn: 3, color: 0x8d9698 },
    { name: 'carp', len: [36, 62], from: 150, to: 540, w: 1.4, color: 0x9a7436 },
    { name: 'catfish', len: [40, 72], from: 180, to: 420, w: 0.6, color: 0x48463f }
  ];

  // s.mode: 'off' | 'out' (rod in hand, lure hanging) | 'wind' | 'fly' | 'wait' | 'fight' | 'lift' | 'release'
  const s = { mode: 'off', ext: 0, t0: 0, lure: new THREE.Vector3(), v: new THREE.Vector3(), inWater: false,
    biteAt: 0, nibbleAt: 0, dip: 0, biting: 0, fish: null, D: 0, ang: 0, off: 0, tension: 0, strain: 0, surge: 0,
    reeling: false, liftT: 0, relT: 0, relFrom: new THREE.Vector3(), relTo: new THREE.Vector3(), clickT: 0, bend: 0 };
  let caught = [], biggest = null, slipped = 0, held = false;

  const fwd = new THREE.Vector3(), tip = new THREE.Vector3(), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();

  // --- the rod (in your hands, on Camp.vm) ------------------------------------------------------------------
  const steel = C.heldMat(0x7d8792, { metalness: 0.85, roughness: 0.32, envMapIntensity: 0.6, warm: 0.9 });
  const iron = C.heldMat(0x23272e, { metalness: 0.7, roughness: 0.5, envMapIntensity: 0.4, warm: 0.7 });
  const brass = C.heldMat(0x9c7231, { metalness: 0.85, roughness: 0.35, envMapIntensity: 0.6, warm: 1 });
  const leather = C.heldMat(0x3e2716, { roughness: 0.9, warm: 0.8 });
  const cylY = (r0, r1, y0, y1, seg = 12) => { const g = new THREE.CylinderGeometry(r1, r0, y1 - y0, seg); g.translate(0, (y0 + y1) / 2, 0); return g; };
  const ringY = (y, r, tube = 0.006) => { const g = new THREE.TorusGeometry(r, tube, 6, 16); g.rotateX(Math.PI / 2); g.translate(0, y, 0); return g; };

  const rod = new THREE.Group(); rod.visible = false; C.vm.add(rod);
  const put = (g, m, parent = rod) => { const o = new THREE.Mesh(g, m); parent.add(o); return o; };
  put(cylY(0.017, 0.017, -0.24, 0.58), iron);                        // the shaft, held at the leather grip (y = 0)
  put(cylY(0.022, 0.022, -0.13, 0.13), leather);
  [-0.13, 0.13, 0.3].forEach((y) => put(ringY(y, 0.023), brass));
  put(cylY(0.02, 0.028, -0.27, -0.23, 14), brass);                     // pommel cap (its gem is the lure now)
  const blade = new THREE.Shape();                                     // the axe head and pick, a size down from 10i
  blade.moveTo(0.02, 0.40); blade.lineTo(0.08, 0.405); blade.quadraticCurveTo(0.17, 0.46, 0.18, 0.57);
  blade.quadraticCurveTo(0.1, 0.55, 0.07, 0.525); blade.quadraticCurveTo(0.1, 0.49, 0.07, 0.455); blade.lineTo(0.02, 0.455);
  const bg = new THREE.ExtrudeGeometry(blade, { depth: 0.012, bevelEnabled: false, curveSegments: 8 }); bg.translate(0, 0, -0.006);
  put(bg, steel);
  const cheek = new THREE.BoxGeometry(0.06, 0.085, 0.04); cheek.translate(0, 0.43, 0); put(cheek, iron);
  const pick = new THREE.ConeGeometry(0.022, 0.19, 10); pick.rotateZ(Math.PI / 2); pick.translate(-0.12, 0.43, 0); put(pick, steel);
  // the mast: three nested pivots; each piece slides out of the one before (scale.y = how far out), and bends
  const mast = [];
  let parent = new THREE.Group(); parent.position.y = 0.58; rod.add(parent);
  for (let i = 0; i < 3; i++) {
    const piv = new THREE.Group(); parent.add(piv);
    const r0 = 0.009 - i * 0.002, r1 = r0 - 0.0015;
    const piece = put(cylY(r0, r1, 0, ROD.seg, 8), steel, piv);
    const guide = put(ringY(ROD.seg - 0.01, r1 + 0.006, 0.0025), brass, piv);   // a line guide at each joint
    const end = new THREE.Group(); end.position.y = ROD.seg; piv.add(end);
    mast.push({ piv, piece, guide, end }); parent = end;
  }
  const tipObj = mast[2].end;

  // --- the lure, the line, the fish (in the world) ----------------------------------------------------------
  const glowTex = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(160,240,255,1)'); gr.addColorStop(0.35, 'rgba(70,200,255,.45)'); gr.addColorStop(1, 'rgba(40,160,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv);
  })();
  const lure = new THREE.Group(); lure.visible = false; scene.add(lure);
  const gemGeo = new THREE.OctahedronGeometry(0.022, 0); gemGeo.scale(1, 1.45, 1);
  const gem = new THREE.Mesh(gemGeo, new THREE.MeshBasicMaterial({ color: 0x8ff0ff })); lure.add(gem);
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.003, 5, 12, Math.PI * 1.35), new THREE.MeshStandardMaterial({ color: 0xc08f3d, metalness: 0.9, roughness: 0.35 }));
  hook.rotation.z = Math.PI * 0.6; hook.position.y = -0.04; lure.add(hook);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9 }));
  glow.scale.setScalar(0.32); lure.add(glow);

  const LN = 24, linePos = new Float32Array(LN * 3);
  const lineGeo = new THREE.BufferGeometry(); lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
  const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xd9cfb4, transparent: true, opacity: 0.55, depthWrite: false }));
  line.frustumCulled = false; line.visible = false; scene.add(line);

  function makeFish(sp, lenM) {
    const g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color: sp.color, metalness: 0.45, roughness: 0.4 });
    const belly = new THREE.MeshStandardMaterial({ color: 0xd8d2bc, metalness: 0.3, roughness: 0.5 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), mat); body.scale.set(0.11, 0.2, 0.5); g.add(body);
    const under = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), belly); under.scale.set(0.095, 0.14, 0.42); under.position.y = -0.06; g.add(under);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.3, 4), mat); tail.scale.set(0.15, 1, 1); tail.rotation.x = -Math.PI / 2; tail.position.z = 0.6; g.add(tail);
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.25, 3), mat); fin.scale.set(0.12, 1, 1.6); fin.position.set(0, 0.2, 0.05); g.add(fin);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    [-1, 1].forEach((k) => { const e = eye.clone(); e.position.set(k * 0.085, 0.05, -0.36); g.add(e); });
    g.userData.tail = tail; g.scale.setScalar(lenM); g.visible = false; scene.add(g);
    return g;
  }
  function dropFish() { if (s.fish && s.fish.mesh) { scene.remove(s.fish.mesh); s.fish.mesh.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); } s.fish = null; }

  // --- the multitool on George's back (the third-person body is a clone of his rig, so it carries one too) ---
  function backTool(show) {
    scene.traverse((o) => { if (o.name === 'GeorgeMultitool') o.visible = show; });
  }

  // --- sound --------------------------------------------------------------------------------------------
  const panAt = (x, z) => (window.CAMP && CAMP.panOf) ? CAMP.panOf(x, z) : 0;
  function clicks(n, gap, f) { if (!C.sfx()) return; const t = audioCtx.currentTime; for (let i = 0; i < n; i++) C.noiseHit(t + i * gap, 0.025, f + i * 140, 5, 0.07); }
  function whoosh(p) { if (C.sfx()) C.noiseHit(audioCtx.currentTime, 0.4, 700 + p * 900, 0.7, 0.08 + p * 0.08); }
  function plop(big) { if (!C.sfx()) return; const t = audioCtx.currentTime, pan = panAt(s.lure.x, s.lure.z); C.tone(t, big ? 420 : 640, big ? 140 : 260, big ? 0.2 : 0.1, big ? 0.13 : 0.06, 'sine', pan); C.noiseHit(t + 0.01, big ? 0.4 : 0.18, big ? 800 : 1500, 0.9, big ? 0.14 : 0.05); }
  function splash(g) { if (C.sfx()) C.noiseHit(audioCtx.currentTime, 0.45, 1100, 0.6, g); }

  // --- where things are -----------------------------------------------------------------------------------
  function shoreOk() { return pondDist(C.player.x, C.player.z) <= SHORE; }
  function facingWater() {
    tmp.set(POND.cx - C.player.x, 0, POND.cz - C.player.z).normalize();
    return tmp.dot(tmp2.set(-Math.sin(C.player.yaw), 0, -Math.cos(C.player.yaw))) > 0.3;
  }
  function tipWorld() { tipObj.updateWorldMatrix(true, false); return tipObj.getWorldPosition(tip); }
  const groundAt = (x, z) => (pondDist(x, z) < 1 ? WATER_Y : terrainY(x, z) + 0.02);
  const hDist = () => Math.hypot(s.lure.x - C.player.x, s.lure.z - C.player.z);
  // a point in the water straight out from where you stand (to put a fish back)
  function waterOut(out) {
    const dx = POND.cx - C.player.x, dz = POND.cz - C.player.z, d = Math.hypot(dx, dz) || 1;
    for (let k = 0.3; k < d; k += 0.1) { const x = C.player.x + dx / d * k, z = C.player.z + dz / d * k; if (pondDist(x, z) < 0.94) return out.set(x + dx / d * 0.4, WATER_Y, z + dz / d * 0.4); }
    return out.set(POND.cx, WATER_Y, POND.cz);
  }

  // --- flow -----------------------------------------------------------------------------------------------
  function unsling() {
    s.mode = 'out'; s.ext = 0; rod.visible = true; backTool(false); clicks(3, 0.17, 2600);
    if (!held) { held = true; C.toast('The spear tip slides out into a mast. The rope is the line, the gem is the lure.'); }
  }
  function stow(msg) {
    if (s.mode === 'fight' && !msg) msg = 'You walked off. It slipped the hook.';
    dropFish(); s.mode = 'off'; s.reeling = false; rod.visible = false; lure.visible = false; line.visible = false; backTool(true);
    clicks(3, 0.12, 3000); if (msg) C.toast(msg);
  }
  function cast() {
    const p = Math.min(1, (performance.now() - s.t0) / ROD.wind);
    fwd.set(0, 0, -1).applyQuaternion(C.head.quaternion);
    const h = Math.hypot(fwd.x, fwd.z) || 1, el = Math.max(0.05, Math.min(0.9, C.player.pitch + 0.45)), sp = ROD.speed[0] + (ROD.speed[1] - ROD.speed[0]) * p;
    s.lure.copy(tipWorld());
    s.v.set(fwd.x / h * Math.cos(el) * sp, Math.sin(el) * sp, fwd.z / h * Math.cos(el) * sp);
    s.mode = 'fly'; whoosh(p);
  }
  function settle() {                                                  // the lure has come down
    s.inWater = pondDist(s.lure.x, s.lure.z) < 1;
    s.mode = 'wait'; s.biting = 0; s.dip = 0;
    if (s.inWater) {
      s.lure.y = WATER_Y; spawnRipple(s.lure.x, s.lure.z, 0.45); plop(false);
      const far = clamp01((hDist() - 2) / 8), now = performance.now();
      s.biteAt = now + rand(7, 20) * 1000 * (1.15 - far * 0.4);         // farther out, a little quicker
      s.nibbleAt = now + rand(1.5, 4) * 1000;
    } else C.toast('On the bank. Hold C to reel it back in.');
  }
  function pickSpecies() {
    const m = C.state.minutes, dawn = m > C.T.NIGHT_MIN - 140;
    const pool = SPECIES.filter((f) => m >= f.from && m <= f.to);
    const w = pool.map((f) => f.w * (dawn && f.dawn ? f.dawn : 1)), sum = w.reduce((a, b) => a + b, 0);
    let r = Math.random() * sum; for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return pool[i]; }
    return pool[0];
  }
  function hookIt() {
    const sp = pickSpecies(), far = clamp01((hDist() - 2) / 8);
    const len = Math.round(sp.len[0] + (sp.len[1] - sp.len[0]) * Math.pow(Math.random(), 1.6 - far * 0.7));
    s.fish = { sp, len, strength: 0.45 + len / 60 * 0.85, stamina: 1, mesh: null, surgeT: 0, nextSurge: performance.now() + rand(400, 1400) };
    s.mode = 'fight'; s.D = hDist(); s.ang = Math.atan2(s.lure.x - C.player.x, s.lure.z - C.player.z); s.off = 0; s.strain = 0; s.tension = 0.3;
    spawnRipple(s.lure.x, s.lure.z, 0.7); splash(0.12); C.toast('Fish on.');
  }
  function lose(msg) { slipped++; dropFish(); s.mode = 'wait'; s.inWater = pondDist(s.lure.x, s.lure.z) < 1; s.biteAt = performance.now() + rand(9, 22) * 1000; s.nibbleAt = performance.now() + 3000; s.reeling = false; C.toast(msg); }
  function land() {
    const f = s.fish; f.mesh = makeFish(f.sp, f.len / 100); f.mesh.visible = true;
    s.mode = 'lift'; s.liftT = 0; s.reeling = false; splash(0.16); spawnRipple(s.lure.x, s.lure.z, 0.6);
    caught.push(f.len); if (!biggest || f.len > biggest.len) biggest = { name: f.sp.name, len: f.len };
    const n = caught.length;
    C.toast(`A ${f.sp.name}, about ${f.len} cm.${n > 1 && biggest.len === f.len ? ' The biggest tonight.' : ''} You hold it a moment, then let it go.`);
    C.emit('fish', { name: f.sp.name, len: f.len });
  }

  // --- per-step physics ---------------------------------------------------------------------------------
  function tick(dt) {
    const S = C.state;
    if (s.mode === 'off' || S.paused) return 0;                      // nothing bites or slips while the guide is open
    if (C.player.sitting) { stow(); return 0; }
    if (!shoreOk() && s.mode !== 'lift' && s.mode !== 'release') { stow(s.mode === 'fight' ? null : ''); return 0; }
    const now = performance.now();
    s.ext = Math.min(1, s.ext + dt / ROD.ext);
    if (s.mode === 'fly') {
      s.v.y -= G * dt; s.v.multiplyScalar(1 - dt * 0.15); s.lure.addScaledVector(s.v, dt);
      if (s.lure.y <= groundAt(s.lure.x, s.lure.z) && s.v.y < 0) { s.lure.y = groundAt(s.lure.x, s.lure.z); settle(); }
    } else if (s.mode === 'wait') {
      if (s.reeling) {                                                 // reel the lure in along the ground or water
        const d = hDist(), k = Math.min(d, 2.4 * dt);
        if (d < 1.35 || (!s.inWater && d < 1.6)) { s.mode = 'out'; s.reeling = false; clicks(1, 0, 2400); return 0; }
        s.lure.x += (C.player.x - s.lure.x) / d * k; s.lure.z += (C.player.z - s.lure.z) / d * k;
        s.inWater = pondDist(s.lure.x, s.lure.z) < 1; s.lure.y = groundAt(s.lure.x, s.lure.z);
        s.biting = 0; s.dip = 0;
      } else if (s.inWater) {
        if (s.biting && now > s.biting) { s.biting = 0; s.biteAt = now + rand(8, 20) * 1000; s.nibbleAt = now + rand(2, 4) * 1000; C.toast('It took the bait and let go. Watch for the deep pull.'); }
        if (!s.biting && now > s.biteAt) { s.biting = now + 1100; s.dip = 1; spawnRipple(s.lure.x, s.lure.z, 0.5); plop(true); }
        else if (!s.biting && now > s.nibbleAt) { s.nibbleAt = now + rand(1.8, 4.5) * 1000; s.dip = Math.max(s.dip, 0.3); spawnRipple(s.lure.x, s.lure.z, 0.2); plop(false); }
      }
      s.dip = Math.max(s.biting ? 0.85 : 0, s.dip - dt * 2.5);
    } else if (s.mode === 'fight') {
      const f = s.fish;
      if (now > f.nextSurge) { f.surgeT = now + rand(600, 1300) * (0.6 + f.strength * 0.4); f.nextSurge = f.surgeT + rand(900, 2600); spawnRipple(s.lure.x, s.lure.z, 0.45); splash(0.05 + f.strength * 0.04); }
      const surge = now < f.surgeT ? 1 : 0; s.surge += (surge - s.surge) * (1 - Math.exp(-dt * 8));
      const pull = (0.4 + 0.6 * s.surge) * f.stamina * f.strength;
      if (s.reeling) { s.D -= (FIGHT.reel - pull * 0.9) * dt; s.tension = 0.25 + pull * 0.75 + 0.3; }
      else { s.D += pull * FIGHT.run * dt; s.tension = 0.12 + pull * 0.3; }
      f.stamina = Math.max(0.2, f.stamina - dt * (s.reeling ? 0.045 : 0.03) * (0.6 + s.tension));
      s.strain = s.tension > 1 ? s.strain + dt : Math.max(0, s.strain - dt * 1.5);
      if (s.strain > FIGHT.slip) return lose(`Too much pull. The ${f.sp.name} shook the hook.`), 0;
      if (s.D > FIGHT.far) return lose('It ran out past the light and was gone.'), 0;
      s.off += Math.sin(now * 0.0011 + f.len) * dt * 0.25 * f.stamina;
      s.off = Math.max(-0.6, Math.min(0.6, s.off));
      const a = s.ang + s.off * Math.min(1, s.D / 4);
      s.lure.set(C.player.x + Math.sin(a) * s.D, WATER_Y - 0.03, C.player.z + Math.cos(a) * s.D);
      const pd = pondDist(s.lure.x, s.lure.z);
      if (pd > 0.97) { const k = 0.97 / pd; s.lure.x = POND.cx + (s.lure.x - POND.cx) * k; s.lure.z = POND.cz + (s.lure.z - POND.cz) * k; s.D = Math.max(s.D * 0.98, hDist()); }
      if (hDist() < FIGHT.land) land();
      if (s.reeling && now > s.clickT) { s.clickT = now + 55; if (C.sfx()) C.noiseHit(audioCtx.currentTime, 0.012, 4300, 4, 0.03); }
    } else if (s.mode === 'lift') {
      s.liftT += dt;
      if (s.liftT > 2.6) { s.mode = 'release'; s.relT = 0; s.relFrom.copy(s.fish.mesh.position); waterOut(s.relTo); }
    } else if (s.mode === 'release') {
      s.relT += dt;
      if (s.relT > 0.7 && !s.fish.splashed) { s.fish.splashed = true; spawnRipple(s.relTo.x, s.relTo.z, 0.8); splash(0.14); }
      if (s.relT > 1.9) { dropFish(); s.mode = 'out'; }
    }
    return 0;
  }

  // --- every frame: the rod in your hands, the lure, the line, the fish -----------------------------------
  const lineMid = new THREE.Vector3();
  function frame(dt, nowMs) {
    const on = s.mode !== 'off' && C.state.running;
    rod.visible = on; lure.visible = on; line.visible = on && s.ext > 0.6;
    if (!on) return;
    const winding = s.mode === 'wind' ? Math.min(1, (performance.now() - s.t0) / ROD.wind) : 0;
    // held low on the right, tip up and out over the water; winding up draws it back, a fish bends it
    const bendGoal = s.mode === 'fight' ? Math.min(1.3, s.tension) : s.mode === 'lift' ? 0.7 : s.mode === 'wait' ? 0.05 + s.dip * 0.3 : 0;
    s.bend += (bendGoal - s.bend) * (1 - Math.exp(-dt * 9));
    rod.position.set(C.side(0.58, 0.5), -0.34, -0.5);
    rod.rotation.set(-1.0 + winding * 0.7 - (s.mode === 'fly' ? 0.15 : 0), 0, 0.22 + (s.mode === 'fight' ? s.off * 0.25 : 0));
    const e = C.smooth(0, 1, s.ext);
    mast.forEach((m, i) => {
      const out = clamp01(e * 3 - i);                                // the pieces slide out one after another
      m.piv.position.y = -ROD.seg * (1 - out) * 0.98;
      m.piv.rotation.x = -s.bend * (0.12 + i * 0.14);
      m.guide.visible = out > 0.05;
    });
    tipWorld();
    // the lure
    if (s.mode === 'out' || s.mode === 'wind') {
      const sw = Math.sin(nowMs * 0.003) * 0.03;
      s.lure.lerp(tmp.set(tip.x + sw, tip.y - ROD.hang * (0.3 + 0.7 * s.ext), tip.z), 1 - Math.exp(-dt * 12));
    }
    lure.position.copy(s.lure);
    if (s.mode === 'wait' && s.inWater && !s.reeling) lure.position.y = WATER_Y + 0.012 + Math.sin(nowMs * 0.0024) * 0.006 - s.dip * 0.06;
    const under = s.mode === 'fight' || (s.mode === 'wait' && s.dip > 0.6);
    glow.material.opacity = under ? 0.45 : 0.9; glow.scale.setScalar(under ? 0.42 : 0.3 + Math.sin(nowMs * 0.004) * 0.02);
    gem.rotation.y += dt * 1.5;
    // the fish
    const f = s.fish;
    if (f && f.mesh) {
      const fm = f.mesh, wig = Math.sin(nowMs * 0.022);
      fm.userData.tail.rotation.y = wig * 0.5;
      if (s.mode === 'lift') {                                         // up out of the water to hang in front of you
        fwd.set(0, 0, -1).applyQuaternion(C.head.quaternion); fwd.y = 0; fwd.normalize();
        const k = C.smooth(0, 0.9, s.liftT);
        tmp.copy(C.head.position).addScaledVector(fwd, 0.95); tmp.y -= 0.18 + f.len / 200;
        tmp2.set(s.lure.x, WATER_Y, s.lure.z);
        fm.position.lerpVectors(tmp2, tmp, k); fm.position.y += Math.sin(k * Math.PI) * 0.25;
        fm.rotation.set(Math.PI / 2, 0, wig * 0.25); fm.rotation.y = Math.atan2(fwd.x, fwd.z);
        lure.position.copy(fm.position); lure.position.y += f.len / 200 + 0.03;
      } else if (s.mode === 'release') {                               // lowered back, then away under the surface
        const k = C.smooth(0, 0.7, s.relT), gone = clamp01((s.relT - 0.7) / 1.2);
        fm.position.lerpVectors(s.relFrom, s.relTo, k); fm.position.y = C.lerp(s.relFrom.y, WATER_Y - 0.05 - gone * 0.5, k);
        tmp.subVectors(s.relTo, C.head.position); tmp.y = 0; tmp.normalize();
        fm.position.addScaledVector(tmp, gone * 1.6);
        fm.rotation.set(C.lerp(Math.PI / 2, 0.15, k), Math.atan2(-tmp.x, -tmp.z), 0);
        fm.visible = gone < 0.95;
        s.lure.lerp(tmp2.set(tip.x, tip.y - ROD.hang, tip.z), 1 - Math.exp(-dt * 6)); lure.position.copy(s.lure);
      }
    }
    // the line: tip to lure, sagging when slack, near-straight under a fish
    const a = tip, b = lure.position, d = a.distanceTo(b);
    const slack = s.mode === 'fight' ? 0.02 * (1.3 - Math.min(1.2, s.tension)) : s.mode === 'fly' ? 0.02 : s.mode === 'wait' ? 0.09 : 0.01;
    for (let i = 0; i < LN; i++) {
      const t = i / (LN - 1);
      lineMid.lerpVectors(a, b, t); lineMid.y -= Math.sin(t * Math.PI) * d * slack;
      if (s.mode === 'wait' && s.inWater && lineMid.y < WATER_Y) lineMid.y = WATER_Y;
      linePos[i * 3] = lineMid.x; linePos[i * 3 + 1] = lineMid.y; linePos[i * 3 + 2] = lineMid.z;
    }
    lineGeo.attributes.position.needsUpdate = true;
  }

  // --- keys: C does everything ----------------------------------------------------------------------------
  function key(e) {
    if (e.code !== 'KeyC') return false;
    const S = C.state; if (!S.running || S.paused) return true;
    if (e.type === 'keydown') {
      if (e.repeat) return true;
      if (s.mode === 'off') {
        if (C.player.sitting) return true;
        if (!shoreOk() || !facingWater()) { C.toast('Fishing is from the shore. Face the water.'); return true; }
        if (C.handsBusy(mod)) { C.toast('Your hands are full.'); return true; }
        unsling(); return true;
      }
      if (s.mode === 'out' && s.ext >= 1) { s.mode = 'wind'; s.t0 = performance.now(); return true; }
      if (s.mode === 'wait') {
        if (s.biting) { s.biting = 0; s.dip = 0; hookIt(); return true; }
        if (s.inWater && s.dip > 0.1) {                                // too soon: it was only nibbling
          s.biteAt = performance.now() + rand(10, 22) * 1000; s.dip = 0; C.toast('Too soon. It was only nibbling.'); return true;
        }
        s.reeling = true; return true;
      }
      if (s.mode === 'fight') { s.reeling = true; return true; }
      return true;
    }
    if (e.type === 'keyup') {
      if (s.mode === 'wind') cast();
      s.reeling = false; return true;
    }
    return true;
  }

  const bar = (v, hot) => `<span class="pw"><i style="width:${Math.round(clamp01(v) * 100)}%;${hot ? 'background:linear-gradient(90deg,#f0b070,#ff6040)' : ''}"></i></span>`;
  const mod = C.use({
    name: 'fishing', order: 55,
    keys: 'C fish (at the shore)',
    reset() { if (s.mode !== 'off') stow(''); caught = []; biggest = null; slipped = 0; held = false; },
    busy: () => s.mode !== 'off',
    speed: () => s.mode === 'off' ? 1 : s.mode === 'fight' ? 0.25 : 0.55,
    target(ctx) {
      switch (s.mode) {
        case 'off': {
          if (ctx.sitting || ctx.busy || !shoreOk() || !facingWater()) return null;
          const stones = C.mods.some((m) => m.name === 'stones');           // the shore offers both; one line
          return { label: '<b>C</b> fish with the multitool' + (stones ? ' · <b>Hold E</b> skip a stone' : ''), prio: 1.1, act: stones ? undefined : unsling };
        }
        case 'out': return { label: s.ext < 1 ? 'Unfolding the rod…' : '<b>Hold C</b> to cast, let go to throw · walk away to fold it', prio: 10 };
        case 'wind': return { label: `Let go of <b>C</b> to cast${bar((performance.now() - s.t0) / ROD.wind)}`, prio: 10 };
        case 'fly': return { label: '…', prio: 10 };
        case 'wait': return { label: s.reeling ? 'Reeling in…' : !s.inWater ? '<b>Hold C</b> to reel in' : s.biting ? '<b>C</b> now!' : 'Watch the light · small dips are nibbles · <b>hold C</b> to reel in', prio: 10 };
        case 'fight': return { label: `<b>Hold C</b> to reel · let go when it pulls hard${bar(s.tension / 1.3, s.tension > 0.9)}`, prio: 10 };
        default: return { label: '', prio: 10 };
      }
    },
    tick,
    frame,
    key,
    onSit() { if (s.mode !== 'off') stow(); },
    moments() {
      const n = caught.length, out = [];
      if (n) out.push(n === 1 ? 'one fish caught and let go' : `${n} fish caught and let go`);
      if (biggest && n > 1) out.push(`the biggest, a ${biggest.name} about ${biggest.len} cm`);
      return out;
    }
  });
  C.test.fishing = () => ({ mode: s.mode, ext: +s.ext.toFixed(2), inWater: s.inWater, biting: !!s.biting, D: +s.D.toFixed(2), tension: +s.tension.toFixed(2),
    stamina: s.fish ? +s.fish.stamina.toFixed(2) : null, fish: s.fish ? `${s.fish.sp.name} ${s.fish.len}` : null, caught: caught.slice(), slipped,
    lure: [s.lure.x, s.lure.y, s.lure.z].map((v) => +v.toFixed(2)) });
  C.test.fish = {                                                       // drive it from the console
    key: (type, repeat) => key({ code: 'KeyC', type: type || 'keydown', repeat: !!repeat }),
    cast: (p, pitch) => { if (pitch !== undefined) C.player.pitch = pitch; if (s.mode === 'off') unsling(); s.ext = 1; s.mode = 'wind'; s.t0 = performance.now() - (p == null ? 0.7 : p) * ROD.wind; cast(); },
    biteNow: () => { if (s.mode === 'wait' && s.inWater) s.biteAt = performance.now(); },
    reel: (on) => { s.reeling = !!on; },
    stow: () => stow('')
  };
})();
