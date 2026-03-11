/**
 * SceneManager3DWorld1 — Three.js based World 1 scene
 * 
 * Replaces the old Canvas 2D scene with:
 * - 3D stone meshes with Simplex Noise displacement
 * - Custom crack emissive shader (glows on hover)
 * - Particle aura orbiting each stone
 * - Energy stream connections between stones
 * - Particle dissolve transition when stone is clicked
 * - UnrealBloomPass post-processing
 * - Background nebula particles
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import gsap from 'gsap';

import { createStoneMesh, getStoneSurfacePoints } from './StoneMesh.js';
import { createParticleAura, createDissolveParticles } from './ParticleAura.js';
import { createBackgroundParticles } from './BackgroundParticles.js';
import { createEnergyStream } from './EnergyStream.js';

// ---- Stone Configurations ----
// Shapes match the COLAPIS logo: bowl (top) + knot (middle) + base (bottom)
//
// Logo anatomy (top to bottom):
//   Bowl  — wide chalice bowl, opening faces up
//   Knot  — small double-sphere connector
//   Base  — flared pedestal with butterfly lobes
//
// Dimensions (radius × yScale):
//   Bowl:  0.65 × 0.45  → halfH = 0.293
//   Knot:  0.35 × 0.70  → halfH = 0.245
//   Base:  0.55 × 0.50  → halfH = 0.275
//
// Logo stacking (bottom-up, pieces touching):
//   Base center:  Y = -0.52
//   Knot center:  Y =  0.00  (base top + knot halfH ≈ -0.245 + 0.245)
//   Bowl center:  Y =  0.54  (knot top + bowl halfH ≈  0.245 + 0.293)
const STONE_CONFIGS = {
  company: {
    label: '会社紹介',
    radius: 0.65,
    shapeType: 'bowl',
    baseColor: new THREE.Color(0.06, 0.10, 0.08),
    crackColor: new THREE.Color(0.18, 0.85, 0.65),
    auraColor: new THREE.Color(0.15, 0.75, 0.55),
    seed: 1,
    // Position in logo formation (relative to logo center)
    logoOffset: new THREE.Vector3(0, 0.54, 0),
    logoRotation: new THREE.Euler(0, 0, 0),
  },
  services: {
    label: 'サービス',
    radius: 0.35,
    shapeType: 'knot',
    baseColor: new THREE.Color(0.07, 0.10, 0.09),
    crackColor: new THREE.Color(0.2, 0.8, 0.7),
    auraColor: new THREE.Color(0.18, 0.8, 0.6),
    seed: 2,
    logoOffset: new THREE.Vector3(0, 0.0, 0),
    logoRotation: new THREE.Euler(0, 0, 0),
  },
  works: {
    label: '開発事例',
    radius: 0.55,
    shapeType: 'base',
    baseColor: new THREE.Color(0.06, 0.09, 0.08),
    crackColor: new THREE.Color(0.15, 0.9, 0.6),
    auraColor: new THREE.Color(0.12, 0.85, 0.55),
    seed: 3,
    logoOffset: new THREE.Vector3(0, -0.52, 0),
    logoRotation: new THREE.Euler(0, 0, 0),
  },
};

export class SceneManager3DWorld1 {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Function} onStoneClick — callback(stoneId) when dissolve completes
   */
  constructor(canvas, onStoneClick) {
    this.canvas = canvas;
    this.onStoneClick = onStoneClick;
    this.running = true;

    // State
    this.stones = {};       // { id: { mesh, aura, dissolve, label, ... } }
    this.energyStreams = []; // particle streams between stones
    this.hoveredStone = null;
    this.isDragging = false;
    this.draggedStone = null;
    this.dragOffset = new THREE.Vector3();
    this.dragStartPos = new THREE.Vector2();
    this.dissolving = false;  // lock during dissolve animation
    this.merging = false;      // lock during logo merge animation
    this.logoDissolveParticles = null; // combined dissolve for merged logo
    this.inTransition = false; // camera flying to/from World 2
    this.cameraLookTarget = new THREE.Vector3(0, 0, 0);
    this.world2Manager = null; // reference to World 2 scene manager

    // Labels
    this.labelContainer = document.getElementById('stone-labels');
    this.labels = {};

    this._initScene();
    this._initLights();
    this._initPostProcessing();
    this._initStones();
    this._initEnergyStreams();
    this._initBackground();
    this._createLabels();
    this._bindEvents();
    this._animate();
  }

  // =============================================
  //  INIT
  // =============================================

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 100);
    this.camera.position.set(0, 0, 5.5);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    this.clock = new THREE.Clock();
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2(9999, 9999); // offscreen initially
    this.mouseNDC = new THREE.Vector2(9999, 9999);
  }

  _initLights() {
    // Subtle ambient
    this.scene.add(new THREE.AmbientLight(0x1a332a, 0.8));

    // Key light — from upper-right
    const key = new THREE.PointLight(0x4aedc4, 1.2, 20);
    key.position.set(3, 3, 5);
    this.scene.add(key);

    // Fill — from left
    const fill = new THREE.PointLight(0x2a8a6e, 0.6, 15);
    fill.position.set(-4, 1, 3);
    this.scene.add(fill);

    // Rim — from behind
    const rim = new THREE.PointLight(0x1a5544, 0.5, 15);
    rim.position.set(0, -2, -5);
    this.scene.add(rim);
  }

  _initPostProcessing() {
    this.composer = new EffectComposer(this.renderer);

    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    // Bloom — key to the visual quality
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.8,    // strength
      0.4,    // radius
      0.85    // threshold
    );
    this.composer.addPass(this.bloomPass);

    const outputPass = new OutputPass();
    this.composer.addPass(outputPass);
  }

  _initStones() {
    const stoneIds = ['company', 'services', 'works'];

    // Triangle layout — bowl left, knot top-center, base right
    const spread = 1.8;
    const yOffset = 0.1;
    const positions = [
      new THREE.Vector3(-spread * 0.85, -spread * 0.25 + yOffset, 0),   // company (bowl) — left
      new THREE.Vector3(0, spread * 0.5 + yOffset, 0),                  // services (knot) — top
      new THREE.Vector3(spread * 0.85, -spread * 0.25 + yOffset, 0),    // works (base) — right
    ];

    stoneIds.forEach((id, i) => {
      const config = STONE_CONFIGS[id];

      // Stone mesh
      const mesh = createStoneMesh({
        radius: config.radius,
        detail: 40,
        noiseScale: 1.8,
        noiseAmplitude: 0.10,
        baseColor: config.baseColor,
        crackColor: config.crackColor,
        seed: config.seed,
        shapeType: config.shapeType,
      });
      mesh.position.copy(positions[i]);
      mesh.userData = {
        stoneId: id,
        isStone: true,
        basePosition: positions[i].clone(),
        driftPhaseX: Math.random() * Math.PI * 2,
        driftPhaseY: Math.random() * Math.PI * 2,
        hoverProgress: 0,
        rotationSpeed: 0.08 + Math.random() * 0.05,
      };
      this.scene.add(mesh);

      // Particle aura
      const aura = createParticleAura({
        count: 600,
        radius: config.radius * 1.8,
        color: config.auraColor,
        pointSize: 0.07,
      });
      aura.position.copy(positions[i]);
      this.scene.add(aura);

      // Pre-compute dissolve particles
      const surfaceData = getStoneSurfacePoints(mesh, 3000);
      const dissolve = createDissolveParticles(surfaceData.points, surfaceData.normals, {
        color: config.auraColor,
        coreColor: new THREE.Color(0.7, 1.0, 0.9),
        pointSize: 0.05,
      });
      dissolve.position.copy(positions[i]);
      this.scene.add(dissolve);

      this.stones[id] = {
        mesh,
        aura,
        dissolve,
        config,
        basePosition: positions[i].clone(),
      };
    });
  }

  _initEnergyStreams() {
    const ids = ['company', 'services', 'works'];
    const pairs = [
      [ids[0], ids[1]],
      [ids[1], ids[2]],
      [ids[2], ids[0]],
    ];

    for (const [idA, idB] of pairs) {
      const stream = createEnergyStream({
        count: 80,
        color: new THREE.Color(0.18, 0.75, 0.55),
        pointSize: 0.04,
      });
      stream.userData = { stoneA: idA, stoneB: idB };
      this.scene.add(stream);
      this.energyStreams.push(stream);
    }
  }

  _initBackground() {
    this.bgParticles = createBackgroundParticles({
      count: 300,
      spread: 25,
      color: new THREE.Color(0.15, 0.5, 0.4),
      pointSize: 0.05,
    });
    this.scene.add(this.bgParticles);
  }

  _createLabels() {
    if (!this.labelContainer) return;
    this.labelContainer.innerHTML = '';

    setTimeout(() => {
      for (const [id, stone] of Object.entries(this.stones)) {
        const label = document.createElement('div');
        label.className = 'stone-label';
        label.textContent = STONE_CONFIGS[id].label;
        label.dataset.stoneId = id;
        this.labelContainer.appendChild(label);
        this.labels[id] = label;
      }
    }, 100);
  }

  // =============================================
  //  EVENTS
  // =============================================

  _bindEvents() {
    window.addEventListener('resize', () => this._onResize());
    this.canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
    this.canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
    this.canvas.addEventListener('mouseup', (e) => this._onMouseUp(e));
    this.canvas.addEventListener('mouseleave', () => {
      this.hoveredStone = null;
      this.canvas.style.cursor = 'default';
    });

    // Touch
    this.canvas.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: false });
    this.canvas.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: false });
    this.canvas.addEventListener('touchend', (e) => this._onTouchEnd(e));
  }

  _onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloomPass.resolution.set(w, h);
  }

  _updateMouseNDC(clientX, clientY) {
    this.mouse.set(clientX, clientY);
    this.mouseNDC.set(
      (clientX / window.innerWidth) * 2 - 1,
      -(clientY / window.innerHeight) * 2 + 1
    );
  }

  _hitTestStones() {
    if (this.dissolving) return null;
    this.raycaster.setFromCamera(this.mouseNDC, this.camera);
    const meshes = Object.values(this.stones).map(s => s.mesh).filter(m => m.visible);
    const hits = this.raycaster.intersectObjects(meshes);
    return hits.length > 0 ? hits[0].object : null;
  }

  _onMouseMove(e) {
    this._updateMouseNDC(e.clientX, e.clientY);
    if (this.dissolving) return;

    // Drag
    if (this.isDragging && this.draggedStone) {
      this._moveDrag(e.clientX, e.clientY);
      this.canvas.style.cursor = 'grabbing';
      return;
    }

    const hit = this._hitTestStones();
    const hitId = hit?.userData?.stoneId || null;
    this.hoveredStone = hitId;
    this.canvas.style.cursor = hitId ? 'pointer' : 'default';
  }

  _onMouseDown(e) {
    if (this.dissolving) return;
    this._updateMouseNDC(e.clientX, e.clientY);
    const hit = this._hitTestStones();
    if (hit) {
      this.isDragging = true;
      this.draggedStone = hit.userData.stoneId;
      this.dragStartPos.set(e.clientX, e.clientY);
    }
  }

  _onMouseUp(e) {
    if (this.dissolving) return;
    if (this.isDragging && this.draggedStone) {
      const dx = e.clientX - this.dragStartPos.x;
      const dy = e.clientY - this.dragStartPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 5) {
        // Click — trigger dissolve
        this._triggerDissolve(this.draggedStone);
      }

      this.isDragging = false;
      this.draggedStone = null;
      this.canvas.style.cursor = 'default';
    }
  }

  // Touch
  _onTouchStart(e) {
    e.preventDefault();
    if (this.dissolving) return;
    const touch = e.touches[0];
    this._updateMouseNDC(touch.clientX, touch.clientY);
    const hit = this._hitTestStones();
    if (hit) {
      this.isDragging = true;
      this.draggedStone = hit.userData.stoneId;
      this.dragStartPos.set(touch.clientX, touch.clientY);
    }
  }

  _onTouchMove(e) {
    e.preventDefault();
    if (this.dissolving) return;
    const touch = e.touches[0];
    this._updateMouseNDC(touch.clientX, touch.clientY);
  }

  _onTouchEnd(e) {
    if (this.dissolving) return;
    if (this.isDragging && this.draggedStone) {
      if (e.changedTouches?.[0]) {
        const touch = e.changedTouches[0];
        const dx = touch.clientX - this.dragStartPos.x;
        const dy = touch.clientY - this.dragStartPos.y;
        if (Math.sqrt(dx * dx + dy * dy) < 10) {
          this._triggerDissolve(this.draggedStone);
        }
      }
      this.isDragging = false;
      this.draggedStone = null;
    }
    this.hoveredStone = null;
  }

  _moveDrag(clientX, clientY) {
    // Project mouse to world plane at z=0
    this._updateMouseNDC(clientX, clientY);
    this.raycaster.setFromCamera(this.mouseNDC, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const target = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(plane, target);

    if (target && this.draggedStone) {
      const stone = this.stones[this.draggedStone];
      stone.mesh.position.x = target.x;
      stone.mesh.position.y = target.y;
      stone.aura.position.copy(stone.mesh.position);
      stone.dissolve.position.copy(stone.mesh.position);
      stone.basePosition.copy(stone.mesh.position);
    }
  }

  // =============================================
  //  DISSOLVE TRANSITION
  // =============================================

  /**
   * Full transition sequence:
   * Phase 1 (0-0.5s):  Clicked stone cracks glow bright, all auras intensify
   * Phase 2 (0.5-2.0s): All 3 stones fly to center and stack into COLAPIS logo
   * Phase 3 (2.0-2.8s): Logo holds — bloom pulse, cracks blaze across all stones
   * Phase 4 (2.8-5.0s): Merged logo dissolves into particles (shatter)
   * Phase 5 (5.0s):     Callback to World 2
   */
  _triggerDissolve(stoneId) {
    if (this.dissolving) return;
    this.dissolving = true;
    this.merging = true;

    const logoCenter = new THREE.Vector3(0, 0, 0);
    const stoneEntries = Object.entries(this.stones);

    // ============================================
    // Phase 1: Clicked stone cracks blaze (0 → 0.5s)
    // ============================================
    const clickedStone = this.stones[stoneId];
    gsap.to(clickedStone.mesh.material.uniforms.uHoverProgress, {
      value: 1.0, duration: 0.4, ease: 'power2.in',
    });

    // All auras intensify
    for (const [, stone] of stoneEntries) {
      gsap.to(stone.aura.material.uniforms.uIntensity, {
        value: 0.8, duration: 0.6, ease: 'power2.in',
      });
    }

    // Fade labels immediately
    for (const label of Object.values(this.labels)) {
      label.style.transition = 'opacity 0.3s ease';
      label.style.opacity = '0';
    }

    // Energy streams intensify then fade
    for (const stream of this.energyStreams) {
      gsap.to(stream.material.uniforms.uIntensity, {
        value: 1.0, duration: 0.4, ease: 'power2.in',
      });
      gsap.to(stream.material.uniforms.uIntensity, {
        value: 0, duration: 0.6, delay: 0.8, ease: 'power2.out',
      });
    }

    // ============================================
    // Phase 2: Stones fly to logo formation (0.5s → 2.0s)
    // ============================================
    const mergeTimeline = gsap.timeline({ delay: 0.5 });

    for (const [id, stone] of stoneEntries) {
      const config = STONE_CONFIGS[id];
      const targetPos = logoCenter.clone().add(config.logoOffset);
      const targetRot = config.logoRotation;

      // Animate position to logo stack
      mergeTimeline.to(stone.mesh.position, {
        x: targetPos.x, y: targetPos.y, z: targetPos.z,
        duration: 1.2, ease: 'power2.inOut',
      }, 0);

      // Sync aura position
      mergeTimeline.to(stone.aura.position, {
        x: targetPos.x, y: targetPos.y, z: targetPos.z,
        duration: 1.2, ease: 'power2.inOut',
      }, 0);

      // Sync dissolve position
      mergeTimeline.to(stone.dissolve.position, {
        x: targetPos.x, y: targetPos.y, z: targetPos.z,
        duration: 1.2, ease: 'power2.inOut',
      }, 0);

      // Align rotation
      mergeTimeline.to(stone.mesh.rotation, {
        x: targetRot.x, y: targetRot.y, z: targetRot.z,
        duration: 1.2, ease: 'power2.inOut',
      }, 0);

      // All cracks start glowing during merge
      mergeTimeline.to(stone.mesh.material.uniforms.uHoverProgress, {
        value: 0.6, duration: 1.0, ease: 'power1.in',
      }, 0);
    }

    // Camera zooms in slightly
    mergeTimeline.to(this.camera.position, {
      z: 4.0, duration: 1.2, ease: 'power2.inOut',
    }, 0);

    // ============================================
    // Phase 3: Logo holds — dramatic bloom + crack pulse (2.0s → 2.8s)
    // ============================================
    const holdTimeline = gsap.timeline({ delay: 1.8 });

    // Bloom burst
    holdTimeline.to(this.bloomPass, {
      strength: 2.5, duration: 0.5, ease: 'power2.out',
    }, 0);
    holdTimeline.to(this.bloomPass, {
      strength: 1.5, duration: 0.4, delay: 0.5, ease: 'power2.in',
    }, 0);

    // All cracks blaze full
    for (const [, stone] of stoneEntries) {
      holdTimeline.to(stone.mesh.material.uniforms.uHoverProgress, {
        value: 1.0, duration: 0.4, ease: 'power3.out',
      }, 0);
    }

    // Auras pulse outward
    for (const [, stone] of stoneEntries) {
      holdTimeline.to(stone.aura.material.uniforms.uIntensity, {
        value: 1.0, duration: 0.3, ease: 'power2.out',
      }, 0);
    }

    // ============================================
    // Phase 4: Logo shatters — all stones dissolve into particles (2.8s → 5.0s)
    // ============================================
    const shatterDelay = 2.6; // seconds from start

    setTimeout(() => {
      this.merging = false;

      for (const [, stone] of stoneEntries) {
        const { mesh, aura, dissolve } = stone;

        // Show dissolve particles
        dissolve.visible = true;

        // Stone shader dissolves
        gsap.to(mesh.material.uniforms.uDissolveProgress, {
          value: 1.0, duration: 1.8, ease: 'power1.inOut',
        });

        // Dissolve particles burst outward
        gsap.to(dissolve.material.uniforms.uProgress, {
          value: 1.0, duration: 2.0, ease: 'power1.inOut',
        });

        // Forward pull — particles stream into depth
        gsap.to(dissolve.material.uniforms.uForwardPull, {
          value: 1.0, duration: 1.5, delay: 0.5, ease: 'power2.in',
        });

        // Aura fades
        gsap.to(aura.material.uniforms.uIntensity, {
          value: 0, duration: 1.2, delay: 0.5, ease: 'power2.out',
        });
      }

      // Bloom settles
      gsap.to(this.bloomPass, {
        strength: 0.8, duration: 1.5, delay: 0.5, ease: 'power2.out',
      });
    }, shatterDelay * 1000);

    // ============================================
    // Phase 5: Camera flight into World 2 (3.5s from start)
    // ============================================
    setTimeout(() => {
      this.inTransition = true;

      // Animate camera forward
      gsap.to(this.camera.position, {
        z: -10, duration: 3.0, ease: 'power2.inOut',
      });

      // Animate lookAt target deeper
      gsap.to(this.cameraLookTarget, {
        z: -15, duration: 3.0, ease: 'power2.inOut',
      });

      // Shift background color — stays black (galaxy will provide color)
      gsap.to(this.scene.background, {
        r: 0, g: 0, b: 0,
        duration: 3.0, ease: 'power2.inOut',
      });

      // Bloom surge during flight
      gsap.to(this.bloomPass, {
        strength: 1.4, duration: 1.2, ease: 'power2.out',
      });
      gsap.to(this.bloomPass, {
        strength: 0.6, duration: 1.5, delay: 1.5, ease: 'power2.in',
      });

      // Notify main.js to set up World 2
      if (this.onStoneClick) {
        this.onStoneClick({ id: stoneId });
      }
    }, 3500);
  }

  /**
   * Reset all stones to their initial state (called when returning from World 2)
   */
  resetStones() {
    this.dissolving = false;
    this.merging = false;
    this.inTransition = false;

    // Reset camera
    this.camera.position.set(0, 0, 5.5);
    this.cameraLookTarget.set(0, 0, 0);
    this.camera.lookAt(0, 0, 0);

    // Reset scene background to black
    this.scene.background.setRGB(0, 0, 0);

    // Reset bloom
    this.bloomPass.strength = 0.8;

    for (const [id, stone] of Object.entries(this.stones)) {
      const { mesh, aura, dissolve } = stone;

      // Reset uniforms
      mesh.material.uniforms.uHoverProgress.value = 0;
      mesh.material.uniforms.uDissolveProgress.value = 0;
      mesh.visible = true;

      aura.material.uniforms.uIntensity.value = 0;
      dissolve.material.uniforms.uProgress.value = 0;
      dissolve.material.uniforms.uForwardPull.value = 0;
      dissolve.visible = false;

      // Reset position
      const stoneIds = Object.keys(this.stones);
      const idx = stoneIds.indexOf(id);
      const spread = 1.8;
      const yOffset = 0.1;
      const positions = [
        new THREE.Vector3(-spread * 0.85, -spread * 0.25 + yOffset, 0),
        new THREE.Vector3(0, spread * 0.5 + yOffset, 0),
        new THREE.Vector3(spread * 0.85, -spread * 0.25 + yOffset, 0),
      ];
      stone.basePosition.copy(positions[idx]);
      mesh.position.copy(positions[idx]);
      aura.position.copy(positions[idx]);
      dissolve.position.copy(positions[idx]);

      // Reset rotation
      mesh.rotation.set(0, 0, 0);
    }

    // Reset energy streams
    for (const stream of this.energyStreams) {
      stream.material.uniforms.uIntensity.value = 0;
    }

    // Reset labels
    for (const label of Object.values(this.labels)) {
      label.style.opacity = '';
      label.classList.remove('visible', 'active');
    }
  }

  // =============================================
  //  SHARED SCENE CONTEXT
  // =============================================

  /** Expose scene context for World 2 to share */
  getSceneContext() {
    return {
      scene: this.scene,
      camera: this.camera,
      renderer: this.renderer,
      composer: this.composer,
      bloomPass: this.bloomPass,
    };
  }

  setWorld2Manager(manager) {
    this.world2Manager = manager;
  }

  removeWorld2Manager() {
    this.world2Manager = null;
  }

  /**
   * Animate camera back from World 2 to World 1 position.
   * Called by main.js when user clicks "back".
   */
  returnFromWorld2() {
    // Animate camera back
    gsap.to(this.camera.position, {
      z: 5.5, duration: 2.5, ease: 'power2.inOut',
    });

    gsap.to(this.cameraLookTarget, {
      z: 0, duration: 2.5, ease: 'power2.inOut',
    });

    // Shift background back to black
    gsap.to(this.scene.background, {
      r: 0, g: 0, b: 0,
      duration: 2.5, ease: 'power2.inOut',
    });

    // Restore bloom
    gsap.to(this.bloomPass, {
      strength: 0.8, duration: 2.0, ease: 'power2.inOut',
    });

    // After camera arrives, reset stones
    setTimeout(() => {
      this.inTransition = false;
      this.resetStones();
      this.removeWorld2Manager();
    }, 2700);
  }

  // =============================================
  //  HAND TRACKING
  // =============================================

  setHandCursor(cursor) {
    if (!cursor) return;
    // Convert normalized hand coordinates to NDC
    this._updateMouseNDC(cursor.x * window.innerWidth, cursor.y * window.innerHeight);

    if (cursor.isPinching) {
      const hit = this._hitTestStones();
      if (hit && !this.isDragging) {
        this.isDragging = true;
        this.draggedStone = hit.userData.stoneId;
        this.dragStartPos.set(cursor.x * window.innerWidth, cursor.y * window.innerHeight);
      } else if (this.isDragging) {
        this._moveDrag(cursor.x * window.innerWidth, cursor.y * window.innerHeight);
      }
    } else {
      if (this.isDragging) {
        const dx = cursor.x * window.innerWidth - this.dragStartPos.x;
        const dy = cursor.y * window.innerHeight - this.dragStartPos.y;
        if (Math.sqrt(dx * dx + dy * dy) < 15) {
          this._triggerDissolve(this.draggedStone);
        }
        this.isDragging = false;
        this.draggedStone = null;
      }
      const hit = this._hitTestStones();
      this.hoveredStone = hit?.userData?.stoneId || null;
    }
  }

  // =============================================
  //  ANIMATION LOOP
  // =============================================

  _animate() {
    if (!this.running) return;

    const dt = Math.min(this.clock.getDelta(), 0.1);
    const time = this.clock.elapsedTime;

    // ---- Update stones ----
    for (const [id, stone] of Object.entries(this.stones)) {
      const { mesh, aura, dissolve } = stone;
      const ud = mesh.userData;

      // Time uniform
      mesh.material.uniforms.uTime.value = time;
      aura.material.uniforms.uTime.value = time;
      dissolve.material.uniforms.uTime.value = time;

      // Hover progress (smooth transition)
      const isHovered = this.hoveredStone === id;
      const targetHover = isHovered ? 1 : 0;
      ud.hoverProgress += (targetHover - ud.hoverProgress) * Math.min(dt * 5, 1);
      mesh.material.uniforms.uHoverProgress.value = ud.hoverProgress;

      // Aura intensity follows hover (only if not dissolving)
      if (!this.dissolving) {
        aura.material.uniforms.uIntensity.value +=
          (ud.hoverProgress * 0.7 - aura.material.uniforms.uIntensity.value) * Math.min(dt * 4, 1);
      }

      // Floating drift (Lissajous) — disabled during merge/dissolve
      if (!this.merging && !this.dissolving && (!this.isDragging || this.draggedStone !== id)) {
        const driftX = Math.sin(time * 0.25 + ud.driftPhaseX) * 0.08
          + Math.sin(time * 0.6 + ud.driftPhaseX * 2) * 0.03;
        const driftY = Math.sin(time * 0.35 + ud.driftPhaseY) * 0.06
          + Math.cos(time * 0.15 + ud.driftPhaseY * 1.5) * 0.04;

        mesh.position.x = stone.basePosition.x + driftX;
        mesh.position.y = stone.basePosition.y + driftY;

        aura.position.copy(mesh.position);
        dissolve.position.copy(mesh.position);
      }

      // Gentle rotation — disabled during merge
      if (!this.merging) {
        mesh.rotation.y += ud.rotationSpeed * dt * (isHovered ? 3 : 1);
        mesh.rotation.x = Math.sin(time * 0.2 + ud.driftPhaseX) * 0.05;
      }
    }

    // ---- Update energy streams ----
    for (const stream of this.energyStreams) {
      const { stoneA, stoneB } = stream.userData;
      stream.material.uniforms.uTime.value = time;
      stream.material.uniforms.uStartPos.value.copy(this.stones[stoneA].mesh.position);
      stream.material.uniforms.uEndPos.value.copy(this.stones[stoneB].mesh.position);

      // Intensity based on hover of connected stones
      if (!this.dissolving) {
        const hoverA = this.stones[stoneA].mesh.userData.hoverProgress;
        const hoverB = this.stones[stoneB].mesh.userData.hoverProgress;
        const targetIntensity = Math.max(hoverA, hoverB) * 0.8 + 0.05;
        stream.material.uniforms.uIntensity.value +=
          (targetIntensity - stream.material.uniforms.uIntensity.value) * Math.min(dt * 3, 1);
      }
    }

    // ---- Update background ----
    this.bgParticles.material.uniforms.uTime.value = time;

    // ---- Camera lookAt (animated during transition) ----
    this.camera.lookAt(this.cameraLookTarget);

    // ---- Update World 2 if active ----
    if (this.world2Manager) {
      this.world2Manager.update(time, dt);
    }

    // ---- Update labels ----
    this._updateLabels();

    // ---- Render with post-processing ----
    this.composer.render();

    requestAnimationFrame(() => this._animate());
  }

  _updateLabels() {
    for (const [id, stone] of Object.entries(this.stones)) {
      const label = this.labels[id];
      if (!label) continue;

      // Project 3D position to screen
      const pos = stone.mesh.position.clone();
      pos.y -= stone.config.radius * 1.4;
      pos.project(this.camera);

      const x = (pos.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-pos.y * 0.5 + 0.5) * window.innerHeight;

      label.style.left = `${x}px`;
      label.style.top = `${y}px`;
      label.style.transform = 'translateX(-50%)';

      const isHovered = this.hoveredStone === id;
      const hp = stone.mesh.userData.hoverProgress;
      label.classList.toggle('visible', isHovered || hp > 0.1);
      label.classList.toggle('active', isHovered);
    }
  }

  // =============================================
  //  LIFECYCLE
  // =============================================

  _onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloomPass.resolution.set(w, h);
  }

  restart() {
    this.running = true;
    this.resetStones();
    this.clock.start();
    this._animate();
  }

  destroy() {
    this.running = false;
    // Full cleanup — only call on page unload, not during transition
    if (this.world2Manager) {
      this.world2Manager.destroy();
      this.world2Manager = null;
    }
  }
}
