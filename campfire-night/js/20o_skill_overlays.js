// © 2026 George Moussa. All rights reserved.
// ---- 20O. NIGHT SKILLS OVERLAYS -------------------------------------------------------
// Teaching pictures drawn over the sky for Night Skills reels (template: 20n). Each one is a cue; all run on the clock.
//   { trail: ["Dubhe", "Mizar"], trailCol: "#bfe3ff", trailSecs: 6 }
//       a trail for each star, from where it was when the cue fired to where it is now: grows while the sky spins
//       (sky key `spin`, 20E). A star ring marks each head.
//   { ring: 45, ringLabel: "never sets", ringCol: "#9fc4ff", ringSecs: 5 }
//       the circle of sky `ring` degrees round Polaris, drawn in over 0.8 s (at 45° N, ring 45 grazes the north horizon)
//   { scale: { left: "3,000 °C", right: "12,000 °C", cols: ["#ff8a4c", "#fff4e0", "#9fc4ff"], title: "",
//              pins: [{ at: 0.05, label: "Betelgeuse", col: "#ff9a5c" }] }, scaleSecs: 4, scaleY: 0.8 }
//       a colour bar with labelled pins that drop in one after another
//   { clock: "Dec 5 · 9:00 pm", clockSecs: 2 }    a small date-and-time plate under the series tag (a time-lapse's "when")
const SKO = { trails: [], rings: [], scales: [], clock: null };
const _skoCue = runCue;
runCue = function (c) {
  _skoCue(c);
  const now = performance.now();
  if (Array.isArray(c.trail)) SKO.trails.push({ stars: c.trail, lst0: NSKY.lst, col: c.trailCol || '#bfe3ff', t0: now, secs: c.trailSecs || 6 });
  if (typeof c.ring === 'number') SKO.rings.push({ r: c.ring, label: c.ringLabel || '', col: c.ringCol || '#9fc4ff', t0: now, secs: c.ringSecs || 5 });
  if (c.scale && typeof c.scale === 'object') SKO.scales.push(Object.assign({ t0: now, secs: c.scaleSecs || 4, y: c.scaleY }, c.scale));
  if (typeof c.clock === 'string') SKO.clock = { text: c.clock, t0: now, secs: c.clockSecs || 3 };
};
const _skoUnload = unloadMoment;
unloadMoment = function () { SKO.trails.length = 0; SKO.rings.length = 0; SKO.scales.length = 0; SKO.clock = null; _skoUnload(); };

function skoLife(o, now) { const t = (now - o.t0) / 1000; return t < 0 || t > o.secs ? -1 : t; }
function skoFade(o, t) { return Math.min(1, t / 0.3) * Math.min(1, (o.secs - t) / 0.3); }
function skoLine(ctx, pts, col, w, a) {
  if (pts.length < 2) return;
  ctx.globalAlpha = a; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.shadowColor = col; ctx.shadowBlur = w * 3;
  ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke(); ctx.shadowBlur = 0;
}
const _skoV = new THREE.Vector3();
function skoAt(ra, dec, lst, W, H) { const aa = nskyAltAz(ra, dec, lst); if (aa[0] < -0.02) return null; return nskyScreen(nskyDirAltAz(aa[0], aa[1], _skoV), W, H); }
function drawSkillOverlays(ctx, W, H) {
  const now = performance.now(), m = Math.min(W, H), lw = Math.max(2, m * 0.0045), amt = nsAt('amt', now);
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let i = SKO.trails.length - 1; i >= 0; i--) {
    const o = SKO.trails[i], t = skoLife(o, now); if (t < 0) { if (now > o.t0) SKO.trails.splice(i, 1); continue; }
    const a = skoFade(o, t) * amt, span = NSKY.lst - o.lst0, n = Math.max(2, Math.min(240, Math.ceil(Math.abs(span) * 20)));
    for (const name of o.stars) {
      const s = nskyRaDec(name); if (!s) continue;
      const pts = []; // break the line where the star is below the horizon or off screen
      for (let k = 0; k <= n; k++) { const p = skoAt(s[0], s[1], o.lst0 + span * k / n, W, H); if (p) pts.push(p); else { skoLine(ctx, pts, o.col, lw, 0.8 * a); pts.length = 0; } }
      skoLine(ctx, pts, o.col, lw, 0.8 * a);
    }
  }
  for (let i = SKO.rings.length - 1; i >= 0; i--) {
    const o = SKO.rings[i], t = skoLife(o, now); if (t < 0) { if (now > o.t0) SKO.rings.splice(i, 1); continue; }
    const a = skoFade(o, t) * amt, draw = Math.min(1, t / 0.8), pts = [], dec = 90 - o.r;
    let lab = null;
    for (let k = 0; k <= 120 * draw; k++) {
      const p = skoAt(k / 120 * 24, dec, 0, W, H); // sidereal time 0 and RA 0..24: the whole circle, which does not turn
      if (p) { pts.push(p); if (!lab || p[1] > lab[1]) lab = p; } else { ctx.setLineDash([lw * 3, lw * 2.4]); skoLine(ctx, pts, o.col, lw * 1.1, 0.9 * a); ctx.setLineDash([]); pts.length = 0; }
    }
    ctx.setLineDash([lw * 3, lw * 2.4]); skoLine(ctx, pts, o.col, lw * 1.1, 0.9 * a); ctx.setLineDash([]);
    if (o.label && lab && draw >= 1) { ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; const fs = Math.round(m * 0.05); ctx.font = `900 ${fs}px ${CAP_FONT}`; cardText(ctx, o.label, lab[0], lab[1] - m * 0.06, fs, o.col); }
  }
  for (let i = SKO.scales.length - 1; i >= 0; i--) {
    const o = SKO.scales[i], t = skoLife(o, now); if (t < 0) { if (now > o.t0) SKO.scales.splice(i, 1); continue; }
    const a = skoFade(o, t), w = W * 0.74, h = m * 0.03, x = (W - w) / 2, y = H * (typeof o.y === 'number' ? o.y : 0.8);
    const g = ctx.createLinearGradient(x, 0, x + w, 0), cols = o.cols || ['#ff8a4c', '#fff4e0', '#9fc4ff'];
    cols.forEach((c, k) => g.addColorStop(k / (cols.length - 1), c));
    ctx.globalAlpha = a; ctx.fillStyle = 'rgba(8, 10, 18, 0.7)'; skillRound(ctx, x - m * 0.03, y - m * 0.09, w + m * 0.06, h + m * 0.2, m * 0.02); ctx.fill();
    ctx.fillStyle = g; skillRound(ctx, x, y, w, h, h / 2); ctx.fill();
    const fs = Math.round(m * 0.032); ctx.font = `800 ${fs}px ${CAP_FONT}`; ctx.textBaseline = 'top';
    ctx.textAlign = 'left'; cardText(ctx, o.left || '', x, y + h + m * 0.015, fs, cols[0]);
    ctx.textAlign = 'right'; cardText(ctx, o.right || '', x + w, y + h + m * 0.015, fs, cols[cols.length - 1]);
    if (o.title) { ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; cardText(ctx, o.title, W / 2, y - m * 0.045, fs, '#ffffff'); }
    (o.pins || []).forEach((p, k) => {
      const tp = t - 0.5 - k * 0.6; if (tp < 0) return;
      const drop = Math.min(1, tp / 0.25), px = x + w * p.at, py = y - m * 0.012 - (1 - drop) * m * 0.04, fsP = Math.round(m * 0.04);
      ctx.globalAlpha = a * drop; ctx.fillStyle = p.col || '#ffffff';
      ctx.beginPath(); ctx.moveTo(px, py + m * 0.012); ctx.lineTo(px - m * 0.014, py - m * 0.012); ctx.lineTo(px + m * 0.014, py - m * 0.012); ctx.closePath(); ctx.fill();
      ctx.textAlign = p.at < 0.2 ? 'left' : p.at > 0.8 ? 'right' : 'center'; ctx.textBaseline = 'bottom'; ctx.font = `900 ${fsP}px ${CAP_FONT}`;
      cardText(ctx, p.label, px + (p.at < 0.2 ? -m * 0.014 : p.at > 0.8 ? m * 0.014 : 0), py - m * 0.018, fsP, p.col || '#ffffff');
    });
  }
  if (SKO.clock) {
    const o = SKO.clock, t = skoLife(o, now);
    if (t >= 0) { ctx.globalAlpha = skoFade(o, t); const fs = Math.round(m * 0.036); ctx.font = `800 ${fs}px ${CAP_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; cardText(ctx, o.text, W / 2, H * 0.18, fs, '#ffffff'); }
  }
  ctx.restore();
}
// drawSkillOverlays is called by 20n's overlay, under its star marks and guide cards.
// A clock that changes during a beat (a time-lapse across nights): IW.skillClock('Dec 15 · 9:00 pm') or a later cue.
if (window.IW) IW.skillClock = (text, secs) => { SKO.clock = { text, t0: performance.now(), secs: secs || 3 }; return SKO.clock; };
