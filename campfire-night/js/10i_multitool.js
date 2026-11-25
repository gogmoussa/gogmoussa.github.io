// © 2026 George Moussa. All rights reserved.
// ============================================================================
// 10I. ADVENTURER MULTITOOL: a big axe / pick / saw / hook staff slung diagonally across George's back
// ============================================================================
// Built in tool space (shaft along +Y, blade side +X, back of the pack -Z), baked into bind space, then into the
// Spine2 bone's local space like the other procedural parts, so it rides the mocap lean and breathing.
function buildGeorgeMultitool(sk) {
  const bone = pbBoneIndex(sk, 'mixamorigSpine2');
  if (bone < 0) return null;

  const steel = new THREE.MeshStandardMaterial({ color: 0xaeb8c4, metalness: 0.92, roughness: 0.28 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x2b313b, metalness: 0.8, roughness: 0.5 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc08f3d, metalness: 0.9, roughness: 0.34 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x5b3a22, metalness: 0.0, roughness: 0.85 });
  const gem = new THREE.MeshStandardMaterial({ color: 0x6beaff, emissive: 0x2fd6ff, emissiveIntensity: 1.8, metalness: 0.1, roughness: 0.15 });

  // Tool space -> bind space: sits behind the shoulder blades, top leaning over the right (-X) shoulder
  const toolToBind = new THREE.Matrix4().compose(
    new THREE.Vector3(0.015, 1.30, -0.150),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0.44 + Math.PI)),
    new THREE.Vector3(1, 1, 1)
  );
  const group = new THREE.Group();
  group.name = 'GeorgeMultitool';

  // Mirrored so the top leans over the right shoulder; a mirror inverts triangle winding, so flip it back
  const mirror = new THREE.Matrix4().makeScale(-1, 1, 1);
  const flipWinding = (g) => {
    if (g.index) { const a = g.index.array; for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; } }
    else for (const k in g.attributes) { const at = g.attributes[k], n = at.itemSize, a = at.array; for (let i = 0; i < at.count; i += 3) for (let c = 0; c < n; c++) { const t = a[(i + 1) * n + c]; a[(i + 1) * n + c] = a[(i + 2) * n + c]; a[(i + 2) * n + c] = t; } }
  };
  const add = (geom, mat, ink = true) => {
    geom.applyMatrix4(mirror);
    flipWinding(geom);
    geom.applyMatrix4(toolToBind);
    geom.applyMatrix4(sk.boneInverses[bone]);
    const m = new THREE.Mesh(geom, mat);
    m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true;
    group.add(m);
    if (ink && typeof georgeOutlineRigid !== 'undefined') {
      const ol = new THREE.Mesh(geom, georgeOutlineRigid);
      ol.frustumCulled = false;
      group.add(ol);
    }
    return m;
  };
  const cyl = (r0, r1, y0, y1, seg = 16) => {
    const g = new THREE.CylinderGeometry(r1, r0, y1 - y0, seg);
    g.translate(0, (y0 + y1) / 2, 0);
    return g;
  };
  const ring = (y, r, tube = 0.007) => {
    const g = new THREE.TorusGeometry(r, tube, 8, 20);
    g.rotateX(Math.PI / 2);
    g.translate(0, y, 0);
    return g;
  };
  const extrude = (shape, depth, bevel = 0.003) => {
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, curveSegments: 10 });
    g.translate(0, 0, -depth / 2);
    return g;
  };

  // Shaft: iron core, leather-wrapped grip, brass collars
  add(cyl(0.018, 0.018, -0.56, 0.58), iron);
  add(cyl(0.022, 0.022, -0.40, -0.06), leather);
  [-0.40, -0.06, 0.20, 0.34, 0.50].forEach((y) => add(ring(y, 0.024), brass, false));
  for (let i = 0; i < 9; i++) add(ring(-0.38 + i * 0.037, 0.0235, 0.0035), iron, false); // grip cord wraps

  // Pommel cap + glowing socket
  add(cyl(0.02, 0.03, -0.60, -0.56, 18), brass);
  const g = new THREE.OctahedronGeometry(0.026, 0); g.scale(1, 1.5, 1); g.translate(0, -0.635, 0);
  add(g, gem, false);

  // Axe head (+X) with a swept crescent blade, and a pick spike (-X) opposite
  const blade = new THREE.Shape();
  blade.moveTo(0.02, 0.40);
  blade.lineTo(0.09, 0.405);
  blade.quadraticCurveTo(0.20, 0.47, 0.215, 0.60);
  blade.quadraticCurveTo(0.12, 0.575, 0.075, 0.545);
  blade.quadraticCurveTo(0.12, 0.525, 0.115, 0.50);
  blade.quadraticCurveTo(0.12, 0.47, 0.075, 0.455);
  blade.lineTo(0.02, 0.455);
  add(extrude(blade, 0.016), steel);
  const cheek = new THREE.BoxGeometry(0.075, 0.1, 0.044); cheek.translate(0.0, 0.43, 0);
  add(cheek, iron);
  const pick = new THREE.ConeGeometry(0.026, 0.23, 14); pick.rotateZ(Math.PI / 2); pick.translate(-0.145, 0.43, 0); // tip toward -X
  add(pick, steel);
  const tip = new THREE.ConeGeometry(0.014, 0.1, 12); tip.translate(0, 0.63, 0); // spear tip
  add(tip, steel);
  const g2 = new THREE.OctahedronGeometry(0.02, 0); g2.scale(1, 1.4, 1); g2.translate(0, 0.585, 0.026);
  add(g2, gem, false);

  // Folding saw blade (serrated) clipped alongside the shaft
  const saw = new THREE.Shape();
  saw.moveTo(0.02, 0.02);
  const teeth = 14, sy0 = 0.02, sy1 = 0.30, hw = 0.05;
  saw.lineTo(0.02, sy1);
  saw.lineTo(0.02 + hw, sy1 - 0.01);
  for (let i = 0; i < teeth; i++) {
    const y = sy1 - 0.01 - (i + 0.5) * ((sy1 - 0.01 - sy0) / teeth);
    saw.lineTo(0.02 + hw - 0.014, y + 0.0085);
    saw.lineTo(0.02 + hw, y - 0.0085);
  }
  saw.lineTo(0.02, sy0);
  const sawGeo = extrude(saw, 0.006, 0.001); sawGeo.translate(0, 0, 0.0);
  add(sawGeo, steel);

  // Hook / carabiner at the foot and a coil of rope
  const hook = new THREE.TorusGeometry(0.055, 0.0085, 8, 24, Math.PI * 1.35); hook.rotateZ(Math.PI * 0.6); hook.translate(-0.045, -0.48, 0);
  add(hook, brass);
  const rope = new THREE.MeshStandardMaterial({ color: 0xc9b58a, roughness: 0.95 });
  for (let i = 0; i < 4; i++) add(ring(0.08 + i * 0.026, 0.0265, 0.0075), rope, false);

  // Two leather loops pinning the tool to the pack
  [-0.18, 0.12].forEach((y) => { const b = new THREE.BoxGeometry(0.07, 0.04, 0.035); b.translate(0, y, 0.0); add(b, leather); });

  // Chest strap: front diagonal from the left shoulder to the right hip, round the side, back to the tool's foot
  const rings = [[1.12, 0.155, 0.100, 0.010], [1.25, 0.160, 0.098, -0.002], [1.33, 0.180, 0.102, -0.006], [1.395, 0.198, 0.094, -0.014], [1.44, 0.15, 0.08, -0.022]];
  const surf = (y) => {
    for (let i = 0; i < rings.length - 1; i++) {
      const a = rings[i], b = rings[i + 1];
      if (y <= b[0]) { const t = Math.max(0, (y - a[0]) / (b[0] - a[0])); return a.map((v, k) => (k ? v + (b[k] - v) * t : 0)); }
    }
    return rings[rings.length - 1];
  };
  const onTorso = (x, y, front, pad = 0.014) => {
    const s = surf(y), rx = s[1], rz = s[2], z0 = s[3];
    const cx = Math.max(-0.98 * rx, Math.min(0.98 * rx, x));
    const z = z0 + (front ? 1 : -1) * (rz * Math.sqrt(1 - (cx / rx) ** 2) + pad);
    return new THREE.Vector3(x, y, z);
  };
  const pts = [
    onTorso(-0.12, 1.46, false), onTorso(-0.145, 1.45, true), onTorso(-0.085, 1.37, true), onTorso(0.0, 1.30, true),
    onTorso(0.085, 1.22, true), onTorso(0.15, 1.14, true), new THREE.Vector3(0.168, 1.12, -0.01),
    onTorso(0.12, 1.12, false), onTorso(0.06, 1.14, false, 0.02)
  ];
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.4);
  const strapGeo = new THREE.TubeGeometry(curve, 64, 0.0135, 8, false);
  strapGeo.applyMatrix4(sk.boneInverses[bone]);
  const strap = new THREE.Mesh(strapGeo, leather);
  strap.frustumCulled = false; strap.castShadow = true; strap.receiveShadow = true;
  group.add(strap);
  if (typeof georgeOutlineRigid !== 'undefined') { const ol = new THREE.Mesh(strapGeo, georgeOutlineRigid); ol.frustumCulled = false; group.add(ol); }
  const buckle = new THREE.BoxGeometry(0.036, 0.036, 0.012);
  buckle.translate(0, 0, 0);
  const bp = onTorso(0.0, 1.30, true, 0.022);
  buckle.translate(bp.x, bp.y, bp.z);
  buckle.applyMatrix4(sk.boneInverses[bone]);
  const bm = new THREE.Mesh(buckle, brass); bm.frustumCulled = false; bm.castShadow = true;
  group.add(bm);

  pbMergeGroup(group); // one mesh per material (10f): the 49 small pieces were each redrawn in every shadow pass
  sk.bones[bone].add(group);
  return group;
}
