// © 2026 George Moussa. All rights reserved.
// Campfire Night's service worker (Nov 27 2026). tools/package_camp.sh copies this to the upload root and fills in
// VERSION (a hash of every file in the build) and FILES (every file the game loads, as the page asks for them).
// First visit: the game loads as usual, then this keeps a copy of every file. Later visits open from that copy at once,
// and the game plays with no signal. A new release has a new VERSION, so the browser installs it in the background;
// the night you are in keeps the old files and the next visit opens the new ones. Nothing is sent anywhere.
const VERSION = '653af4bd4981';
const FILES = ["./","index.html","studio.html","studio.html?camp","lib/three.min.js","lib/GLTFLoader.js","lib/OrbitControls.js","models/sanctuary_models.js?v=lite1","js/01_episodes.js?v=ep1hook1","js/02_textures.js?v=reel2","js/03_renderer_bloom.js?v=perf2","js/04_sky.js?v=perf4","js/05_camera_lighting.js?v=hearth2","js/05b_lake.js?v=pond1","js/06_water_island.js?v=hearth1","js/07_hearth_fire.js?v=hearth2","js/09_godray_dais.js?v=reel2","js/10f_procedural_bodies.js?v=thumb6b","js/10g_stylized_george.js?v=nose5","js/10h_cosmic_spirit.js?v=hearth1","js/10i_multitool.js?v=bake1","js/10_characters.js?v=rig1","js/11_resonance_stream.js?v=reel2","js/11b_natural_world.js?v=ring1","js/11c_capture_reel.js?v=perf2","js/12_audio.js?v=off1","js/13_ui_controls.js?v=camp404","js/14_animation_loop.js?v=skip1","js/15_reel_studio.js?v=camp404","js/16_explore_api.js?v=q1","js/20_moments.js?v=ns2","js/20g_sky_catalogue.js?v=ns2","js/camp/00_core.js?v=text1","js/camp/03_touch.js?v=text1","js/camp/04_quality.js?v=q1","js/camp/05_tent.js?v=text1","js/camp/08_feel.js?v=text1","js/camp/12_field_guide.js?v=text1","js/camp/13_lessons_camp.js?v=audit1","js/camp/14_lessons_sky.js?v=lt1","js/camp/10_fire_tending.js?v=card1","js/camp/20_wood.js?v=text1","js/camp/30_thoughts.js?v=text1","js/camp/35_witness.js?v=card1","js/camp/40_marshmallow.js?v=text1","js/camp/50_stones.js?v=text1","js/camp/55_fishing.js?v=feel1","js/camp/60_night_life.js?v=feel1","js/camp/62_star_finder.js?v=text1","js/camp/70_soundscape.js?v=step1","js/camp/75_smoke.js?v=wit1","js/camp/80_night_air.js?v=feel1","js/camp/82_warmth.js?v=feel1","js/camp/90_third_person.js?v=fv1","js/camp/92_free_view.js?v=fv1"];
const CACHE = 'campfire-night-' + VERSION;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('campfire-night-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    // exact URL first (scripts carry ?v=), then the page itself whatever its query (studio.html?camp, ./, index.html)
    const hit = await c.match(req) || (req.mode === 'navigate' ? await c.match(req, { ignoreSearch: true }) : null);
    if (hit) return hit;
    try { return await fetch(req); }
    catch (err) { const any = await c.match(req, { ignoreSearch: true }); if (any) return any; throw err; }
  })());
});
