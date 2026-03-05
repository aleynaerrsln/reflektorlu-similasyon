import { eventBus } from '../core/EventBus.js';

/**
 * Omron PLC Connector
 *
 * Gercek entegrasyon icin bu sinifi kullanin.
 * Omron PLC'den WebSocket veya REST API uzerinden pozisyon verisini okur.
 *
 * Kullanim:
 *   const plc = new PlcConnector({ host: '192.168.1.100', port: 9600 });
 *   plc.connect();
 *
 * PLC'den gelen pozisyon verisi otomatik olarak EventBus'a yayilir.
 */
export class PlcConnector {
  constructor(config = {}) {
    this.host = config.host || 'localhost';
    this.port = config.port || 9600;
    this.pollInterval = config.pollInterval || 50; // ms
    this.connected = false;
    this.ws = null;
  }

  // WebSocket ile baglanti (Omron FINS/TCP veya ozel protokol)
  connect() {
    const url = `ws://${this.host}:${this.port}`;

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.connected = true;
        eventBus.emit('plc:status', { connected: true });
        console.log(`PLC connected: ${url}`);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Beklenen format: { position: number (metres) }
          if (typeof data.position === 'number') {
            eventBus.emit('plc:position', data.position);
          }
        } catch (e) {
          console.warn('PLC data parse error:', e);
        }
      };

      this.ws.onclose = () => {
        this.connected = false;
        eventBus.emit('plc:status', { connected: false });
        // Auto-reconnect after 3s
        setTimeout(() => this.connect(), 3000);
      };

      this.ws.onerror = (err) => {
        console.warn('PLC connection error:', err);
      };
    } catch (e) {
      console.warn('PLC WebSocket init failed:', e);
    }
  }

  // REST API ile polling (alternatif yontem)
  startPolling() {
    this.pollTimer = setInterval(async () => {
      try {
        const res = await fetch(`http://${this.host}:${this.port}/position`);
        const data = await res.json();
        if (typeof data.position === 'number') {
          eventBus.emit('plc:position', data.position);
        }
      } catch (e) {
        // Baglanti yoksa sessizce devam et
      }
    }, this.pollInterval);
  }

  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  disconnect() {
    this.stopPolling();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
