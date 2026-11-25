// © 2026 George Moussa. All rights reserved.
// ============================================================================
// 15. REEL STUDIO: SETTINGS, LOOK PRESETS, BEAT EDITOR, PANEL BINDINGS
// ============================================================================
// Every Studio/Reel panel control writes into STUDIO (one object), which is applied to the engine objects
// (compositeMat uniforms, camOpts, sceneOpts, capOpts, audioOpts, paceOpts, exportOpts) and saved to
// localStorage, so the studio opens the way you left it. URL params (?mood, ?vert) still win on load.

const STUDIO_KEY = 'innerwork.studio.v1';
const STUDIO_DEFAULTS = {
  vertical: true,          // reels first
  mood: 0,
  guides: false,
  lookName: 'Cinematic',
  look: { bloom: 30, exposure: 100 },
  grade: { sat: 1.02, contrast: 0.34, warmth: 0.12, tint: 0.0, lift: 0.18, split: 1.5, vignette: 1.15, grain: 0.03, ca: 0.8 },
  lens: { dof: true, dofAmt: 0.3, handheld: 0.8, letterbox: false },
  cam: { cut: 'cut', glide: 3.0, moveAmt: 1.0, frame: 1.0, lens: 37, faceY: 0.36 },
  scene: { fire: 1.0, flies: 1.0, glow: 1.0, swarm: true, stream: true, birds: true, embers: true },
  cap: { style: 'karaoke', size: 1.0, pos: 'lower', speaker: true, hook: true, hookSecs: 3.0, handle: '' },
  audio: { voice: 1.0, amb: 0.7, bed: 'fire', chime: false },
  soundOn: false,          // last sound on/off choice (browsers still need a click to start audio)
  pace: { speed: 1.0, gap: 0.55 },
  export: { quality: '1080', fps: 30, fmt: 'mp4', sound: true },
  customLooks: {}
};

// Look presets: grade + lens feel. bloomAdd is relative to the mood's own bloom, so a look works in every mood.
const LOOKS = {
  'Cinematic':        { grade: { sat: 1.02, contrast: 0.34, warmth: 0.12, tint: 0.0, lift: 0.18, split: 1.5, vignette: 1.15, grain: 0.03, ca: 0.8 }, bloomAdd: 0, exposure: 100, dofAmt: 0.3, handheld: 0.8 },
  'Studio Original':  { grade: { sat: 1.04, contrast: 0.28, warmth: 0.0, tint: 0.0, lift: 0.0, split: 1.0, vignette: 1.0, grain: 0.028, ca: 1.0 }, bloomAdd: 0, exposure: 100, dofAmt: 0.15, handheld: 1.0 },
  'Dreamy Glow':      { grade: { sat: 0.92, contrast: 0.16, warmth: 0.22, tint: 0.06, lift: 0.45, split: 1.0, vignette: 0.8, grain: 0.02, ca: 0.6 }, bloomAdd: 28, exposure: 106, dofAmt: 0.55, handheld: 0.6 },
  'Crisp Clean':      { grade: { sat: 1.12, contrast: 0.3, warmth: 0.0, tint: 0.0, lift: 0.0, split: 0.5, vignette: 0.55, grain: 0.008, ca: 0.0 }, bloomAdd: -8, exposure: 102, dofAmt: 0.18, handheld: 0.4 },
  'Moody Teal':       { grade: { sat: 0.94, contrast: 0.46, warmth: -0.32, tint: -0.08, lift: 0.12, split: 2.4, vignette: 1.45, grain: 0.034, ca: 1.0 }, bloomAdd: 6, exposure: 92, dofAmt: 0.4, handheld: 1.0 },
  'Vintage Film':     { grade: { sat: 0.8, contrast: 0.3, warmth: 0.36, tint: 0.1, lift: 0.6, split: 1.2, vignette: 1.3, grain: 0.055, ca: 1.4 }, bloomAdd: 4, exposure: 98, dofAmt: 0.3, handheld: 1.3 },
  'Golden Warmth':    { grade: { sat: 1.1, contrast: 0.3, warmth: 0.45, tint: 0.04, lift: 0.1, split: 1.8, vignette: 1.1, grain: 0.025, ca: 0.7 }, bloomAdd: 10, exposure: 102, dofAmt: 0.35, handheld: 0.8 }
};

function deepMerge(base, over) {
  const out = Array.isArray(base) ? base.slice() : { ...base };
  if (!over || typeof over !== 'object') return out;
  Object.keys(over).forEach((k) => {
    const b = base ? base[k] : undefined, o = over[k];
    out[k] = b && typeof b === 'object' && !Array.isArray(b) && o && typeof o === 'object' ? deepMerge(b, o) : o;
  });
  return out;
}
let studioFromStorage = false;
function loadStudio() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(STUDIO_KEY) || 'null'); } catch (e) {}
  studioFromStorage = !!saved;
  return deepMerge(STUDIO_DEFAULTS, saved);
}
let STUDIO = loadStudio();
let studioSaveTimer = 0;
function saveStudio() {
  clearTimeout(studioSaveTimer);
  studioSaveTimer = setTimeout(() => { try { localStorage.setItem(STUDIO_KEY, JSON.stringify(STUDIO)); } catch (e) {} }, 150);
}
const getPath = (path) => path.split('.').reduce((o, k) => (o ? o[k] : undefined), STUDIO);
function setPath(path, v) {
  const ks = path.split('.');
  let o = STUDIO;
  for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]] = o[ks[i]] || {};
  o[ks[ks.length - 1]] = v;
}

// --- Apply STUDIO to the engine --------------------------------------------------
function applyGrade() {
  const u = compositeMat.uniforms, g = STUDIO.grade;
  u.uSat.value = g.sat; u.uContrast.value = g.contrast; u.uWarmth.value = g.warmth; u.uTint.value = g.tint;
  u.uLift.value = g.lift; u.uSplit.value = g.split; u.uVignette.value = g.vignette; u.uGrain.value = g.grain; u.uCA.value = g.ca;
}
function applyLookLevels() {
  onBloomSlider(STUDIO.look.bloom);
  onExposureSlider(STUDIO.look.exposure);
}
function applyLens() {
  if (dofEnabled !== !!STUDIO.lens.dof && dofSupported) toggleDof();
  dofAmount = STUDIO.lens.dofAmt;
  setHandheld(STUDIO.lens.handheld);
  if (letterboxOn !== !!STUDIO.lens.letterbox) toggleLetterbox();
}
function applyCam() {
  Object.assign(camOpts, { cut: STUDIO.cam.cut, glide: STUDIO.cam.glide, moveAmt: STUDIO.cam.moveAmt, frame: STUDIO.cam.frame, faceY: STUDIO.cam.faceY });
  const fov = THREE.MathUtils.radToDeg(2 * Math.atan(12 / STUDIO.cam.lens)); // full-frame 24 mm sensor height
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
}
// Scene multipliers sit on top of whatever the mood set, so they are re-applied after every mood change.
function applySceneAfterMood() {
  const m = MOODS[moodIdx];
  if (!m) return;
  flyMat.opacity = m.flies * STUDIO.scene.flies;
  const soft = natureOn && !m.spirit;
  spiritLight.intensity = (soft ? (m.witnessGlow || 0.85) : m.spirit ? 1.7 : 2.2) * STUDIO.scene.glow;
}
function applyScene() {
  Object.assign(sceneOpts, STUDIO.scene);
  applySceneAfterMood();
}
function applyOpts() {
  Object.assign(capOpts, STUDIO.cap);
  Object.assign(audioOpts, STUDIO.audio);
  applyAudioMix();
  paceOpts.speed = STUDIO.pace.speed; paceOpts.gap = STUDIO.pace.gap;
  Object.assign(exportOpts, STUDIO.export);
  exportOpts.fps = parseInt(STUDIO.export.fps, 10) || 30;
}
function applyFormat() {
  if (document.body.classList.contains('vertical') !== !!STUDIO.vertical) toggleVertical();
  document.body.classList.toggle('guides', !!STUDIO.guides);
  const g = document.getElementById('btn-guides');
  if (g) g.classList.toggle('on', !!STUDIO.guides);
}

// Wrap applyMood so scene multipliers and the bloom setting follow every mood change (L key, beats, transitions).
const _applyMoodBase = applyMood;
applyMood = function (i) {
  _applyMoodBase(i);
  STUDIO.look.bloom = Math.round(bloomStrength * 100);
  applySceneAfterMood();
  syncUI();
};

// --- Two-way panel bindings -------------------------------------------------------
const BIND_APPLY = {
  grade: applyGrade, look: applyLookLevels, lens: applyLens, cam: () => { applyCam(); resolveShotForBeat(beats[curBeatIdx]); },
  scene: applyScene, cap: (path) => { applyOpts(); if (path === 'cap.pos' || path === 'cap.style') resolveShotForBeat(beats[curBeatIdx]); }, audio: applyOpts, pace: () => { applyOpts(); updateRuntime(); renderBeatTimes(); }, export: applyOpts
};
function fmtVal(path, v) {
  if (path === 'cam.lens') return `${v}mm`;
  if (path === 'look.bloom' || path === 'look.exposure') return `${v}%`;
  if (path === 'pace.gap' || path === 'cap.hookSecs') return `${(+v).toFixed(2)}s`;
  if (typeof v === 'number') return Math.abs(v) < 0.1 && v !== 0 ? v.toFixed(3) : (+v).toFixed(2);
  return v;
}
function syncUI() {
  document.querySelectorAll('[data-bind]').forEach((el) => {
    const v = getPath(el.dataset.bind);
    if (v === undefined) return;
    if (el.type === 'checkbox') el.checked = !!v;
    else if (document.activeElement !== el) el.value = v;
  });
  document.querySelectorAll('[data-val]').forEach((el) => { el.textContent = fmtVal(el.dataset.val, getPath(el.dataset.val)); });
  document.querySelectorAll('[data-seg]').forEach((seg) => {
    const v = String(getPath(seg.dataset.seg));
    seg.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.v === v));
  });
  const ms = document.getElementById('mood-select');
  if (ms && document.activeElement !== ms) ms.value = String(moodIdx);
  const ls = document.getElementById('look-select');
  if (ls && document.activeElement !== ls) ls.value = STUDIO.lookName || '';
}
function onBound(path, v) {
  setPath(path, v);
  if (path.startsWith('grade.') || path.startsWith('look.') || path.startsWith('lens.')) STUDIO.lookName = ''; // edited away from the preset
  const fn = BIND_APPLY[path.split('.')[0]];
  if (fn) fn(path);
  syncUI();
  saveStudio();
}
document.querySelectorAll('[data-bind]').forEach((el) => {
  const path = el.dataset.bind;
  const read = () => (el.type === 'checkbox' ? el.checked : el.type === 'range' || el.type === 'number' ? parseFloat(el.value) : el.value);
  el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', () => onBound(path, read()));
});
document.querySelectorAll('[data-seg]').forEach((seg) => {
  seg.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const cur = getPath(seg.dataset.seg);
    onBound(seg.dataset.seg, typeof cur === 'number' ? parseFloat(b.dataset.v) : b.dataset.v);
  });
});

// Called by 13 after toggles that live outside the bindings (9:16, mood keys, DOF/letterbox buttons).
function studioChanged() {
  STUDIO.vertical = document.body.classList.contains('vertical');
  STUDIO.mood = moodIdx;
  STUDIO.lens.dof = dofEnabled;
  STUDIO.lens.letterbox = letterboxOn;
  syncUI();
  saveStudio();
}

// --- Looks -------------------------------------------------------------------------
function renderLookSelect() {
  const sel = document.getElementById('look-select');
  if (!sel) return;
  sel.innerHTML = '';
  const add = (label, value, group) => { const o = document.createElement('option'); o.value = value; o.textContent = label; group.appendChild(o); };
  const g1 = document.createElement('optgroup'); g1.label = 'Presets';
  Object.keys(LOOKS).forEach((k) => add(k, k, g1));
  sel.appendChild(g1);
  const customs = Object.keys(STUDIO.customLooks || {});
  if (customs.length) {
    const g2 = document.createElement('optgroup'); g2.label = 'My looks';
    customs.forEach((k) => add('★ ' + k, 'my:' + k, g2));
    sel.appendChild(g2);
  }
  const g3 = document.createElement('optgroup'); g3.label = '—';
  add('(custom, unsaved)', '', g3);
  sel.appendChild(g3);
}
function applyLookPreset(name) {
  if (!name) return;
  const custom = name.startsWith('my:') ? STUDIO.customLooks[name.slice(3)] : null;
  const L = custom || LOOKS[name];
  if (!L) return;
  STUDIO.grade = { ...STUDIO_DEFAULTS.grade, ...L.grade };
  STUDIO.look.bloom = custom ? L.bloom : Math.max(0, Math.round(MOODS[moodIdx].bloom + (L.bloomAdd || 0)));
  STUDIO.look.exposure = L.exposure;
  STUDIO.lens.dofAmt = L.dofAmt;
  STUDIO.lens.handheld = L.handheld;
  STUDIO.lookName = name;
  applyGrade(); applyLookLevels(); applyLens();
  syncUI();
  saveStudio();
}
function saveCustomLook() {
  const name = (prompt('Name this look:', 'My look') || '').trim();
  if (!name) return;
  STUDIO.customLooks[name] = { grade: { ...STUDIO.grade }, bloom: STUDIO.look.bloom, exposure: STUDIO.look.exposure, dofAmt: STUDIO.lens.dofAmt, handheld: STUDIO.lens.handheld };
  STUDIO.lookName = 'my:' + name;
  renderLookSelect(); syncUI(); saveStudio();
}
function deleteCustomLook() {
  const v = STUDIO.lookName || '';
  if (!v.startsWith('my:')) { alert('Pick one of your saved looks (★) to delete it.'); return; }
  delete STUDIO.customLooks[v.slice(3)];
  STUDIO.lookName = '';
  renderLookSelect(); syncUI(); saveStudio();
}

// --- Mood select -----------------------------------------------------------------
(function () {
  const sel = document.getElementById('mood-select');
  if (!sel) return;
  MOODS.forEach((m, i) => { const o = document.createElement('option'); o.value = i; o.textContent = `${i} · ${m.name}${m.spirit ? ' (spirit world)' : ''}`; sel.appendChild(o); });
})();
function setMoodFromUI(v) {
  applyMood(parseInt(v, 10));
  if (STUDIO.lookName && LOOKS[STUDIO.lookName]) applyLookPreset(STUDIO.lookName); // keep the look's bloom offset in the new mood
  studioChanged();
}

// --- Captions / guides shortcuts --------------------------------------------------
function cycleCaptionStyle() {
  const order = ['karaoke', 'line', 'off'];
  onBound('cap.style', order[(order.indexOf(STUDIO.cap.style) + 1) % order.length]);
}
function toggleGuides() {
  STUDIO.guides = !STUDIO.guides;
  applyFormat();
  saveStudio();
}

// --- Episode meta (Reel tab text) -------------------------------------------------
let scriptSaveTimer = 0;
function scheduleScriptSave() {
  const st = document.getElementById('beats-status');
  if (st) st.textContent = '● Unsaved changes…';
  clearTimeout(scriptSaveTimer);
  scriptSaveTimer = setTimeout(() => { saveScript(); populateScriptTextarea(); }, 1200);
}
function markBeatsSaved() {
  const st = document.getElementById('beats-status');
  if (st) st.textContent = `✓ Saved episodes/scripts/ep${curEpisodeIdx + 1}.json`;
}
function setEpisodeMeta(key, val) {
  EPISODES[curEpisodeIdx][key] = val;
  if (key === 'title') renderEpisodeList();
  scheduleScriptSave();
}
function syncEpisodeMeta() {
  const ep = EPISODES[curEpisodeIdx] || {};
  [['meta-title', 'title'], ['meta-hook', 'hook'], ['meta-caption', 'caption']].forEach(([id, k]) => {
    const el = document.getElementById(id);
    if (el && document.activeElement !== el) el.value = ep[k] || '';
  });
}

// --- Runtime estimate ----------------------------------------------------------------
function fmtTime(s) { s = Math.round(s); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
function updateRuntime() {
  const total = beats.reduce((a, b) => a + beatDuration(b), 0);
  const el = document.getElementById('hud-runtime');
  if (el) {
    el.textContent = `≈ ${fmtTime(total)}`;
    el.style.color = total > 90 ? '#fb7185' : total > 60 ? '#fbbf24' : '';
    el.title = `Estimated reel length ${fmtTime(total)} (reading time; voice may run a little longer). ${total > 90 ? 'Over 90s: consider trimming for Reels.' : ''}`;
  }
}

// --- Beat editor ---------------------------------------------------------------------
const OPT = {
  cam: [['human', 'George CU'], ['humanFace', 'George face'], ['spirit', 'Witness CU'], ['wide', 'Across flames'], ['across', 'Empty side'], ['pond', 'Pond'], ['top', 'High halo']],
  move: [['', 'Auto'], ['push', 'Push in'], ['pull', 'Pull out'], ['orbit', 'Orbit →'], ['orbitL', 'Orbit ←'], ['crane', 'Crane up'], ['none', 'Locked']],
  emote: [['', 'Auto'], ['idle', 'Calm'], ['agree', 'Nod / agree'], ['headShake', 'Head shake'], ['sad_pose', 'Slumped'], ['curious', 'Curious'], ['anxious', 'Anxious'], ['shame', 'Shame'], ['grief', 'Grief (head in hands)'], ['frustration', 'Frustrated'], ['surprise', 'Surprise'], ['hope', 'Hope (hand on heart)'], ['resolve', 'Resolve'], ['joy', 'Joy (arms open)'], ['peace', 'Peace']],
  focus: [['', 'Auto'], ['george', 'George'], ['witness', 'Witness'], ['fire', 'Fire']]
};
function optionsHtml(list, cur) {
  return list.map(([v, l]) => `<option value="${v}"${String(cur ?? '') === v ? ' selected' : ''}>${l}</option>`).join('');
}
function moodOptions(cur) {
  return `<option value=""${typeof cur !== 'number' ? ' selected' : ''}>Keep</option>` +
    MOODS.map((m, i) => `<option value="${i}"${cur === i ? ' selected' : ''}>${m.name}</option>`).join('');
}
function gestureOptions(cur) { // GESTURE_NAMES is built in 14 from GESTURES + WITNESS_GESTURES; an unknown authored name is kept
  const names = GESTURE_NAMES.includes(cur) || !cur ? GESTURE_NAMES : [cur, ...GESTURE_NAMES];
  return `<option value=""${!cur ? ' selected' : ''}>No gesture</option>` + names.map((n) => `<option value="${n}"${cur === n ? ' selected' : ''}>${n}</option>`).join('');
}
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
// Cues row editor: at (phrase) / feeling / mood / calm per cue. Other cue keys (gestureSecs, cam, move, focus, react…) are kept as authored.
function cueRowsHtml(b) {
  const warns = cueWarnings(b);
  const rows = (b.cues || []).map((c, ci) => {
    const bad = warns.some((w) => w.ci === ci);
    const extra = Object.keys(c).filter((k) => !['at', 't', 'emote', 'mood', 'coherence', 'gesture', 'fire', 'fireSecs'].includes(k)).map((k) => `${k}=${c[k]}`).join(' ');
    return `<div class="cue-row${bad ? ' bad' : ''}" data-ci="${ci}">
      <input class="mini" data-cue="at" placeholder="phrase in the line" value="${esc(c.at ?? (c.t != null ? '#' + c.t : ''))}" />
      <select class="mini" data-cue="emote" title="Feeling">${optionsHtml(OPT.emote, c.emote)}</select>
      <select class="mini" data-cue="gesture" title="Gesture (George's hands / head, Witness posture)">${gestureOptions(c.gesture)}</select>
      <select class="mini" data-cue="mood" title="Mood">${moodOptions(c.mood)}</select>
      <input class="mini" data-cue="coherence" type="number" min="0" max="100" placeholder="calm" title="Calm 0-100" value="${c.coherence ?? ''}" />
      <input class="mini" data-cue="fire" type="number" min="0" max="3" step="0.1" placeholder="fire" title="Fire swell (0.6 gentle, 1.2 big)" value="${c.fire ?? ''}" />
      <input class="mini" data-cue="fireSecs" type="number" min="0.5" max="6" step="0.1" placeholder="fire s" title="Seconds the fire holds its swell (default 1.5)" value="${c.fireSecs ?? ''}" />
      <button class="ib" data-act="cue-del" title="Remove cue">✕</button>
      ${extra ? `<span class="cue-extra" title="Kept as authored">${esc(extra)}</span>` : ''}
    </div>`;
  }).join('');
  return `<div class="beat-cues"><div class="cue-head"><span>Cues</span><button class="ib" data-act="cue-add" title="Add a cue on a phrase of this line">＋ cue</button></div>${rows}<div class="cue-warn" data-cuewarn>${warnHtml(warns)}</div></div>`;
}
function warnHtml(warns) { return warns.map((w) => `<div>⚠ ${esc(w.msg)}</div>`).join(''); }
function refreshCueWarn(i) {
  const card = document.querySelector(`.beat-card[data-i="${i}"]`);
  if (!card) return;
  const warns = cueWarnings(beats[i]);
  card.querySelector('[data-cuewarn]').innerHTML = warnHtml(warns);
  card.querySelectorAll('.cue-row').forEach((r) => r.classList.toggle('bad', warns.some((w) => w.ci === +r.dataset.ci)));
}
function pinKey() { return document.body.classList.contains('vertical') ? 'v' : 'l'; }

function renderBeatList() {
  const box = document.getElementById('beat-list');
  if (!box) return;
  box.innerHTML = beats.map((b, i) => {
    const spirit = b.speaker === 'SPIRIT';
    const pinned = b.pin && b.pin[pinKey()];
    return `<div class="beat-card${spirit ? ' spirit' : ''}${i === curBeatIdx ? ' current' : ''}" data-i="${i}">
      <div class="beat-head">
        <span class="beat-num">#${i + 1}</span>
        <button class="beat-who" data-act="who" title="Switch speaker">${spirit ? 'WITNESS' : 'GEORGE'}</button>
        <button class="ib" data-act="play" title="Play this beat">▶</button>
        <span class="beat-secs" data-secs="${i}">${beatDuration(b).toFixed(1)}s</span>
        <button class="ib" data-act="up" title="Move up">↑</button>
        <button class="ib" data-act="down" title="Move down">↓</button>
        <button class="ib" data-act="dup" title="Duplicate">⧉</button>
        <button class="ib" data-act="del" title="Delete">✕</button>
      </div>
      <textarea class="mini" rows="2" data-f="text">${esc(b.text)}</textarea>
      <div class="beat-grid">
        <label>Shot<select class="mini" data-f="cam">${optionsHtml(OPT.cam, b.cam)}</select></label>
        <label>Move<select class="mini" data-f="move">${optionsHtml(OPT.move, b.move)}</select></label>
        <label>Mood<select class="mini" data-f="mood">${moodOptions(b.mood)}</select></label>
        <label>George<select class="mini" data-f="emote">${optionsHtml(OPT.emote, b.emote)}</select></label>
        <label>Focus<select class="mini" data-f="focus">${optionsHtml(OPT.focus, b.focus)}</select></label>
        <label>Hold (s)<input class="mini" type="number" min="0" max="30" step="0.5" placeholder="auto" data-f="hold" value="${b.hold > 0 ? b.hold : ''}" /></label>
      </div>
      <div class="beat-coh"><span>Calm</span><input type="range" min="0" max="100" data-f="coherence" value="${b.coherence ?? 70}" /><span data-cohval>${b.coherence ?? 70}</span></div>
      ${cueRowsHtml(b)}
      <div class="beat-pin">
        <button class="btn" style="flex:1;padding:5px 8px;" data-act="pin" title="Drag the scene to frame a shot, then pin it to this beat">📌 Pin current camera</button>
        ${pinned ? '<span class="pinned">pinned</span><button class="ib" data-act="unpin" title="Back to the director shot">✕</button>' : ''}
      </div>
    </div>`;
  }).join('');
  updateRuntime();
}
function renderBeatTimes() {
  document.querySelectorAll('[data-secs]').forEach((el) => { const b = beats[+el.dataset.secs]; if (b) el.textContent = `${beatDuration(b).toFixed(1)}s`; });
}
function highlightBeat(i) {
  document.querySelectorAll('.beat-card').forEach((c) => c.classList.toggle('current', +c.dataset.i === i));
  const cur = document.querySelector(`.beat-card[data-i="${i}"]`);
  const pane = document.getElementById('pane-beats');
  if (cur && pane && pane.classList.contains('active') && !cur.contains(document.activeElement)) cur.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
// Live-update the beat on screen without re-speaking it.
function refreshCurrentBeat(field) {
  const b = beats[curBeatIdx];
  if (!b) return;
  if (field === 'text') document.getElementById('dialogue-text').textContent = dialogueLine(b);
  if (field === 'coherence') { onCoherenceSlider(b.coherence); document.getElementById('coherence-slider').value = b.coherence; }
  if (field === 'emote' || field === 'coherence') setEmote(b.emote || (b.coherence < 35 ? 'sad_pose' : 'idle'));
  if (field === 'mood' && typeof b.mood === 'number') transitionToMood(b.mood, 1.6);
  if (['cam', 'move', 'focus', 'pin', 'hold', 'text'].includes(field)) resolveShotForBeat(b);
}
function beatChanged(i, field, rerender) {
  if (i === curBeatIdx) refreshCurrentBeat(field);
  if (rerender) renderBeatList(); else { renderBeatTimes(); updateRuntime(); }
  scheduleScriptSave();
}
(function () {
  const box = document.getElementById('beat-list');
  if (!box) return;
  const idxOf = (el) => +el.closest('.beat-card').dataset.i;
  box.addEventListener('input', (e) => {
    const ck = e.target.dataset.cue;
    if (ck) {
      const i = idxOf(e.target), b = beats[i], c = b.cues[+e.target.closest('.cue-row').dataset.ci];
      let v = e.target.value;
      if (['mood', 'coherence', 'fire', 'fireSecs'].includes(ck)) v = v === '' || isNaN(parseFloat(v)) ? undefined : parseFloat(v);
      else if (v === '') v = undefined;
      if (ck === 'at' && v !== undefined && /^#[\d.]+$/.test(v)) { delete c.at; c.t = parseFloat(v.slice(1)); }
      else if (ck === 'at') { delete c.t; if (v === undefined) delete c.at; else c.at = v; }
      else if (v === undefined) delete c[ck]; else c[ck] = v;
      refreshCueWarn(i);
      beatChanged(i, 'cues', false);
      return;
    }
    const f = e.target.dataset.f;
    if (!f) return;
    const i = idxOf(e.target), b = beats[i];
    let v = e.target.value;
    if (f === 'coherence') { v = parseInt(v, 10); e.target.parentElement.querySelector('[data-cohval]').textContent = v; }
    if (f === 'mood') v = v === '' ? undefined : parseInt(v, 10);
    if (f === 'hold') v = parseFloat(v) > 0 ? parseFloat(v) : undefined;
    if ((f === 'move' || f === 'emote' || f === 'focus') && v === '') v = undefined;
    if (v === undefined) delete b[f]; else b[f] = v;
    beatChanged(i, f, false);
  });
  box.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const i = idxOf(btn), act = btn.dataset.act;
    if (act === 'play') { applyBeat(i); return; }
    if (act === 'cue-add' || act === 'cue-del') {
      const b = beats[i];
      if (act === 'cue-del') { b.cues.splice(+btn.closest('.cue-row').dataset.ci, 1); if (!b.cues.length) delete b.cues; }
      else {
        const w = (b.text || '').split(/\s+/);
        const k = Math.floor(w.length / 2);
        (b.cues = b.cues || []).push({ at: w.slice(k, k + 3).join(' ').replace(/[^\w' -]+$/, '') });
      }
      beatChanged(i, 'cues', true);
      return;
    }
    if (act === 'who') {
      const b = beats[i];
      b.speaker = b.speaker === 'SPIRIT' ? 'HUMAN' : 'SPIRIT';
      if (b.cam === 'human' || b.cam === 'spirit') b.cam = b.speaker === 'SPIRIT' ? 'spirit' : 'human';
      b.stateLabel = b.speaker === 'SPIRIT' ? 'State: Astral Witness' : 'State: Journal Reflection';
      if (i === curBeatIdx) applyBeat(i);
      beatChanged(i, 'speaker', true);
      return;
    }
    if (act === 'up' && i > 0) { [beats[i - 1], beats[i]] = [beats[i], beats[i - 1]]; if (curBeatIdx === i) curBeatIdx--; else if (curBeatIdx === i - 1) curBeatIdx++; }
    else if (act === 'down' && i < beats.length - 1) { [beats[i + 1], beats[i]] = [beats[i], beats[i + 1]]; if (curBeatIdx === i) curBeatIdx++; else if (curBeatIdx === i + 1) curBeatIdx--; }
    else if (act === 'dup') { beats.splice(i + 1, 0, JSON.parse(JSON.stringify(beats[i]))); }
    else if (act === 'del') {
      if (beats.length <= 1) return;
      if (!confirm(`Delete beat #${i + 1}?`)) return;
      beats.splice(i, 1);
      if (curBeatIdx >= beats.length) curBeatIdx = beats.length - 1;
    } else if (act === 'pin') {
      const b = beats[i];
      b.pin = b.pin || {};
      b.pin[pinKey()] = { p: camera.position.toArray().map((x) => +x.toFixed(3)), t: controls.target.toArray().map((x) => +x.toFixed(3)) };
      if (cameraMode !== 'auto') setCameraCut('auto');
      if (i === curBeatIdx) { camMove = null; } // keep exactly the framed angle on screen
      beatChanged(i, 'pin', true);
      document.getElementById('beats-status').textContent = `📌 Pinned this angle to beat #${i + 1} (${pinKey() === 'v' ? '9:16' : '16:9'})`;
      return;
    } else if (act === 'unpin') {
      const b = beats[i];
      if (b.pin) { delete b.pin[pinKey()]; if (!b.pin.v && !b.pin.l) delete b.pin; }
      beatChanged(i, 'pin', true);
      return;
    } else return;
    renderProgressSegments(); updateProgressBars();
    document.getElementById('hud-beat-label').textContent = `BEAT ${curBeatIdx + 1} / ${beats.length}`;
    beatChanged(i, 'order', true);
  });
})();
function addBeat() {
  const last = beats[beats.length - 1] || {};
  const speaker = last.speaker === 'SPIRIT' ? 'HUMAN' : 'SPIRIT';
  beats.push({ speaker, cam: speaker === 'SPIRIT' ? 'spirit' : 'human', coherence: Math.min(100, (last.coherence ?? 60) + 5), emote: 'idle',
    stateLabel: speaker === 'SPIRIT' ? 'State: Astral Witness' : 'State: Journal Reflection', text: 'New line…' });
  renderProgressSegments(); updateProgressBars();
  renderBeatList();
  scheduleScriptSave();
  const box = document.getElementById('beat-list');
  if (box && box.lastElementChild) { box.lastElementChild.scrollIntoView({ block: 'nearest' }); const ta = box.lastElementChild.querySelector('textarea'); if (ta) { ta.focus(); ta.select(); } }
}

// --- Hooks called from 13 ------------------------------------------------------------
function onBeatApplied(i) { highlightBeat(i); }
function onEpisodeLoaded() { renderBeatList(); syncEpisodeMeta(); updateRuntime(); }

// Voice status line (Reel tab): which voice the last line used and whether takes will capture it.
function updateVoiceStatus() {
  const el = document.getElementById('voice-status');
  if (!el) return;
  if (!soundEnabled) el.textContent = 'Sound off. Takes turn it on when "Voice + ambience" is ticked.';
  else if (voiceMode === 'voicebox') el.textContent = '✓ Voicebox / pre-rendered voice: captured in takes.';
  else if (voiceMode === 'browser') el.textContent = '⚠ Browser voice (Voicebox unreachable): heard live but NOT captured in takes.';
  else el.textContent = location.protocol.startsWith('http') ? 'Voice: Voicebox via serve.py' : 'Voice: browser (open over http for Voicebox)';
}

// --- Sound preference: remembered, resumed on the first click/key (browsers block audio until a gesture) ---
const _toggleAudioBase = toggleAudio;
toggleAudio = function () {
  _toggleAudioBase();
  STUDIO.soundOn = soundEnabled;
  saveStudio();
};
function armSoundResume() {
  if (!STUDIO.soundOn || soundEnabled) return;
  const btn = document.getElementById('btn-audio');
  if (btn) btn.textContent = '🔇 Sound (click or press any key to resume)';
  const go = (e) => {
    window.removeEventListener('pointerdown', go, true); window.removeEventListener('keydown', go, true);
    if (STUDIO.soundOn && !soundEnabled && !(e.type === 'keydown' && e.key.toLowerCase() === 'm')) toggleAudio();
    else if (btn && !soundEnabled) btn.textContent = '🔇 Sound (M)';
  };
  window.addEventListener('pointerdown', go, true); window.addEventListener('keydown', go, true);
}

// --- Disk copy of the settings (episodes/studio.json via serve.py): survives a cleared browser, shared across origins ---
function settingsStatus(msg) { const el = document.getElementById('settings-status'); if (el) el.textContent = msg; }
async function saveSettingsToDisk() {
  try {
    const r = await fetch('/api/save-settings/studio.json', { method: 'POST', body: JSON.stringify(STUDIO, null, 2) });
    if (!r.ok) throw new Error(r.status);
    settingsStatus('✓ Saved to ' + (await r.json()).saved);
  } catch (e) { settingsStatus('⚠ Save failed (open over http via serve.py; restart it if it predates this feature).'); }
}
async function loadSettingsFromDisk(announce) {
  try {
    const r = await fetch('/projects/inner_work_3d/episodes/studio.json', { cache: 'no-store' });
    if (!r.ok) throw new Error(r.status);
    STUDIO = deepMerge(STUDIO_DEFAULTS, await r.json());
    applyAll(); saveStudio(); armSoundResume();
    settingsStatus('✓ Loaded episodes/studio.json');
  } catch (e) { if (announce) settingsStatus('No saved settings file found (use Save settings first).'); }
}

function resetStudio() {
  if (!confirm('Reset all studio settings (look, camera, captions, sound, export) to the defaults? Your scripts and saved looks stay.')) return;
  const keep = STUDIO.customLooks;
  STUDIO = deepMerge(STUDIO_DEFAULTS, { customLooks: keep });
  applyAll();
  saveStudio();
}

// Cmd/Ctrl+S saves the script from anywhere in the studio.
window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); clearTimeout(scriptSaveTimer); saveScript(); populateScriptTextarea(); }
});

function applyAll() {
  const bloom = STUDIO.look.bloom; // applyMood resets bloom to the mood's own; keep the saved trim
  if (moodIdx !== STUDIO.mood) applyMood(STUDIO.mood);
  STUDIO.look.bloom = bloom;
  applyGrade();
  applyLookLevels();
  applyLens();
  applyCam();
  applyScene();
  applyOpts();
  applyFormat();
  renderLookSelect();
  syncUI();
  resolveShotForBeat(beats[curBeatIdx]);
}

// --- Boot: URL params win over saved settings ----------------------------------------
(function () {
  const q = new URLSearchParams(location.search);
  if (q.has('mood') && !isNaN(parseInt(q.get('mood'), 10))) STUDIO.mood = ((parseInt(q.get('mood'), 10) % MOODS.length) + MOODS.length) % MOODS.length;
  if (q.has('vert')) STUDIO.vertical = q.get('vert') === '1';
  if (q.get('dof') === '0') STUDIO.lens.dof = false;
  if (q.get('cine') === '1') STUDIO.lens.letterbox = true;
  if (q.has('hand')) STUDIO.lens.handheld = parseFloat(q.get('hand')) || 0;
  applyAll();
  armSoundResume();
  if (!studioFromStorage && location.protocol.startsWith('http') && !document.body.classList.contains('camp')) loadSettingsFromDisk(false); // the camp never reads the studio's saved file
  onEpisodeLoaded();
  setInterval(() => { syncUI(); updateVoiceStatus(); }, 500);
  updateVoiceStatus();
})();
