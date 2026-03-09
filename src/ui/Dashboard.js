import { eventBus } from '../core/EventBus.js';

export class Dashboard {
  constructor(container) {
    this.container = container;
    this.trackLength = 208;

    // Regular stripe positions for tracking (only 'regular' type stripes)
    this.stripePositions = [];
    for (let m = 11; m <= 91; m += 4) this.stripePositions.push(m);
    for (let m = 95; m <= 141; m += 4) this.stripePositions.push(m);
    for (let m = 147; m <= 191; m += 4) this.stripePositions.push(m);

    // Simulated energy data
    this.batteryData = {
      voltage: 532.8,
      current: 0,
      soc: 100,
      cellTemps: [25, 25.2, 24.8, 25.1, 25.3, 24.9],
      cellTempHistory: Array(6).fill(null).map(() => Array(30).fill(25))
    };
    this.limData = {
      temp1: 28, temp2: 27.5, temp3: 28.2,
      tempHistory: Array(3).fill(null).map(() => Array(30).fill(28)),
      status: 'Hazir'
    };
    this.deltaFreq = 0;

    this.buildHTML();
    this.cacheElements();
    this.setupEventListeners();
    this.drawSpeedGauge(0);
    this.startEnergySimulation();
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

      <!-- Dashboard Layout -->
      <div class="dashboard-layout">

        <!-- LEFT COLUMN -->
        <div class="layout-column">

          <!-- Navigasyon Paneli -->
          <div class="section-group">
            <div class="section-title">Navigasyon</div>
            <div class="section-content">
              <div class="panel-card card-speed">
                <h3>Hiz</h3>
                <div class="speed-gauge-wrap">
                  <canvas id="speed-gauge" class="speed-gauge" width="260" height="190"></canvas>
                </div>
              </div>
              <div class="panel-card card-position">
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
            </div>
          </div>

          <!-- Sistem Bilgisi -->
          <div class="section-group">
            <div class="section-title">Sistem Bilgisi</div>
            <div class="section-content">
              <div class="panel-card card-track">
                <div class="metric">
                  <span class="metric-label">Ray Uzunlugu</span>
                  <span><span class="metric-value">${this.trackLength}</span><span class="metric-unit">m</span></span>
                </div>
                <div class="metric">
                  <span class="metric-label">Veri Kaynagi</span>
                  <span class="metric-value" style="font-size:13px; color:#0088ff;" id="data-source">Simulasyon</span>
                </div>
                <div class="metric">
                  <span class="metric-label">Aktif Bolge</span>
                  <span><span class="metric-value" id="active-zone" style="font-size:13px; color:#00aaff;">-</span></span>
                </div>
              </div>
            </div>
          </div>

        </div>

        <!-- CENTER COLUMN -->
        <div class="layout-column">

          <!-- Canli Goruntu -->
          <div class="section-group">
            <div class="section-title">
              Canli Goruntu
              <span class="cam-status-badge" id="cam-status-badge">
                <span class="status-dot"></span> Baglanti Bekleniyor
              </span>
            </div>
            <div class="section-content">
              <div class="panel-card card-camera">
                <div class="camera-viewport" id="camera-viewport">
                  <div class="camera-placeholder">
                    <div class="camera-icon">&#9881;</div>
                    <span>IP Kamera Yayin Bekleniyor</span>
                    <span class="camera-hint">RTSP / PoE baglantisi gerekli</span>
                  </div>
                </div>
                <div class="camera-controls">
                  <div class="camera-info">
                    <div class="metric">
                      <span class="metric-label">Protokol</span>
                      <span class="metric-value" style="font-size:11px; color:#0088ff;">RTSP / PoE</span>
                    </div>
                    <div class="metric">
                      <span class="metric-label">Cozunurluk</span>
                      <span class="metric-value" style="font-size:11px;" id="cam-resolution">720p</span>
                    </div>
                  </div>
                  <div class="camera-brightness">
                    <span class="metric-label" style="font-size:10px;">Parlaklik</span>
                    <input type="range" class="cam-slider" id="cam-brightness" min="0" max="200" value="100" />
                    <span class="metric-value" style="font-size:11px;" id="cam-brightness-val">100%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Enerji & Batarya Paneli -->
          <div class="section-group">
            <div class="section-title">Enerji & Batarya</div>
            <div class="section-content">
              <div class="panel-card card-battery">
                <h3>Batarya Durumu <span class="card-badge">14.10 kg</span></h3>
                <div class="energy-big-row">
                  <div class="energy-big">
                    <span class="energy-big-value" id="bat-voltage">532.8</span>
                    <span class="energy-big-unit">V</span>
                  </div>
                  <div class="energy-big">
                    <span class="energy-big-value" id="bat-current">0.0</span>
                    <span class="energy-big-unit">A</span>
                  </div>
                  <div class="energy-big">
                    <span class="energy-big-value" id="bat-soc" style="font-size:22px;">100</span>
                    <span class="energy-big-unit">% SoC</span>
                  </div>
                </div>
                <div class="temp-chart-label">Hucre Sicakliklari (6 Hucre)</div>
                <canvas id="bat-temp-chart" class="temp-chart" width="360" height="70"></canvas>
                <div class="threshold-legend">
                  <span class="threshold-line-icon"></span> Kritik Esik: 60°C
                </div>
              </div>
            </div>
          </div>

          <!-- Motor Kontrol Paneli -->
          <div class="section-group">
            <div class="section-title">Motor Kontrol</div>
            <div class="section-content">
              <div class="panel-card card-lim">
                <h3>LIM Motor <span class="card-badge">28.80 kg</span></h3>
                <div class="motor-status-row">
                  <div class="metric">
                    <span class="metric-label">Durum</span>
                    <span class="metric-value" id="lim-status" style="font-size:13px; color:#00cc66;">Hazir</span>
                  </div>
                  <div class="metric">
                    <span class="metric-label">Delta Surucu</span>
                    <span class="energy-big" style="gap:2px;">
                      <span class="energy-big-value" id="delta-freq" style="font-size:22px;">0.0</span>
                      <span class="energy-big-unit">Hz</span>
                    </span>
                  </div>
                </div>
                <div class="temp-chart-label">Sargi Sicakliklari (3 Faz)</div>
                <canvas id="lim-temp-chart" class="temp-chart" width="360" height="70"></canvas>
                <div class="threshold-legend">
                  <span class="threshold-line-icon"></span> Kritik Esik: 80°C
                </div>
              </div>
            </div>
          </div>

        </div>

        <!-- RIGHT COLUMN -->
        <div class="layout-column">

          <!-- Sensor Paneli -->
          <div class="section-group">
            <div class="section-title">Sensor Verileri</div>
            <div class="section-content">
              <div class="panel-card card-omron">
                <h3>Omron Cizgi Bilgisi</h3>
                <div class="metric">
                  <span class="metric-label">Son Gecilen Cizgi</span>
                  <span><span class="metric-value" id="last-stripe" style="font-size:16px;">-</span></span>
                </div>
                <div class="metric">
                  <span class="metric-label">Sonraki Cizgi</span>
                  <span><span class="metric-value" id="next-stripe" style="font-size:16px;">-</span></span>
                </div>
              </div>
              <div class="sensor-cards-row">
                <div class="panel-card card-sensor">
                  <div class="sensor-header">
                    <div class="sensor-icon front">S1</div>
                    <div>
                      <h3 style="margin-bottom:0;">Sensor 1 <span style="color:#00aaff;">(On)</span></h3>
                      <span class="sensor-status idle" id="sensor1-status">Bekleniyor</span>
                    </div>
                  </div>
                  <div class="metric">
                    <span class="metric-label">Cizgi</span>
                    <span class="stripe-number" id="sensor1-stripe-num">-<span class="stripe-total"></span></span>
                  </div>
                  <div class="metric">
                    <span class="metric-label">Konum</span>
                    <span><span class="metric-value" id="sensor1-stripe-pos" style="font-size:14px;">-</span></span>
                  </div>
                  <div class="metric">
                    <span class="metric-label">Sonraki</span>
                    <span><span class="metric-value" id="sensor1-next" style="font-size:12px; color:#556677;">-</span></span>
                  </div>
                  <div class="metric">
                    <span class="metric-label">Mesafe</span>
                    <span><span class="metric-value" id="sensor1-dist" style="font-size:12px; color:#00aaff;">-</span></span>
                  </div>
                </div>
                <div class="panel-card card-sensor">
                  <div class="sensor-header">
                    <div class="sensor-icon rear">S2</div>
                    <div>
                      <h3 style="margin-bottom:0;">Sensor 2 <span style="color:#ffaa00;">(Arka)</span></h3>
                      <span class="sensor-status idle" id="sensor2-status">Bekleniyor</span>
                    </div>
                  </div>
                  <div class="metric">
                    <span class="metric-label">Cizgi</span>
                    <span class="stripe-number" id="sensor2-stripe-num">-<span class="stripe-total"></span></span>
                  </div>
                  <div class="metric">
                    <span class="metric-label">Konum</span>
                    <span><span class="metric-value" id="sensor2-stripe-pos" style="font-size:14px;">-</span></span>
                  </div>
                  <div class="metric">
                    <span class="metric-label">Sonraki</span>
                    <span><span class="metric-value" id="sensor2-next" style="font-size:12px; color:#556677;">-</span></span>
                  </div>
                  <div class="metric">
                    <span class="metric-label">Mesafe</span>
                    <span><span class="metric-value" id="sensor2-dist" style="font-size:12px; color:#ffaa00;">-</span></span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>

      <!-- Bottom Control Bar -->
      <div class="control-bar">
        <button class="control-btn" id="btn-reset">Sifirla</button>
        <button class="control-btn" id="btn-start">Baslat</button>
        <button class="control-btn danger" id="btn-stop">Durdur</button>
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
      speedGauge: document.getElementById('speed-gauge'),
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
      lastStripe: document.getElementById('last-stripe'),
      nextStripe: document.getElementById('next-stripe'),
      activeZone: document.getElementById('active-zone'),
      // Sensors
      sensor1Status: document.getElementById('sensor1-status'),
      sensor1StripeNum: document.getElementById('sensor1-stripe-num'),
      sensor1StripePos: document.getElementById('sensor1-stripe-pos'),
      sensor1Next: document.getElementById('sensor1-next'),
      sensor1Dist: document.getElementById('sensor1-dist'),
      sensor2Status: document.getElementById('sensor2-status'),
      sensor2StripeNum: document.getElementById('sensor2-stripe-num'),
      sensor2StripePos: document.getElementById('sensor2-stripe-pos'),
      sensor2Next: document.getElementById('sensor2-next'),
      sensor2Dist: document.getElementById('sensor2-dist'),
      // Energy
      batVoltage: document.getElementById('bat-voltage'),
      batCurrent: document.getElementById('bat-current'),
      batSoc: document.getElementById('bat-soc'),
      batTempChart: document.getElementById('bat-temp-chart'),
      limStatus: document.getElementById('lim-status'),
      limTempChart: document.getElementById('lim-temp-chart'),
      deltaFreq: document.getElementById('delta-freq'),
      // Camera
      camViewport: document.getElementById('camera-viewport'),
      camBrightness: document.getElementById('cam-brightness'),
      camBrightnessVal: document.getElementById('cam-brightness-val'),
      camStatusBadge: document.getElementById('cam-status-badge')
    };
  }

  setupEventListeners() {
    let lastPosition = 0;
    let lastTime = performance.now();

    eventBus.on('vehicle:telemetry', (data) => {
      const now = performance.now();
      const dt = (now - lastTime) / 1000;
      const speed = dt > 0 ? Math.abs(data.current - lastPosition) / dt * 3.6 : 0;
      lastPosition = data.current;
      lastTime = now;

      this.drawSpeedGauge(speed);
      this.els.posCurrent.textContent = data.current.toFixed(1);
      this.els.posRemaining.textContent = data.remaining.toFixed(1);
      this.els.posPercent.textContent = data.percentage.toFixed(1);
      this.els.progressFill.style.width = `${data.percentage}%`;

      this.updateStripeInfo(data.current);
      this.updateSensorCards(data.current);
      this.updateEnergyFromSpeed(speed, data.percentage);
    });

    // Camera brightness slider
    this.els.camBrightness.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      this.els.camBrightnessVal.textContent = `${val}%`;
      this.els.camViewport.style.filter = `brightness(${val / 100})`;
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
    this.simSpeed = 30;

    this.els.btnStart.addEventListener('click', () => {
      this.simRunning = true;
      this.els.btnStart.classList.add('active');
    });

    this.els.btnStop.addEventListener('click', () => {
      this.simRunning = false;
      this.els.btnStart.classList.remove('active');
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

  // Placeholder energy values - will be replaced with real PLC data
  updateEnergyFromSpeed(speed, percentage) {
    const speedFactor = speed / 120;
    this.lastSpeedFactor = speedFactor;

    this.batteryData.current = speedFactor * 85;
    this.batteryData.voltage = 532.8 - speedFactor * 12;
    this.batteryData.soc = Math.max(0, 100 - percentage * 0.4);
    this.limData.status = speedFactor > 0.1 ? 'Calisiyor' : 'Hazir';
    this.deltaFreq = speedFactor * 60;

    this.els.batVoltage.textContent = this.batteryData.voltage.toFixed(1);
    this.els.batCurrent.textContent = this.batteryData.current.toFixed(1);
    this.els.batSoc.textContent = this.batteryData.soc.toFixed(0);
    this.els.limStatus.textContent = this.limData.status;
    this.els.limStatus.style.color = this.limData.status === 'Calisiyor' ? '#00cc66' : '#778899';
    this.els.deltaFreq.textContent = this.deltaFreq.toFixed(1);
  }

  startEnergySimulation() {
    this.lastSpeedFactor = 0;

    // Push new data point every 1 second, then redraw charts
    setInterval(() => {
      const sf = this.lastSpeedFactor;

      for (let i = 0; i < 6; i++) {
        this.batteryData.cellTemps[i] = 25 + sf * 18;
        this.batteryData.cellTempHistory[i].push(this.batteryData.cellTemps[i]);
        if (this.batteryData.cellTempHistory[i].length > 30) this.batteryData.cellTempHistory[i].shift();
      }

      const limTemps = [this.limData.temp1, this.limData.temp2, this.limData.temp3];
      for (let i = 0; i < 3; i++) {
        limTemps[i] = 28 + sf * 30;
        this.limData.tempHistory[i].push(limTemps[i]);
        if (this.limData.tempHistory[i].length > 30) this.limData.tempHistory[i].shift();
      }
      this.limData.temp1 = limTemps[0];
      this.limData.temp2 = limTemps[1];
      this.limData.temp3 = limTemps[2];

      // Redraw charts
      this.drawTempChart(
        this.els.batTempChart,
        this.batteryData.cellTempHistory,
        ['#ff4466', '#ff6644', '#ffaa22', '#44aaff', '#44ff88', '#aa44ff'],
        60, 20, 50
      );
      this.drawTempChart(
        this.els.limTempChart,
        this.limData.tempHistory,
        ['#ff4466', '#ffaa22', '#44aaff'],
        80, 20, 70
      );
    }, 1000);
  }

  drawSpeedGauge(speed) {
    const canvas = this.els.speedGauge;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2 + 12;
    const maxSpeed = 150;
    // 240-degree arc: from 150° to 390° (= 30°)
    const sweepDeg = 240;
    const gapDeg = (360 - sweepDeg) / 2;
    const startAngle = (90 + gapDeg) * Math.PI / 180;
    const endAngle = startAngle + sweepDeg * Math.PI / 180;
    const speedRatio = Math.min(speed / maxSpeed, 1);
    const needleAngle = startAngle + speedRatio * (endAngle - startAngle);
    const sweep = endAngle - startAngle;

    // Timestamp for subtle animations
    if (!this._gaugeTime) this._gaugeTime = 0;
    this._gaugeTime += 0.02;
    const t_anim = this._gaugeTime;

    // === Layer 1: Ambient radial glow behind gauge ===
    const ambGlow = ctx.createRadialGradient(cx, cy, 20, cx, cy, 110);
    ambGlow.addColorStop(0, 'rgba(0, 100, 200, 0.06)');
    ambGlow.addColorStop(0.5, 'rgba(0, 60, 140, 0.03)');
    ambGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.beginPath();
    ctx.arc(cx, cy, 110, 0, Math.PI * 2);
    ctx.fillStyle = ambGlow;
    ctx.fill();

    // === Layer 2: Outermost decorative micro-tick ring ===
    const rMicro = 88;
    for (let i = 0; i < 80; i++) {
      const t = i / 80;
      const angle = startAngle + t * sweep;
      const len = (i % 4 === 0) ? 4 : 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * rMicro, cy + Math.sin(angle) * rMicro);
      ctx.lineTo(cx + Math.cos(angle) * (rMicro + len), cy + Math.sin(angle) * (rMicro + len));
      ctx.strokeStyle = (i % 4 === 0) ? 'rgba(0, 180, 255, 0.2)' : 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // === Layer 3: Outer dashed decorative ring ===
    const rOuter = 84;
    ctx.save();
    ctx.setLineDash([1.5, 6]);
    ctx.beginPath();
    ctx.arc(cx, cy, rOuter, startAngle, endAngle);
    ctx.strokeStyle = 'rgba(0, 170, 255, 0.15)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.restore();

    // === Layer 4: Main arc background with glow ===
    const rMain = 74;
    ctx.save();
    ctx.shadowColor = 'rgba(0, 100, 200, 0.2)';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(cx, cy, rMain, startAngle, endAngle);
    ctx.strokeStyle = 'rgba(0, 100, 200, 0.04)';
    ctx.lineWidth = 16;
    ctx.stroke();
    ctx.restore();

    // === Layer 5: Segmented background track ===
    const totalSegs = 48;
    const segGap = 0.008;
    for (let i = 0; i < totalSegs; i++) {
      const t0 = i / totalSegs;
      const t1 = (i + 1) / totalSegs;
      const a1 = startAngle + t0 * sweep + segGap;
      const a2 = startAngle + t1 * sweep - segGap;
      ctx.beginPath();
      ctx.arc(cx, cy, rMain, a1, a2);
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.lineWidth = 14;
      ctx.lineCap = 'butt';
      ctx.stroke();
    }

    // === Layer 6: Active segmented arc with dynamic color + neon glow ===
    for (let i = 0; i < totalSegs; i++) {
      const t = i / totalSegs;
      if (t > speedRatio) break;
      const a1 = startAngle + t * sweep + segGap;
      const a2 = startAngle + ((i + 1) / totalSegs) * sweep - segGap;

      // Color zones: cyan -> blue -> purple -> red
      let r, g, b;
      if (t < 0.3) {
        const p = t / 0.3;
        r = 0; g = Math.round(220 + p * 35); b = Math.round(160 + p * 40);
      } else if (t < 0.55) {
        const p = (t - 0.3) / 0.25;
        r = 0; g = Math.round(255 - p * 80); b = 255;
      } else if (t < 0.8) {
        const p = (t - 0.55) / 0.25;
        r = Math.round(p * 180); g = Math.round(175 - p * 100); b = Math.round(255 - p * 30);
      } else {
        const p = (t - 0.8) / 0.2;
        r = Math.round(180 + p * 75); g = Math.round(75 - p * 55); b = Math.round(225 - p * 160);
      }

      // Brightness pulse near tip
      const distFromTip = Math.abs(t - speedRatio);
      const pulse = distFromTip < 0.06 ? 1 + (1 - distFromTip / 0.06) * 0.4 : 1;

      ctx.save();
      ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.7)`;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(cx, cy, rMain, a1, a2);
      ctx.strokeStyle = `rgba(${Math.min(255, Math.round(r * pulse))}, ${Math.min(255, Math.round(g * pulse))}, ${Math.min(255, Math.round(b * pulse))}, 1)`;
      ctx.lineWidth = 14;
      ctx.lineCap = 'butt';
      ctx.stroke();
      ctx.restore();
    }

    // === Layer 7: Inner decorative ring ===
    const rInner = 62;
    ctx.beginPath();
    ctx.arc(cx, cy, rInner, startAngle, endAngle);
    ctx.strokeStyle = 'rgba(0, 170, 255, 0.06)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Second inner ring
    ctx.beginPath();
    ctx.arc(cx, cy, rInner - 3, startAngle, endAngle);
    ctx.strokeStyle = 'rgba(0, 170, 255, 0.03)';
    ctx.lineWidth = 0.3;
    ctx.stroke();

    // === Layer 8: Major tick marks + speed labels ===
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const angle = startAngle + t * sweep;
      const outer = rMain + 8;
      const inner = rMain - 8;

      // Major tick - glowing line
      ctx.save();
      ctx.shadowColor = 'rgba(0, 200, 255, 0.3)';
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
      ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
      ctx.strokeStyle = 'rgba(0, 200, 255, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      // Speed label
      const labelR = rMain + 16;
      const label = Math.round(maxSpeed * t);
      ctx.fillStyle = 'rgba(0, 200, 255, 0.55)';
      ctx.font = 'bold 9px "Segoe UI"';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, cx + Math.cos(angle) * labelR, cy + Math.sin(angle) * labelR);
    }

    // Minor ticks
    for (let i = 0; i <= 30; i++) {
      if (i % 5 === 0) continue;
      const t = i / 30;
      const angle = startAngle + t * sweep;
      const outer = rMain + 3;
      const inner = rMain - 3;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
      ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // === Layer 9: Scanning sweep line (animated) ===
    const scanAngle = startAngle + ((t_anim * 0.3) % 1) * sweep;
    const scanLen = 50;
    for (let i = 0; i < scanLen; i++) {
      const t = i / scanLen;
      const a = scanAngle - t * 0.3;
      if (a < startAngle) break;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (rInner + 2), cy + Math.sin(a) * (rInner + 2));
      ctx.lineTo(cx + Math.cos(a) * (rMain - 2), cy + Math.sin(a) * (rMain - 2));
      ctx.strokeStyle = `rgba(0, 200, 255, ${0.08 * (1 - t)})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // === Layer 10: Glowing orb at active arc tip ===
    if (speedRatio > 0.01) {
      const tipAngle = startAngle + speedRatio * sweep;
      const tipX = cx + Math.cos(tipAngle) * rMain;
      const tipY = cy + Math.sin(tipAngle) * rMain;

      // Outer glow
      const glow1 = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, 18);
      glow1.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
      glow1.addColorStop(0.2, 'rgba(0, 220, 255, 0.5)');
      glow1.addColorStop(0.5, 'rgba(0, 150, 255, 0.15)');
      glow1.addColorStop(1, 'rgba(0, 100, 255, 0)');
      ctx.beginPath();
      ctx.arc(tipX, tipY, 18, 0, Math.PI * 2);
      ctx.fillStyle = glow1;
      ctx.fill();

      // Core dot
      ctx.beginPath();
      ctx.arc(tipX, tipY, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }

    // === Layer 11: Triangle needle ===
    const needleLen = rInner - 2;
    const nx = cx + Math.cos(needleAngle) * needleLen;
    const ny = cy + Math.sin(needleAngle) * needleLen;

    // Needle glow trail
    ctx.save();
    ctx.shadowColor = 'rgba(0, 200, 255, 0.5)';
    ctx.shadowBlur = 14;

    // Triangle needle shape
    const perpAngle = needleAngle + Math.PI / 2;
    const baseW = 4;
    ctx.beginPath();
    ctx.moveTo(nx, ny); // tip
    ctx.lineTo(cx + Math.cos(perpAngle) * baseW, cy + Math.sin(perpAngle) * baseW);
    ctx.lineTo(cx - Math.cos(perpAngle) * baseW, cy - Math.sin(perpAngle) * baseW);
    ctx.closePath();

    const needleGrad = ctx.createLinearGradient(cx, cy, nx, ny);
    needleGrad.addColorStop(0, 'rgba(0, 150, 255, 0.3)');
    needleGrad.addColorStop(0.7, 'rgba(200, 230, 255, 0.8)');
    needleGrad.addColorStop(1, '#ffffff');
    ctx.fillStyle = needleGrad;
    ctx.fill();
    ctx.restore();

    // Needle edge highlight
    ctx.beginPath();
    ctx.moveTo(nx, ny);
    ctx.lineTo(cx + Math.cos(perpAngle) * baseW, cy + Math.sin(perpAngle) * baseW);
    ctx.strokeStyle = 'rgba(0, 200, 255, 0.3)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // === Layer 12: Center hub (multi-ring) ===
    // Outer ring glow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 200, 255, 0.4)';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 15, 30, 0.95)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 170, 255, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // Inner ring
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 200, 255, 0.3)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Core
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    const corePulse = 0.7 + 0.3 * Math.sin(t_anim * 3);
    ctx.fillStyle = `rgba(0, 220, 255, ${corePulse})`;
    ctx.fill();

    // Hub glow
    const hubGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 20);
    hubGlow.addColorStop(0, 'rgba(0, 200, 255, 0.2)');
    hubGlow.addColorStop(1, 'rgba(0, 200, 255, 0)');
    ctx.beginPath();
    ctx.arc(cx, cy, 20, 0, Math.PI * 2);
    ctx.fillStyle = hubGlow;
    ctx.fill();

    // === Layer 13: Digital speed readout ===
    ctx.save();
    ctx.textAlign = 'center';

    // Large speed number
    ctx.shadowColor = 'rgba(0, 200, 255, 0.9)';
    ctx.shadowBlur = 16;
    ctx.font = 'bold 32px "Segoe UI"';
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(Math.round(speed), cx, cy - 20);

    // km/h label
    ctx.shadowBlur = 0;
    ctx.font = '600 10px "Segoe UI"';
    ctx.fillStyle = 'rgba(0, 200, 255, 0.7)';
    ctx.fillText('km/h', cx, cy - 10);
    ctx.restore();

    // === Layer 14: Status zone indicator at bottom ===
    let zoneText, zoneColor;
    if (speedRatio < 0.4) {
      zoneText = 'NORMAL';
      zoneColor = 'rgba(0, 220, 150, 0.7)';
    } else if (speedRatio < 0.7) {
      zoneText = 'HIZ';
      zoneColor = 'rgba(0, 180, 255, 0.7)';
    } else {
      zoneText = 'MAKSIMUM';
      zoneColor = 'rgba(255, 80, 80, 0.8)';
    }

    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 7px "Segoe UI"';
    ctx.letterSpacing = '2px';
    ctx.fillStyle = zoneColor;
    ctx.fillText(zoneText, cx, cy + 18);
    ctx.restore();

    // === Layer 15: Decorative corner data markers ===
    ctx.save();
    ctx.font = '7px "Segoe UI"';
    ctx.fillStyle = 'rgba(0, 170, 255, 0.25)';
    ctx.textAlign = 'left';
    ctx.fillText('MAX ' + maxSpeed, 6, 12);
    ctx.textAlign = 'right';
    ctx.fillText('HLR-01', w - 6, 12);
    ctx.restore();
  }

  drawTempChart(canvas, histories, colors, threshold, minY, maxY) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 4; i++) {
      const y = (i / 3) * h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Threshold line
    const thresholdY = h - ((threshold - minY) / (maxY - minY)) * h;
    ctx.strokeStyle = '#ff2222';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(0, thresholdY);
    ctx.lineTo(w, thresholdY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw lines
    histories.forEach((data, idx) => {
      ctx.strokeStyle = colors[idx];
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      data.forEach((val, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = h - ((val - minY) / (maxY - minY)) * h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });
  }

  updateStripeInfo(currentPos) {
    const passed = this.stripePositions.filter(p => p <= currentPos);
    const upcoming = this.stripePositions.filter(p => p > currentPos);

    const lastStripe = passed.length > 0 ? passed[passed.length - 1] : null;
    const nextStripe = upcoming.length > 0 ? upcoming[0] : null;

    this.els.lastStripe.textContent = lastStripe !== null ? `${lastStripe}m` : '-';
    this.els.nextStripe.textContent = nextStripe !== null ? `${nextStripe}m` : '-';

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
