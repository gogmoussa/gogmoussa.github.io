// © 2026 George Moussa. All rights reserved.
// Initial mood (?mood=N). Lives here, not in 11b, because applyMood calls onBloomSlider, declared in this file.
{
  const q = new URLSearchParams(location.search);
  const mi = parseInt(q.get('mood'), 10);
  applyMood(!isNaN(mi) ? mi : 0);
}

// ============================================================================
// 13. UI & DIRECTOR CONTROLS
// ============================================================================
function renderProgressSegments() {
  const container = document.getElementById('reel-progress');
  container.innerHTML = '';
  beats.forEach((_, idx) => {
    const seg = document.createElement('div');
    seg.className = 'reel-seg';
    const fill = document.createElement('div');
    fill.className = 'reel-seg-fill';
    fill.id = `seg-fill-${idx}`;
    fill.style.width = idx < curBeatIdx ? '100%' : (idx === curBeatIdx && !autoPlay ? '100%' : '0%');
    seg.appendChild(fill);
    container.appendChild(seg);
  });
}

function updateProgressBars() {
  beats.forEach((_, idx) => {
    const fill = document.getElementById(`seg-fill-${idx}`);
    if (!fill) return;
    if (idx < curBeatIdx) fill.style.width = '100%';
    else if (idx > curBeatIdx) fill.style.width = '0%';
    else fill.style.width = autoPlay ? `${Math.min(100, (beatTimer / beatDuration()) * 100)}%` : '100%';
  });
}

let curEmotionShot = null; // the EMOTION_SHOT entry the camera is on right now (cues cut only when it changes enough)
function resolveShotForBeat(beat) {
  lastCamCutAt = performance.now();
  const key = cameraMode === 'auto' ? (beat.cam || 'wide') : cameraMode;
  const shot = CAM_SHOTS[key] || CAM_SHOTS.wide;
  // Explore fills the window whatever the reel format is, so it frames for the window (the Nov 14 robe-in-the-lens wide was a
  // 9:16 solve shown in a 4:3 view, on top of the axis problem fixed by the fitted wide).
  const isVert = document.body.classList.contains('vertical') && !document.body.classList.contains('explore');
  // A beat can carry a hand-placed angle per format (Beats tab > Pin angle): { v: {p, t}, l: {p, t} }
  const pin = cameraMode === 'auto' && beat.pin && beat.pin[isVert ? 'v' : 'l'];
  let s = isVert && shot.v ? Object.assign({}, shot, shot.v) : shot;
  if (shot.g && beat.speaker !== 'SPIRIT') s = Object.assign({}, s, shot.g, isVert && shot.g.v ? shot.g.v : null); // wide/top follow the speaker
  // George's own close-up takes its angle and framing from the feeling he is in (EMOTION_SHOT, 05_camera_lighting.js)
  let es = cameraMode === 'auto' && key === 'human' && !pin && EMOTION_SHOT[parseEmote(beat.emote).name];
  if (cameraMode === 'auto' && key === 'human' && !pin && beat.react && (!es || es.az < 90)) es = REACTION_SHOT; // reaction cut: face-readable
  if (es) s = Object.assign({}, s, { az: es.az, el: es.el, halfW: s.halfW * es.frame, halfH: s.halfH * es.frame });
  curEmotionShot = es || null;
  if (!isVert && s.lAz !== undefined) s.az = s.lAz; // 16:9 can see the fire further off-axis, which keeps the Witness out of George's frame
  const aspect = isVert ? 9 / 16 : (camera.aspect >= 1 ? camera.aspect : 16 / 9); // stale <1 right after leaving the reel
  // Alternate the orbit side on repeated shots of the same kind so back-to-back beats do not feel identical.
  const odd = curBeatIdx % 2 === 1;
  const swing = s.fit ? (odd ? 5 : -4) : (odd ? 16 : -10); // a fitted wide stays near its authored angle so no one is covered
  // alternate tight close-up / medium close-up so consecutive beats still read as a cut
  const ease = s.fit ? (odd ? 1.1 : 1) : (odd ? 1.5 : 1);
  const vt = camVfovTan();
  // A fitted shot solves its own look-at point and distance so every subject is in frame at this aspect.
  if (s.fit) { fitShot(WIDE_FIT, s.az + swing, s.el, aspect, _fitOut); s = Object.assign({}, s, { target: _fitOut.target, halfH: 1.0 }); }
  const dist = (s.fit ? _fitOut.dist : Math.max(s.halfH / vt, s.halfW / (vt * aspect))) * ease * camOpts.frame;
  const onGeorge = key === 'human' || key === 'humanFace' || (shot.g && beat.speaker !== 'SPIRIT' && key !== 'spirit');
  let azDeg = s.az + swing;
  if (onGeorge && !pin && key !== 'wide') {
    // Across-the-fire angles (az ~95-120) put the lens inside the Witness when the frame is loose: swing round the far side of him.
    const wdx = FOCUS_POINTS.witness.x - s.target.x, wdz = FOCUS_POINTS.witness.z - s.target.z;
    if (dist > Math.hypot(wdx, wdz) - 0.9) {
      const wAz = Math.atan2(wdx, wdz) * 180 / Math.PI;
      const d = ((azDeg - wAz + 540) % 360) - 180;
      if (Math.abs(d) < 20) azDeg = wAz + (d < 0 ? -20 : 20);
    }
  }
  const az = THREE.MathUtils.degToRad(azDeg), el = THREE.MathUtils.degToRad(s.el);
  desiredCamTarget.copy(s.target);
  desiredCamPos.set(
    s.target.x + Math.sin(az) * Math.cos(el) * dist,
    s.target.y + Math.sin(el) * dist - (odd ? 0.12 : 0),
    s.target.z + Math.cos(az) * Math.cos(el) * dist
  );
  // Captions on top push the eyes down the frame so the two never overlap.
  const faceY = capOpts.pos === 'upper' && capOpts.style !== 'off' ? Math.max(camOpts.faceY, 0.5) : camOpts.faceY;
  if (isVert && s.fit) {
    // A fitted wide fills the reel's width, so there is spare height: sit the group above the middle, clear of the captions.
    const drop = 0.16 * dist * vt;
    desiredCamTarget.y -= drop; desiredCamPos.y -= drop;
  } else if (isVert && faceY > 0 && !shot.noFace) {
    // Reel composition: slide the rig up/down so the speaker's face lands at camOpts.faceY from the top
    // (upper third), clear of the caption band, whatever the shot's authored look-at height.
    const georgeShot = key === 'human' || key === 'humanFace' || (shot.g && beat.speaker !== 'SPIRIT' && key !== 'spirit');
    const face = faceWorldPos(georgeShot ? 'george' : 'witness');
    if (face) {
      const h = dist * vt;                             // half-height of the frame at the subject
      const dy = face.y - desiredCamTarget.y;
      const drop = THREE.MathUtils.clamp((0.5 - faceY) * 2 * h - dy, -0.6 * h, 0.6 * h);
      desiredCamTarget.y -= drop;
      desiredCamPos.y -= drop;
    }
  }
  shotIsCloseUp = s.halfH < 0.9; // tells the render loop to fade the thought-swarm markers out
  if (pin) {
    desiredCamPos.fromArray(pin.p);
    desiredCamTarget.fromArray(pin.t);
    shotIsCloseUp = desiredCamPos.distanceTo(desiredCamTarget) < 2.6;
    s = Object.assign({}, s, { label: '📌 Shot: Pinned Angle' });
  }
  // Move priority: authored beat.move > mood-change camera beat > the feeling George is in (when the camera is on him) > parity.
  const em = cameraMode === 'auto' && onGeorge ? emotionMove(beat.emote) : null;
  const moodCam = pendingMoodCam; pendingMoodCam = null;
  const authored = beat.move && CAM_MOVES[beat.move];
  const moveType = authored ? beat.move : moodCam ? moodCam.type : em ? em.move
    : (cameraMode === 'auto' ? (odd ? 'pull' : 'push') : 'none'); // manual shot picks stay still
  const moveSecs = authored ? 0 : moodCam ? moodCam.secs : (em && em.secs) || 0;
  camMove = moveType === 'none' && camWiden === 1 ? null
    : { type: moveType, t: 0, dur: moveSecs || beatDuration(), basePos: desiredCamPos.clone(), baseTarget: desiredCamTarget.clone() };
  camFocus.strength = shotIsCloseUp ? 1.0 : 0.7;
  camFocus.override = (beat.focus && FOCUS_POINTS[beat.focus]) || null;
  camTransitionTime = 1.25;
  if (camOpts.cut === 'cut') {
    // Hard cut: land on the shot (at the start of its move) this frame, focus included
    updateCamMoveDesired();
    camera.position.copy(desiredCamPos);
    controls.target.copy(desiredCamTarget);
    camTransitionTime = 0;
    camFocus.snap = true;
  }
  document.getElementById('camera-shot-label').textContent = s.label;
}

// The feeling's camera move; a push becomes a held frame while his body is already leaning in (lean x intensity).
function emotionMove(spec) {
  const e = parseEmote(spec), m = EMOTION_MOVE[e.name];
  if (!m) return null;
  const lean = ((typeof EMOTIONS !== 'undefined' && EMOTIONS[e.name] && EMOTIONS[e.name].lean) || 0) * e.i;
  return m.move === 'push' && lean >= 0.08 ? { move: 'hold', secs: m.secs } : m;
}
// Swap the running move for another without a jump: the new move starts from where the camera is right now.
function retargetCamMove(type, secs) {
  const base = desiredCamPos.clone().sub(desiredCamTarget).divideScalar(camWiden).add(desiredCamTarget); // undo gesture widening
  camMove = { type, t: 0, dur: secs || beatDuration(), basePos: base, baseTarget: desiredCamTarget.clone() };
}
// Live eye line (head bone + measured offset), so reel framing follows the seated George and the floating Witness.
const _faceTmp = new THREE.Vector3();
function faceWorldPos(who) {
  const bones = who === 'george' ? humanBones : spiritBones;
  const head = bones && bones['mixamorigHead'];
  if (!head) return null;
  head.getWorldPosition(_faceTmp);
  _faceTmp.y += who === 'george' ? 0.03 : 0.08; // eyes above the head bone, measured on screen in 9:16
  return _faceTmp;
}

// The mood a beat starts in = the last mood set by any earlier beat (line-start or cue); Golden Hour if the script sets none yet.
function moodBeforeBeat(i) {
  let m = 0;
  for (let k = 0; k < i; k++) {
    if (typeof beats[k].mood === 'number') m = beats[k].mood;
    for (const c of (beats[k].cues || [])) if (typeof c.mood === 'number') m = c.mood;
  }
  return m;
}
function applyBeat(idx) {
  const prevIdx = curBeatIdx;
  curBeatIdx = (idx + beats.length) % beats.length;
  // Jumping (Prev, restart, episode load, autoplay wrap) must restore the mood the story is in at that point; moods otherwise
  // only change going forward, so going back from the Turn would leave Astral Twilight on the early beats.
  if (curBeatIdx !== prevIdx + 1 && beats.some((x) => typeof x.mood === 'number' || (x.cues || []).some((c) => typeof c.mood === 'number'))) {
    const want = moodBeforeBeat(curBeatIdx), now = moodTrans ? moodTrans.target : moodIdx;
    if (want !== now) { moodTrans = null; applyMood(want); }
  }
  beatTimer = 0;
  const b = beats[curBeatIdx];

  const card = document.getElementById('dialogue-card');
  const isSpirit = b.speaker === 'SPIRIT';
  card.className = `dialogue-card ${isSpirit ? 'speaker-spirit' : 'speaker-human'}`;
  document.getElementById('speaker-name').textContent = isSpirit
    ? '✨ THE ASTRAL WITNESS (SPIRIT)'
    : '👤 THE SEEKER (THE HUMAN)';
  document.getElementById('dialogue-text').textContent = dialogueLine(b);

  document.getElementById('hud-beat-label').textContent = `BEAT ${curBeatIdx + 1} / ${beats.length}`;
  document.getElementById('hud-state-pill').textContent = b.stateLabel || 'State: Inner Dialogue';
  const dot = document.getElementById('hud-dot');
  dot.style.background = isSpirit ? '#38bdf8' : '#fbbf24';
  dot.style.boxShadow = `0 0 10px ${isSpirit ? '#38bdf8' : '#fbbf24'}`;

  // moodSnap: set the mood outright (no whiteout, no mood camera beat); for the opening beat's starting mood
  // the fire's spirit colour snaps too, or a take after one that ended in the spirit world opens on a cyan fire
  if (typeof b.mood === 'number') { if (b.moodSnap) { moodTrans = null; applyMood(b.mood); fireSpiritCur = fireSpiritTarget; } else transitionToMood(b.mood, b.moodSecs); }

  if (typeof b.coherence === 'number') {
    onCoherenceSlider(b.coherence);
    document.getElementById('coherence-slider').value = b.coherence;
  }

  if (curBeatIdx !== prevIdx + 1) setHandHome(handHomeAtBeat(curBeatIdx), false); // jump: hands where linear playback has them
  setEmote(b.emote || (b.coherence < 35 ? 'sad_pose' : 'idle'));
  startBeatCues(b);
  onStoryBeat(curBeatIdx, prevIdx);

  resolveShotForBeat(b);
  renderProgressSegments();
  updateProgressBars();
  beatShownAt = performance.now();
  playChime(isSpirit);
  speakLineAfter(b, b.voiceDelay);
  if (typeof onBeatApplied === 'function') onBeatApplied(curBeatIdx);
}

function nextBeat(fromAuto = false) {
  if (!fromAuto && autoPlay) {
    autoPlay = false;
    updateAutoPlayBtn();
  }
  applyBeat(curBeatIdx + 1);
}

function prevBeat() {
  if (autoPlay) {
    autoPlay = false;
    updateAutoPlayBtn();
  }
  applyBeat(curBeatIdx - 1);
}

function toggleAutoPlay() {
  autoPlay = !autoPlay;
  beatTimer = 0;
  updateAutoPlayBtn();
  updateProgressBars();
}

function updateAutoPlayBtn() {
  const btn = document.getElementById('btn-autoplay');
  btn.textContent = autoPlay ? '⏸ Auto-Play: On' : '▶ Auto-Play: Off';
  btn.classList.toggle('on', autoPlay);
}

function setCameraCut(cut) {
  cameraMode = cut;
  ['auto', 'wide', 'human', 'humanFace', 'spirit', 'top'].forEach((k) => {
    const el = document.getElementById(`cam-${k}`);
    if (el) el.classList.toggle('active', k === cut);
  });
  resolveShotForBeat(beats[curBeatIdx]);
}

function onCoherenceSlider(val) {
  const num = parseFloat(val);
  targetCoherence = num / 100;
  const lbl = document.getElementById('coherence-label');
  lbl.textContent = `Coherence ${num}%`;
}

function onBloomSlider(val) {
  bloomStrength = parseFloat(val) / 100;
  compositeMat.uniforms.uBloomStrength.value = bloomStrength;
}

// Camera & Lens panel controls
function toggleDof() {
  if (!dofSupported) return;
  setDof(!dofEnabled);
  const b = document.getElementById('btn-dof');
  b.classList.toggle('on', dofEnabled);
  b.textContent = dofEnabled ? '🎯 DOF: On' : '🎯 DOF: Off';
  document.getElementById('dof-slider').disabled = !dofEnabled;
}
function onDofSlider(val) { dofAmount = parseFloat(val) / 100; }
function onExposureSlider(val) {
  exposureTrim = parseFloat(val) / 100;
  compositeMat.uniforms.uExposure.value = moodExposure * exposureTrim;
}
function onHandheldSlider(val) { setHandheld(parseFloat(val) / 100); }
function toggleLetterbox() {
  setLetterbox(!letterboxOn);
  const b = document.getElementById('btn-letterbox');
  b.classList.toggle('on', letterboxOn);
  b.textContent = letterboxOn ? '🎞 Letterbox: On' : '🎞 Letterbox: Off';
}
function syncLensControls() {
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
  set('handheld-slider', Math.round(handheldAmt * 100));
  const bd = document.getElementById('btn-dof');
  if (bd) {
    bd.classList.toggle('on', dofEnabled);
    bd.textContent = dofEnabled ? '🎯 DOF: On' : '🎯 DOF: Off';
    if (!dofSupported) { bd.disabled = true; bd.title = 'Needs WebGL2'; }
    document.getElementById('dof-slider').disabled = !dofEnabled;
  }
  const bl = document.getElementById('btn-letterbox');
  if (bl) {
    bl.classList.toggle('on', letterboxOn);
    bl.textContent = letterboxOn ? '🎞 Letterbox: On' : '🎞 Letterbox: Off';
  }
}
syncLensControls();

// Scripts edited in the Journal/Beats tabs are saved by serve.py to projects/inner_work_3d/episodes/scripts/epN.json
// as { title, hook, caption, scene, beats } (older saves are a bare beats array; both load).
const savedBeats = {};
const SCRIPT_URL = (i) => `episodes/scripts/ep${i + 1}.json`;
function setSaveStatus(msg) {
  const el = document.getElementById('save-status');
  if (el) el.textContent = msg;
}
function saveScript() {
  const epIdx = curEpisodeIdx;
  const ep = EPISODES[epIdx];
  savedBeats[epIdx] = beats.map((b) => ({ ...b }));
  const doc = Object.assign({ title: ep.title, hook: ep.hook || '', caption: ep.caption || '' }, ep.scene ? { scene: ep.scene } : {}, { beats });
  fetch(`/api/save-script/ep${epIdx + 1}.json`, { method: 'POST', body: JSON.stringify(doc, null, 2) })
    .then((r) => r.json())
    .then((j) => { setSaveStatus(`Saved → ${j.saved}`); if (typeof markBeatsSaved === 'function') markBeatsSaved(); })
    .catch(() => setSaveStatus('Not saved to disk: run via serve.py (polymath-static) on http://localhost:8765'));
}
function resetScript() {
  delete savedBeats[curEpisodeIdx];
  loadEpisode(curEpisodeIdx);
  setSaveStatus('Reverted to built-in script (saved file kept until you press Load & Save).');
}
// Campfire Night (?camp) has no episodes: skip the saved-script requests (on a published copy they are 404s in the console)
if (!document.body.classList.contains('camp')) EPISODES.forEach((_, i) => {
  fetch(SCRIPT_URL(i), { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((saved) => {
      const list = Array.isArray(saved) ? saved : (saved && Array.isArray(saved.beats) ? saved.beats : null);
      if (!list || !list.length) return;
      if (saved && !Array.isArray(saved)) ['title', 'hook', 'caption'].forEach((k) => { if (typeof saved[k] === 'string' && saved[k]) EPISODES[i][k] = saved[k]; });
      if (saved && saved.scene) EPISODES[i].scene = saved.scene;
      savedBeats[i] = list;
      renderEpisodeList();
      if (i === curEpisodeIdx) { beats = list.map((b) => ({ ...b })); loadStoryScene(EPISODES[i]); populateScriptTextarea(); applyBeat(Math.min(curBeatIdx, beats.length - 1)); }
    })
    .catch(() => {});
});

function renderEpisodeList() {
  const box = document.getElementById('episode-list');
  if (!box) return;
  box.innerHTML = '';
  EPISODES.forEach((ep, i) => {
    const btn = document.createElement('button');
    btn.className = 'ep-btn' + (i === curEpisodeIdx ? ' active' : '');
    btn.id = `ep-btn-${i}`;
    btn.textContent = ep.title;
    btn.onclick = () => loadEpisode(i);
    box.appendChild(btn);
  });
}
renderEpisodeList();

// The dialogue card: the spoken line in quotes, then the stage direction (never spoken or captioned) in brackets.
function dialogueLine(b) {
  const said = b.text ? `"${b.text}"` : '';
  return b.direction ? (said ? `${said}  [${b.direction}]` : `[${b.direction}]`) : said;
}
// voiceDelay (s): let a reveal play before the line starts. voicePending holds auto-advance (beatIsDone) through the wait.
let voiceDelayTimer = null, voicePending = false;
function speakLineAfter(b, secs) {
  clearTimeout(voiceDelayTimer); voicePending = false;
  if (!(secs > 0) || !b.text || !soundEnabled) { speakLine(b); return; }
  if (typeof stopVoicebox === 'function') stopVoicebox();
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  lineVoice = null; voicePending = true;
  const idx = curBeatIdx;
  voiceDelayTimer = setTimeout(() => { voicePending = false; if (curBeatIdx === idx && beats[idx] === b) speakLine(b); }, secs * 1000);
}
function loadEpisode(epIdx) {
  curEpisodeIdx = epIdx;
  EPISODES.forEach((_, i) => {
    const btn = document.getElementById(`ep-btn-${i}`);
    if (btn) btn.classList.toggle('active', i === epIdx);
  });
  beats = (savedBeats[epIdx] || EPISODES[epIdx].beats).map((b) => ({ ...b }));
  loadStoryScene(EPISODES[epIdx]);
  populateScriptTextarea();
  applyBeat(0);
  if (typeof onEpisodeLoaded === 'function') onEpisodeLoaded(epIdx);
}

// Script text format, one beat per line (a line without a speaker continues the beat above it):
//   TITLE: … / HOOK: … / CAPTION: …           episode meta (optional, top of the script)
//   GEORGE: line [cam:human] [move:push] [mood:3] [emote:agree] [focus:witness] [coherence:40] [hold:5]
//   WITNESS: line …                            (# starts a comment line)
//   mid-line cues, repeatable: [cue:phrase from the line > emote=shame@0.8 mood=3 moodSecs=3 coherence=60 cam=wide move=pull focus=fire]  (phrase `#0.4` = 40% into the line)
// cam: human | humanFace | spirit | wide | across | pond | top · move: push | pull | orbit | orbitL | crane | none
// mood: 0-4 or golden | dawn | dusk | astral | night · emote: idle | agree | headShake | sad_pose | curious | anxious | shame | grief | frustration | surprise | hope | resolve | joy | peace
const MOOD_ALIASES = { golden: 0, gold: 0, dawn: 1, misty: 1, mist: 1, dusk: 2, blue: 2, astral: 3, spirit: 3, twilight: 3, night: 4, moon: 4, moonlit: 4 };
const BEAT_TAGS = ['cam', 'move', 'mood', 'moodSnap', 'emote', 'focus', 'coherence', 'hold', 'voiceDelay', 'direction'];
function beatTags(b) {
  const tags = [`[cam:${b.cam || 'wide'}]`];
  if (b.move) tags.push(`[move:${b.move}]`);
  if (typeof b.mood === 'number') tags.push(`[mood:${b.mood}]`);
  if (typeof b.mood === 'number' && b.moodSnap) tags.push('[moodSnap:1]');
  if (b.emote) tags.push(`[emote:${b.emote}]`);
  if (b.focus) tags.push(`[focus:${b.focus}]`);
  tags.push(`[coherence:${b.coherence ?? 70}]`);
  if (b.hold > 0) tags.push(`[hold:${b.hold}]`);
  if (b.voiceDelay > 0) tags.push(`[voiceDelay:${b.voiceDelay}]`);
  if (b.direction) tags.push(`[direction:${b.direction}]`);
  for (const c of (b.cues || [])) tags.push(cueTag(c));
  return tags.join(' ');
}
const CUE_KEYS = ['emote', 'gesture', 'gestureSecs', 'mood', 'moodSecs', 'coherence', 'cam', 'move', 'focus', 'react', 'reactSecs', 'fire', 'fireSecs', 'reactDelay', 'fireLean', 'spark', 'tremble', 'stone', 'ripple', 'avoid', 'numb', 'judge'];
function cueTag(c) {
  const where = c.at ? c.at : `#${c.t ?? 0}`;
  return `[cue:${where} > ${CUE_KEYS.filter((k) => c[k] != null && c[k] !== '').map((k) => `${k}=${c[k]}`).join(' ')}]`;
}
// "[cue:Maybe I was afraid > emote=shame@0.8 mood=3]" -> { at, emote, mood }; mutates nothing, returns { cues, rest }
function extractCues(body) {
  const cues = [];
  const rest = body.replace(/\[cue\s*:\s*([^\]]*)\]/gi, (_, inner) => {
    const [where, args = ''] = inner.split(/\s>\s/);
    const c = {};
    const w = where.trim();
    if (/^#[\d.]+$/.test(w)) c.t = parseFloat(w.slice(1)); else if (w) c.at = w;
    args.trim().split(/\s+/).forEach((kv) => {
      const m = /^(\w+)=(.+)$/.exec(kv);
      if (!m || !CUE_KEYS.includes(m[1])) return;
      c[m[1]] = ['mood', 'moodSecs', 'gestureSecs', 'reactSecs', 'reactDelay', 'coherence', 'fire', 'fireSecs', 'fireLean', 'spark', 'tremble', 'avoid', 'numb', 'judge'].includes(m[1]) ? parseFloat(m[2]) : m[2];
    });
    if (c.at || c.t != null) cues.push(c);
    return '';
  });
  return { cues, rest };
}
function populateScriptTextarea() {
  const ep = EPISODES[curEpisodeIdx] || {};
  const head = [];
  if (ep.title) head.push(`TITLE: ${ep.title}`);
  if (ep.hook) head.push(`HOOK: ${ep.hook}`);
  if (ep.caption) head.push(`CAPTION: ${ep.caption}`);
  const lines = beats.map((b) => `${b.speaker === 'SPIRIT' ? 'WITNESS' : 'GEORGE'}: ${b.text} ${beatTags(b)}`);
  document.getElementById('script-textarea').value = (head.length ? head.join('\n') + '\n\n' : '') + lines.join('\n\n');
}

function parseScript(raw) {
  const meta = {};
  const rows = [];
  const lines = raw.split(/\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  const speakerRe = /^\**\s*(HUMAN|ME|GEORGE|SPIRIT|WITNESS|BEING|THE WITNESS|ASTRAL WITNESS)\s*\**\s*[:\-–—]\s*(.*)$/i;
  const anyPrefix = lines.some((l) => speakerRe.test(l));
  lines.forEach((line) => {
    const mMeta = line.match(/^(TITLE|HOOK|CAPTION)\s*:\s*(.+)$/i);
    if (mMeta) { meta[mMeta[1].toLowerCase()] = mMeta[2].trim(); return; }
    const m = line.match(speakerRe);
    if (m) {
      const k = m[1].toUpperCase();
      rows.push({ speaker: /SPIRIT|WITNESS|BEING/.test(k) ? 'SPIRIT' : 'HUMAN', body: m[2] });
    } else if (anyPrefix && rows.length) {
      rows[rows.length - 1].body += ' ' + line; // a wrapped line continues the beat above
    } else {
      rows.push({ speaker: rows.length % 2 === 0 ? 'HUMAN' : 'SPIRIT', body: line });
    }
  });

  const n = rows.length;
  const hasCoh = rows.some((r) => /\[coherence:/i.test(r.body));
  const spiritIdx = rows.map((r, i) => (r.speaker === 'SPIRIT' ? i : -1)).filter((i) => i >= 0);
  const parsed = [];
  rows.forEach((r, idx) => {
    const cx = extractCues(r.body);
    let body = cx.rest;
    const tag = (name) => {
      const mt = body.match(new RegExp(`\\[${name}\\s*:\\s*([^\\]]+)\\]`, 'i'));
      if (!mt) return null;
      body = body.replace(mt[0], '');
      return mt[1].trim();
    };
    const t = {};
    BEAT_TAGS.forEach((k) => { t[k] = tag(k); });
    body = body.replace(/\s{2,}/g, ' ').replace(/^["“'']|["”'']$/g, '').trim();
    if (!body && !t.direction) return; // a silent beat (stage direction only) still counts
    const isSpirit = r.speaker === 'SPIRIT';
    // Default arc: coherence climbs from anxious to luminous across the reel; George's lines sit a bit lower.
    const arc = n > 1 ? idx / (n - 1) : 1;
    const coherence = t.coherence != null ? Math.min(100, Math.max(0, parseInt(t.coherence, 10) || 0))
      : Math.round(Math.min(100, Math.max(10, 18 + arc * 82 - (isSpirit ? 0 : 8))));
    // Default shots: George in close-up, the Witness alternating close-up / across the flames, the last Witness line high on the halo.
    let cam = t.cam ? Object.keys(CAM_SHOTS).find((k) => k.toLowerCase() === t.cam.toLowerCase()) || null : null; // humanFace is camelCase
    if (!cam) {
      if (!isSpirit) cam = 'human';
      else {
        const k = spiritIdx.indexOf(idx);
        cam = k === spiritIdx.length - 1 && spiritIdx.length > 1 ? 'top' : (k % 2 === 0 ? 'spirit' : 'wide');
      }
    }
    const beat = { speaker: r.speaker, cam, coherence, text: body };
    beat.emote = t.emote || (isSpirit ? 'idle' : coherence < 35 ? 'sad_pose' : coherence >= 75 ? 'agree' : 'idle');
    if (t.move && CAM_MOVES[t.move]) beat.move = t.move;
    if (t.focus && FOCUS_POINTS[t.focus.toLowerCase()]) beat.focus = t.focus.toLowerCase();
    if (t.mood != null) {
      const mv = /^\d+$/.test(t.mood) ? parseInt(t.mood, 10) : MOOD_ALIASES[t.mood.toLowerCase()];
      if (mv != null && mv >= 0 && mv < MOODS.length) beat.mood = mv;
    }
    if (beat.mood != null && t.moodSnap != null && !/^(0|false|no)$/i.test(t.moodSnap)) beat.moodSnap = true;
    if (t.hold != null && parseFloat(t.hold) > 0) beat.hold = parseFloat(t.hold);
    if (t.voiceDelay != null && parseFloat(t.voiceDelay) > 0) beat.voiceDelay = parseFloat(t.voiceDelay);
    if (t.direction) beat.direction = t.direction;
    if (cx.cues.length) beat.cues = cx.cues;
    beat.stateLabel = isSpirit ? 'State: Astral Witness' : 'State: Journal Reflection';
    parsed.push(beat);
  });
  return { meta, beats: parsed, hasCoh };
}

function applyCustomScript() {
  const raw = document.getElementById('script-textarea').value.trim();
  if (!raw) return;
  const { meta, beats: parsed } = parseScript(raw);
  if (!parsed.length) return;
  // Keep pinned angles when a line is re-parsed with the same text
  parsed.forEach((p, i) => { const old = beats.find((b) => b.text === p.text && b.speaker === p.speaker); if (old && old.pin) p.pin = old.pin; });
  const ep = EPISODES[curEpisodeIdx];
  ['title', 'hook', 'caption'].forEach((k) => { if (meta[k]) ep[k] = meta[k]; });
  beats = parsed;
  renderEpisodeList();
  applyBeat(0);
  saveScript();
  if (typeof onEpisodeLoaded === 'function') onEpisodeLoaded(curEpisodeIdx);
}

function generateSceneFromRawJournal() {
  const inputEl = document.getElementById('raw-journal-input');
  const lensEl = document.getElementById('journal-lens-select');
  const raw = (inputEl && inputEl.value.trim()) ||
    "Today I kept comparing my progress to everyone online and lost my creative joy.";
  const lens = (lensEl && lensEl.value) || 'socratic';
  const cleaned = raw.replace(/^["']|["']$/g, '').trim();
  const firstSentence = (cleaned.split(/(?<=[.!?])\s+/)[0] || cleaned).slice(0, 180);

  const templates = {
    socratic: [
      `HUMAN: ${firstSentence} [cam:human] [coherence:22]`,
      `SPIRIT: Whose scoreboard are you using to measure a private curiosity? [cam:spirit] [coherence:52]`,
      `HUMAN: The loud one in my feed—where everything has to look finished, impressive, and monetizable immediately. [cam:human] [coherence:35]`,
      `SPIRIT: A seed cannot sprout if you dig it up every hour to compare its roots to someone else's harvest. [cam:wide] [coherence:76]`,
      `HUMAN: When I shut the noise out and focus on the craft in front of me, the tightness in my chest actually drops. [cam:human] [coherence:90]`,
      `SPIRIT: Stay with the work that makes you forget to check the applause. That is where your real voice lives. [cam:top] [coherence:100]`
    ],
    zen: [
      `HUMAN: ${firstSentence} [cam:human] [coherence:18]`,
      `SPIRIT: Notice how the mind spins a single observation into a storm of self-judgment. That whirlpool is Chitta Vritti. [cam:spirit] [coherence:56]`,
      `HUMAN: I keep trying to think my way out of the restlessness, and it only spins faster. [cam:human] [coherence:32]`,
      `SPIRIT: Do not fight the ripples with your hands. Let the breath lengthen until the water of attention clears on its own. [cam:wide] [coherence:82]`,
      `HUMAN: Beneath the urgency, the clearing is completely still. Nothing here is actually on fire. [cam:human] [coherence:92]`,
      `SPIRIT: Rest in the witness who sees the thought pass like wind over the pond. [cam:top] [coherence:100]`
    ],
    shadow: [
      `HUMAN: ${firstSentence} [cam:human] [coherence:24]`,
      `SPIRIT: What is the protective fear hiding underneath that frustration? [cam:spirit] [coherence:54]`,
      `HUMAN: That if I build purely what I love without a guarantee, I'll be seen as foolish or ordinary. [cam:human] [coherence:38]`,
      `SPIRIT: That part of you is only trying to keep you safe. Thank the guard at the gate, then invite the maker back to the fire. [cam:wide] [coherence:78]`,
      `HUMAN: I don't have to exile my ambition—I just don't want fear driving the studio. [cam:human] [coherence:90]`,
      `SPIRIT: When shadow and craft sit at the same hearth, nothing in you is wasted. [cam:top] [coherence:100]`
    ],
    maker: [
      `HUMAN: ${firstSentence} [cam:human] [coherence:26]`,
      `SPIRIT: Strip away the narrative for a moment. What is the next small physical thing your hands want to test? [cam:spirit] [coherence:58]`,
      `HUMAN: Just getting the light, the motion, and the mechanics to feel honest and alive on screen. [cam:human] [coherence:48]`,
      `SPIRIT: Craft is the antidote to existential static. One honest iteration teaches more than a hundred hours of rumination. [cam:wide] [coherence:84]`,
      `HUMAN: The moment I start tuning the details, the joy comes right back into the room. [cam:human] [coherence:94]`,
      `SPIRIT: Keep your eyes on the work and let the mastery compound in quiet hours. [cam:top] [coherence:100]`
    ]
  };

  const lines = templates[lens] || templates.socratic;
  document.getElementById('script-textarea').value = lines.join('\n\n');
  applyCustomScript();
}

function copySocialCaption() {
  const ep = EPISODES[curEpisodeIdx];
  const dialogueTranscript = beats
    .map((b) => `${b.speaker === 'SPIRIT' ? '✨ Witness' : '👤 Me'}: "${b.text}"`)
    .join('\n\n');
  const fullPost = `${ep.hook ? ep.hook + '\n\n' : ''}${ep.caption || ''}\n\n---\n${dialogueTranscript}`;
  navigator.clipboard.writeText(fullPost);
  const btn = document.getElementById('btn-copy-caption');
  btn.textContent = '✓ Copied!';
  setTimeout(() => { btn.textContent = '📋 Copy Caption'; }, 2000);
}

function toggleVertical() {
  document.body.classList.toggle('vertical');
  const isV = document.body.classList.contains('vertical');
  const btn = document.getElementById('btn-vertical');
  btn.classList.toggle('on', isV);
  btn.textContent = isV ? '🖥️ 16:9 Cinema (V)' : '📱 9:16 Reel (V)';
  resolveShotForBeat(beats[curBeatIdx]);
  setTimeout(resizeRenderer, 50);
  if (typeof studioChanged === 'function') studioChanged();
}

function togglePanel(side, force) {
  const cls = `${side}-collapsed`;
  const collapse = typeof force === 'boolean' ? force : !document.body.classList.contains(cls);
  document.body.classList.toggle(cls, collapse);
}

function setRightTab(name) {
  ['direct', 'beats', 'reel', 'journal'].forEach((k) => {
    document.getElementById(`tab-${k}`).classList.toggle('active', k === name);
    document.getElementById(`pane-${k}`).classList.toggle('active', k === name);
  });
}

// E: open the Journal tab; press again to return to Direct controls.
function toggleScriptDrawer() {
  const open = !document.body.classList.contains('right-collapsed');
  const onJournal = document.getElementById('pane-journal').classList.contains('active');
  if (open && onJournal) { setRightTab('direct'); return; }
  togglePanel('right', false);
  setRightTab('journal');
}

// Panels float over the scene, so the canvas never needs to resize for them; start narrow screens collapsed.
if (window.innerWidth < 1100) document.body.classList.add('left-collapsed', 'right-collapsed');
document.addEventListener('click', (e) => { if (e.target.closest('button')) e.target.closest('button').blur(); });
if (window.ResizeObserver) new ResizeObserver(() => { if (typeof resizeRenderer === 'function') resizeRenderer(); }).observe(document.getElementById('frame-container'));

function toggleCleanMode() {
  document.body.classList.toggle('clean');
  setTimeout(resizeRenderer, 50);
}

// Sliders and checkboxes give focus back after use, so shortcuts keep working; text fields keep it.
document.addEventListener('pointerup', () => {
  const ae = document.activeElement;
  if (ae && ae.tagName === 'INPUT' && (ae.type === 'range' || ae.type === 'checkbox')) setTimeout(() => ae.blur(), 0);
});
window.addEventListener('keydown', (e) => {
  const ae = document.activeElement;
  if (ae && (ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT' || (ae.tagName === 'INPUT' && ae.type !== 'range' && ae.type !== 'checkbox'))) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.code === 'Space' || e.code === 'ArrowRight') {
    e.preventDefault();
    nextBeat();
  } else if (e.code === 'ArrowLeft') {
    e.preventDefault();
    prevBeat();
  } else if (e.key === 'v' || e.key === 'V') {
    toggleVertical();
  } else if (e.key === 'h' || e.key === 'H') {
    toggleCleanMode();
  } else if (e.key === '[') {
    togglePanel('left');
  } else if (e.key === ']') {
    togglePanel('right');
  } else if (e.key === 'e' || e.key === 'E') {
    toggleScriptDrawer();
  } else if (e.key === 'm' || e.key === 'M') {
    toggleAudio();
  } else if (e.key === 'l' || e.key === 'L') {
    cycleSceneMood();
    if (typeof studioChanged === 'function') studioChanged();
  } else if (e.key === 'r' || e.key === 'R') {
    startTake(true);
  } else if (e.key === 'p' || e.key === 'P') {
    playFromStart();
  } else if (e.key === 'c' || e.key === 'C') {
    if (typeof cycleCaptionStyle === 'function') cycleCaptionStyle();
  } else if (e.key === 'g' || e.key === 'G') {
    if (typeof toggleGuides === 'function') toggleGuides();
  } else if (e.key === 'b' || e.key === 'B') {
    setRightTab('beats'); togglePanel('right', false);
  } else if (e.key === 'Escape') {
    if (take) stopTake();
  } else if (e.key === '0') setCameraCut('auto');
  else if (e.key === '1') setCameraCut('wide');
  else if (e.key === '2') setCameraCut('human');
  else if (e.key === '3') setCameraCut('spirit');
  else if (e.key === '4') setCameraCut('top');
});
