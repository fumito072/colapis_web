/**
 * StoneMesh — 3D stone with Simplex Noise displacement + emissive crack shader
 * 
 * Appearance: Dark rocky surface with subtle inner glow cracks
 * Interaction: Hover → cracks illuminate, Click → aura burst + dissolve
 */
import * as THREE from 'three';
import { createNoise3D } from 'simplex-noise';

// ---- Shared Noise Instance ----
const noise3D = createNoise3D();

// ---- Custom Shader for Crack Emissive ----
const stoneVertexShader = /* glsl */`
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying vec3 vLocalPosition;
  varying float vDisplacement;
  
  uniform float uTime;
  uniform float uHoverProgress;
  
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vLocalPosition = position;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    
    // Slight vertex animation on hover — breathing
    float breath = sin(uTime * 1.5) * 0.005 * uHoverProgress;
    vec3 displaced = position * (1.0 + breath);
    
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(displaced, 1.0);
  }
`;

const stoneFragmentShader = /* glsl */`
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying vec3 vLocalPosition;
  varying float vDisplacement;
  
  uniform float uTime;
  uniform float uHoverProgress;
  uniform float uDissolveProgress;  // 0 = solid, 1 = fully dissolved
  uniform vec3 uBaseColor;
  uniform vec3 uCrackColor;
  uniform vec3 uLightDir;
  
  // Simplex-like hash noise (GPU side)
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  
  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    
    return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                   mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                   mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  
  // Fractal Brownian Motion for crack pattern
  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 5; i++) {
      value += amplitude * noise(p);
      p *= 2.2;
      amplitude *= 0.5;
    }
    return value;
  }
  
  // Voronoi-like crack pattern
  float crackPattern(vec3 p) {
    vec3 ip = floor(p);
    vec3 fp = fract(p);
    
    float minDist1 = 1.0;
    float minDist2 = 1.0;
    
    for (int x = -1; x <= 1; x++) {
      for (int y = -1; y <= 1; y++) {
        for (int z = -1; z <= 1; z++) {
          vec3 neighbor = vec3(float(x), float(y), float(z));
          vec3 point = vec3(hash(ip + neighbor), 
                           hash(ip + neighbor + vec3(31.0, 17.0, 7.0)),
                           hash(ip + neighbor + vec3(11.0, 37.0, 53.0)));
          float d = length(neighbor + point - fp);
          if (d < minDist1) {
            minDist2 = minDist1;
            minDist1 = d;
          } else if (d < minDist2) {
            minDist2 = d;
          }
        }
      }
    }
    
    // Edge detection — cracks are where two cells meet
    return 1.0 - smoothstep(0.0, 0.08, minDist2 - minDist1);
  }
  
  void main() {
    // ---- Dissolve clip ----
    float dissolveNoise = fbm(vLocalPosition * 3.0 + uTime * 0.3);
    float dissolveEdge = smoothstep(uDissolveProgress - 0.08, uDissolveProgress, dissolveNoise);
    
    if (dissolveNoise < uDissolveProgress - 0.08) {
      discard;
    }
    
    // ---- Base lighting (simplified PBR-like) ----
    vec3 N = normalize(vNormal);
    vec3 L = normalize(uLightDir);
    float NdotL = max(dot(N, L), 0.0);
    
    // Roughness simulation
    float diffuse = NdotL * 0.6 + 0.15;
    float rim = pow(1.0 - max(dot(N, vec3(0.0, 0.0, 1.0)), 0.0), 3.0) * 0.2;
    
    vec3 baseColor = uBaseColor * (diffuse + rim);
    
    // ---- Crack emissive pattern ----
    float crack = crackPattern(vLocalPosition * 4.5 + vec3(0.0, 0.0, uTime * 0.05));
    
    // Crack only glows with hover
    float crackGlow = crack * uHoverProgress;
    
    // Pulsating crack intensity
    float pulse = 0.6 + 0.4 * sin(uTime * 2.0 + vLocalPosition.y * 3.0);
    crackGlow *= pulse;
    
    vec3 crackEmission = uCrackColor * crackGlow * 2.5;
    
    // ---- Dissolve edge glow ----
    float edgeGlow = (1.0 - dissolveEdge) * step(0.01, uDissolveProgress);
    vec3 dissolveEmission = vec3(0.3, 0.8, 0.65) * edgeGlow * 5.0;
    
    // ---- Combine ----
    vec3 finalColor = baseColor + crackEmission + dissolveEmission;
    
    // Slight ambient occlusion from noise
    float ao = 0.8 + 0.2 * noise(vLocalPosition * 6.0);
    finalColor *= ao;
    
    float alpha = dissolveEdge;
    
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

// ============================================
// Shape profile helpers
// ============================================

/**
 * Smoothstep interpolation between profile control points
 * @param {number} t — input value
 * @param {Array<[number, number]>} pts — [[t0,v0], [t1,v1], ...] sorted by t
 */
function evalProfile(t, pts) {
  const n = pts.length;
  if (t <= pts[0][0]) return pts[0][1];
  if (t >= pts[n - 1][0]) return pts[n - 1][1];

  for (let i = 0; i < n - 1; i++) {
    const [t0, v0] = pts[i];
    const [t1, v1] = pts[i + 1];
    if (t >= t0 && t <= t1) {
      const f = (t - t0) / (t1 - t0);
      const s = f * f * (3 - 2 * f); // smoothstep
      return v0 + (v1 - v0) * s;
    }
  }
  return pts[n - 1][1];
}

/**
 * Apply revolution-profile shape to icosahedron vertices.
 * Profile maps ny ∈ [-1,1] → cross-section radius [0,1].
 * The vertex is placed at (hDir * crossR * xzScale, ny * R * yScale, ...).
 */
function applyProfileShape(positions, radius, profile, yScale, xScale, zScale, opts = {}) {
  const { asymmetry = 0, asymAngle = 0, lobeAmp = 0, lobePhase = 0 } = opts;

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);

    const len = Math.sqrt(x * x + y * y + z * z);
    if (len < 0.001) continue;

    const ny = y / len;
    const hLen = Math.sqrt(x * x + z * z);
    const hx = hLen > 0.001 ? x / hLen : 1;
    const hz = hLen > 0.001 ? z / hLen : 0;
    const phi = Math.atan2(hz, hx);

    let crossR = evalProfile(ny, profile) * radius;

    // Left-right asymmetry (wider on one side)
    if (asymmetry !== 0) {
      crossR *= 1.0 + asymmetry * Math.cos(phi + asymAngle);
    }

    // Butterfly/lobe modulation (wider in 2 directions)
    if (lobeAmp !== 0) {
      const lobeStrength = Math.max(0, lobePhase + ny * (-lobePhase));
      crossR *= 1.0 + lobeAmp * Math.cos(2 * phi) * lobeStrength;
    }

    positions.setXYZ(i,
      hx * crossR * xScale,
      ny * radius * yScale,
      hz * crossR * zScale
    );
  }
}

/**
 * Apply two-sphere SDF knot shape.
 * Creates double-bulge with smooth neck, like the COLAPIS logo middle piece.
 */
function applyKnotShape(positions, radius, yScale, xzScale, topY, topR, botY, botR, neckMinR) {
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);

    const len = Math.sqrt(x * x + y * y + z * z);
    if (len < 0.001) continue;

    const ny = y / len;
    const hLen = Math.sqrt(x * x + z * z);
    const hx = hLen > 0.001 ? x / hLen : 1;
    const hz = hLen > 0.001 ? z / hLen : 0;

    // Cross-section from two overlapping spheres
    const dTop = ny - topY;
    const rTop = (dTop * dTop < topR * topR)
      ? Math.sqrt(topR * topR - dTop * dTop) : 0;

    const dBot = ny - botY;
    const rBot = (dBot * dBot < botR * botR)
      ? Math.sqrt(botR * botR - dBot * dBot) : 0;

    // Smooth union of cross-sections
    let crossR;
    if (rTop > 0 && rBot > 0) {
      const k = 0.10;
      const h = Math.max(0, k - Math.abs(rTop - rBot)) / k;
      crossR = Math.max(rTop, rBot) + h * h * h * k / 6;
    } else {
      crossR = Math.max(rTop, rBot);
    }

    // Ensure smooth neck (minimum width at junction)
    const neckY = (topY + botY) / 2;
    const neckDist = Math.abs(ny - neckY);
    const neckContrib = neckMinR * Math.exp(-neckDist * neckDist * 10);
    crossR = Math.max(crossR, neckContrib);

    const finalR = crossR * radius;

    positions.setXYZ(i,
      hx * finalR * xzScale,
      ny * radius * yScale,
      hz * finalR * xzScale
    );
  }
}

// ============================================
// Stone mesh factory
// ============================================

/**
 * Create a stone mesh with noise displacement and crack shader
 *
 * shapeType determines the stone silhouette (matching COLAPIS logo):
 *   'bowl'   — Top stone: chalice bowl, wide opening at top   (会社紹介)
 *   'knot'   — Middle stone: double-sphere connector           (サービス)
 *   'base'   — Bottom stone: flared pedestal with lobes        (開発事例)
 *   'sphere' — Fallback: regular icosahedron
 */
export function createStoneMesh(config = {}) {
  const {
    radius = 0.6,
    detail = 40,
    noiseScale = 1.8,
    noiseAmplitude = 0.10,
    baseColor = new THREE.Color(0.08, 0.12, 0.10),
    crackColor = new THREE.Color(0.18, 0.85, 0.65),
    seed = 0,
    shapeType = 'sphere',
  } = config;

  // Start with unit icosahedron (radius=1), then shape + scale
  const geo = new THREE.IcosahedronGeometry(1.0, detail);
  const positions = geo.attributes.position;

  // ---- Apply shape deformation per type ----
  if (shapeType === 'bowl') {
    // Chalice bowl — wide opening at top (ny=1), narrows toward bottom
    // Profile: ny → cross-section radius (0-1 normalized)
    const profile = [
      [-1.0, 0.38],  // bottom center — narrow (connects to knot)
      [-0.8, 0.44],  // lower rounding
      [-0.5, 0.58],  // lower wall
      [-0.2, 0.72],  // mid-lower — widening
      [0.0, 0.80],   // middle
      [0.2, 0.88],   // upper-mid
      [0.4, 0.94],   // approaching rim
      [0.6, 0.98],   // near rim
      [0.75, 1.00],  // rim — widest point
      [0.88, 0.97],  // above rim — subtle lip
      [1.0, 0.88],   // top edge — curves inward (concave opening)
    ];
    applyProfileShape(positions, radius, profile,
      0.45,   // yScale — visible depth, not too flat
      1.55,   // xScale — wide
      1.20,   // zScale — slightly less depth for 3/4 silhouette
      {
        asymmetry: 0.08,       // slight left-right asymmetry
        asymAngle: Math.PI * 0.7,  // wider on the left
      }
    );

  } else if (shapeType === 'knot') {
    // Double-sphere connector — two rounded bulges with narrow neck
    // Top sphere slightly smaller, bottom sphere slightly larger (matching logo)
    applyKnotShape(positions, radius,
      0.70,   // yScale — vertically elongated
      0.75,   // xzScale — narrower than tall
      0.38,   // topY — top sphere center (normalized)
      0.42,   // topR — top sphere radius
      -0.32,  // botY — bottom sphere center
      0.50,   // botR — bottom sphere radius (slightly larger)
      0.18,   // neckMinR — minimum neck width
    );

  } else if (shapeType === 'base') {
    // Flared pedestal — wide bottom with butterfly lobes, narrow top
    const profile = [
      [-1.0, 0.42],  // bottom center — slight inward curve
      [-0.8, 0.88],  // flaring outward sharply
      [-0.55, 1.00], // maximum width
      [-0.3, 0.88],  // starting to narrow
      [-0.05, 0.70], // middle zone
      [0.2, 0.55],   // upper-mid
      [0.45, 0.42],  // upper
      [0.7, 0.32],   // approaching top
      [0.85, 0.27],  // near top
      [1.0, 0.22],   // top — narrow (connects to knot)
    ];
    applyProfileShape(positions, radius, profile,
      0.50,   // yScale
      1.30,   // xScale
      1.08,   // zScale
      {
        lobeAmp: 0.14,   // butterfly lobe amplitude
        lobePhase: 0.65,  // lobes strongest at bottom
      }
    );

  } else {
    // Fallback: uniform sphere at given radius
    for (let i = 0; i < positions.count; i++) {
      positions.setXYZ(i,
        positions.getX(i) * radius,
        positions.getY(i) * radius,
        positions.getZ(i) * radius
      );
    }
  }

  // ---- Simplex noise displacement for organic rocky texture ----
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);

    const len = Math.sqrt(x * x + y * y + z * z);
    if (len < 0.001) continue;
    const nx = x / len, ny = y / len, nz = z / len;

    // Multi-octave noise
    const n1 = noise3D(x * noiseScale + seed * 10, y * noiseScale, z * noiseScale) * noiseAmplitude;
    const n2 = noise3D(x * noiseScale * 2.5 + seed * 10, y * noiseScale * 2.5 + 100, z * noiseScale * 2.5) * noiseAmplitude * 0.4;
    const n3 = noise3D(x * noiseScale * 5 + seed * 10, y * noiseScale * 5 + 200, z * noiseScale * 5) * noiseAmplitude * 0.15;

    const disp = n1 + n2 + n3;
    positions.setXYZ(i, x + nx * disp, y + ny * disp, z + nz * disp);
  }

  geo.computeVertexNormals();

  // ---- Custom Shader Material ----
  const material = new THREE.ShaderMaterial({
    vertexShader: stoneVertexShader,
    fragmentShader: stoneFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uHoverProgress: { value: 0 },
      uDissolveProgress: { value: 0 },
      uBaseColor: { value: baseColor },
      uCrackColor: { value: crackColor },
      uLightDir: { value: new THREE.Vector3(0.5, 0.8, 1.0).normalize() },
    },
    transparent: true,
    side: THREE.FrontSide,
    depthWrite: true,
  });

  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;

  return mesh;
}

/**
 * Generate surface point positions from a stone mesh (for particle dissolve)
 * @returns {Float32Array} positions [x,y,z, x,y,z, ...]
 */
export function getStoneSurfacePoints(mesh, count = 2000) {
  const geo = mesh.geometry;
  const positions = geo.attributes.position;
  const normals = geo.attributes.normal;
  const index = geo.index;
  const points = new Float32Array(count * 3);
  const pointNormals = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    // Pick a random triangle
    let i0, i1, i2;
    if (index) {
      const faceIdx = Math.floor(Math.random() * (index.count / 3)) * 3;
      i0 = index.getX(faceIdx);
      i1 = index.getX(faceIdx + 1);
      i2 = index.getX(faceIdx + 2);
    } else {
      const faceIdx = Math.floor(Math.random() * (positions.count / 3)) * 3;
      i0 = faceIdx;
      i1 = faceIdx + 1;
      i2 = faceIdx + 2;
    }

    // Random barycentric coordinates
    let u = Math.random(), v = Math.random();
    if (u + v > 1) { u = 1 - u; v = 1 - v; }
    const w = 1 - u - v;

    // Interpolate position
    points[i * 3]     = positions.getX(i0) * u + positions.getX(i1) * v + positions.getX(i2) * w;
    points[i * 3 + 1] = positions.getY(i0) * u + positions.getY(i1) * v + positions.getY(i2) * w;
    points[i * 3 + 2] = positions.getZ(i0) * u + positions.getZ(i1) * v + positions.getZ(i2) * w;

    // Interpolate normal
    pointNormals[i * 3]     = normals.getX(i0) * u + normals.getX(i1) * v + normals.getX(i2) * w;
    pointNormals[i * 3 + 1] = normals.getY(i0) * u + normals.getY(i1) * v + normals.getY(i2) * w;
    pointNormals[i * 3 + 2] = normals.getZ(i0) * u + normals.getZ(i1) * v + normals.getZ(i2) * w;
  }

  return { points, normals: pointNormals };
}
