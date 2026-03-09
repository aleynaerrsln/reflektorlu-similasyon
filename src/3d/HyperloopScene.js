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
  }

  update(delta) {
    this.vehicle.update(delta);

    const data = this.vehicle.getPositionData();
    eventBus.emit('vehicle:telemetry', data);
  }
}
