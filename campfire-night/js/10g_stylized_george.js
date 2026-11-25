// © 2026 George Moussa. All rights reserved.
// ============================================================================
// 10G. STYLIZED GEORGE: cel-shaded material, inked outlines, wavy hair, trimmed beard, brows
// ============================================================================
// Target look (reference art): clean anime/cartoon maker: wavy black hair, big brown eyes, thick brows,
// trimmed beard + goatee, black open overshirt over a dark-grey tee, slate-grey cargo pants, dark sneakers.
// Everything keys on bind-space coordinates (aOrigBindPos), same as the old realistic shader, so the
// procedural body (10f) and head (10f) paint themselves. Loads before 10_characters.js.

// Beard outline in head bind space: jaw + sideburns + mustache, with the mouth and the skin under the nose left open.
// The painted beard (toon frag) and the 3D beard shell (buildStylizedBeard) share it so their edges line up.
const GEORGE_BEARD_GLSL = `
  float beardMask(vec3 p) {
    float ax = abs(p.x), y = p.y;
    float jawTop = 1.598 + ax * 0.22 + 0.0018 * sin(ax * 520.0);   // small serration reads as tufts at the cheek line
    float jawBot = 1.534 + ax * ax * 9.0 + ax * 0.30 - 0.016 * exp(-pow((ax - 0.050) / 0.026, 2.0));              // chin round at centre, jawline climbs to the ear
    // the band narrows to a point as it runs back to the ear, instead of ending in a square cut
    float jb = jawTop - (jawTop - jawBot) * smoothstep(-0.018, 0.020, p.z);   // top edge stays pinned under the sideburn
    float m = step(y, jawTop) * step(jb, y) * step(-0.018, p.z);
    float noseGap = 1.0 - step(ax, 0.034) * step(1.6005, y);
    float mouth = step(ax, 0.036) * step(1.5560, y) * step(y, 1.5935);
    return m * noseGap * (1.0 - mouth);
  }
`;
// Hair on the side of the head (bind space): temple corner, a short recess, then a sideburn in front of the ear that
// runs down into the beard; the ear itself stays skin. zF is the hair's front edge as a function of height.
const GEORGE_SIDEHAIR_GLSL = `
  float sideHairMask(vec3 p) {
    float ax = abs(p.x), y = p.y, z = p.z;
    float nape = 0.075 * (1.0 - smoothstep(-0.085, -0.040, z));   // lower edge slopes down toward the nape, joining the back hairline
    float zOld = 0.030 + 0.020 * smoothstep(1.684, 1.708, y) + 0.006 * (1.0 - smoothstep(1.615, 1.665, y)) - 0.016 * (1.0 - smoothstep(1.612, 1.652, y));
    float zF = mix(0.010, zOld, smoothstep(1.655, 1.688, y));   // no sideburn strip in front of the ear: hair stops at the temple
    float m = smoothstep(0.054, 0.060, ax) * (1.0 - smoothstep(zF - 0.002, zF + 0.002, z)) * smoothstep(1.598 - nape, 1.606 - nape, y);
    float zb = -0.019 - 0.022 * (1.0 - smoothstep(1.625, 1.650, y));   // below the ear the skin cutout widens back, so no thin hair line runs down behind the ear
    float ear = smoothstep(zb, zb + 0.004, z) * (1.0 - smoothstep(0.011, 0.015, z)) * (1.0 - smoothstep(1.672 - 40.0 * z * z, 1.678 - 40.0 * z * z, y));
    return m * (1.0 - ear);
  }
`;
const georgeSideHairFront = (y) => {
  const ss = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const zOld = 0.030 + 0.020 * ss(1.684, 1.708, y) + 0.006 * (1 - ss(1.615, 1.665, y)) - 0.016 * (1 - ss(1.612, 1.652, y));
  return 0.010 + (zOld - 0.010) * ss(1.655, 1.688, y);
};

function georgeBeardMask(x, y, z) {
  const ax = Math.abs(x);
  const jawTop = 1.598 + ax * 0.22 + 0.0018 * Math.sin(ax * 520);
  const jawBot = 1.534 + ax * ax * 9 + ax * 0.30 - 0.016 * Math.exp(-(((ax - 0.050) / 0.026) ** 2));
  const ssb = (a0, a1, v) => { const t = Math.max(0, Math.min(1, (v - a0) / (a1 - a0))); return t * t * (3 - 2 * t); };
  const jb = jawTop - (jawTop - jawBot) * ssb(-0.018, 0.020, z);
  if (z < -0.018 || y > jawTop || y < jb) return 0;
  if (ax < 0.034 && y > 1.6005) return 0;
  if (ax < 0.036 && y > 1.5560 && y < 1.5935) return 0;
  return 1;
}

// Separation rims (Seeker look item 2, Nov 2026), shared by the body/skin and hair/beard shaders. Two crisp cel rims so
// George reads against dark trees in a wide shot: a warm edge on the side of his silhouette that faces the hearth
// (strongest when the camera looks past him into the fire), and a cool sky kicker from above-behind the camera's view,
// mostly on head and shoulders, so there is an edge in every shot and mood. by = bind-space height.
const GEORGE_RIM_GLSL = `
  vec3 georgeRims(vec3 N, vec3 V, vec3 Lf, float fireAmt, vec3 fireH, vec3 skyH, float by) {
    float edge = 1.0 - max(dot(N, V), 0.0);
    float faceF = smoothstep(-0.10, 0.45, dot(N, Lf));
    float backF = 0.40 + 0.60 * smoothstep(-0.40, 0.50, dot(-V, Lf));
    float fireR = smoothstep(0.38, 0.46, edge) * faceF * backF * min(fireAmt, 1.2);
    vec3 Lt = normalize(vec3(0.0, 0.8, 0.0) - V * 0.6);
    float topF = smoothstep(0.05, 0.45, dot(N, Lt));
    float hs = 0.35 + 0.65 * smoothstep(1.22, 1.42, by);
    float skyR = smoothstep(0.40, 0.48, edge) * topF * hs;
    return fireH * vec3(1.0, 0.80, 0.62) * fireR * 0.85 + mix(skyH, vec3(1.0), 0.45) * skyR * 0.40;
  }
`;

const GEORGE_TOON_FRAG = `
  uniform vec3 uSunDir;
  uniform vec3 uSunCol;
  uniform vec3 uAmbCol;
  uniform vec3 uGndCol;
  uniform vec3 uFireCol; uniform float uFireK;
  uniform float uSmile;     // -1 frown .. 1 big smile (set by the emotion blender in 14_animation_loop)
  uniform float uMouthOpen; // 0 closed .. 1 open
  uniform float uBrowLift;  // painted brow follows the 3D brow mesh: lift (m) and knit (+ inner ends up, - down)
  uniform float uBrowKnit;
  uniform float uBlush;
  varying vec3 vBindPos;
  varying vec3 vNormalWorld;
  varying vec3 vWorldPos;
  float gauss(float d, float s) { return exp(-(d * d) / (2.0 * s * s)); }
  float box(float v, float a, float b, float e) { return smoothstep(a - e, a, v) * (1.0 - smoothstep(b, b + e, v)); }
  ${GEORGE_BEARD_GLSL}
  ${GEORGE_SIDEHAIR_GLSL}
  ${GEORGE_RIM_GLSL}

  void main() {
    HANDS_ONLY_DISCARD
    float x = vBindPos.x, y = vBindPos.y, z = vBindPos.z, ax = abs(x);
    vec3 N = normalize(vNormalWorld);
    vec3 V = normalize(cameraPosition - vWorldPos);

    // palette: lit colour, shadow colour
    vec3 skinL = vec3(0.82, 0.60, 0.46), skinS = vec3(0.64, 0.38, 0.37);
    vec3 shirtL = vec3(0.21, 0.21, 0.235), shirtS = vec3(0.06, 0.06, 0.085);
    vec3 teeL = vec3(0.44, 0.44, 0.48), teeS = vec3(0.18, 0.18, 0.23);
    // cargo pants sit one value step above the black overshirt (look item 5): warm slate grey against its cool black
    vec3 pantsL = vec3(0.33, 0.32, 0.315), pantsS = vec3(0.21, 0.20, 0.215);   // lit kept lower: the fire key turned a lighter lit side tan, close to his skin
    vec3 lit = skinL, shd = skinS;
    float rim = 1.0;
    float line = 0.0; // 1 = draw a dark stitch/outline line
    float ao = 1.0;   // painted contact shadow (under the chin, below the hairline)
    float skinK = 0.0; // 1 on bare skin: gets the warm terminator band

    if (y < 0.135) {
      // low-top sneakers: dark upper, pale rubber sole + toe cap
      lit = vec3(0.17, 0.17, 0.19); shd = vec3(0.05, 0.05, 0.07);
      float sole = smoothstep(0.034, 0.028, y);
      lit = mix(lit, vec3(0.92, 0.92, 0.90), sole); shd = mix(shd, vec3(0.62, 0.62, 0.66), sole);
      float toe = smoothstep(0.05, 0.065, z) * smoothstep(0.075, 0.06, y);
      lit = mix(lit, vec3(0.32, 0.32, 0.35), toe * (1.0 - sole));
      line = smoothstep(0.0035, 0.0012, abs(y - 0.034)) * 0.9;
    } else if (y < 1.04) {
      // slate-grey cargo pants: side cargo pockets with flap line + stitching
      lit = pantsL; shd = pantsS;
      float pk = box(y, 0.50, 0.70, 0.004) * smoothstep(0.098, 0.106, ax) * smoothstep(0.215, 0.205, ax);
      lit = mix(lit, pantsL * 1.08, pk * 0.8);   // pocket: a faint lift only, so it stays near the tee's value
      float flap = smoothstep(0.004, 0.0012, abs(y - 0.665)) * smoothstep(0.098, 0.106, ax) * smoothstep(0.215, 0.205, ax);
      float pkEdge = (smoothstep(0.004, 0.0012, abs(y - 0.50)) + smoothstep(0.004, 0.0012, abs(y - 0.70))
        + smoothstep(0.004, 0.0012, abs(ax - 0.102)) * box(y, 0.50, 0.70, 0.001)
        + smoothstep(0.004, 0.0012, abs(ax - 0.212)) * box(y, 0.50, 0.70, 0.001)) * smoothstep(0.098, 0.106, ax) * smoothstep(0.215, 0.205, ax);
      line = clamp(flap + pkEdge, 0.0, 1.0) * 0.8;
      float hem = smoothstep(0.004, 0.0012, abs(y - 0.158)); line = max(line, hem * 0.7);
      // trouser seam down the outside of each leg
      line = max(line, smoothstep(0.003, 0.001, abs(ax - 0.176)) * box(y, 0.16, 0.95, 0.002) * 0.45);
      // belt
      float belt = box(y, 0.995, 1.03, 0.002);
      lit = mix(lit, vec3(0.08, 0.08, 0.09), belt); shd = mix(shd, vec3(0.03), belt);
    } else if (y < 1.488 || (ax > 0.078 && y < 1.545)) {
      if (ax > 0.5 && y > 1.30 && y < 1.60) {
        // rolled sleeve ends at the forearm: bare skin below the cuff
        lit = skinL; shd = skinS;
        float cuff = smoothstep(0.54, 0.505, ax);
        lit = mix(lit, shirtL * 1.25, cuff); shd = mix(shd, shirtS, cuff);
        line = smoothstep(0.004, 0.0012, abs(ax - 0.505)) * 0.9;
        skinK = 1.0 - cuff;
      } else if (ax > 0.215 && y > 1.30) {
        // overshirt sleeve
        lit = shirtL; shd = shirtS;
        rim = 0.38;
        line = smoothstep(0.0035, 0.0012, abs(ax - 0.50)) * 0.0;
      } else {
        // torso: open overshirt (black) over a grey tee centre panel
        lit = shirtL; shd = shirtS;
        rim = 0.38;
        float openW = 0.068 + 0.018 * smoothstep(1.35, 1.10, y);
        float tee = smoothstep(openW + 0.004, openW - 0.004, ax) * smoothstep(0.0, 0.03, z);
        lit = mix(lit, teeL, tee); shd = mix(shd, teeS, tee);
        line = smoothstep(0.0035, 0.0013, abs(ax - openW)) * smoothstep(0.0, 0.03, z) * box(y, 1.05, 1.47, 0.004) * 0.9;
        // chest flap pockets
        float pk = box(y, 1.255, 1.335, 0.003) * smoothstep(0.088, 0.094, ax) * smoothstep(0.160, 0.154, ax) * smoothstep(0.03, 0.06, z);
        line = max(line, pk * (smoothstep(0.003, 0.001, abs(y - 1.30)) + smoothstep(0.003, 0.001, abs(y - 1.255)) * 0.6) * 0.8);
        lit = mix(lit, shirtL * 1.3, pk * 0.5);
        // button placket band + hem
        float hemL = smoothstep(0.005, 0.0013, abs(y - 1.045)) * (1.0 - tee) * 0.8;
        line = max(line, hemL);
        // crew neckline of the tee shows skin
        float neck = smoothstep(1.455, 1.458, y) * smoothstep(openW, openW - 0.002, ax) * max(smoothstep(0.010, 0.016, z), 1.0 - smoothstep(0.046, 0.052, ax)); // the neck itself sits back at z<0.03: still skin
        lit = mix(lit, skinL, neck); shd = mix(shd, skinS, neck);
        skinK = neck; rim = mix(rim, 0.8, neck);   // the neck below the jaw is shaded like the rest of his skin, not like the tee
        // overshirt collar: lighter stand-up band
        float col = smoothstep(1.46, 1.472, y) * smoothstep(openW - 0.004, openW + 0.002, ax) * smoothstep(0.108, 0.098, ax);
        lit = mix(lit, shirtL * 1.5, col);
      }
    } else {
      // head, neck, hands: warm skin with a gentle blush
      lit = skinL; shd = skinS;
      float front = smoothstep(0.04, 0.10, z);
      float cheek = gauss(ax - 0.058, 0.020) * gauss(y - 1.612, 0.018) * front;
      lit = mix(lit, vec3(1.0, 0.70, 0.62), cheek * (0.16 + 0.34 * uBlush));
      float smile = ax * ax * 5.0 * clamp(1.0 + 1.6 * uSmile, -0.6, 2.2); // corners lift (or drop for a frown)
      float ym = y - 1.5775 - smile;
      float mo = uMouthOpen * 0.0085;                    // half-height of the open mouth
      float mz = smoothstep(0.034, 0.050, z);              // the lips sit at z ~0.076 (corners ~0.06) on the current head
      float lipMask = smoothstep(0.0072 + mo, 0.0035 + mo, abs(ym)) * smoothstep(0.034, 0.026, ax) * mz;
      lit = mix(lit, vec3(0.80, 0.44, 0.44), lipMask * 0.85); shd = mix(shd, vec3(0.58, 0.30, 0.34), lipMask);
      float crease = smoothstep(0.0016, 0.0005, abs(ym)) * smoothstep(0.032, 0.026, ax) * mz;
      lit = mix(lit, vec3(0.30, 0.12, 0.14), crease * 0.9); shd = mix(shd, vec3(0.20, 0.08, 0.10), crease);
      float mq = (ym * ym) / max(mo * mo, 1e-9) + (ax * ax) / (0.022 * 0.022);
      float mouthIn = (1.0 - smoothstep(0.75, 1.0, mq)) * step(0.0004, mo) * mz;
      lit = mix(lit, vec3(0.22, 0.07, 0.09), mouthIn); shd = mix(shd, vec3(0.12, 0.04, 0.05), mouthIn);
      float earIn = smoothstep(0.084, 0.092, ax) * gauss(y - 1.650, 0.015) * (1.0 - front);
      lit = mix(lit, vec3(0.93, 0.58, 0.50), earIn * 0.7);
      float earHole = smoothstep(0.084, 0.092, ax) * gauss(y - 1.652, 0.008) * gauss(z + 0.001, 0.006) * (1.0 - front);   // concha: the ear's dark hollow
      lit = mix(lit, vec3(0.62, 0.34, 0.30), earHole * 0.85); shd = mix(shd, vec3(0.38, 0.20, 0.20), earHole * 0.85);
      rim = 0.8;
      float bt = clamp((ax - 0.012) / 0.050, 0.0, 1.0);
      float by = 1.689 + 0.0085 * sin(bt * 2.7) - 0.006 * bt * bt + uBrowLift - uBrowKnit * (ax - 0.037);
      float browM = smoothstep(0.0058 * (1.0 - 0.55 * bt), 0.0026, abs(y - by)) * smoothstep(0.008, 0.014, ax) * smoothstep(0.066, 0.058, ax) * smoothstep(0.04, 0.07, z);
      lit = mix(lit, vec3(0.10, 0.095, 0.125), browM); shd = mix(shd, vec3(0.04, 0.035, 0.05), browM);

      // trimmed beard: painted under the 3D beard shell with the same crisp outline, so the shell's edge sits on dark, not skin
      float jawBot = 1.534 + ax * ax * 9.0 + ax * 0.30 - 0.016 * exp(-pow((ax - 0.050) / 0.026, 2.0));
      float bm = beardMask(vBindPos);
      vec3 beardL = vec3(0.13, 0.115, 0.14), beardS = vec3(0.045, 0.04, 0.055);
      lit = mix(lit, beardL, bm); shd = mix(shd, beardS, bm);
      // painted hair base (the 3D cap/locks sit just inside this edge so the hairline stays smooth)
      float hl = 1.724 - 0.15 * ax;
      float aboveHL = smoothstep(hl - 0.0025, hl + 0.0025, y);
      float nape = 0.075 * (1.0 - smoothstep(-0.080, -0.012, z));   // the back hairline runs down toward the nape
      float zEdge = -0.025 - 0.030 * (1.0 - smoothstep(1.625, 1.650, y));
      float hm = aboveHL * (1.0 - smoothstep(0.060, 0.066, ax))   // undercut: solid hair only on the top strip
        + smoothstep(zEdge + 0.005, zEdge - 0.005, z) * smoothstep(1.572 + ax * 0.2 + 0.010 * sin(x * 140.0 + 3.0) - nape, 1.592 + ax * 0.2 + 0.010 * sin(x * 140.0 + 3.0) - nape, y);
      hm = clamp(hm, 0.0, 1.0);
      // cropped sides: solid dark hair under the thin side shell, no skin showing through
      float shave = clamp(aboveHL + sideHairMask(vBindPos), 0.0, 1.0) * (1.0 - hm);
      lit = mix(lit, vec3(0.12, 0.11, 0.14), shave); shd = mix(shd, vec3(0.035, 0.032, 0.046), shave);
      lit = mix(lit, vec3(0.10, 0.095, 0.125), hm); shd = mix(shd, vec3(0.03, 0.028, 0.042), hm);
      skinK = (1.0 - bm) * (1.0 - hm) * (1.0 - browM) * (1.0 - shave);
      // contact shadows: the jaw shades the neck, the hair shades the top of the forehead, a soft lid crease
      ao *= mix(0.92, 1.0, smoothstep(1.492, jawBot + 0.006, y)) * mix(1.0, 0.0, smoothstep(0.070, 0.090, ax)) + smoothstep(0.070, 0.090, ax);
      ao *= 1.0 - 0.20 * smoothstep(hl - 0.032, hl - 0.002, y) * (1.0 - hm) * front;
      ao *= 1.0 - 0.12 * gauss(ax - 0.031, 0.013) * gauss(y - 1.674, 0.006) * front;
    }

    // ---- cel lighting: the fire is the key, the low sun a back/side light; one crisp shadow step + a highlight band ----
    // each light tints its side, sky tints the shadows
    vec3 Lk = normalize(uSunDir);
    vec3 Pf = vec3(${glslF(fireLight.position.x)}, 0.85, ${glslF(fireLight.position.z)}) - vWorldPos;
    float df = length(Pf);
    vec3 Lf = Pf / df;
    float fireAmt = 1.25 / (1.0 + df * df * 0.22) * uFireK;
    float sunMag = clamp(max(max(uSunCol.r, uSunCol.g), uSunCol.b), 0.3, 1.0);
    // a dim dusk sun or the moon lights less than the golden-hour sun; the hearth is the key whenever it burns
    float sunD = dot(N, Lk) * 0.85 * (0.45 + 0.55 * sunMag), fireD = dot(N, Lf) * 0.95 * fireAmt;
    float amt = sunD + fireD;
    // cel shadow step: a hard edge on cloth, a hair softer on skin so cheeks and jaw don't facet
    float b1 = mix(smoothstep(0.015, 0.040, amt), smoothstep(0.0, 0.075, amt), skinK);
#ifdef NOSE_TRUE_N
    // the nose patch has its real normals: a wider, softer step so its shadow side reads as one clean shape, not a jagged band
    // fades out toward the patch border (x ±0.034, y 1.598..1.676 in 10E) so it meets the head skin's own step without a seam
    float noseIn = smoothstep(0.0, 0.010, min(0.034 - abs(vBindPos.x), min(vBindPos.y - 1.598, 1.676 - vBindPos.y)));
    float noseFade = smoothstep(0.03, 0.06, vBindPos.z) * noseIn;
    b1 = mix(b1, smoothstep(-0.06, 0.16, amt), noseFade);
    // the nose's side walls turn edge-on to the camera, so the fresnel rims (sky, sunset, fire) light them as a pale stripe
    // down the bridge while the cheeks beside them stay dark: keep the rims off the nose, it borrows the face's silhouette
    float noseRimK = 1.0 - 0.9 * noseFade;
#else
    float noseRimK = 1.0;
#endif
    float b2 = smoothstep(0.50, 0.62, amt);
    // light hues (sRGB, brightest channel = 1), so every mood and the teal spirit fire colour George like the set around him
    vec3 sunH = pow(max(uSunCol, vec3(1e-4)), vec3(0.4545)); sunH /= max(max(sunH.r, sunH.g), sunH.b);
    vec3 fireH = pow(max(uFireCol, vec3(1e-4)), vec3(0.4545)); fireH /= max(max(fireH.r, fireH.g), fireH.b);
    vec3 skyH = uAmbCol / max(max(uAmbCol.r, uAmbCol.g), max(uAmbCol.b, 1e-4));
    float wf = max(fireD, 0.0) / (max(sunD, 0.0) + max(fireD, 0.0) + 1e-3);
    // fire-lit side takes the flame's hue strongly (warm key); skin a little more than cloth
    vec3 litT = lit * mix(vec3(1.0), mix(sunH, fireH, wf), 0.30 + (0.26 + 0.04 * skinK) * wf);
    shd = mix(shd, lit * 0.62, 0.28); // shadow side stays readable in the dim twilight scene, but sits a clear step below the lit side
    // the nose ridge is a narrow bump: its hard shadow band and warm terminator read as a smudge, so keep it soft
    float noseK = (1.0 - smoothstep(0.014, 0.030, abs(vBindPos.x))) * smoothstep(1.600, 1.610, vBindPos.y) * (1.0 - smoothstep(1.670, 1.680, vBindPos.y)) * smoothstep(0.03, 0.06, vBindPos.z);
#ifdef NOSE_TRUE_N
    shd = mix(shd, lit * mix(0.88, 0.80, noseIn), noseK * mix(0.75, 0.55, noseIn));   // real form: a gentle, warm shadow side
#else
    shd = mix(shd, lit * 0.88, noseK * 0.75);   // head skin under the patch: keep the ridge soft
#endif
    vec3 shdT = shd * mix(vec3(1.0), skyH, 0.28 - 0.18 * skinK); // skin keeps its warmth in shadow
    vec3 col = mix(shdT, litT, b1);
    // warm terminator on skin: a thin saturated band where light turns to shadow, like light through skin
    float term = b1 * (1.0 - smoothstep(0.10, 0.26, amt)) * skinK * (1.0 - noseK);
    col = mix(col, litT * vec3(1.06, 0.78, 0.72), term * 0.55);
    // on bare skin the highlight band fades in softly: its hard edge made islands of brightness (a pale slab under the jaw)
    float b2s = mix(b2, smoothstep(0.30, 0.82, amt), skinK);
    col = mix(col, litT * 1.08 + 0.02, b2s * 0.35);
    col *= ao;
    {   // nose details painted on top of the form (crisp anime marks, warm not grey): nostrils, alar crease, cast shadow, tip highlight
      // marks are drawn for a front view: fade them where the surface turns edge-on, or a 3/4 view squeezes them into one red smudge
      float nz = smoothstep(0.03, 0.06, vBindPos.z) * skinK * smoothstep(0.25, 0.65, max(dot(N, V), 0.0));
      float nxp = vBindPos.x, nyp = vBindPos.y, anx = abs(nxp);
      vec3 warmD = vec3(0.86, 0.70, 0.66);                                                 // skin-shadow multiplier: darkens toward a warm red-brown
      // nostrils: small tilted ellipses with a crisp edge, inner ends a touch lower
      vec2 nq = vec2(anx - 0.0102, nyp - 1.6062 + 0.10 * (anx - 0.0102));
      float hole = 1.0 - smoothstep(0.70, 1.0, length(nq / vec2(0.0038, 0.0015)));
      // alar crease: a thin arc hugging the outside of each wing
      float wr = length(vec2((anx - 0.0150) / 0.0088, (nyp - 1.6135) / 0.0092));
      float crease = (1.0 - smoothstep(0.06, 0.16, abs(wr - 1.0))) * step(0.0150, anx) * smoothstep(1.606, 1.611, nyp) * (1.0 - smoothstep(1.618, 1.624, nyp));
      // cast shadow under the tip onto the upper lip: a crisp soft-edged crescent, deeper when the key light is high
      float castD = length(vec2(nxp / 0.0125, (nyp - 1.6005) / 0.0034));
      float castS = (1.0 - smoothstep(0.70, 1.0, castD)) * (1.0 - hole);
      col *= mix(vec3(1.0), warmD, nz * clamp(0.55 * castS + 0.40 * crease, 0.0, 1.0));
      col = mix(col, col * vec3(0.52, 0.40, 0.38), nz * hole * 0.50);
      // tip highlight: a small crisp dab, only where the light reaches
      float tipD = length(vec2((nxp + 0.0010) / 0.0046, (nyp - 1.6225) / 0.0036));
      float tipHi = (1.0 - smoothstep(0.55, 1.0, tipD)) * b1;
      col = mix(col, col * 1.12 + 0.035, nz * tipHi * 0.55);
    }
    vec3 tint = clamp(uAmbCol * 3.2 + 0.30, 0.65, 1.30);
    col *= mix(vec3(1.0), tint, 0.25) * 1.06;
    float NoV = max(dot(N, V), 0.0);
    float fresR = smoothstep(0.50, 0.66, pow(1.0 - NoV, 2.4)) * noseRimK;
    float rimB = fresR * smoothstep(-0.25, 0.35, dot(N, normalize(vec3(0.6, 0.2, 0.5))));
    col += vec3(0.58, 0.38, 0.92) * rimB * 0.32 * rim;
    // backlight rim: the low sun behind the set catches George's silhouette in its own colour
    col += sunH * fresR * smoothstep(-0.20, 0.35, dot(N, Lk)) * 0.55 * sunMag * rim;
    // firelight: a warm wash on everything that faces the hearth, so dark cloth catches it too, and a hot edge on the fire side
    float fireF = smoothstep(0.05, 0.75, dot(N, Lf)) * fireAmt;
    col += fireH * vec3(1.0, 0.62, 0.34) * fireF * (0.10 + 0.05 * skinK) * b1;   // only on the lit side, so it doesn't wash out the cel step
    // separation rims (replace the old thin fire edge); black cloth keeps most of them, or his shoulders vanish into the trees
    col += georgeRims(N, V, Lf, fireAmt, fireH, skyH, vBindPos.y) * max(rim, 0.75) * noseRimK;
    col = mix(col, vec3(0.04, 0.035, 0.05), clamp(line, 0.0, 1.0));
    gl_FragColor = vec4(pow(max(col, vec3(0.0)), vec3(2.2)), 1.0); // palette is authored in sRGB; the scene composite is linear
  }
`;

// Skinned-and-rigid-capable vertex shader (bind position drives the painting)
const GEORGE_TOON_VERT = `
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
`;

// trueNose: the nose patch (10E) keeps its real normals and shades itself (NOSE_TRUE_N); every other part leaves it off
function makeGeorgeToonMaterial(uniforms, handsOnly, trueNose) {
  return new THREE.ShaderMaterial({
    uniforms,
    defines: trueNose ? { NOSE_TRUE_N: 1 } : {},
    vertexShader: GEORGE_TOON_VERT,
    fragmentShader: GEORGE_TOON_FRAG.replace('HANDS_ONLY_DISCARD', handsOnly ? 'if (abs(vBindPos.x) <= 0.648) discard;' : '')
  });
}

// Inverted-hull ink outline. thick is in the mesh's own units (metres for skinned bind space,
// centimetres for rigid parts that live in bone space), and grows gently with camera distance.
function makeGeorgeOutlineMaterial(thick, handsOnly) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { uThick: { value: thick } },
    vertexShader: `
      #include <common>
      #include <skinning_pars_vertex>
      attribute vec3 aOrigBindPos;
      uniform float uThick;
      varying vec3 vBindPos;
      void main() {
        vBindPos = aOrigBindPos;
        vec3 nBind = normalize(normal);
        #include <beginnormal_vertex>
        #include <skinbase_vertex>
        #include <skinnormal_vertex>
        #include <begin_vertex>
        // distance to the camera from the posed vertex: on the baked body, position is in bone space, not the world
        #ifdef USE_SKINNING
          float d = length((modelViewMatrix * skinMatrix * vec4(position, 1.0)).xyz);
        #else
          float d = length((modelViewMatrix * vec4(position, 1.0)).xyz);
        #endif
        transformed += nBind * uThick * clamp(d * 0.45, 1.0, 2.6);
        #include <skinning_vertex>
        gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vBindPos;
      void main() {
        ${handsOnly ? 'if (abs(vBindPos.x) <= 0.648) discard;' : ''}
        gl_FragColor = vec4(0.002, 0.002, 0.003, 1.0);
      }
    `
  });
}

// ---- small geometry helpers (bind space, metres) ----
function sgMerge(geos) {
  const pos = [], nrm = [], idx = [], lk = [], lt = [];
  let base = 0;
  const anyLock = geos.some((g) => g.attributes.aLock);
  geos.forEach((g) => {
    const p = g.attributes.position, n = g.attributes.normal, L = g.attributes.aLock, T = g.attributes.aLockT;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nrm.push(n.getX(i), n.getY(i), n.getZ(i)); }
    if (anyLock) for (let i = 0; i < p.count; i++) {
      if (L) { lk.push(L.getX(i), L.getY(i), L.getZ(i), L.getW(i)); lt.push(T.getX(i), T.getY(i), T.getZ(i)); } else { lk.push(0, 0, 0, 0); lt.push(0, 1, 0); }
    }
    if (g.index) g.index.array.forEach((v) => idx.push(base + v));
    base += p.count;
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  if (anyLock) { out.setAttribute('aLock', new THREE.Float32BufferAttribute(lk, 4)); out.setAttribute('aLockT', new THREE.Float32BufferAttribute(lt, 3)); }
  out.setIndex(idx);
  return out;
}

// Tapered tube along a CatmullRom path; r(t) gives radius, section scaled (sy, sz) for flat ribbons
function sgTube(points, r0, r1, seg = 22, radial = 8, curve = 'catmullrom') {
  const path = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, curve, 0.5);
  const frames = path.computeFrenetFrames(seg, false);
  const pos = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, c = path.getPoint(t), n = frames.normals[i], b = frames.binormals[i];
    const r = (r0 + (r1 - r0) * Math.pow(t, 0.8)) * (i === seg ? 0.15 : 1);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      pos.push(c.x + (n.x * Math.cos(a) + b.x * Math.sin(a)) * r, c.y + (n.y * Math.cos(a) + b.y * Math.sin(a)) * r, c.z + (n.z * Math.cos(a) + b.z * Math.sin(a)) * r);
    }
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b2 = a + radial + 1;
    idx.push(a, a + 1, b2, b2, a + 1, b2 + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Triangles of a head-space geometry whose vertices all pass `pred`, pushed out along their normals by `off`
function sgRegionShell(headGeo, pred, off, wobble) {
  const p = headGeo.attributes.position, n = headGeo.attributes.normal, gi = headGeo.index.array;
  const remap = new Map(), pos = [], idx = [];
  const take = (v) => {
    if (remap.has(v)) return remap.get(v);
    const x = p.getX(v), y = p.getY(v), z = p.getZ(v);
    const w = wobble ? wobble(x, y, z) : 0;
    pos.push(x + n.getX(v) * (off + w), y + n.getY(v) * (off + w), z + n.getZ(v) * (off + w));
    remap.set(v, pos.length / 3 - 1);
    return remap.get(v);
  };
  for (let t = 0; t < gi.length; t += 3) {
    const a = gi[t], b = gi[t + 1], c = gi[t + 2];
    if (pred(p.getX(a), p.getY(a), p.getZ(a)) && pred(p.getX(b), p.getY(b), p.getZ(b)) && pred(p.getX(c), p.getY(c), p.getZ(c))) {
      idx.push(take(a), take(b), take(c));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Give a bind-space geometry skin weights 100% on one bone + the bind-position attribute
function sgSkinToBone(g, boneIdx) {
  const count = g.attributes.position.count;
  const si = new Uint16Array(count * 4), sw = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) { si[i * 4] = boneIdx; sw[i * 4] = 1; }
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  g.setAttribute('aOrigBindPos', new THREE.Float32BufferAttribute(g.attributes.position.array.slice(), 3));
  return g;
}

// Deterministic pseudo-random so the hair is the same every load
function sgRand(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }

// Wavy black hair: a smooth scalp cap + big wavy clumps, plus trimmed beard (with mouth gap + goatee).
// Returns {hair, beard} bind-space geometries (not yet skinned).
function buildStylizedHairAndBeard(headGeo) {
  const rnd = sgRand(7);
  const hairline = (ax) => 1.734 - 0.15 * ax;
  const inHair = (x, y, z) => {
    const ax = Math.abs(x);
    // undercut: the cap covers the top strip and the back; the sides are shaved (painted stubble in the toon shader)
    const t = Math.max(0, Math.min(1, (z + 0.080) / 0.068)), nape = 0.075 * (1 - t * t * (3 - 2 * t));
    const te = Math.max(0, Math.min(1, (y - 1.625) / 0.025)), zEdge = -0.025 - 0.030 * (1 - te * te * (3 - 2 * te));   // below the ear the hair's front edge slants back instead of dropping straight down
    return (y > hairline(ax) && ax < 0.062) || (z < zEdge && y > 1.585 + ax * 0.2 + 0.010 * Math.sin(x * 140 + 3.0) - nape);
  };
  const lump = (x, y, z) => 0.0012 * Math.sin(x * 160 + y * 70) * Math.cos(z * 140 + y * 90);
  const cap = sgRegionShell(headGeo, inHair, 0.0035, lump); // thin inner layer: just enough to hide the scalp
  // cropped sides: a closer shell over the temples and above the ears, so the sides read as short hair, not skin
  const inSides = (x, y, z) => {
    const ax = Math.abs(x);
    const side = ax > 0.056 && z < georgeSideHairFront(y) - 0.004 && y > 1.680 - 40 * z * z;
    return !inHair(x, y, z) && (side || (y > hairline(ax) - 0.002 && ax >= 0.058));
  };
  const sides = sgRegionShell(headGeo, inSides, 0.0018, (x, y, z) => 0.0004 * Math.sin(x * 300 + y * 200));

  // Big smooth wavy clumps laid along the skull. Each lock runs between two directions from the skull centre,
  // follows the surface (ray-cast on the head), arches off it, and ends in a soft point that lifts a little.
  const C = new THREE.Vector3(0, 1.668, -0.004);
  const probe = new THREE.Mesh(headGeo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const ray = new THREE.Raycaster();
  const dirOf = (thDeg, phDeg) => {
    const th = THREE.MathUtils.degToRad(thDeg), ph = THREE.MathUtils.degToRad(phDeg);
    return new THREE.Vector3(Math.sin(th) * Math.sin(ph), Math.cos(th), Math.sin(th) * Math.cos(ph));
  };
  const surf = (d) => {
    ray.set(C, d);
    const h = ray.intersectObject(probe, false)[0];
    return h ? h.point.clone() : C.clone().add(new THREE.Vector3(d.x * 0.083, d.y * 0.107, d.z * 0.100));
  };
  const lock = (th0, ph0, th1, ph1, rMax, opt = {}) => {
    const o = Object.assign({ lift: 0.013, arch: 0.008, tipLift: 0.010, wave: 0.005, phase: 0, hang: 0, flick: 0 }, opt);
    // the cut sits close to the head: locks float at ~45% of their authored lift and are ~25% thinner
    const lift = o.lift * 0.45, arch = o.arch * 0.55, tipLift = o.tipLift * 0.7, { wave, phase, hang, flick } = o;
    rMax *= 0.75;
    const d0 = dirOf(th0, ph0), d1 = dirOf(th1, ph1);
    const S = 26, R = 12, cs = [], ns = [];
    for (let i = 0; i <= S; i++) {
      const k = i / S;
      const d = new THREE.Vector3().lerpVectors(d0, d1, k).normalize();
      const s = surf(d), n = s.clone().sub(C).normalize();
      cs.push(s.addScaledVector(n, lift + arch * Math.sin(Math.PI * k) + tipLift * k * k * k)); ns.push(n);
    }
    // sideways S-wave across the surface
    for (let i = 0; i <= S; i++) {
      const k = i / S, T = cs[Math.min(i + 1, S)].clone().sub(cs[Math.max(i - 1, 0)]).normalize();
      const B = new THREE.Vector3().crossVectors(T, ns[i]).normalize();
      cs[i].addScaledVector(B, wave * Math.sin(k * Math.PI * 1.6 + phase) * Math.min(1, k * 3));
    }
    // free-hanging length past the skull: turns from the surface direction toward gravity, leaning out so it clears
    // the neck, and flicks outward at the tip (the wolf-cut flip)
    if (hang > 0) {
      const H = 16, nEnd = ns[S].clone(), T0 = cs[S].clone().sub(cs[S - 1]).normalize();
      const down = new THREE.Vector3(0, -1, 0).addScaledVector(new THREE.Vector3(nEnd.x, 0, nEnd.z).normalize(), 0.22).normalize();
      const p = cs[S].clone();
      for (let m = 1; m <= H; m++) {
        const u = m / H;
        const d = T0.clone().lerp(down, Math.min(1, u * 1.8)).normalize().addScaledVector(nEnd, flick * u * u).normalize();
        p.addScaledVector(d, hang / H);
        // keep clear of the neck column below the skull
        const rx = p.x, rz = p.z + 0.02, rh = Math.hypot(rx, rz);
        if (p.y < 1.60 && rh < 0.078) { p.x *= 0.078 / rh; p.z = (p.z + 0.02) * 0.078 / rh - 0.02; }
        cs.push(p.clone()); ns.push(nEnd);
      }
    }
    const NS = cs.length - 1;
    const pos = [], idx = [], lk = [], lt = [], id = lockN++;
    for (let i = 0; i <= NS; i++) {
      const t = i / NS;
      const T = cs[Math.min(i + 1, NS)].clone().sub(cs[Math.max(i - 1, 0)]).normalize();
      const B = new THREE.Vector3().crossVectors(T, ns[i]).normalize();
      const N2 = new THREE.Vector3().crossVectors(B, T).normalize();
      // hanging locks are fullest near the root and taper to a choppy point; scalp clumps swell in the middle
      const r = (hang > 0 ? rMax * 1.25 * Math.pow(Math.min(1, t * 4 + 0.3), 0.5) * Math.pow(1 - Math.pow(t, 1.8), 0.8)
        : rMax * Math.pow(Math.max(Math.sin(Math.PI * (0.12 + 0.88 * t)), 0), 0.55)) + 0.0004;
      const wB = hang > 0 ? 2.1 : 1.55, wN = hang > 0 ? 0.62 : 0.78; // hanging locks are broad flat sheets, not cords
      for (let j = 0; j <= R; j++) {
        const a = (j / R) * Math.PI * 2;
        const p = cs[i].clone().addScaledVector(B, Math.cos(a) * r * wB).addScaledVector(N2, Math.sin(a) * r * wN);
        pos.push(p.x, p.y, p.z);
        lk.push(t, j / R, id, 2); lt.push(T.x, T.y, T.z);   // aLock: along, around, lock id, flag (2 = a lock; brows get the default w 1)
      }
    }
    for (let i = 0; i < NS; i++) for (let j = 0; j < R; j++) {
      const a = i * (R + 1) + j, b = a + R + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aLock', new THREE.Float32BufferAttribute(lk, 4));
    g.setAttribute('aLockT', new THREE.Float32BufferAttribute(lt, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };
  let lockN = 0;
  const j = (a) => (rnd() - 0.5) * a;
  const locks = [];
  // Swept-back cut with shaved sides: the fringe lifts off the forehead and runs straight back over the top,
  // the crown fans back over the whorl, and only the back keeps length, flipping out at the nape.
  const W = [18, 175];
  // swept-back top: rooted at the front hairline, lifting into a soft quiff and running all the way back over the
  // crown and down the back of the head to the nape (the sides stay cropped)
  for (let i = 0; i < 7; i++) {
    const ph0 = -30 + i * 10 + j(3);
    locks.push(lock(56 + j(2), ph0, 112 + j(5), 180 - ph0 * 0.6 + j(4), 0.0175 + j(0.003),
      { lift: 0.020 - 0.008 * Math.abs(i - 3) / 3 + 0.004 * (i % 2), arch: 0.014, tipLift: 0.0, wave: 0.006, phase: i * 1.4, hang: 0.020 + j(0.008), flick: 1.2 }));
  }
  // crown: second layer laid over the top, also running back to the nape
  for (let i = 0; i < 7; i++) {
    const ph0 = -36 + i * 12 + j(4);
    locks.push(lock(26 + j(5), ph0, 108 + j(6), 180 - ph0 * 0.7 + j(5), 0.0170 + j(0.003),
      { lift: 0.016, arch: 0.012, tipLift: 0.0, wave: 0.008, phase: i * 2.1, hang: 0.015 + j(0.008), flick: 1.4 }));
  }
  // back: the length lives only at the centre back, past the nape and flipping out
  for (let i = 0; i < 7; i++) {
    const ph = 180 - 33 + i * 11 + j(3);
    locks.push(lock(70 + j(4), 180 + (ph - 180) * 0.6, 122 + j(4), ph, 0.0170 + j(0.003),
      { lift: 0.012 + 0.008 * (i % 2), arch: 0.016, tipLift: 0.0, wave: 0.010, phase: i * 1.7, hang: 0.080 + j(0.020), flick: 1.8 + j(0.5) }));
  }
  const hair = sgMerge([cap, sides, ...locks]);

  // beard: jaw + cheeks up to a sideburn line, mustache, goatee; leave the mouth open
  const inBeard = (x, y, z) => {
    const ax = Math.abs(x);
    if (z < -0.02) return false;
    if (y > 1.600 + ax * 0.35) return false;           // upper edge slopes up toward the ear
    if (ax < 0.030 && y > 1.567 && y < 1.586) return false;   // mouth opening
    if (ax < 0.030 && y > 1.586 && y < 1.603) return true;    // mustache
    if (y > 1.586 && ax < 0.034) return false;          // clear skin between mustache edge and nose side
    return y > 1.505;
  };
  return { hair, beard: null };
}

// 3D trimmed beard: a shell over the jaw sampled in a cylindrical grid around the head (surfAt(phi, y) -> surface point),
// pushed out along the surface normal, fuller at the chin and mustache. aOrigBindPos keeps the underlying skin point so
// the beard material clips to the same outline as the painted beard. Returns an unskinned bind-space geometry.
function buildStylizedBeard(surfAt) {
  const NU = 160, NV = 76, ph0 = -1.95, ph1 = 1.95, y0 = 1.525, y1 = 1.618;
  const surf = [], pos = [], idx = [];
  for (let iv = 0; iv <= NV; iv++) for (let iu = 0; iu <= NU; iu++) surf.push(surfAt(ph0 + (ph1 - ph0) * iu / NU, y0 + (y1 - y0) * iv / NV));
  for (let iv = 0; iv < NV; iv++) for (let iu = 0; iu < NU; iu++) {
    const a = iv * (NU + 1) + iu, b = a + NU + 1;
    // rows near the underside of the head can miss the raycast and land far away: skip those stretched triangles (they drew a stray line off the goatee)
    const far = (i, j) => Math.hypot(surf[i][0] - surf[j][0], surf[i][1] - surf[j][1], surf[i][2] - surf[j][2]) > 0.012;
    if (far(a, a + 1) || far(a, b) || far(a + 1, b + 1) || far(b, b + 1) || far(a + 1, b)) continue;
    idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(surf.flat(), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const n = g.attributes.normal;
  surf.forEach(([x, y, z], i) => {
    const ax = Math.abs(x);
    const chin = Math.exp(-((y - 1.540) ** 2) / (2 * 0.016 ** 2)) * Math.exp(-(ax * ax) / (2 * 0.040 ** 2));
    const stache = Math.exp(-((y - 1.594) ** 2) / (2 * 0.004 ** 2)) * (ax < 0.034 ? 1 : 0);
    const lump = 0.0007 * Math.sin(x * 610 + y * 230) * Math.cos(z * 540 + y * 170);
    const off = 0.0020 + 0.0042 * chin + 0.0016 * stache + lump;
    pos.push(x + n.getX(i) * off, y + n.getY(i) * off, z + n.getZ(i) * off);
  });
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aOrigBindPos', new THREE.Float32BufferAttribute(surf.flat(), 3));
  g.computeVertexNormals();
  return g;
}

// Thick anime brows as tapered ribbons over the brow ridge (surfZ samples the head surface)
function buildStylizedBrows(surfZ, only) { // only: -1 or 1 builds just that side (so each brow can move on its own)
  const geos = [];
  (only ? [only] : [-1, 1]).forEach((s) => {
    const pts = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const x = s * (0.012 + t * 0.050);
      const y = 1.694 + 0.0075 * Math.sin(t * Math.PI * 0.85) - 0.006 * t * t;
      pts.push([x, y, surfZ(x, y) + 0.0035]);
    }
    const g = sgTube(pts, 0.0078, 0.0022, 18, 8);
    const p = g.attributes.position;
    // flatten against the skin
    for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) - (p.getZ(i) - surfZ(p.getX(i), p.getY(i))) * 0.35);
    g.computeVertexNormals();
    geos.push(g);
  });
  return sgMerge(geos);
}

// Big anime eye texture: white sclera, large brown iris with dark limbal ring, pupil, two highlights
function makeStylizedEyeTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#f3ede5'; g.fillRect(0, 0, 512, 256);
  // iris 68 px (about 48° of the globe, was 58): it tucks under both lids, so no white ring shows at rest, with a sliver at the corners
  const cx = 128, cy = 128, IR = 68;
  const ir = g.createRadialGradient(cx, cy + 10, 8, cx, cy, IR);
  ir.addColorStop(0, '#d9a463'); ir.addColorStop(0.42, '#94592a'); ir.addColorStop(0.82, '#4f2c13'); ir.addColorStop(1, '#1f1007');
  g.fillStyle = ir; g.beginPath(); g.arc(cx, cy, IR, 0, Math.PI * 2); g.fill();
  // darker top half of the iris (the lid shades it), lighter fleck below
  const top = g.createLinearGradient(0, cy - IR, 0, cy + 6);
  top.addColorStop(0, 'rgba(18,8,3,0.65)'); top.addColorStop(1, 'rgba(18,8,3,0)');
  g.fillStyle = top; g.beginPath(); g.arc(cx, cy, IR, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#150a05'; g.lineWidth = 7; g.beginPath(); g.arc(cx, cy, IR - 2, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#0b0503'; g.beginPath(); g.arc(cx, cy, 30, 0, Math.PI * 2); g.fill();
  // catchlights: one crisp main highlight over the pupil's upper edge, a small soft one opposite
  g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(cx - 24, cy - 16, 16, 14, -0.3, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.arc(cx + 26, cy + 26, 7, 0, Math.PI * 2); g.fill();
  const tex = new THREE.CanvasTexture(g.canvas);
  tex.anisotropy = 8;
  return tex;
}

// Black hair/beard/brows: three-tone cel shading with cool highlight bands and the same purple rim
function makeGeorgeHairMaterial(uniforms, beard) {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: beard ? GEORGE_TOON_VERT : GEORGE_TOON_VERT
      .replace('varying vec3 vBindPos;', 'varying vec3 vBindPos;\n  attribute vec4 aLock; attribute vec3 aLockT; varying vec4 vLock; varying vec3 vLockT;')
      .replace('vBindPos = aOrigBindPos;', 'vBindPos = aOrigBindPos; vLock = aLock; vLockT = normalize((modelMatrix * vec4(aLockT, 0.0)).xyz + vec3(0.0, 1e-5, 0.0));'),
    fragmentShader: `
      ${beard ? '' : 'varying vec4 vLock; varying vec3 vLockT;'}
      uniform vec3 uSunDir;
      uniform vec3 uSunCol;
      uniform vec3 uAmbCol;
      uniform vec3 uFireCol; uniform float uFireK;
      varying vec3 vBindPos;
      varying vec3 vNormalWorld;
      varying vec3 vWorldPos;
      ${beard ? GEORGE_BEARD_GLSL : ''}
      ${GEORGE_RIM_GLSL}
      void main() {
        ${beard ? 'if (beardMask(vBindPos) < 0.5) discard;' : ''}
        vec3 N = normalize(vNormalWorld);
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 Pf = vec3(${glslF(fireLight.position.x)}, 0.85, ${glslF(fireLight.position.z)}) - vWorldPos;
        float df = length(Pf);
        vec3 Lf = Pf / df;
        float fireAmt = 1.25 / (1.0 + df * df * 0.22) * uFireK;
        // same weighting as the skin (item 1): the hearth is the key, the sun scaled by its own brightness
        float sunMag = clamp(max(max(uSunCol.r, uSunCol.g), uSunCol.b), 0.3, 1.0);
        float sunD = dot(N, normalize(uSunDir)) * 0.85 * (0.45 + 0.55 * sunMag), fireD = dot(N, Lf) * 0.95 * fireAmt;
        float amt = sunD + fireD;
        float b1 = smoothstep(-0.05, 0.12, amt);
        float b2 = smoothstep(0.42, 0.56, amt);
        vec3 col = mix(vec3(0.020, 0.018, 0.028), vec3(0.075, 0.068, 0.095), b1);
        vec3 sunH = pow(max(uSunCol, vec3(1e-4)), vec3(0.4545)); sunH /= max(max(sunH.r, sunH.g), sunH.b);
        vec3 fireH = pow(max(uFireCol, vec3(1e-4)), vec3(0.4545)); fireH /= max(max(fireH.r, fireH.g), fireH.b);
        vec3 skyH = uAmbCol / max(max(uAmbCol.r, uAmbCol.g), max(uAmbCol.b, 1e-4));
        float wf = max(fireD, 0.0) / (max(sunD, 0.0) + max(fireD, 0.0) + 1e-3);
        vec3 hiH = mix(vec3(1.0), mix(sunH, fireH, wf), 0.35 + 0.20 * wf);
        col += vec3(0.20, 0.17, 0.27) * hiH * b2 * (0.45 + 0.55 * smoothstep(1.62, 1.78, vBindPos.y));
        float fresR = smoothstep(0.50, 0.66, pow(1.0 - max(dot(N, V), 0.0), 2.4));
        float rimB = fresR * smoothstep(-0.25, 0.35, dot(N, normalize(vec3(0.6, 0.2, 0.5))));
        col += vec3(0.58, 0.38, 0.92) * rimB * 0.32;
        col += sunH * fresR * smoothstep(-0.20, 0.35, dot(N, normalize(uSunDir))) * 0.45 * sunMag;
        col += fireH * vec3(1.0, 0.62, 0.34) * smoothstep(0.05, 0.75, dot(N, Lf)) * fireAmt * 0.07 * b1;
        ${beard ? '' : `// locks (item 4): each clump reads on its own. Fine strands run along it, its edges and root sink into
        // shadow, and a crisp broken sheen band (Kajiya-Kay on the lock's direction) catches the key light, plus a cool
        // band from the sky so the locks still separate from behind, where the fire is on the far side
        float isLock = step(1.5, vLock.w);
        float lid = vLock.z, along = vLock.x, around = vLock.y;
        float s1 = 0.5 + 0.5 * sin(around * 69.12 + lid * 3.1 + sin(along * 9.0 + lid) * 1.6);
        float s2 = 0.5 + 0.5 * sin(around * 144.5 + lid * 5.7);
        float strands = smoothstep(0.25, 0.75, s1 * 0.6 + s2 * 0.4);
        vec3 Tl = normalize(vLockT + N * (strands - 0.5) * 0.35);
        vec3 K = normalize(mix(normalize(uSunDir), Lf, wf));
        float keyOn = smoothstep(-0.10, 0.30, dot(N, K)) * clamp((max(sunD, 0.0) + max(fireD, 0.0)) * 1.6, 0.0, 1.0);
        float tH = dot(Tl, normalize(K + V));
        float sheen = smoothstep(0.50, 0.62, pow(max(1.0 - tH * tH, 0.0), 8.0)) * keyOn;
        float tS = dot(Tl, normalize(vec3(0.0, 1.0, 0.0) + V));
        float skyMag = clamp(max(max(uAmbCol.r, uAmbCol.g), uAmbCol.b) * 2.5, 0.25, 1.0);
        float skyB = smoothstep(0.45, 0.60, pow(max(1.0 - tS * tS, 0.0), 8.0)) * smoothstep(-0.70, 0.45, N.y) * skyMag;
        float tone = 0.85 + 0.30 * fract(lid * 0.618);
        col *= mix(1.0, tone * mix(0.55, 1.0, smoothstep(0.05, 0.40, dot(N, V))) * mix(0.65, 1.0, smoothstep(0.0, 0.18, along)) * mix(0.55, 1.0, strands), isLock);
        col += isLock * (hiH * vec3(0.42, 0.36, 0.46) * sheen * (0.45 + 0.55 * strands)
          + skyH * vec3(0.16, 0.18, 0.24) * skyB * (0.35 + 0.65 * strands) * (1.0 - 0.6 * sheen)
          + skyH * 0.060 * skyMag * (0.4 + 0.6 * strands));`}
        col += georgeRims(N, V, Lf, fireAmt, fireH, skyH, vBindPos.y);
        ${beard ? `// combed strands: fine streaks running down the jaw, a touch lighter where the light catches them
        float strand = 0.5 + 0.5 * sin(vBindPos.x * 820.0 + sin(vBindPos.y * 260.0 + vBindPos.x * 90.0) * 2.4);
        col *= 0.82 + 0.30 * strand * (0.4 + 0.6 * b1);` : ''}
        gl_FragColor = vec4(pow(max(col, vec3(0.0)), vec3(2.2)), 1.0);
      }
    `
  });
}

// Overshirt relief: the painted open shirt gets a little real cloth. A rolled front edge on each side that rises into
// the collar and meets behind the neck, a hem band, rolled sleeve cuffs and a few creases at the inner elbow. All closed
// tubes so the ink outline draws them; their bind position is re-pointed at a plain overshirt spot so they paint as cloth.
function buildStylizedOvershirt(sk, mat) {
  const ss = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const openW = (y) => 0.068 + 0.018 * (1 - ss(1.10, 1.35, y)); // same opening as GEORGE_TOON_FRAG
  const probe = new THREE.Mesh(pbLoft(GEORGE_TORSO_RINGS), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const ray = new THREE.Raycaster();
  const frontZ = (x, y) => {
    ray.set(new THREE.Vector3(x, y, 0.4), new THREE.Vector3(0, 0, -1));
    const h = ray.intersectObject(probe, false)[0];
    return h ? h.point.z : 0.08;
  };
  const around = (a, y, off) => { // torso surface at angle a (0 = front) around the loft axis, pushed out by off
    const d = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
    ray.set(new THREE.Vector3(0, y, 0.0), d);
    const h = ray.intersectObject(probe, false)[0];
    const p = h ? h.point : new THREE.Vector3(d.x * 0.15, y, d.z * 0.09);
    return [p.x + d.x * off, y, p.z + d.z * off];
  };
  const paintAs = (mesh, x, y, z) => {
    if (!mesh) return;
    const b = mesh.geometry.attributes.aOrigBindPos;
    for (let i = 0; i < b.count; i++) b.setXYZ(i, x, y, z);
  };

  [-1, 1].forEach((s) => {
    // front edge from the hem up to the chest, then folding out into a lapel and around the neck as the collar
    const pts = [];
    for (let y = 1.050; y <= 1.38; y += 0.03) { const x = s * (openW(y) + 0.003); pts.push([x, y, frontZ(x, y) + 0.002]); }
    pts.push([s * 0.086, 1.425, frontZ(s * 0.086, 1.425) + 0.004]);
    pts.push([s * 0.080, 1.462, 0.020]);
    pts.push([s * 0.064, 1.484, -0.012]);
    pts.push([s * 0.046, 1.496, -0.060]);
    pts.push([s * 0.004, 1.500, -0.086]);
    paintAs(pbAttach(sk, 'mixamorigSpine', sgTube(pts, 0.0050, 0.0105, 48, 10), mat), s * 0.13, 1.40, 0.0);

    // rolled sleeve cuff: two soft rolls around the forearm where the paint switches to skin
    [[0.509, 0.0072], [0.524, 0.0064]].forEach(([x, tube]) => {
      const r = 0.043 - 0.009 * (x - 0.43) / 0.238 + 0.004;
      const g = new THREE.TorusGeometry(r, tube, 8, 32);
      g.rotateY(Math.PI / 2);
      g.translate(s * x, 1.438, -0.05);
      paintAs(pbAttach(sk, `mixamorig${s > 0 ? 'Left' : 'Right'}ForeArm`, g, mat), 0.30, 1.40, 0.0);
    });
    // inner-elbow creases: short arcs on the front of the arm either side of the joint
    [[0.392, 'Arm', 1.9], [0.412, 'Arm', 2.3], [0.452, 'ForeArm', 1.7]].forEach(([x, bone, arc]) => {
      const r = (x < 0.43 ? 0.049 - 0.007 * (x - 0.152) / 0.278 : 0.043 - 0.009 * (x - 0.43) / 0.238) + 0.0015;
      const g = new THREE.TorusGeometry(r, 0.0030, 6, 20, arc);
      g.rotateZ(Math.PI - arc / 2);  // centre the arc on -x of the torus plane, which turns to +z (front) below
      g.rotateY(Math.PI / 2);        // torus axis onto the arm (x)
      g.translate(s * x, 1.438, -0.05);
      paintAs(pbAttach(sk, `mixamorig${s > 0 ? 'Left' : 'Right'}${bone}`, g, mat), 0.30, 1.40, 0.0);
    });
  });

  // hem band: from one front edge round the back to the other
  const hem = [];
  const a0 = Math.atan2(openW(1.048) + 0.004, frontZ(openW(1.048), 1.048));
  for (let i = 0; i <= 40; i++) hem.push(around(a0 + (Math.PI * 2 - 2 * a0) * i / 40, 1.048, 0.003));
  paintAs(pbAttach(sk, 'mixamorigSpine', sgTube(hem, 0.0058, 0.0058, 80, 8), mat), 0.13, 1.40, 0.0);
}
