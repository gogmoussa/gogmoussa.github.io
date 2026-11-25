// © 2026 George Moussa. All rights reserved.
// ============================================================================
// 11. DOUBLE-HELIX GOLDEN-CYAN RESONANCE STREAM & COSMIC BOKEH STARS
// ============================================================================
const BRIDGE_COUNT = 52;
const bridgeNodes = [];
const bridgeGroup = new THREE.Group();
sanctuaryGroup.add(bridgeGroup);

for (let i = 0; i < BRIDGE_COUNT; i++) {
  const frac = i / (BRIDGE_COUNT - 1);
  const strand = i % 2 === 0 ? 1 : -1;
  const sp = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: strand === 1 ? goldGlowTex : cyanGlowTex,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  bridgeGroup.add(sp);
  bridgeNodes.push({ sprite: sp, frac, strand });
}

const starGeo = new THREE.BufferGeometry();
const STAR_COUNT = 950;
const starPos = new Float32Array(STAR_COUNT * 3);
const starCols = new Float32Array(STAR_COUNT * 3);
for (let i = 0; i < STAR_COUNT; i++) {
  const r = 10 + Math.random() * 55;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
  starPos[i * 3 + 1] = Math.abs(r * Math.cos(phi)) - 2;
  starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

  const c = i % 3 === 0 ? new THREE.Color(0x38bdf8) : (i % 3 === 1 ? new THREE.Color(0xfef08a) : new THREE.Color(0xe879f9));
  starCols[i * 3] = c.r;
  starCols[i * 3 + 1] = c.g;
  starCols[i * 3 + 2] = c.b;
}
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
starGeo.setAttribute('color', new THREE.BufferAttribute(starCols, 3));
const starField = new THREE.Points(
  starGeo,
  new THREE.PointsMaterial({
    size: 0.42,
    map: cyanGlowTex,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  })
);
scene.add(starField);
