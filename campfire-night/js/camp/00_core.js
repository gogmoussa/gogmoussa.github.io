// © 2026 George Moussa. All rights reserved.
// ============================================================================
// CAMP 00. CORE (studio.html?camp): "Campfire Night", a first-person camping game in the studio's own world.
//     Off unless the URL has ?camp, so the film set is untouched. It rides on Explore mode: the director hands the
//     camera back, and this file replaces tickExplore's flight with walking. Keys never reach the studio's handlers:
//     the inline script at the top of <body> swallows them (capture, registered first) and forwards them to campKey.
//
//     The core owns: the page shell + HUD, walking + mouse look + colliders, the fire's fuel, the night clock
//     (moods 21:00 -> 06:00), the ambient bed, the night's start/end, and the frame. Everything you DO at camp is a
//     module in js/camp/NN_name.js that plugs in with Camp.use({...}); see js/camp/README.md for the interface.
//     window.CAMP is the test handle.
// ============================================================================
(function () {
  if (!new URLSearchParams(location.search).has('camp')) return;

  // --- C1. TUNING + HELPERS -------------------------------------------------
  const T = {
    START_MIN: 21 * 60, NIGHT_MIN: 9 * 60, REAL_SEC: 600,    // 9 game hours; 10 real minutes if you only walk
    MAX_FUEL: 150, START_FUEL: 60, EMBER_MIN: 30,
    EYE: 1.65, WORLD_R: 29, FOV: 68, WALK: 2.2, JOG: 4.2
  };
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const lerp = (a, b, u) => a + (b - a) * u;
  const cB = new THREE.Color();
  const lerpHex = (out, a, b, u, linear) => { out.setHex(a).lerp(cB.setHex(b), u); if (linear && out.convertSRGBToLinear) out.convertSRGBToLinear(); return out; };
  const HX = hearthGroup.position.x, HZ = hearthGroup.position.z;   // the studio hearth
  const SEAT = { x: GEORGE_SEAT.x, z: GEORGE_SEAT.z, eye: GEORGE_SEAT.top + 0.06 + 0.78 };
  const seatYaw = Math.atan2(SEAT.x - (HX - HEARTH.dx), SEAT.z - (HZ - HEARTH.dz));   // sitting faces the pit's studio spot, so the moved fire is on your right (HEARTH in 05)
  const fireAt = new THREE.Vector3(HX, terrainY(HX, HZ) + 0.42, HZ);  // the heart of the flames
  const moodNamed = (n) => Math.max(0, MOODS.findIndex((m) => m.name === n));
  const NIGHT_KEYS = [[0, 'Blue Dusk'], [50, 'Moonlit Night'], [430, 'Moonlit Night'], [495, 'Misty Dawn'], [540, 'Golden Hour']]
    .map(([t, n]) => ({ t, i: moodNamed(n) }));

  // --- C2. PAGE: hide the studio UI, add the camp HUD ------------------------
  //     Modules add their own CSS with Camp.css(text) and their own DOM with Camp.ui.insertAdjacentHTML.
  document.body.classList.add('camp', 'explore');
  const cssEl = document.createElement('style');
  cssEl.textContent = `
    body.camp > *:not(#workspace):not(#camp-ui):not(script):not(style) { display: none !important; }
    body.camp #workspace > *:not(#stage-wrap), body.camp #stage-wrap > *:not(#frame-container),
    body.camp #frame-container > *:not(#three-canvas) { display: none !important; }
    #camp-ui { position: fixed; inset: 0; pointer-events: none; z-index: 50; color: #f3e7d3;
      font: 15px/1.45 ui-rounded, "SF Pro Rounded", system-ui, -apple-system, sans-serif; }
    #camp-ui .cu-panel { background: rgba(8,10,18,.6); border-radius: 12px; backdrop-filter: blur(4px); }
    #cu-stats { position: absolute; top: calc(16px + env(safe-area-inset-top)); left: calc(16px + env(safe-area-inset-left)); padding: 10px 14px; display: grid; gap: 6px; min-width: 180px; }
    #cu-clock { font-size: 22px; font-weight: 600; letter-spacing: .5px; }
    #camp-ui .row { display: flex; justify-content: space-between; gap: 12px; color: #a99c88; font-size: 13px; }
    #camp-ui .row b { color: #f3e7d3; font-weight: 600; }
    #cu-bar { height: 6px; border-radius: 3px; background: rgba(255,255,255,.1); overflow: hidden; }
    #cu-fuel { height: 100%; width: 40%; background: linear-gradient(90deg,#b4380e,#ff8a2a,#ffd27a); transition: width .3s; }
    #cu-cross { position: absolute; left: 50%; top: 50%; width: 6px; height: 6px; margin: -3px 0 0 -3px; border-radius: 50%; background: rgba(255,240,220,.55); }
    #cu-prompt { position: absolute; left: 50%; bottom: 12%; transform: translateX(-50%); padding: 8px 16px; border-radius: 20px;
      opacity: 0; transition: opacity .2s; white-space: nowrap; max-width: calc(100vw - 32px); overflow: hidden; text-overflow: ellipsis; }
    #cu-prompt.on { opacity: 1; }
    #cu-toast { position: absolute; left: 50%; top: 22%; transform: translateX(-50%); text-shadow: 0 2px 12px #000; font-size: 17px;
      opacity: 0; transition: opacity .6s; text-align: center; padding: 0 16px; }
    #cu-toast.on { opacity: 1; }
    #cu-keys { position: absolute; right: 16px; bottom: 16px; color: #a99c88; font-size: 12px; text-align: right; padding: 8px 12px; }
    #camp-ui .overlay { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; padding: 16px; pointer-events: auto;
      background: radial-gradient(ellipse at 50% 60%, rgba(40,20,8,.35), rgba(3,5,14,.82)); }
    #camp-ui .overlay.hidden { display: none; }
    #camp-ui .card { max-width: 460px; text-align: center; }
    #camp-ui h1 { font-size: 34px; margin: 0 0 8px; font-weight: 700; letter-spacing: .5px; }
    #camp-ui .card p { color: #a99c88; margin: 8px 0; }
    #camp-ui .card p.fine { font-size: 11px; color: #6f6656; margin-top: 18px; }
    #camp-ui ul { text-align: left; color: #a99c88; padding-left: 20px; margin: 14px auto; max-width: 360px; }
    #camp-ui li b { color: #f3e7d3; }
    #camp-ui button { margin-top: 14px; font: inherit; font-weight: 600; color: #1a0d04; background: #ff8a2a; border: 0;
      border-radius: 24px; padding: 11px 26px; cursor: pointer; }
    #camp-ui button:hover { filter: brightness(1.1); }
    #camp-ui .moments { color: #d9c9b0; font-size: 14px; line-height: 1.7; margin-top: 14px; }
    #cu-fade { position: fixed; inset: 0; background: #020308; opacity: 0; transition: opacity 2s; pointer-events: none; }
    #cu-fade.on { opacity: 1; }
    #camp-ui:has(#cu-start:not(.hidden)) #cu-stats, #camp-ui:has(#cu-dawn:not(.hidden)) #cu-stats { opacity: 0; } /* cards stand alone (on a phone they cover the stats) */
    @media (max-width: 600px) { #cu-keys { display: none; } #cu-stats { min-width: 150px; } }`;
  document.head.appendChild(cssEl);
  const ui = document.createElement('div');
  ui.id = 'camp-ui';
  ui.innerHTML = `
    <div id="cu-stats" class="cu-panel">
      <div id="cu-clock">21:00</div>
      <div id="cu-bar"><div id="cu-fuel"></div></div>
      <div class="row">Fire <b id="cu-fire">burning</b></div>
    </div>
    <div id="cu-cross"></div>
    <div id="cu-prompt" class="cu-panel"></div>
    <div id="cu-toast"></div>
    <div id="cu-keys" class="cu-panel"></div>
    <div id="cu-fade"></div>
    <div id="cu-start" class="overlay"><div class="card">
      <h1>Campfire Night</h1>
      <p>The clearing by the pond. Nine hours until dawn.</p>
      <ul id="cu-how"></ul>
      <p>Nothing you write is kept. Keyboard and mouse. Sound on is nicer.</p>
      <button id="cu-go">Light the fire</button>
      <p class="fine">© 2026 George Moussa. All rights reserved.</p>
    </div></div>
    <div id="cu-dawn" class="overlay hidden"><div class="card">
      <h1>Dawn</h1><p id="cu-summary"></p><div id="cu-moments" class="moments"></div><button id="cu-again">Another night</button>
    </div></div>`;
  document.body.appendChild(ui);
  document.title = 'Campfire Night';                                   // players see the game's name in the tab, not the studio's
  const $ = (id) => document.getElementById(id);

  // --- C3. STAGE: no characters, no story, free camera -----------------------
  setUI('explore', { save: false });
  if (autoPlay) toggleAutoPlay();
  controls.enabled = false;
  controls.enableDamping = false;
  controls.minPolarAngle = 0.05; controls.maxPolarAngle = Math.PI - 0.05; controls.minDistance = 0.01;
  function hideStudioCast() {
    if (xbotHumanModel) xbotHumanModel.visible = false;
    spiritFloatGroup.visible = false;
    thoughtSwarmGroup.visible = false;
    georgeContactShadow.visible = false;
    spiritLight.intensity = 0;
    sceneOpts.swarm = false; sceneOpts.stream = false; sceneOpts.birds = false;
  }
  if (!camera.parent) scene.add(camera);
  // the eye: where you see from. The camera sits here, unless a view module (90) pulls it back for a third-person frame
  const head = new THREE.Object3D(); scene.add(head);
  // headlamp: a soft spot on your head
  const lamp = new THREE.SpotLight(0xfff1d6, 0, 14, 0.5, 0.6, 1.4);
  head.add(lamp); head.add(lamp.target); lamp.target.position.set(0, -0.4, -1);
  // hands: modules hang what you hold on this group (it bobs as you walk; it rides the eye, not the camera)
  const vm = new THREE.Group(); head.add(vm);
  // Held things sit 0.5 m from the eye, where the sky light (IBL) and the composite lift plain albedo to cream/grey.
  // heldMat() gives a darker, less sky-lit material that picks up a warm glow from the fire by distance (updateHands).
  const heldMats = [];
  function heldMat(color, opts) {
    const o = Object.assign({ color, roughness: 0.95, envMapIntensity: 0.25 }, opts || {}), warm = o.warm || 1;
    delete o.warm;                                                   // ours, not three's (three warns on unknown material fields)
    const m = new THREE.MeshStandardMaterial(o);
    m.userData.warm = warm; heldMats.push(m); return m;
  }

  // --- C4. COLLIDERS: hearth, stump, pond, rocks, trees (modules push their own: Camp.colliders) ---------
  const colliders = [{ x: HX, z: HZ, r: 1.15 }, { x: SEAT.x, z: SEAT.z, r: 0.5 }];
  {
    scene.updateMatrixWorld(true);
    const v = new THREE.Vector3(), m = new THREE.Matrix4();
    rocksGroup.traverse((o) => {
      if (!o.isMesh) return;
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      o.getWorldPosition(v);
      const r = o.geometry.boundingSphere.radius * Math.max(o.getWorldScale(new THREE.Vector3()).x, 0.01);
      if (r > 0.22) colliders.push({ x: v.x, z: v.z, r: r * 0.85 + 0.25 });
    });
    for (let i = 0; i < pines.count; i++) {
      pines.getMatrixAt(i, m); m.premultiply(pines.matrixWorld); v.setFromMatrixPosition(m);
      colliders.push({ x: v.x, z: v.z, r: 0.55 });
    }
    foliageMeshes.forEach((f) => { f.getWorldPosition(v); if (Math.hypot(v.x, v.z) > 3) colliders.push({ x: v.x, z: v.z, r: 0.45 }); });
  }
  function pushOut(p) {
    for (const c of colliders) {
      const dx = p.x - c.x, dz = p.z - c.z;
      if (Math.abs(dx) > c.r || Math.abs(dz) > c.r) continue;
      const d = Math.hypot(dx, dz);
      if (d < c.r && d > 1e-4) { p.x = c.x + dx / d * c.r; p.z = c.z + dz / d * c.r; }
    }
    const pd = pondDist(p.x, p.z);                                    // keep your boots dry
    if (pd < 1.08 && pd > 1e-4) { const k = 1.08 / pd; p.x = POND.cx + (p.x - POND.cx) * k; p.z = POND.cz + (p.z - POND.cz) * k; }
    const r = Math.hypot(p.x, p.z); if (r > T.WORLD_R) { p.x *= T.WORLD_R / r; p.z *= T.WORLD_R / r; }
  }
  const blocked = (x, z, pad) => pondDist(x, z) < 1.2 || colliders.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + pad);

  // --- C5. MODULES ----------------------------------------------------------------
  //     Each module: { name, order?, keys?, how?, init?, reset?, tick?(dt, nowMs) -> game minutes to advance,
  //     key?(e) -> true if handled, target?(ctx) -> { label, act?, prio? }, seatHint?() -> html, busy?() -> bool,
  //     speed?() -> walk multiplier, moments?() -> [lines], hud?() -> { label, value },
  //     view?(dt) -> true if it moved the camera off the eye this frame (put back before the next frame) }. See js/camp/README.md.
  const mods = [];
  const call = (fn, ...a) => mods.map((m) => m[fn] && m[fn](...a));
  // Events: modules say what just happened (Camp.emit('feed', { log: true })) and others listen (Camp.on('feed', fn)).
  // The field guide (12) and its lessons (13, 14) teach from these. Names in use: README "Events".
  const listeners = {};
  const on = (name, fn) => { (listeners[name] = listeners[name] || []).push(fn); };
  const emit = (name, data) => { for (const fn of listeners[name] || []) { try { fn(data || {}); } catch (err) { console.warn('[camp] listener', name, err); } } };

  // --- C6. STATE + PLAYER --------------------------------------------------------
  const state = { running: false, done: false, minutes: 0, fuel: T.START_FUEL, ember: 0, burned: 0, lamp: false, muted: false, target: null, flare: 0, paused: false, wind: 1 };
  const player = { x: 0.3, z: 5.4, yaw: 0, pitch: -0.12, vx: 0, vz: 0, bob: 0, sitting: false };
  const keys = {};
  const fwd = new THREE.Vector3(), tmpV = new THREE.Vector3(), eyeGoal = new THREE.Vector3();
  const faceFire = (x, z) => Math.atan2(x - HX, z - HZ);
  player.yaw = faceFire(player.x, player.z);
  camera.position.set(player.x, terrainY(player.x, player.z) + T.EYE, player.z);
  const handsBusy = (except) => mods.some((m) => m !== except && m.busy && m.busy());
  const dFire = () => Math.hypot(camera.position.x - HX, camera.position.z - HZ);
  const looking = (x, y, z, dot) => { camera.getWorldDirection(fwd); return tmpV.set(x, y, z).sub(camera.position).normalize().dot(fwd) > dot; };

  window.campKey = function (e) {
    for (const m of mods) if (m.key && m.key(e)) return;              // a module may take the key (typing, held keys…)
    const down = e.type === 'keydown';
    keys[e.code] = down;
    if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
    if (!down || e.repeat || !state.running || state.paused) return;
    if (e.code === 'KeyE') interact();
    if (e.code === 'KeyL') { state.lamp = !state.lamp; emit('lamp', { on: state.lamp }); }
    if (e.code === 'KeyM') state.muted = !state.muted;
  };
  const canvas = renderer.domElement;
  const locked = () => document.pointerLockElement === canvas;
  function lockMouse() { try { const p = canvas.requestPointerLock && canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {} } // some embedded views refuse; drag-to-look still works
  let dragging = false;
  window.addEventListener('mousedown', (e) => {
    if (!state.running || (e.target.closest && e.target.closest('#camp-ui .overlay'))) return;
    if (e.target.closest && e.target.closest('#camp-ui textarea, #camp-ui input')) return;
    if (document.activeElement && document.activeElement.closest && document.activeElement.closest('#camp-ui textarea')) { e.preventDefault(); dragging = true; return; } // drag to look while a line keeps focus
    dragging = true; if (!locked()) lockMouse();
  });
  window.addEventListener('mouseup', () => { dragging = false; });
  window.addEventListener('mousemove', (e) => {
    if (!state.running || !(locked() || dragging)) return;
    player.yaw -= e.movementX * 0.0024;
    player.pitch = Math.max(-1.35, Math.min(1.35, player.pitch - e.movementY * 0.0024));
  });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  function sitDown() { player.sitting = true; player.vx = player.vz = 0; player.yaw = seatYaw; player.pitch = -0.28; call('onSit'); emit('sit'); }
  function standUp() {
    player.sitting = false; call('onStand');
    player.x = SEAT.x + Math.sin(seatYaw) * 0.9; player.z = SEAT.z + Math.cos(seatYaw) * 0.9;
    toast('');
  }
  function updatePlayer(dt) {
    let fx = 0, fz = 0;
    if (!state.paused) {
      if (keys.KeyW || keys.ArrowUp) fz -= 1; if (keys.KeyS || keys.ArrowDown) fz += 1;
      if (keys.KeyA || keys.ArrowLeft) fx -= 1; if (keys.KeyD || keys.ArrowRight) fx += 1;
    }
    if (player.sitting && (fx || fz)) standUp();
    if (player.sitting) {
      eyeGoal.set(SEAT.x, terrainY(SEAT.x, SEAT.z) + SEAT.eye, SEAT.z);
      camera.position.lerp(eyeGoal, 1 - Math.exp(-dt * 6));
    } else {
      let mul = 1; for (const m of mods) if (m.speed) mul *= m.speed();
      const speed = ((keys.ShiftLeft || keys.ShiftRight) ? T.JOG : T.WALK) * mul, len = Math.hypot(fx, fz) || 1;
      const s = Math.sin(player.yaw), c = Math.cos(player.yaw);
      const tx = (fx * c + fz * s) / len * speed, tz = (-fx * s + fz * c) / len * speed;
      const k = 1 - Math.exp(-dt * 10); player.vx += (tx - player.vx) * k; player.vz += (tz - player.vz) * k;
      player.x += player.vx * dt; player.z += player.vz * dt; pushOut(player);
      const moving = Math.hypot(player.vx, player.vz); player.bob += moving * dt * 2.6;
      eyeGoal.set(player.x, terrainY(player.x, player.z) + T.EYE + Math.sin(player.bob * 2) * 0.03 * Math.min(1, moving), player.z);
      camera.position.lerp(eyeGoal, 1 - Math.exp(-dt * 14));
    }
    // aim through the studio's own camera pipeline: controls.update() looks at controls.target
    fwd.set(-Math.sin(player.yaw) * Math.cos(player.pitch), Math.sin(player.pitch), -Math.cos(player.yaw) * Math.cos(player.pitch));
    controls.target.copy(camera.position).add(fwd);
    desiredCamPos.copy(camera.position); desiredCamTarget.copy(controls.target);
    camTransitionTime = 0; camMove = null; camFocus.override = null; camFocus.strength = 0;   // no DOF in the game (C10)
    camera.lookAt(controls.target);
  }
  const vmBob = { x: 0, y: 0 };
  function updateHands(dt) {
    const moving = Math.min(1, Math.hypot(player.vx, player.vz) / T.WALK);
    const bx = Math.cos(player.bob) * 0.012 * moving, by = Math.abs(Math.sin(player.bob)) * 0.014 * moving;
    vmBob.x += (bx - vmBob.x) * Math.min(1, dt * 12); vmBob.y += (by - vmBob.y) * Math.min(1, dt * 12);
    vm.position.set(vmBob.x, vmBob.y, 0);
    vm.visible = state.running && !state.paused;
    const d = dFire(), w = fireLevel() * (1 + 0.4 * state.flare) / (1 + 0.25 * d * d);
    for (const m of heldMats) m.emissive.setRGB(0.16 * w * m.userData.warm, 0.06 * w * m.userData.warm, 0.015 * w * m.userData.warm);
  }

  // --- C7. TARGETS: what E would do right now --------------------------------------
  //     Modules offer targets (highest prio wins). Sitting, the stump's own line joins every module's seatHint.
  function findTarget() {
    camera.getWorldDirection(fwd);
    const ctx = { sitting: player.sitting, dFire: dFire(), fwd, busy: handsBusy() };
    let best = null;
    if (!player.sitting && looking(SEAT.x, 0.4, SEAT.z, 0.6) && tmpV.set(SEAT.x, 0.4, SEAT.z).distanceTo(camera.position) < 2.4)
      best = { label: '<b>E</b> sit on the stump', act: sitDown, prio: 2, mod: 'core' };
    for (const m of mods) {
      if (!m.target) continue;
      const t = m.target(ctx); if (!t) continue;
      t.prio = t.prio || 0; t.mod = m.name;
      if (!best || t.prio > best.prio) best = t;
    }
    if (best && (best.prio >= 10 || !player.sitting)) return best;    // prio >= 10 takes over the whole line (a module mid-action)
    if (player.sitting) {
      const hints = mods.map((m) => m.seatHint && m.seatHint()).filter(Boolean);
      if (best) hints.push(best.label);
      hints.push(best ? '<b>WASD</b> stand' : '<b>E</b> stand up');
      return { label: hints.join(' · '), act: best ? best.act : standUp, mod: best ? best.mod : 'core' };
    }
    return null;
  }
  function interact() { const tg = state.target; if (tg && tg.act) tg.act(); }

  // --- C8. FIRE: scale the studio fire by fuel (runs after the loop's fire code, before render) ---------
  function fireLevel() { return state.fuel > 0 ? 0.3 + 0.7 * clamp01(state.fuel / 90) : 0; }
  function addFuel(min, why) {
    const wasOut = state.fuel <= 0;
    state.fuel = Math.min(T.MAX_FUEL, state.fuel + min); state.ember = 0;
    if (wasOut && why !== 'quiet') toast('The fire catches again.');
    emit('fuel', { min, relit: wasOut });
  }
  let sparkBoost = 0;                                                 // a module may ask for more rising sparks for a while
  function applyFire(dt) {
    state.flare = Math.max(0, state.flare - dt * 0.8);
    const f = fireLevel(), ember = state.ember / T.EMBER_MIN, flare = state.flare;
    const k = f * (1 + 0.35 * flare) + ember * 0.12;                  // 1 = the mood's own resting fire
    fireLight.intensity *= k;
    bladeFX.uFireK.value *= k;
    hearthGlow.material.opacity *= Math.min(1, k + ember * 0.3);
    fireHalo.material.opacity *= k;
    firePool.material.opacity *= Math.min(1, k + ember * 0.2);
    flameMeshes.forEach((m) => { m.mesh.visible = f > 0; m.mesh.scale.x *= 0.55 + 0.45 * f; m.mesh.scale.y *= (0.45 + 0.55 * f) * (1 + 0.25 * flare); });
    const sparks = Math.min(1, f + 0.6 * sparkBoost);
    risingEmbers.forEach((e, i) => { e.sprite.visible = f > 0 ? (i % 70) < 20 + 50 * sparks : (i % 70) < 6 * ember; });
    sparkBoost = 0;
  }

  // --- C9. NIGHT: moods through the night ----------------------------------------
  const cA = new THREE.Color(), vA = new THREE.Vector3(), vB = new THREE.Vector3();
  function nightBlend(min) {
    let k = 0; while (k < NIGHT_KEYS.length - 2 && min > NIGHT_KEYS[k + 1].t) k++;
    const A = NIGHT_KEYS[k], B = NIGHT_KEYS[k + 1];
    return { a: A.i, b: B.i, u: smooth(A.t, B.t, min) };
  }
  function applyNight(min) {
    const { a, b, u } = nightBlend(min);
    const want = u < 0.5 ? a : b;
    if (moodIdx !== want) { applyMood(want); hideStudioCast(); }
    const A = MOODS[a], B = MOODS[b];
    if (a !== b) {
      const sun = vA.fromArray(A.sun).normalize().lerp(vB.fromArray(B.sun).normalize(), u).normalize();
      moonLight.position.copy(sun).multiplyScalar(16);
      lerpHex(moonLight.color, A.sunCol, B.sunCol, u); moonLight.intensity = lerp(A.sunInt, B.sunInt, u);
      lerpHex(hemiLight.color, A.hemiSky, B.hemiSky, u); lerpHex(hemiLight.groundColor, A.hemiGnd, B.hemiGnd, u);
      hemiLight.intensity = lerp(A.hemiInt, B.hemiInt, u);
      lerpHex(scene.fog.color, A.fog, B.fog, u, true); scene.fog.density = lerp(A.fogD, B.fogD, u);
      skyUniforms.uSunDir.value.copy(sun); waterUniforms.uSunDir.value.copy(sun); foliageSSSUniforms.uSunDir.value.copy(sun); barkFX.uSunDir.value.copy(sun);
      lerpHex(skyUniforms.uSunCol.value, A.sunCol, B.sunCol, u, true);
      lerpHex(skyUniforms.uHorizon.value, A.horizon, B.horizon, u, true);
      lerpHex(skyUniforms.uZenith.value, A.zenith, B.zenith, u, true);
      moodExposure = lerp(A.exposure, B.exposure, u);
      compositeMat.uniforms.uExposure.value = moodExposure * exposureTrim;
      flyMat.opacity = lerp(A.flies, B.flies, u);
      bladeFX.uSat.value = lerp(A.gSat ?? 1, B.gSat ?? 1, u); bladeFX.uDim.value = lerp(A.gDim ?? 1, B.gDim ?? 1, u);
      fireBase = lerp(A.fire, B.fire, u);
    }
    applyStars(min);
    return smooth(T.NIGHT_MIN - 110, T.NIGHT_MIN, min);                // dawn 0..1 (sound, headlamp)
  }
  // The real star sky from "Find north" (20E) instead of the studio's bokeh dots (11), which float among the trees.
  // It comes out after dusk, wheels one sidereal hour per hour of night, and fades before dawn; the clouds thin under it.
  const starsOut = (min) => smooth(15, 70, min) * (1 - smooth(440, 505, min));
  // Air temperature through the night, °C: 16 at 21:00, cooling fast then slowly, about 5 by dawn (clear nights are
  // coldest near sunrise). Crickets chirp by it (Dolbear's law, below) and the breath (80) shows once it is under ~7-9.
  const airTemp = (min) => 4 + 12 * Math.exp(-min / 220);
  function applyStars(min) {
    starField.visible = false;
    if (typeof NS === 'undefined' || typeof NSKY === 'undefined') return;
    const amt = starsOut(min);
    NS.amt = { from: amt, to: amt, t0: 0, secs: 1 };                 // held, not tweened: the night clock drives it
    NSKY.lst = NSKY.lst0 + min / 60;
  }

  // --- C10. SOUND: the studio bed (wind in leaves + campfire) plus crickets and dawn birds -------------
  //     Modules make one-shots with Camp.sfx() (null when muted / no audio) + Camp.noiseHit / Camp.tone.
  let crickets = null, nextBird = 0, noiseBuf = null;
  function sfx() {
    if (typeof audioCtx === 'undefined' || !audioCtx || audioCtx.state !== 'running' || state.muted) return null;
    if (!noiseBuf) { noiseBuf = audioCtx.createBuffer(1, audioCtx.sampleRate * 1.2, audioCtx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    return audioCtx;
  }
  let sfxBus = null;                                                  // where one-shots go: audioOut, or a bus a module sets (70_soundscape adds a forest reverb)
  const sfxOut = (dest) => dest || sfxBus || audioOut;
  function noiseHit(t, dur, freq, q, gain, type, dest) {              // one short filtered noise burst at audio time t
    const src = audioCtx.createBufferSource(), bp = audioCtx.createBiquadFilter(), g = audioCtx.createGain();
    src.buffer = noiseBuf; bp.type = type || 'bandpass'; bp.frequency.value = freq; bp.Q.value = q;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + Math.min(0.006, dur * 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp); bp.connect(g); g.connect(sfxOut(dest)); src.start(t, Math.random() * 1.0); src.stop(t + dur + 0.02);
  }
  function tone(t, f0, f1, dur, gain, type, pan, dest) {                    // a gliding oscillator blip, optionally panned
    const o = audioCtx.createOscillator(), g = audioCtx.createGain(), p = audioCtx.createStereoPanner();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + Math.min(0.02, dur * 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    p.pan.value = pan || 0; o.connect(g); g.connect(p); p.connect(sfxOut(dest)); o.start(t); o.stop(t + dur + 0.02);
  }
  function startSound() {
    initAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    soundEnabled = true;
    audioOpts.bed = 'both'; applyAudioMix();
    if (crickets) return;
    // Crickets keep a steady rhythm (a real one chirps like a metronome), so each voice is a fixed rate with a little drift.
    const bus = audioCtx.createGain(); bus.gain.value = 0;
    const bp = audioCtx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 4500; bp.Q.value = 3;
    bus.connect(bp); bp.connect(audioOut);
    // Each voice chirps at Dolbear's rate for the air temperature (°C = chirps in 25 s / 3 + 4), so counting the loud one
    // on the left really gives the temperature the HUD shows; the other two are other crickets, a little faster or slower.
    const voices = [{ f: 4400, k: 1, pan: -0.7, g: 1 }, { f: 4750, k: 0.82, pan: 0.6, g: 0.7 }, { f: 4250, k: 1.25, pan: 0.1, g: 0.45 }]
      .map((v) => { const p = audioCtx.createStereoPanner(); p.pan.value = v.pan; p.connect(bus); return Object.assign(v, { p, next: audioCtx.currentTime + Math.random() }); });
    crickets = { bus, voices };
  }
  function chirp(v, when) {
    const pulses = 3 + (Math.random() < 0.3 ? 1 : 0);
    for (let k = 0; k < pulses; k++) {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain(), t0 = when + k * 0.042;
      o.frequency.value = v.f * (1 + (Math.random() - 0.5) * 0.004);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(v.g, t0 + 0.006); g.gain.setValueAtTime(v.g, t0 + 0.018); g.gain.linearRampToValueAtTime(0, t0 + 0.026);
      o.connect(g); g.connect(v.p); o.start(t0); o.stop(t0 + 0.03);
    }
  }
  function bird(when, gain) {
    const pan = audioCtx.createStereoPanner(); pan.pan.value = rand(-0.9, 0.9); pan.connect(sfxOut());
    const base = rand(2600, 3600), n = 2 + (Math.random() * 3 | 0);
    for (let k = 0; k < n; k++) {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain(), t0 = when + k * rand(0.13, 0.2), d = rand(0.08, 0.14);
      o.frequency.setValueAtTime(base, t0); o.frequency.exponentialRampToValueAtTime(base * rand(1.25, 1.6), t0 + d * 0.6); o.frequency.exponentialRampToValueAtTime(base * 1.1, t0 + d);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      o.connect(g); g.connect(pan); o.start(t0); o.stop(t0 + d + 0.02);
    }
  }
  function updateSound(dawn) {
    if (!audioCtx || !crickets || audioCtx.state !== 'running') return;
    const now = audioCtx.currentTime, mute = state.muted || !state.running ? 0 : 1;
    const d = dFire(), att = 1 / (1 + 0.07 * d * d);
    const f = fireLevel(), ember = state.ember / T.EMBER_MIN;
    masterGain.gain.setTargetAtTime(bedLevel() * mute, now, 0.2);
    droneGain.gain.setTargetAtTime(0.8 * state.wind, now, 0.5);        // state.wind: gusts (70_soundscape)
    fireGain.gain.setTargetAtTime((1.9 * f * (1 + 0.5 * state.flare) + 0.25 * ember) * (0.25 + 0.75 * att), now, 0.25);
    const temp = airTemp(state.minutes), period = 25 / (3 * Math.max(0.5, temp - 4));   // seconds between chirps (Dolbear)
    crickets.bus.gain.setTargetAtTime(0.012 * (1 - smooth(0.2, 0.75, dawn)) * smooth(5.5, 9, temp) * mute, now, 0.5);   // too cold: they fall quiet
    for (const v of crickets.voices) {
      if (now > v.next - 0.1) { chirp(v, Math.max(v.next, now)); v.next = Math.max(v.next, now) + period * v.k * rand(0.98, 1.02); }
    }
    if (dawn > 0.25 && mute && now > nextBird) { bird(now + 0.05, 0.02 * dawn); nextBird = now + rand(1.5, 6) / dawn; }
  }

  // --- C11. HUD ----------------------------------------------------------------
  //     Each field is written only when its text changes: a DOM write every frame dirtied layout, and the loop's
  //     resizeRenderer (getBoundingClientRect) then forced a full layout every frame. Module rows (hud()) the same.
  let toastTimer = 0, lastWarn = 0;
  function toast(msg) { const el = $('cu-toast'); el.textContent = msg; el.classList.toggle('on', !!msg); clearTimeout(toastTimer); if (msg) toastTimer = setTimeout(() => el.classList.remove('on'), 3500); }
  const fmt = (m) => { const t = (T.START_MIN + m) % 1440; return String(t / 60 | 0).padStart(2, '0') + ':' + String(t % 60 | 0).padStart(2, '0'); };
  const hudEls = { clock: $('cu-clock'), fuel: $('cu-fuel'), fire: $('cu-fire'), prompt: $('cu-prompt') };
  const hudWas = {};
  function hudSet(key, val, write) { if (hudWas[key] === val) return; hudWas[key] = val; write(hudEls[key], val); }
  const setText = (el, v) => { el.textContent = v; };
  function updateHUD() {
    hudSet('clock', fmt(state.minutes), setText);
    hudSet('fuel', (state.fuel / T.MAX_FUEL * 100).toFixed(1) + '%', (el, v) => { el.style.width = v; });
    hudSet('fire', state.fuel > 90 ? 'roaring' : state.fuel > 35 ? 'burning' : state.fuel > 0 ? 'low' : state.ember > 0 ? 'embers' : 'out', setText);
    hudSet('prompt', state.target ? state.target.label : '', (el, v) => { el.innerHTML = v; el.classList.toggle('on', !!v); });
    for (const m of mods) {
      if (!m.hud) continue;
      const r = m.hud(), key = 'mod:' + m.name;
      if (!hudEls[key]) { const row = document.createElement('div'); row.className = 'row'; row.innerHTML = `${r.label} <b></b>`; $('cu-stats').appendChild(row); hudEls[key] = row.querySelector('b'); }
      hudSet(key, r.value, setText);
    }
  }
  function buildHowTo() {                                             // the start card and key strip are made from the modules
    $('cu-how').innerHTML = mods.filter((m) => m.how).sort((a, b) => (a.order || 50) - (b.order || 50)).map((m) => `<li>${m.how}</li>`).join('');
    if (document.body.classList.contains('camp-touch')) $('cu-how').querySelectorAll('[data-touch]').forEach((b) => { b.textContent = b.dataset.touch; }); // <b data-touch="Guide">G</b>: phones name the button
    const ks = ['WASD move · Shift jog · E use', ...mods.map((m) => m.keys).filter(Boolean), 'L headlamp · M sound · Esc mouse'];
    $('cu-keys').innerHTML = ks.join('<br>');
  }

  // --- C12. PERFORMANCE (camp only; the film set keeps its own settings) ----------------------------------
  //     Measured Nov 18 2026 (1410x1866 at pixel ratio 2): 12.9 ms a frame -> about 9.5 ms, all GPU.
  //     · The fire's point light redrew its six-face shadow cube every frame, yet nothing it shadows moves in camp
  //       (no cast; its distance material has no wind). It now redraws every FIRE_SHADOW_SECS.
  //     · The moon's shadow follows the leaves in the wind, so it stays live but redraws every other frame.
  //     · The pond is small and rippled, so its mirror renders at MIRROR_K of the canvas instead of half.
  //     · The studio's caption overlay is hidden in camp; stop clearing that full-size canvas every frame.
  //     · Depth of field is off (updatePlayer sets camFocus.strength 0): roaming strength 0.2 x the 0.15 lens slider
  //       blurred at most ~5%, invisible, but the composite still ran every blur tap (~2 ms).
  const FIRE_SHADOW_SECS = 2, MIRROR_K = 0.3;
  fireLight.shadow.autoUpdate = false; fireLight.shadow.needsUpdate = true;
  moonLight.shadow.autoUpdate = false; moonLight.shadow.needsUpdate = true;
  let fireShadowAt = 0, shadowFrame = 0;
  drawLiveOverlay = function () {};
  //     · (Nov 18, second pass) Studio lights that stay at zero all night in camp (the spirit light, the dais light, the
  //       daylight sun) are hidden while they are at zero: every lit pixel looped over them anyway (~0.7 ms). The headlamp
  //       is left alone (it switches on and off, and a light that appears recompiles every material: a stutter).
  const quietLights = [];
  scene.traverse((o) => { if (o.isLight && o !== lamp && !o.castShadow) quietLights.push(o); });
  function tickPerfCamp(nowMs) {
    for (const l of quietLights) { const on = l.intensity > 0; if (l.visible !== on) l.visible = on; }
    if (nowMs - fireShadowAt > FIRE_SHADOW_SECS * 1000) { fireShadowAt = nowMs; fireLight.shadow.needsUpdate = true; }
    if ((++shadowFrame & 1) === 0) moonLight.shadow.needsUpdate = true;
    const cv = renderer.domElement, mw = Math.max(64, Math.floor(cv.width * MIRROR_K)), mh = Math.max(64, Math.floor(cv.height * MIRROR_K));
    if (reflectRT.width !== mw || reflectRT.height !== mh) reflectRT.setSize(mw, mh);   // resizeRenderer resets it to half on a resize
  }

  // --- C13. NIGHT FLOW -----------------------------------------------------------
  function advance(dGame) {
    state.minutes = Math.min(T.NIGHT_MIN, state.minutes + dGame);
    if (state.fuel > 0) {
      state.burned += Math.min(state.fuel, dGame); state.fuel -= dGame;
      if (state.fuel <= 0) { state.fuel = 0; state.ember = T.EMBER_MIN; toast('The flames are gone. Embers are left.'); emit('embers'); }
    } else if (state.ember > 0) { state.ember = Math.max(0, state.ember - dGame); if (state.ember === 0) { toast('The fire is out. Add a stick to relight it.'); emit('fireout'); } }
  }
  function startNight() {
    Object.assign(state, { running: true, done: false, minutes: 0, fuel: T.START_FUEL, ember: 0, burned: 0, flare: 0, paused: false });
    Object.assign(player, { x: 0.3, z: 5.4, vx: 0, vz: 0, sitting: false, pitch: -0.12 }); player.yaw = faceFire(player.x, player.z);
    camera.position.set(player.x, terrainY(player.x, player.z) + T.EYE, player.z);
    call('reset');
    $('cu-start').classList.add('hidden'); $('cu-dawn').classList.add('hidden'); $('cu-fade').classList.remove('on');
    startSound(); lockMouse();
    toast('The fire is going. Keep it alive until dawn.');
    emit('night');
  }
  function endNight(why) {
    state.running = false; state.done = true; document.exitPointerLock?.();
    call('onDawn');                                                   // e.g. anything left unburned goes with the night
    const pct = state.burned / T.NIGHT_MIN;
    $('cu-summary').innerHTML = why === 'slept' ? (state.fuel > 0 ? 'You slept until morning.<br>The fire was still going when you woke.' : state.ember > 0 ? 'You slept until morning.<br>The fire was down to embers when you woke.' : 'You slept until morning.<br>The fire burned down to ash while you rested.')
      : pct > 0.98 ? 'The fire kept you company all night.<br>Morning now.' : 'The night is over.<br>The fire kept you company until morning.';
    const lines = [].concat(...call('moments').filter(Boolean));
    $('cu-moments').innerHTML = lines.length ? lines.map((l) => l.charAt(0).toUpperCase() + l.slice(1)).join('<br>') : '';
    $('cu-dawn').classList.remove('hidden');
  }
  $('cu-go').onclick = startNight; $('cu-again').onclick = startNight;

  // --- C14. FRAME: replaces Explore's flight; called by the loop after the fire and nature updates, before render ---
  let lastT = performance.now(), idleA = 0, booted = false, viewMoved = false;
  tickExplore = function () {
    const nowMs = performance.now(), dt = Math.min(0.05, (nowMs - lastT) / 1000); lastT = nowMs;
    if (!booted) { booted = true; mods.sort((a, b) => (a.order || 50) - (b.order || 50)); call('init'); buildHowTo(); }
    hideStudioCast();
    if (viewMoved) { camera.position.copy(head.position); camera.quaternion.copy(head.quaternion); viewMoved = false; } // back to the eye
    if (Math.abs(camera.fov - T.FOV) > 0.01) { camera.fov = T.FOV; camera.updateProjectionMatrix(); } // a game lens, not the studio's 37 mm
    if (state.running) {
      let dGame = 0;                                                  // modules may move the night (a burning thought does)
      for (const m of mods) if (m.tick) dGame += m.tick(dt, nowMs) || 0;
      advance(dt * T.NIGHT_MIN / T.REAL_SEC * (player.sitting || state.paused ? 0 : 1) + dGame);   // sitting still, the night waits
      updatePlayer(dt);
      state.target = findTarget();
      if (state.fuel > 0 && state.fuel < 15 && nowMs - lastWarn > 20000) { lastWarn = nowMs; toast('The fire is getting low.'); }
      if (state.minutes >= T.NIGHT_MIN && !state.paused) endNight();
    } else if (!state.done) {
      idleA += dt * 0.05;                                             // slow orbit behind the start card
      camera.position.set(HX + Math.sin(idleA) * 6, 2.2, HZ + Math.cos(idleA) * 6);
      controls.target.set(HX, 0.7, HZ); desiredCamPos.copy(camera.position); desiredCamTarget.copy(controls.target);
      camTransitionTime = 0; camMove = null; camera.lookAt(controls.target);
    }
    head.position.copy(camera.position); head.quaternion.copy(camera.quaternion);   // the eye, before any view module moves the camera
    updateHands(dt);
    const dawn = applyNight(state.minutes);
    applyFire(dt);
    for (const m of mods) if (m.frame) m.frame(dt, nowMs);           // every frame, running or not, after the fire is scaled
    lamp.intensity = state.lamp && state.running ? 1.6 * (1 - dawn * 0.8) : 0;
    updateSound(dawn);
    updateHUD();
    tickPerfCamp(nowMs);
    for (const m of mods) if (m.view && m.view(dt)) viewMoved = true; // last: everything above saw the eye
  };
  applyMood(NIGHT_KEYS[0].i); hideStudioCast();

  // --- C15. THE SHARED HANDLE: what modules (and tests) use -----------------------
  window.Camp = {
    T, rand, clamp01, smooth, lerp, lerpHex, $, ui, css(text) { const s = document.createElement('style'); s.textContent = text; document.head.appendChild(s); },
    HX, HZ, SEAT, seatYaw, fireAt, state, player, keys, colliders, blocked, vm, camera, head, pushOut,
    fireLevel, addFuel, flare(v) { state.flare = Math.max(state.flare, v); }, sparks(v) { sparkBoost = Math.max(sparkBoost, v); },
    toast, advance, endNight, faceFire, sitDown, standUp, handsBusy, dFire, looking, starsOut, airTemp,
    sfx, noiseHit, tone, noise: () => noiseBuf, mods, heldMat, on, emit,
    setSfxBus(node) { sfxBus = node; },                               // one-shots and birds go through this node (null = straight out)
    sfxOut: () => sfxOut(),                                            // the node a module's own one-shot graph should end in
    // x in camera space for something held at depth z, as a fraction of the half-width you can see (works in tall or wide windows)
    side: (frac, z) => frac * Math.abs(z) * Math.tan(T.FOV * Math.PI / 360) * camera.aspect,
    use(m) { if (mods.some((o) => o.name === m.name)) console.warn('[camp] two modules named', m.name); mods.push(m); if (booted) { mods.sort((a, b) => (a.order || 50) - (b.order || 50)); m.init && m.init(); buildHowTo(); } return m; }
  };
  window.CAMP = {                                                     // the test handle; modules add their own fields with Camp.test
    state, player, start: startNight, interact,
    perf: () => (typeof IW !== 'undefined' ? IW.perf() : null),
    tp(x, z, yaw) { Object.assign(player, { x, z, vx: 0, vz: 0, sitting: false }); if (yaw !== undefined) player.yaw = yaw; camera.position.set(x, terrainY(x, z) + T.EYE, z); },
    look(x, y, z) { const d = new THREE.Vector3(x, y, z).sub(camera.position); player.yaw = Math.atan2(-d.x, -d.z); player.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)); },
    sit: sitDown, stand: standUp,
    skip(min) { advance(min); },
    target: () => state.target && (state.target.mod || 'core') + ': ' + state.target.label.replace(/<[^>]+>/g, ''),
    mood: () => MOODS[moodIdx].name,
    modules: () => mods.map((m) => m.name),
    hearth: [HX, HZ], seat: [SEAT.x, SEAT.z], colliders: () => colliders.length
  };
  // modules add test helpers with Camp.test.x = …; a name already taken (like the core's skip) is refused with a warning
  window.Camp.test = new Proxy(window.CAMP, { set(o, k, v) { if (k in o) { console.warn('[camp] test name taken:', k); return true; } o[k] = v; return true; } });
})();
