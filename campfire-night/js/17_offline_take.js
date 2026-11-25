// © 2026 George Moussa. All rights reserved.
// ============================================================================
// 17. OFFLINE TAKE: render a reel frame by frame, not in real time
// ============================================================================
// Why: the desktop app's Browser pane (and any hidden or covered tab) draws at about 1 frame a second, so a real-time take
// (11c startTake) stalls and nothing can be judged by eye. Here the clock is virtual: performance.now() and setTimeout move
// exactly 1/fps per frame, animate() is called by hand, each frame goes straight into the browser's H.264 encoder
// (WebCodecs; one <name>.h264 file is saved at the end, no per-frame JPEGs or uploads), and the soundtrack
// (voice clips + the fire/wind bed, ducked under the voice) is rendered by an OfflineAudioContext. It comes out the same
// whether the pane is visible or not, and every frame can be looked at afterwards.
//
//   IW.render({ ep: 3 })                 full 1080x1920 (or 1920x1080) take at 30 fps
//   IW.render({ ep: 3, scale: 0.5 })     quick half-size check (540x960)
//   IW.render({ ep: 3, scale: 2, fps: 60 })   4K (2160x3840) at 60 fps, named <name>-2160p
//   IW.render({ ep: 3, maxSecs: 8 })     only the first 8 s
//   IW.renderState()                     { phase, frame, secs, beat, done, err, name, timeline }
//   IW.stopRender()
//   IW.render({ ep: 3, frames: true })   the old way: every frame as a JPEG in <name>.frames/ (also the fallback when
//                                        the browser has no H.264 encoder)
// Output in episodes/takes/: <name>.h264 (or <name>.frames/f00000.jpg…), <name>.wav, <name>.json (fps, size, beat and cut
// times, voice times). Then: python3 tools/finalize_take.py   (wraps the video and sound into <name>-final.mp4 without
// encoding the picture again, and removes the .h264). To look at single frames of a take:
//   ffmpeg -r 30 -i <name>.h264 -vf "select='eq(n,15)+eq(n,120)',tile=2x1" -frames:v 1 out.jpg
// Voice lines come from the saved clips in episodes/audio/epNN/; a line with no clip is silent and timed by reading speed.
// The chime option is not rendered.
let renderJob = null;

function wavBlob(buf) {
  const ch = Math.min(2, buf.numberOfChannels), n = buf.length, sr = buf.sampleRate;
  const out = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const str = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); out.setUint32(4, 36 + n * ch * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true); out.setUint32(24, sr, true);
  out.setUint32(28, sr * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true);
  str(36, 'data'); out.setUint32(40, n * ch * 2, true);
  const data = []; for (let c = 0; c < ch; c++) data.push(buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, data[c][i])); out.setInt16(o, v < 0 ? v * 32768 : v * 32767, true); o += 2; }
  return new Blob([out.buffer], { type: 'audio/wav' });
}

async function renderTake(o) {
  o = o || {};
  if (renderJob && !renderJob.done) return { error: 'a render is already running', frame: renderJob.frame };
  if (take) return { error: 'a take is already running' };
  if (!location.protocol.startsWith('http')) return { error: 'needs serve.py (http), not file://' };
  const fps = o.fps || 30, scale = o.scale || 1;
  const job = renderJob = { phase: 'prep', frame: 0, secs: 0, beat: 0, done: false, err: null, stop: false, name: null, timeline: [] };
  const real = { st: window.setTimeout, ct: window.clearTimeout, raf: window.requestAnimationFrame, speak: speakLine, sound: soundEnabled };
  // a task-queue yield that hidden pages do not throttle (their timers are held to 1 per second)
  const tick = () => new Promise((r) => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });
  let installed = false;
  try {
    if (uiMode !== 'studio') setUI('studio', { save: false });
    if (o.ep) IW.go(o.ep, 1);
    if (typeof o.vertical === 'boolean') IW.vertical(o.vertical);
    autoPlay = false;
    const vertical = document.body.classList.contains('vertical');
    const even = (x) => Math.round(x / 2) * 2;
    const W = even((vertical ? 1080 : 1920) * scale), H = even((vertical ? 1920 : 1080) * scale);
    const name = job.name = `inner-work-ep${curEpisodeIdx + 1}-${stamp()}${scale < 1 ? '-preview' : scale > 1 ? '-' + Math.min(W, H) + 'p' : ''}`; // smaller than full size is a check, larger says its size (-2160p)

    // Voice clips, decoded up front (needs an AudioContext; it may stay suspended, nothing has to play)
    if (!audioCtx) initAudio();
    const clips = new Map(), missing = [];
    for (const b of beats) {
      if (!b.text || !b.text.trim()) continue;
      const buf = await voiceboxClip(b);
      if (buf) clips.set(b, buf); else missing.push(b.text);
    }
    job.missingVoice = missing;

    // --- virtual clock, timers and voice ---
    let vt = performance.now();
    const t0 = vt, voiceLog = [], timers = new Map();
    let tid = 1e9;
    performance.now = () => vt;
    window.requestAnimationFrame = () => 0;
    window.setTimeout = (fn, ms, ...a) => { timers.set(++tid, { at: vt + (ms || 0), fn, a }); return tid; };
    window.clearTimeout = (id) => { if (!timers.delete(id)) real.ct.call(window, id); };
    speakLine = (beat) => {
      speechActive = false; lineVoice = null;
      const buf = beat.text && clips.get(beat);
      if (!buf) return;
      lineVoice = { start: vt, dur: buf.duration, words: buf.cueWords || null };
      speechActive = true; voiceMode = 'voicebox';
      voiceLog.push({ buf, t: (vt - t0) / 1000, dur: buf.duration, speaker: beat.speaker, text: beat.text });
    };
    installed = true;
    soundEnabled = true; // the beat pacing and cue timing follow the voice, as in a real take
    take = { phase: 'rec', auto: true, offline: true, startedAt: vt };
    renderSizeOverride = [W, H]; resizeRenderer();
    const rc = document.createElement('canvas'); rc.width = W; rc.height = H;
    const rctx = rc.getContext('2d');

    // --- video: the browser's own H.264 encoder, Annex B so the stream needs no muxer here (ffmpeg wraps it later) ---
    let enc = null, encErr = null, encBytes = 0;
    const chunks = [];
    if (!o.frames && window.VideoEncoder) {
      // about 16 Mbit/s at 1080x1920, scaled by area; High profile, level 5.1 covers every size used here
      const cfg = { codec: 'avc1.640033', width: W, height: H, framerate: fps, bitrate: Math.max(2e6, Math.round(16e6 * (W * H) / (1080 * 1920))),
        bitrateMode: 'variable', latencyMode: 'quality', avc: { format: 'annexb' } };
      let ok = false;
      try { ok = (await VideoEncoder.isConfigSupported(cfg)).supported; } catch (e) {}
      if (ok) {
        enc = new VideoEncoder({
          output: (chunk) => { const b = new Uint8Array(chunk.byteLength); chunk.copyTo(b); chunks.push(b); encBytes += b.length; },
          error: (e) => { encErr = e; }
        });
        enc.configure(cfg);
      }
    }
    job.video = enc ? 'h264' : 'frames';

    applyBeat(0);
    camera.position.copy(desiredCamPos); controls.target.copy(desiredCamTarget);
    camTransitionTime = 0; camFocus.snap = true;
    autoPlay = true; beatTimer = 0;
    clock.getDelta();

    job.phase = 'frames';
    const pending = new Set();
    let i = 0, lastBeat = -1, lastCut = -1, failed = 0;
    const maxFrames = Math.round((o.maxSecs || 180) * fps);
    for (;;) {
      vt += 1000 / fps;
      if (timers.size) for (const [id, tm] of [...timers].sort((a, b) => a[1].at - b[1].at)) if (tm.at <= vt) { timers.delete(id); try { tm.fn(...tm.a); } catch (e) { console.warn('[render] timer', e); } }
      if (lineVoice && lineVoice.end == null && vt >= lineVoice.start + lineVoice.dur * 1000) { lineVoice.end = lineVoice.start + lineVoice.dur * 1000; speechActive = false; }
      animate();
      rctx.drawImage(canvas, 0, 0, W, H);
      drawReelOverlay(rctx, W, H);
      const secs = i / fps;
      if (curBeatIdx !== lastBeat) { lastBeat = curBeatIdx; job.timeline.push({ t: +secs.toFixed(2), beat: curBeatIdx + 1 }); }
      if (lastCamCutAt !== lastCut) { lastCut = lastCamCutAt; job.timeline.push({ t: +secs.toFixed(2), cut: (document.getElementById('shot-label') || {}).textContent || true }); }
      if (enc) {
        if (encErr) throw encErr;
        const vf = new VideoFrame(rc, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
        enc.encode(vf, { keyFrame: i % (fps * 2) === 0 }); // a key frame every 2 s, so a cut-down copy can start anywhere near
        vf.close();
        while (enc.encodeQueueSize > 4) await tick(); // do not outrun the encoder
      } else {
        const blob = await new Promise((r) => rc.toBlob(r, 'image/jpeg', o.jpeg || 0.95));
        const p = fetch(`/api/save-frame/${name}/f${String(i).padStart(5, '0')}.jpg`, { method: 'POST', body: blob })
          .then((r) => { if (!r.ok) failed++; }).catch(() => { failed++; }).finally(() => pending.delete(p));
        pending.add(p);
        if (pending.size >= 6) await Promise.race(pending);
      }
      i++; job.frame = i; job.secs = +secs.toFixed(2); job.beat = curBeatIdx + 1;
      if (!take || (take.phase === 'tail' && vt - take.tailAt >= 1000)) break;
      if (i >= maxFrames || job.stop) break;
      await tick();
    }
    await Promise.all(pending);
    if (failed) throw new Error(failed + ' frame(s) were not saved (is this page served by serve.py?)');
    if (enc) {
      job.phase = 'video';
      await enc.flush(); enc.close();
      if (encErr) throw encErr;
      const r = await fetch(`/api/save-take/${name}.h264`, { method: 'POST', body: new Blob(chunks, { type: 'video/h264' }) });
      if (!r.ok) throw new Error('the video was not saved (' + r.status + '): restart serve.py, one started before Nov 16 2026 refuses .h264');
    }
    const total = i / fps;

    // --- soundtrack ---
    job.phase = 'audio';
    let wavOk = false;
    if (o.sound !== false) {
      const sr = 48000, off = new OfflineAudioContext(2, Math.ceil(total * sr), sr), G = buildAudioGraph(off);
      const bed = audioOpts.bed;
      G.droneGain.gain.value = bed === 'bowl' || bed === 'both' ? 1 : 0;
      G.fireGain.gain.value = bed === 'fire' || bed === 'both' ? 1.6 : 0;
      G.masterGain.gain.setValueAtTime(bedLevel(), 0);
      for (const v of voiceLog) {
        if (v.t >= total) continue;
        const src = off.createBufferSource(), g = off.createGain();
        src.buffer = v.buf; g.gain.value = audioOpts.voice;
        src.connect(g); g.connect(G.audioOut); src.start(v.t);
        G.masterGain.gain.setTargetAtTime(bedLevel() * 0.25, v.t, 0.15);       // duck the bed under the voice
        G.masterGain.gain.setTargetAtTime(bedLevel(), v.t + v.dur, 0.6);
      }
      const rendered = await off.startRendering();
      const r = await fetch(`/api/save-take/${name}.wav`, { method: 'POST', body: wavBlob(rendered) });
      wavOk = r.ok;
    }
    const meta = { name, ep: curEpisodeIdx + 1, fps, width: W, height: H, frames: i, video: enc ? name + '.h264' : null, videoBytes: enc ? encBytes : 0, secs: +total.toFixed(3), audio: wavOk, complete: !job.stop && i < maxFrames,
      timeline: job.timeline, voice: voiceLog.map((v) => ({ t: +v.t.toFixed(2), dur: +v.dur.toFixed(2), speaker: v.speaker, text: v.text })), missingVoice: missing };
    await fetch(`/api/save-take/${name}.json`, { method: 'POST', body: JSON.stringify(meta, null, 1) });
    job.meta = meta; job.phase = 'done';
  } catch (e) {
    job.err = String((e && e.stack) || e); job.phase = 'error';
  } finally {
    if (installed) {
      delete performance.now;
      window.setTimeout = real.st; window.clearTimeout = real.ct; window.requestAnimationFrame = real.raf;
      speakLine = real.speak; soundEnabled = real.sound;
    }
    take = null; autoPlay = false; lineVoice = null; speechActive = false; voicePending = false;
    renderSizeOverride = null; document.body.classList.remove('frame169'); resizeRenderer();
    if (typeof updateTakeUI === 'function') updateTakeUI();
    if (typeof updateAutoPlayBtn === 'function') updateAutoPlayBtn();
    clock.getDelta();
    if (installed) real.raf.call(window, animate);
    job.done = true;
  }
  return IW.renderState();
}

if (window.IW) {
  IW.render = (o) => renderTake(o);
  IW.renderState = () => renderJob ? { phase: renderJob.phase, frame: renderJob.frame, secs: renderJob.secs, beat: renderJob.beat, done: renderJob.done,
    err: renderJob.err, name: renderJob.name, video: renderJob.video || null, missingVoice: renderJob.missingVoice || [], timeline: renderJob.timeline } : null;
  IW.stopRender = () => { if (renderJob) renderJob.stop = true; return true; };
}
