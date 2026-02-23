/**
 * SceneManager — Orchestrates the Canvas scene
 * Manages animation loop, input events, and renders stones + particles.
 * Designed to be replaceable with a Three.js scene for 3D upgrade.
 */
import { StoneRenderer } from './StoneRenderer.js';
import { ParticleSystem } from './ParticleSystem.js';

export class SceneManager {
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {Function} onStoneClick — callback when a stone is clicked
     */
    constructor(canvas, onStoneClick) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.onStoneClick = onStoneClick;

        this.stoneRenderer = new StoneRenderer();
        this.particleSystem = new ParticleSystem();

        this.width = 0;
        this.height = 0;
        this.dpr = window.devicePixelRatio || 1;

        this.startTime = performance.now();
        this.lastTime = this.startTime;
        this.running = true;

        // Input state
        this.mouse = { x: 0, y: 0 };
        this.isDragging = false;
        this.dragStartPos = { x: 0, y: 0 };
        this.dragThreshold = 5;

        // Hand tracking cursor
        this.handCursor = null;
        this.handActive = false;

        // Background stars (tiny static dots for depth)
        this.stars = this._generateStars(60);

        // Stone labels DOM elements
        this.labelContainer = document.getElementById('stone-labels');
        this.labels = {};

        this._resize();
        this._bindEvents();
        this._createLabels();
        this._animate();
    }

    /**
     * Generate background star positions
     */
    _generateStars(count) {
        const stars = [];
        for (let i = 0; i < count; i++) {
            stars.push({
                x: Math.random(),
                y: Math.random(),
                size: 0.3 + Math.random() * 1.2,
                alpha: 0.05 + Math.random() * 0.15,
                twinkleSpeed: 0.5 + Math.random() * 2,
                twinklePhase: Math.random() * Math.PI * 2,
            });
        }
        return stars;
    }

    /**
     * Resize canvas to match window
     */
    _resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width * this.dpr;
        this.canvas.height = this.height * this.dpr;
        this.canvas.style.width = this.width + 'px';
        this.canvas.style.height = this.height + 'px';
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

        this.stoneRenderer.init(this.width, this.height);
    }

    /**
     * Bind input events
     */
    _bindEvents() {
        window.addEventListener('resize', () => this._resize());

        this.canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
        this.canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
        this.canvas.addEventListener('mouseup', (e) => this._onMouseUp(e));
        this.canvas.addEventListener('mouseleave', () => {
            this.stoneRenderer.hoveredStone = null;
            this.canvas.style.cursor = 'default';
        });

        this.canvas.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: false });
        this.canvas.addEventListener('touchend', (e) => this._onTouchEnd(e));
    }

    /**
     * Create label DOM elements for each stone
     */
    _createLabels() {
        if (!this.labelContainer) return;
        this.labelContainer.innerHTML = '';

        setTimeout(() => {
            for (const stone of this.stoneRenderer.stones) {
                const label = document.createElement('div');
                label.className = 'stone-label';
                label.textContent = stone.label;
                label.dataset.stoneId = stone.id;
                this.labelContainer.appendChild(label);
                this.labels[stone.id] = label;
            }
        }, 100);
    }

    /**
     * Update label positions
     */
    _updateLabels() {
        for (const stone of this.stoneRenderer.stones) {
            const label = this.labels[stone.id];
            if (!label) continue;

            const labelX = stone.x;
            const labelY = stone.y + stone.size * 1.6 + 10;

            label.style.left = `${labelX}px`;
            label.style.top = `${labelY}px`;
            label.style.transform = 'translateX(-50%)';

            const isHovered = this.stoneRenderer.hoveredStone === stone;
            label.classList.toggle('visible', isHovered || stone.hoverProgress > 0.1);
            label.classList.toggle('active', isHovered);
        }
    }

    // ---- Mouse handlers ----

    _onMouseMove(e) {
        this.mouse.x = e.clientX;
        this.mouse.y = e.clientY;

        if (this.isDragging && this.stoneRenderer.draggedStone) {
            this.stoneRenderer.moveDrag(e.clientX, e.clientY);
            this.canvas.style.cursor = 'grabbing';
            return;
        }

        const hit = this.stoneRenderer.hitTest(e.clientX, e.clientY);
        this.stoneRenderer.hoveredStone = hit;
        this.canvas.style.cursor = hit ? 'pointer' : 'default';
    }

    _onMouseDown(e) {
        const hit = this.stoneRenderer.hitTest(e.clientX, e.clientY);
        if (hit) {
            this.isDragging = true;
            this.dragStartPos = { x: e.clientX, y: e.clientY };
            this.stoneRenderer.startDrag(hit, e.clientX, e.clientY);
        }
    }

    _onMouseUp(e) {
        if (this.isDragging) {
            const dx = e.clientX - this.dragStartPos.x;
            const dy = e.clientY - this.dragStartPos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const stone = this.stoneRenderer.endDrag();

            if (dist < this.dragThreshold && stone) {
                this.onStoneClick(stone);
            }

            this.isDragging = false;
            this.canvas.style.cursor = 'default';
        }
    }

    // ---- Touch handlers ----

    _onTouchStart(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const hit = this.stoneRenderer.hitTest(touch.clientX, touch.clientY);
        if (hit) {
            this.isDragging = true;
            this.dragStartPos = { x: touch.clientX, y: touch.clientY };
            this.stoneRenderer.startDrag(hit, touch.clientX, touch.clientY);
        }
    }

    _onTouchMove(e) {
        e.preventDefault();
        const touch = e.touches[0];
        if (this.isDragging && this.stoneRenderer.draggedStone) {
            this.stoneRenderer.moveDrag(touch.clientX, touch.clientY);
        }
        const hit = this.stoneRenderer.hitTest(touch.clientX, touch.clientY);
        this.stoneRenderer.hoveredStone = hit;
    }

    _onTouchEnd(e) {
        if (this.isDragging) {
            const stone = this.stoneRenderer.endDrag();
            if (e.changedTouches && e.changedTouches[0]) {
                const touch = e.changedTouches[0];
                const dx = touch.clientX - this.dragStartPos.x;
                const dy = touch.clientY - this.dragStartPos.y;
                if (Math.sqrt(dx * dx + dy * dy) < this.dragThreshold && stone) {
                    this.onStoneClick(stone);
                }
            }
            this.isDragging = false;
        }
        this.stoneRenderer.hoveredStone = null;
    }

    // ---- Hand tracking integration ----

    setHandCursor(cursor) {
        this.handCursor = cursor;
        this.handActive = !!cursor;

        if (!cursor) return;

        const x = cursor.x * this.width;
        const y = cursor.y * this.height;

        if (cursor.isPinching) {
            if (!this.isDragging) {
                const hit = this.stoneRenderer.hitTest(x, y);
                if (hit) {
                    this.isDragging = true;
                    this.dragStartPos = { x, y };
                    this.stoneRenderer.startDrag(hit, x, y);
                }
            } else {
                this.stoneRenderer.moveDrag(x, y);
            }
        } else {
            if (this.isDragging) {
                const dx = x - this.dragStartPos.x;
                const dy = y - this.dragStartPos.y;
                const stone = this.stoneRenderer.endDrag();
                if (Math.sqrt(dx * dx + dy * dy) < this.dragThreshold * 3 && stone) {
                    this.onStoneClick(stone);
                }
                this.isDragging = false;
            }
            const hit = this.stoneRenderer.hitTest(x, y);
            this.stoneRenderer.hoveredStone = hit;
        }
    }

    // ---- Animation loop ----

    _animate() {
        if (!this.running) return;

        const now = performance.now();
        const time = (now - this.startTime) / 1000;
        const dt = Math.min((now - this.lastTime) / 1000, 0.1);
        this.lastTime = now;

        this._clear();
        this._drawBackground(time);
        this._drawStars(time);

        // Update
        this.stoneRenderer.update(time, dt);
        this.particleSystem.setEmitters(
            this.stoneRenderer.stones.map(s => ({ x: s.x, y: s.y, size: s.size }))
        );
        this.particleSystem.update(time, dt);

        // Draw (particles behind stones)
        this.particleSystem.draw(this.ctx);
        this.stoneRenderer.draw(this.ctx);

        // Draw hand cursor
        if (this.handActive && this.handCursor) {
            this._drawHandCursor(this.handCursor);
        }

        // Update labels
        this._updateLabels();

        requestAnimationFrame(() => this._animate());
    }

    /**
     * Clear canvas
     */
    _clear() {
        this.ctx.clearRect(0, 0, this.width, this.height);
    }

    /**
     * Draw dark gradient background with breathing glow
     */
    _drawBackground(time) {
        // Deep dark background with vignette
        const grad = this.ctx.createRadialGradient(
            this.width / 2, this.height / 2, 0,
            this.width / 2, this.height / 2, Math.max(this.width, this.height) * 0.7
        );
        grad.addColorStop(0, '#0c1a16');
        grad.addColorStop(0.5, '#081210');
        grad.addColorStop(1, '#030806');
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Breathing center glow — multi-layered for organic feel
        const breath1 = 0.025 + Math.sin(time * 0.3) * 0.012;
        const breath2 = 0.015 + Math.sin(time * 0.5 + 1) * 0.008;
        const breath3 = 0.01 + Math.sin(time * 0.15) * 0.005;

        // Layer 1: tight center glow
        const glow1 = this.ctx.createRadialGradient(
            this.width / 2, this.height * 0.48, 0,
            this.width / 2, this.height * 0.48, Math.min(this.width, this.height) * 0.3
        );
        glow1.addColorStop(0, `hsla(170, 50%, 30%, ${breath1})`);
        glow1.addColorStop(1, 'hsla(170, 50%, 30%, 0)');
        this.ctx.fillStyle = glow1;
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Layer 2: wider ambient glow
        const glow2 = this.ctx.createRadialGradient(
            this.width / 2, this.height * 0.5, 0,
            this.width / 2, this.height * 0.5, Math.min(this.width, this.height) * 0.55
        );
        glow2.addColorStop(0, `hsla(165, 40%, 25%, ${breath2})`);
        glow2.addColorStop(1, 'hsla(165, 40%, 25%, 0)');
        this.ctx.fillStyle = glow2;
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Layer 3: slow peripheral pulse
        const glow3 = this.ctx.createRadialGradient(
            this.width / 2, this.height / 2, Math.min(this.width, this.height) * 0.2,
            this.width / 2, this.height / 2, Math.max(this.width, this.height) * 0.6
        );
        glow3.addColorStop(0, 'hsla(170, 30%, 20%, 0)');
        glow3.addColorStop(0.5, `hsla(175, 30%, 15%, ${breath3})`);
        glow3.addColorStop(1, 'hsla(175, 30%, 15%, 0)');
        this.ctx.fillStyle = glow3;
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    /**
     * Draw twinkling background stars
     */
    _drawStars(time) {
        for (const star of this.stars) {
            const twinkle = Math.sin(time * star.twinkleSpeed + star.twinklePhase) * 0.5 + 0.5;
            const alpha = star.alpha * (0.3 + twinkle * 0.7);

            const x = star.x * this.width;
            const y = star.y * this.height;

            this.ctx.beginPath();
            this.ctx.arc(x, y, star.size, 0, Math.PI * 2);
            this.ctx.fillStyle = `hsla(170, 30%, 70%, ${alpha})`;
            this.ctx.fill();
        }
    }

    /**
     * Draw hand cursor indicator
     */
    _drawHandCursor(cursor) {
        const x = cursor.x * this.width;
        const y = cursor.y * this.height;
        const radius = cursor.isPinching ? 8 : 12;
        const alpha = cursor.isPinching ? 0.6 : 0.3;

        // Outer ring
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.strokeStyle = `hsla(170, 80%, 65%, ${alpha})`;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // Glow
        const cursorGlow = this.ctx.createRadialGradient(x, y, 0, x, y, radius * 2);
        cursorGlow.addColorStop(0, `hsla(170, 80%, 65%, ${alpha * 0.3})`);
        cursorGlow.addColorStop(1, 'hsla(170, 80%, 65%, 0)');
        this.ctx.fillStyle = cursorGlow;
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius * 2, 0, Math.PI * 2);
        this.ctx.fill();

        if (cursor.isPinching) {
            this.ctx.beginPath();
            this.ctx.arc(x, y, 4, 0, Math.PI * 2);
            this.ctx.fillStyle = `hsla(170, 80%, 65%, ${alpha})`;
            this.ctx.fill();
        }
    }

    /**
     * Stop the scene
     */
    destroy() {
        this.running = false;
    }
}
