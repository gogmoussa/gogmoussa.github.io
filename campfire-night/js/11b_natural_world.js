// © 2026 George Moussa. All rights reserved.
// ============================================================================
// 11B. NATURAL WORLD: MEADOW TERRAIN, SWAYING GRASS, TREES, ROCKS, POND & MOODS
//      Cycle with the Mood button / L key. Every mood is the woods clearing at a
//      different time; "Astral Twilight" is the spirit world (bioluminescent look).
// ============================================================================
const natureGroup = new THREE.Group();
scene.add(natureGroup);
let natureOn = true;
let fireBase = 2.0;
let moodIdx = 0;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const nrng = mulberry32(20261024);
function nh2(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function nvn(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return (nh2(xi, yi) * (1 - u) + nh2(xi + 1, yi) * u) * (1 - v) +
         (nh2(xi, yi + 1) * (1 - u) + nh2(xi + 1, yi + 1) * u) * v;
}
function nfbm(x, y) { return nvn(x, y) * 0.55 + nvn(x * 2.1, y * 2.1) * 0.3 + nvn(x * 4.3, y * 4.3) * 0.15; }

// POND, pondDist, lakeEdge, lakeShoreAt, LAKE_Y: the lake's shape lives in 05b_lake.js
function vistaFactor(x, z) { return (z < 0) ? Math.exp(-Math.pow(x / (6.8 - z * 0.26), 2)) : 0.0; } // 1 = open corridor behind the pond
function terrainY(x, z) {
  const r = Math.hypot(x, z);
  // Keep the central vista corridor behind the pond open; undulate organically along the far grassy shore crest, then dip into the mountain valley
  const vistaAngle = vistaFactor(x, z);
  // Past the pine ring the land keeps rolling into far forested hills, rising to a rim before the sky dome (r 144) so the flat plane never shows
  const far = THREE.MathUtils.smoothstep(r, 58, 132);
  const farHills = far * far * (3.5 + 11.0 * nfbm(x * 0.021 + 7.3, z * 0.021 - 3.1) + 3.0 * nvn(x * 0.07, z * 0.07)) * (1.0 - 0.35 * vistaAngle);
  const flankRise = THREE.MathUtils.smoothstep(r, 11, 42) * (1.0 - vistaAngle * 0.94);
  const crestWave = 0.65 + 0.70 * nfbm(x * 0.38 + 2.1, z * 0.38);
  const farBankCrest = (z < -7.5 && z > -19.5) ? Math.exp(-Math.pow((z + 12.2) / 3.4, 2)) * 0.32 * crestWave * vistaAngle * 1.0 : 0.0;
  // The valley drop behind the old pond (WATER_MODE 'pond'); with the lake, 05b fills the valley with water instead
  const valleyDrop = (WATER_MODE === 'pond' && z < -15.5) ? -THREE.MathUtils.smoothstep(-z, 15.5, 26.0) * 6.5 * vistaAngle : 0.0;
  const h = farBankCrest + valleyDrop + farHills +
         flankRise * (0.75 + nfbm(x * 0.045 + 3, z * 0.045) * 2.1) +
         nfbm(x * 0.16 + 9, z * 0.16) * 0.09 * THREE.MathUtils.smoothstep(r, 5.5, 15) * (1.0 - vistaAngle * 0.85);
  // The lake bed and the rocky step down to it (05b); hills near the water ease flat first
  return lakeShapeTerrain(x, z, h);
}

// ---- Procedural textures ----------------------------------------------------
const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1);
function makeGrassTex() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const x = c.getContext('2d');
  x.fillStyle = '#334a19'; x.fillRect(0, 0, 512, 512);
  const cols = ['#263a11', '#3d581c', '#4b6923', '#2e4515', '#587429', '#1f310d'];
  const r = mulberry32(7);
  for (let i = 0; i < 9500; i++) {
    x.strokeStyle = cols[(r() * cols.length) | 0];
    x.globalAlpha = 0.35 + r() * 0.45;
    x.lineWidth = 0.8 + r() * 1.4;
    const px = r() * 512, py = r() * 512, len = 5 + r() * 12, a = -Math.PI / 2 + (r() - 0.5) * 1.2;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len); x.stroke();
  }
  x.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = maxAniso;
  if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
  return t;
}
function makeBarkTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 512;
  const x = c.getContext('2d');
  x.fillStyle = '#5c4838'; x.fillRect(0, 0, 256, 512); // mid brown: the old near-black base made every trunk a pure black silhouette
  const r = mulberry32(11);
  // Deep vertical bark ridges and dark crevices
  for (let i = 0; i < 620; i++) {
    const dark = r() < 0.42;
    const v = dark ? (26 + r() * 22) : (70 + r() * 50);
    x.fillStyle = `rgba(${(v * 1.25) | 0},${(v * 0.92) | 0},${(v * 0.68) | 0},${0.32 + r() * 0.48})`;
    const w = dark ? (1 + r() * 2.5) : (2 + r() * 5.5);
    const px = r() * 256, py = r() * 512, h = 24 + r() * 95;
    x.fillRect(px, py, w, h);
  }
  // Subtle bark knots & horizontal lenticels
  for (let i = 0; i < 28; i++) {
    const kx = r() * 256, ky = r() * 512, kr = 4 + r() * 7;
    x.strokeStyle = 'rgba(30,20,12,0.55)';
    x.lineWidth = 1.6;
    x.beginPath(); x.ellipse(kx, ky, kr * 0.6, kr, 0, 0, Math.PI * 2); x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = maxAniso;
  if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
  return t;
}
function makeFoliageTex(seed, palette) {
  // One soft leaf clump per card: a few big overlapping lobes in close greens (lit from above, shaded underneath)
  // with a scalloped edge, instead of hundreds of small high-contrast leaves that read as speckle from a distance.
  const r = mulberry32(seed);
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d');
  for (let i = 0; i < 64; i++) {
    const a = r() * Math.PI * 2, d = Math.pow(r(), 0.6) * 66;
    x.save();
    x.translate(128 + Math.cos(a) * d, 128 + Math.sin(a) * d * 0.9);
    x.rotate(a + (r() - 0.5) * 1.2);
    x.fillStyle = palette[(r() * palette.length) | 0];
    const edgeScale = 1.0 - 0.5 * (d / 66);
    x.beginPath(); x.ellipse(0, 0, (20 + r() * 14) * edgeScale, (12 + r() * 8) * edgeScale, 0, 0, Math.PI * 2); x.fill();
    x.restore();
  }
  x.globalCompositeOperation = 'source-atop';
  // soft top light and under-shadow over the whole clump
  const gv = x.createLinearGradient(0, 30, 0, 236);
  gv.addColorStop(0, 'rgba(206,224,150,0.20)');
  gv.addColorStop(0.45, 'rgba(0,0,0,0)');
  gv.addColorStop(1, 'rgba(6,14,10,0.50)');
  x.fillStyle = gv; x.fillRect(0, 0, 256, 256);
  // a few broad, faint leaf dabs so the clump is not flat
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2, d = Math.pow(r(), 0.8) * 80;
    const py = 128 + Math.sin(a) * d * 0.9;
    x.fillStyle = py < 128 ? 'rgba(190,214,140,0.10)' : 'rgba(8,18,12,0.12)';
    x.beginPath(); x.ellipse(128 + Math.cos(a) * d, py, 12 + r() * 12, 6 + r() * 6, (r() - 0.5) * 1.4, 0, Math.PI * 2); x.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = maxAniso;
  if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
  return t;
}

// ---- Geometry helpers -------------------------------------------------------
function mergeGeos(list) {
  const pos = [], nor = [], uv = [], col = [], idx = [];
  let off = 0;
  list.forEach((g) => {
    const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv, c = g.attributes.color;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      nor.push(n.getX(i), n.getY(i), n.getZ(i));
      uv.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0);
      col.push(c ? c.getX(i) : 1, c ? c.getY(i) : 1, c ? c.getZ(i) : 1);
    }
    if (g.index) { for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + off); }
    else { for (let i = 0; i < p.count; i++) idx.push(i + off); }
    off += p.count;
  });
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  m.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  m.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  m.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  m.setIndex(idx);
  return m;
}

// ---- Terrain: flat clearing in the middle, rolling forested hills beyond ----
const grassTex = makeGrassTex();
grassTex.repeat.set(110, 110);
const groundGeo = new THREE.PlaneGeometry(420, 420, 220, 220);
groundGeo.rotateX(-Math.PI / 2);
{
  // Grid squeezed toward the middle (~0.6 m cells at the camp and the lake's step, ~4.6 m at the rim) so the bank can drop
  // in under a metre; UVs follow world x/z so the grass texture keeps one scale everywhere
  const p = groundGeo.attributes.position, guv = groundGeo.attributes.uv;
  const warp = (v) => { const u = v / 210; return 210 * (0.3 * u + 0.7 * u * u * u); };
  for (let i = 0; i < p.count; i++) {
    const x = warp(p.getX(i)), z = warp(p.getZ(i));
    p.setX(i, x); p.setZ(i, z); guv.setXY(i, x / 420 + 0.5, 0.5 - z / 420);
  }
}
{
  const p = groundGeo.attributes.position;
  const colArr = new Float32Array(p.count * 3);
  const cA = new THREE.Color(0.14, 0.24, 0.06), cB = new THREE.Color(0.24, 0.26, 0.08), cF = new THREE.Color(0.09, 0.17, 0.05);
  const cShore = new THREE.Color(0.10, 0.09, 0.05), cCanopy = new THREE.Color(0.035, 0.075, 0.03);
  const tmp = new THREE.Color(), tmpFar = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    p.setY(i, terrainY(x, z));
    const patch = THREE.MathUtils.smoothstep(nfbm(x * 0.08 + 20, z * 0.08), 0.38, 0.76);
    tmp.copy(cA).lerp(cB, patch);
    tmp.lerp(cF, THREE.MathUtils.smoothstep(Math.hypot(x, z), 14, 42));
    // Far hills: dark forest canopy broken by lighter glades so the hazy distance has texture from above
    const farT = THREE.MathUtils.smoothstep(Math.hypot(x, z), 52, 80);
    if (farT > 0) tmp.lerp(tmpFar.copy(cCanopy).lerp(cB, THREE.MathUtils.smoothstep(nfbm(x * 0.05 + 4, z * 0.05 - 6), 0.48, 0.62)), farT * 0.85);
    const le = lakeEdge(x, z);
    if (le < 1.0) tmp.lerp(cShore, 1.0 - THREE.MathUtils.smoothstep(le, 0.15, 1.0)); // wet earth and stone at the bank and under the water
    const shade = 0.72 + 0.36 * nfbm(x * 0.45, z * 0.45);
    colArr[i * 3] = tmp.r * shade; colArr[i * 3 + 1] = tmp.g * shade; colArr[i * 3 + 2] = tmp.b * shade;
  }
  groundGeo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
  groundGeo.computeVertexNormals();
}
const groundMesh = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({
  map: grassTex, vertexColors: true, roughness: 0.98, metalness: 0.0, envMapIntensity: 0.25
}));
groundMesh.receiveShadow = true;
natureGroup.add(groundMesh);

// ---- Swaying grass + reeds (GPU-instanced blades) ---------------------------
const windU = { value: 0 };
const galeU = { value: 0 }; // 0..1 storm wind, written by 20_moments.js: grass and canopies lean downwind (toward -x, +z) and thrash
const bladeGeo = (function () {
  const w = 0.032, h = 0.29;
  const verts = [-w, 0, 0, w, 0, 0, -w * 0.72, h * 0.5, 0, w * 0.72, h * 0.5, 0, 0, h, 0];
  const cols = [0.05, 0.09, 0.03, 0.05, 0.09, 0.03, 0.13, 0.22, 0.06, 0.13, 0.22, 0.06, 0.24, 0.34, 0.10]; // softer tip: less of a spike pattern
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4]);
  return g;
})();
const bladeMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
// Grass look, written by applyMood (uSat, uDim) and the loop (the two glows): the blades take the mood's colour instead of
// staying lime, the fire lays a warm pool on them, the Witness a cool one, and George's stump sits in a soft contact shadow.
const bladeFX = {
  uFireP: { value: new THREE.Vector3(HEARTH.x, 0.6, HEARTH.z) }, uFireC: { value: new THREE.Color(0xff7b1c) }, uFireK: { value: 1 },
  uSpP: { value: new THREE.Vector3(1.08, 1.0, -0.12) }, uSpC: { value: new THREE.Color(0x93c5fd) }, uSpK: { value: 0 },
  uBlob: { value: new THREE.Vector3(-1.13, 0.5, 0.62) },   // x, z, radius
  uSat: { value: 1 }, uDim: { value: 1 }
};
bladeMat.onBeforeCompile = (sh) => {
  sh.uniforms.uWind = windU; sh.uniforms.uGale = galeU;
  Object.assign(sh.uniforms, bladeFX);
  sh.fragmentShader = `varying vec3 vBW; varying float vBH;
    uniform vec3 uFireP; uniform vec3 uFireC; uniform float uFireK; uniform vec3 uSpP; uniform vec3 uSpC; uniform float uSpK;
    uniform vec3 uBlob; uniform float uSat; uniform float uDim;
  ` + sh.fragmentShader.replace('#include <tonemapping_fragment>', `
    {
      vec3 gc = gl_FragColor.rgb;
      float gl = dot(gc, vec3(0.299, 0.587, 0.114));
      float fd = length(vBW.xz - uFireP.xz);
      float pool = uFireK / (1.0 + fd * fd * 0.42) * (1.0 - smoothstep(4.0, 8.5, fd));
      float sd = length(vBW.xz - uSpP.xz);
      float cool = uSpK / (1.0 + sd * sd * 0.9) * (1.0 - smoothstep(2.5, 5.0, sd));
      // away from the fire the mood owns the grass (less colour, less light); close in it keeps its full colour
      gc = mix(vec3(gl), gc, mix(uSat, 1.0, clamp(pool * 1.4, 0.0, 1.0))) * mix(uDim, 1.0, clamp(pool * 1.6, 0.0, 1.0));
      vec3 fh = uFireC / max(max(uFireC.r, uFireC.g), max(uFireC.b, 1e-4));
      gc = mix(gc, gl * mix(vec3(1.0), fh, 0.62) * 1.45, clamp(pool * 0.7, 0.0, 0.5)); // firelit grass leans to the fire's colour (gold, or teal in the spirit world), not lime
      float tipK = 0.35 + 0.65 * vBH;
      gc += uFireC * pool * 0.085 * tipK + uSpC * cool * 0.055 * tipK;
      float bd = length(vBW.xz - uBlob.xy);
      gc *= 1.0 - 0.62 * (1.0 - smoothstep(0.18, uBlob.z, bd));
      gl_FragColor.rgb = gc;
    }
    #include <tonemapping_fragment>`);
  sh.vertexShader = 'uniform float uWind; uniform float uGale;\nvarying vec3 vBW; varying float vBH;\n' + sh.vertexShader.replace('#include <begin_vertex>', `
    vec3 transformed = vec3(position);
    vBH = clamp(position.y / 0.29, 0.0, 1.0);
    float gx = instanceMatrix[3].x, gz = instanceMatrix[3].z;
    float sway = sin(uWind * 1.5 + gx * 1.7 + gz * 1.3) * 0.55 + sin(uWind * 2.9 + gz * 3.1 + gx * 0.7) * 0.25;
    float bend = position.y * position.y * 1.6;
    // storm: gust fronts travel downwind across the meadow and flatten the blades as they pass
    float front = 0.5 + 0.5 * sin(uWind * 1.15 + gx * 0.62 - gz * 0.33) * (0.6 + 0.4 * sin(uWind * 0.47 + gz * 0.21));
    float flat_ = uGale * (0.75 + 1.55 * front);
    sway *= 1.0 + uGale * 1.6;
    transformed.x += (sway * 0.55 - flat_ * 1.25) * bend;
    transformed.z += (sway * 0.25 + flat_ * 0.80) * bend;
    transformed.y -= flat_ * bend * 0.55;
    vBW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
  `);
};

function scatterBlades(count, maxR, accept, hMin, hMax) {
  const mesh = new THREE.InstancedMesh(bladeGeo, bladeMat, count);
  const d = new THREE.Object3D();
  const tint = new THREE.Color();
  let n = 0, tries = 0;
  while (n < count && tries < count * 8) {
    tries++;
    const r = maxR * Math.sqrt(nrng()), a = nrng() * Math.PI * 2;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const scaleMult = accept(x, z, r);
    if (!scaleMult) continue;
    d.position.set(x, terrainY(x, z), z);
    d.rotation.set((nrng() - 0.5) * 0.25, nrng() * Math.PI * 2, (nrng() - 0.5) * 0.25);
    const s = (hMin + nrng() * (hMax - hMin)) * (typeof scaleMult === 'number' ? scaleMult : 1.0);
    d.scale.set(0.75 + nrng() * 0.4, s, 1);
    d.updateMatrix();
    mesh.setMatrixAt(n, d.matrix);
    { // colour in soft patches (olive, deep green, a little straw) instead of one even lime
      const pt = nfbm(x * 0.6 + 31.0, z * 0.6 - 17.0);
      tint.setHSL(0.20 + 0.10 * pt + nrng() * 0.04, 0.30 + 0.22 * pt + nrng() * 0.10, 0.30 + 0.20 * pt + nrng() * 0.14);
    }
    mesh.setColorAt(n, tint);
    n++;
  }
  mesh.count = n;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  return mesh;
}
const grassBlades = scatterBlades(90000, 25.0, (x, z, r) => {
  const le = lakeEdge(x, z);
  if (le < 0.45) return false;
  if (Math.hypot(x + 0.05, z + 0.28) < 0.72) return false;
  // One organic meadow all the way round (wavy edge, no box corners): dense in the clearing, thinning into clumps under the trees
  const maxReach = 21.0 + 3.5 * nfbm(Math.atan2(z, x) * 1.6 + 5.0, 2.3);
  if (r > maxReach) return false;
  if (nrng() >= 1.0 - THREE.MathUtils.smoothstep(r, maxReach * 0.8, maxReach)) return false;
  if (r > 10.0 && nrng() > 0.42 * (0.45 + 1.1 * nfbm(x * 0.35 + 11.0, z * 0.35 - 2.0)) + (1.0 - THREE.MathUtils.smoothstep(r, 10.0, 12.5))) return false;
  // Shorter grass near the front pond shoreline so the water surface reads clearly
  if (le < 1.3 && z > POND.cz) return THREE.MathUtils.lerp(0.35, 0.95, (le - 0.45) / 0.85);
  // Organic undulating meadow tufts on the far pond bank crest (avoids a flat ruler-straight hedge line)
  if (z < -7.8) return 0.68 + 0.92 * nfbm(x * 0.55 + 4.2, z * 0.55);
  return 1.0;
}, 0.46, 1.08);
natureGroup.add(grassBlades);

// Tall reeds hugging the pond left, right, and far banks (leaving front sightline open!)
const reeds = (function () {
  const count = 210;
  const mesh = new THREE.InstancedMesh(bladeGeo, bladeMat, count);
  const d = new THREE.Object3D();
  const tint = new THREE.Color();
  let placed = 0, guard = 0;
  while (placed < count && guard++ < count * 10) {
    const a = nrng() * Math.PI * 2;
    // Leave the front shore (sin(a) > 0.22) clear; only the nearer side shores of the lake (the far shore is the hills)
    if (Math.sin(a) > 0.20 && Math.abs(Math.cos(a)) < 0.86) continue;
    const k = nrng() * 0.55;
    if (lakeR(a) > 20) continue;
    const [x, z] = lakeShoreAt(a, -0.25 + k);
    d.position.set(x, terrainY(x, z), z);
    d.rotation.set((nrng() - 0.5) * 0.18, nrng() * Math.PI * 2, (nrng() - 0.5) * 0.18);
    d.scale.set(0.85 + nrng() * 0.45, 1.35 + nrng() * 1.35, 1);
    d.updateMatrix();
    mesh.setMatrixAt(placed, d.matrix);
    tint.setHSL(0.21 + nrng() * 0.07, 0.32 + nrng() * 0.18, 0.28 + nrng() * 0.22);
    mesh.setColorAt(placed, tint);
    placed++;
  }
  mesh.count = placed;
  mesh.frustumCulled = false;
  return mesh;
})();
natureGroup.add(reeds);

// Floating pond water-lily pads & subtle lotus blossoms
const lilyGroup = new THREE.Group();
{
  const lr = mulberry32(314);
  const padMat = new THREE.MeshStandardMaterial({ color: 0x1e3814, roughness: 0.65, metalness: 0.02, envMapIntensity: 0.3 });
  const bloomMat = new THREE.MeshStandardMaterial({ color: 0xfbe8d3, emissive: 0x3a2410, emissiveIntensity: 0.15, roughness: 0.4 });
  const clusters = [[-2.4, -4.1], [2.5, -4.4], [-1.8, -5.8], [2.1, -6.1], [-0.4, -3.2]];
  clusters.forEach(([cx, cz], ci) => {
    for (let i = 0; i < 6; i++) {
      const a = lr() * Math.PI * 2, d = lr() * 0.75;
      const px = cx + Math.cos(a) * d, pz = cz + Math.sin(a) * d * 0.8;
      if (pondDist(px, pz) > 0.88) continue;
      const rad = 0.11 + lr() * 0.11;
      const padGeo = new THREE.CircleGeometry(rad, 18, 0, Math.PI * 1.88);
      padGeo.rotateX(-Math.PI / 2);
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.position.set(px, LAKE_Y + 0.005 + (i * 0.0005), pz);
      pad.rotation.y = lr() * Math.PI * 2;
      lilyGroup.add(pad);
      if (i === 0 || (i === 2 && ci % 2 === 0)) {
        const fl = new THREE.Mesh(new THREE.OctahedronGeometry(0.036, 1), bloomMat);
        fl.scale.set(1, 0.65, 1);
        fl.position.set(px, LAKE_Y + 0.02, pz);
        lilyGroup.add(fl);
      }
    }
  });
}
natureGroup.add(lilyGroup);

// Wildflower clusters
const flowers = (function () {
  const count = 420;
  const mesh = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.024, 1),
    new THREE.MeshStandardMaterial({ roughness: 0.65, metalness: 0, envMapIntensity: 0.25 }),
    count
  );
  const d = new THREE.Object3D();
  const palette = [0xd8d0be, 0xd9a830, 0x967ec8, 0xd47496, 0xe2dfd7].map((h) => new THREE.Color(h));
  const centers = [];
  for (let i = 0; i < 12; i++) {
    const a = nrng() * Math.PI * 2, r = 2.2 + nrng() * 5.2;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (lakeEdge(x, z) > 1.2) centers.push([x, z, palette[i % palette.length]]);
  }
  let n = 0;
  for (let i = 0; i < count; i++) {
    const c = centers[i % centers.length];
    const x = c[0] + (nrng() - 0.5) * 1.8, z = c[1] + (nrng() - 0.5) * 1.8;
    if (lakeEdge(x, z) < 0.9) continue;
    d.position.set(x, terrainY(x, z) + 0.16 + nrng() * 0.13, z);
    const s = 0.75 + nrng() * 0.75;
    d.scale.set(s, s * 0.7, s);
    d.updateMatrix();
    mesh.setMatrixAt(n, d.matrix);
    mesh.setColorAt(n, c[2]);
    n++;
  }
  mesh.count = n;
  mesh.frustumCulled = false;
  return mesh;
})();
natureGroup.add(flowers);

// ---- Rocks (faceted granite/slate boulders with dark crevices & moss) -------
const rockMat = new THREE.MeshStandardMaterial({
  vertexColors: true, roughness: 0.92, metalness: 0.03, envMapIntensity: 0.22, flatShading: false
});
function makeRock(size, seed) {
  const g = new THREE.IcosahedronGeometry(1, 3);
  const p = g.attributes.position;
  const sx = 1.05 + nh2(seed, 1) * 0.45, sy = 0.48 + nh2(seed, 2) * 0.28, sz = 0.85 + nh2(seed, 3) * 0.4;
  for (let i = 0; i < p.count; i++) {
    const dx = p.getX(i), dy = p.getY(i), dz = p.getZ(i);
    const n1 = nfbm(dx * 1.6 + dz * 1.2 + seed, dy * 1.8 + dz * 0.9 + seed * 0.3);
    const ridge = 1.0 - Math.abs(nvn(dx * 3.2 + seed, dz * 3.2 - seed) * 2.0 - 1.0);
    const disp = 0.72 + 0.38 * n1 + 0.14 * ridge;
    let y = dy * disp * sy;
    if (y < -0.14) y = -0.14 + (y + 0.14) * 0.22;
    p.setXYZ(i, dx * disp * sx * size, y * size, dz * disp * sz * size);
  }
  g.computeVertexNormals();
  const nrm = g.attributes.normal;
  const cols = new Float32Array(p.count * 3);
  const base = new THREE.Color(), moss = new THREE.Color(0.045, 0.085, 0.022);
  for (let i = 0; i < p.count; i++) {
    const px = p.getX(i), py = p.getY(i), pz = p.getZ(i);
    const n = nfbm(px * 5.5 + seed, pz * 5.5);
    const crag = nvn(px * 12.0 + seed, py * 12.0);
    // Realistic dark linear river-stone / granite values (prevents double-gamma chalkiness)
    const v = (0.032 + n * 0.048) * (0.75 + 0.35 * crag);
    const ao = THREE.MathUtils.smoothstep(py / size, -0.18, 0.12) * 0.65 + 0.35;
    base.setRGB(v * 1.05 * ao, v * 0.98 * ao, v * 0.90 * ao);
    const m = THREE.MathUtils.smoothstep(nrm.getY(i) + (n - 0.5) * 0.45, 0.58, 0.88);
    base.lerp(moss, m * 0.65);
    cols[i * 3] = base.r; cols[i * 3 + 1] = base.g; cols[i * 3 + 2] = base.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return g;
}
const rocksGroup = new THREE.Group();
natureGroup.add(rocksGroup);
function placeRock(x, z, size, seed, sink) {
  const m = new THREE.Mesh(makeRock(size, seed), rockMat);
  m.position.set(x, terrainY(x, z) - (sink || 0.06) * size, z);
  m.rotation.y = nh2(seed, 9) * 6.28;
  m.castShadow = true; m.receiveShadow = true;
  rocksGroup.add(m);
  return m;
}
// Campfire stone ring (compact river stones nestled in the earth)
for (let i = 0; i < 12; i++) {
  const a = (i / 12) * Math.PI * 2 + 0.15;
  placeRock(HEARTH.x + Math.cos(a) * 0.44, HEARTH.z + Math.sin(a) * 0.44, 0.11 + nh2(i, 4) * 0.045, 40 + i, 0.26);
}
// The lake's bank rocks are placed by dressLake() (05b), called after the ground below
// A few larger boulders framing the clearing flanks
[[-3.6, 1.5, 0.52], [4.1, 1.9, 0.46], [5.2, -2.0, 0.68], [-5.4, -1.4, 0.62], [2.9, 3.6, 0.36]].forEach(([x, z, s], i) => placeRock(x, z, s, 200 + i, 0.32));

// Fallen log you could sit on, in the foreground
const barkTex = makeBarkTex();
barkTex.repeat.set(2, 4);
const barkMat = new THREE.MeshStandardMaterial({
  map: barkTex, bumpMap: barkTex, bumpScale: 0.04, roughness: 0.94, metalness: 0.0, color: 0xa08a76, envMapIntensity: 0.22
});
// Trunks: a warm rim down the side that faces the sun (same sun as the canopies; uniforms are filled in below)
const barkFX = { uSunDir: { value: new THREE.Vector3(0, 0.1, -1) }, uSunCol: { value: new THREE.Color(0xffb85c) }, uRimK: { value: 0.5 } };
barkMat.onBeforeCompile = (sh) => {
  Object.assign(sh.uniforms, barkFX);
  sh.vertexShader = 'varying vec3 vBarkW;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
    vec4 wpBark = vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
      wpBark = instanceMatrix * wpBark;
    #endif
    vBarkW = (modelMatrix * wpBark).xyz;`);
  sh.fragmentShader = 'uniform vec3 uSunDir; uniform vec3 uSunCol; uniform float uRimK; varying vec3 vBarkW;\n' + sh.fragmentShader.replace('#include <dithering_fragment>', `
    {
      vec3 nW = inverseTransformDirection(normal, viewMatrix);
      vec3 vW = normalize(cameraPosition - vBarkW);
      vec3 sunSideDir = normalize(uSunDir + vec3(-vBarkW.x * 0.09, 0.15, 0.0));
      float side = smoothstep(-0.35, 0.55, dot(nW, sunSideDir));
      float edge = pow(clamp(1.0 - abs(dot(nW, vW)), 0.0, 1.0), 2.0);
      gl_FragColor.rgb += (uSunCol * 0.6 + diffuseColor.rgb) * side * edge * uRimK * 0.5;
    }
    #include <dithering_fragment>`);
};
{
  const logG = new THREE.CylinderGeometry(0.16, 0.20, 2.1, 16, 8);
  const lp = logG.attributes.position;
  for (let i = 0; i < lp.count; i++) {
    const k = 1 + (nfbm(lp.getY(i) * 3, lp.getX(i) * 5) - 0.5) * 0.18;
    lp.setX(i, lp.getX(i) * k); lp.setZ(i, lp.getZ(i) * k);
  }
  logG.computeVertexNormals();
  const logM = new THREE.Mesh(logG, barkMat);
  logM.rotation.z = Math.PI / 2;
  logM.rotation.y = 0.0;
  const holder = new THREE.Group();
  holder.add(logM);
  holder.position.set(-2.95, 0.13, 1.62);
  holder.rotation.y = 0.52;
  // Campfire Night (?camp, Nov 19 2026) swings the log CAMP_LOG_SWING radians round George's stump, to the right as seen
  // from the tent and clear of the boulder beside it; it still points at the stump. Studio episodes keep it where it was.
  if (IS_CAMP) {
    const CAMP_LOG_SWING = 0.5, sx = GEORGE_SEAT.x, sz = GEORGE_SEAT.z;
    const ox = holder.position.x - sx, oz = holder.position.z - sz, d = Math.hypot(ox, oz), a = Math.atan2(oz, ox) + CAMP_LOG_SWING;
    const y0 = terrainY(holder.position.x, holder.position.z);
    holder.position.set(sx + Math.cos(a) * d, 0, sz + Math.sin(a) * d);
    holder.position.y = 0.13 + terrainY(holder.position.x, holder.position.z) - y0;
    holder.rotation.y = Math.atan2(Math.sin(a), -Math.cos(a));   // log axis (local x) along the line back to the stump
  }
  logM.castShadow = true; logM.receiveShadow = true;
  rocksGroup.add(holder);
}

// ---- Trees (Multi-dome canopies, root buttresses & gnarled boughs) ----------
const foliageSSSUniforms = {
  uSunDir: { value: new THREE.Vector3(-0.32, 0.24, -0.92).normalize() },
  uSunCol: { value: new THREE.Color(0xffb85c) },
  uRimK: { value: 0.32 }
};
// Subtle wind in the canopies, on the same clock as the grass: the crown leans slowly with gusts
// (more at the top), and each leaf card flutters on its own phase taken from where it sits.
const FOLIAGE_WIND_VERT = `
    vec3 transformed = vec3(position);
    vec4 fwp = vec4(position, 1.0);
    #ifdef USE_INSTANCING
      fwp = instanceMatrix * fwp;
    #endif
    fwp = modelMatrix * fwp;
    float gust = sin(uWind * 0.7 + fwp.x * 0.15 + fwp.z * 0.11) * 0.6 + sin(uWind * 1.3 + fwp.z * 0.23) * 0.4;
    float crown = clamp(position.y * 0.25, 0.0, 1.0);
    float gfront = 0.5 + 0.5 * sin(uWind * 0.9 + fwp.x * 0.22 - fwp.z * 0.12);
    transformed.x += (gust * 0.07 * (1.0 + uGale * 3.0) - uGale * (0.10 + 0.22 * gfront)) * crown;
    transformed.z += (gust * 0.04 * (1.0 + uGale * 3.0) + uGale * (0.06 + 0.14 * gfront)) * crown;
    float leafPh = dot(fwp.xyz, vec3(3.1, 2.3, 2.7));
    float flutter = sin(uWind * 3.4 + leafPh) * 0.5 + sin(uWind * 5.3 + leafPh * 1.7) * 0.3;
    transformed += vec3(0.6, 0.35, 0.5) * flutter * 0.035 * (1.0 + uGale * 2.4);
`;
function applyFoliageWind(shader) {
  shader.uniforms.uWind = windU; shader.uniforms.uGale = galeU;
  shader.vertexShader = 'uniform float uWind; uniform float uGale;\n' + shader.vertexShader.replace('#include <begin_vertex>', FOLIAGE_WIND_VERT);
}
// Canopy light: the clump edges that turn toward the sun catch a warm rim (strongest when the camera looks into
// the sun), over a faint glow through the leaves. Normals are the dome normals from buildFoliageGeo, in world space.
function applyFoliageSubsurface(mat) {
  mat.onBeforeCompile = (shader) => {
    applyFoliageWind(shader);
    shader.uniforms.uSunDir = foliageSSSUniforms.uSunDir;
    shader.uniforms.uSunCol = foliageSSSUniforms.uSunCol;
    shader.uniforms.uRimK = foliageSSSUniforms.uRimK;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      '#include <common>\nvarying vec3 vWorldPosFol;\nvarying vec3 vNrmFol;'
    ).replace(
      '#include <worldpos_vertex>',
      `#include <worldpos_vertex>
      vec4 wpFol = vec4(transformed, 1.0);
      vec3 nFol = normal;
      #ifdef USE_INSTANCING
        wpFol = instanceMatrix * wpFol;
        nFol = mat3(instanceMatrix) * nFol;
      #endif
      vWorldPosFol = (modelMatrix * wpFol).xyz;
      vNrmFol = normalize(mat3(modelMatrix) * nFol);`
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      '#include <common>\nuniform vec3 uSunDir;\nuniform vec3 uSunCol;\nuniform float uRimK;\nvarying vec3 vWorldPosFol;\nvarying vec3 vNrmFol;'
    ).replace(
      // Light every card by its clump's dome normal. Three flips the normal on back faces, which lit half the
      // cards from the sun side and half from the shade side: that was the beige/green speckle. The normal also
      // leans toward the camera and up, so a low sun behind the trees no longer paints stray cards pale; the
      // sun-side light comes from the rim term below instead.
      '#include <normal_fragment_begin>',
      '#include <normal_fragment_begin>\n#ifndef FLAT_SHADED\n  normal = normalize( normalize( vNormal ) + vec3( 0.0, 0.25, 0.85 ) );\n#endif'
    ).replace(
      '#include <dithering_fragment>',
      `vec3 viewDirFol = normalize(cameraPosition - vWorldPosFol);
      vec3 nrmFol = normalize(vNrmFol);
      float backLight = pow( clamp( dot( viewDirFol, -uSunDir ), 0.0, 1.0 ), 2.2 );
      // the low sun sits over the far bank, so a tree's sun side is its top and the flank toward the middle
      vec3 sunSideDir = normalize( uSunDir + vec3( -vWorldPosFol.x * 0.09, 0.4, 0.0 ) );
      float sunSide = smoothstep( -0.2, 0.6, dot( nrmFol, sunSideDir ) );
      float edgeFol = pow( clamp( 1.0 - abs( dot( nrmFol, viewDirFol ) ), 0.0, 1.0 ), 2.6 );
      vec3 leafGlow = ( diffuseColor.rgb * vec3(0.95, 1.30, 0.80) + uSunCol * dot( diffuseColor.rgb, vec3(1.6) ) ) * 1.6; // the leaf's own colour, warmed by the sun
      gl_FragColor.rgb += leafGlow * ( 0.07 * backLight + uRimK * sunSide * edgeFol * ( 0.35 + 0.65 * backLight ) );
      #include <dithering_fragment>`
    );
  };
  return mat;
}
const FOLIAGE_TEXES = [
  makeFoliageTex(3, ['#1b4a20', '#215526', '#27602b', '#2e6c31', '#1d4f23']),
  makeFoliageTex(5, ['#1f5024', '#265c29', '#2d682e', '#357434', '#225627'])
];
const foliageMats = FOLIAGE_TEXES.map((t) => applyFoliageSubsurface(new THREE.MeshStandardMaterial({
  map: t, alphaTest: 0.46, side: THREE.DoubleSide, vertexColors: true, roughness: 0.88, metalness: 0, color: 0x80ad88, envMapIntensity: 0.28
})));
// Astral Twilight twins of the canopy materials. There the cards are blended, so every overlapping layer is shaded, and
// the standard material's per-pixel lighting was about 3 ms a frame at 2048x1536. These light per vertex (Lambert) with the
// same wind, rim and colours: same picture, about 1.6 ms back. applyMood swaps them onto `foliageMeshes` in the spirit mood.
function makeSpiritTwin(m, color, emissive) {
  const p = new THREE.MeshLambertMaterial({
    map: m.map || null, alphaTest: m.alphaTest, side: m.side, vertexColors: m.vertexColors, color, emissive, transparent: true, opacity: 0.58
  });
  p.onBeforeCompile = (shader) => {
    m.onBeforeCompile(shader); // wind + sun rim, as on the standard material
    // the same dome-normal lean the standard material applies per pixel, and no flipped light on back faces (the speckle)
    shader.vertexShader = shader.vertexShader.replace('#include <defaultnormal_vertex>',
      '#include <defaultnormal_vertex>\n  transformedNormal = normalize( normalize( transformedNormal ) + vec3( 0.0, 0.25, 0.85 ) );');
    shader.fragmentShader = shader.fragmentShader.split('vLightBack').join('vLightFront').split('vIndirectBack').join('vIndirectFront');
  };
  return p;
}
const foliageSpiritMats = foliageMats.map((m) => makeSpiritTwin(m, 0x164058, 0x053a4a));
const foliageMeshes = []; // every canopy and shrub mesh, with userData.folTex = its index into foliageMats
const foliageDepthMats = FOLIAGE_TEXES.map((t) => {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: t, alphaTest: 0.46 });
  m.side = THREE.DoubleSide;
  m.onBeforeCompile = applyFoliageWind; // shadows follow the moving leaves
  return m;
});

function buildFoliageGeo(r, domes, sizeMin, sizeMax) {
  const pos = [], nor = [], uv = [], col = [], idx = [];
  let vi = 0;
  domes.forEach(([cx, cy, cz, rx, ry, rz, puffN]) => {
    let placed = 0, guard = 0;
    while (placed < puffN && guard++ < puffN * 20) {
      const px = (r() * 2 - 1), py = (r() * 2 - 1), pz = (r() * 2 - 1);
      if (px * px + py * py + pz * pz > 1) continue;
      placed++;
      const c = new THREE.Vector3(cx + px * rx, cy + py * ry, cz + pz * rz);
      const s = sizeMin + r() * (sizeMax - sizeMin);
      const ph = r() * Math.PI;
      // Deep interior self-shadowing + warm sunlit crown tops
      const topLight = THREE.MathUtils.clamp(0.48 + py * 0.45 + Math.sqrt(px * px + pz * pz) * 0.22, 0, 1);
      const shade = 0.26 + 0.72 * Math.pow(topLight, 1.15);
      const warmTint = 0.86 + 0.04 * topLight;
      for (let k = 0; k < 3; k++) {
        const a = ph + (k * Math.PI) / 3;
        const tx = Math.cos(a), tz = Math.sin(a);
        const tilt = (r() - 0.5) * 0.55;
        const corners = [[-1, -0.9], [1, -0.9], [1, 0.9], [-1, 0.9]];
        corners.forEach(([u, v], ci) => {
          const vx = c.x + tx * u * s, vy = c.y + v * s + tilt * u * s * 0.3, vz = c.z + tz * u * s;
          pos.push(vx, vy, vz);
          const n = new THREE.Vector3(vx - cx, (vy - cy) * 0.75 + 0.4 * ry, vz - cz).normalize();
          nor.push(n.x, n.y, n.z);
          uv.push(ci === 0 || ci === 3 ? 0 : 1, ci < 2 ? 0 : 1);
          col.push(shade * warmTint, shade, shade * 0.96);
        });
        idx.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
        vi += 4;
      }
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

function buildBroadleaf(x, z, scale, seed, puffN, casts) {
  if (lakeEdge(x, z) < 1.6) return null; // the lake took the old pond's far bank
  const r = mulberry32(seed);
  const grp = new THREE.Group();
  const H = 2.15 + r() * 0.55;
  const tg = new THREE.CylinderGeometry(0.10, 0.25, H, 16, 12);
  const tp = tg.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const py = tp.getY(i);
    const hNorm = (py + H / 2) / H; // 0 at base, 1 at top
    const ang = Math.atan2(tp.getZ(i), tp.getX(i));
    // Flared root buttresses near the ground + organic bark flutes
    const rootFlare = Math.pow(Math.max(0, 1 - hNorm * 3.0), 2.0) * (0.42 + 0.32 * Math.sin(ang * 5 + seed));
    const barkFlute = (nfbm(py * 2.6 + seed, tp.getX(i) * 5 + tp.getZ(i) * 5) - 0.5) * 0.26;
    const k = 1 + rootFlare + barkFlute;
    const bendX = Math.sin(hNorm * Math.PI * 0.85 + seed) * 0.14 * hNorm;
    const bendZ = Math.cos(hNorm * Math.PI * 0.75 + seed * 1.7) * 0.10 * hNorm;
    tp.setX(i, tp.getX(i) * k + bendX);
    tp.setZ(i, tp.getZ(i) * k + bendZ);
  }
  tg.translate(0, H / 2, 0);
  tg.computeVertexNormals();
  const trunk = new THREE.Mesh(tg, barkMat);
  trunk.castShadow = true; trunk.receiveShadow = true;
  grp.add(trunk);

  // Primary gnarled boughs & secondary forks reaching into multi-dome foliage clusters
  const domes = [
    [0, H + 1.18, 0, 1.35, 0.95, 1.35, Math.round(puffN * 0.36)],
    [0, H + 0.52, 0, 1.05, 0.58, 1.05, Math.round(puffN * 0.16)]
  ];
  const limbCount = 5;
  for (let i = 0; i < limbCount; i++) {
    const a = (i / limbCount) * Math.PI * 2 + (r() - 0.5) * 0.45;
    const len = 0.95 + r() * 0.45;
    const tilt = 0.58 + r() * 0.28;
    const startY = H * (0.68 + r() * 0.20);
    const lg = new THREE.CylinderGeometry(0.032, 0.088, len, 9, 5);
    const lp = lg.attributes.position;
    for (let vi = 0; vi < lp.count; vi++) {
      const ly = lp.getY(vi) + len / 2;
      lp.setX(vi, lp.getX(vi) + Math.sin(ly * 2.8 + i) * 0.04);
    }
    lg.translate(0, len / 2, 0);
    lg.computeVertexNormals();
    const limb = new THREE.Mesh(lg, barkMat);
    limb.position.set(0, startY, 0);
    limb.rotation.set(Math.sin(a) * tilt, 0, -Math.cos(a) * tilt);
    limb.castShadow = casts;
    grp.add(limb);

    const ex = Math.cos(a) * Math.sin(tilt) * len;
    const ey = startY + Math.cos(tilt) * len;
    const ez = Math.sin(a) * Math.sin(tilt) * len;
    domes.push([ex * 0.92, ey + 0.15, ez * 0.92, 1.05 + r() * 0.25, 0.78 + r() * 0.18, 1.05 + r() * 0.25, Math.round(puffN * 0.16)]);
  }
  const tex = r() > 0.5 ? 1 : 0;
  const fg = buildFoliageGeo(r, domes, 0.58, 0.96);
  const fol = new THREE.Mesh(fg, foliageMats[tex]);
  fol.receiveShadow = false; fol.userData.folTex = tex; foliageMeshes.push(fol);
  if (casts) { fol.castShadow = true; fol.customDepthMaterial = foliageDepthMats[tex]; }
  grp.add(fol);
  grp.position.set(x, terrainY(x, z) - 0.05, z);
  grp.rotation.y = r() * 6.28;
  grp.scale.setScalar(scale);
  natureGroup.add(grp);
  return grp;
}
// Hero trees framing the left & right flanks + mid-ground lakeside trees so the central sun pass stays open!
[
  [-6.0, -2.8, 0.96, 11], [6.2, -2.3, 0.92, 12],
  [-7.4, -6.2, 1.04, 13], [7.6, -5.8, 1.00, 14],
  [-4.8, -9.8, 0.90, 15], [5.0, -9.6, 0.88, 16],
  [-9.0, 2.0, 0.98, 17], [9.0, 2.5, 0.98, 18],
  [-3.5, -13.2, 0.78, 19], [3.7, -13.0, 0.76, 20],
  [-7.8, -12.4, 0.94, 21], [8.0, -12.2, 0.92, 22]
].forEach(([x, z, s, seed]) => buildBroadleaf(x, z, s, seed, 78, true));

// Low shrubs and lakeside bushes (kept off the front pond bank, framing the far bank & flanks)
{
  const sr = mulberry32(77);
  for (let i = 0; i < 32; i++) {
    let x, z;
    if (i < 12) {
      const a = sr() * Math.PI * 2;
      if (Math.sin(a) > 0.15 && Math.abs(Math.cos(a)) < 0.85) continue;
      if (Math.sin(a) < -0.82 && Math.abs(Math.cos(a)) < 0.36) continue;
      [x, z] = lakeShoreAt(a, 0.9 + sr() * 1.4);
    } else if (i < 22) {
      // Far meadow bank shrubs framing the mountain pass
      const side = (i % 2 === 0) ? -1 : 1;
      x = side * (1.85 + sr() * 4.8);
      z = -9.2 - sr() * 5.2;
    } else {
      const a = sr() * Math.PI * 2;
      const rr = 7.5 + sr() * 5;
      x = Math.cos(a) * rr;
      z = Math.sin(a) * rr;
      if (z < -4 && Math.abs(x) < 3.5) continue;
    }
    if (lakeEdge(x, z) < 0.8) continue;
    const tex = sr() > 0.5 ? 1 : 0;
    const fg = buildFoliageGeo(sr, [[0, 0.34, 0, 0.62, 0.38, 0.62, 14]], 0.25, 0.44);
    const m = new THREE.Mesh(fg, foliageMats[tex]);
    m.userData.folTex = tex; foliageMeshes.push(m);
    m.position.set(x, terrainY(x, z), z);
    m.scale.setScalar(0.78 + sr() * 0.68);
    natureGroup.add(m);
  }
}

// Conifer forest ring (Organic textured evergreen bough clusters — zero geometric cones!)
const pineTex = makeFoliageTex(9, ['#15301a', '#1a381d', '#1f4122', '#254a27', '#17341b']);
const pineGeo = (function () {
  const pr = mulberry32(404);
  const domes = [
    [0, 1.15, 0, 1.12, 0.56, 1.12, 16],
    [0, 1.82, 0, 0.94, 0.52, 0.94, 14],
    [0, 2.45, 0, 0.76, 0.48, 0.76, 12],
    [0, 3.02, 0, 0.58, 0.44, 0.58, 10],
    [0, 3.54, 0, 0.42, 0.40, 0.42, 8],
    [0, 3.98, 0, 0.26, 0.36, 0.26, 6]
  ];
  return buildFoliageGeo(pr, domes, 0.42, 0.74);
})();
const pineMat = applyFoliageSubsurface(new THREE.MeshStandardMaterial({
  map: pineTex, alphaTest: 0.46, vertexColors: true, roughness: 0.90, metalness: 0,
  color: 0x7e9468, side: THREE.DoubleSide, envMapIntensity: 0.24
}));
const pineSpiritMat = makeSpiritTwin(pineMat, 0x143a50, 0x053244);
const PINE_N = 165;
const pines = new THREE.InstancedMesh(pineGeo, pineMat, PINE_N);
{
  const d = new THREE.Object3D(), tint = new THREE.Color();
  let n = 0, tries = 0;
  while (n < PINE_N && tries < 4000) {
    tries++;
    const a = nrng() * Math.PI * 2, r = 13.5 + Math.pow(nrng(), 0.82) * 44;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.hypot(x - POND.cx, z - POND.cz) < 7.5 || lakeEdge(x, z) < 2.0) continue;
    // Keep the central sky & mountain pass vista channel behind the pond open
    if (z < -4 && Math.abs(x) < 4.8 + (-z) * 0.15) continue;
    d.position.set(x, terrainY(x, z) - 0.15, z);
    d.rotation.set((nrng() - 0.5) * 0.06, nrng() * 6.28, (nrng() - 0.5) * 0.06);
    const s = 0.78 + nrng() * 0.72 + r * 0.005;
    d.scale.set(s * (0.88 + nrng() * 0.24), s * (0.92 + nrng() * 0.30), s * (0.88 + nrng() * 0.24));
    d.updateMatrix();
    pines.setMatrixAt(n, d.matrix);
    tint.setHSL(0.26 + nrng() * 0.06, 0.28, 0.62 + nrng() * 0.32);
    pines.setColorAt(n, tint);
    n++;
  }
  pines.count = n;
  pines.frustumCulled = false;
}
natureGroup.add(pines);

// Pine trunks: a short tapered bark stem per pine (same instance matrices), rising from just below the grass into the lowest bough dome
const pineTrunkGeo = new THREE.CylinderGeometry(0.075, 0.15, 1.6, 7, 1, true);
pineTrunkGeo.translate(0, 0.5, 0);
const pineTrunks = new THREE.InstancedMesh(pineTrunkGeo, barkMat, pines.count);
{
  const m = new THREE.Matrix4();
  for (let i = 0; i < pines.count; i++) { pines.getMatrixAt(i, m); pineTrunks.setMatrixAt(i, m); }
  pineTrunks.frustumCulled = false;
  pineTrunks.receiveShadow = true;
}
natureGroup.add(pineTrunks);

// ---- Distant treeline rings: alpha-cut forest silhouettes on the far hills ----
// One strip mesh per ring (cheap); scene fog fades them into the haze so the forest reads as continuing past the pines.
const treelineTex = (function () {
  const W = 4096, H = 256, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d'), tr = mulberry32(777);
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#fff'; g.fillRect(0, H * 0.62, W, H);
  const tree = (cx, h, w, pine) => {
    if (pine) {
      g.beginPath(); g.moveTo(cx, H - h);
      for (let k = 1; k <= 5; k++) { // ragged tiers so the cone reads as boughs
        const y = H - h + (h * 0.78) * k / 5, ww = w * (0.25 + 0.75 * k / 5);
        g.lineTo(cx + ww * 0.5, y); g.lineTo(cx + ww * 0.22, y - 7);
      }
      for (let k = 5; k >= 1; k--) {
        const y = H - h + (h * 0.78) * k / 5, ww = w * (0.25 + 0.75 * k / 5);
        g.lineTo(cx - ww * 0.22, y - 7); g.lineTo(cx - ww * 0.5, y);
      }
      g.closePath(); g.fill();
      g.fillRect(cx - w * 0.5, H - h * 0.25, w, h * 0.25);
    } else {
      for (let k = 0; k < 4; k++) {
        g.beginPath();
        g.arc(cx + (tr() - 0.5) * w * 0.6, H - h * (0.45 + tr() * 0.35), w * (0.32 + tr() * 0.18), 0, Math.PI * 2);
        g.fill();
      }
      g.fillRect(cx - w * 0.45, H - h * 0.5, w * 0.9, h * 0.5);
    }
  };
  for (let x = 0; x < W; x += 34 + tr() * 50) {
    const h = 110 + tr() * 136, pine = tr() > 0.22, w = pine ? 70 + tr() * 50 : 120 + tr() * 80;
    tree(x, h, w, pine);
    if (x < 160) tree(x + W, h, w, pine); else if (x > W - 160) tree(x - W, h, w, pine); // seamless wrap
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
})();
// Each ring has its own colour, set per mood in applyMood: the tree colour sunk into the horizon's haze, more for the far
// ring. Scene fog is off for them: it took both rings to the same fog colour, which read as one flat band under the sky.
const treelineMats = [0, 1].map(() => new THREE.MeshBasicMaterial({
  color: 0x1c2a14, alphaMap: treelineTex, alphaTest: 0.5, vertexColors: true, side: THREE.DoubleSide, fog: false
}));
function buildTreelineRing(radius, height, reps, seed, treelineMat) {
  const SEG = 400, pos = [], col = [], uv = [], idx = [];
  for (let i = 0; i <= SEG; i++) {
    const a = (i / SEG) * Math.PI * 2;
    let x = Math.cos(a) * radius, z = Math.sin(a) * radius;
    if (lakeEdge(x, z) < 4) { // over the lake (05b): stand this stretch on the far shore instead, so the forest still fronts the hills
      const al = Math.atan2(z - POND.cz, x - POND.cx);
      [x, z] = lakeShoreAt(al, 4 + (radius - 66) * 0.5);
      // stay inside the sky dome (144). Each ring keeps its own cap (66 m ring 114, 100 m ring 128): one shared cap put
      // both rings on the same circle across the far shore, where they z-fought and shimmered as the view moved
      const cap = 128 - (100 - radius) * 0.4, rr = Math.hypot(x, z);
      if (rr > cap) { x *= cap / rr; z *= cap / rr; }
    }
    const gy = terrainY(x, z);
    const h = height * (1.0 - 0.45 * vistaFactor(x, z)) * (0.85 + 0.3 * nvn(a * 7.0, seed)); // lower in the vista so the sun stays clear
    const shade = 0.75 + 0.45 * nvn(a * 11.0 + seed, 1.7);
    pos.push(x, gy - 3.0, z, x, gy + h, z);
    col.push(shade * 0.7, shade * 0.7, shade * 0.7, shade * 1.1, shade * 1.1, shade * 1.1);
    uv.push((i / SEG) * reps + seed * 0.37, 0, (i / SEG) * reps + seed * 0.37, 1);
    if (i < SEG) { const b = i * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const m = new THREE.Mesh(geo, treelineMat);
  m.frustumCulled = false;
  natureGroup.add(m);
  return m;
}
buildTreelineRing(66, 9.0, 3, 3.0, treelineMats[0]);
buildTreelineRing(100, 14.0, 3, 8.0, treelineMats[1]);

// ---- Lake bank: pebbles, short tufts and reed clumps along the near shores (the wet earth is in the ground's colours) ----
const bankGroup = new THREE.Group();
natureGroup.add(bankGroup);
{
  const br = mulberry32(2026); // own generator, so the rest of the meadow stays where it was
  const d = new THREE.Object3D(), tint = new THREE.Color();
  // k: the old pond-radius fraction (1 = waterline), now about 3.4 m of bank per unit; only the near shores (the far one is the hills)
  const onBank = (a, k) => lakeR(a) > 22 ? null : lakeShoreAt(a, (k - 1) * 3.4);
  const front = (a) => Math.sin(a) > 0.2 && Math.abs(Math.cos(a)) < 0.86; // the bank the camera looks across

  // Pebbles and small stones, in loose drifts along the waterline
  const pg = new THREE.IcosahedronGeometry(1, 1);
  {
    const p = pg.attributes.position, cols = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const k = 0.8 + 0.4 * nfbm(p.getX(i) * 2.1 + 3, p.getZ(i) * 2.1 + p.getY(i));
      p.setXYZ(i, p.getX(i) * k, Math.max(p.getY(i) * k * 0.55, -0.2), p.getZ(i) * k);
      const v = 0.75 + 0.25 * (p.getY(i) + 1) * 0.5;
      cols[i * 3] = v; cols[i * 3 + 1] = v; cols[i * 3 + 2] = v;
    }
    pg.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    pg.computeVertexNormals();
  }
  const PEB_N = 110;
  const pebbles = new THREE.InstancedMesh(pg, rockMat, PEB_N);
  let n = 0, guard = 0;
  while (n < PEB_N && guard++ < PEB_N * 30) {
    const a = br() * Math.PI * 2;
    if (nfbm(Math.cos(a) * 4.5 + 20, Math.sin(a) * 4.5 + 20) < 0.42 + br() * 0.2) continue; // drifts, not an even necklace
    const pb = onBank(a, 0.985 + br() * br() * 0.10);
    if (!pb) continue;
    const [x, z] = pb;
    const big = br() < 0.14, sz = big ? 0.10 + br() * 0.07 : 0.03 + br() * 0.045;
    d.position.set(x, terrainY(x, z) + 0.008, z);
    d.rotation.set((br() - 0.5) * 0.4, br() * 6.28, (br() - 0.5) * 0.4);
    d.scale.set(sz * (0.8 + br() * 0.6), sz * (0.55 + br() * 0.4), sz * (0.8 + br() * 0.6));
    d.updateMatrix(); pebbles.setMatrixAt(n, d.matrix);
    const v = 0.028 + br() * 0.04;
    pebbles.setColorAt(n, tint.setRGB(v * 1.05, v, v * 0.92)); n++;
  }
  pebbles.count = n; pebbles.frustumCulled = false; pebbles.receiveShadow = true;
  bankGroup.add(pebbles);

  // Short tufts that creep over the bare earth, and reed clumps at the water (low and sparse on the front bank)
  const TUFT_N = 1500, REED_N = 150;
  const edge = new THREE.InstancedMesh(bladeGeo, bladeMat, TUFT_N + REED_N);
  const put = (x, z, sx, sy, lean, h, sat, l) => {
    d.position.set(x, terrainY(x, z), z);
    d.rotation.set((br() - 0.5) * lean, br() * 6.28, (br() - 0.5) * lean);
    d.scale.set(sx, sy, 1); d.updateMatrix(); edge.setMatrixAt(n, d.matrix);
    edge.setColorAt(n, tint.setHSL(h, sat, l)); n++;
  };
  n = 0; guard = 0;
  while (n < TUFT_N && guard++ < TUFT_N * 30) {
    const a = br() * Math.PI * 2, k = 1.0 + br() * 0.085, tb = onBank(a, k);
    if (!tb) continue;
    const [x, z] = tb;
    if (nfbm(x * 1.5 + 3, z * 1.5 - 8) < 0.40 + (1.085 - k) * 2.2) continue; // patchy, thinner toward the water
    put(x, z, 0.7 + br() * 0.4, (0.28 + br() * 0.42) * (front(a) ? 0.8 : 1), 0.3, 0.21 + br() * 0.08, 0.30 + br() * 0.16, 0.24 + br() * 0.18);
  }
  const tuftEnd = n;
  const clumps = [];
  for (let i = 0; i < 15; i++) {
    const a = br() * Math.PI * 2;
    if (front(a) && Math.abs(Math.cos(a)) < 0.42) continue; // keep the middle of the near bank open for the reflection
    if (lakeR(a) > 22) continue;
    clumps.push(a);
  }
  guard = 0;
  while (clumps.length && n < tuftEnd + REED_N && guard++ < REED_N * 20) {
    const a0 = clumps[(br() * clumps.length) | 0], a = a0 + (br() - 0.5) * 0.11;
    const cb = onBank(a, 0.965 + br() * 0.07);
    if (!cb) continue;
    const [x, z] = cb;
    put(x, z, 0.8 + br() * 0.4, (1.2 + br() * 1.3) * (front(a0) ? 0.62 : 1), 0.2, 0.19 + br() * 0.07, 0.30 + br() * 0.16, 0.24 + br() * 0.2);
  }
  edge.count = n; edge.frustumCulled = false; edge.receiveShadow = true;
  bankGroup.add(edge);
}

// The lake: water depth on the water grid and the rocky bank stepping down to it (05b)
dressLake(natureGroup);

// ---- Fireflies: a few small ones low over the pond and in meadow patches on the flanks. None over the hearth
// ---- or between it and the usual cameras, so they never sit on George's or the Witness's face.
const FLY_N = 56, FLY_SIZE = 0.085, FLY_SIZE_SPIRIT = 0.17;
const flyBase = new Float32Array(FLY_N * 4);
const flyGeo = new THREE.BufferGeometry();
flyGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(FLY_N * 3), 3));
for (let i = 0; i < 600; i++) nrng(); // the old 150 flies drew 600 numbers here; keep everything seeded after them in place
{
  const fr = mulberry32(5150);
  const patches = [[-5.4, 1.2], [5.2, 0.6], [-4.6, 4.4], [4.8, 4.2], [-6.8, -2.6], [7.0, -2.4]];
  let i = 0, guard = 0;
  while (i < FLY_N && guard++ < 4000) {
    let x, y, z;
    if (i < FLY_N * 0.5) { // over the water, thicker toward the far bank
      const a = fr() * Math.PI * 2, k = Math.sqrt(fr()) * 0.96;
      x = POND.cx + Math.cos(a) * POND.rx * k; z = POND.cz + Math.sin(a) * POND.rz * k - 0.4;
      y = 0.28 + fr() * fr() * 1.1;
      if (z > -2.4 && Math.abs(x) < 2.4) continue; // not right behind the two of them
    } else {
      const c = patches[(fr() * patches.length) | 0];
      x = c[0] + (fr() + fr() - 1) * 1.6; z = c[1] + (fr() + fr() - 1) * 1.6;
      y = 0.3 + fr() * 0.75;
      if (Math.hypot(x, z) < 3.4) continue;
    }
    flyBase[i * 4] = x; flyBase[i * 4 + 1] = y; flyBase[i * 4 + 2] = z; flyBase[i * 4 + 3] = fr() * 100;
    i++;
  }
}
const flyMat = new THREE.PointsMaterial({
  size: FLY_SIZE, map: goldGlowTex, color: 0xfff3a0, transparent: true, opacity: 0.2,
  depthWrite: false, blending: THREE.AdditiveBlending
});
const fireflies = new THREE.Points(flyGeo, flyMat);
fireflies.frustumCulled = false;
natureGroup.add(fireflies);

// ---- Crepuscular Golden-Hour Sunbeams slanting through the central tree gap ----
const sunbeamUniforms = {
  uColor: { value: new THREE.Color(0xffb86c) },
  uOpacity: { value: 0.085 }
};
const sunbeamMat = new THREE.ShaderMaterial({
  uniforms: sunbeamUniforms,
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
  blending: THREE.AdditiveBlending,
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    uniform vec3 uColor;
    uniform float uOpacity;
    void main() {
      float edgeX = sin(vUv.x * 3.14159265);
      float fadeY = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.25, vUv.y);
      float a = pow(edgeX, 2.2) * fadeY * uOpacity;
      gl_FragColor = vec4(uColor * a, a);
    }
  `
});
const sunbeamGroup = new THREE.Group();
[
  [-1.8, 2.1, -6.2, 2.2, 6.8, -0.32, 0.28],
  [-0.4, 2.3, -6.6, 2.6, 7.2, -0.10, 0.30],
  [ 1.1, 2.2, -6.4, 2.3, 6.9,  0.14, 0.28]
].forEach(([bx, by, bz, bw, bh, rotZ, rotX]) => {
  const bm = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), sunbeamMat);
  bm.position.set(bx, by, bz);
  bm.rotation.set(rotX, 0, rotZ);
  sunbeamGroup.add(bm);
});
natureGroup.add(sunbeamGroup);

// ---- Spirit world extras (Astral Twilight): drifting wisps, ground-bloom lights, pillars of light ----
const spiritGroup = new THREE.Group();
spiritGroup.visible = false;
natureGroup.add(spiritGroup);
const softGlowTex = createGlowTexture('rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0.26)');
const SP_WISP_N = 110, SP_BLOOM_N = 90;
function makeSpiritPoints(n, size, opacity, place) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), base = new Float32Array(n * 4);
  const pal = [new THREE.Color(0x6ee7ff), new THREE.Color(0xc4a8ff), new THREE.Color(0x7dffd2), new THREE.Color(0xff9be8)];
  for (let i = 0; i < n; i++) {
    place(base, i);
    const c = pal[Math.floor(nrng() * pal.length)];
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size, map: softGlowTex, vertexColors: true, transparent: true, opacity,
    depthWrite: false, blending: THREE.AdditiveBlending
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  spiritGroup.add(pts);
  return { geo, base, mat, opacity };
}
const spiritWisps = makeSpiritPoints(SP_WISP_N, 0.42, 0.9, (b, i) => {
  const a = nrng() * Math.PI * 2, r = 1.2 + Math.sqrt(nrng()) * 13;
  b[i * 4] = Math.cos(a) * r; b[i * 4 + 1] = nrng() * 5.5; b[i * 4 + 2] = Math.sin(a) * r - 2; b[i * 4 + 3] = nrng() * 100;
});
const spiritBlooms = makeSpiritPoints(SP_BLOOM_N, 0.30, 0.95, (b, i) => {
  let x, z, tries = 0;
  do { const a = nrng() * Math.PI * 2, r = 2.2 + nrng() * 8.5; x = Math.cos(a) * r; z = Math.sin(a) * r - 1.5; tries++; }
  while (tries < 20 && lakeEdge(x, z) < 0.5);
  b[i * 4] = x; b[i * 4 + 1] = 0.06 + nrng() * 0.34; b[i * 4 + 2] = z; b[i * 4 + 3] = nrng() * 100;
});
// Tall soft pillars of light rising from the ground, like the spirits of the trees
const spiritPillarUniforms = { uColor: { value: new THREE.Color(0x8fb4ff) }, uOpacity: { value: 0.16 } };
const spiritPillarMat = sunbeamMat.clone();
spiritPillarMat.uniforms = spiritPillarUniforms;
[[-5.2, -8.5, 7], [4.8, -9.5, 8], [-8.6, -4.8, 6], [8.4, -5.6, 7], [-2.8, -12.5, 9], [2.6, -13, 8.5], [-11, -9, 8], [11.5, -10, 8]].forEach(([px, pz, ph], i) => {
  for (let k = 0; k < 2; k++) {
    const pm = new THREE.Mesh(new THREE.PlaneGeometry(1.4 + (i % 3) * 0.3, ph), spiritPillarMat);
    pm.position.set(px, ph / 2 - 0.2, pz);
    pm.rotation.y = k * Math.PI / 2 + i * 0.4;
    spiritGroup.add(pm);
  }
});
function updateSpiritWorld(t) {
  const w = spiritWisps, wa = w.geo.attributes.position.array;
  for (let i = 0; i < SP_WISP_N; i++) {
    const ph = w.base[i * 4 + 3];
    wa[i * 3] = w.base[i * 4] + Math.sin(t * 0.22 + ph) * 1.2;
    wa[i * 3 + 1] = (w.base[i * 4 + 1] + t * (0.07 + (ph % 7) * 0.012)) % 5.8;
    wa[i * 3 + 2] = w.base[i * 4 + 2] + Math.cos(t * 0.19 + ph * 0.7) * 1.2;
  }
  w.geo.attributes.position.needsUpdate = true;
  const b = spiritBlooms, ba = b.geo.attributes.position.array;
  for (let i = 0; i < SP_BLOOM_N; i++) {
    ba[i * 3] = b.base[i * 4]; ba[i * 3 + 2] = b.base[i * 4 + 2];
    ba[i * 3 + 1] = b.base[i * 4 + 1] + Math.sin(t * 0.8 + b.base[i * 4 + 3]) * 0.04;
  }
  b.geo.attributes.position.needsUpdate = true;
  b.mat.opacity = b.opacity * (0.72 + 0.28 * Math.sin(t * 1.3));
  spiritPillarUniforms.uOpacity.value = 0.2 + 0.05 * Math.sin(t * 0.5);
  // foliage glow breathes slowly, each species on its own phase
  foliageMats.forEach((fm, i) => { fm.emissiveIntensity = foliageSpiritMats[i].emissiveIntensity = 0.85 + 0.3 * Math.sin(t * 0.7 + i * 1.3); });
  pineMat.emissiveIntensity = pineSpiritMat.emissiveIntensity = 0.85 + 0.3 * Math.sin(t * 0.6 + 2.0);
  // slow ghostly shimmer in how solid the foliage is
  foliageMats.forEach((fm, i) => { fm.opacity = foliageSpiritMats[i].opacity = 0.58 + 0.07 * Math.sin(t * 0.45 + i * 1.7); });
  pineMat.opacity = pineSpiritMat.opacity = 0.58 + 0.07 * Math.sin(t * 0.4 + 1.0);
  bladeMat.opacity = 0.62 + 0.05 * Math.sin(t * 0.5);
}
const defaultFoliageCol = foliageMats[0].color.getHex(), defaultPineCol = pineMat.color.getHex(), defaultBladeCol = bladeMat.color.getHex();

// ---- The original floating-island sanctuary props are no longer used by any mood: remove them -------------
const keepNodes = new Set([hearthGroup, spiritFloatGroup, thoughtSwarmGroup, bridgeGroup, waterPoolMesh, georgeContactShadow, georgeLogSeat]);
const cosmicProps = sanctuaryGroup.children.filter((o) => {
  if (keepNodes.has(o)) return false;
  if (astralBirds.some((b) => b.pivot === o)) return false; // birds fly in every mood; updateNature restyles them
  let skinned = false;
  o.traverse((c) => { if (c.isSkinnedMesh) skinned = true; });
  return !skinned;
});
cosmicProps.forEach((o) => sanctuaryGroup.remove(o));
skyDome.scale.setScalar(1.7);

// ---- Per-mood environment maps (so PBR surfaces pick up the right sky) ------
function makeEnvTexture(zenHex, horHex, gndHex) {
  const pm = new THREE.PMREMGenerator(renderer);
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(
    new THREE.SphereGeometry(20, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: { z: { value: new THREE.Color(zenHex) }, h: { value: new THREE.Color(horHex) }, g: { value: new THREE.Color(gndHex) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'varying vec3 vP; uniform vec3 z; uniform vec3 h; uniform vec3 g; void main(){ float y = vP.y; vec3 c = y < 0.0 ? mix(h, g, clamp(-y * 2.0, 0.0, 1.0)) : mix(h, z, pow(y, 0.55)); gl_FragColor = vec4(c, 1.0); }'
    })
  ));
  const rt = pm.fromScene(s, 0.04);
  pm.dispose();
  return rt.texture;
}
const envCache = {};

// ---- Moods (Sun positioned in the central clearing gap over the pond so solar disc, clouds & water reflection shine) ----
const MOODS = [
  { name: 'Golden Hour', tree: 0x22301a, nature: 1, sun: [-0.05, 0.115, -0.99], sunCol: 0xffa84c, sunInt: 1.42,
    hemiSky: 0xbfd2ff, hemiGnd: 0x4a3b22, hemiInt: 0.44, horizon: 0xf4a868, zenith: 0x2456b8, gnd: 0x2e2e14,
    fog: 0xd49a6a, fogD: 0.0115, exposure: 0.86, bloom: 30, flies: 0.16, fire: 1.9, gSat: 0.85, gDim: 0.9,
    gSun: 1.0, amb: [0.18, 0.24, 0.36], grd: [0.18, 0.13, 0.07] },
  { name: 'Misty Dawn', tree: 0x2c3a2c, nature: 1, sun: [0.06, 0.105, -0.99], sunCol: 0xffcfa0, sunInt: 1.08,
    hemiSky: 0xd8e4f0, hemiGnd: 0x444d3b, hemiInt: 0.54, horizon: 0xe6b8a6, zenith: 0x426fa8, gnd: 0x2f3828,
    fog: 0xc2b8bc, fogD: 0.019, exposure: 0.90, bloom: 26, flies: 0.06, fire: 1.5, gSat: 0.75, gDim: 0.95,
    gSun: 0.84, amb: [0.24, 0.28, 0.36], grd: [0.14, 0.16, 0.11] },
  { name: 'Blue Dusk', tree: 0x0e1714, nature: 1, sun: [-0.04, 0.085, -0.99], sunCol: 0xe88b68, sunInt: 0.76,
    hemiSky: 0x5c74b8, hemiGnd: 0x141b12, hemiInt: 0.52, horizon: 0x8c5268, zenith: 0x0c1b48, gnd: 0x101612,
    fog: 0x283252, fogD: 0.0155, exposure: 1.08, bloom: 40, flies: 0.95, fire: 2.8, gSat: 0.55, gDim: 0.62, witnessGlow: 1.5,
    gSun: 0.60, amb: [0.10, 0.14, 0.28], grd: [0.05, 0.06, 0.07] },
  // Spirit world: the woods re-lit in indigo and teal with a great pale moon, aurora, glowing foliage and drifting wisps
  { name: 'Astral Twilight', tree: 0x050a24, nature: 1, stars: 1, spirit: 1, sun: [-0.22, 0.30, -0.93], sunCol: 0x6ad8ff, sunInt: 0.5,
    hemiSky: 0x2a5ae0, hemiGnd: 0x043a40, hemiInt: 0.5, horizon: 0x1a2a8a, zenith: 0x02041a, gnd: 0x061a30,
    fog: 0x06143a, fogD: 0.022, exposure: 1.05, bloom: 50, flies: 1.0, fire: 3.4,
    gSun: 0.42, amb: [0.08, 0.16, 0.34], grd: [0.03, 0.10, 0.14] },
  // Night: cool moonlight and deep blue sky, with the campfire as the main warm light
  { name: 'Moonlit Night', tree: 0x070c10, nature: 1, stars: 1, sun: [0.18, 0.28, -0.94], sunCol: 0x9db8ff, sunInt: 0.34,
    hemiSky: 0x24346a, hemiGnd: 0x07090f, hemiInt: 0.34, horizon: 0x16224a, zenith: 0x02040e, gnd: 0x05070a,
    fog: 0x0a1230, fogD: 0.017, exposure: 1.22, bloom: 46, flies: 1.0, fire: 4.6, gSat: 0.40, gDim: 0.50, witnessGlow: 1.8,
    gSun: 0.30, amb: [0.05, 0.07, 0.15], grd: [0.02, 0.025, 0.04] }
];

function applyMood(i) {
  moodIdx = ((i % MOODS.length) + MOODS.length) % MOODS.length;
  const m = MOODS[moodIdx];
  natureOn = !!m.nature;
  const sun = new THREE.Vector3(m.sun[0], m.sun[1], m.sun[2]).normalize();

  moonLight.position.copy(sun).multiplyScalar(16);
  moonLight.color.setHex(m.sunCol);
  moonLight.intensity = m.sunInt;
  hemiLight.color.setHex(m.hemiSky);
  hemiLight.groundColor.setHex(m.hemiGnd);
  hemiLight.intensity = m.hemiInt;
  scene.fog.color.setHex(m.fog);
  if (natureOn && scene.fog.color.convertSRGBToLinear) scene.fog.color.convertSRGBToLinear();
  scene.fog.density = m.fogD;
  fireBase = m.fire;
  bladeFX.uSat.value = m.gSat !== undefined ? m.gSat : 1; bladeFX.uDim.value = m.gDim !== undefined ? m.gDim : 1;
  moodExposure = m.exposure;
  compositeMat.uniforms.uExposure.value = moodExposure * exposureTrim;
  flyMat.opacity = m.flies;

  const spirit = !!m.spirit;
  const soft = natureOn && !spirit; // the Witness is toned down in the daylight woods, but stays luminous in the spirit world
  skyUniforms.uNature.value = natureOn ? 1 : 0;
  skyUniforms.uSpirit.value = spirit ? 1 : 0;
  skyUniforms.uSunDir.value.copy(sun);
  skyUniforms.uSunCol.value.setHex(m.sunCol);
  skyUniforms.uHorizon.value.setHex(m.horizon);
  skyUniforms.uZenith.value.setHex(m.zenith);
  if (natureOn && skyUniforms.uZenith.value.convertSRGBToLinear) {
    skyUniforms.uSunCol.value.convertSRGBToLinear();
    skyUniforms.uHorizon.value.convertSRGBToLinear();
    skyUniforms.uZenith.value.convertSRGBToLinear();
  }

  waterUniforms.uNature.value = natureOn ? 1 : 0;
  waterUniforms.uSunDir.value.copy(sun);
  waterUniforms.uSunCol.value.setHex(m.sunCol);
  waterPoolMesh.position.set(0, LAKE_Y, 0); // the lake grid is already in world x/z (05b)

  const gu = georgeMakerShader.uniforms;
  gu.uSunDir.value.copy(sun);
  gu.uSunCol.value.setHex(m.sunCol);
  if (gu.uSunCol.value.convertSRGBToLinear) gu.uSunCol.value.convertSRGBToLinear();
  gu.uSunCol.value.multiplyScalar(m.gSun);
  gu.uAmbCol.value.set(m.amb[0], m.amb[1], m.amb[2]);
  gu.uGndCol.value.set(m.grd[0], m.grd[1], m.grd[2]);

  sunbeamUniforms.uColor.value.setHex(m.sunCol);
  if (sunbeamUniforms.uColor.value.convertSRGBToLinear) sunbeamUniforms.uColor.value.convertSRGBToLinear();
  sunbeamUniforms.uOpacity.value = m.spirit ? 0.06 : m.stars ? 0.0 : natureOn ? (moodIdx === 0 ? 0.075 : (moodIdx === 1 ? 0.095 : 0.035)) : 0.0;

  foliageSSSUniforms.uSunDir.value.copy(sun);
  foliageSSSUniforms.uSunCol.value.setHex(m.sunCol);
  if (foliageSSSUniforms.uSunCol.value.convertSRGBToLinear) foliageSSSUniforms.uSunCol.value.convertSRGBToLinear();

  // Tone down cosmic spirit effects in natural moods so the Witness feels organically woven into nature
  spiritBodyUniforms.uNature.value = soft ? 1.0 : 0.0;
  godRayUniforms.uNature.value = soft ? 1.0 : 0.0;
  haloRing1.material.opacity = soft ? 0.10 : 0.55;
  haloRing1.material.color.setHex(soft ? 0xbae6fd : 0xfde6b0);
  haloRing2.material.opacity = soft ? 0.08 : 0.45;
  haloRing2.material.color.setHex(soft ? 0xfde68a : 0xc4c8ff);
  haloRing3.material.opacity = soft ? 0.04 : 0.35;
  haloRing3.material.color.setHex(soft ? 0xfef3c7 : 0xfff1d0);
  tetraUp.material.opacity = soft ? 0.35 : 1.0;
  tetraUp.material.transparent = true;
  tetraDown.material.opacity = soft ? 0.35 : 1.0;
  tetraDown.material.transparent = true;
  spiritMotes.forEach((sm, idx) => {
    sm.sprite.material.opacity = soft ? (idx % 3 === 2 ? 0.0 : 0.32) : 0.85;
  });
  bridgeNodes.forEach((bn) => {
    bn.sprite.material.opacity = soft ? 0.34 : 0.88;
  });
  spiritLight.color.setHex(soft ? 0x93c5fd : 0x38bdf8);
  spiritLight.intensity = soft ? (m.witnessGlow || 0.85) : spirit ? 1.7 : 2.2; // witnessGlow: the Witness lights the bank at dusk and night

  {
    const hazeC = new THREE.Color(m.horizon).lerp(new THREE.Color(m.fog), 0.35);
    treelineMats.forEach((tm, k) => {
      tm.color.setHex(m.tree).lerp(hazeC, k ? 0.58 : 0.26);
      if (tm.color.convertSRGBToLinear) tm.color.convertSRGBToLinear();
    });
  }
  natureGroup.visible = natureOn;
  spiritGroup.visible = spirit;
  // Spirit world re-tints the woods: indigo-teal foliage and grass with a faint inner glow, cyan fireflies
  foliageMats.forEach((fm) => { fm.color.setHex(spirit ? 0x164058 : defaultFoliageCol); fm.emissive.setHex(spirit ? 0x053a4a : 0x000000); });
  pineMat.color.setHex(spirit ? 0x143a50 : defaultPineCol); pineMat.emissive.setHex(spirit ? 0x053244 : 0x000000);
  bladeMat.color.setHex(spirit ? 0x1a7f90 : defaultBladeCol); bladeMat.emissive.setHex(spirit ? 0x04343a : 0x000000);
  flyMat.map = spirit ? softGlowTex : goldGlowTex;
  flyMat.color.setHex(spirit ? 0x7dffe8 : 0xfff3a0);
  flyMat.size = spirit ? FLY_SIZE_SPIRIT : FLY_SIZE;
  flyMat.needsUpdate = true;
  // A faint ghostly fade on the foliage and grass, like the Witness's glass body
  [...foliageMats, pineMat].forEach((fm) => { fm.transparent = spirit; fm.opacity = spirit ? 0.58 : 1; fm.needsUpdate = true; });
  foliageMeshes.forEach((fm) => { fm.material = (spirit ? foliageSpiritMats : foliageMats)[fm.userData.folTex]; }); // cheaper twins while blended
  pines.material = spirit ? pineSpiritMat : pineMat;
  if (lakeShorePines) lakeShorePines.material = pines.material; // 05b's shore pines
  bladeMat.transparent = spirit; bladeMat.opacity = spirit ? 0.62 : 1; bladeMat.needsUpdate = true;
  spiritPillarUniforms.uColor.value.setHex(0x40ffd0);
  fireSpiritTarget = spirit ? 1 : 0;
  foliageSSSUniforms.uSunCol.value.setHex(spirit ? 0x7fd8ff : m.sunCol);
  if (!spirit && foliageSSSUniforms.uSunCol.value.convertSRGBToLinear) foliageSSSUniforms.uSunCol.value.convertSRGBToLinear();
  foliageSSSUniforms.uRimK.value = m.rim !== undefined ? m.rim : 0.32;
  barkFX.uSunDir.value.copy(sun); barkFX.uSunCol.value.copy(foliageSSSUniforms.uSunCol.value); barkFX.uRimK.value = foliageSSSUniforms.uRimK.value * 1.6;
  starField.visible = !!m.stars;
  brazierRing.visible = true;
  georgeContactShadow.position.y = 0.02;
  basaltMat.color.setHex(0x28231e); basaltMat.roughness = 0.92; basaltMat.metalness = 0.02;

  if (!envCache[moodIdx]) envCache[moodIdx] = makeEnvTexture(m.zenith, m.horizon, m.gnd);
  scene.environment = envCache[moodIdx];

  const slider = document.getElementById('bloom-slider');
  if (slider) slider.value = m.bloom;
  onBloomSlider(m.bloom);
  const btn = document.getElementById('btn-mood');
  if (btn) btn.textContent = `🎨 Mood: ${m.name} (L)`;
}
function cycleSceneMood() { applyMood(moodIdx + 1); }

// Smooth mood change: light swells (exposure + bloom) to a luminous whiteout, the mood swaps at the peak, then it settles.
// Used by beats with `mood: N` (e.g. woods -> spirit world, mood 3). Ticked from updateNature.
let moodTrans = null;
let fireSpiritTarget = 0, fireSpiritCur = 0;
function transitionToMood(i, secs) {
  const target = ((i % MOODS.length) + MOODS.length) % MOODS.length;
  if (target === moodIdx && !moodTrans) return;
  moodTrans = { target, dur: Math.max(0.6, secs || 3.2), t0: performance.now(), swapped: false };
  // a camera beat through the whiteout: crane up into the spirit world, pull back out of it (spec 4b rule 6)
  pendingMoodCam = { type: target === 3 ? 'crane' : 'pull', secs: moodTrans.dur };
}
function tickMoodTransition() {
  if (!moodTrans) return;
  const u = Math.min(1, (performance.now() - moodTrans.t0) / 1000 / moodTrans.dur);
  if (u >= 0.5 && !moodTrans.swapped) { moodTrans.swapped = true; applyMood(moodTrans.target); }
  const k = Math.sin(Math.min(u, 1) * Math.PI);          // 0 -> 1 -> 0
  const f = k * k;
  compositeMat.uniforms.uExposure.value = moodExposure * exposureTrim * (1 + 2.2 * f);
  compositeMat.uniforms.uBloomStrength.value = bloomStrength * (1 + 1.4 * f);
  if (u >= 1) {
    compositeMat.uniforms.uExposure.value = moodExposure * exposureTrim;
    compositeMat.uniforms.uBloomStrength.value = bloomStrength;
    moodTrans = null;
  }
}

let birdStyleKey = -1;
const fireTealLight = new THREE.Color(0x2fe0ff), fireOrangeLight = new THREE.Color(0xff7b1c), fireWhite = new THREE.Color(0xffffff), fireCyanEmi = new THREE.Color(0x30d0ff), coalOrange = new THREE.Color(0xd9480f), coalCyan = new THREE.Color(0x0aa8d0);
function updateFireLook() {
  fireSpiritCur += (fireSpiritTarget - fireSpiritCur) * 0.04;
  if (Math.abs(fireSpiritTarget - fireSpiritCur) < 0.002) fireSpiritCur = fireSpiritTarget;
  const k = fireSpiritCur;
  fireShaderUniforms.uSpirit.value = k;
  fireLight.color.copy(fireOrangeLight).lerp(fireTealLight, k);
  hearthGlow.material.color.setHex(0xff7a1a).lerp(fireTealLight, k);
  fireHalo.material.color.setHex(0xff8a2a).lerp(fireTealLight, k); firePool.material.color.setHex(0xff7a1a).lerp(fireTealLight, k);
  coalBed.material.emissive.copy(coalOrange).lerp(coalCyan, k);
  charredLogMat.emissive.copy(fireWhite).lerp(fireCyanEmi, k);
  risingEmbers.forEach((e, i) => e.sprite.material.color.setHex(i % 2 === 0 ? 0xfef08a : 0xf97316).lerp(i % 2 === 0 ? fireWhite : fireTealLight, k));
}
let windLastT = null;
function updateNature(t) {
  // the wind clock is integrated, so a storm can speed it up (galeU) without the sway jumping phase
  windU.value += windLastT === null ? t : Math.max(0, Math.min(0.1, t - windLastT)) * (1 + 1.5 * galeU.value); windLastT = t;
  updateFireLook();
  tickMoodTransition();
  const spirit = !!(MOODS[moodIdx] && MOODS[moodIdx].spirit);
  if (spirit) updateSpiritWorld(t);
  if (natureOn) {
    const arr = flyGeo.attributes.position.array;
    for (let i = 0; i < FLY_N; i++) {
      const ph = flyBase[i * 4 + 3];
      arr[i * 3] = flyBase[i * 4] + Math.sin(t * 0.35 + ph) * 0.45;
      arr[i * 3 + 1] = flyBase[i * 4 + 1] + Math.sin(t * 0.6 + ph * 1.7) * 0.16;
      arr[i * 3 + 2] = flyBase[i * 4 + 2] + Math.cos(t * 0.3 + ph * 0.7) * 0.45;
    }
    flyGeo.attributes.position.needsUpdate = true;
  }
  // George stands directly on the grass in the natural moods
  const gy = natureOn ? 0.0 : 0.06;
  if (typeof xbotHumanModel !== 'undefined' && xbotHumanModel) xbotHumanModel.position.y = gy;
  // Birds read as graceful distant silhouettes in the natural moods, looping over the open vista
  // channel behind the pond (no pines or hero trees there), sized up so they read at ~20m and keep >1.7m from any canopy
  const key = spirit ? 2 : natureOn ? 1 : 0;
  if (astralBirds.length && birdStyleKey !== key + astralBirds.length * 10) {
    birdStyleKey = key + astralBirds.length * 10;
    const natural = [0x1b2028, 0x261f1c];
    const ghost = [0xa5f3fc, 0xe9d5ff];
    const astral = [0x38bdf8, 0xfbbf24];
    astralBirds.forEach((b, idx) => {
      const mesh = b.pivot.children[0];
      if (!b.baseScale && mesh) b.baseScale = mesh.scale.x;
      if (!b.baseRadius) { b.baseRadius = b.radius; b.baseHeight = b.height; }
      if (mesh && mesh.material) {
        mesh.material.color.setHex((spirit ? ghost : natureOn ? natural : astral)[idx % 2]);
        if (natureOn && !spirit) mesh.material.color.convertSRGBToLinear();
        mesh.material.opacity = natureOn ? 0.88 : 0.85;
        if (b.baseScale) mesh.scale.setScalar(b.baseScale * (natureOn ? 1.4 : 1.0));
      }
      // White head and tail: pale in the woods moods, a glowing white in Astral Twilight
      if (b.accent) {
        b.accent.color.setHex(natureOn ? 0xe6e1d6 : 0xffffff);
        if (natureOn) b.accent.color.convertSRGBToLinear();
        b.accent.opacity = 0.9;
      }
      if (b.baseRadius) {
        const w = [[0.0, -20.0, 3.2, 2.4, 5.2], [0.3, -19.0, 3.0, 2.4, 5.9]][idx % 2]; // cx, cz, rx, rz, height
        b.cx = natureOn ? w[0] : 0;
        b.cz = natureOn ? w[1] : 0;
        b.radius = natureOn ? w[2] : b.baseRadius;
        b.rz = natureOn ? w[3] : b.baseRadius;
        b.height = natureOn ? w[4] : b.baseHeight;
      }
    });
  }
}
function setReflectionPassVisibility(visible) {
  grassBlades.visible = visible;
  flowers.visible = visible;
  reeds.visible = visible;
  lilyGroup.visible = visible;
  rocksGroup.visible = visible;
  bankGroup.visible = visible;
  fireflies.visible = visible;
  georgeContactShadow.visible = visible;
}
