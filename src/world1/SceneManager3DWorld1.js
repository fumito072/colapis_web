import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import gsap from 'gsap';
import { Drone } from './Drone.js';
import { createColumbiaCloudTexture } from './CloudTextureGenerator.js';

export class SceneManager3DWorld1 {
  constructor(canvas, onLogoClick) {
    this.canvas = canvas;
    this.onLogoClick = onLogoClick; // Callback to proceed to world 2
    this.running = true;
    
    // Scroll state maps to video progress and objects
    this.scrollProgress = 0;
    this.targetScroll = 0;
    this.videoDuration = 10; // Fallback until loaded
    
    this.world2Manager = null;
    this.inTransition = false;
    this.isClicking = false;
    this.hoveredLogo = false;
    
    this._initScene();
    this._initLights();
    this._initPostProcessing();
    this._initVideoBackground();
    this._initColumbiaClouds();
    this._initLogoAndText();
    this._initDrone();
    this._initScrollUI();
    this._bindEvents();
    this._animate();
  }
  
  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 150);
    this.camera.position.set(0, 0, 5.5);
    
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    
    this.clock = new THREE.Clock();
    this.raycaster = new THREE.Raycaster();
    this.mouseNDC = new THREE.Vector2(9999, 9999);
  }

  _initLights() {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(this.ambientLight);

    // Divine backlight (behind the logo to create god rays / glow)
    this.divineLight = new THREE.PointLight(0xffeedd, 0, 30);
    this.divineLight.position.set(0, 0.5, -5);
    this.scene.add(this.divineLight);

    this.fillLight = new THREE.PointLight(0xffffff, 0.5, 20);
    this.fillLight.position.set(0, 2, 5);
    this.scene.add(this.fillLight);
  }

  _initPostProcessing() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.6, 0.4, 0.8
    );
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());
  }

  _initVideoBackground() {
    this.video = document.createElement('video');
    this.video.src = '/cloud_video.mp4'; // Use the provided user video
    this.video.crossOrigin = 'anonymous';
    this.video.loop = false;
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.preload = 'auto'; // Load data ahead for smooth scrubbing
    
    this.video.addEventListener('loadedmetadata', () => {
      this.videoDuration = this.video.duration || 10;
    });
    this.video.load(); // Force preload
    
    this.videoTexture = new THREE.VideoTexture(this.video);
    this.videoTexture.minFilter = THREE.LinearFilter;
    this.videoTexture.magFilter = THREE.LinearFilter;
    this.videoTexture.format = THREE.RGBAFormat;
    this.videoTexture.colorSpace = THREE.SRGBColorSpace;
    
    // Position background plane sufficiently far back
    this.bgDistance = 60;
    const bgMat = new THREE.MeshBasicMaterial({
      map: this.videoTexture,
      depthWrite: false,
    });
    this.bgMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), bgMat);
    this.bgMesh.position.set(0, 0, 5.5 - this.bgDistance);
    this.scene.add(this.bgMesh);
    
    this._updateVideoBgScale();
    // this._initSpeedClouds(); (Removed in favor of Columbia Clouds)
  }

  _initColumbiaClouds() {
    this.cloudSystem = new THREE.Group();
    this.scene.add(this.cloudSystem);
    
    const tex = createColumbiaCloudTexture();
    const cloudGeo = new THREE.PlaneGeometry(50, 50);
    // Additive blending looks epic for divine glowing light clouds
    this.cloudMat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        color: 0xffeedd,
        side: THREE.DoubleSide
    });
    
    this.clouds = [];
    const numClouds = 60; // Huge enclosing planes
    
    for(let i=0; i<numClouds; i++) {
        // Create a tunnel shape perfectly aligned with camera dive
        const z = -20 - Math.random() * 180;
        const angle = Math.random() * Math.PI * 2;
        
        // Radius of tunnel (clouds surround the center, leaving space to fly)
        const radius = 12 + Math.random() * 20;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * (radius * 0.7); // Elliptical tunnel looks cinematic
        
        const mesh = new THREE.Mesh(cloudGeo, this.cloudMat.clone()); // Individual mats for fading
        mesh.position.set(x, y, z);
        
        // Random scale (large fluff blocks)
        const scale = 0.8 + Math.random() * 2.0;
        mesh.scale.set(scale, scale, scale);
        
        // Look generally towards center but with random roll
        mesh.rotation.z = Math.random() * Math.PI * 2;
        // Let planes face camera exactly via lookAt later if wanted, 
        // but facing Z is fine for a fly-through
        
        this.cloudSystem.add(mesh);
        this.clouds.push({ mesh, speedZ: (Math.random() - 0.5) * 1.5, rotZ: (Math.random() - 0.5) * 0.1 });
    }
  }

  _updateVideoBgScale() {
    if (!this.bgMesh) return;
    const aspect = window.innerWidth / window.innerHeight;
    const vFov = (50 * Math.PI) / 180;
    const h = 2 * Math.tan(vFov / 2) * this.bgDistance;
    const w = h * aspect;
    
    const videoAspect = 16/9; // Assuming 16:9 standard video
    if (aspect > videoAspect) {
      this.bgMesh.scale.set(w, w / videoAspect, 1);
    } else {
      this.bgMesh.scale.set(h * videoAspect, h, 1);
    }
  }

  _initLogoAndText() {
    this.logoGroup = new THREE.Group();
    // Anchor everything to 0 for initial setup, but displace individually
    this.scene.add(this.logoGroup);
    
    // 1. Logo (public/logo.png replacing the stones)
    const logoTex = new THREE.TextureLoader().load('/logo.png');
    logoTex.colorSpace = THREE.SRGBColorSpace;
    const logoMat = new THREE.MeshStandardMaterial({
      map: logoTex,
      transparent: true,
      alphaTest: 0.1, // clean edges
      metalness: 0.4,
      roughness: 0.5,
      opacity: 0,
      emissive: new THREE.Color(0xffeedd),
      emissiveIntensity: 0.0 // modulated over scroll
    });
    
    // A stable aspect plane for the logo
    this.logoMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), logoMat);
    this.logoMesh.position.set(0, 0.4, -40); // Starts far behind
    this.logoGroup.add(this.logoMesh);
    
    // 2. Cinematic Text "COLAPIS" via high-res Canvas
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,1024,256);
    const drawText = () => {
      ctx.clearRect(0,0,1024,256);
      ctx.fillStyle = '#ffffff';
      ctx.font = '300 130px "Cinzel", "Times New Roman", "Georgia", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(255,255,255,0.8)';
      ctx.shadowBlur = 10;
      try { ctx.letterSpacing = '12px'; } catch(e){}
      ctx.fillText('COLAPIS', 512, 128);
      if (this.textMesh) this.textMesh.material.map.needsUpdate = true;
    };

    drawText();
    document.fonts.ready.then(drawText);
    
    const textTex = new THREE.CanvasTexture(canvas);
    textTex.colorSpace = THREE.SRGBColorSpace;
    const textMat = new THREE.MeshStandardMaterial({
      map: textTex,
      transparent: true,
      alphaTest: 0.1,
      metalness: 0.4,
      roughness: 0.5,
      opacity: 0,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.0
    });
    
    this.textMesh = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), textMat);
    this.textMesh.position.set(0, -1.0, -80); // Starts EXTREMELY far behind
    this.logoGroup.add(this.textMesh);
  }

  _initDrone() {
    this.drone = new Drone(this.scene);
  }

  _initScrollUI() {
    this.scrollIndicator = document.createElement('div');
    this.scrollIndicator.innerHTML = `
      <span>Scroll to explore</span>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin: 10px auto 0; display: block; animation: colapis-bounce 2s infinite;"><path d="M6 9l6 6 6-6"/></svg>
    `;
    Object.assign(this.scrollIndicator.style, {
      position: 'absolute', bottom: '40px', left: '50%', transform: 'translateX(-50%)',
      color: 'rgba(255,255,255,0.7)', textAlign: 'center', pointerEvents: 'none',
      fontFamily: 'sans-serif', letterSpacing: '0.1em', fontSize: '0.8rem',
      zIndex: 100, transition: 'opacity 0.5s'
    });
    document.body.appendChild(this.scrollIndicator);
    
    if (!document.getElementById('colapis-style')) {
      const style = document.createElement('style');
      style.id = 'colapis-style';
      style.innerHTML = `@keyframes colapis-bounce { 0%, 20%, 50%, 80%, 100% {transform: translateY(0);} 40% {transform: translateY(-8px);} 60% {transform: translateY(-4px);} }`;
      document.head.appendChild(style);
    }
  }

  _bindEvents() {
    window.addEventListener('resize', () => this._onResize());
    window.addEventListener('wheel', (e) => this._onWheel(e), { passive: true });
    
    this.canvas.addEventListener('mousemove', (e) => {
      this.mouseNDC.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    });
    
    this.canvas.addEventListener('mousedown', () => { if (this.hoveredLogo) this.isClicking = true; });
    this.canvas.addEventListener('mouseup', () => {
      if (this.isClicking && this.hoveredLogo) this._triggerTransition();
      this.isClicking = false;
    });

    // Touch
    this.touchStartY = 0;
    this.canvas.addEventListener('touchstart', (e) => {
      if(e.cancelable) e.preventDefault();
      const t = e.touches[0];
      this.touchStartY = t.clientY;
      this.mouseNDC.set((t.clientX / window.innerWidth) * 2 - 1, -(t.clientY / window.innerHeight) * 2 + 1);
      if (this.hoveredLogo) this.isClicking = true;
    }, {passive: false});
    this.canvas.addEventListener('touchmove', (e) => {
      if(e.cancelable) e.preventDefault();
      const t = e.touches[0];
      const dy = this.touchStartY - t.clientY;
      this.touchStartY = t.clientY;
      this.mouseNDC.set((t.clientX / window.innerWidth) * 2 - 1, -(t.clientY / window.innerHeight) * 2 + 1);
      
      if (!this.inTransition && !this.isClicking) {
        this.targetScroll += dy * 0.002; // Scrub speed mapping
        this.targetScroll = Math.max(0, Math.min(1.4, this.targetScroll));
      }
    }, {passive: false});
    this.canvas.addEventListener('touchend', () => {
      if (this.isClicking && this.hoveredLogo) this._triggerTransition();
      this.isClicking = false;
    });
  }

  _onWheel(e) {
    if (this.inTransition) return;
    this.targetScroll += e.deltaY * 0.0006;
    this.targetScroll = Math.max(0, Math.min(1.4, this.targetScroll));

    // Try to unlock video playback context if suspended by browser
    if (this.video && this.video.paused) {
       this.video.play().then(() => this.video.pause()).catch(() => {});
    }
  }

  _onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloomPass.resolution.set(w, h);
    this._updateVideoBgScale();
  }

  _triggerTransition() {
    if (this.inTransition) return;
    this.inTransition = true;
    this.scrollIndicator.style.opacity = '0';

    // Cinematic dive into the white clouds/light
    // 1. Extreme Bloom Burst + God Rays
    gsap.to(this.bloomPass, { strength: 16.0, duration: 1.8, ease: 'power3.in' });
    gsap.to(this.divineLight, { intensity: 500.0, duration: 1.8, ease: 'power3.in' });
    gsap.to(this.logoMesh.material, { emissiveIntensity: 3.0, duration: 1.5, ease: 'power2.in' });
    gsap.to(this.textMesh.material, { emissiveIntensity: 3.0, duration: 1.5, ease: 'power2.in' });
    
    // 2. Camera deeply plunges into the clouds behind the logo (accelerates dive)
    gsap.to(this.camera.position, { z: -40, duration: 2.0, ease: 'power2.in' });

    // 3. Accelerate the Columbia clouds past camera
    if (this.clouds && this.cloudSystem) {
        gsap.to(this.cloudSystem.position, { z: 400, duration: 2.0, ease: 'power3.in' });
    }

    // 4. Logo & Drone fly "past" the camera backwards for velocity feel
    gsap.to(this.logoMesh.position, { z: 10, y: 1.5, duration: 2.5, ease: 'power2.in' });
    gsap.to(this.textMesh.position, { z: 10, y: -2.0, duration: 2.5, ease: 'power2.in' });
    if (this.drone && this.drone.group) {
      gsap.to(this.drone.group.position, { z: 15, duration: 2.5, ease: 'power2.in' });
    }
    
    // 5. Fade out the video background precisely at the transition split
    gsap.to(this.bgMesh.material, { 
      opacity: 0, 
      transparent: true,
      duration: 1.0, 
      delay: 1.0, 
      ease: 'power2.out' 
    });

    setTimeout(() => {
      // Callback passes "dummy" stone to main to trigger the world2 load (or next page)
      if (this.onLogoClick) this.onLogoClick({ id: 'main_logo' });
    }, 2000);
  }

  returnFromWorld2() {
    gsap.to(this.camera.position, { z: 5.5, duration: 2.5, ease: 'power2.inOut' });
    gsap.to(this.bloomPass, { strength: 0.6 + Math.pow(this.scrollProgress, 3) * 0.8, duration: 2.0, ease: 'power1.inOut' });
    gsap.to(this.logoMesh.material, { emissiveIntensity: 0.0, duration: 2.0, ease: 'power1.out' });
    gsap.to(this.textMesh.material, { emissiveIntensity: 0.0, duration: 2.0, ease: 'power1.out' });
    gsap.to(this.bgMesh.material, { opacity: 1, duration: 2.0, ease: 'power2.inOut' });
    
    setTimeout(() => {
      this.scrollIndicator.style.opacity = this.scrollProgress > 0.05 ? '0' : '1';
      this.inTransition = false;
      this.world2Manager = null; // Detach
    }, 2700);
  }

  _animate() {
    if (!this.running) return;

    const dt = Math.min(this.clock.getDelta(), 0.1);
    const time = this.clock.elapsedTime;

    // Smooth Interpolate Scroll
    if (!this.inTransition) {
      if (this.scrollProgress !== this.targetScroll) {
         this.scrollProgress += (this.targetScroll - this.scrollProgress) * Math.min(dt * 5, 1.0);
         if (Math.abs(this.scrollProgress - this.targetScroll) < 0.001) this.scrollProgress = this.targetScroll;
      }
      this.scrollIndicator.style.opacity = this.scrollProgress > 0.05 ? '0' : '1';
    }

    // 1. Scrub Video (Tied perfectly to scroll progress 0..1)
    if (this.video && this.videoDuration > 0 && !this.inTransition) {
      // Offset by slightly less than total duration to avoid loop flickers
      const safeScroll = Math.min(this.scrollProgress, 1.0);
      const tgtTime = safeScroll * (this.videoDuration - 0.1);
      this.video.currentTime = tgtTime;
    }

    if (!this.inTransition) {
      // 2. Animate Logo emergence (scroll from 0.4 to 0.9)
      let logoP = Math.max(0, (this.scrollProgress - 0.4) / 0.5);
      logoP = Math.min(1, logoP);
      const logoSmooth = logoP * logoP * (3 - 2*logoP); // Custom smoothstep

      // Logo flies from -40 to 0 (Z axis)
      this.logoMesh.position.z = THREE.MathUtils.lerp(-40, 0, logoSmooth);
      this.logoMesh.material.opacity = logoSmooth;

      // "神々しい感じ": The logo floats smoothly, bathing in light
      this.logoMesh.position.y = 0.5 + Math.sin(time * 1.5) * 0.08 * logoSmooth;
      
      // 3. Animate Text emergence (scroll from 0.65 to 1.0)
      let textP = Math.max(0, (this.scrollProgress - 0.65) / 0.35);
      textP = Math.min(1, textP);
      const textSmooth = textP * textP * (3 - 2*textP);

      // COLAPIS flies from very deep -Z up to catch the logo right at the end
      this.textMesh.position.z = THREE.MathUtils.lerp(-80, -0.6, textSmooth);
      this.textMesh.material.opacity = textSmooth;
      
      // Subtle float for text too, shifted phase slightly
      this.textMesh.position.y = -1.0 + Math.sin(time * 1.5 + 1.0) * 0.04 * textSmooth;

      // 4. Divine Lighting rises towards the end as they lock into position
      // Add shimmering/pulsating glow effect ("出したり出さなかったり")
      const shimmer = 0.5 + 0.5 * Math.sin(time * 6.0) * Math.sin(time * 2.5);
      this.divineLight.intensity = Math.pow(this.scrollProgress, 5) * 15.0 * shimmer; 
      
      // 5. Bloom gently pulses at the peak of scroll, with matching shimmer
      const peakBloom = 0.5 + Math.pow(this.scrollProgress, 4) * 1.5 * shimmer;
      this.bloomPass.strength = peakBloom;
      
      // 6. Check hover on logo only when fully formed
      this.raycaster.setFromCamera(this.mouseNDC, this.camera);
      const hits = this.raycaster.intersectObject(this.logoMesh);
      this.hoveredLogo = hits.length > 0 && this.scrollProgress > 0.95;
      
      this.canvas.style.cursor = this.hoveredLogo ? 'pointer' : 'default';
      
      // Flash logo if hovered
      const tgtEmissive = this.hoveredLogo ? 0.3 : 0.0;
      this.logoMesh.material.emissiveIntensity += (tgtEmissive - this.logoMesh.material.emissiveIntensity) * dt * 5;
    }

    if (this.drone) {
      this.drone.update(time, this.scrollProgress);
    }

    // World 2 render stack if active
    if (this.world2Manager) {
      this.world2Manager.update(time, dt);
    }
    
    // Columbia clouds fly past when scrolling past 1.0 (the dive phase)
    if (this.clouds && !this.inTransition) {
        if (this.scrollProgress > 1.0) {
            // How deep into the dive we are (0 to 0.4)
            const diveP = (this.scrollProgress - 1.0) / 0.4;
            
            for(let c of this.clouds) {
                // Clouds fade in based on dive progress
                c.mesh.material.opacity = Math.min(diveP * 0.8, 0.8);
                
                // Active pushing towards camera
                c.mesh.position.z += c.speedZ * 60 * dt; 
                c.mesh.position.z += diveP * 15; // aggressive forward push
                
                c.mesh.rotation.z += c.rotZ * dt;
                
                // Loop clouds so it's endless until transition
                if (c.mesh.position.z > 10) {
                   c.mesh.position.z = -100 - Math.random() * 100;
                }
            }
        } else {
            for(let c of this.clouds) {
                c.mesh.material.opacity = 0;
            }
        }
    }

    // Rather than an auto-timer, trigger transition entirely by scroll depth
    if (this.scrollProgress >= 1.39 && !this.inTransition) {
       this._triggerTransition();
    }

    this.composer.render();
    requestAnimationFrame(() => this._animate());
  }

  // Called by HandTracker
  setHandCursor(cursor) {
    if (!cursor) return;
    this.mouseNDC.set((cursor.x) * 2 - 1, -(cursor.y) * 2 + 1);
    if(cursor.isPinching && this.hoveredLogo) this.isClicking = true;
    if(!cursor.isPinching && this.isClicking) {
      this._triggerTransition();
      this.isClicking = false;
    }
  }

  getSceneContext() {
    return {
      scene: this.scene, camera: this.camera, renderer: this.renderer,
      composer: this.composer, bloomPass: this.bloomPass
    };
  }

  setWorld2Manager(manager) { this.world2Manager = manager; }
  removeWorld2Manager() { this.world2Manager = null; }
  
  restart() {
    this.inTransition = false;
    this.scrollProgress = 0;
    this.targetScroll = 0;
    this.camera.position.set(0, 0, 5.5);
    this.scrollIndicator.style.opacity = '1';
    this.bgMesh.material.opacity = 1;
    this.bgMesh.material.transparent = false;
  }

  destroy() {
    this.running = false;
    if (this.world2Manager) {
      this.world2Manager.destroy();
      this.world2Manager = null;
    }
  }
}
