/**
 * StoneRenderer — Draws 3 mystical stones on Canvas 2D
 * Each stone is an organic shape with glow, energy cracks, and connection lines
 */
export class StoneRenderer {
    constructor() {
        /** @type {Stone[]} */
        this.stones = [];
        this.hoveredStone = null;
        this.draggedStone = null;
        this.dragOffset = { x: 0, y: 0 };
        this.initialized = false;

        // Energy connection state
        this.energyFlowPhase = 0;
    }

    /**
     * Initialize stones at their default positions
     * @param {number} canvasWidth
     * @param {number} canvasHeight
     */
    init(canvasWidth, canvasHeight) {
        const cx = canvasWidth / 2;
        const cy = canvasHeight / 2;
        const baseSize = Math.min(canvasWidth, canvasHeight) * 0.07;

        // Triangle layout — centered, slightly above middle
        const spread = Math.min(canvasWidth, canvasHeight) * 0.18;
        const yOffset = canvasHeight * 0.05;

        this.stones = [
            {
                id: 'company',
                label: '会社紹介',
                route: '#/company',
                x: cx - spread * 0.9,
                y: cy + spread * 0.4 + yOffset,
                baseX: cx - spread * 0.9,
                baseY: cy + spread * 0.4 + yOffset,
                size: baseSize * 1.1,
                rotation: 0.3,
                shape: this._generateShape(8, baseSize * 1.1),
                glowIntensity: 0,
                hoverProgress: 0,
                pulsePhase: 0,
                breathPhase: 0,
                driftPhaseX: Math.random() * Math.PI * 2,
                driftPhaseY: Math.random() * Math.PI * 2,
                color: { h: 165, s: 35, l: 28 },
            },
            {
                id: 'services',
                label: 'サービス',
                route: '#/services',
                x: cx,
                y: cy - spread * 0.5 + yOffset,
                baseX: cx,
                baseY: cy - spread * 0.5 + yOffset,
                size: baseSize * 1.2,
                rotation: -0.2,
                shape: this._generateShape(9, baseSize * 1.2),
                glowIntensity: 0,
                hoverProgress: 0,
                pulsePhase: Math.PI * 0.66,
                breathPhase: Math.PI * 0.5,
                driftPhaseX: Math.random() * Math.PI * 2,
                driftPhaseY: Math.random() * Math.PI * 2,
                color: { h: 170, s: 30, l: 25 },
            },
            {
                id: 'works',
                label: '開発事例',
                route: '#/works',
                x: cx + spread * 0.9,
                y: cy + spread * 0.4 + yOffset,
                baseX: cx + spread * 0.9,
                baseY: cy + spread * 0.4 + yOffset,
                size: baseSize,
                rotation: 0.1,
                shape: this._generateShape(7, baseSize),
                glowIntensity: 0,
                hoverProgress: 0,
                pulsePhase: Math.PI * 1.33,
                breathPhase: Math.PI * 1.2,
                driftPhaseX: Math.random() * Math.PI * 2,
                driftPhaseY: Math.random() * Math.PI * 2,
                color: { h: 160, s: 40, l: 26 },
            },
        ];

        this.initialized = true;
    }

    /**
     * Generate an organic polygon shape
     * @param {number} points 
     * @param {number} radius 
     * @returns {Array<{angle: number, r: number}>}
     */
    _generateShape(points, radius) {
        const shape = [];
        for (let i = 0; i < points; i++) {
            const angle = (Math.PI * 2 * i) / points;
            const variation = 0.7 + Math.random() * 0.5;
            shape.push({ angle, r: radius * variation });
        }
        return shape;
    }

    /**
     * Update stone states
     * @param {number} time — elapsed time in seconds
     * @param {number} dt — delta time
     */
    update(time, dt) {
        this.energyFlowPhase += dt * 0.6;

        for (const stone of this.stones) {
            // Pulse animation — multi-frequency for organic feel
            stone.pulsePhase += dt * 0.8;
            stone.breathPhase += dt * 0.4;
            const pulse = Math.sin(stone.pulsePhase) * 0.5 + 0.5;
            const breath = Math.sin(stone.breathPhase) * 0.3 + 0.7;
            stone.glowIntensity = (0.3 + pulse * 0.3) * breath;

            // Hover animation
            const isHovered = this.hoveredStone === stone;
            const targetHover = isHovered ? 1 : 0;
            stone.hoverProgress += (targetHover - stone.hoverProgress) * dt * 5;

            // Multi-axis floating with Lissajous-like drift
            if (!this.draggedStone || this.draggedStone !== stone) {
                const driftX = Math.sin(time * 0.3 + stone.driftPhaseX) * 4
                    + Math.sin(time * 0.7 + stone.driftPhaseX * 2) * 2;
                const driftY = Math.sin(time * 0.5 + stone.driftPhaseY) * 5
                    + Math.cos(time * 0.2 + stone.driftPhaseY * 1.5) * 3;
                stone.x = stone.baseX + driftX;
                stone.y = stone.baseY + driftY;
            }

            // Slow gentle rotation
            stone.rotation += dt * 0.015 * (isHovered ? 4 : 1);
        }
    }

    /**
     * Draw all stones and connections
     * @param {CanvasRenderingContext2D} ctx
     */
    draw(ctx) {
        // Draw energy connection lines first (behind stones)
        this._drawConnections(ctx);

        for (const stone of this.stones) {
            this._drawStone(ctx, stone);
        }
    }

    /**
     * Draw energy lines connecting the 3 stones
     * @param {CanvasRenderingContext2D} ctx
     */
    _drawConnections(ctx) {
        if (this.stones.length < 3) return;

        const pairs = [
            [this.stones[0], this.stones[1]],
            [this.stones[1], this.stones[2]],
            [this.stones[2], this.stones[0]],
        ];

        for (let pi = 0; pi < pairs.length; pi++) {
            const [a, b] = pairs[pi];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Base alpha — faint connection, stronger if either stone is hovered
            const hoverBoost = Math.max(a.hoverProgress, b.hoverProgress);
            const baseAlpha = 0.03 + hoverBoost * 0.12;

            // Draw flowing energy dots along the line
            const numDots = 12;
            for (let i = 0; i < numDots; i++) {
                // Each dot flows along the line
                const flowOffset = (this.energyFlowPhase + pi * 0.3 + i * 0.05) % 1;
                const t = (i / numDots + flowOffset * 0.15) % 1;

                // Bezier curve with midpoint offset for organic path
                const midX = (a.x + b.x) / 2 + Math.sin(this.energyFlowPhase * 0.8 + pi * 2) * 15;
                const midY = (a.y + b.y) / 2 + Math.cos(this.energyFlowPhase * 0.6 + pi * 2) * 15;

                const x = (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * midX + t * t * b.x;
                const y = (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * midY + t * t * b.y;

                // Dot fades near endpoints
                const edgeFade = Math.min(t, 1 - t) * 4;
                const dotAlpha = baseAlpha * Math.min(edgeFade, 1) * (0.5 + Math.sin(this.energyFlowPhase * 3 + i) * 0.5);

                const dotSize = 1.5 + hoverBoost * 1.5 + Math.sin(this.energyFlowPhase * 2 + i * 0.5) * 0.5;

                ctx.beginPath();
                ctx.arc(x, y, dotSize, 0, Math.PI * 2);
                ctx.fillStyle = `hsla(170, 70%, 65%, ${dotAlpha})`;
                ctx.fill();
            }

            // Faint connecting line
            ctx.beginPath();
            const midX = (a.x + b.x) / 2 + Math.sin(this.energyFlowPhase * 0.8 + pi * 2) * 15;
            const midY = (a.y + b.y) / 2 + Math.cos(this.energyFlowPhase * 0.6 + pi * 2) * 15;
            ctx.moveTo(a.x, a.y);
            ctx.quadraticCurveTo(midX, midY, b.x, b.y);
            ctx.strokeStyle = `hsla(170, 60%, 50%, ${baseAlpha * 0.3})`;
            ctx.lineWidth = 0.5 + hoverBoost * 0.5;
            ctx.stroke();
        }
    }

    /**
     * Draw a single stone with effects
     * @param {CanvasRenderingContext2D} ctx
     * @param {Object} stone
     */
    _drawStone(ctx, stone) {
        ctx.save();
        ctx.translate(stone.x, stone.y);
        ctx.rotate(stone.rotation);

        // Breathing scale
        const breathScale = 1 + Math.sin(stone.breathPhase) * 0.015;
        const scale = (1 + stone.hoverProgress * 0.08) * breathScale;
        ctx.scale(scale, scale);

        // Outer glow
        const glowAlpha = (stone.glowIntensity + stone.hoverProgress * 0.5) * 0.4;
        const glowRadius = stone.size * (1.8 + stone.hoverProgress * 0.5);
        const glowGrad = ctx.createRadialGradient(0, 0, stone.size * 0.3, 0, 0, glowRadius);
        glowGrad.addColorStop(0, `hsla(${stone.color.h}, 80%, 60%, ${glowAlpha * 0.5})`);
        glowGrad.addColorStop(0.4, `hsla(${stone.color.h}, 60%, 40%, ${glowAlpha * 0.3})`);
        glowGrad.addColorStop(1, `hsla(${stone.color.h}, 40%, 20%, 0)`);
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        // Stone body path
        const bodyPath = this._createStonePath(ctx, stone);

        // Stone fill gradient
        const fillGrad = ctx.createRadialGradient(
            -stone.size * 0.2, -stone.size * 0.3, 0,
            0, 0, stone.size
        );
        fillGrad.addColorStop(0, `hsl(${stone.color.h}, ${stone.color.s}%, ${stone.color.l + 12}%)`);
        fillGrad.addColorStop(0.5, `hsl(${stone.color.h}, ${stone.color.s}%, ${stone.color.l}%)`);
        fillGrad.addColorStop(1, `hsl(${stone.color.h}, ${stone.color.s - 10}%, ${stone.color.l - 8}%)`);
        ctx.fillStyle = fillGrad;
        ctx.fill();

        // Surface texture — subtle noise lines (seeded by stone id for consistency)
        ctx.strokeStyle = `hsla(${stone.color.h}, 20%, ${stone.color.l + 5}%, 0.12)`;
        ctx.lineWidth = 0.5;
        const seed = stone.id === 'company' ? 1 : stone.id === 'services' ? 2 : 3;
        for (let i = 0; i < 6; i++) {
            ctx.beginPath();
            const startAngle = ((seed * 7 + i * 13) % 100) / 100 * Math.PI * 2;
            const arcLen = Math.PI * (0.2 + ((seed * 3 + i * 7) % 50) / 100);
            const r = stone.size * (0.25 + ((seed * 11 + i * 17) % 60) / 100);
            ctx.arc(0, 0, r, startAngle, startAngle + arcLen);
            ctx.stroke();
        }

        // Edge light — bright rim
        const edgeAlpha = 0.12 + stone.hoverProgress * 0.25;
        ctx.strokeStyle = `hsla(${stone.color.h}, 80%, 75%, ${edgeAlpha})`;
        ctx.lineWidth = 0.8 + stone.hoverProgress * 1.2;
        this._createStonePath(ctx, stone);
        ctx.stroke();

        // Inner glow on hover — radiant core
        if (stone.hoverProgress > 0.05) {
            const innerAlpha = stone.hoverProgress * 0.4;
            const innerGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, stone.size * 0.6);
            innerGrad.addColorStop(0, `hsla(170, 90%, 80%, ${innerAlpha * 0.4})`);
            innerGrad.addColorStop(0.5, `hsla(170, 70%, 50%, ${innerAlpha * 0.15})`);
            innerGrad.addColorStop(1, `hsla(170, 50%, 30%, 0)`);
            ctx.fillStyle = innerGrad;
            this._createStonePath(ctx, stone);
            ctx.fill();
        }

        // Energy cracks — bright lines radiating from center
        if (stone.hoverProgress > 0.1) {
            const crackAlpha = stone.hoverProgress * 0.6;
            ctx.strokeStyle = `hsla(170, 90%, 80%, ${crackAlpha})`;
            ctx.lineWidth = 0.8;
            ctx.shadowColor = `hsla(170, 90%, 70%, ${crackAlpha})`;
            ctx.shadowBlur = 10;

            const numCracks = 4;
            for (let i = 0; i < numCracks; i++) {
                ctx.beginPath();
                const ang = (Math.PI * 2 * i) / numCracks + stone.rotation * 0.5;
                ctx.moveTo(0, 0);

                // Jagged crack path
                const segments = 3;
                let px = 0, py = 0;
                for (let s = 1; s <= segments; s++) {
                    const progress = s / segments;
                    const len = stone.size * 0.5 * progress;
                    const jitter = (s < segments) ? ((i * 7 + s * 13) % 10 - 5) * 0.05 : 0;
                    px = Math.cos(ang + jitter) * len;
                    py = Math.sin(ang + jitter) * len;
                    ctx.lineTo(px, py);
                }
                ctx.stroke();
            }
            ctx.shadowBlur = 0;
        }

        ctx.restore();
    }

    /**
     * Create the stone body path (reusable)
     */
    _createStonePath(ctx, stone) {
        ctx.beginPath();
        for (let i = 0; i < stone.shape.length; i++) {
            const p = stone.shape[i];
            const next = stone.shape[(i + 1) % stone.shape.length];
            if (i === 0) {
                ctx.moveTo(Math.cos(p.angle) * p.r, Math.sin(p.angle) * p.r);
            }
            const cpX = (Math.cos(p.angle) * p.r + Math.cos(next.angle) * next.r) / 2;
            const cpY = (Math.sin(p.angle) * p.r + Math.sin(next.angle) * next.r) / 2;
            ctx.quadraticCurveTo(
                Math.cos(next.angle) * next.r,
                Math.sin(next.angle) * next.r,
                cpX,
                cpY
            );
        }
        ctx.closePath();
        return ctx;
    }

    /**
     * Hit-test for mouse/touch position
     * @param {number} x 
     * @param {number} y 
     * @returns {Object|null} the stone under the cursor, or null
     */
    hitTest(x, y) {
        for (let i = this.stones.length - 1; i >= 0; i--) {
            const stone = this.stones[i];
            const dx = x - stone.x;
            const dy = y - stone.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < stone.size * 1.3) {
                return stone;
            }
        }
        return null;
    }

    /**
     * Start dragging a stone
     */
    startDrag(stone, x, y) {
        this.draggedStone = stone;
        this.dragOffset.x = stone.x - x;
        this.dragOffset.y = stone.y - y;
    }

    /**
     * Move dragged stone
     */
    moveDrag(x, y) {
        if (this.draggedStone) {
            this.draggedStone.x = x + this.dragOffset.x;
            this.draggedStone.y = y + this.dragOffset.y;
            this.draggedStone.baseX = this.draggedStone.x;
            this.draggedStone.baseY = this.draggedStone.y;
        }
    }

    /**
     * End dragging
     * @returns {Object|null} the stone that was dragged
     */
    endDrag() {
        const stone = this.draggedStone;
        this.draggedStone = null;
        return stone;
    }
}
