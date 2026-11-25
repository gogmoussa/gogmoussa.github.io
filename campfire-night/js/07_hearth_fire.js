// © 2026 George Moussa. All rights reserved.
// ============================================================================
// 7. CENTER HEARTH: CHARRED LOGS, GLOWING COALS & VOLUMETRIC FIRE SHADER
// ============================================================================
const hearthGroup = new THREE.Group();
hearthGroup.position.set(HEARTH.x, 0, HEARTH.z);   // HEARTH lives in 05 (camp mode moves it)
sanctuaryGroup.add(hearthGroup);

// Traditional fieldstone fire ring (a Group so the nature toggle can still hide it)
const brazierRing = new THREE.Group();
// A faint warm emissive floor: the faces turned away from the fire only see the blue night sky, and without it they
// went navy and read like a gap under the fire (camp audit, Nov 24 2026). With it they read as dark stone in shadow.
const stoneMat = new THREE.MeshStandardMaterial({ color: 0x12100e, emissive: 0x0a0705, roughness: 0.95, metalness: 0.0, envMapIntensity: 0.1, flatShading: true });
const STONE_COUNT = 11;
for (let i = 0; i < STONE_COUNT; i++) {
  const a = (i / STONE_COUNT) * Math.PI * 2;
  const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2, 0), stoneMat);
  const k = 0.85 + 0.3 * Math.abs(Math.sin(i * 12.9898));
  stone.scale.set(1.2 * k, 0.6 * k, 0.9 * k);
  stone.rotation.set(0, a + Math.PI / 2, 0);
  stone.position.set(Math.cos(a) * 0.56, 0.11, Math.sin(a) * 0.56);
  stone.castShadow = true;
  stone.receiveShadow = true;
  brazierRing.add(stone);
}
hearthGroup.add(brazierRing);

const FIRE_SCALE = 0.75; // logs, coals and flames relative to the original
const coalBed = new THREE.Mesh(
  new THREE.CylinderGeometry(0.30 * FIRE_SCALE, 0.36 * FIRE_SCALE, 0.05, 28),
  new THREE.MeshStandardMaterial({
    color: 0x0c0908,
    emissive: 0xd9480f,
    emissiveIntensity: 2.4,
    roughness: 0.95,
    envMapIntensity: 0.15
  })
);
coalBed.position.y = 0.025;
hearthGroup.add(coalBed);

// Procedural charred-bark textures: dark char + ash patches, with glowing ember cracks as the emissive map
function makeLogTextures() {
  const W = 128, H = 256;
  const col = document.createElement('canvas'); col.width = W; col.height = H;
  const emi = document.createElement('canvas'); emi.width = W; emi.height = H;
  const c = col.getContext('2d'), e = emi.getContext('2d');
  c.fillStyle = '#17100b'; c.fillRect(0, 0, W, H);
  e.fillStyle = '#000'; e.fillRect(0, 0, W, H);
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 90; i++) {            // grey ash / lighter char flecks
    const g = 28 + rnd() * 40;
    c.fillStyle = `rgba(${g},${g * 0.9},${g * 0.8},${0.15 + rnd() * 0.25})`;
    c.fillRect(rnd() * W, rnd() * H, 2 + rnd() * 10, 4 + rnd() * 22);
  }
  for (let i = 0; i < 46; i++) {            // vertical bark cracks that glow from within
    let x = rnd() * W, y = rnd() * H;
    const len = 20 + rnd() * 60, bright = 0.35 + rnd() * 0.65;
    c.strokeStyle = '#050302'; c.lineWidth = 2.4;
    e.strokeStyle = `rgba(255,${Math.floor(70 + rnd() * 70)},12,${bright})`; e.lineWidth = 1.2 + rnd() * 1.2;
    c.beginPath(); e.beginPath(); c.moveTo(x, y); e.moveTo(x, y);
    for (let k = 0; k < len; k += 6) { x += (rnd() - 0.5) * 5; y += 6; c.lineTo(x, y); e.lineTo(x, y); }
    c.stroke(); e.stroke();
  }
  const mk = (cv, srgb) => {
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (srgb && THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
    return t;
  };
  return { map: mk(col, true), emissiveMap: mk(emi, true) };
}
const logTex = makeLogTextures();
const charredLogMat = new THREE.MeshStandardMaterial({
  map: logTex.map,
  bumpMap: logTex.map,
  bumpScale: 1.5,
  emissive: 0xffffff,
  emissiveMap: logTex.emissiveMap,
  emissiveIntensity: 1.25,
  roughness: 0.95,
  metalness: 0.0,
  envMapIntensity: 0.15
});

// Knobbly log: cylinder with lumpy radial displacement, flared ends and a charred, rounded cut face
function buildLogGeometry(rTop, rBot, len, seed) {
  const g = new THREE.CylinderGeometry(rTop, rBot, len, 16, 10);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 1e-5) continue;
    const a = Math.atan2(z, x);
    const lump = 1 + 0.10 * Math.sin(a * 3 + y * 9 + seed) + 0.06 * Math.sin(a * 7 - y * 17 + seed * 2.3);
    const end = Math.abs(y) / (len / 2);
    const burn = 1 - 0.22 * Math.pow(end, 6);   // burnt ends thin toward a point
    pos.setXYZ(i, x * lump * burn, y, z * lump * burn);
  }
  g.computeVertexNormals();
  return g;
}

// Teepee of charred logs leaning inward with varied thickness and length, tops crossing above the flames
const TEEPEE_LOGS = 7;
for (let i = 0; i < TEEPEE_LOGS; i++) {
  const len = (0.56 + 0.16 * Math.abs(Math.sin(i * 2.7))) * FIRE_SCALE;
  const rad = (0.05 + 0.018 * Math.abs(Math.sin(i * 4.1))) * FIRE_SCALE;
  const logMesh = new THREE.Mesh(buildLogGeometry(rad * 0.85, rad * 1.15, len, i * 1.9), charredLogMat);
  const ang = (i / TEEPEE_LOGS) * Math.PI * 2 + 0.3 + Math.sin(i * 5.1) * 0.12;
  const dx = Math.cos(ang), dz = Math.sin(ang);
  const lean = 0.60 + 0.08 * Math.sin(i * 3.7); // a low, open stack: the flames stand above and between the logs
  const axis = new THREE.Vector3(-dx * Math.sin(lean), Math.cos(lean), -dz * Math.sin(lean));
  logMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
  logMesh.rotateY(i * 1.3);                   // vary which part of the bark texture faces out
  logMesh.position.set(dx * 0.36 * FIRE_SCALE, 0.06, dz * 0.36 * FIRE_SCALE).addScaledVector(axis, len / 2);
  logMesh.castShadow = true;
  logMesh.receiveShadow = true;
  hearthGroup.add(logMesh);
}
// Two short logs lying on the coal bed, anchoring the teepee
[{ ang: 0.9, len: 0.42 }, { ang: 4.2, len: 0.36 }].forEach((l, i) => {
  const len = l.len * FIRE_SCALE, rad = 0.058 * FIRE_SCALE;
  const lying = new THREE.Mesh(buildLogGeometry(rad, rad * 1.1, len, 11 + i * 3), charredLogMat);
  lying.rotation.set(0, l.ang, Math.PI / 2);
  lying.position.set(Math.cos(l.ang + Math.PI / 2) * 0.1 * FIRE_SCALE, 0.07, Math.sin(l.ang + Math.PI / 2) * 0.1 * FIRE_SCALE);
  lying.castShadow = true;
  lying.receiveShadow = true;
  hearthGroup.add(lying);
});

const fireShaderUniforms = { uTime: { value: 0 }, uSpirit: { value: 0 } };
const volumetricFireMat = new THREE.ShaderMaterial({
  uniforms: fireShaderUniforms,
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
  blending: THREE.AdditiveBlending,
  vertexShader: `
    varying vec2 vUv;
    varying float vSeed;
    uniform float uTime;
    void main() {
      vUv = uv;
      vec3 wPos = (modelMatrix * vec4(position, 1.0)).xyz;
      vSeed = atan(wPos.z, wPos.x + 0.001);
      vec3 pos = position;
      float sway = sin(uv.y * 7.5 - uTime * 6.2 + vSeed * 2.0) * 0.085 + cos(uv.y * 12.0 - uTime * 9.5 + vSeed) * 0.035;
      pos.x += sway * pow(uv.y, 1.15);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    varying float vSeed;
    uniform float uTime;
    uniform float uSpirit;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
    }
    float fbm(vec2 p) {
      float v = 0.0, a = 0.5;
      for (int i = 0; i < 4; i++) {
        v += a * noise(p);
        p = p * 2.12 + vec2(1.7, -2.3);
        a *= 0.5;
      }
      return v;
    }

    void main() {
      vec2 uv = vUv;
      float t = uTime;
      // Domain-warped upward-flowing noise; the warp grows with height so tips lick and twist
      vec2 q = vec2(uv.x * 3.2 + vSeed * 0.9, uv.y * 2.4 - t * 3.2);
      float warp = fbm(q) - 0.5;
      float x = (uv.x - 0.5) * 2.0 + warp * (0.30 + uv.y * 1.5);

      // Per-tongue height: several licks of different lengths that rise and fall independently
      float lick = noise(vec2(uv.x * 4.0 + vSeed * 3.1, t * 1.7 + vSeed));
      float topY = 0.50 + 0.48 * lick;
      float tip = 1.0 - smoothstep(topY - 0.30, topY, uv.y);

      // Teardrop body: fat belly low down, tapering to a point
      // (narrow at the coals, widest a quarter of the way up, then a long curling tip: a flame, not a tent)
      float yy = clamp(uv.y / max(topY, 0.2), 0.0, 1.0);
      float width = 1.22 * pow(yy + 0.05, 0.34) * pow(1.0 - yy, 0.90) + 0.03;
      float body = 1.0 - smoothstep(width * 0.35, width, abs(x));
      float base = smoothstep(0.0, 0.10, uv.y);
      float shape = body * tip * base;

      float n1 = fbm(vec2(uv.x * 5.5 + warp * 2.0, uv.y * 4.2 - t * 4.4));
      float n2 = noise(vec2(uv.x * 12.0 - warp * 2.5, uv.y * 8.5 - t * 6.8));
      float heat = shape * (0.55 + 0.75 * n1 + 0.30 * n2) - uv.y * 0.12;

      float alpha = smoothstep(0.16, 0.55, heat);
      // Crimson edges -> orange body -> yellow -> white-hot base core, with a faint blue root
      vec3 outerFlame = vec3(0.90, 0.10, 0.01);
      vec3 midFlame   = vec3(1.25, 0.42, 0.04);
      vec3 hotFlame   = vec3(1.35, 0.82, 0.16);
      vec3 whiteCore  = vec3(1.50, 1.25, 0.70);
      vec3 blueRoot   = vec3(0.25, 0.45, 1.10);
      // Spirit world: the same flame in bioluminescent colours (violet edge -> electric cyan -> mint -> white-cyan core)
      outerFlame = mix(outerFlame, vec3(0.16, 0.12, 0.95), uSpirit);
      midFlame   = mix(midFlame,   vec3(0.05, 0.85, 1.20), uSpirit);
      hotFlame   = mix(hotFlame,   vec3(0.35, 1.45, 1.10), uSpirit);
      whiteCore  = mix(whiteCore,  vec3(1.00, 1.55, 1.60), uSpirit);
      vec3 col = mix(outerFlame, midFlame, smoothstep(0.18, 0.46, heat));
      col = mix(col, hotFlame, smoothstep(0.44, 0.78, heat));
      float lowMask = 1.0 - smoothstep(0.05, 0.40, uv.y);
      col = mix(col, whiteCore, smoothstep(0.62, 1.0, heat) * lowMask);
      col = mix(col, blueRoot, (1.0 - smoothstep(0.0, 0.07, uv.y)) * 0.55 * alpha);

      gl_FragColor = vec4(col * alpha * 0.92, alpha);
    }
  `
});

const flameGeo = new THREE.PlaneGeometry(0.80, 0.86, 8, 16);
// Five crossed flame sheets (three tall, two short fillers): simple, readable from every side
const flameSheets = [
  { rot: 0.18, sx: 1.30, sy: 1.70 }, { rot: 0.18 + Math.PI / 3, sx: 1.10, sy: 1.40 },
  { rot: 0.18 + 2 * Math.PI / 3, sx: 1.25, sy: 1.55 },
  { rot: 0.18 + Math.PI / 6, sx: 0.85, sy: 1.05 }, { rot: 0.18 + 5 * Math.PI / 6, sx: 0.80, sy: 1.15 }
];
const flameMeshes = []; // base scales kept so a `fire` cue can swell them
flameSheets.forEach(f => {
  const fMesh = new THREE.Mesh(flameGeo, volumetricFireMat);
  fMesh.scale.set(f.sx * FIRE_SCALE, f.sy * FIRE_SCALE, 1);
  fMesh.position.y = 0.12 + 0.43 * f.sy * FIRE_SCALE; // (leanFlames in 14 keeps the base at 0.12)
  fMesh.rotation.y = f.rot;
  flameMeshes.push({ mesh: fMesh, sx: fMesh.scale.x, sy: fMesh.scale.y });
  hearthGroup.add(fMesh);
});

// Warm ground glow under and around the fire
const hearthGlow = new THREE.Sprite(new THREE.SpriteMaterial({
  map: goldGlowTex, color: 0xff7a1a, transparent: true, opacity: 0.55,
  blending: THREE.AdditiveBlending, depthWrite: false
}));
hearthGlow.scale.set(1.2, 1.2, 1);
hearthGlow.position.y = 0.2;
hearthGroup.add(hearthGlow);
// Wide soft halo round the flames (firelight in the air) and a warm pool on the bare ground inside and round the ring.
// Both follow the fire's flicker in the loop (14, step 6) and its colour in updateFireLook (11b).
const fireHalo = new THREE.Sprite(new THREE.SpriteMaterial({
  map: goldGlowTex, color: 0xff8a2a, transparent: true, opacity: 0.07,
  blending: THREE.AdditiveBlending, depthWrite: false
}));
fireHalo.scale.set(3.4, 3.4, 1);
fireHalo.position.y = 0.55;
hearthGroup.add(fireHalo);
const firePool = new THREE.Mesh(new THREE.CircleGeometry(1.45, 40), new THREE.MeshBasicMaterial({
  map: goldGlowTex, color: 0xff7a1a, transparent: true, opacity: 0.5,
  blending: THREE.AdditiveBlending, depthWrite: false, fog: false
}));
firePool.rotation.x = -Math.PI / 2;
firePool.position.y = 0.03;
hearthGroup.add(firePool);

const risingEmbers = [];
for (let i = 0; i < 70; i++) {
  const sp = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: goldGlowTex,
      color: i % 2 === 0 ? 0xfef08a : 0xf97316,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  sp.scale.setScalar(0.025 + Math.random() * 0.03);
  hearthGroup.add(sp);
  risingEmbers.push({
    sprite: sp,
    phase: Math.random() * Math.PI * 2,
    speed: 0.5 + Math.random() * 1.1,
    rad: 0.05 + Math.random() * 0.45
  });
}
