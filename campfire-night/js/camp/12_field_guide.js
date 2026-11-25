// © 2026 George Moussa. All rights reserved.
// CAMP 12. FIELD GUIDE: the camping game teaches what it shows. Lessons (13_lessons_camp.js, 14_lessons_sky.js) are
//     short pages that unlock when you do or see the real thing: feed a log, skip a stone, find Polaris. A page slides in
//     at the bottom left for a few seconds; G opens the whole guide (the night waits while it is open), with a hint for every
//     page not found yet. Which pages you have found is kept in localStorage['innerwork.camp.guide'] (page ids only:
//     nothing you write in the game ever goes near it).
//
// A lesson:
//   Camp.lesson({ id, topic, title, body,         // body: two or three short sentences (HTML ok)
//     tryIt?,                                       // one thing to try right now, shown under the body
//     safety?,                                      // true: a real-world safety page (marked, never skipped)
//     hint,                                         // how to find it, shown in the guide while it is still locked
//     sky?,                                         // a constellation id (62_star_finder): drawn while the page is up
//     on?, when?(data),                             // unlock on Camp.emit(on, data) when when(data) is true (or no when)
//     check?() })                                   // or unlock when check() is true (polled twice a second while the night runs)
//   Camp.learn(id) unlocks one by hand (a lesson's own listener may chain to another).
// Every fact in a page is checked before it lands (George's rule): see README "Facts checked".
(function () {
  if (!window.Camp) return;
  const C = Camp;
  const KEY = 'innerwork.camp.guide', CARD_MIN_MS = 9000, MS_PER_WORD = 330;
  const TOPICS = ['Fire', 'Camp craft', 'Water', 'Night life', 'Night air', 'Sky'];
  const lessons = [], byId = {};
  let learned = new Set(), fresh = new Set(), shownAt = 0, tonight = 0, queue = [], showing = null, hideAt = 0, open = false, pausedBy = false, pollT = 0;
  try { learned = new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify([...learned])); } catch (e) {} };

  C.css(`
    #cu-lesson { position: absolute; left: 16px; bottom: 16px; transform: translateY(12px); width: min(330px, calc(100vw - 32px));
      padding: 14px 16px 12px; opacity: 0; transition: opacity .5s, transform .5s; border-left: 3px solid #ffb35c; }
    #cu-lesson.on { opacity: 1; transform: none; }
    /* phones: the bottom corners belong to the joystick and E, so the page sits under the stats, clear of the buttons on the right */
    body.camp-touch #cu-lesson { bottom: auto; top: calc(196px + env(safe-area-inset-top)); left: calc(16px + env(safe-area-inset-left)); width: min(330px, calc(100vw - 96px)); }
    @media (orientation: landscape) and (max-height: 600px) { body.camp-touch #cu-lesson { top: calc(12px + env(safe-area-inset-top)); left: auto; right: calc(84px + env(safe-area-inset-right)); width: min(320px, 42vw); } }
    #cu-lesson .lt { font-size: 11px; letter-spacing: 1.4px; text-transform: uppercase; color: #ffb35c; }
    #cu-lesson.safe { border-left-color: #7fd18b; } #cu-lesson.safe .lt { color: #7fd18b; }
    #cu-lesson.sky { border-left-color: #9fc4ff; } #cu-lesson.sky .lt { color: #9fc4ff; }
    #cu-lesson h3 { margin: 4px 0 6px; font-size: 18px; font-weight: 700; }
    #cu-lesson p { margin: 0; color: #d9cbb4; font-size: 14px; }
    #cu-lesson .try { margin-top: 8px; color: #f3e7d3; font-size: 13px; }
    #cu-lesson .ft { margin-top: 8px; color: #8d826f; font-size: 11px; }
    #cu-guide .card { background: rgba(9,11,20,.95); max-width: 640px; width: 100%; max-height: calc(100vh - 32px); overflow: auto; text-align: left; padding: 20px 22px; }
    #cu-guide h1 { text-align: center; } #cu-guide .sub { text-align: center; color: #a99c88; margin: 0 0 10px; }
    #cu-guide h2 { font-size: 13px; letter-spacing: 1.4px; text-transform: uppercase; color: #ffb35c; margin: 18px 0 6px; display: flex; justify-content: space-between; }
    #cu-guide h2 span { color: #8d826f; letter-spacing: 0; text-transform: none; }
    #cu-guide .pg { padding: 8px 0; border-top: 1px solid rgba(255,255,255,.07); }
    #cu-guide .pg b { color: #f3e7d3; } #cu-guide .pg p { margin: 3px 0 0; color: #b9ad98; font-size: 13.5px; }
    #cu-guide .pg.locked b { color: #6f6656; } #cu-guide .pg.locked p { color: #8d826f; font-style: italic; }
    #cu-guide .pg .tag { font-size: 10px; letter-spacing: 1px; color: #7fd18b; margin-left: 6px; }
    #cu-guide .pg .tag.new { color: #ffb35c; }
    #cu-guide .where { color: #9fc4ff; font-style: normal; }
    #cu-guide .row2 { text-align: center; }
    #cu-guide button.ghost { background: transparent; color: #a99c88; border: 1px solid rgba(255,255,255,.18); margin-left: 8px; }`);
  C.ui.insertAdjacentHTML('beforeend', `
    <div id="cu-lesson" class="cu-panel"></div>
    <div id="cu-guide" class="overlay hidden"><div class="card cu-panel">
      <h1>Field Guide</h1><p class="sub" id="cu-g-sub"></p><div id="cu-g-list"></div>
      <div class="row2"><button id="cu-g-close">Back to the fire</button><button id="cu-g-reset" class="ghost">Forget pages</button></div>
    </div></div>`);
  const card = C.$('cu-lesson');

  function lesson(def) {
    if (byId[def.id]) { console.warn('[camp] two lessons named', def.id); return; }
    lessons.push(def); byId[def.id] = def;
    if (def.on) C.on(def.on, (d) => { if (!def.when || def.when(d)) learn(def.id); });
  }
  const rank = (l) => (l.topic === 'Sky' ? 2 : l.safety ? 1 : 0);      // sky pages are about where you are looking now
  const SKY_CUTS_AFTER_MS = 5000;                                    // a sky page may end a card that has been up this long (it stays in the guide)
  function learn(id) {
    const L = byId[id]; if (!L || learned.has(id)) return false;
    // Pages about what is in front of you right now go first: a constellation while you are looking at it, a safety page.
    // Among those, first come first served (Polaris before what it teaches).
    // Found the moment you do the thing: the guide and the count have it at once, even while its card waits its turn.
    learned.add(id); fresh.add(id); tonight++; save();
    const r = rank(L); let i = 0; while (i < queue.length && rank(queue[i]) >= r) i++; queue.splice(i, 0, L);
    return true;
  }
  const words = (L) => (L.title + ' ' + L.body + ' ' + (L.tryIt || '')).replace(/<[^>]+>/g, '').split(/\s+/).length;
  const typing = () => { const a = document.activeElement; return !!(a && a.closest && a.closest('#camp-ui textarea, #camp-ui input')); };
  function show(L) {
    showing = L; shownAt = performance.now();
    hideAt = performance.now() + Math.max(CARD_MIN_MS, words(L) * MS_PER_WORD);
    card.className = 'cu-panel on' + (L.safety ? ' safe' : L.topic === 'Sky' ? ' sky' : '');
    card.innerHTML = `<div class="lt">${L.safety ? 'Safety · ' : ''}${L.topic} · new page</div><h3>${L.title}</h3><p>${L.body}</p>`
      + (L.tryIt ? `<div class="try">Try: ${L.tryIt}</div>` : '') + `<div class="ft">${learned.size} of ${lessons.length} pages · G field guide</div>`;
    chime();
  }
  function hide() { showing = null; card.classList.remove('on'); hideAt = Math.min(hideAt, performance.now()); }   // the next page waits 1.2 s after this one goes
  function chime() {
    if (!C.sfx()) return; const t = audioCtx.currentTime + 0.02;
    C.tone(t, 660, 650, 0.9, 0.035, 'sine', -0.2); C.tone(t + 0.14, 990, 980, 1.2, 0.03, 'sine', 0.2);
  }

  // --- the whole guide (G) ---
  function render() {
    C.$('cu-g-sub').textContent = `${learned.size} of ${lessons.length} pages found. Pages unlock when you do the real thing.`;
    C.$('cu-g-list').innerHTML = TOPICS.map((t) => {
      const ls = lessons.filter((l) => l.topic === t); if (!ls.length) return '';
      const got = ls.filter((l) => learned.has(l.id)).length;
      return `<h2>${t} <span>${got} / ${ls.length}</span></h2>` + ls.map((l) => {
        if (learned.has(l.id)) return `<div class="pg"><b>${l.title}</b>${l.safety ? '<span class="tag">SAFETY</span>' : ''}${fresh.has(l.id) ? '<span class="tag new">NEW TONIGHT</span>' : ''}<p>${l.body}${l.tryIt ? ' <i>Try: ' + l.tryIt + '</i>' : ''}</p></div>`;
        const where = l.sky && C.sky && C.sky.where ? C.sky.where(l.sky) : '';
        return `<div class="pg locked"><b>? ? ?</b><p>${l.hint}${where ? ` <span class="where">${where}</span>` : ''}</p></div>`;
      }).join('');
    }).join('');
  }
  function setOpen(v) {
    if (v === open) return; open = v;
    C.$('cu-guide').classList.toggle('hidden', !v);
    card.style.visibility = v ? 'hidden' : '';
    // opening the guide shows every page found, so cards still waiting their turn are dropped
    if (v) { queue = []; render(); document.exitPointerLock?.(); if (!C.state.paused) { C.state.paused = true; pausedBy = true; } }
    else if (pausedBy) { C.state.paused = false; pausedBy = false; }
  }
  C.$('cu-g-close').onclick = () => setOpen(false);
  const resetBtn = C.$('cu-g-reset'); let resetArm = 0;               // two clicks: forgetting every page should not be an accident
  resetBtn.onclick = () => {
    if (performance.now() - resetArm > 4000) { resetArm = performance.now(); resetBtn.textContent = 'Sure? Click again'; setTimeout(() => { resetBtn.textContent = 'Forget pages'; }, 4000); return; }
    learned.clear(); fresh.clear(); save(); render(); resetArm = 0; resetBtn.textContent = 'Forget pages';
  };

  const mod = C.use({
    name: 'field-guide', order: 12,
    how: 'Your <b>field guide</b> (<b data-touch="Guide">G</b>) fills in as you go.',
    keys: 'G field guide',
    reset() { tonight = 0; fresh.clear(); queue = []; hide(); setOpen(false); },
    key(e) {
      if (e.code !== 'KeyG' && !(open && e.code === 'Escape')) return false;
      if (typing()) return false;
      if (e.type === 'keydown' && !e.repeat && (C.state.running || open)) setOpen(e.code === 'Escape' ? false : !open);
      return true;
    },
    tick(dt) {
      pollT += dt;
      if (pollT > 0.5 && !C.state.paused) {
        pollT = 0;
        for (const L of lessons) if (L.check && !learned.has(L.id) && !queue.includes(L)) { try { if (L.check()) learn(L.id); } catch (e) {} }
      }
    },
    frame() {
      const now = performance.now();
      if (showing && queue.length && rank(queue[0]) === 2 && rank(showing) < 2 && now > shownAt + SKY_CUTS_AFTER_MS) { hide(); hideAt = now - 1200; }
      if (showing && (now > hideAt || !C.state.running)) hide();
      if (!showing && queue.length && C.state.running && !open && !typing() && now > hideAt + 1200) show(queue.shift());
    },
    hud: () => ({ label: 'Field guide', value: `${learned.size} / ${lessons.length}` }),
    moments: () => [tonight && (tonight === 1 ? 'one new page in your field guide' : `${tonight} new pages in your field guide`)].filter(Boolean)
  });
  C.lesson = lesson; C.learn = learn;
  C.guide = { showing: () => showing && showing.id, learned: (id) => learned.has(id), lessons, open: () => open };
  Object.assign(C.test, {
    guide: () => ({ learned: learned.size, total: lessons.length, tonight, queue: queue.map((l) => l.id), showing: showing && showing.id, open }),
    guideOpen: (v) => { setOpen(v === undefined ? !open : !!v); return open; },
    guideForget: () => { learned.clear(); fresh.clear(); save(); queue = []; hide(); return 0; },
    lessonIds: () => lessons.map((l) => l.id)
  });
  void mod;
})();
