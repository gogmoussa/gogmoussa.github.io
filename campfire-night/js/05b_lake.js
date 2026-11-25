// © 2026 George Moussa. All rights reserved.
// ============================================================================
// 5B. THE LAKE: its shape, water level and shore (Nov 18 2026, replaced the pond)
//     The near bank is the old pond's front shore (so the fire, the Witness's place and POND_SPOT
//     stay where they were); behind it the water opens out wide down the valley to the far hills.
//     Loads before 06 (the water mesh uses makeLakeWaterGeometry). 11b calls dressLake() once
//     terrainY and placeRock exist. Other files only use the helpers below:
//       LAKE_Y               water level (the camp ground is at 0, so the bank steps down to it)
//       POND                 the near-shore ellipse (centre cx/cz; rx/rz = the front bank radii)
//       lakeR(a)             shore distance from the POND centre along angle a (sin(a) > 0 faces the camp)
//       pondDist(x, z)       radial shore ratio: < 1 water, 1 waterline, > 1 land (camp/ pushes along it)
//       lakeEdge(x, z)       metres from the waterline along that ray: < 0 water, > 0 land
//       lakeShoreAt(a, e)    [x, z] at e metres off the shore (negative = out in the water)
//     The old pond is kept as a switch: WATER_MODE 'pond' rebuilds it as it was before Nov 18 (ellipse, water at
//     0.014, flat mud bank, ring of boulders, the far-bank trees and the valley). Chosen at load because the ground
//     is built once: ?water=pond|lake, else localStorage 'innerwork.water', else 'lake'. IW.water(), the dock's
//     Water menu and setWaterMode() save the choice and reload.
// ============================================================================
const WATER_MODE = (function () {
  let m = null;
  try { m = new URLSearchParams(location.search).get('water'); } catch (e) {}
  if (m !== 'pond' && m !== 'lake') { try { m = localStorage.getItem('innerwork.water'); } catch (e) {} }
  return m === 'pond' ? 'pond' : 'lake';
})();
function setWaterMode(m) {
  m = m === 'pond' ? 'pond' : 'lake';
  try { localStorage.setItem('innerwork.water', m); } catch (e) {}
  if (m === WATER_MODE) return m;
  const u = new URL(location.href); u.searchParams.delete('water');
  location.href = u.toString();
  return m;
}
const LAKE_Y = WATER_MODE === 'pond' ? 0.014 : -0.3;
const POND = { cx: 0.12, cz: -4.65, rx: 4.75, rz: 3.35 };
const LAKE = {
  spread: 0.55,  // how fast the lake widens behind the near bank (metres of width per metre back, each side)
  far: 46,       // where the side shores meet the forest, measured from the POND centre
  farVista: 118, // straight out (the open view to the sky and far hills) the water runs on to the hills
  water: 3       // the water surface runs this far under the bank, so the waterline is set by the ground
};

function lakeR(a) {
  const c = Math.cos(a), s = Math.sin(a);
  if (s >= 0 || WATER_MODE === 'pond') return 1 / Math.hypot(c / POND.rx, s / POND.rz); // near bank: the old pond's front
  const out = THREE.MathUtils.smoothstep(-s, 0.80, 0.97);    // 1 = looking straight out from the camp
  const far = (LAKE.far + (LAKE.farVista - LAKE.far) * out) * (1 + 0.06 * Math.sin(4 * a + 0.7) + 0.03 * Math.sin(9 * a + 2.0));
  const den = Math.abs(c) - LAKE.spread * -s;                 // a fan opening out from the sides of the old pond
  const fan = den > POND.rx / far ? POND.rx / den : far;
  const wob = 0.10 * Math.sin(3 * a + 1.3) + 0.05 * Math.sin(7 * a + 0.4) + 0.025 * Math.sin(13 * a + 2.1);
  const k = THREE.MathUtils.smoothstep(-s, 0, 0.35);          // no wobble right at the sides, so the shore stays continuous
  return Math.min(far, fan * (1 + wob * k));
}
function pondDist(x, z) {
  const dx = x - POND.cx, dz = z - POND.cz, r = Math.hypot(dx, dz);
  return r < 1e-6 ? 0 : r / lakeR(Math.atan2(dz, dx));
}
function lakeEdge(x, z) {
  const dx = x - POND.cx, dz = z - POND.cz;
  return Math.hypot(dx, dz) - lakeR(Math.atan2(dz, dx));
}
function lakeShoreAt(a, e) {
  const r = lakeR(a) + e;
  return [POND.cx + Math.cos(a) * r, POND.cz + Math.sin(a) * r];
}
// Lake bed and the step down to it, blended into the land height h that 11b's terrainY works out.
// The bank drops LAKE_Y over the last ~1 m (rocks sit on it); hills near the water are eased flat first.
function lakeShapeTerrain(x, z, h) {
  // The pond: a flat bowl just under the water, kept flat for ~3 m past the shore, then easing into the meadow
  if (WATER_MODE === 'pond') return THREE.MathUtils.lerp(-0.02, h, THREE.MathUtils.smoothstep(pondDist(x, z), 1.0, 2.0));
  const e = lakeEdge(x, z), ss = THREE.MathUtils.smoothstep;
  const land = h * ss(e, 0.4, 9.0);
  if (e > 0.75) return land;
  const bed = LAKE_Y - 0.16 - 2.6 * ss(-e, 0.0, 16.0);
  return THREE.MathUtils.lerp(bed, land, ss(e, -0.4, 0.75));
}

// Water surface: a polar grid around the POND centre that follows the shore (plus LAKE.water metres),
// finer near the bank. aDepth (water depth at each vertex) is filled in by dressLake().
function makeLakeWaterGeometry() {
  const NR = 48, NA = 192, pos = [], uv = [], idx = [];
  pos.push(POND.cx, 0, POND.cz); uv.push(0.5, 0.5);
  for (let i = 1; i <= NR; i++) {
    const f = Math.pow(i / NR, 1.5);
    for (let j = 0; j < NA; j++) {
      const a = (j / NA) * Math.PI * 2, r = (lakeR(a) + LAKE.water) * f;
      const x = POND.cx + Math.cos(a) * r, z = POND.cz + Math.sin(a) * r;
      pos.push(x, 0, z); uv.push(0.5 + (x - POND.cx) / 10.16, 0.5 - (z - POND.cz) / 10.16);
    }
  }
  for (let j = 0; j < NA; j++) idx.push(0, 1 + (j + 1) % NA, 1 + j);
  for (let i = 1; i < NR; i++) {
    const r0 = 1 + (i - 1) * NA, r1 = 1 + i * NA;
    for (let j = 0; j < NA; j++) {
      const j1 = (j + 1) % NA;
      idx.push(r0 + j, r0 + j1, r1 + j, r0 + j1, r1 + j1, r1 + j);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aDepth', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3).fill(1), 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

// Called from 11b after the ground is built: water depth per vertex, then the rocky bank.
const lakeRocks = new THREE.Group();
function dressLake(parent) {
  const g = waterPoolMesh.geometry, p = g.attributes.position, d = g.attributes.aDepth;
  // The pond's bowl is flat, so its "depth" for the water colours is drawn from the shore distance instead
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    d.setX(i, WATER_MODE === 'pond' ? 2.2 * (1 - pondDist(x, z)) : LAKE_Y - terrainY(x, z));
  }
  d.needsUpdate = true;
  parent.add(lakeRocks);
  if (WATER_MODE === 'pond') { dressPond(parent); return; }

  const rr = mulberry32(5150 + 7);
  const keepClear = (x, z) => Math.hypot(x - 0.6, z + 1.75) < 0.9; // POND_SPOT: the stone lands and the Witness rises there
  const rock = (x, z, size, seed, sink) => {
    if (keepClear(x, z)) return;
    const m = new THREE.Mesh(makeRock(size, seed), rockMat);
    m.position.set(x, terrainY(x, z) - sink * size, z);
    m.rotation.y = rr() * 6.28;
    m.castShadow = true; m.receiveShadow = true;
    lakeRocks.add(m);
  };
  // The near bank: a few broad, flat-topped rocks stepping down from the grass into the water
  const steps = [[-0.25, 0.55, 0.42], [-0.05, 0.20, 0.36], [0.12, -0.18, 0.30], [0.30, 0.45, 0.34], [-0.42, 0.05, 0.28],
                 [0.55, 0.10, 0.26], [-0.62, 0.50, 0.38], [0.78, 0.40, 0.30], [-0.85, -0.10, 0.24]];
  steps.forEach(([da, e, s], i) => {
    const a = Math.PI / 2 + da; // straight in front of the camp is a = 90 deg
    const [x, z] = lakeShoreAt(a, e);
    rock(x, z, s * (1.15 + rr() * 0.35), 300 + i, e > 0 ? 0.28 : 0.42);
  });
  // Along the rest of the near shore and the sides, loose drifts of boulders (none on the far shore, it is the hills)
  let n = 0, guard = 0;
  while (n < 34 && guard++ < 600) {
    const a = rr() * Math.PI * 2;
    if (lakeR(a) > 24) continue;
    if (Math.sin(a) > 0.3 && Math.abs(Math.cos(a)) < 0.55) continue; // the near middle has its steps already
    if (nfbm(Math.cos(a) * 3.5 + 11, Math.sin(a) * 3.5 + 4) < 0.45) continue; // in drifts, not a necklace
    const e = -0.3 + rr() * 1.0;
    const [x, z] = lakeShoreAt(a, e);
    rock(x, z, 0.16 + rr() * 0.42, 340 + n, e > 0.2 ? 0.25 : 0.4);
    n++;
  }
  // Pines down to the side and far shores, so the water meets forest (11b's pine ring stops short of it), thinning back
  // into the background treeline. Same geometry and material as 11b's pines; applyMood swaps the material for both.
  const N = 340, pm = new THREE.InstancedMesh(pineGeo, pineMat, N), o3 = new THREE.Object3D(), tint = new THREE.Color();
  let k = 0; guard = 0;
  while (k < N && guard++ < 6000) {
    const a = Math.PI + rr() * Math.PI;                         // the back half: sides and far shore
    if (lakeR(a) < 12) continue;
    const e = 1.4 + Math.pow(rr(), 1.4) * 18;
    const [x, z] = lakeShoreAt(a, e);
    if (Math.hypot(x, z) > 63.5 || lakeEdge(x, z) < 1.2) continue;  // in front of the background treeline ring (66 m)
    if (nfbm(x * 0.09 + 3, z * 0.09 - 5) < 0.36) continue;          // in stands, with gaps
    if (vistaFactor(x, z) > 0.22) continue;                          // keep the open view out to the sky and hills
    o3.position.set(x, terrainY(x, z) - 0.15, z);
    o3.rotation.set((rr() - 0.5) * 0.06, rr() * 6.28, (rr() - 0.5) * 0.06);
    const s = 0.9 + rr() * 0.7 + Math.hypot(x, z) * 0.008;
    o3.scale.set(s * (0.88 + rr() * 0.24), s * (0.92 + rr() * 0.3), s * (0.88 + rr() * 0.24));
    o3.updateMatrix(); pm.setMatrixAt(k, o3.matrix);
    pm.setColorAt(k, tint.setHSL(0.26 + rr() * 0.06, 0.28, 0.58 + rr() * 0.3));
    k++;
  }
  pm.count = k; pm.frustumCulled = false;
  parent.add(pm);
  lakeShorePines = pm;
}
let lakeShorePines = null;

// The old pond's own dressing (WATER_MODE 'pond'): the textured mud bank disc and the ring of boulders on its flanks
// and far shore, as they were before Nov 18. Reeds, pebbles, tufts and lilies come from 11b in both modes.
function dressPond(parent) {
  // ---- Pond bank: wet earth that darkens at the waterline and breaks up into the grass, with pebbles, ----
  // ---- short tufts and reed clumps along it (replaces the hard-edged mud disc; water sits on top)     ----
  const BANK_OUT = 1.24; // disc radius, in pond radii
  const bankTex = (function () {
    const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d'), img = g.createImageData(S, S), d = img.data;
    const ss = THREE.MathUtils.smoothstep;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const u = (x + 0.5) / S * 2 - 1, v = (y + 0.5) / S * 2 - 1;
      const rr = Math.hypot(u, v) * BANK_OUT, ang = Math.atan2(v, u);
      const wob = (nfbm(Math.cos(ang) * 3.2 + 9, Math.sin(ang) * 3.2 + 4) - 0.5) * 0.14 + (nfbm(u * 15 + 2, v * 15 - 7) - 0.5) * 0.10;
      const alpha = 1 - ss(rr, 1.015 + wob * 0.4, 1.12 + wob);       // ragged fade into the meadow
      const wet = 1 - ss(rr, 0.98, 1.06 + wob * 0.5);                // darkest where the water laps
      const grit = 0.82 + 0.36 * nfbm(u * 46 + 1, v * 46 + 5);
      const i = (y * S + x) * 4;
      d[i] = (62 - 34 * wet) * grit; d[i + 1] = (52 - 28 * wet) * grit; d[i + 2] = (38 - 18 * wet) * grit;
      d[i + 3] = 255 * alpha;
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = maxAniso;
    if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
    return t;
  })();
  const mudMat = new THREE.MeshStandardMaterial({ map: bankTex, transparent: true, depthWrite: false, roughness: 0.9, envMapIntensity: 0.2 });
  const mudRing = new THREE.Mesh(new THREE.CircleGeometry(1, 72), mudMat);
  mudRing.rotation.x = -Math.PI / 2;
  mudRing.scale.set(POND.rx * BANK_OUT, POND.rz * BANK_OUT, 1);
  mudRing.position.set(POND.cx, 0.006, POND.cz);
  mudRing.receiveShadow = true;
  mudRing.renderOrder = -2; // under the water and everything else see-through
  parent.add(mudRing);

  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2 + nh2(i, 5) * 0.22;
    if (Math.sin(a) > 0.28 && Math.abs(Math.cos(a)) < 0.78) continue;
    const k = 1.01 + nh2(i, 6) * 0.08;
    placeRock(POND.cx + Math.cos(a) * POND.rx * k, POND.cz + Math.sin(a) * POND.rz * k, 0.18 + nh2(i, 7) * 0.34, 100 + i, 0.22);
  }
}

// Dock menu (called by 16 once the dock exists)
function buildWaterMenu() {
  const after = document.getElementById('xd-part');
  if (!after || document.getElementById('xd-water')) return;
  const sel = document.createElement('select');
  sel.className = 'mini'; sel.id = 'xd-water'; sel.title = 'Water: the wide lake or the old pond (reloads the page)';
  sel.innerHTML = '<option value="lake">Water: lake</option><option value="pond">Water: pond</option>';
  sel.value = WATER_MODE;
  sel.onchange = () => { sel.blur(); setWaterMode(sel.value); };
  after.insertAdjacentElement('afterend', sel);
}
