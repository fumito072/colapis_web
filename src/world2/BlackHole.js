/**
 * BlackHole — Cosmic Fractal Singularity
 *
 * IFS fractal-based cosmic effect inspired by "The Big Bang" (Shadertoy).
 * Deep black space with swirling gold / amber energy radiating from center.
 * Adapted for Three.js ShaderMaterial with shared renderer architecture.
 */
import * as THREE from 'three';

// ---- Vertex Shader ----
const bhVertexShader = /* glsl */`
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// ---- Fragment Shader: IFS Fractal Cosmic Effect ----
const bhFragmentShader = /* glsl */`
  precision highp float;

  uniform float uTime;
  uniform vec2  uResolution;
  uniform float uOpacity;
  uniform float uCameraDistance;

  void main() {
    vec2 uv = (gl_FragCoord.xy / uResolution.xy) - 0.5;

    // Zoom control via scroll (uCameraDistance 8→3 maps to zoom 1→1.8)
    float zoom = 1.0 + (8.0 - uCameraDistance) * 0.16;
    uv /= zoom;

    float time = uTime * 0.1 + ((0.25 + 0.05 * sin(uTime * 0.1)) / (length(uv.xy) + 0.07)) * 2.2;
    float si = sin(time);
    float co = cos(time);
    mat2 ma = mat2(co, si, -si, co);

    float v1 = 0.0, v2 = 0.0, v3 = 0.0;
    float s = 0.0;

    for (int i = 0; i < 90; i++) {
      vec3 p = s * vec3(uv, 0.0);
      p.xy *= ma;
      p += vec3(0.22, 0.3, s - 1.5 - sin(uTime * 0.13) * 0.1);

      for (int j = 0; j < 8; j++) {
        p = abs(p) / dot(p, p) - 0.659;
      }

      v1 += dot(p, p) * 0.0015 * (1.8 + sin(length(uv.xy * 13.0) + 0.5 - uTime * 0.2));
      v2 += dot(p, p) * 0.0013 * (1.5 + sin(length(uv.xy * 14.5) + 1.2 - uTime * 0.3));
      v3 += length(p.xy * 10.0) * 0.0003;
      s += 0.035;
    }

    float len = length(uv);

    v1 *= smoothstep(0.7, 0.0, len);
    v2 *= smoothstep(0.5, 0.0, len);
    v3 *= smoothstep(0.9, 0.0, len);

    // Gold / amber luxury color mapping (warm tones on dark base)
    vec3 col = vec3(
      v3 * (1.5 + sin(uTime * 0.2) * 0.4),         // warm amber channel
      (v1 + v3) * 0.3,                               // subtle gold mid
      v2 * 0.15                                       // deep blue suppressed
    );

    // Core glow: warm white center
    col += smoothstep(0.2, 0.0, len) * 0.7 * vec3(1.0, 0.85, 0.55);

    // Outer halo warmth
    col += smoothstep(0.0, 0.6, v3) * 0.25 * vec3(1.0, 0.7, 0.3);

    // Gamma + contrast
    col = min(pow(abs(col), vec3(1.15)), 1.0);

    gl_FragColor = vec4(col, uOpacity);
  }
`;

/**
 * Create the black hole full-screen plane
 */
export function createBlackHole(config = {}) {
  const { size = 50 } = config;

  const geometry = new THREE.PlaneGeometry(size, size);

  const material = new THREE.ShaderMaterial({
    vertexShader: bhVertexShader,
    fragmentShader: bhFragmentShader,
    uniforms: {
      uTime:           { value: 0.0 },
      uResolution:     { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      uOpacity:        { value: 0.0 },
      uCameraDistance:  { value: 8.0 },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;

  // Keep resolution in sync
  const onResize = () => {
    material.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
  };
  window.addEventListener('resize', onResize);
  mesh.userData.cleanup = () => window.removeEventListener('resize', onResize);

  return mesh;
}
