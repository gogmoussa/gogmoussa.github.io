// © 2026 George Moussa. All rights reserved.
// CAMP 50. SKIPPING STONES: at the shore, facing the water, hold E to wind up and let go to throw.
//     Real-ish physics: a fast, flat throw (look near level) skips; a steep or slow one sinks. Ripples from the
//     studio's spawnRipple (14D) at every touch, a plink per skip.
(function () {
  if (!window.Camp) return;
  const C = Camp, { rand } = C;
  const WATER_Y = LAKE_Y + 0.01, WIND_MS = 1100, SPEED = [3, 10], G = 9.8, HIP = 0.8;   // tuned offline: full power, level aim ~8 skips
  const SKIP = { minSpeed: 2.4, maxSteep: 0.72, keep: 0.83, bounce: 0.45, cap: [0.35, 0.045], luck: 4, maxSkips: 14 };   // luck: sink chance = (steep/maxSteep)^luck
  const s = { charging: false, t0: 0, flying: null };
  let best = 0, throws = 0;

  C.css(`#camp-ui .pw { display: inline-block; width: 90px; height: 6px; border-radius: 3px; background: rgba(255,255,255,.15); vertical-align: middle; margin-left: 8px; overflow: hidden; }
    #camp-ui .pw i { display: block; height: 100%; background: linear-gradient(90deg,#9fd3e6,#fff); }`);
  const geo = new THREE.DodecahedronGeometry(0.035, 0), mat = new THREE.MeshStandardMaterial({ color: 0x6f7378, roughness: 0.6, flatShading: true });
  const held = new THREE.Mesh(geo, C.heldMat(0x2c2e31, { roughness: 0.6, flatShading: true, warm: 0.6 })); held.scale.set(1.3, 0.45, 1); held.visible = false; C.vm.add(held);
  const power = () => s.charging ? Math.min(1, (performance.now() - s.t0) / WIND_MS) : 0;
  const fwd = new THREE.Vector3(), tmp = new THREE.Vector3();

  function atShore() {
    if (C.player.sitting || s.flying || C.handsBusy(mod)) return false;
    if (pondDist(camera.position.x, camera.position.z) > 1.6) return false;
    tmp.set(POND.cx - camera.position.x, 0, POND.cz - camera.position.z).normalize();
    return tmp.dot(fwd.set(-Math.sin(C.player.yaw), 0, -Math.cos(C.player.yaw))) > 0.35;
  }
  function release() {
    const p = power(); s.charging = false; throws++;
    const mesh = new THREE.Mesh(geo, mat); mesh.scale.set(1.3, 0.45, 1);
    camera.getWorldDirection(fwd);
    const pos = camera.position.clone().addScaledVector(fwd, 0.3); pos.y -= HIP;    // a low sidearm throw, from the hip
    const sp = SPEED[0] + (SPEED[1] - SPEED[0]) * p, el = Math.max(-0.5, Math.min(0.6, C.player.pitch + 0.08));
    const h = Math.hypot(fwd.x, fwd.z) || 1;
    mesh.position.copy(pos); scene.add(mesh);
    s.flying = { mesh, v: new THREE.Vector3(fwd.x / h * Math.cos(el) * sp, Math.sin(el) * sp, fwd.z / h * Math.cos(el) * sp), skips: 0, life: 6, spin: 25 + p * 20 };
    if (C.sfx()) C.noiseHit(audioCtx.currentTime, 0.25, 700 + p * 600, 0.8, 0.12 + p * 0.1);
  }
  function update(dt) {
    const f = s.flying; if (!f || C.state.paused) return;
    f.life -= dt; const m = f.mesh;
    f.v.y -= G * dt; m.position.addScaledVector(f.v, dt); m.rotation.y += f.spin * dt;
    const pd = pondDist(m.position.x, m.position.z);
    if (pd < 1 && m.position.y <= WATER_Y && f.v.y < 0) {
      const vh = Math.hypot(f.v.x, f.v.z), steep = -f.v.y / Math.max(0.01, vh);
      if (vh > SKIP.minSpeed && steep < SKIP.maxSteep && Math.random() > Math.pow(steep / SKIP.maxSteep, SKIP.luck) && f.skips < SKIP.maxSkips) {   // skip: lose some speed, bounce low
        f.skips++; f.v.x *= SKIP.keep; f.v.z *= SKIP.keep; f.v.y = Math.min(-f.v.y * SKIP.bounce, SKIP.cap[0] + vh * SKIP.cap[1]);
        m.position.y = WATER_Y + 0.001; spawnRipple(m.position.x, m.position.z, 0.35 + 0.05 * vh); plink(f.skips, m);
      } else { spawnRipple(m.position.x, m.position.z, 0.9); plop(); done(f, vh <= SKIP.minSpeed ? 'soft' : 'steep'); }
    } else if (pd >= 1 && m.position.y <= terrainY(m.position.x, m.position.z) + 0.03) { clack(); done(f, false); }
    else if (f.life <= 0) done(f, false);
  }
  function done(f, sank) {
    scene.remove(f.mesh); s.flying = null;
    const n = f.skips, isBest = n > best && n >= 2 && throws > 1; if (n > best) best = n;
    const msg = n === 0 ? (sank === 'soft' ? 'Plunk. Throw it harder.' : sank === 'steep' ? 'Plunk. Too steep. Aim level with the water.' : 'It cleared the water.')
      : n === 1 ? (sank === 'soft' ? 'One skip. Harder next time.' : 'One skip.') : `${n} skips.${isBest ? ' Your best tonight.' : ''}`;
    C.toast(n >= 8 ? msg + ' Beautiful.' : msg); C.emit('stone', { skips: n, sank });
  }
  function plink(n, m) {                                             // each skip a touch higher and quieter, panned by where it lands
    if (!C.sfx()) return; const t = audioCtx.currentTime;
    const pan = Math.max(-1, Math.min(1, (m.position.x - camera.position.x) / 6));
    C.tone(t, 1100 + n * 60, 650, 0.09, 0.08 / (1 + n * 0.12), 'sine', pan); C.noiseHit(t, 0.08, 3500, 1.5, 0.06);
  }
  function plop() { if (!C.sfx()) return; const t = audioCtx.currentTime; C.tone(t, 520, 180, 0.16, 0.12); C.noiseHit(t + 0.02, 0.35, 900, 0.9, 0.14); }
  function clack() { if (C.sfx()) C.noiseHit(audioCtx.currentTime, 0.05, 2600, 3, 0.25); }

  const mod = C.use({
    name: 'stones', order: 50,
    how: 'At the <b>pond</b>: hold <b>E</b> to skip a stone, <b>C</b> to fish.',
    key(e) {                                                          // E is held: down starts the wind-up, up throws
      if (e.code !== 'KeyE') return false;
      if (e.type === 'keyup' && s.charging) { release(); return true; }
      if (e.type === 'keydown' && s.charging) return true;            // key repeat while winding up
      return false;
    },
    reset() { if (s.flying) scene.remove(s.flying.mesh); s.flying = null; s.charging = false; best = throws = 0; },
    busy: () => s.charging,
    speed: () => s.charging ? 0.4 : 1,
    target() {
      if (s.charging) return { label: `Let go of <b>E</b> to skip it<span class="pw"><i style="width:${Math.round(power() * 10) * 10}%"></i></span>`, prio: 10 };
      if (!atShore()) return null;
      return { label: '<b>Hold E</b> to skip a stone · aim low and flat', prio: 1, act: () => { s.charging = true; s.t0 = performance.now(); } };
    },
    tick: update,
    frame() {
      held.visible = s.charging && C.state.running;
      if (s.charging) { const p = power(); held.position.set(C.side(0.55 + p * 0.15, 0.42), -0.24 + p * 0.03, -0.42 + p * 0.12); }
    },
    moments: () => best >= 2 ? [`a stone that skipped ${best} times`] : []
  });
  C.test.stones = () => ({ best, throws, charging: s.charging, flying: !!s.flying, skips: s.flying ? s.flying.skips : null });
  C.test.skipStone = (p, pitch) => { if (pitch !== undefined) C.player.pitch = pitch; s.charging = true; s.t0 = performance.now() - p * WIND_MS; release(); };
})();
