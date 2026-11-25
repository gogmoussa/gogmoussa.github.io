// © 2026 George Moussa. All rights reserved.
// ============================================================================
// 16. EXPLORE MODE, FRAME METER / AUTO QUALITY, AND THE `IW` CONTROL API
// ============================================================================
// Loads last. Three things:
//  16A  tickPerf     frame meter + auto quality (drops the render scale when frames run slow, raises it back when there is room)
//  16B  Explore mode the default view: no panels, a small dock, WASD flight, the story can play while you roam
//  16C  window.IW    one object that drives the whole studio from the console (what Claude uses): IW.help()

// --- 16A. FRAME METER + AUTO QUALITY ---
const PERF = { fps: 60, frameMs: 16.7, cpuMs: 0, scale: renderer.getPixelRatio(), maxScale: Math.min(window.devicePixelRatio || 1, 2), minScale: 0.75,
  auto: true, mirror: true, slowFor: 0, fastFor: 0, lastChange: 0, lastAt: 0, ceiling: null };
function setRenderScale(s) {
  s = Math.max(PERF.minScale, Math.min(PERF.ceiling || PERF.maxScale, Math.round(s * 4) / 4));
  if (s === renderer.getPixelRatio()) return;
  renderer.setPixelRatio(s); // resizeRenderer (14) resizes the render targets on the next frame
  PERF.scale = s; PERF.lastChange = performance.now(); PERF.slowFor = PERF.fastFor = 0;
}
function tickPerf(frameT0, mirrorDrawn) {
  tickGrassPrepass();
  const now = performance.now();
  const gap = PERF.lastAt ? now - PERF.lastAt : 16.7;
  PERF.lastAt = now;
  PERF.mirror = !!mirrorDrawn;
  PERF.cpuMs += (now - frameT0 - PERF.cpuMs) * 0.05;
  if (gap > 250) { PERF.slowFor = PERF.fastFor = 0; return; } // tab was hidden or the page stalled: not a real sample
  PERF.frameMs += (gap - PERF.frameMs) * 0.05;
  PERF.fps = 1000 / PERF.frameMs;
  PERF.scale = renderer.getPixelRatio();
  if (!PERF.auto || renderSizeOverride || take) { PERF.slowFor = PERF.fastFor = 0; return; } // never touch a take
  if (PERF.frameMs > 18.5) { PERF.slowFor += gap; PERF.fastFor = 0; }      // under ~54 fps
  else if (PERF.frameMs < 17.2) { PERF.fastFor += gap; PERF.slowFor = 0; } // a steady 60
  else { PERF.slowFor = PERF.fastFor = 0; }
  if (PERF.slowFor > 1500 && PERF.scale > PERF.minScale) {
    if (now - PERF.lastChange < 8000 && PERF.lastStep === 'up') PERF.ceiling = PERF.scale - 0.25; // the last raise was too much: stay below it
    PERF.lastStep = 'down'; setRenderScale(PERF.scale - 0.25);
  } else if (PERF.fastFor > 6000 && PERF.scale < (PERF.ceiling || PERF.maxScale)) {
    PERF.lastStep = 'up'; setRenderScale(PERF.scale + 0.25);
  }
}

// --- 16A2. ASTRAL TWILIGHT: DEPTH PRE-PASS FOR THE SEE-THROUGH GRASS ---
// In the spirit mood the grass is blended (bladeMat.transparent), so the GPU shades every overlapping blade instead of only
// the nearest one. A colourless copy of each grass mesh, drawn first with the same wind shader, lays down depth so the blended
// pass shades one layer. Same picture, about 1.1 ms a frame back at 2048x1536. Grass only: on the tree canopies the layers
// showing through each other are the look, and a pre-pass there turns them solid with dark edges (tried Nov 15 2026).
const grassPrepass = [];
function tickGrassPrepass() {
  const on = bladeMat.transparent;
  if (on && !grassPrepass.length) {
    const depthMat = bladeMat.clone();
    depthMat.onBeforeCompile = bladeMat.onBeforeCompile; // the wind must move both copies alike
    if (bladeMat.customProgramCacheKey) depthMat.customProgramCacheKey = bladeMat.customProgramCacheKey;
    depthMat.transparent = false; depthMat.opacity = 1; depthMat.colorWrite = false;
    const hosts = [];
    scene.traverse((o) => { if (o.isMesh && o.material === bladeMat) hosts.push(o); });
    hosts.forEach((o) => {
      let m;
      if (o.isInstancedMesh) { m = new THREE.InstancedMesh(o.geometry, depthMat, o.count); m.instanceMatrix = o.instanceMatrix; }
      else m = new THREE.Mesh(o.geometry, depthMat);
      m.matrixAutoUpdate = false; m.frustumCulled = o.frustumCulled; m.castShadow = false; m.receiveShadow = false;
      m.renderOrder = o.renderOrder - 1;
      o.add(m); grassPrepass.push(m);
    });
  }
  for (const m of grassPrepass) m.visible = on;
}

// --- 16B. EXPLORE MODE ---
const UI_KEY = 'innerwork.ui';
let uiMode = 'studio';      // 'explore' | 'studio'
let followDirector = false; // explore only: let the story's director move the camera
const flyKeys = {};
const flyVel = new THREE.Vector3(), _flyF = new THREE.Vector3(), _flyR = new THREE.Vector3(), _flyGoal = new THREE.Vector3(), _flyD = new THREE.Vector3();
const FLY = { speed: 2.4, fast: 3.2, floor: 0.28, radius: 34, ceil: 30 };
const ORBIT_STUDIO = { minDistance: controls.minDistance, maxDistance: controls.maxDistance, maxPolarAngle: controls.maxPolarAngle };
const ORBIT_EXPLORE = { minDistance: 0.35, maxDistance: 45, maxPolarAngle: Math.PI * 0.64 };

// Places to jump to. p = camera, t = what it looks at.
const PLACES = {
  fire:    { label: '🔥 Fire',    p: [0.3, 1.75, 5.4],   t: [0, 1.15, 0] },
  george:  { label: '🧔 George',  p: [0.75, 1.5, 2.5],   t: [-1.13, 1.25, 0.5] },
  witness: { label: '✨ Witness', p: [-0.7, 1.75, 2.3],  t: [1.02, 1.8, -0.2] },
  pond:    { label: '💧 Lake',    p: [-4.6, 1.0, -7.8],  t: [0, 0.9, -1.2] },
  meadow:  { label: '🌾 Meadow',  p: [-7.5, 1.1, 8.5],   t: [0, 1.4, 0] },
  above:   { label: '🦅 Above',   p: [7, 9.5, 13],       t: [0, 0.8, 0] }
};
function goPlace(name, snap) {
  const pl = PLACES[name];
  if (!pl) return false;
  desiredCamPos.fromArray(pl.p); desiredCamTarget.fromArray(pl.t);
  camMove = null;
  if (snap) { camera.position.copy(desiredCamPos); controls.target.copy(desiredCamTarget); camTransitionTime = 0; camFocus.snap = true; }
  else camTransitionTime = 1.6;
  flyVel.set(0, 0, 0);
  return true;
}
function setCamera(p, t, snap) { // free camera from numbers: p and t are [x, y, z]
  desiredCamPos.fromArray(p); if (t) desiredCamTarget.fromArray(t);
  camMove = null;
  if (snap === false) camTransitionTime = 1.6;
  else { camera.position.copy(desiredCamPos); controls.target.copy(desiredCamTarget); camTransitionTime = 0; camFocus.snap = true; }
}

// While roaming, the director still runs (labels, focus, staging) but hands the camera straight back.
const _resolveShotDirector = resolveShotForBeat;
resolveShotForBeat = function (beat) {
  if (uiMode !== 'explore' || followDirector) return _resolveShotDirector(beat);
  const p = camera.position.clone(), tg = controls.target.clone(), dp = desiredCamPos.clone(), dt2 = desiredCamTarget.clone(), tt = camTransitionTime;
  const out = _resolveShotDirector(beat);
  camera.position.copy(p); controls.target.copy(tg); desiredCamPos.copy(dp); desiredCamTarget.copy(dt2);
  camTransitionTime = tt; camMove = null; camFocus.override = null; shotIsCloseUp = false;
  return out;
};

function tickExplore(dt) {
  if (uiMode !== 'explore') return;
  if (!followDirector) { camMove = null; camFocus.override = null; camFocus.strength = 0.2; } // cue-driven moves too; roaming keeps the world mostly sharp
  const k = flyKeys;
  const mx = (k.d ? 1 : 0) - (k.a ? 1 : 0), mz = (k.w ? 1 : 0) - (k.s ? 1 : 0), my = (k.e ? 1 : 0) - (k.q ? 1 : 0);
  _flyGoal.set(0, 0, 0);
  if (mx || my || mz) {
    camera.getWorldDirection(_flyF);
    _flyR.crossVectors(_flyF, camera.up).normalize();
    _flyGoal.addScaledVector(_flyF, mz).addScaledVector(_flyR, mx);
    _flyGoal.y += my;
    _flyGoal.normalize().multiplyScalar(FLY.speed * (k.shift ? FLY.fast : 1));
    camTransitionTime = 0; camMove = null; // flying takes the camera, like dragging does
    if (followDirector) setFollow(false);
  }
  flyVel.lerp(_flyGoal, 1 - Math.exp(-dt * 7));
  if (flyVel.lengthSq() > 1e-5) {
    _flyD.copy(flyVel).multiplyScalar(dt);
    camera.position.add(_flyD); controls.target.add(_flyD);
  }
  if (camTransitionTime > 0) return; // gliding to a place: leave it alone
  // stay above the ground, under the sky and inside the world
  let lift = 0;
  if (camera.position.y < FLY.floor) lift = FLY.floor - camera.position.y;
  else if (camera.position.y > FLY.ceil) lift = FLY.ceil - camera.position.y;
  if (lift) { camera.position.y += lift; controls.target.y += lift; }
  const r = Math.hypot(camera.position.x, camera.position.z);
  if (r > FLY.radius) {
    const s = FLY.radius / r, dx = camera.position.x * (s - 1), dz = camera.position.z * (s - 1);
    camera.position.x += dx; camera.position.z += dz; controls.target.x += dx; controls.target.z += dz;
  }
}

function setFollow(on) {
  followDirector = typeof on === 'boolean' ? on : !followDirector;
  if (uiMode === 'explore' && followDirector) _resolveShotDirector(beats[curBeatIdx]);
  syncDock();
  return followDirector;
}

function setUI(mode, opts) {
  if (mode !== 'explore' && mode !== 'studio') return uiMode;
  uiMode = mode;
  document.body.classList.toggle('explore', mode === 'explore');
  Object.assign(controls, mode === 'explore' ? ORBIT_EXPLORE : ORBIT_STUDIO);
  for (const key in flyKeys) flyKeys[key] = false;
  flyVel.set(0, 0, 0);
  if (mode === 'explore') { followDirector = false; camMove = null; camFocus.override = null; shotIsCloseUp = false; }
  else resolveShotForBeat(beats[curBeatIdx]); // back to the beat's shot
  if (!opts || opts.save !== false) { try { localStorage.setItem(UI_KEY, mode); } catch (e) {} }
  setTimeout(resizeRenderer, 50);
  syncDock();
  return uiMode;
}

// Keys: capture phase so E (script drawer in the studio) can mean "up" while exploring.
function typingInField() {
  const ae = document.activeElement;
  return !!ae && (ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT' || (ae.tagName === 'INPUT' && ae.type !== 'range' && ae.type !== 'checkbox'));
}
const FLY_CODES = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyQ: 'q', KeyE: 'e' };
window.addEventListener('keydown', (e) => {
  if (typingInField() || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.code === 'Tab') { e.preventDefault(); e.stopPropagation(); setUI(uiMode === 'explore' ? 'studio' : 'explore'); return; }
  if (uiMode !== 'explore') return;
  flyKeys.shift = e.shiftKey;
  const fk = FLY_CODES[e.code];
  if (fk) { flyKeys[fk] = true; e.preventDefault(); e.stopPropagation(); return; }
  if (e.code === 'KeyF') { e.stopPropagation(); setFollow(); return; }
  if (e.code === 'Space') { e.preventDefault(); e.stopPropagation(); toggleAutoPlay(); syncDock(); return; }
  if (e.code === 'KeyV') { e.stopPropagation(); startAvoid(4); return; } // V: watch the Avoider leave and come back
  if (e.code === 'KeyJ') { e.stopPropagation(); if (typeof setMap === 'function') setMap(); return; } // J: the process map (js/19_process.js)
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= 6) { e.stopPropagation(); goPlace(Object.keys(PLACES)[n - 1]); } // 1-6 jump to places here (camera cuts in the studio)
}, true);
window.addEventListener('keyup', (e) => {
  flyKeys.shift = e.shiftKey;
  const fk = FLY_CODES[e.code];
  if (fk) flyKeys[fk] = false;
}, true);
window.addEventListener('blur', () => { for (const key in flyKeys) flyKeys[key] = false; });

// Dock
function syncDock() {
  const set = (id, txt, on) => { const el = document.getElementById(id); if (!el) return; if (txt != null && el.textContent !== txt) el.textContent = txt; if (on != null) el.classList.toggle('on', !!on); };
  set('xd-play', autoPlay ? '⏸ Pause story' : '▶ Play story');
  set('xd-follow', followDirector ? '🎬 Director cam: On' : '🎬 Director cam: Off', followDirector);
  set('xd-sound', soundEnabled ? '🔊 Sound' : '🔇 Sound', soundEnabled);
  const b = beats[curBeatIdx] || {};
  set('xd-beat', `${curBeatIdx + 1} / ${beats.length}`);
  const ep = document.getElementById('xd-episode'), md = document.getElementById('xd-mood');
  if (ep && document.activeElement !== ep) ep.value = String(curEpisodeIdx);
  if (md && document.activeElement !== md) md.value = String(moodIdx);
  const fps = document.getElementById('xd-fps');
  if (fps) fps.textContent = `${Math.round(PERF.fps)} fps · ${PERF.scale}x`;
}
(function buildDock() {
  const places = document.getElementById('xd-place');
  if (!places) return;
  // Views menu: pick a place and fly there. It snaps back to the title so the same place can be picked twice in a row.
  places.add(new Option('View: fly to…', ''));
  Object.keys(PLACES).forEach((key, i) => places.add(new Option(`${PLACES[key].label}  (${i + 1})`, key)));
  places.onchange = () => { if (places.value) goPlace(places.value); places.value = ''; places.blur(); };
  const ep = document.getElementById('xd-episode');
  EPISODES.forEach((e, i) => ep.add(new Option(`${i + 1} · ${e.title || 'Episode ' + (i + 1)}`, String(i))));
  ep.onchange = () => { IW.go(parseInt(ep.value, 10) + 1, 1); ep.blur(); };
  const md = document.getElementById('xd-mood');
  MOODS.forEach((m, i) => md.add(new Option(m.name, String(i))));
  md.onchange = () => { IW.mood(parseInt(md.value, 10)); md.blur(); };
  setInterval(syncDock, 400);
})();
if (typeof buildWaterMenu === 'function') buildWaterMenu(); // 05b: Water lake / pond

// --- 16C. `IW`: DRIVE THE STUDIO FROM THE CONSOLE ---
// Every call returns plain data (JSON-safe) so it can be read back from javascript_tool.
let lastSave = null; // { kind, name, saved, ok, at }
const saveWaiters = [];
saveMediaFile = function (endpoint, blob, name, label) { // same behaviour as 11c, plus it reports the outcome to IW
  const done = (ok, saved) => {
    lastSave = { kind: endpoint === 'save-take' ? 'take' : 'still', name, saved, ok, bytes: blob.size, at: new Date().toISOString() };
    saveWaiters.splice(0).forEach((fn) => fn(lastSave));
  };
  fetch(`/api/${endpoint}/${name}`, { method: 'POST', body: blob })
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((j) => { setReelStatus(`${label} saved → ${j.saved}`); done(true, j.saved); })
    .catch(() => { downloadBlob(blob, name); setReelStatus(`${label} downloaded: ${name}`); done(false, `download:${name}`); });
};
const nextSave = () => new Promise((res) => saveWaiters.push(res));
const r3 = (v) => v.toArray().map((x) => +x.toFixed(3));
function moodIndex(x) {
  if (typeof x === 'number') return ((x % MOODS.length) + MOODS.length) % MOODS.length;
  const s = String(x).toLowerCase();
  if (s in MOOD_ALIASES) return MOOD_ALIASES[s];
  const i = MOODS.findIndex((m) => m.name.toLowerCase().includes(s));
  return i < 0 ? null : i;
}

window.IW = {
  help() {
    return [
      'IW.state()                          everything at a glance (episode, beat, mood, camera, take, perf)',
      'IW.ui("explore" | "studio")         explore = no panels + dock + WASD; studio = the full panels',
      'IW.go(ep, beat)                     1-based; beat optional',
      'IW.play() / pause() / toggle() / next() / prev() / rehearse()',
      'IW.mood(0-4 | "dusk")  IW.look("Dreamy Glow")  IW.vertical(true|false)  IW.sound(true|false)',
      'IW.set("grade.warmth", 0.3) / IW.get("cam.lens") / IW.settings()   any STUDIO setting, applied + saved',
      'IW.place("fire"|"george"|"witness"|"pond"|"meadow"|"above")   IW.places()',
      'IW.cam("auto"|"wide"|"human"|"spirit"|"top")  or  IW.cam({ p:[x,y,z], t:[x,y,z] })  free camera',
      'IW.follow(true|false)               explore: let the story director move the camera',
      'IW.emote("grief@0.8")  IW.gesture("nod", 2)   try George\'s emotions / gestures live',
      'IW.avoid(2.5)                                 the Avoider: swarm scatters, fire dips, he and the camera look away',
      'IW.numb(4)                                    the Numb-er: fog rolls in, the fire dims, a smoke figure holds a hand out',
      'IW.judge(4)                                   the Judge: the fire flares, a tall charcoal figure of him stands on the tree line behind him',
      'IW.still()                          PNG of the frame → episodes/shots/ (promise)',
      'IW.record({ ep, vertical, quality:"1080"|"720", fps:30|60 })   full take → episodes/takes/ (promise); IW.stopRecord()',
      'IW.perf()  IW.quality("auto" | 1 | 1.5 | 2)   frame meter and render scale',
      'IW.water()  IW.water("lake" | "pond")   the wide lake or the old pond (saved; reloads the page)'
    ].join('\n');
  },
  water(m) { return m === undefined ? WATER_MODE : setWaterMode(m); },
  state() {
    const b = beats[curBeatIdx] || {};
    return {
      ui: uiMode, follow: followDirector, clean: document.body.classList.contains('clean'),
      ep: curEpisodeIdx + 1, title: (EPISODES[curEpisodeIdx] || {}).title, episodes: EPISODES.length,
      beat: curBeatIdx + 1, beats: beats.length, speaker: b.speaker, text: b.text, playing: autoPlay,
      mood: MOODS[moodIdx].name, moodIdx, look: STUDIO.lookName, vertical: document.body.classList.contains('vertical'),
      sound: soundEnabled, voiceMode, take: take ? take.phase : null, lastSave,
      cam: { p: r3(camera.position), t: r3(controls.target), fov: +camera.fov.toFixed(1), cut: cameraMode },
      perf: IW.perf()
    };
  },
  perf() {
    return { fps: +PERF.fps.toFixed(1), frameMs: +PERF.frameMs.toFixed(2), cpuMs: +PERF.cpuMs.toFixed(2), scale: PERF.scale, auto: PERF.auto,
      ceiling: PERF.ceiling, mirrorPass: PERF.mirror, mirrorRect: PERF.mirrorRect, canvas: [canvas.width, canvas.height], hidden: document.hidden };
  },
  quality(q) {
    if (q === 'auto') { PERF.auto = true; PERF.ceiling = null; }
    else if (typeof q === 'number') { PERF.auto = false; PERF.ceiling = null; setRenderScale(q); }
    return IW.perf();
  },
  ui(mode) { return setUI(mode); },
  clean(on) { if (document.body.classList.contains('clean') !== !!on) toggleCleanMode(); return !!on; },
  go(ep, beat) {
    if (ep >= 1 && ep <= EPISODES.length && ep - 1 !== curEpisodeIdx) loadEpisode(ep - 1);
    if (beat >= 1 && beat <= beats.length) applyBeat(beat - 1);
    syncDock();
    return { ep: curEpisodeIdx + 1, beat: curBeatIdx + 1, beats: beats.length };
  },
  play() { if (!autoPlay) toggleAutoPlay(); syncDock(); return true; },
  pause() { if (autoPlay) toggleAutoPlay(); syncDock(); return false; },
  toggle() { toggleAutoPlay(); syncDock(); return autoPlay; },
  next() { nextBeat(); return curBeatIdx + 1; },
  prev() { prevBeat(); return curBeatIdx + 1; },
  rehearse() { playFromStart(); syncDock(); return true; },
  mood(x) { const i = moodIndex(x); if (i == null) return null; setMoodFromUI(i); return MOODS[moodIdx].name; },
  look(name) { if (!(name in LOOKS) && !(name in (STUDIO.customLooks || {}))) return Object.keys(LOOKS); applyLookPreset(name); return STUDIO.lookName; },
  vertical(on) { if (document.body.classList.contains('vertical') !== !!on) toggleVertical(); return !!on; },
  sound(on) { if (soundEnabled !== !!on) toggleAudio(); syncDock(); return soundEnabled; },
  set(path, v) { if (getPath(path) === undefined) return { error: `no setting "${path}"`, settings: Object.keys(STUDIO) }; onBound(path, v); return getPath(path); },
  get(path) { return getPath(path); },
  settings() { return JSON.parse(JSON.stringify(STUDIO)); },
  places() { return JSON.parse(JSON.stringify(PLACES)); },
  place(name, snap) { return goPlace(name, snap) ? name : Object.keys(PLACES); },
  cam(x, snap) {
    if (typeof x === 'string') { if (uiMode === 'explore') setFollow(true); setCameraCut(x); return cameraMode; }
    if (x && x.p) { if (uiMode === 'explore' && followDirector) setFollow(false); setCamera(x.p, x.t, snap); }
    return { p: r3(camera.position), t: r3(controls.target) };
  },
  follow(on) { return setFollow(on); },
  emote(spec) { setEmote(spec); return spec; },
  gesture(name, secs) { playGesture(name, secs); return name; },
  avoid(secs) { startAvoid(secs || 2.5); return { avoid: secs || 2.5 }; }, // the Avoider: swarm scatters, fire dips, he and the camera look away
  numb(secs) { startNumb(secs || 4); return { numb: secs || 4 }; },       // the Numb-er: fog rolls in, the fire dims, a smoke figure holds a hand out
  judge(secs) { startJudge(secs || 4); return { judge: secs || 4 }; },    // the Judge: the fire flares, a tall charcoal figure stands on the tree line behind him
  still() { const p = nextSave(); capturePosterPNG(); return p; },
  // A full take: studio view, beat 1 to the end, saved by serve.py. The tab must stay visible (a hidden tab stops rendering).
  async record(o) {
    o = o || {};
    if (take) return { error: 'a take is already running', take: take.phase };
    const prevUI = uiMode;
    if (uiMode !== 'studio') setUI('studio', { save: false });
    if (o.ep) IW.go(o.ep, 1);
    if (typeof o.vertical === 'boolean') IW.vertical(o.vertical);
    if (o.quality) onBound('export.quality', String(o.quality));
    if (o.fps) onBound('export.fps', +o.fps);
    if (typeof o.sound === 'boolean') onBound('export.sound', o.sound);
    const p = nextSave();
    startTake(true);
    if (prevUI === 'explore') p.then(() => setUI('explore', { save: false })); // back to roaming once the file is saved
    return p;
  },
  stopRecord() { if (take) stopTake(); return true; }
};

// --- Boot: ?ui=explore|studio wins; a deep link to a shot (?beat, ?cam, ?snap, ?clean) means the studio; else the last choice; else explore ---
(function () {
  const q = new URLSearchParams(location.search);
  let saved = null;
  try { saved = localStorage.getItem(UI_KEY); } catch (e) {}
  const deep = q.has('beat') || q.has('cam') || q.has('snap') || q.has('clean');
  const mode = q.get('ui') || (deep ? 'studio' : saved) || 'explore';
  setUI(mode === 'studio' ? 'studio' : 'explore', { save: false });
  if (uiMode === 'explore') goPlace('fire', true);
  requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.remove('booting'))); // reveal once a frame of the right view has drawn
})();
