// © 2026 George Moussa. All rights reserved.
// CAMP 62. STAR FINDER: the real night sky, named. Look up and hold your gaze on a constellation for a moment: its
//     lines draw in and its name appears; hold a little longer and Camp.emit('sky', { id }) tells the field guide you
//     found it. K draws every constellation that is up (a star chart). Once you have found Polaris tonight, a small N
//     sits on the horizon below it. Looking up, a heading reads out at the top ("NE · 35° up").
//
//     The sky is the "Find north" sky (20E: NSKY, latitude 45° N, north along +z, one sidereal hour per hour of night,
//     sidereal time 20 h at 21:00, which is an early-September evening). 20E draws the Dippers, Cassiopeia and a few
//     bright stars; the rest of the stars its constellations need (J2000 positions, rounded)
//     live in js/20g_sky_catalogue.js (NSKY_EXTRA, nskyExtraPts), shared with the Night Skills reels so both show one sky.
//
//     Everything is drawn on a 2D canvas after the frame is rendered (its own requestAnimationFrame), projected through
//     the camera as it was drawn, so the lines sit on the stars in first and third person alike.
(function () {
  if (!window.Camp || typeof NSKY === 'undefined' || typeof nskyAltAz !== 'function') return;
  const C = Camp, D2R = Math.PI / 180;
  // name, RA hours, Dec degrees, magnitude (stars 20E already draws keep its names and are not added twice)
  const S = NSKY_EXTRA; // shared with the Night Skills reels: js/20g_sky_catalogue.js
  const radec = (n) => { const i = NSKY_IDX[n]; if (i !== undefined) return [NSKY_NAMED[i][1], NSKY_NAMED[i][2], NSKY_NAMED[i][3]]; return S[n]; };
  // id, name, a short line, stars (gaze targets), lines (pairs), r (how close the gaze must come, degrees)
  const CONS = [
    { id: 'dipper', name: 'Big Dipper', sub: 'part of Ursa Major, the Great Bear', stars: ['Dubhe', 'Merak', 'Phecda', 'Megrez', 'Alioth', 'Mizar', 'Alkaid', 'Alcor'], lines: NSKY_DIPPER },
    { id: 'polaris', name: 'Polaris', sub: 'the North Star', stars: ['Polaris'], lines: [], r: 4, guide: [['Merak', 'Dubhe', 'Polaris']] },
    { id: 'littledipper', name: 'Little Dipper', sub: 'Ursa Minor, the Little Bear', stars: ['Polaris', 'Yildun', 'EpsUMi', 'ZetaUMi', 'Kochab', 'Pherkad', 'EtaUMi'],
      lines: [['Polaris', 'Yildun'], ['Yildun', 'EpsUMi'], ['EpsUMi', 'ZetaUMi'], ['ZetaUMi', 'Kochab'], ['Kochab', 'Pherkad'], ['Pherkad', 'EtaUMi'], ['EtaUMi', 'ZetaUMi']] },
    { id: 'cassiopeia', name: 'Cassiopeia', sub: 'the Queen, a W in the sky', stars: ['Caph', 'Schedar', 'GammaCas', 'Ruchbah', 'Segin'], lines: [['Caph', 'Schedar'], ['Schedar', 'GammaCas'], ['GammaCas', 'Ruchbah'], ['Ruchbah', 'Segin']] },
    { id: 'thuban', name: 'Thuban', sub: 'in Draco, the Dragon', stars: ['Thuban'], lines: [], r: 4 },
    { id: 'draco', name: 'Head of Draco', sub: 'the Dragon', stars: ['Eltanin', 'Rastaban', 'Grumium'], lines: [['Eltanin', 'Rastaban'], ['Rastaban', 'Grumium'], ['Grumium', 'Eltanin']] },
    { id: 'bootes', name: 'Boötes & Arcturus', sub: 'the Herdsman', stars: ['Arcturus', 'Izar', 'Muphrid', 'Seginus', 'Nekkar', 'DeltaBoo'],
      lines: [['Arcturus', 'Izar'], ['Izar', 'DeltaBoo'], ['DeltaBoo', 'Nekkar'], ['Nekkar', 'Seginus'], ['Seginus', 'Arcturus'], ['Arcturus', 'Muphrid']], guide: [['Alioth', 'Mizar', 'Alkaid', 'Arcturus']] },
    { id: 'lyra', name: 'Lyra & Vega', sub: 'the Lyre', stars: ['Vega', 'EpsLyr', 'ZetaLyr', 'Sheliak', 'Sulafat', 'DeltaLyr'],
      lines: [['Vega', 'EpsLyr'], ['Vega', 'ZetaLyr'], ['ZetaLyr', 'Sheliak'], ['Sheliak', 'Sulafat'], ['Sulafat', 'DeltaLyr'], ['DeltaLyr', 'ZetaLyr']] },
    { id: 'cygnus', name: 'Cygnus & Deneb', sub: 'the Swan, or the Northern Cross', stars: ['Deneb', 'Sadr', 'Gienah', 'DeltaCyg', 'Albireo', 'EtaCyg'],
      lines: [['Deneb', 'Sadr'], ['Sadr', 'EtaCyg'], ['EtaCyg', 'Albireo'], ['DeltaCyg', 'Sadr'], ['Sadr', 'Gienah']] },
    { id: 'aquila', name: 'Aquila & Altair', sub: 'the Eagle', stars: ['Altair', 'Tarazed', 'Alshain', 'ZetaAql', 'DeltaAql', 'ThetaAql', 'LambdaAql'],
      lines: [['Tarazed', 'Altair'], ['Altair', 'Alshain'], ['Alshain', 'ThetaAql'], ['Altair', 'DeltaAql'], ['DeltaAql', 'LambdaAql'], ['DeltaAql', 'ZetaAql']] },
    { id: 'triangle', name: 'Summer Triangle', sub: 'Vega, Deneb and Altair', stars: [], lines: [['Vega', 'Deneb'], ['Deneb', 'Altair'], ['Altair', 'Vega']], noGaze: true },
    { id: 'pegasus', name: 'Great Square of Pegasus', sub: 'the Winged Horse', stars: ['Markab', 'Scheat', 'Algenib', 'Alpheratz', 'Enif', 'Homam'],
      lines: [['Markab', 'Scheat'], ['Scheat', 'Alpheratz'], ['Alpheratz', 'Algenib'], ['Algenib', 'Markab'], ['Markab', 'Homam'], ['Homam', 'Enif']] },
    { id: 'andromeda', name: 'Andromeda', sub: 'and the Andromeda Galaxy', stars: ['Alpheratz', 'DeltaAnd', 'Mirach', 'Almach', 'MuAnd', 'NuAnd', 'M31'],
      lines: [['Alpheratz', 'DeltaAnd'], ['DeltaAnd', 'Mirach'], ['Mirach', 'Almach'], ['Mirach', 'MuAnd'], ['MuAnd', 'NuAnd']], mark: 'M31' },
    { id: 'perseus', name: 'Perseus', sub: 'the Hero, with Algol', stars: ['Mirfak', 'Algol', 'DeltaPer', 'EpsPer', 'GammaPer', 'ZetaPer', 'EtaPer'],
      lines: [['EtaPer', 'GammaPer'], ['GammaPer', 'Mirfak'], ['Mirfak', 'DeltaPer'], ['DeltaPer', 'EpsPer'], ['EpsPer', 'ZetaPer'], ['Mirfak', 'Algol']] },
    { id: 'pleiades', name: 'Pleiades', sub: 'the Seven Sisters', stars: ['Alcyone', 'Atlas', 'Electra', 'Maia', 'Merope', 'Taygeta', 'Pleione'], lines: [], r: 4, ring: true },
    { id: 'auriga', name: 'Auriga & Capella', sub: 'the Charioteer', stars: ['Capella', 'Menkalinan', 'ThetaAur', 'Hassaleh', 'Almaaz', 'Elnath'],
      lines: [['Capella', 'Menkalinan'], ['Menkalinan', 'ThetaAur'], ['ThetaAur', 'Elnath'], ['Elnath', 'Hassaleh'], ['Hassaleh', 'Almaaz'], ['Almaaz', 'Capella']] },
    { id: 'taurus', name: 'Taurus & Aldebaran', sub: 'the Bull', stars: ['Aldebaran', 'Theta2Tau', 'GammaTau', 'Delta1Tau', 'EpsTau', 'Elnath', 'ZetaTau'],
      lines: [['ZetaTau', 'Aldebaran'], ['Aldebaran', 'Theta2Tau'], ['Theta2Tau', 'GammaTau'], ['GammaTau', 'Delta1Tau'], ['Delta1Tau', 'EpsTau'], ['EpsTau', 'Elnath']] },
    { id: 'orion', name: 'Orion', sub: 'the Hunter', stars: ['Betelgeuse', 'Rigel', 'Bellatrix', 'Saiph', 'Alnitak', 'Alnilam', 'Mintaka', 'Meissa', 'M42'],
      lines: [['Meissa', 'Betelgeuse'], ['Meissa', 'Bellatrix'], ['Betelgeuse', 'Alnitak'], ['Bellatrix', 'Mintaka'], ['Mintaka', 'Alnilam'], ['Alnilam', 'Alnitak'], ['Alnitak', 'Saiph'], ['Mintaka', 'Rigel']], mark: 'M42' },
    { id: 'gemini', name: 'Gemini', sub: 'the Twins, Castor and Pollux', stars: ['Castor', 'Pollux', 'Alhena', 'Mebsuta', 'Tejat', 'Wasat'],
      lines: [['Castor', 'Mebsuta'], ['Mebsuta', 'Tejat'], ['Pollux', 'Wasat'], ['Wasat', 'Alhena'], ['Castor', 'Pollux']] },
    { id: 'sirius', name: 'Sirius', sub: 'the Dog Star, in Canis Major', stars: ['Sirius', 'Mirzam'], lines: [['Sirius', 'Mirzam']], r: 5 },
    { id: 'fomalhaut', name: 'Fomalhaut', sub: 'the lonely star of autumn', stars: ['Fomalhaut'], lines: [], r: 5 }
  ];
  const byId = {}; CONS.forEach((c) => { byId[c.id] = c; c.r = c.r || 7; });
  for (const c of CONS) for (const n of c.stars.concat(...c.lines)) if (!radec(n)) console.warn('[camp] star finder: no star', n);

  // --- the stars 20E does not draw: a second cloud on its material ---
  const extraPts = nskyExtraPts; // the shared cloud of the stars 20E does not draw (js/20g_sky_catalogue.js)

  // --- sky maths (the same as 20E) ---
  const altaz = (n, lst) => { const s = radec(n); return nskyAltAz(s[0], s[1], lst === undefined ? NSKY.lst : lst); };
  const dirOf = (n, out) => { const a = altaz(n); return nskyDirAltAz(a[0], a[1], out); };
  const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const compass = (az) => COMPASS[Math.round((((az / D2R) % 360) + 360) % 360 / 45) % 8];
  const centre = (c) => (c.stars.length ? c.stars : [].concat(...c.lines));
  function centreAltAz(c, lst) {                                    // the average direction of its stars
    const v = new THREE.Vector3(), t = new THREE.Vector3();
    for (const n of centre(c)) { const a = altaz(n, lst); v.add(nskyDirAltAz(a[0], a[1], t)); }
    v.normalize();
    const E = new THREE.Vector3().crossVectors(NSKY.north, new THREE.Vector3(0, 1, 0)).normalize();
    return [Math.asin(v.y), Math.atan2(v.dot(E), v.dot(NSKY.north))];
  }
  const lstAt = (min) => NSKY.lst0 + min / 60;
  const clock = (min) => { const t = (C.T.START_MIN + min) % 1440; return String(t / 60 | 0).padStart(2, '0') + ':' + String(t % 60 | 0).padStart(2, '0'); };
  // A hint for the field guide: where it is now, or when it rises / whether it sets
  function where(id) {
    const c = byId[id]; if (!c) return '';
    const m = C.state.minutes, [alt, az] = centreAltAz(c, lstAt(m));
    if (alt > 3 * D2R) return `Now: ${compass(az)}, ${Math.round(alt / D2R)}° up.`;
    for (let t = m + 10; t <= C.T.NIGHT_MIN; t += 10) { const a = centreAltAz(c, lstAt(t)); if (a[0] > 8 * D2R) return `Below the horizon now. Up in the ${compass(a[1])} by about ${clock(t)}.`; }
    return 'Not up again before dawn tonight.';
  }

  // --- the overlay ---
  const cv = document.createElement('canvas'); cv.id = 'cu-sky';
  cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
  C.ui.insertBefore(cv, C.ui.firstChild);
  const ctx = cv.getContext('2d');
  C.css(`#cu-head { position: absolute; left: 50%; top: 16px; transform: translateX(-50%); padding: 5px 14px; font-size: 13px; color: #cfe0ff;
    letter-spacing: .5px; opacity: 0; transition: opacity .4s; } #cu-head.on { opacity: 1; }`);
  C.ui.insertAdjacentHTML('beforeend', '<div id="cu-head" class="cu-panel"></div>');
  const headEl = C.$('cu-head');
  let told = false, chart = false, focus = null, dwell = 0, show = {}, found = {}, foundAt = {}, headWas = '', drew = false;
  const P = new THREE.Vector3(), F = new THREE.Vector3(), tA = new THREE.Vector3();
  function scr(n, W, H) {
    dirOf(n, P); if (P.y < -0.02) return null;
    P.multiplyScalar(NSKY.R).add(camera.position).project(camera);
    if (P.z > 1 || P.z < -1) return null;
    return [(P.x + 1) / 2 * W, (1 - P.y) / 2 * H];
  }
  function label(s, x, y, fs, col, a) {
    ctx.globalAlpha = a; ctx.font = `700 ${fs}px ui-rounded, "SF Pro Rounded", system-ui, sans-serif`;
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(3,5,14,.75)'; ctx.strokeText(s, x, y); ctx.fillStyle = col; ctx.fillText(s, x, y);
  }
  function drawCons(c, a, W, H, m, lite) {
    if (a < 0.01) return;
    ctx.lineCap = 'round'; ctx.strokeStyle = lite ? '#8fb3e8' : '#bfe3ff'; ctx.lineWidth = Math.max(1.2, m * (lite ? 0.0016 : 0.0026));
    ctx.globalAlpha = a * (lite ? 0.45 : 0.8); ctx.shadowColor = '#9fc4ff'; ctx.shadowBlur = lite ? 0 : 6;
    ctx.beginPath();
    for (const [x, y] of c.lines) { const p = scr(x, W, H), q = scr(y, W, H); if (p && q) { ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); } }
    ctx.stroke(); ctx.shadowBlur = 0;
    if (!lite && c.guide && a > 0.3) {                               // pointer lines: Dubhe to Polaris, the Dipper's handle to Arcturus
      ctx.setLineDash([m * 0.008, m * 0.007]); ctx.strokeStyle = '#fbbf24'; ctx.globalAlpha = a * 0.75;
      for (const path of c.guide) { ctx.beginPath(); path.forEach((n, i) => { const p = scr(n, W, H); if (p) (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); }); ctx.stroke(); }
      ctx.setLineDash([]);
    }
    const pts = centre(c).map((n) => scr(n, W, H)).filter(Boolean); if (!pts.length) return;
    if (c.ring || c.stars.length === 1 || c.mark) {
      const p = c.mark ? scr(c.mark, W, H) : pts[0];
      if (p) { ctx.globalAlpha = a * 0.8; ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p[0], p[1], m * (c.ring ? 0.035 : 0.022), 0, 7); ctx.stroke(); }
    }
    let x = 0, y = 0, top = Infinity; for (const p of pts) { x += p[0]; y += p[1]; top = Math.min(top, p[1]); }
    x /= pts.length; y /= pts.length;
    const ly = c.stars.length <= 2 || c.ring ? top - m * 0.05 : y + m * 0.02;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    label(c.name, x, ly, Math.round(m * (lite ? 0.017 : 0.026)), lite ? '#b9cdf0' : '#ffffff', a * (lite ? 0.7 : 1));
    if (!lite) label(c.sub, x, ly + m * 0.03, Math.round(m * 0.016), '#cfe0ff', a * 0.85);
  }
  function draw(dt) {
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = Math.round(innerWidth * dpr), H = Math.round(innerHeight * dpr);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const up = C.state.running ? C.starsOut(C.state.minutes) : 0;
    camera.updateMatrixWorld(); camera.getWorldDirection(F);
    // the gaze: which constellation is nearest the middle of the view
    let best = null, bestA = Infinity;
    if (up > 0.45 && F.y > 0.05 && !C.state.paused) {
      for (const c of CONS) {
        if (c.noGaze) continue;
        for (const n of c.stars) { const a = altaz(n); if (a[0] < 2 * D2R) continue; const ang = nskyDirAltAz(a[0], a[1], tA).angleTo(F) / D2R, sc = ang / c.r + c.stars.length * 0.01; if (ang < c.r && sc < bestA) { bestA = sc; best = c; } }   // a single star (Polaris) wins over the pattern it sits in
      }
    }
    if (best !== focus) { focus = best; dwell = 0; } else if (focus) dwell += dt;
    if (focus && dwell > 1.6 && !found[focus.id]) { found[focus.id] = true; foundAt[focus.id] = C.state.minutes; C.emit('sky', { id: focus.id, alt: centreAltAz(focus)[0] / D2R }); maybeTriangle(); }
    const lessonSky = C.guide && C.guide.showing() && C.guide.lessons.find((l) => l.id === C.guide.showing());
    const want = {};
    for (const c of CONS) want[c.id] = (focus === c && dwell > 0.35) || (lessonSky && lessonSky.sky === c.id) ? 1 : 0;
    let any = false;
    for (const c of CONS) { const v = show[c.id] || 0, t = want[c.id]; show[c.id] = v + (t - v) * Math.min(1, dt * (t > v ? 3 : 1.5)); if (show[c.id] > 0.01) any = true; }
    // heading while you look up
    const looking = up > 0.2 && F.y > 0.25 && C.state.running && !C.state.paused;
    const E = tA.crossVectors(NSKY.north, camera.up).normalize();
    const h = looking ? `${compass(Math.atan2(F.dot(E), F.dot(NSKY.north)))} · ${Math.round(Math.asin(Math.min(1, F.y)) / D2R)}° up` : '';
    if (h !== headWas) { headWas = h; headEl.textContent = h; headEl.classList.toggle('on', !!h); }
    const north = found.polaris && up > 0.05;
    if (!any && !(chart && up > 0.05) && !north) { if (drew) { ctx.clearRect(0, 0, W, H); drew = false; } return; }
    ctx.clearRect(0, 0, W, H); drew = true;
    const m = Math.min(W, H) * 1.2;
    ctx.save();
    if (chart && up > 0.05) for (const c of CONS) if ((show[c.id] || 0) < 0.5 && centreAltAz(c)[0] > 0) drawCons(c, up, W, H, m, true);
    for (const c of CONS) drawCons(c, (show[c.id] || 0) * up, W, H, m, false);
    if (north) {                                                      // N on the horizon below Polaris
      const pa = altaz('Polaris'); nskyDirAltAz(0.01, pa[1], P); P.multiplyScalar(NSKY.R).add(camera.position).project(camera);
      if (P.z < 1 && P.z > -1) { ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; label('N', (P.x + 1) / 2 * W, (1 - P.y) / 2 * H - m * 0.02, Math.round(m * 0.03), '#fde68a', 0.85 * up); }
    }
    ctx.restore();
  }
  function maybeTriangle() {
    if (found.lyra && found.cygnus && found.aquila && !found.triangle) { found.triangle = true; foundAt.triangle = C.state.minutes; C.emit('sky', { id: 'triangle', alt: centreAltAz(byId.triangle)[0] / D2R }); }
  }
  let lastRaf = performance.now();
  (function loop(now) {
    const dt = Math.min(0.1, (now - lastRaf) / 1000 || 0); lastRaf = now;
    try { draw(dt); } catch (e) { console.warn('[camp] star finder', e); }
    requestAnimationFrame(loop);
  })(lastRaf);

  C.use({
    name: 'star-finder', order: 62,
    how: '<b>Look up</b> and hold your gaze: the constellations name themselves. <b data-touch="Stars">K</b> opens a star chart.',
    keys: 'K star chart',
    reset() { found = {}; foundAt = {}; focus = null; dwell = 0; show = {}; told = false; },
    key(e) {
      if (e.code !== 'KeyK') return false;
      const a = document.activeElement; if (a && a.closest && a.closest('#camp-ui textarea, #camp-ui input')) return false;
      if (e.type === 'keydown' && !e.repeat && C.state.running) { chart = !chart; C.toast(chart ? 'Star chart on. K to hide it.' : 'Star chart off.'); C.emit('chart', { on: chart }); }
      return true;
    },
    frame() {
      extraPts.visible = nskyPoints.visible;
      if (!told && C.state.running && !C.state.paused && C.starsOut(C.state.minutes) > 0.6) { told = true; C.toast('The stars are out. Look up and hold your gaze on them. K shows a star chart.'); }
    }
  });
  C.sky = { where, found: (id) => !!found[id], foundAt: (id) => foundAt[id], ids: CONS.map((c) => c.id), altaz: (id) => centreAltAz(byId[id]).map((r) => +(r / D2R).toFixed(1)) };
  Object.assign(C.test, {
    sky: () => ({ focus: focus && focus.id, dwell: +dwell.toFixed(2), chart, found: Object.keys(found), up: +C.starsOut(C.state.minutes).toFixed(2) }),
    skyUp: () => Object.fromEntries(CONS.map((c) => [c.id, C.sky.altaz(c.id)])),
    skyLook: (id) => { const [alt, az] = centreAltAz(byId[id]); nskyDirAltAz(alt, az, tA); C.player.yaw = Math.atan2(-tA.x, -tA.z); C.player.pitch = Math.max(-1.35, Math.min(1.35, alt)); return [+(alt / D2R).toFixed(1), compass(az)]; },
    chart: (v) => { chart = v === undefined ? !chart : !!v; return chart; }
  });
})();
