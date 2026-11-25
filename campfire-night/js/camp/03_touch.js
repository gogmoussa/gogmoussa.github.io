// © 2026 George Moussa. All rights reserved.
// ============================================================================
// CAMP 03. TOUCH: plays Campfire Night on a phone or tablet (Nov 24 2026).
//     Only on a touch screen (a coarse pointer), or anywhere with ?touch in the URL for testing.
//     Left thumb: a joystick that walks (pushed to the rim it jogs). Right thumb: drag anywhere to look.
//     Buttons send the same keys the keyboard does, straight to window.campKey, so every pastime works
//     unchanged: a big E (act) bottom right, plus one button for each other key the prompt asks for right now
//     (R, F, C, Space…), read from the <b>key</b> labels in #cu-prompt, and a small fixed row (guide, stars,
//     view, lamp, full screen). Holding a button holds the key (hold E for stones, hold C to cast and reel).
//     Phones also get a lighter render: pixel ratio starts at 1 and auto quality (16A) may go 0.5 to 1.5.
// ============================================================================
(function () {
  if (!window.Camp) return;
  const C = Camp;
  const q = new URLSearchParams(location.search);
  const coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  if (!(q.has('touch') || (coarse && navigator.maxTouchPoints > 0))) return;

  // --- 03A. LIGHTER RENDER ----------------------------------------------------------
  if (typeof PERF === 'object' && typeof setRenderScale === 'function') {
    PERF.maxScale = Math.min(window.devicePixelRatio || 1, 1.5);
    PERF.minScale = 0.75;                                       // 0.5 looked very blocky (audit Nov 24); slower phones trade frames for sharpness
    setRenderScale(1);
  }

  // --- 03B. KEYS: a fake key event straight into the camp's key path -------------------
  const KEYNAME = { Space: ' ', Enter: 'Enter' };
  const held = new Set();
  function send(code, down) {
    const w = writing();
    if (w && (code === 'Enter' || code === 'Escape')) {       // the writing line listens on itself (30): a real key event there
      if (down) w.dispatchEvent(new KeyboardEvent('keydown', { key: code, code, bubbles: true, cancelable: true }));
      return;
    }
    if (down === held.has(code)) return;
    if (down) held.add(code); else held.delete(code);
    const key = KEYNAME[code] || code.replace('Key', '').toLowerCase();
    if (window.campKey) window.campKey({ type: down ? 'keydown' : 'keyup', code, key, repeat: false, shiftKey: false,
      isComposing: false, target: document.body, preventDefault() {}, stopPropagation() {} });
  }
  const codeOf = (label) => {                     // "Hold C" -> KeyC, "Space" -> Space
    const k = label.replace(/^hold\s+/i, '').trim();
    if (/^[A-Z]$/i.test(k)) return 'Key' + k.toUpperCase();
    if (k === 'Space' || k === 'Enter') return k;
    return null;
  };

  // --- 03C. LAYOUT ---------------------------------------------------------------------
  C.css(`
    body.camp-touch, body.camp-touch canvas { touch-action: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
    body.camp-touch #cu-keys { display: none; }
    body.camp-touch #camp-ui .overlay { align-items: flex-start; overflow-y: auto; touch-action: pan-y; -webkit-overflow-scrolling: touch; }
    body.camp-touch #camp-ui .overlay .card { margin: auto 0; }
    body.camp-touch #cu-prompt { bottom: calc(26% + env(safe-area-inset-bottom)); max-width: 92vw; text-align: center; }
    #ct { position: fixed; inset: 0; pointer-events: none; z-index: 55; display: none; }
    #ct.on { display: block; }
    #ct .stick { position: absolute; left: calc(20px + env(safe-area-inset-left)); bottom: calc(24px + env(safe-area-inset-bottom));
      width: 120px; height: 120px; border-radius: 50%; background: rgba(20,24,40,0.28); border: 1px solid rgba(243,231,211,0.25); pointer-events: auto; }
    #ct .knob { position: absolute; left: 50%; top: 50%; width: 52px; height: 52px; margin: -26px 0 0 -26px; border-radius: 50%;
      background: rgba(243,231,211,0.35); }
    #ct .btn { position: absolute; pointer-events: auto; border-radius: 50%; display: flex; align-items: center; justify-content: center;
      background: rgba(20,24,40,0.45); border: 1px solid rgba(243,231,211,0.35); color: #f3e7d3; font: 600 15px/1 system-ui, sans-serif; }
    #ct .btn.down { background: rgba(255,170,90,0.45); }
    #ct .act { right: calc(22px + env(safe-area-inset-right)); bottom: calc(34px + env(safe-area-inset-bottom)); width: 78px; height: 78px; font-size: 22px; }
    #ct .ctx { display: flex; gap: 12px; position: absolute; right: calc(112px + env(safe-area-inset-right)); bottom: calc(44px + env(safe-area-inset-bottom)); }
    #ct .ctx .btn, #ct .row .btn { position: static; width: 56px; height: 56px; }
    #ct .row { display: flex; flex-direction: column; gap: 8px; position: absolute; right: calc(12px + env(safe-area-inset-right)); top: calc(12px + env(safe-area-inset-top)); }
    #ct .row .btn { width: 42px; height: 42px; font-size: 12px; }
  `);
  document.body.classList.add('camp-touch');
  const root = document.createElement('div');
  root.id = 'ct';
  root.innerHTML = `<div class="stick"><div class="knob"></div></div>
    <div class="ctx"></div>
    <div class="btn act" data-code="KeyE">E</div>
    <div class="row">
      <div class="btn" data-code="KeyG" title="Field guide">Guide</div>
      <div class="btn" data-code="KeyK" title="Star chart">Stars</div>
      <div class="btn" data-code="KeyV" title="First or third person">View</div>
      <div class="btn" data-code="KeyL" title="Lamp">Lamp</div>
      <div class="btn" data-fs="1" title="Full screen">⛶</div>
    </div>`;
  C.ui.appendChild(root);                        // inside #camp-ui: the core hides every other child of body
  const stick = root.querySelector('.stick'), knob = root.querySelector('.knob'), ctx = root.querySelector('.ctx');

  // the start card says keyboard; say touch instead
  const startP = [...C.ui.querySelectorAll('#cu-start p')].find((p) => /Keyboard/.test(p.textContent));
  if (startP) startP.textContent = 'Nothing you write is kept. Left thumb walks, right thumb looks, E does things. Sound on is nicer.';

  // --- 03D. BUTTONS (hold = hold the key) ------------------------------------------------
  function wire(el) {
    if (el._ct) return; el._ct = true;
    el.addEventListener('touchstart', (e) => {
      e.preventDefault(); e.stopPropagation();
      if (el.dataset.fs) { toggleFull(); return; }
      el.classList.add('down'); send(el.dataset.code, true);
    }, { passive: false });
    const up = (e) => { e.preventDefault(); el.classList.remove('down'); if (el.dataset.code) send(el.dataset.code, false); };
    el.addEventListener('touchend', up, { passive: false });
    el.addEventListener('touchcancel', up, { passive: false });
  }
  root.querySelectorAll('.btn').forEach(wire);
  function toggleFull() {
    const d = document;
    try {
      if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
      else { const r = d.documentElement; const p = (r.requestFullscreen || r.webkitRequestFullscreen).call(r); if (p && p.catch) p.catch(() => {}); }
    } catch (e) {}
  }

  // writing on the stump (30): phone keyboards often send no usable Enter, so Burn and close get buttons
  function writing() { const w = document.getElementById('cu-write'); return w && w.closest('#cu-writebox.on') ? w : null; }

  // context buttons: every key the prompt names, other than E (the big button) and WASD
  let lastKeys = '';
  function syncContext() {
    const el = document.getElementById('cu-prompt');
    const html = el && el.classList.contains('on') ? el.innerHTML : '';
    const codes = writing() ? ['Enter', 'Escape'] : [];
    if (!codes.length) for (const m of html.matchAll(/<b>([^<]{1,8})<\/b>/g)) {
      const c = codeOf(m[1]);
      if (c && c !== 'KeyE' && !codes.includes(c)) codes.push(c);
    }
    const sig = (writing() ? 'w:' : '') + codes.join(',');
    if (sig === lastKeys) return;
    lastKeys = sig;
    for (const b of [...ctx.children]) { if (held.has(b.dataset.code)) send(b.dataset.code, false); b.remove(); }
    for (const c of codes) {
      const b = document.createElement('div');
      b.className = 'btn'; b.dataset.code = c; b.textContent = c === 'Space' ? '␣' : c === 'Enter' ? (writing() ? 'Burn' : '⏎') : c === 'Escape' ? '✕' : c.slice(3);
      ctx.appendChild(b); wire(b);
    }
  }

  // --- 03E. JOYSTICK + LOOK ------------------------------------------------------------
  const R = 50;                                   // knob travel in px
  let stickId = null, sx = 0, sy = 0, jx = 0, jy = 0;
  let lookId = null, lx = 0, ly = 0;
  const LOOK_RATE = 0.0048;                       // radians per px of drag
  function setMove() {
    const k = C.keys, m = Math.hypot(jx, jy);
    k.KeyW = jy < -0.35; k.KeyS = jy > 0.35; k.KeyA = jx < -0.35; k.KeyD = jx > 0.35;
    k.ShiftLeft = m > 0.92;
    knob.style.transform = `translate(${jx * R}px, ${jy * R}px)`;
  }
  stick.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.changedTouches[0]; stickId = t.identifier;
    const r = stick.getBoundingClientRect(); sx = r.left + r.width / 2; sy = r.top + r.height / 2;
    move(t);
  }, { passive: false });
  function move(t) {
    let dx = (t.clientX - sx) / R, dy = (t.clientY - sy) / R; const m = Math.hypot(dx, dy);
    if (m > 1) { dx /= m; dy /= m; }
    jx = dx; jy = dy; setMove();
  }
  const inUI = (el) => el && el.closest && el.closest('#ct .btn, #ct .stick, #camp-ui .overlay, #camp-ui textarea, #camp-ui input, #camp-ui button, #camp-ui a, .cg-open, [data-touch-ui]');
  window.addEventListener('touchstart', (e) => {
    if (!C.state.running || C.state.paused) return;            // the field guide open: let it scroll
    for (const t of e.changedTouches) {
      if (lookId === null && !inUI(t.target)) { lookId = t.identifier; lx = t.clientX; ly = t.clientY; e.preventDefault(); }
    }
  }, { passive: false });
  window.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) { e.preventDefault(); move(t); }
      else if (t.identifier === lookId) {
        e.preventDefault();
        const p = C.player;
        p.yaw -= (t.clientX - lx) * LOOK_RATE;
        p.pitch = Math.max(-1.35, Math.min(1.35, p.pitch - (t.clientY - ly) * LOOK_RATE));
        lx = t.clientX; ly = t.clientY;
      }
    }
  }, { passive: false });
  function end(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) { stickId = null; jx = jy = 0; setMove(); }
      if (t.identifier === lookId) lookId = null;
    }
  }
  window.addEventListener('touchend', end);
  window.addEventListener('touchcancel', end);

  function releaseAll() { for (const c of [...held]) send(c, false); stickId = lookId = null; jx = jy = 0; setMove(); root.querySelectorAll('.down').forEach((b) => b.classList.remove('down')); }
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });

  C.use({
    name: 'touch', order: 3,
    frame() {
      const show = C.state.running && !document.querySelector('#camp-ui .overlay:not(.hidden)');
      root.classList.toggle('on', show);
      if (!show) { if (held.size || stickId !== null) releaseAll(); return; }
      syncContext();
    },
    onDawn() { releaseAll(); },
  });
  C.test.touch = () => ({ on: root.classList.contains('on'), held: [...held], ctx: [...ctx.children].map((b) => b.dataset.code),
    stick: [jx, jy], scale: typeof PERF === 'object' ? [PERF.scale, PERF.minScale, PERF.maxScale] : null });
  C.test.touchKey = (code, down) => send(code, down);
})();
