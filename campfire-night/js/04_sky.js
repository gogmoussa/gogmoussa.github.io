// © 2026 George Moussa. All rights reserved.
// ============================================================================
// 4. SKY DOME (daylight woods moods + spirit-world nebula/aurora/moon)
// ============================================================================
const skyUniforms = {
  uTime: { value: 0 },
  uCoherence: { value: 0.5 },
  uNature: { value: 1 },
  uSpirit: { value: 0 },
  uSunDir: { value: new THREE.Vector3(-0.6, 0.3, -0.45).normalize() },
  uSunCol: { value: new THREE.Color(0xffb36a) },
  uHorizon: { value: new THREE.Color(0xf2bb8c) },
  uZenith: { value: new THREE.Color(0x4c78c8) },
  // storm (20_moments.js): uStorm 0..1 rolls a dark overcast in, uFlash lights it from inside around uFlashDir
  uStorm: { value: 0 },
  uClouds: { value: 1 }, // 0 clears the fair-weather clouds (20E's star sky)
  uFlash: { value: 0 },
  uFlashDir: { value: new THREE.Vector3(0, 0.3, -1).normalize() }
};
const SKY_NOISE_GLSL = `
      float hash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      float noise(vec3 x) {
        vec3 i = floor(x);
        vec3 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
              mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
          mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
              mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
          f.z
        );
      }

      float fbm(vec3 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 5; i++) {
          v += a * noise(p);
          p = p * 2.04 + vec3(0.15, -0.12, 0.22);
          a *= 0.5;
        }
        return v;
      }
`;
// The three mountain ridges depend only on the compass direction (az), so their heights are worked out once, on the GPU
// with the same noise, into an 8192 x 1 strip (ridgeLUT): hFar, the far ridge's slope, hMid, hNear. The sky then reads
// one texel per pixel instead of running four fbm and three noise calls in the horizon band every frame (~0.6 ms at
// 2880x1800). The strip is sampled at texel centres exactly where it was computed; between them it is linear, well under
// a pixel. Without float render targets the sky computes the ridges live, as before.
const RIDGE_GLSL = `
      float az = atan(dir.x, -dir.z);
      float passDip = 1.0 - 0.44 * exp(-az * az * 5.8);
      float m1a = fbm(vec3(az * 3.6 + 1.3, 0.8, 2.1));
      float m1aRight = fbm(vec3((az + 0.018) * 3.6 + 1.3, 0.8, 2.1));
      float m1Slope = clamp((m1a - m1aRight) * 28.0, -1.0, 1.0);
      float m1b = 1.0 - abs(noise(vec3(az * 11.0 + 0.5, 1.4, 3.8)) * 2.0 - 1.0);
      float hFar = 0.026 + ((m1a - 0.22) * 0.135 + m1b * 0.042) * passDip;
      float m3a = fbm(vec3(az * 4.4 + 7.7, 3.1, 0.6));
      float m3b = 1.0 - abs(noise(vec3(az * 13.0 - 4.0, 2.2, 5.1)) * 2.0 - 1.0);
      float hMid = 0.014 + ((m3a - 0.22) * 0.105 + m3b * 0.026) * (1.0 - 0.42 * exp(-az * az * 6.2));
      float m2a = fbm(vec3(az * 5.6 - 2.1, 2.3, 4.7));
      float m2b = noise(vec3(az * 16.0 + 3.0, 0.5, 1.2));
      float hNear = 0.008 + ((m2a - 0.22) * 0.072 + m2b * 0.016) * (1.0 - 0.38 * exp(-az * az * 6.8));
`;
const RIDGE_N = 8192;
const ridgeLUT = (function () {
  const ok = renderer.capabilities.isWebGL2 && renderer.extensions.has('EXT_color_buffer_float') && renderer.extensions.has('OES_texture_float_linear');
  if (!ok) return null;
  const rt = new THREE.WebGLRenderTarget(RIDGE_N, 1, { type: THREE.FloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false, generateMipmaps: false });
  const mat = new THREE.ShaderMaterial({
    vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: SKY_NOISE_GLSL + `
      void main() {
        // texel i holds az at its centre, the same az the sky's lookup lands on there
        float azc = (gl_FragCoord.x / ${RIDGE_N}.0) * 6.28318530718 - 3.14159265359;
        vec3 dir = vec3(sin(azc), 0.0, -cos(azc));
        ${RIDGE_GLSL}
        gl_FragColor = vec4(hFar, m1Slope, hMid, hNear);
      }`,
    depthTest: false, depthWrite: false
  });
  const sc = new THREE.Scene(); sc.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
  const prev = renderer.getRenderTarget();
  renderer.setRenderTarget(rt); renderer.render(sc, new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)); renderer.setRenderTarget(prev);
  mat.dispose();
  return rt.texture;
})();
const skyDome = new THREE.Mesh(
  new THREE.SphereGeometry(85, 48, 32),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    defines: ridgeLUT ? { RIDGE_LUT: 1 } : {},
    uniforms: Object.assign(skyUniforms, { tRidge: { value: ridgeLUT } }),
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vWorldPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position.z = gl_Position.w; // on the far plane: behind everything, so it only shades the pixels nothing else covers
      }
    `,
    fragmentShader: `
      varying vec3 vWorldPos;
      uniform float uTime;
      uniform float uCoherence;
      uniform float uNature;
      uniform float uSpirit;
      uniform vec3 uSunDir;
      uniform vec3 uSunCol;
      uniform vec3 uHorizon;
      uniform vec3 uZenith;
      uniform float uStorm;
      uniform float uClouds;
      uniform float uFlash;
      uniform vec3 uFlashDir;
      uniform sampler2D tRidge;

${SKY_NOISE_GLSL}

      void main() {
        vec3 dir = normalize(vWorldPos);

        if (uNature > 0.5) {
          // Natural daylight sky: deep azure zenith, warm golden horizon, sculpted clouds & crisp solar disc
          float up = clamp(dir.y * 3.4, 0.0, 1.0);
          vec3 sky = mix(uHorizon, uZenith, pow(up, 0.48));
          if (dir.y < 0.0) sky = mix(uHorizon, uZenith * 0.25, clamp(-dir.y * 4.0, 0.0, 1.0));
          vec3 sDir = normalize(uSunDir);
          float sd = max(dot(dir, sDir), 0.0);
          // Tight golden horizon band + solar corona + a soft-edged disc (a hard, very bright disc bloomed into a white blob)
          float horizonBand = exp(-abs(dir.y - 0.022) * 16.0) * (0.25 + 0.75 * pow(sd, 4.0));
          sky += uSunCol * horizonBand * 0.32;
          sky += uSunCol * (pow(sd, 24.0) * 0.28 + pow(sd, 110.0) * 0.70 + pow(sd, 420.0) * 0.9 + smoothstep(0.9978, 0.99975, sd) * 1.25);
          // the cover mask below is zero outside this band (and with uClouds 0), so the noise is skipped there: same picture
          float cloudBand = smoothstep(0.028, 0.10, dir.y) * smoothstep(0.68, 0.20, dir.y) * uClouds;
          if (dir.y > 0.015 && cloudBand > 0.0) {
            vec2 cp = dir.xz / (dir.y + 0.14) * 1.05 + vec2(uTime * 0.006, uTime * 0.002);
            float c1 = fbm(vec3(cp * 1.15, 1.7));
            float c2 = fbm(vec3(cp * 2.8 + 3.1, 4.2));
            // fbm stays under 0.96875, so the fine layer adds at most 0.2933 to baseCloud: where the two broad layers are
            // below -0.274 the cover is zero whatever it says, and it is skipped (clear sky between clouds, same picture)
            float cBroad = (c1 - 0.455) * 3.4 + (c2 - 0.48) * 1.4;
            if (cBroad > -0.274) {
            float c3 = fbm(vec3(cp * 6.0 - 1.8, 7.1));
            // Stretch FBM contrast around its 0.48 mean so distinct cumulus cloud banks form
            float baseCloud = cBroad + (c3 - 0.48) * 0.6;
            float cover = smoothstep(0.02, 0.55, baseCloud) * smoothstep(0.028, 0.10, dir.y) * smoothstep(0.68, 0.20, dir.y);
            // Clear a small window right around the solar disc so the sun shines through the clouds
            cover *= 1.0 - 0.55 * pow(sd, 45.0);
            cover *= uClouds;
            float puffTop = clamp((c1 - 0.44) * 4.2 + (c2 - 0.48) * 1.8 + dir.y * 0.6, 0.0, 1.0);
            float edgeRim = pow(sd, 3.0) * smoothstep(0.02, 0.25, baseCloud) * (1.0 - smoothstep(0.28, 0.60, baseCloud));
            vec3 cloudLit = mix(uHorizon * 1.15 + vec3(0.10), uSunCol * 0.95 + vec3(0.16), 0.35 + 0.65 * pow(sd, 2.0));
            vec3 cloudShade = mix(uZenith * 0.45 + vec3(0.02, 0.03, 0.06), uHorizon * 0.42, 0.35);
            vec3 cloudCol = mix(cloudShade, cloudLit, smoothstep(0.18, 0.78, puffTop)) + uSunCol * edgeRim * 0.95;
            sky = mix(sky, cloudCol, cover * 0.88);
            }
          }
          // Storm: a dark overcast rolls in from behind the ridges (coverage grows with uStorm), fast and low, with
          // heavy bellies; lightning lights it from inside around the bolt.
          if (uStorm > 0.002) {
            vec2 sp = dir.xz / (max(dir.y, 0.0) + 0.20) * 0.85 + vec2(uTime * 0.085, uTime * 0.034);
            float s1 = fbm(vec3(sp * 0.8, uTime * 0.04));
            float s2 = fbm(vec3(sp * 2.4 + 5.0, uTime * 0.07 + 2.0));
            float dens = s1 * 0.66 + s2 * 0.34;
            // the front arrives from -z (over the pond vista) and reaches overhead, then everywhere
            float reach = clamp(uStorm * 2.3 - 0.55 + (-dir.z) * 0.55 - dir.y * 0.35, 0.0, 1.0);
            float cov = smoothstep(0.58 - reach * 0.50, 0.74 - reach * 0.44, dens);
            cov = max(cov, reach * reach * 0.9) * smoothstep(-0.01, 0.05, dir.y);
            vec3 belly = mix(vec3(0.012, 0.016, 0.028), vec3(0.070, 0.082, 0.112), smoothstep(0.34, 0.72, dens));
            belly = mix(belly, uHorizon * 0.30, 0.22 * (1.0 - clamp(dir.y * 3.0, 0.0, 1.0)));
            float fd = max(dot(dir, normalize(uFlashDir)), 0.0);
            belly += vec3(0.60, 0.70, 1.0) * uFlash * (0.07 + 1.25 * pow(fd, 5.0) + 0.30 * pow(fd, 1.5)) * (0.30 + 0.70 * smoothstep(0.30, 0.75, dens));
            sky = mix(sky, belly, cov * min(1.0, uStorm * 1.6));
          }
          // Spirit world (Astral Twilight): violet nebula, drifting aurora curtains and a great pale moon
          if (uSpirit > 0.5) {
            vec3 spp = dir * 2.6 + vec3(uTime * 0.012, -uTime * 0.008, uTime * 0.01);
            float sn1 = fbm(spp);
            float sn2 = fbm(spp * 2.0 + vec3(sn1 * 1.4));
            float neb = smoothstep(0.38, 0.8, sn2) * smoothstep(0.0, 0.45, dir.y);
            sky += mix(vec3(0.10, 0.42, 0.85), vec3(0.55, 0.20, 0.85), sn1) * neb * 0.45;
            float aw = sin(dir.x * 5.0 + dir.z * 3.0 + uTime * 0.25 + sn1 * 3.5);
            float am = smoothstep(0.5, 0.98, aw) * smoothstep(0.03, 0.28, dir.y) * (1.0 - smoothstep(0.55, 0.9, dir.y));
            sky += mix(vec3(0.10, 0.95, 0.75), vec3(0.62, 0.40, 1.0), sn2) * am * 0.55;
            float md = max(dot(dir, normalize(uSunDir)), 0.0);
            sky += vec3(0.72, 0.82, 1.0) * (smoothstep(0.9962, 0.9982, md) * 1.5 + pow(md, 60.0) * 0.4 + pow(md, 8.0) * 0.14);
          }
          // Layered distant alpine mountain range, sunlit ridge facets & misty forested valley floor
          if (dir.y < 0.175) {
            #ifdef RIDGE_LUT
              float az = atan(dir.x, -dir.z);
              vec4 rdg = texture2D(tRidge, vec2(az / 6.28318530718 + 0.5, 0.5));
              float hFar = rdg.x, m1Slope = rdg.y, hMid = rdg.z, hNear = rdg.w;
            #else
              ${RIDGE_GLSL}
            #endif
            // Three ridges stepping back into the haze: each is darkest along its crest and dissolves into mist
            // at its foot, and the farther the ridge the closer it sits to the horizon's own colour.
            vec3 haze = mix(uHorizon, uSunCol, 0.22 * pow(sd, 3.0)) * 0.94;
            vec3 deep = uZenith * 0.40 + uHorizon * 0.10 + vec3(0.006, 0.008, 0.016);
            float mFarMask = 1.0 - smoothstep(hFar - 0.004, hFar + 0.003, dir.y);
            vec3 farCol = mix(haze, deep, 0.16) + uSunCol * 0.05 * clamp(m1Slope * 0.65 + 0.35, 0.0, 1.0);
            farCol += uSunCol * smoothstep(hFar - 0.02, hFar, dir.y) * pow(sd, 2.5) * 0.10;
            farCol = mix(farCol, haze, 0.62 * (1.0 - smoothstep(hFar - 0.060, hFar - 0.004, dir.y)));
            sky = mix(sky, farCol, mFarMask);

            float mMidMask = 1.0 - smoothstep(hMid - 0.003, hMid + 0.0025, dir.y);
            vec3 midCol = mix(haze, deep, 0.30);
            midCol = mix(midCol, haze, 0.50 * (1.0 - smoothstep(hMid - 0.045, hMid - 0.003, dir.y)));
            sky = mix(sky, midCol, mMidMask);

            float mNearMask = 1.0 - smoothstep(hNear - 0.002, hNear + 0.0015, dir.y);
            vec3 nearCol = mix(haze, deep + vec3(0.004, 0.012, 0.004), 0.46);
            float valleyMist = exp(-max(dir.y + 0.004, 0.0) * 48.0);
            nearCol = mix(nearCol, uHorizon * 0.68, valleyMist * 0.52);

            // For downward rays (visible in high Cosmic Orbit top shot), render a lush misty forested valley & river shimmer
            if (dir.y < 0.008) {
              float vDepth = clamp(-dir.y * 12.0, 0.0, 1.0);
              float vTex = fbm(vec3(dir.x * 18.0, dir.y * 32.0, 3.4));
              vec3 forestValley = mix(vec3(0.018, 0.042, 0.015), vec3(0.038, 0.068, 0.022), vTex) + uHorizon * 0.18 * (1.0 - vDepth * 0.5);
              float m1aR = fbm(vec3(az * 3.6 + 1.3, 0.8, 2.1)); // the far ridge's noise, only for the rare downward rays
              float riverMeander = sin(dir.y * 55.0 + m1aR * 4.0) * 0.045;
              float riverMask = exp(-pow((az - riverMeander) * 14.0, 2.0)) * smoothstep(-0.18, -0.005, dir.y);
              forestValley = mix(forestValley, uHorizon * 0.65 + uSunCol * 0.45, riverMask * 0.65);
              nearCol = mix(nearCol, forestValley, smoothstep(0.008, -0.022, dir.y));
            }
            sky = mix(sky, nearCol, mNearMask);
          }
          if (uStorm > 0.002) { // the ridges and valley sink into the storm's shadow, and flash with the sky
            float low = 1.0 - smoothstep(0.12, 0.30, dir.y);
            sky = mix(sky, sky * 0.34 + vec3(0.006, 0.008, 0.014), uStorm * low * 0.85);
            sky = mix(sky, vec3(dot(sky, vec3(0.299, 0.587, 0.114))) * vec3(0.80, 0.90, 1.12), min(1.0, uStorm * 1.25) * 0.88); // dusk pinks go slate
            sky += vec3(0.50, 0.58, 0.85) * uFlash * 0.05 * low;
          }
          gl_FragColor = vec4(sky, 1.0);
          return;
        }

        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      }
    `
  })
);
// Drawn after every opaque thing (renderOrder) and pinned to the far plane (vertex shader): the depth test then skips every
// pixel the ground, trees and rocks already cover. Before, the dome sorted first (its centre sits near the camera) and ran
// its cloud and ridge noise on the whole frame, only to be painted over (Nov 18 2026: the largest single GPU cost).
skyDome.renderOrder = 100;
scene.add(skyDome);
