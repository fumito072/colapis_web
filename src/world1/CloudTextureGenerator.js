import * as THREE from 'three';

export function createColumbiaCloudTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    // Add multiple radial gradients offset to simulate a detailed, fluffy cloud shape
    const drawPuff = (x, y, r, opacity) => {
        const grad = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
        grad.addColorStop(0, `rgba(255, 240, 220, ${opacity * 0.8})`); 
        grad.addColorStop(0.3, `rgba(255, 200, 150, ${opacity * 0.4})`); // Golden Columbia hue
        grad.addColorStop(0.7, `rgba(180, 100, 50, ${opacity * 0.15})`);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
    };

    // Center main body
    drawPuff(256, 256, 240, 0.4);
    
    // Many random sub-puffs to give it volume and lumps
    for(let i = 0; i < 70; i++) {
        const angle = Math.random() * Math.PI * 2;
        // concentrate more puffs towards the center
        const dist = Math.pow(Math.random(), 1.5) * 160; 
        const size = 60 + Math.random() * 100;
        const op = 0.15 + Math.random() * 0.35;
        drawPuff(256 + Math.cos(angle)*dist, 256 + Math.sin(angle)*dist, size, op);
    }
    
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}
