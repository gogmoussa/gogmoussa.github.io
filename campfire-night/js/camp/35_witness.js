// © 2026 George Moussa. All rights reserved.
// ============================================================================
// CAMP 35. THE WITNESS: sit on the stump and the Witness comes up out of the lake to join you across the fire.
//     The studio's Witness (10h, spiritFloatGroup) has its place across the hearth from George's seat, facing the
//     stump. The core hides the cast every frame (hideStudioCast); this module's frame() runs after that and shows it.
//     Arriving: after a short wait it rises out of the water at RISE_SPOT (open water to the LEFT of the fire as you
//     sit), inside ripple rings, then glides ashore to its place (the studio's "rise" reveal, 14D). Leaving (you stand):
//     the same path backwards, it glides out over the water and sinks, with ripples.
//     One number drives it: p, 0 = under the water at RISE_SPOT, 1 = at its place. Rise over p 0..RISE_P, glide after.
//     No light is added (a light appearing recompiles every material: a stutter); its glass shader glows on its own.
// ============================================================================
(function () {
  if (!window.Camp) return;
  const C = Camp;
  const ARRIVE_AFTER = 1.6;            // seconds settled on the stump before it comes
  const IN_SECS = 3.2, OUT_SECS = 2.8; // the whole path, each way
  const RISE_P = 0.42, DEPTH = 1.9;    // share of the path spent rising; how far under the water it starts
  const home = spiritFloatGroup.position.clone();   // its place (x/z; y floats in the loop)
  const spot = new THREE.Vector3();

  // RISE_SPOT: open water to the left of the fire as seen from the stump, ~3.4 m out, at least 0.9 m inside the shore
  function findSpot() {
    const fx = home.x - C.SEAT.x, fz = home.z - C.SEAT.z, fl = Math.hypot(fx, fz);
    const ux = fx / fl, uz = fz / fl, lx = uz, lz = -ux;           // forward and left on the ground
    let best = null;
    for (let side = 0.9; side <= 3.5 && !best; side += 0.2)       // as little to the left as works
      for (let fwd = 1.2; fwd <= 4.4; fwd += 0.2) {
        const x = C.SEAT.x + ux * fwd + lx * side, z = C.SEAT.z + uz * fwd + lz * side;
        if (lakeEdge(x, z) < -0.9) { best = [x, z]; break; }
      }
    if (!best) best = [POND_SPOT.x, POND_SPOT.z];
    spot.set(best[0], 0, best[1]);
  }

  const w = { p: 0, dir: 0, sitT: 0, visits: 0, counted: false, splashed: false };
  const ss = (x) => x * x * (3 - 2 * x);

  function sound(rising) {                                 // a slow water swell, and a glass note as it surfaces
    const ac = C.sfx(); if (!ac) return;
    const t = ac.currentTime, pan = window.CAMP && CAMP.panOf ? CAMP.panOf(spot.x, spot.z) : 0, out = C.sfxOut();
    C.noiseHit(t, 1.6, 520, 0.8, 0.05, 'bandpass', out);
    C.noiseHit(t + 0.25, 1.2, 1400, 1.2, 0.02, 'bandpass', out);
    if (rising) { C.tone(t + 0.5, 880, 880, 2.6, 0.03, 'sine', pan, out); C.tone(t + 0.58, 1318.5, 1318.5, 2.2, 0.018, 'sine', pan, out); }
  }
  function ripples(max) { if (typeof spawnRipple === 'function') spawnRipple(spot.x, spot.z, max); }

  C.use({
    name: 'witness', order: 35,
    init: findSpot,
    reset() { w.p = 0; w.dir = 0; w.sitT = 0; w.visits = 0; w.counted = false; },
    onSit() { w.sitT = 0; w.counted = false; },
    onStand() { if (w.p > 0) { w.dir = -1; w.splashed = false; } },
    frame(dt) {
      const sitting = C.state.running && C.player.sitting;
      if (sitting) {
        w.sitT += dt;
        if (w.dir <= 0 && w.p < 1 && w.sitT >= ARRIVE_AFTER) {
          if (w.p === 0) { ripples(1.2); sound(true); }
          w.dir = 1;
          if (!w.counted) { w.counted = true; w.visits++; }
        }
      } else if (w.dir > 0 || w.p > 0) w.dir = -1;
      const pBefore = w.p;
      if (w.dir > 0) w.p = Math.min(1, w.p + dt / IN_SECS);
      else if (w.dir < 0) w.p = Math.max(0, w.p - dt / OUT_SECS);
      if (w.dir < 0 && pBefore > RISE_P && w.p <= RISE_P) { ripples(1.0); sound(false); }   // reaching the water: going under
      if (w.p === 0 && w.dir < 0) { w.dir = 0; ripples(0.7); }
      if (w.p === 1 && w.dir > 0) w.dir = 0;

      const on = w.p > 0.001;
      spiritFloatGroup.visible = on;
      if (!on) return;
      const rise = -DEPTH * (1 - ss(Math.min(1, w.p / RISE_P)));                 // up out of the water...
      const glide = ss(Math.max(0, (w.p - RISE_P) / (1 - RISE_P)));             // ...then ashore to its place
      spiritFloatGroup.position.x = THREE.MathUtils.lerp(spot.x, home.x, glide);
      spiritFloatGroup.position.z = THREE.MathUtils.lerp(spot.z, home.z, glide);
      spiritFloatGroup.position.y += rise;                                      // the loop set the float height this frame
      spiritFloatGroup.scale.setScalar(1);
      spiritBodyUniforms.uCoherence.value = 0.65;
    },
    moments() { return w.visits ? [w.visits === 1 ? 'The Witness came up from the lake to sit with you.' : `The Witness came up from the lake ${w.visits} times.`] : []; }
  });
  C.test.witness = () => ({ p: +w.p.toFixed(3), dir: w.dir, visible: spiritFloatGroup.visible, visits: w.visits,
    spot: [+spot.x.toFixed(2), +spot.z.toFixed(2)], at: spiritFloatGroup.position.toArray().map((v) => +v.toFixed(2)) });
})();
