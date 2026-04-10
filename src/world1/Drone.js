import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

export class Drone {
  constructor(scene) {
    this.scene = scene;
    this.model = null;
    this.loaded = false;
    this.init();
  }

  init() {
    this.group = new THREE.Group();
    this.scene.add(this.group);

    const loader = new FBXLoader();
    const basePath = '/Meshy_AI-drone/';
    
    // Load textures
    const texLoader = new THREE.TextureLoader();
    const map = texLoader.load(basePath + 'Meshy_AI_drone_0408165727_texture.png');
    map.colorSpace = THREE.SRGBColorSpace;
    const metallicMap = texLoader.load(basePath + 'Meshy_AI_drone_0408165727_texture_metallic.png');
    const normalMap = texLoader.load(basePath + 'Meshy_AI_drone_0408165727_texture_normal.png');
    const roughnessMap = texLoader.load(basePath + 'Meshy_AI_drone_0408165727_texture_roughness.png');

    loader.load(basePath + 'Meshy_AI_drone_0408165727_texture.fbx', (fbx) => {
      this.model = fbx;
      
      // Setup materials
      this.model.traverse((child) => {
        if (child.isMesh) {
          // Keep original material but attach provided textures
          if (!child.material) {
            child.material = new THREE.MeshStandardMaterial();
          }
          const mat = child.material;
          mat.map = map;
          mat.metalnessMap = metallicMap;
          mat.normalMap = normalMap;
          mat.roughnessMap = roughnessMap;
          mat.metalness = 1.0;
          mat.roughness = 1.0;
          mat.needsUpdate = true;
        }
      });

      // Initial scaling/positioning
      this.model.scale.set(0.015, 0.015, 0.015);
      
      // Center the model in the group
      const box = new THREE.Box3().setFromObject(this.model);
      const center = box.getCenter(new THREE.Vector3());
      this.model.position.sub(center);

      // Add a slight tilt
      this.group.rotation.x = Math.PI * 0.1;
      this.group.rotation.y = Math.PI * 0.5;

      this.group.add(this.model);
      this.loaded = true;
    });
  }

  update(time, scrollProgress) {
    if (!this.loaded) return;

    // スクロール全体の進行度(0〜1.4)を0〜1に正規化
    const t = Math.min(scrollProgress / 1.4, 1.0);
    const invT = 1 - t;

    // 二次ベジェ曲線による、左からのアーチ＆右奥の光へのダイブ軌道
    // Start: 初めから画面の左下に見える位置
    const p0 = { x: -6.0, y: -2.0, z: 3.0 };
    // Control Point: 画面左側へ大きく膨らみながら上昇
    const p1 = { x: -12.0, y: 5.0, z: -10.0 };
    // End Point: 画像右奥の強烈な光の中（深く奥へ）
    const p2 = { x: 15.0, y: 2.0, z: -40.0 };

    // Calculate position along the bezier curve
    const basePathX = invT * invT * p0.x + 2 * invT * t * p1.x + t * t * p2.x;
    const basePathY = invT * invT * p0.y + 2 * invT * t * p1.y + t * t * p2.y;
    const basePathZ = invT * invT * p0.z + 2 * invT * t * p1.z + t * t * p2.z;
    
    // Position combines the arching path + organic hovering movement
    this.group.position.set(
      basePathX + Math.cos(time * 1.5) * 0.3,
      basePathY + Math.sin(time * 2.0) * 0.2,
      basePathZ
    );

    // Calculate X-axis velocity (derivative) for dynamic banking and yaw
    const dx = 2 * invT * (p1.x - p0.x) + 2 * t * (p2.x - p1.x);

    // Rotations (assuming base model facing +X natively)
    // Yaw: point forward (-Z) then adjust based on sweeping velocity
    this.group.rotation.y = Math.PI * 0.5 + (dx * 0.03);
    
    // Pitch: slight downward pitch as it arrives, mixed with hovering tilt
    this.group.rotation.x = Math.PI * 0.1 + Math.sin(time * 1.2) * 0.05 + (t * 0.15);
    
    // Roll/Bank: bank dynamically into the turn based on horizontal velocity
    this.group.rotation.z = Math.sin(time * 1.8) * 0.05 + (dx * 0.025);
  }
}
