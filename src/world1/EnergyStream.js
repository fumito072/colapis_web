/**
 * EnergyStream — Particle-based energy connections between stones
 * Replaces the old Canvas 2D dotted lines with flowing particle streams
 */
import * as THREE from 'three';

const streamVertexShader = /* glsl */`
  attribute float aPhase;
  attribute float aT;          // position along the curve 0..1
  attribute float aSize;
  
  uniform float uTime;
  uniform float uIntensity;    // hover boost
  uniform vec3 uStartPos;
  uniform vec3 uEndPos;
  uniform float uPointSize;
  
  varying float vAlpha;
  
  void main() {
    // Flow along the curve
    float flowT = fract(aT + uTime * 0.15 + aPhase * 0.1);
    
    // Bezier midpoint with gentle wave
    vec3 mid = (uStartPos + uEndPos) * 0.5;
    mid.y += sin(uTime * 0.5 + aPhase) * 0.3;
    mid.z += cos(uTime * 0.3 + aPhase * 2.0) * 0.2;
    
    // Quadratic bezier
    float t = flowT;
    vec3 pos = (1.0 - t) * (1.0 - t) * uStartPos 
             + 2.0 * (1.0 - t) * t * mid 
             + t * t * uEndPos;
    
    // Slight perpendicular offset for width
    vec3 tangent = normalize(uEndPos - uStartPos);
    vec3 up = vec3(0.0, 1.0, 0.0);
    vec3 perp = normalize(cross(tangent, up));
    
    float offsetAmount = sin(aPhase * 20.0 + uTime * 2.0) * 0.05 * (1.0 + uIntensity);
    pos += perp * offsetAmount;
    pos.y += sin(aPhase * 15.0 + uTime * 1.5) * 0.03;
    
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = aSize * uPointSize * (100.0 / -mvPosition.z) * (0.5 + uIntensity * 0.5);
    gl_Position = projectionMatrix * mvPosition;
    
    // Fade at endpoints
    float edgeFade = smoothstep(0.0, 0.15, flowT) * smoothstep(1.0, 0.85, flowT);
    float pulse = 0.5 + 0.5 * sin(uTime * 3.0 + aPhase * 10.0);
    vAlpha = edgeFade * pulse * (0.08 + uIntensity * 0.4);
  }
`;

const streamFragmentShader = /* glsl */`
  uniform vec3 uColor;
  varying float vAlpha;
  
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float alpha = smoothstep(1.0, 0.0, d) * vAlpha;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

/**
 * Create one energy stream between two stone positions
 */
export function createEnergyStream(config = {}) {
  const {
    count = 100,
    color = new THREE.Color(0.2, 0.85, 0.65),
    pointSize = 0.05,
  } = config;

  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3); // placeholder
  const phases = new Float32Array(count);
  const ts = new Float32Array(count);
  const sizes = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    phases[i] = Math.random() * Math.PI * 2;
    ts[i] = i / count;
    sizes[i] = 0.3 + Math.random() * 0.8;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute('aT', new THREE.BufferAttribute(ts, 1));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.ShaderMaterial({
    vertexShader: streamVertexShader,
    fragmentShader: streamFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 0 },
      uStartPos: { value: new THREE.Vector3() },
      uEndPos: { value: new THREE.Vector3() },
      uColor: { value: color },
      uPointSize: { value: pointSize },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  return new THREE.Points(geometry, material);
}
