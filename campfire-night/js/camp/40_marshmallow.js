// © 2026 George Moussa. All rights reserved.
// CAMP 40. MARSHMALLOWS: on the stump, R puts one on a stick, Space holds it closer to the coals, R again eats it.
//     Heat comes from where the marshmallow actually is (its distance to the flames) and how big the fire is.
//     White -> golden (the sweet spot) -> dark -> it catches: R blows it out, or it chars on its own.
(function () {
  if (!window.Camp) return;
  const C = Camp, { clamp01, fireAt } = C;
  const TOAST_RATE = 0.11, CATCH_AT = 1.0, CHAR_SECS = 4;
  const COLS = [[0, 0xe8e0d2], [0.35, 0xcfae80], [0.6, 0xa8641e], [0.82, 0x4e2610], [1.05, 0x120804]];   // darker than life: the composite lifts near things
  const GOLDEN = [0.6, 0.8];
  const m = { on: false, cook: 0, reach: 0, fire: 0, burnt: false };
  let eaten = 0, golden = 0;

  // the roasting stick runs from your right hand toward the middle of the view; the marshmallow sits on its tip
  const roast = new THREE.Group(); C.vm.add(roast); roast.visible = false;
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.011, 1, 5), C.heldMat(0x3a2412));
  stick.rotation.x = Math.PI / 2; stick.position.z = -0.5; roast.add(stick);
  const mat = new THREE.MeshStandardMaterial({ color: 0xe8e0d2, roughness: 0.7, emissive: 0x000000, envMapIntensity: 0.3 });
  const mallow = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.07, 14), mat);
  mallow.rotation.x = Math.PI / 2; mallow.position.z = -0.97; roast.add(mallow);
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: goldGlowTex, color: 0xff9a3a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
  flame.position.z = -0.99; flame.scale.setScalar(0.11); roast.add(flame);

  const word = () => m.burnt ? 'charcoal' : m.fire > 0 ? 'on fire!' : m.cook < 0.2 ? 'white' : m.cook < 0.48 ? 'warming'
    : m.cook < GOLDEN[0] ? 'almost' : m.cook < GOLDEN[1] ? 'golden' : m.cook < 0.95 ? 'dark' : 'about to catch';
  function press() {
    if (!m.on) { if (C.handsBusy(mod)) { C.toast('Hands full. Feed the fire first.'); return; } Object.assign(m, { on: true, cook: 0, reach: 0, fire: 0, burnt: false }); return; }
    if (m.fire > 0) { m.fire = 0; m.burnt = true; m.cook = Math.max(m.cook, 1.1); blow(); return; }
    const c = m.cook;
    const said = m.burnt ? 'Charcoal outside, molten inside. Still good.' : c < 0.2 ? 'Cold in the middle. Still a marshmallow.' : c < 0.48 ? 'Warm and soft.'
      : c < GOLDEN[0] ? 'Nearly there. Soft and sweet.' : c < GOLDEN[1] ? 'Just right. Golden all over.' : 'Toasty, a little crisp at the edges.';
    if (!m.burnt && c >= GOLDEN[0] && c < GOLDEN[1]) golden++;
    eaten++; m.on = false; C.toast(said); C.emit('mallow', { cook: c, burnt: m.burnt });
  }
  function blow() { if (C.sfx()) C.noiseHit(audioCtx.currentTime, 0.45, 900, 0.6, 0.3); }

  const at = new THREE.Vector3(), cA = new THREE.Color();
  function update(dt) {
    roast.visible = m.on && C.state.running;
    if (!m.on || C.state.paused) return;                              // the guide or sleep holds the night: nothing cooks
    m.reach += ((C.keys.Space ? 1 : 0) - m.reach) * Math.min(1, dt * 4);   // Space holds it closer to the coals
    roast.position.set(C.side(0.5, 0.35) - 0.05 * m.reach, -0.2 - 0.07 * m.reach, -0.05 - 0.38 * m.reach);
    roast.rotation.set(0.12 - 0.08 * m.reach, 0.14, 0);   // tip up in the view, above the prompt line
    mallow.getWorldPosition(at);
    const d = at.distanceTo(fireAt), f = Math.max(C.fireLevel(), 0.45 * C.state.ember / C.T.EMBER_MIN) * (1 + 0.3 * C.state.flare);   // glowing embers toast too (the field guide says coals are best)
    const heat = f * Math.pow(clamp01(1 - (d - 0.12) / 0.95), 1.6);   // close to the coals it toasts in seconds; far off, it barely warms
    if (!m.burnt) m.cook += dt * heat * TOAST_RATE;
    if (m.cook > CATCH_AT && !m.fire && !m.burnt) { m.fire = 0.001; if (C.burst) C.burst(12, 0.4, at); C.toast('It caught! R to blow it out.'); C.emit('mallowfire'); }
    if (m.fire > 0) { m.fire += dt; m.cook += dt * 0.15; if (m.fire > CHAR_SECS) { m.fire = 0; m.burnt = true; } }
    const c = Math.min(m.cook, 1.05); let k = 0; while (k < COLS.length - 2 && c > COLS[k + 1][0]) k++;
    const A = COLS[k], B = COLS[k + 1];
    C.lerpHex(mat.color, A[1], B[1], clamp01((c - A[0]) / (B[0] - A[0])), true);
    mat.emissive.setRGB(0.5 * heat + (m.fire > 0 ? 0.6 : 0), 0.18 * heat + (m.fire > 0 ? 0.2 : 0), 0.02 * heat);
    const now = performance.now();
    flame.material.opacity = m.fire > 0 ? 0.9 + 0.1 * Math.sin(now * 0.03) : 0;
    flame.scale.setScalar(0.09 + 0.03 * Math.sin(now * 0.021));
    m.heat = heat;
  }

  const mod = C.use({
    name: 'marshmallow', order: 40,
    keys: 'R marshmallow · Space hold it closer',
    key(e) {
      if (e.type !== 'keydown' || e.repeat || e.code !== 'KeyR' || !C.player.sitting || !C.state.running || C.state.paused) return false;
      press(); return true;
    },
    onStand() { m.on = false; },
    reset() { Object.assign(m, { on: false, cook: 0, reach: 0, fire: 0, burnt: false }); eaten = golden = 0; },
    busy: () => m.on,
    seatHint: () => m.on ? null : '<b>R</b> marshmallow',
    target(ctx) {
      if (!ctx.sitting || !m.on) return null;
      return { label: m.fire > 0 ? '<b>R</b> blow it out!' : `<b>R</b> eat it · <b>Space</b> hold closer · looks <b>${word()}</b>`, prio: 10 };
    },
    frame: update,
    moments: () => golden ? [golden === 1 ? 'a marshmallow, just right' : `${golden} golden marshmallows`]
      : eaten ? [eaten === 1 ? 'a marshmallow' : `${eaten} marshmallows`] : []
  });
  C.test.mallow = () => ({ on: m.on, cook: +m.cook.toFixed(3), heat: +(m.heat || 0).toFixed(3), look: word(), eaten, golden });
  C.test.mallowKey = press;
})();
