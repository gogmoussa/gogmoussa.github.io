// © 2026 George Moussa. All rights reserved.
// ============================================================================
// 10H. COSMIC SPIRIT: translucent star-glass Witness with face, starfield hair, ribbons and halo
// ============================================================================
// Target look (reference art): a calm bearded man (closed eyes, small smile, goatee) made of lavender-white
// glass full of galaxies and star sparkles; long wavy hair that is itself a starfield streaming to one side;
// a radiant halo of light dots behind the head; open long-fingered hands; sheer sash + iridescent ribbons;
// a luminous galaxy in the chest. Everything keys on bind-space coordinates (aOrigBindPos) like 10g.
// Needs pbAttach/pbLoft/pbCapsule/pbEllipsoid/pbP + buildGeorgeHeadGeometry (10f) and sgTube/sgRegionShell (10g).
// Loads before 10_characters.js; materials are built when buildCosmicSpirit() runs (after spiritBodyUniforms exists).

const CS_GLSL = `
  float sq(float v) { return v * v; }
  float csH(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
  float csN(vec3 p) {
    vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(csH(i), csH(i + vec3(1,0,0)), f.x), mix(csH(i + vec3(0,1,0)), csH(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(csH(i + vec3(0,0,1)), csH(i + vec3(1,0,1)), f.x), mix(csH(i + vec3(0,1,1)), csH(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float csFbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * csN(p); p *= 2.03; a *= 0.5; } return s; }
  // rgb = star colour, a = intensity. One star per occupied 3D cell, twinkling.
  vec4 csStars(vec3 p, float scale, float density, float t) {
    vec3 q = p * scale, id = floor(q), f = fract(q);
    float h = csH(id);
    vec3 c = vec3(csH(id + 7.1), csH(id + 13.7), csH(id + 21.3)) * 0.6 + 0.2;
    float sz = mix(0.14, 0.38, csH(id + 3.3));
    float s = 1.0 - smoothstep(0.0, sz, length(f - c)); s *= s;
    float tw = 0.65 + 0.35 * sin(t * (1.5 + h * 6.0) + h * 80.0);
    float k = csH(id + 41.0);
    vec3 col = k < 0.5 ? vec3(1.0, 0.97, 0.90) : (k < 0.75 ? vec3(1.0, 0.82, 0.45) : (k < 0.9 ? vec3(0.55, 0.90, 1.0) : vec3(1.0, 0.62, 0.90)));
    return vec4(col, s * tw * step(h, density));
  }
  // spiral galaxy in a unit disc: two log-spiral arms trailed by dust lanes, star-forming knots, gold core, violet halo
  vec4 csGalaxy(vec2 p, float t) {
    float r = length(p), a = atan(p.y, p.x);
    float sp = a - 2.6 * log(r + 0.03) + t * 0.35;
    float arm = pow(0.5 + 0.5 * cos(2.0 * sp), 3.0);
    float lane = pow(0.5 + 0.5 * cos(2.0 * sp + 0.9), 8.0);
    float disc = exp(-r * 2.6);
    float core = exp(-r * r * 30.0);
    vec4 kn = csStars(vec3(p * 1.3, 5.0), 9.0, 0.45, t * 2.0);
    vec3 armCol = mix(vec3(0.98, 0.58, 1.0), vec3(0.45, 0.78, 1.0), smoothstep(0.2, 0.9, r));
    vec3 c = armCol * disc * (0.18 + 1.50 * arm) * (1.0 - 0.70 * lane)
           + vec3(1.0, 0.90, 0.66) * core * 1.5
           + vec3(0.62, 0.55, 1.0) * exp(-r * 1.3) * 0.22
           + kn.rgb * kn.a * arm * disc * 2.2;
    float on = 1.0 - smoothstep(1.0, 1.6, r);
    return vec4(c * on, clamp(disc + core, 0.0, 1.0) * on);
  }
  // chakra light: a soft core plus a faint petalled lotus ring, pulsing as energy climbs (i = 0 root .. 4 throat)
  vec3 csChakra(vec3 P, vec3 c, vec3 col, float t, float i) {
    vec3 d3 = P - c;
    float d = length(d3);
    float pulse = 0.50 + 0.50 * pow(0.5 + 0.5 * sin(t * 0.9 - i * 0.8), 3.0);
    float core = exp(-d * d / 0.00012) + 0.35 * exp(-d * d / 0.0012);
    float petals = 0.55 + 0.45 * cos(atan(d3.y, d3.x) * (4.0 + i * 2.0) + t * 0.3);
    float ring = exp(-sq((d - 0.030) / 0.0035)) * petals;
    return col * (core * 1.6 + ring * 0.6) * pulse;
  }
`;

const CS_VERT = `
  #include <common>
  attribute vec3 aOrigBindPos;
  attribute float aFlow;
  attribute vec2 aUV;
  uniform float uTime;
  uniform float uSway;
  varying vec3 vBindPos;
  varying vec3 vNormalView;
  varying vec3 vNormalWorld;
  varying vec3 vViewPos;
  varying vec3 vWorldPos;
  varying float vFlow;
  varying vec2 vUV;
  void main() {
    vBindPos = aOrigBindPos;
    vFlow = aFlow;
    vUV = aUV;
    // free-end drift: bone-local units are cm, so convert a world-space (metre) amplitude through the bone's world scale
    float sc = length(modelMatrix[0].xyz);
    float ph = aOrigBindPos.x * 9.0 + aOrigBindPos.y * 6.0 + aOrigBindPos.z * 7.0;
    float f = aFlow * aFlow;
    vec3 d = vec3(sin(uTime * 1.7 + ph + aFlow * 3.0), cos(uTime * 1.3 + ph * 1.3 + aFlow * 2.2) * 0.7, sin(uTime * 1.5 + ph * 0.8 + aFlow * 3.7)) * uSway * f / sc;
    vec3 pos = position + d;
    vNormalView = normalize(normalMatrix * normal);
    vNormalWorld = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    vViewPos = -mv.xyz;
    vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const CS_VARY = `
  uniform float uTime;
  uniform float uSpeakBoost;
  uniform float uNature;
  varying vec3 vBindPos;
  varying vec3 vNormalView;
  varying vec3 vNormalWorld;
  varying vec3 vViewPos;
  varying vec3 vWorldPos;
  varying float vFlow;
  varying vec2 vUV;
`;

// translucent lavender glass: living nebula interior, twinkling stars, heart + robe galaxies, chakra lights, rising energy threads, pearly rim
const CS_GLASS_FRAG = `
  ${CS_VARY}
  ${CS_GLSL}
  void main() {
    vec3 N = normalize(vNormalView), V = normalize(vViewPos), Nw = normalize(vNormalWorld);
    float NoV = clamp(abs(dot(N, V)), 0.0, 1.0);
    float fres = pow(1.0 - NoV, 2.2);
    vec3 P = vBindPos;
    float x = P.x, y = P.y, z = P.z, ax = abs(x);
    // lighting: wrapped key (sun), warm campfire bounce from the hearth side, cool sky fill
    vec3 L_key = normalize(vec3(-0.5, 0.7, 0.6));
    vec3 toFire = vec3(${glslF(HEARTH.x)}, 0.45, ${glslF(HEARTH.z)}) - vWorldPos;
    float dFire = length(toFire);
    float key = clamp((dot(Nw, L_key) + 0.45) / 1.45, 0.0, 1.0);
    float fireW = clamp((dot(Nw, toFire / dFire) + 0.35) / 1.35, 0.0, 1.0) / (1.0 + dFire * dFire * 0.18);
    float diff = 0.52 + 0.36 * key + 0.10 * (Nw.y * 0.5 + 0.5);
    vec3 fireBounce = vec3(1.0, 0.52, 0.20) * fireW * 0.40;
    // fine surface detail: micro-grain plus slow drifting luminous veins
    float grain = csFbm(P * 90.0);
    float veinN = csFbm(P * 9.0 + vec3(0.0, uTime * 0.12, 0.0));
    float vein = smoothstep(0.42, 0.50, veinN) * (1.0 - smoothstep(0.50, 0.58, veinN));
    float detail = 0.95 + 0.10 * (grain - 0.5) + 0.06 * vein;
    // subsurface glow: thin silhouettes scatter light through the body
    float scatter = pow(1.0 - NoV, 1.6) * (0.5 + 0.5 * key);
    // spirit body: a pale glass shell over a living, domain-warped nebula; deeper colour where the surface faces the camera
    vec3 fq = P * 3.6 + vec3(0.0, -uTime * 0.05, 0.0);
    vec3 warp = vec3(csFbm(fq + 1.7), csFbm(fq + 9.2), csFbm(fq + 4.4));
    float neb = csFbm(P * 6.0 + warp * 1.8 + vec3(0.0, -uTime * 0.07, 0.0));
    float neb2 = csFbm(P * 13.0 + warp * 2.5 + 7.3);
    vec3 inner = mix(vec3(0.16, 0.18, 0.55), vec3(0.50, 0.36, 0.92), smoothstep(0.30, 0.65, neb));
    inner = mix(inner, vec3(0.30, 0.82, 0.98), smoothstep(0.50, 0.78, warp.x) * 0.55);
    inner = mix(inner, vec3(0.95, 0.52, 0.88), smoothstep(0.55, 0.80, neb2) * 0.45);
    inner += vec3(0.80, 0.86, 1.0) * smoothstep(0.50, 0.80, neb2) * smoothstep(0.45, 0.70, warp.y) * 0.45; // soft bright gas wisps
    float depth = pow(NoV, 1.4);
    vec3 col = mix(vec3(0.60, 0.74, 0.98), inner * 1.15, 0.42 + 0.40 * depth) * (diff + fireBounce) * detail;
    col += vec3(0.30, 0.85, 1.0) * vein * 0.05 + vec3(0.55, 0.70, 1.0) * scatter * 0.16;

    // face zone: a calmer lavender skin, sculpted with painted occlusion so the features read through the glow
    float face = smoothstep(-0.085, -0.010, z) * smoothstep(1.520, 1.550, y) * (1.0 - smoothstep(1.72, 1.76, y));
    vec3 skin = vec3(0.66, 0.74, 0.95) * (0.50 + 0.50 * diff);
    float occ = 0.0;
    occ += 0.30 * exp(-sq((ax - 0.033) / 0.022) - sq((y - 1.665) / 0.014));  // eye sockets
    occ += 0.18 * exp(-sq((ax - 0.020) / 0.010) - sq((y - 1.679) / 0.008));  // inner brow corners
    occ += 0.22 * exp(-sq((ax - 0.018) / 0.0055) - sq((y - 1.618) / 0.010)); // nose wings
    occ += 0.28 * exp(-sq(x / 0.013) - sq((y - 1.603) / 0.0045));            // under the nose
    occ += 0.10 * exp(-sq(x / 0.006) - sq((y - 1.592) / 0.008));             // philtrum
    occ += 0.22 * exp(-sq(x / 0.020) - sq((y - 1.563) / 0.0055));            // under the lower lip
    occ += 0.12 * exp(-sq((ax - 0.040) / 0.012) - sq((y - 1.595) / 0.018));  // smile lines
    occ += 0.25 * smoothstep(0.050, 0.085, ax) * smoothstep(0.0, 0.05, z) * (1.0 - smoothstep(1.70, 1.74, y));       // turn of the face
    float hi = exp(-sq((ax - 0.050) / 0.016) - sq((y - 1.636) / 0.012))       // cheekbones
             + 0.8 * exp(-sq(x / 0.006) - sq((y - 1.640) / 0.020))           // nose bridge
             + 0.6 * exp(-sq(x / 0.030) - sq((y - 1.705) / 0.020));          // forehead
    skin = mix(skin * (1.0 - occ), vec3(0.30, 0.28, 0.62) * (1.0 - occ), occ * 0.5);
    skin += vec3(0.20, 0.24, 0.30) * hi * 0.5;
    float lip = exp(-sq(x / 0.019) - sq((y - 1.5757) / 0.0055));
    skin = mix(skin, vec3(0.82, 0.56, 0.76), lip * 0.50);
    skin += vec3(0.10, 0.08, 0.10) * exp(-sq(x / 0.012) - sq((y - 1.5712) / 0.0025)); // lower-lip sheen
    col = mix(col, skin, face * 0.85);
    float cheek = exp(-sq((ax - 0.058) / 0.020)) * exp(-sq((y - 1.612) / 0.018)) * face;
    col = mix(col, vec3(1.0, 0.66, 0.78), cheek * 0.30);
    // soft jaw shadow under the goatee. Keep this mix: on this GPU, removing it shifts the whole body from pale glass to saturated cyan
    float jawTop = 1.566 + ax * 0.30;
    float bm = (1.0 - smoothstep(jawTop - 0.009, jawTop + 0.003, y)) * smoothstep(1.505, 1.535, y) * smoothstep(-0.005, 0.03, z);
    bm *= 0.28 + 0.72 * (1.0 - smoothstep(0.020, 0.052, ax));
    float nat = mix(1.0, 0.5, uNature);
    float calm = 1.0 - 0.7 * face;
    vec4 s1 = csStars(P, 30.0, 0.30, uTime), s2 = csStars(P + 3.3, 12.0, 0.16, uTime);
    vec3 stars = (s1.rgb * s1.a * 1.1 + s2.rgb * s2.a * 1.6) * 1.5 * calm * nat;
    float starA = (s1.a + s2.a) * calm;

    // heart galaxy (tilted, slowly turning) + two small ones drifting in the robe (front only)
    float front = smoothstep(0.02, 0.05, z);
    vec2 hp = mat2(0.88, -0.47, 0.47, 0.88) * (P.xy - vec2(0.0, 1.32));
    hp.y /= 0.62;
    vec4 g1 = csGalaxy(hp / 0.15, uTime) * front * step(1.12, y);
    vec4 g2 = csGalaxy((P.xy - vec2(0.07, 0.66)) / 0.075, uTime * 0.8 + 2.0) * front * step(y, 1.0);
    vec4 g3 = csGalaxy((P.xy - vec2(-0.09, 0.90)) / 0.05, uTime * 1.2 + 4.0) * front * step(y, 1.0);
    vec3 gal = (g1.rgb * 1.1 + g2.rgb * 0.7 + g3.rgb * 0.7) * nat;

    // chakra lights up the front centre line (the heart one sits under the galaxy; third eye + halo cover the head)
    vec3 chak = csChakra(P, vec3(0.0, 0.930, 0.140), vec3(1.0, 0.32, 0.36), uTime, 0.0)
              + csChakra(P, vec3(0.0, 1.045, 0.100), vec3(1.0, 0.58, 0.22), uTime, 1.0)
              + csChakra(P, vec3(0.0, 1.190, 0.092), vec3(1.0, 0.86, 0.34), uTime, 2.0)
              + csChakra(P, vec3(0.0, 1.320, 0.110), vec3(0.45, 1.0, 0.70), uTime, 3.0) * 0.3
              + csChakra(P, vec3(0.0, 1.488, 0.026), vec3(0.40, 0.78, 1.0), uTime, 4.0) * 0.45; // throat sits right under the face: keep it soft
    // nadis: fine threads of light flowing up through the body, with pulses travelling along them
    float th = csFbm(vec3(x * 14.0, y * 0.7 - uTime * 0.05, z * 14.0) + warp * 0.8);
    float thread = 1.0 - smoothstep(0.0, 0.012, abs(th - 0.5));
    float travel = pow(0.5 + 0.5 * sin(y * 18.0 - uTime * 1.6 + x * 9.0), 10.0);
    vec3 energy = mix(vec3(0.55, 0.85, 1.0), vec3(1.0, 0.86, 0.60), travel) * thread * (0.05 + 0.75 * travel);
    col += (chak + energy * nat) * (1.0 - face);

    col += stars + gal;
    // pearly rim shifts hue with view angle, like a thin film
    vec3 rimC = mix(vec3(0.72, 0.90, 1.0), vec3(1.0, 0.72, 0.96), smoothstep(0.55, 1.0, fres) * 0.45);
    // close-up balance: neck, collarbones and shoulders sit right under the face, so ease their glow and rim
    // (bloom off a white neck otherwise washes over the features)
    float upper = smoothstep(1.36, 1.47, y) * (1.0 - face);
    col += rimC * fres * (0.65 + 0.5 * uSpeakBoost) * (1.0 - 0.75 * face) * (1.0 - 0.45 * upper);
    vec3 H = normalize(normalize(vec3(-0.5, 0.7, 0.6)) + V);
    float nh = max(0.0, dot(N, H));
    col += vec3(1.0) * (pow(nh, 60.0) * 0.18 * (0.55 + 0.45 * fres) + pow(nh, 8.0) * 0.04);
    col *= (1.0 + 0.30 * uSpeakBoost) * (1.0 - 0.26 * upper);
    col = mix(col, vec3(0.05, 0.07, 0.15) + stars * 0.35, bm * 0.30);
    // third-eye point of light between the brows, brightening as the Witness speaks
    float d2 = x * x + sq(y - 1.701);
    float bindu = exp(-d2 / (0.0026 * 0.0026)) + 0.18 * exp(-d2 / (0.008 * 0.008));
    col += vec3(1.0, 0.86, 0.58) * bindu * (0.9 + 0.8 * uSpeakBoost) * face;

    // sprite tail: below the hips the gown dissolves into rising wisps of starlight instead of a hard hem
    // (the visible fade lives in y 0.40..1.02, over the flared, pleated part of the gown)
    float k = clamp((y - 0.40) / 0.62, 0.0, 1.0);
    float tailZone = 1.0 - smoothstep(0.35, 1.0, k);
    float streak = csFbm(vec3(x * 16.0, y * 2.6 - uTime * 0.30, z * 16.0));
    float fine = csFbm(vec3(x * 34.0 + 3.1, y * 7.0 - uTime * 0.55, z * 34.0));
    float wisp = pow(k, 1.5) * 1.6 + (streak - 0.5) * 0.9 + (fine - 0.5) * 0.35 - 0.10;
    float alpha = smoothstep(0.0, 1.0, wisp);
    // brighten and cool toward the tail so it reads as light, with sparks lifting off it
    col = mix(col, vec3(0.62, 0.90, 1.0) * (1.15 + 0.35 * streak), tailZone * 0.55);
    vec4 sp = csStars(P + vec3(0.0, -uTime * 0.12, 0.0), 22.0, 0.22, uTime);
    col += sp.rgb * sp.a * 2.4 * tailZone;
    alpha = max(alpha, sp.a * tailZone * 0.8 * (1.0 - smoothstep(0.0, 0.25, k)));
    if (alpha < 0.012) discard;
    gl_FragColor = vec4(pow(max(col, vec3(0.0)), vec3(2.2)), alpha);
  }
`;

// hair: the starfield itself. Deep indigo, dense stars, pale rim, fraying and brightening toward the tips
const CS_HAIR_FRAG = `
  ${CS_VARY}
  ${CS_GLSL}
  void main() {
    vec3 N = normalize(vNormalView), V = normalize(vViewPos), Nw = normalize(vNormalWorld);
    float NoV = clamp(abs(dot(N, V)), 0.0, 1.0);
    float fres = pow(1.0 - NoV, 2.0);
    vec3 P = vBindPos;
    float diff = 0.55 + 0.45 * max(0.0, dot(Nw, normalize(vec3(-0.5, 0.7, 0.6))));
    float neb = csFbm(P * 6.0 + vec3(uTime * 0.04, 0.0, 0.0));
    vec3 col = mix(vec3(0.008, 0.010, 0.028), vec3(0.05, 0.065, 0.15), neb) * (0.6 + 0.7 * diff);
    col = mix(col, vec3(0.10, 0.22, 0.45), smoothstep(0.6, 0.85, csFbm(P * 13.0)) * 0.3);
    float nat = mix(1.0, 0.55, uNature);
    vec4 s1 = csStars(P, 30.0, 0.42, uTime), s2 = csStars(P + 1.7, 14.0, 0.26, uTime), s3 = csStars(P + 5.1, 7.0, 0.12, uTime);
    col += (s1.rgb * s1.a + s2.rgb * s2.a * 1.5 + s3.rgb * s3.a * 2.2) * 1.5 * nat;
    float tip = smoothstep(0.15, 1.0, vFlow);
    col += vec3(0.45, 0.70, 1.0) * fres * (0.45 + 0.4 * uSpeakBoost);
    col += vec3(0.50, 0.75, 1.0) * tip * 0.35;
    vec3 H = normalize(normalize(vec3(-0.5, 0.7, 0.6)) + V);
    col += vec3(0.55, 0.70, 1.0) * pow(max(0.0, dot(N, H)), 30.0) * 0.30;
    // dense, solid locks; only the very ends feather out
    float alpha = mix(1.0, 0.0, pow(tip, 2.2)) + (s1.a + s2.a + s3.a) * 0.25 * (1.0 - tip);
    // feather the scalp cap's lower edge (temple + nape) so the mesh steps don't read as a hard cut
    float edgeLine = mix(1.668 + 1.2 * min(P.z, 0.0), 1.665 + (P.z + 0.025) * 1.1 + abs(P.x) * 0.2, step(P.z, -0.025));
    float feather = mix(1.0, smoothstep(-0.012, 0.012, P.y - edgeLine), step(P.z, 0.0) * step(abs(P.x), 0.085) * step(P.y, 1.70));
    alpha *= feather;
    gl_FragColor = vec4(pow(max(col, vec3(0.0)), vec3(2.2)), clamp(alpha, 0.0, 1.0));
  }
`;

// ribbons: near-clear pearly lavender with a pastel rainbow edge and drifting stars, added over the scene
const CS_RIBBON_FRAG = `
  ${CS_VARY}
  ${CS_GLSL}
  void main() {
    float edge = abs(vUV.x - 0.5) * 2.0;
    vec3 P = vBindPos;
    vec3 rainbow = 0.55 + 0.45 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + vUV.y * 1.3 + edge * 0.55 + uTime * 0.08));
    float neb = csFbm(P * 7.0 + vec3(0.0, uTime * 0.05, 0.0));
    vec3 body = mix(vec3(0.35, 0.62, 1.0), vec3(0.85, 0.96, 1.0), neb);
    rainbow = mix(rainbow, vec3(0.72, 0.80, 1.0), 0.55); // pastel, closer to the scene's dusk palette
    vec3 col = mix(body, rainbow, pow(edge, 2.2) * 0.6);
    float nat = mix(1.0, 0.5, uNature);
    vec4 s1 = csStars(P, 40.0, 0.24, uTime), s2 = csStars(P + 2.1, 16.0, 0.12, uTime);
    col += (s1.rgb * s1.a + s2.rgb * s2.a * 1.6) * 1.0 * nat;
    // soft at both ends so the ribbons dissolve into the air instead of stopping
    float endFade = smoothstep(0.0, 0.22, vUV.y) * (1.0 - smoothstep(0.45, 1.0, vUV.y));
    float alpha = (0.05 + 0.26 * pow(edge, 2.8) + (s1.a + s2.a) * 0.22) * endFade * mix(1.0, 0.55, uNature) * (1.0 + 0.3 * uSpeakBoost);
    gl_FragColor = vec4(pow(max(col, vec3(0.0)), vec3(2.2)), alpha);
  }
`;

function makeCosmicMaterial(frag, uniforms, sway, opts) {
  const u = Object.assign({}, uniforms, { uSway: { value: sway } });
  return new THREE.ShaderMaterial(Object.assign({
    uniforms: u, vertexShader: CS_VERT, fragmentShader: frag, transparent: true
  }, opts));
}

// soft pearly glow hull (inverted-hull, additive) so the silhouette reads as light, not ink
function makeCosmicOutlineMaterial(thick, uniforms) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: Object.assign({ uThick: { value: thick } }, { uNature: uniforms.uNature, uSpeakBoost: uniforms.uSpeakBoost }),
    vertexShader: `
      uniform float uThick;
      attribute vec3 aOrigBindPos;
      varying float vBindY;
      void main() {
        vBindY = aOrigBindPos.y;
        vec4 mv0 = modelViewMatrix * vec4(position, 1.0);
        float d = length(mv0.xyz);
        vec3 p = position + normalize(normal) * uThick * clamp(d * 0.45, 1.0, 2.6);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uNature;
      uniform float uSpeakBoost;
      varying float vBindY;
      void main() {
        float tail = smoothstep(0.62, 1.0, vBindY); // glow hull fades out with the robe tail
        float neck = smoothstep(1.30, 1.40, vBindY) * (1.0 - smoothstep(1.56, 1.64, vBindY)); // thinner around the shoulders and neck, under the face
        gl_FragColor = vec4(vec3(0.86, 0.80, 1.0), (0.55 + 0.25 * uSpeakBoost) * mix(1.0, 0.5, uNature) * tail * (1.0 - 0.5 * neck));
      }
    `
  });
}

// ---- geometry helpers ----

// tube + per-vertex flow (0 at the root, 1 at the tip), padded for merging
function csTube(points, r0, r1, seg, radial, flowFn) {
  const g = sgTube(points, r0, r1, seg, radial);
  const n = g.attributes.position.count, fl = new Float32Array(n);
  for (let i = 0; i <= seg; i++) for (let j = 0; j <= radial; j++) fl[i * (radial + 1) + j] = flowFn ? flowFn(i / seg) : i / seg;
  g.setAttribute('aFlow', new THREE.BufferAttribute(fl, 1));
  return g;
}

function csMerge(geos) {
  const pos = [], nrm = [], idx = [], flow = [];
  let base = 0;
  geos.forEach((g) => {
    const p = g.attributes.position, n = g.attributes.normal, f = g.attributes.aFlow;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i)); nrm.push(n.getX(i), n.getY(i), n.getZ(i));
      flow.push(f ? f.getX(i) : 0);
    }
    if (g.index) g.index.array.forEach((v) => idx.push(base + v));
    base += p.count;
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  out.setAttribute('aFlow', new THREE.Float32BufferAttribute(flow, 1));
  out.setIndex(idx);
  return out;
}

// flat translucent ribbon along a path. widthFn(v), twistFn(v) -> radians about the path tangent, flowFn(v)
function csRibbon(pts, widthFn, twistFn, flowFn, nv = 90, nu = 6) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.5);
  const pos = [], uv = [], flow = [], idx = [];
  const up = new THREE.Vector3(0, 1, 0), alt = new THREE.Vector3(1, 0, 0);
  for (let i = 0; i <= nv; i++) {
    const v = i / nv, c = curve.getPoint(v), T = curve.getTangent(v).normalize();
    const S = new THREE.Vector3().crossVectors(T, Math.abs(T.y) < 0.9 ? up : alt).normalize();
    const B = new THREE.Vector3().crossVectors(T, S).normalize();
    const th = twistFn(v), w = widthFn(v);
    const side = S.clone().multiplyScalar(Math.cos(th)).addScaledVector(B, Math.sin(th));
    const nor = B.clone().multiplyScalar(Math.cos(th)).addScaledVector(S, -Math.sin(th));
    for (let j = 0; j <= nu; j++) {
      const u = j / nu, k = (u - 0.5) * 2;
      const q = c.clone().addScaledVector(side, k * w * 0.5).addScaledVector(nor, (1 - k * k) * w * 0.12);
      pos.push(q.x, q.y, q.z); uv.push(u, v); flow.push(flowFn(v));
    }
  }
  const row = nu + 1;
  for (let i = 0; i < nv; i++) for (let j = 0; j < nu; j++) {
    const a = i * row + j, b = a + 1, c2 = a + row, d = c2 + 1;
    idx.push(a, c2, b, b, c2, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aUV', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aFlow', new THREE.Float32BufferAttribute(flow, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ---- parts ----

// Gown below the waist: an elliptical loft whose radius carries pleats that deepen and twist toward the hem.
function csRobe() {
  const prof = [ // y, rx, rz, z0  (top rows match the torso loft so the waist join stays tangent)
    [1.20, 0.1380, 0.0920, 0.000], [1.16, 0.1375, 0.0925, 0.001], [1.11, 0.1365, 0.0925, 0.002], [1.06, 0.143, 0.098, 0.004],
    [1.00, 0.166, 0.119, 0.006], [0.88, 0.188, 0.142, 0.002], [0.74, 0.218, 0.170, -0.010], [0.60, 0.252, 0.198, -0.026],
    [0.46, 0.290, 0.226, -0.046], [0.32, 0.330, 0.252, -0.070]
  ];
  const n = prof.length, SEG = 72, STEPS = 60;
  const cr = (p0, p1, p2, p3, t) => 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
  const at = (i) => prof[Math.max(0, Math.min(n - 1, i))];
  const sm = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const pos = [], flow = [], idx = [];
  for (let k = 0; k <= STEPS; k++) {
    const u = (k / STEPS) * (n - 1), i = Math.min(n - 2, Math.floor(u)), t = u - i;
    const f = (c) => cr(at(i - 1)[c], at(i)[c], at(i + 1)[c], at(i + 2)[c], t);
    const y = f(0), rx = f(1), rz = f(2), z0 = f(3);
    const below = sm(1.04, 0.32, y);                   // 0 at the waist, 1 at the hem
    const e = 2 / (1.8 + 0.2 * below);                 // torso's squared section relaxes into an ellipse
    const fold = 0.14 * Math.pow(below, 1.2);
    for (let j = 0; j <= SEG; j++) {
      const a = (j / SEG) * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
      const pleat = 0.55 * Math.sin(6 * a + 0.3 + y * 2.2) + 0.30 * Math.sin(11 * a + 1.7 - y * 3.5) + 0.15 * Math.sin(17 * a + 0.5);
      const r = 1 + fold * pleat;
      pos.push(rx * r * Math.sign(c) * Math.pow(Math.abs(c), e) + 0.03 * Math.pow(below, 2), y,
        z0 + rz * r * Math.sign(sn) * Math.pow(Math.abs(sn), e));
      flow.push(Math.pow(below, 1.3));
    }
  }
  const row = SEG + 1;
  for (let k = 0; k < STEPS; k++) for (let j = 0; j < SEG; j++) {
    const a = k * row + j, b = a + 1, c = a + row, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aFlow', new THREE.Float32BufferAttribute(flow, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = Math.floor(STEPS / 2) * row, nrm = g.attributes.normal, p = g.attributes.position;
  if (nrm.getX(m) * p.getX(m) + nrm.getZ(m) * p.getZ(m) < 0) { // winding must face outward
    const ia = g.index.array;
    for (let q = 0; q < ia.length; q += 3) { const tmp = ia[q + 1]; ia[q + 1] = ia[q + 2]; ia[q + 2] = tmp; }
    g.computeVertexNormals();
  }
  return g;
}

function csHair(headGeo) {
  const rnd = sgRand(11);
  const hairline = (ax) => 1.728 - 0.14 * ax;
  const inHair = (x, y, z) => {
    const ax = Math.abs(x);
    return y > hairline(ax) || (ax > 0.058 && z < 0.0 && y > 1.653 + 1.2 * z) || (z < -0.025 && y > 1.650 + (z + 0.025) * 1.1 + ax * 0.2);
  };
  const lump = (x, y, z) => 0.003 * Math.sin(x * 210 + y * 90) * Math.cos(z * 190 + y * 110);
  const cap = sgRegionShell(headGeo, inHair, 0.012, lump);
  const geos = [cap];
  const V3 = (a) => new THREE.Vector3(...a);
  const Fdir = V3([0.62, 0.22, -0.60]).normalize();      // streaming direction: up-back and to the character's left
  const upV = new THREE.Vector3(0, 1, 0);
  const perp = new THREE.Vector3().crossVectors(Fdir, upV).normalize();
  const perp2 = new THREE.Vector3().crossVectors(Fdir, perp).normalize();
  // locks share one travelling wave (small per-lock jitter) and barely twist, so the hair streams as one mass
  // instead of a pile of shards
  for (let i = 0; i < 52; i++) {
    const th = Math.acos(0.05 + rnd() * 0.95), ph = rnd() * Math.PI * 2;
    const dx = Math.sin(th) * Math.cos(ph), dy = Math.cos(th), dz = Math.sin(th) * Math.sin(ph);
    const s = [0.064 * dx, 1.668 + 0.090 * dy, -0.004 + 0.080 * dz];
    if (!inHair(s[0], s[1] - 0.002, s[2]) && s[1] < 1.70) continue;
    const long = i < 18;
    const len = long ? 0.42 + rnd() * 0.40 : 0.10 + rnd() * 0.16;
    const front = dz > 0.35;
    const nrm = new THREE.Vector3(dx, dy, dz);
    // front locks lift and sweep back over the temple; the rest stream along the flow direction
    const dir = front ? Fdir.clone().multiplyScalar(0.8).add(V3([0, 0.5, 0.1])).normalize() : Fdir.clone().lerp(nrm.clone().multiplyScalar(0.6), 0.15).normalize();
    const A = (long ? 0.05 + rnd() * 0.03 : 0.015 + rnd() * 0.015), fq = 1.25 + rnd() * 0.25, p0 = 0.7 + (rnd() - 0.5) * 0.7;
    const pts = [];
    for (let k = 0; k <= 7; k++) {
      const t = k / 7;
      const root = Math.min(1, t * 3.0);
      const q = V3(s).addScaledVector(nrm, 0.040 * root).addScaledVector(dir, len * t * (0.4 + 0.6 * t))
        .addScaledVector(perp, A * Math.sin(t * Math.PI * fq + p0) * t)
        .addScaledVector(perp2, A * 0.8 * Math.cos(t * Math.PI * (fq + 0.6) + p0) * t)
        .addScaledVector(upV, (long ? 0.10 : 0.03) * Math.sin(t * Math.PI * 0.9) * t);
      pts.push([q.x, q.y, q.z]);
    }
    // broad stylised swoops: wide at the root, tapering to a soft point, fading as they flow out
    const W = long ? 0.072 + rnd() * 0.036 : 0.046 + rnd() * 0.022;
    geos.push(csRibbon(pts, (t) => W * Math.pow(Math.min(1, t * 6 + 0.35), 0.5) * Math.pow(1 - t * t, 0.65) + 0.004,
      (t) => 0.35 * Math.sin(t * 2.4 + p0), (t) => (long ? 0.12 + 0.88 * t : 0.08 + 0.92 * t * 0.8), long ? 40 : 24, 4));
  }
  // tall crown curls
  [[-0.035, 1.772, 0.02, -1], [0.0, 1.782, 0.035, 0.4], [0.035, 1.774, 0.015, 1]].forEach(([x, y, z, b]) => {
    geos.push(csTube([[x, y - 0.012, z], [x + b * 0.012, y + 0.018, z - 0.008], [x + b * 0.035, y + 0.030, z - 0.026], [x + b * 0.06, y + 0.026, z - 0.05]], 0.017, 0.003, 18, 6, (t) => 0.2 + 0.8 * t));
  });
  return csMerge(geos);
}

function csBrowsAndEyes(surfZ, ss) {
  // closed eyes: relaxed "‿" lash curves with a faint lid ridge; thin brows
  const lids = [], brows = [];
  [-1, 1].forEach((s) => {
    const ep = [], bp = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const x = s * (0.014 + t * 0.036), y = 1.6615 - 0.0062 * Math.sin(t * Math.PI) + 0.0016 * t;
      ep.push([x, y, surfZ(x, y) + 0.0018]);
    }
    lids.push(sgTube(ep, 0.0024, 0.0013, 18, 6));
    // short lashes fanning down-and-out along the outer half of each closed lid
    [0.42, 0.56, 0.70, 0.83, 0.95].forEach((t) => {
      const x = s * (0.014 + t * 0.036), y = 1.6615 - 0.0062 * Math.sin(t * Math.PI) + 0.0016 * t, z = surfZ(x, y) + 0.0018;
      const L = 0.0035 + 0.0025 * t;
      lids.push(sgTube([[x, y, z], [x + s * L * 0.45, y - L * 0.55, z + 0.0012], [x + s * L * 1.05, y - L * 0.80, z + 0.0016]], 0.0009, 0.0003, 6, 4));
    });
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const x = s * (0.011 + t * 0.052), y = 1.6905 + 0.0058 * Math.sin(t * Math.PI * 0.85) - 0.0058 * t * t;
      bp.push([x, y, surfZ(x, y) + 0.0028]);
    }
    const bg = sgTube(bp, 0.0042, 0.0013, 18, 6);
    const p = bg.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) - (p.getZ(i) - surfZ(p.getX(i), p.getY(i))) * 0.4);
    bg.computeVertexNormals();
    brows.push(bg);
  });
  return { lids: sgMerge(lids), brows: sgMerge(brows) };
}

function csNose(surfZ, ss) {
  const g = (d, s) => Math.exp(-(d * d) / (2 * s * s));
  const NX = 20, NY = 28, x0 = -0.034, x1 = 0.034, y0 = 1.598, y1 = 1.676;
  const pos = [], idx = [];
  for (let iy = 0; iy <= NY; iy++) for (let ix = 0; ix <= NX; ix++) {
    const x = x0 + (x1 - x0) * ix / NX, y = y0 + (y1 - y0) * iy / NY, ax = Math.abs(x);
    const bridgeAmp = 0.003 + 0.012 * ss(1.668, 1.634, y), bridgeSig = 0.0042 + 0.0030 * ss(1.664, 1.628, y);
    let h = bridgeAmp * g(x, bridgeSig) * g(y - 1.646, 0.018);
    h += 0.016 * g(Math.hypot(x * 1.15, y - 1.620), 0.0092);
    h += 0.012 * g(Math.hypot(ax - 0.0165, (y - 1.616) * 1.1), 0.0068);
    h *= ss(0, 0.004, Math.min(x1 - ax, y - y0)) * ss(0, 0.004, y1 - y);
    pos.push(x, y, surfZ(x, y) + h + 0.0003);
  }
  for (let iy = 0; iy < NY; iy++) for (let ix = 0; ix < NX; ix++) {
    const a = iy * (NX + 1) + ix, b = a + NX + 1;
    idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function csSmile(surfZ) {
  // each half-tube tapers at one end, so build two mirrored halves per lip
  const half = (cy, curl, r, s) => {
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8, x = s * t * 0.0175, y = cy + curl * t * t;
      pts.push([x, y, surfZ(x, y) + 0.0012]);
    }
    return sgTube(pts.reverse(), r * 0.45, r, 16, 6);
  };
  // a single soft mouth line with lifted corners; the lips themselves are tinted in the glass shader
  return sgMerge([half(1.5762, 0.0040, 0.0013, 1), half(1.5762, 0.0040, 0.0013, -1)]);
}

// starfield facial hair matching the locks: a fine moustache drooping past the mouth corners + a chin goatee
function csBeard(surfZ) {
  const half = (s) => {
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8, x = s * (t * 0.030 - 0.0015), y = 1.5915 - 0.0030 * t - 0.0050 * t * t;
      pts.push([x, y, surfZ(x, y) + 0.0022]);
    }
    const g = sgTube(pts, 0.0028, 0.0007, 18, 6);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) - (p.getZ(i) - surfZ(p.getX(i), p.getY(i))) * 0.35);
    g.computeVertexNormals();
    return g;
  };
  // goatee: a smooth patch draped on the chin (a narrow soul patch under the lip widening into a rounded tuft)
  const NX = 14, NY = 24, gy0 = 1.537, gy1 = 1.5685, pos = [], idx = [];
  for (let iy = 0; iy <= NY; iy++) for (let ix = 0; ix <= NX; ix++) {
    const t = iy / NY, u = ix / NX * 2 - 1, y = gy0 + (gy1 - gy0) * t;
    const w = (0.0075 + 0.0105 * Math.exp(-(((t - 0.30) / 0.32) ** 2))) * Math.sqrt(Math.min(1, t * 4 + 0.15));
    const x = w * u;
    pos.push(x, y, surfZ(x, y) + 0.0004 + 0.0024 * Math.sqrt(Math.max(0, 1 - u * u)) * Math.min(1, t * 4));
  }
  for (let iy = 0; iy < NY; iy++) for (let ix = 0; ix < NX; ix++) {
    const a = iy * (NX + 1) + ix, b = a + NX + 1;
    idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const goatee = new THREE.BufferGeometry();
  goatee.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  goatee.setIndex(idx);
  goatee.computeVertexNormals();
  const g = sgMerge([half(1), half(-1), goatee]);
  g.setAttribute('aFlow', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count), 1));
  return g;
}

// lathed limb from a to b; prof(t) gives the radius along it, so muscles swell and joints pinch
function csLimb(a, b, prof, steps = 24) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), L = A.distanceTo(B);
  const pts = [], capN = 6, r0 = prof(0), r1 = prof(1);
  for (let i = 0; i <= capN; i++) { const t = (i / capN) * Math.PI / 2; pts.push(new THREE.Vector2(Math.sin(t) * r0, -Math.cos(t) * r0)); }
  for (let i = 1; i < steps; i++) { const t = i / steps; pts.push(new THREE.Vector2(prof(t), t * L)); }
  for (let i = 0; i <= capN; i++) { const t = (i / capN) * Math.PI / 2; pts.push(new THREE.Vector2(Math.cos(t) * r1, L + Math.sin(t) * r1)); }
  const g = new THREE.LatheGeometry(pts, 28);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()));
  g.translate(A.x, A.y, A.z);
  return g;
}

// long elegant hands, relaxed fingers with a graceful baked curl
function csHands(sk, mat) {
  [['Left', 1], ['Right', -1]].forEach(([side, s]) => {
    const W = pbP(sk, `mixamorig${side}Hand`), bone = `mixamorig${side}Hand`;
    const X = (d) => s * (Math.abs(W.x) + d);
    pbAttach(sk, bone, pbEllipsoid([X(0.030), W.y - 0.002, W.z], 0.054, 0.0200, 0.046), mat);
    // jointed fingers: three phalanges (0.45/0.30/0.25 of the length) bending palm-ward a little more at each joint,
    // a soft swell at each knuckle, and a slight fan so they read as fingers rather than one mitten
    [[0.028, 0.082, 0.0160, 5, [6, 11, 8]], [0.0095, 0.094, 0.0165, 1, [5, 10, 7]],
     [-0.009, 0.086, 0.0155, -4, [7, 13, 9]], [-0.027, 0.068, 0.0135, -10, [9, 16, 11]]].forEach(([dz, L, r, splay, bends]) => {
      const bx = Math.abs(W.x) + 0.060, sp = THREE.MathUtils.degToRad(splay);
      const pts = [[s * bx, W.y - 0.001, W.z + dz]];
      let th = 0;
      [0.45, 0.30, 0.25].forEach((f, k) => {
        th += THREE.MathUtils.degToRad(bends[k]);
        const p = pts[pts.length - 1], seg = L * f;
        const dir = [s * Math.cos(th) * Math.cos(sp), -Math.sin(th), Math.cos(th) * Math.sin(sp)];
        pts.push([p[0] + dir[0] * seg * 0.5, p[1] + dir[1] * seg * 0.5, p[2] + dir[2] * seg * 0.5]);
        pts.push([p[0] + dir[0] * seg, p[1] + dir[1] * seg, p[2] + dir[2] * seg]);
      });
      const g = sgTube(pts, r, r * 0.62, 30, 10);
      // knuckle swells at the two finger joints: scale each ring about its centre
      const P = g.attributes.position, ringN = 11;
      for (let i = 0; i <= 30; i++) {
        const t = i / 30, k = 1.0 + 0.11 * Math.exp(-(((t - 0.45) / 0.05) ** 2)) + 0.08 * Math.exp(-(((t - 0.75) / 0.045) ** 2));
        let cx = 0, cy = 0, cz = 0;
        for (let j = 0; j < ringN - 1; j++) { cx += P.getX(i * ringN + j); cy += P.getY(i * ringN + j); cz += P.getZ(i * ringN + j); }
        cx /= ringN - 1; cy /= ringN - 1; cz /= ringN - 1;
        for (let j = 0; j < ringN; j++) {
          const v = i * ringN + j;
          P.setXYZ(v, cx + (P.getX(v) - cx) * k, cy + (P.getY(v) - cy) * k, cz + (P.getZ(v) - cz) * k);
        }
      }
      g.computeVertexNormals();
      pbAttach(sk, bone, g, mat);
    });
    const tb = Math.abs(W.x) + 0.010;
    pbAttach(sk, bone, sgTube([
      [s * tb, W.y - 0.003, W.z + 0.024],
      [s * (tb + 0.034), W.y - 0.005, W.z + 0.042],
      [s * (tb + 0.062), W.y - 0.010, W.z + 0.062],
      [s * (tb + 0.084), W.y - 0.016, W.z + 0.076]
    ], 0.0200, 0.0135, 18, 8), mat);
  });
}

// returns { robe, ribbons: [{mesh, swayAmp, phase}] } for the animation loop
function buildCosmicSpirit(sk, uniforms) {
  const ring = (y, rx, rz, z0 = 0) => ({ y, rx, rz, z0 });
  const glass = makeCosmicMaterial(CS_GLASS_FRAG, uniforms, 0, { depthWrite: true });
  const hairMat = makeCosmicMaterial(CS_HAIR_FRAG, uniforms, 0.045, { depthWrite: true, side: THREE.DoubleSide });
  const ribbonMat = makeCosmicMaterial(CS_RIBBON_FRAG, uniforms, 0.06, { depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const hullBody = makeCosmicOutlineMaterial(0.20, uniforms);
  const hullFine = makeCosmicOutlineMaterial(0.10, uniforms);
  const inkMat = new THREE.MeshBasicMaterial({ color: 0x2c1d52, transparent: true, opacity: 0.92 });
  const lipMat = new THREE.MeshBasicMaterial({ color: 0x7a4470, transparent: true, opacity: 0.85 });
  glass.name = 'spiritGlass'; hairMat.name = 'spiritHair';
  hairMat.uniforms.uSway.value = 0.045;
  const out = { robe: null, ribbons: [], skeleton: sk };
  const v = (p) => [p.x, p.y, p.z];

  // ---- head + face (bind-space, features sampled from the skull surface like George's) ----
  const headGeo = buildGeorgeHeadGeometry(0);
  ['skinIndex', 'skinWeight'].forEach((a) => headGeo.deleteAttribute(a));
  const probe = new THREE.Mesh(headGeo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const ray = new THREE.Raycaster();
  const surfZ = (x, y) => {
    ray.set(new THREE.Vector3(x, y, 0.6), new THREE.Vector3(0, 0, -1));
    const h = ray.intersectObject(probe, false)[0];
    return h ? h.point.z : 0.1;
  };
  const ss = (a, b, t) => { const q = Math.max(0, Math.min(1, (t - a) / (b - a))); return q * q * (3 - 2 * q); };
  probe.updateMatrixWorld(true);
  const be = csBrowsAndEyes(surfZ, ss);
  const noseGeo = csNose(surfZ, ss);
  const smileGeo = csSmile(surfZ);
  const hairGeo = csHair(headGeo);
  const beardGeo = csBeard(surfZ);
  pbOutlineMat = hullBody;
  pbAttach(sk, 'mixamorigHead', headGeo, glass);
  pbOutlineMat = null;
  pbAttach(sk, 'mixamorigHead', noseGeo, glass);
  pbAttach(sk, 'mixamorigHead', be.lids, inkMat);
  pbAttach(sk, 'mixamorigHead', be.brows, inkMat);
  pbAttach(sk, 'mixamorigHead', smileGeo, lipMat);
  const hairMesh = pbAttach(sk, 'mixamorigHead', hairGeo, hairMat);
  hairMesh.renderOrder = 3;
  pbAttach(sk, 'mixamorigHead', beardGeo, hairMat).renderOrder = 3;

  // ---- body: neck, bare chest, robe skirt ----
  // rounder section, a fuller chest and a sloping trapezius line, so the shoulders are carried by the deltoids instead of a box corner
  pbOutlineMat = hullBody;
  pbAttach(sk, 'mixamorigNeck', pbCapsule([0, 1.47, -0.028], [0, 1.545, -0.024], 0.054, 0.044), glass);
  pbAttach(sk, 'mixamorigSpine2', pbLoft([
    ring(1.00, 0.070, 0.050, 0.004), ring(1.06, 0.118, 0.080, 0.003), ring(1.12, 0.1395, 0.0950, 0.002), ring(1.18, 0.142, 0.096, 0.0), ring(1.26, 0.156, 0.104, 0.0),
    ring(1.33, 0.172, 0.116, 0.002), ring(1.39, 0.176, 0.108, -0.005), ring(1.430, 0.160, 0.088, -0.016),
    ring(1.462, 0.118, 0.070, -0.024), ring(1.490, 0.068, 0.056, -0.028), ring(1.505, 0.050, 0.050, -0.028)
  ], 32, 34, 1.8), glass);
  // flowing gown: same section as the torso at the waist (tangent join, no rim), flaring into pleated folds that trail back
  // and sway at the hem (aFlow), dissolving into wisps in the glass shader
  const robeMat = makeCosmicMaterial(CS_GLASS_FRAG, uniforms, 0.035, { depthWrite: true });
  robeMat.name = 'spiritGlass';
  out.robe = pbAttach(sk, 'mixamorigHips', csRobe(), robeMat);

  // arms: deltoid cap over the joint, a soft bicep swell, forearm fullest near the elbow tapering to a slim wrist
  const bump = (t, c, w) => Math.exp(-((t - c) / w) * ((t - c) / w));
  [['Left', 1], ['Right', -1]].forEach(([side, s]) => {
    const A = pbP(sk, `mixamorig${side}Arm`), E = pbP(sk, `mixamorig${side}ForeArm`), W = pbP(sk, `mixamorig${side}Hand`);
    pbAttach(sk, `mixamorig${side}Arm`, pbEllipsoid([A.x + s * 0.024, A.y - 0.010, A.z + 0.002], 0.064, 0.046, 0.052), glass);
    pbAttach(sk, `mixamorig${side}Arm`, csLimb(v(A), v(E), (t) => 0.044 - 0.009 * t + 0.007 * bump(t, 0.42, 0.22)), glass);
    pbAttach(sk, `mixamorig${side}ForeArm`, csLimb(v(E), v(W), (t) => 0.037 - 0.012 * Math.pow(t, 0.9) + 0.007 * bump(t, 0.22, 0.20)), glass);
  });
  pbOutlineMat = hullFine;
  csHands(sk, glass);
  pbOutlineMat = null;

  // ---- ribbons ----
  const addRibbon = (boneName, geo, sway, phase) => {
    const m = pbAttach(sk, boneName, geo, ribbonMat);
    m.renderOrder = 4; m.castShadow = false; m.receiveShadow = false;
    out.ribbons.push({ mesh: m, sway, phase });
    return m;
  };
  // long swirling ribbons winding up around the figure and flaring out toward the sides
  [[0.0, 1, 1.00, 0.28], [2.2, -1, 0.85, 0.42], [4.3, 1, 0.70, 0.58], [1.1, -1, 0.55, 0.20]].forEach(([a0, dir, size, y0], k) => {
    const pts = [];
    for (let i = 0; i <= 28; i++) {
      const t = i / 28, ang = a0 + dir * t * Math.PI * (1.9 + k * 0.1);
      const r = 0.31 + 0.10 * Math.sin(t * 6.0 + k) + 0.62 * size * Math.pow(t, 2.1);
      const y = y0 + (0.95 + 0.25 * size) * t + 0.10 * Math.sin(t * 9.0 + k * 2.0);
      pts.push([Math.cos(ang) * r, y, Math.sin(ang) * r * 0.85]);
    }
    addRibbon('mixamorigHips', csRibbon(pts, (t) => (0.10 + 0.07 * size) * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.02)), 0.6) + 0.012,
      (t) => 1.4 * Math.sin(t * 7.0 + k * 1.7) + t * 2.0, (t) => 0.15 + 0.85 * t, 110), 0.05, k * 1.3);
  });
  return out;
}

// ---- namaste: palms pressed together in front of the heart, fingers up, thumbs toward the chest ----
// Solved in bind space relative to the chest (2-bone IK + aimed hand frame), then written as absolute local
// quaternions each frame, so the idle clip's arm motion is replaced rather than offset (no accumulation).
// lift (metres) raises the hands slightly for breath.
function csNamastePose(sk, lift, open) { // open 0..1: palms part and turn up (Witness `open-hands`)
  if (!sk.userData) sk.userData = {};
  let B = sk.userData.namaste;
  if (!B) {
    B = {};
    const bind = (name) => {
      const i = pbBoneIndex(sk, name);
      const m = sk.boneInverses[i].clone().invert(), p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
      m.decompose(p, q, sc);
      return { bone: sk.bones[i], p, q };
    };
    B.spine2 = bind('mixamorigSpine2');
    ['Left', 'Right'].forEach((side) => {
      B[side] = {
        sh: bind(`mixamorig${side}Shoulder`), arm: bind(`mixamorig${side}Arm`),
        fore: bind(`mixamorig${side}ForeArm`), hand: bind(`mixamorig${side}Hand`)
      };
    });
    sk.userData.namaste = B;
  }
  const V = THREE.Vector3, Q = THREE.Quaternion;
  const basis = (f, n) => { const t = new V().crossVectors(f, n); return new THREE.Matrix4().makeBasis(f, n, t); };
  [['Left', 1], ['Right', -1]].forEach(([side, s]) => {
    const c = B[side];
    const L1 = c.arm.p.distanceTo(c.fore.p), L2 = c.fore.p.distanceTo(c.hand.p);
    const o = open || 0, A = c.arm.p, W = new V(s * (0.024 + o * 0.2), 1.215 + lift + o * 0.03, 0.200 + o * 0.12);
    // elbow from the triangle, bent down, out and a little back
    const u = W.clone().sub(A); const d = Math.min(u.length(), L1 + L2 - 1e-4); u.normalize();
    const pole = new V(s * 0.55, -1.0, -0.25); pole.addScaledVector(u, -pole.dot(u)).normalize();
    const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    const E = A.clone().addScaledVector(u, a).addScaledVector(pole, h);
    const dArm0 = c.fore.p.clone().sub(c.arm.p).normalize(), dFore0 = c.hand.p.clone().sub(c.fore.p).normalize();
    const rwArm = new Q().setFromUnitVectors(dArm0, E.clone().sub(A).normalize()).multiply(c.arm.q);
    const rwFore = new Q().setFromUnitVectors(dFore0, W.clone().sub(E).normalize()).multiply(c.fore.q);
    // hand: bind frame (fingers along the arm, palm down) -> fingers up and slightly forward, palm facing the other hand
    const f0 = new V(s, 0, 0), n0 = new V(0, -1, 0);
    const f1 = new V(s * 0.25 * o, 1 - 0.75 * o, 0.18 + 0.82 * o).normalize(), n1 = new V(-s * (1 - o), o, 0);
    n1.addScaledVector(f1, -n1.dot(f1)).normalize(); // keep the frame orthonormal while it blends to palms up
    const R = new Q().setFromRotationMatrix(basis(f1, n1).multiply(basis(f0, n0).transpose()));
    const rwHand = R.multiply(c.hand.q);
    c.sh.bone.quaternion.copy(B.spine2.q.clone().invert().multiply(c.sh.q));
    c.arm.bone.quaternion.copy(c.sh.q.clone().invert().multiply(rwArm));
    c.fore.bone.quaternion.copy(rwArm.clone().invert().multiply(rwFore));
    c.hand.bone.quaternion.copy(rwFore.clone().invert().multiply(rwHand));
  });
}

// ---- halo: soft glow disc + concentric rings of light dots + fine rays, billboarded behind the head ----
const HALO_SCALE = 0.55;
function createSpiritHalo(rings, uniforms) {
  const group = new THREE.Group();
  const haloU = { uTime: uniforms.uTime, uNature: uniforms.uNature, uSpeakBoost: uniforms.uSpeakBoost, uPx: { value: 700 } };

  const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.0), new THREE.ShaderMaterial({
    uniforms: haloU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform float uTime; uniform float uNature; uniform float uSpeakBoost;
      varying vec2 vP;
      void main() {
        float r = length(vP);
        float a = atan(vP.y, vP.x);
        float rays = 0.55 + 0.45 * pow(abs(sin(a * 14.0 + uTime * 0.15)), 6.0) * smoothstep(0.35, 0.9, r);
        float g = exp(-r * r * 6.0) * 0.30 + exp(-pow((r - 0.40) / 0.14, 2.0)) * 0.07 + exp(-pow((r - 0.64) / 0.12, 2.0)) * 0.04;
        g *= rays * (1.0 - smoothstep(0.8, 1.0, r)) * (1.0 + 0.35 * uSpeakBoost) * mix(1.0, 0.25, uNature);
        gl_FragColor = vec4(pow(vec3(1.0, 0.86, 0.60), vec3(2.2)) * g, g);
      }
    `
  }));
  glow.renderOrder = 0;
  group.add(glow);

  // concentric rings of dots
  const rnd = sgRand(5);
  const pos = [], size = [], seed = [], hue = [];
  for (let k = 0; k < 9; k++) {
    const R = 0.20 + k * 0.040;
    const n = Math.floor(R * 130);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + k * 0.4 + (rnd() - 0.5) * 0.03, rr = R + (rnd() - 0.5) * 0.008;
      pos.push(Math.cos(a) * rr, Math.sin(a) * rr, 0);
      size.push((0.007 + rnd() * 0.009) * (1.0 - k * 0.025) * HALO_SCALE); seed.push(rnd()); hue.push(rnd());
    }
  }
  // sparse outer stars
  for (let i = 0; i < 45; i++) {
    const a = rnd() * 6.283, rr = 0.55 + rnd() * 0.45;
    pos.push(Math.cos(a) * rr, Math.sin(a) * rr, 0); size.push((0.006 + rnd() * 0.010) * HALO_SCALE); seed.push(rnd()); hue.push(rnd());
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  pg.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1));
  pg.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
  pg.setAttribute('aHue', new THREE.Float32BufferAttribute(hue, 1));
  const dots = new THREE.Points(pg, new THREE.ShaderMaterial({
    uniforms: haloU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float aSize; attribute float aSeed; attribute float aHue;
      uniform float uTime; uniform float uPx;
      varying float vTw; varying float vHue;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vTw = 0.55 + 0.45 * sin(uTime * (1.6 + aSeed * 3.0) + aSeed * 60.0);
        vHue = aHue;
        gl_PointSize = max(1.5, aSize * uPx / -mv.z * 2.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform float uNature; uniform float uSpeakBoost;
      varying float vTw; varying float vHue;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = 1.0 - smoothstep(0.0, 0.5, d); a = a * a;
        vec3 c = vHue < 0.55 ? vec3(1.0, 0.90, 0.68) : (vHue < 0.85 ? vec3(0.78, 0.82, 1.0) : vec3(0.62, 0.95, 1.0));
        float k = a * vTw * (1.0 + 0.4 * uSpeakBoost) * mix(1.0, 0.2, uNature) * 0.6;
        gl_FragColor = vec4(pow(c, vec3(2.2)) * k * 1.6, k);
      }
    `
  }));
  dots.renderOrder = 1;
  group.add(dots);

  // existing gyroscope rings become thin concentric halo circles
  rings.forEach((r, i) => { r.position.set(0, 0, 0.001 * i); r.visible = i === 0; group.add(r); }); // one faint ring only; the dot rings carry the halo
  // sized to sit behind the head (ring ~0.18 m) instead of framing the whole upper body; dots shrink with it
  group.scale.setScalar(HALO_SCALE);
  group.userData.uniforms = haloU;
  return group;
}

const _csQ = new THREE.Quaternion(), _csV = new THREE.Vector3(), _csV2 = new THREE.Vector3();
// Keep the halo facing the camera, centred just behind the head (in spiritFloatGroup space)
function updateSpiritHalo(group, headBone, parent, cam) {
  if (!headBone) return;
  group.userData.uniforms.uPx.value = renderer.domElement.height / // the drawn frame's height, so the dots keep their size in a take of any size
     (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2));
  headBone.getWorldPosition(_csV);
  _csV.y += 0.145;                                   // head centre sits above the Head bone origin
  _csV2.copy(_csV).sub(cam.position).normalize();
  _csV.addScaledVector(_csV2, 0.16);                 // push away from the camera so the head occludes the middle
  group.position.copy(parent.worldToLocal(_csV));
  parent.getWorldQuaternion(_csQ).invert();
  group.quaternion.copy(_csQ).multiply(cam.quaternion);
}
