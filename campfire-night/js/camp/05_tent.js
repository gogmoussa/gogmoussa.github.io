// © 2026 George Moussa. All rights reserved.
// CAMP 05. TENT: the tent by the clearing; crawl in to sleep until morning (asks once more first).
//     Loads first among the modules because it adds a collider that wood placement must avoid.
(function () {
  if (!window.Camp) return;
  const C = Camp, { HX, HZ } = C;
  const TENT = { x: -3.3, z: 3.9 }, ASK_MS = 4000;
  const faceYaw = Math.atan2(HX - TENT.x, HZ - TENT.z);
  const door = { x: TENT.x + Math.sin(faceYaw) * 1.9, z: TENT.z + Math.cos(faceYaw) * 1.9 };

  // --- the look: a canvas A-frame on a ridge pole. Local frame: door at +z, length along z.
  //     Canvas sags between poles, flares out at the stakes; the right door flap is rolled back,
  //     a lantern glows inside (through the canvas too) and fades out toward dawn.
  const W = 1.15, H = 1.6, L = 2.6, ZF = L / 2;
  const SLANT = Math.hypot(W, H);
  const cs = Math.cos(faceYaw), sn = Math.sin(faceYaw);
  const toWorld = (lx, lz) => ({ x: TENT.x + lx * cs + lz * sn, z: TENT.z - lx * sn + lz * cs });
  const groundAt = (lx, lz) => { const p = toWorld(lx, lz); return terrainY(p.x, p.z); };
  const baseY = Math.min(groundAt(0, 0), groundAt(-W, -ZF), groundAt(W, -ZF), groundAt(-W, ZF), groundAt(W, ZF)) - 0.02;
  const localGround = (lx, lz) => groundAt(lx, lz) - baseY;

  // canvas texture: weave, stitched seams, reinforced edges, damp darker hem
  function canvasTex() {
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = '#8a7c58'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 2600; i++) {                                    // mottling
      const x = Math.random() * 512, y = Math.random() * 512, r = 4 + Math.random() * 22;
      g.fillStyle = `rgba(${Math.random() < 0.5 ? '60,50,30' : '170,155,115'},${0.025 + Math.random() * 0.04})`;
      g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
    }
    g.globalAlpha = 0.09;                                                // weave
    for (let y = 0; y < 512; y += 2) { g.fillStyle = y % 4 ? '#3a301c' : '#c8b88e'; g.fillRect(0, y, 512, 1); }
    for (let x = 0; x < 512; x += 2) { g.fillStyle = x % 4 ? '#3a301c' : '#c8b88e'; g.fillRect(x, 0, 1, 512); }
    g.globalAlpha = 1;
    const hem = g.createLinearGradient(0, 512, 0, 380);                  // damp, muddy hem (v = 0 at the ground)
    hem.addColorStop(0, 'rgba(38,30,18,0.75)'); hem.addColorStop(0.25, 'rgba(50,40,24,0.35)'); hem.addColorStop(1, 'rgba(50,40,24,0)');
    g.fillStyle = hem; g.fillRect(0, 380, 512, 132);
    g.fillStyle = 'rgba(70,58,36,0.9)'; g.fillRect(0, 498, 512, 14);      // hem tape
    g.fillStyle = 'rgba(70,58,36,0.75)'; g.fillRect(0, 0, 512, 10);       // ridge tape
    for (const sx of [0, 128, 256, 384]) {                               // seams with stitching
      g.fillStyle = 'rgba(55,45,27,0.55)'; g.fillRect(sx - 3, 0, 6, 512);
      g.fillStyle = 'rgba(190,175,135,0.35)'; g.fillRect(sx + 3, 0, 1, 512);
      g.fillStyle = 'rgba(30,24,14,0.5)';
      for (let y = 4; y < 512; y += 9) { g.fillRect(sx - 6, y, 1, 4); g.fillRect(sx + 6, y + 4, 1, 4); }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
    if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
    return t;
  }
  const tex = canvasTex();
  const outMat = new THREE.MeshStandardMaterial({ map: tex, color: 0xa89a7c, roughness: 0.95, side: THREE.FrontSide,
    emissive: 0xff9a40, emissiveMap: tex, emissiveIntensity: 0.0 });
  const inMat = new THREE.MeshStandardMaterial({ map: tex, color: 0x4a3c26, roughness: 1, side: THREE.BackSide,
    emissive: 0xff8a30, emissiveMap: tex, emissiveIntensity: 0.0 });

  // a grid surface from f(a, b) -> [x, y, z, u, v]; both faces drawn (outside lit, inside lantern-warm)
  function sheet(nA, nB, f) {
    const pos = [], uv = [], idx = [];
    for (let j = 0; j <= nB; j++) for (let i = 0; i <= nA; i++) {
      const p = f(i / nA, j / nB); pos.push(p[0], p[1], p[2]); uv.push(p[3], p[4]);
    }
    for (let j = 0; j < nB; j++) for (let i = 0; i < nA; i++) {
      const a = j * (nA + 1) + i, b = a + 1, c = a + nA + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  const tent = new THREE.Group();
  tent.position.set(TENT.x, baseY, TENT.z);
  tent.rotation.y = faceYaw;                                           // door (+z face) toward the fire
  const addSheet = (g) => { tent.add(new THREE.Mesh(g, outMat)); tent.add(new THREE.Mesh(g, inMat)); };

  // roof panels: a = along the length (back -> front), b = eave -> ridge. Sag between poles,
  // a little scallop at the hem between the five stakes, slight ridge dip in the middle.
  const STAKES = 4;
  for (const s of [-1, 1]) {
    addSheet(sheet(24, 10, (a, b) => {
      const z = -ZF + a * L, mid = Math.sin(Math.PI * a);
      const ridgeY = H - 0.05 * mid;
      const sag = 0.07 * mid * Math.sin(Math.PI * b);                  // canvas pulled in between poles
      const scal = 0.05 * Math.pow(1 - b, 3) * (1 - Math.abs(Math.cos(Math.PI * a * STAKES)));   // flare at stakes
      const x = s * (W * (1 - b) - sag + scal);
      const y = ridgeY * b + (1 - b) * 0.0 - sag * 0.35;
      return [x, Math.max(y, 0), z, a * 2 * (s > 0 ? 1 : -1), 1 - b];
    }));
  }
  // back wall (a flat triangle with a slight inward belly)
  addSheet(sheet(10, 10, (a, b) => {
    const half = W * (1 - b), x = -half + 2 * half * a;
    const belly = 0.06 * Math.sin(Math.PI * a) * Math.sin(Math.PI * Math.min(1, b * 1.2)) * (1 - b * 0.3);
    return [x, H * b, -ZF + belly, (x + W) / (2 * W) * 0.9 + 0.05, 1 - b];
  }));
  // front: left flap hangs closed with its lower inner corner swung open; the right half is open
  addSheet(sheet(8, 12, (a, b) => {                                   // a: outer -> inner edge, b: apex -> ground
    const outer = -W * b, inner = -0.03 * b - 0.22 * b * b;
    const x = outer + (inner - outer) * a;
    const z = ZF + 0.012 + 0.07 * a * b * b + 0.02 * Math.sin(Math.PI * a) * b;
    return [x, H * (1 - b), z, a * 0.45, b];
  }));
  // the right flap, rolled up and tied against the right front edge
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, SLANT * 0.92, 10, 1), outMat);
  roll.position.set(W * 0.5 + 0.04, H * 0.5 - 0.02, ZF + 0.06);
  roll.rotation.z = Math.atan2(W, H); tent.add(roll);
  const rollDir = new THREE.Vector3(-Math.sin(roll.rotation.z), Math.cos(roll.rotation.z), 0);   // ties ring the roll
  const tieMat = new THREE.MeshStandardMaterial({ color: 0x2c2216, roughness: 1 });
  for (const f of [0.3, 0.7]) {
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.012, 5, 12), tieMat);
    tie.position.set(W * (1 - f) + 0.04, H * f - 0.02, ZF + 0.06); tie.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), rollDir); tent.add(tie);
  }

  // inside: groundsheet, a rolled sleeping bag, a pillow, a lantern under the ridge
  // the groundsheet follows the ground (a flat plane z-fought with the terrain where it rises)
  const floorG = sheet(8, 12, (a, b) => { const x = (a - 0.5) * (2 * W - 0.1), z = (0.5 - b) * (L - 0.05); return [x, localGround(x, z) + 0.035, z, a, b]; });
  tent.add(new THREE.Mesh(floorG, new THREE.MeshStandardMaterial({ color: 0x161c18, roughness: 1, side: THREE.DoubleSide })));
  const bag = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 1.9, 14, 1), new THREE.MeshStandardMaterial({ color: 0x34452c, roughness: 0.9 }));
  bag.rotation.x = Math.PI / 2; bag.scale.set(1.35, 1, 0.42); bag.position.set(-0.3, localGround(-0.3, -0.1) + 0.11, -0.1); tent.add(bag);
  const pillow = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), new THREE.MeshStandardMaterial({ color: 0x8e8a7c, roughness: 1 }));
  pillow.scale.set(1.2, 0.4, 0.7); pillow.position.set(-0.3, localGround(-0.3, -1.0) + 0.12, -1.0); tent.add(pillow);
  const lantern = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.11, 10), new THREE.MeshBasicMaterial({ color: 0xffc070 }));
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.05, 10), tieMat); cap.position.y = 0.08;
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.22, 4), tieMat); cord.position.y = 0.21;
  lantern.add(glass, cap, cord); lantern.position.set(0, H - 0.4, -0.15); tent.add(lantern);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,190,110,0.9)'); r.addColorStop(1, 'rgba(255,150,60,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
  })(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  halo.scale.setScalar(0.4); lantern.add(halo);

  // poles, guy lines, stakes
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a3420, roughness: 0.85 });
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0xb8ab88, roughness: 1 });
  const rod = (a, b, r, mat) => {                                       // a thin cylinder from a to b (local)
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 5, 1), mat);
    m.position.copy(A).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    tent.add(m); return m;
  };
  const stake = (x, z) => rod([x, localGround(x, z) - 0.05, z], [x * 1.02, localGround(x, z) + 0.12, z * 1.02], 0.018, woodMat);
  rod([0, H - 0.06, -ZF - 0.14], [0, H - 0.06, ZF + 0.14], 0.025, woodMat);   // ridge pole, ends poke out
  for (const z of [-ZF - 0.04, ZF + 0.04]) {                                  // upright poles at each end, tip above the ridge
    rod([0, localGround(0, z) - 0.05, z], [0, H + 0.12, z], 0.024, woodMat);
  }
  for (const zs of [-1, 1]) {
    const tip = [0, H + 0.08, zs * (ZF + 0.04)];
    for (const xs of [-1, 1]) {                                               // two guy lines from each pole tip
      const gx = xs * 0.9, gz = zs * (ZF + 1.05), gy = localGround(gx, gz) + 0.08;
      rod(tip, [gx, gy, gz], 0.006, ropeMat); stake(gx, gz);
    }
  }
  for (const s of [-1, 1]) for (let i = 0; i <= STAKES; i++) {               // hem stakes
    const z = -ZF + (i / STAKES) * L;
    stake(s * (W + 0.1), z);
  }
  scene.add(tent);
  C.colliders.push({ x: TENT.x, z: TENT.z, r: 1.6 });
  C.tentAt = TENT;                                                   // where the tent stands (the field guide's tent lesson reads it)

  // nothing from the meadow grows through the groundsheet: every instanced scatter (grass, mushrooms,
  // anything added later) loses the instances that stand inside the footprint. Runs again on init,
  // after every module has loaded, for scatters built after this file.
  function clearFootprint() {
    tent.updateMatrixWorld(true);
    const inv = tent.matrixWorld.clone().invert(), toLocal = new THREE.Matrix4();
    const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    scene.traverse((o) => {
      if (!o.isInstancedMesh || o.userData.tentCleared) return;
      for (let a = o; a; a = a.parent) if (a === tent) return;
      o.updateMatrixWorld(true); toLocal.multiplyMatrices(inv, o.matrixWorld);
      let hit = 0;
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m); p.setFromMatrixPosition(m).applyMatrix4(toLocal);
        if (Math.abs(p.z) > ZF + 0.08 || Math.abs(p.x) > W * 0.98 || p.y > H) continue;
        m.decompose(p, q, s); s.multiplyScalar(0.001); m.compose(p, q, s);
        o.setMatrixAt(i, m); hit++;
      }
      if (hit) o.instanceMatrix.needsUpdate = true;
      o.userData.tentCleared = true;
    });
  }
  clearFootprint();

  // lantern glow: through the canvas at night, out by first light; a small flame flicker
  function lanternGlow(nowMs) {
    const dawn = C.smooth(C.T.NIGHT_MIN - 150, C.T.NIGHT_MIN - 40, C.state.minutes);
    const flick = 0.9 + 0.06 * Math.sin(nowMs * 0.011) + 0.04 * Math.sin(nowMs * 0.029 + 1.3);
    const on = (1 - dawn) * flick;
    outMat.emissiveIntensity = 0.14 * on;
    inMat.emissiveIntensity = 0.6 * on;
    glass.material.color.setRGB(1, 0.75, 0.44).multiplyScalar(0.35 + 0.65 * on);
    halo.material.opacity = 0.85 * on;
  }
  lanternGlow(0);

  let askedAt = 0, asleep = false;
  const asked = () => performance.now() - askedAt < ASK_MS;
  function sleep() {
    if (!asked()) { askedAt = performance.now(); C.toast(C.state.minutes < 300 ? 'Sleep already? The night is young.' : 'Rest until morning?'); return; }
    asleep = true; C.state.paused = true; C.$('cu-fade').classList.add('on'); C.toast('');
    setTimeout(() => {
      C.advance(C.T.NIGHT_MIN - C.state.minutes);                    // the fire burns on without you
      Object.assign(C.player, { x: door.x, z: door.z, vx: 0, vz: 0, pitch: 0.05, sitting: false }); C.player.yaw = C.faceFire(door.x, door.z);
      camera.position.set(door.x, terrainY(door.x, door.z) + C.T.EYE, door.z);
      C.$('cu-fade').classList.remove('on');
      setTimeout(() => { asleep = false; C.state.paused = false; C.endNight('slept'); }, 2600);
    }, 2300);
  }

  C.use({
    name: 'tent', order: 90,
    how: 'Sleep in the <b>tent</b> when you are ready.',
    init() { clearFootprint(); },
    reset() { askedAt = 0; asleep = false; },
    frame(dt, nowMs) { lanternGlow(nowMs); },
    target(ctx) {
      if (ctx.sitting || asleep) return null;
      const d = Math.hypot(camera.position.x - door.x, camera.position.z - door.z);
      if (d > 2.2 || !C.looking(TENT.x, 0.8, TENT.z, 0.55)) return null;
      return { label: asked() ? '<b>E</b> again to sleep until morning' : '<b>E</b> crawl into the tent', act: sleep, prio: 1 };
    }
  });
  C.test.tent = [TENT.x, TENT.z];
})();
