import { Track } from './Track.js';
import { Vehicle } from './Vehicle.js';
import { Environment } from './Environment.js';
import { eventBus } from '../core/EventBus.js';

export class HyperloopScene {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this.scene = sceneManager.scene;

    this.config = {
      trackLength: 208,  // real track length in metres
      sceneLength: 60    // 3D scene length in units
    };

    this.environment = new Environment(this.scene);
    this.track = new Track(this.scene, this.config);
    this.vehicle = new Vehicle(this.scene, this.track);

    this.setupEventListeners();
    this.sceneManager.onUpdate((delta) => this.update(delta));
  }

  setupEventListeners() {
    eventBus.on('plc:position', (position) => {
      this.vehicle.setPosition(position);
    });

    eventBus.on('cockpit:toggle', () => {
      const active = this.sceneManager.toggleCockpitMode();
      if (active) {
        // Hide vehicle body in cockpit mode so it doesn't block the view
        this.vehicle.group.visible = false;
      } else {
        this.vehicle.group.visible = true;
      }
      eventBus.emit('cockpit:state', active);
    });
  }

  update(delta) {
    this.vehicle.update(delta);

    // In cockpit mode, camera fixed inside vehicle looking straight forward
    if (this.sceneManager.cockpitMode) {
      const vehicleZ = this.vehicle.group.position.z;
      const cam = this.sceneManager.camera;

      // Fixed driver seat height, looking perfectly straight down the track
      cam.position.set(0, 0.75, vehicleZ + 0.5);
      cam.rotation.set(0, Math.PI, 0);
      cam.lookAt(0, 0.75, vehicleZ - 100);
    }

    const data = this.vehicle.getPositionData();
    eventBus.emit('vehicle:telemetry', data);
  }
}
