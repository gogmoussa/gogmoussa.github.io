// © 2026 George Moussa. All rights reserved.
// ---- 20F. FIST = LATITUDE ------------------------------------------------------
// Moment 5 (episodes/moments/fist_latitude_15s.json): a fist at arm's length covers about 10 degrees of sky, so the
// fists stacked from the horizon up to Polaris give its height, and Polaris's height is your latitude. Builds on the
// north sky in 20E (loads right after 20_moments.js) and changes nothing there.
// The count is George's own fist, seen from just behind his right shoulder (his right is north while he sits facing
// the fire): the camera stands at FL.cam and his fist is driven to FL.D in front of it, at the altitude the `fist` key
// says, so its size on screen is its real angle against the real sky. FL.handScale makes that angle FIST_DEG.
//   Cue { sky: { fist: 0..9 }, skySecs }  where his fist is: its bottom edge sits `fist` fists above the horizon
//                                          (0 = resting on the horizon, 4 = its middle on Polaris at latitude 45).
//                                          Every whole fist passed leaves a tick and its number.
//   Cue { sky: { half: 0..1 } }            "4½" lands on Polaris.
//   Cue { sky: { globe: 0..1 } }           the payoff: a globe with the equator, the pole and "you" at NSKY.lat.
//   Gesture "fist"                         the right arm up, hand closed, tracking the `fist` key.
// Console: IW.sky({ amt: 1, pol: 1, fist: 2 }, 0.5), IW.gesture('fist', 9), IW.sky({ globe: 1 }, 1).
const FIST_DEG = 10;
const FL = { cam: [-1.33, 1.05, 0.66], D: 0.5, handScale: 1.05, reach: 0.05, lift: -4 }; // reach: fist centre beyond the hand bone; lift: degrees, the
// hand bone sits below the middle of the fist as seen from FL.cam, so the target drops a little to centre the fist
NS_KEYS.push('fist', 'half', 'globe');

const FIST_R = { at: [52, 86, 30], pole: [50, 0, -30], rot: [0, 0, 1.4], curl: 1, thumb: 0.9 }; // rot: curled fingers towards the camera, so it reads as a fist
Object.assign(GESTURES, { fist: { widen: 1, R: FIST_R } });
if (typeof GESTURE_NAMES !== 'undefined' && !GESTURE_NAMES.includes('fist')) GESTURE_NAMES.push('fist');

const _flF = new THREE.Vector3(), _flC = new THREE.Vector3(), _flU = new THREE.Vector3(), _flP = new THREE.Vector3();
function fistAz() { const P = NSKY_NAMED[NSKY_IDX.Polaris]; return nskyAltAz(P[1], P[2], NSKY.lst)[1]; }
// Every frame while the gesture runs: aim the hand target (Hips space, x mirrored for the right side) at the fist's spot.
function fistTrack() {
  const on = activeGestures.some((g) => g.def === GESTURES.fist);
  const hand = humanBones && humanBones.mixamorigRightHand;
  if (hand) hand.userData.flScale = on ? FL.handScale : 1;
  if (!on || !humanBones.mixamorigHips) return;
  const f = nsAt('fist', performance.now()), alt = ((f + 0.5) * FIST_DEG + FL.lift) * Math.PI / 180;
  nskyDirAltAz(alt, fistAz(), _flU);
  _flP.fromArray(FL.cam).addScaledVector(_flU, FL.D - FL.reach);
  humanBones.mixamorigHips.worldToLocal(_flP);
  FIST_R.at[0] = -_flP.x; FIST_R.at[1] = _flP.y; FIST_R.at[2] = _flP.z;
  const b = momentNow && beats[curBeatIdx];
  if (b && b.fistCount) camFocus.override = _flF.fromArray(FL.cam).addScaledVector(_flU, FL.D); // focus on the fist, not the sky
}
// The hand's scale is set after the loop has posed it (the mixer may rewrite it), and put back otherwise.
function fistHandScale() {
  const hand = humanBones && humanBones.mixamorigRightHand; if (!hand) return;
  const s = hand.userData.flScale || 1;
  if (Math.abs(hand.scale.x - s) > 1e-4) { hand.scale.setScalar(s); hand.updateMatrixWorld(true); }
}
const _flAnimate = animate;
animate = function () { fistTrack(); _flAnimate(); fistHandScale(); };

// --- the overlay: horizon mark, a tick and number for every fist passed, "4½" on Polaris, the globe ---
function drawFistCount(ctx, W, H) {
  const now = performance.now(), amt = nsAt('amt', now), f = nsAt('fist', now), half = nsAt('half', now);
  const b = momentNow && beats[curBeatIdx];
  if (amt < 0.01 || !b || !b.fistCount) return; // only on the shots that measure (beat field `fistCount: true`)
  const az = fistAz(), at = (deg) => nskyScreen(nskyDirAltAz(deg * Math.PI / 180, az, _nsB), W, H);
  const m = Math.min(W, H), lw = Math.max(2, m * 0.0055), base = at(0);
  ctx.save(); ctx.lineCap = 'round'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.strokeStyle = '#fde68a'; ctx.shadowColor = '#fde68a';
  if (base) { // the horizon under Polaris: where the first fist starts
    ctx.globalAlpha = amt; ctx.lineWidth = lw; ctx.shadowBlur = lw * 3;
    ctx.beginPath(); ctx.moveTo(base[0] - m * 0.16, base[1]); ctx.lineTo(base[0] + m * 0.16, base[1]); ctx.stroke(); ctx.shadowBlur = 0;
    ctx.globalAlpha = amt * 0.85; nskyLabel(ctx, 'horizon', base[0] + m * 0.25, base[1], Math.round(m * 0.04), '#fde68a');
  }
  for (let k = 1; k <= Math.floor(f + 1e-3) && k <= 9; k++) { // the top of each fist passed
    const p = at(k * FIST_DEG); if (!p) continue;
    const age = Math.min(1, (f - k + 1e-3) / 0.3), pop = 1 + 0.5 * (1 - age);
    ctx.globalAlpha = amt * (1 - 0.6 * half); ctx.lineWidth = lw; ctx.strokeStyle = '#fde68a';
    ctx.beginPath(); ctx.moveTo(p[0] + m * 0.10, p[1]); ctx.lineTo(p[0] + m * 0.17, p[1]); ctx.stroke();
    ctx.save(); ctx.translate(p[0] + m * 0.23, p[1]); ctx.scale(pop, pop); nskyLabel(ctx, String(k), 0, 0, Math.round(m * 0.07), '#ffffff'); ctx.restore();
  }
  if (half > 0.01) { // the last fist covers Polaris at its middle: 4½
    const p = at(NSKY.lat);
    if (p) { ctx.globalAlpha = amt * half; nskyLabel(ctx, `${Math.round(NSKY.lat / FIST_DEG - 0.5)}½`, p[0] + m * 0.24, p[1], Math.round(m * 0.085 * (1 + 0.4 * (1 - half))), '#fde68a'); }
  }
  ctx.restore();
}
function drawGlobe(ctx, W, H) {
  const g = nsAt('globe', performance.now());
  if (g < 0.01) return;
  const m = Math.min(W, H), R = m * 0.27, cx = W / 2, cy = H * 0.47, lw = Math.max(2, m * 0.006);
  const lat = NSKY.lat * Math.min(1, Math.max(0, (g - 0.35) / 0.65)) * Math.PI / 180; // "you" climbs from the equator
  ctx.save(); ctx.globalAlpha = Math.min(1, g * 2.5); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const grad = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.35, R * 0.1, cx, cy, R);
  grad.addColorStop(0, '#2b5f8f'); grad.addColorStop(1, '#0b1f36');
  ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#bfe3ff'; ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  const ring = (la, col, w) => { // a line of latitude, seen a little from above
    const y = cy - R * Math.sin(la), rx = R * Math.cos(la), ry = rx * 0.22;
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.ellipse(cx, y, rx, ry, 0, 0, Math.PI); ctx.stroke();
    ctx.globalAlpha *= 0.35; ctx.beginPath(); ctx.ellipse(cx, y, rx, ry, 0, Math.PI, Math.PI * 2); ctx.stroke(); ctx.globalAlpha /= 0.35;
  };
  ring(0, '#bfe3ff', lw);
  if (lat > 0.01) ring(lat, '#fde68a', lw * 1.3);
  const fs = Math.round(m * 0.045);
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(cx, cy - R, lw * 2.2, 0, Math.PI * 2); ctx.fill();
  nskyLabel(ctx, 'North Pole', cx, cy - R - fs * 1.1, fs, '#ffffff');
  nskyLabel(ctx, 'Equator', cx, cy + R * 0.22 + fs * 0.9, Math.round(fs * 0.85), '#bfe3ff');
  const yy = cy - R * Math.sin(lat) + R * Math.cos(lat) * 0.22; // "you": front of the gold ring
  ctx.fillStyle = '#fbbf24'; ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = lw * 5;
  ctx.beginPath(); ctx.arc(cx, yy, lw * 3, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  if (g > 0.9) { ctx.globalAlpha = Math.min(1, (g - 0.9) / 0.1); nskyLabel(ctx, `You: ${NSKY.lat}° N`, cx + R * 0.62, yy - fs * 0.2, fs, '#fde68a'); }
  ctx.restore();
}
drawReelOverlay = function (ctx, W, H) { _stOverlay(ctx, W, H); drawNorthSky(ctx, W, H); drawFistCount(ctx, W, H); drawGlobe(ctx, W, H); drawCards(ctx, W, H); };
