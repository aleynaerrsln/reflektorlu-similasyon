import * as THREE from 'three';

export class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.clock = new THREE.Clock();
    this.updateCallbacks = [];

    this.initRenderer();
    this.initCamera();

    window.addEventListener('resize', () => this.onResize());
  }

  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
  }

  initCamera() {
    // Orthographic camera - fixed side view, tunnel pinned to top
    const sceneLength = 60;
    const halfWidth = sceneLength / 2 + 4;
    const aspect = window.innerWidth / window.innerHeight;
    const totalHeight = (2 * halfWidth) / aspect;

    // Asymmetric frustum: small space above tunnel, rest below
    // This pushes the tunnel to the top of the screen
    const top = 4.5;
    const bottom = -(totalHeight - 4.5);

    this.camera = new THREE.OrthographicCamera(
      -halfWidth, halfWidth,
      top, bottom,
      0.1, 100
    );
    // Side view: looking from +X towards the track center
    this.camera.position.set(15, 1.5, -sceneLength / 2);
    this.camera.lookAt(0, 0.8, -sceneLength / 2);
  }

  onUpdate(callback) {
    this.updateCallbacks.push(callback);
  }

  onResize() {
    const sceneLength = 60;
    const halfWidth = sceneLength / 2 + 4;
    const aspect = window.innerWidth / window.innerHeight;
    const totalHeight = (2 * halfWidth) / aspect;

    this.camera.left = -halfWidth;
    this.camera.right = halfWidth;
    this.camera.top = 4.5;
    this.camera.bottom = -(totalHeight - 4.5);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  start() {
    const animate = () => {
      requestAnimationFrame(animate);
      const delta = this.clock.getDelta();
      const elapsed = this.clock.getElapsedTime();

      this.updateCallbacks.forEach(cb => cb(delta, elapsed));
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }
}
