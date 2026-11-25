// © 2026 George Moussa. All rights reserved.
// ============================================================================
// 11C. REEL CAPTIONS, HOOK TITLE, POSTER PNG & TAKE RECORDING
// ============================================================================
// One overlay drawer (drawReelOverlay) feeds both the live overlay canvas over the scene and every recorded
// frame, so what you see while directing is exactly what lands in the video.

// Caption options (Reel tab > Captions; persisted by 15_reel_studio.js)
//  style: 'karaoke' (words light up as they are spoken) | 'line' (whole line) | 'off'
//  pos: 'lower' | 'middle' | 'upper' · size: multiplier · speaker: name tag above the line
//  hook: show the episode hook big over the first seconds of beat 1 · handle: '@name' watermark ('' = none)
const capOpts = { style: 'karaoke', size: 1.0, pos: 'lower', speaker: true, hook: true, hookSecs: 3.0, handle: '' };
const CAP_FONT = '"Inter", "SF Pro Display", system-ui, -apple-system, "Helvetica Neue", sans-serif';
const SPEAKER_STYLE = {
  HUMAN:  { name: 'THE SEEKER',    accent: '#fbbf24' },
  SPIRIT: { name: 'THE WITNESS', accent: '#7dd3fc' }
};
let beatShownAt = performance.now(); // set by applyBeat; drives caption timing when no voice is playing

function currentEpisodeMeta() { return (typeof EPISODES !== 'undefined' && EPISODES[curEpisodeIdx]) || {}; }

// 0..1 through the spoken line: follows the real voice clip when one plays, else the reading time.
// -1 = the voice is still loading (show the first page with nothing lit yet).
function captionProgress(b) {
  const now = performance.now();
  if (lineVoice) return THREE.MathUtils.clamp((now - lineVoice.start) / 1000 / Math.max(0.3, lineVoice.dur), 0, 1);
  if (soundEnabled && speechActive) return -1;
  const speak = Math.max(0.8, beatDuration(b) - 0.9 / paceOpts.speed);
  return THREE.MathUtils.clamp((now - beatShownAt) / 1000 / speak, 0, 1);
}

// Word timing weights: longer words and punctuation pauses take more time.
function wordWeights(words) {
  return words.map((w) => w.length + 3 + (/[,;:—–-]$/.test(w) ? 3 : 0) + (/[.!?…]["']?$/.test(w) ? 6 : 0));
}

function wrapWords(ctx, words, maxW) {
  const lines = [];
  let line = [], width = 0;
  const space = ctx.measureText(' ').width;
  words.forEach((w, i) => {
    const ww = ctx.measureText(w).width;
    if (line.length && width + space + ww > maxW) { lines.push(line); line = []; width = 0; }
    width += (line.length ? space : 0) + ww;
    line.push(i);
  });
  if (line.length) lines.push(line);
  return lines;
}

// Caption pages: split the line into screen-sized chunks of near-equal width (breaking after punctuation when
// close), then lay each chunk out as one line or two balanced lines, so no page ends on a lonely word.
function layoutPages(ctx, words, maxW) {
  const sp = ctx.measureText(' ').width * 1.4;
  const ww = words.map((w) => ctx.measureText(w).width);
  const span = (a, b) => { let t = 0; for (let i = a; i < b; i++) t += ww[i] + (i > a ? sp : 0); return t; };
  const total = span(0, words.length);
  // Start from the width estimate and add pages until every page fits in two lines.
  let pages = null;
  for (let n = Math.max(1, Math.ceil(total / (maxW * 2 * 0.86))); n <= words.length; n++) {
    pages = layoutInto(n);
    if (pages.every((pg) => pg.length <= 2)) break;
  }
  return pages;

  function layoutInto(nPages) {
  const cuts = [0];
  for (let k = 1; k < nPages; k++) {
    const goal = (total * k) / nPages;
    let best = -1, bestScore = Infinity, acc = 0;
    for (let i = cuts[k - 1] + 1; i < words.length; i++) {
      acc = span(0, i);
      const off = Math.abs(acc - goal) / (total / nPages);
      if (off > 0.45) { if (acc > goal) break; continue; }
      const score = off - (/[,.;:!?…—–]["'”]?$/.test(words[i - 1]) ? 0.3 : 0);
      if (score < bestScore) { bestScore = score; best = i; }
    }
    if (best > cuts[k - 1]) cuts.push(best);
  }
  cuts.push(words.length);
  const pages = [];
  for (let k = 0; k < cuts.length - 1; k++) {
    const a = cuts[k], b = cuts[k + 1];
    const idx = (x, y) => Array.from({ length: y - x }, (_, j) => x + j);
    if (span(a, b) <= maxW * 0.92 || b - a < 3) { pages.push([idx(a, b)]); continue; }
    let split = -1, diff = Infinity;
    for (let i = a + 1; i < b; i++) {
      const w1 = span(a, i), w2 = span(i, b);
      if (w1 > maxW || w2 > maxW) continue;
      const d = Math.abs(w1 - w2) - (/[,.;:!?…—–]["'”]?$/.test(words[i - 1]) ? maxW * 0.08 : 0);
      if (d < diff) { diff = d; split = i; }
    }
    if (split > 0) pages.push([idx(a, split), idx(split, b)]);
    else { // very long words: fall back to greedy wrapping inside this chunk
      const sub = wrapWords(ctx, words.slice(a, b), maxW).map((ln) => ln.map((j) => j + a));
      pages.push(sub);
    }
  }
  return pages;
  }
}
// Caption tokens: words, with dash-joined phrases ("new—drones,") split after the dash so they can wrap.
function captionWords(text) {
  return text.trim().split(/\s+/).flatMap((w) => w.split(/(?<=[—–])(?=\S)/));
}

function drawCaption(ctx, W, H, b, vertical) {
  if (capOpts.style === 'off' || !b || !b.text) return;
  if ((currentEpisodeMeta().scene || {}).hookSolo && hookShowing()) return;
  const st = SPEAKER_STYLE[b.speaker] || SPEAKER_STYLE.HUMAN;
  const fs = Math.round(Math.min(W, H) * (vertical ? 0.062 : 0.05) * capOpts.size);
  const words = captionWords(b.text);
  ctx.font = `800 ${fs}px ${CAP_FONT}`;
  const pages = layoutPages(ctx, words, W * (vertical ? 0.84 : 0.7));
  const p = captionProgress(b);
  const weights = wordWeights(words);
  const total = weights.reduce((a, c) => a + c, 0);
  let cur = -1;
  if (p >= 0) {
    let acc = 0;
    cur = words.length - 1;
    for (let i = 0; i < words.length; i++) { acc += weights[i]; if (acc / total > p) { cur = i; break; } }
  }
  const page = Math.max(0, pages.findIndex((pg) => pg.some((ln) => ln.includes(Math.max(0, cur)))));
  const shown = pages[page];

  const lh = Math.round(fs * 1.22);
  const labelFs = Math.round(fs * 0.4);
  const labelH = capOpts.speaker ? Math.round(labelFs * 2.0) : 0;
  const blockH = labelH + shown.length * lh;
  const cy = H * ({ lower: vertical ? 0.715 : 0.8, middle: vertical ? 0.56 : 0.55, upper: vertical ? 0.24 : 0.2 }[capOpts.pos] || 0.715);
  const top = Math.round(cy - blockH / 2);
  const fade = Math.min(1, (performance.now() - beatShownAt) / 180);

  ctx.save();
  ctx.globalAlpha = fade;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  if (capOpts.speaker) {
    ctx.font = `800 ${labelFs}px ${CAP_FONT}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(labelFs * 0.22)}px`;
    const tw = ctx.measureText(st.name).width;
    ctx.fillStyle = 'rgba(4, 8, 18, 0.55)';
    const px = labelFs * 0.7, bh = labelFs * 1.55;
    ctx.beginPath();
    const bx = W / 2 - tw / 2 - px, by = top;
    if (ctx.roundRect) ctx.roundRect(bx, by, tw + px * 2, bh, bh / 2); else ctx.rect(bx, by, tw + px * 2, bh);
    ctx.fill();
    ctx.fillStyle = st.accent;
    ctx.textAlign = 'center';
    ctx.fillText(st.name, W / 2 + (ctx.letterSpacing ? labelFs * 0.11 : 0), by + bh * 0.72);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }
  ctx.font = `800 ${fs}px ${CAP_FONT}`;
  ctx.textAlign = 'left';
  const space = ctx.measureText(' ').width + fs * 0.1; // a touch wider: the outline stroke eats into word gaps
  shown.forEach((ln, li) => {
    const widths = ln.map((i) => ctx.measureText(words[i]).width);
    const lw = widths.reduce((a, c) => a + c, 0) + space * (ln.length - 1);
    let x = W / 2 - lw / 2;
    const y = top + labelH + (li + 1) * lh - lh * 0.24;
    ln.forEach((wi, k) => {
      const spoken = capOpts.style === 'line' || wi <= cur;
      const isCur = capOpts.style === 'karaoke' && wi === cur && p < 1;
      ctx.lineWidth = fs * 0.16;
      ctx.strokeStyle = 'rgba(2, 4, 10, 0.78)';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
      ctx.shadowBlur = fs * 0.35;
      ctx.globalAlpha = fade * (spoken ? 1 : 0.5);
      ctx.strokeText(words[wi], x, y);
      ctx.shadowBlur = 0;
      ctx.fillStyle = isCur ? st.accent : '#ffffff';
      ctx.fillText(words[wi], x, y);
      x += widths[k] + space;
    });
  });
  ctx.restore();
}

// Per-episode hook staging in epN.json `scene`: hookSecs (how long it stays, else the Reel tab's setting), hookY (0..1 from
// the top, else 0.2), hookSolo (true = no caption under it while it is up, so one block of text owns the first seconds).
function hookSecsNow() { const sc = currentEpisodeMeta().scene || {}; return typeof sc.hookSecs === 'number' ? sc.hookSecs : capOpts.hookSecs; }
function hookShowing() {
  const hook = (currentEpisodeMeta().hook || '').trim();
  return !!(capOpts.hook && hook && curBeatIdx === 0 && (performance.now() - beatShownAt) / 1000 <= hookSecsNow());
}
function drawHook(ctx, W, H, vertical) {
  const hook = (currentEpisodeMeta().hook || '').trim();
  if (!hookShowing()) return;
  const sc = currentEpisodeMeta().scene || {};
  const t = (performance.now() - beatShownAt) / 1000;
  const dur = hookSecsNow();
  // No fade-in: the hook is fully there on frame 1 (the cover frame, and the first thing a scrolling viewer sees)
  const a = Math.min(1, (dur - t) / 0.3);
  const pop = 1;
  const fs = Math.round(Math.min(W, H) * (vertical ? 0.082 : 0.062) * capOpts.size);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.font = `900 ${fs}px ${CAP_FONT}`;
  const words = hook.split(/\s+/);
  const lines = wrapWords(ctx, words, W * 0.84).slice(0, 3);
  const lh = fs * 1.12;
  const y0 = H * (typeof sc.hookY === 'number' ? sc.hookY : capOpts.pos === 'upper' && capOpts.style !== 'off' ? 0.6 : vertical ? 0.2 : 0.18); // stay clear of upper captions
  ctx.translate(W / 2, y0);
  ctx.scale(pop, pop);
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  lines.forEach((ln, i) => {
    const s = ln.map((k) => words[k]).join(' ');
    const y = i * lh;
    ctx.lineWidth = fs * 0.2;
    ctx.strokeStyle = 'rgba(2, 4, 10, 0.85)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = fs * 0.4;
    ctx.strokeText(s, 0, y);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(s, 0, y);
  });
  // accent underline that draws in
  const bw = W * 0.18 * Math.min(1, t / 0.6);
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(-bw / 2, (lines.length - 1) * lh + fs * 0.42, bw, Math.max(3, fs * 0.08));
  ctx.restore();
}

// End card: `scene.outro` in epN.json is a question drawn over the last beat from `scene.outroAt` seconds in (default 3),
// in the hook's place and style, a little smaller. It stays up until the reel ends, so the last frame asks for a comment.
function drawOutro(ctx, W, H, vertical) {
  const sc = currentEpisodeMeta().scene || {};
  const text = (sc.outro || '').trim();
  if (!capOpts.hook || !text || curBeatIdx !== beats.length - 1) return;
  const t = (performance.now() - beatShownAt) / 1000 - (typeof sc.outroAt === 'number' ? sc.outroAt : 3);
  if (t < 0) return;
  const fs = Math.round(Math.min(W, H) * (vertical ? 0.07 : 0.054) * capOpts.size);
  ctx.save();
  ctx.globalAlpha = Math.min(1, t / 0.5);
  ctx.font = `900 ${fs}px ${CAP_FONT}`;
  const words = text.split(/\s+/);
  const lines = wrapWords(ctx, words, W * 0.8).slice(0, 3);
  const lh = fs * 1.14;
  ctx.translate(W / 2, H * (capOpts.pos === 'upper' && capOpts.style !== 'off' ? 0.6 : vertical ? 0.2 : 0.18) + (1 - Math.min(1, t / 0.5)) * fs * 0.3);
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  lines.forEach((ln, i) => {
    const s = ln.map((k) => words[k]).join(' ');
    ctx.lineWidth = fs * 0.2;
    ctx.strokeStyle = 'rgba(2, 4, 10, 0.85)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = fs * 0.4;
    ctx.strokeText(s, 0, i * lh);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(s, 0, i * lh);
  });
  const bw = W * 0.18 * Math.min(1, t / 0.8);
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(-bw / 2, (lines.length - 1) * lh + fs * 0.42, bw, Math.max(3, fs * 0.08));
  ctx.restore();
}

// Curiosity loop: `scene.loop: { ask, answer, answerAt }` keeps one open question on screen as a small tag near the top
// from the moment the hook leaves, so a viewer who joins or drifts mid-reel still knows what is unresolved. On the last
// beat, `answerAt` seconds in (default 2), the tag flips to `answer` in the accent colour: the loop the hook opened closes.
// `steps` changes the question on later beats so the tag is not static.
let loopTagText = '', loopTagAt = 0; // what the tag last showed and when it changed (drives the pop)
function drawLoopTag(ctx, W, H, vertical) {
  const lp = (currentEpisodeMeta().scene || {}).loop;
  if (!capOpts.hook || !lp || !lp.ask || hookShowing()) return;
  const t = (performance.now() - beatShownAt) / 1000;
  const last = curBeatIdx === beats.length - 1;
  const since = last ? t - (typeof lp.answerAt === 'number' ? lp.answerAt : 2) : -1;
  const closed = since >= 0 && !!lp.answer;
  // `steps: [{ from: 4, ask: "..." }]` swaps the question as the story moves (from = 1-based beat); each swap pops once
  let ask = lp.ask;
  for (const st of (lp.steps || [])) if (st && st.ask && curBeatIdx + 1 >= st.from) ask = st.ask;
  const text = closed ? lp.answer : ask;
  if (text !== loopTagText) { loopTagText = text; loopTagAt = performance.now(); }
  const pop = Math.max(0, 1 - (performance.now() - loopTagAt) / 400);
  const fs = Math.round(Math.min(W, H) * (vertical ? 0.04 : 0.03) * capOpts.size * (1 + 0.28 * pop * pop));
  ctx.save();
  ctx.font = `800 ${fs}px ${CAP_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const tw = ctx.measureText(text).width, padX = fs * 0.7, h = fs * 1.75, w = tw + padX * 2;
  const x = W / 2, y = H * (vertical ? 0.125 : 0.09);
  ctx.globalAlpha = curBeatIdx === 0 ? Math.min(1, Math.max(0, (t - hookSecsNow()) / 0.3)) : 1;
  ctx.fillStyle = closed ? '#fbbf24' : 'rgba(6, 9, 18, 0.72)';
  ctx.beginPath();
  const r = h / 2;
  ctx.moveTo(x - w / 2 + r, y - r); ctx.lineTo(x + w / 2 - r, y - r); ctx.arc(x + w / 2 - r, y, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(x - w / 2 + r, y + r); ctx.arc(x - w / 2 + r, y, r, Math.PI / 2, Math.PI * 1.5); ctx.closePath();
  ctx.fill();
  if (!closed) { ctx.lineWidth = Math.max(2, fs * (0.06 + 0.1 * pop)); ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)'; ctx.stroke(); }
  ctx.fillStyle = closed ? '#0a0d16' : '#ffffff';
  ctx.fillText(text, x, y + fs * 0.04);
  ctx.restore();
}

function drawHandle(ctx, W, H, vertical) {
  const h = (capOpts.handle || '').trim();
  if (!h) return;
  const fs = Math.round(Math.min(W, H) * (vertical ? 0.03 : 0.024));
  ctx.save();
  ctx.font = `700 ${fs}px ${CAP_FONT}`;
  ctx.textAlign = 'center';
  ctx.globalAlpha = 0.62;
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = fs * 0.5;
  ctx.fillText(h.startsWith('@') ? h : '@' + h, W / 2, H * (vertical ? 0.78 : 0.94));
  ctx.restore();
}

function drawReelOverlay(ctx, W, H) {
  const vertical = H > W;
  drawHook(ctx, W, H, vertical);
  drawOutro(ctx, W, H, vertical);
  drawLoopTag(ctx, W, H, vertical);
  drawCaption(ctx, W, H, beats[curBeatIdx], vertical);
  drawHandle(ctx, W, H, vertical);
}

// Live overlay canvas sits over the WebGL canvas (pointer-events: none), at the same CSS size.
const overlayCanvas = document.getElementById('overlay-canvas');
const overlayCtx = overlayCanvas ? overlayCanvas.getContext('2d') : null;
function drawLiveOverlay() {
  if (!overlayCtx) return;
  const r = canvas.getBoundingClientRect();
  const pr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(1, Math.round(r.width * pr)), h = Math.max(1, Math.round(r.height * pr));
  if (overlayCanvas.width !== w || overlayCanvas.height !== h) { overlayCanvas.width = w; overlayCanvas.height = h; }
  overlayCtx.clearRect(0, 0, w, h);
  if (take && take.phase === 'prep') return;
  if (!autoPlay && document.body.classList.contains('explore')) return; // roaming: captions only while the story plays
  drawReelOverlay(overlayCtx, w, h);
}

// fresh: the canvas was composited in this same task (the frame loop). Otherwise redraw the composite from sceneRT first:
// the canvas does not keep its pixels between frames (preserveDrawingBuffer is off, see 03).
function drawBroadcastFrame(ctx, W, H, fresh) {
  if (!fresh) { renderer.setRenderTarget(null); renderer.render(compositeScene, postCam); }
  ctx.drawImage(canvas, 0, 0, W, H);
  drawReelOverlay(ctx, W, H);
}

function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
function stamp() {
  const d = new Date(), z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}`;
}
function setReelStatus(msg) {
  const el = document.getElementById('reel-status');
  if (el) el.textContent = msg;
}
// Save next to the episode via serve.py; fall back to a browser download (plain http.server, file://, older serve.py).
function saveMediaFile(endpoint, blob, name, label) {
  fetch(`/api/${endpoint}/${name}`, { method: 'POST', body: blob })
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((j) => setReelStatus(`${label} saved → ${j.saved}`))
    .catch(() => { downloadBlob(blob, name); setReelStatus(`${label} downloaded: ${name}`); });
}

function capturePosterPNG() {
  const c = document.createElement('canvas');
  c.width = canvas.width; c.height = canvas.height;
  drawBroadcastFrame(c.getContext('2d'), c.width, c.height);
  c.toBlob((blob) => {
    if (!blob) return;
    saveMediaFile('save-shot', blob, `inner-work-ep${curEpisodeIdx + 1}-beat${curBeatIdx + 1}-${stamp()}.png`, 'Still');
  }, 'image/png');
}

// --- Takes -------------------------------------------------------------------
// Export options (Reel tab > Export; persisted by 15_reel_studio.js)
//  quality: '1080' | '720' | 'screen' · fps: 30 | 60 · fmt: 'mp4' | 'webm' · sound: record voice + ambience
const exportOpts = { quality: '1080', fps: 30, fmt: 'mp4', sound: true };
let reelRecorder = null, reelCanvas = null, reelCtx = null, reelChunks = [];
let take = null; // { phase: 'prep'|'rec'|'tail', auto, startedAt, tailAt, prevPR, dest, mime, ext }

function pickMime() {
  const mp4 = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4'];
  const webm = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  const order = exportOpts.fmt === 'webm' ? webm.concat(mp4) : mp4.concat(webm);
  return order.find((m) => MediaRecorder.isTypeSupported(m)) || '';
}

// Render the take at an exact output size (even dimensions, as H.264 needs): 1080×1920 / 720×1280 for 9:16,
// 1920×1080 / 1280×720 for 16:9, or the current canvas size rounded to even for 'screen'.
function setTakeResolution(on) {
  const body = document.body;
  if (on) {
    take.prevPR = renderer.getPixelRatio();
    const vertical = body.classList.contains('vertical');
    if (!vertical) body.classList.add('frame169'); // takes in cinema mode are a true 16:9
    const short = exportOpts.quality === '720' ? 720 : 1080;
    let size = vertical ? [short, Math.round(short * 16 / 9)] : [Math.round(short * 16 / 9), short];
    if (exportOpts.quality === 'screen') size = [canvas.width & ~1, canvas.height & ~1];
    renderSizeOverride = size;
  } else {
    body.classList.remove('frame169');
    renderSizeOverride = null;
    if (take && take.prevPR) renderer.setPixelRatio(take.prevPR);
  }
  resizeRenderer();
}

function withTimeout(p, ms) { return Promise.race([p, new Promise((res) => setTimeout(() => res(null), ms))]); }

// Fetch every voice line before rolling so the take never waits on generation mid-reel.
async function prepareVoices() {
  if (!soundEnabled || !location.protocol.startsWith('http')) return;
  let done = 0;
  setReelStatus(`Preparing voices 0/${beats.length}…`);
  await Promise.all(beats.map((b) => withTimeout(voiceboxClip(b), 90000).then((buf) => {
    done++;
    setReelStatus(`Preparing voices ${done}/${beats.length}…`);
    return buf;
  })));
}

function updateTakeUI() {
  const btn = document.getElementById('btn-take');
  if (btn) {
    btn.textContent = take ? (take.phase === 'prep' ? '… Preparing' : '⏹ Stop Take (R)') : '🔴 Record Take (R)';
    btn.classList.toggle('on', !!take);
  }
  const rec = document.getElementById('btn-record');
  if (rec) { rec.textContent = take && !take.auto ? '⏹ Stop Recording' : '⏺ Free Record'; rec.classList.toggle('on', !!(take && !take.auto)); }
  document.body.classList.toggle('recording', !!take);
}

// auto = true: a full take (beat 1 to the end, auto-play, stops itself). false: free recording of whatever you do.
async function startTake(auto = true) {
  if (take) { stopTake(); return; }
  if (!window.MediaRecorder) { setReelStatus('This browser cannot record video (no MediaRecorder).'); return; }
  take = { phase: 'prep', auto };
  updateTakeUI();
  if (exportOpts.sound && !soundEnabled) toggleAudio();
  if (auto) {
    autoPlay = false; updateAutoPlayBtn();
    await prepareVoices();
    if (!take) return; // cancelled while preparing
  }
  setTakeResolution(true);
  await new Promise((r) => setTimeout(r, 160)); // let the new size land (a few frames)

  reelCanvas = document.createElement('canvas');
  reelCanvas.width = canvas.width; reelCanvas.height = canvas.height;
  reelCtx = reelCanvas.getContext('2d');
  drawBroadcastFrame(reelCtx, reelCanvas.width, reelCanvas.height);
  const stream = reelCanvas.captureStream(exportOpts.fps);
  if (soundEnabled && audioCtx && audioMaster) {
    take.dest = audioCtx.createMediaStreamDestination();
    audioMaster.connect(take.dest);
    take.dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
  }
  const mime = pickMime();
  take.ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
  const px = reelCanvas.width * reelCanvas.height;
  reelRecorder = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: px > 1.5e6 ? 16000000 : 9000000, audioBitsPerSecond: 192000 });
  reelChunks = [];
  reelRecorder.ondataavailable = (e) => { if (e.data && e.data.size) reelChunks.push(e.data); };
  const ep = curEpisodeIdx + 1, ext = take.ext, mimeType = mime || 'video/webm', label = auto ? 'Take' : 'Recording';
  reelRecorder.onstop = () => {
    const blob = new Blob(reelChunks, { type: mimeType.split(';')[0] });
    saveMediaFile('save-take', blob, `inner-work-ep${ep}-${stamp()}.${ext}`, label);
  };
  reelRecorder.start(500);
  take.phase = 'rec';
  take.startedAt = performance.now();
  updateTakeUI();
  if (auto) {
    applyBeat(0);
    camera.position.copy(desiredCamPos); // land on the first shot even in glide mode
    controls.target.copy(desiredCamTarget);
    camTransitionTime = 0;
    camFocus.snap = true;
    autoPlay = true; beatTimer = 0; updateAutoPlayBtn();
  }
  if (soundEnabled && voiceMode === 'browser') setReelStatus('⚠ Browser voice is not captured. Start Voicebox (or render voices) for voice in the take.');
  else setReelStatus(`Recording ${reelCanvas.width}×${reelCanvas.height} ${take.ext.toUpperCase()} @ ${exportOpts.fps}fps…`);
}

function stopTake() {
  if (!take) return;
  const t = take;
  if (t.phase === 'prep') { take = null; updateTakeUI(); setReelStatus('Take cancelled.'); return; }
  if (reelRecorder && reelRecorder.state !== 'inactive') reelRecorder.stop();
  if (t.dest && audioMaster) { try { audioMaster.disconnect(t.dest); } catch (e) {} }
  reelRecorder = null; reelCtx = null;
  if (t.auto) { autoPlay = false; updateAutoPlayBtn(); }
  setTakeResolution(false);
  take = null;
  updateTakeUI();
  setReelStatus('Encoding…');
}

// Free recording (old Record Reel button): records whatever happens until pressed again.
function toggleReelRecording() { if (take) stopTake(); else startTake(false); }

// Called by auto-play when the last beat finishes.
function onReelEnd() {
  if (take && take.auto && take.phase === 'rec') { take.phase = 'tail'; take.tailAt = performance.now(); return; }
  if (take) return;
  autoPlay = false;
  updateAutoPlayBtn();
}

function tickTake() {
  const hud = document.getElementById('rec-hud');
  if (!take) { if (hud) hud.style.display = 'none'; return; }
  if (take.phase === 'tail' && performance.now() - take.tailAt > 1100) { stopTake(); return; }
  if (hud) {
    hud.style.display = 'flex';
    if (take.phase === 'prep') hud.textContent = '… preparing take';
    else {
      const s = Math.floor((performance.now() - take.startedAt) / 1000);
      hud.textContent = `● REC ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} · beat ${curBeatIdx + 1}/${beats.length}`;
    }
  }
}

// Rehearse: play the whole reel from beat 1 without recording (stops at the end).
function playFromStart() {
  if (take) return;
  applyBeat(0);
  autoPlay = true; beatTimer = 0;
  updateAutoPlayBtn();
}
