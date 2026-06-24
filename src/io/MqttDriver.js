/**
 * MqttDriver - MQTT connection driver using mqtt.js via WebSocket
 */
import { appState } from '../core/AppState.js';

function getProtocolOptions(version) {
  if (version === '3.1') {
    return { protocolId: 'MQIsdp', protocolVersion: 3 };
  }
  if (version === '5.0') {
    return { protocolId: 'MQTT', protocolVersion: 5 };
  }
  return { protocolId: 'MQTT', protocolVersion: 4 };
}

function buildBrokerUrl(cfg) {
  const rawUrl = (cfg.brokerUrl || '').trim();
  if (rawUrl) {
    if (rawUrl.startsWith('ws://') || rawUrl.startsWith('wss://')) return rawUrl;
    if (rawUrl.startsWith('mqtt://') || rawUrl.startsWith('tcp://')) {
      throw new Error('Browser MQTT requires a ws:// or wss:// endpoint, not mqtt:// or tcp://.');
    }
  }

  const host = (cfg.host || '').trim();
  if (!host) {
    throw new Error('MQTT host is required.');
  }

  const scheme = cfg.useSSL ? 'wss' : 'ws';
  const path = (cfg.path || '/mqtt').trim() || '/mqtt';
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const port = Number(cfg.port) || (cfg.useSSL ? 8084 : 8083);
  return `${scheme}://${host}:${port}${normalizedPath}`;
}

function messageToBytes(message) {
  if (typeof message === 'string') return new TextEncoder().encode(message);
  if (message instanceof ArrayBuffer) return new Uint8Array(message);
  if (ArrayBuffer.isView(message)) {
    return new Uint8Array(message.buffer, message.byteOffset, message.byteLength);
  }
  return new TextEncoder().encode(String(message ?? ''));
}

function normalizeSubscription(item, fallbackQos = 0) {
  if (!item) return null;
  if (typeof item === 'string') {
    const trimmed = item.trim();
    return trimmed ? { topic: trimmed, qos: fallbackQos } : null;
  }

  const topic = String(item.topic || item.mqttTopic || '').trim();
  if (!topic) return null;
  return {
    ...item,
    topic,
    sourceId: item.sourceId ?? item.source ?? item.parserSourceId ?? '',
    qos: Number.isFinite(Number(item.qos)) ? Number(item.qos) : fallbackQos
  };
}

function dedupeSubscriptions(subscriptions) {
  const seen = new Set();
  return subscriptions.filter((subscription) => {
    const key = `${subscription.topic}:${subscription.sourceId ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mqttTopicMatches(filter, topic) {
  const filterParts = String(filter || '').split('/');
  const topicParts = String(topic || '').split('/');
  for (let i = 0; i < filterParts.length; i += 1) {
    const part = filterParts[i];
    if (part === '#') return i === filterParts.length - 1;
    if (part !== '+' && part !== topicParts[i]) return false;
  }
  return filterParts.length === topicParts.length;
}

function sourceConnectionConfig(baseCfg, source = {}) {
  const nested = source.connection || source.mqtt || {};
  const direct = {};
  [
    'version', 'mode', 'keepalive', 'host', 'port', 'path', 'username', 'password',
    'clientId', 'useSSL', 'brokerUrl', 'clean', 'retain', 'qos'
  ].forEach((key) => {
    if (source[key] !== undefined) direct[key] = source[key];
  });
  return { ...baseCfg, ...nested, ...direct };
}

function connectionKey(cfg) {
  return [
    cfg.brokerUrl || '',
    cfg.useSSL ? 'wss' : 'ws',
    cfg.host || '',
    Number(cfg.port) || '',
    cfg.path || '/mqtt',
    cfg.username || ''
  ].join('|');
}

function addPlan(planMap, cfg, subscriptions) {
  const cleanSubscriptions = dedupeSubscriptions((subscriptions || []).filter(Boolean));
  if (!cleanSubscriptions.length) return;
  const key = connectionKey(cfg);
  if (!planMap.has(key)) {
    planMap.set(key, { cfg, subscriptions: [] });
  }
  const plan = planMap.get(key);
  plan.subscriptions = dedupeSubscriptions([...plan.subscriptions, ...cleanSubscriptions]);
}

function buildConnectionPlans(cfg) {
  const fallbackQos = Number(cfg.qos) || 0;
  const plans = new Map();

  if (Array.isArray(cfg.connections)) {
    cfg.connections.forEach((connection, index) => {
      const connectionCfg = { ...cfg, ...connection, clientId: connection.clientId || `${cfg.clientId || 'web-serial-studio'}-${index + 1}` };
      const subscriptions = Array.isArray(connection.subscriptions)
        ? connection.subscriptions.map((item) => normalizeSubscription(item, fallbackQos)).filter(Boolean)
        : [normalizeSubscription({ topic: connection.topic || connection.mqttTopic, qos: connection.qos ?? fallbackQos }, fallbackQos)].filter(Boolean);
      addPlan(plans, connectionCfg, subscriptions);
    });
  }

  const configSubscriptions = Array.isArray(cfg.subscriptions)
    ? cfg.subscriptions.map((item) => normalizeSubscription(item, fallbackQos)).filter(Boolean)
    : [];
  const singleSubscription = normalizeSubscription({ topic: cfg.topic, qos: fallbackQos }, fallbackQos);
  if (configSubscriptions.length || singleSubscription) {
    addPlan(plans, cfg, configSubscriptions.length ? configSubscriptions : [singleSubscription]);
  }

  const sources = Array.isArray(appState.project?.sources) ? appState.project.sources : [];
  sources.forEach((source) => {
    const type = String(source.type || source.busType || source.bus || '').toLowerCase();
    const topic = source.topic || source.mqttTopic;
    if (!topic && type !== 'mqtt') return;
    const sourceCfg = sourceConnectionConfig(cfg, source);
    const subscription = normalizeSubscription({
      topic,
      sourceId: source.sourceId,
      title: source.title,
      qos: source.qos ?? fallbackQos
    }, fallbackQos);
    addPlan(plans, sourceCfg, [subscription]);
  });

  return [...plans.values()];
}

export class MqttDriver {
  constructor() {
    this._client = null;
    this._clients = [];
    this._callbacks = { data: [], error: [], close: [] };
    this._subscriptions = [];
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

    const connectPlan = (plan, planIndex) => new Promise((resolve, reject) => {
      let settled = false;
      try {
        const planCfg = plan.cfg;
        const brokerUrl = buildBrokerUrl(planCfg);
        const options = {
          keepalive: Math.max(5, Number(planCfg.keepalive) || 60),
          clientId: (planCfg.clientId || '').trim() || ('serial_studio_' + Math.random().toString(16).substring(2, 8)) + `_${planIndex + 1}`,
          clean: planCfg.clean !== false,
          connectTimeout: 5000,
          reconnectPeriod: 0,
          ...getProtocolOptions(planCfg.version),
        };

        if (planCfg.username) options.username = planCfg.username;
        if (planCfg.password) options.password = planCfg.password;

        const client = window.mqtt.connect(brokerUrl, options);
        this._clients.push(client);
        if (!this._client) this._client = client;

        client.on('connect', () => {
          const shouldSubscribe = (planCfg.mode || 'PubSub') !== 'PublishOnly';
          if (shouldSubscribe) {
            const subscriptions = plan.subscriptions || [];
            if (!subscriptions.length) {
              if (!settled) {
                settled = true;
                reject(new Error('MQTT topic is required for subscribe mode.'));
              }
              client.end(true);
              return;
            }

            this._subscriptions = dedupeSubscriptions([...this._subscriptions, ...subscriptions]);
            const topicMap = subscriptions.reduce((acc, subscription) => {
              acc[subscription.topic] = { qos: Number(subscription.qos) || 0 };
              return acc;
            }, {});

            client.subscribe(topicMap, (err) => {
              if (err) {
                this._emit('error', err);
                if (!settled) {
                  settled = true;
                  reject(new Error(`MQTT subscribe failed: ${err.message || err}`));
                }
                client.end(true);
                return;
              }
              if (!settled) {
                settled = true;
                resolve();
              }
            });
            return;
          }

          if (!settled) {
            settled = true;
            resolve();
          }
        });

        client.on('message', (topic, message) => {
          const subscription = (plan.subscriptions || []).find((item) => mqttTopicMatches(item.topic, topic)) || { topic };
          this._emit('data', {
            payload: messageToBytes(message),
            topic,
            sourceId: subscription.sourceId,
            subscription,
            brokerUrl
          });
        });

        client.on('error', (e) => {
          this._emit('error', e);
          if (!settled) {
            settled = true;
            reject(new Error(`MQTT connection failed (${brokerUrl}). Browser mode requires a WebSocket MQTT endpoint.`));
          }
        });

        client.on('close', () => {
          this._emit('close');
          if (!settled) {
            settled = true;
            reject(new Error(`MQTT connection closed before handshake completed (${brokerUrl}).`));
          }
        });

        client.on('offline', () => {
          if (!settled) {
            settled = true;
            reject(new Error(`MQTT client went offline while connecting (${brokerUrl}).`));
          }
        });

      } catch (err) {
        reject(err);
      }
    });

    const plans = buildConnectionPlans(cfg);
    if (!plans.length) {
      if ((cfg.mode || 'PubSub') === 'PublishOnly') {
        plans.push({ cfg, subscriptions: [] });
      } else {
        throw new Error('MQTT topic is required for subscribe mode.');
      }
    }
    await Promise.all(plans.map((plan, index) => connectPlan(plan, index)));
  }

  async send(data) {
    const client = this._clients.find((item) => item?.connected) || this._client;
    if (!client || !client.connected) {
      throw new Error('MQTT not connected');
    }
    const cfg = appState.mqttConfig;
    const topic = (cfg.publishTopic || cfg.topic || '').trim();
    if (!topic) throw new Error('MQTT topic is required');
    client.publish(topic, data, {
      qos: Number(cfg.qos) || 0,
      retain: !!cfg.retain
    });
  }

  async disconnect() {
    this._clients.forEach((client) => client?.end(true));
    this._clients = [];
    this._client = null;
    this._subscriptions = [];
  }
}
