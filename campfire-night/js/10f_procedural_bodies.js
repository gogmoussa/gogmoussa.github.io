// © 2026 George Moussa. All rights reserved.
// ============================================================================
// 10F. PROCEDURAL BODIES: smooth rigid parts attached to the Xbot skeleton bones
// ============================================================================
// Xbot's own surface is segmented (ball-joint mannequin), so George's torso/arms/legs/boots are rebuilt here as lofted/tapered parts in bind-pose space, converted into
// bone-local space and parented to the bones. The mocap clips still drive them. Geometry carries
// aOrigBindPos (bind-space position) so the existing region-painting shaders keep working.
// George's head and hands are procedural too (buildGeorgeHeadGeometry, buildGeorgeHands); Xbot's own
// meshes are hidden, so only its skeleton and mocap clips are used.

// When set, every part attached by pbAttach also gets an inverted-hull ink outline with this material
let pbOutlineMat = null;
// When set to an array, every part made by pbAttach and the finger rig is also listed in it, for pbBakeParts
let pbBakeList = null;

function pbBoneIndex(sk, name) {
  return sk.bones.findIndex((b) => b.name.replace(':', '') === name);
}

function pbP(sk, name) {
  const i = pbBoneIndex(sk, name);
  return new THREE.Vector3().setFromMatrixPosition(sk.boneInverses[i].clone().invert());
}

function pbAttach(sk, boneName, geom, mat) {
  const i = pbBoneIndex(sk, boneName);
  if (i < 0) return null;
  geom.setAttribute('aOrigBindPos', new THREE.BufferAttribute(geom.attributes.position.array.slice(), 3));
  geom.applyMatrix4(sk.boneInverses[i]);
  const mesh = new THREE.Mesh(geom, mat);
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  sk.bones[i].add(mesh);
  if (pbBakeList) pbBakeList.push(mesh);
  if (pbOutlineMat) {
    const ol = new THREE.Mesh(geom, pbOutlineMat);
    ol.frustumCulled = false;
    sk.bones[i].add(ol);
    if (pbBakeList) pbBakeList.push(ol);
  }
  return mesh;
}

// Merge listed rigid parts into one skinned mesh per material (George: 218 meshes become 3). Each part keeps riding its
// own parent, a bone or a finger pivot: the parents become the "bones" of a private skeleton with identity inverses and an
// identity bind matrix, so vertices stay in parent-local units and the picture does not change. What changes is the draw
// count: one per material per pass, and the fire's shadow alone is six passes. Call it after every part is built and
// painted, before the first render; parts must have no transform of their own. `bound` (centre, radius in root space) lets
// the merged meshes be frustum-culled, which the single parts never were; leave it out for a figure that walks far.
function pbBakeParts(root, list, bound) {
  const bones = [], boneOf = new Map(), groups = new Map();
  list.forEach((m) => {
    if (!m.parent) return;
    if (!boneOf.has(m.parent)) { boneOf.set(m.parent, bones.length); bones.push(m.parent); }
    if (!groups.has(m.material)) groups.set(m.material, []);
    groups.get(m.material).push(m);
  });
  if (!bones.length) return [];
  const skeleton = new THREE.Skeleton(bones, bones.map(() => new THREE.Matrix4()));
  const out = [];
  groups.forEach((meshes, mat) => {
    let nV = 0, nI = 0;
    meshes.forEach((m) => { const g = m.geometry, n = g.attributes.position.count; nV += n; nI += g.index ? g.index.count : n; });
    const pos = new Float32Array(nV * 3), nrm = new Float32Array(nV * 3), bind = new Float32Array(nV * 3);
    const si = new Uint16Array(nV * 4), sw = new Float32Array(nV * 4), idx = new (nV > 65535 ? Uint32Array : Uint16Array)(nI);
    let v0 = 0, i0 = 0, cast = false, receive = false;
    meshes.forEach((m) => {
      const g = m.geometry, a = g.attributes, n = a.position.count, b = boneOf.get(m.parent);
      pos.set(a.position.array.subarray(0, n * 3), v0 * 3);
      nrm.set(a.normal.array.subarray(0, n * 3), v0 * 3);
      bind.set(a.aOrigBindPos.array.subarray(0, n * 3), v0 * 3);
      for (let k = 0; k < n; k++) { si[(v0 + k) * 4] = b; sw[(v0 + k) * 4] = 1; }
      if (g.index) { const ia = g.index.array; for (let k = 0; k < g.index.count; k++) idx[i0 + k] = ia[k] + v0; i0 += g.index.count; }
      else { for (let k = 0; k < n; k++) idx[i0 + k] = v0 + k; i0 += n; }
      v0 += n;
      cast = cast || m.castShadow; receive = receive || m.receiveShadow;
      m.parent.remove(m);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    geo.setAttribute('aOrigBindPos', new THREE.BufferAttribute(bind, 3));
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    const sm = new THREE.SkinnedMesh(geo, mat);
    sm.name = 'pbBaked';
    sm.castShadow = cast; sm.receiveShadow = receive;
    if (bound) geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(bound[0], bound[1], bound[2]), bound[3]);
    else sm.frustumCulled = false;
    root.add(sm);
    sm.bind(skeleton, new THREE.Matrix4());
    out.push(sm);
  });
  return out;
}

// Merge a group's child meshes that share a material into one mesh each (position + normal only, so it suits plain
// untextured materials and the ink hull). The children must have no transform of their own. George's multitool: 49 -> 7.
function pbMergeGroup(group) {
  const groups = new Map();
  group.children.slice().forEach((m) => {
    if (!m.isMesh || m.isSkinnedMesh) return;
    if (!groups.has(m.material)) groups.set(m.material, []);
    groups.get(m.material).push(m);
  });
  groups.forEach((meshes, mat) => {
    if (meshes.length < 2) return;
    let nV = 0, nI = 0;
    meshes.forEach((m) => { const g = m.geometry, n = g.attributes.position.count; nV += n; nI += g.index ? g.index.count : n; });
    const pos = new Float32Array(nV * 3), nrm = new Float32Array(nV * 3), idx = new (nV > 65535 ? Uint32Array : Uint16Array)(nI);
    let v0 = 0, i0 = 0, cast = false, receive = false;
    meshes.forEach((m) => {
      const g = m.geometry, a = g.attributes, n = a.position.count;
      pos.set(a.position.array.subarray(0, n * 3), v0 * 3);
      nrm.set(a.normal.array.subarray(0, n * 3), v0 * 3);
      if (g.index) { const ia = g.index.array; for (let k = 0; k < g.index.count; k++) idx[i0 + k] = ia[k] + v0; i0 += g.index.count; }
      else { for (let k = 0; k < n; k++) idx[i0 + k] = v0 + k; i0 += n; }
      v0 += n;
      cast = cast || m.castShadow; receive = receive || m.receiveShadow;
      group.remove(m);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    const merged = new THREE.Mesh(geo, mat);
    merged.frustumCulled = false; merged.castShadow = cast; merged.receiveShadow = receive;
    group.add(merged);
  });
}

// Tapered capsule from a to b (radius r0 at a, r1 at b), hemispherical caps
function pbCapsule(a, b, r0, r1) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const L = A.distanceTo(B);
  const pts = [], capN = 7;
  for (let i = 0; i <= capN; i++) { const t = (i / capN) * Math.PI / 2; pts.push(new THREE.Vector2(Math.sin(t) * r0, -Math.cos(t) * r0)); }
  for (let i = 0; i <= capN; i++) { const t = (i / capN) * Math.PI / 2; pts.push(new THREE.Vector2(Math.cos(t) * r1, L + Math.sin(t) * r1)); }
  const g = new THREE.LatheGeometry(pts, 28);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()));
  g.translate(A.x, A.y, A.z);
  return g;
}

function pbEllipsoid(c, rx, ry, rz) {
  const g = new THREE.SphereGeometry(1, 28, 20);
  g.scale(rx, ry, rz);
  g.translate(c[0], c[1], c[2]);
  return g;
}

// Loft elliptical rings ({y, rx, rz, z0}) bottom-to-top with Catmull-Rom smoothing and a squarish section
function pbLoft(rings, segs = 32, steps = 30, squareness = 2.3) {
  const n = rings.length;
  const cr = (p0, p1, p2, p3, t) => 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
  const at = (i) => rings[Math.max(0, Math.min(n - 1, i))];
  const pos = [], idx = [];
  const e = 2 / squareness;
  for (let k = 0; k <= steps; k++) {
    const u = (k / steps) * (n - 1);
    const i = Math.min(n - 2, Math.floor(u)), t = u - i;
    const f = (key) => cr(at(i - 1)[key], at(i)[key], at(i + 1)[key], at(i + 2)[key], t);
    const y = f('y'), rx = f('rx'), rz = f('rz'), z0 = f('z0');
    for (let j = 0; j <= segs; j++) {
      const a = (j / segs) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      pos.push(rx * Math.sign(c) * Math.pow(Math.abs(c), e), y, z0 + rz * Math.sign(s) * Math.pow(Math.abs(s), e));
    }
  }
  const row = segs + 1;
  for (let k = 0; k < steps; k++) for (let j = 0; j < segs; j++) {
    const a = k * row + j, b = a + 1, c = a + row, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  // close bottom and top with fans
  const cb = pos.length / 3; pos.push(0, rings[0].y, rings[0].z0);
  const ct = cb + 1; pos.push(0, rings[n - 1].y, rings[n - 1].z0);
  for (let j = 0; j < segs; j++) { idx.push(cb, j, j + 1); idx.push(ct, steps * row + j + 1, steps * row + j); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // make sure winding faces outward (normal at a mid-side vertex should point away from the axis)
  const m = Math.floor(steps / 2) * row;
  const nrm = g.attributes.normal, p = g.attributes.position;
  if (nrm.getX(m) * (p.getX(m)) + nrm.getZ(m) * (p.getZ(m) - rings[0].z0) < 0) {
    const ia = g.index.array;
    for (let q = 0; q < ia.length; q += 3) { const tmp = ia[q + 1]; ia[q + 1] = ia[q + 2]; ia[q + 2] = tmp; }
    g.computeVertexNormals();
  }
  return g;
}

// George's torso loft (bind space); 10g samples it again to lay the overshirt edges on the surface.
// The chest stays inside the shoulder joints (x 0.152): any wider and a hanging upper arm sinks into the ribs,
// which forced the elbows out into chicken wings. The shoulder balls carry the shoulder width instead.
const GEORGE_TORSO_RINGS = [
  [1.02, 0.152, 0.104, 0.012], [1.09, 0.158, 0.102, 0.008], [1.15, 0.155, 0.098, 0.002],
  [1.17, 0.155, 0.098, 0.0], [1.25, 0.154, 0.100, -0.002], [1.33, 0.154, 0.106, -0.006],
  [1.395, 0.160, 0.098, -0.014], [1.435, 0.142, 0.082, -0.022], [1.462, 0.104, 0.070, -0.026],
  [1.480, 0.072, 0.060, -0.028], [1.486, 0.056, 0.054, -0.028]
].map(([y, rx, rz, z0]) => ({ y, rx, rz, z0 }));

function buildGeorgeBody(sk, mat) {
  const ring = (y, rx, rz, z0 = 0) => ({ y, rx, rz, z0 });
  pbAttach(sk, 'mixamorigHips', pbLoft([
    ring(0.93, 0.135, 0.100, 0.012), ring(1.00, 0.158, 0.106, 0.012), ring(1.08, 0.160, 0.106, 0.010)
  ]), mat);
  pbAttach(sk, 'mixamorigHips', pbEllipsoid([0, 0.95, 0.012], 0.152, 0.10, 0.104), mat);
  pbAttach(sk, 'mixamorigNeck', pbCapsule([0, 1.455, -0.028], [0, 1.560, -0.020], 0.040, 0.034), mat);
  // Torso rides the lowest spine bone (pivot ~1.14) so the bend sits at the waist; it overlaps the pelvis loft from 1.02.
  pbAttach(sk, 'mixamorigSpine', pbLoft(GEORGE_TORSO_RINGS), mat);

  [['Left', 1], ['Right', -1]].forEach(([side, s]) => {
    const A = pbP(sk, `mixamorig${side}Arm`), E = pbP(sk, `mixamorig${side}ForeArm`);
    const arm = (v) => [v.x, v.y, v.z];
    const wristEnd = [s * 0.668, E.y, E.z];
    pbAttach(sk, `mixamorig${side}Arm`, pbEllipsoid(arm(A), 0.053, 0.055, 0.055), mat);
    pbAttach(sk, `mixamorig${side}Arm`, pbCapsule(arm(A), arm(E), 0.049, 0.042), mat);
    pbAttach(sk, `mixamorig${side}ForeArm`, pbEllipsoid(arm(E), 0.043, 0.043, 0.043), mat);
    pbAttach(sk, `mixamorig${side}ForeArm`, pbCapsule(arm(E), wristEnd, 0.043, 0.034), mat);

    const U = pbP(sk, `mixamorig${side}UpLeg`), K = pbP(sk, `mixamorig${side}Leg`), F = pbP(sk, `mixamorig${side}Foot`);
    const ankleTop = [F.x, 0.14, F.z], ankleLow = [F.x, 0.07, F.z];
    pbAttach(sk, `mixamorig${side}UpLeg`, pbCapsule(arm(U), arm(K), 0.104, 0.071), mat);
    pbAttach(sk, `mixamorig${side}Leg`, pbEllipsoid(arm(K), 0.072, 0.072, 0.072), mat);
    pbAttach(sk, `mixamorig${side}Leg`, pbCapsule(arm(K), ankleTop, 0.071, 0.054), mat);
    pbAttach(sk, `mixamorig${side}Foot`, pbCapsule(ankleTop, ankleLow, 0.056, 0.058), mat);
    pbAttach(sk, `mixamorig${side}Foot`, pbEllipsoid([F.x, 0.07, F.z], 0.058, 0.070, 0.062), mat);
    pbAttach(sk, `mixamorig${side}Foot`, pbEllipsoid([F.x, 0.042, 0.105], 0.054, 0.042, 0.095), mat);
  });
}

// ----------------------------------------------------------------------------
// George's head: a clean egg-shaped skull + jaw + facial relief, authored in the same bind-space
// coordinates the 10E face/hair shaders already key on (crown ~1.775, brow 1.686, eyes 1.660,
// nose 1.62, lips 1.578, chin 1.561). Skinned 100% to the Head bone so shells/eyes/lips still work.
// ----------------------------------------------------------------------------
function buildGeorgeHeadGeometry(headBoneIdx) {
  const U = 72, V = 56;
  const cy = 1.668, cz = -0.004, rx = 0.077, ry = 0.107, ryLow = 0.133, rz = 0.100;
  const ss = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const g = (d, s) => Math.exp(-(d * d) / (2 * s * s));
  const pos = [], idx = [];
  for (let iv = 0; iv <= V; iv++) {
    const th = (iv / V) * Math.PI;
    for (let iu = 0; iu <= U; iu++) {
      const ph = (iu / U) * Math.PI * 2;
      const dx = Math.sin(th) * Math.cos(ph), dy = Math.cos(th), dz = Math.sin(th) * Math.sin(ph);
      let x = dx * rx, y = cy + dy * (dy < 0 ? ryLow : ry), z = cz + dz * rz;
      const yl = y - cy;
      // jaw: narrow toward the chin, push the chin forward, flatten the underside
      const lower = ss(0.0, -0.13, yl);
      x *= 1 - 0.22 * Math.pow(lower, 1.3);
      if (dz > 0) z += 0.012 * lower * ss(0, 0.9, dz);
      z -= 0.010 * lower * (dz < 0 ? 1 : 0);
      // forehead recedes a little toward the crown; cranium fuller at the back
      if (dz > 0) z -= 0.012 * ss(0.03, 0.105, yl);
      if (dz < 0) z -= 0.008 * ss(-0.02, 0.06, yl);
      // flatten the face plane slightly so features read
      if (dz > 0.3 && Math.abs(x) < 0.05 && yl > -0.09 && yl < 0.03) z -= 0.004 * g(x, 0.04);
      // facial bone structure (same Gaussians the old sculpt used, now on a clean surface)
      const ax = Math.abs(x), sx = x < 0 ? -1 : 1;
      if (ax < 0.115 && y > 1.52 && y < 1.78) {
        const front = Math.max(0, Math.min(1, (z + 0.02) / 0.10));
        z += 0.011 * g(y - 1.686, 0.011) * g(ax, 0.05) * front;                              // brow ridge
        z -= 0.010 * g(Math.hypot(ax - 0.031, (y - 1.660) * 1.15), 0.015) * front;          // eye sockets
        z += 0.008 * g(Math.hypot(ax - 0.060, y - 1.622), 0.016) * front;                    // cheekbones
        z -= 0.006 * g(Math.hypot(ax - 0.058, y - 1.588), 0.018) * front;                    // cheek hollow
        z += 0.018 * g(ax, 0.026) * g(y - 1.543, 0.016) * front;                             // chin: stronger, so the profile has a jaw
        z += 0.006 * g(ax, 0.050) * g(y - 1.716, 0.020) * front;                             // forehead: a little fullness above the brow
        x += sx * 0.004 * g(y - 1.575, 0.018) * Math.max(0, Math.min(1, (ax - 0.05) / 0.03)); // jaw angle
      }
      pos.push(x, y, z);
    }
  }
  // close the lat-long seam crack: the first and last columns get different front/back sculpt offsets (sin(2π) ≈ -0),
  // so share the seam z and fade the correction out over 3 columns each side
  for (let iv = 0; iv <= V; iv++) {
    const a0 = iv * (U + 1), a1 = a0 + U, d = (pos[a1 * 3 + 2] - pos[a0 * 3 + 2]) / 2;
    for (let c = 0; c < 3; c++) { const w = 1 - c / 3; pos[(a0 + c) * 3 + 2] += d * w; pos[(a1 - c) * 3 + 2] -= d * w; }
  }
  const row = U + 1;
  for (let iv = 0; iv < V; iv++) for (let iu = 0; iu < U; iu++) {
    const a = iv * row + iu, b = a + 1, c = a + row, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  // outward check on a front-of-face vertex, flip winding if needed
  const probeV = Math.floor(V / 2) * row + Math.floor(U / 4);
  if (geo.attributes.normal.getZ(probeV) < 0) {
    const ia = geo.index.array;
    for (let q = 0; q < ia.length; q += 3) { const t = ia[q + 1]; ia[q + 1] = ia[q + 2]; ia[q + 2] = t; }
    geo.computeVertexNormals();
  }
  // weld the lat-long seam and poles so there is no shading crease
  const n = geo.attributes.normal;
  for (let iv = 0; iv <= V; iv++) {
    const a = iv * row, b = a + U;
    const nx = (n.getX(a) + n.getX(b)) / 2, ny = (n.getY(a) + n.getY(b)) / 2, nz = (n.getZ(a) + n.getZ(b)) / 2;
    const l = Math.hypot(nx, ny, nz) || 1;
    n.setXYZ(a, nx / l, ny / l, nz / l); n.setXYZ(b, nx / l, ny / l, nz / l);
  }
  for (let iu = 0; iu <= U; iu++) { n.setXYZ(iu, 0, 1, 0); n.setXYZ(V * row + iu, 0, -1, 0); }
  const count = pos.length / 3;
  const si = new Uint16Array(count * 4), sw = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) { si[i * 4] = headBoneIdx; sw[i * 4] = 1; }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  geo.setAttribute('aOrigBindPos', new THREE.Float32BufferAttribute(pos.slice(), 3));
  return geo;
}

// George's hands: flat palm, four tapered fingers with a relaxed baked curl, and a thumb, rigid on the Hand bones.
// Authored in the T-pose bind (palm down, fingers outward along ±x, thumb toward +z). Needs sgTube from 10g.
// Fingers are jointed: three segments per finger (two for the thumb) hung on plain pivots under the Hand bone, so the loop
// can curl them (georgeFingerRig, driven in 14B by curlFingers). Authored in bind space like everything else here: in the
// bind pose the palms face down (-y), fingers point out along x, thumbs forward (+z). The Xbot finger bones stay untouched.
const georgeFingerRig = { L: null, R: null };
function buildGeorgeHands(sk, mat) {
  [['Left', 1], ['Right', -1]].forEach(([side, s]) => {
    const W = pbP(sk, `mixamorig${side}Hand`);
    const bone = `mixamorig${side}Hand`, bi = pbBoneIndex(sk, bone), handBone = sk.bones[bi], inv = sk.boneInverses[bi];
    const X = (d) => s * (Math.abs(W.x) + d);
    pbAttach(sk, bone, pbEllipsoid([X(0.030), W.y - 0.003, W.z], 0.047, 0.0165, 0.041), mat);
    const outline = pbOutlineMat;
    const local = (v) => v.clone().applyMatrix4(inv); // bind space -> Hand-bone local
    // a pivot under `parent` at bind point J (pivots carry no rotation at rest, so hand-local offsets just add up)
    const pivot = (parent, J, parentJ) => {
      const o = new THREE.Object3D();
      o.position.copy(parentJ ? local(J).sub(local(parentJ)) : local(J));
      parent.add(o);
      return o;
    };
    const hang = (o, J, geom) => { // bind-space geom -> pivot-local, attached with its ink outline
      geom.setAttribute('aOrigBindPos', new THREE.BufferAttribute(geom.attributes.position.array.slice(), 3));
      geom.applyMatrix4(inv);
      const lj = local(J);
      geom.translate(-lj.x, -lj.y, -lj.z);
      const m = new THREE.Mesh(geom, mat); m.frustumCulled = false; m.castShadow = true; o.add(m);
      if (pbBakeList) pbBakeList.push(m);
      if (outline) { const ol = new THREE.Mesh(geom, outline); ol.frustumCulled = false; o.add(ol); if (pbBakeList) pbBakeList.push(ol); }
    };
    // bend axis in bind space: positive angle swings the finger down toward the palm (d x -y)
    const bendAxis = (d) => new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, -1, 0)).normalize().transformDirection(inv).normalize();
    const rig = { fingers: [], thumb: null };
    // [z offset, length, base radius]: index, middle, ring, little. Look item 6 (Nov 17 2026): slimmer (was 10.8/11.2/10.4/9.0 mm)
    // and tapering to ~55% at the tip (was 68%); joint points and pivots are unchanged, so every pose stays as it was.
    [[0.027, 0.072, 0.0085], [0.009, 0.080, 0.0088], [-0.009, 0.074, 0.0082], [-0.026, 0.058, 0.0071]].forEach(([dz, L, r]) => {
      const bx = Math.abs(W.x) + 0.062;
      const P = [
        new THREE.Vector3(s * bx, W.y - 0.002, W.z + dz),
        new THREE.Vector3(s * (bx + L * 0.40), W.y - 0.006, W.z + dz * 1.04),
        new THREE.Vector3(s * (bx + L * 0.70), W.y - 0.012, W.z + dz * 1.08),
        new THREE.Vector3(s * (bx + L), W.y - 0.020, W.z + dz * 1.10)
      ];
      const rr = [r, r * 0.86, r * 0.72, r * 0.55];
      const segs = [];
      let parent = handBone, parentJ = null;
      for (let k = 0; k < 3; k++) {
        const o = pivot(parent, P[k], parentJ);
        const a = P[k], b = P[k + 1], m = a.clone().lerp(b, 0.5);
        hang(o, a, sgTube([a.toArray(), m.toArray(), b.toArray()], rr[k], rr[k + 1], 10, 8));
        if (k > 0) hang(o, a, pbEllipsoid(a.toArray(), rr[k] * 1.02, rr[k] * 1.02, rr[k] * 1.02)); // knuckle fills the bend
        if (k === 2) hang(o, b, pbEllipsoid(b.toArray(), rr[3], rr[3], rr[3]));              // rounded fingertip
        segs.push(o);
        parent = o; parentJ = a;
      }
      rig.fingers.push({ segs, axis: bendAxis(P[1].clone().sub(P[0])) });
    });
    const tb = Math.abs(W.x) + 0.012;
    const T = [
      new THREE.Vector3(s * tb, W.y - 0.004, W.z + 0.026),
      new THREE.Vector3(s * (tb + 0.032), W.y - 0.007, W.z + 0.042),
      new THREE.Vector3(s * (tb + 0.056), W.y - 0.012, W.z + 0.054),
      new THREE.Vector3(s * (tb + 0.074), W.y - 0.020, W.z + 0.060)
    ];
    // Look item 6b (Nov 17 2026): the thumb was the longest digit (8.3 cm) and ~1.45x a finger's width, so hanging down
    // the thigh in the front close-ups it read huge. The tip comes back toward T[2] (T[3] is not a pivot and the bend
    // axis uses T[2], so no pose changes) and the radii drop to ~1.2x a finger.
    T[3] = T[2].clone().lerp(T[3], 0.30);
    const t0 = pivot(handBone, T[0], null);
    hang(t0, T[0], sgTube([T[0].toArray(), T[1].toArray()], 0.0105, 0.0088, 8, 8));
    const t1 = pivot(t0, T[1], T[0]);
    hang(t1, T[1], sgTube([T[1].toArray(), T[2].toArray(), T[3].toArray()], 0.0088, 0.0062, 12, 8));
    hang(t1, T[1], pbEllipsoid(T[1].toArray(), 0.0091, 0.0091, 0.0091));
    hang(t1, T[3], pbEllipsoid(T[3].toArray(), 0.0062, 0.0062, 0.0062));
    // the thumb folds in under the palm toward the fingers: bend about its own axis plus a sweep about the palm normal
    rig.thumb = { segs: [t0, t1], axis: bendAxis(T[2].clone().sub(T[0])),
      sweep: new THREE.Vector3(0, -s, 0).transformDirection(inv).normalize() };
    georgeFingerRig[s > 0 ? 'L' : 'R'] = rig;
  });
}
