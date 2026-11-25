// © 2026 George Moussa. All rights reserved.
// ---- 20G. SKY CATALOGUE ----------------------------------------------------------
// The stars the 20E sky does not draw itself (J2000, rounded), shared by Campfire Night's star finder (camp/62) and the
// Night Skills reels (20n), so the game and the reels show one sky. Moved here from camp/62 on Nov 24 2026.
//   NSKY_EXTRA[name] = [RA hours, Dec degrees, magnitude]     NSKY_PLANETS[name] = [RA, Dec, mag, rgb] (kind 4: no twinkle)
//   nskyExtraPts: one point cloud on 20E's own uniforms (it turns and fades with the sky); invisible until a user shows it.
//   NSKY_COL: true star colours, mixed in by the sky key `col` (0 = every star the same blue-white, as before).
// Sky keys added (cue { sky: {...} }, see 20E): `col` 0..1 true colours · `twk` 0..1 strong twinkling, most near the
// horizon (planets stay steady) · `pl` 0..1 the planets fade in.
const NSKY_EXTRA = {
  Alcor: [13.420, 54.988, 4.0],
  Arcturus: [14.261, 19.182, -0.05], Izar: [14.750, 27.074, 2.4], Muphrid: [13.911, 18.398, 2.7], Seginus: [14.535, 38.308, 3.0], Nekkar: [15.032, 40.390, 3.5], DeltaBoo: [15.258, 33.315, 3.5],
  EpsLyr: [18.739, 39.670, 4.7], ZetaLyr: [18.746, 37.605, 4.4], Sheliak: [18.835, 33.363, 3.5], Sulafat: [18.982, 32.690, 3.3], DeltaLyr: [18.908, 36.899, 4.3],
  Sadr: [20.370, 40.257, 2.2], Gienah: [20.770, 33.970, 2.5], DeltaCyg: [19.750, 45.131, 2.9], Albireo: [19.512, 27.960, 3.1], EtaCyg: [19.938, 35.083, 3.9],
  Altair: [19.846, 8.868, 0.76], Tarazed: [19.771, 10.613, 2.7], Alshain: [19.922, 6.407, 3.7], ZetaAql: [19.090, 13.863, 3.0], DeltaAql: [19.425, 3.115, 3.4], ThetaAql: [20.188, -0.821, 3.2], LambdaAql: [19.104, -4.883, 3.4],
  Markab: [23.079, 15.205, 2.5], Scheat: [23.063, 28.083, 2.4], Algenib: [0.220, 15.184, 2.8], Alpheratz: [0.140, 29.091, 2.1], Enif: [21.736, 9.875, 2.4], Homam: [22.691, 10.831, 3.4],
  DeltaAnd: [0.655, 30.861, 3.3], Mirach: [1.162, 35.621, 2.1], Almach: [2.065, 42.330, 2.1], MuAnd: [0.946, 38.499, 3.9], NuAnd: [0.830, 41.079, 4.5], M31: [0.712, 41.269, 3.6],
  Mirfak: [3.405, 49.861, 1.8], Algol: [3.136, 40.956, 2.1], DeltaPer: [3.715, 47.788, 3.0], EpsPer: [3.964, 40.010, 2.9], GammaPer: [3.080, 53.506, 2.9], ZetaPer: [3.902, 31.884, 2.9], EtaPer: [2.845, 55.896, 3.8],
  Alcyone: [3.791, 24.105, 2.9], Atlas: [3.819, 24.053, 3.6], Electra: [3.749, 24.113, 3.7], Maia: [3.763, 24.368, 3.9], Merope: [3.772, 23.948, 4.2], Taygeta: [3.754, 24.467, 4.3], Pleione: [3.819, 24.137, 5.1],
  Aldebaran: [4.599, 16.509, 0.86], Theta2Tau: [4.478, 15.871, 3.4], GammaTau: [4.330, 15.628, 3.7], Delta1Tau: [4.383, 17.543, 3.8], EpsTau: [4.477, 19.180, 3.5], Elnath: [5.438, 28.608, 1.65], ZetaTau: [5.627, 21.143, 3.0],
  Menkalinan: [5.992, 44.948, 1.9], ThetaAur: [5.995, 37.213, 2.6], Hassaleh: [4.950, 33.166, 2.7], Almaaz: [5.032, 43.823, 3.0],
  Betelgeuse: [5.919, 7.407, 0.5], Rigel: [5.242, -8.202, 0.13], Bellatrix: [5.419, 6.350, 1.64], Saiph: [5.796, -9.670, 2.06], Alnitak: [5.679, -1.943, 1.77], Alnilam: [5.604, -1.202, 1.69], Mintaka: [5.533, -0.299, 2.23], Meissa: [5.585, 9.934, 3.4], M42: [5.588, -5.391, 4.0],
  Castor: [7.577, 31.889, 1.58], Pollux: [7.755, 28.026, 1.14], Alhena: [6.629, 16.399, 1.9], Mebsuta: [6.732, 25.131, 3.0], Tejat: [6.383, 22.514, 2.9], Wasat: [7.335, 21.982, 3.5],
  Sirius: [6.752, -16.716, -1.46], Mirzam: [6.378, -17.956, 1.98],
  Fomalhaut: [22.961, -29.622, 1.16],
  Eltanin: [17.943, 51.489, 2.2], Rastaban: [17.507, 52.301, 2.8], Grumium: [17.892, 56.873, 3.75]
};
// Planets for the reels' dates (December 2026 evenings). Saturn: in Pisces near the Cetus border all autumn, about
// RA 0h40m, Dec +1°, magnitude about 0.5 (stationary in mid-December); approximate, good to a degree or two.
const NSKY_PLANETS = { Saturn: [0.67, 1.2, 0.5, [1.0, 0.9, 0.7]] };
// True colours (rough, from spectral class) for the stars a reel names; anything not listed stays blue-white.
const NSKY_COL = {
  Betelgeuse: [1.0, 0.55, 0.32], Aldebaran: [1.0, 0.66, 0.40], Arcturus: [1.0, 0.72, 0.45], Antares: [1.0, 0.5, 0.3],
  Pollux: [1.0, 0.8, 0.55], Capella: [1.0, 0.92, 0.72], Rigel: [0.72, 0.82, 1.0], Bellatrix: [0.72, 0.82, 1.0],
  Saiph: [0.72, 0.82, 1.0], Alnitak: [0.72, 0.82, 1.0], Alnilam: [0.72, 0.82, 1.0], Mintaka: [0.72, 0.82, 1.0],
  Sirius: [0.86, 0.92, 1.0], Vega: [0.86, 0.92, 1.0], Kochab: [1.0, 0.74, 0.48]
};
NS_KEYS.push('col', 'twk', 'pl');
nskyMat.uniforms.uCol = { value: 0 }; nskyMat.uniforms.uPl = { value: 0 };
const nskyExtraNames = Object.keys(NSKY_EXTRA).filter((n) => NSKY_IDX[n] === undefined);
const nskyExtraPts = (function () {
  const names = nskyExtraNames.concat(Object.keys(NSKY_PLANETS)), n = names.length;
  const g = new THREE.BufferGeometry(), st = new Float32Array(n * 4), tw = new Float32Array(n), col = new Float32Array(n * 3);
  names.forEach((k, i) => {
    const pl = NSKY_PLANETS[k], s = pl || NSKY_EXTRA[k];
    st.set([s[0], s[1], s[2], pl ? 4 : 0], i * 4); tw[i] = (i * 0.618) % 1;
    col.set(pl ? pl[3] : (NSKY_COL[k] || [0, 0, 0]), i * 3);
  });
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('aStar', new THREE.BufferAttribute(st, 4)); g.setAttribute('aTw', new THREE.BufferAttribute(tw, 1));
  g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
  // 20E's shader plus a colour per star: same uniform objects, so it turns, fades and twinkles with the main cloud
  const vs = nskyMat.vertexShader.replace('attribute float aTw;', 'attribute float aTw; attribute vec3 aCol; uniform float uCol, uPl;')
    .replace(/\}\s*$/, '  vCol = mix(vCol, aCol, uCol * step(0.01, aCol.r + aCol.g + aCol.b));\n  vI *= mix(1.0, uPl, step(3.5, k));\n}');
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending,
    uniforms: nskyMat.uniforms, vertexShader: vs, fragmentShader: nskyMat.fragmentShader });
  const p = new THREE.Points(g, m); p.frustumCulled = false; p.renderOrder = -5; p.visible = false; scene.add(p);
  return p;
})();
// Same lookups as 20E's nskyDir, for any star or planet in either catalogue.
function nskyRaDec(name) {
  const i = NSKY_IDX[name]; if (i !== undefined) return [NSKY_NAMED[i][1], NSKY_NAMED[i][2], NSKY_NAMED[i][3]];
  return NSKY_EXTRA[name] || NSKY_PLANETS[name] || null;
}
function nskyDirAny(name, out) { const s = nskyRaDec(name); if (!s) return null; const aa = nskyAltAz(s[0], s[1], NSKY.lst); return nskyDirAltAz(aa[0], aa[1], out); }
const _gPre = nskyPre;
nskyPre = function () {
  _gPre();
  const now = performance.now(), u = nskyMat.uniforms;
  u.uCol.value = nsAt('col', now); u.uTwk.value = nsAt('twk', now); u.uPl.value = nsAt('pl', now);
};
