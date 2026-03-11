/**
 * GalaxyParticles — Cosmic Vortex (対数螺旋 / Logarithmic Spiral)
 *
 * A vast, epic cosmic vortex built on the mathematics of nature:
 *   r = a × e^(b × θ)   — the logarithmic spiral
 *
 * Particles flow INWARD (accretion) and OUTWARD (ejection).
 * The vortex breathes: slowly generates, peaks, dissolves, regenerates.
 * As long as In and Out coexist, the vortex is eternal.
 *
 * 50,000 GPU-driven particles. Zero CPU per-frame updates.
 * Future: the camera will fly INTO this vortex (black hole) to reach sub-pages.
 */
import * as THREE from 'three';

// ---- Vertex Shader: Logarithmic Spiral Vortex ----
const vortexVertexShader = /* glsl */`
  attribute float aRadialT;       // 0=core .. 1=outer rim
  attribute float aPhaseOffset;   // random per-particle phase
  attribute float aSize;          // size multiplier
  attribute float aFlowDir;       // -1=inward, +1=outward
  attribute float aArmIndex;      // spiral arm ID (0..numArms-1)
  attribute float aLayerZ;        // vertical scatter seed
  attribute vec3  aColorHint;     // per-particle color

  uniform float uTime;
  uniform float uPointSize;
  uniform float uSpinSpeed;
  uniform float uOpacity;
  uniform float uLifeCycle;       // 0=dissolved .. 1=fully formed

  varying float vAlpha;
  varying vec3  vColor;
  varying float vCoreGlow;

  // ---- Hash functions ----
  float hash(float n) { return fract(sin(n) * 43758.5453123); }

  void main() {
    float r = aRadialT;

    // ======== Lifecycle: birth / death per particle ========
    // Inner particles appear first, outer last. Staggered by random offset.
    float birthThreshold = r * 0.55 + hash(aPhaseOffset * 137.0) * 0.45;
    float alive = smoothstep(birthThreshold - 0.12, birthThreshold + 0.05, uLifeCycle);

    if (alive < 0.005) {
      gl_PointSize = 0.0;
      gl_Position = vec4(0.0, 0.0, -999.0, 1.0);
      vAlpha = 0.0;
      vColor = vec3(0.0);
      vCoreGlow = 0.0;
      return;
    }

    // ======== Logarithmic Spiral: r = a × e^(b × θ) ========

    float numArms = 3.0;
    float armAngle = aArmIndex * (6.28318 / numArms);

    // Flow: particles drift in or out along the spiral over time
    // flowR is the "effective radial position" that changes with time
    float flowSpeed = 0.05; // how fast particles flow in/out
    float flowR = r + uTime * flowSpeed * aFlowDir;
    flowR = fract(flowR); // wrap around: 0->1->0 endlessly

    // ---- Logarithmic spiral parameters ----
    // b controls "tightness" — smaller = tighter wind
    // a scales the overall radius
    float b_spiral = 0.24;                   // spiral tightness (open arms)
    float a_spiral = 0.28;                   // base scale
    float maxRadius = 17.5;                  // cosmic scale

    // theta increases with radial position — fewer turns for open spiral
    float theta = flowR * 9.0;               // total winding (~1.4 full turns)
    float spiralAngle = armAngle + theta;

    // The logarithmic spiral radius
    // r_spiral = a * e^(b * theta)
    float r_spiral = a_spiral * exp(b_spiral * theta);
    // Normalize and scale to maxRadius
    float r_max = a_spiral * exp(b_spiral * 9.0);
    float radius = (r_spiral / r_max) * maxRadius;

    // ---- Differential rotation ----
    // Inner regions spin MUCH faster (like real galaxies / hurricanes)
    // Angular velocity proportional to 1/r  (Keplerian-ish)
    float angularVel = uSpinSpeed * (1.0 / (0.15 + flowR * 0.85));
    float angle = spiralAngle + uTime * angularVel;

    // ---- Arm scatter (particles aren't perfectly on the arm) ----
    float armSpread = 0.03 + flowR * 0.25;   // tighter arm lanes
    float scatter = (hash(aPhaseOffset * 100.0) - 0.5) * armSpread;
    // Arm definition: gaussian falloff from arm center → visible spiral lanes
    float scatterNorm = abs(scatter) / max(armSpread * 0.45, 0.01);
    float armIntensity = exp(-scatterNorm * scatterNorm * 2.5);

    // ---- Disk thickness ----
    float zThick = aLayerZ * (0.02 + flowR * 0.18);
    // Core bulge — thicker near center
    float coreBulge = (1.0 - flowR) * (1.0 - flowR) * 0.4;
    float zPos = zThick + aLayerZ * coreBulge;

    // ======== Final position (polar -> cartesian) ========
    // x = center_x + r * cos(theta)
    // y = center_y + r * sin(theta)
    vec3 pos = vec3(
      cos(angle) * radius + cos(angle + 1.5708) * scatter,
      zPos,
      sin(angle) * radius + sin(angle + 1.5708) * scatter
    );

    // ---- Organic turbulence ----
    float turb = hash(aPhaseOffset * 200.0 + 3.0);
    float turbStrength = 0.02 * flowR;
    pos.x += sin(uTime * 0.15 + turb * 25.0) * turbStrength;
    pos.z += cos(uTime * 0.12 + turb * 20.0) * turbStrength;

    // Scale by alive factor (particles grow in during birth)
    pos *= alive;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

    // ---- Point size: core particles bigger, outer smaller ----
    float sizeScale = (1.5 - flowR * 0.7) * alive;
    float size = aSize * uPointSize * sizeScale;
    gl_PointSize = max(size * (250.0 / -mvPosition.z), 0.4);
    gl_Position = projectionMatrix * mvPosition;

    // ======== Color & Alpha — ALL WHITE ========
    // The denser particles accumulate, the brighter the glow
    // Core = intense white light source, arms = softer white

    // Core concentration → brightness (particles become a light source)
    float coreBright = pow(1.0 - flowR, 3.1) * 2.4;
    // Arm brightness — gentler falloff
    float armBright = 0.06 + 0.32 * (1.0 - flowR * 0.7);
    float brightness = max(coreBright, armBright);

    // Halo and dust-lane shaping for photographic galaxy look
    float halo = exp(-pow((flowR - 0.55) / 0.34, 2.0)) * 0.35;
    float dustLane = 1.0 - 0.32 * smoothstep(0.18, 0.9, flowR) * (1.0 - armIntensity);

    // Twinkle — stars shimmer
    float twinkle = 0.7 + 0.3 * sin(
      uTime * (1.2 + hash(aPhaseOffset * 500.0) * 4.0) + aPhaseOffset * 8.0
    );

    // Outward-flowing particles slightly dimmer (ejected)
    float dirFade = aFlowDir > 0.0 ? 0.6 : 1.0;

    vAlpha = brightness * twinkle * alive * uOpacity * dirFade;
    vAlpha *= (armIntensity * 0.85 + halo + 0.10);
    vAlpha *= dustLane;
    // Warm core, cooler outer — like real galaxies
    float warmth = pow(1.0 - flowR, 2.0);
    float cool = smoothstep(0.3, 1.0, flowR);
    vColor = vec3(1.0,
            1.0 - warmth * 0.06,
            1.0 - warmth * 0.12 + cool * 0.03);
    vCoreGlow = coreBright * alive;
  }
`;

// ---- Fragment Shader ----
const vortexFragmentShader = /* glsl */`
  varying float vAlpha;
  varying vec3  vColor;
  varying float vCoreGlow;

  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;

    // Soft gaussian glow for all particles
    float alpha = exp(-d * d * 3.0) * vAlpha;

    vec3 color = vColor;

    // Core concentration glow — where particles gather, light intensifies
    // Pure white intensification at the center
    float coreBoost = vCoreGlow * exp(-d * d * 4.0);
    color += vec3(1.0, 0.98, 0.95) * coreBoost;

    // Extra bloom-friendly brightness at core (overdrives additive blending)
    alpha += coreBoost * 0.5;

    gl_FragColor = vec4(color, alpha);
  }
`;

/**
 * Create a vast cosmic vortex particle system
 */
export function createGalaxyParticles(config = {}) {
  const {
    count = 50000,
    pointSize = 0.04,
    spinSpeed = 0.06,
    // All white — color is handled in shader now
    particleWhite = [1.0, 1.0, 1.0],
  } = config;

  const geometry = new THREE.BufferGeometry();

  const positions    = new Float32Array(count * 3);
  const radialTs     = new Float32Array(count);
  const phaseOffsets = new Float32Array(count);
  const sizes        = new Float32Array(count);
  const flowDirs     = new Float32Array(count);
  const armIndices   = new Float32Array(count);
  const layerZs      = new Float32Array(count);
  const colorHints   = new Float32Array(count * 3);

  // Distribution: 10% core, 55% arm, 25% outer, 10% dust
  const coreN  = Math.floor(count * 0.10);
  const armN   = Math.floor(count * 0.55);
  const outerN = Math.floor(count * 0.25);
  const dustN  = count - coreN - armN - outerN;

  let idx = 0;
  const numArms = 3;

  const setParticle = (r, arm, sz, fDir, col) => {
    positions[idx * 3] = positions[idx * 3 + 1] = positions[idx * 3 + 2] = 0;
    radialTs[idx]     = r;
    phaseOffsets[idx] = Math.random() * Math.PI * 2;
    sizes[idx]        = sz;
    flowDirs[idx]     = fDir;
    armIndices[idx]   = arm;
    layerZs[idx]      = (Math.random() - 0.5) * 2;
    colorHints[idx * 3]     = col[0] + (Math.random() - 0.5) * 0.12;
    colorHints[idx * 3 + 1] = col[1] + (Math.random() - 0.5) * 0.1;
    colorHints[idx * 3 + 2] = col[2] + (Math.random() - 0.5) * 0.1;
    idx++;
  };

  const white = particleWhite;

  // ---- Core: dense center, both in+out ----
  for (let i = 0; i < coreN; i++) {
    const r = Math.pow(Math.random(), 3.0);
    const fDir = Math.random() < 0.5 ? -1 : 1;
    const arm = Math.floor(Math.random() * numArms);
    setParticle(r, arm, 0.5 + Math.random() * 1.8, fDir, white);
  }

  // ---- Arm particles: 50% in, 50% out ----
  for (let i = 0; i < armN; i++) {
    const r = Math.random();
    const fDir = Math.random() < 0.5 ? -1 : 1;
    const arm = Math.floor(Math.random() * numArms);
    setParticle(r, arm, 0.2 + Math.random() * 0.8, fDir, white);
  }

  // ---- Outer halo: mostly inward (being drawn into the vortex) ----
  for (let i = 0; i < outerN; i++) {
    const r = 0.4 + Math.random() * 0.6;
    const fDir = Math.random() < 0.75 ? -1 : 1;
    const arm = Math.floor(Math.random() * numArms);
    setParticle(r, arm, 0.12 + Math.random() * 0.35, fDir, white);
  }

  // ---- Dust / nebula wisps (larger, softer) ----
  for (let i = 0; i < dustN; i++) {
    const r = 0.1 + Math.random() * 0.6;
    const fDir = Math.random() < 0.5 ? -1 : 1;
    const arm = Math.floor(Math.random() * numArms);
    setParticle(r, arm, 0.9 + Math.random() * 2.2, fDir, white);
  }

  geometry.setAttribute('position',     new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aRadialT',     new THREE.BufferAttribute(radialTs, 1));
  geometry.setAttribute('aPhaseOffset', new THREE.BufferAttribute(phaseOffsets, 1));
  geometry.setAttribute('aSize',        new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aFlowDir',     new THREE.BufferAttribute(flowDirs, 1));
  geometry.setAttribute('aArmIndex',    new THREE.BufferAttribute(armIndices, 1));
  geometry.setAttribute('aLayerZ',      new THREE.BufferAttribute(layerZs, 1));
  geometry.setAttribute('aColorHint',   new THREE.BufferAttribute(colorHints, 3));

  const material = new THREE.ShaderMaterial({
    vertexShader: vortexVertexShader,
    fragmentShader: vortexFragmentShader,
    uniforms: {
      uTime:      { value: 0 },
      uPointSize: { value: pointSize },
      uSpinSpeed: { value: spinSpeed },
      uOpacity:   { value: 0 },
      uLifeCycle: { value: 0 },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);

  // Tilt to see spiral structure — epic angled view
  points.rotation.x = -Math.PI * 0.08;
  points.rotation.z = Math.PI * 0.02;

  return points;
}
