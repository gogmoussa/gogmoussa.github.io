// © 2026 George Moussa. All rights reserved.
// ============================================================================
// 10. REALISTIC CLOTHED & SCULPTED HUMAN MAKER (GEORGE) + ASTRAL WITNESS
// ============================================================================
const gltfLoader = new THREE.GLTFLoader();
const mixers = [];

// George sits on a cut log (camp seat) a little back from the stone pad's centre, facing the fire.
// Hearth centre is (-0.05, -0.28); heading below is atan2(fire - seat) so he looks straight at the flames.
const GEORGE_SEAT = { x: -1.27, z: 0.59, top: 0.46, faceY: Math.atan2(-0.05 + 1.27, -0.28 - 0.59) };
const georgeLogSeat = new THREE.Group();
(function buildGeorgeLogSeat() {
  const R = 0.21, H = GEORGE_SEAT.top - 0.06;
  const mk = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding; return t; };
  const rnd = (i) => Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
  const bark = mk(256, 128, (g, w, h) => {
    g.fillStyle = '#4a3624'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(${rnd(i) > 0.5 ? '20,12,6' : '110,82,54'},${0.25 + rnd(i + 7) * 0.3})`; g.fillRect(rnd(i + 1) * w, 0, 1 + rnd(i + 2) * 4, h * (0.4 + rnd(i + 3) * 0.6)); }
  });
  bark.repeat.set(3, 1);
  const top = mk(256, 256, (g, w, h) => {
    g.fillStyle = '#b98f58'; g.fillRect(0, 0, w, h);
    for (let r = 120; r > 4; r -= 4 + rnd(r) * 4) { g.strokeStyle = `rgba(90,58,28,${0.25 + rnd(r + 3) * 0.35})`; g.lineWidth = 1 + rnd(r + 5) * 1.5; g.beginPath(); g.ellipse(w / 2 + 3, h / 2 - 2, r, r * 0.97, 0, 0, Math.PI * 2); g.stroke(); }
    g.strokeStyle = 'rgba(60,35,16,0.55)'; g.lineWidth = 2; g.beginPath(); g.moveTo(w / 2, h / 2); g.lineTo(w / 2 + 118, h / 2 - 30); g.stroke(); // drying check
    g.strokeStyle = '#3d2a1a'; g.lineWidth = 7; g.beginPath(); g.arc(w / 2, h / 2, 124, 0, Math.PI * 2); g.stroke();
  });
  const sideMat = new THREE.MeshStandardMaterial({ map: bark, color: 0xb59a80, roughness: 0.95, envMapIntensity: 0.15 });
  const topMat = new THREE.MeshStandardMaterial({ map: top, roughness: 0.85, envMapIntensity: 0.15 });
  const geo = new THREE.CylinderGeometry(R * 0.96, R * 1.05, H, 28, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const a = Math.atan2(pos.getZ(i), pos.getX(i)); const k = 1 + 0.035 * Math.sin(a * 3 + 1) + 0.02 * Math.sin(a * 7); pos.setX(i, pos.getX(i) * k); pos.setZ(i, pos.getZ(i) * k); }
  geo.computeVertexNormals();
  const log = new THREE.Mesh(geo, [sideMat, topMat, sideMat]);
  log.position.y = H / 2;
  log.castShadow = true; log.receiveShadow = true;
  georgeLogSeat.add(log);
  georgeLogSeat.position.set(GEORGE_SEAT.x, 0.06, GEORGE_SEAT.z);
  sanctuaryGroup.add(georgeLogSeat);
})();

const thoughtSwarmGroup = new THREE.Group();
thoughtSwarmGroup.position.set(GEORGE_SEAT.x, 1.55, GEORGE_SEAT.z);
sanctuaryGroup.add(thoughtSwarmGroup);
const thoughtNodes = [];
for (let i = 0; i < 16; i++) {
  const m = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.032, 0),
    new THREE.MeshBasicMaterial({
      color: i % 2 === 0 ? 0xfb7185 : 0xfbbf24,
      transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false // soft glowing shards; as wireframes they read as square debug outlines up close
    })
  );
  thoughtSwarmGroup.add(m);
  thoughtNodes.push({
    mesh: m,
    phase: i * 0.6,
    radius: 0.20 + (i % 4) * 0.06,
    speed: 0.9 + (i % 3) * 0.3
  });
}

// --- 10A. GEORGE (THE HUMAN MAKER): MASCULINE SCULPTED PHYSIQUE, BEARD, SHORT HAIR & CLOTHING ---
// Lighting is a small PBR model (GGX specular, per-channel wrapped skin scattering, thin-part
// transmission) with screen-space-derivative bump from procedural heights (pores, knit, twill,
// leather grain). Hair, beard and brows are shell layers (see 10E) that reuse the region masks below.
const GEORGE_NOISE_GLSL = `
  float hash31(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
  }
  float vnoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash31(i), hash31(i + vec3(1.0, 0.0, 0.0)), f.x),
          mix(hash31(i + vec3(0.0, 1.0, 0.0)), hash31(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
      mix(mix(hash31(i + vec3(0.0, 0.0, 1.0)), hash31(i + vec3(1.0, 0.0, 1.0)), f.x),
          mix(hash31(i + vec3(0.0, 1.0, 1.0)), hash31(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) {
    float a = 0.5, s = 0.0;
    for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; }
    return s;
  }
  float gauss(float d, float s) { return exp(-(d * d) / (2.0 * s * s)); }
`;

const georgeMakerShader = new THREE.ShaderMaterial({
  extensions: { derivatives: true },
  uniforms: {
    uTime: { value: 0 },
    uCoherence: { value: 0.65 },
    uSunDir: { value: new THREE.Vector3(-0.4, 0.8, 0.5).normalize() },
    uSunCol: { value: new THREE.Color(0xe0f2fe) },
    uAmbCol: { value: new THREE.Vector3(0.2, 0.26, 0.4) },
    uGndCol: { value: new THREE.Vector3(0.2, 0.15, 0.08) },
    uFireK: { value: 1 }, // fire strength on the toon: 1 = Blue Dusk, follows fireLight's flicker and the mood (set in the loop)
    uFireCol: { value: new THREE.Color(0xff7b1c) }, // campfire hue for the stylized toon (follows fireLight, teal in the spirit world)
    // face expression, written each frame by the emotion blender (14B)
    uSmile: { value: 0 }, uMouthOpen: { value: 0 }, uBrowLift: { value: 0 }, uBrowKnit: { value: 0 }, uBlush: { value: 0 }
  },
  vertexShader: `
    #include <common>
    #include <skinning_pars_vertex>
    attribute vec3 aOrigBindPos;
    varying vec3 vBindPos;
    varying vec3 vNormalWorld;
    varying vec3 vWorldPos;
    void main() {
      vBindPos = aOrigBindPos;

      #include <beginnormal_vertex>
      #include <skinbase_vertex>
      #include <skinnormal_vertex>
      vNormalWorld = normalize((modelMatrix * vec4(objectNormal, 0.0)).xyz);

      #include <begin_vertex>
      #include <skinning_vertex>
      vec4 worldPos = modelMatrix * vec4(transformed, 1.0);
      vWorldPos = worldPos.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,
  fragmentShader: `
    varying vec3 vBindPos;
    varying vec3 vNormalWorld;
    varying vec3 vWorldPos;
    uniform float uTime;
    uniform float uCoherence;
    uniform vec3 uSunDir;
    uniform vec3 uSunCol;
    uniform vec3 uAmbCol;
    uniform vec3 uGndCol;
    ${GEORGE_NOISE_GLSL}

    // Screen-space bump (Mikkelsen): h is a height in metres
    vec3 bumpNormal(vec3 N, vec3 P, float h) {
      vec3 dpdx = dFdx(P);
      vec3 dpdy = dFdy(P);
      float dhx = dFdx(h);
      float dhy = dFdy(h);
      vec3 r1 = cross(dpdy, N);
      vec3 r2 = cross(N, dpdx);
      float det = dot(dpdx, r1);
      vec3 g = sign(det) * (dhx * r1 + dhy * r2);
      return normalize(abs(det) * N - g);
    }

    void addLight(vec3 L, vec3 lc, vec3 N, vec3 V, float rough, float f0, vec3 wrapv,
                  inout vec3 diff, inout vec3 spec) {
      float NoL = dot(N, L);
      diff += lc * clamp((vec3(NoL) + wrapv) / (1.0 + wrapv), 0.0, 1.0);
      float nl = max(NoL, 0.0);
      vec3 H = normalize(L + V);
      float NoH = max(dot(N, H), 0.0);
      float NoV = max(dot(N, V), 0.001);
      float VoH = max(dot(V, H), 0.0);
      float a = max(rough * rough, 0.02);
      float d = NoH * NoH * (a * a - 1.0) + 1.0;
      float D = (a * a) / (3.14159 * d * d);
      float k = a * 0.5;
      float vis = 0.25 / ((NoV * (1.0 - k) + k) * (nl * (1.0 - k) + k) + 0.001);
      float F = f0 + (1.0 - f0) * pow(1.0 - VoH, 5.0);
      spec += lc * (D * vis * F * nl);
    }

    void main() {
      float x = vBindPos.x;
      float y = vBindPos.y;
      float ax = abs(x);
      float z = vBindPos.z;
      vec3 P = vBindPos;
      float px = length(fwidth(vBindPos));

      vec3 Nw = normalize(vNormalWorld);
      vec3 V = normalize(cameraPosition - vWorldPos);

      vec3 albedo = vec3(0.75, 0.52, 0.39);
      float rough = 0.5;
      float f0 = 0.028;
      float skin = 0.0;
      float thin = 0.0;
      float h = 0.0;
      float ao = 1.0;
      float fuzz = 0.0;
      float metal = 0.0;

      if (y < 0.035) {
        // Lugged rubber outsole
        float lug = smoothstep(0.35, 0.65, sin(x * 380.0) * sin(z * 300.0) * 0.5 + 0.5);
        albedo = vec3(0.10, 0.09, 0.08) * (0.75 + 0.25 * lug);
        rough = 0.82;
        f0 = 0.04;
        h = -0.0012 * lug * (1.0 - smoothstep(0.0015, 0.004, px));
      } else if (y < 0.145) {
        // Saddle-leather work boot: pebbled grain, scuffs, waxed highlights
        float grain = vnoise(P * 900.0);
        float aaG = 1.0 - smoothstep(0.0008, 0.0026, px);
        float scuff = fbm(P * vec3(55.0, 130.0, 55.0));
        float wear = smoothstep(0.45, 0.8, scuff) * (1.0 - smoothstep(0.03, 0.14, y));
        albedo = vec3(0.30, 0.165, 0.085) * (0.80 + 0.40 * mix(0.5, grain, aaG));
        albedo = mix(albedo, vec3(0.42, 0.26, 0.14), wear * 0.55);
        rough = mix(0.42, 0.68, wear);
        f0 = 0.05;
        h = (grain - 0.5) * 0.00035 * aaG;
        // welt stitching at the sole line
        float stitch = smoothstep(0.0018, 0.0006, abs(y - 0.052)) * step(0.5, fract(x * 380.0 + z * 380.0));
        albedo = mix(albedo, vec3(0.70, 0.58, 0.38), stitch * 0.8);
      } else if (y < 0.995) {
        // Raw-indigo selvedge denim with twill, whiskering and honeycomb creases
        float aaT = 1.0 - smoothstep(0.0012, 0.0036, px);
        float twill = sin((x + y * 1.15) * 1150.0) * 0.5 + 0.5;
        float weftNoise = vnoise(vec3(x * 140.0, y * 900.0, z * 140.0));
        float fade = fbm(P * vec3(26.0, 6.0, 26.0));
        float thighFade = smoothstep(0.80, 0.95, y) * smoothstep(0.0, 0.08, z) * smoothstep(0.35, 0.7, fade);
        float kneeFade = smoothstep(0.12, 0.0, abs(y - 0.50)) * smoothstep(0.35, 0.65, fade);
        float behindKnee = smoothstep(0.10, 0.0, abs(y - 0.50)) * smoothstep(0.0, -0.05, z);
        float honey = abs(sin(y * 420.0 + fbm(P * 60.0) * 6.0)) * behindKnee;
        vec3 indigo = vec3(0.095, 0.145, 0.255);
        vec3 faded = vec3(0.24, 0.33, 0.46);
        albedo = indigo * (0.82 + 0.28 * mix(0.5, twill, aaT) + 0.12 * weftNoise);
        albedo = mix(albedo, faded, clamp(thighFade * 0.75 + kneeFade * 0.55 + honey * 0.35, 0.0, 0.85));
        // rolled hem cuff + chain stitch
        float cuff = smoothstep(0.205, 0.20, y);
        albedo = mix(albedo, albedo * 1.35 + 0.02, cuff * 0.6);
        float hemStitch = smoothstep(0.0020, 0.0007, abs(y - 0.172)) * step(0.5, fract(atan(z, x) * 70.0));
        albedo = mix(albedo, vec3(0.70, 0.52, 0.22), hemStitch * 0.85);
        // side-seam topstitch
        float sideSeam = smoothstep(0.0022, 0.0008, abs(abs(z) - 0.0)) * step(0.14, ax);
        albedo = mix(albedo, vec3(0.65, 0.47, 0.20), sideSeam * 0.6);
        rough = 0.86;
        fuzz = 0.18;
        h = ((twill - 0.5) * 0.0005 * aaT) + (weftNoise - 0.5) * 0.0002 - honey * 0.0006;
      } else if (y < 1.035 && ax < 0.185) {
        // Bridle-leather belt with brushed-steel buckle
        bool buckle = ax < 0.026 && z > 0.04;
        float grain = vnoise(P * 700.0);
        if (buckle) {
          float brushed = sin(y * 3200.0 + fbm(P * 80.0) * 8.0) * 0.5 + 0.5;
          albedo = vec3(0.70, 0.67, 0.60) * (0.85 + 0.15 * brushed);
          rough = 0.32;
          f0 = 0.55;
          metal = 1.0;
          float hole = smoothstep(0.012, 0.009, abs(x)) * smoothstep(0.012, 0.008, abs(y - 1.015));
          albedo = mix(albedo, vec3(0.05), hole * 0.8);
        } else {
          albedo = vec3(0.20, 0.115, 0.065) * (0.85 + 0.30 * grain);
          rough = 0.40;
          f0 = 0.05;
          float stitch = smoothstep(0.0012, 0.0004, abs(abs(y - 1.015) - 0.0145)) * step(0.5, fract(x * 260.0));
          albedo = mix(albedo, vec3(0.62, 0.50, 0.30), stitch * 0.7);
          h = (grain - 0.5) * 0.0003;
        }
      } else if (y < 1.488 || ax > 0.14 || (y < 1.545 && ax > 0.078)) {
        // (ax > 0.14 keeps the shoulder slope above y=1.488 in sweater, not neck skin)
        if (ax > 0.648) {
          // Hands: warm skin, redder knuckles
          float knuck = fbm(P * 90.0);
          albedo = mix(vec3(0.75, 0.52, 0.39), vec3(0.72, 0.42, 0.33), smoothstep(0.55, 0.8, knuck) * 0.6);
          rough = 0.50;
          skin = 1.0;
          thin = 0.35;
          h = (fbm(P * 700.0) - 0.5) * 0.00025;
        } else if (ax > 0.602) {
          // Ribbed charcoal wrist cuff
          float ang = atan(z, y - 1.41);
          float rib = sin(ang * 70.0) * 0.5 + 0.5;
          albedo = vec3(0.15, 0.17, 0.19) * (0.72 + 0.5 * rib);
          rough = 0.88;
          fuzz = 0.30;
          h = rib * 0.0009;
        } else if (y > 1.468 && ax < 0.088) {
          // Ribbed crewneck collar
          float rib = sin(x * 700.0) * 0.5 + 0.5;
          albedo = vec3(0.16, 0.18, 0.20) * (0.72 + 0.5 * rib);
          rough = 0.88;
          fuzz = 0.30;
          h = rib * 0.0008;
        } else {
          // Heavy waffle-knit pullover: chunky stitch relief, heathered fibre, fuzzy rim
          float onArm = smoothstep(0.20, 0.27, ax);
          float c = atan(z, y - 1.41) * 0.045;
          vec2 uv = mix(vec2(x, y), vec2(x, c), onArm);
          float aaK = 1.0 - smoothstep(0.0009, 0.0026, px);
          float wx = sin(uv.x * 520.0);
          float wy = sin(uv.y * 520.0);
          float waffle = (wx * wy) * 0.5 + 0.5;
          float wale = sin(uv.x * 260.0) * 0.5 + 0.5;
          float heather = fbm(P * vec3(180.0, 180.0, 180.0));
          float slub = vnoise(P * vec3(40.0, 300.0, 40.0));
          float yoke = 0.0;
          vec3 body = mix(vec3(0.17, 0.26, 0.19), vec3(0.27, 0.36, 0.26), heather);
          vec3 shoulder = mix(vec3(0.28, 0.19, 0.13), vec3(0.38, 0.27, 0.19), heather);
          albedo = mix(body, shoulder, yoke);
          albedo *= 0.86 + 0.16 * mix(0.5, waffle, aaK) + 0.08 * slub;
          float placket = (z > 0.04 && y > 1.32 && ax < 0.016) ? 1.0 : 0.0;
          albedo = mix(albedo, vec3(0.14, 0.15, 0.16), placket * 0.7);
          // trapped shadow under the chest and in the sleeve creases
          ao = 0.88 + 0.12 * smoothstep(0.0, 0.7, waffle + 0.2);
          rough = 0.92;
          fuzz = 0.40;
          h = (mix(0.5, waffle, aaK) * 0.0016) + (mix(0.5, wale, aaK) * 0.0004) + (slub - 0.5) * 0.0004;
        }
      } else {
        // Head & neck
        skin = 1.0;
        float pore = fbm(P * 1100.0);
        float aaP = 1.0 - smoothstep(0.0006, 0.0022, px);
        float tone = fbm(P * 26.0);
        albedo = vec3(0.75, 0.52, 0.39) * (0.93 + 0.14 * tone);
        rough = 0.46;
        h = (pore - 0.5) * 0.00032 * aaP;
        float front = smoothstep(0.04, 0.10, z);

        // Flush & colour zones: cheeks, nose tip, forehead lightness, under-eye bags, ears
        float cheek = gauss(ax - 0.060, 0.020) * gauss(y - 1.612, 0.020) * front;
        float noseTip = gauss(x, 0.011) * gauss(y - 1.621, 0.009) * front;
        float forehead = gauss(x, 0.05) * gauss(y - 1.705, 0.02) * front;
        float eyeBag = gauss(ax - 0.031, 0.015) * gauss(y - 1.642, 0.006) * front;
        float ear = smoothstep(0.084, 0.092, ax) * gauss(y - 1.640, 0.026) * (1.0 - front);
        albedo = mix(albedo, vec3(0.80, 0.42, 0.33), cheek * 0.38);
        albedo = mix(albedo, vec3(0.82, 0.40, 0.32), noseTip * 0.40 + ear * 0.55);
        albedo = mix(albedo, vec3(0.80, 0.58, 0.45), forehead * 0.28);
        albedo = mix(albedo, vec3(0.50, 0.34, 0.33), eyeBag * 0.45);
        thin = max(ear * 0.9, noseTip * 0.5);
        rough = mix(rough, 0.34, (forehead + noseTip) * 0.5);

        // Lips: warm rose, slightly glossier
        float lipMask = smoothstep(0.011, 0.003, abs(y - 1.578)) * smoothstep(0.026, 0.018, ax) * smoothstep(0.07, 0.09, z);
        albedo = mix(albedo, vec3(0.58, 0.30, 0.28), lipMask * 0.65);
        rough = mix(rough, 0.34, lipMask);
        float mouthLine = smoothstep(0.0016, 0.0004, abs(y - 1.5785 + ax * 0.10)) * smoothstep(0.026, 0.012, ax) * front;
        albedo = mix(albedo, vec3(0.20, 0.09, 0.08), mouthLine * 0.75);
        ao *= 1.0 - mouthLine * 0.6;

        // Nostrils & philtrum shadows
        float nostril = gauss(ax - 0.0085, 0.0034) * gauss(y - 1.6105, 0.0022) * front;
        albedo = mix(albedo, vec3(0.12, 0.06, 0.05), nostril * 0.85);
        ao *= 1.0 - nostril * 0.7;

        // Eye socket occlusion, nasolabial folds, under-chin, neck
        float socket = gauss(ax - 0.030, 0.019) * gauss(y - 1.662, 0.015) * front;
        float nasolabial = gauss(ax - 0.030 - (1.60 - y) * 0.25, 0.005) * gauss(y - 1.590, 0.020) * front;
        float underChin = smoothstep(1.56, 1.50, y);
        ao *= 1.0 - socket * 0.50 - nasolabial * 0.18 - underChin * 0.35;

        // 5-o'clock shadow under the cropped beard, tapering into the skin
        float jawBeardY = smoothstep(1.535, 1.555, y) * smoothstep(1.628 - ax * 0.35, 1.608 - ax * 0.35, y);
        float jawBeardZ = smoothstep(-0.005, 0.032, z);
        float sideburn = smoothstep(0.052, 0.066, ax) * smoothstep(1.595, 1.615, y) * smoothstep(1.705, 1.685, y) * smoothstep(-0.010, 0.028, z);
        float mustache = smoothstep(0.009, 0.002, abs(y - 1.593)) * smoothstep(0.032, 0.014, ax) * smoothstep(0.075, 0.095, z);
        float beardMask = clamp((jawBeardY * jawBeardZ + sideburn + mustache) * (1.0 - lipMask), 0.0, 1.0);
        float stubbleNoise = vnoise(P * 700.0);
        albedo = mix(albedo, vec3(0.16, 0.115, 0.095), beardMask * (0.55 + 0.35 * stubbleNoise));
        float cheekShadow = smoothstep(1.64, 1.60, y) * smoothstep(0.03, 0.08, ax) * front * (1.0 - beardMask);
        albedo = mix(albedo, albedo * vec3(0.90, 0.88, 0.92), cheekShadow * 0.35);
        rough = mix(rough, 0.70, beardMask);
        skin *= 1.0 - beardMask * 0.6;

        // Hair scalp base (the shell strands in 10E sit on top of this)
        float waveH = sin(x * 110.0) * 0.004;
        float crownHair = smoothstep(1.688 + waveH, 1.704 + waveH, y);
        float backFade = smoothstep(0.015, -0.035, z) * smoothstep(1.642 + waveH, 1.678 + waveH, y);
        float sideTemple = smoothstep(0.056, 0.068, ax) * smoothstep(1.668, 1.692, y) * smoothstep(0.045, -0.010, z);
        float hairMask = clamp(crownHair + backFade * 0.85 + sideTemple, 0.0, 1.0);
        albedo = mix(albedo, vec3(0.08, 0.06, 0.05), hairMask);
        rough = mix(rough, 0.55, hairMask);
        skin *= 1.0 - hairMask;
        h *= 1.0 - hairMask;
      }

      Nw = bumpNormal(Nw, vWorldPos, h);

      // sRGB -> linear
      albedo = pow(max(albedo, vec3(0.001)), vec3(2.2));

      vec3 wrapv = mix(vec3(0.30), vec3(0.62, 0.30, 0.16), skin);
      vec3 diff = vec3(0.0);
      vec3 spec = vec3(0.0);

      vec3 Pf = vec3(${glslF(fireLight.position.x)}, 0.85, ${glslF(fireLight.position.z)}) - vWorldPos;
      float df = length(Pf);
      vec3 Lf = Pf / df;
      vec3 fireC = vec3(0.90, 0.43, 0.14) * 1.25 / (1.0 + df * df * 0.22);
      vec3 Ps = vec3(1.08, 1.75, -0.12) - vWorldPos;
      float ds = length(Ps);
      vec3 Ls = Ps / ds;
      vec3 spiritC = vec3(0.18, 0.52, 0.78) * 0.55 / (1.0 + ds * ds * 0.18);
      vec3 Pj = vec3(-1.05, 1.35, 0.42) - vWorldPos;
      float dj = length(Pj);
      vec3 Lj = Pj / dj;
      vec3 journalC = vec3(0.98, 0.72, 0.22) * 0.30 / (1.0 + dj * dj * 0.9);
      vec3 Lm = normalize(uSunDir);

      addLight(Lf, fireC, Nw, V, rough, f0, wrapv, diff, spec);
      addLight(Ls, spiritC, Nw, V, rough, f0, wrapv * 0.6, diff, spec);
      addLight(Lj, journalC, Nw, V, rough, f0, wrapv, diff, spec);
      addLight(Lm, uSunCol * 0.62, Nw, V, rough, f0, wrapv * 0.5, diff, spec);

      vec3 amb = mix(uGndCol, uAmbCol, Nw.y * 0.5 + 0.5);
      // Thin-part transmission (ears, nose wings, fingers) glowing red when lit from behind
      float trans = pow(clamp(dot(-Nw, Lf) * 0.5 + 0.5, 0.0, 1.0), 3.0) * thin;
      vec3 transC = vec3(0.85, 0.22, 0.08) * fireC * trans * 2.2;

      vec3 col = albedo * (diff + amb * 1.0) * ao;
      col += transC * albedo;
      // Metals take their colour into the specular lobe
      col = mix(col, vec3(0.0), metal * 0.8);
      col += spec * mix(vec3(1.0), albedo * 4.0, metal);

      // Environment sheen on the grazing edge: fuzz for knit/denim, subtle for skin
      float NoV = max(dot(Nw, V), 0.0);
      float rim = pow(1.0 - NoV, 3.0);
      vec3 envC = mix(uGndCol, uAmbCol, clamp(Nw.y * 0.5 + 0.6, 0.0, 1.0)) * 1.6 + uSunCol * 0.18;
      col += envC * rim * (0.05 + 0.10 * skin + fuzz * 0.5) * (1.0 - metal * 0.5);
      col += albedo * fireC * rim * fuzz * 0.9;

      gl_FragColor = vec4(col, 1.0);
    }
  `
});

// Reshape Xbot.glb's bind-space geometry into a broad-shouldered, flat-chested, square-jawed Male physique
function sculptMaleGeometry(geom, meshIdx) {
  const pos = geom.attributes.position;
  const origArr = new Float32Array(pos.array.length);
  origArr.set(pos.array);
  geom.setAttribute('aOrigBindPos', new THREE.BufferAttribute(origArr, 3));

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const ax = Math.abs(x);
    const sx = x < 0 ? -1 : 1;

    // 1. Bridge the ribcage-to-pelvis waist gap on Mesh 1 so the sweater forms a solid straight male torso
    if (meshIdx === 1 && ax < 0.21 && y > 1.04 && y < 1.30) {
      if (y >= 1.20 && y < 1.30) {
        const t = (1.30 - y) / 0.10;
        y -= t * 0.078;
      } else if (y > 1.04 && y <= 1.12) {
        const t = (y - 1.04) / 0.08;
        y += t * 0.058;
      }
    }

    // 2. Reshape torso (y in [0.85, 1.48], ax < 0.24) into a flat-chested, straight-backed male V-taper
    if (ax < 0.24 && y > 0.85 && y < 1.48) {
      const hFrac = Math.max(0, Math.min(1, (y - 0.90) / (1.44 - 0.90)));
      const targetMaxX = 0.155 + hFrac * 0.082; // 0.155 at hips -> 0.237 at broad male lats/shoulders
      const targetMaxZ = (y > 1.38)
        ? 0.100 - (y - 1.38) * 0.42
        : 0.100; // Completely flat masculine chest & stomach!
      const targetMinZ = -0.114 - hFrac * 0.014;

      if (z > 0.015) {
        const curFront = (meshIdx === 1 && y > 1.12 && y < 1.39) ? 0.148 : 0.120;
        z = Math.min(targetMaxZ, (z / curFront) * targetMaxZ);
      }
      if (z < targetMinZ) {
        z = Math.max(targetMinZ, z * 0.82);
      }
      if (y > 1.02 && y < 1.42) {
        const r = Math.hypot(x, z);
        if (r > 0.025) {
          const ang = Math.atan2(z, x);
          const ellR = 1.0 / Math.hypot(Math.cos(ang) / targetMaxX, Math.sin(ang) / (z >= 0 ? targetMaxZ : -targetMinZ));
          const blend = Math.sin(Math.min(1, Math.max(0, (y - 1.02) / 0.40)) * Math.PI) * 0.90;
          const newR = r * (1 - blend) + ellR * blend;
          x = Math.cos(ang) * newR;
          z = Math.sin(ang) * newR;
        }
      }
      // Narrow flared hips/pelvis (y in [0.85, 1.06])
      if (y <= 1.06 && ax > 0.09) {
        const hipT = Math.sin(Math.max(0, Math.min(1, (y - 0.85) / 0.21)) * Math.PI);
        x *= (1.0 - 0.22 * hipT);
      }
    }

    // 3. Broaden male shoulders/deltoids & thicken upper arms/forearms
    if (y > 1.32 && y < 1.53 && ax >= 0.13 && ax < 0.58) {
      const armFade = 1.0 - Math.max(0, (ax - 0.40) / 0.18);
      x += sx * 0.010 * armFade;
      z *= (1.0 + 0.07 * armFade);
    }

    // 4. Thicken male thighs & calves slightly for straight-leg jeans
    if (y > 0.14 && y <= 0.85) {
      z *= 1.12;
    }

    // 5. Thicken male neck, square out jaw/chin & sculpt short-cropped hair crown + front quiff
    if (y >= 1.48 && y < 1.58 && ax < 0.12) {
      x *= 1.32;
      z *= 1.22;
    }
    if (y >= 1.55 && y < 1.65 && ax < 0.10) {
      x *= 1.16;
      if (z > 0.015) z += 0.013;
    }
    if (y >= 1.69 && z > -0.09) {
      const quiff = Math.max(0, (z + 0.02) / 0.14) * Math.max(0, 1.0 - ax / 0.075);
      const lockWave = Math.sin(x * 180.0 + z * 110.0) * 0.0025;
      y += 0.015 + 0.016 * quiff + lockWave;
      z += 0.014 * quiff;
    }

    // 6. Facial bone structure on the surface mesh: brow ridge, eye sockets, cheekbones, chin, jaw
    if (meshIdx === 1 && y > 1.52 && y < 1.78 && ax < 0.115) {
      const g = (d, s) => Math.exp(-(d * d) / (2 * s * s));
      const front = Math.max(0, Math.min(1, (z + 0.02) / 0.10));
      z += 0.011 * g(y - 1.686, 0.011) * g(ax, 0.05) * front;
      z -= 0.010 * g(Math.hypot(ax - 0.031, (y - 1.660) * 1.15), 0.015) * front;
      z += 0.007 * g(Math.hypot(ax - 0.060, y - 1.622), 0.016) * front;
      z -= 0.004 * g(Math.hypot(ax - 0.062, y - 1.585), 0.016) * front;
      z += 0.011 * g(ax, 0.022) * g(y - 1.553, 0.013) * front;
      x += sx * 0.006 * g(y - 1.565, 0.018) * Math.max(0, Math.min(1, (ax - 0.06) / 0.03));
    }

    pos.setXYZ(i, x, y, z);
  }

  // Xbot's Beta_Joints are separate ball spheres that bulge out of the sleeves at shoulders/elbows.
  // Shrink each sphere island toward its own centroid so it still covers the seam but no longer bulges.
  if (meshIdx === 0 && geom.index) {
    const idx = geom.index.array;
    const parent = new Int32Array(pos.count).map((_, i) => i);
    const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
    for (let i = 0; i < idx.length; i += 3) {
      const ra = find(idx[i]), rb = find(idx[i + 1]), rc = find(idx[i + 2]);
      parent[rb] = ra; parent[find(rc)] = ra;
    }
    const sum = new Map();
    for (let i = 0; i < pos.count; i++) {
      const r = find(i);
      const s = sum.get(r) || { x: 0, y: 0, z: 0, n: 0 };
      s.x += pos.getX(i); s.y += pos.getY(i); s.z += pos.getZ(i); s.n++;
      sum.set(r, s);
    }
    const JOINT_SHRINK = 0.97;
    for (let i = 0; i < pos.count; i++) {
      const s = sum.get(find(i));
      const cx = s.x / s.n, cy = s.y / s.n, cz = s.z / s.n;
      pos.setXYZ(i, cx + (pos.getX(i) - cx) * JOINT_SHRINK, cy + (pos.getY(i) - cy) * JOINT_SHRINK, cz + (pos.getZ(i) - cz) * JOINT_SHRINK);
    }
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
}

// Soft contact shadows ground the characters on the basin floor (the custom
// character shaders don't receive shadow maps, so these anchor them physically)
function makeContactShadow(x, z, radius, opacity) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const gr = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  gr.addColorStop(0, `rgba(0,0,0,${opacity})`);
  gr.addColorStop(0.55, `rgba(0,0,0,${opacity * 0.45})`);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, 128, 128);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.075, z);
  m.renderOrder = 2;
  sanctuaryGroup.add(m);
  return m;
}
const georgeContactShadow = makeContactShadow(GEORGE_SEAT.x, GEORGE_SEAT.z, 0.62, 0.62);

// Stylized (cel-shaded) George. The Xbot surface is kept only for his hands; everything else is procedural.
const georgeToon = makeGeorgeToonMaterial(georgeMakerShader.uniforms, false);
const georgeToonHands = makeGeorgeToonMaterial(georgeMakerShader.uniforms, true);
const georgeNoseToon = makeGeorgeToonMaterial(georgeMakerShader.uniforms, false, true);
const georgeHairMat = makeGeorgeHairMaterial(georgeMakerShader.uniforms);
const georgeOutlineSkinned = makeGeorgeOutlineMaterial(0.0022, false);  // metres (bind space)
const georgeOutlineRigid = makeGeorgeOutlineMaterial(0.22, false);      // bone-local units (cm)
const georgeOutlineFine = makeGeorgeOutlineMaterial(0.11, false);       // thinner ink for fingers

let xbotHumanModel = null;
let humanMixer = null;
const humanActions = {};
let activeHumanAction = null;
const humanBones = {};
const humanRest = {}; // bind-pose quaternions, so the seated leg pose can be absolute (clip-independent)
let currentHumanEmote = 'sad_pose';
// Face rig handles filled by buildGeorgeFace: faceGroup (head bind space → world), per-side brow meshes [mesh, ink], eye lid pivots
const georgeFace = { group: null, brows: {}, lids: [], eyes: [], lips: [] };
// The procedural emotions (EMOTIONS in 14_animation_loop) ride on one of Xbot's clips; anything else plays its own clip or idle.
const EMOTE_CLIP = { anxious: 'sad_pose', shame: 'sad_pose', grief: 'sad_pose', frustration: 'headShake', joy: 'agree', resolve: 'agree' };

// Xbot is decoded once and parsed twice (George + Witness): each parse builds its own
// scene, bones and clips, and GLTFLoader slices the buffer, so sharing it is safe.
const xbotBuffer = window.XBOT_B64 ? b64ToBuffer(window.XBOT_B64) : null;

if (xbotBuffer) {
  gltfLoader.parse(xbotBuffer, '', (gltf) => {
    xbotHumanModel = gltf.scene;
    xbotHumanModel.position.set(GEORGE_SEAT.x, 0.06, GEORGE_SEAT.z);
    xbotHumanModel.rotation.y = GEORGE_SEAT.faceY;
    let mIdx = 0;
    xbotHumanModel.traverse((child) => {
      if (child.isBone) {
        humanBones[child.name] = child;
        humanBones[child.name.replace(':', '')] = child;
        humanRest[child.name.replace(':', '')] = child.quaternion.clone();
      }
      if (child.isMesh) {
        sculptMaleGeometry(child.geometry, mIdx++);
        child.castShadow = true;
        child.receiveShadow = true;
        child.frustumCulled = false;
        child.material = georgeToonHands;
        child.visible = false; // George is fully procedural now (body, head, hands); Xbot only supplies the skeleton
      }
    });

    try {
      let sm = null;
      xbotHumanModel.traverse((c) => { if (c.isSkinnedMesh && c.name === 'Beta_Surface') sm = c; });
      pbOutlineMat = georgeOutlineRigid;
      pbBakeList = [];
      buildGeorgeBody(sm.skeleton, georgeToon);
      buildStylizedOvershirt(sm.skeleton, georgeToon);
      pbOutlineMat = georgeOutlineFine;
      buildGeorgeHands(sm.skeleton, georgeToon);
      pbOutlineMat = null;
      // body, overshirt and fingers: 218 rigid parts drawn as 3 skinned meshes (10f pbBakeParts)
      const bakeList = pbBakeList; pbBakeList = null;
      pbBakeParts(xbotHumanModel, bakeList, [0, 0.9, 0, 1.6]); // bound: he never leaves a 1.6 m ball around his own middle
      buildGeorgeMultitool(sm.skeleton);
    } catch (e) { console.error('George procedural body failed', e); }

    sanctuaryGroup.add(xbotHumanModel);
    try { buildGeorgeFace(xbotHumanModel); } catch (e) { console.error('George face detail failed', e); }

    humanMixer = new THREE.AnimationMixer(xbotHumanModel);
    mixers.push(humanMixer);
    gltf.animations.forEach((clip) => {
      humanActions[clip.name] = humanMixer.clipAction(clip);
    });
    playHumanClip(String(beats[curBeatIdx].emote || 'idle').split('@')[0]); // setEmote lives in 14 (not loaded yet)
  });
}

function playHumanClip(name) {
  currentHumanEmote = name || 'idle';
  if (!humanMixer) return;
  const clipName = EMOTE_CLIP[name] || name;
  const targetName = humanActions[clipName] ? clipName : 'idle';
  const next = humanActions[targetName];
  if (!next) return;
  if (activeHumanAction !== next) {
    if (activeHumanAction) activeHumanAction.fadeOut(1.4);
    // Very short clips (sad_pose is ~0.07s) strobe when looped. Hold them near-frozen but keep the
    // action running: the mixer must rewrite bones every frame or addBoneOffset's offsets accumulate.
    const isBlip = next.getClip().duration < 0.5;
    next.setLoop(THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = false;
    next.reset().setEffectiveTimeScale(isBlip ? 0.001 : (targetName === 'idle' ? 0.45 : 0.22)).setEffectiveWeight(1).fadeIn(1.4).play();
    if (isBlip) next.time = next.getClip().duration * 0.5;
    activeHumanAction = next;
  }
}

// --- 10C. CHARACTER 2: THE ASTRAL WITNESS (CRISP MULTICOLOR IRIDESCENT CELESTIAL BEING) ---
const spiritFloatGroup = new THREE.Group();
spiritFloatGroup.position.set(1.08, 0.35, -0.12);
spiritFloatGroup.rotation.y = -Math.PI * 0.42;
sanctuaryGroup.add(spiritFloatGroup);

let spiritMixer = null;
let spiritRobe = null;
let spiritFx = null;   // { robe, ribbons } from buildCosmicSpirit (10h)
const spiritBones = {};

const spiritBodyUniforms = {
  uTime: { value: 0 },
  uSpeakBoost: { value: 0 },
  uCoherence: { value: 0.65 },
  uNature: { value: 1.0 }
};

// Crisp 3D Anatomically Sculpted Multicolor Celestial Shader (Never blows out to white!)
const spiritAstralShader = new THREE.ShaderMaterial({
  uniforms: spiritBodyUniforms,
  transparent: true,
  depthWrite: true,
  blending: THREE.NormalBlending,
  vertexShader: `
    #include <common>
    #include <skinning_pars_vertex>
    attribute vec3 aOrigBindPos;
    varying vec3 vBindPos;
    varying vec3 vNormalView;
    varying vec3 vNormalWorld;
    varying vec3 vViewPos;
    varying vec3 vWorldPos;
    void main() {
      vBindPos = aOrigBindPos;
      #include <beginnormal_vertex>
      #include <skinbase_vertex>
      #include <skinnormal_vertex>
      #include <defaultnormal_vertex>
      vNormalView = normalize(transformedNormal);
      vNormalWorld = normalize((modelMatrix * vec4(objectNormal, 0.0)).xyz);

      #include <begin_vertex>
      #include <skinning_vertex>
      vec4 worldPos = modelMatrix * vec4(transformed, 1.0);
      vWorldPos = worldPos.xyz;
      vec4 mvPosition = viewMatrix * worldPos;
      vViewPos = -mvPosition.xyz;
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform float uSpeakBoost;
    uniform float uCoherence;
    uniform float uNature;
    varying vec3 vBindPos;
    varying vec3 vNormalView;
    varying vec3 vNormalWorld;
    varying vec3 vViewPos;
    varying vec3 vWorldPos;

    float sHash(vec3 p) {
      p = fract(p * 0.1031);
      p += dot(p, p.zyx + 31.32);
      return fract((p.x + p.y) * p.z);
    }
    float sNoise(vec3 p) {
      vec3 i = floor(p);
      vec3 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(mix(sHash(i), sHash(i + vec3(1.0, 0.0, 0.0)), f.x),
            mix(sHash(i + vec3(0.0, 1.0, 0.0)), sHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
        mix(mix(sHash(i + vec3(0.0, 0.0, 1.0)), sHash(i + vec3(1.0, 0.0, 1.0)), f.x),
            mix(sHash(i + vec3(0.0, 1.0, 1.0)), sHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
    }

    void main() {
      vec3 N = normalize(vNormalView);
      vec3 Nw = normalize(vNormalWorld);
      vec3 V = normalize(vViewPos);
      float NoV = abs(dot(N, V));
      float fresnel = pow(1.0 - NoV, 2.3);

      // Fine surface detail: slow drifting luminous veins plus a micro-grain so the body reads as
      // a soft, living material instead of a flat gradient
      float grain = sNoise(vBindPos * 160.0);
      float veins = sNoise(vBindPos * 9.0 + vec3(0.0, uTime * 0.12, 0.0));
      float vein = smoothstep(0.42, 0.5, veins) * (1.0 - smoothstep(0.5, 0.58, veins));
      float detail = 0.94 + 0.10 * grain + 0.10 * vein;

      // Lighting: wrapped key (sun), warm campfire bounce from the hearth side, cool sky fill
      vec3 L_key = normalize(vec3(-0.7, 0.6, 0.6));
      vec3 toFire = vec3(${glslF(fireLight.position.x)}, 0.85, ${glslF(fireLight.position.z)}) - vWorldPos;
      float dFire = length(toFire);
      vec3 L_fire = toFire / dFire;
      float key = clamp((dot(Nw, L_key) + 0.45) / 1.45, 0.0, 1.0);
      float fireW = clamp((dot(Nw, L_fire) + 0.35) / 1.35, 0.0, 1.0) / (1.0 + dFire * dFire * 0.18);
      float sky = Nw.y * 0.5 + 0.5;
      float diff = 0.30 + key * 0.55 + sky * 0.12;
      vec3 fireBounce = vec3(1.0, 0.52, 0.20) * fireW * 0.55;

      // Soft sheen (broad lobe) plus a crisp highlight, both Fresnel-weighted
      vec3 H = normalize(L_key + V);
      float nh = max(0.0, dot(N, H));
      float spec = pow(nh, 48.0) * (0.55 + 0.45 * fresnel) + pow(nh, 8.0) * 0.12;

      // Subsurface glow: thin silhouettes scatter light through the body
      float scatter = pow(1.0 - NoV, 1.6) * (0.5 + 0.5 * key);

      float h = clamp((vBindPos.y - 0.5) / 1.25, 0.0, 1.0);
      // Lower body dissolves into mist so the Witness reads as a presence, not a mannequin on legs
      float mist = smoothstep(0.12, 0.98, vBindPos.y);
      float wave = 0.5 + 0.5 * sin(vBindPos.y * 7.0 - uTime * 2.8);
      float constellation = smoothstep(0.92, 0.98, sin(vBindPos.x * 45.0 + uTime) * cos(vBindPos.y * 45.0 - uTime * 1.2));

      if (uNature > 0.5) {
        // Ethereal sunlit gossamer presence in natural moods (soft pearl, warm gold, tranquil sky-aqua)
        vec3 nLow  = vec3(0.10, 0.24, 0.28);
        vec3 nMid  = vec3(0.22, 0.42, 0.44);
        vec3 nHigh = vec3(0.52, 0.48, 0.36);
        vec3 nGrad = h < 0.5 ? mix(nLow, nMid, h * 2.0) : mix(nMid, nHigh, (h - 0.5) * 2.0);
        vec3 nBody = nGrad * (diff + fireBounce) * detail + vec3(0.75, 0.64, 0.32) * constellation * 0.18;
        vec3 nRim  = mix(vec3(0.45, 0.72, 0.78), vec3(0.92, 0.74, 0.38), wave);
        vec3 nCol  = nBody + nRim * fresnel * (0.55 + uSpeakBoost * 0.25) + vec3(0.55, 0.78, 0.74) * scatter * 0.22 + vec3(0.75, 0.72, 0.62) * spec * 0.30;
        float nAlpha = clamp(0.66 + fresnel * 0.20 - scatter * 0.06, 0.0, 0.92) * mist;
        gl_FragColor = vec4(nCol, nAlpha);
        return;
      }

      // Rainbow Chakra Harmonic Gradient along bind height (Sapphire -> Cyan -> Emerald -> Violet -> Gold)
      vec3 cLow  = vec3(0.06, 0.25, 0.68); // Deep Sapphire
      vec3 cMid  = vec3(0.04, 0.68, 0.85); // Luminous Cyan-Teal
      vec3 cHigh = vec3(0.58, 0.22, 0.88); // Cosmic Amethyst-Violet
      vec3 baseGrad = h < 0.5 ? mix(cLow, cMid, h * 2.0) : mix(cMid, cHigh, (h - 0.5) * 2.0);

      vec3 bodyCol = baseGrad * (diff + fireBounce) * detail + vec3(0.95, 0.78, 0.25) * constellation * 0.35;
      bodyCol += vec3(0.30, 0.85, 1.0) * vein * 0.10;

      // Iridescent Rim (Cyan -> Gold -> Magenta), thin-film shift with view angle
      vec3 rimCol = mix(vec3(0.18, 0.88, 1.25), vec3(1.35, 1.05, 0.35), wave);
      rimCol = mix(rimCol, vec3(1.0, 0.35, 0.95), smoothstep(0.55, 1.0, fresnel) * 0.35);
      vec3 finalCol = bodyCol + rimCol * fresnel * (0.95 + uSpeakBoost * 0.35) + baseGrad * scatter * 0.30 + vec3(0.9, 1.1, 1.3) * spec * 0.45;

      float alpha = clamp(0.86 + fresnel * 0.14, 0.0, 0.99) * mist;
      gl_FragColor = vec4(finalCol, alpha);
    }
  `
});

const spiritWireframeShader = new THREE.ShaderMaterial({
  uniforms: spiritBodyUniforms,
  wireframe: true,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  vertexShader: spiritAstralShader.vertexShader,
  fragmentShader: `
    uniform float uTime;
    varying vec3 vBindPos;
    void main() {
      float pulse = 0.5 + 0.5 * sin(vBindPos.y * 10.0 - uTime * 3.5);
      vec3 col = mix(vec3(0.15, 0.75, 1.1), vec3(1.1, 0.85, 0.3), pulse);
      gl_FragColor = vec4(col, 0.12);
    }
  `
});

// Delicate, Properly Scaled Sacred Geometry Heart Merkaba (in SpiritFloatGroup meter units!)
const heartChakraAttachment = new THREE.Group();
heartChakraAttachment.position.set(0, 1.32, 0.06);
const tetraUp = new THREE.Mesh(
  new THREE.TetrahedronGeometry(0.14, 0),
  new THREE.MeshBasicMaterial({ color: 0xfef08a, wireframe: true })
);
const tetraDown = new THREE.Mesh(
  new THREE.TetrahedronGeometry(0.14, 0),
  new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true })
);
tetraDown.rotation.x = Math.PI;
const heartCoreStar = new THREE.Mesh(
  new THREE.OctahedronGeometry(0.055, 0),
  new THREE.MeshBasicMaterial({ color: 0xfde047 })
);
// the chest galaxy is painted in the glass shader; the old merkaba is replaced by a soft glow
tetraUp.visible = tetraDown.visible = heartCoreStar.visible = false;
const heartGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: goldGlowTex, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
heartGlow.scale.set(0.34, 0.34, 1);
heartChakraAttachment.add(tetraUp, tetraDown, heartCoreStar, heartGlow);
spiritFloatGroup.add(heartChakraAttachment);

// 3 Crisp Multicolor Gyroscopic Armillary Astrolabe Rings
const haloRing1 = new THREE.Mesh(
  new THREE.TorusGeometry(0.30, 0.0035, 8, 128),
  new THREE.MeshBasicMaterial({ color: 0xfde6b0, transparent: true, opacity: 0.55, depthWrite: false })
);
const haloRing2 = new THREE.Mesh(
  new THREE.TorusGeometry(0.46, 0.003, 8, 128),
  new THREE.MeshBasicMaterial({ color: 0xc4c8ff, transparent: true, opacity: 0.45, depthWrite: false })
);
const haloRing3 = new THREE.Mesh(
  new THREE.TorusGeometry(0.64, 0.0025, 8, 128),
  new THREE.MeshBasicMaterial({ color: 0xfff1d0, transparent: true, opacity: 0.35, depthWrite: false })
);
// halo behind the head: glow, dot rings and the three thin rings, billboarded each frame (10h)
const spiritHalo = createSpiritHalo([haloRing1, haloRing2, haloRing3], spiritBodyUniforms);
spiritFloatGroup.add(spiritHalo);

// Delicate Orbiting Astral Motes
const spiritMotes = [];
for (let i = 0; i < 24; i++) {
  const sp = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: i % 3 === 0 ? cyanGlowTex : (i % 3 === 1 ? goldGlowTex : magentaGlowTex),
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  const sz = 0.07 + (i % 3) * 0.03;
  sp.scale.set(sz, sz, 1);
  spiritFloatGroup.add(sp);
  spiritMotes.push({
    sprite: sp,
    angle: (i / 24) * Math.PI * 2,
    radius: 0.65 + (i % 5) * 0.16,
    yOffset: 0.4 + Math.random() * 1.65,
    speed: 0.65 + (i % 4) * 0.25
  });
}

if (xbotBuffer) {
  gltfLoader.parse(xbotBuffer, '', (gltf) => {
    const spirit = gltf.scene;
    spirit.scale.setScalar(1.12);

    spirit.traverse((child) => {
      if (child.isBone) {
        spiritBones[child.name] = child;
        spiritBones[child.name.replace(':', '')] = child;
      }
      if (child.isMesh) {
        child.frustumCulled = false;
        // Joints share the solid shader: the Xbot surface is segmented, so the spheres are what make it read as one body
        child.material = spiritAstralShader;
        child.visible = false; // the Witness is fully procedural (10h); the Xbot joints/surface stay hidden
      }
    });

    // The Xbot surface is segmented; the Witness's body is the procedural build in 10f
    let spiritSkinned = null;
    spirit.traverse((c) => { if (c.isSkinnedMesh) { c.visible = false; if (c.name === 'Beta_Surface') spiritSkinned = c; } });
    try {
      spiritFx = buildCosmicSpirit(spiritSkinned.skeleton, spiritBodyUniforms);
      spiritRobe = spiritFx.robe;
    } catch (e) { console.error('Spirit procedural body failed', e); }

    spiritFloatGroup.add(spirit);

    spiritMixer = new THREE.AnimationMixer(spirit);
    mixers.push(spiritMixer);
    const idleClip = gltf.animations.find((c) => c.name === 'idle') || gltf.animations[0];
    if (idleClip) {
      spiritMixer.clipAction(idleClip).setEffectiveTimeScale(0.55).play();
    }
  });
}

// --- 10D. SOARING ASTRAL EAGLES (procedural; forward = +z, wings along +/-x, ~1.3 wide) ---
// Root mesh = body; head, hooked beak, wedge tail, tucked talons and both wings (inner arm, outer hand,
// six splayed primary "fingers") share its material, so updateNature can recolour/fade the whole eagle
// through children[0].material and scale it through children[0].scale.
const astralBirds = [];
function buildEagle() {
  const mat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
  const accent = mat.clone(); // bald-eagle white head, neck and tail; updateNature recolours it via the bird record
  accent.color.setHex(0xffffff);
  const flat = (pts) => {
    const sh = new THREE.Shape();
    pts.forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y)));
    const g = new THREE.ShapeGeometry(sh);
    g.rotateX(Math.PI / 2); // shape +y -> bird forward (+z)
    return g;
  };
  const mirror = (g) => { const m = g.clone(); m.scale(-1, 1, 1); return m; };
  const ellipsoid = (rx, ry, rz) => { const g = new THREE.SphereGeometry(1, 16, 12); g.scale(rx, ry, rz); return g; };

  // Heavy chest tapering to the tail, thick neck, flat-browed head
  const body = new THREE.Mesh(ellipsoid(0.075, 0.075, 0.25), mat);
  const neck = new THREE.Mesh(ellipsoid(0.048, 0.05, 0.07), accent);
  neck.position.set(0, 0.02, 0.2);
  body.add(neck);
  const head = new THREE.Mesh(ellipsoid(0.046, 0.045, 0.062), accent);
  head.position.set(0, 0.03, 0.275);
  body.add(head);
  // Big hooked beak: heavy cone plus a downturned tip
  const beakGeo = new THREE.ConeGeometry(0.03, 0.08, 8);
  beakGeo.rotateX(Math.PI / 2);
  const beak = new THREE.Mesh(beakGeo, mat);
  beak.position.set(0, 0.012, 0.345);
  body.add(beak);
  const hookGeo = new THREE.ConeGeometry(0.014, 0.04, 6);
  hookGeo.rotateX(Math.PI / 2 + 0.9);
  const hook = new THREE.Mesh(hookGeo, mat);
  hook.position.set(0, -0.012, 0.385);
  body.add(hook);

  // Broad wedge tail with a rounded end
  const tail = new THREE.Mesh(flat([[-0.05, 0], [0.05, 0], [0.12, -0.12], [0.17, -0.26], [0.17, -0.36], [0.1, -0.43], [0, -0.45],
                                    [-0.1, -0.43], [-0.17, -0.36], [-0.17, -0.26], [-0.12, -0.12]]), accent);
  tail.position.set(0, 0.005, -0.2);
  body.add(tail);

  // Feathered thighs and talons tucked back under the tail
  [1, -1].forEach((side) => {
    const legGeo = new THREE.CylinderGeometry(0.017, 0.011, 0.14, 6);
    legGeo.rotateX(Math.PI / 2 + 0.35);
    const leg = new THREE.Mesh(legGeo, mat);
    leg.position.set(side * 0.035, -0.07, -0.13);
    body.add(leg);
    const foot = new THREE.Mesh(ellipsoid(0.02, 0.012, 0.035), mat);
    foot.position.set(side * 0.035, -0.095, -0.2);
    body.add(foot);
  });

  // Right-wing outlines in (x, forward). Inner arm (secondaries, scalloped) -> wrist at x = 0.4 -> hand panel
  const arm = flat([[0, 0.12], [0.2, 0.16], [0.4, 0.15], [0.4, -0.12], [0.35, -0.16], [0.27, -0.215], [0.18, -0.245], [0.09, -0.25], [0, -0.21]]);
  const hand = flat([[0, 0.15], [0.1, 0.14], [0.16, 0.1], [0.16, -0.06], [0.08, -0.1], [0, -0.12]]);
  // Primary feather: long narrow blade with a rounded tip, pointing +x
  const feather = flat([[0, 0.03], [0.36, 0.028], [0.47, 0.012], [0.5, 0], [0.47, -0.012], [0.36, -0.028], [0, -0.03]]);
  const FINGERS = 7;
  const wings = [1, -1].map((side) => {
    const root = new THREE.Group();
    root.position.set(side * 0.05, 0.03, 0.03);
    root.add(new THREE.Mesh(side > 0 ? arm : mirror(arm), mat));
    const elbow = new THREE.Group();
    elbow.position.set(side * 0.4, 0, 0);
    elbow.add(new THREE.Mesh(side > 0 ? hand : mirror(hand), mat));
    const fingers = [];
    for (let i = 0; i < FINGERS; i++) {
      const f = new THREE.Group();
      const k = i / (FINGERS - 1);
      f.position.set(side * 0.12, 0.09 - k * 0.15, 0);
      f.rotation.y = side * (-0.04 + k * 0.34);   // fan back from the leading feather
      const lift = 0.06 + k * 0.08;                  // tips upturned like a soaring eagle
      const fm = new THREE.Mesh(side > 0 ? feather : mirror(feather), mat);
      fm.scale.x = 0.7 + Math.sin(Math.min(1, k * 1.25 + 0.1) * Math.PI) * 0.3; // longest feathers in the middle
      f.add(fm);
      elbow.add(f);
      fingers.push({ f, lift });
    }
    root.add(elbow);
    body.add(root);
    return { root, elbow, fingers, side };
  });
  body.scale.setScalar(0.62); // updateNature scales from this baseline
  return { body, wings, accent };
}
function spawnAstralBird(radius, height, speed, phase, hexColor) {
  const { body, wings, accent } = buildEagle();
  body.material.color.setHex(hexColor);
  const pivot = new THREE.Group();
  pivot.add(body);
  sanctuaryGroup.add(pivot);
  // Mostly a level soaring glide with a raised dihedral; every so often a few slow, shallow beats.
  // The hand lags the arm and the primaries lag the hand, but all stay overlapped (small angles).
  const flap = (t) => {
    const burst = Math.min(1, Math.max(0, Math.sin(t * 0.32 + phase * 2.0) * 2.2 - 0.5));
    const w = t * 2.0 + phase * 3.0;
    wings.forEach(({ root, elbow, fingers, side }) => {
      root.rotation.z = side * (0.12 + Math.sin(w) * 0.2 * burst + Math.sin(t * 0.7 + phase) * 0.02);
      elbow.rotation.z = side * (-0.05 + Math.sin(w - 0.9) * 0.11 * burst);
      fingers.forEach(({ f, lift }, i) => {
        f.rotation.z = side * (lift + Math.sin(w - 1.5 - i * 0.1) * 0.08 * burst);
      });
    });
  };
  astralBirds.push({ pivot, radius, height, speed, phase, flap, accent });
}
spawnAstralBird(5.4, 3.0, 0.45, 0.0,  0x38bdf8);
spawnAstralBird(6.2, 3.4, 0.38, 3.14, 0xfbbf24);

// --- 10E. GEORGE FACE & HAIR DETAIL: EYES, LIDS, NOSE, LIPS, EARS + SHELL-STRAND HAIR, BEARD, BROWS ---
// Everything is authored in the mesh's bind space (metres). Rigid pieces ride the Head bone via
// boneInverse * bindMatrix; strand shells are extra SkinnedMeshes sharing the body skeleton.
function makeEyeTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 0, 256);
  bg.addColorStop(0, '#d8cbc2'); bg.addColorStop(0.5, '#f3eee8'); bg.addColorStop(1, '#d8cbc2');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 256);
  // faint capillaries creeping in from both corners
  g.lineWidth = 1;
  for (let i = 0; i < 60; i++) {
    const side = i % 2 ? 0.5 : 0.0;
    const sx = side * 512 + (Math.random() - 0.5) * 12, sy = 128 + (Math.random() - 0.5) * 70;
    g.strokeStyle = `rgba(170,60,55,${0.08 + Math.random() * 0.12})`;
    g.beginPath(); g.moveTo(sx, sy);
    g.lineTo(sx + (side ? -1 : 1) * (30 + Math.random() * 40), sy + (Math.random() - 0.5) * 24);
    g.stroke();
  }
  const cx = 128, cy = 128;
  const ir = g.createRadialGradient(cx, cy, 10, cx, cy, 41);
  ir.addColorStop(0, '#8a5a2b'); ir.addColorStop(0.45, '#6b4423'); ir.addColorStop(0.9, '#3a2412'); ir.addColorStop(1, '#150c07');
  g.fillStyle = ir; g.beginPath(); g.arc(cx, cy, 41, 0, Math.PI * 2); g.fill();
  for (let i = 0; i < 220; i++) {
    const a = Math.random() * Math.PI * 2, r0 = 13 + Math.random() * 6, r1 = 28 + Math.random() * 12;
    g.strokeStyle = Math.random() < 0.5 ? `rgba(190,140,70,${0.15 + Math.random() * 0.25})` : `rgba(20,10,4,${0.2 + Math.random() * 0.3})`;
    g.lineWidth = 0.8 + Math.random();
    g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.stroke();
  }
  g.strokeStyle = 'rgba(205,150,80,0.55)'; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, 20, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = 'rgba(10,5,3,0.9)'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, 40, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#050302'; g.beginPath(); g.arc(cx, cy, 13, 0, Math.PI * 2); g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  return tex;
}

// Sweep a circular cross-section along a path (for lips): path(t) -> [x,y,z], radius(t) -> metres
function sweepTube(path, radius, ay, az, nu, nv) {
  const pos = [], idx = [];
  for (let i = 0; i <= nu; i++) {
    const t = (i / nu) * 2 - 1;
    const c = path(t), r = radius(t);
    for (let j = 0; j <= nv; j++) {
      const a = (j / nv) * Math.PI * 2;
      pos.push(c[0], c[1] + Math.cos(a) * r * ay, c[2] + Math.sin(a) * r * az);
    }
  }
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const a = i * (nv + 1) + j, b = a + nv + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function hairShellMaterial(mode, layer, len) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMode: { value: mode }, uLayer: { value: layer }, uLen: { value: len },
      uSunDir: georgeMakerShader.uniforms.uSunDir, uSunCol: georgeMakerShader.uniforms.uSunCol,
      uAmbCol: georgeMakerShader.uniforms.uAmbCol, uGndCol: georgeMakerShader.uniforms.uGndCol
    },
    vertexShader: `
      #include <common>
      #include <skinning_pars_vertex>
      attribute vec3 aOrigBindPos;
      uniform float uLayer;
      uniform float uLen;
      varying vec3 vBindPos;
      varying vec3 vNormalWorld;
      varying vec3 vWorldPos;
      void main() {
        vBindPos = aOrigBindPos;
        vec3 nBind = normalize(normal);
        #include <beginnormal_vertex>
        #include <skinbase_vertex>
        #include <skinnormal_vertex>
        vNormalWorld = normalize((modelMatrix * vec4(objectNormal, 0.0)).xyz);
        #include <begin_vertex>
        transformed += nBind * (uLayer * uLen);
        transformed.y -= uLayer * uLayer * uLen * 0.45;
        #include <skinning_vertex>
        vec4 worldPos = modelMatrix * vec4(transformed, 1.0);
        vWorldPos = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform float uMode;
      uniform float uLayer;
      uniform vec3 uSunDir;
      uniform vec3 uSunCol;
      uniform vec3 uAmbCol;
      uniform vec3 uGndCol;
      varying vec3 vBindPos;
      varying vec3 vNormalWorld;
      varying vec3 vWorldPos;
      ${GEORGE_NOISE_GLSL}
      float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

      void main() {
        float x = vBindPos.x, y = vBindPos.y, z = vBindPos.z, ax = abs(x);
        float front = smoothstep(0.04, 0.10, z);
        float mask = 0.0;
        vec2 uv = vec2(0.0);
        vec3 rootC = vec3(0.04), tipC = vec3(0.12);
        float dens = 1.0;

        if (uMode < 0.5) {
          float waveH = sin(x * 110.0) * 0.004;
          float crown = smoothstep(1.688 + waveH, 1.704 + waveH, y);
          float back = smoothstep(0.015, -0.035, z) * smoothstep(1.642 + waveH, 1.678 + waveH, y);
          float temple = smoothstep(0.056, 0.068, ax) * smoothstep(1.668, 1.692, y) * smoothstep(0.045, -0.010, z);
          mask = clamp(crown + back * 0.85 + temple, 0.0, 1.0);
          uv = vec2(atan(x, z - 0.01) * 70.0, y * 600.0);
          rootC = vec3(0.035, 0.026, 0.020);
          tipC = vec3(0.16, 0.115, 0.085);
        } else if (uMode < 1.5) {
          float jawY = smoothstep(1.535, 1.555, y) * smoothstep(1.628 - ax * 0.35, 1.608 - ax * 0.35, y);
          float jawZ = smoothstep(-0.005, 0.032, z);
          float side = smoothstep(0.052, 0.066, ax) * smoothstep(1.595, 1.615, y) * smoothstep(1.705, 1.685, y) * smoothstep(-0.010, 0.028, z);
          float must = smoothstep(0.009, 0.002, abs(y - 1.593)) * smoothstep(0.032, 0.014, ax) * smoothstep(0.075, 0.095, z);
          float lips = smoothstep(0.009, 0.003, abs(y - 1.578)) * smoothstep(0.024, 0.016, ax);
          mask = clamp((jawY * jawZ + side + must) * (1.0 - lips), 0.0, 1.0);
          uv = vec2(x * 520.0, y * 620.0 + z * 120.0);
          rootC = vec3(0.04, 0.03, 0.024);
          tipC = vec3(0.15, 0.105, 0.075);
          dens = 1.0;
        } else {
          float yc = 1.683 + 0.12 * ax - 3.0 * ax * ax;
          float tw = 0.0062 * (1.0 - smoothstep(0.03, 0.058, ax) * 0.75);
          mask = smoothstep(tw, tw * 0.45, abs(y - yc)) * smoothstep(0.011, 0.020, ax) * smoothstep(0.060, 0.047, ax) * front;
          uv = vec2(x * 700.0, y * 1100.0);
          rootC = vec3(0.05, 0.036, 0.026);
          tipC = vec3(0.17, 0.12, 0.085);
        }

        if (mask < 0.04) discard;
        vec2 cell = floor(uv);
        vec2 f = fract(uv);
        float r1 = h21(cell), r2 = h21(cell + 17.3), r3 = h21(cell + 41.9);
        float strandLen = mask * (0.45 + 0.55 * r1);
        if (uLayer > strandLen) discard;
        float rad = 0.52 * (1.0 - 0.6 * uLayer);
        if (length(f - (0.25 + 0.5 * vec2(r2, r3))) > rad) discard;

        vec3 base = mix(rootC, tipC, uLayer) * (0.7 + 0.6 * r2);
        base = pow(base, vec3(2.2 * 0.62)); // already near-linear authoring; keep it dark but not crushed

        vec3 N = normalize(vNormalWorld);
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 T = normalize(vec3(0.0, 1.0, 0.0) - N * N.y);

        vec3 col = vec3(0.0);
        vec3 Lf = vec3(${glslF(fireLight.position.x)}, 0.85, ${glslF(fireLight.position.z)}) - vWorldPos; float df = length(Lf); Lf /= df;
        vec3 Ls = vec3(1.08, 1.75, -0.12) - vWorldPos; float ds = length(Ls); Ls /= ds;
        vec3 Lj = vec3(-1.05, 1.35, 0.42) - vWorldPos; float dj = length(Lj); Lj /= dj;
        vec3 Lm = normalize(uSunDir);
        vec3 cF = vec3(0.90, 0.43, 0.14) * 1.25 / (1.0 + df * df * 0.22);
        vec3 cS = vec3(0.18, 0.52, 0.78) * 0.55 / (1.0 + ds * ds * 0.18);
        vec3 cJ = vec3(0.98, 0.72, 0.22) * 0.30 / (1.0 + dj * dj * 0.9);
        vec3 cM = uSunCol * 0.62;

        vec3 diff = cF * clamp(dot(N, Lf) * 0.6 + 0.4, 0.0, 1.0) + cS * clamp(dot(N, Ls) * 0.6 + 0.4, 0.0, 1.0)
                  + cJ * clamp(dot(N, Lj) * 0.6 + 0.4, 0.0, 1.0) + cM * clamp(dot(N, Lm) * 0.6 + 0.4, 0.0, 1.0);
        vec3 amb = mix(uGndCol, uAmbCol, N.y * 0.5 + 0.5);
        float occl = mix(0.30, 1.0, uLayer);
        col = base * (diff + amb) * occl;

        // Kajiya-Kay strand highlight
        vec3 H1 = normalize(Lf + V);
        vec3 H2 = normalize(Lm + V);
        vec3 H3 = normalize(Lj + V);
        float s1 = sqrt(max(0.0, 1.0 - pow(dot(T, H1), 2.0)));
        float s2 = sqrt(max(0.0, 1.0 - pow(dot(T, H2), 2.0)));
        float s3 = sqrt(max(0.0, 1.0 - pow(dot(T, H3), 2.0)));
        col += (cF * pow(s1, 70.0) + cM * pow(s2, 90.0) * 0.6 + cJ * pow(s3, 70.0)) * 0.22 * uLayer;

        gl_FragColor = vec4(col, 1.0);
      }
    `
  });
}

function buildGeorgeFace(model) {
  let surf = null;
  model.traverse((c) => { if (c.isSkinnedMesh && c.name === 'Beta_Surface') surf = c; });
  if (!surf) return;
  const sk = surf.skeleton;
  const headIdx = sk.bones.findIndex((b) => b.name === 'mixamorigHead');
  if (headIdx < 0) return;
  const headBone = sk.bones[headIdx];

  const faceGroup = new THREE.Group();
  faceGroup.matrixAutoUpdate = false;
  faceGroup.matrix.copy(sk.boneInverses[headIdx]).multiply(surf.bindMatrix);
  headBone.add(faceGroup);
  georgeFace.group = faceGroup;

  // The head is a clean procedural skull (10f) skinned to the Head bone; Xbot's own head is hidden.
  const headGeo = buildGeorgeHeadGeometry(headIdx);
  const headSkin = new THREE.SkinnedMesh(headGeo, georgeToon);
  const headInk = new THREE.SkinnedMesh(headGeo, georgeOutlineSkinned);
  headInk.position.copy(surf.position); headInk.quaternion.copy(surf.quaternion); headInk.scale.copy(surf.scale);
  headInk.frustumCulled = false;
  headSkin.position.copy(surf.position);
  headSkin.quaternion.copy(surf.quaternion);
  headSkin.scale.copy(surf.scale);
  headSkin.frustumCulled = false;
  headSkin.castShadow = true;
  headSkin.receiveShadow = true;
  surf.parent.add(headSkin);
  headSkin.bind(sk, surf.bindMatrix);
  surf.parent.add(headInk);
  headInk.bind(sk, surf.bindMatrix);

  const gp = headGeo.attributes.position;
  const gi = headGeo.index.array;
  const probe = new THREE.Mesh(headGeo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const ray = new THREE.Raycaster();
  const surfZ = (x, y) => {
    ray.set(new THREE.Vector3(x, y, 0.6), new THREE.Vector3(0, 0, -1));
    const h = ray.intersectObject(probe, false)[0];
    return h ? h.point.z : 0.12;
  };
  const surfX = (y, z) => {
    ray.set(new THREE.Vector3(0.4, y, z), new THREE.Vector3(-1, 0, 0));
    const h = ray.intersectObject(probe, false)[0];
    return h ? h.point.x : 0.095;
  };
  const g = (d, s) => Math.exp(-(d * d) / (2 * s * s));
  const ss = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

  // --- Eyes: textured globe, glossy cornea, upper/lower lids, lash lines ---
  const eyeTex = makeStylizedEyeTexture();
  const eyeMat = new THREE.MeshBasicMaterial({ map: eyeTex });
  // bigger anime eyes: globe 1.2x, sunk a little deeper so it bulges about as much as before
  const ER = 0.0190, LR = 0.0206, EYE_SINK = ER - 0.0052;
  const D2R = Math.PI / 180;
  // Lid edges are polar angles (from straight up) for each azimuth a (0 = straight ahead, s * a > 0 = outer corner).
  // Upper: an arch over the top of the iris that drops toward the corners, more at the outer one, so the resting face
  // is calm instead of startled; surprise (lid < 0) still lifts it clear of the iris.
  const archUp = (a, s) => (57 + 30 * (1 - Math.cos(a)) + 6 * Math.min(1, Math.max(0, s * a))) * D2R;
  const archLo = (a) => (130 - 22 * (1 - Math.cos(a))) * D2R;
  const sph = (r, th, a) => [r * Math.sin(th) * Math.sin(a), r * Math.cos(th), r * Math.sin(th) * Math.cos(a)];
  // a shell of the sphere between two polar-angle curves (wraps all the way round; the back sits inside the head)
  const capGeo = (r, th0, th1, NA, NT, aMin = -Math.PI, aMax = Math.PI) => {
    const pos = [], idx = [], fade = [];
    for (let i = 0; i <= NA; i++) {
      const a = aMin + (aMax - aMin) * i / NA, t0 = th0(a), t1 = th1(a);
      for (let j = 0; j <= NT; j++) { pos.push(...sph(r, t0 + (t1 - t0) * j / NT, a)); fade.push(1 - j / NT); }
    }
    for (let i = 0; i < NA; i++) for (let j = 0; j < NT; j++) {
      const v = i * (NT + 1) + j, w = v + NT + 1;
      idx.push(v, v + 1, w, w, v + 1, w + 1);   // outward-facing
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((v, k) => v / r), 3));
    geo.setAttribute('aFade', new THREE.Float32BufferAttribute(fade, 1));
    geo.setIndex(idx);
    return geo;
  };
  const lashMat = new THREE.MeshBasicMaterial({ color: 0x0d0605 });   // ink, like the outlines: unlit
  const rimMat = new THREE.MeshBasicMaterial({ color: 0x3a1a12 });
  // the upper lid's soft shadow across the top of the eyeball, so the iris tucks under the lid instead of floating
  const lidShadeMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: 'attribute float aFade; varying float vF; void main() { vF = aFade; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying float vF; void main() { gl_FragColor = vec4(0.07, 0.035, 0.02, 0.62 * vF * vF); }',
  });
  [-1, 1].forEach((s) => {
    const ex = s * 0.032, ey = 1.660;
    const eye = new THREE.Group();
    eye.position.set(ex, ey, surfZ(ex, ey) - EYE_SINK);
    eye.rotation.y = s * 0.04;
    eye.updateMatrix();
    const eyeInv = eye.matrix.clone().invert();
    // the skin opening is centred ~24° toward the outer corner (the face curves back), so the iris turns out 14° to sit
    // nearer the middle of it; at 0 the irises crowd the nose and he looks slightly cross-eyed
    const ball = new THREE.Mesh(new THREE.SphereGeometry(ER, 40, 24), eyeMat);
    ball.rotation.y = s * 14 * D2R;
    eye.add(ball);
    const lidMesh = (lg) => {
      const lp = lg.attributes.position, bp = new Float32Array(lp.array.length);
      for (let i = 0; i < lp.count; i++) { bp[i * 3] = lp.getX(i) + eye.position.x; bp[i * 3 + 1] = lp.getY(i) + eye.position.y; bp[i * 3 + 2] = lp.getZ(i) + eye.position.z; }
      lg.setAttribute('aOrigBindPos', new THREE.BufferAttribute(bp, 3));
      return new THREE.Mesh(lg, georgeToon);
    };
    // eye-local points kept just above the skin, so the lid line still shows where the lid shell dips under it
    const onSkin = (p, lift) => {
      const v = new THREE.Vector3(...p).applyMatrix4(eye.matrix);
      v.z = Math.max(v.z, surfZ(v.x, v.y) + lift);
      return v.applyMatrix4(eyeInv).toArray();
    };
    // Where the eyeball comes out of the skin, per azimuth (binary search on the polar angle). The brow skin overhangs
    // the top of the eye, so a lid edge above that line never shows: each lid rests a few degrees inside the skin
    // opening, which makes the lid (and its line and shadow) the visible edge of the eye.
    const visible = (th, a) => { const v = new THREE.Vector3(...sph(ER, th, a)).applyMatrix4(eye.matrix); return v.z > surfZ(v.x, v.y) + 0.0002; };
    const AZ = [], skinTop = [], skinBot = [];
    for (let k = -6; k <= 6; k++) {
      const a = k * 12 * D2R; AZ.push(a);
      if (!visible(90 * D2R, a)) { skinTop.push(95 * D2R); skinBot.push(95 * D2R); continue; }
      let lo = 0, hi = 90 * D2R;
      for (let it = 0; it < 9; it++) { const m = (lo + hi) / 2; if (visible(m, a)) hi = m; else lo = m; }
      skinTop.push(hi);
      lo = 90 * D2R; hi = Math.PI;
      for (let it = 0; it < 9; it++) { const m = (lo + hi) / 2; if (visible(m, a)) lo = m; else hi = m; }
      skinBot.push(lo);
    }
    const interp = (tab, a) => {
      const f = Math.max(0, Math.min(12, (a + 72 * D2R) / (12 * D2R))), i = Math.min(11, Math.floor(f));
      return tab[i] + (tab[i + 1] - tab[i]) * (f - i);
    };
    const upperEdge = (a) => Math.max(archUp(a, s), interp(skinTop, a) + 4 * D2R);
    const lowerEdge = (a) => Math.min(archLo(a), interp(skinBot, a) - 3 * D2R);
    (georgeFace.eyeEdges = georgeFace.eyeEdges || []).push({ s, az: AZ.map((v) => Math.round(v / D2R)), top: skinTop.map((v) => Math.round(v / D2R)), bot: skinBot.map((v) => Math.round(v / D2R)) });

    const upperLid = capGeo(LR, () => 0, upperEdge, 64, 10);
    const lowerLid = capGeo(LR, lowerEdge, () => Math.PI, 64, 8);
    // lids take the face's own normals where they face forward, so a half-shut lid shades like the skin around it
    // instead of reading as a separate ball with its own cel shadow
    const eyeQinv = eye.quaternion.clone().invert();
    [upperLid, lowerLid].forEach((lg) => {
      const lp = lg.attributes.position, ln = lg.attributes.normal;
      for (let i = 0; i < lp.count; i++) {
        if (lp.getZ(i) < 0.004) continue;
        const v = new THREE.Vector3(lp.getX(i), lp.getY(i), lp.getZ(i)).applyMatrix4(eye.matrix);
        ray.set(new THREE.Vector3(v.x, v.y, 0.6), new THREE.Vector3(0, 0, -1));
        const h = ray.intersectObject(probe, false)[0];
        if (!h) continue;
        const n = h.face.normal.clone().applyQuaternion(eyeQinv);
        const sN = new THREE.Vector3(ln.getX(i), ln.getY(i), ln.getZ(i)).lerp(n, 0.85).normalize();
        ln.setXYZ(i, sN.x, sN.y, sN.z);
      }
    });
    const lidShade = capGeo(ER + 0.0004, upperEdge, (a) => upperEdge(a) + 13 * D2R, 40, 5, -1.4, 1.4);
    // the open span of the eye (lids apart), inner corner first
    const span = [];
    for (let k = 0; k <= 36; k++) { const a = -s * 72 * D2R + s * 144 * D2R * k / 36; if (upperEdge(a) < lowerEdge(a) - 2 * D2R) span.push(a); }
    // upper lid line: thin at the inner corner, bold over the iris and out to the outer corner, then a short tapered wing
    const upPts = span.map((a) => onSkin(sph(LR + 0.0002, upperEdge(a) - 0.5 * D2R, a), 0.0003));
    const corner = new THREE.Vector3(...upPts[upPts.length - 1]).applyMatrix4(eye.matrix);
    const wingPts = [upPts[upPts.length - 2], upPts[upPts.length - 1]];
    [[0.0030, -0.0006], [0.0060, -0.0018]].forEach(([dx, dy]) => wingPts.push(onSkin(new THREE.Vector3(corner.x + s * dx, corner.y + dy, -1).applyMatrix4(eyeInv).toArray(), 0.0004)));
    const upLine = new THREE.Mesh(sgMerge([sgTube(upPts, 0.0008, 0.0021, 30, 8), sgTube(wingPts, 0.0021, 0.0008, 10, 8)]), lashMat);
    // lower lid line: a fine warm line along the outer two thirds of the lower edge
    const loSpan = span.filter((a) => s * a > -20 * D2R);
    const loPts = loSpan.map((a) => onSkin(sph(LR + 0.0001, lowerEdge(a) + 0.5 * D2R, a), 0.0002));
    const loLine = new THREE.Mesh(sgTube(loPts, 0.0004, 0.0008, 18, 6), rimMat);
    // closed eye: one inked curve on the skin, sagging in the middle like a content anime closed eye. The loop shows it
    // and hides the whole eye (globe, lids, lines) once the upper lid is down, so a shut eye has no dome or crossed lines.
    const shutPts = span.map((a, k) => {
      const u = span.length > 1 ? (k / (span.length - 1)) * 2 - 1 : 0;
      const v = new THREE.Vector3(...sph(ER, upperEdge(a) * 0.42 + lowerEdge(a) * 0.58, a)).applyMatrix4(eye.matrix);
      v.y -= 0.0020 * (1 - u * u);
      v.z = surfZ(v.x, v.y) + 0.0006;
      return v.toArray();
    });
    const mid = Math.floor(shutPts.length / 2);
    const shutLine = new THREE.Mesh(sgMerge([
      sgTube(shutPts.slice(0, mid + 2), 0.0006, 0.0018, 16, 8),
      sgTube(shutPts.slice(mid - 1).reverse(), 0.0007, 0.0018, 16, 8),
    ]), lashMat);
    shutLine.visible = false;
    faceGroup.add(shutLine);
    // lids in their own pivots (the eye centre) so emotions can squint, widen or droop them: +x closes the upper, -x the lower
    const upperG = new THREE.Group(), lowerG = new THREE.Group();
    const shade = new THREE.Mesh(lidShade, lidShadeMat);
    shade.renderOrder = 2;
    upperG.add(lidMesh(upperLid), upLine, shade);
    lowerG.add(lidMesh(lowerLid), loLine);
    eye.add(upperG, lowerG);
    georgeFace.lids.push({ upper: upperG, lower: lowerG });
    georgeFace.eyes.push({ g: eye, s, baseY: s * 0.04, shut: shutLine });
    faceGroup.add(eye);
  });

  // --- Nose: heightfield patch of blended bumps over the sampled face surface ---
  const NX = 24, NY = 34, x0 = -0.034, x1 = 0.034, y0 = 1.598, y1 = 1.676;
  const npos = [], nidx = [];
  for (let iy = 0; iy <= NY; iy++) for (let ix = 0; ix <= NX; ix++) {
    const x = x0 + (x1 - x0) * ix / NX, y = y0 + (y1 - y0) * iy / NY;
    const ax = Math.abs(x);
    const bridgeAmp = 0.003 + 0.009 * ss(1.668, 1.634, y);
    const bridgeSig = 0.0055 + 0.0035 * ss(1.664, 1.628, y);
    let hgt = bridgeAmp * g(x, bridgeSig) * g(y - 1.646, 0.018);
    hgt += 0.019 * g(Math.hypot(x * 1.15, y - 1.620), 0.0092);
    hgt += 0.014 * g(Math.hypot(ax - 0.0170, (y - 1.616) * 1.1), 0.0068);
    hgt *= ss(0, 0.004, Math.min(x1 - ax, y - y0)) * ss(0, 0.004, y1 - y);
    npos.push(x, y, surfZ(x, y) + hgt + 0.0003);
  }
  for (let iy = 0; iy < NY; iy++) for (let ix = 0; ix < NX; ix++) {
    const a = iy * (NX + 1) + ix, b = a + NX + 1;
    nidx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const noseGeo = new THREE.BufferGeometry();
  noseGeo.setAttribute('position', new THREE.Float32BufferAttribute(npos, 3));
  noseGeo.setAttribute('aOrigBindPos', new THREE.Float32BufferAttribute(npos.slice(), 3));
  noseGeo.setIndex(nidx);
  noseGeo.computeVertexNormals();
  {                                    // real normals inside (the form shades itself); near the border they ease into the face surface's own normal so no seam shows
    const nn = noseGeo.attributes.normal, v = new THREE.Vector3(), sn = new THREE.Vector3(), h = 0.0015;
    for (let i = 0; i < nn.count; i++) {
      const ix = i % (NX + 1), iy = Math.floor(i / (NX + 1));
      const e = Math.min(1, Math.min(ix, NX - ix, iy, NY - iy) / 5), t = e * e * (3 - 2 * e);
      const x = npos[i * 3], y = npos[i * 3 + 1];
      sn.set(-(surfZ(x + h, y) - surfZ(x - h, y)) / (2 * h), -(surfZ(x, y + h) - surfZ(x, y - h)) / (2 * h), 1).normalize();
      v.fromBufferAttribute(nn, i).lerp(sn, 1 - t).normalize(); nn.setXYZ(i, v.x, v.y, v.z);
    }
  }
  // shaded by its own material (NOSE_TRUE_N in 10G): a softer cel step there keeps the ridge clean, fading to the face's step at the border
  faceGroup.add(new THREE.Mesh(noseGeo, georgeNoseToon));

  // --- Lips ---
  const lipPath = (cy, bow) => (t) => {
    const x = t * 0.0235;
    const y = cy + 0.0016 * t * t + bow * (1 - Math.abs(t)) * (Math.abs(t) < 0.18 ? -0.4 : 1);
    return [x, y, surfZ(x, y) + 0.0012];
  };
  const taper = (r0) => (t) => r0 * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(t), 2.6)), 0.7) + 0.0002;
  const upperLipGeo = sweepTube(lipPath(1.5815, 0.0006), taper(0.0030), 0.95, 0.85, 40, 12);
  const lowerLipGeo = sweepTube(lipPath(1.5715, 0.0), taper(0.0037), 1.0, 0.95, 40, 12);
  [upperLipGeo, lowerLipGeo].forEach((geo, i) => {
    geo.setAttribute('aOrigBindPos', new THREE.Float32BufferAttribute(geo.attributes.position.array.slice(), 3));
    const lip = new THREE.Mesh(geo, georgeToon);
    faceGroup.add(lip);
    georgeFace.lips[i] = lip; // upper, lower: applyEmotionFace parts them for an open mouth
  });

  // --- Ears: base plate + helix rim + lobe + tragus, leaning back like a real ear (head-bind coords drive the shader paint) ---
  [-1, 1].forEach((s) => {
    const ex = surfX(1.652, 0.0);
    const ear = new THREE.Group();
    ear.position.set(s * (Math.abs(ex) + 0.0030), 1.652, 0.0);
    ear.rotation.set(-0.20, s * 0.32, -s * 0.10);
    const ell = (sx, sy, sz, px, py, pz) => {
      const geo = new THREE.SphereGeometry(1, 20, 14);
      geo.scale(sx, sy, sz);
      const m = new THREE.Mesh(geo, georgeToon); m.position.set(px, py, pz); return m;
    };
    const pts = [];
    for (let k = 0; k <= 24; k++) {                       // helix: back-bottom, up round the back and top, down to the front
      const th = THREE.MathUtils.lerp(-0.92 * Math.PI, 0.42 * Math.PI, k / 24);
      pts.push(new THREE.Vector3(0.0034, 0.0250 * Math.cos(th), 0.0150 * Math.sin(th)));
    }
    const rim = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.0024, 8, false), georgeToon);
    ear.add(ell(0.0040, 0.0245, 0.0160, 0, 0, 0), rim,
      ell(0.0035, 0.0060, 0.0055, 0.0018, -0.0215, 0.0015),   // lobe
      ell(0.0030, 0.0042, 0.0030, 0.0030, -0.0030, 0.0125));  // tragus
    ear.updateMatrix();
    ear.children.forEach((c) => {                           // bake bind coords (head space) for the shader masks, then flatten into faceGroup
      c.updateMatrix();
      const M = new THREE.Matrix4().multiplyMatrices(ear.matrix, c.matrix), p = c.geometry.attributes.position, b = new Float32Array(p.array.length), v = new THREE.Vector3();
      for (let q = 0; q < p.count; q++) { v.fromBufferAttribute(p, q).applyMatrix4(M); b.set([v.x, v.y, v.z], q * 3); }
      c.geometry.setAttribute('aOrigBindPos', new THREE.BufferAttribute(b, 3));
    });
    faceGroup.add(ear);
  });

  // --- Stylized hair, beard and brows (rigid on the head via faceGroup, bind-space coordinates) ---
  const addStyled = (geo, mat) => {
    geo.setAttribute('aOrigBindPos', new THREE.Float32BufferAttribute(geo.attributes.position.array.slice(), 3));
    const m = new THREE.Mesh(geo, mat);
    m.frustumCulled = false;
    faceGroup.add(m);
    const ink = new THREE.Mesh(geo, georgeOutlineSkinned);
    ink.frustumCulled = false;
    faceGroup.add(ink);
    return [m, ink];
  };
  const hb = buildStylizedHairAndBeard(headGeo);
  addStyled(hb.hair, georgeHairMat);
  [-1, 1].forEach((s) => { georgeFace.brows[s] = addStyled(buildStylizedBrows(surfZ, s), georgeHairMat); });

  // 3D beard over the painted one: sample the skull around a vertical axis so the shell wraps from sideburn to sideburn
  const surfAt = (ph, y) => {
    const dir = new THREE.Vector3(-Math.sin(ph), 0, -Math.cos(ph));
    ray.set(new THREE.Vector3(Math.sin(ph) * 0.4, y, -0.004 + Math.cos(ph) * 0.4), dir);
    const h = ray.intersectObject(probe, false)[0];
    return h ? [h.point.x, h.point.y, h.point.z] : [Math.sin(ph) * 0.08, y, -0.004 + Math.cos(ph) * 0.09];
  };
  const beardMesh = new THREE.Mesh(buildStylizedBeard(surfAt), makeGeorgeHairMaterial(georgeMakerShader.uniforms, true));
  beardMesh.frustumCulled = false;
  faceGroup.add(beardMesh);
}
