// © 2026 George Moussa. All rights reserved.
// ============================================================================
// 12. WEB AUDIO SYNTHESIZER (wind-in-leaves bed + campfire + Voiceover)
// ============================================================================
let soundEnabled = false;
let audioCtx = null;
let masterGain = null; // the ambience bed (wind in leaves + campfire); ducks under the voice
let audioOut = null;   // every source sums here
let audioMaster = null; // gentle limiter after audioOut; feeds the speakers and (while recording) the take's audio track
let droneGain = null, fireGain = null;
// Mix (Reel tab > Sound; persisted by 15_reel_studio.js). bed: 'bowl' | 'fire' | 'both' | 'off'
const audioOpts = { voice: 1.0, amb: 0.7, bed: 'fire', chime: false };
function bedLevel() { return 0.18 * audioOpts.amb; }
// When the voice line started and how long it runs (seconds), so captions can follow the real audio and auto-play can wait for it.
let lineVoice = null; // { start: performance.now() ms, dur, end?: ms once it finished }

// The whole sound graph on any context: the live AudioContext (initAudio) or an OfflineAudioContext (17_offline_take.js
// renders a take's soundtrack with it). Returns { audioOut, audioMaster, masterGain, droneGain, fireGain }.
function buildAudioGraph(ctx) {
  const G = {};
  G.audioOut = ctx.createGain();
  G.audioMaster = ctx.createDynamicsCompressor();
  G.audioMaster.threshold.value = -10;
  G.audioMaster.knee.value = 8;
  G.audioMaster.ratio.value = 4;
  G.audioMaster.attack.value = 0.004;
  G.audioMaster.release.value = 0.25;
  G.audioOut.connect(G.audioMaster);
  G.audioMaster.connect(ctx.destination);
  G.masterGain = ctx.createGain();
  G.masterGain.gain.value = bedLevel();
  G.masterGain.connect(G.audioOut);
  G.droneGain = ctx.createGain();
  G.fireGain = ctx.createGain();
  G.droneGain.connect(G.masterGain);
  G.fireGain.connect(G.masterGain);

  // Bed "bowl" (the Reel tab's name for it; now soft wind through leaves). Two separate parts so it
  // doesn't blur into static: a smooth low whoosh (heavily smoothed noise, gusting pitch and level)
  // and sparse leaf rustles (short bursts of band-passed noise with silence between them).
  const wsr = ctx.sampleRate, wn = wsr * 10;
  const wbuf = ctx.createBuffer(2, wn, wsr);
  const lbuf = ctx.createBuffer(2, wn, wsr);
  for (let ch = 0; ch < 2; ch++) {
    const d = wbuf.getChannelData(ch);
    // Generate extra tail and crossfade it into the head so the 10 s loop has no seam (a seam clicks once per loop).
    const xf = Math.floor(wsr * 1.5), gen = new Float32Array(wn + xf);
    let a1 = 0, a2 = 0;
    for (let i = 0; i < gen.length; i++) { a1 += (Math.random() * 2 - 1 - a1) * 0.06; a2 += (a1 - a2) * 0.2; gen[i] = a2 * 5; }
    for (let i = 0; i < wn; i++) d[i] = i < xf ? gen[i] * Math.sin(i / xf * Math.PI / 2) + gen[wn + i] * Math.cos(i / xf * Math.PI / 2) : gen[i];
    const l = lbuf.getChannelData(ch);
    const bursts = 12 + Math.floor(Math.random() * 5);
    for (let k = 0; k < bursts; k++) {
      const at = Math.floor(wsr * 0.1 + Math.random() * (wn - wsr * 1.3));
      const len = Math.floor(wsr * (0.35 + Math.random() * 0.6)); // long, soft swells: short ones read as clicks
      const amp = 0.25 + 0.75 * Math.random();
      let lp = 0; // smoothed noise (not raw white) so the rustle is soft, not a tick
      for (let j = 0; j < len; j++) {
        lp += (Math.random() * 2 - 1 - lp) * 0.35;
        const x = j / len, env = Math.sin(Math.PI * x) ** 3;
        l[at + j] += lp * amp * env;
      }
    }
  }
  const windSrc = ctx.createBufferSource();
  windSrc.buffer = wbuf; windSrc.loop = true;
  const windLP = ctx.createBiquadFilter();
  windLP.type = 'lowpass'; windLP.frequency.value = 650; windLP.Q.value = 0.5;
  const windHP = ctx.createBiquadFilter();
  windHP.type = 'highpass'; windHP.frequency.value = 140;
  const gustLFO = ctx.createOscillator(), gustDepth = ctx.createGain();
  gustLFO.frequency.value = 0.1; gustDepth.gain.value = 300; // pitch of the whoosh drifts 350-950 Hz
  gustLFO.connect(gustDepth); gustDepth.connect(windLP.frequency); gustLFO.start();
  const windLevel = ctx.createGain();
  windLevel.gain.value = 0.45;
  const swell = ctx.createOscillator(), swellDepth = ctx.createGain();
  swell.frequency.value = 0.08; swellDepth.gain.value = 0.4;
  swell.connect(swellDepth); swellDepth.connect(windLevel.gain); swell.start();
  windSrc.connect(windHP); windHP.connect(windLP); windLP.connect(windLevel); windLevel.connect(G.droneGain);
  const leafSrc = ctx.createBufferSource();
  leafSrc.buffer = lbuf; leafSrc.loop = true;
  const leafBP = ctx.createBiquadFilter();
  leafBP.type = 'bandpass'; leafBP.frequency.value = 2600; leafBP.Q.value = 0.5;
  const leafLevel = ctx.createGain();
  leafLevel.gain.value = 0.35;
  const gustToLeaf = ctx.createGain();
  gustToLeaf.gain.value = 0.12; // rustles pick up as a gust swells
  swell.connect(gustToLeaf); gustToLeaf.connect(leafLevel.gain);
  leafSrc.connect(leafBP); leafBP.connect(leafLevel); leafLevel.connect(G.droneGain);
  windSrc.start(); leafSrc.start();

  // Campfire: an 8 s loop of soft low roar (filtered noise) plus a separate crackle layer below
  const sr = ctx.sampleRate, n = sr * 8;
  const buf = ctx.createBuffer(2, n, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0, lp2 = 0;
    for (let i = 0; i < n; i++) {
      lp += (Math.random() * 2 - 1 - lp) * 0.02;
      lp2 += (lp - lp2) * 0.05;
      d[i] = lp2 * 2.2 * (0.8 + 0.2 * Math.sin(i / sr * 2.1 + ch));
    }
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 150;
  src.connect(hp);
  hp.connect(G.fireGain);
  src.start();

  // Crackle layer: crisp, bright ticks (0.2-3 ms, differenced noise, highpassed) fired in small
  // clusters. Short and high = crackle; long and low-frequency read as soft pops.
  const cbuf = ctx.createBuffer(2, n, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = cbuf.getChannelData(ch);
    const clusters = 38 + Math.floor(Math.random() * 14);
    for (let c = 0; c < clusters; c++) {
      const start = Math.random() * (n - sr * 0.4);
      const ticks = 2 + Math.floor(Math.random() * 7);
      let at = start;
      for (let k = 0; k < ticks; k++) {
        at += sr * (0.004 + Math.random() * 0.035);
        const len = Math.floor(sr * (0.0002 + Math.random() * (Math.random() < 0.12 ? 0.003 : 0.0012)));
        const amp = 0.05 + 0.4 * Math.pow(Math.random(), 2.5);
        let prev = 0;
        for (let j = 0; j < len; j++) {
          const w = Math.random() * 2 - 1;
          const idx = Math.floor(at) + j;
          if (idx < n) d[idx] += amp * (w - prev) * 0.5 * Math.exp(-j / (len * 0.35));
          prev = w;
        }
      }
    }
  }
  const csrc = ctx.createBufferSource();
  csrc.buffer = cbuf;
  csrc.loop = true;
  const chp = ctx.createBiquadFilter();
  chp.type = 'highpass'; chp.frequency.value = 2500;
  const cg = ctx.createGain();
  cg.gain.value = 3.0;
  csrc.connect(chp);
  chp.connect(cg);
  cg.connect(G.fireGain);
  csrc.start();
  return G;
}

function initAudio() {
  if (audioCtx) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  audioCtx = new AudioContext();
  const G = buildAudioGraph(audioCtx);
  audioOut = G.audioOut; audioMaster = G.audioMaster; masterGain = G.masterGain; droneGain = G.droneGain; fireGain = G.fireGain;
  applyAudioMix();
}

// Push audioOpts into the graph (bed type + level). Safe to call before initAudio.
function applyAudioMix() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  droneGain.gain.setTargetAtTime(audioOpts.bed === 'bowl' || audioOpts.bed === 'both' ? 1 : 0, now, 0.2);
  fireGain.gain.setTargetAtTime(audioOpts.bed === 'fire' || audioOpts.bed === 'both' ? 1.6 : 0, now, 0.2);
  if (soundEnabled) masterGain.gain.setTargetAtTime(voiceboxSource ? bedLevel() * 0.25 : bedLevel(), now, 0.2);
}

function playChime(isSpirit) {
  if (!soundEnabled || !audioCtx || !audioOpts.chime) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(isSpirit ? 528 : 396, now);
  osc.frequency.exponentialRampToValueAtTime(isSpirit ? 660 : 440, now + 0.45);
  g.gain.setValueAtTime(0.12, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
  osc.connect(g);
  g.connect(audioOut);
  osc.start(now);
  osc.stop(now + 0.95);
}

// --- Voicebox (local TTS app) via the /voicebox/ proxy in serve.py; falls back to speechSynthesis ---
const VOICEBOX_BASE = '/voicebox';
// Keep in sync with VOICE / INSTRUCT in tools/make_voiceover.py so a live render matches the saved clips.
const VOICEBOX_VOICE = { HUMAN: 'Cand UncleFu', SPIRIT: 'Cand Ryan' };
const VOICEBOX_INSTRUCT = {
  HUMAN: 'Speak in a deep, low, grounded male voice. Quiet, tired and worried, a little hesitant, speaking slowly and heavily.',
  SPIRIT: 'Speak in a very deep, calm, gentle voice. Slow, soft and warm, almost whispered, with long pauses between phrases.'
};
const voiceSources = new Set(); // every voice clip currently playing; only one may ever sound at once
let voiceboxUp = location.protocol.startsWith('http'); // proxy only exists over http
let voiceboxProfiles = null;
const voiceboxClips = new Map(); // "speaker|text" -> Promise<AudioBuffer|null>
let voiceboxSource = null;
let voiceboxToken = 0;

async function voiceboxProfileId(name) {
  if (!voiceboxProfiles) {
    const r = await fetch(VOICEBOX_BASE + '/profiles');
    if (!r.ok) throw new Error('profiles ' + r.status);
    voiceboxProfiles = await r.json();
  }
  const p = voiceboxProfiles.find(x => x.name.toLowerCase() === name.toLowerCase());
  if (!p) throw new Error('no Voicebox profile named ' + name);
  return p;
}

// Pre-rendered lines from tools/make_voiceover.py: episodes/audio/epNN/manifest.json lists {file, speaker, text}.
const PRERENDER_DIR = 'episodes/audio/';
const prerenderManifests = new Map(); // episode idx -> Promise<manifest|null>

function prerenderManifest(epIdx) {
  if (!prerenderManifests.has(epIdx)) {
    const dir = PRERENDER_DIR + 'ep' + String(epIdx + 1).padStart(2, '0') + '/';
    prerenderManifests.set(epIdx, fetch(dir + 'manifest.json')
      .then(r => (r.ok ? r.json() : null))
      .then(m => (m ? { dir, lines: m.lines } : null))
      .catch(() => null));
  }
  return prerenderManifests.get(epIdx);
}

async function prerenderedBuffer(beat) {
  const m = await prerenderManifest(curEpisodeIdx);
  const norm = t => String(t || '').replace(/\s+/g, ' ').trim();
  const line = m && m.lines.find(l => l.speaker === beat.speaker && norm(l.text) === norm(beat.text));
  if (!line) { console.warn('No pre-rendered clip for', beat.speaker, JSON.stringify(beat.text), '(text edited or not rendered; re-run tools/make_voiceover.py)'); return null; }
  const r = await fetch(m.dir + line.file);
  if (!r.ok) return null;
  const buf = await audioCtx.decodeAudioData(await r.arrayBuffer());
  buf.cueWords = line.words || null; // word timestamps from tools/add_word_timings.py (SYNC_SPEC 4.1 phase 2)
  return buf;
}

async function voiceboxSynth(beat) {
  const pre = await prerenderedBuffer(beat);
  if (pre) return pre;
  if (!voiceboxUp) throw new Error('no pre-rendered clip and Voicebox proxy unavailable');
  const prof = await voiceboxProfileId(VOICEBOX_VOICE[beat.speaker] || 'George');
  const r = await fetch(VOICEBOX_BASE + '/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: beat.text, instruct: VOICEBOX_INSTRUCT[beat.speaker] || null, profile_id: prof.id, language: prof.language || 'en', engine: prof.default_engine || prof.preset_engine || 'kokoro' })
  });
  if (!r.ok) throw new Error('generate ' + r.status);
  const gen = await r.json();
  const deadline = performance.now() + 90000; // first run loads the model
  while (performance.now() < deadline) {
    const a = await fetch(VOICEBOX_BASE + '/audio/' + gen.id);
    if (a.ok && /audio/.test(a.headers.get('Content-Type') || '')) {
      return audioCtx.decodeAudioData(await a.arrayBuffer());
    }
    await new Promise(res => setTimeout(res, 350));
  }
  throw new Error('Voicebox timed out');
}

function voiceboxClip(beat) {
  if (!beat.text || !beat.text.trim()) return Promise.resolve(null); // silent beat: nothing to fetch (it used to ask Voicebox for an empty line)
  const key = beat.speaker + '|' + beat.text;
  if (!voiceboxClips.has(key)) {
    voiceboxClips.set(key, voiceboxSynth(beat).catch(err => {
      console.warn('Voicebox unavailable, using browser voice:', err.message);
      voiceboxUp = false;
      voiceboxClips.delete(key);
      return null;
    }));
  }
  return voiceboxClips.get(key);
}

function stopVoicebox() {
  voiceboxToken++;
  voiceSources.forEach(src => { try { src.stop(); } catch (e) {} });
  voiceSources.clear();
  voiceboxSource = null;
}

let voiceAnalyser = null;
function speakWithVoicebox(beat) {
  stopVoicebox(); // silence the previous line (and bump the token) before anything new starts
  const token = voiceboxToken;
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  speechActive = true; // hold auto-advance while the clip generates and plays (8s safety cap in animate)
  voiceboxClip(beat).then(buf => {
    if (token !== voiceboxToken || !soundEnabled) return;
    if (!buf) { speakBrowser(beat); return; }
    const src = audioCtx.createBufferSource();
    const g = audioCtx.createGain();
    g.gain.value = audioOpts.voice;
    src.buffer = buf;
    src.connect(g);
    g.connect(audioOut);
    if (!voiceAnalyser) { voiceAnalyser = audioCtx.createAnalyser(); voiceAnalyser.fftSize = 512; } // 14E reads the level for George's mouth
    g.connect(voiceAnalyser);
    src.onended = () => {
      voiceSources.delete(src);
      if (token !== voiceboxToken) return;
      speechActive = false;
      if (lineVoice) lineVoice.end = performance.now();
      voiceboxSource = null;
      if (soundEnabled) masterGain.gain.setTargetAtTime(bedLevel(), audioCtx.currentTime, 0.6); // bring the bed back
    };
    voiceboxSource = src;
    voiceSources.add(src);
    voiceMode = 'voicebox';
    masterGain.gain.setTargetAtTime(bedLevel() * 0.25, audioCtx.currentTime, 0.15); // duck the bed under the voice
    lineVoice = { start: performance.now(), dur: buf.duration, words: buf.cueWords || null };
    src.start();
    const next = beats[curBeatIdx + 1]; // prefetch the next line so it starts without a wait
    if (next) voiceboxClip(next);
  });
}

// Which voice is speaking: 'voicebox' (pre-rendered or live clip, recorded into takes) or 'browser' (speechSynthesis, NOT captured by recordings).
let voiceMode = null;
function speakLine(beat) {
  speechActive = false;
  lineVoice = null;
  if (!soundEnabled || !beat.text) return; // silent beat: a stage direction only
  if (audioCtx && location.protocol.startsWith('http')) return speakWithVoicebox(beat);
  speakBrowser(beat);
}

function speakBrowser(beat) {
  if (!('speechSynthesis' in window)) { speechActive = false; return; }
  window.speechSynthesis.cancel();
  voiceMode = 'browser';
  const u = new SpeechSynthesisUtterance(beat.text);
  u.rate = beat.speaker === 'SPIRIT' ? 0.92 : 1.02;
  u.pitch = beat.speaker === 'SPIRIT' ? 1.15 : 0.95;
  u.volume = Math.min(1, 0.9 * audioOpts.voice);
  u.onstart = () => { speechActive = true; lineVoice = { start: performance.now(), dur: beat.text.split(/\s+/).length * 0.36 + 0.3 }; };
  u.onend = u.onerror = () => { speechActive = false; if (lineVoice) lineVoice.end = performance.now(); };
  window.speechSynthesis.speak(u);
  speechActive = true; // hold auto-advance until the line finishes (8s safety cap in animate)
}

function toggleAudio() {
  soundEnabled = !soundEnabled;
  const btn = document.getElementById('btn-audio');
  if (soundEnabled) {
    initAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    applyAudioMix();
    masterGain.gain.setTargetAtTime(bedLevel(), audioCtx.currentTime, 0.2);
    btn.textContent = '🔊 Sound: On (M)';
    btn.classList.add('on');
    speakLine(beats[curBeatIdx]);
  } else {
    if (audioCtx && masterGain) masterGain.gain.setTargetAtTime(0.0001, audioCtx.currentTime, 0.15);
    speechActive = false;
    stopVoicebox();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    lineVoice = null;
    btn.textContent = '🔇 Sound (M)';
    btn.classList.remove('on');
  }
}
