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

    // BNO055 IMU data (populated by real sensor via eventBus)
    this.bnoData = {
      calSys: 0, calGyro: 0, calAccel: 0, calMag: 0,
      accelX: null, velocity: null, position: null,
      roll: null, pitch: null, yaw: null,
      gyroX: null, gyroY: null, gyroZ: null,
      temp: null
    };
    this.bnoConnected = false;
    this.useOmronForPosition = true;

    // Fren sistemi (4 piston: 2 ön, 2 arka)
    // 2 röle + 2 valf: Röle1+Valf1 = ön frenler, Röle2+Valf2 = arka frenler
    // Fren serbest olması için hem röle hem valf açık olmalı
    this.brakeData = {
      relay1: true, valve1: true, // Ön frenler (serbest)
      relay2: true, valve2: true  // Arka frenler (serbest)
    };

    this.buildHTML();
    this.cacheElements();
    this.setupEventListeners();
    this.drawSpeedGauge(0);
    this.drawBrakeVisual();
    this.startEnergySimulation();
  }

  buildHTML() {
    this.container.innerHTML = `
      <!-- Top Bar -->
      <div class="top-bar">
        <span class="logo">Hyperloop Control</span>
        <div class="status-badge waiting" id="status-badge">
          <span class="status-dot"></span>
          <span id="status-text">Beklemede</span>
        </div>
      </div>

      <!-- Dashboard Layout -->
      <div class="dashboard-layout">

        <!-- LEFT COLUMN -->
        <div class="layout-column">

          <!-- Navigasyon Paneli -->
          <div class="section-group theme-nav">
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
          <div class="section-group theme-system">
            <div class="section-title">Sistem Bilgisi</div>
            <div class="section-content">
              <div class="panel-card card-track">
                <div class="metric">
                  <span class="metric-label">Ray Uzunlugu</span>
                  <span><span class="metric-value">${this.trackLength}</span><span class="metric-unit">m</span></span>
                </div>
                <div class="metric">
                  <span class="metric-label">Veri Kaynagi</span>
                  <span class="status-indicator warning" id="data-source">Simulasyon</span>
                </div>
                <div class="metric">
                  <span class="metric-label">PLC Baglanti</span>
                  <span class="status-indicator warning" id="plc-status">Bagli Degil</span>
                </div>
                <div class="metric">
                  <span class="metric-label">Aktif Bolge</span>
                  <span><span class="metric-value" id="active-zone" style="font-size:13px;">-</span></span>
                </div>
              </div>
            </div>
          </div>

        </div>

        <!-- COLUMN 2: Sensor Verileri -->
        <div class="layout-column">

          <!-- Sensor Paneli -->
          <div class="section-group theme-sensor">
            <div class="section-title">Sensor Verileri</div>
            <div class="section-content">
              <div class="sensor-cards-row">
                <div class="panel-card card-sensor">
                  <div class="sensor-header">
                    <div class="sensor-icon front">O1</div>
                    <div>
                      <h3 style="margin-bottom:0;">Omron 1</h3>
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
                    <div class="sensor-icon rear">O2</div>
                    <div>
                      <h3 style="margin-bottom:0;">Omron 2</h3>
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
              <div class="panel-card card-comparison" id="sensor-comparison">
                <h3>Sensor Karsilastirma</h3>
                <div class="comparison-status" id="comp-status">
                  <span class="comp-icon" id="comp-icon">&#10003;</span>
                  <span id="comp-text">Veri Bekleniyor</span>
                </div>
                <div class="comparison-details">
                  <div class="metric">
                    <span class="metric-label">Omron 1 Konum</span>
                    <span><span class="metric-value" id="comp-pos1" style="font-size:13px;">-</span></span>
                  </div>
                  <div class="metric">
                    <span class="metric-label">Omron 2 Konum</span>
                    <span><span class="metric-value" id="comp-pos2" style="font-size:13px;">-</span></span>
                  </div>
                  <div class="metric">
                    <span class="metric-label">Fark</span>
                    <span><span class="metric-value" id="comp-diff" style="font-size:13px;">-</span></span>
                  </div>
                  <div class="metric">
                    <span class="metric-label">Sapma</span>
                    <span><span class="metric-value" id="comp-percent" style="font-size:13px;">-</span></span>
                  </div>
                </div>
              </div>
              <div class="panel-card card-bno" id="bno-card">
                <h3>BNO055 IMU <span class="status-indicator warning" id="bno-status">Bagli Degil</span></h3>
                <div class="bno-calib-row">
                  <div class="bno-calib-item">
                    <span class="metric-label">Sistem</span>
                    <span class="bno-calib-value" id="bno-cal-sys">0</span>
                    <div class="bno-calib-bar"><div class="bno-calib-fill" id="bno-cal-sys-bar" style="width:0%"></div></div>
                  </div>
                  <div class="bno-calib-item">
                    <span class="metric-label">Jiroskop</span>
                    <span class="bno-calib-value" id="bno-cal-gyro">0</span>
                    <div class="bno-calib-bar"><div class="bno-calib-fill" id="bno-cal-gyro-bar" style="width:0%"></div></div>
                  </div>
                  <div class="bno-calib-item">
                    <span class="metric-label">Ivme</span>
                    <span class="bno-calib-value" id="bno-cal-accel">0</span>
                    <div class="bno-calib-bar"><div class="bno-calib-fill" id="bno-cal-accel-bar" style="width:0%"></div></div>
                  </div>
                  <div class="bno-calib-item">
                    <span class="metric-label">Pusula</span>
                    <span class="bno-calib-value" id="bno-cal-mag">0</span>
                    <div class="bno-calib-bar"><div class="bno-calib-fill" id="bno-cal-mag-bar" style="width:0%"></div></div>
                  </div>
                </div>
                <div class="bno-data-grid">
                  <div class="metric">
                    <span class="metric-label">Dogrusal Ivme X</span>
                    <span><span class="metric-value" id="bno-accel-x" style="font-size:13px;">-</span><span class="metric-unit">m/s²</span></span>
                  </div>
                  <div class="metric">
                    <span class="metric-label">Hiz (BNO)</span>
                    <span><span class="metric-value" id="bno-velocity" style="font-size:13px;">-</span><span class="metric-unit">m/s</span></span>
                  </div>
                  <div class="metric">
                    <span class="metric-label">Konum (BNO)</span>
                    <span><span class="metric-value" id="bno-position" style="font-size:13px;">-</span><span class="metric-unit">m</span></span>
                  </div>
                  <div class="metric">
                    <span class="metric-label">Yuvarlama</span>
                    <span><span class="metric-value" id="bno-roll" style="font-size:13px;">-</span><span class="metric-unit">°</span></span>
                  </div>
                  <div class="metric">
                    <span class="metric-label">Egilim</span>
                    <span><span class="metric-value" id="bno-pitch" style="font-size:13px;">-</span><span class="metric-unit">°</span></span>
                  </div>
                  <div class="metric">
                    <span class="metric-label">Sapma</span>
                    <span><span class="metric-value" id="bno-yaw" style="font-size:13px;">-</span><span class="metric-unit">°</span></span>
                  </div>
                  <div class="metric">
                    <span class="metric-label">Jiroskop X / Y / Z</span>
                    <span><span class="metric-value" id="bno-gyro" style="font-size:11px;">- / - / -</span></span>
                  </div>
                  <div class="metric">
                    <span class="metric-label">Sicaklik</span>
                    <span><span class="metric-value" id="bno-temp" style="font-size:13px;">-</span><span class="metric-unit">°C</span></span>
                  </div>
                </div>
                <div class="bno-source-indicator">
                  <span class="metric-label">Aktif Konum Kaynagi</span>
                  <span class="status-indicator ok" id="pos-source">Omron</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        <!-- COLUMN 3: Enerji -->
        <div class="layout-column">

          <!-- Batarya Paketi - 144S1P -->
          <div class="section-group theme-energy">
            <div class="section-title">Batarya Paketi (144S1P)</div>
            <div class="section-content">
              <div class="panel-card card-battery">
                <h3>144 Hucre <span class="card-badge">LIM Motor</span> <span class="status-indicator ok" id="bat-status">Normal</span></h3>
                <div class="energy-big-row">
                  <div class="energy-big">
                    <span class="energy-big-value" id="bat-voltage">532.8</span>
                    <span class="energy-big-unit">V</span>
                    <span class="metric-label">Paket Voltaj</span>
                  </div>
                  <div class="energy-big">
                    <span class="energy-big-value" id="bat-current">0.0</span>
                    <span class="energy-big-unit">A</span>
                    <span class="metric-label">Akim</span>
                  </div>
                  <div class="energy-big">
                    <span class="energy-big-value" id="bat-power">0.0</span>
                    <span class="energy-big-unit">kW</span>
                    <span class="metric-label">Guc</span>
                  </div>
                </div>
                <div class="energy-big-row" style="margin-top:2px;">
                  <div class="energy-big">
                    <span class="energy-big-value" id="bat-soc" style="font-size:20px;">100</span>
                    <span class="energy-big-unit">%</span>
                    <span class="metric-label">SoC</span>
                  </div>
                  <div class="energy-big">
                    <span class="energy-big-value" id="bat-energy" style="font-size:20px;">0.0</span>
                    <span class="energy-big-unit">Wh</span>
                    <span class="metric-label">Tuketim</span>
                  </div>
                </div>
                <div class="bat-cell-grid">
                  <div class="metric">
                    <span class="metric-label">Min Hucre</span>
                    <span><span class="metric-value" id="bat-cell-min">3.70</span><span class="metric-unit">V</span></span>
                  </div>
                  <div class="metric">
                    <span class="metric-label">Max Hucre</span>
                    <span><span class="metric-value" id="bat-cell-max">3.70</span><span class="metric-unit">V</span></span>
                  </div>
                  <div class="metric">
                    <span class="metric-label">Ort Hucre</span>
                    <span><span class="metric-value" id="bat-cell-avg">3.70</span><span class="metric-unit">V</span></span>
                  </div>
                  <div class="metric">
                    <span class="metric-label">Fark (ΔV)</span>
                    <span class="status-indicator ok" id="bat-cell-delta">0.00V</span>
                  </div>
                  <div class="metric">
                    <span class="metric-label">Dengeleme</span>
                    <span class="status-indicator warning" id="bat-balance">Pasif</span>
                  </div>
                  <div class="metric">
                    <span class="metric-label">Pre-charge</span>
                    <span class="status-indicator warning" id="bat-precharge">Bekliyor</span>
                  </div>
                </div>
                <div class="bat-temp-section">
                  <canvas id="bat-temp-heatmap" class="bat-heatmap" width="280" height="100"></canvas>
                </div>
                <div class="bat-contactor-row">
                  <button class="bat-contactor-btn" id="bat-contactor-btn">Kontaktor: KAPALI</button>
                  <button class="bat-emergency-btn" id="bat-emergency-btn">ACIL KES</button>
                </div>
              </div>
            </div>
          </div>

        </div>

        <!-- COLUMN 4: Lineer Motor Sürücüsü + Fren -->
        <div class="layout-column">

          <div class="section-group theme-motor">
            <div class="section-title">Lineer Motor Surucusu</div>
            <div class="section-content">
              <div class="panel-card card-lim">
                <h3>Delta MS300 <span class="card-badge">VFD9A0MS43AFSAA</span> <span class="status-indicator warning" id="vfd-state">Beklemede</span></h3>
                <div class="vfd-command-row">
                  <input type="number" class="vfd-freq-input" id="vfd-freq-input" min="0" max="60" step="0.1" value="0" placeholder="Hz" />
                  <span class="metric-unit" style="margin-right:4px;">Hz</span>
                  <button class="vfd-send-btn" id="vfd-send-btn">Gonder</button>
                  <button class="vfd-stop-btn" id="vfd-stop-btn">Durdur</button>
                </div>
                <div class="vfd-big-row">
                  <div class="energy-big">
                    <span class="energy-big-value" id="vfd-freq">0.0</span>
                    <span class="energy-big-unit">Hz</span>
                    <span class="metric-label">Cikis Frekans</span>
                  </div>
                  <div class="energy-big">
                    <span class="energy-big-value" id="vfd-current">0.0</span>
                    <span class="energy-big-unit">A</span>
                    <span class="metric-label">Cikis Akim</span>
                  </div>
                  <div class="energy-big">
                    <span class="energy-big-value" id="vfd-dc-bus">0</span>
                    <span class="energy-big-unit">V</span>
                    <span class="metric-label">DC Bus</span>
                  </div>
                </div>
                <div class="vfd-grid">
                  <div class="metric">
                    <span class="metric-label">Cikis Voltaj</span>
                    <span><span class="metric-value" id="vfd-voltage">0</span><span class="metric-unit">V</span></span>
                  </div>
                  <div class="metric">
                    <span class="metric-label">Hedef Frekans</span>
                    <span><span class="metric-value" id="vfd-target-freq">0.0</span><span class="metric-unit">Hz</span></span>
                  </div>
                  <div class="metric">
                    <span class="metric-label">Tork</span>
                    <span><span class="metric-value" id="vfd-torque">0</span><span class="metric-unit">%</span></span>
                  </div>
                  <div class="metric">
                    <span class="metric-label">Yon</span>
                    <span class="status-indicator ok" id="vfd-direction">-</span>
                  </div>
                  <div class="metric">
                    <span class="metric-label">Hata Kodu</span>
                    <span class="status-indicator ok" id="vfd-fault">Yok</span>
                  </div>
                  <div class="metric">
                    <span class="metric-label">Modbus</span>
                    <span class="status-indicator warning" id="vfd-comm">Baglanti Yok</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Fren Sistemi -->
          <div class="section-group theme-brake">
            <div class="section-title">Fren Sistemi</div>
            <div class="section-content">
              <div class="panel-card card-brake">
                <div class="brake-visual-wrap">
                  <canvas id="brake-visual" class="brake-canvas" width="260" height="90"></canvas>
                </div>
                <div class="brake-btn-row">
                  <button class="brake-action-btn" id="brake-front-btn">On Fren</button>
                  <button class="brake-action-btn" id="brake-rear-btn">Arka Fren</button>
                  <button class="brake-action-btn brake-both-btn" id="brake-both-btn">Hepsi</button>
                </div>
                <div class="brake-status-row">
                  <span class="brake-status-item" id="brake-front-status">On: Aktif</span>
                  <span class="brake-status-item" id="brake-rear-status">Arka: Aktif</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        <!-- COLUMN 5: Canli Goruntu (en sag) -->
        <div class="layout-column">

          <div class="section-group theme-camera">
            <div class="section-title">
              Canli Goruntu
              <span class="cam-status-badge cam-waiting" id="cam-status-badge">
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
                <div class="camera-controls" style="margin-top:4px; gap:8px;">
                  <span class="metric-label" style="font-size:9px;" id="cam-resolution">720p</span>
                  <div class="camera-brightness" style="margin-left:auto;">
                    <span class="metric-label" style="font-size:9px;">Parlaklik</span>
                    <input type="range" class="cam-slider" id="cam-brightness" min="0" max="200" value="100" />
                    <span style="font-size:9px; color:#aaccee;" id="cam-brightness-val">100%</span>
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
      statusBadge: document.getElementById('status-badge'),
      statusText: document.getElementById('status-text'),
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
      batPower: document.getElementById('bat-power'),
      batSoc: document.getElementById('bat-soc'),
      batEnergy: document.getElementById('bat-energy'),
      batCellMin: document.getElementById('bat-cell-min'),
      batCellMax: document.getElementById('bat-cell-max'),
      batCellAvg: document.getElementById('bat-cell-avg'),
      batCellDelta: document.getElementById('bat-cell-delta'),
      batBalance: document.getElementById('bat-balance'),
      batPrecharge: document.getElementById('bat-precharge'),
      batTempHeatmap: document.getElementById('bat-temp-heatmap'),
      batContactorBtn: document.getElementById('bat-contactor-btn'),
      batEmergencyBtn: document.getElementById('bat-emergency-btn'),
      vfdState: document.getElementById('vfd-state'),
      vfdFreq: document.getElementById('vfd-freq'),
      vfdCurrent: document.getElementById('vfd-current'),
      vfdDcBus: document.getElementById('vfd-dc-bus'),
      vfdVoltage: document.getElementById('vfd-voltage'),
      vfdTargetFreq: document.getElementById('vfd-target-freq'),
      vfdTorque: document.getElementById('vfd-torque'),
      vfdDirection: document.getElementById('vfd-direction'),
      vfdFault: document.getElementById('vfd-fault'),
      vfdComm: document.getElementById('vfd-comm'),
      vfdFreqInput: document.getElementById('vfd-freq-input'),
      vfdSendBtn: document.getElementById('vfd-send-btn'),
      vfdStopBtn: document.getElementById('vfd-stop-btn'),
      // BNO055
      bnoStatus: document.getElementById('bno-status'),
      bnoCalSys: document.getElementById('bno-cal-sys'),
      bnoCalGyro: document.getElementById('bno-cal-gyro'),
      bnoCalAccel: document.getElementById('bno-cal-accel'),
      bnoCalMag: document.getElementById('bno-cal-mag'),
      bnoCalSysBar: document.getElementById('bno-cal-sys-bar'),
      bnoCalGyroBar: document.getElementById('bno-cal-gyro-bar'),
      bnoCalAccelBar: document.getElementById('bno-cal-accel-bar'),
      bnoCalMagBar: document.getElementById('bno-cal-mag-bar'),
      bnoAccelX: document.getElementById('bno-accel-x'),
      bnoVelocity: document.getElementById('bno-velocity'),
      bnoPosition: document.getElementById('bno-position'),
      bnoRoll: document.getElementById('bno-roll'),
      bnoPitch: document.getElementById('bno-pitch'),
      bnoYaw: document.getElementById('bno-yaw'),
      bnoGyro: document.getElementById('bno-gyro'),
      bnoTemp: document.getElementById('bno-temp'),
      posSource: document.getElementById('pos-source'),
      // System status
      plcStatus: document.getElementById('plc-status'),
      batStatus: document.getElementById('bat-status'),
      // Comparison
      compIcon: document.getElementById('comp-icon'),
      compText: document.getElementById('comp-text'),
      compPos1: document.getElementById('comp-pos1'),
      compPos2: document.getElementById('comp-pos2'),
      compDiff: document.getElementById('comp-diff'),
      compPercent: document.getElementById('comp-percent'),
      // Camera
      camViewport: document.getElementById('camera-viewport'),
      camBrightness: document.getElementById('cam-brightness'),
      camBrightnessVal: document.getElementById('cam-brightness-val'),
      camStatusBadge: document.getElementById('cam-status-badge'),
      // Brakes
      brakeCanvas: document.getElementById('brake-visual'),
      brakeFrontBtn: document.getElementById('brake-front-btn'),
      brakeRearBtn: document.getElementById('brake-rear-btn'),
      brakeBothBtn: document.getElementById('brake-both-btn'),
      brakeFrontStatus: document.getElementById('brake-front-status'),
      brakeRearStatus: document.getElementById('brake-rear-status')
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

    // BNO055 real sensor data
    eventBus.on('bno:data', (data) => {
      this.bnoConnected = true;
      this.bnoData.calSys = data.calSys ?? this.bnoData.calSys;
      this.bnoData.calGyro = data.calGyro ?? this.bnoData.calGyro;
      this.bnoData.calAccel = data.calAccel ?? this.bnoData.calAccel;
      this.bnoData.calMag = data.calMag ?? this.bnoData.calMag;
      this.bnoData.accelX = data.accelX ?? this.bnoData.accelX;
      this.bnoData.velocity = data.velocity ?? this.bnoData.velocity;
      this.bnoData.position = data.position ?? this.bnoData.position;
      this.bnoData.roll = data.roll ?? this.bnoData.roll;
      this.bnoData.pitch = data.pitch ?? this.bnoData.pitch;
      this.bnoData.yaw = data.yaw ?? this.bnoData.yaw;
      this.bnoData.gyroX = data.gyroX ?? this.bnoData.gyroX;
      this.bnoData.gyroY = data.gyroY ?? this.bnoData.gyroY;
      this.bnoData.gyroZ = data.gyroZ ?? this.bnoData.gyroZ;
      this.bnoData.temp = data.temp ?? this.bnoData.temp;
      this.updateBNO();
    });

    // Fren röle verileri
    eventBus.on('brake:data', (data) => {
      if (data.relay1 !== undefined) this.brakeData.relay1 = !!data.relay1;
      if (data.valve1 !== undefined) this.brakeData.valve1 = !!data.valve1;
      if (data.relay2 !== undefined) this.brakeData.relay2 = !!data.relay2;
      if (data.valve2 !== undefined) this.brakeData.valve2 = !!data.valve2;
      this.updateBrakes();
    });

    // Fren butonları
    this.els.brakeFrontBtn.addEventListener('click', () => {
      const frontOn = this.brakeData.relay1 && this.brakeData.valve1;
      this.brakeData.relay1 = !frontOn;
      this.brakeData.valve1 = !frontOn;
      eventBus.emit('brake:command', { ...this.brakeData });
      this.updateBrakes();
    });
    this.els.brakeRearBtn.addEventListener('click', () => {
      const rearOn = this.brakeData.relay2 && this.brakeData.valve2;
      this.brakeData.relay2 = !rearOn;
      this.brakeData.valve2 = !rearOn;
      eventBus.emit('brake:command', { ...this.brakeData });
      this.updateBrakes();
    });
    this.els.brakeBothBtn.addEventListener('click', () => {
      const allOn = this.brakeData.relay1 && this.brakeData.valve1 && this.brakeData.relay2 && this.brakeData.valve2;
      this.brakeData.relay1 = !allOn;
      this.brakeData.valve1 = !allOn;
      this.brakeData.relay2 = !allOn;
      this.brakeData.valve2 = !allOn;
      eventBus.emit('brake:command', { ...this.brakeData });
      this.updateBrakes();
    });

    // VFD frekans komutu
    this.els.vfdSendBtn.addEventListener('click', () => {
      const freq = parseFloat(this.els.vfdFreqInput.value) || 0;
      const clamped = Math.max(0, Math.min(60, freq));
      this.els.vfdFreqInput.value = clamped;
      eventBus.emit('vfd:command', { freq: clamped, run: true });
      this._vfdTargetFreq = clamped;
      this.updateVfdFromTarget();
    });
    this.els.vfdStopBtn.addEventListener('click', () => {
      this.els.vfdFreqInput.value = 0;
      eventBus.emit('vfd:command', { freq: 0, run: false });
      this._vfdTargetFreq = 0;
      this.updateVfdFromTarget();
    });
    this.els.vfdFreqInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.els.vfdSendBtn.click();
    });

    // Batarya kontaktör
    this.batContactorOn = false;
    this.els.batContactorBtn.addEventListener('click', () => {
      this.batContactorOn = !this.batContactorOn;
      this.els.batContactorBtn.textContent = this.batContactorOn ? 'Kontaktor: ACIK' : 'Kontaktor: KAPALI';
      this.els.batContactorBtn.className = 'bat-contactor-btn' + (this.batContactorOn ? ' contactor-on' : '');
      this.els.batPrecharge.textContent = this.batContactorOn ? 'Tamam' : 'Bekliyor';
      this.els.batPrecharge.className = 'status-indicator ' + (this.batContactorOn ? 'ok' : 'warning');
      eventBus.emit('battery:contactor', { on: this.batContactorOn });
    });
    this.els.batEmergencyBtn.addEventListener('click', () => {
      this.batContactorOn = false;
      this.els.batContactorBtn.textContent = 'Kontaktor: KAPALI';
      this.els.batContactorBtn.className = 'bat-contactor-btn';
      this.els.batPrecharge.textContent = 'ACIL KES';
      this.els.batPrecharge.className = 'status-indicator error';
      this.els.batStatus.textContent = 'ACIL';
      this.els.batStatus.className = 'status-indicator error';
      // Frenle + VFD durdur
      this.brakeData = { relay1: false, valve1: false, relay2: false, valve2: false };
      this.updateBrakes();
      this._vfdTargetFreq = 0;
      this.updateVfdFromTarget();
      eventBus.emit('battery:emergency', {});
      eventBus.emit('brake:command', { ...this.brakeData });
      eventBus.emit('vfd:command', { freq: 0, run: false });
    });

    // Batarya sıcaklık sensörleri (15 adet)
    this._batTemps = new Array(15).fill(25);
    this._batEnergyUsed = 0;

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
      this.updateSystemStatus('running');
    });

    this.els.btnStop.addEventListener('click', () => {
      this.simRunning = false;
      this.els.btnStart.classList.remove('active');
      this.updateSystemStatus('stopped');
    });

    this.els.btnReset.addEventListener('click', () => {
      this.simRunning = false;
      this.simPosition = 0;
      this.els.simSlider.value = 0;
      this.els.simSliderValue.textContent = '0.0m';
      this.els.btnStart.classList.remove('active');
      this.updateSystemStatus('idle');
      eventBus.emit('plc:position', 0);
    });

    // Auto simulation loop
    let lastSim = performance.now();
    const simLoop = () => {
      const now = performance.now();
      const dt = (now - lastSim) / 1000;
      lastSim = now;

      if (this.simRunning) {
        // Fren durumuna göre hız ayarla
        const frontBraked = !(this.brakeData.relay1 && this.brakeData.valve1);
        const rearBraked = !(this.brakeData.relay2 && this.brakeData.valve2);
        const bothBraked = frontBraked && rearBraked;
        const oneBraked = frontBraked || rearBraked;

        let speedMult = 1;
        if (bothBraked) {
          speedMult = 0; // İki fren de basılı → tam dur
        } else if (oneBraked) {
          speedMult = 0.3; // Tek fren → yavaşla
        }

        this.simPosition += this.simSpeed * speedMult * dt;
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

    const power = this.batteryData.voltage * this.batteryData.current / 1000;
    this._batEnergyUsed = (this._batEnergyUsed || 0) + power * 0.05; // approx Wh accumulation

    this.els.batVoltage.textContent = this.batteryData.voltage.toFixed(1);
    this.els.batCurrent.textContent = this.batteryData.current.toFixed(1);
    this.els.batPower.textContent = power.toFixed(1);
    this.els.batSoc.textContent = this.batteryData.soc.toFixed(0);
    this.els.batEnergy.textContent = this._batEnergyUsed.toFixed(1);

    // Hücre voltajları (placeholder - gerçek BMS verisi gelecek)
    const cellAvg = this.batteryData.voltage / 144;
    const cellMin = cellAvg - speedFactor * 0.05;
    const cellMax = cellAvg + speedFactor * 0.05;
    const delta = cellMax - cellMin;
    this.els.batCellMin.textContent = cellMin.toFixed(2);
    this.els.batCellMax.textContent = cellMax.toFixed(2);
    this.els.batCellAvg.textContent = cellAvg.toFixed(2);
    this.els.batCellDelta.textContent = delta.toFixed(2) + 'V';
    this.els.batCellDelta.className = 'status-indicator ' + (delta > 0.3 ? 'error' : delta > 0.1 ? 'warning' : 'ok');

    // Sıcaklık sensörleri güncelle (15 adet)
    for (let i = 0; i < 15; i++) {
      this._batTemps[i] = 25 + speedFactor * 15 + Math.sin(i * 0.7 + Date.now() * 0.001) * 2;
    }
    this.drawBatHeatmap();

    // VFD placeholder values from speed
    this.els.vfdFreq.textContent = this.deltaFreq.toFixed(1);
    this.els.vfdTargetFreq.textContent = this.deltaFreq.toFixed(1);
    this.els.vfdCurrent.textContent = (speedFactor * 9).toFixed(1);
    this.els.vfdDcBus.textContent = (620 + speedFactor * 30).toFixed(0);
    this.els.vfdVoltage.textContent = (speedFactor * 380).toFixed(0);
    this.els.vfdTorque.textContent = (speedFactor * 75).toFixed(0);

    // VFD state
    const stateEl = this.els.vfdState;
    if (speedFactor > 0.1) {
      const accel = speed > (this._lastVfdSpeed || 0) + 0.5;
      const decel = speed < (this._lastVfdSpeed || 0) - 0.5;
      stateEl.textContent = accel ? 'Hizlaniyor' : decel ? 'Yavasliyor' : 'Calisiyor';
      stateEl.className = 'status-indicator ok';
    } else {
      stateEl.textContent = 'Beklemede';
      stateEl.className = 'status-indicator warning';
    }
    this._lastVfdSpeed = speed;

    // VFD direction
    this.els.vfdDirection.textContent = speedFactor > 0.1 ? 'Ileri' : '-';

    // Battery status with color coding
    const soc = this.batteryData.soc;
    const batEl = this.els.batStatus;
    if (soc > 50) {
      batEl.textContent = 'Normal';
      batEl.className = 'status-indicator ok';
    } else if (soc > 20) {
      batEl.textContent = 'Dusuk';
      batEl.className = 'status-indicator warning';
    } else {
      batEl.textContent = 'Kritik!';
      batEl.className = 'status-indicator critical';
    }

    // SoC value color
    this.els.batSoc.style.color = soc > 50 ? '#00cc66' : soc > 20 ? '#e0a000' : '#ff4444';

    // Active zone color coding
    const zoneEl = this.els.activeZone;
    const zone = zoneEl.textContent;
    if (zone.includes('Acil')) {
      zoneEl.style.color = '#ff4444';
    } else if (zone === '-' || zone.includes('Bekleniyor')) {
      zoneEl.style.color = '#e0a000';
    } else {
      zoneEl.style.color = '#00cc66';
    }
  }

  startEnergySimulation() {
    this.lastSpeedFactor = 0;

    // Heatmap çizimini periyodik güncelle
    setInterval(() => {
      this.drawBatHeatmap();
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

  drawBatHeatmap() {
    const canvas = this.els.batTempHeatmap;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (!this._heatTime) this._heatTime = 0;
    this._heatTime += 0.02;
    const anim = this._heatTime;
    const temps = this._batTemps;
    const tMin = Math.min(...temps);
    const tMax = Math.max(...temps);
    const minIdx = temps.indexOf(tMin);
    const maxIdx = temps.indexOf(tMax);

    const n = 15;
    const padL = 4, padR = 4, padT = 12, padB = 18;
    const barGap = 2;
    const barW = (w - padL - padR - (n - 1) * barGap) / n;
    const barMaxH = h - padT - padB;

    // Threshold line at 45°C
    const threshRatio = Math.max(0, Math.min(1, (45 - 20) / 40));
    const threshY = padT + barMaxH * (1 - threshRatio);

    // Header
    ctx.font = 'bold 6px "Segoe UI"';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255, 160, 80, 0.45)';
    ctx.fillText('SICAKLIK SENSORU', padL, 8);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillText(`MIN ${tMin.toFixed(0)}°C  MAX ${tMax.toFixed(0)}°C`, w - padR, 8);

    // Background grid lines (yatay)
    for (let t = 20; t <= 60; t += 10) {
      const ratio = (t - 20) / 40;
      const y = padT + barMaxH * (1 - ratio);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();
    }

    // Threshold line (45°C uyarı)
    ctx.strokeStyle = 'rgba(255, 60, 40, 0.25)';
    ctx.lineWidth = 0.7;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(padL, threshY);
    ctx.lineTo(w - padR, threshY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '5px "Segoe UI"';
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255, 60, 40, 0.35)';
    ctx.fillText('45°C', w - padR, threshY - 2);

    for (let i = 0; i < n; i++) {
      const temp = temps[i];
      const ratio = Math.max(0, Math.min(1, (temp - 20) / 40));
      const x = padL + i * (barW + barGap);
      const fillH = ratio * barMaxH;
      const barY = padT + barMaxH - fillH;
      const isMin = i === minIdx;
      const isMax = i === maxIdx;
      const start = i * 10 + 1;
      const end = i === 14 ? 144 : (i + 1) * 10;

      // Bar track (arka plan)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.beginPath();
      ctx.roundRect(x, padT, barW, barMaxH, [2, 2, 0, 0]);
      ctx.fill();

      // Bar fill gradient
      const grad = ctx.createLinearGradient(0, padT + barMaxH, 0, barY);
      if (ratio < 0.4) {
        grad.addColorStop(0, 'rgba(0, 180, 140, 0.3)');
        grad.addColorStop(1, 'rgba(0, 220, 180, 0.8)');
      } else if (ratio < 0.65) {
        grad.addColorStop(0, 'rgba(180, 180, 40, 0.3)');
        grad.addColorStop(1, 'rgba(255, 220, 50, 0.85)');
      } else {
        grad.addColorStop(0, 'rgba(200, 60, 30, 0.3)');
        grad.addColorStop(1, 'rgba(255, 70, 40, 0.9)');
      }
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, barY, barW, fillH, [2, 2, 0, 0]);
      ctx.fill();

      // Shine effect (sol kenar)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fillRect(x + 1, barY + 1, 1.5, fillH - 2);

      // Glow for min/max
      if (isMax && ratio > 0.5) {
        ctx.save();
        ctx.shadowColor = `rgba(255, 60, 30, ${0.3 + 0.15 * Math.sin(anim * 4)})`;
        ctx.shadowBlur = 8;
        ctx.fillStyle = 'rgba(255, 60, 30, 0.01)';
        ctx.fillRect(x - 1, barY - 2, barW + 2, fillH + 4);
        ctx.restore();
      }
      if (isMin) {
        ctx.save();
        ctx.shadowColor = `rgba(0, 200, 255, ${0.2 + 0.1 * Math.sin(anim * 3)})`;
        ctx.shadowBlur = 6;
        ctx.fillStyle = 'rgba(0, 200, 255, 0.01)';
        ctx.fillRect(x - 1, barY - 2, barW + 2, fillH + 4);
        ctx.restore();
      }

      // Temperature value on top
      ctx.font = 'bold 7px "Segoe UI"';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = isMax ? '#ff6644' : isMin ? '#44ddff' : 'rgba(255,255,255,0.7)';
      ctx.fillText(`${temp.toFixed(0)}°`, x + barW / 2, barY - 1);

      // Bottom label: sensor ID
      ctx.font = 'bold 6px "Segoe UI"';
      ctx.textBaseline = 'top';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255, 180, 100, 0.55)';
      ctx.fillText(`S${i + 1}`, x + barW / 2, padT + barMaxH + 2);

      // Cell range
      ctx.font = '5px "Segoe UI"';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fillText(`${start}-${end}`, x + barW / 2, padT + barMaxH + 10);
    }
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

    if (this.els.lastStripe) this.els.lastStripe.textContent = lastStripe !== null ? `${lastStripe}m` : '-';
    if (this.els.nextStripe) this.els.nextStripe.textContent = nextStripe !== null ? `${nextStripe}m` : '-';

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
    // Both sensors are side by side at the same position
    // In simulation, add small random noise to mimic real sensor variance
    const sensorOffsets = [0, 0];
    const sensorEls = [
      { status: this.els.sensor1Status, num: this.els.sensor1StripeNum, pos: this.els.sensor1StripePos, next: this.els.sensor1Next, dist: this.els.sensor1Dist },
      { status: this.els.sensor2Status, num: this.els.sensor2StripeNum, pos: this.els.sensor2StripePos, next: this.els.sensor2Next, dist: this.els.sensor2Dist }
    ];
    const totalStripes = this.stripePositions.length;
    const sensorPositions = [null, null];
    const sensorStripeIndices = [0, 0];

    sensorOffsets.forEach((offset, i) => {
      // Add small noise for simulation (real PLC data won't need this)
      const noise = (Math.random() - 0.5) * 0.3;
      const sensorPos = currentPos + offset + noise;
      const els = sensorEls[i];

      const passed = this.stripePositions.filter(p => p <= sensorPos);
      const upcoming = this.stripePositions.filter(p => p > sensorPos);

      const lastStripe = passed.length > 0 ? passed[passed.length - 1] : null;
      const nextStripe = upcoming.length > 0 ? upcoming[0] : null;
      const stripeIndex = passed.length;

      sensorPositions[i] = sensorPos;
      sensorStripeIndices[i] = stripeIndex;

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

    // Sensor comparison
    this.updateSensorComparison(sensorPositions, sensorStripeIndices);
  }

  updateSensorComparison(positions, stripeIndices) {
    const compCard = document.getElementById('sensor-comparison');
    const compIcon = this.els.compIcon;
    const compText = this.els.compText;
    const compPos1 = this.els.compPos1;
    const compPos2 = this.els.compPos2;
    const compDiff = this.els.compDiff;
    const compPercent = this.els.compPercent;

    const pos1 = positions[0];
    const pos2 = positions[1];

    if (pos1 === null || pos2 === null || pos1 < 1) {
      compText.textContent = 'Veri Bekleniyor';
      compIcon.innerHTML = '&#8987;';
      compCard.className = 'panel-card card-comparison';
      compPos1.textContent = '-';
      compPos2.textContent = '-';
      compDiff.textContent = '-';
      compPercent.textContent = '-';
      return;
    }

    const diff = Math.abs(pos1 - pos2);
    const avg = (pos1 + pos2) / 2;
    const deviationPercent = avg > 0 ? (diff / avg) * 100 : 0;
    const stripeDiff = Math.abs(stripeIndices[0] - stripeIndices[1]);

    compPos1.textContent = `${pos1.toFixed(2)}m`;
    compPos2.textContent = `${pos2.toFixed(2)}m`;
    compDiff.textContent = `${diff.toFixed(3)}m`;
    compPercent.textContent = `${deviationPercent.toFixed(2)}%`;

    if (stripeDiff > 0 || deviationPercent > 5) {
      // Alert state - switch to BNO055 for position
      compCard.className = 'panel-card card-comparison comp-alert';
      compIcon.innerHTML = '&#9888;';
      compText.textContent = `Uyari! Sapma %${deviationPercent.toFixed(1)} - BNO055 Aktif`;
      this.useOmronForPosition = false;
    } else if (deviationPercent > 2) {
      // Warning state
      compCard.className = 'panel-card card-comparison comp-warning';
      compIcon.innerHTML = '&#9888;';
      compText.textContent = `Dikkat - Sapma %${deviationPercent.toFixed(1)}`;
      this.useOmronForPosition = true;
    } else {
      // OK state
      compCard.className = 'panel-card card-comparison comp-ok';
      compIcon.innerHTML = '&#10003;';
      compText.textContent = `Eslesme Basarili - Sapma %${deviationPercent.toFixed(1)}`;
      this.useOmronForPosition = true;
    }

    // Update position source indicator
    const srcEl = this.els.posSource;
    if (this.useOmronForPosition) {
      srcEl.textContent = 'Omron';
      srcEl.className = 'status-indicator ok';
    } else {
      srcEl.textContent = 'BNO055 (Yedek)';
      srcEl.className = 'status-indicator critical';
    }
  }

  updateBNO() {
    // Display BNO055 data from real sensor (populated via eventBus 'bno:data' event)
    // No simulation - values stay at defaults until real data arrives

    // Update calibration display
    const calItems = [
      { val: this.bnoData.calSys, el: this.els.bnoCalSys, bar: this.els.bnoCalSysBar },
      { val: this.bnoData.calGyro, el: this.els.bnoCalGyro, bar: this.els.bnoCalGyroBar },
      { val: this.bnoData.calAccel, el: this.els.bnoCalAccel, bar: this.els.bnoCalAccelBar },
      { val: this.bnoData.calMag, el: this.els.bnoCalMag, bar: this.els.bnoCalMagBar }
    ];

    calItems.forEach(item => {
      const level = Math.floor(item.val);
      item.el.textContent = level;
      item.bar.style.width = `${(item.val / 3) * 100}%`;
      if (level >= 3) {
        item.bar.style.background = '#00cc66';
        item.el.style.color = '#00cc66';
      } else if (level >= 2) {
        item.bar.style.background = '#e0a000';
        item.el.style.color = '#e0a000';
      } else {
        item.bar.style.background = '#ff4444';
        item.el.style.color = '#ff4444';
      }
    });

    // BNO status
    const sysCalLevel = Math.floor(this.bnoData.calSys);
    const statusEl = this.els.bnoStatus;
    if (!this.bnoConnected) {
      statusEl.textContent = 'Bagli Degil';
      statusEl.className = 'status-indicator warning';
    } else if (sysCalLevel >= 3) {
      statusEl.textContent = 'Kalibre';
      statusEl.className = 'status-indicator ok';
    } else if (sysCalLevel >= 1) {
      statusEl.textContent = 'Kalibrasyon...';
      statusEl.className = 'status-indicator warning';
    } else {
      statusEl.textContent = 'Kalibrasyon Bekleniyor';
      statusEl.className = 'status-indicator warning';
    }

    // Update data values (show '-' if null / not connected)
    const fmt = (val, dec) => val !== null ? val.toFixed(dec) : '-';
    this.els.bnoAccelX.textContent = fmt(this.bnoData.accelX, 2);
    this.els.bnoVelocity.textContent = fmt(this.bnoData.velocity, 2);
    this.els.bnoPosition.textContent = fmt(this.bnoData.position, 2);
    this.els.bnoRoll.textContent = fmt(this.bnoData.roll, 1);
    this.els.bnoPitch.textContent = fmt(this.bnoData.pitch, 1);
    this.els.bnoYaw.textContent = fmt(this.bnoData.yaw, 1);
    const gx = this.bnoData.gyroX, gy = this.bnoData.gyroY, gz = this.bnoData.gyroZ;
    this.els.bnoGyro.textContent = (gx !== null && gy !== null && gz !== null)
      ? `${gx.toFixed(1)} / ${gy.toFixed(1)} / ${gz.toFixed(1)}`
      : '- / - / -';
    this.els.bnoTemp.textContent = fmt(this.bnoData.temp, 0);
  }

  drawBrakeVisual() {
    const canvas = this.els.brakeCanvas;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (!this._brakeTime) this._brakeTime = 0;
    this._brakeTime += 0.03;
    const t = this._brakeTime;

    const bd = this.brakeData;
    const frontFree = bd.relay1 && bd.valve1;
    const rearFree = bd.relay2 && bd.valve2;
    const cx = w * 0.5;
    const rows = [
      { y: 0.32, free: frontFree, label: 'ON' },
      { y: 0.72, free: rearFree, label: 'ARKA' }
    ];

    // === Background ambient glow ===
    const ambGlow = ctx.createRadialGradient(cx, h * 0.5, 10, cx, h * 0.5, w * 0.45);
    ambGlow.addColorStop(0, 'rgba(255, 100, 60, 0.04)');
    ambGlow.addColorStop(0.5, 'rgba(255, 60, 30, 0.02)');
    ambGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = ambGlow;
    ctx.fillRect(0, 0, w, h);

    // === Vertical rail in center ===
    const railW = 10;
    const railTop = h * 0.06;
    const railBot = h * 0.94;
    const railH = railBot - railTop;
    // Rail base (steel look)
    const railBaseGrad = ctx.createLinearGradient(cx - railW / 2, 0, cx + railW / 2, 0);
    railBaseGrad.addColorStop(0, 'rgba(70, 75, 90, 0.9)');
    railBaseGrad.addColorStop(0.2, 'rgba(100, 105, 120, 0.95)');
    railBaseGrad.addColorStop(0.5, 'rgba(120, 125, 140, 1)');
    railBaseGrad.addColorStop(0.8, 'rgba(95, 100, 115, 0.95)');
    railBaseGrad.addColorStop(1, 'rgba(65, 70, 85, 0.9)');
    ctx.fillStyle = railBaseGrad;
    ctx.beginPath();
    ctx.roundRect(cx - railW / 2, railTop, railW, railH, 3);
    ctx.fill();
    // Rail center highlight
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(cx, railTop + 3);
    ctx.lineTo(cx, railBot - 3);
    ctx.stroke();
    // Sleeper ties (horizontal)
    const sleeperCount = 14;
    for (let s = 0; s < sleeperCount; s++) {
      const sy = railTop + 6 + s * ((railH - 12) / (sleeperCount - 1));
      ctx.fillStyle = 'rgba(60, 50, 40, 0.7)';
      ctx.fillRect(cx - railW / 2 - 3, sy - 1.5, railW + 6, 3);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(cx - railW / 2 - 3, sy - 1.5, railW + 6, 3);
    }
    // Rail neon edge glow (animated)
    const railGlowAlpha = 0.12 + 0.06 * Math.sin(t * 3);
    ctx.save();
    ctx.shadowColor = `rgba(255, 140, 60, ${railGlowAlpha * 2})`;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = `rgba(255, 120, 60, ${railGlowAlpha})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(cx - railW / 2, railTop, railW, railH, 3);
    ctx.stroke();
    ctx.restore();
    // Moving light on rail (vertical, top to bottom)
    const railDotProgress = ((t * 0.3) % 1);
    const railDotY = railTop + 4 + railDotProgress * (railH - 8);
    const dotGlow = ctx.createRadialGradient(cx, railDotY, 0, cx, railDotY, 7);
    dotGlow.addColorStop(0, `rgba(255, 200, 100, ${0.5 + 0.2 * Math.sin(t * 5)})`);
    dotGlow.addColorStop(0.4, 'rgba(255, 140, 60, 0.15)');
    dotGlow.addColorStop(1, 'rgba(255, 100, 40, 0)');
    ctx.fillStyle = dotGlow;
    ctx.beginPath();
    ctx.arc(cx, railDotY, 7, 0, Math.PI * 2);
    ctx.fill();

    // === Row labels (ÖN / ARKA) ===
    ctx.font = 'bold 9px "Segoe UI"';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255, 160, 100, 0.7)';
    ctx.fillText('ÖN', 6, h * 0.32 - 14);
    ctx.fillText('ARKA', 6, h * 0.72 - 14);

    // === Decorative corner markers ===
    ctx.font = '6px "Segoe UI"';
    ctx.fillStyle = 'rgba(255, 120, 60, 0.2)';
    ctx.textAlign = 'left';
    ctx.fillText('FREN SYS', 4, 9);
    ctx.textAlign = 'right';
    ctx.fillText('HLR-BRK', w - 4, 9);

    // === Draw each brake row ===
    rows.forEach(row => {
      const by = h * row.y;
      const isActive = !row.free; // fren basılı
      const maxExtend = w * 0.14 - 1; // max rod extension to nearly reach rail
      const padExtend = isActive ? maxExtend : 3;
      const cylW = 24;
      const cylH = 16;
      const padW = 7;
      const padH = cylH + 4;

      // Draw left and right brake assemblies
      [-1, 1].forEach(dir => {
        const side = dir === -1 ? 'left' : 'right';
        // Cylinder position: offset from center
        const cylCx = cx + dir * (w * 0.14 + cylW / 2);
        const cylX = cylCx - cylW / 2;
        const cylY = by - cylH / 2;

        // === Ambient neon glow behind cylinder ===
        ctx.save();
        const glowCol = isActive ? 'rgba(255, 60, 40, 0.15)' : 'rgba(0, 200, 140, 0.08)';
        ctx.shadowColor = glowCol;
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(cylCx, by, cylH * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.01)';
        ctx.fill();
        ctx.restore();

        // === Cylinder body (fixed, metallic with 3D look) ===
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 2;
        const cylGrad = ctx.createLinearGradient(cylX, cylY, cylX, cylY + cylH);
        cylGrad.addColorStop(0, 'rgba(140, 150, 170, 0.95)');
        cylGrad.addColorStop(0.15, 'rgba(190, 200, 215, 1)');
        cylGrad.addColorStop(0.4, 'rgba(210, 218, 230, 1)');
        cylGrad.addColorStop(0.6, 'rgba(180, 188, 200, 0.95)');
        cylGrad.addColorStop(0.85, 'rgba(130, 140, 160, 0.9)');
        cylGrad.addColorStop(1, 'rgba(100, 110, 130, 0.85)');
        ctx.fillStyle = cylGrad;
        ctx.beginPath();
        ctx.roundRect(cylX, cylY, cylW, cylH, 3);
        ctx.fill();
        ctx.restore();

        // Cylinder border highlight
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.roundRect(cylX, cylY, cylW, cylH, 3);
        ctx.stroke();

        // Cylinder ribs (machined grooves)
        for (let g = 0; g < 4; g++) {
          const gx = cylX + 4 + g * 5;
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(gx, cylY + 3);
          ctx.lineTo(gx, cylY + cylH - 3);
          ctx.stroke();
          // Highlight next to groove
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
          ctx.beginPath();
          ctx.moveTo(gx + 1, cylY + 3);
          ctx.lineTo(gx + 1, cylY + cylH - 3);
          ctx.stroke();
        }

        // === Piston rod (extends inward toward rail) ===
        const rodLen = Math.max(padExtend - padW, 1);
        const rodH = 4;
        const rodY = by - rodH / 2;

        // Rod metallic gradient
        const rodGrad = ctx.createLinearGradient(0, rodY, 0, rodY + rodH);
        rodGrad.addColorStop(0, 'rgba(170, 180, 195, 0.9)');
        rodGrad.addColorStop(0.5, 'rgba(200, 210, 220, 0.95)');
        rodGrad.addColorStop(1, 'rgba(150, 160, 175, 0.85)');

        let rodX;
        if (dir === -1) {
          rodX = cylX + cylW;
          ctx.fillStyle = rodGrad;
          ctx.fillRect(rodX, rodY, rodLen, rodH);
          // Rod shine
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(rodX, rodY + 1);
          ctx.lineTo(rodX + rodLen, rodY + 1);
          ctx.stroke();
        } else {
          rodX = cylX - rodLen;
          ctx.fillStyle = rodGrad;
          ctx.fillRect(rodX, rodY, rodLen, rodH);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(rodX, rodY + 1);
          ctx.lineTo(rodX + rodLen, rodY + 1);
          ctx.stroke();
        }

        // === Brake pad (rubber, at tip of rod) ===
        let padX;
        if (dir === -1) {
          padX = cylX + cylW + rodLen;
        } else {
          padX = cylX - rodLen - padW;
        }
        const padY = by - padH / 2;

        // Pad shadow
        ctx.save();
        ctx.shadowColor = isActive ? 'rgba(255, 50, 30, 0.4)' : 'rgba(0, 0, 0, 0.2)';
        ctx.shadowBlur = isActive ? 8 : 3;

        const padGrad = ctx.createLinearGradient(padX, padY, padX, padY + padH);
        padGrad.addColorStop(0, 'rgba(30, 30, 35, 0.95)');
        padGrad.addColorStop(0.2, 'rgba(50, 50, 58, 1)');
        padGrad.addColorStop(0.5, 'rgba(60, 60, 68, 1)');
        padGrad.addColorStop(0.8, 'rgba(45, 45, 52, 0.95)');
        padGrad.addColorStop(1, 'rgba(25, 25, 30, 0.9)');
        ctx.fillStyle = padGrad;
        const rr = dir === -1 ? [0, 3, 3, 0] : [3, 0, 0, 3];
        ctx.beginPath();
        ctx.roundRect(padX, padY, padW, padH, rr);
        ctx.fill();
        ctx.restore();

        // Pad edge highlight
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.roundRect(padX, padY, padW, padH, rr);
        ctx.stroke();

        // Pad grip texture (horizontal lines)
        for (let l = 0; l < 3; l++) {
          const ly = padY + 4 + l * 5;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(padX + 1, ly);
          ctx.lineTo(padX + padW - 1, ly);
          ctx.stroke();
        }

        // === Status LED (neon dot on cylinder top) ===
        const ledX = cylCx;
        const ledY = cylY - 5;
        ctx.save();
        // Outer glow
        const ledGlow = ctx.createRadialGradient(ledX, ledY, 0, ledX, ledY, 8);
        if (isActive) {
          ledGlow.addColorStop(0, 'rgba(255, 50, 50, 0.8)');
          ledGlow.addColorStop(0.4, 'rgba(255, 30, 30, 0.2)');
          ledGlow.addColorStop(1, 'rgba(255, 0, 0, 0)');
        } else {
          ledGlow.addColorStop(0, 'rgba(0, 220, 120, 0.6)');
          ledGlow.addColorStop(0.4, 'rgba(0, 200, 100, 0.15)');
          ledGlow.addColorStop(1, 'rgba(0, 200, 100, 0)');
        }
        ctx.fillStyle = ledGlow;
        ctx.beginPath();
        ctx.arc(ledX, ledY, 8, 0, Math.PI * 2);
        ctx.fill();
        // LED core
        ctx.shadowColor = isActive ? 'rgba(255, 50, 50, 0.9)' : 'rgba(0, 220, 120, 0.9)';
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(ledX, ledY, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = isActive ? '#ff4444' : '#00dd77';
        ctx.fill();
        // LED highlight
        ctx.beginPath();
        ctx.arc(ledX - 0.5, ledY - 0.5, 1, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fill();
        ctx.restore();

        // === Pneumatic port indicators (bottom) ===
        const portY = cylY + cylH + 4;
        [cylX + 6, cylX + cylW - 6].forEach(px => {
          ctx.save();
          ctx.shadowColor = 'rgba(0, 150, 255, 0.3)';
          ctx.shadowBlur = 3;
          ctx.fillStyle = 'rgba(40, 50, 65, 0.9)';
          ctx.beginPath();
          ctx.arc(px, portY, 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(0, 170, 255, 0.3)';
          ctx.lineWidth = 0.5;
          ctx.stroke();
          ctx.restore();
          // Pneumatic line
          ctx.strokeStyle = 'rgba(0, 150, 255, 0.08)';
          ctx.lineWidth = 0.5;
          ctx.setLineDash([2, 2]);
          ctx.beginPath();
          ctx.moveTo(px, portY + 3);
          ctx.lineTo(px, portY + 10);
          ctx.stroke();
          ctx.setLineDash([]);
        });
      });

      // === Contact effect when pads meet at rail (brake engaged) ===
      if (isActive) {
        // Neon glow at contact point
        const contactGlow = ctx.createRadialGradient(cx, by, 0, cx, by, 14);
        contactGlow.addColorStop(0, `rgba(255, 180, 80, ${0.5 + 0.15 * Math.sin(t * 4)})`);
        contactGlow.addColorStop(0.3, 'rgba(255, 100, 40, 0.25)');
        contactGlow.addColorStop(0.6, 'rgba(255, 50, 20, 0.08)');
        contactGlow.addColorStop(1, 'rgba(255, 0, 0, 0)');
        ctx.beginPath();
        ctx.arc(cx, by, 14, 0, Math.PI * 2);
        ctx.fillStyle = contactGlow;
        ctx.fill();

        // Pressure line indicator
        ctx.save();
        ctx.strokeStyle = `rgba(255, 120, 60, ${0.3 + 0.1 * Math.sin(t * 5)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - 8, by);
        ctx.lineTo(cx + 8, by);
        ctx.stroke();
        ctx.restore();
      }

      // Row label on right side
      ctx.save();
      ctx.font = 'bold 6px "Segoe UI"';
      ctx.fillStyle = isActive ? 'rgba(255, 80, 60, 0.5)' : 'rgba(0, 200, 120, 0.3)';
      ctx.textAlign = 'right';
      ctx.fillText(isActive ? 'KILITLI' : 'SERBEST', w - 4, by + 3);
      ctx.restore();
    });

    // === Scanning line animation (like speed gauge) ===
    const scanY = h * 0.08 + ((t * 0.15) % 1) * h * 0.84;
    const scanGrad = ctx.createLinearGradient(0, scanY - 3, 0, scanY + 3);
    scanGrad.addColorStop(0, 'rgba(255, 120, 60, 0)');
    scanGrad.addColorStop(0.5, 'rgba(255, 120, 60, 0.06)');
    scanGrad.addColorStop(1, 'rgba(255, 120, 60, 0)');
    ctx.fillStyle = scanGrad;
    ctx.fillRect(0, scanY - 3, w, 6);
  }

  updateBrakes() {
    const bd = this.brakeData;

    const frontFree = bd.relay1 && bd.valve1;
    const rearFree = bd.relay2 && bd.valve2;

    // Buton durumları
    this.els.brakeFrontBtn.className = 'brake-action-btn' + (frontFree ? ' brake-btn-active' : '');
    this.els.brakeRearBtn.className = 'brake-action-btn' + (rearFree ? ' brake-btn-active' : '');
    this.els.brakeBothBtn.className = 'brake-action-btn brake-both-btn' + (frontFree && rearFree ? ' brake-btn-active' : '');

    // Durum yazıları
    this.els.brakeFrontStatus.textContent = frontFree ? 'Ön: Serbest' : 'Ön: Aktif';
    this.els.brakeFrontStatus.className = 'brake-status-item' + (frontFree ? ' status-free' : ' status-active');
    this.els.brakeRearStatus.textContent = rearFree ? 'Arka: Serbest' : 'Arka: Aktif';
    this.els.brakeRearStatus.className = 'brake-status-item' + (rearFree ? ' status-free' : ' status-active');

    this.drawBrakeVisual();
  }

  updateVfdFromTarget() {
    const target = this._vfdTargetFreq || 0;
    const running = target > 0;
    this.els.vfdTargetFreq.textContent = target.toFixed(1);
    this.els.vfdFreq.textContent = target.toFixed(1);
    this.els.vfdCurrent.textContent = running ? (target / 60 * 9).toFixed(1) : '0.0';
    this.els.vfdDcBus.textContent = running ? (620 + target / 60 * 30).toFixed(0) : '0';
    this.els.vfdVoltage.textContent = running ? (target / 60 * 380).toFixed(0) : '0';
    this.els.vfdTorque.textContent = running ? (target / 60 * 75).toFixed(0) : '0';
    this.els.vfdDirection.textContent = running ? 'Ileri' : '-';

    const stateEl = this.els.vfdState;
    if (running) {
      stateEl.textContent = 'Calisiyor';
      stateEl.className = 'status-indicator ok';
    } else {
      stateEl.textContent = 'Beklemede';
      stateEl.className = 'status-indicator warning';
    }
  }

  updateSystemStatus(state) {
    const badge = this.els.statusBadge;
    const text = this.els.statusText;

    switch (state) {
      case 'running':
        badge.className = 'status-badge online';
        text.textContent = 'Calisiyor';
        break;
      case 'stopped':
        badge.className = 'status-badge offline';
        text.textContent = 'Durduruldu';
        break;
      case 'idle':
        badge.className = 'status-badge waiting';
        text.textContent = 'Beklemede';
        break;
    }
  }
}
