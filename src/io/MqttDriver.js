/**
 * MqttDriver - MQTT connection driver using mqtt.js via WebSocket
 */
import { appState } from '../core/AppState.js';

export class MqttDriver {
  constructor() {
    this._client = null;
    this._callbacks = { data: [], error: [], close: [] };
  }

  on(event, cb) { this._callbacks[event]?.push(cb); }
  off(event, cb) {
    if (!this._callbacks[event]) return;
    this._callbacks[event] = this._callbacks[event].filter(c => c !== cb);
  }
  _emit(event, data) { this._callbacks[event]?.forEach(cb => cb(data)); }

  async connect() {
    const cfg = appState.mqttConfig;
    
    if (!window.mqtt) {
      throw new Error('MQTT library not loaded in browser.');
    }

    return new Promise((resolve, reject) => {
      try {
        const options = {
          keepalive: 30,
          clientId: 'serial_studio_' + Math.random().toString(16).substring(2, 8),
          clean: true,
          connectTimeout: 5000,
        };
        
        if (cfg.username) options.username = cfg.username;
        if (cfg.password) options.password = cfg.password;

        this._client = window.mqtt.connect(cfg.brokerUrl, options);

        this._client.on('connect', () => {
          // Subscribe to the configured topic
          this._client.subscribe(cfg.topic, (err) => {
            if (err) {
              this._emit('error', err);
            }
          });
          resolve();
        });

        this._client.on('message', (topic, message) => {
          // message is a Buffer
          this._emit('data', new Uint8Array(message));
        });

        this._client.on('error', (e) => {
          this._emit('error', e);
          if (!this._client.connected) {
             reject(new Error('MQTT connection failed'));
          }
        });

        this._client.on('close', () => {
          this._emit('close');
        });
        
        this._client.on('offline', () => {
          // Usually emits before close or reconnect.
        });

      } catch (err) {
        reject(err);
      }
    });
  }

  async send(data) {
    if (!this._client || !this._client.connected) {
      throw new Error('MQTT not connected');
    }
    const cfg = appState.mqttConfig;
    // We publish to the same topic by default. Or we could define a transmit topic.
    // Assuming transmitting to the same topic or a standard TX topic.
    // For simplicity, we just publish to the subscribed topic for now.
    this._client.publish(cfg.topic, data);
  }

  async disconnect() {
    if (this._client) {
      this._client.end();
      this._client = null;
    }
  }
}
