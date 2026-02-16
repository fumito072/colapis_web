/**
 * StoneRenderer — Draws 3 mystical stones on Canvas 2D
 * Each stone is an organic shape with glow effects
 */
export class StoneRenderer {
    constructor() {
        /** @type {Stone[]} */
        this.stones = [];
        this.hoveredStone = null;
        this.draggedStone = null;
        this.dragOffset = { x: 0, y: 0 };
        this.initialized = false;
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
        for (const stone of this.stones) {
            // Pulse animation
            stone.pulsePhase += dt * 0.8;
            const pulse = Math.sin(stone.pulsePhase) * 0.5 + 0.5;
            stone.glowIntensity = 0.3 + pulse * 0.3;

            // Hover animation
            const isHovered = this.hoveredStone === stone;
            const targetHover = isHovered ? 1 : 0;
            stone.hoverProgress += (targetHover - stone.hoverProgress) * dt * 5;

            // Gentle floating
            stone.y = stone.baseY + Math.sin(time * 0.5 + stone.pulsePhase) * 3;
            stone.rotation += dt * 0.02 * (isHovered ? 3 : 1);
        }
    }

    /**
     * Draw all stones
     * @param {CanvasRenderingContext2D} ctx
     */
    draw(ctx) {
        for (const stone of this.stones) {
            this._drawStone(ctx, stone);
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

        const scale = 1 + stone.hoverProgress * 0.08;
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
        ctx.beginPath();
        for (let i = 0; i < stone.shape.length; i++) {
            const p = stone.shape[i];
            const next = stone.shape[(i + 1) % stone.shape.length];
            if (i === 0) {
                ctx.moveTo(Math.cos(p.angle) * p.r, Math.sin(p.angle) * p.r);
            }
            // Smooth curve through points
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

        // Surface texture — subtle noise lines
        ctx.strokeStyle = `hsla(${stone.color.h}, 20%, ${stone.color.l + 5}%, 0.15)`;
        ctx.lineWidth = 0.5;
        for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            const startAngle = Math.random() * Math.PI * 2;
            const arcLen = Math.PI * (0.3 + Math.random() * 0.5);
            const r = stone.size * (0.3 + Math.random() * 0.4);
            ctx.arc(0, 0, r, startAngle, startAngle + arcLen);
            ctx.stroke();
        }

        // Edge light — bright rim
        const edgeAlpha = 0.15 + stone.hoverProgress * 0.2;
        ctx.strokeStyle = `hsla(${stone.color.h}, 80%, 75%, ${edgeAlpha})`;
        ctx.lineWidth = 1 + stone.hoverProgress;
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
        ctx.stroke();

        // Energy cracks — bright lines between stones
        if (stone.hoverProgress > 0.1) {
            const crackAlpha = stone.hoverProgress * 0.6;
            ctx.strokeStyle = `hsla(170, 90%, 80%, ${crackAlpha})`;
            ctx.lineWidth = 1;
            ctx.shadowColor = `hsla(170, 90%, 70%, ${crackAlpha})`;
            ctx.shadowBlur = 8;
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                const ang = (Math.PI * 2 * i) / 3 + stone.rotation;
                ctx.moveTo(0, 0);
                const len = stone.size * (0.4 + Math.random() * 0.3);
                ctx.lineTo(Math.cos(ang) * len, Math.sin(ang) * len);
                ctx.stroke();
            }
            ctx.shadowBlur = 0;
        }

        ctx.restore();
    }

    /**
     * Hit-test for mouse/touch position
     * @param {number} x 
     * @param {number} y 
     * @returns {Object|null} the stone under the cursor, or null
     */
    hitTest(x, y) {
        // Test in reverse order (top-most first)
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
     * @param {Object} stone 
     * @param {number} x 
     * @param {number} y
     */
    startDrag(stone, x, y) {
        this.draggedStone = stone;
        this.dragOffset.x = stone.x - x;
        this.dragOffset.y = stone.y - y;
    }

    /**
     * Move dragged stone
     * @param {number} x 
     * @param {number} y
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
