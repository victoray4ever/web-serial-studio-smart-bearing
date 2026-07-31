import { appState } from '../../core/AppState.js';
import { t } from '../../core/i18n.js';

function brokerUrl(config, isDesktop) {
  if (!config.host) return '';
  if (isDesktop) {
    return `${config.useSSL ? 'mqtts' : 'mqtt'}://${config.host}:${config.port}`;
  }
  return `${config.useSSL ? 'wss' : 'ws'}://${config.host}:${config.port}${config.path}`;
}

export function buildMqttConfigPanel(cfg) {
  const isDesktop = !!window.memsCmsDesktop;
  const path = cfg.path || '/mqtt';
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const host = cfg.host || '';
  const useSSL = !!cfg.useSSL;
  const port = Number(cfg.port) || (isDesktop ? (useSSL ? 8883 : 1883) : (useSSL ? 8084 : 8083));
  const preview = brokerUrl({ host, port, path: normalizedPath, useSSL }, isDesktop) || t('sidebar.waitingForHost');
  const note = isDesktop
    ? (appState.locale === 'zh-CN'
      ? '软件端通过 Electron/Node 直接连接 MQTT 服务器。一个连接使用一个订阅主题；默认端口为 1883，SSL/TLS 通常使用 8883。'
      : 'The desktop app connects directly through Electron/Node. Each connection uses one subscription topic; default ports are 1883 or 8883 with TLS.')
    : t('sidebar.mqttHelper');

  return `
    <div class="mqtt-config-grid">
      <div class="form-row">
        <div class="form-label">${t('sidebar.mqttVersion')}</div>
        <select class="form-select" id="drv-mqtt-version">
          ${['3.1', '3.1.1', '5.0'].map((version) => `<option ${cfg.version === version ? 'selected' : ''} value="${version}">MQTT ${version}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-label">${t('sidebar.mode')}</div>
        <select class="form-select" id="drv-mqtt-mode">
          ${[
            ['PubSub', t('sidebar.subscribePublish')],
            ['SubscribeOnly', t('sidebar.subscribeOnly')],
            ['PublishOnly', t('sidebar.publishOnly')]
          ].map(([value, label]) => `<option ${cfg.mode === value ? 'selected' : ''} value="${value}">${label}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-label">${t('sidebar.qos')}</div>
        <select class="form-select" id="drv-mqtt-qos">
          ${[
            [0, t('sidebar.atMostOnce')],
            [1, t('sidebar.atLeastOnce')],
            [2, t('sidebar.exactlyOnce')]
          ].map(([value, label]) => `<option ${Number(cfg.qos) === value ? 'selected' : ''} value="${value}">${label}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-label">${t('sidebar.keepAlive')}</div>
        <input class="form-input" id="drv-mqtt-keepalive" type="number" min="5" max="3600" value="${cfg.keepalive ?? 60}">
      </div>
      <div class="form-row">
        <div class="form-label">${t('sidebar.host')}</div>
        <input class="form-input" id="drv-mqtt-host" value="${host}" placeholder="broker.example.com">
      </div>
      <div class="form-row">
        <div class="form-label">${t('sidebar.port')}</div>
        <input class="form-input" id="drv-mqtt-port" type="number" min="1" max="65535" value="${port}">
      </div>
      <div class="form-row">
        <div class="form-label">${t('sidebar.topic')}</div>
        <input class="form-input" id="drv-mqtt-topic" value="${cfg.topic || ''}" placeholder="sensor/data">
      </div>
      ${isDesktop ? '' : `
        <div class="form-row">
          <div class="form-label">${t('sidebar.websocketPath')}</div>
          <input class="form-input" id="drv-mqtt-path" value="${path}" placeholder="/mqtt">
        </div>
      `}
      <div class="form-row">
        <div class="form-label">${t('sidebar.username')}</div>
        <input class="form-input" id="drv-mqtt-user" value="${cfg.username || ''}" placeholder="${t('sidebar.optional')}">
      </div>
      <div class="form-row">
        <div class="form-label">${t('sidebar.password')}</div>
        <input class="form-input" id="drv-mqtt-pass" type="password" value="${cfg.password || ''}" placeholder="${t('sidebar.optional')}">
      </div>
      <div class="form-row">
        <div class="form-label">${t('sidebar.clientId')}</div>
        <input class="form-input mono" id="drv-mqtt-clientid" value="${cfg.clientId || ''}" placeholder="mems-cms-client">
      </div>
      <div class="form-row mqtt-toggles">
        <label class="checkbox-wrap">
          <input type="checkbox" id="drv-mqtt-ssl" ${useSSL ? 'checked' : ''}>
          <span>${t('sidebar.enableSsl')}</span>
        </label>
        <label class="checkbox-wrap">
          <input type="checkbox" id="drv-mqtt-clean" ${cfg.clean !== false ? 'checked' : ''}>
          <span>${t('sidebar.cleanSession')}</span>
        </label>
        <label class="checkbox-wrap">
          <input type="checkbox" id="drv-mqtt-retain" ${cfg.retain ? 'checked' : ''}>
          <span>${t('sidebar.retainPublish')}</span>
        </label>
      </div>
    </div>
    <div class="mqtt-helper-card">
      <div class="mqtt-helper-title">${isDesktop ? (appState.locale === 'zh-CN' ? 'MQTT 连接地址' : 'MQTT Connection URL') : t('sidebar.browserEndpoint')}</div>
      <div class="mqtt-helper-url mono">${preview}</div>
      <div class="mqtt-helper-note">${note}</div>
    </div>`;
}

export function bindMqttConfigPanel(panel) {
  const isDesktop = !!window.memsCmsDesktop;
  const update = () => {
    const useSSL = !!panel.querySelector('#drv-mqtt-ssl')?.checked;
    const rawPort = Number.parseInt(panel.querySelector('#drv-mqtt-port')?.value, 10);
    const port = Number.isInteger(rawPort) && rawPort >= 1 && rawPort <= 65535
      ? rawPort
      : (isDesktop ? (useSSL ? 8883 : 1883) : (useSSL ? 8084 : 8083));
    const rawPath = panel.querySelector('#drv-mqtt-path')?.value?.trim() || appState.mqttConfig.path || '/mqtt';
    const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
    const next = {
      transport: isDesktop ? 'tcp' : 'websocket',
      version: panel.querySelector('#drv-mqtt-version')?.value || '3.1.1',
      mode: panel.querySelector('#drv-mqtt-mode')?.value || 'PubSub',
      qos: Number.parseInt(panel.querySelector('#drv-mqtt-qos')?.value, 10) || 0,
      keepalive: Math.max(5, Number.parseInt(panel.querySelector('#drv-mqtt-keepalive')?.value, 10) || 60),
      host: panel.querySelector('#drv-mqtt-host')?.value?.trim() || '',
      port,
      topic: panel.querySelector('#drv-mqtt-topic')?.value?.trim() || '',
      path,
      username: panel.querySelector('#drv-mqtt-user')?.value || '',
      password: panel.querySelector('#drv-mqtt-pass')?.value || '',
      clientId: panel.querySelector('#drv-mqtt-clientid')?.value?.trim() || '',
      useSSL,
      clean: !!panel.querySelector('#drv-mqtt-clean')?.checked,
      retain: !!panel.querySelector('#drv-mqtt-retain')?.checked
    };
    next.brokerUrl = brokerUrl(next, isDesktop);
    appState.updateMqttConfig(next);

    const portInput = panel.querySelector('#drv-mqtt-port');
    if (portInput && portInput.value !== String(port)) portInput.value = String(port);
    const preview = panel.querySelector('.mqtt-helper-url');
    if (preview) preview.textContent = next.brokerUrl || t('sidebar.waitingForHost');
  };

  panel.querySelectorAll(
    '#drv-mqtt-version, #drv-mqtt-mode, #drv-mqtt-qos, #drv-mqtt-keepalive, #drv-mqtt-host, #drv-mqtt-port, #drv-mqtt-topic, #drv-mqtt-path, #drv-mqtt-user, #drv-mqtt-pass, #drv-mqtt-clientid, #drv-mqtt-ssl, #drv-mqtt-clean, #drv-mqtt-retain'
  ).forEach((element) => {
    const eventName = element.type === 'checkbox' || element.tagName === 'SELECT' ? 'change' : 'input';
    element.addEventListener(eventName, update);
  });
  update();
}
