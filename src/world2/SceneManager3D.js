/**
 * SceneManager3D — World 2: Scroll Into The Vortex
 *
 * The cosmic vortex fills the screen. As the user scrolls down,
 * the camera dives deeper INTO the vortex center (the black hole).
 * Three content sections emerge from the cosmic depth:
 *   1. サービス (Services)
 *   2. 会社紹介 (Company)
 *   3. 開発事例 (Works)
 *
 * Each section fades in with a cinematic reveal as the user scrolls
 * through the vortex, giving the feeling of traveling through space
 * and discovering worlds within.
 *
 * Uses shared renderer architecture from World 1.
 */
import * as THREE from 'three';
import gsap from 'gsap';
import { CONTENT } from '../data/ContentData.js';
import { createBlackHole } from './BlackHole.js';

/** Z-offset for World 2 objects in the shared scene */
const WORLD2_Z = -15;

/** Scroll depth stages: camera z positions relative to WORLD2_Z */
const SCROLL_STAGES = [
    { z: 0, label: 'vortex' },          // initial: vortex view
    { z: -8, label: 'services' },        // first content
    { z: -18, label: 'company' },        // second content
    { z: -28, label: 'works' },          // third content
];

const TOTAL_SCROLL_DEPTH = 3000; // pixels of virtual scroll

export class SceneManager3D {
    constructor(container, sceneContext, onBackToWorld1) {
        this.container = container;
        this.sharedScene = sceneContext.scene;
        this.camera = sceneContext.camera;
        this.renderer = sceneContext.renderer;
        this.composer = sceneContext.composer;
        this.bloomPass = sceneContext.bloomPass;
        this.onBackToWorld1 = onBackToWorld1;
        this.running = false;
        this.activeStoneId = null;

        // Scroll state
        this.scrollProgress = 0;  // 0..1
        this.targetScroll = 0;
        this.currentScroll = 0;
        this.scrollEnabled = false;

        // Camera base position (set during enter())
        this.cameraBaseZ = 0;

        // Particle group
        this.particleGroup = new THREE.Group();
        this.particleGroup.position.z = WORLD2_Z;
        this.particleGroup.visible = false;
        this.sharedScene.add(this.particleGroup);

        // Content sections (DOM)
        this.sections = [];
        this.sectionEls = [];

        this._initBlackHole();
        this._initContentSections();
        this._initBackButton();
        this._bindScroll();
    }

    // ====== INIT ======

    _initBlackHole() {
        this.blackHole = createBlackHole();
        this.blackHole.position.set(0, 0, -3);
        this.particleGroup.add(this.blackHole);
    }

    _initContentSections() {
        // Create the scroll content wrapper
        this.contentWrapper = document.createElement('div');
        this.contentWrapper.id = 'vortex-content-wrapper';
        Object.assign(this.contentWrapper.style, {
            position: 'fixed',
            top: '0', left: '0',
            width: '100%', height: '100%',
            zIndex: '90',
            pointerEvents: 'none',
            overflow: 'hidden',
        });
        this.container.appendChild(this.contentWrapper);

        // Three content pages that emerge from the vortex
        const pageConfigs = [
            { id: 'services', start: 0.12, end: 0.38 },
            { id: 'company',  start: 0.40, end: 0.66 },
            { id: 'works',    start: 0.68, end: 0.96 },
        ];

        for (const cfg of pageConfigs) {
            const data = CONTENT[cfg.id];
            if (!data) continue;

            const section = document.createElement('div');
            section.className = 'vortex-section';
            section.dataset.pageId = cfg.id;
            section.innerHTML = `
                <div class="vortex-section-inner">
                    <div class="vortex-section-line"></div>
                    <h2 class="vortex-section-title">${data.title}</h2>
                    <p class="vortex-section-subtitle">${data.subtitle}</p>
                    <div class="vortex-section-cards">
                        ${data.sections.map((s, i) => `
                            <div class="vortex-card" style="--card-delay: ${i}">
                                <div class="vortex-card-heading">${s.heading}</div>
                                <div class="vortex-card-body">${s.body.replace(/\n/g, '<br>')}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
            this.contentWrapper.appendChild(section);
            this.sectionEls.push(section);
            this.sections.push({ el: section, ...cfg, revealed: false });
        }
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

    _bindScroll() {
        // Scroll indicator
        this.scrollIndicator = document.createElement('div');
        this.scrollIndicator.className = 'vortex-scroll-indicator';
        this.scrollIndicator.innerHTML = `
            <div class="scroll-arrow"></div>
            <span>Scroll to explore</span>
        `;
        this.container.appendChild(this.scrollIndicator);

        this._onWheel = (e) => {
            if (!this.running || !this.scrollEnabled) return;
            e.preventDefault();

            const delta = e.deltaY;
            const step = Math.max(-0.045, Math.min(0.045, delta / TOTAL_SCROLL_DEPTH));
            this.targetScroll += step;
            this.targetScroll = Math.max(0, Math.min(1, this.targetScroll));
        };

        // Touch support
        this._touchStartY = 0;
        this._onTouchStart = (e) => {
            if (!this.running || !this.scrollEnabled) return;
            this._touchStartY = e.touches[0].clientY;
        };
        this._onTouchMove = (e) => {
            if (!this.running || !this.scrollEnabled) return;
            e.preventDefault();
            const dy = this._touchStartY - e.touches[0].clientY;
            this._touchStartY = e.touches[0].clientY;
            const step = Math.max(-0.06, Math.min(0.06, dy / (TOTAL_SCROLL_DEPTH * 0.32)));
            this.targetScroll += step;
            this.targetScroll = Math.max(0, Math.min(1, this.targetScroll));
        };

        window.addEventListener('wheel', this._onWheel, { passive: false });
        window.addEventListener('touchstart', this._onTouchStart, { passive: true });
        window.addEventListener('touchmove', this._onTouchMove, { passive: false });
    }

    // ====== ENTER / EXIT ======

    enter(stoneId) {
        this.activeStoneId = stoneId;
        this.running = true;
        this.scrollProgress = 0;
        this.targetScroll = 0;
        this.currentScroll = 0;

        // Record the camera's z when we enter (set by World 1 flight)
        this.cameraBaseZ = this.camera.position.z;

        this.particleGroup.visible = true;

        // Reset sections
        for (const s of this.sections) {
            s.revealed = false;
            s.el.classList.remove('revealed');
            s.el.style.opacity = '0';
            s.el.style.transform = 'translateY(24px)';
        }

        // Fade in black hole
        gsap.to(this.blackHole.material.uniforms.uOpacity, {
            value: 1.0, duration: 2.5, delay: 0.3, ease: 'power2.out',
            onComplete: () => {
                this.scrollEnabled = true;
                this.scrollIndicator.classList.add('visible');
            },
        });

        // Show container
        setTimeout(() => {
            this.container.style.display = 'block';
        }, 2500);
    }

    exit() {
        this.running = false;
        this.scrollEnabled = false;
        this.scrollIndicator.classList.remove('visible');

        // Hide sections
        for (const s of this.sections) {
            s.el.classList.remove('revealed');
            s.revealed = false;
            s.el.style.opacity = '0';
            s.el.style.transform = 'translateY(24px)';
        }

        // Fade out black hole
        gsap.to(this.blackHole.material.uniforms.uOpacity, {
            value: 0, duration: 1.0, ease: 'power2.in',
        });

        setTimeout(() => {
            this.particleGroup.visible = false;
            this.container.style.display = 'none';
        }, 1200);
    }

    switchStone() {} // no-op

    // ====== UPDATE ======

    update(time, dt) {
        if (!this.running) return;

        // ---- Smooth scroll interpolation ----
        this.currentScroll += (this.targetScroll - this.currentScroll) * 0.08;
        this.scrollProgress = this.currentScroll;

        // ---- Camera depth based on scroll ----
        // Fly from cameraBaseZ deeper into the vortex
        const maxDepth = 20;
        const scrollZ = this.cameraBaseZ - this.scrollProgress * maxDepth;
        this.camera.position.z = scrollZ;

        // ---- Black hole shader ----
        this.blackHole.material.uniforms.uTime.value = time;

        // Keep plane centered in front of the camera
        const cameraLocalZ = this.camera.position.z - WORLD2_Z;
        this.blackHole.position.z = cameraLocalZ - 10;

        // Camera approaches the singularity as user scrolls deeper
        const camDist = 8.0 - this.scrollProgress * 5.0;
        this.blackHole.material.uniforms.uCameraDistance.value = camDist;

        // ---- Section reveals based on scroll ----
        // Only show ONE section at a time — range-based reveal
        let anyRevealed = false;
        for (const section of this.sections) {
            const inRange = this.scrollProgress >= section.start
                          && this.scrollProgress < section.end;

            if (inRange && !section.revealed) {
                section.revealed = true;
                section.el.classList.add('revealed');
            }
            if (!inRange && section.revealed) {
                section.revealed = false;
                section.el.classList.remove('revealed');
            }

            // Parallax within the section's range
            if (section.revealed) {
                anyRevealed = true;
                const progress = (this.scrollProgress - section.start) / (section.end - section.start);
                const fadeIn = Math.min(1, progress * 5);
                const fadeOut = Math.min(1, (1 - progress) * 6);
                const opacity = Math.min(fadeIn, fadeOut);
                const translateY = (1 - progress) * 16;
                section.el.style.transform = `translateY(${translateY}px)`;
                section.el.style.opacity = String(opacity);
            } else {
                section.el.style.opacity = '0';
                section.el.style.transform = 'translateY(24px)';
            }
        }

        // Show scroll indicator when no section is visible
        if (anyRevealed) {
            this.scrollIndicator.classList.remove('visible');
        } else if (this.scrollProgress < 0.10) {
            this.scrollIndicator.classList.add('visible');
        }

        // ---- Bloom intensifies as we go deeper ----
        if (this.bloomPass) {
            const baseStrength = 0.8;
            const scrollBoost = this.scrollProgress * 0.6;
            this.bloomPass.strength = baseStrength + scrollBoost;
        }
    }

    // ====== CLEANUP ======

    destroy() {
        this.running = false;
        this.sharedScene.remove(this.particleGroup);

        window.removeEventListener('wheel', this._onWheel);
        window.removeEventListener('touchstart', this._onTouchStart);
        window.removeEventListener('touchmove', this._onTouchMove);

        for (const el of [this.backBtn, this.contentWrapper, this.scrollIndicator]) {
            if (el?.parentNode) el.parentNode.removeChild(el);
        }
    }
}
