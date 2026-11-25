// © 2026 George Moussa. All rights reserved.
// ============================================================================
// CAMP 90. THIRD PERSON: V swaps between your own eyes and a camera behind your shoulder.
//     The body is a clone of George's studio rig (cloneRig from 18_parts) on its own mixer: idle, walk and run,
//     blended by how fast you move, turning toward where you walk.
//     Everything else in the game still sees from the eye (Camp.head): targets, throws, sound, held things.
//     This module only pulls the camera back in its view() hook, which the core runs last and undoes before
//     the next frame. Sitting on the stump eases back into your eyes (the stump pastimes are close-up work);
//     there V belongs to the free view (92).
//     The choice is remembered in this browser (localStorage, a view preference only).
// ============================================================================
(function () {
  if (!window.Camp) return;
  const C = Camp;
  const LOOK = { dist: 2.7, shoulder: 0.42, lift: 0.22, minY: 0.3, hideBodyUnder: 0.75, walkRate: 1.45, runRate: 3.4 };
  const KEY = 'innerwork.camp.view';
  let third = false;
  try { third = localStorage.getItem(KEY) === '3'; } catch (e) {}

  const body = { root: null, mixer: null, acts: {}, head: null, feet: [], foot: 0, failed: false, heading: 0, bob: 0 };
  let blend = 0, dist = LOOK.dist;
  const fwd = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), tmp = new THREE.Vector3();

  function build() {
    if (body.root || body.failed) return;
    if (typeof cloneRig !== 'function' || typeof xbotHumanModel === 'undefined' || !xbotHumanModel || !humanActions.idle) return;
    try {
      const { clone, map } = cloneRig(xbotHumanModel);
      clone.traverse((c) => { if (c.isMesh || c.isSkinnedMesh) c.frustumCulled = false; });
      clone.position.set(0, 0, 0); clone.rotation.set(0, 0, 0);
      body.head = map.get(humanBones.mixamorigHead) || null;
      body.feet = ['mixamorigLeftToeBase', 'mixamorigRightToeBase'].map((n) => map.get(humanBones[n])).filter(Boolean);
      body.mixer = new THREE.AnimationMixer(clone);
      for (const name of ['idle', 'walk', 'run']) {
        const a = humanActions[name]; if (!a) continue;
        const act = body.mixer.clipAction(a.getClip()); act.setLoop(THREE.LoopRepeat, Infinity); act.play(); act.setEffectiveWeight(name === 'idle' ? 1 : 0);
        body.acts[name] = act;
      }
      if (body.acts.idle) body.acts.idle.timeScale = 0.45;
      scene.add(clone); clone.visible = false; body.root = clone;
      // feet on the ground: lowest toe in the standing idle sits 5 cm up
      body.mixer.update(0); clone.updateMatrixWorld(true);
      let low = Infinity; for (const f of body.feet) { f.getWorldPosition(tmp); low = Math.min(low, tmp.y); }
      body.foot = low < Infinity ? 0.05 - low : 0;
    } catch (err) { body.failed = true; console.error('[camp] third-person body failed', err); }
  }

  function setThird(on, quiet) {
    third = on;
    try { localStorage.setItem(KEY, on ? '3' : '1'); } catch (e) {}
    if (!quiet) C.toast(on ? 'Third person. V to see through your own eyes.' : 'First person.');
  }

  // speed 0..JOG -> idle / walk / run weights, and step rates that keep the feet roughly planted
  function animate(dt, speed) {
    const A = body.acts, w = Math.min(1, speed / C.T.WALK), r = C.clamp01((speed - C.T.WALK) / (C.T.JOG - C.T.WALK));
    if (A.idle) A.idle.setEffectiveWeight(1 - w);
    if (A.walk) { A.walk.setEffectiveWeight(w * (1 - r)); A.walk.timeScale = Math.max(0.6, speed / LOOK.walkRate); }
    if (A.run) { A.run.setEffectiveWeight(w * r); A.run.timeScale = Math.max(0.6, speed / LOOK.runRate); }
    body.mixer.update(dt);
    if (body.head) body.head.scale.setScalar(1.14);                   // the studio's head scale (10g)
  }

  // Only the pines block the camera: the stump, hearth and rocks are low, the camera rides over them (and the ground floor).
  const trunks = [];
  function findTrunks() {
    if (typeof pines === 'undefined' || !pines) return;
    const m = new THREE.Matrix4(), v = new THREE.Vector3(); pines.updateMatrixWorld(true);
    for (let i = 0; i < pines.count; i++) { pines.getMatrixAt(i, m); m.premultiply(pines.matrixWorld); v.setFromMatrixPosition(m); trunks.push({ x: v.x, z: v.z, r: 0.55 }); }
  }
  // how far back the camera can go before a pine is in the way
  function clearDist(from, dir, want) {
    for (let d = 0.4; d <= want; d += 0.1) {
      p.copy(from).addScaledVector(dir, d);
      for (const c of trunks) {
        const dx = p.x - c.x, dz = p.z - c.z, rr = c.r * 0.6;
        if (Math.abs(dx) < rr && Math.abs(dz) < rr && dx * dx + dz * dz < rr * rr) return Math.max(0.4, d - 0.25);
      }
    }
    return want;
  }

  C.use({
    name: 'third_person', order: 90,
    keys: 'V third person',
    init() { build(); findTrunks(); },
    reset() { blend = 0; dist = LOOK.dist; body.heading = C.player.yaw; },
    key(e) {
      if (e.code !== 'KeyV' || C.player.sitting) return false;   // sitting, V is free view (92)
      if (e.type === 'keydown' && !e.repeat && C.state.running && !C.state.paused) setThird(!third);
      return true;
    },
    frame(dt) {
      const P = C.player, S = C.state;
      const want = third && S.running && !S.paused && !P.sitting ? 1 : 0;
      blend += (want - blend) * (1 - Math.exp(-dt * (want ? 5 : 7)));
      if (blend < 0.002) blend = 0;
      if (!body.root) { if (third) build(); if (!body.root) return; }
      const speed = Math.hypot(P.vx, P.vz);
      if (speed > 0.3) {                                                // turn toward where you walk
        const goal = Math.atan2(-P.vx, -P.vz);
        let d = goal - body.heading; d = Math.atan2(Math.sin(d), Math.cos(d));
        body.heading += d * (1 - Math.exp(-dt * 10));
      }
      const show = blend > 0 && dist * blend > LOOK.hideBodyUnder;
      body.root.visible = show;
      if (!show) return;
      body.root.position.set(P.x, terrainY(P.x, P.z) + body.foot, P.z);
      body.root.rotation.y = body.heading + Math.PI;                    // the rig faces +z; yaw 0 looks down -z
      animate(dt, speed);
    },
    view(dt) {
      if (blend <= 0) return false;
      const P = C.player, eye = C.head.position;
      fwd.set(-Math.sin(P.yaw) * Math.cos(P.pitch), Math.sin(P.pitch), -Math.cos(P.yaw) * Math.cos(P.pitch));
      right.set(Math.cos(P.yaw), 0, -Math.sin(P.yaw));
      // behind and over the right shoulder; pulled in when a tree or rock is in the way (in fast, out slow)
      tmp.copy(fwd).multiplyScalar(-1).addScaledVector(right, LOOK.shoulder / LOOK.dist).addScaledVector(up, LOOK.lift / LOOK.dist).normalize();
      const clear = clearDist(eye, tmp, LOOK.dist);
      dist += (clear - dist) * (1 - Math.exp(-dt * (clear < dist ? 18 : 3)));
      const cam = C.camera;
      cam.position.copy(eye).addScaledVector(tmp, dist * blend);
      const floor = terrainY(cam.position.x, cam.position.z) + LOOK.minY;
      if (cam.position.y < floor) cam.position.y = floor;
      controls.target.copy(cam.position).add(fwd);                     // controls.update() aims the camera after this
      desiredCamPos.copy(cam.position); desiredCamTarget.copy(controls.target);
      cam.lookAt(controls.target);
      return true;
    }
  });
  C.test.view = (on) => { if (on !== undefined) setThird(!!on, true); return { third, blend: +blend.toFixed(3), dist: +dist.toFixed(2), body: !!body.root, visible: !!(body.root && body.root.visible) }; };
})();
