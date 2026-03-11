/**
 * BackgroundParticles — Ambient floating particles for World 1
 * Star-field / nebula atmosphere in the background
 */
import * as THREE from 'three';

const bgVertexShader = /* glsl */`
  attribute float aSize;
  attribute float aPhase;
  attribute float aBrightness;
  
  uniform float uTime;
  uniform float uPointSize;
  
  varying float vAlpha;
  
  void main() {
    vec3 pos = position;
    
    // Gentle drift
    pos.x += sin(uTime * 0.1 + aPhase * 3.0) * 0.3;
    pos.y += cos(uTime * 0.08 + aPhase * 2.0) * 0.2;
    pos.z += sin(uTime * 0.05 + aPhase) * 0.1;
    
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    
    gl_PointSize = aSize * uPointSize * (100.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
    
    // Twinkle
    float twinkle = 0.5 + 0.5 * sin(uTime * (1.0 + aPhase * 2.0) + aPhase * 10.0);
    vAlpha = aBrightness * twinkle;
  }
`;

const bgFragmentShader = /* glsl */`
  uniform vec3 uColor;
  varying float vAlpha;
  
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float alpha = smoothstep(1.0, 0.0, d) * vAlpha;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

export function createBackgroundParticles(config = {}) {
  const {
    count = 500,
    spread = 30,
    zDepth = 45,
    color = new THREE.Color(0.2, 0.6, 0.5),
    pointSize = 0.06,
  } = config;

  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const brightnesses = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * spread;
    positions[i * 3 + 1] = (Math.random() - 0.5) * spread * 0.7;
    positions[i * 3 + 2] = -2 - Math.random() * zDepth;
    
    sizes[i] = 0.2 + Math.random() * 1.2;
    phases[i] = Math.random() * Math.PI * 2;
    brightnesses[i] = 0.05 + Math.random() * 0.2;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute('aBrightness', new THREE.BufferAttribute(brightnesses, 1));

  const material = new THREE.ShaderMaterial({
    vertexShader: bgVertexShader,
    fragmentShader: bgFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: color },
      uPointSize: { value: pointSize },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  return new THREE.Points(geometry, material);
}
