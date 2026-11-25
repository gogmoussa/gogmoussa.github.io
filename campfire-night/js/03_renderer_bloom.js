// © 2026 George Moussa. All rights reserved.
// ============================================================================
// 3. THREE.JS RENDERER, PMREM IBL & SOFT-KNEE HDR BLOOM PIPELINE
// ============================================================================
const canvas = document.getElementById('three-canvas');
// The canvas only ever receives one full-screen quad (the composite); the scene itself renders into sceneRT, which has no
// multisampling. So canvas antialiasing never smoothed an edge, yet it kept a 4x multisampled screen buffer that was
// resolved every frame, and preserveDrawingBuffer added a full-screen copy on top. Both off (Nov 18 2026): the same
// picture, about 2-3 ms a frame back at 2880x1800. Anything that reads the canvas outside the frame loop (a still, the
// first frame of a take) redraws the composite first: see drawBroadcastFrame in 11c.
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  preserveDrawingBuffer: false,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.capabilities.getMaxAnisotropy && (THREE.Texture.DEFAULT_ANISOTROPY = Math.min(8, renderer.capabilities.getMaxAnisotropy()));

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x070d1f, 0.019); // denser atmospheric perspective for depth

const camera = new THREE.PerspectiveCamera(36, 16 / 9, 0.1, 180);
camera.position.set(0, 2.2, 6.5);

const controls = new THREE.OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.maxPolarAngle = Math.PI / 2 - 0.02;
controls.minDistance = 2.0;
controls.maxDistance = 18.0;
controls.target.set(0, 1.25, 0);

// Balanced, Richly Colored Studio Environment Map for Specular Reflections
if (THREE.PMREMGenerator) {
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();
  const envLightingScene = new THREE.Scene();
  const envSphere = new THREE.Mesh(
    new THREE.SphereGeometry(20, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: `varying vec3 vPos; void main() { vPos = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        varying vec3 vPos;
        void main() {
          float y = vPos.y;
          vec3 groundBounce = vec3(0.32, 0.14, 0.05);
          vec3 horizonCol   = vec3(0.08, 0.20, 0.38);
          vec3 zenithCol    = vec3(0.03, 0.06, 0.18);
          vec3 col = y < 0.0 ? mix(horizonCol, groundBounce, clamp(-y * 1.5, 0.0, 1.0))
                             : mix(horizonCol, zenithCol, pow(y, 0.6));
          gl_FragColor = vec4(col, 1.0);
        }
      `
    })
  );
  envLightingScene.add(envSphere);
  const envRT = pmremGenerator.fromScene(envLightingScene, 0.04);
  scene.environment = envRT.texture;
  pmremGenerator.dispose();
}

const rtType = renderer.capabilities.isWebGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType;
function makeRT(w, h) {
  return new THREE.WebGLRenderTarget(w, h, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: rtType
  });
}

let sceneRT   = makeRT(1280, 720);
// Depth attachment feeds the composite-pass depth of field (WebGL2 only; r128 needs a 32-bit depth for a 0.1..180 frustum).
const dofSupported = renderer.capabilities.isWebGL2;
if (dofSupported) {
  sceneRT.depthTexture = new THREE.DepthTexture(1280, 720);
  sceneRT.depthTexture.type = THREE.UnsignedIntType;
  sceneRT.depthTexture.minFilter = THREE.NearestFilter;
  sceneRT.depthTexture.magFilter = THREE.NearestFilter;
}
let reflectRT = makeRT(640, 360);
let brightRT  = makeRT(640, 360);
let blurHRT1  = makeRT(640, 360);
let blurVRT1  = makeRT(640, 360);
let blurHRT2  = makeRT(320, 180);
let blurVRT2  = makeRT(320, 180);

const quadGeo = new THREE.PlaneGeometry(2, 2);
const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

// Soft-Knee Clamped High-Pass Filter (prevents nuclear white blowout!)
const brightMat = new THREE.ShaderMaterial({
  uniforms: {
    tDiffuse: { value: null },
    uThreshold: { value: 0.92 }
  },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uThreshold;
    varying vec2 vUv;
    void main() {
      vec3 c = max(texture2D(tDiffuse, vUv).rgb, vec3(0.0));
      float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
      float w = smoothstep(uThreshold, uThreshold + 0.75, lum);
      // Clamp maximum bloom contribution so characters & pages never wash out to white
      vec3 extracted = min(c * w, vec3(1.35));
      gl_FragColor = vec4(extracted, 1.0);
    }
  `,
  depthWrite: false, depthTest: false
});
const brightScene = new THREE.Scene();
brightScene.add(new THREE.Mesh(quadGeo, brightMat));

// Takes larger than 1080p only: the bright pass is drawn at half the frame as usual (brightHiRT), then shrunk into
// brightRT, which with the blur targets stays at the size a 1080 take uses. The blur reaches a fixed number of texels,
// so this keeps the glow the same width on screen at any take size (at 4K it came out half as wide). See resizeRenderer.
let brightHiRT = null;
const copyMat = new THREE.ShaderMaterial({
  uniforms: { tDiffuse: { value: null } },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv; void main() { gl_FragColor = vec4(texture2D(tDiffuse, vUv).rgb, 1.0); }`,
  depthWrite: false, depthTest: false
});
const copyScene = new THREE.Scene();
copyScene.add(new THREE.Mesh(quadGeo, copyMat));

const blurMat = new THREE.ShaderMaterial({
  uniforms: {
    tDiffuse: { value: null },
    uDirection: { value: new THREE.Vector2(1, 0) },
    uResolution: { value: new THREE.Vector2(640, 360) }
  },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 uDirection;
    uniform vec2 uResolution;
    varying vec2 vUv;
    void main() {
      vec2 off1 = vec2(1.3846153846) * uDirection / uResolution;
      vec2 off2 = vec2(3.2307692308) * uDirection / uResolution;
      vec2 off3 = vec2(5.0769230769) * uDirection / uResolution;
      vec3 col = texture2D(tDiffuse, vUv).rgb * 0.2270270270;
      col += texture2D(tDiffuse, vUv + off1).rgb * 0.3162162162;
      col += texture2D(tDiffuse, vUv - off1).rgb * 0.3162162162;
      col += texture2D(tDiffuse, vUv + off2).rgb * 0.0702702703;
      col += texture2D(tDiffuse, vUv - off2).rgb * 0.0702702703;
      col += texture2D(tDiffuse, vUv + off3).rgb * 0.015;
      col += texture2D(tDiffuse, vUv - off3).rgb * 0.015;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
  depthWrite: false, depthTest: false
});
const blurScene = new THREE.Scene();
blurScene.add(new THREE.Mesh(quadGeo, blurMat));

const compositeMat = new THREE.ShaderMaterial({
  // Blur samples per pixel. 24 covers the blur disc at 1080x1920; a larger take spreads the same disc over more pixels,
  // so resizeRenderer (14) raises the count with the frame's area, or the blur breaks up into ripples (seen at 4K).
  defines: { DOF_TAPS: 24 },
  uniforms: {
    tBase: { value: sceneRT.texture },
    tBloom1: { value: blurVRT1.texture },
    tBloom2: { value: blurVRT2.texture },
    uBloomStrength: { value: bloomStrength },
    uTime: { value: 0 },
    uExposure: { value: 1.0 },
    tDepth: { value: sceneRT.depthTexture },
    uDofStrength: { value: 0 },   // 0 = off; ~1 = cinematic close-up falloff
    uFocusDist: { value: 2 },     // view-axis metres to the plane in focus
    uCamNear: { value: camera.near },
    uCamFar: { value: camera.far },
    uAspect: { value: 16 / 9 },
    uLetterbox: { value: 0 },     // 1 = 2.39:1 bars
    // Colour grade (Studio panel > Grade). Defaults reproduce the original hard-coded look.
    uSat: { value: 1.04 },        // saturation (1 = neutral)
    uContrast: { value: 0.28 },   // filmic S-curve mix
    uWarmth: { value: 0 },        // -1 cool .. +1 warm (white balance shift)
    uTint: { value: 0 },          // -1 green .. +1 magenta
    uLift: { value: 0 },          // matte/faded blacks
    uVignette: { value: 1 },      // vignette strength multiplier
    uGrain: { value: 0.028 },     // film grain amount
    uCA: { value: 1 },            // chromatic aberration multiplier
    uSplit: { value: 1 }          // cool-shadow / warm-highlight split-tone multiplier
  },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`,
  fragmentShader: `
    uniform float uTime;
    uniform float uExposure;
    uniform sampler2D tBase;
    uniform sampler2D tBloom1;
    uniform sampler2D tBloom2;
    uniform float uBloomStrength;
    uniform sampler2D tDepth;
    uniform float uDofStrength;
    uniform float uFocusDist;
    uniform float uCamNear;
    uniform float uCamFar;
    uniform float uAspect;
    uniform float uLetterbox;
    uniform float uSat;
    uniform float uContrast;
    uniform float uWarmth;
    uniform float uTint;
    uniform float uLift;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uCA;
    uniform float uSplit;
    varying vec2 vUv;

    float viewDist(vec2 uv) {
      float z = texture2D(tDepth, uv).x * 2.0 - 1.0;
      return 2.0 * uCamNear * uCamFar / (uCamFar + uCamNear - z * (uCamFar - uCamNear));
    }
    // Circle of confusion 0..1: a small dead zone keeps the whole face sharp, falloff grows with distance from the focal plane.
    float cocAt(float d) {
      return clamp((abs(d - uFocusDist) / max(d, 0.05) - 0.06) * 1.8 * uDofStrength, 0.0, 1.0);
    }

    vec3 acesFilm(vec3 x) {
      float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
      return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
    }

    void main() {
      // Subtle lens chromatic aberration, growing toward the frame edges
      vec2 ca = (vUv - 0.5) * 0.0022 * uCA * length(vUv - 0.5) * 2.0;
      vec3 base = vec3(
        texture2D(tBase, vUv + ca).r,
        texture2D(tBase, vUv).g,
        texture2D(tBase, vUv - ca).b
      );
      if (uDofStrength > 0.001) {
        float coc = cocAt(viewDist(vUv));
        float radius = coc * 0.016; // in screen-height units
        if (radius > 0.0004) {
          vec3 acc = base;
          float wsum = 1.0;
          for (int i = 0; i < DOF_TAPS; i++) {
            float fi = float(i) + 1.0;
            float r = sqrt(fi / float(DOF_TAPS)) * radius;
            float a = fi * 2.39996323; // golden-angle spiral = even disc coverage
            vec2 uv = vUv + vec2(cos(a) / uAspect, sin(a)) * r;
            float sCoc = cocAt(viewDist(uv));
            // sharp pixels must not bleed into a blurred centre (no halo around the in-focus subject)
            float w = clamp(sCoc / max(coc, 0.001), 0.0, 1.0);
            w = max(w, 0.04);
            acc += texture2D(tBase, uv).rgb * w;
            wsum += w;
          }
          base = mix(base, acc / wsum, smoothstep(0.0004, 0.003, radius));
        }
      }
      vec3 b1 = texture2D(tBloom1, vUv).rgb;
      vec3 b2 = texture2D(tBloom2, vUv).rgb;

      vec3 hdr = (base + (b1 * 0.55 + b2 * 0.90) * uBloomStrength) * uExposure;
      // White balance before tone mapping: warmth pushes red up / blue down, tint trades green for magenta
      hdr *= vec3(1.0 + 0.10 * uWarmth + 0.04 * uTint, 1.0 - 0.06 * uTint, 1.0 - 0.12 * uWarmth + 0.04 * uTint);

      vec2 d = vUv - 0.5;
      float vig = smoothstep(0.88, 0.18, dot(d, d));
      hdr *= mix(mix(1.0, 0.68, uVignette), 1.04, vig);

      vec3 mapped = acesFilm(hdr);
      // Saturation (1.04 = the original subtle vibrance boost)
      float luma = dot(mapped, vec3(0.299, 0.587, 0.114));
      mapped = mix(vec3(luma), mapped, uSat);
      // Gentle filmic S-curve + cool shadows / warm highlights split-tone
      mapped = mix(mapped, mapped * mapped * (3.0 - 2.0 * mapped), uContrast);
      mapped += (vec3(-0.006, 0.0, 0.012) * (1.0 - luma) + vec3(0.012, 0.005, -0.006) * luma * 0.5) * uSplit;
      // Matte lift: raise the blacks for a faded film look
      float lift = uLift * 0.06; // UI 0..1 -> blacks up to ~0.03 linear (~0.2 after gamma)
      mapped = mapped * (1.0 - lift) + lift * 0.5 * vec3(0.92, 0.96, 1.0);
      mapped = pow(clamp(mapped, 0.0, 1.0), vec3(1.0 / 2.2));
      // Animated fine film grain doubles as dither to kill gradient banding
      float g = fract(sin(dot(vUv * 1717.0 + fract(uTime) * 91.0, vec2(12.9898, 78.233))) * 43758.5453);
      mapped += (g - 0.5) * max(uGrain, 0.006) * (1.0 - luma * 0.6);
      // 2.39:1 letterbox (only when wider than the frame; step mask, no early return)
      float halfBand = min(0.5, 0.5 * uAspect / 2.39);
      mapped *= 1.0 - uLetterbox * step(halfBand, abs(vUv.y - 0.5));
      gl_FragColor = vec4(mapped, 1.0);
    }
  `,
  depthWrite: false, depthTest: false
});
const compositeScene = new THREE.Scene();
compositeScene.add(new THREE.Mesh(quadGeo, compositeMat));
