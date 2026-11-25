// © 2026 George Moussa. All rights reserved.
// ============================================================================
// 14. 60 FPS REAL-TIME ANIMATION, PLANAR REFLECTION & 5-PASS BLOOM LOOP
// ============================================================================
const clock = new THREE.Clock();
const _tmpEuler = new THREE.Euler();
const _tmpQuat = new THREE.Quaternion();
const _dofDir = new THREE.Vector3();
const _shakeEuler = new THREE.Euler();
const _shakeQuat = new THREE.Quaternion();
function addBoneOffset(bone, rx, ry, rz) {
  if (!bone) return;
  _tmpEuler.set(rx, ry, rz, 'XYZ');
  _tmpQuat.setFromEuler(_tmpEuler);
  bone.quaternion.multiply(_tmpQuat);
}

const humanClean = {};
const POSED_BONES = ['mixamorigHips', 'mixamorigSpine', 'mixamorigSpine1', 'mixamorigSpine2', 'mixamorigHead',
  'mixamorigLeftUpLeg', 'mixamorigLeftLeg', 'mixamorigLeftFoot', 'mixamorigRightUpLeg', 'mixamorigRightLeg', 'mixamorigRightFoot',
  'mixamorigLeftArm', 'mixamorigRightArm', 'mixamorigLeftForeArm', 'mixamorigRightForeArm'];
const SEAT_HIP_DROP = 42, SEAT_HIP_BACK = -2; // cm (Armature is 0.01 scale)
const SEAT_WRIST = new THREE.Vector3(13.4, 1.4, 31.4); // left wrist on the thigh, Hips space (cm); mirrored for the right
const SEAT_ELBOW = new THREE.Vector3(28, 12, 0);       // pole: the left elbow swings toward this, out past the ribs

const _ikS = new THREE.Vector3(), _ikE = new THREE.Vector3(), _ikW = new THREE.Vector3(), _ikT = new THREE.Vector3();
const _ikA = new THREE.Vector3(), _ikB = new THREE.Vector3(), _ikQ = new THREE.Quaternion(), _ikPQ = new THREE.Quaternion(), _ikBQ = new THREE.Quaternion();
function rotateBoneWorld(bone, q) { // pre-multiply a world-space rotation onto a bone, keeping its parent
  bone.parent.getWorldQuaternion(_ikPQ);
  bone.getWorldQuaternion(_ikBQ);
  bone.quaternion.copy(_ikPQ.invert().multiply(_ikBQ.premultiply(q)));
  bone.updateMatrixWorld(true);
}
function pinWrist(side, wrist, elbow) { // wrist target and elbow pole in Hips space (cm), already mirrored for this side
  const arm = humanBones[`mixamorig${side}Arm`], fore = humanBones[`mixamorig${side}ForeArm`], hand = humanBones[`mixamorig${side}Hand`];
  if (!arm || !fore || !hand) return;
  arm.getWorldPosition(_ikS); fore.getWorldPosition(_ikE); hand.getWorldPosition(_ikW); // also refreshes the hips matrix
  _ikT.copy(wrist); humanBones['mixamorigHips'].localToWorld(_ikT);
  const L1 = _ikS.distanceTo(_ikE), L2 = _ikE.distanceTo(_ikW);
  const d = Math.min(_ikS.distanceTo(_ikT), (L1 + L2) * 0.995);
  _ikA.subVectors(_ikS, _ikE); _ikB.subVectors(_ikW, _ikE);
  const cur = _ikA.angleTo(_ikB);
  const want = Math.acos(THREE.MathUtils.clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2), -1, 1));
  rotateBoneWorld(fore, _ikQ.setFromAxisAngle(_ikA.cross(_ikB).normalize(), want - cur));
  hand.getWorldPosition(_ikW);
  rotateBoneWorld(arm, _ikQ.setFromUnitVectors(_ikW.sub(_ikS).normalize(), _ikT.sub(_ikS).normalize()));
  // roll the whole arm about the shoulder-wrist line until the elbow faces the pole
  const axis = _ikT; // already the unit shoulder-to-wrist direction
  fore.getWorldPosition(_ikE); _ikE.sub(_ikS);
  _ikA.copy(elbow); humanBones['mixamorigHips'].localToWorld(_ikA); _ikA.sub(_ikS);
  _ikE.addScaledVector(axis, -_ikE.dot(axis)); _ikA.addScaledVector(axis, -_ikA.dot(axis));
  if (_ikE.lengthSq() > 1e-8 && _ikA.lengthSq() > 1e-8) {
    const roll = Math.atan2(_ikB.crossVectors(_ikE, _ikA).dot(axis), _ikE.dot(_ikA));
    rotateBoneWorld(arm, _ikQ.setFromAxisAngle(axis, roll));
  }
}

// --- 14B. GEORGE'S EMOTIONS ---
// Seated body language layered on the log pose, picked per beat with `emote`. Every value is an offset from the calm seat:
//   lean/twist/tilt  Spine pitch (+ forward) / yaw / roll     chest  Spine2 pitch (- opens the chest)
//   hp/hy/hr         head pitch (+ nose down) / yaw / roll     lid    + squints or droops the lids, - widens
//   smile -1..1, open 0..1, brow (m, lift), knit (+ worried inner ends up, - angry), blush 0..1
//   gaze + looks down / - up (eyes only, on top of the head pitch)
//   tremble, shake (head-shake bursts), bob + bobHz (sob shudder / laugh bounce), breath (+ faster, deeper), fidget (cm, wringing)
//   L / R            hand: at = wrist target (Hips space cm, x mirrored per side; with face: true, head bind space m),
//                    pole = where the elbow swings (Hips cm), rot = extra hand rotation, curl = finger curl 0 (flat) .. 1 (fist),
//                    thumb = thumb fold (defaults to curl); a hand with no curl gets the relaxed REST_CURL
// Emotions cross-fade over ~2.5s (EMO_RATE), so a new one arrives gradually instead of snapping.
const REST_CURL = 0.38;
const HAND_REST = { at: [13.4, 1.4, 31.4], pole: [28, 12, 0], curl: REST_CURL };
// Right hand flat on the heart (his left chest), palm in. rot was solved numerically for the palm normal: the old
// rot [0, 0, 0.5] held the hand edge-on to the chest, which read as a karate chop or a "wait" sign.
const HEART_R = { at: [-3, 25.5, 17.5], pole: [26, -6, 0], rot: [-1.8, 0.1, -0.2], curl: 0.15 };
const CLASPED = { at: [3.5, 6, 35], pole: [26, 6, 12], rot: [0, 0, 0.5], curl: 0.72, thumb: 0.5 };
const EMOTIONS = {
  idle: {},
  agree: { smile: 0.35, brow: 0.001 },
  headShake: { smile: -0.25, knit: -0.08 },
  sad_pose: { gaze: 0.3, lean: 0.04, hp: 0.18, smile: -0.2, knit: 0.12, lid: 0.25 },
  // thinking: chin in hand, head cocked, brows up
  curious: { gaze: -0.3, lean: 0.10, hp: -0.04, hr: 0.16, hy: 0.04, smile: 0.2, open: 0.15, brow: 0.004, knit: 0.06, lid: -0.1,
    R: { at: [0.03, 1.485, 0.10], face: true, pole: [16, -12, 32], rot: [-0.4, 0, 0.3], curl: 0.8, thumb: 0.35 } },
  // tense and small: hunched, hands wringing in the lap, eyes wide and worried
  anxious: { gaze: 0.15, lean: 0.12, chest: 0.12, hp: 0.08, smile: -0.35, open: 0.12, brow: 0.004, knit: 0.30, lid: -0.1, tremble: 0.010, breath: 0.9, fidget: 1.4,
    L: CLASPED, R: CLASPED },
  // wanting to disappear: sunk shoulders, chin down but face still to camera, hands hidden low
  shame: { gaze: 0.9, lean: 0.12, chest: 0.14, hp: 0.12, hy: 0.10, hr: 0.08, twist: 0.08, smile: -0.3, knit: 0.22, lid: 0.45, blush: 0.9,
    L: { at: [3, 3, 33], pole: [24, 4, 10], rot: [0, 0, 0.5], curl: 0.55 }, R: { at: [3, 3, 33], pole: [24, 4, 10], rot: [0, 0, 0.5], curl: 0.55 } },
  // heavy: folded forward, one hand pinching the bridge of the nose, slow sob
  grief: { gaze: 1.0, lean: 0.18, chest: 0.12, hp: 0.10, smile: -0.7, open: 0.1, knit: 0.34, lid: 0.7, bob: 0.018, bobHz: 0.55, breath: 0.4,
    L: { at: [3, 3, 33], pole: [24, 4, 10], rot: [0, 0, 0.5], curl: 0.5 },
    R: { at: [0.012, 1.665, 0.10], face: true, pole: [16, -16, 36], rot: [-2.4, 0.3, 0.1], curl: 0.35, thumb: 0.2 } }, // palm to the face (rot [0.3,0,0] pressed the back of the hand to the brow)
  // angry: head forward and glaring from under brows, clenched fist on knee, other hand dragged through hair
  frustration: { lean: 0.08, chest: 0.04, hp: 0.14, smile: -0.6, open: 0.22, brow: -0.003, knit: -0.38, lid: 0.15, shake: 0.14, breath: 0.7,
    L: { at: [14, 4, 30], pole: [28, 12, 0], curl: 1, thumb: 0.9 }, R: { at: [0.045, 1.725, 0.02], face: true, pole: [22, -8, 30], rot: [-1.8, -0.2, -0.5], curl: 0.55 } }, // palm on the head
  // shock: thrown back, wide eyes, open mouth, both hands flying up by the face
  surprise: { gaze: -0.2, lean: -0.22, chest: -0.12, hp: -0.18, smile: 0, open: 0.9, brow: 0.007, knit: 0.06, lid: -0.5,
    L: { at: [0.075, 1.50, 0.15], face: true, pole: [26, 0, 4], rot: [0, 0, -0.8], curl: 0.1 }, R: { at: [0.075, 1.50, 0.15], face: true, pole: [26, 0, 4], rot: [0, 0, -0.8], curl: 0.1 } },
  // left hand flat on the heart (palm in, fingers up and across): rot solved so the palm faces the chest, not edge-on
  hope: { gaze: -0.7, lean: 0.0, chest: -0.06, hp: -0.10, hr: -0.08, smile: 0.5, open: 0.1, brow: 0.003, knit: 0.12, blush: 0.3,
    L: { at: [9, 25, 17], pole: [26, -6, 0], rot: [-2.2, 0, -0.5], curl: 0.15 } },
  // grounded: sitting tall, steady gaze, fist pressed to the knee, other hand on the heart
  resolve: { gaze: 0.0, lean: 0.04, chest: -0.12, hp: -0.02, smile: 0.12, knit: -0.14, lid: 0.15, breath: -0.2,
    L: { at: [13, 4, 36], pole: [28, 12, 0], curl: 1, thumb: 0.9 }, R: HEART_R },
  // delighted: head up a touch, eyes squeezed, mouth open, hands clapped together at the chest, laugh bounce
  joy: { gaze: -0.1, lean: -0.04, chest: -0.10, hp: -0.08, smile: 1.0, open: 0.65, brow: 0.004, knit: 0.04, lid: 0.5, blush: 0.5, bob: 0.014, bobHz: 2.6,
    L: { at: [4, 27, 24], pole: [24, -4, 0], rot: [0, 0, 0.9], curl: 0.12 }, R: { at: [4, 27, 24], pole: [24, -4, 0], rot: [0, 0, 0.9], curl: 0.12 } },
  // serene: eyes closed, soft smile, chest open, palms resting
  peace: { lean: 0.02, chest: -0.10, hp: 0.06, smile: 0.7, knit: 0.03, lid: 1.0, breath: -0.45 },
};
window.EMOTIONS = EMOTIONS; // tunable live from the console
const EMO_NUM = ['lean', 'twist', 'tilt', 'chest', 'hp', 'hy', 'hr', 'smile', 'open', 'brow', 'knit', 'blush', 'lid',
  'tremble', 'shake', 'bob', 'bobHz', 'breath', 'fidget', 'gaze'];
const EMO_RATE = 1.2;
const emoW = { idle: 1 };   // cross-fade weight per emotion
const emo = {};             // blended values this frame
const emoHands = { L: { at: new THREE.Vector3(), pole: new THREE.Vector3(), rot: new THREE.Vector3(), curl: REST_CURL, thumb: REST_CURL },
                   R: { at: new THREE.Vector3(), pole: new THREE.Vector3(), rot: new THREE.Vector3(), curl: REST_CURL, thumb: REST_CURL } };
let emoBobPhase = 0, emoBreathPhase = 0, emoNextBlink = 3, emoBlink = 0;
const _emoV = new THREE.Vector3();
function blendEmotions(dt) {
  const cur = EMOTIONS[currentHumanEmote] ? currentHumanEmote : 'idle';
  if (!(cur in emoW)) emoW[cur] = 0;
  const k = 1 - Math.exp(-dt * EMO_RATE);
  // intensity < 1 mixes the emotion with the calm seat, so "grief@0.5" is half-way there
  const I = cur === 'idle' ? 1 : emoIntensity;
  if (I < 1 && !('idle' in emoW)) emoW.idle = 0;
  let sum = 0;
  for (const n in emoW) {
    const goal = n === cur ? I : (n === 'idle' ? 1 - I : 0);
    emoW[n] += (goal - emoW[n]) * k;
    if (n !== cur && n !== 'idle' && emoW[n] < 0.002) delete emoW[n]; else if (n === 'idle' && n !== cur && goal === 0 && emoW[n] < 0.002) delete emoW[n]; else sum += emoW[n];
  }
  for (const key of EMO_NUM) emo[key] = 0;
  for (const n in emoW) {
    const w = emoW[n] / sum, e = EMOTIONS[n];
    for (const key of EMO_NUM) if (e[key]) emo[key] += w * e[key];
  }
  // integrate phases with dt (never t * rate) so a changing rate can't make them jump
  emoBobPhase += dt * Math.PI * 2 * (emo.bobHz || 1);
  emoBreathPhase += dt * 1.1 * (1 + emo.breath);
  blendHandWeights(dt);
}
// Hand targets resolve after the head is posed: face-space targets follow the head into Hips space.
// The hands have their own cross-fade toward handHome, the last feeling strong enough to move them (intensity >=
// HAND_COMMIT): "grief@0.4" puts the hand fully on the brow (blending by intensity left it hovering in mid-air), while a
// weaker feeling ("curious@0.2") shows in the face and body and the hands stay where they were.
const HAND_COMMIT = 0.3;
const handW = { idle: 1 };
let handHome = 'idle';
function emoteMovesHands(spec) { const e = parseEmote(spec); return e.name === 'idle' || e.i >= HAND_COMMIT; }
// Where the hands are at the start of beat i in linear playback (for jumps): the last committing emote at or before it.
function handHomeAtBeat(i) {
  let home = 'idle';
  for (let k = 0; k <= i && k < beats.length; k++) {
    const b = beats[k];
    if (emoteMovesHands(b.emote || 'idle')) home = parseEmote(b.emote || 'idle').name;
    if (k < i) for (const c of (b.cues || [])) if (c.emote && emoteMovesHands(c.emote)) home = parseEmote(c.emote).name;
  }
  return EMOTIONS[home] ? home : 'idle';
}
function setHandHome(name, snap) {
  handHome = EMOTIONS[name] ? name : 'idle';
  if (snap) { for (const n in handW) delete handW[n]; handW[handHome] = 1; }
}
function blendHandWeights(dt) {
  const k = 1 - Math.exp(-dt * EMO_RATE);
  if (!(handHome in handW)) handW[handHome] = 0;
  for (const n in handW) {
    handW[n] += ((n === handHome ? 1 : 0) - handW[n]) * k;
    if (n !== handHome && handW[n] < 0.002) delete handW[n];
  }
}
function blendEmotionHands() {
  let sum = 0;
  for (const n in handW) sum += handW[n];
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? 1 : -1, h = emoHands[side];
    h.at.set(0, 0, 0); h.pole.set(0, 0, 0); h.rot.set(0, 0, 0); h.curl = 0; h.thumb = 0;
    for (const n in handW) {
      const w = handW[n] / sum, d = EMOTIONS[n][side] || HAND_REST;
      if (!w) continue;
      const c = d.curl ?? REST_CURL; h.curl += w * c; h.thumb += w * (d.thumb ?? c);
      _emoV.set(s * d.at[0], d.at[1], d.at[2]);
      if (d.face && georgeFace.group) {
        georgeFace.group.updateWorldMatrix(true, false);
        georgeFace.group.localToWorld(_emoV);
        humanBones['mixamorigHips'].worldToLocal(_emoV);
      }
      h.at.addScaledVector(_emoV, w);
      h.pole.x += w * s * d.pole[0]; h.pole.y += w * d.pole[1]; h.pole.z += w * d.pole[2];
      if (d.rot) { h.rot.x += w * d.rot[0]; h.rot.y += w * s * d.rot[1]; h.rot.z += w * s * d.rot[2]; }
    }
  }
}
// Hands follow their blended goal through a critically damped spring, so a new emotion starts them from zero speed
// (the plain exponential cross-fade started at full speed and yanked them) and arcs them out in front of the torso
// instead of dragging them in a straight line through it.
const HAND_SPRING = { at: 7.5, pole: 5, rot: 6, bulge: 0.35, bulgeMax: 14 }; // omega (1/s); bulge in cm per cm of travel left
const handSpring = { L: null, R: null };
function springVec(cur, vel, goal, w, dt) { // critically damped, stable at any dt
  const x = w * dt, e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  for (const k of ['x', 'y', 'z']) {
    const d = cur[k] - goal[k], tmp = (vel[k] + w * d) * dt;
    vel[k] = (vel[k] - w * tmp) * e;
    cur[k] = goal[k] + (d + tmp) * e;
  }
}
function smoothEmotionHands(dt) {
  for (const key of ['L', 'R']) {
    const g = emoHands[key];
    let sp = handSpring[key];
    if (!sp) sp = handSpring[key] = { at: g.at.clone(), atV: new THREE.Vector3(), pole: g.pole.clone(), poleV: new THREE.Vector3(), rot: g.rot.clone(), rotV: new THREE.Vector3() };
    springVec(sp.at, sp.atV, g.at, HAND_SPRING.at, dt);
    springVec(sp.pole, sp.poleV, g.pole, HAND_SPRING.pole, dt);
    springVec(sp.rot, sp.rotV, g.rot, HAND_SPRING.rot, dt);
    g.at.copy(sp.at); g.pole.copy(sp.pole); g.rot.copy(sp.rot);
    // fingers ease (no spring needed): about 0.3 s to settle, so a fist closes as the hand arrives
    const kc = 1 - Math.exp(-dt * 7);
    sp.curl = sp.curl == null ? g.curl : sp.curl + (g.curl - sp.curl) * kc; g.curl = sp.curl;
    sp.thumb = sp.thumb == null ? g.thumb : sp.thumb + (g.thumb - sp.thumb) * kc; g.thumb = sp.thumb;
    // while travelling, bow the path forward (+z, away from the chest) in proportion to the distance still to cover
    const left = sp.at.distanceTo(_emoGoalAt.copy(sp.at).addScaledVector(sp.atV, 0.35));
    g.at.z += Math.min(HAND_SPRING.bulgeMax, left * HAND_SPRING.bulge * 3);
  }
}
const _emoGoalAt = new THREE.Vector3();
// Finger pose from emoHands[side].curl / thumb onto the jointed fingers (10f georgeFingerRig). Pivots are ours (no mixer),
// so their rotation is set outright each frame. Little finger curls a touch more than the index: a natural cascade.
const FINGER_JOINT = [1.25, 1.5, 1.0], FINGER_CASCADE = [0.86, 0.96, 1.02, 1.1];
const _fq = new THREE.Quaternion(), _fq2 = new THREE.Quaternion();
function curlFingers() {
  for (const key of ['L', 'R']) {
    const rig = typeof georgeFingerRig !== 'undefined' && georgeFingerRig[key];
    if (!rig) continue;
    const c = THREE.MathUtils.clamp(emoHands[key].curl, -0.1, 1.05), th = THREE.MathUtils.clamp(emoHands[key].thumb, -0.1, 1.05);
    rig.fingers.forEach((f, i) => f.segs.forEach((o, k) => o.quaternion.setFromAxisAngle(f.axis, c * FINGER_CASCADE[i] * FINGER_JOINT[k])));
    rig.thumb.segs[0].quaternion.setFromAxisAngle(rig.thumb.sweep, th * 0.55).multiply(_fq.setFromAxisAngle(rig.thumb.axis, th * 0.35));
    rig.thumb.segs[1].quaternion.setFromAxisAngle(rig.thumb.axis, th * 0.7);
  }
}
// One-shot hand gestures layered over the current emotion: a cue's `gesture: "offer"` eases the named hand(s) to the
// target (Hips space cm, x mirrored per side like EMOTIONS L/R), holds, and eases back. `gestureSecs` sets the length.
const GESTURES = {
  pocket: { widen: 1.2, R: { at: [17, -3, 17], pole: [28, 12, 0], rot: [0, 0, 0.3], curl: 0.65 } },                       // tuck the right hand away at the hip
  offer:  { widen: 1.6, R: { at: [4, 25, 62], pole: [26, -6, 0], rot: [-3.1, 0.1, -0.1], curl: 0.08, thumb: 0.05 } },                   // reach across the fire, palm up
  open:   { widen: 1.25, L: { at: [30, 16, 36], pole: [30, -6, -4], rot: [-3.38, -0.3, 0.4], curl: 0.08 }, R: { at: [30, 16, 36], pole: [30, -6, -4], rot: [-3.58, -0.2, 0.1], curl: 0.08 } }, // both palms open, up
  touchChest: { R: HEART_R },                                                                                       // hand on the heart
  toss:   { R: { at: [6, 14, 52], pole: [28, 2, 0], rot: [0, 0, 0.3], curl: 0.3, thumb: 0.2 } },           // underhand throw out over the water (pair with a `stone` cue)
};
// Head gestures (George): layered onto the head bone in the loop, so they play over a hand gesture instead of replacing it.
// head(t) -> [pitch, yaw, roll] radians at gesture-time t (seconds, before the envelope); + pitch looks down.
// lookAway turns toward LOOK_AWAY_YAW's sign (away from the Witness, off the fire) and drops the eyes a little.
const LOOK_AWAY_YAW = 0.55;
Object.assign(GESTURES, {
  nod:      { head: (t) => [0.2 * (0.5 - 0.5 * Math.cos(t * Math.PI * 2 / 0.6)), 0, 0], secs: 1.2, a: 0.12, r: 0.35 }, // two small dips
  lookAway: { head: () => [0.14, LOOK_AWAY_YAW, 0.05], secs: 2.0, a: 0.55, r: 0.9 },
  lookUp:   { head: () => [-0.42, -0.04, 0], secs: 4.0, a: 1.4, r: 1.2 },                     // up past the fire to the sky
});
// Witness gestures: slow, small and always back to namaste. spine = total forward pitch spread over the three spine bones,
// head = extra head pitch, open = 0..1 blend of the namaste IK target into open palms (csNamastePose's third argument).
// Same rule as everything else here: addBoneOffset rides on bones the mixer rewrites each frame, so nothing accumulates.
const WITNESS_GESTURES = {
  'lean-in':    { spine: 0.2, head: 0.08, secs: 2.4, a: 0.9, r: 1.2 },
  'open-hands': { open: 1, spine: 0.05, secs: 2.4, a: 0.8, r: 1.0 },
  'bow':        { spine: 0.5, head: 0.3, secs: 2.0, a: 1.1, r: 1.3 },
  tilt:         { tilt: 0.2, secs: 2.2, a: 0.8, r: 1.0 },      // head roll + a little lean to the same side: listening, tender
  radiate:      { radiate: 1, secs: 1.8, a: 0.7, r: 1.1 },     // glow pulse: halo swells, heart brightens, god rays rise (visible from any shot)
};
const GESTURE_NAMES = [...Object.keys(GESTURES), ...Object.keys(WITNESS_GESTURES)];
const activeGestures = [], activeHeadGestures = [], activeWitnessGestures = [];
// opts.widen === false: the shot already contains the gesture (e.g. the across-the-fire cut), so do not pull the camera back.
function playGesture(name, secs, opts) {
  const wdef = WITNESS_GESTURES[name], def = wdef || GESTURES[name];
  if (!def) { console.warn('[gesture] unknown:', name); return; }
  const entry = { def, t0: performance.now(), dur: Math.max(0.8, secs || def.secs || 1.8), a: def.a, r: def.r };
  if (wdef) { activeWitnessGestures.length = 0; activeWitnessGestures.push(entry); return; } // one at a time per body part
  if (def.head) { activeHeadGestures.length = 0; activeHeadGestures.push(entry); return; }
  activeGestures.length = 0; // one at a time
  activeGestures.push({ def, t0: performance.now(), dur: Math.max(0.8, secs || 1.8), widen: !(opts && opts.widen === false) });
  // widening needs a running camera move to carry it (a still shot has none)
  if (!camMove && activeGestures[0].widen && def.widen) retargetCamMove('none', 8);
}
// Camera frame scale for the active gesture: eases out with the gesture's envelope so the moving hand stays in shot (4b-2).
function gestureWidenNow() {
  let w = 1;
  for (const g of activeGestures) if (g.widen && g.def.widen) w = Math.max(w, 1 + (g.def.widen - 1) * gestureEnv(g));
  return w;
}
function gestureEnv(g) {
  const t = (performance.now() - g.t0) / 1000, a = g.a || 0.45, r = g.r || 0.65;
  if (t < 0 || t > g.dur + r) return 0;
  const ss = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
  return t < a ? ss(t / a) : (t <= g.dur ? 1 : 1 - ss((t - g.dur) / r));
}
// Summed head offset [pitch, yaw, roll] from active George head gestures (nod, lookAway).
const _gHead = [0, 0, 0];
function headGestureNow() {
  _gHead[0] = _gHead[1] = _gHead[2] = 0;
  for (let i = activeHeadGestures.length - 1; i >= 0; i--) {
    const g = activeHeadGestures[i], t = (performance.now() - g.t0) / 1000;
    if (t > g.dur + (g.r || 0.65) + 0.1) { activeHeadGestures.splice(i, 1); continue; }
    const w = gestureEnv(g), h = g.def.head(Math.min(t, g.dur));
    _gHead[0] += w * h[0]; _gHead[1] += w * h[1]; _gHead[2] += w * h[2];
  }
  return _gHead;
}
// Witness gesture envelope-weighted values: { spine, head, open }.
const _wg = { spine: 0, head: 0, open: 0, tilt: 0, radiate: 0 };
function witnessGestureNow() {
  _wg.spine = _wg.head = _wg.open = _wg.tilt = _wg.radiate = 0;
  for (let i = activeWitnessGestures.length - 1; i >= 0; i--) {
    const g = activeWitnessGestures[i], t = (performance.now() - g.t0) / 1000;
    if (t > g.dur + (g.r || 0.65) + 0.1) { activeWitnessGestures.splice(i, 1); continue; }
    const w = gestureEnv(g);
    _wg.spine += w * (g.def.spine || 0); _wg.head += w * (g.def.head || 0); _wg.open += w * (g.def.open || 0); _wg.tilt += w * (g.def.tilt || 0); _wg.radiate += w * (g.def.radiate || 0);
  }
  return _wg;
}
function applyGestures() {
  for (let i = activeGestures.length - 1; i >= 0; i--) {
    const g = activeGestures[i], w = gestureEnv(g);
    if ((performance.now() - g.t0) / 1000 > g.dur + 0.7) { activeGestures.splice(i, 1); continue; }
    for (const key of ['L', 'R']) {
      const d = g.def[key];
      if (!d) continue;
      const s = key === 'L' ? 1 : -1, h = emoHands[key];
      _emoV.set(s * d.at[0], d.at[1], d.at[2]); h.at.lerp(_emoV, w);
      _emoV.set(s * d.pole[0], d.pole[1], d.pole[2]); h.pole.lerp(_emoV, w);
      if (d.rot) { _emoV.set(d.rot[0], s * d.rot[1], s * d.rot[2]); h.rot.lerp(_emoV, w); }
      if (d.curl != null) { h.curl += (d.curl - h.curl) * w; h.thumb += ((d.thumb ?? d.curl) - h.thumb) * w; }
    }
  }
}
// --- 14C. BEAT CUES ---
// A beat can change feeling, mood, coherence and camera mid-line. beat.emote / beat.mood / beat.coherence still fire at line
// start; beat.cues = [{ at: "phrase from the line", emote: "shame@0.8", mood, moodSecs, coherence, cam, move, focus }] fire
// CUE_LEAD seconds before the phrase is spoken (time = phrase position in the text x line length, from the voice clip when
// there is one). `t: 0..1` may be used instead of `at`. Spec: SYNC_SPEC.md sections 3-4.
const CUE_LEAD = 0.3, CUE_MIN_HOLD = 1.2;
var emoIntensity = 1;
let beatCueList = [], beatCueNext = 0, beatCueClock = 0;
// Cue cameras are queued, not solved inline: cues run mid-frame before the seated pose is applied, and resolveShotForBeat
// measures George's live face height (faceWorldPos), which would be his unseated height then. animate() solves it next frame.
let pendingCueShot = null;
let delayedCuts = []; // [{ t, fn }]: camera cuts a cue asked for after a delay (`reactDelay`)
let camReturn = null; // { t, idx }: after a reaction / offer cut, go back to the beat's own shot when t runs out
function parseEmote(spec) {
  const m = /^\s*([A-Za-z_]+)(?:@([\d.]+))?\s*$/.exec(spec || '');
  return m ? { name: m[1], i: m[2] != null ? THREE.MathUtils.clamp(parseFloat(m[2]), 0, 1) : 1 } : { name: 'idle', i: 1 };
}
let curEmoteName = 'idle';
function setEmote(spec) { // "name" or "name@0.6"
  const e = parseEmote(spec);
  if (e.name !== curEmoteName) camMoveHoldUntil = performance.now() + 600; // spec 4b rule 5: camera holds still while the pose cross-fades
  curEmoteName = e.name;
  if (emoteMovesHands(spec)) setHandHome(e.name);
  playHumanClip(e.name);
  emoIntensity = e.i;
  handheldBoostGoal = 1 + ((EMOTION_HANDHELD[e.name] || 1) - 1) * e.i;
}
// Resolve a beat's cues to time fractions; cues whose phrase isn't in the line are dropped (and reported by cueWarnings).
function resolveCues(b) {
  const text = b.text || '', low = text.toLowerCase(), list = [];
  for (const c of (b.cues || [])) {
    let f = typeof c.t === 'number' ? c.t : 0;
    if (c.at) {
      const k = low.indexOf(String(c.at).toLowerCase());
      if (k < 0) continue;
      f = k / Math.max(1, text.length);
    }
    list.push({ f, c });
  }
  return list.sort((a, b2) => a.f - b2.f);
}
// Authoring validator (SYNC_SPEC step 5): [{ ci, msg }] for a phrase missing from the text, or two cues < CUE_MIN_HOLD s apart.
function cueWarnings(b) {
  const out = [], cues = b.cues || [], low = (b.text || '').toLowerCase();
  cues.forEach((c, ci) => {
    if (c.at && low.indexOf(String(c.at).toLowerCase()) < 0) out.push({ ci, msg: `phrase not found in line: "${c.at}"` });
  });
  const list = resolveCues(b), est = beatDuration(b);
  for (let i = 1; i < list.length; i++) {
    const gap = (list[i].f - list[i - 1].f) * est;
    if (gap < CUE_MIN_HOLD) out.push({ ci: cues.indexOf(list[i].c), msg: `cue ${cues.indexOf(list[i].c) + 1} is ${gap.toFixed(1)}s after cue ${cues.indexOf(list[i - 1].c) + 1} (under ${CUE_MIN_HOLD}s)` });
  }
  return out;
}
// `fire` cue: swell the flames and fire light by `amp` (0.8 = +80% light; negative dips them, -0.5 = half), attack 0.5 s,
// hold `fireSecs`, release 1.2 s. `fireLean` (0..1) bends the flames toward George on the same envelope.
let fireSwell = null;
let fireLeanNow = 0;
function fireSwellNow() {
  fireLeanNow = 0;
  if (!fireSwell) return 0;
  const t = (performance.now() - fireSwell.t0) / 1000, a = 0.5, r = 1.2;
  if (t > a + fireSwell.dur + r) { fireSwell = null; return 0; }
  const e = t < a ? t / a : t < a + fireSwell.dur ? 1 : 1 - (t - a - fireSwell.dur) / r;
  fireLeanNow = fireSwell.lean * e * e * (3 - 2 * e);
  return fireSwell.amp * e * e * (3 - 2 * e);
}
// `avoid` cue (seconds): the Avoider, cheap form (CHARACTERS.md). The thought swarm bursts up and outward, the eagles lift,
// the fire dips (R1: he is dodging), George looks away and the camera drifts off his face, then all of it settles back.
// Envelope: attack 0.4 s, hold `avoid` s, release 1.2 s. Nothing here accumulates: every offset is e * constant per frame.
let avoidFx = null;
let avoidE = 0; // 0..1, read by the swarm, the birds and the camera this frame
function startAvoid(secs, c) {
  const dur = Math.max(0.4, +secs || 2.5);
  avoidFx = { t0: performance.now(), dur };
  if (!c || !c.gesture) playGesture('lookAway', dur + 0.8);
  if (!c || (typeof c.fire !== 'number' && !(c.fireLean > 0))) fireSwell = { t0: performance.now(), dur, amp: -0.35, lean: 0 };
}
function avoidNow() {
  if (!avoidFx) return 0;
  const t = (performance.now() - avoidFx.t0) / 1000, a = 0.4, r = 1.2;
  if (t > a + avoidFx.dur + r) { avoidFx = null; return 0; }
  const e = t < 0 ? 0 : t < a ? t / a : t < a + avoidFx.dur ? 1 : 1 - (t - a - avoidFx.dur) / r;
  return e * e * (3 - 2 * e);
}
// `numb` cue (seconds): the Numb-er, cheap form (CHARACTERS.md). Fog thickens and rolls in low from the trees, the fire dims
// and the colour drains a little, then all of it returns by itself. Slower than `avoid`: attack 1.6 s, hold `numb` s,
// release 2.6 s. Nothing here accumulates: every value is its base (mood / STUDIO setting) times (1 + numbE * constant).
const NUMB_FX = { fog: 1.9, fire: -0.45, sat: -0.4 }; // at full hold: fog density x2.9, fire light down to about a third, 40% less colour
let numbFx = null;
let numbE = 0; // 0..1, read by the fog, the fire and the Numb-er's figure this frame
let numbApplied = false;
function startNumb(secs) {
  numbFx = { t0: performance.now(), dur: Math.max(0.5, +secs || 4) };
}
function numbNow() {
  if (!numbFx) return 0;
  const t = (performance.now() - numbFx.t0) / 1000, a = 1.6, r = 2.6;
  if (t > a + numbFx.dur + r) { numbFx = null; return 0; }
  const e = t < 0 ? 0 : t < a ? t / a : t < a + numbFx.dur ? 1 : 1 - (t - a - numbFx.dur) / r;
  return e * e * (3 - 2 * e);
}
// Fog and colour: written from their bases while the envelope runs, and once more (exactly the bases) on the frame it ends.
function applyNumbWorld() {
  if (numbE <= 0 && !numbApplied) return;
  scene.fog.density = MOODS[moodIdx].fogD * (1 + NUMB_FX.fog * numbE);
  const baseSat = typeof STUDIO !== 'undefined' && STUDIO.grade ? STUDIO.grade.sat : 1.04;
  compositeMat.uniforms.uSat.value = baseSat * (1 + NUMB_FX.sat * numbE);
  numbApplied = numbE > 0;
}
// `judge` cue (seconds): the Judge (CHARACTERS.md). The fire flares a little and, on the tree line behind George where it would
// throw his shadow, a tall charcoal figure of him rises and stands over him while he sits; then it sinks back. Attack 1.2 s,
// hold `judge` s, release 2.0 s. Nothing here accumulates: the fire is its own level plus judgeE * constant, and the figure
// (tickJudge, 18_parts.js) is placed from the envelope every frame.
const JUDGE_FX = { fire: 0.3 }; // at full hold the fire is 30% brighter: the light that throws the shadow
let judgeFx = null;
let judgeE = 0; // 0..1, read by the fire and the Judge's figure this frame
function startJudge(secs) {
  judgeFx = { t0: performance.now(), dur: Math.max(0.5, +secs || 4) };
}
function judgeNow() {
  if (!judgeFx) return 0;
  const t = (performance.now() - judgeFx.t0) / 1000, a = 1.2, r = 2.0;
  if (t > a + judgeFx.dur + r) { judgeFx = null; return 0; }
  const e = t < 0 ? 0 : t < a ? t / a : t < a + judgeFx.dur ? 1 : 1 - (t - a - judgeFx.dur) / r;
  return e * e * (3 - 2 * e);
}
function startBeatCues(b) {
  if (!document.body.classList.contains('camp')) cueWarnings(b).forEach((w) => console.warn('[cues]', w.msg)); // episode-authoring hint; players of the camp never see episodes
  const list = resolveCues(b);
  beatCueList = list; beatCueNext = 0; beatCueClock = 0; camReturn = null; delayedCuts = [];
}
function runCue(c) {
  if (c.emote) {
    setEmote(c.emote);
    // a new feeling on George's close-up re-aims the camera, but only for a real change (a cut every cue would flicker)
    const es = cameraMode === 'auto' && beats[curBeatIdx].cam === 'human' && EMOTION_SHOT[parseEmote(c.emote).name];
    if (es && !c.cam && (!curEmotionShot || Math.abs(es.az - curEmotionShot.az) >= 15 || Math.abs(es.el - curEmotionShot.el) >= 8)) {
      pendingCueShot = Object.assign({}, beats[curBeatIdx], { emote: c.emote }, c.cam ? { cam: c.cam } : {});
    } else if (es && !c.cam && !beats[curBeatIdx].move) {
      // same angle, but the new feeling may want a different move (push vs crane vs hold): swap it from the current pose
      const em = emotionMove(c.emote);
      if (em && (!camMove || camMove.type !== em.move)) retargetCamMove(em.move, em.secs || Math.max(1.5, beatDuration() - beatCueClock));
    }
  }
  const b0 = beats[curBeatIdx], b0Idx = curBeatIdx;
  // Reaction shot: the Witness lands a phrase, cut to George's face on the cue (4b rule 4), back after reactSecs
  if (c.react && !/^(0|false)$/i.test(String(c.react)) && cameraMode === 'auto' && !c.cam) {
    const doReact = () => {
      if (curBeatIdx !== b0Idx) return;
      pendingCueShot = Object.assign({}, b0, { cam: 'human', react: true, emote: c.emote || b0.emote });
      camReturn = { t: c.reactSecs || 2.4, idx: curBeatIdx };
    };
    // reactDelay: let the gesture play on the current shot first (e.g. the Witness's open-hands), then cut
    if (c.reactDelay > 0) delayedCuts.push({ t: c.reactDelay, fn: doReact }); else doReact();
  }
  let widen = true;
  // Offer / reach across the fire: cut to the wide across-the-fire shot so the whole reach is in frame (4b-2 movement rule 4)
  if (c.gesture === 'offer' && cameraMode === 'auto' && !c.cam && !pendingCueShot) {
    pendingCueShot = Object.assign({}, b0, { cam: 'wide', speaker: 'HUMAN' });
    camReturn = { t: (c.gestureSecs || 1.8) + 0.7, idx: curBeatIdx };
    widen = false;
  }
  // Fire swell on a face close-up: the fire is off-camera, so cut to the wide across-the-fire shot while it flares
  if (c.fire && cameraMode === 'auto' && !c.cam && !pendingCueShot && /^human/.test(b0.cam || '')) {
    pendingCueShot = Object.assign({}, b0, { cam: 'wide', speaker: 'HUMAN' });
    camReturn = { t: (c.fireSecs || 1.5) + 1.7, idx: curBeatIdx };
  }
  if (c.gesture) playGesture(c.gesture, c.gestureSecs, { widen });
  if ((typeof c.fire === 'number' && c.fire !== 0) || c.fireLean > 0) fireSwell = { t0: performance.now(), dur: c.fireSecs || 1.5, amp: Math.max(-0.8, c.fire || 0), lean: c.fireLean || 0 };
  runStoryCue(c);
  if (typeof c.mood === 'number') {
    transitionToMood(c.mood, c.moodSecs);
    // camera beat through the whiteout (a queued cut resolves it itself; otherwise swap the running move now)
    if (pendingMoodCam && !c.move && !pendingCueShot && !b0.move) { retargetCamMove(pendingMoodCam.type, pendingMoodCam.secs); pendingMoodCam = null; }
    else if (pendingMoodCam && !pendingCueShot && !c.cam && !c.focus) pendingMoodCam = null; // an authored move wins; don't let the beat leak into the next shot
  }
  if (typeof c.coherence === 'number') {
    onCoherenceSlider(c.coherence);
    const sl = document.getElementById('coherence-slider'); if (sl) sl.value = c.coherence;
  }
  if (c.cam || c.move || c.focus) {
    const b = beats[curBeatIdx];
    pendingCueShot = Object.assign({}, b, pendingCueShot || {}, c.cam ? { cam: c.cam } : {}, c.minCut > 0 ? { _minCut: c.minCut } : {}, c.move ? { move: c.move } : {}, c.focus ? { focus: c.focus } : {});
  }
}
// Spoken start (s) of a cue's `at` phrase from the clip's word timestamps (manifest `words`), or null when they don't line up.
function cueWordTime(item, text, words) {
  if (item.tw !== undefined) return item.tw;
  item.tw = null;
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9']/g, '');
  const want = String(item.c.at || '').split(/\s+/).map(norm).filter(Boolean);
  if (!want.length || !words) return null;
  const heard = words.map((w) => norm(w.w));
  for (let i = 0; i + want.length <= heard.length; i++) {
    if (want.every((x, j) => heard[i + j] === x)) { item.tw = words[i].t0; break; }
  }
  if (item.tw == null) { // transcript spelled it differently: fall back to the word index when both have the same word count
    const all = text.split(/\s+/).filter(Boolean);
    const k = text.toLowerCase().indexOf(String(item.c.at).toLowerCase());
    if (all.length === words.length && k >= 0) item.tw = words[text.slice(0, k).split(/\s+/).filter(Boolean).length].t0;
  }
  return item.tw;
}
function tickBeatCues(dt) {
  for (let i = delayedCuts.length - 1; i >= 0; i--) { delayedCuts[i].t -= dt; if (delayedCuts[i].t <= 0) delayedCuts.splice(i, 1)[0].fn(); }
  if (camReturn) {
    camReturn.t -= dt;
    if (camReturn.t <= 0) { if (camReturn.idx === curBeatIdx && !pendingCueShot) pendingCueShot = Object.assign({}, beats[camReturn.idx]); camReturn = null; }
  }
  if (beatCueNext >= beatCueList.length) return;
  beatCueClock += dt;
  let now, dur;
  const cb = beats[curBeatIdx] || {}, vd = cb.text ? cb.voiceDelay || 0 : 0; // voiceDelay: cues wait for the line too
  if (lineVoice) { now = (performance.now() - lineVoice.start) / 1000; dur = Math.max(lineVoice.dur, cb.hold ? cb.hold - vd : 0); }
  else if (speechActive && soundEnabled && beatCueClock < 4 + vd) return; // voice clip still generating: hold the cues (4 s cap)
  else { now = beatCueClock - vd; dur = Math.max(0.5, beatDuration() - vd); }
  while (beatCueNext < beatCueList.length) {
    const it = beatCueList[beatCueNext];
    const tw = lineVoice && lineVoice.words && it.c.at ? cueWordTime(it, (beats[curBeatIdx] || {}).text || '', lineVoice.words) : null;
    if (now < (tw != null ? tw : it.f * dur) - CUE_LEAD) break;
    runCue(it.c); beatCueNext++;
  }
}

// --- 14D. STORY SCENE ---
// Per-episode staging from epN.json `scene`: { witnessAt: 4, reveal: "fade" | "rise", spark: { fistUntil: 10, base: 0.35 } }.
// witnessAt = the 1-based beat the Witness first appears on; before it the Witness, its god ray and the resonance stream are
// hidden (the dais ring stays: an empty glowing place across the fire). "fade" = a light burst it steps out of; "rise" = it
// comes up out of the pond at POND_SPOT inside ripple rings, then glides ashore to its place. spark = a glow in George's
// right fist, held at his chest until fistUntil.
// Cue keys handled here: spark (target glow, 1 = bright, 2 = bloom), tremble (secs of fist shake), stone (George throws a
// stone into the pond at POND_SPOT; ripples where it lands), ripple ("pond" | "witness").
const REVEAL_SECS = { fade: 0.8, rise: 1.8 };
const BLINK_OUT_SECS = 0.6; // a fade episode's cold open: how long the Witness takes to leave in its second burst
// Open water near the pond's front shore, just behind the Witness's place: in view of the `across` and `spirit` shots.
// (Lake, 05b: near-shore centre 0.12, -4.65, front shore z ~ -1.3, water at LAKE_Y.)
const POND_SPOT = new THREE.Vector3(0.6, LAKE_Y + 0.01, -1.75);
const WITNESS_HOME = spiritFloatGroup.position.clone();
let storyScene = {};
const witnessShow = { on: true, t0: 0, mode: null };   // mode set while a reveal is playing
const revealFlash = new THREE.Sprite(new THREE.SpriteMaterial({ map: cyanGlowTex, color: 0xdff6ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
revealFlash.visible = false;
sanctuaryGroup.add(revealFlash);
const sparkGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: goldGlowTex, color: 0xffe9a8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
const sparkLight = new THREE.PointLight(0xffc870, 0, 1.6, 2);
sparkGlow.visible = false;
sanctuaryGroup.add(sparkGlow, sparkLight);
const spark = { level: 0, goal: 0, trembleUntil: 0 };
const ripples = []; // { mesh, t0, max }
const rippleGeo = new THREE.RingGeometry(0.94, 1, 64);
const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.035, 0), new THREE.MeshStandardMaterial({ color: 0x3a3632, roughness: 0.9 }));
stone.visible = false;
sanctuaryGroup.add(stone);
let stoneFall = null; // { p0, t0, dur }
const _sv = new THREE.Vector3(), _sv2 = new THREE.Vector3();

let revealOnCut = false; // a `reveal` cue that also cuts: the entrance waits for the cut, so the burst is never off camera
let glimpseUntil = 0, glimpseCut = 0; // glimpse ends at glimpseUntil (performance.now(), 0 = none) or on the first camera cut more than 0.3 s after it began (glimpseCut), whichever comes first, so the Witness never vanishes inside a shot
function witnessAtIdx() { return storyScene.witnessAt > 1 ? storyScene.witnessAt - 1 : 0; }
function sparkBeforeBeat(i) { // last spark level any earlier beat's cue set (like moodBeforeBeat)
  let s = storyScene.spark ? storyScene.spark.base ?? 0.35 : 0;
  for (let k = 0; k < i; k++) for (const c of (beats[k].cues || [])) if (typeof c.spark === 'number') s = c.spark;
  return s;
}
function loadStoryScene(ep) {
  storyScene = (ep && ep.scene) || {};
  ripples.forEach((r) => sanctuaryGroup.remove(r.mesh)); ripples.length = 0;
  stoneFall = null; stone.visible = false;
}
// applyBeat calls this: stepping onto witnessAt plays the reveal; jumping anywhere sets the Witness shown/hidden outright.
function onStoryBeat(idx, prevIdx) {
  const at = witnessAtIdx();
  glimpseUntil = 0; revealOnCut = false;
  if (idx === at && prevIdx === idx - 1 && at > 0 && !witnessShow.on) { // already on = a `reveal` cue brought it in early
    witnessShow.on = true; witnessShow.mode = storyScene.reveal === 'rise' ? 'rise' : 'fade'; witnessShow.t0 = performance.now();
    playGesture('radiate', 1.2);
    if (witnessShow.mode === 'rise') { spawnRipple(POND_SPOT.x, POND_SPOT.z, 1.0); setTimeout(() => spawnRipple(POND_SPOT.x, POND_SPOT.z, 0.8), 450); }
  } else if (idx !== prevIdx || !witnessShow.mode) {
    // also on a re-applied beat (fresh page load, or a take starting from beat 1 while already on it): without this the
    // Witness stood in the opening shot of an episode it only enters later
    witnessShow.on = idx >= at; witnessShow.mode = null;
  }
  if (idx !== prevIdx + 1) { spark.level = spark.goal = sparkBeforeBeat(idx); }
  if (idx === 0 && at > 0 && storyScene.coldOpen && storyScene.coldOpen.secs > 0) startGlimpse(storyScene.coldOpen.secs, storyScene.coldOpen.from);
}
// Cold open: plays the Witness's reveal now, before witnessAt, and hides it again after `secs` (a flash-forward under the
// hook; the real entrance still plays on its beat). `from` (s) starts it part-way in, so the figure is already breaking the
// water on frame 1. Set per episode as `scene.coldOpen: { secs, from }` (starts with beat 1, not tied to the voice clip
// loading), or fired by a cue: `glimpse: secs`, `glimpseFrom`. `secs` is the whole peek (up and back under); a camera cut ends it early.
function startGlimpse(secs, from) {
  if (curBeatIdx >= witnessAtIdx()) return;
  // rise episodes: a peek. The Witness comes up to the chest and sinks back under on its own, so it never pops out of
  // sight (a full reveal that then vanished read as a glitch). fade episodes: a blink. It steps out of the light burst,
  // stands, and leaves in a second burst before `secs` is up, for the same reason.
  witnessShow.on = true; witnessShow.mode = storyScene.reveal === 'rise' ? 'peek' : 'blink'; witnessShow.dur = secs;
  witnessShow.t0 = performance.now() - (from || 0) * 1000;
  glimpseUntil = performance.now() + (secs - (from || 0)) * 1000 + 50; glimpseCut = performance.now();
  if (witnessShow.mode === 'peek') { spawnRipple(POND_SPOT.x, POND_SPOT.z, 1.0); setTimeout(() => spawnRipple(POND_SPOT.x, POND_SPOT.z, 0.8), 450); }
}
// Cue `reveal: true`: the Witness's entrance plays now, on this cue, a beat or more before witnessAt (ep2: on the cut to
// the empty place in the silent beat, so it is not off screen for 16 s). It then stays; witnessAt's beat skips its reveal.
function revealNow() {
  if (witnessShow.on && !glimpseUntil) return;
  glimpseUntil = 0;
  witnessShow.on = true; witnessShow.mode = storyScene.reveal === 'rise' ? 'rise' : 'fade'; witnessShow.t0 = performance.now();
  playGesture('radiate', 1.2);
  if (witnessShow.mode === 'rise') { spawnRipple(POND_SPOT.x, POND_SPOT.z, 1.0); setTimeout(() => spawnRipple(POND_SPOT.x, POND_SPOT.z, 0.8), 450); }
}
function runStoryCue(c) {
  if (c.reveal) { if (c.cam) revealOnCut = true; else revealNow(); }
  if (c.glimpse > 0) startGlimpse(c.glimpse, c.glimpseFrom);
  if (typeof c.spark === 'number') spark.goal = c.spark;
  if (c.tremble > 0) spark.trembleUntil = performance.now() + c.tremble * 1000;
  if (c.stone) {
    const hand = humanBones && humanBones['mixamorigRightHand'];
    if (hand) { hand.getWorldPosition(_sv); sanctuaryGroup.worldToLocal(_sv); } else _sv.set(-0.9, 0.7, 0.6);
    stoneFall = { p0: _sv.clone(), t0: performance.now(), dur: 1.0 };
    stone.position.copy(_sv); stone.visible = true;
  }
  if (c.avoid > 0) startAvoid(c.avoid, c);
  if (c.numb > 0) startNumb(c.numb);
  if (c.judge > 0) startJudge(c.judge);
  if (c.ripple) { const p = c.ripple === 'witness' ? WITNESS_HOME : POND_SPOT; spawnRipple(p.x, p.z, 1.4); }
}
function spawnRipple(x, z, max) { // three rings, a beat apart, spreading and fading on the water
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(rippleGeo, new THREE.MeshBasicMaterial({ color: 0xcfeeff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, LAKE_Y + 0.016, z); m.scale.setScalar(0.01);
    m.renderOrder = -1; // under the other see-through things (flames, glows) when they overlap on screen
    sanctuaryGroup.add(m);
    ripples.push({ mesh: m, t0: performance.now() + i * 420, max: max * (1 - i * 0.18) });
  }
}
// Runs in animate() after the Witness's float/pose and George's hands are set for this frame.
function tickStoryScene(dt, t) {
  const now = performance.now();
  // Witness visibility and reveal
  let rise = 0, scl = 1, flash = 0, glide = 0;
  if (witnessShow.mode) {
    const timed = witnessShow.mode === 'peek' || witnessShow.mode === 'blink', dur = timed ? witnessShow.dur : REVEAL_SECS[witnessShow.mode], u = Math.min(1, (now - witnessShow.t0) / 1000 / dur);
    const ss = (x) => x * x * (3 - 2 * x);
    if (witnessShow.mode === 'fade') {
      flash = Math.sin(Math.min(1, u * 1.6) * Math.PI);          // burst peaks ~30% in, gone by ~60%
      scl = u < 0.2 ? 0.001 : 0.9 + 0.1 * ss(Math.min(1, (u - 0.2) / 0.8));
    } else if (witnessShow.mode === 'blink') {
      const el = u * dur, ui = Math.min(1, el / REVEAL_SECS.fade), uo = Math.max(0, (el - (dur - BLINK_OUT_SECS)) / BLINK_OUT_SECS);
      flash = Math.max(Math.sin(Math.min(1, ui * 1.6) * Math.PI), Math.sin(uo * Math.PI));   // in on a burst, out on a burst
      scl = ui < 0.2 || uo > 0.5 ? 0.001 : 0.9 + 0.1 * ss(Math.min(1, (ui - 0.2) / 0.8));      // gone at the second burst's peak
    } else if (witnessShow.mode === 'peek') {
      rise = -1.9 + 1.25 * Math.sin(u * Math.PI);                  // head and chest up out of the water, then back under
      glide = 1;                                                   // stays at POND_SPOT
      flash = 0.3 * Math.sin(u * Math.PI);
    } else {
      rise = -1.9 * (1 - ss(Math.min(1, u / 0.5)));                // up out of the water at POND_SPOT...
      glide = 1 - ss(Math.max(0, (u - 0.45) / 0.55));               // ...then ashore to its place
      flash = 0.5 * Math.sin(Math.min(1, u * 2.2) * Math.PI);
    }
    if (u >= 1) { if (timed) { witnessShow.on = curBeatIdx >= witnessAtIdx(); glimpseUntil = 0; rise = 0; glide = 0; flash = 0; scl = 1; if (witnessShow.mode === 'peek') spawnRipple(POND_SPOT.x, POND_SPOT.z, 0.7); } witnessShow.mode = null; }
  }
  if (glimpseUntil && (now >= glimpseUntil || lastCamCutAt > glimpseCut + 300)) { glimpseUntil = 0; witnessShow.on = curBeatIdx >= witnessAtIdx(); witnessShow.mode = null; rise = 0; scl = 1; flash = 0; glide = 0; }
  spiritFloatGroup.visible = witnessShow.on;
  spiritFloatGroup.position.y += rise;
  spiritFloatGroup.position.x = THREE.MathUtils.lerp(WITNESS_HOME.x, POND_SPOT.x, glide);
  spiritFloatGroup.position.z = THREE.MathUtils.lerp(WITNESS_HOME.z, POND_SPOT.z, glide);
  spiritFloatGroup.scale.setScalar(scl);
  godRayCone.visible = witnessShow.on && scl > 0.01;
  if (!witnessShow.on) bridgeGroup.visible = false;
  revealFlash.visible = flash > 0.01;
  if (revealFlash.visible) {
    revealFlash.position.set(spiritFloatGroup.position.x, 1.25 + rise * 0.3, spiritFloatGroup.position.z);
    revealFlash.scale.setScalar(0.6 + 2.6 * flash);
    revealFlash.material.opacity = flash;
  }
  // Ripples
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i], u = (now - r.t0) / 2600;
    if (u < 0) continue;
    if (u >= 1) { sanctuaryGroup.remove(r.mesh); r.mesh.material.dispose(); ripples.splice(i, 1); continue; }
    r.mesh.scale.setScalar(0.05 + r.max * Math.sqrt(u));
    r.mesh.material.opacity = 0.55 * (1 - u) * Math.min(1, u * 8);
  }
  // Stone: an underhand arc from the hand into the pond, ripples where it lands
  if (stoneFall) {
    const u = Math.min(1, (now - stoneFall.t0) / 1000 / stoneFall.dur);
    stone.position.lerpVectors(stoneFall.p0, POND_SPOT, u);
    stone.position.y = THREE.MathUtils.lerp(stoneFall.p0.y, POND_SPOT.y, u * u) + Math.sin(u * Math.PI) * 0.9;
    stone.rotation.x += dt * 6;
    if (u >= 1) { stone.visible = false; stoneFall = null; spawnRipple(POND_SPOT.x, POND_SPOT.z, 0.9); }
  }
  // Spark in the fist
  const sp = storyScene.spark;
  const hand = humanBones && humanBones['mixamorigRightHand'];
  sparkGlow.visible = !!(sp && hand);
  sparkLight.intensity = 0;
  if (sparkGlow.visible) {
    spark.level += (spark.goal - spark.level) * (1 - Math.exp(-dt * 2.2));
    // palm centre (between the wrist and the middle knuckle), so an open palm-up offer holds it in the hand, not at the wrist
    hand.getWorldPosition(_sv);
    const knuckle = typeof georgeFingerRig !== 'undefined' && georgeFingerRig.R && georgeFingerRig.R.fingers[1].segs[0];
    if (knuckle) _sv.lerp(knuckle.getWorldPosition(_sv2), 0.55);
    sanctuaryGroup.worldToLocal(_sv);
    const flick = 1 + Math.sin(t * 7.1) * 0.06 + Math.sin(t * 11.3) * 0.04;
    sparkLight.position.copy(_sv);
    // the wrist bone sits inside the hand mesh: pull the glow a few cm toward the lens so it leaks out between the fingers
    _sv2.copy(camera.position); sanctuaryGroup.worldToLocal(_sv2);
    sparkGlow.position.copy(_sv).addScaledVector(_sv2.sub(_sv).normalize(), 0.07);
    sparkGlow.scale.setScalar((0.07 + 0.16 * spark.level) * flick);
    sparkGlow.material.opacity = Math.min(1, 0.45 + 0.35 * spark.level);
    sparkLight.intensity = 0.25 + 1.1 * spark.level * flick;
  }
}
// Flames bend toward George: each sheet tilts about the horizontal axis across the fire-to-George line, base kept in place.
const fireLeanDir = new THREE.Vector3(FOCUS_POINTS.george.x - hearthGroup.position.x, 0, FOCUS_POINTS.george.z - hearthGroup.position.z).normalize();
const _leanAxis = new THREE.Vector3(fireLeanDir.z, 0, -fireLeanDir.x), _leanQ = new THREE.Quaternion(), _yQ = new THREE.Quaternion(), _yAxis = new THREE.Vector3(0, 1, 0);
function leanFlames(k) {
  const ang = 0.5 * k;
  _leanQ.setFromAxisAngle(_leanAxis, ang);
  flameMeshes.forEach((f, i) => {
    if (f.y0 === undefined) { f.y0 = f.mesh.position.y; f.rot = f.mesh.rotation.y; }
    const half = f.y0 - 0.12;
    _yQ.setFromAxisAngle(_yAxis, f.rot);
    f.mesh.quaternion.copy(_leanQ).multiply(_yQ);
    f.mesh.position.set(fireLeanDir.x * Math.sin(ang) * half, 0.12 + Math.cos(ang) * half, fireLeanDir.z * Math.sin(ang) * half);
  });
}
// Right hand held as a fist against the chest (spark episodes, before fistUntil): runs after applyGestures so a one-shot
// right-hand gesture (the closing offer) wins while it plays.
const FIST_AT = new THREE.Vector3(-3, 27, 17), FIST_POLE = new THREE.Vector3(-26, -6, 0), FIST_ROT = new THREE.Vector3(0, 0, -0.5);
function applyStoryHands(t) {
  const sp = storyScene.spark;
  if (!sp || curBeatIdx + 1 >= (sp.fistUntil || 1e9)) return;
  if (activeGestures.some((g) => g.def.R)) return;
  const h = emoHands.R;
  h.at.copy(FIST_AT); h.pole.copy(FIST_POLE); h.rot.copy(FIST_ROT); h.curl = 1; h.thumb = 0.8;
  if (performance.now() < spark.trembleUntil) { h.at.x += Math.sin(t * 31) * 0.5; h.at.y += Math.sin(t * 27 + 1) * 0.4; }
}

// --- 14E. GEORGE TALKING ---
// While George's line is actually being spoken: the mouth opens and closes with the voice (the clip's level through
// voiceAnalyser, else a syllable rhythm laid over the words, from word timestamps when the clip has them), stressed words
// get a small head beat + brow lift, a question lifts and tilts the head on its last word, and he leans in a touch.
// Nothing moves on silent beats, before a voiceDelay ends, or once the line has finished.
const talk = { mouth: 0, nod: 0, nodV: 0, brow: 0, lean: 0, tilt: 0, lastWord: -1, lastBeat: -9, plan: null };
const STRESS_MIN = 5; // letters: a word this long (or the last word before , . ? !) can get a head beat
// Head beats at most every TALK_BEAT_GAP s: with a beat on every stressed word (about 2 in 3 words, 1.7 a second) the
// head bobbled. Real speakers land roughly one beat per phrase; the line's last word always gets its beat.
const TALK_BEAT_GAP = 0.9;
function talkPlan(b, dur, words) { // [{ t0, t1, stress, q }] per word, in seconds from the line start
  const toks = (b.text || '').split(/\s+/).filter(Boolean);
  if (words && words.length) return words.map((w, i) => ({ t0: w.t0, t1: w.t1, stress: /[,.?!]$/.test(toks[i] || w.w) || (w.w || '').replace(/\W/g, '').length >= STRESS_MIN, q: /\?$/.test(toks[i] || '') }));
  // no timestamps: spread the words over the line, pauses after punctuation
  const weights = toks.map((w) => w.replace(/\W/g, '').length * 0.12 + 0.18 + (/[.?!]$/.test(w) ? 0.35 : /[,…]$|\.\.\.$/.test(w) ? 0.2 : 0));
  const sum = weights.reduce((a, x) => a + x, 0) || 1;
  let t = 0;
  return toks.map((w, i) => {
    const len = dur * weights[i] / sum, pause = /[.?!]$/.test(w) ? 0.35 : /[,…]$|\.\.\.$/.test(w) ? 0.2 : 0;
    const o = { t0: t, t1: t + len - dur * pause / sum, stress: /[,.?!]$/.test(w) || w.replace(/\W/g, '').length >= STRESS_MIN, q: /\?$/.test(w) };
    t += len; return o;
  });
}
function voiceLevel() {
  if (typeof voiceAnalyser === 'undefined' || !voiceAnalyser || voiceMode !== 'voicebox') return null;
  const buf = talk.buf || (talk.buf = new Float32Array(voiceAnalyser.fftSize));
  voiceAnalyser.getFloatTimeDomainData(buf);
  let e = 0; for (let i = 0; i < buf.length; i++) e += buf[i] * buf[i];
  return Math.min(1, Math.sqrt(e / buf.length) * 7);
}
function tickTalk(dt, t) {
  const b = beats[curBeatIdx] || {};
  let now = -1, dur = 0;
  if (b.speaker === 'HUMAN' && b.text && !voicePending) {
    if (lineVoice) { now = (performance.now() - lineVoice.start) / 1000; dur = lineVoice.dur; if (lineVoice.end != null) now = -1; }
    else if (!soundEnabled) { // silent preview: mime the line over its reading time
      dur = Math.max(0.8, (b.text.split(/\s+/).length * paceOpts.wordSecs) / paceOpts.speed);
      now = (performance.now() - beatShownAt) / 1000 - (b.voiceDelay || 0);
      if (now > dur) now = -1;
    }
  }
  if (!talk.plan || talk.plan.beat !== b || talk.plan.dur !== dur || talk.plan.words !== (lineVoice && lineVoice.words)) {
    talk.plan = { beat: b, dur, words: lineVoice && lineVoice.words, list: dur ? talkPlan(b, dur, lineVoice && lineVoice.words) : [] };
    talk.lastWord = -1; talk.lastBeat = -9;
  }
  let mouthGoal = 0;
  if (now >= 0) {
    const lvl = voiceLevel();
    const wi = talk.plan.list.findIndex((w) => now >= w.t0 && now < w.t1);
    if (lvl != null) mouthGoal = lvl;
    else if (wi >= 0) { // ~4.5 syllables a second inside a word, closed between words
      const w = talk.plan.list[wi], u = (now - w.t0) / Math.max(0.12, w.t1 - w.t0);
      const syl = Math.max(1, Math.round((w.t1 - w.t0) * 4.5));
      mouthGoal = 0.12 + 0.88 * Math.abs(Math.sin(u * syl * Math.PI));
    }
    if (wi >= 0 && wi !== talk.lastWord) {
      talk.lastWord = wi;
      const w = talk.plan.list[wi], last = wi === talk.plan.list.length - 1;
      if (w.stress && (now - talk.lastBeat >= (last ? 0.45 : TALK_BEAT_GAP))) { talk.nodV += 0.85; talk.brow = 1; talk.lastBeat = now; }
      if (last && w.q) talk.tilt = 1;
    }
  }
  talk.mouth += (mouthGoal - talk.mouth) * (1 - Math.exp(-dt * 22));
  // head beat: a damped spring kicked on stressed words (pitch dips ~2-3 deg and comes back)
  talk.nodV += (-talk.nod * 90 - talk.nodV * 14) * dt; talk.nod += talk.nodV * dt;
  talk.brow = Math.max(0, talk.brow - dt * 2.2);
  talk.tilt = Math.max(0, talk.tilt - dt * 0.6);
  talk.lean += ((now >= 0 ? 1 : 0) - talk.lean) * (1 - Math.exp(-dt * 2.5));
  // calmer feelings talk smaller (grief, shame, peace hold still; anxious and frustration a bit bigger)
  talk.amp = 1 - 0.5 * ((emoW.grief || 0) + (emoW.shame || 0) + (emoW.peace || 0)) + 0.25 * ((emoW.frustration || 0) + (emoW.anxious || 0));
}

// Face: shader uniforms for mouth/brow paint/blush, brow meshes rotate about their middles, lids pivot on the eye centre.
function applyEmotionFace(dt) {
  const u = georgeMakerShader.uniforms;
  const mouthOpen = Math.min(1, emo.open + talk.mouth * 0.42 * (1 - emo.open));
  u.uSmile.value = emo.smile; u.uMouthOpen.value = mouthOpen;
  u.uBrowLift.value = emo.brow + talk.brow * 0.0015 * talk.amp; u.uBrowKnit.value = emo.knit; u.uBlush.value = emo.blush;
  for (const s of [-1, 1]) {
    const pair = georgeFace.brows[s];
    if (!pair) continue;
    const th = -s * emo.knit * 1.5, px = s * 0.037, py = 1.697, c = Math.cos(th), sn = Math.sin(th);
    for (const m of pair) {
      m.rotation.z = th;
      m.position.set(px - (px * c - py * sn), py - (px * sn + py * c) + emo.brow + talk.brow * 0.0015 * talk.amp, 0);
    }
  }
  // blinks every few seconds, quicker when anxious
  emoNextBlink -= dt;
  if (emoNextBlink <= 0) { emoBlink = 1; emoNextBlink = 2.5 + Math.random() * 3.5 - emo.tremble * 120; }
  emoBlink = Math.max(0, emoBlink - dt * 7);
  const blink = Math.sin(emoBlink * Math.PI);
  const lid = THREE.MathUtils.clamp(emo.lid, -0.4, 1);
  georgeFace.lids.forEach((l, i) => {
    // the upper lid rests on the iris (10A eyes, Nov 16 2026), so closing needs less travel: lid 1 just shuts the eye
    // (peace), 0.7 is heavy (grief), 0.5 squints (joy); widening (lid < 0) keeps the full range
    const up = lid * (lid > 0 ? 0.62 : 0.95);
    l.upper.rotation.x = up + blink * (1.25 - up);
    l.lower.rotation.x = -Math.max(0, lid) * 0.30 - blink * 0.2;
    // once the lids meet, swap the eye for the single closed-eye line drawn on the skin
    const e = georgeFace.eyes[i], shut = l.upper.rotation.x >= 0.58;
    if (e && e.shut) { e.g.visible = !shut; e.shut.visible = shut; }
  });
  // lips follow the painted mouth: part for an open mouth, lift a touch with a smile, sink with a frown
  const lipOpen = mouthOpen * 0.0065, lipLift = emo.smile * 0.0018;
  const lips = georgeFace.lips;
  if (lips[0]) lips[0].position.y = lipOpen + lipLift;
  if (lips[1]) lips[1].position.y = -lipOpen + lipLift;
  // eyes: gaze pitch from the feeling, plus a small drifting look so he never stares dead-still
  emoGazeT += dt;
  if (emoGazeT > emoGazeNext) { emoGazeT = 0; emoGazeNext = 0.8 + Math.random() * 2.2; emoGazeGoal.set((Math.random() - 0.5) * 0.10, (Math.random() - 0.5) * 0.05); }
  emoGazeCur.lerp(emoGazeGoal, 1 - Math.exp(-dt * 9));
  for (const e of georgeFace.eyes) {
    e.g.rotation.x = emo.gaze * 0.30 + emoGazeCur.y;
    e.g.rotation.y = e.baseY + emoGazeCur.x;
  }
}
let emoGazeT = 0, emoGazeNext = 1;
const emoGazeGoal = new THREE.Vector2(), emoGazeCur = new THREE.Vector2();

// While a take records, the frame renders at an exact size (e.g. 1080×1920) instead of window size × pixel ratio.
let shadowMapsDrawn = false;   // false until the main pass has drawn the shadow maps once (the mirror pass then reuses them)
let renderSizeOverride = null; // [w, h] in device pixels, or null
function resizeRenderer() {
  const container = document.getElementById('frame-container');
  const rect = container.getBoundingClientRect();
  const w = Math.max(280, Math.floor(rect.width));
  const h = Math.max(280, Math.floor(rect.height));
  const pr = renderer.getPixelRatio();
  const rw = renderSizeOverride ? renderSizeOverride[0] : Math.floor(w * pr);
  const rh = renderSizeOverride ? renderSizeOverride[1] : Math.floor(h * pr);

  // sceneRT is checked too: renderer.setPixelRatio (auto quality in 16) resizes the canvas itself but not the render targets
  if (canvas.width !== rw || canvas.height !== rh || sceneRT.width !== rw || sceneRT.height !== rh) {
    if (renderSizeOverride) { renderer.setPixelRatio(1); renderer.setSize(rw, rh, false); }
    else renderer.setSize(w, h, false);
    sceneRT.setSize(rw, rh);
    reflectRT.setSize(Math.floor(rw * 0.5), Math.floor(rh * 0.5));
    // k: how much larger than 1080p a take is (1 for the live view and for takes up to 1080p). The glow targets stay at
    // their 1080 size (the blur reaches a fixed number of texels, so the glow keeps its width on screen), fed by a
    // half-frame bright pass that is shrunk into brightRT (brightHiRT, see 03 and the passes at the end of animate).
    const k = renderSizeOverride ? Math.max(1, Math.min(rw, rh) / 1080) : 1;
    const bw = rw / k, bh = rh / k;
    brightRT.setSize(Math.floor(bw * 0.5), Math.floor(bh * 0.5));
    blurHRT1.setSize(Math.floor(bw * 0.5), Math.floor(bh * 0.5));
    blurVRT1.setSize(Math.floor(bw * 0.5), Math.floor(bh * 0.5));
    blurHRT2.setSize(Math.floor(bw * 0.25), Math.floor(bh * 0.25));
    blurVRT2.setSize(Math.floor(bw * 0.25), Math.floor(bh * 0.25));
    if (k > 1) {
      if (!brightHiRT) brightHiRT = makeRT(2, 2);
      brightHiRT.setSize(Math.floor(rw * 0.5), Math.floor(rh * 0.5));
    } else if (brightHiRT) { brightHiRT.dispose(); brightHiRT = null; }

    camera.aspect = rw / rh;
    camera.updateProjectionMatrix();

    // A take larger than 1080p gets more blur samples, in step with its area (4K: 96), so the out-of-focus background
    // stays as smooth as it is at 1080. The live view and 1080 takes keep 24.
    const taps = Math.max(24, Math.min(96, Math.round(24 * k * k)));
    if (compositeMat.defines.DOF_TAPS !== taps) { compositeMat.defines.DOF_TAPS = taps; compositeMat.needsUpdate = true; }
  }
}
window.addEventListener('resize', resizeRenderer);

populateScriptTextarea();
// Deep links: ?ep=1&beat=3&cam=human&mood=0&vert=1&clean=1&drawer=1&snap=1
(function () {
  const q = new URLSearchParams(location.search);
  const ep = parseInt(q.get('ep'), 10);
  if (!isNaN(ep) && ep >= 1 && ep <= EPISODES.length) loadEpisode(ep - 1);
  if (q.get('vert') === '1') toggleVertical();
  if (q.get('clean') === '1') toggleCleanMode();
  if (q.get('drawer') === '1') toggleScriptDrawer();
  const bt = parseInt(q.get('beat'), 10);
  applyBeat(!isNaN(bt) ? bt - 1 : 0);
  const cm = q.get('cam');
  if (cm && ['auto', 'wide', 'human', 'humanFace', 'spirit', 'top'].includes(cm)) setCameraCut(cm);
  if (q.get('snap')) {
    // Skip the glide so a screenshot captures the final framing
    camTransitionTime = 0;
    camera.position.copy(desiredCamPos);
    controls.target.copy(desiredCamTarget);
  }
})();
setTimeout(resizeRenderer, 20);

// Auto-play: a beat is done when its voice line has finished plus the pace gap (or, silent, after its reading time).
function beatIsDone() {
  const b = beats[curBeatIdx] || {};
  const dur = beatDuration();
  if (voicePending) return false; // a voiceDelay beat is still waiting to speak
  if (lineVoice) {
    if (beatTimer >= Math.max(dur, lineVoice.dur) + 8) return true; // safety cap
    if (lineVoice.end == null) return false;
    return (performance.now() - lineVoice.end) / 1000 >= (typeof b.gap === 'number' ? b.gap : paceOpts.gap) / paceOpts.speed && !(b.hold > beatTimer); // beat.gap: this line's own pause (s) before the next
  }
  if (speechActive) return beatTimer >= dur + 8; // the clip is still generating: wait, with a cap
  return beatTimer >= dur;
}
function autoAdvance() {
  if (curBeatIdx >= beats.length - 1) { onReelEnd(); return; }
  nextBeat(true);
}

const _bridgeA = new THREE.Vector3(), _bridgeB = new THREE.Vector3(), _bridgeP = new THREE.Vector3(), _focusV = new THREE.Vector3();
const _waterFrustum = new THREE.Frustum(), _waterPM = new THREE.Matrix4();
const _lakeClip = [new THREE.Plane(new THREE.Vector3(0, 1, 0), -LAKE_Y + 0.02)], _noClip = []; // mirror pass keeps only what is above the water
// The water reads its reflection at its own screen position (06: reflUv = (ndc.x, 1 - ndc.y) + ripple offset), so only
// that part of reflectRT is ever sampled. waterMirrorRect() bounds the water's box on screen (edges cut at the near plane),
// in reflectRT texels with MIRROR_MARGIN for the ripples (at most 0.0125 on the lake, 0.026 / 0.036 on the old pool).
// The mirror pass then renders only that window, with the same projection (setViewOffset), so its pixels are unchanged
// while the sky and everything outside the water are neither drawn nor culled in. Nov 19 2026.
const MIRROR_MARGIN = 0.045;
const _wrBox = new THREE.Box3(), _wrV = Array.from({ length: 8 }, () => new THREE.Vector3()), _wrP = new THREE.Vector3();
const _wrEdges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
function waterMirrorRect(W, H) { // [x, y, w, h] in reflectRT pixels (y from the bottom), or null to draw it all
  const g = waterPoolMesh.geometry;
  if (!g.boundingBox) g.computeBoundingBox();
  _wrBox.copy(g.boundingBox).applyMatrix4(waterPoolMesh.matrixWorld);
  const a = _wrBox.min, b = _wrBox.max, zN = -camera.near;
  for (let i = 0; i < 8; i++) _wrV[i].set(i & 1 ? b.x : a.x, i & 2 ? b.y : a.y, i & 4 ? b.z : a.z).applyMatrix4(camera.matrixWorldInverse);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const add = (v) => { _wrP.copy(v).applyMatrix4(camera.projectionMatrix);
    x0 = Math.min(x0, _wrP.x); x1 = Math.max(x1, _wrP.x); y0 = Math.min(y0, _wrP.y); y1 = Math.max(y1, _wrP.y); };
  for (let i = 0; i < 8; i++) if (_wrV[i].z < zN) add(_wrV[i]);
  for (const [i, j] of _wrEdges) {
    const p = _wrV[i], q = _wrV[j];
    if ((p.z < zN) !== (q.z < zN)) add(_wrP.copy(p).lerp(q, (zN - p.z) / (q.z - p.z)));
  }
  if (x0 > x1) return null;
  // screen ndc -> reflectRT uv: u = ndc.x / 2 + 0.5, v = 1 - (ndc.y / 2 + 0.5) (the mirror image is flipped)
  const u0 = x0 * 0.5 + 0.5 - MIRROR_MARGIN, u1 = x1 * 0.5 + 0.5 + MIRROR_MARGIN;
  const v0 = 0.5 - y1 * 0.5 - MIRROR_MARGIN, v1 = 0.5 - y0 * 0.5 + MIRROR_MARGIN;
  const px0 = Math.max(0, Math.floor(u0 * W)), px1 = Math.min(W, Math.ceil(u1 * W));
  const py0 = Math.max(0, Math.floor(v0 * H)), py1 = Math.min(H, Math.ceil(v1 * H));
  if (px1 <= px0 || py1 <= py0) return null;
  if ((px1 - px0) * (py1 - py0) > 0.92 * W * H) return null; // nearly all of it: not worth the offset
  return [px0, py0, px1 - px0, py1 - py0];
}
function animate() {
  requestAnimationFrame(animate);
  const _frameT0 = performance.now();
  resizeRenderer();

  const dt = Math.min(clock.getDelta(), 0.1);
  const t = clock.getElapsedTime();
  // cue cuts keep at least CAM_MIN_CUT_SECS apart (a queued one waits); beat-start cuts are never queued
  // a cue's `minCut` (s) may shorten that wait for its own cut; a `reveal` cue with a `cam` plays the entrance on the cut
  if (pendingCueShot && performance.now() - lastCamCutAt >= (pendingCueShot._minCut || CAM_MIN_CUT_SECS) * 1000) { const b = pendingCueShot; pendingCueShot = null; resolveShotForBeat(b); if (revealOnCut) { revealOnCut = false; revealNow(); } }

  if (autoPlay) {
    beatTimer += dt;
    updateProgressBars();
    if (beatIsDone()) autoAdvance();
  }
  tickTake();

  curCoherence = THREE.MathUtils.lerp(curCoherence, targetCoherence, dt * 1.1);
  const activeBeat = beats[curBeatIdx] || {};
  const spiritSpeaking = activeBeat.speaker === 'SPIRIT';

  // 1. Update All Custom Shader Uniforms
  skyUniforms.uTime.value = t;
  skyUniforms.uCoherence.value = curCoherence;

  waterUniforms.uTime.value = t * 0.55;
  waterUniforms.uCoherence.value = curCoherence;
  waterUniforms.uCamPos.value.copy(camera.position);

  fireShaderUniforms.uTime.value = t * 0.5;
  godRayUniforms.uTime.value = t;
  godRayUniforms.uIntensity.value = 0.65 + curCoherence * 0.65 + (spiritSpeaking ? 0.35 : 0) + _wg.radiate * 0.7; // radiate gesture (last frame's value)

  compositeMat.uniforms.uTime.value = t;
  georgeMakerShader.uniforms.uTime.value = t;
  georgeMakerShader.uniforms.uFireCol.value.copy(fireLight.color);
  georgeMakerShader.uniforms.uCoherence.value = curCoherence;

  spiritBodyUniforms.uTime.value = t * 0.6;
  spiritBodyUniforms.uCoherence.value = curCoherence;
  spiritBodyUniforms.uSpeakBoost.value = THREE.MathUtils.lerp(
    spiritBodyUniforms.uSpeakBoost.value,
    spiritSpeaking ? 1.0 : 0.0,
    dt * 5.0
  );

  // 2. Step Skeletal AnimationMixers
  // The mixer only rewrites a bone when its sampled value changes, so a near-frozen clip leaves our
  // offsets from last frame in place and they pile up. Restore the clean pose first, step, re-capture.
  for (const n in humanClean) {
    const c = humanClean[n], b = humanBones[n];
    b.quaternion.copy(c.q);
    if (c.p) b.position.copy(c.p);
  }
  for (const m of mixers) m.update(dt);
  for (const n of POSED_BONES) {
    const b = humanBones[n];
    if (!b) continue;
    const c = humanClean[n] || (humanClean[n] = { q: new THREE.Quaternion(), p: n === 'mixamorigHips' ? new THREE.Vector3() : null });
    c.q.copy(b.quaternion);
    if (c.p) c.p.copy(b.position);
  }

  // 3. Expressive Gaze & Gestures on George (The Human Maker)
  // +X pitch = nose down: slump the head on sad_pose, gently attend to the Witness when it speaks
  tickBeatCues(dt);
  blendEmotions(dt);
  const trem = emo.tremble * (Math.sin(t * 17.0) + Math.sin(t * 23.3 + 1.1)) * 0.5;
  const shakeYaw = emo.shake * Math.sin(t * 4.2) * Math.pow(Math.max(0, Math.sin(t * 0.9)), 2); // head-shake bursts
  const bob = emo.bob * Math.abs(Math.sin(emoBobPhase));
  const gazePitch = emo.hp + (spiritSpeaking ? 0.03 : 0.0);
  tickTalk(dt, t);
  const gazeYaw = -0.10 + Math.sin(t * 0.6) * 0.05;
  // Restless micro-drift as coherence drops. Pitch and yaw use unrelated frequencies (and a
  // sine + cosine pair at one frequency would trace a visible circle), so it never reads as a loop.
  const swayAmt = Math.max(0, 1.0 - curCoherence * 1.4);
  const swayPitch = (Math.sin(t * 0.37) * 0.6 + Math.sin(t * 0.91 + 1.3) * 0.4) * 0.018 * swayAmt;
  const swayYawExtra = (Math.sin(t * 0.53 + 0.7) * 0.6 + Math.sin(t * 1.17) * 0.4) * 0.022 * swayAmt;

  // Seated on the log, leaning toward the fire. The mixer rewrites every bone each frame, so these
  // never accumulate: legs/hips are set absolute from the bind pose (every clip ends up seated),
  // torso/arms/head multiply onto whatever the clip does.
  const hb = humanBones;
  if (hb['mixamorigHips']) {
    hb['mixamorigHips'].position.y -= SEAT_HIP_DROP;
    hb['mixamorigHips'].position.z += SEAT_HIP_BACK;
    const set = (n, rx, ry, rz) => { if (!hb[n]) return; _tmpEuler.set(rx, ry, rz, 'XYZ'); hb[n].quaternion.copy(humanRest[n]).multiply(_tmpQuat.setFromEuler(_tmpEuler)); };
    const sitLeg = (side, sgn) => {
      set(`mixamorig${side}UpLeg`, -1.50, sgn * 0.10, sgn * 0.06);
      set(`mixamorig${side}Leg`, 1.52, 0, 0);
      set(`mixamorig${side}Foot`, -0.02, 0, 0);
    };
    sitLeg('Left', 1); sitLeg('Right', -1);
    // All of the lean hinges on the lowest spine bone (just above the hips) so the back bends at the waist, not mid-back.
    addBoneOffset(hb['mixamorigSpine'], 0.38 + emo.lean + bob + trem * 0.4 + talk.lean * 0.025 * talk.amp, emo.twist, emo.tilt);
    addBoneOffset(hb['mixamorigSpine2'], emo.chest - bob * 0.5, 0, 0);
    // Arms are absolute from the bind pose too, mirrored: forearms resting on the thighs, hands near the knees.
    // (Multiplied onto the clips they came out lopsided and the standing clips' gestures pushed the hands into the lap.)
    // Searched (left side) for elbows just outside the ribs, forearms clear of the thighs, palms flat; pinWrist below fine-tunes the reach.
    const A = window.SEAT_ARM || (window.SEAT_ARM = { ax: 2.225, ay: -0.518, az: 0.953, fx: -0.656, fy: -0.313, fz: 1.629, hx: 0.013, hy: 0.16, hz: 0.192 });
    const br = Math.sin(emoBreathPhase) * 0.012 * (1 + emo.breath * 0.8); // breathing: shoulders rise and fall a touch, so the arms never sit dead still
    const sitArm = (side, sgn) => {
      set(`mixamorig${side}Arm`, A.ax + br, sgn * A.ay, sgn * A.az);
      set(`mixamorig${side}ForeArm`, A.fx, sgn * A.fy, sgn * A.fz);
      set(`mixamorig${side}Hand`, A.hx, sgn * A.hy, sgn * A.hz);
    };
    sitArm('Left', 1); sitArm('Right', -1);
    // The clips still move the spine and collarbones, which would lift the hands off the thighs, so pin each wrist
    // to a spot just behind the knee (Hips space, cm) with a two-bone fix-up: bend the elbow to the right reach, swing, then roll the elbow toward SEAT_ELBOW.
  }
  if (humanBones['mixamorigHead']) {
    humanBones['mixamorigHead'].scale.setScalar(1.14); // stylized proportions: a slightly larger head
    // lean pitches the face at the ground; lift it back up so he watches the flames
    const gh = headGestureNow();
    const ta = talk.amp, tq = Math.sin(Math.min(1, talk.tilt) * Math.PI * 0.5);
    addBoneOffset(humanBones['mixamorigHead'], gazePitch + swayPitch + trem - 0.52 - emo.lean * 0.6 + gh[0] + talk.nod * ta - tq * 0.05,
      gazeYaw + swayYawExtra + emo.hy + shakeYaw + gh[1], emo.hr + gh[2] + tq * 0.07 * ta);
  }
  if (hb['mixamorigHips']) {
    // Hands go last so face-space targets (head in hands, chin on fist) follow the posed head.
    blendEmotionHands();
    applyGestures();
    applyStoryHands(t);
    smoothEmotionHands(dt);
    const fid = emo.fidget * Math.sin(t * 2.6);
    emoHands.L.at.x += fid * 0.3; emoHands.L.at.z += fid; emoHands.R.at.x -= fid * 0.3; emoHands.R.at.z -= fid;
    for (const [side, key] of [['Left', 'L'], ['Right', 'R']]) {
      const h = emoHands[key];
      pinWrist(side, h.at, h.pole);
      addBoneOffset(hb[`mixamorig${side}Hand`], h.rot.x, h.rot.y, h.rot.z);
    }
    curlFingers();
    applyEmotionFace(dt);
  }

  // Overthinking Chaos Vortex above George's Head
  const chaosWeight = Math.max(0, 1.0 - curCoherence * 1.15);
  // close-ups fade the wireframe markers out so they never read as debug shapes behind a face
  avoidE = avoidNow();
  numbE = numbNow();
  judgeE = judgeNow();
  applyNumbWorld();
  const swarmNear = camera.position.distanceTo(thoughtSwarmGroup.position) < 2.4; // a free camera close to his head counts as a close-up too
  swarmShow += (((shotIsCloseUp || swarmNear) && avoidE < 0.05 ? 0 : 1) - swarmShow) * (1 - Math.exp(-dt * 4));
  const swarmSize = Math.max(chaosWeight * swarmShow, avoidE * 3.0); // the Avoider shows the swarm even on a calm, close shot
  thoughtSwarmGroup.visible = sceneOpts.swarm && swarmSize > 0.03;
  thoughtNodes.forEach((n, idx) => {
    // Integrate the angle (never t * f(coherence)) so coherence changes can't make it jump or spin up
    n.angle = (n.angle ?? n.phase) + dt * n.speed * (0.12 + avoidE * 1.1);
    const sr = n.radius * (1 + avoidE * (3.2 + (idx % 5) * 0.7)); // scatter: each node flies out a different distance
    n.mesh.position.set(
      Math.cos(n.angle) * sr,
      Math.sin(n.angle * 0.5 + idx) * 0.04 + avoidE * (0.35 + (idx % 4) * 0.22),
      Math.sin(n.angle) * sr
    );
    n.mesh.rotation.x = t * 0.08;
    n.mesh.rotation.y = t * 0.06;
    n.mesh.scale.setScalar(Math.max(0.001, swarmSize * (natureOn ? 0.62 : 1.0)));
  });


  // 4. Transcendent Levitation & Celestial Breath Pose on the Spiritual Being
  spiritFloatGroup.position.y = 0.34 + Math.sin(t * 0.8) * 0.08;
  if (spiritRobe) {
    // slow drifting sway of the robe about the hips (different frequencies so it never reads as a loop)
    spiritRobe.rotation.x = Math.sin(t * 0.55) * 0.05;
    spiritRobe.rotation.z = Math.sin(t * 0.37 + 1.1) * 0.06;
  }
  const wg = witnessGestureNow();
  if (spiritBones['mixamorigHead']) {
    const nod = spiritSpeaking ? Math.sin(t * 1.8) * 0.04 : Math.sin(t * 0.9) * 0.03;
    addBoneOffset(spiritBones['mixamorigHead'], nod + wg.head, Math.cos(t * 0.5) * 0.05, wg.tilt);
  }
  if (wg.tilt) addBoneOffset(spiritBones['mixamorigSpine2'], 0, 0, wg.tilt * 0.3);
  if (wg.spine) { // lean-in / bow / open-hands: the lean hinges across the three spine bones (hands follow the chest)
    addBoneOffset(spiritBones['mixamorigSpine'], wg.spine * 0.4, 0, 0);
    addBoneOffset(spiritBones['mixamorigSpine1'], wg.spine * 0.35, 0, 0);
    addBoneOffset(spiritBones['mixamorigSpine2'], wg.spine * 0.25, 0, 0);
  }
  if (spiritBones['mixamorigLeftUpLeg'] && spiritBones['mixamorigRightUpLeg']) {
    addBoneOffset(spiritBones['mixamorigLeftUpLeg'], -0.32, 0, 0.10);
    addBoneOffset(spiritBones['mixamorigLeftLeg'], 0.52, 0, 0);
    addBoneOffset(spiritBones['mixamorigRightUpLeg'], -0.18, 0, -0.08);
    addBoneOffset(spiritBones['mixamorigRightLeg'], 0.34, 0, 0);
  }
  if (spiritFx && spiritFx.skeleton) {
    // hands held in namaste before the heart (absolute pose from 10h), rising gently with the breath
    csNamastePose(spiritFx.skeleton, Math.sin(t * 1.0) * 0.006, wg.open);
  }

  // Spin the Heart Merkaba & Gyroscopic Astrolabe Rings
  const spiritSpeakBoost = spiritSpeaking ? 1.15 : 1.0;
  const ringSpeed = (0.20 + curCoherence * 0.30) * spiritSpeakBoost;
  // halo rings stay flat to the camera and turn slowly; the billboard itself follows the head
  haloRing1.rotation.z = t * ringSpeed * 0.4;
  haloRing2.rotation.z = -t * ringSpeed * 0.3;
  haloRing3.rotation.z = t * ringSpeed * 0.2;
  updateSpiritHalo(spiritHalo, spiritBones['mixamorigHead'], spiritFloatGroup, camera);
  if (spiritFx) {
    // ribbons wind slowly about the figure on top of the shader's free-end drift
    spiritFx.ribbons.forEach((r, i) => {
      r.mesh.rotation.y = Math.sin(t * 0.32 + r.phase) * 0.10 * (1 + i * 0.15);
      r.mesh.rotation.x = Math.sin(t * 0.27 + r.phase * 1.7) * 0.04;
    });
  }

  tetraUp.rotation.y = t * 0.7;
  tetraDown.rotation.y = -t * 0.7;
  heartChakraAttachment.scale.setScalar((1.0 + Math.sin(t * (spiritSpeaking ? 2.6 : 1.3)) * 0.08) * (1 + wg.radiate * 0.6));
  spiritHalo.scale.setScalar(1 + wg.radiate * 0.35);

  spiritMotes.forEach((m) => {
    const a = t * m.speed * spiritSpeakBoost + m.angle;
    m.sprite.position.set(
      Math.cos(a) * m.radius,
      m.yOffset + Math.sin(t * 0.9 + m.angle) * 0.10,
      Math.sin(a) * m.radius
    );
  });

  // 5. Double-Helix Golden-Cyan Resonance Stream
  const startPt = _bridgeA.set(-1.02, 1.12, 0.42);
  const endPt = _bridgeB.set(1.08, spiritFloatGroup.position.y + 1.32, -0.12);
  if (sceneOpts.stream) bridgeNodes.forEach((node) => { // skipped while the stream is switched off
    const f = (node.frac + t * (spiritSpeaking ? -0.10 : 0.08) + 10) % 1;
    const pos = _bridgeP.lerpVectors(startPt, endPt, f);
    const env = Math.sin(f * Math.PI);
    const helixAngle = f * Math.PI * 5.0 - t * 1.3 + (node.strand === 1 ? 0 : Math.PI);
    pos.y += env * (0.55 + curCoherence * 0.35) + Math.sin(helixAngle) * 0.14 * env;
    pos.z += Math.cos(helixAngle) * 0.16 * env;
    node.sprite.position.copy(pos);
    const sz = env * (0.11 + curCoherence * 0.06) * (natureOn ? 0.62 : 1.0);
    node.sprite.scale.set(sz, sz, 1);
  });

  // 6. Campfire Embers, Monoliths & Flying Astral Birds
  const fs = Math.max(-0.85, fireSwellNow() + NUMB_FX.fire * numbE + JUDGE_FX.fire * judgeE); // the Numb-er dims the fire on its own envelope
  flameMeshes.forEach((f) => f.mesh.scale.set(f.sx * (1 + 0.6 * fs), f.sy * (1 + 1.1 * fs), 1));
  leanFlames(fireLeanNow);
  // one flicker for everything the fire lights: the point light, George's toon, the grass pool, halo and ground pool
  const flick = 1 + 0.075 * Math.sin(t * 4.5) + 0.05 * Math.cos(t * 6.3) + 0.04 * Math.sin(t * 11.7 + 1.3) + 0.03 * Math.sin(t * 17.9);
  const fireK = flick * sceneOpts.fire * (1 + 1.4 * fs);            // 1 = this mood's resting fire
  hearthGlow.scale.setScalar(1.3 * (1 + 1.5 * fs)); hearthGlow.material.opacity = Math.min(1, (0.34 + 0.45 * fs) * flick);
  fireLight.intensity = fireBase * 1.12 * fireK;
  const fireRel = Math.max(0, Math.min(2.2, fireBase / 2.8 * fireK)); // against Blue Dusk's fire
  georgeMakerShader.uniforms.uFireK.value = Math.max(0.15, Math.min(1.9, 0.45 + 0.55 * fireRel));
  bladeFX.uFireK.value = fireRel; bladeFX.uFireC.value.copy(fireLight.color);
  bladeFX.uSpK.value = witnessShow.on ? spiritLight.intensity / 1.5 : 0; bladeFX.uSpC.value.copy(spiritLight.color);
  fireHalo.material.opacity = Math.min(0.3, 0.07 * fireRel); fireHalo.scale.setScalar(3.4 * (0.96 + 0.04 * flick) * (1 + 0.5 * fs));
  firePool.material.opacity = Math.min(0.9, 0.5 * fireRel);
  // The ground pool, halo and hearth glow use a gold-tinted glow map; times the teal spirit fire that goes olive-green,
  // so past the half-way point of the fire's colour change they switch to the neutral glow map.
  const fireGlowMap = fireShaderUniforms.uSpirit.value > 0.5 ? softGlowTex : goldGlowTex;
  if (firePool.material.map !== fireGlowMap) [firePool, fireHalo, hearthGlow].forEach((o) => { o.material.map = fireGlowMap; o.material.needsUpdate = true; });
  bridgeGroup.visible = sceneOpts.stream;
  tickStoryScene(dt, t);
  risingEmbers.forEach((e, idx) => {
    const cycle = (t * e.speed * 0.55 + e.phase) % 1.0;
    const ang = t * 0.7 + idx;
    e.sprite.position.set(
      Math.cos(ang) * e.rad * (1.0 + cycle * 0.6),
      0.15 + cycle * 3.0 * (1 + 0.8 * fs),
      Math.sin(ang) * e.rad * (1.0 + cycle * 0.6)
    );
    e.sprite.material.opacity = Math.min(1, Math.sin(cycle * Math.PI) * (sceneOpts.embers ? 0.85 + 0.3 * fs : 0));
    if (e.bs === undefined) e.bs = e.sprite.scale.x;
    e.sprite.scale.setScalar(e.bs * Math.max(0.15, 1 + 2 * fs));
    e.sprite.position.x += fireLeanDir.x * fireLeanNow * cycle * 0.9; e.sprite.position.z += fireLeanDir.z * fireLeanNow * cycle * 0.9;
  });

  monoliths.forEach((r, i) => {
    const a = r.angle + t * r.speed;
    r.mesh.position.set(
      Math.cos(a) * r.dist,
      r.baseY + Math.sin(t * 0.7 + i) * 0.18,
      Math.sin(a) * r.dist
    );
    r.mesh.rotation.y = t * 0.25;
  });

  astralBirds.forEach((b) => {
    b.pivot.visible = sceneOpts.birds;
    if (b.flap) b.flap(t);
    // Elliptical loop around (cx, cz); a plain circle at the origin unless updateNature moved it
    const a = t * b.speed + b.phase;
    const rz = b.rz || b.radius;
    b.pivot.position.set(
      (b.cx || 0) + Math.cos(a) * b.radius,
      b.height + Math.sin(t * 1.0 + b.phase) * 0.20 + avoidE * 1.4,
      (b.cz || 0) + Math.sin(a) * rz
    );
    b.pivot.rotation.y = Math.PI / 2 - Math.atan2(rz * Math.cos(a), -b.radius * Math.sin(a));
  });

  starField.rotation.y = t * 0.012;
  updateNature(t);

  if (typeof tickAvoider === 'function') tickAvoider(avoidE, dt); // 18: the Avoider's figure (copies George's final pose for this frame)
  if (typeof tickNumber === 'function') tickNumber(numbE, dt, t); // 18: the Numb-er's smoke figure and the low fog
  if (typeof tickJudge === 'function') tickJudge(judgeE, dt, t); // 18: the Judge, tall on the tree line behind George

  // 7. Smooth Director Camera Glide
  camWiden = gestureWidenNow();
  if (camMove) {
    if (performance.now() >= camMoveHoldUntil) camMove.t += dt;
    updateCamMoveDesired();
  }
  if (camTransitionTime > 0 || camMove) {
    camTransitionTime = Math.max(0, camTransitionTime - dt);
    const damp = 1.0 - Math.exp(-dt * (camTransitionTime > 0 ? camOpts.glide : 3.0));
    camera.position.lerp(desiredCamPos, damp);
    controls.target.lerp(desiredCamTarget, damp);
  }
  if (typeof tickExplore === 'function') tickExplore(dt); // 16: WASD flight + free-roam camera
  controls.update();

  // Depth of field: focus on the look-at point along the view axis, easing so each cut racks focus instead of snapping.
  const focusPt = camFocus.override || controls.target;
  const wantFocus = Math.max(0.3, _focusV.copy(focusPt).sub(camera.position).dot(camera.getWorldDirection(_dofDir)));
  camFocus.dist = camFocus.snap ? wantFocus : camFocus.dist + (wantFocus - camFocus.dist) * (1 - Math.exp(-dt * 5));
  camFocus.snap = false;
  compositeMat.uniforms.uFocusDist.value = camFocus.dist;
  compositeMat.uniforms.uDofStrength.value = dofEnabled ? camFocus.strength * dofAmount : 0;
  compositeMat.uniforms.uAspect.value = camera.aspect;
  compositeMat.uniforms.uLetterbox.value = letterboxOn && camera.aspect > 1 ? 1 : 0;

  // The Avoider pulls the eye off him: up and aside, eased by the same envelope. controls.update() re-aims the camera
  // every frame, so this never accumulates. Not while the user is roaming in explore mode.
  if (avoidE > 0.001 && !(typeof uiMode !== 'undefined' && uiMode === 'explore' && !followDirector)) {
    _shakeEuler.set(avoidE * 0.11, -avoidE * 0.055, 0); // mostly up, where the swarm goes; a little aside
    camera.quaternion.multiply(_shakeQuat.setFromEuler(_shakeEuler));
  }

  // Handheld sway, only while the director has the camera (not while the user orbits).
  if (handheldAmt > 0 && (camMove || camTransitionTime > 0)) {
    handheldBoost += (handheldBoostGoal - handheldBoost) * (1 - Math.exp(-dt * 1.5));
    const a = 0.0011 * handheldAmt * handheldBoost;
    _shakeEuler.set(
      (Math.sin(t * 1.3) * 0.6 + Math.sin(t * 2.9 + 1.7) * 0.4) * a,
      (Math.sin(t * 1.1 + 0.8) * 0.6 + Math.sin(t * 3.3) * 0.4) * a,
      Math.sin(t * 0.9 + 2.1) * a * 0.5
    );
    camera.quaternion.multiply(_shakeQuat.setFromEuler(_shakeEuler));
  }

  // ==========================================================================
  // 8. MULTI-PASS RENDERING PIPELINE (Planar Reflection + 5-Pass HDR Bloom)
  // ==========================================================================
  waterPoolMesh.visible = false;
  setReflectionPassVisibility(false);
  // Mirror about the lake surface (LAKE_Y); the lake bed and anything else under the water is clipped away in this pass,
  // or it would stand between the mirrored camera and the sky
  reflectionCamera.position.set(camera.position.x, 2 * LAKE_Y - camera.position.y, camera.position.z);
  reflectionCamera.up.set(0, 1, 0);
  reflectionCamera.lookAt(controls.target.x, 2 * LAKE_Y - controls.target.y, controls.target.z);
  reflectionCamera.aspect = camera.aspect;
  reflectionCamera.updateProjectionMatrix();

  // The mirror pass draws the whole scene again; skip it whenever the pond is out of frame (sky, close-ups, flying away).
  camera.updateMatrixWorld();
  _waterFrustum.setFromProjectionMatrix(_waterPM.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  waterPoolMesh.visible = true;
  const waterInView = _waterFrustum.intersectsObject(waterPoolMesh);
  waterPoolMesh.visible = false;
  if (waterInView) {
    // The shadow maps do not depend on the camera, so the mirror pass reuses the ones the main pass drew last frame
    // instead of drawing every caster again (seven shadow views, about 300 casters each, was the largest CPU cost in the frame).
    renderer.shadowMap.autoUpdate = !shadowMapsDrawn;
    const RW = reflectRT.width, RH = reflectRT.height, wr = waterMirrorRect(RW, RH);
    if (wr) {
      reflectionCamera.setViewOffset(RW, RH, wr[0], RH - wr[1] - wr[3], wr[2], wr[3]); // view offsets count y from the top
      reflectRT.viewport.set(wr[0], wr[1], wr[2], wr[3]); reflectRT.scissor.copy(reflectRT.viewport); reflectRT.scissorTest = true;
    }
    renderer.setRenderTarget(reflectRT);
    renderer.clippingPlanes = _lakeClip;
    renderer.render(scene, reflectionCamera);
    renderer.clippingPlanes = _noClip;
    if (wr) {
      reflectionCamera.clearViewOffset();
      reflectRT.viewport.set(0, 0, RW, RH); reflectRT.scissor.set(0, 0, RW, RH); reflectRT.scissorTest = false;
    }
    if (typeof PERF !== "undefined") PERF.mirrorRect = wr ? +((wr[2] * wr[3]) / (RW * RH)).toFixed(3) : 1;
    renderer.shadowMap.autoUpdate = true;
  }
  shadowMapsDrawn = true;
  waterPoolMesh.visible = true;
  setReflectionPassVisibility(true);

  renderer.setRenderTarget(sceneRT);
  renderer.render(scene, camera);

  brightMat.uniforms.tDiffuse.value = sceneRT.texture;
  if (brightHiRT) { // a take larger than 1080p: bright pass at half the frame, then down to the 1080-size glow target
    renderer.setRenderTarget(brightHiRT);
    renderer.render(brightScene, postCam);
    copyMat.uniforms.tDiffuse.value = brightHiRT.texture;
    renderer.setRenderTarget(brightRT);
    renderer.render(copyScene, postCam);
  } else {
    renderer.setRenderTarget(brightRT);
    renderer.render(brightScene, postCam);
  }

  blurMat.uniforms.uResolution.value.set(brightRT.width, brightRT.height);
  blurMat.uniforms.tDiffuse.value = brightRT.texture;
  blurMat.uniforms.uDirection.value.set(1.5, 0.0);
  renderer.setRenderTarget(blurHRT1);
  renderer.render(blurScene, postCam);

  blurMat.uniforms.tDiffuse.value = blurHRT1.texture;
  blurMat.uniforms.uDirection.value.set(0.0, 1.5);
  renderer.setRenderTarget(blurVRT1);
  renderer.render(blurScene, postCam);

  blurMat.uniforms.uResolution.value.set(blurHRT2.width, blurHRT2.height);
  blurMat.uniforms.tDiffuse.value = blurVRT1.texture;
  blurMat.uniforms.uDirection.value.set(2.8, 0.0);
  renderer.setRenderTarget(blurHRT2);
  renderer.render(blurScene, postCam);

  blurMat.uniforms.tDiffuse.value = blurHRT2.texture;
  blurMat.uniforms.uDirection.value.set(0.0, 2.8);
  renderer.setRenderTarget(blurVRT2);
  renderer.render(blurScene, postCam);

  renderer.setRenderTarget(null);
  renderer.render(compositeScene, postCam);

  drawLiveOverlay();
  if (reelRecorder && reelCtx) drawBroadcastFrame(reelCtx, reelCanvas.width, reelCanvas.height, true);
  if (typeof tickPerf === 'function') tickPerf(_frameT0, waterInView); // 16: frame meter + auto quality
}

animate();
