import * as THREE from 'three';

export class Track {
  constructor(scene, config) {
    this.scene = scene;
    this.realLength = config.trackLength || 208; // metres
    this.sceneLength = config.sceneLength || 60;  // 3D scene units
    this.scale = this.sceneLength / this.realLength;

    this.group = new THREE.Group();
    this.group.name = 'track';

    // Omron sensor stripe definitions (real metre positions)
    this.stripeData = this.defineOmronStripes();

    this.buildTube();
    this.buildRails();
    this.buildMarkers();
    this.buildOmronStripes();
    this.buildZoneLabels();
    this.buildStartEndPlatforms();

    this.scene.add(this.group);
  }

  buildTube() {
    // Semi-transparent tube around the track
    const tubeRadius = 1.8;
    const tubeGeo = new THREE.CylinderGeometry(tubeRadius, tubeRadius, this.sceneLength, 32, 1, true);
    const tubeMat = new THREE.MeshPhysicalMaterial({
      color: 0x88ccff,
      transparent: true,
      opacity: 0.08,
      roughness: 0.1,
      metalness: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const tube = new THREE.Mesh(tubeGeo, tubeMat);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, 0.8, -this.sceneLength / 2);
    this.group.add(tube);

    // Tube wireframe rings for visual depth
    const ringCount = 40;
    for (let i = 0; i <= ringCount; i++) {
      const ringGeo = new THREE.RingGeometry(tubeRadius - 0.02, tubeRadius, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x4499cc,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      const z = -(i / ringCount) * this.sceneLength;
      ring.position.set(0, 0.8, z);
      this.group.add(ring);
    }
  }

  buildRails() {
    // Two parallel rails
    const railGeo = new THREE.BoxGeometry(0.08, 0.08, this.sceneLength);
    const railMat = new THREE.MeshStandardMaterial({
      color: 0x888888,
      metalness: 0.9,
      roughness: 0.2
    });

    const railLeft = new THREE.Mesh(railGeo, railMat);
    railLeft.position.set(-0.5, 0, -this.sceneLength / 2);
    railLeft.castShadow = true;

    const railRight = new THREE.Mesh(railGeo, railMat);
    railRight.position.set(0.5, 0, -this.sceneLength / 2);
    railRight.castShadow = true;

    this.group.add(railLeft, railRight);

    // Rail bed
    const bedGeo = new THREE.BoxGeometry(1.5, 0.05, this.sceneLength);
    const bedMat = new THREE.MeshStandardMaterial({
      color: 0x333344,
      metalness: 0.5,
      roughness: 0.8
    });
    const bed = new THREE.Mesh(bedGeo, bedMat);
    bed.position.set(0, -0.04, -this.sceneLength / 2);
    bed.receiveShadow = true;
    this.group.add(bed);
  }

  buildMarkers() {
    // Distance markers every 20m (real distance)
    this.markers = [];
    const step = 20; // every 20 metres
    for (let m = 0; m <= this.realLength; m += step) {
      const z = -(m * this.scale);

      // Marker post
      const postGeo = new THREE.BoxGeometry(0.05, 0.6, 0.05);
      const postMat = new THREE.MeshStandardMaterial({ color: 0xffaa00 });
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(-1.2, 0.3, z);
      this.group.add(post);

      // Label sprite
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, 128, 64);
      ctx.fillStyle = '#00ffaa';
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${m}m`, 64, 42);

      const tex = new THREE.CanvasTexture(canvas);
      const spriteMat = new THREE.SpriteMaterial({ map: tex });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(1.2, 0.6, 1);
      sprite.position.set(-1.8, 0.8, z);
      this.group.add(sprite);
    }
  }

  defineOmronStripes() {
    const stripes = [];

    // === BOLUM 1: Kapsul Alani - Yaris Baslangici (0-11m) ===
    // Kapsul yerlesim alani cizgisi
    stripes.push({ pos: 5, color: 'red', type: 'zone', label: 'Kapsul Siniri' });

    // === BOLUM 2: Ilk bolum - her 4m'de kirmizi cizgi (11m - 91m, 82m bolum) ===
    for (let m = 11; m <= 91; m += 4) {
      stripes.push({ pos: m, color: 'red', type: 'regular' });
    }

    // === BOLUM 3: Son 100m Isaretcisi (~91m) ===
    // Ozel sari+kirmizi ince cizgi grubu (5cm aralikli)
    const marker100mCenter = 91;
    // Ust grup (2.05m yukarida)
    for (let i = 0; i < 3; i++) {
      stripes.push({ pos: marker100mCenter - 2.05 + i * 0.05, color: 'yellow', type: 'fine' });
    }
    // Alt grup (1.95m asagida)
    for (let i = 0; i < 4; i++) {
      stripes.push({ pos: marker100mCenter + 1.95 + i * 0.05, color: 'yellow', type: 'fine' });
    }
    stripes.push({ pos: marker100mCenter, color: 'yellow', type: 'special', label: 'Son 100m' });

    // === BOLUM 4: Orta bolum - her 4m'de sari+kirmizi cizgi (91m - 141m, 44m bolum) ===
    for (let m = 95; m <= 141; m += 4) {
      stripes.push({ pos: m, color: 'redyellow', type: 'regular' });
    }

    // === BOLUM 5: Son 48m Isaretcisi (~143m) ===
    const marker48mCenter = 143;
    // Ust grup (3.05m yukarida)
    for (let i = 0; i < 2; i++) {
      stripes.push({ pos: marker48mCenter - 3.05 + i * 0.05, color: 'yellow', type: 'fine' });
    }
    // Alt grup (0.95m asagida)
    for (let i = 0; i < 3; i++) {
      stripes.push({ pos: marker48mCenter + 0.95 + i * 0.05, color: 'yellow', type: 'fine' });
    }
    stripes.push({ pos: marker48mCenter, color: 'yellow', type: 'special', label: 'Son 48m' });

    // === BOLUM 6: Son bolum - her 4m'de sari+kirmizi cizgi (143m - 191m, 44m bolum) ===
    for (let m = 147; m <= 191; m += 4) {
      stripes.push({ pos: m, color: 'redyellow', type: 'regular' });
    }

    // === BOLUM 7: Yaris Bitisi & Acil Durdurma (191m - 208m) ===
    stripes.push({ pos: 191, color: 'red', type: 'zone', label: 'Yaris Bitisi' });
    stripes.push({ pos: 208, color: 'red', type: 'zone', label: 'Tunel Bitisi' });

    return stripes;
  }

  buildOmronStripes() {
    // Tube center Y = 0.8, radius = 1.8 → top inside = 2.6
    const tubeCenter = 0.8;
    const tubeRadius = 1.8;
    const ceilingY = tubeCenter + tubeRadius; // 2.6

    // Dome reflector geometry (half-sphere, pointing downward from ceiling)
    const redReflectorGeo = new THREE.SphereGeometry(0.18, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    const yellowReflectorGeo = new THREE.SphereGeometry(0.22, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    const zoneReflectorGeo = new THREE.SphereGeometry(0.25, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    const fineReflectorGeo = new THREE.SphereGeometry(0.1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);

    // Materials with emissive glow
    const redMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
    const yellowMat = new THREE.MeshBasicMaterial({ color: 0xffdd00 });
    const redGlowMat = new THREE.MeshBasicMaterial({ color: 0xff4444, transparent: true, opacity: 0.25 });
    const yellowGlowMat = new THREE.MeshBasicMaterial({ color: 0xffdd00, transparent: true, opacity: 0.2 });

    this.stripeData.forEach(stripe => {
      const z = this.realToScene(stripe.pos);

      if (stripe.type === 'fine') {
        // Ince isaretci - kucuk dome
        const mat = stripe.color === 'yellow' ? yellowMat.clone() : redMat.clone();
        mat.transparent = true;
        mat.opacity = 0.9;
        const mesh = new THREE.Mesh(fineReflectorGeo, mat);
        mesh.rotation.x = Math.PI; // flip upside down (dome pointing down)
        mesh.position.set(0, ceilingY, z);
        this.group.add(mesh);
      } else if (stripe.type === 'regular') {
        if (stripe.color === 'redyellow') {
          // Cift renkli: kirmizi + sari yan yana dome
          const redDome = new THREE.Mesh(redReflectorGeo, redMat);
          redDome.rotation.x = Math.PI;
          redDome.position.set(-0.3, ceilingY, z);
          this.group.add(redDome);

          const yellowDome = new THREE.Mesh(redReflectorGeo, yellowMat);
          yellowDome.rotation.x = Math.PI;
          yellowDome.position.set(0.3, ceilingY, z);
          this.group.add(yellowDome);
        } else {
          // Tek kirmizi dome
          const mesh = new THREE.Mesh(redReflectorGeo, redMat);
          mesh.rotation.x = Math.PI;
          mesh.position.set(0, ceilingY, z);
          this.group.add(mesh);
        }

        // Glow halo
        const glowGeo = new THREE.PlaneGeometry(0.6, 0.6);
        const gMat = stripe.color === 'redyellow' ? yellowGlowMat.clone() : redGlowMat.clone();
        const glow = new THREE.Mesh(glowGeo, gMat);
        glow.position.set(0, ceilingY - 0.02, z);
        glow.rotation.x = -Math.PI / 2;
        this.group.add(glow);
      } else if (stripe.type === 'special') {
        // Ozel isaretci - buyuk sari dome
        const mesh = new THREE.Mesh(yellowReflectorGeo, yellowMat);
        mesh.rotation.x = Math.PI;
        mesh.position.set(0, ceilingY, z);
        this.group.add(mesh);

        // Glow
        const glowGeo = new THREE.PlaneGeometry(0.8, 0.8);
        const glow = new THREE.Mesh(glowGeo, yellowGlowMat.clone());
        glow.position.set(0, ceilingY - 0.02, z);
        glow.rotation.x = -Math.PI / 2;
        this.group.add(glow);
      } else if (stripe.type === 'zone') {
        // Bolge sinir - buyuk kirmizi dome
        const mesh = new THREE.Mesh(zoneReflectorGeo, new THREE.MeshBasicMaterial({ color: 0xff4444 }));
        mesh.rotation.x = Math.PI;
        mesh.position.set(0, ceilingY, z);
        this.group.add(mesh);

        // Glow
        const glowGeo = new THREE.PlaneGeometry(0.9, 0.9);
        const glow = new THREE.Mesh(glowGeo, redGlowMat.clone());
        glow.position.set(0, ceilingY - 0.02, z);
        glow.rotation.x = -Math.PI / 2;
        this.group.add(glow);
      }

      // Etiketi olan cizgilere label ekle
      if (stripe.label) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, 256, 64);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.roundRect(4, 4, 248, 56, 8);
        ctx.fill();

        const borderColor = stripe.color === 'yellow' ? '#ffdd00' : '#ff4444';
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 2;
        ctx.roundRect(4, 4, 248, 56, 8);
        ctx.stroke();

        ctx.fillStyle = borderColor;
        ctx.font = 'bold 24px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(stripe.label, 128, 40);

        const tex = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(1.8, 0.45, 1);
        sprite.position.set(0, ceilingY + 0.5, z);
        this.group.add(sprite);
      }
    });
  }

  buildZoneLabels() {
    // Kapsul Yerlestirme Alani (0-5m)
    const capsuleZoneGeo = new THREE.BoxGeometry(2.5, 0.02, 5 * this.scale);
    const capsuleZoneMat = new THREE.MeshBasicMaterial({
      color: 0x0044aa,
      transparent: true,
      opacity: 0.2
    });
    const capsuleZone = new THREE.Mesh(capsuleZoneGeo, capsuleZoneMat);
    capsuleZone.position.set(0, 0.005, this.realToScene(2.5));
    this.group.add(capsuleZone);

    // Acil Durdurma Bolgesi (191-208m)
    const emergencyLen = 17 * this.scale;
    const emergencyGeo = new THREE.BoxGeometry(2.5, 0.02, emergencyLen);
    const emergencyMat = new THREE.MeshBasicMaterial({
      color: 0xaa0000,
      transparent: true,
      opacity: 0.15
    });
    const emergencyZone = new THREE.Mesh(emergencyGeo, emergencyMat);
    emergencyZone.position.set(0, 0.005, this.realToScene(199.5));
    this.group.add(emergencyZone);

    // Zone label sprites
    this.addZoneSprite('Kapsul Yerlestirme Alani', 2.5, '#0088ff');
    this.addZoneSprite('Acil Durdurma Bolgesi', 199.5, '#ff4444');
  }

  addZoneSprite(text, realPos, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.roundRect(4, 4, 504, 56, 8);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.roundRect(4, 4, 504, 56, 8);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(text, 256, 40);

    const tex = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(3, 0.4, 1);
    sprite.position.set(0, 1.8, this.realToScene(realPos));
    this.group.add(sprite);
  }

  buildStartEndPlatforms() {
    // Start platform
    const platGeo = new THREE.BoxGeometry(3, 0.15, 2);
    const startMat = new THREE.MeshStandardMaterial({ color: 0x00cc66 });
    const startPlat = new THREE.Mesh(platGeo, startMat);
    startPlat.position.set(0, -0.05, 0.5);
    startPlat.receiveShadow = true;
    this.group.add(startPlat);

    // End platform
    const endMat = new THREE.MeshStandardMaterial({ color: 0xcc3333 });
    const endPlat = new THREE.Mesh(platGeo, endMat);
    endPlat.position.set(0, -0.05, -this.sceneLength - 0.5);
    endPlat.receiveShadow = true;
    this.group.add(endPlat);
  }

  realToScene(realPosition) {
    return -(realPosition * this.scale);
  }
}
