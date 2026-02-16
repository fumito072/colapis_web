/**
 * ParticleSystem — Mist/aura particles around the stones
 * Inspired by hot spring steam (酸ヶ湯) and mystical energy
 */
export class ParticleSystem {
    constructor() {
        /** @type {Particle[]} */
        this.particles = [];
        this.maxParticles = 150;
        this.emitters = [];
    }

    /**
     * Set emitter positions (stone positions)
     * @param {Array<{x: number, y: number, size: number}>} positions
     */
    setEmitters(positions) {
        this.emitters = positions;
    }

    /**
     * Update particles
     * @param {number} time 
     * @param {number} dt 
     */
    update(time, dt) {
        // Spawn new particles from emitters
        for (const emitter of this.emitters) {
            if (this.particles.length < this.maxParticles && Math.random() < 0.3) {
                this._spawn(emitter, time);
            }
        }

        // Also spawn ambient mist (fewer, larger, slower)
        if (this.particles.length < this.maxParticles && Math.random() < 0.05) {
            this._spawnAmbient(time);
        }

        // Update existing particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.age += dt;

            if (p.age >= p.lifetime) {
                this.particles.splice(i, 1);
                continue;
            }

            const lifeProgress = p.age / p.lifetime;

            // Move
            p.x += p.vx * dt;
            p.y += p.vy * dt;

            // Slight wind drift
            p.x += Math.sin(time * 0.3 + p.phase) * dt * 5;

            // Slow down
            p.vx *= 0.99;
            p.vy *= 0.99;

            // Fade in then out
            if (lifeProgress < 0.2) {
                p.opacity = (lifeProgress / 0.2) * p.maxOpacity;
            } else if (lifeProgress > 0.7) {
                p.opacity = ((1 - lifeProgress) / 0.3) * p.maxOpacity;
            } else {
                p.opacity = p.maxOpacity;
            }

            // Grow slightly
            p.currentSize = p.size * (0.8 + lifeProgress * 0.5);
        }
    }

    /**
     * Spawn a particle from a stone emitter
     */
    _spawn(emitter, time) {
        const angle = Math.random() * Math.PI * 2;
        const dist = emitter.size * (0.5 + Math.random() * 0.8);

        this.particles.push({
            x: emitter.x + Math.cos(angle) * dist,
            y: emitter.y + Math.sin(angle) * dist,
            vx: (Math.random() - 0.5) * 8,
            vy: -10 - Math.random() * 20, // rise like steam
            size: 3 + Math.random() * 8,
            currentSize: 3,
            opacity: 0,
            maxOpacity: 0.06 + Math.random() * 0.08,
            age: 0,
            lifetime: 3 + Math.random() * 4,
            phase: Math.random() * Math.PI * 2,
            hue: 165 + (Math.random() - 0.5) * 20,
            type: 'mist',
        });
    }

    /**
     * Spawn ambient background mist
     */
    _spawnAmbient(time) {
        const canvas = document.getElementById('main-canvas');
        if (!canvas) return;

        this.particles.push({
            x: Math.random() * canvas.width,
            y: canvas.height * (0.3 + Math.random() * 0.5),
            vx: (Math.random() - 0.5) * 3,
            vy: -2 - Math.random() * 5,
            size: 20 + Math.random() * 40,
            currentSize: 20,
            opacity: 0,
            maxOpacity: 0.02 + Math.random() * 0.03,
            age: 0,
            lifetime: 6 + Math.random() * 6,
            phase: Math.random() * Math.PI * 2,
            hue: 170 + (Math.random() - 0.5) * 30,
            type: 'ambient',
        });
    }

    /**
     * Draw all particles
     * @param {CanvasRenderingContext2D} ctx
     */
    draw(ctx) {
        for (const p of this.particles) {
            if (p.opacity <= 0) continue;

            const grad = ctx.createRadialGradient(
                p.x, p.y, 0,
                p.x, p.y, p.currentSize
            );
            grad.addColorStop(0, `hsla(${p.hue}, 60%, 55%, ${p.opacity})`);
            grad.addColorStop(0.5, `hsla(${p.hue}, 50%, 40%, ${p.opacity * 0.5})`);
            grad.addColorStop(1, `hsla(${p.hue}, 40%, 30%, 0)`);

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.currentSize, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}
