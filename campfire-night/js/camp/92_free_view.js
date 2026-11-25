// © 2026 George Moussa. All rights reserved.
// ============================================================================
// CAMP 92. FREE VIEW: sitting on the stump, V lifts the camera out of your eyes onto a free orbit around you.
//     Same key as third person (90 hands V over while you sit). The mouse (or a touch drag) orbits, the wheel zooms.
//     The body is the studio's own George, already seated on the stump every frame by the studio loop (14):
//     the core hides the cast each frame, this module's frame shows it again while the camera is out.
//     The orbit reads player.yaw / pitch, so when you go back to your eyes you look the way the camera faced.
//     Held things (Camp.vm, on the eye) are hidden while the camera is out: they would float where your head is.
//     Everything else still sees from the eye (Camp.head). The choice is remembered (localStorage, a view preference only).
// ============================================================================
(function () {
  if (!window.Camp) return;
  const C = Camp;
  const LOOK = { dist: 2.6, min: 0.9, max: 7, chest: 0.32, minY: 0.25, showBodyOver: 0.45 };
  const KEY = 'innerwork.camp.free';
  let free = false;
  try { free = localStorage.getItem(KEY) === '1'; } catch (e) {}

  let blend = 0, dist = LOOK.dist, zoom = LOOK.dist;
  const center = new THREE.Vector3(), fwd = new THREE.Vector3(), orbit = new THREE.Vector3(), look = new THREE.Vector3(), tmp = new THREE.Vector3();

  function setFree(on, quiet) {
    free = on;
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {}
    if (!quiet) C.toast(on ? 'Free view. Move the mouse to look around, the wheel to zoom. V for your own eyes.' : 'Your own eyes.');
  }
  const active = () => free && C.state.running && !C.state.paused && C.player.sitting;

  window.addEventListener('wheel', (e) => {
    if (!active()) return;
    e.preventDefault();
    zoom = Math.max(LOOK.min, Math.min(LOOK.max, zoom * Math.exp(e.deltaY * 0.0015)));
  }, { passive: false });

  C.use({
    name: 'free_view', order: 92,
    reset() { blend = 0; dist = zoom = LOOK.dist; },
    key(e) {
      if (e.code !== 'KeyV' || !C.player.sitting) return false;
      if (e.type === 'keydown' && !e.repeat && C.state.running && !C.state.paused) setFree(!free);
      return true;
    },
    seatHint() { return free ? '<b>V</b> your eyes' : '<b>V</b> free view'; },
    frame(dt) {
      const want = active() ? 1 : 0;
      blend += (want - blend) * (1 - Math.exp(-dt * (want ? 4 : 7)));
      if (blend < 0.002) blend = 0;
      dist += (zoom - dist) * (1 - Math.exp(-dt * 8));
      const show = blend > 0 && C.player.sitting && dist * blend > LOOK.showBodyOver;
      if (show && typeof xbotHumanModel !== 'undefined' && xbotHumanModel) {
        xbotHumanModel.visible = true;
        if (typeof georgeContactShadow !== 'undefined') georgeContactShadow.visible = true;
      }
      if (show) C.vm.visible = false;
    },
    view() {
      if (blend <= 0) return false;
      const P = C.player, S = C.SEAT, cam = C.camera;
      center.set(S.x, terrainY(S.x, S.z) + S.eye - LOOK.chest, S.z);
      fwd.set(-Math.sin(P.yaw) * Math.cos(P.pitch), Math.sin(P.pitch), -Math.cos(P.yaw) * Math.cos(P.pitch));
      orbit.copy(center).addScaledVector(fwd, -dist);
      const floor = terrainY(orbit.x, orbit.z) + LOOK.minY;
      if (orbit.y < floor) orbit.y = floor;
      // ease from wherever the camera is now (the eye, or 90's shoulder camera) to the orbit
      look.set(0, 0, -1).applyQuaternion(cam.quaternion).add(cam.position);
      cam.position.lerp(orbit, blend);
      look.lerp(tmp.copy(center).add(fwd), blend);
      controls.target.copy(look);
      desiredCamPos.copy(cam.position); desiredCamTarget.copy(look);
      cam.lookAt(look);
      return true;
    }
  });
  C.test.freeView = (on) => { if (on !== undefined) setFree(!!on, true); return { free, active: active(), blend: +blend.toFixed(3), dist: +dist.toFixed(2), george: !!(typeof xbotHumanModel !== 'undefined' && xbotHumanModel && xbotHumanModel.visible) }; };
})();
