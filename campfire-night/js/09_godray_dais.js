// © 2026 George Moussa. All rights reserved.
// ============================================================================
// 9. VOLUMETRIC GOD-RAY LIGHT PILLAR & SPIRIT LOTUS DAIS
// ============================================================================
const spiritDais = new THREE.Group();
spiritDais.position.set(1.08, 0.02, -0.12);
sanctuaryGroup.add(spiritDais);

[0.52, 0.78, 1.05].forEach((r, idx) => {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(r - 0.022, r, 64),
    new THREE.MeshBasicMaterial({
      color: idx === 0 ? 0x38bdf8 : (idx === 1 ? 0xfbbf24 : 0xe879f9),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.82 - idx * 0.15,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.01 * (idx + 1);
  spiritDais.add(ring);
});

const godRayUniforms = { uTime: { value: 0 }, uIntensity: { value: 1.0 }, uNature: { value: 1.0 } };
const godRayCone = new THREE.Mesh(
  new THREE.CylinderGeometry(0.45, 1.35, 6.5, 32, 1, true),
  new THREE.ShaderMaterial({
    uniforms: godRayUniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPos;
      void main() {
        vUv = uv;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vViewPos = -mvPos.xyz;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPos;
      uniform float uTime;
      uniform float uIntensity;
      uniform float uNature;
      void main() {
        float edgeFade = pow(abs(dot(normalize(vNormal), normalize(vViewPos))), 1.8);
        float vFade = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.15, vUv.y);
        float streak = 0.65 + 0.35 * sin(vUv.x * 37.699 + uTime * 1.5);
        vec3 cosmicCol = mix(vec3(0.12, 0.65, 0.95), vec3(0.85, 0.45, 0.95), vUv.y);
        vec3 natureCol = mix(vec3(0.95, 0.78, 0.45), vec3(0.65, 0.85, 0.92), vUv.y);
        vec3 col = mix(cosmicCol, natureCol, uNature);
        float alpha = edgeFade * vFade * streak * mix(0.11, 0.045, uNature) * uIntensity;
        gl_FragColor = vec4(col, alpha);
      }
    `
  })
);
godRayCone.position.y = 3.25;
spiritDais.add(godRayCone);
