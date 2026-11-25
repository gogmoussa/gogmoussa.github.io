// © 2026 George Moussa. All rights reserved.
// ---- 20N. NIGHT SKILLS --------------------------------------------------------------
// The template every Night Skills reel is built on (plan: episodes/NIGHT_SKILLS_SCHEDULE.md; how-to: README "Night Skills").
// A reel is a moment file (episodes/moments/ns<NN>_<name>.json, loaded with IW.moment) with one extra field:
//   skill: { n: 4, guide: "twinkle", topic: "Sky", lst: 0.7, when: "Dec 1, 8 pm" }
//     n      the series number, drawn as "NIGHT SKILLS #4" on every frame
//     guide  the Campfire Night field-guide page the reel teaches (js/camp/13_, 14_); tools/check_night_skills.py checks
//            that the reel's guide card carries that page's exact title and only sentences from its body
//     topic  the page's topic (Sky | Fire | Camp craft | Water | Night life | Night air): the card's colour
//     lst    sidereal time in hours for the star sky (20E), so the sky is the real one for the reel's date ("when")
//     moon   false = no moon disc in the sky (check the real moon for the date: it is part of the fact check)
// Cues this file adds (cue t is a fraction of the beat, fired 0.3 s early, as everywhere):
//   { guide: { title, body }, guideSecs: 4, guideY: 0.6 }   the field guide card, drawn like the game's (#cu-lesson)
//   { mark: "Saturn", markLabel: "steady", markSub: "", markCol: "#fde68a", markSecs: 3, markSide: "r" | "l" | "up" | "down" }
//       a ring and a label on any star or planet in 20E or 20G's catalogues
// Beat `aim` (20E) also takes any star or planet name, a compass point ("south", "southwest"...) and "a|b" (between two).
// Sound is mixed by episodes/moments/score_skill.py from the moment's own `sound` block (voice clips and effects).
const SKILL = { now: null, marks: [], cards: [] };
const SKILL_TOPIC_COL = { Sky: '#9fc4ff', Fire: '#ffb35c', 'Camp craft': '#ffb35c', Water: '#ffb35c', 'Night life': '#ffb35c', 'Night air': '#ffb35c', Safety: '#7fd18b' };
const SKILL_COMPASS = { north: 0, northeast: 45, east: 90, southeast: 135, south: 180, southwest: 225, west: 270, northwest: 315 };

// --- loading: the sky's time comes from the reel, and goes back to 20E's own when another moment or episode loads ---
const _skLoad = loadMoment;
loadMoment = async function (name) {
  SKILL.now = null; NSKY.lst0 = 20; // 20E's default (an early-September evening)
  const r = await _skLoad(name);
  if (r.error) return r;
  const m = await (await fetch(`episodes/moments/${name}.json?${Date.now()}`)).json();
  if (!m.skill) return r;
  SKILL.now = m.skill; SKILL.marks.length = 0; SKILL.cards.length = 0;
  skillMoon();
  if (typeof m.skill.lst === 'number') { NSKY.lst0 = NSKY.lst = m.skill.lst; applyBeat(0); } // re-aim beat 0 under the reel's own sky
  return Object.assign(r, { skill: m.skill.n, guide: m.skill.guide });
};
const _skUnload = unloadMoment;
unloadMoment = function () { if (SKILL.now) { if (SKILL.now.moon === false && _skMoonSave.lengthSq()) skyUniforms.uSunDir.value.copy(_skMoonSave); SKILL.now = null; NSKY.lst0 = 20; SKILL.marks.length = 0; SKILL.cards.length = 0; } _skUnload(); };

// --- sky: aim at any named star, a compass point, or between two; the extra stars show in a reel ---
const _skAimDir = nskyAimDir;
nskyAimDir = function (name, out) {
  if (typeof name === 'string' && name.includes('|')) {
    const [a, b] = name.split('|'), v = new THREE.Vector3();
    return out.copy(nskyAimDir(a, v)).add(nskyAimDir(b, new THREE.Vector3())).normalize();
  }
  if (SKILL_COMPASS[name] !== undefined) return nskyDirAltAz(8 * Math.PI / 180, SKILL_COMPASS[name] * Math.PI / 180, out);
  if (NSKY_IDX[name] === undefined && nskyRaDec(name)) return nskyDirAny(name, out);
  return _skAimDir(name, out);
};
// `skill.moon: false` takes the moon out of the sky dome (the mood's "sun" disc): on Dec 1 2026 it rises near midnight.
// The mood's light stays as it is; only the disc and its glow go below the horizon.
const _skMoonSave = new THREE.Vector3();
function skillMoon() {
  if (!SKILL.now || SKILL.now.moon !== false) return;
  const d = skyUniforms.uSunDir.value; if (d.y > -0.3) { _skMoonSave.copy(d); d.set(d.x, -0.4, d.z).normalize(); }
}
const _skMood = applyMood;
applyMood = function () { const r = _skMood.apply(this, arguments); skillMoon(); return r; };
const _skPre = nskyPre;
nskyPre = function () {
  _skPre();
  if (SKILL.now || window.Camp) nskyExtraPts.visible = nskyPoints.visible; // camp/62 also sets it, every frame
  else nskyExtraPts.visible = false;
};

// --- cues ---
const _skCue = runCue;
runCue = function (c) {
  _skCue(c);
  const now = performance.now();
  if (c.guide && typeof c.guide === 'object') SKILL.cards.push({ title: String(c.guide.title || ''), body: String(c.guide.body || ''), t0: now, secs: c.guideSecs || 4, y: c.guideY, safety: !!c.guide.safety });
  if (typeof c.mark === 'string' && c.mark) SKILL.marks.push({ name: c.mark, label: c.markLabel || '', sub: c.markSub || '', col: c.markCol || '#fde68a', t0: now, secs: c.markSecs || 3, side: c.markSide || 'r' });
};

// --- drawing, over the picture and the other overlays ---
function skillRound(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
}
function drawSkillTag(ctx, W, H) {
  const m = Math.min(W, H), fs = Math.round(m * 0.032), s = `NIGHT SKILLS #${SKILL.now.n}`;
  ctx.save(); ctx.font = `800 ${fs}px ${CAP_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(fs * 0.18)}px`;
  ctx.globalAlpha = 0.92; cardText(ctx, s, W / 2, H * (H > W ? 0.068 : 0.06), fs, '#fbbf24');
  ctx.restore();
}
function drawSkillMarks(ctx, W, H) {
  const now = performance.now(), m = Math.min(W, H), lw = Math.max(2, m * 0.005), v = new THREE.Vector3();
  for (let i = SKILL.marks.length - 1; i >= 0; i--) {
    const k = SKILL.marks[i], t = (now - k.t0) / 1000;
    if (t > k.secs || t < -30) { SKILL.marks.splice(i, 1); continue; }
    if (t < 0 || !nskyDirAny(k.name, v)) continue;
    const p = nskyScreen(v, W, H); if (!p) continue;
    const a = Math.min(1, t / 0.25) * Math.min(1, (k.secs - t) / 0.25), r = m * (0.034 + 0.03 * Math.max(0, 1 - t / 0.35));
    ctx.save(); ctx.globalAlpha = a * nsAt('amt', now);
    ctx.strokeStyle = k.col; ctx.lineWidth = lw; ctx.shadowColor = k.col; ctx.shadowBlur = lw * 4;
    ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0;
    if (k.label) {
      const fs = Math.round(m * 0.052), dx = { r: 1, l: -1, up: 0, down: 0 }[k.side] || 0, dy = { up: -1, down: 1 }[k.side] || 0;
      const x = p[0] + dx * m * 0.06, y = p[1] + dy * m * 0.08;
      ctx.textAlign = dx > 0 ? 'left' : dx < 0 ? 'right' : 'center'; ctx.textBaseline = 'middle';
      ctx.font = `900 ${fs}px ${CAP_FONT}`; cardText(ctx, k.label, x, y, fs, k.col);
      if (k.sub) { const f2 = Math.round(fs * 0.62); ctx.font = `700 ${f2}px ${CAP_FONT}`; cardText(ctx, k.sub, x, y + fs * 0.95, f2, '#ffffff'); }
    }
    ctx.restore();
  }
}
// The field guide card, drawn like the game's page toast (12_field_guide.js #cu-lesson): dark glass, a coloured left edge,
// "SKY · FIELD GUIDE", the page title, then the page text in warm grey.
function drawSkillCards(ctx, W, H) {
  const now = performance.now(), m = Math.min(W, H), vertical = H > W;
  for (let i = SKILL.cards.length - 1; i >= 0; i--) {
    const c = SKILL.cards[i], t = (now - c.t0) / 1000;
    if (t > c.secs || t < -30) { SKILL.cards.splice(i, 1); continue; }
    if (t < 0) continue;
    const a = Math.min(1, t / 0.35) * Math.min(1, (c.secs - t) / 0.3), slide = (1 - Math.min(1, t / 0.35)) * m * 0.03;
    const topic = c.safety ? 'Safety' : (SKILL.now.topic || 'Sky'), col = SKILL_TOPIC_COL[topic] || '#ffb35c';
    const w = W * (vertical ? 0.86 : 0.5), x = (W - w) / 2, pad = m * 0.045, fsL = Math.round(m * 0.028), fsT = Math.round(m * 0.058), fsB = Math.round(m * 0.04);
    ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = `500 ${fsB}px ${CAP_FONT}`;
    const words = c.body.split(/\s+/).filter(Boolean), lines = wrapWords(ctx, words, w - pad * 2).slice(0, 7);
    const h = pad * 2 + fsL * 1.2 + fsT * 1.35 + lines.length * fsB * 1.32;
    const y = H * (typeof c.y === 'number' ? c.y : vertical ? 0.6 : 0.55) + slide;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'; ctx.shadowBlur = m * 0.03;
    ctx.fillStyle = 'rgba(8, 10, 18, 0.78)'; skillRound(ctx, x, y, w, h, m * 0.022); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = col; ctx.fillRect(x, y + m * 0.012, Math.max(3, m * 0.007), h - m * 0.024);
    let yy = y + pad + fsL;
    ctx.font = `800 ${fsL}px ${CAP_FONT}`; if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(fsL * 0.14)}px`;
    ctx.fillStyle = col; ctx.fillText(`${topic.toUpperCase()} · FIELD GUIDE`, x + pad, yy);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    yy += fsT * 1.35; ctx.font = `800 ${fsT}px ${CAP_FONT}`; ctx.fillStyle = '#ffffff';
    const tw = ctx.measureText(c.title).width, room = w - pad * 2; // a long page title shrinks to fit the card
    if (tw > room) ctx.font = `800 ${Math.floor(fsT * room / tw)}px ${CAP_FONT}`;
    ctx.fillText(c.title, x + pad, yy);
    ctx.font = `500 ${fsB}px ${CAP_FONT}`; ctx.fillStyle = '#d9cbb4';
    lines.forEach((ln, k) => ctx.fillText(ln.map((j) => words[j]).join(' '), x + pad, yy + fsB * 1.32 * (k + 1)));
    ctx.restore();
  }
}
const _skOverlay = drawReelOverlay;
drawReelOverlay = function (ctx, W, H) {
  _skOverlay(ctx, W, H);
  if (!SKILL.now) return;
  if (typeof drawSkillOverlays === 'function') drawSkillOverlays(ctx, W, H); // 20o: trails, rings, scales, clock (under the marks and cards)
  drawSkillMarks(ctx, W, H); drawSkillCards(ctx, W, H); drawSkillTag(ctx, W, H);
};

if (window.IW) {
  IW.skill = () => (SKILL.now ? Object.assign({}, SKILL.now, { lst: +NSKY.lst.toFixed(3), marks: SKILL.marks.length, cards: SKILL.cards.length }) : null);
  IW.starAltAz = (name) => { const s = nskyRaDec(name); if (!s) return null; const aa = nskyAltAz(s[0], s[1], NSKY.lst); return { alt: +(aa[0] * 180 / Math.PI).toFixed(1), az: +((((aa[1] * 180 / Math.PI) % 360) + 360) % 360).toFixed(1) }; };
}
