// © 2026 George Moussa. All rights reserved.
// CAMP 20. WOOD: sticks around the clearing (carry three), logs out by the tree line (carry one, walk slower,
//     burn for hours). What you carry shows in your hands; fed wood arcs into the fire and catches when it lands.
(function () {
  if (!window.Camp) return;
  const C = Camp, { rand, HX, HZ, fireAt } = C;
  const STICKS = 14, CARRY = 3, STICK_FUEL = 45, STICK_RESPAWN_MS = 6000;
  const LOGS = 5, LOG_FUEL = 110, LOG_SPEED = 0.7, LOG_RESPAWN_MS = 30000;
  const carry = { sticks: 0, log: false };
  let sticksFed = 0, logsFed = 0, logTold = false;

  // --- meshes
  const stickGeo = new THREE.CylinderGeometry(0.045, 0.06, 1.0, 6);
  // Sticks are dark and warm on purpose: the night light is blue-pink and the scene composite lifts colours a lot,
  // so the old 0x8a6440 read pale pink-white on the grass (audit Nov 24). A faint warm floor keeps them brown.
  const STICK_COL = 0x3e2810, STICK_BASE = 0x140803;
  const newStickMat = () => new THREE.MeshStandardMaterial({ color: STICK_COL, emissive: STICK_BASE, roughness: 0.85, envMapIntensity: 0.4 });
  const stickMat = newStickMat();
  const logGeo = new THREE.CylinderGeometry(0.12, 0.13, 0.95, 9), endGeo = new THREE.CircleGeometry(0.115, 9);
  const logMat = new THREE.MeshStandardMaterial({ color: 0x5c4129, roughness: 0.95 }), endMat = new THREE.MeshStandardMaterial({ color: 0xb08a5e, roughness: 0.9 });
  function makeLog(bark, end) {
    const g = new THREE.Group(), a = new THREE.Mesh(endGeo, end || endMat), b = new THREE.Mesh(endGeo, end || endMat);
    a.position.y = 0.476; a.rotation.x = -Math.PI / 2; b.position.y = -0.476; b.rotation.x = Math.PI / 2;
    g.add(new THREE.Mesh(logGeo, bark || logMat), a, b); return g;
  }
  // each ground stick has its own material so the one you aim at (and ones in the headlamp beam) can glint
  const sticks = [], logs = [];
  function place(item, rMin, rMax, pad, lift) {
    for (let t = 0; t < 120; t++) {
      const a = Math.random() * Math.PI * 2, r = rand(rMin, rMax), x = HX + Math.cos(a) * r, z = HZ + Math.sin(a) * r;
      if (Math.hypot(x, z) > C.T.WORLD_R - 1.5 || C.blocked(x, z, pad)) continue;
      item.mesh.position.set(x, terrainY(x, z) + lift, z);
      item.mesh.rotation.set(Math.PI / 2, 0, Math.random() * Math.PI * 2);
      item.mesh.visible = true; item.active = true; item.respawnAt = 0; return;
    }
  }
  const placeStick = (s) => place(s, 3.2, 15, 0.3, 0.09), placeLog = (l) => place(l, 9, 22, 0.7, 0.12);

  // --- in your hands
  const heldStick = C.heldMat(0x3a2412);
  const vmSticks = [0, 1, 2].map((i) => {
    const m = new THREE.Mesh(stickGeo, heldStick);
    m.scale.set(0.45, 0.55, 0.45); m.position.set(0, -0.33 - i * 0.012, -0.66 + i * 0.02);
    m.rotation.set(-1.05 + i * 0.12, 0.25 - i * 0.18, -0.5 + i * 0.22); C.vm.add(m); return m;
  });
  const vmLog = makeLog(C.heldMat(0x2e1d10), C.heldMat(0x6a4e32)); vmLog.scale.setScalar(0.62); vmLog.position.set(0, -0.38, -0.6); vmLog.rotation.set(0, 0, Math.PI / 2 - 0.08); C.vm.add(vmLog);

  // --- feeding: the wood flies in an arc and catches when it lands
  const tossed = [], fwd = new THREE.Vector3();
  function feed() {
    const isLog = carry.log;
    if (isLog) carry.log = false; else if (carry.sticks > 0) carry.sticks--; else return;
    camera.getWorldDirection(fwd);
    const mesh = isLog ? makeLog() : new THREE.Mesh(stickGeo, stickMat);
    if (!isLog) mesh.scale.set(0.8, 0.62, 0.8);
    const from = camera.position.clone().addScaledVector(fwd, 0.5); from.y -= 0.3;
    mesh.position.copy(from); scene.add(mesh);
    const d = Math.hypot(from.x - HX, from.z - HZ);
    tossed.push({ mesh, isLog, from, to: new THREE.Vector3(HX + rand(-0.15, 0.15), fireAt.y - 0.22, HZ + rand(-0.15, 0.15)), t: 0,
      dur: (isLog ? 0.9 : 0.55) + d * 0.12, arc: isLog ? 0.25 : 0.5,
      spin: [rand(-3, 3), rand(-2, 2), isLog ? rand(-1, 1) : rand(4, 8)], rot0: [isLog ? 0 : -1, 0, isLog ? Math.PI / 2 : 0] });
  }
  function lands(w) {
    scene.remove(w.mesh);
    C.addFuel(w.isLog ? LOG_FUEL : STICK_FUEL); C.emit('feed', { log: !!w.isLog });
    if (w.isLog) logsFed++; else sticksFed++;
    C.flare(w.isLog ? 1.4 : 1); if (C.burst) C.burst(w.isLog ? 70 : 30, w.isLog ? 1.2 : 0.9);
    thunk(w.isLog);
  }
  function updateTossed(dt) {
    for (let i = tossed.length - 1; i >= 0; i--) {
      const w = tossed[i]; w.t += dt / w.dur; const u = Math.min(1, w.t), r = w.rot0, s = w.spin;
      w.mesh.position.lerpVectors(w.from, w.to, u); w.mesh.position.y += Math.sin(u * Math.PI) * w.arc;
      w.mesh.rotation.set(r[0] + s[0] * u, r[1] + s[1] * u, r[2] + s[2] * u);
      if (u >= 1) { lands(w); tossed.splice(i, 1); }
    }
  }

  // --- sounds
  function pickSound(heavy) {
    if (!C.sfx()) return; const t = audioCtx.currentTime;
    for (let i = 0; i < (heavy ? 5 : 3); i++) C.noiseHit(t + i * 0.03, heavy ? 0.12 : 0.05, heavy ? rand(300, 700) : rand(900, 1800), 2, heavy ? 0.25 : 0.15);
  }
  function thunk(heavy) {
    if (!C.sfx()) return; const t = audioCtx.currentTime;
    C.noiseHit(t, heavy ? 0.3 : 0.14, heavy ? 160 : 320, 1.2, heavy ? 0.9 : 0.5);
    for (let k = 0; k < (heavy ? 26 : 12); k++) C.noiseHit(t + 0.05 + Math.pow(Math.random(), 1.5) * (heavy ? 1.6 : 0.9), rand(0.01, 0.04), rand(1500, 5000), rand(2, 6), 0.3 * rand(0.4, 1));
  }

  // --- aim: the nearest stick or log in front of you
  const tmp = new THREE.Vector3();
  function aimed(list, reach, dot) {
    let best = null, bestD = 1e9;
    for (const o of list) {
      if (!o.active) continue;
      tmp.copy(o.mesh.position).sub(camera.position); const d = tmp.length();
      if (d < reach && d < bestD && tmp.normalize().dot(fwd) > dot) { best = o; bestD = d; }
    }
    return best;
  }
  const GLINT = 0x281206, AIM = 0x401e06;                          // warm amber, so the aimed stick stands out and still reads as wood
  function glints() {                                               // the aimed stick, and sticks in the headlamp's beam, catch the light
    camera.getWorldDirection(fwd);
    for (const s of sticks) {
      let e = STICK_BASE;
      if (s.active && C.state.lamp) { tmp.copy(s.mesh.position).sub(camera.position); const d = tmp.length(); if (d < 11 && tmp.normalize().dot(fwd) > 0.8) e = GLINT; }
      if (C.state.target && C.state.target.item === s) e = AIM;
      s.mesh.material.emissive.setHex(e);
    }
  }

  C.use({
    name: 'wood', order: 10,
    how: '<b>Keep the fire going</b>: gather sticks, haul a log from the tree line, feed it before it dies down. <b>F</b> pokes it.',
    init() {
      for (let i = 0; i < STICKS; i++) { const s = { mesh: new THREE.Mesh(stickGeo, newStickMat()), active: false }; scene.add(s.mesh); placeStick(s); sticks.push(s); }
      for (let i = 0; i < LOGS; i++) { const l = { mesh: makeLog(), active: false }; scene.add(l.mesh); placeLog(l); logs.push(l); }
    },
    reset() {
      carry.sticks = 0; carry.log = false; sticksFed = logsFed = 0;
      tossed.forEach((w) => scene.remove(w.mesh)); tossed.length = 0;
      sticks.forEach(placeStick); logs.forEach(placeLog);
    },
    busy: () => carry.sticks > 0 || carry.log,
    speed: () => carry.log ? LOG_SPEED : 1,
    hud: () => ({ label: 'Carrying', value: carry.log ? 'a log' : carry.sticks ? `${carry.sticks} stick${carry.sticks > 1 ? 's' : ''}` : 'nothing' }),
    target(ctx) {
      const has = carry.sticks > 0 || carry.log;
      const atFire = ctx.sitting || (ctx.dFire < 3 && C.looking(HX, 0.4, HZ, 0.55));
      if (has && atFire) return { label: carry.log ? '<b>E</b> roll the log onto the fire' : (ctx.sitting ? '<b>E</b> add a stick' : '<b>E</b> add a stick to the fire'), act: feed, prio: 3 };
      if (ctx.sitting) return null;
      if (!carry.log && carry.sticks < CARRY && !C.handsBusy(this)) {
        const s = aimed(sticks, 2.6, 0.86);
        if (s) return { label: '<b>E</b> pick up stick', item: s, prio: 4, act: () => { s.active = false; s.mesh.visible = false; s.respawnAt = performance.now() + STICK_RESPAWN_MS; carry.sticks++; pickSound(); } };
      }
      if (!has && !C.handsBusy(this)) {
        const l = aimed(logs, 2.8, 0.82);
        if (l) return { label: '<b>E</b> lift the log', item: l, prio: 4, act: () => { l.active = false; l.mesh.visible = false; l.respawnAt = performance.now() + LOG_RESPAWN_MS; carry.log = true; pickSound(true);
          if (!logTold) { logTold = true; C.toast('Heavy. It will burn for hours.'); } } };
      }
      if (carry.log && ctx.dFire > 3) return { label: 'Heavy going. Bring it to the fire.', prio: -1 };
      if (carry.sticks >= CARRY && ctx.dFire > 3) return { label: 'Hands full. Bring the wood to the fire.', prio: -1 };
      return null;
    },
    tick(dt, nowMs) {
      updateTossed(dt);
      for (const s of sticks) if (!s.active && s.respawnAt && nowMs > s.respawnAt) placeStick(s);
      for (const l of logs) if (!l.active && l.respawnAt && nowMs > l.respawnAt) placeLog(l);
    },
    frame() {
      const show = !C.handsBusy(this) || carry.sticks || carry.log;
      vmSticks.forEach((m, i) => { m.visible = show && i < carry.sticks; m.position.x = C.side(0.62 + i * 0.05, m.position.z); });
      vmLog.visible = carry.log;
      C.vm.position.y -= carry.log ? 0.015 : 0;                       // a log sits low and heavy
      glints();
    },
    moments() {
      const wood = [sticksFed && `${sticksFed} stick${sticksFed > 1 ? 's' : ''}`, logsFed && (logsFed === 1 ? 'a log' : `${logsFed} logs`)].filter(Boolean).join(' and ');
      return wood ? [wood + ' for the fire'] : [];
    }
  });
  Object.assign(C.test, { sticks, logs, carry, feed });
})();
