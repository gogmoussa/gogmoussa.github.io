// © 2026 George Moussa. All rights reserved.
// ============================================================================
// 19. THE PROCESS MAP. Loads last (after 18_parts).
// A small card in explore mode that shows where things stand: the parts of George, the nights, the one thing
// in progress ("Now") and the last real step in each skill. Data: ../process.json, kept up to date by Claude
// (George never edits it). Click a built part to see it in the clearing; click a night to go to it.
//  19A  Styles + card + dock button (all made here, so studio.html only needs the script tag)
//  19B  Load process.json and draw
//  19C  IW.process() / IW.map()
// ============================================================================

// --- 19A. STYLES + CARD + DOCK BUTTON ---
const MAP_KEY = 'innerwork.map';
let processData = null;
let mapOpen = false;
try { mapOpen = localStorage.getItem(MAP_KEY) === '1'; } catch (err) { /* private window: stay closed */ }

(function buildProcessMap() {
  const css = document.createElement('style');
  css.textContent = `
    #process-map { display: none; position: absolute; left: 14px; top: 14px; z-index: 20; max-width: min(430px, calc(100vw - 28px));
      max-height: calc(100vh - 150px); overflow: auto; padding: 12px 14px; background: var(--glass); backdrop-filter: blur(14px);
      border: 1px solid var(--border); border-radius: 16px; color: var(--ink); font-size: 12px; line-height: 1.5; }
    body.explore #process-map.open { display: block; }
    body.clean #process-map, body.recording #process-map { display: none !important; }
    #process-map h4 { margin: 0 0 4px; font: 600 10px "SF Mono", Menlo, monospace; letter-spacing: 0.12em; color: var(--dim); }
    #process-map .pm-cols { display: flex; flex-wrap: wrap; gap: 6px 22px; }
    #process-map .pm-row { display: flex; gap: 8px; align-items: baseline; padding: 1px 4px; margin: 0 -4px; border-radius: 6px; }
    #process-map .pm-row.go { cursor: pointer; }
    #process-map .pm-row.go:hover { background: rgba(255, 255, 255, 0.08); }
    #process-map .pm-row.dim .pm-name { color: var(--dim); }
    #process-map .pm-row.shown .pm-name { color: var(--gold); }
    #process-map .pm-stage { margin-left: auto; padding-left: 10px; color: var(--dim); font: 500 10.5px "SF Mono", Menlo, monospace; white-space: nowrap; }
    #process-map .pm-now { margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--border); }
    #process-map .pm-now b { color: var(--gold); font-weight: 600; }
    #process-map .pm-skills { margin-top: 8px; color: var(--dim); font-size: 11px; }
    #process-map .pm-skills span { color: var(--ink); }
  `;
  document.head.appendChild(css);

  const card = document.createElement('div');
  card.id = 'process-map';
  const dock = document.getElementById('explore-dock');
  (dock && dock.parentNode ? dock.parentNode : document.body).appendChild(card);

  const rows = dock ? dock.querySelectorAll('.xd-row') : [];
  if (rows.length) {
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.id = 'xd-map';
    btn.style.display = 'none'; // shown once process.json has loaded
    btn.title = 'Where things stand: parts, nights and what is in progress';
    btn.textContent = '🗺 Map';
    btn.onclick = () => { setMap(); btn.blur(); };
    rows[rows.length - 1].appendChild(btn);
  }
})();

function setMap(on) {
  mapOpen = on == null ? !mapOpen : !!on;
  try { localStorage.setItem(MAP_KEY, mapOpen ? '1' : '0'); } catch (err) { /* not saved, still works */ }
  const card = document.getElementById('process-map'), btn = document.getElementById('xd-map');
  if (card) card.classList.toggle('open', mapOpen && !!processData);
  if (btn) btn.classList.toggle('on', mapOpen);
  if (mapOpen) drawProcessMap();
  return mapOpen;
}

// --- 19B. LOAD + DRAW ---
const pmEsc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function drawProcessMap() {
  const card = document.getElementById('process-map');
  if (!card || !processData) return;
  const d = processData;
  const parts = (d.parts || []).map((p) => {
    const can = typeof PARTS !== 'undefined' && PARTS[p.id] && PARTS[p.id].built; // only parts with a figure can be visited
    const shown = typeof partShown !== 'undefined' && partShown === p.id;
    const stage = p.note ? `${p.stage} · ${p.note}` : p.stage;
    return `<div class="pm-row${can ? ' go' : ''}${p.stage === 'seen' ? ' dim' : ''}${shown ? ' shown' : ''}"${can ? ` data-part="${pmEsc(p.id)}"` : ''}>` +
      `<span class="pm-name">${p.stage === 'seen' ? '○' : '●'} ${pmEsc(p.label)}</span><span class="pm-stage">${pmEsc(stage)}</span></div>`;
  }).join('');
  const nights = (d.nights || []).map((n) =>
    `<div class="pm-row go" data-night="${Number(n.n)}"><span class="pm-name">${Number(n.n)} · ${pmEsc(n.title)}</span><span class="pm-stage">${pmEsc(n.stage)}</span></div>`).join('');
  const skills = (d.skills || []).map((s) => {
    const last = (s.steps || [])[(s.steps || []).length - 1];
    return `<div>${pmEsc(s.label)}: <span>${last ? pmEsc(last.text) : '—'}</span></div>`;
  }).join('');
  card.innerHTML =
    `<div class="pm-cols"><div><h4>PARTS</h4>${parts}</div><div><h4>NIGHTS</h4>${nights}</div></div>` +
    (d.now ? `<div class="pm-now"><b>Now:</b> ${pmEsc(d.now)}</div>` : '') +
    (skills ? `<div class="pm-skills">${skills}</div>` : '');
  card.querySelectorAll('[data-part]').forEach((el) => {
    el.onclick = () => { const id = el.dataset.part; showPart(partShown === id ? '' : id); drawProcessMap(); }; // click again to send it back
  });
  card.querySelectorAll('[data-night]').forEach((el) => {
    el.onclick = () => { if (window.IW) IW.go(parseInt(el.dataset.night, 10), 1); };
  });
}

function loadProcess() {
  return fetch('process.json', { cache: 'no-store' })
    .then((r) => { if (!r.ok) throw new Error('process.json ' + r.status); return r.json(); })
    .then((d) => {
      processData = d;
      const btn = document.getElementById('xd-map');
      if (btn) btn.style.display = '';
      setMap(mapOpen);
      return d;
    })
    .catch(() => null); // opened from file:// or the file is missing: no Map button, nothing else changes
}
if (!document.body.classList.contains('camp')) loadProcess();   // the map is a studio card; the camp hides it

// --- 19C. IW ---
if (window.IW) {
  IW.process = () => processData;                       // the data behind the map (null until loaded)
  IW.map = (on) => setMap(on);                          // IW.map(true | false) opens or closes it; IW.map() toggles
  IW.reloadProcess = () => loadProcess();               // after Claude edits process.json
}
