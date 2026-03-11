/**
 * ParticleAura — GPU particle aura around stones
 * Uses custom shaders for performance (2000+ particles per stone)
 * 
 * Features:
 * - Idle: Faint particles orbiting the stone
 * - Hover: Particles intensify and swirl faster  
 * - Dissolve: Stone surface points become particles that explode outward
 */
import * as THREE from 'three';

// ---- Aura Particle Shaders ----

const auraVertexShader = /* glsl */`
  attribute float aSize;
  attribute float aPhase;
  attribute float aSpeed;
  attribute float aOrbitRadius;
  
  uniform float uTime;
  uniform float uIntensity;   // 0 = idle, 1 = full hover
  uniform float uPointSize;
  
  varying float vAlpha;
  varying float vPhase;
  
  void main() {
    // Orbital motion around the stone center
    float angle = aPhase + uTime * aSpeed * (0.3 + uIntensity * 0.7);
    float r = aOrbitRadius * (1.0 + sin(uTime * 0.5 + aPhase) * 0.2);
    
    // 3D orbital path
    float orbitTilt = aPhase * 0.5;
    vec3 orbitPos = vec3(
      cos(angle) * r,
      sin(angle * 0.7 + orbitTilt) * r * 0.6,
      sin(angle) * r * 0.8
    );
    
    // Add some noise drift
    orbitPos.x += sin(uTime * 0.3 + aPhase * 3.0) * 0.1;
    orbitPos.y += cos(uTime * 0.4 + aPhase * 2.0) * 0.08;
    
    vec3 transformed = position + orbitPos;
    
    vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
    
    // Size attenuation
    float sizeScale = aSize * uPointSize * (0.4 + uIntensity * 0.6);
    gl_PointSize = sizeScale * (200.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
    
    // Fade based on distance from center and intensity
    float dist = length(orbitPos);
    float distFade = smoothstep(2.0, 0.3, dist);
    float timeFade = 0.3 + 0.7 * (0.5 + 0.5 * sin(uTime * 2.0 + aPhase * 5.0));
    
    vAlpha = distFade * timeFade * (0.15 + uIntensity * 0.85);
    vPhase = aPhase;
  }
`;

const auraFragmentShader = /* glsl */`
  uniform vec3 uColor;
  varying float vAlpha;
  varying float vPhase;
  
  void main() {
    // Soft circle with radial gradient
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float alpha = smoothstep(1.0, 0.0, d) * vAlpha;
    
    // Slight color variation per particle
    vec3 color = uColor * (0.8 + 0.4 * sin(vPhase * 10.0));
    
    gl_FragColor = vec4(color, alpha);
  }
`;

/**
 * Create a particle aura system around a stone
 */
export function createParticleAura(config = {}) {
  const {
    count = 800,
    radius = 1.0,
    color = new THREE.Color(0.2, 0.9, 0.7),
    pointSize = 0.08,
  } = config;

  const geometry = new THREE.BufferGeometry();

  // All particles start at origin (stone center); movement is in shader
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const speeds = new Float32Array(count);
  const orbitRadii = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    positions[i * 3] = 0;
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = 0;

    sizes[i] = 0.3 + Math.random() * 1.0;
    phases[i] = Math.random() * Math.PI * 2;
    speeds[i] = 0.3 + Math.random() * 1.5;
    orbitRadii[i] = radius * (0.5 + Math.random() * 0.8);
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
  geometry.setAttribute('aOrbitRadius', new THREE.BufferAttribute(orbitRadii, 1));

  const material = new THREE.ShaderMaterial({
    vertexShader: auraVertexShader,
    fragmentShader: auraFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 0 },
      uColor: { value: color },
      uPointSize: { value: pointSize },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);
  return points;
}

// ---- Dissolve Particle Shaders ----

const dissolveVertexShader = /* glsl */`
  attribute vec3 aStartPos;    // Surface point on stone
  attribute vec3 aNormal;      // Surface normal (outward direction)
  attribute float aPhase;
  attribute float aSpeed;
  attribute float aSize;
  
  uniform float uTime;
  uniform float uProgress;     // 0 = on surface, 1 = fully dispersed
  uniform float uPointSize;
  uniform float uForwardPull;  // 0 = normal dissolve, 1 = stream forward into depth
  
  varying float vAlpha;
  varying float vProgress;
  
  // Simplex-ish noise for GPU
  float hash1(float n) { return fract(sin(n) * 43758.5453123); }
  
  void main() {
    // Dissolve wave: particles release based on noise threshold
    float threshold = uProgress * 1.3; // slightly over 1 so all particles eventually release
    float noiseVal = hash1(aPhase * 1000.0) * 0.5 
                   + 0.5 * sin(aStartPos.y * 5.0 + aPhase);
    
    float released = smoothstep(noiseVal - 0.1, noiseVal, threshold);
    float localTime = max(0.0, threshold - noiseVal) * 3.0;
    
    // Movement: outward along normal, then spiraling
    vec3 outward = aNormal * localTime * aSpeed * 0.8;
    
    // Add spiral motion
    float spiralAngle = localTime * 3.0 + aPhase * 6.28;
    float spiralRadius = localTime * 0.3;
    vec3 spiral = vec3(
      cos(spiralAngle) * spiralRadius,
      sin(spiralAngle * 0.7) * spiralRadius * 0.5 + localTime * aSpeed * 0.2,
      sin(spiralAngle) * spiralRadius * 0.8
    );
    
    // Gravity-like downward pull at the end
    vec3 gravity = vec3(0.0, -localTime * localTime * 0.05, 0.0);
    
    // Forward pull into depth during world transition
    vec3 forward = vec3(0.0, 0.0, -localTime * aSpeed * uForwardPull * 3.0);
    
    vec3 pos = aStartPos + (outward + spiral + gravity + forward) * released;
    
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    
    float size = aSize * uPointSize * (0.5 + released * 0.5);
    // Particles grow slightly as they move away
    size *= (1.0 + localTime * 0.3);
    gl_PointSize = size * (200.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
    
    // Fade: bright at release, then gradually fade
    float releaseFade = released;
    float ageFade = 1.0 - smoothstep(0.5, 1.5, localTime);
    float twinkle = 0.7 + 0.3 * sin(uTime * 5.0 + aPhase * 20.0);
    
    vAlpha = releaseFade * ageFade * twinkle;
    vProgress = uProgress;
  }
`;

const dissolveFragmentShader = /* glsl */`
  uniform vec3 uColor;
  uniform vec3 uCoreColor;
  uniform float uProgress;
  
  varying float vAlpha;
  varying float vProgress;
  
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float alpha = smoothstep(1.0, 0.0, d) * vAlpha;
    
    // Color shifts from stone color to bright core as dissolve progresses
    vec3 color = mix(uColor, uCoreColor, vProgress * 0.6);
    
    // Bright center
    color += vec3(0.3, 0.5, 0.4) * smoothstep(0.5, 0.0, d) * 0.5;
    
    gl_FragColor = vec4(color, alpha);
  }
`;

/**
 * Create dissolve particle system from stone surface points
 * @param {Float32Array} surfacePoints - positions [x,y,z,...]
 * @param {Float32Array} surfaceNormals - normals [x,y,z,...]
 */
export function createDissolveParticles(surfacePoints, surfaceNormals, config = {}) {
  const {
    color = new THREE.Color(0.2, 0.9, 0.7),
    coreColor = new THREE.Color(0.7, 1.0, 0.9),
    pointSize = 0.06,
  } = config;

  const count = surfacePoints.length / 3;
  const geometry = new THREE.BufferGeometry();

  const phases = new Float32Array(count);
  const speeds = new Float32Array(count);
  const sizes = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    phases[i] = Math.random() * Math.PI * 2;
    speeds[i] = 0.5 + Math.random() * 1.5;
    sizes[i] = 0.3 + Math.random() * 1.0;
  }

  // position attribute is unused (we use aStartPos), but Three.js requires it
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute('aStartPos', new THREE.BufferAttribute(surfacePoints, 3));
  geometry.setAttribute('aNormal', new THREE.BufferAttribute(surfaceNormals, 3));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.ShaderMaterial({
    vertexShader: dissolveVertexShader,
    fragmentShader: dissolveFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uColor: { value: color },
      uCoreColor: { value: coreColor },
      uPointSize: { value: pointSize },
      uForwardPull: { value: 0 },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);
  points.visible = false; // hidden until dissolve starts

  return points;
}
