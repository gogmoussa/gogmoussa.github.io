// © 2026 George Moussa. All rights reserved.
// ==========================================================================
// 18. THE PARTS OF GEORGE (CHARACTERS.md). Loads last.
//  18A  The Avoider: a pale double of George that steps out of him and stands close behind and beside him,
//       half turned away toward the trees, then is drawn back in. Shown by the `avoid` envelope (avoidE, 14_animation_loop.js) or held
//       on screen from the dock's Characters menu.
//  18N  The Numb-er: a smoke-grey double that stands on George's other side, facing him, one hand held out, with
//       smoke rising off it and low fog banks that roll in from the trees. Shown by the `numb` envelope (numbE) or the menu.
//  18J  The Judge: a charcoal double, taller than George, that rises on the tree line behind him where the fire would throw
//       his shadow, and stands over him while he sits. Shown by the `judge` envelope (judgeE) or the menu.
//  18B  The roster and the dock menu: showPart / IW.part.
// A part's body is George's own rig, cloned once, playing the rig's standing idle on its own mixer (C4: all made of him).
// ==========================================================================

// --- 18A. THE AVOIDER ---
const AVOIDER = { root: null, mixer: null, head: null, mats: [], feet: [], failed: false, show: 0 };
const AVOIDER_LOOK = { color: 0xffb08a, opacity: 0.2, back: 0.6, side: 0.7, turn: 2.35 }; // metres behind / beside George's seat; `turn` (radians) is how far he is
// turned from facing George: 0 faces him, PI is his full back. 2.35 (about 135 deg) is half turned to leave, toward the trees behind George.
const _avDir = new THREE.Vector3(), _avFoot = new THREE.Vector3();

// Object3D.clone leaves cloned skinned meshes bound to the ORIGINAL bones; rebind them to the cloned ones.
function cloneRig(src) {
  const map = new Map(), clone = src.clone(true);
  (function walk(a, b) { map.set(a, b); for (let i = 0; i < a.children.length; i++) if (b.children[i]) walk(a.children[i], b.children[i]); })(src, clone);
  src.traverse((n) => {
    if (!n.isSkinnedMesh) return;
    const c = map.get(n);
    c.skeleton = new THREE.Skeleton(n.skeleton.bones.map((b) => map.get(b)), n.skeleton.boneInverses);
    c.bindMatrix.copy(n.bindMatrix); c.bindMatrixInverse.copy(n.bindMatrixInverse);
  });
  return { clone, map };
}

// Shared body for a part: George's rig cloned, every visible mesh dressed in `mk(skinning)`, standing in the rig's idle on
// its own mixer. Fills P.root / P.mixer / P.head / P.feet / P.mats / P.bone(name). Sets P.failed if the rig is not usable.
function buildPartBody(P, label, mk) {
  if (P.root || P.failed || typeof xbotHumanModel === 'undefined' || !xbotHumanModel || !xbotHumanModel.parent) return;
  try {
    const { clone, map } = cloneRig(xbotHumanModel);
    const rigid = mk(false), skinned = mk(true);
    P.mats = [rigid, skinned];
    clone.traverse((c) => {
      if (c.isBone) return;
      if (c.isMesh) {
        const m = Array.isArray(c.material) ? c.material[0] : c.material;
        if (!c.visible || (m && m.side === THREE.BackSide)) { c.visible = false; return; } // hidden Xbot skin and the inked outline hulls
        c.material = c.isSkinnedMesh ? skinned : rigid;
        c.castShadow = false; c.receiveShadow = false; c.frustumCulled = false; c.renderOrder = 3;
      } else if (c.isLine || c.isPoints || c.isSprite) c.visible = false;
    });
    const byName = (name) => { const b = humanBones[name]; return b ? map.get(b) : null; };
    P.bone = byName;
    P.feet = ['mixamorigLeftToeBase', 'mixamorigRightToeBase', 'mixamorigLeftFoot', 'mixamorigRightFoot'].map(byName).filter(Boolean);
    P.head = byName('mixamorigHead');
    // It stands on its own: the rig's standing idle, on the clone's own mixer (clip tracks find the cloned bones by name)
    P.mixer = new THREE.AnimationMixer(clone);
    const idle = humanActions.idle && humanActions.idle.getClip();
    if (idle) { const act = P.mixer.clipAction(idle); act.timeScale = 0.45; act.play(); P.mixer.update(0); }
    clone.visible = false;
    xbotHumanModel.parent.add(clone);
    P.root = clone;
  } catch (err) { P.failed = true; console.error(label + ' build failed', err); }
}
// Stand a part's root on the ground (lowest foot bone 7 cm up, the ankle/toe height of the rig).
function groundPart(P) {
  const r = P.root;
  r.updateMatrixWorld(true);
  let low = Infinity;
  for (const f of P.feet) { f.getWorldPosition(_avFoot); r.parent.worldToLocal(_avFoot); if (_avFoot.y < low) low = _avFoot.y; }
  if (low < Infinity) r.position.y += 0.07 - low;
}
function buildAvoider() {
  buildPartBody(AVOIDER, 'Avoider', (skinning) => new THREE.MeshBasicMaterial({ color: AVOIDER_LOOK.color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, skinning, fog: false }));
}

// Called every frame from the loop. `e` is the avoid envelope (0..1); the Characters menu can also hold him on screen.
function tickAvoider(e, dt) {
  AVOIDER.show += ((partShown === 'avoider' ? 1 : 0) - AVOIDER.show) * (1 - Math.exp(-(dt || 0.016) * 3));
  e = Math.max(e, AVOIDER.show < 0.004 ? 0 : AVOIDER.show);
  if (e <= 0.004) { if (AVOIDER.root) AVOIDER.root.visible = false; return; }
  if (!AVOIDER.root) buildAvoider();
  const r = AVOIDER.root;
  if (!r) return;
  const L = AVOIDER_LOOK, g = xbotHumanModel.position;
  if (AVOIDER.mixer) AVOIDER.mixer.update(dt || 0.016);
  if (AVOIDER.head && humanBones.mixamorigHead) AVOIDER.head.scale.copy(humanBones.mixamorigHead.scale); // George's stylized head size
  // His spot: a little behind George (away from the fire) and to one side. He steps out of George toward it, already turned away.
  _avDir.set(GEORGE_SEAT.x - hearthGroup.position.x, 0, GEORGE_SEAT.z - hearthGroup.position.z).normalize();
  const ox = _avDir.x * L.back + _avDir.z * L.side, oz = _avDir.z * L.back - _avDir.x * L.side;
  r.position.set(g.x + ox * e, g.y, g.z + oz * e);
  // The rig faces +z. He is turned away from George by L.turn, to whichever side points more toward the trees behind George
  // (_avDir). Set all three axes: the clone can inherit x = z = pi from George's root, which flips a y-only turn.
  const face = Math.atan2(-ox, -oz), ya = face + L.turn, yb = face - L.turn;
  const da = Math.sin(ya) * _avDir.x + Math.cos(ya) * _avDir.z, db = Math.sin(yb) * _avDir.x + Math.cos(yb) * _avDir.z;
  r.rotation.set(0, da >= db ? ya : yb, 0);
  r.visible = true;
  groundPart(AVOIDER); // keep his feet on the ground
  const flicker = 0.88 + 0.12 * Math.sin(performance.now() * 0.011);
  for (const m of AVOIDER.mats) m.opacity = L.opacity * e * flicker;
}

// --- 18N. THE NUMB-ER ---
// Normal (not additive) blending and no scene fog or lights on the material, so it stays the same smoke grey in every mood.
const NUMBER = { root: null, mixer: null, head: null, mats: [], feet: [], failed: false, show: 0, wisps: [], banks: [], group: null };
const NUMBER_LOOK = {
  color: 0x15171b, opacity: 0.8,        // the body. The composite lifts unlit colours a lot: this near-black reads as mid smoke grey
  back: -1.12, side: -0.85, drift: 0.7, // metres behind (negative: toward the fire) / beside George's seat. The pond side, opposite the Avoider,
                                        // and clear of George from the default camera (straight behind him it is hidden). It drifts in this far.
  wispColor: 0x1c1e23, wisps: 9, wispOpacity: 0.16,
  banks: 14, bankFar: 10.5, bankNear: 3.4, bankOpacity: 0.3, // low fog: a ring of soft banks that closes in from the trees
};
const _nbA = new THREE.Vector3(), _nbB = new THREE.Vector3(), _nbD = new THREE.Vector3(), _nbTo = new THREE.Vector3();
const _nbQ = new THREE.Quaternion(), _nbW = new THREE.Quaternion(), _nbP = new THREE.Quaternion();

function smokeTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}
function buildNumber() {
  buildPartBody(NUMBER, 'Numb-er', (skinning) => new THREE.MeshBasicMaterial({ color: NUMBER_LOOK.color, transparent: true, opacity: 0, skinning, fog: false }));
  if (!NUMBER.root || NUMBER.group) return;
  const L = NUMBER_LOOK, tex = smokeTexture(), grp = new THREE.Group();
  const puff = (color, order) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    sp.renderOrder = order; grp.add(sp); return sp;
  };
  for (let i = 0; i < L.wisps; i++) NUMBER.wisps.push({ sp: puff(L.wispColor, 4), phase: i / L.wisps, speed: 0.11 + (i % 3) * 0.035, ang: i * 2.4 });
  for (let i = 0; i < L.banks; i++) NUMBER.banks.push({ sp: puff(0xffffff, 2), ang: (i / L.banks) * Math.PI * 2 + (i % 2) * 0.17, k: 0.8 + (i % 4) * 0.13 });
  grp.visible = false;
  NUMBER.root.parent.add(grp);
  NUMBER.group = grp;
}
// Turn `bone` so the line to its child points along world direction `dir`. The mixer rewrites the bone every frame, so
// this never accumulates.
function aimBone(bone, child, dir) {
  if (!bone || !child) return;
  bone.getWorldPosition(_nbA); child.getWorldPosition(_nbB);
  _nbQ.setFromUnitVectors(_nbB.sub(_nbA).normalize(), dir);
  bone.getWorldQuaternion(_nbW).premultiply(_nbQ);
  bone.parent.getWorldQuaternion(_nbP).invert();
  bone.quaternion.copy(_nbP.multiply(_nbW));
  bone.updateMatrixWorld(true);
}

// Called every frame from the loop. `e` is the numb envelope (0..1); the Characters menu can also hold the figure on screen.
// The low fog banks belong to the cue only (`e`); the figure and its smoke show for either.
function tickNumber(e, dt, t) {
  NUMBER.show += ((partShown === 'number' ? 1 : 0) - NUMBER.show) * (1 - Math.exp(-(dt || 0.016) * 3));
  const s = Math.max(e, NUMBER.show < 0.004 ? 0 : NUMBER.show);
  if (s <= 0.004) { if (NUMBER.root) { NUMBER.root.visible = false; NUMBER.group.visible = false; } return; }
  if (!NUMBER.root) buildNumber();
  const r = NUMBER.root;
  if (!r || !NUMBER.group) return;
  const L = NUMBER_LOOK, g = xbotHumanModel.position, hx = hearthGroup.position.x, hz = hearthGroup.position.z;
  if (NUMBER.mixer) NUMBER.mixer.update(dt || 0.016);
  if (NUMBER.head && humanBones.mixamorigHead) NUMBER.head.scale.copy(humanBones.mixamorigHead.scale);
  // Its spot: the pond side of George, between him and the fire. It drifts in the last little way as it thickens.
  _avDir.set(GEORGE_SEAT.x - hx, 0, GEORGE_SEAT.z - hz).normalize();
  const ox = _avDir.x * L.back + _avDir.z * L.side, oz = _avDir.z * L.back - _avDir.x * L.side;
  const len = Math.hypot(ox, oz), far = 1 + (L.drift / len) * (1 - s);
  r.position.set(g.x + ox * far, g.y, g.z + oz * far);
  r.rotation.set(0, Math.atan2(-ox, -oz), 0); // the rig faces +z; turn it to look at George (all three axes, see tickAvoider)
  r.visible = true;
  groundPart(NUMBER);
  // One hand held out to him: upper arm forward and down, forearm level, both aimed along the line to George.
  _nbTo.set(-ox / len, 0, -oz / len);
  const arm = NUMBER.bone('mixamorigRightArm'), fore = NUMBER.bone('mixamorigRightForeArm'), hand = NUMBER.bone('mixamorigRightHand');
  aimBone(arm, fore, _nbD.set(_nbTo.x * 0.72, -0.69, _nbTo.z * 0.72).normalize());
  aimBone(fore, hand, _nbD.set(_nbTo.x, 0.1, _nbTo.z).normalize());
  for (const m of NUMBER.mats) m.opacity = L.opacity * s;
  // Smoke coming off it: each wisp's place is a pure function of time
  NUMBER.group.visible = true;
  for (const w of NUMBER.wisps) {
    const c = (t * w.speed + w.phase) % 1, a = w.ang + t * 0.5;
    w.sp.position.set(r.position.x + Math.cos(a) * (0.12 + c * 0.3), r.position.y + 0.5 + c * 1.9, r.position.z + Math.sin(a) * (0.12 + c * 0.3));
    w.sp.scale.setScalar(0.55 + c * 0.9);
    w.sp.material.opacity = L.wispOpacity * s * Math.sin(c * Math.PI);
  }
  // Low fog from the trees: the ring closes in with the envelope and takes the mood's fog colour, lifted toward grey
  const rad = L.bankFar + (L.bankNear - L.bankFar) * e;
  for (const b of NUMBER.banks) {
    const a = b.ang + Math.sin(t * 0.07 + b.ang * 3) * 0.12, rr = rad * b.k + Math.sin(t * 0.21 + b.ang * 5) * 0.4;
    b.sp.position.set(hx + Math.cos(a) * rr, g.y + 0.45, hz + Math.sin(a) * rr);
    b.sp.scale.set(6.5 * b.k, 1.7, 1);
    b.sp.material.color.copy(scene.fog.color).lerp(_nbGrey, 0.3);
    b.sp.material.opacity = L.bankOpacity * e;
    b.sp.visible = e > 0.004;
  }
}
const _nbGrey = new THREE.Color(0x8a8f96);

// --- 18J. THE JUDGE ---
// His own shadow given a body: George's rig in flat charcoal, scaled up, standing. Normal blending, no scene fog or lights,
// so it stays charcoal in every mood. It never sits and never comes closer; it only rises and sinks.
const JUDGE = { root: null, mixer: null, head: null, mats: [], feet: [], failed: false, show: 0, flecks: [], group: null, base: null };
const JUDGE_LOOK = {
  color: 0x050506, opacity: 0.94, // the body. The composite lifts unlit colours a lot: this near-black reads as charcoal
  back: 4.6, side: 1.5,           // metres behind George's seat (away from the fire, toward the pines) / to the side, so he does not hide it
  scale: 1.75, low: 0.35,         // times George's size; `low` is the height it starts from as it rises (a shadow growing up the trees)
  ashColor: 0x8d8880, flecks: 10, ashOpacity: 0.5, // ash that falls off it
};
function buildJudge() {
  buildPartBody(JUDGE, 'Judge', (skinning) => new THREE.MeshBasicMaterial({ color: JUDGE_LOOK.color, transparent: true, opacity: 0, skinning, fog: false }));
  if (!JUDGE.root || JUDGE.group) return;
  JUDGE.base = JUDGE.root.scale.clone();
  const L = JUDGE_LOOK, tex = smokeTexture(), grp = new THREE.Group();
  for (let i = 0; i < L.flecks; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: L.ashColor, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    sp.renderOrder = 4; grp.add(sp);
    JUDGE.flecks.push({ sp, phase: i / L.flecks, speed: 0.07 + (i % 3) * 0.02, ang: i * 2.4 });
  }
  grp.visible = false;
  JUDGE.root.parent.add(grp);
  JUDGE.group = grp;
}
// Called every frame from the loop. `e` is the judge envelope (0..1); the Characters menu can also hold the figure on screen.
function tickJudge(e, dt, t) {
  JUDGE.show += ((partShown === 'judge' ? 1 : 0) - JUDGE.show) * (1 - Math.exp(-(dt || 0.016) * 3));
  const s = Math.max(e, JUDGE.show < 0.004 ? 0 : JUDGE.show);
  if (s <= 0.004) { if (JUDGE.root) { JUDGE.root.visible = false; JUDGE.group.visible = false; } return; }
  if (!JUDGE.root) buildJudge();
  const r = JUDGE.root;
  if (!r || !JUDGE.group) return;
  const L = JUDGE_LOOK, g = xbotHumanModel.position;
  if (JUDGE.mixer) JUDGE.mixer.update(dt || 0.016);
  if (JUDGE.head && humanBones.mixamorigHead) JUDGE.head.scale.copy(humanBones.mixamorigHead.scale);
  // Its spot: straight out from the fire through George, on the tree line, a little to one side so George does not hide it.
  _avDir.set(GEORGE_SEAT.x - hearthGroup.position.x, 0, GEORGE_SEAT.z - hearthGroup.position.z).normalize();
  const ox = _avDir.x * L.back + _avDir.z * L.side, oz = _avDir.z * L.back - _avDir.x * L.side;
  r.position.set(g.x + ox, g.y, g.z + oz);
  r.rotation.set(0, Math.atan2(-ox, -oz), 0); // the rig faces +z; turn it to look at George (all three axes, see tickAvoider)
  // It rises: full width from the start, height grows with the envelope. Scale is set from the stored base, never multiplied.
  const tall = L.low + (1 - L.low) * s;
  r.scale.set(JUDGE.base.x * L.scale, JUDGE.base.y * L.scale * tall, JUDGE.base.z * L.scale);
  r.visible = true;
  groundPart(JUDGE);
  for (const m of JUDGE.mats) m.opacity = L.opacity * s;
  // Ash falling off it: each fleck's place is a pure function of time
  JUDGE.group.visible = true;
  const top = 1.8 * L.scale * tall;
  for (const f of JUDGE.flecks) {
    const c = (t * f.speed + f.phase) % 1, a = f.ang + Math.sin(t * 0.6 + f.ang) * 0.5, rad = 0.25 * L.scale + c * 0.35;
    f.sp.position.set(r.position.x + Math.cos(a) * rad, r.position.y + top * (0.95 - c * 0.9), r.position.z + Math.sin(a) * rad);
    f.sp.scale.setScalar(0.07 + (f.ang % 1) * 0.05);
    f.sp.material.opacity = L.ashOpacity * s * Math.sin(c * Math.PI);
  }
}

// --- 18B. ROSTER + DOCK MENU ---
// Every part in CHARACTERS.md. `built: false` ones are listed greyed out so the menu shows what is coming.
const PARTS = {
  avoider: { label: 'The Avoider', built: true },
  judge: { label: 'The Judge', built: true },
  number: { label: 'The Numb-er', built: true },
  child: { label: 'The Child on watch', built: false },
};
let partShown = null;
function showPart(name) {
  partShown = PARTS[name] && PARTS[name].built ? name : null;
  const sel = document.getElementById('xd-part');
  if (sel) sel.value = partShown || '';
  return partShown;
}
(function buildPartsMenu() {
  const sel = document.getElementById('xd-part');
  if (!sel) return;
  sel.innerHTML = '<option value="">Characters: none</option>' + Object.keys(PARTS).map((k) =>
    `<option value="${k}"${PARTS[k].built ? '' : ' disabled'}>${PARTS[k].label}${PARTS[k].built ? '' : ' (not built yet)'}</option>`).join('');
  sel.onchange = () => { showPart(sel.value); sel.blur(); };
})();
if (window.IW) {
  IW.part = (name) => showPart(name);                                   // IW.part('avoider' | 'number' | 'judge') holds a part on screen; IW.part() sends it back
  IW.parts = () => Object.keys(PARTS).map((k) => ({ name: k, label: PARTS[k].label, built: PARTS[k].built, shown: partShown === k }));
}
