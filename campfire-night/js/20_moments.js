// © 2026 George Moussa. All rights reserved.
// ============================================================================
// 20. MOMENTS: wordless clips built around one effect (README "Direction (Nov 16 2026)")
// ============================================================================
//  20A  the storm      wind, overcast, rain, lightning, a fire that fights to stay lit (and can go out)
//  20C  weather menu   Clear / Windy / Rain / Storm in the explore dock, T for lightning
//  20D  cards          on-screen words for a moment that teaches: a big count, a fact title, a Witness line (cue `card`)
//  20B  moment loader  IW.moment('storm_15s') plays episodes/moments/<name>.json in place of an episode's beats
//
// This file loads last and hooks the loop from outside (it wraps animate, runCue, fireSwellNow and loadEpisode), so the
// storm needs no code in 14. What it does need elsewhere: galeU in the grass and canopy shaders (11b) and
// uStorm / uFlash / uFlashDir in the sky shader (04).
//
// Cue keys (any beat's `cues`):
//   storm: 0..1        the storm's level; `stormSecs` = seconds to get there (0 snaps, default 3). 0 clears the sky again.
//   fireOut: 0..1     how far out the fire is (1 = no flame, no light; the coals still glow); `fireOutSecs` to get there
//                      (default 1). fireTeal: seconds the fire burns in the Witness's teal before easing back to gold.
//   gesture: "shield"  George leans his hands low over the fire, palms down (added to 14's GESTURES from here).
//   flash: 0..1.5      a lightning strike now. `bolt: false` = sheet lightning only (no visible bolt); otherwise the bolt
//                      lands in front of the camera, `boltAz` degrees left (-) or right (+) of centre (default: seeded).
// Explore dock: a Weather menu (Clear / Windy / Rain / Storm) and the T key for one lightning strike; IW.weather('storm').
// Console: IW.storm(1, 4) rolls one in with its own random lightning; IW.storm(0) ends it; IW.flash() strikes once.
// Nothing here accumulates: every light, fog and exposure value is its mood base times a storm factor, each frame.

// ---- 20A. THE STORM ---------------------------------------------------------
const STORM = { level: 0, from: 0, to: 0, t0: 0, secs: 0, auto: false, nextAuto: 0, lastNow: null, applied: false, t: 0, flash: null, pending: null, log: [] };
const STORM_WIND = new THREE.Vector3(-0.84, 0, 0.54); // downwind; matches the grass lean in 11b and the flames' lean toward George
const STORM_FX = { sun: 0.8, hemi: 0.5, fog: 1.25, fogDark: 0.72, exposure: 0.10, fire: 0.30, fireGutter: 0.30, lean: 0.55 };
const _stFogBase = new THREE.Color(), _stFogDark = new THREE.Color(0x05070c), _stFlashCol = new THREE.Color(0.62, 0.72, 1.0);
const _stSun = new THREE.Color(), _stV = new THREE.Vector3(), _stSunDir = new THREE.Vector3();
const stormFlashDir = new THREE.Vector3(0, 0.35, -1).normalize();
const stormFlashLight = new THREE.DirectionalLight(0xa9c2ff, 0); // no shadows: it is on for a few frames
scene.add(stormFlashLight);

function stormSet(level, secs) {
  const now = performance.now();
  STORM.from = stormLevelAt(now); STORM.to = Math.max(0, Math.min(1, +level || 0));
  STORM.t0 = now; STORM.secs = typeof secs === 'number' ? Math.max(0, secs) : 3;
}
function stormLevelAt(now) {
  if (STORM.secs <= 0) return STORM.to;
  const u = Math.max(0, Math.min(1, (now - STORM.t0) / 1000 / STORM.secs));
  return STORM.from + (STORM.to - STORM.from) * u * u * (3 - 2 * u);
}
// One strike: a main stroke, two or three restrikes and a short afterglow, about 0.8 s in all.
const STROKES = [[0, 1], [0.10, 0.5], [0.17, 0.9], [0.31, 0.35]];
function flashShape(dt, core) {
  if (dt < 0) return 0;
  let v = 0;
  for (const [t, a] of STROKES) if (dt >= t) v += a * Math.exp(-(dt - t) / (core ? 0.035 : 0.06));
  return Math.min(1.4, v + (core ? 0 : 0.2 * Math.exp(-dt / 0.28)));
}
function stormRand(seed) { // mulberry32: a take renders the same bolt every time
  let a = (seed >>> 0) || 1;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function stormFlash(strength, c) {
  c = c || {};
  const seed = typeof c.seed === 'number' ? c.seed : (curBeatIdx + 1) * 131 + Math.round((c.t || 0) * 10) * 7 + (STORM.auto ? Math.floor(performance.now()) : 0);
  STORM.pending = { k: Math.max(0.1, +strength || 1), bolt: c.bolt !== false, az: c.boltAz, seed };
}

// --- the bolt: a jagged ribbon far behind the scene, facing the camera it was built for ---
const boltMat = new THREE.ShaderMaterial({
  uniforms: { uK: { value: 0 } },
  vertexShader: `attribute float aEdge; varying float vE; void main() { vE = aEdge; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform float uK; varying float vE; void main() { float c = 1.0 - abs(vE); gl_FragColor = vec4(vec3(0.72, 0.80, 1.0) * uK * (0.35 + 2.4 * c * c), 1.0); }`,
  blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, side: THREE.DoubleSide
});
const boltMesh = new THREE.Mesh(new THREE.BufferGeometry(), boltMat);
boltMesh.frustumCulled = false; boltMesh.visible = false; boltMesh.renderOrder = 2;
scene.add(boltMesh);

function jag(a, b, amp, depth, rnd, right, out) {
  if (depth === 0) { out.push(b.clone()); return; }
  const m = a.clone().lerp(b, 0.5 + (rnd() - 0.5) * 0.2);
  m.addScaledVector(right, (rnd() - 0.5) * 2 * amp); m.y += (rnd() - 0.5) * amp * 0.5;
  jag(a, m, amp * 0.55, depth - 1, rnd, right, out); jag(m, b, amp * 0.55, depth - 1, rnd, right, out);
}
function buildBolt(p) {
  const rnd = stormRand(p.seed);
  const fwd = _stV.copy(controls.target).sub(camera.position); fwd.y = 0;
  if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1);
  fwd.normalize();
  const az = (typeof p.az === 'number' ? p.az : (rnd() - 0.5) * 16) * Math.PI / 180;
  const f = new THREE.Vector3(fwd.x * Math.cos(az) - fwd.z * Math.sin(az), 0, fwd.x * Math.sin(az) + fwd.z * Math.cos(az));
  const right = new THREE.Vector3(-f.z, 0, f.x), D = 58;
  const base = camera.position.clone().addScaledVector(f, D); base.y = 0.5;
  const top = base.clone().addScaledVector(right, (rnd() - 0.5) * 22); top.y = 44;
  const paths = [];
  const main = [top.clone()]; jag(top, base, 4.2, 6, rnd, right, main); paths.push({ pts: main, w: 0.17 });
  const nBr = 2 + Math.floor(rnd() * 2);
  for (let i = 0; i < nBr; i++) {
    const s = main[Math.floor(main.length * (0.18 + rnd() * 0.45))];
    const e = s.clone().addScaledVector(right, (rnd() < 0.5 ? -1 : 1) * (5 + rnd() * 9)); e.y -= 6 + rnd() * 10;
    const br = [s.clone()]; jag(s, e, 2.2, 4, rnd, right, br); paths.push({ pts: br, w: 0.07 });
  }
  const pos = [], edge = [], idx = [];
  for (const { pts, w } of paths) {
    const b0 = pos.length / 3;
    for (let i = 0; i < pts.length; i++) {
      const t = pts[Math.min(pts.length - 1, i + 1)].clone().sub(pts[Math.max(0, i - 1)]).normalize();
      const side = t.cross(f).normalize().multiplyScalar(w * (1 - 0.5 * i / pts.length));
      pos.push(pts[i].x - side.x, pts[i].y - side.y, pts[i].z - side.z, pts[i].x + side.x, pts[i].y + side.y, pts[i].z + side.z);
      edge.push(-1, 1);
      if (i) { const k = b0 + i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
    }
  }
  boltMesh.geometry.dispose();
  const g = boltMesh.geometry = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aEdge', new THREE.Float32BufferAttribute(edge, 1));
  g.setIndex(idx);
  const mid = main[Math.floor(main.length * 0.35)];
  stormFlashDir.copy(mid).normalize();
}

// --- rain and wind-blown leaves: one shader, streak quads in a box that wraps round the camera ---
const RAIN_VERT = `
  attribute vec2 corner;
  uniform float uT; uniform float uAmt; uniform float uLen; uniform float uWidth; uniform float uLift; uniform float uTumble; uniform float uNear;
  uniform vec3 uVel; uniform vec3 uBox;
  varying float vA; varying vec3 vP;
  void main() {
    vec3 sd = position;
    float h = fract(sd.x * 91.7 + sd.z * 37.3 + sd.y * 13.1);
    float h2 = fract(sd.x * 17.3 + sd.y * 71.9 + sd.z * 5.7);
    vec3 vel = uVel * (0.78 + 0.44 * h);
    vec3 c = cameraPosition + vec3(0.0, uBox.y * uLift, 0.0);
    vec3 p = c + mod(sd * uBox + vel * uT - c + uBox * 0.5, uBox) - uBox * 0.5;
    p.y += sin(uT * 5.0 + h * 40.0) * uTumble; p.x += cos(uT * 3.7 + h2 * 31.0) * uTumble;
    vec3 d = normalize(vel);
    vec3 side = normalize(cross(d, normalize(cameraPosition - p)));
    vec3 wp = p - d * uLen * (0.7 + 0.6 * h) * corner.y + side * uWidth * corner.x * (1.0 + uTumble * 2.0 * sin(uT * 9.0 + h * 50.0));
    float dist = length(p - cameraPosition);
    vA = step(h2, uAmt) * smoothstep(uNear, uNear * 3.0 + 0.3, dist) * (1.0 - smoothstep(uBox.x * 0.36, uBox.x * 0.5, dist)) * (1.0 - corner.y * 0.8);
    vP = wp;
    gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
  }`;
const RAIN_FRAG = `
  uniform vec3 uCol; uniform float uAlpha; uniform float uFlash; uniform vec3 uFireP; uniform vec3 uFireC; uniform float uFireK;
  varying float vA; varying vec3 vP;
  void main() {
    float fd = length(vP - uFireP);
    vec3 col = uCol * (1.0 + uFlash * 5.0) + uFireC * uFireK / (1.0 + fd * fd * 0.55);
    gl_FragColor = vec4(col, vA * uAlpha);
  }`;
function buildStreaks(n, uniforms, additive) {
  const pos = new Float32Array(n * 12), cor = new Float32Array(n * 8), idx = new Uint32Array(n * 6);
  const rnd = stormRand(n * 7 + 3);
  for (let i = 0; i < n; i++) {
    const x = rnd(), y = rnd(), z = rnd();
    for (let k = 0; k < 4; k++) { pos.set([x, y, z], i * 12 + k * 3); cor.set([k % 2 ? 1 : -1, k < 2 ? 0 : 1], i * 8 + k * 2); }
    idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 1, i * 4 + 3, i * 4 + 2], i * 6);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('corner', new THREE.BufferAttribute(cor, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: RAIN_VERT, fragmentShader: RAIN_FRAG, transparent: true, depthWrite: false,
    side: THREE.DoubleSide, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
  const m = new THREE.Mesh(g, mat);
  m.frustumCulled = false; m.visible = false; m.renderOrder = 1;
  scene.add(m);
  return m;
}
const stormFireP = { value: new THREE.Vector3(HEARTH.x, 0.7, HEARTH.z) }, stormFireC = { value: new THREE.Color(0xff7b1c) };
const rainU = { uT: { value: 0 }, uAmt: { value: 0 }, uLen: { value: 0.36 }, uWidth: { value: 0.0024 }, uLift: { value: 0.22 }, uTumble: { value: 0 }, uNear: { value: 0.5 },
  uVel: { value: new THREE.Vector3(-5.5, -15, 3.5) }, uBox: { value: new THREE.Vector3(20, 12, 20) },
  uCol: { value: new THREE.Color(0.30, 0.35, 0.46) }, uAlpha: { value: 0.36 }, uFlash: { value: 0 }, uFireP: stormFireP, uFireC: stormFireC, uFireK: { value: 0 } };
const leafU = { uT: rainU.uT, uAmt: { value: 0 }, uLen: { value: 0.085 }, uWidth: { value: 0.022 }, uLift: { value: 0.18 }, uTumble: { value: 0.16 }, uNear: { value: 2.4 },
  uVel: { value: new THREE.Vector3(-7.5, -0.7, 4.8) }, uBox: { value: new THREE.Vector3(26, 6, 26) },
  uCol: { value: new THREE.Color(0.030, 0.034, 0.022) }, uAlpha: { value: 0.95 }, uFlash: { value: 0 }, uFireP: stormFireP, uFireC: stormFireC, uFireK: { value: 0 } };
const rainMesh = buildStreaks(14000, rainU, true);
const leafMesh = buildStreaks(420, leafU, false);

// --- rain rings on the pond: point sprites squashed into ellipses, each a short ring that opens and fades ---
const pondRainU = { uT: rainU.uT, uAmt: { value: 0 }, uFlash: { value: 0 }, uScale: { value: 1 } };
const pondRain = (function () {
  const n = 420, pos = new Float32Array(n * 3), rnd = stormRand(77);
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 0.93;
    pos.set([POND.cx + Math.cos(a) * r * POND.rx, LAKE_Y + 0.022, POND.cz + Math.sin(a) * r * POND.rz], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: pondRainU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform float uT; uniform float uAmt; uniform float uScale; varying float vPh; varying float vOn;
      void main() {
        float h = fract(position.x * 12.9898 + position.z * 78.233), h2 = fract(position.x * 39.3 + position.z * 11.1);
        vPh = fract(uT * (0.9 + 0.7 * h) + h2);
        vOn = step(h, uAmt);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = uScale * (0.05 + 0.34 * vPh) / max(0.5, -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform float uFlash; varying float vPh; varying float vOn;
      void main() {
        vec2 q = (gl_PointCoord - 0.5) * vec2(2.0, 5.0);
        float r = length(q);
        float ring = smoothstep(0.55, 0.8, r) * (1.0 - smoothstep(0.8, 1.0, r));
        gl_FragColor = vec4(vec3(0.55, 0.66, 0.85) * (0.32 + uFlash * 2.2), ring * (1.0 - vPh) * (1.0 - vPh) * vOn);
      }`
  });
  const m = new THREE.Points(g, mat);
  m.frustumCulled = false; m.visible = false; m.renderOrder = 0;
  sanctuaryGroup.add(m);
  return m;
})();

// --- the fire going out, and coming back in the Witness's colour ---
const FIRE_OUT = { from: 0, to: 0, t0: 0, secs: 0, now: 0, tealUntil: 0, tealOn: false };
function fireOutAt(now) {
  if (FIRE_OUT.secs <= 0) return FIRE_OUT.to;
  const u = Math.max(0, Math.min(1, (now - FIRE_OUT.t0) / 1000 / FIRE_OUT.secs));
  return FIRE_OUT.from + (FIRE_OUT.to - FIRE_OUT.from) * u * u * (3 - 2 * u);
}
function fireOutSet(v, secs) {
  const now = performance.now();
  FIRE_OUT.from = fireOutAt(now); FIRE_OUT.to = Math.max(0, Math.min(1, +v || 0)); FIRE_OUT.t0 = now; FIRE_OUT.secs = typeof secs === 'number' ? Math.max(0, secs) : 1;
}
function tickFireOut(now) {
  FIRE_OUT.now = fireOutAt(now);
  if (FIRE_OUT.tealUntil) {
    if (now < FIRE_OUT.tealUntil) { fireSpiritTarget = 1; if (!FIRE_OUT.tealOn) { fireSpiritCur = 1; FIRE_OUT.tealOn = true; } }
    else { fireSpiritTarget = MOODS[moodIdx].spirit ? 1 : 0; FIRE_OUT.tealUntil = 0; FIRE_OUT.tealOn = false; }
  }
}
// 14 sets the flames, the fire's light and its glows in step 6 and then calls tickStoryScene; scaling them here, after
// that and before the frame is drawn, takes the fire all the way down (the `fire` cue alone cannot go below a low flame).
const _stTickStoryScene = tickStoryScene;
tickStoryScene = function (dt, t) {
  _stTickStoryScene(dt, t);
  const o = FIRE_OUT.now;
  if (o <= 0) return;
  const k = 1 - o;
  flameMeshes.forEach((f) => f.mesh.scale.multiplyScalar(Math.max(0.001, k)));
  fireLight.intensity *= k; hearthGlow.material.opacity *= k; fireHalo.material.opacity *= k; firePool.material.opacity *= k;
  bladeFX.uFireK.value *= k; georgeMakerShader.uniforms.uFireK.value *= 1 - 0.8 * o;
};
// George shields the fire: both hands low over it, palms down, fingers a little cupped (Hips space cm, like 14's GESTURES)
GESTURES.shield = { L: { at: [12, 9, 66], pole: [30, -6, -4], rot: [-0.2, 0, 0.2], curl: 0.3 }, R: { at: [12, 9, 66], pole: [30, -6, -4], rot: [-0.2, 0, 0.2], curl: 0.3 } };

// --- per frame, before the loop draws ---
let stormFireAmp = 0, stormLean = 0;
function stormPre() {
  const now = performance.now();
  const dt = STORM.lastNow === null ? 0 : Math.max(0, Math.min(0.1, (now - STORM.lastNow) / 1000));
  STORM.lastNow = now; STORM.t += dt;
  const E = STORM.level = stormLevelAt(now);
  tickFireOut(now);

  if (STORM.auto && E > 0.55 && now > STORM.nextAuto) { stormFlash(0.7 + Math.random() * 0.6, { bolt: Math.random() < 0.7 }); STORM.nextAuto = now + 2500 + Math.random() * 5000; }
  if (STORM.pending) { // the camera is where the last frame left it, so a bolt cued on a cut lands in the new shot
    const p = STORM.pending; STORM.pending = null;
    if (p.bolt) buildBolt(p); else stormFlashDir.set(Math.sin(p.seed), 0.9, Math.cos(p.seed * 1.7)).normalize();
    STORM.flash = { t0: now, k: p.k, bolt: p.bolt };
    if (take && take.offline) STORM.log.push({ t: +((now - take.startedAt) / 1000 - 1 / 30).toFixed(2), k: p.k, bolt: p.bolt }); // for the soundtrack (score_storm.py)
  }
  let F = 0, core = 0;
  if (STORM.flash) {
    const ft = (now - STORM.flash.t0) / 1000;
    if (ft > 1.6) STORM.flash = null;
    else { F = flashShape(ft, false) * STORM.flash.k; core = STORM.flash.bolt ? flashShape(ft, true) * STORM.flash.k : 0; }
  }
  boltMesh.visible = core > 0.03; boltMat.uniforms.uK.value = core * 5.5;

  if (E <= 0 && F <= 0 && !STORM.applied) { stormFireAmp = 0; stormLean = 0; return; }
  const m = MOODS[moodIdx];
  // slow irregular gusts, 0..1: the fire gutters and the flames whip on them
  const n1 = 0.5 + 0.5 * Math.sin(STORM.t * 2.3) * Math.sin(STORM.t * 0.83 + 1.3), n2 = 0.5 + 0.5 * Math.sin(STORM.t * 5.1 + 0.7) * Math.sin(STORM.t * 1.9);
  galeU.value = E * (0.82 + 0.18 * n1);
  skyUniforms.uStorm.value = E; skyUniforms.uFlash.value = F; skyUniforms.uFlashDir.value.copy(stormFlashDir);

  moonLight.intensity = m.sunInt * (1 - STORM_FX.sun * E);
  hemiLight.intensity = m.hemiInt * (1 - STORM_FX.hemi * E) + F * 0.6;
  stormFlashLight.position.copy(stormFlashDir).multiplyScalar(30); stormFlashLight.intensity = F * 2.4;

  _stFogBase.setHex(m.fog); if (natureOn) _stFogBase.convertSRGBToLinear();
  scene.fog.color.copy(_stFogBase).lerp(_stFogDark, STORM_FX.fogDark * E);
  scene.fog.color.r += F * 0.10; scene.fog.color.g += F * 0.12; scene.fog.color.b += F * 0.17;
  scene.fog.density = m.fogD * (1 + STORM_FX.fog * E) * (1 + (typeof NUMB_FX !== 'undefined' ? NUMB_FX.fog * numbE : 0));
  compositeMat.uniforms.uExposure.value = moodExposure * exposureTrim * (1 - STORM_FX.exposure * E + 0.32 * F) * (1 - 0.28 * FIRE_OUT.now * E) // a dead fire in a storm: the whole frame sinks;

  // The two far treeline rings are unlit (applyMood gives them the mood's haze colour), so they are darkened here.
  if (typeof treelineMats !== 'undefined') {
    if (!STORM.applied || STORM.tlMood !== moodIdx) { STORM.tlBase = treelineMats.map((tm) => tm.color.clone()); STORM.tlMood = moodIdx; }
    treelineMats.forEach((tm, k) => { tm.color.copy(STORM.tlBase[k]).lerp(_stFogDark, 0.86 * Math.min(1, E * 1.2)); tm.color.r += F * 0.05; tm.color.g += F * 0.06; tm.color.b += F * 0.09; });
  }

  // George's cel shader has its own light uniforms (it does not read the scene lights)
  const gu = georgeMakerShader.uniforms;
  _stSun.setHex(m.sunCol).convertSRGBToLinear().multiplyScalar(m.gSun * (1 - 0.8 * E));
  gu.uSunCol.value.copy(_stSun); gu.uSunCol.value.r += _stFlashCol.r * F * 1.0; gu.uSunCol.value.g += _stFlashCol.g * F * 1.0; gu.uSunCol.value.b += _stFlashCol.b * F * 1.0;
  gu.uAmbCol.value.set(m.amb[0], m.amb[1], m.amb[2]).multiplyScalar(1 - 0.45 * E).addScalar(F * 0.16);
  _stSunDir.set(m.sun[0], m.sun[1], m.sun[2]).normalize();
  gu.uSunDir.value.copy(F > 0.04 ? stormFlashDir : _stSunDir);

  if (typeof flowers !== 'undefined') flowers.material.color.setScalar(1 - 0.92 * E); // the wildflowers stop glowing under the overcast
  waterUniforms.uSunCol.value.setHex(m.sunCol).multiplyScalar(1 - 0.88 * E); // no sun glitter on the pond under the overcast
  flyMat.opacity = m.flies * (typeof STUDIO !== 'undefined' && STUDIO.scene ? STUDIO.scene.flies : 1) * Math.max(0, 1 - 1.6 * E);

  // rain starts once the overcast is well in; leaves fly as soon as the wind is up
  const rain = Math.max(0, Math.min(1, (E - 0.3) / 0.45));
  rainU.uT.value += dt;
  rainU.uAmt.value = rain; rainU.uFlash.value = F; rainU.uFireK.value = 0.55 * fireLight.intensity / Math.max(0.5, fireBase);
  rainU.uVel.value.set(-5.5 * (0.5 + 0.5 * E), -15, 3.5 * (0.5 + 0.5 * E));
  leafU.uAmt.value = Math.min(1, E * 1.3); leafU.uFlash.value = F * 0.25; leafU.uFireK.value = rainU.uFireK.value * 0.5;
  stormFireC.value.copy(fireLight.color);
  rainMesh.visible = rain > 0.01; leafMesh.visible = E > 0.05;
  pondRain.visible = rain > 0.01; pondRainU.uAmt.value = rain; pondRainU.uFlash.value = F;
  pondRainU.uScale.value = renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360));

  stormFireAmp = -E * (STORM_FX.fire + STORM_FX.fireGutter * n2);
  stormLean = E * (STORM_FX.lean + 0.45 * n1);
  STORM.applied = E > 0 || F > 0; // one more pass at zero puts every value back on its mood base
}

// ---- hooks into the loop (classic scripts share globals, and the loop calls these by name each frame) ----
const _stFireSwellNow = fireSwellNow;
fireSwellNow = function () { // 14 step 6 reads this for the fire's light, flame size and lean
  const v = _stFireSwellNow();
  if (stormLean > 0) fireLeanNow = Math.min(1.15, fireLeanNow + stormLean);
  return Math.max(-0.66, v + stormFireAmp);
};
const _stRunCue = runCue;
runCue = function (c) {
  _stRunCue(c);
  if (typeof c.storm === 'number') { STORM.auto = false; stormSet(c.storm, c.stormSecs); }
  if (c.flash) stormFlash(c.flash === true ? 1 : c.flash, c);
  if (typeof c.fireOut === 'number') fireOutSet(c.fireOut, c.fireOutSecs);
  if (c.fireTeal > 0) FIRE_OUT.tealUntil = performance.now() + c.fireTeal * 1000;
};
const _stAnimate = animate;
animate = function () { stormPre(); _stAnimate(); };

// ---- 20B. MOMENT LOADER -------------------------------------------------------
// A moment is a beats file like an episode script, but with no words: episodes/moments/<name>.json = { title, hook?,
// scene?, beats }. Loading one swaps the current episode's beats, hook and scene in memory only; nothing is written to
// episodes/scripts/ (saveScript is switched off until an episode is loaded again).
let momentNow = null;
function unloadMoment() {
  if (!momentNow) return;
  const ep = EPISODES[momentNow.epIdx];
  ep.hook = momentNow.hook; ep.scene = momentNow.scene;
  saveScript = momentNow.saveScript;
  momentNow = null; CARDS.length = 0; washSet(0, 0); nskyReset();
  STORM.auto = false; stormSet(0, 0); fireOutSet(0, 0);
  if (typeof syncWeatherMenu === 'function') syncWeatherMenu();
}
async function loadMoment(name) {
  const r = await fetch(`episodes/moments/${name}.json?${Date.now()}`);
  if (!r.ok) return { error: `episodes/moments/${name}.json: ${r.status}` };
  const m = await r.json();
  unloadMoment(); CARDS.length = 0; nskyReset();
  const ep = EPISODES[curEpisodeIdx];
  momentNow = { name, epIdx: curEpisodeIdx, hook: ep.hook, scene: ep.scene, saveScript };
  saveScript = function () {};
  ep.hook = m.hook || ''; ep.scene = m.scene || {};
  beats = m.beats.map((b) => ({ ...b }));
  loadStoryScene(ep);
  applyBeat(0);
  return { moment: name, beats: beats.length, secs: +beats.reduce((s, b) => s + (b.hold || 0), 0).toFixed(1) };
}
const _stLoadEpisode = loadEpisode;
loadEpisode = function (i) { unloadMoment(); return _stLoadEpisode(i); };

// ---- 20C. WEATHER IN THE DOCK ---------------------------------------------------
// Explore mode's dock gets a Weather menu next to Characters, and T strikes lightning once. Built here, not in studio.html.
const WEATHER = { clear: { label: 'Weather: clear', level: 0 }, wind: { label: 'Windy', level: 0.3 }, rain: { label: 'Rain', level: 0.62 }, storm: { label: 'Storm', level: 1, auto: true } };
let weatherNow = 'clear';
function setWeather(name, secs) {
  const w = WEATHER[name] || WEATHER.clear;
  weatherNow = WEATHER[name] ? name : 'clear';
  STORM.auto = !!w.auto; STORM.nextAuto = performance.now() + 2200;
  stormSet(w.level, secs === undefined ? 4 : secs);
  syncWeatherMenu();
  return { weather: weatherNow, level: w.level };
}
function syncWeatherMenu() { const sel = document.getElementById('xd-weather'); if (sel) sel.value = STORM.to > 0 || STORM.auto ? weatherNow : 'clear'; }
(function buildWeatherMenu() {
  const after = document.getElementById('xd-part');
  if (!after) return;
  const sel = document.createElement('select');
  sel.className = 'mini'; sel.id = 'xd-weather'; sel.title = 'Weather: wind, rain or a full storm (T strikes lightning)';
  sel.innerHTML = Object.keys(WEATHER).map((k) => `<option value="${k}">${WEATHER[k].label}</option>`).join('');
  sel.onchange = () => { setWeather(sel.value); sel.blur(); };
  after.insertAdjacentElement('afterend', sel);
})();
window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || uiMode !== 'explore') return;
  const tag = (e.target && e.target.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable)) return;
  if (e.key === 't' || e.key === 'T') stormFlash(1, { seed: Math.floor(performance.now()) });
});

// ---- 20D. CARDS -------------------------------------------------------------
// On-screen words for a moment that teaches something, drawn over every frame like the captions (live and in a take).
// Cue: { card: "text", cardKind: "count" | "fact" | "say", cardSecs: 1, cardDelay: 0, cardSub: "small second line" }.
//   count = one huge number that pops · fact = a big title (no fade-in, so it can be the hook on frame 1)
//   say   = a line from the Witness with the name tag, no voice
// cardDelay is in seconds from the cue, so a count can be tied to a lightning strike exactly (flash, then 1 s, 2 s, 3 s).
// Cards run on the clock, not the beat: one can stay up across a cut.
const CARDS = [];
// Cue { wash: 0..1, washSecs: 0.3, washCol: "#e8e8e4" }: a flat pale screen over the picture and under the cards (the
// ground an afterimage shows on, see stare_fire_15s.json). cardKind "hold" = a fact title with a bar that drains over cardSecs.
const WASH = { from: 0, to: 0, t0: 0, secs: 0, col: '#e8e8e4' };
function washAt(now) {
  if (WASH.secs <= 0) return WASH.to;
  const u = Math.max(0, Math.min(1, (now - WASH.t0) / 1000 / WASH.secs));
  return WASH.from + (WASH.to - WASH.from) * u;
}
function washSet(v, secs, col) {
  const now = performance.now();
  WASH.from = washAt(now); WASH.to = Math.max(0, Math.min(1, +v || 0)); WASH.t0 = now; WASH.secs = typeof secs === 'number' ? Math.max(0, secs) : 0.3;
  if (col) WASH.col = col;
}
function cardAdd(c) {
  CARDS.push({ text: String(c.card), kind: c.cardKind || 'fact', sub: c.cardSub || '', secs: typeof c.cardSecs === 'number' ? c.cardSecs : 2,
    t0: performance.now() + (c.cardDelay || 0) * 1000, y: c.cardY });
}
function cardText(ctx, s, x, y, fs, fill) {
  ctx.lineJoin = 'round'; ctx.lineWidth = fs * 0.2; ctx.strokeStyle = 'rgba(2, 4, 10, 0.85)';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)'; ctx.shadowBlur = fs * 0.4; ctx.strokeText(s, x, y);
  ctx.shadowBlur = 0; ctx.fillStyle = fill; ctx.fillText(s, x, y);
}
function drawCards(ctx, W, H) {
  const now = performance.now(), vertical = H > W, m = Math.min(W, H);
  const wa = washAt(now);
  if (wa > 0.002) { ctx.save(); ctx.globalAlpha = wa; ctx.fillStyle = WASH.col; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  for (let i = CARDS.length - 1; i >= 0; i--) {
    const c = CARDS[i], t = (now - c.t0) / 1000;
    if (t > c.secs || t < -30) { CARDS.splice(i, 1); continue; } // t < -30: left over from another clock (a take's virtual one)
    if (t < 0) continue;
    const out = Math.min(1, (c.secs - t) / 0.2);
    ctx.save();
    ctx.textAlign = 'center';
    if (c.kind === 'count') {
      const pop = Math.max(0, 1 - t / 0.14), fs = Math.round(m * 0.30);
      ctx.globalAlpha = out; ctx.font = `900 ${fs}px ${CAP_FONT}`; ctx.textBaseline = 'middle';
      ctx.translate(W / 2, H * (typeof c.y === 'number' ? c.y : vertical ? 0.3 : 0.4)); ctx.scale(1 + 0.4 * pop * pop, 1 + 0.4 * pop * pop);
      cardText(ctx, c.text, 0, 0, fs, '#ffffff');
    } else if (c.kind === 'say') {
      const fs = Math.round(m * (vertical ? 0.056 : 0.042)), words = c.text.split(/\s+/);
      ctx.globalAlpha = Math.min(1, t / 0.12) * out; ctx.font = `800 ${fs}px ${CAP_FONT}`;
      const lines = wrapWords(ctx, words, W * 0.84).slice(0, 3), y0 = H * (typeof c.y === 'number' ? c.y : vertical ? 0.7 : 0.8);
      lines.forEach((ln, k) => cardText(ctx, ln.map((j) => words[j]).join(' '), W / 2, y0 + k * fs * 1.16, fs, '#ffffff'));
      ctx.font = `800 ${Math.round(fs * 0.5)}px ${CAP_FONT}`;
      cardText(ctx, SPEAKER_STYLE.SPIRIT.name, W / 2, y0 - fs * 1.15, fs * 0.5, SPEAKER_STYLE.SPIRIT.accent);
    } else {
      const fs = Math.round(m * (vertical ? 0.082 : 0.062)), words = c.text.split(/\s+/);
      ctx.globalAlpha = out; ctx.font = `900 ${fs}px ${CAP_FONT}`;
      const lines = wrapWords(ctx, words, W * 0.84).slice(0, 3), lh = fs * 1.12, y0 = H * (typeof c.y === 'number' ? c.y : vertical ? 0.2 : 0.18);
      lines.forEach((ln, k) => cardText(ctx, ln.map((j) => words[j]).join(' '), W / 2, y0 + k * lh, fs, '#ffffff'));
      const yb = y0 + (lines.length - 1) * lh + fs * 0.42, bw = c.kind === 'hold' ? W * 0.6 * Math.max(0, 1 - t / c.secs) : W * 0.18 * Math.min(1, t / 0.6);
      ctx.fillStyle = '#fbbf24'; ctx.fillRect(W / 2 - bw / 2, yb, bw, Math.max(3, fs * 0.08));
      if (c.sub) { const fs2 = Math.round(fs * 0.46); ctx.font = `700 ${fs2}px ${CAP_FONT}`; ctx.globalAlpha = out * Math.min(1, Math.max(0, (t - 0.5) / 0.3)); cardText(ctx, c.sub, W / 2, yb + fs * 0.95, fs2, '#ffffff'); }
    }
    ctx.restore();
  }
}
const _stOverlay = drawReelOverlay;
drawReelOverlay = function (ctx, W, H) { _stOverlay(ctx, W, H); drawCards(ctx, W, H); };
const _stRunCue2 = runCue;
runCue = function (c) { _stRunCue2(c); if (c.card !== undefined && c.card !== '') cardAdd(c); if (typeof c.wash === 'number') washSet(c.wash, c.washSecs, c.washCol); };

if (window.IW) {
  IW.weather = (name, secs) => setWeather(name, secs);                  // 'clear' | 'wind' | 'rain' | 'storm'
  IW.fireOut = (v, secs) => { fireOutSet(v === undefined ? 1 : v, secs); return { fireOut: FIRE_OUT.to }; };
  IW.storm = (level, secs) => { const l = level === undefined ? 1 : +level; STORM.auto = l > 0; STORM.nextAuto = performance.now() + 2500; stormSet(l, secs === undefined ? 4 : secs); return { storm: l }; };
  IW.stormLog = (clear) => { const l = STORM.log.slice(); if (clear) STORM.log.length = 0; return l; }; // lightning times of the last offline take(s)
  IW.flash = (k, o) => { stormFlash(k || 1, o); return { flash: k || 1 }; };
  IW.stormState = () => ({ level: +STORM.level.toFixed(3), to: STORM.to, auto: STORM.auto, flash: !!STORM.flash, rain: +rainU.uAmt.value.toFixed(2), gale: +galeU.value.toFixed(2), fire: +stormFireAmp.toFixed(2) });
  IW.wash = (v, secs, col) => { washSet(v === undefined ? 1 : v, secs, col); return { wash: WASH.to }; };
  IW.moment = (name) => (name ? loadMoment(name) : (unloadMoment(), { moment: null }));
}

// ---- 20E. THE NORTH SKY ------------------------------------------------------
// A real night sky for "Find north" (episodes/moments/find_north_15s.json): stars placed by right ascension and
// declination and turned into this meadow's sky for latitude NSKY.lat at sidereal time NSKY.lst, with north (azimuth 0)
// along NSKY.north in the scene. The Big Dipper, Polaris, the Little Dipper and Cassiopeia are real positions (J2000);
// the rest are random faint stars. The stylised star field (11) fades out while this one is up.
// Cue { sky: { amt, dip, ptr, line, pol, drop, spin }, skySecs }: each key tweens to its value over skySecs.
//   amt  0..1  the sky fades in              dip  0..1  the Dipper's outline draws itself and its stars brighten
//   ptr  0..1  the two pointer stars go amber   line 0..5.34  the pointer line, in pointer-gaps (5.34 reaches Polaris)
//   pol  0..1  Polaris flares and is named    drop 0..1  a line falls from Polaris to the horizon, "N" lands there
//   spin       sidereal hours per second (a time-lapse: the sky wheels round Polaris, which stays put)
// Beat fields: `aim: { from, to, up }` points the camera at named sky spots (dipper, pointers, polaris, north,
// mid) and pans from one to the other over the beat (up = degrees added to the aim's altitude); `fov` widens the lens
// for that beat. The camera position still comes from the beat's pin (`pin.v.p`).
const NSKY = { lat: 45, lst0: 20, lst: 20, north: new THREE.Vector3(0, 0, 1), R: 80 };
const NSKY_NAMED = [ // name, RA hours, Dec degrees, magnitude, kind (1 Dipper, 2 pointer, 3 Polaris, 0 other)
  ['Dubhe', 11.062, 61.751, 1.8, 2], ['Merak', 11.031, 56.382, 2.4, 2], ['Phecda', 11.897, 53.695, 2.4, 1],
  ['Megrez', 12.257, 57.033, 3.3, 1], ['Alioth', 12.900, 55.960, 1.8, 1], ['Mizar', 13.399, 54.925, 2.2, 1],
  ['Alkaid', 13.792, 49.313, 1.9, 1], ['Polaris', 2.530, 89.264, 2.0, 3],
  ['Kochab', 14.845, 74.155, 2.1, 0], ['Pherkad', 15.345, 71.834, 3.0, 0], ['ZetaUMi', 15.734, 77.794, 4.3, 0],
  ['EtaUMi', 16.292, 75.755, 4.9, 0], ['EpsUMi', 16.766, 82.037, 4.2, 0], ['Yildun', 17.537, 86.586, 4.4, 0],
  ['Caph', 0.153, 59.15, 2.3, 0], ['Schedar', 0.675, 56.54, 2.2, 0], ['GammaCas', 0.945, 60.72, 2.4, 0],
  ['Ruchbah', 1.430, 60.24, 2.7, 0], ['Segin', 1.907, 63.67, 3.4, 0],
  ['Capella', 5.278, 45.998, 0.1, 0], ['Vega', 18.616, 38.784, 0.0, 0], ['Deneb', 20.690, 45.280, 1.3, 0],
  ['Thuban', 14.073, 64.376, 3.7, 0], ['Muscida', 8.504, 60.718, 3.4, 0], ['Talitha', 8.987, 48.04, 3.1, 0],
  ['ThetaUMa', 9.525, 51.68, 3.2, 0]
];
const NSKY_IDX = {}; NSKY_NAMED.forEach((s, i) => { NSKY_IDX[s[0]] = i; });
const NSKY_DIPPER = [['Dubhe', 'Merak'], ['Merak', 'Phecda'], ['Phecda', 'Megrez'], ['Megrez', 'Dubhe'], ['Megrez', 'Alioth'], ['Alioth', 'Mizar'], ['Mizar', 'Alkaid']];
const nskyStars = (function () {
  const rnd = stormRand(424242), n = 1400, list = NSKY_NAMED.map((s) => ({ ra: s[1], dec: s[2], mag: s[3], kind: s[4] }));
  for (let i = 0; i < n; i++) {
    const ra = rnd() * 24, dec = Math.asin(rnd() * 2 - 1) * 180 / Math.PI;
    list.push({ ra, dec, mag: 3.6 + 2.6 * Math.sqrt(rnd()), kind: 0, tw: rnd() });
  }
  return list;
})();
// Alt/az (degrees, azimuth from north towards east) for a star at the current sidereal time.
function nskyAltAz(ra, dec, lst) {
  const H = (lst - ra) * 15 * Math.PI / 180, d = dec * Math.PI / 180, p = NSKY.lat * Math.PI / 180;
  const alt = Math.asin(Math.sin(d) * Math.sin(p) + Math.cos(d) * Math.cos(p) * Math.cos(H));
  const az = Math.atan2(-Math.sin(H) * Math.cos(d), Math.sin(d) * Math.cos(p) - Math.cos(d) * Math.sin(p) * Math.cos(H));
  return [alt, az];
}
const _nsE = new THREE.Vector3(), _nsUp = new THREE.Vector3(0, 1, 0);
function nskyDirAltAz(alt, az, out) { // scene direction for alt/az in radians
  _nsE.crossVectors(NSKY.north, _nsUp).normalize();
  const c = Math.cos(alt);
  return (out || new THREE.Vector3()).copy(NSKY.north).multiplyScalar(c * Math.cos(az)).addScaledVector(_nsE, c * Math.sin(az)).addScaledVector(_nsUp, Math.sin(alt)).normalize();
}
function nskyDir(name, out) { const s = NSKY_NAMED[NSKY_IDX[name]], aa = nskyAltAz(s[1], s[2], NSKY.lst); return nskyDirAltAz(aa[0], aa[1], out); }
const nskyMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending,
  uniforms: {
    uLst: { value: NSKY.lst }, uLat: { value: NSKY.lat * Math.PI / 180 }, uNorth: { value: NSKY.north }, uEast: { value: new THREE.Vector3(-1, 0, 0) },
    uR: { value: NSKY.R }, uPx: { value: 1 }, uAmt: { value: 0 }, uDip: { value: 0 }, uPtr: { value: 0 }, uPol: { value: 0 }, uTime: { value: 0 }, uTwk: { value: 0 }
  },
  vertexShader: `
    attribute vec4 aStar; // ra (hours), dec (deg), magnitude, kind
    attribute float aTw;
    uniform float uLst, uLat, uR, uPx, uAmt, uDip, uPtr, uPol, uTime, uTwk; // uTwk: 20G's strong twinkle (0 = the gentle one)
    uniform vec3 uNorth, uEast;
    varying vec3 vCol; varying float vI;
    void main() {
      float H = (uLst - aStar.x) * 0.2617994, d = radians(aStar.y);
      float alt = asin(sin(d) * sin(uLat) + cos(d) * cos(uLat) * cos(H));
      float az = atan(-sin(H) * cos(d), sin(d) * cos(uLat) - cos(d) * sin(uLat) * cos(H));
      vec3 dir = cos(alt) * (cos(az) * uNorth + sin(az) * uEast) + vec3(0.0, sin(alt), 0.0);
      gl_Position = projectionMatrix * viewMatrix * vec4(cameraPosition + dir * uR, 1.0);
      float k = aStar.w;
      float b = pow(10.0, -0.4 * (aStar.z - 2.0));
      float dip = step(0.5, k) * step(k, 2.5) * uDip, ptr = step(1.5, k) * step(k, 2.5) * uPtr, pol = step(2.5, k) * step(k, 3.5) * uPol;
      float tw = 0.82 + 0.18 * sin(uTime * (2.0 + aTw * 3.0) + aTw * 40.0);
      float low = 1.0 - smoothstep(0.08, 1.2, alt), fast = sin(uTime * (19.0 + aTw * 11.0) + aTw * 91.0) * sin(uTime * (7.0 + aTw * 5.0) + aTw * 17.0);
      float sc = uTwk * (0.3 + 0.7 * low) * fast * (1.0 - step(3.5, k)); // scintillation: quick, strongest low down; kind 4 = a planet (20G), a tiny disc, steady
      tw = mix(tw, 1.0, step(3.5, k)) * (1.0 + 0.9 * sc);
      gl_PointSize = uPx * (3.0 + 10.0 * sqrt(b)) * (1.0 + 0.45 * dip + 0.7 * ptr + 1.6 * pol) * (1.0 + 0.5 * sc);
      vI = uAmt * 3.2 * clamp(0.30 + 0.95 * b, 0.0, 2.0) * tw * (1.0 + 0.8 * dip + 1.2 * ptr + 2.2 * pol) * smoothstep(-0.01, 0.06, alt);
      vCol = mix(vec3(0.80, 0.87, 1.0), vec3(1.0, 0.72, 0.30), ptr);
      vCol = mix(vCol, vec3(1.0, 0.93, 0.70), pol);
      vCol *= vec3(1.0 + 0.3 * sc, 1.0, 1.0 - 0.3 * sc); // low stars flash colours as they twinkle
    }`,
  fragmentShader: `
    varying vec3 vCol; varying float vI;
    void main() {
      vec2 q = gl_PointCoord - 0.5; float r2 = dot(q, q) * 4.0;
      float a = exp(-r2 * 14.0) + 0.22 * exp(-r2 * 3.5);
      gl_FragColor = vec4(vCol * a * vI, 1.0);
    }`
});
const nskyPoints = (function () {
  const g = new THREE.BufferGeometry(), n = nskyStars.length;
  const st = new Float32Array(n * 4), tw = new Float32Array(n), pos = new Float32Array(n * 3);
  nskyStars.forEach((s, i) => { st.set([s.ra, s.dec, s.mag, s.kind], i * 4); tw[i] = s.tw === undefined ? (i * 0.137) % 1 : s.tw; });
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aStar', new THREE.BufferAttribute(st, 4)); g.setAttribute('aTw', new THREE.BufferAttribute(tw, 1));
  const p = new THREE.Points(g, nskyMat);
  p.frustumCulled = false; p.renderOrder = -5; p.visible = false;
  scene.add(p);
  return p;
})();
const NS = {}; // key -> { from, to, t0, secs }
const NS_KEYS = ['amt', 'dip', 'ptr', 'line', 'pol', 'drop', 'spin'];
function nsAt(k, now) {
  const e = NS[k]; if (!e) return 0;
  if (e.secs <= 0) return e.to;
  const u = Math.max(0, Math.min(1, (now - e.t0) / 1000 / e.secs)), s = u * u * (3 - 2 * u);
  return e.from + (e.to - e.from) * s;
}
function nsSet(vals, secs) {
  const now = performance.now();
  for (const k of NS_KEYS) if (typeof vals[k] === 'number') NS[k] = { from: nsAt(k, now), to: vals[k], t0: now, secs: typeof secs === 'number' ? secs : 0.6 };
}
function nskyReset() { for (const k of NS_KEYS) delete NS[k]; NSKY.lst = NSKY.lst0; nskyPoints.visible = false; nskyMat.uniforms.uAmt.value = 0; starField.material.opacity = 0.9; skyUniforms.uClouds.value = 1; nskyLastNow = 0;
  if (NSKY.ctl) { controls.maxPolarAngle = NSKY.ctl.max; controls.maxDistance = NSKY.ctl.maxD; NSKY.ctl = null; }
  if (NSKY.swarm !== undefined) { sceneOpts.swarm = NSKY.swarm[0]; sceneOpts.stream = NSKY.swarm[1]; delete NSKY.swarm; }
  starField.visible = !!(MOODS[moodIdx] && MOODS[moodIdx].stars);
}
// Named aim points for `aim` (directions in the scene, at the current sidereal time).
const _nsA = new THREE.Vector3(), _nsB = new THREE.Vector3();
function nskyAimDir(name, out) {
  if (name === 'dipper') { out.set(0, 0, 0); for (const s of ['Dubhe', 'Merak', 'Phecda', 'Megrez', 'Alioth', 'Mizar', 'Alkaid']) out.add(nskyDir(s, _nsA)); return out.normalize(); }
  if (name === 'pointers') return out.copy(nskyDir('Dubhe', _nsA)).add(nskyDir('Merak', _nsB)).normalize();
  if (name === 'polaris') return nskyDir('Polaris', out);
  if (name === 'mid') return out.copy(nskyDir('Dubhe', _nsA)).add(nskyDir('Polaris', _nsB)).normalize();
  if (name === 'north') return nskyDirAltAz(8 * Math.PI / 180, 0, out);
  return nskyDir(name, out);
}
function nskyAimTarget(aim, u, out, from) {
  const a = nskyAimDir(aim.from, new THREE.Vector3()), b = nskyAimDir(aim.to || aim.from, new THREE.Vector3());
  const e = u * u * (3 - 2 * u);
  out.copy(a).lerp(b, e).normalize();
  if (aim.up) { const alt = Math.asin(out.y) + aim.up * Math.PI / 180, h = Math.hypot(out.x, out.z) || 1; out.set(out.x / h * Math.cos(alt), Math.sin(alt), out.z / h * Math.cos(alt)); }
  return out.multiplyScalar(aim.focus || 40).add(from || desiredCamPos); // far look-at point: depth of field focuses on the sky
}
function nskyLensFov() { return THREE.MathUtils.radToDeg(2 * Math.atan(12 / STUDIO.cam.lens)); }
let nskyLastNow = 0;
function nskyPre() {
  const now = performance.now(), dt = nskyLastNow ? Math.min(0.1, (now - nskyLastNow) / 1000) : 0;
  nskyLastNow = now;
  const amt = nsAt('amt', now);
  NSKY.lst += nsAt('spin', now) * dt;
  nskyPoints.visible = amt > 0.002;
  const u = nskyMat.uniforms;
  u.uAmt.value = amt; u.uDip.value = nsAt('dip', now); u.uPtr.value = nsAt('ptr', now); u.uPol.value = nsAt('pol', now);
  u.uLst.value = NSKY.lst; u.uTime.value = now / 1000; u.uEast.value.crossVectors(NSKY.north, _nsUp).normalize();
  u.uPx.value = renderer.domElement.height / 1080;
  starField.material.opacity = 0.9 * (1 - Math.min(1, amt * 1.5));
  if (amt > 0.002 && NSKY.swarm === undefined) { NSKY.swarm = [sceneOpts.swarm, sceneOpts.stream]; sceneOpts.swarm = false; sceneOpts.stream = false; } // the thought swarm and the gold-cyan stream hide under the star sky
  starField.visible = starField.visible && amt < 0.66;
  skyUniforms.uClouds.value = 1 - 0.9 * Math.min(1, amt * 1.5); // a clear night for the stars
  // per-beat lens and sky aim (moments only)
  const b = momentNow && beats[curBeatIdx];
  const fov = (b && b.fov) || nskyLensFov();
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  // the orbit controls keep the camera from looking up (max polar angle ~89 deg, distance 18): loosen them for sky beats
  const aiming = !!(b && b.aim); // not gated on the sky being up: on a sky beat's first frame its `amt` cue has not fired yet, and restoring the limit then swung the camera level with its target
  if (aiming && !NSKY.ctl) { NSKY.ctl = { max: controls.maxPolarAngle, maxD: controls.maxDistance }; controls.maxPolarAngle = Math.PI * 0.97; controls.maxDistance = 200; }
  if (!aiming && NSKY.ctl) { controls.maxPolarAngle = NSKY.ctl.max; controls.maxDistance = NSKY.ctl.maxD; NSKY.ctl = null; }
  if (aiming) {
    const hold = Math.max(0.1, b.hold || beatDuration());
    nskyAimTarget(b.aim, Math.min(1, beatTimer / hold), desiredCamTarget, camera.position);
    controls.target.copy(desiredCamTarget);
  }
}
const _nsAnimate = animate;
animate = function () { nskyPre(); _nsAnimate(); };
const _nsResolve = resolveShotForBeat;
resolveShotForBeat = function (beat) {
  const r = _nsResolve.apply(this, arguments);
  if (momentNow && beat && beat.aim) { // a sky beat
    if (!NSKY.ctl) { NSKY.ctl = { max: controls.maxPolarAngle, maxD: controls.maxDistance }; controls.maxPolarAngle = Math.PI * 0.97; controls.maxDistance = 200; } // a sky beat is always a hard cut, so the aim is exact from its first frame
    camera.position.copy(desiredCamPos); camTransitionTime = 0; camFocus.snap = true;
    nskyAimTarget(beat.aim, 0, desiredCamTarget); controls.target.copy(desiredCamTarget);
  }
  return r;
};
// --- the teaching layer, drawn over the picture with the cards: outline, pointer line with its count, names, N ---
const _nsP = new THREE.Vector3();
function nskyScreen(dir, W, H) {
  _nsP.copy(dir).multiplyScalar(NSKY.R).add(camera.position).project(camera);
  if (_nsP.z > 1 || _nsP.z < -1) return null;
  return [(_nsP.x + 1) / 2 * W, (1 - _nsP.y) / 2 * H];
}
function nskyLabel(ctx, s, x, y, fs, fill) { ctx.font = `800 ${fs}px ${CAP_FONT}`; cardText(ctx, s, x, y, fs, fill); }
function drawNorthSky(ctx, W, H) {
  const now = performance.now(), amt = nsAt('amt', now);
  if (amt < 0.01) return;
  const m = Math.min(W, H), lw = Math.max(2, m * 0.0055), dip = nsAt('dip', now), ptr = nsAt('ptr', now), line = nsAt('line', now), pol = nsAt('pol', now), drop = nsAt('drop', now);
  const P = (name) => nskyScreen(nskyDir(name, _nsA), W, H);
  ctx.save(); ctx.lineCap = 'round'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const glowLine = (pts, col, w, a) => {
    ctx.globalAlpha = a; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.shadowColor = col; ctx.shadowBlur = w * 3;
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke(); ctx.shadowBlur = 0;
  };
  if (dip > 0.005) { // the Dipper draws itself segment by segment
    const segs = NSKY_DIPPER.map(([a, b]) => [P(a), P(b)]).filter((s) => s[0] && s[1]);
    const lens = segs.map((s) => Math.hypot(s[1][0] - s[0][0], s[1][1] - s[0][1])), tot = lens.reduce((x, y) => x + y, 0);
    let left = tot * Math.min(1, dip);
    segs.forEach((s, i) => {
      if (left <= 0) return; const f = Math.min(1, left / lens[i]); left -= lens[i];
      glowLine([s[0], [s[0][0] + (s[1][0] - s[0][0]) * f, s[0][1] + (s[1][1] - s[0][1]) * f]], '#bfe3ff', lw, 0.75 * amt);
    });
    const c = nskyScreen(nskyAimDir('dipper', _nsB), W, H);
    if (c && dip > 0.6) { ctx.globalAlpha = Math.min(1, (dip - 0.6) / 0.3) * amt * (1 - ptr * 0.5); nskyLabel(ctx, 'Big Dipper', c[0], c[1] + m * 0.11, Math.round(m * 0.05), '#ffffff'); }
  }
  if (ptr > 0.005) { // the two pointer stars: amber segment and rings
    const a = P('Merak'), b = P('Dubhe');
    if (a && b) {
      glowLine([a, b], '#fbbf24', lw * 1.6, ptr * amt);
      ctx.globalAlpha = ptr * amt; ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = lw * 0.8;
      for (const p of [a, b]) { ctx.beginPath(); ctx.arc(p[0], p[1], m * 0.03, 0, Math.PI * 2); ctx.stroke(); }
    }
  }
  if (line > 0.005) { // from Dubhe towards Polaris, ticked every pointer-gap, numbered
    const dA = nskyDir('Dubhe', new THREE.Vector3()), dB = nskyDir('Polaris', new THREE.Vector3()), dM = nskyDir('Merak', new THREE.Vector3());
    const gap = dM.angleTo(dA), full = dA.angleTo(dB), ang = Math.min(full, line * gap);
    const axis = new THREE.Vector3().crossVectors(dA, dB).normalize(), q = new THREE.Quaternion(), v = new THREE.Vector3();
    const at = (a) => { q.setFromAxisAngle(axis, a); return nskyScreen(v.copy(dA).applyQuaternion(q), W, H); };
    const pts = []; for (let i = 0; i <= 40; i++) { const p = at(ang * i / 40); if (p) pts.push(p); }
    ctx.setLineDash([lw * 3, lw * 2.4]); glowLine(pts, '#fbbf24', lw * 1.2, 0.95 * amt); ctx.setLineDash([]);
    const fs = Math.round(m * 0.07);
    for (let k = 1; k <= 5; k++) {
      if (line < k) break;
      const p = at(k * gap); if (!p) continue;
      const age = Math.min(1, (line - k) / 0.25), pop = 1 + 0.5 * (1 - age);
      const fadeN = 1 - 0.85 * Math.min(1, drop * 2);
      ctx.globalAlpha = amt * (1 - pol * 0.6) * fadeN; ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(p[0], p[1], lw * 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = amt * fadeN; ctx.save(); ctx.translate(p[0] + m * 0.06, p[1]); ctx.scale(pop, pop); nskyLabel(ctx, String(k), 0, 0, fs, '#ffffff'); ctx.restore();
    }
  }
  if (pol > 0.005) { // Polaris: a ring and its name
    const p = P('Polaris');
    if (p) {
      ctx.globalAlpha = pol * amt; ctx.strokeStyle = '#fde68a'; ctx.lineWidth = lw; ctx.shadowColor = '#fde68a'; ctx.shadowBlur = lw * 4;
      ctx.beginPath(); ctx.arc(p[0], p[1], m * (0.035 + 0.02 * (1 - Math.min(1, pol))), 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0;
      nskyLabel(ctx, 'Polaris', p[0], p[1] - m * 0.075, Math.round(m * 0.06), '#fde68a');
    }
  }
  if (drop > 0.005) { // straight down from Polaris to the horizon: north
    const pa = nskyAltAz(NSKY_NAMED[NSKY_IDX.Polaris][1], NSKY_NAMED[NSKY_IDX.Polaris][2], NSKY.lst), pts = [];
    const end = pa[0] * (1 - Math.min(1, drop));
    for (let i = 0; i <= 30; i++) { const al = pa[0] + (end - pa[0]) * i / 30, p = nskyScreen(nskyDirAltAz(al, pa[1], _nsB), W, H); if (p) pts.push(p); }
    ctx.setLineDash([lw * 3, lw * 2.4]); glowLine(pts, '#fde68a', lw * 1.1, 0.9 * amt); ctx.setLineDash([]);
    if (drop > 0.85 && pts.length) {
      const g = pts[pts.length - 1], a = Math.min(1, (drop - 0.85) / 0.15);
      ctx.globalAlpha = a * amt; ctx.fillStyle = '#fde68a';
      ctx.beginPath(); ctx.moveTo(g[0], g[1] - m * 0.02); ctx.lineTo(g[0] - m * 0.03, g[1] + m * 0.03); ctx.lineTo(g[0] + m * 0.03, g[1] + m * 0.03); ctx.closePath(); ctx.fill();
      nskyLabel(ctx, 'N', g[0], g[1] + m * 0.1, Math.round(m * 0.11), '#ffffff');
    }
  }
  ctx.restore();
}
drawReelOverlay = function (ctx, W, H) { _stOverlay(ctx, W, H); drawNorthSky(ctx, W, H); drawCards(ctx, W, H); };
const _nsRunCue = runCue;
runCue = function (c) { _nsRunCue(c); if (c.sky && typeof c.sky === 'object') nsSet(c.sky, c.skySecs); };
if (window.IW) {
  IW.sky = (vals, secs) => { nsSet(vals || { amt: 1 }, secs); return Object.fromEntries(NS_KEYS.map((k) => [k, +nsAt(k, performance.now()).toFixed(3)])); };
  IW.skyReset = () => { nskyReset(); return { sky: 'reset' }; };
  IW.skyAim = (from, to, up) => { const t = nskyAimTarget({ from, to, up }, 1, new THREE.Vector3()); return t.toArray().map((x) => +x.toFixed(2)); };
}
