/**
 * SceneManager3D — Three.js World 2 scene
 * 
 * Design concept:
 * - Foreground stone SHATTERS into fragments with inner light radiating outward
 * - Light-heavy atmosphere (contrast: World 1 = quiet stones → World 2 = radiant light)
 * - Midground stones float in upper-left quadrant with depth
 * - Content displayed via DOM overlay on right 40%
 * - Light burst transition from World 1
 */
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import gsap from 'gsap';
import { CONTENT } from '../data/ContentData.js';

export class SceneManager3D {
    constructor(container, onBackToWorld1) {
        this.container = container;
        this.onBackToWorld1 = onBackToWorld1;
        this.running = false;
        this.activeStoneId = null;
        this.stoneIds = ['company', 'services', 'works'];
        this.stoneMeshes = {};
        this.fragments = []; // shattered pieces of foreground stone
        this.lightOrbs = []; // floating light orbs

        // Midground stone positions — upper-left quadrant, with depth
        this.midgroundPositions = [
            new THREE.Vector3(-2.8, 1.5, -5),
            new THREE.Vector3(-1.5, -1.8, -6),
        ];

        // Colors
        this.colors = {
            bg: 0x050810,
            accent: 0xa8c8ff,
            emission: 0x8ab4ff,
            warmLight: 0xd4e8ff,
            coreLight: 0xffffff,
        };

        this.stoneLabelObjects = [];
        this.contentOverlay = null;

        this._initScene();
        this._initLights();
        this._initStones();
        this._initParticles();
        this._initLightOrbs();
        this._initCSS2DRenderer();
        this._initContentOverlay();
        this._initTransitionOverlay();
        this._initBackButton();
        this._bindEvents();
    }

    // ====== INIT ======

    _initScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(this.colors.bg);
        this.scene.fog = new THREE.FogExp2(this.colors.bg, 0.025);

        this.camera = new THREE.PerspectiveCamera(
            60, window.innerWidth / window.innerHeight, 0.1, 100
        );
        this.camera.position.set(0, 0, 5);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.4;
        this.container.appendChild(this.renderer.domElement);

        Object.assign(this.renderer.domElement.style, {
            position: 'fixed', top: '0', left: '0', zIndex: '1',
        });

        this.clock = new THREE.Clock();
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.hoveredMesh = null;
    }

    _initLights() {
        // Ambient — slightly brighter than before
        this.scene.add(new THREE.AmbientLight(0x203050, 1.0));

        // Key light — warm front
        this.keyLight = new THREE.PointLight(this.colors.warmLight, 2.0, 25);
        this.keyLight.position.set(1, 2, 5);
        this.scene.add(this.keyLight);

        // Fill from left
        const fill = new THREE.PointLight(0x6090d0, 1.2, 20);
        fill.position.set(-4, 1, 3);
        this.scene.add(fill);

        // Rim light from behind
        const rim = new THREE.PointLight(0x8ab4ff, 1.0, 20);
        rim.position.set(0, -1, -6);
        this.scene.add(rim);

        // Core light (emanating from shattered stone center) — starts dim
        this.coreLight = new THREE.PointLight(this.colors.coreLight, 0, 8);
        this.coreLight.position.set(-1.5, 0, 0.5);
        this.scene.add(this.coreLight);

        // Volumetric glow sprite at core
        const glowTex = this._createGlowTexture();
        this.coreGlow = new THREE.Sprite(
            new THREE.SpriteMaterial({
                map: glowTex,
                transparent: true,
                opacity: 0,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                color: 0xc0d8ff,
            })
        );
        this.coreGlow.scale.set(4, 4, 1);
        this.coreGlow.position.copy(this.coreLight.position);
        this.scene.add(this.coreGlow);
    }

    _createGlowTexture() {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(0.2, 'rgba(200, 220, 255, 0.6)');
        grad.addColorStop(0.5, 'rgba(150, 190, 255, 0.2)');
        grad.addColorStop(1, 'rgba(100, 150, 255, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);

        const tex = new THREE.CanvasTexture(canvas);
        return tex;
    }

    _initStones() {
        const configs = {
            company: { size: 0.55, detail: 1, color: 0x2a3555 },
            services: { size: 0.65, detail: 1, color: 0x2d3860 },
            works: { size: 0.50, detail: 1, color: 0x283050 },
        };

        for (const id of this.stoneIds) {
            const c = configs[id];
            const geo = new THREE.IcosahedronGeometry(c.size, c.detail);

            // Displace vertices for rock feel
            const pos = geo.attributes.position;
            for (let i = 0; i < pos.count; i++) {
                const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
                const noise = 1 + (Math.sin(x * 5) * Math.cos(y * 3) * Math.sin(z * 7)) * 0.15;
                pos.setXYZ(i, x * noise, y * noise, z * noise);
            }
            geo.computeVertexNormals();

            const mat = new THREE.MeshStandardMaterial({
                color: c.color,
                roughness: 0.6,
                metalness: 0.25,
                emissive: this.colors.emission,
                emissiveIntensity: 0.05,
            });

            const mesh = new THREE.Mesh(geo, mat);
            mesh.userData = { stoneId: id, isStone: true, baseGeo: geo };
            mesh.position.set(0, 0, -20);
            mesh.visible = false;

            this.scene.add(mesh);
            this.stoneMeshes[id] = mesh;
        }
    }

    /**
     * Create fragments from a stone mesh (shattering effect)
     */
    _createFragments(stoneId) {
        this._clearFragments();

        const mesh = this.stoneMeshes[stoneId];
        const geo = mesh.userData.baseGeo;
        const positions = geo.attributes.position;
        const indices = geo.index ? geo.index.array : null;

        const center = new THREE.Vector3(-1.5, 0, 0.5);
        const numFragments = indices ? indices.length / 3 : positions.count / 3;

        // Create individual triangle fragments
        for (let f = 0; f < numFragments; f++) {
            let i0, i1, i2;
            if (indices) {
                i0 = indices[f * 3];
                i1 = indices[f * 3 + 1];
                i2 = indices[f * 3 + 2];
            } else {
                i0 = f * 3;
                i1 = f * 3 + 1;
                i2 = f * 3 + 2;
            }

            const v0 = new THREE.Vector3(positions.getX(i0), positions.getY(i0), positions.getZ(i0));
            const v1 = new THREE.Vector3(positions.getX(i1), positions.getY(i1), positions.getZ(i1));
            const v2 = new THREE.Vector3(positions.getX(i2), positions.getY(i2), positions.getZ(i2));

            // Triangle centroid
            const centroid = new THREE.Vector3().addVectors(v0, v1).add(v2).divideScalar(3);

            // Fragment geometry (triangle relative to centroid)
            const fragGeo = new THREE.BufferGeometry();
            const verts = new Float32Array([
                v0.x - centroid.x, v0.y - centroid.y, v0.z - centroid.z,
                v1.x - centroid.x, v1.y - centroid.y, v1.z - centroid.z,
                v2.x - centroid.x, v2.y - centroid.y, v2.z - centroid.z,
            ]);
            fragGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
            fragGeo.computeVertexNormals();

            const fragMat = new THREE.MeshStandardMaterial({
                color: mesh.material.color,
                roughness: 0.5,
                metalness: 0.3,
                emissive: this.colors.emission,
                emissiveIntensity: 0.1,
                side: THREE.DoubleSide,
            });

            const fragMesh = new THREE.Mesh(fragGeo, fragMat);
            fragMesh.position.copy(center).add(centroid);

            // Store drift direction (outward from center)
            const dir = centroid.clone().normalize();
            fragMesh.userData = {
                direction: dir,
                speed: 0.3 + Math.random() * 0.5,
                rotSpeed: new THREE.Vector3(
                    (Math.random() - 0.5) * 2,
                    (Math.random() - 0.5) * 2,
                    (Math.random() - 0.5) * 2
                ),
                basePos: fragMesh.position.clone(),
                driftRadius: 0.3 + Math.random() * 0.8,
                phase: Math.random() * Math.PI * 2,
            };

            this.scene.add(fragMesh);
            this.fragments.push(fragMesh);
        }
    }

    _clearFragments() {
        for (const frag of this.fragments) {
            this.scene.remove(frag);
            frag.geometry.dispose();
            frag.material.dispose();
        }
        this.fragments = [];
    }

    /**
     * Animate fragments outward from center (shatter + float)
     */
    _shatterAnimation() {
        for (const frag of this.fragments) {
            const d = frag.userData;
            const target = d.basePos.clone().add(
                d.direction.clone().multiplyScalar(d.driftRadius)
            );

            gsap.to(frag.position, {
                x: target.x,
                y: target.y,
                z: target.z,
                duration: 1.5 + Math.random() * 0.8,
                ease: 'power2.out',
                delay: Math.random() * 0.3,
            });

            gsap.to(frag.material, {
                emissiveIntensity: 0.3 + Math.random() * 0.3,
                duration: 1.5,
                delay: 0.5,
            });
        }

        // Core light burst
        gsap.to(this.coreLight, {
            intensity: 3.0,
            duration: 1.8,
            ease: 'power2.out',
            delay: 0.3,
        });

        gsap.to(this.coreGlow.material, {
            opacity: 0.6,
            duration: 1.5,
            ease: 'power2.out',
            delay: 0.3,
        });
    }

    _initParticles() {
        const count = 500;
        const positions = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 25;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 18;
            positions[i * 3 + 2] = -3 - Math.random() * 18;
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const mat = new THREE.PointsMaterial({
            color: this.colors.accent, size: 0.05, transparent: true,
            opacity: 0.5, sizeAttenuation: true,
            blending: THREE.AdditiveBlending, depthWrite: false,
        });

        this.particles = new THREE.Points(geo, mat);
        this.scene.add(this.particles);
    }

    /**
     * Floating light orbs that add luminosity
     */
    _initLightOrbs() {
        const orbGeo = new THREE.SphereGeometry(0.06, 8, 8);

        for (let i = 0; i < 20; i++) {
            const orbMat = new THREE.MeshBasicMaterial({
                color: this.colors.warmLight,
                transparent: true,
                opacity: 0,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
            });

            const orb = new THREE.Mesh(orbGeo, orbMat);
            orb.position.set(
                (Math.random() - 0.6) * 8,  // bias left
                (Math.random() - 0.5) * 6,
                (Math.random() - 0.5) * 4 - 2
            );
            orb.userData = {
                basePos: orb.position.clone(),
                speed: 0.2 + Math.random() * 0.4,
                phase: Math.random() * Math.PI * 2,
                amplitude: 0.3 + Math.random() * 0.5,
            };

            this.scene.add(orb);
            this.lightOrbs.push(orb);
        }
    }

    _initCSS2DRenderer() {
        this.cssRenderer = new CSS2DRenderer();
        this.cssRenderer.setSize(window.innerWidth, window.innerHeight);
        Object.assign(this.cssRenderer.domElement.style, {
            position: 'fixed', top: '0', left: '0',
            pointerEvents: 'none', zIndex: '10',
        });
        this.container.appendChild(this.cssRenderer.domElement);
    }

    _initContentOverlay() {
        this.contentOverlay = document.createElement('div');
        this.contentOverlay.id = 'w2-content-overlay';
        Object.assign(this.contentOverlay.style, {
            position: 'fixed', top: '0', right: '0',
            width: '40%', maxWidth: '480px', height: '100%',
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
            padding: '3rem 2.5rem', zIndex: '50', pointerEvents: 'none',
            boxSizing: 'border-box', overflow: 'hidden', opacity: '0',
        });
        this.container.appendChild(this.contentOverlay);
    }

    /**
     * Full-screen light burst overlay for World 1 → 2 transition
     */
    _initTransitionOverlay() {
        this.transitionOverlay = document.createElement('div');
        Object.assign(this.transitionOverlay.style, {
            position: 'fixed', top: '0', left: '0',
            width: '100%', height: '100%',
            background: 'radial-gradient(circle, rgba(200,220,255,0.8) 0%, rgba(5,8,16,0) 70%)',
            opacity: '0', zIndex: '100', pointerEvents: 'none',
            transition: 'none',
        });
        this.container.appendChild(this.transitionOverlay);
    }

    _initBackButton() {
        this.backBtn = document.createElement('button');
        this.backBtn.className = 'back-btn world2-back';
        this.backBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
      <span>戻る</span>
    `;
        Object.assign(this.backBtn.style, { zIndex: '200', pointerEvents: 'all' });
        this.backBtn.addEventListener('click', () => {
            if (this.onBackToWorld1) this.onBackToWorld1();
        });
        this.container.appendChild(this.backBtn);
    }

    _bindEvents() {
        window.addEventListener('resize', () => this._onResize());
        this.renderer.domElement.addEventListener('mousemove', (e) => this._onMouseMove(e));
        this.renderer.domElement.addEventListener('click', (e) => this._onClick(e));
    }

    // ====== ENTER / EXIT ======

    enter(stoneId) {
        this.activeStoneId = stoneId;
        this.running = true;
        this.container.style.display = 'block';

        // Light burst transition
        this.transitionOverlay.style.opacity = '1';
        gsap.to(this.transitionOverlay.style, {
            opacity: 0,
            duration: 2.0,
            delay: 0.5,
            ease: 'power2.out',
        });

        const otherIds = this.stoneIds.filter(id => id !== stoneId);

        // Hide the foreground stone mesh (it will be replaced by fragments)
        const mainMesh = this.stoneMeshes[stoneId];
        mainMesh.visible = false;

        // Create shattered fragments at center-left position
        this._createFragments(stoneId);

        // Initially keep fragments clustered, then shatter
        for (const frag of this.fragments) {
            frag.scale.set(0.5, 0.5, 0.5);
            gsap.to(frag.scale, {
                x: 1, y: 1, z: 1,
                duration: 1.2, ease: 'power2.out', delay: 0.3,
            });
        }

        // Trigger shatter after brief moment
        setTimeout(() => this._shatterAnimation(), 600);

        // Midground stones — upper-left quadrant with depth
        otherIds.forEach((id, i) => {
            const mesh = this.stoneMeshes[id];
            mesh.visible = true;
            mesh.position.set(this.midgroundPositions[i].x * 1.5, this.midgroundPositions[i].y, -20);
            mesh.scale.set(0.5, 0.5, 0.5);

            gsap.to(mesh.position, {
                x: this.midgroundPositions[i].x,
                y: this.midgroundPositions[i].y,
                z: this.midgroundPositions[i].z,
                duration: 2.2, ease: 'power2.out', delay: 0.8 + i * 0.3,
            });
            gsap.to(mesh.scale, {
                x: 0.6, y: 0.6, z: 0.6,
                duration: 2.2, ease: 'power2.out', delay: 0.8 + i * 0.3,
            });
        });

        // Camera entrance
        this.camera.position.set(0, 0, 12);
        gsap.to(this.camera.position, { z: 5, duration: 2, ease: 'power2.out' });

        // Fade in light orbs
        this.lightOrbs.forEach((orb, i) => {
            gsap.to(orb.material, {
                opacity: 0.3 + Math.random() * 0.4,
                duration: 2,
                delay: 0.5 + i * 0.05,
            });
        });

        // Show content after settling
        setTimeout(() => {
            this._showContent(stoneId);
            this._showStoneLabels(stoneId);
        }, 1500);

        this._animate();
    }

    exit() {
        this.running = false;
        this._clearContent();
        this._clearStoneLabels();

        // Collapse fragments back to center
        for (const frag of this.fragments) {
            gsap.to(frag.position, {
                x: -1.5, y: 0, z: 0.5,
                duration: 0.6, ease: 'power2.in',
            });
            gsap.to(frag.scale, {
                x: 0, y: 0, z: 0,
                duration: 0.6, ease: 'power2.in',
            });
        }

        // Fade core light
        gsap.to(this.coreLight, { intensity: 0, duration: 0.6 });
        gsap.to(this.coreGlow.material, { opacity: 0, duration: 0.6 });

        // Fade light orbs
        this.lightOrbs.forEach(orb => {
            gsap.to(orb.material, { opacity: 0, duration: 0.5 });
        });

        // Animate midground stones out
        for (const id of this.stoneIds) {
            const mesh = this.stoneMeshes[id];
            gsap.to(mesh.position, { z: -20, duration: 0.8, ease: 'power2.in' });
            gsap.to(mesh.scale, {
                x: 0.2, y: 0.2, z: 0.2, duration: 0.8, ease: 'power2.in',
                onComplete: () => { mesh.visible = false; },
            });
        }

        gsap.to(this.camera.position, {
            z: 12, duration: 0.8, ease: 'power2.in',
            onComplete: () => {
                this._clearFragments();
                this.container.style.display = 'none';
            },
        });
    }

    switchStone(newStoneId) {
        if (newStoneId === this.activeStoneId) return;
        const oldId = this.activeStoneId;
        this.activeStoneId = newStoneId;

        this._clearContent();
        this._clearStoneLabels();

        // Collapse old fragments
        for (const frag of this.fragments) {
            gsap.to(frag.position, {
                x: -1.5, y: 0, z: 0.5,
                duration: 0.5, ease: 'power2.in',
            });
            gsap.to(frag.scale, {
                x: 0, y: 0, z: 0,
                duration: 0.5, ease: 'power2.in',
            });
        }

        // Fade core light momentarily
        gsap.to(this.coreLight, { intensity: 0.5, duration: 0.3 });
        gsap.to(this.coreGlow.material, { opacity: 0.1, duration: 0.3 });

        // Move old stone back to midground
        const oldMesh = this.stoneMeshes[oldId];
        oldMesh.visible = true;
        oldMesh.position.set(-1.5, 0, 0.5);
        oldMesh.scale.set(0.8, 0.8, 0.8);

        const otherIds = this.stoneIds.filter(id => id !== newStoneId);
        const midIdx = otherIds.indexOf(oldId);
        const midPos = this.midgroundPositions[midIdx >= 0 ? midIdx : 0];

        gsap.to(oldMesh.position, {
            x: midPos.x, y: midPos.y, z: midPos.z,
            duration: 1.2, ease: 'power2.inOut',
        });
        gsap.to(oldMesh.scale, {
            x: 0.6, y: 0.6, z: 0.6, duration: 1.2, ease: 'power2.inOut',
        });
        gsap.to(oldMesh.material, { emissiveIntensity: 0.05, duration: 1 });

        // Hide new stone mesh and create fragments
        const newMesh = this.stoneMeshes[newStoneId];
        newMesh.visible = false;

        // Reposition third stone
        const thirdId = otherIds.find(id => id !== oldId);
        if (thirdId) {
            const thirdMesh = this.stoneMeshes[thirdId];
            gsap.to(thirdMesh.position, {
                x: this.midgroundPositions[1].x,
                y: this.midgroundPositions[1].y,
                z: this.midgroundPositions[1].z,
                duration: 1.2, ease: 'power2.inOut',
            });
        }

        // After old fragments collapse, create new ones
        setTimeout(() => {
            this._clearFragments();
            this._createFragments(newStoneId);
            this._shatterAnimation();
        }, 600);

        // Show new content
        setTimeout(() => {
            this._showContent(newStoneId);
            this._showStoneLabels(newStoneId);
        }, 1200);
    }

    // ====== CONTENT (DOM Overlay) ======

    _showContent(stoneId) {
        this._clearContent();
        const data = CONTENT[stoneId];
        if (!data) return;

        this.contentOverlay.innerHTML = `
      <div class="w2-content-title" style="animation: w2FadeIn 0.8s ease forwards;">
        <div class="w2-title">${data.title}</div>
        <div class="w2-subtitle">${data.subtitle}</div>
      </div>
      ${data.sections.map((s, i) => `
        <div class="w2-section-card" style="animation-delay: ${0.3 + i * 0.15}s;">
          <div class="w2-section-heading">${s.heading}</div>
          <div class="w2-section-body">${s.body.replace(/\n/g, '<br>')}</div>
        </div>
      `).join('')}
    `;
        this.contentOverlay.style.opacity = '1';
    }

    _clearContent() {
        if (this.contentOverlay) {
            this.contentOverlay.innerHTML = '';
            this.contentOverlay.style.opacity = '0';
        }
    }

    // ====== STONE LABELS (CSS2DRenderer) ======

    _showStoneLabels(activeId) {
        this._clearStoneLabels();
        const otherIds = this.stoneIds.filter(id => id !== activeId);

        otherIds.forEach((id) => {
            const midData = CONTENT[id];
            const midMesh = this.stoneMeshes[id];
            if (!midData || !midMesh) return;

            const el = document.createElement('div');
            el.className = 'w2-stone-label';
            el.textContent = midData.title;
            el.style.pointerEvents = 'all';
            el.style.cursor = 'pointer';
            el.addEventListener('click', () => this.switchStone(id));

            const label = new CSS2DObject(el);
            label.position.set(0, -0.7, 0);
            midMesh.add(label);
            this.stoneLabelObjects.push(label);
        });
    }

    _clearStoneLabels() {
        for (const label of this.stoneLabelObjects) {
            if (label.parent) label.parent.remove(label);
            if (label.element?.parentNode) label.element.parentNode.removeChild(label.element);
        }
        this.stoneLabelObjects = [];
    }

    // ====== INTERACTION ======

    _onResize() {
        if (!this.running) return;
        const w = window.innerWidth, h = window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
        this.cssRenderer.setSize(w, h);
    }

    _onMouseMove(e) {
        this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    }

    _onClick(e) {
        this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const midgroundMeshes = this.stoneIds
            .filter(id => id !== this.activeStoneId)
            .map(id => this.stoneMeshes[id]).filter(m => m && m.visible);

        const hits = this.raycaster.intersectObjects(midgroundMeshes);
        if (hits.length > 0) {
            this.switchStone(hits[0].object.userData.stoneId);
        }
    }

    // ====== ANIMATION LOOP ======

    _animate() {
        if (!this.running) return;
        const time = this.clock.getElapsedTime();

        // Rotate + float midground stones
        for (const id of this.stoneIds) {
            const mesh = this.stoneMeshes[id];
            if (!mesh.visible) continue;
            mesh.rotation.y += 0.003;
            mesh.rotation.x = Math.sin(time * 0.3 + this.stoneIds.indexOf(id)) * 0.1;
            mesh.position.y += Math.sin(time * 0.4 + this.stoneIds.indexOf(id) * 2) * 0.001;
        }

        // Fragment gentle drifting
        for (const frag of this.fragments) {
            const d = frag.userData;
            frag.rotation.x += d.rotSpeed.x * 0.005;
            frag.rotation.y += d.rotSpeed.y * 0.005;
            frag.rotation.z += d.rotSpeed.z * 0.003;

            // Gentle float around drift position
            frag.position.y += Math.sin(time * d.speed + d.phase) * 0.001;
            frag.position.x += Math.cos(time * d.speed * 0.7 + d.phase) * 0.0005;

            // Emissive pulse
            frag.material.emissiveIntensity =
                0.15 + Math.sin(time * 1.5 + d.phase) * 0.15;
        }

        // Core light pulsing
        if (this.coreLight.intensity > 0) {
            this.coreLight.intensity =
                this.coreLight.intensity * 0.99 +
                (2.0 + Math.sin(time * 1.2) * 1.0) * 0.01;

            this.coreGlow.material.opacity =
                0.3 + Math.sin(time * 0.8) * 0.15;

            this.coreGlow.scale.setScalar(3.5 + Math.sin(time * 0.5) * 0.5);
        }

        // Light orbs float
        for (const orb of this.lightOrbs) {
            const d = orb.userData;
            orb.position.x = d.basePos.x + Math.sin(time * d.speed + d.phase) * d.amplitude;
            orb.position.y = d.basePos.y + Math.cos(time * d.speed * 0.8 + d.phase) * d.amplitude * 0.7;
            orb.position.z = d.basePos.z + Math.sin(time * d.speed * 0.5) * 0.3;
        }

        // Hover detection for midground stones
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const midgroundMeshes = this.stoneIds
            .filter(id => id !== this.activeStoneId)
            .map(id => this.stoneMeshes[id]).filter(m => m && m.visible);

        const hits = this.raycaster.intersectObjects(midgroundMeshes);
        const newHovered = hits.length > 0 ? hits[0].object : null;

        if (newHovered !== this.hoveredMesh) {
            if (this.hoveredMesh) {
                gsap.to(this.hoveredMesh.material, { emissiveIntensity: 0.05, duration: 0.3 });
                gsap.to(this.hoveredMesh.scale, { x: 0.6, y: 0.6, z: 0.6, duration: 0.3 });
            }
            if (newHovered) {
                gsap.to(newHovered.material, { emissiveIntensity: 0.3, duration: 0.3 });
                gsap.to(newHovered.scale, { x: 0.7, y: 0.7, z: 0.7, duration: 0.3 });
                this.renderer.domElement.style.cursor = 'pointer';
            } else {
                this.renderer.domElement.style.cursor = 'default';
            }
            this.hoveredMesh = newHovered;
        }

        // Particle drift
        const pp = this.particles.geometry.attributes.position;
        for (let i = 0; i < pp.count; i++) {
            pp.setY(i, pp.getY(i) + Math.sin(time * 0.2 + i * 0.1) * 0.002);
            pp.setX(i, pp.getX(i) + Math.cos(time * 0.15 + i * 0.05) * 0.001);
        }
        pp.needsUpdate = true;

        this.renderer.render(this.scene, this.camera);
        this.cssRenderer.render(this.scene, this.camera);
        requestAnimationFrame(() => this._animate());
    }

    // ====== CLEANUP ======

    destroy() {
        this.running = false;
        this._clearContent();
        this._clearStoneLabels();
        this._clearFragments();

        for (const el of [
            this.renderer?.domElement, this.cssRenderer?.domElement,
            this.backBtn, this.contentOverlay, this.transitionOverlay
        ]) {
            if (el?.parentNode) el.parentNode.removeChild(el);
        }
        this.renderer?.dispose();
    }
}
