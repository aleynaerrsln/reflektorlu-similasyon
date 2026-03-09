import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.clock = new THREE.Clock();
    this.updateCallbacks = [];

    this.initRenderer();
    this.initCamera();
    this.initControls();

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
    this.camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      500
    );
    // Position camera to see entire track from start to finish
    this.camera.position.set(25, 18, 5);
    this.camera.lookAt(0, 0, -30);
  }

  initControls() {
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2.1;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 150;
    this.controls.target.set(0, 0, -30);

    // Cockpit mode state
    this.cockpitMode = false;
    this.savedCameraState = null;
  }

  enableCockpitMode() {
    if (this.cockpitMode) return;
    // Save current orbit camera state
    this.savedCameraState = {
      position: this.camera.position.clone(),
      target: this.controls.target.clone(),
      fov: this.camera.fov
    };
    this.controls.enabled = false;
    this.camera.fov = 90;
    this.camera.updateProjectionMatrix();
    this.cockpitMode = true;
  }

  disableCockpitMode() {
    if (!this.cockpitMode) return;
    this.cockpitMode = false;
    this.controls.enabled = true;
    if (this.savedCameraState) {
      this.camera.position.copy(this.savedCameraState.position);
      this.controls.target.copy(this.savedCameraState.target);
      this.camera.fov = this.savedCameraState.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  toggleCockpitMode() {
    if (this.cockpitMode) {
      this.disableCockpitMode();
    } else {
      this.enableCockpitMode();
    }
    return this.cockpitMode;
  }

  onUpdate(callback) {
    this.updateCallbacks.push(callback);
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  start() {
    const animate = () => {
      requestAnimationFrame(animate);
      const delta = this.clock.getDelta();
      const elapsed = this.clock.getElapsedTime();

      this.updateCallbacks.forEach(cb => cb(delta, elapsed));
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }
}
