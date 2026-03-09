import { eventBus } from '../core/EventBus.js';

export class Dashboard {
  constructor(container) {
    this.container = container;
    this.trackLength = 208;
    this.telemetry = { current: 0, remaining: 208, percentage: 0, speed: 0 };

    // Regular stripe positions for tracking (only 'regular' type stripes)
    this.stripePositions = [];
    for (let m = 11; m <= 91; m += 4) this.stripePositions.push(m);
    for (let m = 95; m <= 141; m += 4) this.stripePositions.push(m);
    for (let m = 147; m <= 191; m += 4) this.stripePositions.push(m);

    this.buildHTML();
    this.cacheElements();
    this.setupEventListeners();
  }

  buildHTML() {
    this.container.innerHTML = `
      <!-- Top Bar -->
      <div class="top-bar">
        <span class="logo">Hyperloop Control</span>
        <div class="status-badge online" id="status-badge">
          <span class="status-dot"></span>
          <span id="status-text">Cevrimici</span>
        </div>
      </div>

      <!-- Left Info Panel -->
      <div class="info-panel">
        <!-- Speed Card -->
        <div class="panel-card">
          <h3>Hiz</h3>
          <div class="speed-display">
            <div class="speed-value" id="speed-value">0</div>
            <div class="speed-unit">km/h</div>
          </div>
        </div>

        <!-- Position Card -->
        <div class="panel-card">
          <h3>Konum Bilgisi</h3>
          <div class="metric">
            <span class="metric-label">Mevcut Konum</span>
            <span><span class="metric-value" id="pos-current">0.0</span><span class="metric-unit">m</span></span>
          </div>
          <div class="metric">
            <span class="metric-label">Kalan Mesafe</span>
            <span><span class="metric-value" id="pos-remaining">208.0</span><span class="metric-unit">m</span></span>
          </div>
          <div class="metric">
            <span class="metric-label">Ilerleme</span>
            <span><span class="metric-value" id="pos-percent">0.0</span><span class="metric-unit">%</span></span>
          </div>
          <div class="track-progress">
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" id="progress-fill"></div>
            </div>
            <div class="progress-labels">
              <span>0m</span>
              <span>${this.trackLength}m</span>
            </div>
          </div>
        </div>

        <!-- Omron Stripe Card -->
        <div class="panel-card">
          <h3>Omron Cizgi Bilgisi</h3>
          <div class="metric">
            <span class="metric-label">Son Gecilen Cizgi</span>
            <span><span class="metric-value" id="last-stripe" style="font-size:16px;">-</span></span>
          </div>
          <div class="metric">
            <span class="metric-label">Sonraki Cizgi</span>
            <span><span class="metric-value" id="next-stripe" style="font-size:16px;">-</span></span>
          </div>
          <div class="metric">
            <span class="metric-label">Aktif Bolge</span>
            <span><span class="metric-value" id="active-zone" style="font-size:13px; color:#00aaff;">-</span></span>
          </div>
        </div>

        <!-- Track Info Card -->
        <div class="panel-card">
          <h3>Ray Bilgisi</h3>
          <div class="metric">
            <span class="metric-label">Toplam Uzunluk</span>
            <span><span class="metric-value">${this.trackLength}</span><span class="metric-unit">m</span></span>
          </div>
          <div class="metric">
            <span class="metric-label">Veri Kaynagi</span>
            <span class="metric-value" style="font-size:13px; color:#0088ff;" id="data-source">Simulasyon</span>
          </div>
        </div>
      </div>

      <!-- Right Sensor Panel -->
      <div class="sensor-panel">
        <!-- Omron Sensor 1 (Front) -->
        <div class="panel-card">
          <div class="sensor-header">
            <div class="sensor-icon front">S1</div>
            <div>
              <h3 style="margin-bottom:0;">Omron Sensor 1 <span style="color:#00aaff;">(On)</span></h3>
              <span class="sensor-status idle" id="sensor1-status">Bekleniyor</span>
            </div>
          </div>
          <div class="metric">
            <span class="metric-label">Gecilen Cizgi No</span>
            <span class="stripe-number" id="sensor1-stripe-num">-<span class="stripe-total"></span></span>
          </div>
          <div class="metric">
            <span class="metric-label">Cizgi Konumu</span>
            <span><span class="metric-value" id="sensor1-stripe-pos" style="font-size:16px;">-</span></span>
          </div>
          <div class="metric">
            <span class="metric-label">Sonraki Cizgi</span>
            <span><span class="metric-value" id="sensor1-next" style="font-size:14px; color:#556677;">-</span></span>
          </div>
          <div class="metric">
            <span class="metric-label">Mesafe (Sonrakine)</span>
            <span><span class="metric-value" id="sensor1-dist" style="font-size:14px; color:#00aaff;">-</span></span>
          </div>
        </div>

        <!-- Omron Sensor 2 (Rear) -->
        <div class="panel-card">
          <div class="sensor-header">
            <div class="sensor-icon rear">S2</div>
            <div>
              <h3 style="margin-bottom:0;">Omron Sensor 2 <span style="color:#ffaa00;">(Arka)</span></h3>
              <span class="sensor-status idle" id="sensor2-status">Bekleniyor</span>
            </div>
          </div>
          <div class="metric">
            <span class="metric-label">Gecilen Cizgi No</span>
            <span class="stripe-number" id="sensor2-stripe-num">-<span class="stripe-total"></span></span>
          </div>
          <div class="metric">
            <span class="metric-label">Cizgi Konumu</span>
            <span><span class="metric-value" id="sensor2-stripe-pos" style="font-size:16px;">-</span></span>
          </div>
          <div class="metric">
            <span class="metric-label">Sonraki Cizgi</span>
            <span><span class="metric-value" id="sensor2-next" style="font-size:14px; color:#556677;">-</span></span>
          </div>
          <div class="metric">
            <span class="metric-label">Mesafe (Sonrakine)</span>
            <span><span class="metric-value" id="sensor2-dist" style="font-size:14px; color:#ffaa00;">-</span></span>
          </div>
        </div>
      </div>

      <!-- Bottom Control Bar -->
      <div class="control-bar">
        <button class="control-btn" id="btn-reset">Sifirla</button>
        <button class="control-btn" id="btn-start">Baslat</button>
        <button class="control-btn danger" id="btn-stop">Durdur</button>
        <button class="control-btn" id="btn-cockpit">Kokpit Modu [C]</button>
        <div class="sim-slider-container">
          <span class="metric-label" style="font-size:11px;">Konum:</span>
          <input type="range" class="sim-slider" id="sim-slider" min="0" max="${this.trackLength}" step="0.1" value="0" />
          <span class="sim-slider-value" id="sim-slider-value">0.0m</span>
        </div>
      </div>
    `;
  }

  cacheElements() {
    this.els = {
      speedValue: document.getElementById('speed-value'),
      posCurrent: document.getElementById('pos-current'),
      posRemaining: document.getElementById('pos-remaining'),
      posPercent: document.getElementById('pos-percent'),
      progressFill: document.getElementById('progress-fill'),
      simSlider: document.getElementById('sim-slider'),
      simSliderValue: document.getElementById('sim-slider-value'),
      btnReset: document.getElementById('btn-reset'),
      btnStart: document.getElementById('btn-start'),
      btnStop: document.getElementById('btn-stop'),
      dataSource: document.getElementById('data-source'),
      btnCockpit: document.getElementById('btn-cockpit'),
      lastStripe: document.getElementById('last-stripe'),
      nextStripe: document.getElementById('next-stripe'),
      activeZone: document.getElementById('active-zone'),
      // Sensor 1 (Front)
      sensor1Status: document.getElementById('sensor1-status'),
      sensor1StripeNum: document.getElementById('sensor1-stripe-num'),
      sensor1StripePos: document.getElementById('sensor1-stripe-pos'),
      sensor1Next: document.getElementById('sensor1-next'),
      sensor1Dist: document.getElementById('sensor1-dist'),
      // Sensor 2 (Rear)
      sensor2Status: document.getElementById('sensor2-status'),
      sensor2StripeNum: document.getElementById('sensor2-stripe-num'),
      sensor2StripePos: document.getElementById('sensor2-stripe-pos'),
      sensor2Next: document.getElementById('sensor2-next'),
      sensor2Dist: document.getElementById('sensor2-dist')
    };
  }

  setupEventListeners() {
    let lastPosition = 0;
    let lastTime = performance.now();

    // Listen for telemetry updates from 3D scene
    eventBus.on('vehicle:telemetry', (data) => {
      const now = performance.now();
      const dt = (now - lastTime) / 1000;

      // Calculate speed (m/s -> km/h)
      const speed = dt > 0 ? Math.abs(data.current - lastPosition) / dt * 3.6 : 0;
      lastPosition = data.current;
      lastTime = now;

      this.els.speedValue.textContent = speed.toFixed(0);
      this.els.posCurrent.textContent = data.current.toFixed(1);
      this.els.posRemaining.textContent = data.remaining.toFixed(1);
      this.els.posPercent.textContent = data.percentage.toFixed(1);
      this.els.progressFill.style.width = `${data.percentage}%`;

      // Update stripe info
      this.updateStripeInfo(data.current);
      this.updateSensorCards(data.current);
    });

    // Simulation slider
    this.els.simSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.els.simSliderValue.textContent = `${val.toFixed(1)}m`;
      eventBus.emit('plc:position', val);
    });

    // Simulation buttons
    this.simRunning = false;
    this.simPosition = 0;
    this.simSpeed = 30; // m/s

    this.els.btnStart.addEventListener('click', () => {
      this.simRunning = true;
      this.els.btnStart.classList.add('active');
    });

    this.els.btnStop.addEventListener('click', () => {
      this.simRunning = false;
      this.els.btnStart.classList.remove('active');
    });

    // Cockpit mode toggle
    this.els.btnCockpit.addEventListener('click', () => {
      eventBus.emit('cockpit:toggle');
    });

    eventBus.on('cockpit:state', (active) => {
      if (active) {
        this.els.btnCockpit.classList.add('active');
        this.els.btnCockpit.textContent = 'Dis Gorunum [C]';
      } else {
        this.els.btnCockpit.classList.remove('active');
        this.els.btnCockpit.textContent = 'Kokpit Modu [C]';
      }
    });

    // Keyboard shortcut: C key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'c' || e.key === 'C') {
        if (e.target.tagName === 'INPUT') return;
        eventBus.emit('cockpit:toggle');
      }
    });

    this.els.btnReset.addEventListener('click', () => {
      this.simRunning = false;
      this.simPosition = 0;
      this.els.simSlider.value = 0;
      this.els.simSliderValue.textContent = '0.0m';
      this.els.btnStart.classList.remove('active');
      eventBus.emit('plc:position', 0);
    });

    // Auto simulation loop
    let lastSim = performance.now();
    const simLoop = () => {
      const now = performance.now();
      const dt = (now - lastSim) / 1000;
      lastSim = now;

      if (this.simRunning) {
        this.simPosition += this.simSpeed * dt;
        if (this.simPosition >= this.trackLength) {
          this.simPosition = this.trackLength;
          this.simRunning = false;
          this.els.btnStart.classList.remove('active');
        }
        this.els.simSlider.value = this.simPosition;
        this.els.simSliderValue.textContent = `${this.simPosition.toFixed(1)}m`;
        eventBus.emit('plc:position', this.simPosition);
      }

      requestAnimationFrame(simLoop);
    };
    requestAnimationFrame(simLoop);
  }

  updateStripeInfo(currentPos) {
    const passed = this.stripePositions.filter(p => p <= currentPos);
    const upcoming = this.stripePositions.filter(p => p > currentPos);

    const lastStripe = passed.length > 0 ? passed[passed.length - 1] : null;
    const nextStripe = upcoming.length > 0 ? upcoming[0] : null;

    this.els.lastStripe.textContent = lastStripe !== null ? `${lastStripe}m` : '-';
    this.els.nextStripe.textContent = nextStripe !== null ? `${nextStripe}m` : '-';

    // Determine active zone
    let zone = '-';
    if (currentPos < 5) zone = 'Kapsul Alani';
    else if (currentPos < 11) zone = 'Baslangic';
    else if (currentPos < 91) zone = 'Bolum 1 (Kirmizi)';
    else if (currentPos < 95) zone = 'Son 100m Isaretcisi';
    else if (currentPos < 141) zone = 'Bolum 2 (Kirmizi+Sari)';
    else if (currentPos < 147) zone = 'Son 48m Isaretcisi';
    else if (currentPos < 191) zone = 'Bolum 3 (Kirmizi+Sari)';
    else if (currentPos < 208) zone = 'Acil Durdurma';
    else zone = 'Tunel Bitisi';

    this.els.activeZone.textContent = zone;
  }

  updateSensorCards(currentPos) {
    // Front sensor: 0.8m ahead of vehicle center
    // Rear sensor: 0.8m behind vehicle center
    const sensorOffsets = [0.8, -0.8];
    const sensorEls = [
      { status: this.els.sensor1Status, num: this.els.sensor1StripeNum, pos: this.els.sensor1StripePos, next: this.els.sensor1Next, dist: this.els.sensor1Dist },
      { status: this.els.sensor2Status, num: this.els.sensor2StripeNum, pos: this.els.sensor2StripePos, next: this.els.sensor2Next, dist: this.els.sensor2Dist }
    ];

    const totalStripes = this.stripePositions.length;

    sensorOffsets.forEach((offset, i) => {
      const sensorPos = currentPos + offset;
      const els = sensorEls[i];

      const passed = this.stripePositions.filter(p => p <= sensorPos);
      const upcoming = this.stripePositions.filter(p => p > sensorPos);

      const lastStripe = passed.length > 0 ? passed[passed.length - 1] : null;
      const nextStripe = upcoming.length > 0 ? upcoming[0] : null;
      const stripeIndex = passed.length;

      if (lastStripe !== null) {
        els.status.textContent = 'Okuyor';
        els.status.className = 'sensor-status reading';
        els.num.innerHTML = `${stripeIndex}<span class="stripe-total"> / ${totalStripes}</span>`;
        els.pos.textContent = `${lastStripe}m`;
      } else {
        els.status.textContent = 'Bekleniyor';
        els.status.className = 'sensor-status idle';
        els.num.innerHTML = `-<span class="stripe-total"></span>`;
        els.pos.textContent = '-';
      }

      if (nextStripe !== null) {
        els.next.textContent = `${nextStripe}m (#${stripeIndex + 1})`;
        const dist = (nextStripe - sensorPos).toFixed(1);
        els.dist.textContent = `${dist}m`;
      } else {
        els.next.textContent = '-';
        els.dist.textContent = '-';
      }
    });
  }

}
