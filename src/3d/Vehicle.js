import * as THREE from 'three';

export class Vehicle {
  constructor(scene, track) {
    this.scene = scene;
    this.track = track;
    this.currentPosition = 0; // real metres
    this.targetPosition = 0;

    this.group = new THREE.Group();
    this.group.name = 'vehicle';

    this.buildBody();
    this.buildDetails();
    this.buildGlow();

    this.scene.add(this.group);
  }

  buildBody() {
    // Main capsule body - elongated shape
    const bodyLength = 2.5;
    const bodyGeo = new THREE.CapsuleGeometry(0.6, bodyLength, 8, 16);
    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: 0xe0e0e0,
      metalness: 0.7,
      roughness: 0.15,
      clearcoat: 0.8,
      clearcoatRoughness: 0.1
    });
    this.body = new THREE.Mesh(bodyGeo, bodyMat);
    this.body.rotation.x = Math.PI / 2;
    this.body.position.y = 0.65;
    this.body.castShadow = true;
    this.group.add(this.body);
  }

  buildDetails() {
    // Window strip
    const windowGeo = new THREE.BoxGeometry(0.85, 0.2, 2.0);
    const windowMat = new THREE.MeshPhysicalMaterial({
      color: 0x1a1a2e,
      metalness: 0.1,
      roughness: 0.0,
      transmission: 0.5,
      thickness: 0.1
    });
    const windowMesh = new THREE.Mesh(windowGeo, windowMat);
    windowMesh.position.y = 0.9;
    this.group.add(windowMesh);

    // Front LED strip
    const ledGeo = new THREE.BoxGeometry(0.5, 0.06, 0.06);
    const ledMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
    this.frontLed = new THREE.Mesh(ledGeo, ledMat);
    this.frontLed.position.set(0, 0.5, -1.8);
    this.group.add(this.frontLed);

    // Rear LED strip
    const rearLedMat = new THREE.MeshBasicMaterial({ color: 0xff3344 });
    this.rearLed = new THREE.Mesh(ledGeo.clone(), rearLedMat);
    this.rearLed.position.set(0, 0.5, 1.8);
    this.group.add(this.rearLed);

    // Bottom levitation indicators
    const levGeo = new THREE.BoxGeometry(0.3, 0.03, 0.3);
    const levMat = new THREE.MeshBasicMaterial({
      color: 0x0088ff,
      transparent: true,
      opacity: 0.6
    });
    for (let i = -1; i <= 1; i += 0.5) {
      const lev = new THREE.Mesh(levGeo, levMat.clone());
      lev.position.set(0, 0.02, i);
      this.group.add(lev);
    }
  }

  buildGlow() {
    // Soft glow under the vehicle (levitation effect)
    const glowGeo = new THREE.PlaneGeometry(1.2, 3);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x0066ff,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide
    });
    this.glow = new THREE.Mesh(glowGeo, glowMat);
    this.glow.rotation.x = -Math.PI / 2;
    this.glow.position.y = 0.01;
    this.group.add(this.glow);
  }

  setPosition(realMetres) {
    this.targetPosition = Math.max(0, Math.min(realMetres, this.track.realLength));
  }

  update(delta) {
    // Smooth interpolation towards target
    const diff = this.targetPosition - this.currentPosition;
    if (Math.abs(diff) > 0.001) {
      this.currentPosition += diff * Math.min(delta * 5, 1);
    } else {
      this.currentPosition = this.targetPosition;
    }

    const z = this.track.realToScene(this.currentPosition);
    this.group.position.z = z;

    // Levitation hover animation
    this.group.position.y = Math.sin(performance.now() * 0.003) * 0.03;

    // Glow pulse
    if (this.glow) {
      this.glow.material.opacity = 0.1 + Math.sin(performance.now() * 0.005) * 0.08;
    }
  }

  getPositionData() {
    return {
      current: this.currentPosition,
      target: this.targetPosition,
      remaining: this.track.realLength - this.currentPosition,
      percentage: (this.currentPosition / this.track.realLength) * 100
    };
  }
}
