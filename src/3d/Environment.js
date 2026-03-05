import * as THREE from 'three';

export class Environment {
  constructor(scene) {
    this.scene = scene;
    this.setupLights();
    this.setupGround();
    this.setupBackground();
  }

  setupLights() {
    // Ambient
    const ambient = new THREE.AmbientLight(0x334466, 0.6);
    this.scene.add(ambient);

    // Main directional
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(10, 15, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 80;
    dirLight.shadow.camera.left = -40;
    dirLight.shadow.camera.right = 40;
    dirLight.shadow.camera.top = 10;
    dirLight.shadow.camera.bottom = -10;
    this.scene.add(dirLight);

    // Fill light
    const fillLight = new THREE.DirectionalLight(0x4488cc, 0.4);
    fillLight.position.set(-5, 5, -10);
    this.scene.add(fillLight);

    // Point lights along the track for atmosphere
    const colors = [0x0088ff, 0x00ffaa, 0x0088ff];
    colors.forEach((color, i) => {
      const pl = new THREE.PointLight(color, 0.3, 20);
      pl.position.set(2, 3, -i * 20);
      this.scene.add(pl);
    });
  }

  setupGround() {
    const groundGeo = new THREE.PlaneGeometry(100, 200);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x111122,
      roughness: 0.9,
      metalness: 0.1
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.1, -30);
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Grid helper for visual reference
    const grid = new THREE.GridHelper(100, 50, 0x222233, 0x181825);
    grid.position.y = -0.09;
    grid.position.z = -30;
    this.scene.add(grid);
  }

  setupBackground() {
    this.scene.background = new THREE.Color(0x0a0a1a);
    this.scene.fog = new THREE.FogExp2(0x0a0a1a, 0.008);
  }
}
