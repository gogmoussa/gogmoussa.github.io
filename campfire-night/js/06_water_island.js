// © 2026 George Moussa. All rights reserved.
// ============================================================================
// 6. SCHLICK-FRESNEL MIRROR-WATER POOL & SCULPTED SANCTUARY ISLAND
// ============================================================================
const sanctuaryGroup = new THREE.Group();
scene.add(sanctuaryGroup);

const reflectionCamera = camera.clone();
const mandalaTex = createMandalaTexture();

const waterUniforms = {
  tReflection: { value: reflectRT.texture },
  tMandala: { value: mandalaTex },
  uTime: { value: 0 },
  uCoherence: { value: 0.65 },
  uCamPos: { value: new THREE.Vector3() },
  uNature: { value: 1 },
  uSunDir: { value: new THREE.Vector3(-0.6, 0.3, -0.45).normalize() },
  uSunCol: { value: new THREE.Color(0xffb36a) }
};

const waterPoolMesh = new THREE.Mesh(
  makeLakeWaterGeometry(), // 05b: follows the lake shore; aDepth is filled in by dressLake()
  new THREE.ShaderMaterial({
    uniforms: waterUniforms,
    transparent: true,
    vertexShader: `
      varying vec3 vWorldPos;
      varying vec2 vUv;
      varying vec4 vScreenPos;
      attribute float aDepth;
      varying float vDepth;
      void main() {
        vUv = uv;
        vDepth = aDepth;
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPosition.xyz;
        vScreenPos = projectionMatrix * viewMatrix * worldPosition;
        gl_Position = vScreenPos;
      }
    `,
    fragmentShader: `
      uniform sampler2D tReflection;
      uniform sampler2D tMandala;
      uniform float uTime;
      uniform float uCoherence;
      uniform vec3 uCamPos;
      uniform float uNature;
      uniform vec3 uSunDir;
      uniform vec3 uSunCol;
      varying vec3 vWorldPos;
      varying vec2 vUv;
      varying vec4 vScreenPos;
      varying float vDepth;

      void main() {
        vec2 xz = vWorldPos.xz;

        if (uNature > 0.5) {
          // Natural lake: wind-rippled mirror water, sky/hill reflection, sun-path shimmer; colour from the real depth
          float dep = vDepth;
          float shoreK = 1.0 - smoothstep(0.0, 0.45, dep);          // 1 at the waterline
          float dCam = length(uCamPos - vWorldPos);
          float calm = 1.0 / (1.0 + dCam * 0.05);                   // far water lies flatter (and does not shimmer into noise)
          vec2 q = xz * 1.25;
          float nx = cos(q.x * 5.5 + uTime * 0.95) * 0.45 + cos((q.x + q.y) * 11.5 - uTime * 1.45) * 0.35 + cos(q.y * 18.0 + q.x * 5.5 + uTime * 2.1) * 0.20;
          float nz = sin(q.y * 6.5 - uTime * 0.85) * 0.45 + sin((q.x - q.y) * 13.0 + uTime * 1.35) * 0.35 + sin(q.x * 19.5 - q.y * 6.0 - uTime * 1.9) * 0.20;
          vec2 sw = vec2(cos(xz.x * 0.35 + xz.y * 0.21 - uTime * 0.4), sin(xz.y * 0.31 - xz.x * 0.17 + uTime * 0.33)); // long slow swell
          nx = nx * calm + sw.x * 0.25; nz = nz * calm + sw.y * 0.25;
          vec3 N = normalize(vec3(nx * 0.045, 1.0, nz * 0.045));
          vec3 V = normalize(uCamPos - vWorldPos);
          float NdotV = max(0.001, dot(N, V));
          float fres = 0.06 + 0.82 * pow(1.0 - NdotV, 3.4);
          fres = clamp(fres, 0.06, 0.80);

          vec2 ndc = (vScreenPos.xy / vScreenPos.w) * 0.5 + 0.5;
          vec2 reflUv = clamp(vec2(ndc.x, 1.0 - ndc.y) + vec2(nx, nz) * 0.010 * (0.4 + 0.6 * calm), 0.003, 0.997);
          vec3 refl = max(texture2D(tReflection, reflUv).rgb, vec3(0.0)) * vec3(0.46, 0.55, 0.58);
          vec3 sDir = normalize(uSunDir);

          // Emerald-teal deep water, mossy-pebble shallows at the bank
          float rippleLight = 0.88 + 0.12 * (nx * 0.6 + nz * 0.4);
          vec3 deep = vec3(0.010, 0.040, 0.050) * rippleLight;
          vec3 midWater = vec3(0.022, 0.072, 0.064) * rippleLight;
          vec3 shallow = vec3(0.058, 0.068, 0.032) * rippleLight;
          vec3 body = mix(mix(shallow, midWater, smoothstep(0.0, 0.45, dep)), deep, smoothstep(0.45, 2.4, dep));
          vec3 col = mix(body, refl, fres * (1.0 - 0.7 * shoreK));

          // Sun-path sparkle across the ripples + the campfire's warm streak on the near water
          vec3 H = normalize(sDir + V);
          float glint1 = pow(max(dot(N, H), 0.0), 220.0) * 1.35;
          float glint2 = pow(max(dot(N, H), 0.0), 32.0) * 0.18;
          col += uSunCol * (glint1 + glint2) * (1.0 - shoreK);

          vec3 L_fire = normalize(vec3(${glslF(HEARTH.x)}, 0.85, ${glslF(HEARTH.z)}) - vWorldPos);
          vec3 H_fire = normalize(L_fire + V);
          float dFire = length(xz - vec2(${glslF(HEARTH.x)}, ${glslF(HEARTH.z)}));
          col += vec3(1.1, 0.48, 0.12) * pow(max(0.0, dot(N, H_fire)), 56.0) * exp(-dFire * 0.45) * 0.48;

          // A faint lapping line where the water meets the rocks
          float shoreRing = smoothstep(0.0, 0.04, dep) * (1.0 - smoothstep(0.04, 0.16, dep));
          col += uSunCol * shoreRing * (0.04 + 0.03 * sin(dep * 80.0 - uTime * 2.4));

          gl_FragColor = vec4(col, smoothstep(-0.01, 0.07, dep));
          return;
        }

        float dSpirit = length(xz - vec2(1.08, -0.12));
        float dFire   = length(xz - vec2(${glslF(fireLight.position.x)}, ${glslF(fireLight.position.z)}));
        float dHuman  = length(xz - vec2(-0.98, 0.38));

        float r1 = sin(dSpirit * 15.0 - uTime * 3.6) * exp(-dSpirit * 0.60);
        float r2 = sin(dFire * 19.0 - uTime * 4.4) * exp(-dFire * 0.80);
        float r3 = sin(dHuman * 13.0 - uTime * 2.8) * exp(-dHuman * 0.70);
        float capillary = sin(xz.x * 22.0 + xz.y * 16.0 + uTime * 2.2) * cos(xz.x * 17.0 - xz.y * 24.0 - uTime * 1.7) * 0.2;
        float totalWave = r1 + r2 * 0.75 + r3 * 0.65 + capillary;

        vec3 N = normalize(vec3(totalWave * 0.12, 1.0, totalWave * 0.12));
        vec3 V = normalize(uCamPos - vWorldPos);
        float NdotV = max(0.001, dot(N, V));
        float fresnel = 0.20 + 0.75 * pow(1.0 - NdotV, 3.2);

        vec2 ndc = (vScreenPos.xy / vScreenPos.w) * 0.5 + 0.5;
        vec2 distortion = vec2(totalWave * 0.010, totalWave * 0.014);
        vec2 reflUv = clamp(vec2(ndc.x, 1.0 - ndc.y) + distortion, 0.002, 0.998);
        vec3 reflCol = texture2D(tReflection, reflUv).rgb;

        vec2 cUv = vUv - 0.5;
        float ang = uTime * 0.035;
        mat2 rot = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
        vec4 mandala = texture2D(tMandala, rot * cUv + 0.5);

        vec3 deepWater = mix(vec3(0.015, 0.022, 0.055), vec3(0.010, 0.042, 0.095), uCoherence);
        float shoreFade = smoothstep(5.08, 4.15, length(xz));

        vec3 L_fire = normalize(vec3(${glslF(fireLight.position.x)}, 0.82, ${glslF(fireLight.position.z)}) - vWorldPos);
        vec3 H_fire = normalize(L_fire + V);
        float specFire = pow(max(0.0, dot(N, H_fire)), 72.0) * exp(-dFire * 0.38);

        vec3 L_spirit = normalize(vec3(1.08, 1.85, -0.12) - vWorldPos);
        vec3 H_spirit = normalize(L_spirit + V);
        float specSpirit = pow(max(0.0, dot(N, H_spirit)), 72.0) * exp(-dSpirit * 0.35);

        vec3 runeGlow = mandala.rgb * mandala.a * (0.48 + uCoherence * 0.55) * (1.1 - fresnel * 0.45);
        vec3 finalCol = mix(deepWater + runeGlow * shoreFade, reflCol * 0.85, fresnel * shoreFade);
        finalCol += vec3(1.4, 0.65, 0.18) * specFire * 0.65 + vec3(0.25, 1.1, 1.6) * specSpirit * 0.65;

        gl_FragColor = vec4(finalCol, 1.0);
      }
    `
  })
);
waterPoolMesh.position.y = LAKE_Y; // the lake grid is built flat in XZ (05b)
sanctuaryGroup.add(waterPoolMesh);

// Smooth, Richly Colored Obsidian-Slate Basalt Material
const basaltMat = new THREE.MeshStandardMaterial({
  color: 0x162032,
  roughness: 0.55,
  metalness: 0.25
});

const bronzeMat = new THREE.MeshStandardMaterial({
  color: 0xd97706,
  roughness: 0.28,
  metalness: 0.82
});

const islandRim = new THREE.Mesh(new THREE.TorusGeometry(5.12, 0.30, 24, 96), basaltMat);
islandRim.rotation.x = Math.PI / 2;
islandRim.position.y = -0.03;
islandRim.receiveShadow = true;
sanctuaryGroup.add(islandRim);

const rimGoldInlay = new THREE.Mesh(new THREE.TorusGeometry(4.92, 0.035, 12, 96), bronzeMat);
rimGoldInlay.rotation.x = Math.PI / 2;
rimGoldInlay.position.y = 0.02;
sanctuaryGroup.add(rimGoldInlay);

const islandUnder = new THREE.Mesh(new THREE.ConeGeometry(5.18, 3.5, 24), basaltMat);
islandUnder.rotation.x = Math.PI;
islandUnder.position.y = -1.78;
sanctuaryGroup.add(islandUnder);

// Stepped Stone Dais under George (The Human Maker)
const humanStonePad = new THREE.Mesh(
  new THREE.CylinderGeometry(0.92, 1.08, 0.08, 48),
  basaltMat
);
humanStonePad.position.set(-0.98, 0.02, 0.38);
humanStonePad.receiveShadow = true;
sanctuaryGroup.add(humanStonePad);

const humanPadGoldRing = new THREE.Mesh(
  new THREE.TorusGeometry(0.94, 0.018, 12, 48),
  bronzeMat
);
humanPadGoldRing.rotation.x = Math.PI / 2;
humanPadGoldRing.position.set(-0.98, 0.06, 0.38);
sanctuaryGroup.add(humanPadGoldRing);

// Sculpted Shoreline Boulders & Glowing Crystal Clusters around the Sanctuary Rim
const crystalMat = new THREE.MeshPhysicalMaterial({
  color: 0x0ea5e9,
  emissive: 0x0284c7,
  emissiveIntensity: 0.55,
  roughness: 0.15,
  metalness: 0.2,
  clearcoat: 1.0
});
const amethystMat = new THREE.MeshPhysicalMaterial({
  color: 0xa855f7,
  emissive: 0x7e22ce,
  emissiveIntensity: 0.55,
  roughness: 0.15,
  metalness: 0.2,
  clearcoat: 1.0
});

for (let i = 0; i < 14; i++) {
  const a = (i / 14) * Math.PI * 2 + 0.2;
  const r = 4.82;
  const bMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.26 + (i % 3) * 0.08, 1), basaltMat);
  bMesh.scale.set(1.3, 0.62, 1.0);
  bMesh.position.set(Math.cos(a) * r, 0.06, Math.sin(a) * r);
  bMesh.rotation.y = i;
  bMesh.castShadow = true;
  bMesh.receiveShadow = true;
  sanctuaryGroup.add(bMesh);

  // Add a glowing crystal spire next to every 3rd shoreline boulder
  if (i % 3 === 0) {
    const cSpire = new THREE.Mesh(
      new THREE.ConeGeometry(0.09, 0.48, 6),
      i % 2 === 0 ? crystalMat : amethystMat
    );
    cSpire.position.set(Math.cos(a + 0.05) * (r - 0.12), 0.24, Math.sin(a + 0.05) * (r - 0.12));
    cSpire.rotation.z = 0.18;
    sanctuaryGroup.add(cSpire);
  }
}

// --- ANCIENT FLUTED TEMPLE COLUMNS & OPEN-LATTICE SANCTUARY LANTERNS ---
const flutedTex = createFlutedPillarTexture();
flutedTex.repeat.set(1, 2);
const pillarMat = new THREE.MeshStandardMaterial({
  map: flutedTex,
  color: 0x1e293b,
  roughness: 0.38,
  metalness: 0.32
});

[
  [-3.8, -2.6, 2.9, 0.03],
  [-2.1, -3.9, 3.5, -0.02],
  [ 2.1, -3.9, 3.5,  0.02],
  [ 3.8, -2.6, 2.6, -0.04]
].forEach(([px, pz, h, tilt]) => {
  const pGroup = new THREE.Group();
  pGroup.position.set(px, 0, pz);
  pGroup.rotation.z = tilt;

  const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.20, 0.74), basaltMat);
  plinth.position.y = 0.10;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  pGroup.add(plinth);

  const torusBase = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.045, 16, 32), bronzeMat);
  torusBase.rotation.x = Math.PI / 2;
  torusBase.position.y = 0.22;
  pGroup.add(torusBase);

  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.26, h, 32), pillarMat);
  col.position.y = h / 2 + 0.2;
  col.castShadow = true;
  col.receiveShadow = true;
  pGroup.add(col);

  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.18, 0.66), basaltMat);
  cap.position.y = h + 0.22;
  pGroup.add(cap);

  const bronzeRing = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.018, 12, 32), bronzeMat);
  bronzeRing.rotation.x = Math.PI / 2;
  bronzeRing.position.y = h * 0.72;
  pGroup.add(bronzeRing);

  sanctuaryGroup.add(pGroup);
});

const lintel = new THREE.Mesh(new THREE.BoxGeometry(4.85, 0.32, 0.48), basaltMat);
lintel.position.set(0, 3.82, -3.9);
lintel.castShadow = true;
sanctuaryGroup.add(lintel);

// Open-Lattice Japanese/Sanctuary Stone Lanterns (Tōrō) with Glowing Flame Core
function createSanctuaryLantern(lx, lz) {
  const lg = new THREE.Group();
  lg.position.set(lx, 0, lz);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.12, 8), basaltMat);
  base.position.y = 0.06;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.72, 16), basaltMat);
  post.position.y = 0.42;
  post.castShadow = true;
  const platform = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.14, 0.08, 8), bronzeMat);
  platform.position.y = 0.80;

  // 4 Open Corner Struts so the glowing flame core is visible inside
  for (let c = 0; c < 4; c++) {
    const ca = (c / 4) * Math.PI * 2 + Math.PI / 4;
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.28, 8), bronzeMat);
    strut.position.set(Math.cos(ca) * 0.12, 0.96, Math.sin(ca) * 0.12);
    lg.add(strut);
  }

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xfef08a })
  );
  core.position.y = 0.95;
  const coreHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: goldGlowTex, color: 0xfbbf24, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  coreHalo.scale.setScalar(0.42);
  coreHalo.position.y = 0.95;

  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.18, 8), basaltMat);
  cap.position.y = 1.16;
  const finial = new THREE.Mesh(new THREE.OctahedronGeometry(0.045, 0), bronzeMat);
  finial.position.y = 1.28;

  lg.add(base, post, platform, core, coreHalo, cap, finial);
  sanctuaryGroup.add(lg);
}
createSanctuaryLantern(-2.85, -1.15);
createSanctuaryLantern( 2.85, -1.15);

// Orbiting Levitating Crystal Obelisks
const monoliths = [];
for (let i = 0; i < 10; i++) {
  const a = (i / 10) * Math.PI * 2;
  const dist = 6.3 + (i % 3) * 1.2;
  const mesh = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.30, 0),
    i % 3 === 0 ? crystalMat : (i % 3 === 1 ? amethystMat : basaltMat)
  );
  mesh.scale.set(0.55, 1.95, 0.55);
  sanctuaryGroup.add(mesh);
  monoliths.push({
    mesh,
    angle: a,
    dist,
    baseY: -0.3 + (i % 4) * 0.55,
    speed: 0.05 + (i % 3) * 0.02
  });
}

// --- MULTI-BRANCHING ORGANIC CELESTIAL BONSAI TREES (65 Layered Leaf Clusters per Tree!) ---
const trunkMat = new THREE.MeshStandardMaterial({
  color: 0x3b2112,
  roughness: 0.72,
  metalness: 0.06
});

function createCelestialBonsai(x, z, scale, paletteHexes, emissiveHex) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.scale.setScalar(scale);

  // Gnarled Multi-Limb Trunk & Secondary Branches
  const branches = [
    { pos: [0, 0.36, 0],       rot: [0.05, 0, 0.12],  rTop: 0.13, rBot: 0.22, len: 0.75 },
    { pos: [0.08, 0.88, 0.03], rot: [-0.08, 0, -0.22], rTop: 0.09, rBot: 0.13, len: 0.62 },
    { pos: [-0.14, 1.12, 0.0], rot: [0.12, 0, 0.48],   rTop: 0.05, rBot: 0.09, len: 0.52 },
    { pos: [0.24, 1.22, -0.06],rot: [-0.15, 0, -0.52], rTop: 0.05, rBot: 0.08, len: 0.50 },
    { pos: [-0.02, 1.42, 0.04],rot: [0.08, 0, 0.14],   rTop: 0.04, rBot: 0.07, len: 0.45 }
  ];
  branches.forEach((b) => {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(b.rTop, b.rBot, b.len, 16), trunkMat);
    seg.position.set(...b.pos);
    seg.rotation.set(...b.rot);
    seg.castShadow = true;
    seg.receiveShadow = true;
    g.add(seg);
  });

  // 56 Organic Multi-Tone Foliage Clusters arranged in 4 Bonsai Cloud Pads
  const materials = paletteHexes.map((hex) => new THREE.MeshStandardMaterial({
    color: hex,
    emissive: emissiveHex,
    emissiveIntensity: 0.28,
    roughness: 0.55,
    metalness: 0.05
  }));

  const cloudCenters = [
    [-0.36, 1.32, 0.02, 0.42],
    [ 0.42, 1.42, -0.08, 0.44],
    [-0.12, 1.66, 0.10, 0.46],
    [ 0.10, 1.82, -0.02, 0.50]
  ];
  const leafGeo = new THREE.DodecahedronGeometry(0.14, 1);

  cloudCenters.forEach(([cx, cy, cz, spread], cIdx) => {
    for (let i = 0; i < 14; i++) {
      const ang = (i / 14) * Math.PI * 2 + cIdx;
      const r = (0.2 + 0.8 * ((i * 7) % 11) / 11) * spread;
      const hOff = (((i * 3) % 7) / 7 - 0.5) * 0.18;
      const leaf = new THREE.Mesh(leafGeo, materials[i % materials.length]);
      leaf.position.set(cx + Math.cos(ang) * r, cy + hOff, cz + Math.sin(ang) * r);
      const s = 0.75 + ((i * 5) % 9) / 18;
      leaf.scale.set(s * 1.25, s * 0.72, s * 1.15);
      leaf.rotation.set(i * 0.4, i * 0.9, i * 0.3);
      leaf.castShadow = true;
      g.add(leaf);
    }
  });

  sanctuaryGroup.add(g);
}
createCelestialBonsai(-3.65, -1.95, 1.12, [0x059669, 0x10b981, 0x34d399, 0x0d9488], 0x047857);
createCelestialBonsai( 3.85,  0.85, 1.08, [0xc026d3, 0xe879f9, 0xf472b6, 0xa855f7], 0x86198f);
