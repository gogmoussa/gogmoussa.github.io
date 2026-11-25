// © 2026 George Moussa. All rights reserved.
// CAMP 60. NIGHT LIFE: shooting stars once the real sky is out (hold your gaze up and one comes), and an owl in the trees.
(function () {
  if (!window.Camp) return;
  const C = Camp, { rand } = C;
  // Shooting stars come where you can see them: every STAR_EVERY seconds somewhere ahead and low-ish in the sky, and
  // while you hold your gaze up for a few seconds (GAZE), one crosses where you are looking (at least GAP apart).
  // They need the sky out (starsOut > STAR_SKY): about a minute of walking or one burning thought after 21:00.
  const STAR_EVERY = [30, 60], STAR_FIRST = [25, 45], GAZE = [3, 9], GAP = 8, STAR_SKY = 0.4, R = 60, UP = 0.3;
  // Look (George, Nov 18: the first, dimmer ones were better): a thin, soft streak and a small head, about the size of
  // a bright star, not a flare. WIDTH is the head's half-width in metres at R; HEAD the glow sprite; BRIGHT the head colour.
  const WIDTH = [0.09, 0.14], HEAD = [0.7, 0.35], BRIGHT = 0.7;
  const OWL_EVERY = [60, 140], OWL_FIRST = [40, 80];
  let stars = 0, owls = 0, nextStar = 0, lastStar = 0, gaze = 0, gazeNeed = rand(...GAZE), nextOwl = 0, live = null;

  // a streak: a camera-facing tapered quad (head bright and wide, tail dark and thin; additive) plus a glow at its head
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array([BRIGHT, BRIGHT * 0.97, BRIGHT * 0.9, BRIGHT, BRIGHT * 0.97, BRIGHT * 0.9, 0, 0, 0, 0, 0, 0]), 3));
  geo.setIndex([0, 1, 2, 1, 3, 2]);
  const streak = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
  streak.frustumCulled = false; streak.visible = false; scene.add(streak);
  const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: goldGlowTex, color: 0xfff6e8, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  head.visible = false; scene.add(head);
  const fwd = new THREE.Vector3(), tmp = new THREE.Vector3(), to = new THREE.Vector3(), side = new THREE.Vector3(), tail = new THREE.Vector3();

  function spawn(where) {                                             // 'gaze': across the middle of your view; 'ahead': in front, low enough to catch
    const p = C.player, gazing = where === 'gaze';
    const yaw = p.yaw + (gazing ? rand(-0.35, 0.35) : rand(-1.1, 1.1));
    const el = gazing ? Math.max(0.3, Math.min(1.25, p.pitch + rand(-0.05, 0.2))) : rand(0.35, 0.7);
    const c = new THREE.Vector3(-Math.sin(yaw) * Math.cos(el), Math.sin(el), -Math.cos(yaw) * Math.cos(el)).multiplyScalar(R).add(camera.position);
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(Math.random() < 0.5 ? -1 : 1);
    const dir = right.addScaledVector(new THREE.Vector3(0, 1, 0), -rand(0.25, 0.6)).normalize();   // across and falling
    const travel = rand(14, 20);
    live = { a: c.addScaledVector(dir, -travel / 2), dir, travel, t: 0, dur: rand(0.9, 1.4), len: rand(9, 15), w: rand(...WIDTH), seen: false };
  }
  function updateStars(dt, nowMs) {
    const amt = C.starsOut(C.state.minutes);
    if (!nextStar) nextStar = nowMs + rand(...STAR_FIRST) * 1000;
    gaze = C.player.pitch > UP ? gaze + dt : 0;
    if (!live && amt > STAR_SKY) {
      if (gaze > gazeNeed && nowMs - lastStar > GAP * 1000) { spawn('gaze'); gaze = 0; gazeNeed = rand(...GAZE); lastStar = nowMs; }
      else if (nowMs > nextStar) { spawn('ahead'); lastStar = nowMs; nextStar = nowMs + rand(...STAR_EVERY) * 1000; }
    }
    if (!live) { streak.visible = head.visible = false; return; }
    const s = live; s.t += dt / s.dur; const u = Math.min(1, s.t), fade = Math.sin(u * Math.PI) * Math.min(1, amt * 1.5);
    const h = tmp.copy(s.a).addScaledVector(s.dir, s.travel * u);
    tail.copy(h).addScaledVector(s.dir, -s.len * Math.min(1, u * 2.5));
    to.copy(camera.position).sub(h); side.crossVectors(s.dir, to).normalize().multiplyScalar(s.w * fade);
    const arr = geo.attributes.position.array, tw = 0.25;            // the tail keeps a sliver of width so it never collapses to a hairline
    arr[0] = h.x + side.x; arr[1] = h.y + side.y; arr[2] = h.z + side.z;
    arr[3] = h.x - side.x; arr[4] = h.y - side.y; arr[5] = h.z - side.z;
    arr[6] = tail.x + side.x * tw; arr[7] = tail.y + side.y * tw; arr[8] = tail.z + side.z * tw;
    arr[9] = tail.x - side.x * tw; arr[10] = tail.y - side.y * tw; arr[11] = tail.z - side.z * tw;
    geo.attributes.position.needsUpdate = true;
    streak.material.opacity = head.material.opacity = fade; head.position.copy(h); head.scale.setScalar(HEAD[0] + HEAD[1] * fade);
    streak.visible = head.visible = true;
    camera.getWorldDirection(fwd);
    if (!s.seen && to.copy(h).sub(camera.position).normalize().dot(fwd) > 0.6) { s.seen = true; stars++; C.emit('meteor'); if (stars === 1) setTimeout(() => C.toast('A shooting star. Make a wish.'), 700); }
    if (u >= 1) live = null;
  }

  function owl() {                                                    // a tawny-ish "hoo ... hoo-hoo-hooo", far off in the trees
    if (!C.sfx()) return; const t = audioCtx.currentTime + 0.05, f = owlF, g = 0.05;
    const pan = C.test.panOf ? C.test.panOf(owlAt.x, owlAt.z) : rand(-0.9, 0.9);   // one perch a night: turn and it stays put
    hoot(t, f, f * 0.94, 0.5, g, pan);
    [0.95, 1.2, 1.45].forEach((d, i) => hoot(t + d, f * 1.02, f * (i === 2 ? 0.85 : 0.95), i === 2 ? 0.7 : 0.18, g * 0.8, pan));
    owls++; C.emit('owl');
  }
  // a hoot is breath through a hollow: a soft-attack sine with a slow wobble, plus breath noise tuned to the same note
  function hoot(t, f0, f1, dur, g, pan) {
    const o = audioCtx.createOscillator(), vib = audioCtx.createOscillator(), vg = audioCtx.createGain(), env = audioCtx.createGain(), p = audioCtx.createStereoPanner();
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    vib.frequency.value = 6; vg.gain.value = f0 * 0.012; vib.connect(vg); vg.connect(o.frequency);
    env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(g, t + Math.min(0.08, dur * 0.35)); env.gain.setValueAtTime(g, t + dur * 0.6); env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    p.pan.value = pan; o.connect(env); env.connect(p); p.connect(C.sfxOut ? C.sfxOut() : audioOut);
    o.start(t); vib.start(t); o.stop(t + dur + 0.05); vib.stop(t + dur + 0.05);
    C.noiseHit(t + 0.02, dur, f0, 9, g * 0.9);                         // breath
  }
  const owlAt = new THREE.Vector3(); let owlF = 390;
  function perch() {
    const a = rand(0, Math.PI * 2), r = rand(14, 22);
    owlAt.set(C.HX + Math.sin(a) * r, 6, C.HZ + Math.cos(a) * r); owlF = rand(360, 420);
  }
  function updateOwl(nowMs) {
    if (!nextOwl) nextOwl = nowMs + rand(...OWL_FIRST) * 1000;
    if (nowMs > nextOwl && C.state.minutes > 60 && C.state.minutes < 470) { owl(); nextOwl = nowMs + rand(...OWL_EVERY) * 1000; }
  }

  C.use({
    name: 'night-life', order: 60,
    reset() { stars = owls = 0; nextStar = nextOwl = lastStar = gaze = 0; live = null; perch(); },
    tick(dt, nowMs) { if (!C.state.paused) { updateStars(dt, nowMs); updateOwl(nowMs); } },
    frame() { if (!C.state.running) streak.visible = head.visible = false; },
    moments: () => [stars && (stars === 1 ? 'a shooting star' : `${stars} shooting stars`), owls && 'an owl, somewhere in the trees'].filter(Boolean)
  });
  Object.assign(C.test, { shootingStar: (where) => spawn(where || 'gaze'), owl, nightLife: () => ({ stars, owls, live: !!live }) });
})();
