// © 2026 George Moussa. All rights reserved.
// ============================================================================
// 5. GOLDEN-RATIO CAMERA SHOTS & BALANCED CINEMA LIGHTING RIG
// ============================================================================
// Shots are framed, not placed: each names a look-at point, an orbit angle (az: degrees from +z toward +x,
// el: degrees above horizon) and the half-width/half-height (metres) that must fit. resolveShotForBeat
// solves the dolly distance for the current aspect, so 16:9 and 9:16 reel both get a correct composition.
// `v` overrides fields for the vertical reel (single-subject, tighter, since 9:16 is narrow).
// George sits ~(-1.27,0.59) facing the fire/Witness; the Witness hovers ~(1.05,-0.2); fire at (0,0.35).
const CAM_SHOTS = {
  // Every beat is a close-up on the person talking (or their reaction); halfH is tiny on purpose.
  human:  { target: new THREE.Vector3(-1.13, 1.22, 0.50), az: 68,  el: 4,  halfW: 0.66, halfH: 0.42, label: "🎥 Shot: George Close-Up",
            v: { halfW: 0.30, halfH: 0.56 } },
  // Tight, face-readable George for peak lines (grief, surprise, joy, shame): across-the-fire angle, head and hands only.
  humanFace: { target: new THREE.Vector3(-1.13, 1.30, 0.50), az: 115, el: 2, halfW: 0.36, halfH: 0.28, label: "🎥 Shot: George Face",
            v: { halfW: 0.20, halfH: 0.36 } },
  spirit: { target: new THREE.Vector3(1.02, 1.80, -0.20), az: -48, el: 3,  halfW: 0.66, halfH: 0.42, label: "🎥 Shot: Astral Witness Close-Up",
            v: { halfW: 0.30, halfH: 0.56 } },
  // 'wide' = George, the fire and the Witness together (fit: the camera is solved from WIDE_FIT, not from target/halfW/halfH,
  // which stay only as a fallback). It leans to the speaker: the Witness's line is seen from George's side and George's line
  // from the Witness's side, always far enough off the George-Witness axis (az ~105) that neither figure covers the other.
  // 'top' = high-angle close on the Witness's halo
  wide:   { target: new THREE.Vector3(0.80, 1.45, -0.10), az: -30, el: 7, halfW: 1.7, halfH: 1.0, fit: true, label: "🎥 Shot: Wide, Witness Across The Flames",
            g: { az: 52, el: 7, label: "🎥 Shot: Wide, George Across The Flames", v: { az: 58 } },
            v: { az: -38 } }, // 9:16: a little nearer the axis, but not so near that George's back hides the fire
  // 'across' = the Witness's place seen from George's side of the fire, whoever speaks (no g): before a reveal it shows the
  // empty side; it also holds the fire and George's near shoulder in frame.
  across: { target: new THREE.Vector3(0.55, 1.2, -0.12), az: -32, el: 6, halfW: 1.9, halfH: 1.1, label: "🎥 Shot: Across The Fire",
            v: { halfW: 0.85, halfH: 1.45 } },
  // 'pond' = the pond's near water behind the Witness's place (14D POND_SPOT), looking down from George's side: the stone
  // landing, the ripples, the Witness rising out of them and gliding ashore. noFace: 9:16 keeps this framing (no face to lift).
  pond:   { target: new THREE.Vector3(0.62, 0.7, -1.55), az: -37, el: 14, halfW: 1.7, halfH: 1.05, noFace: true, label: "🎥 Shot: The Pond",
            v: { halfW: 0.95, halfH: 1.75 } },
  top:    { target: new THREE.Vector3(1.02, 1.62, -0.20), az: -25, el: 30, halfW: 0.95, halfH: 0.58, label: "🎥 Shot: High Halo Close-Up",
            g: { target: new THREE.Vector3(-1.13, 1.12, 0.50), az: 108, el: 32, label: "🎥 Shot: High Close On George" }, // az 108: near-frontal, so a lookUp shows his eyes (80 was a profile over the meadow)
            v: { halfW: 0.42, halfH: 0.75 } }
};
// Per-emotion camera for George's own shots (`human`), used in Auto camera mode. Measured on screen: az 30-70 is pure
// profile, ~90 is 3/4, 110-125 is near-frontal across the fire (his face reads). frame scales halfW/halfH (<1 tighter).
// Spec: SYNC_SPEC.md section 4b-2. Emotions not listed keep the authored `human` shot (az 68).
const EMOTION_SHOT = {
  curious:     { az: 90,  el: 4,  frame: 0.95 },
  anxious:     { az: 85,  el: 6,  frame: 1.0 },
  shame:       { az: 95,  el: 14, frame: 1.0 },
  grief:       { az: 118, el: 2,  frame: 0.85 },
  frustration: { az: 105, el: 3,  frame: 0.95 },
  surprise:    { az: 120, el: 2,  frame: 0.85 },
  hope:        { az: 95,  el: -3, frame: 1.0 },
  resolve:     { az: 70,  el: -7, frame: 1.0 },
  joy:         { az: 115, el: -3, frame: 1.0 },
  peace:       { az: 68,  el: 2,  frame: 1.0 },
};
// In-shot move chosen by the feeling (spec 4b rule 1): closing-in feelings push, releasing ones crane/pull, tension orbits.
// `secs` overrides the move length (surprise = fast). A push is swapped for a held frame while his body is already leaning in
// (emotionMove in 13_ui_controls.js, spec 4b-2 movement rule 3).
const EMOTION_MOVE = {
  curious: { move: 'push' }, anxious: { move: 'orbit' }, shame: { move: 'push' }, grief: { move: 'push' },
  frustration: { move: 'orbitL' }, surprise: { move: 'push', secs: 0.9 }, hope: { move: 'crane' },
  resolve: { move: 'push' }, joy: { move: 'crane' }, peace: { move: 'pull' },
};
// Face-readable angle for a reaction cut (cue `react`): near-frontal across the fire, tight on the face.
const REACTION_SHOT = { az: 115, el: 2, frame: 0.85 };
// Tension feelings let the camera carry the energy: handheld sway multiplier per feeling (x intensity), eased in 14_animation_loop.js.
const EMOTION_HANDHELD = { anxious: 3.0, frustration: 3.5, surprise: 2.0, grief: 1.5 };
const CAM_MIN_CUT_SECS = 2.0;  // cue-driven cuts wait until the last cut is this old (beat-start cuts are never delayed)
let camMoveHoldUntil = 0; // moves stand still until this time (ms): no drift while a big pose change cross-fades
let lastCamCutAt = 0, handheldBoost = 1, handheldBoostGoal = 1;
let camWiden = 1;            // >1 while a gesture plays so the moving hand stays in frame (set in 14_animation_loop.js)
let pendingMoodCam = null;   // { type, secs } set by transitionToMood, consumed by resolveShotForBeat / runCue
// What a `fit` shot must hold: spheres round George on his stump, the fire, and the Witness (robe and head + halo).
const WIDE_FIT = [
  { c: new THREE.Vector3(-1.10, 0.92, 0.48), r: 0.58 },
  { c: new THREE.Vector3(0, 0.62, 0.35), r: 0.55 },
  { c: new THREE.Vector3(1.07, 1.12, -0.12), r: 0.55 },
  { c: new THREE.Vector3(1.07, 1.98, -0.12), r: 0.50 }
];
// Solve the nearest camera on the (az, el) direction whose frame holds every sphere, for this lens and aspect.
// Returns the look-at point (at the group's mean depth) and the distance back from it, the same pair an authored shot gives.
const _fitF = new THREE.Vector3(), _fitR = new THREE.Vector3(), _fitU = new THREE.Vector3(), _fitUp = new THREE.Vector3(0, 1, 0);
function fitShot(spheres, azDeg, elDeg, aspect, out) {
  const az = THREE.MathUtils.degToRad(azDeg), el = THREE.MathUtils.degToRad(elDeg);
  _fitF.set(-Math.sin(az) * Math.cos(el), -Math.sin(el), -Math.cos(az) * Math.cos(el));
  _fitR.crossVectors(_fitF, _fitUp).normalize();
  _fitU.crossVectors(_fitR, _fitF);
  const tv = camVfovTan(), th = tv * aspect, kh = Math.hypot(1, th), kv = Math.hypot(1, tv);
  let r1 = -Infinity, r2 = -Infinity, u1 = -Infinity, u2 = -Infinity, depth = 0;
  for (const s of spheres) {
    const pr = s.c.dot(_fitR), pu = s.c.dot(_fitU), pf = s.c.dot(_fitF);
    r1 = Math.max(r1, pr - th * pf + s.r * kh); r2 = Math.max(r2, -pr - th * pf + s.r * kh);
    u1 = Math.max(u1, pu - tv * pf + s.r * kv); u2 = Math.max(u2, -pu - tv * pf + s.r * kv);
    depth += pf / spheres.length;
  }
  const cf = Math.min(-(r1 + r2) / (2 * th), -(u1 + u2) / (2 * tv)); // the tighter of width and height sets the distance
  out.dist = depth - cf;
  out.target.set(0, 0, 0).addScaledVector(_fitR, (r1 - r2) / 2).addScaledVector(_fitU, (u1 - u2) / 2).addScaledVector(_fitF, depth);
  return out;
}
const _fitOut = { target: new THREE.Vector3(), dist: 1 };
// Framing solves against the live lens, so changing the focal length (Studio panel > Camera) keeps every composition.
function camVfovTan() { return Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2); }
// Director options (Studio panel > Camera; persisted by 15_reel_studio.js):
//  cut: 'cut' = hard cut on each beat, 'glide' = swoop between shots · glide: swoop speed (higher = faster)
//  moveAmt: scales the in-shot push/pull/orbit/crane drift · frame: >1 looser, <1 tighter than the authored shot
//  faceY: 9:16 only, where the speaker's face sits (fraction from the top; 0 = keep the authored framing)
const camOpts = { cut: 'cut', glide: 3.0, moveAmt: 1.0, frame: 1.0, faceY: 0.36 };
// Scene dressing (Studio panel > Scene): multipliers on top of the mood, and on/off for the extra effects.
const sceneOpts = { fire: 1.0, flies: 1.0, glow: 1.0, swarm: true, stream: true, birds: true, embers: true };
let shotIsCloseUp = false;
let swarmShow = 1;
let desiredCamPos = new THREE.Vector3(0, 1.4, 4);
let desiredCamTarget = CAM_SHOTS.human.target.clone();
let camTransitionTime = 1.2;

// Slow in-shot moves layered on the solved shot. `base*` are the framed pose; the loop adds the offset for progress u (0..1 over the beat).
// A beat can override with `move: 'push'|'pull'|'orbit'|'orbitL'|'crane'|'none'`; otherwise defaultMoveFor() alternates push / pull.
const CAM_MOVES = {
  none:   (u, dir, out) => { out.scale = 1; out.yaw = 0; out.lift = 0; },
  push:   (u, dir, out) => { out.scale = 1 - 0.14 * u; out.yaw = 0; out.lift = 0; },
  pull:   (u, dir, out) => { out.scale = 0.9 + 0.12 * u; out.yaw = 0; out.lift = 0; },
  orbit:  (u, dir, out) => { out.scale = 1; out.yaw = THREE.MathUtils.degToRad(9 * u); out.lift = 0; },
  orbitL: (u, dir, out) => { out.scale = 1; out.yaw = THREE.MathUtils.degToRad(-9 * u); out.lift = 0; },
  crane:  (u, dir, out) => { out.scale = 1 - 0.06 * u; out.yaw = 0; out.lift = 0.22 * u; },
  hold:   (u, dir, out) => { out.scale = 1 + 0.03 * u; out.yaw = 0; out.lift = 0; } // body leans in: camera eases back a touch
};
let camMove = null; // { type, t, dur, basePos, baseTarget }
const camMoveOut = { scale: 1, yaw: 0, lift: 0 };
// Writes desiredCamPos for the active move at its current progress (camMove.t); used by the render loop and by hard cuts.
function updateCamMoveDesired() {
  if (!camMove) return;
  const u = Math.min(1, camMove.t / Math.max(0.5, camMove.dur));
  const e = u * u * (3 - 2 * u);
  CAM_MOVES[camMove.type](e, null, camMoveOut);
  const k = camOpts.moveAmt;
  const scale = (1 + (camMoveOut.scale - 1) * k) * camWiden, yaw = camMoveOut.yaw * k, lift = camMoveOut.lift * k;
  const ox = camMove.basePos.x - camMove.baseTarget.x, oy = camMove.basePos.y - camMove.baseTarget.y, oz = camMove.basePos.z - camMove.baseTarget.z;
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  desiredCamPos.set(
    camMove.baseTarget.x + (ox * cy + oz * sy) * scale,
    camMove.baseTarget.y + oy * scale + lift,
    camMove.baseTarget.z + (-ox * sy + oz * cy) * scale
  );
}
// Depth of field: focus distance chases the subject (so every cut racks focus), strength comes from the shot (close-ups shallower).
const camFocus = { dist: 2, override: null, strength: 1, snap: false }; // snap: jump focus on a hard cut instead of racking
// A beat can pull focus to a named point with `focus: 'george'|'witness'|'fire'` (e.g. hold on the listener while the other speaks).
const FOCUS_POINTS = {
  george:  new THREE.Vector3(-1.13, 1.22, 0.50),
  witness: new THREE.Vector3(1.02, 1.80, -0.20),
  fire:    new THREE.Vector3(0, 0.6, 0.35)
};
// Handheld sway: a few arcminutes of layered-sine rotation on the final camera (reset every frame by controls.update's lookAt).
let handheldAmt = new URLSearchParams(location.search).get('hand') === '0' ? 0 : 1;
function setHandheld(a) { handheldAmt = Math.max(0, +a || 0); }
let letterboxOn = new URLSearchParams(location.search).get('cine') === '1';
function setLetterbox(on) { letterboxOn = !!on; }
let dofEnabled =dofSupported && new URLSearchParams(location.search).get('dof') !== '0';
function setDof(on) { dofEnabled = !!on && dofSupported; }
let dofAmount = 0.15;                    // user multiplier on the per-shot DOF strength (Studio panel slider)
let moodExposure = 1, exposureTrim = 1;  // exposure = mood preset * user trim

canvas.addEventListener('pointerdown', () => {
  camTransitionTime = 0;
  camMove = null; // the user took the camera
});

const hemiLight = new THREE.HemisphereLight(0x7dd3fc, 0x1e1b18, 0.65);
scene.add(hemiLight);

const moonLight = new THREE.DirectionalLight(0xe0f2fe, 0.85);
moonLight.position.set(-6, 11, 7);
moonLight.castShadow = true;
moonLight.shadow.mapSize.set(2048, 2048);
moonLight.shadow.camera.near = 1;
moonLight.shadow.camera.far = 28;
moonLight.shadow.camera.left = -7;
moonLight.shadow.camera.right = 7;
moonLight.shadow.camera.top = 7;
moonLight.shadow.camera.bottom = -7;
moonLight.shadow.bias = -0.0005;
moonLight.shadow.normalBias = 0.03;
moonLight.shadow.radius = 3;
scene.add(moonLight);

// The hearth's place, shared by every file that needs the fire (pit, stone ring, fire light, shader glows).
// Studio episodes keep it at (-0.05, -0.28). Campfire Night (?camp) moves the whole pit CAMP_FIRE_SHIFT metres to the
// right as seen from George's stump (Nov 18 2026), so it sits off to the side rather than dead ahead.
const IS_CAMP = new URLSearchParams(location.search).has('camp');
const HEARTH = (function () {
  const x = -0.05, z = -0.28, seatX = -1.27, seatZ = 0.59, CAMP_FIRE_SHIFT = 0.5;
  if (!IS_CAMP) return { x, z, dx: 0, dz: 0 };
  const fx = x - seatX, fz = z - seatZ, l = Math.hypot(fx, fz);   // stump -> fire, flat
  const dx = -fz / l * CAMP_FIRE_SHIFT, dz = fx / l * CAMP_FIRE_SHIFT;   // that direction turned to the sitter's right
  return { x: x + dx, z: z + dz, dx, dz };
})();
const glslF = (v) => v.toFixed(3);   // a JS number as a GLSL float literal

const fireLight = new THREE.PointLight(0xff7b1c, 2.1, 11, 1.8); // steep falloff: a warm pool round the hearth, cool dusk beyond
fireLight.position.set(0 + HEARTH.dx, 0.82, 0.35 + HEARTH.dz);   // sits a little toward the camp from the pit's centre
fireLight.castShadow = true;
fireLight.shadow.bias = -0.001;
scene.add(fireLight);

const journalLight = new THREE.PointLight(0xfbbf24, 1.1, 5.5, 1.6);
journalLight.position.set(-1.05, 1.35, 0.42);
scene.add(journalLight);

const spiritLight = new THREE.PointLight(0x38bdf8, 2.2, 14, 1.4);
spiritLight.position.set(1.08, 1.75, -0.12);
scene.add(spiritLight);
