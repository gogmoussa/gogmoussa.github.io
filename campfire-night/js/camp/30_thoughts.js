// © 2026 George Moussa. All rights reserved.
// CAMP 30. BURN THE THOUGHT: on the stump, Enter opens a line to write on; Enter again burns it. The night moves
//     while it burns (25-120 game minutes by length, over 14-40 real seconds), and it feeds the fire.
//     PRIVACY: the words live only in the textarea until Enter, then are cleared. Nothing is stored, sent or exposed:
//     no localStorage, no serve.py, no network, and no test field carries the text (counts only).
(function () {
  if (!window.Camp) return;
  const C = Camp, { rand, clamp01, smooth, HX, HZ } = C;
  const BURN_MIN = [25, 120], BURN_SEC = [14, 40], BURN_PER_CHAR = 0.25, THOUGHT_FUEL_BONUS = 15;
  // soft openers shown faintly in the empty line (gone as soon as you type); by the hour, never required
  const INVITES = {
    'Blue Dusk': ['What is still with you from today?', 'Anything on your mind?', 'Something from today you are still holding…'],
    'Moonlit Night': ['What has been heavy lately?', 'Something you have not said out loud…', 'What keeps coming back?', 'Anything at all. A word is enough.'],
    'Misty Dawn': ['What could you put down tonight?', 'Something you are ready to let go of…'],
    'Golden Hour': ['One small thing for today…', 'What would feel good to leave here?']
  };

  C.css(`
    #cu-writebox { position: absolute; left: 50%; bottom: 13%; transform: translateX(-50%); width: min(560px, calc(100vw - 32px));
      opacity: 0; transition: opacity .6s; pointer-events: none; padding: 10px 14px 8px; border-radius: 14px;
      background: rgba(8,10,18,.62); backdrop-filter: blur(6px); box-shadow: 0 0 40px rgba(255,140,60,.12); }
    #cu-writebox.on { opacity: 1; pointer-events: auto; }
    #camp-ui:has(#cu-writebox.on) #cu-lesson, #camp-ui:has(#cu-writebox.on) #cu-keys { opacity: 0; } /* nothing over the words while writing */
    #cu-write { display: block; width: 100%; box-sizing: border-box; resize: none; overflow: hidden; border: 0; outline: 0;
      background: transparent; border-bottom: 1px solid rgba(255,170,90,.3);
      color: #ffe9cf; caret-color: #ffb066; font: 18px/1.5 ui-serif, Georgia, serif; padding: 8px 6px; text-shadow: 0 1px 8px rgba(0,0,0,.6);
      transition: opacity .7s, transform .7s, filter .7s; }
    #cu-write::placeholder { color: rgba(255,225,190,.38); font-style: italic; }
    #cu-write.burning { opacity: 0; transform: translateY(-26px) scale(.96); filter: blur(3px) sepia(1) saturate(3); }
    #cu-hint { color: rgba(220,200,175,.5); font-size: 12px; text-align: center; margin-top: 6px; transition: opacity 1s; }
    #cu-hint.gone { opacity: 0; }`);
  C.ui.insertAdjacentHTML('beforeend', `<div id="cu-writebox"><textarea id="cu-write" rows="1" spellcheck="false" autocomplete="off" aria-label="Write, then Enter to burn it"></textarea>
      <div id="cu-hint">Enter gives it to the fire · Shift+Enter new line · Esc stop</div></div>`);
  const writeEl = C.$('cu-write'), box = C.$('cu-writebox');

  const thought = { secsLeft: 0, minLeft: 0, count: 0 };            // the burn in progress (more thoughts add to it)
  const papers = [];                                                // paper curls flying into the fire
  let warm = 0, hintSeen = false, sitTold = false;
  const paperGeo = new THREE.PlaneGeometry(0.16, 0.11, 1, 1), fwd = new THREE.Vector3(), cA = new THREE.Color();
  const writing = () => document.activeElement === writeEl;
  function openWrite(focus) {
    const pool = INVITES[MOODS[moodIdx] && MOODS[moodIdx].name] || INVITES['Moonlit Night'];
    if (!writeEl.value) writeEl.placeholder = pool[Math.random() * pool.length | 0];
    box.classList.add('on');
    document.exitPointerLock?.();
    for (const k in C.keys) C.keys[k] = false;                      // a held W must not stand you up
    if (focus) writeEl.focus({ preventScroll: true });
  }
  function closeWrite() { writeEl.blur(); box.classList.remove('on'); }
  function fitWrite() { writeEl.style.height = 'auto'; writeEl.style.height = Math.min(writeEl.scrollHeight, 180) + 'px'; }
  writeEl.addEventListener('input', fitWrite);
  function writeKey(e) {
    if (e.type !== 'keydown') return;
    if (e.key === 'Escape') { e.preventDefault(); closeWrite(); return; }
    if ((e.key === 'Enter') && !e.shiftKey && !e.isComposing) { e.preventDefault(); burnThought(); }
  }
  function burnThought(text) {
    const words = (text !== undefined ? text : writeEl.value).trim();
    if (!words || writeEl.classList.contains('burning')) return false;
    const chars = words.length;
    writeEl.classList.add('burning');
    setTimeout(() => { writeEl.value = ''; fitWrite(); writeEl.classList.remove('burning'); }, 700);
    if (!hintSeen) { hintSeen = true; C.$('cu-hint').classList.add('gone'); }
    // the burn length comes from the length alone; the words themselves go nowhere
    const min = Math.max(BURN_MIN[0], Math.min(BURN_MIN[1], 20 + chars * BURN_PER_CHAR));
    const secs = BURN_SEC[0] + (BURN_SEC[1] - BURN_SEC[0]) * clamp01((min - BURN_MIN[0]) / (BURN_MIN[1] - BURN_MIN[0]));
    throwPaper(min, secs);
    return true;
  }
  function throwPaper(min, secs) {
    camera.getWorldDirection(fwd);
    const mat = new THREE.MeshBasicMaterial({ color: 0xf2e6cf, transparent: true, side: THREE.DoubleSide, fog: true, depthWrite: false });
    const mesh = new THREE.Mesh(paperGeo, mat);
    const from = camera.position.clone().addScaledVector(fwd, 0.45); from.y -= 0.22;
    mesh.position.copy(from); scene.add(mesh); crumple();
    papers.push({ mesh, from, to: new THREE.Vector3(HX + rand(-0.12, 0.12), terrainY(HX, HZ) + 0.32, HZ + rand(-0.12, 0.12)), t: 0, dur: 1.5, min, secs,
      spin: new THREE.Vector3(rand(1, 3), rand(2, 4), rand(-2, 2)) });
  }
  function paperLands(pp) {
    scene.remove(pp.mesh); pp.mesh.material.dispose();
    C.addFuel(pp.min + THOUGHT_FUEL_BONUS);
    thought.minLeft += pp.min; thought.secsLeft += pp.secs; thought.count++;
    C.flare(1); warm = 1; puff(pp.secs);
  }
  function updateThoughts(dt) {
    for (let i = papers.length - 1; i >= 0; i--) {
      const pp = papers[i]; pp.t += dt / pp.dur;
      const u = Math.min(1, pp.t), m = pp.mesh;
      m.position.lerpVectors(pp.from, pp.to, u); m.position.y += Math.sin(u * Math.PI) * 0.35;
      m.rotation.set(pp.spin.x * u, pp.spin.y * u, pp.spin.z * u);
      const curl = 1 - 0.55 * smooth(0.55, 1, u); m.scale.set(curl, curl * (1 - 0.4 * u), 1);
      m.material.color.setHex(0xf2e6cf).lerp(cA.setHex(0x3a1606), smooth(0.6, 1, u));
      if (u >= 1) { paperLands(pp); papers.splice(i, 1); }
    }
    let dGame = 0;
    if (thought.secsLeft > 0) {
      const step = Math.min(dt, thought.secsLeft);
      dGame = thought.minLeft * step / thought.secsLeft;
      thought.minLeft -= dGame; thought.secsLeft -= step;
      if (thought.secsLeft <= 1e-4) thought.secsLeft = thought.minLeft = 0;
      warm = Math.max(warm, 0.6);
    }
    warm = Math.max(0, warm - dt * 0.08);
    return dGame;
  }
  // fireflies drift in toward the fire while a thought burns (the nature code rewrites them each frame, so this never adds up)
  function pullFireflies() {
    if (warm <= 0.01 || !fireflies.visible) return;
    C.sparks(0.6 * warm);                                             // a burning thought sends up more sparks
    const arr = flyGeo.attributes.position.array, k = 0.35 * warm;
    for (let i = 0; i < FLY_N; i++) {
      const x = arr[i * 3], z = arr[i * 3 + 2], d = Math.hypot(x - HX, z - HZ); if (d < 2.6) continue;
      const goal = 2.6 + (d - 2.6) * 0.4;                           // closer, never into the flames
      arr[i * 3] = HX + (x - HX) * (1 + (goal / d - 1) * k); arr[i * 3 + 2] = HZ + (z - HZ) * (1 + (goal / d - 1) * k);
    }
    flyGeo.attributes.position.needsUpdate = true;
  }
  // paper sounds sit above the fire bed (fireGain ~1.9): a crumple as it leaves your hand, a catch when it lands,
  // then the paper crackling for the first part of the burn. All filtered noise, scheduled once on the audio clock.
  const PAPER_VOL = { crumple: 0.22, catch: 0.42, crackle: 0.3, hiss: 0.12 };
  function crumple() {
    if (!C.sfx()) return;
    const t0 = audioCtx.currentTime;
    for (let i = 0; i < 14; i++) C.noiseHit(t0 + Math.pow(Math.random(), 1.6) * 0.45, rand(0.02, 0.06), rand(2500, 6000), rand(1.5, 4), PAPER_VOL.crumple * rand(0.4, 1));
  }
  function puff(secs) {                                             // the catch, then paper crackle for the first part of the burn
    if (!C.sfx()) return;
    const t0 = audioCtx.currentTime, noiseBuf = C.noise();
    const src = audioCtx.createBufferSource(), lp = audioCtx.createBiquadFilter(), g = audioCtx.createGain();
    src.buffer = noiseBuf; lp.type = 'lowpass'; lp.frequency.setValueAtTime(600, t0); lp.frequency.linearRampToValueAtTime(2400, t0 + 0.12); lp.frequency.exponentialRampToValueAtTime(400, t0 + 0.9);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(PAPER_VOL.catch, t0 + 0.06); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9);
    src.connect(lp); lp.connect(g); g.connect(audioOut); src.start(t0); src.stop(t0 + 0.92);
    // a soft burning hiss under the crackle, fading as the paper is used up
    const len = Math.min(8, 2.5 + (secs || 14) * 0.15);
    const hs = audioCtx.createBufferSource(), hp = audioCtx.createBiquadFilter(), hg = audioCtx.createGain();
    hs.buffer = noiseBuf; hs.loop = true; hp.type = 'bandpass'; hp.frequency.value = 3200; hp.Q.value = 0.7;
    hg.gain.setValueAtTime(0, t0); hg.gain.linearRampToValueAtTime(PAPER_VOL.hiss, t0 + 0.4); hg.gain.setTargetAtTime(0.0001, t0 + len * 0.45, len * 0.2);
    hs.connect(hp); hp.connect(hg); hg.connect(audioOut); hs.start(t0); hs.stop(t0 + len + 1.5);
    // crackles: dense at the catch, thinning out over len seconds
    for (let t = 0.1; t < len; ) {
      const left = 1 - t / len;
      C.noiseHit(t0 + t, rand(0.015, 0.05), rand(1800, 5500), rand(2, 6), PAPER_VOL.crackle * (0.35 + 0.65 * left) * rand(0.4, 1));
      t += rand(0.03, 0.12) + (1 - left) * rand(0.1, 0.45);
    }
  }
  function clearThoughts() {
    writeEl.value = ''; fitWrite(); writeEl.classList.remove('burning'); closeWrite();
    papers.forEach((pp) => { scene.remove(pp.mesh); pp.mesh.material.dispose(); }); papers.length = 0;
    thought.secsLeft = thought.minLeft = 0; warm = 0;
  }

  C.use({
    name: 'thoughts', order: 30,
    how: '<b>Sit on the stump</b>: write what is on your mind and let it burn, toast a marshmallow, or just wait a while.',
    keys: 'On the stump: Enter write',
    key(e) {
      if (e.target === writeEl) { writeKey(e); return true; }         // typing: the textarea has the key
      if (e.type === 'keydown' && !e.repeat && (e.code === 'Enter' || e.code === 'NumpadEnter') && C.player.sitting && C.state.running && !C.state.paused) {
        e.preventDefault(); openWrite(true); return true;
      }
      return false;
    },
    onSit() { if (!sitTold) C.toast('The fire takes what you write. The night moves on while it burns.'); sitTold = true; },
    onStand: closeWrite,
    onDawn: clearThoughts,                                            // anything left unburned goes with the night
    reset() { clearThoughts(); thought.count = 0; },
    seatHint: () => '<b>Enter</b> write',
    target: (ctx) => ctx.sitting && writing() ? { label: '', prio: 20 } : null,   // the line's own hint is enough while writing
    tick: updateThoughts,
    frame: pullFireflies,
    moments: () => thought.count ? [thought.count === 1 ? 'one thought given to it' : `${thought.count} thoughts given to it`] : []
  });
  Object.assign(C.test, {
    write(text) { if (!C.player.sitting) return false; openWrite(false); return burnThought(text); },  // tests only: burns test text
    thought: () => ({ writing: writing(), open: box.classList.contains('on'), secsLeft: +thought.secsLeft.toFixed(2), minLeft: +thought.minLeft.toFixed(1), burned: thought.count, inFlight: papers.length, lineEmpty: !writeEl.value })
  });
})();
