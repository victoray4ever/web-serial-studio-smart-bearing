const { app, BrowserWindow, Menu, shell, session, ipcMain, dialog } = require('electron');
const path = require('path');
const mqtt = require('mqtt');
const { startIntegratedUdpGateway } = require('./udpGateway');
const { setupHistoryStorageIpc } = require('./historyStorage');
const { createUpdateManager } = require('./updateManager');

const isSmokeTest = process.env.ELECTRON_SMOKE_TEST === '1';
const isDevMode = !app.isPackaged;
const appIconPath = path.join(__dirname, '..', 'src', 'assets', 'cms-icon.ico');
let udpGatewayServer = null;
let udpGatewayPort = 8765;
const mqttSessions = new Map();
let mainWindow = null;
let updateManager = null;
let historyStorage = null;
let historyShutdownStarted = false;
let historyShutdownComplete = false;

app.setAppUserModelId('edu.neu.memslab.cms');

function ipcPayloadToBuffer(payload, payloadBase64) {
  if (payloadBase64) return Buffer.from(String(payloadBase64), 'base64');
  if (Buffer.isBuffer(payload)) return Buffer.from(payload);
  if (payload instanceof ArrayBuffer) return Buffer.from(new Uint8Array(payload));
  if (ArrayBuffer.isView(payload)) return Buffer.from(payload.buffer, payload.byteOffset, payload.byteLength);
  if (Array.isArray(payload)) return Buffer.from(payload);
  return Buffer.from(String(payload ?? ''), 'utf8');
}

function mqttProtocolOptions(version) {
  if (version === '3.1') return { protocolId: 'MQIsdp', protocolVersion: 3 };
  if (version === '5.0') return { protocolId: 'MQTT', protocolVersion: 5 };
  return { protocolId: 'MQTT', protocolVersion: 4 };
}

function mqttBrokerUrl(cfg = {}) {
  const rawUrl = String(cfg.brokerUrl || '').trim();
  if (rawUrl) {
    if (rawUrl.startsWith('tcp://')) return `mqtt://${rawUrl.slice('tcp://'.length)}`;
    if (rawUrl.startsWith('tls://')) return `mqtts://${rawUrl.slice('tls://'.length)}`;
    if (rawUrl.startsWith('mqtt://') || rawUrl.startsWith('mqtts://')) return rawUrl;
  }
  const host = String(cfg.host || '').trim();
  if (!host) throw new Error('MQTT host is required.');
  const useSSL = !!cfg.useSSL;
  const port = Number(cfg.port) || (useSSL ? 8883 : 1883);
  return `${useSSL ? 'mqtts' : 'mqtt'}://${host}:${port}`;
}

function closeMqttSession(sessionId) {
  const session = mqttSessions.get(sessionId);
  if (!session) return;
  session.clients.forEach((client) => {
    try { client.end(true); } catch (_error) { /* already closed */ }
  });
  mqttSessions.delete(sessionId);
}

function setupMqttIpc() {
  ipcMain.handle('mqtt-tcp:connect', async (event, options = {}) => {
    const sessionId = String(options.sessionId || 'default');
    closeMqttSession(sessionId);
    const plans = Array.isArray(options.plans) ? options.plans : [];
    if (!plans.length) throw new Error('MQTT connection plan is empty.');

    const owner = event.sender;
    const session = { clients: [], owner };
    mqttSessions.set(sessionId, session);

    const connectPlan = (plan = {}, index) => new Promise((resolve, reject) => {
      let settled = false;
      const cfg = plan.cfg || {};
      const brokerUrl = mqttBrokerUrl(cfg);
      const clientIdBase = String(cfg.clientId || '').trim() || `mems_cms_${Math.random().toString(16).slice(2, 8)}`;
      const client = mqtt.connect(brokerUrl, {
        keepalive: Math.max(5, Number(cfg.keepalive) || 60),
        clientId: `${clientIdBase}_${index + 1}`,
        clean: cfg.clean !== false,
        connectTimeout: 5000,
        reconnectPeriod: 0,
        username: cfg.username || undefined,
        password: cfg.password || undefined,
        ...mqttProtocolOptions(cfg.version)
      });

      session.clients.push(client);
      client.on('connect', () => {
        const shouldSubscribe = (cfg.mode || 'PubSub') !== 'PublishOnly';
        if (!shouldSubscribe) {
          settled = true;
          resolve();
          return;
        }
        const subscriptions = Array.isArray(plan.subscriptions) ? plan.subscriptions : [];
        if (!subscriptions.length) {
          settled = true;
          client.end(true);
          reject(new Error('MQTT topic is required for subscribe mode.'));
          return;
        }
        const topicMap = subscriptions.reduce((acc, subscription) => {
          acc[subscription.topic] = { qos: Number(subscription.qos) || 0 };
          return acc;
        }, {});
        client.subscribe(topicMap, (error) => {
          if (error) {
            settled = true;
            client.end(true);
            reject(new Error(`MQTT subscribe failed: ${error.message || error}`));
            return;
          }
          settled = true;
          resolve();
        });
      });

      client.on('message', (topic, message) => {
        owner.send('mqtt-tcp:data', {
          sessionId,
          topic,
          payloadBase64: Buffer.from(message).toString('base64'),
          subscriptions: plan.subscriptions || [],
          brokerUrl
        });
      });
      client.on('error', (error) => {
        owner.send('mqtt-tcp:error', { sessionId, message: error.message || String(error), brokerUrl });
        if (!settled) {
          settled = true;
          reject(new Error(`MQTT TCP connection failed (${brokerUrl}): ${error.message || error}`));
        }
      });
      client.on('close', () => {
        owner.send('mqtt-tcp:close', { sessionId, brokerUrl });
        if (!settled) {
          settled = true;
          reject(new Error(`MQTT TCP connection closed before handshake completed (${brokerUrl}).`));
        }
      });
    });

    try {
      await Promise.all(plans.map((plan, index) => connectPlan(plan, index)));
      return { ok: true };
    } catch (error) {
      closeMqttSession(sessionId);
      throw error;
    }
  });

  ipcMain.handle('mqtt-tcp:publish', async (_event, options = {}) => {
    const sessionId = String(options.sessionId || 'default');
    const session = mqttSessions.get(sessionId);
    const client = session?.clients.find((item) => item.connected);
    if (!client) throw new Error('MQTT TCP not connected.');
    const topic = String(options.topic || '').trim();
    if (!topic) throw new Error('MQTT topic is required.');
    const payload = ipcPayloadToBuffer(options.payload, options.payloadBase64);
    await new Promise((resolve, reject) => {
      client.publish(topic, payload, {
        qos: Number(options.qos) || 0,
        retain: !!options.retain
      }, (error) => (error ? reject(error) : resolve()));
    });
    return { ok: true };
  });

  ipcMain.handle('mqtt-tcp:disconnect', async (_event, sessionId = 'default') => {
    closeMqttSession(String(sessionId || 'default'));
    return { ok: true };
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function serialDisplayName(port) {
  return port.displayName || port.portName || port.portId || 'Serial Port';
}

function serialMeta(port) {
  const items = [];
  if (port.portName) items.push(`端口 ${port.portName}`);
  if (port.portId && port.portId !== port.portName) items.push(`ID ${port.portId}`);
  if (port.vendorId) items.push(`VID ${port.vendorId}`);
  if (port.productId) items.push(`PID ${port.productId}`);
  if (port.serialNumber) items.push(`SN ${port.serialNumber}`);
  return items.join(' · ') || '串口设备';
}

function buildSerialPickerHtml(portList) {
  const rows = portList.map((port, index) => `
    <button class="port-row ${index === 0 ? 'selected' : ''}" data-port-id="${escapeHtml(port.portId)}">
      <span class="port-index">${index + 1}</span>
      <span class="port-main">
        <span class="port-title">${escapeHtml(serialDisplayName(port))}</span>
        <span class="port-meta">${escapeHtml(serialMeta(port))}</span>
      </span>
      <span class="port-badge">${escapeHtml(port.portName || port.portId || 'COM')}</span>
    </button>
  `).join('');

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <style>
    :root {
      color-scheme: light;
      --accent:#004769;
      --accent-2:#006b88;
      --border:#d8e0e7;
      --text:#000;
      --muted:#4b5563;
      --panel:#fff;
      --soft:#f4f8fb;
    }
    * { box-sizing:border-box; }
    body {
      margin:0;
      font-family:"Microsoft YaHei UI","Segoe UI",Arial,sans-serif;
      background:#fff;
      color:var(--text);
      font-size:14px;
      overflow:hidden;
    }
    .titlebar {
      height:36px;
      display:flex;
      align-items:center;
      justify-content:space-between;
      padding:0 12px;
      border-bottom:1px solid var(--border);
      background:#f7fbfd;
      font-weight:700;
    }
    .titlebar span:first-child::before {
      content:"";
      display:inline-block;
      width:9px;
      height:9px;
      margin-right:9px;
      background:var(--accent);
      transform:rotate(45deg);
      border-radius:2px;
      vertical-align:1px;
    }
    .close {
      border:0;
      background:transparent;
      color:#111827;
      font-size:20px;
      line-height:1;
      cursor:pointer;
      width:28px;
      height:28px;
    }
    .content { padding:18px 20px 16px; }
    .hint {
      display:flex;
      align-items:center;
      gap:12px;
      margin-bottom:14px;
      color:#111827;
      font-weight:600;
    }
    .hint-icon {
      width:30px;
      height:30px;
      border-radius:7px;
      background:var(--accent);
      color:white;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      font-weight:800;
      font-family:Georgia,serif;
    }
    .list {
      max-height:300px;
      overflow:auto;
      border:1px solid var(--border);
      border-radius:8px;
      background:var(--panel);
    }
    .port-row {
      width:100%;
      display:grid;
      grid-template-columns:34px minmax(0,1fr) auto;
      gap:10px;
      align-items:center;
      min-height:54px;
      padding:8px 10px;
      border:0;
      border-bottom:1px solid var(--border);
      background:#fff;
      color:var(--text);
      text-align:left;
      cursor:pointer;
      font:inherit;
    }
    .port-row:last-child { border-bottom:0; }
    .port-row:hover,
    .port-row.selected {
      background:#eef6fa;
      outline:1px solid rgba(0,71,105,.35);
      outline-offset:-1px;
    }
    .port-index {
      width:24px;
      height:24px;
      border-radius:5px;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      background:var(--accent);
      color:#fff;
      font-weight:800;
      font-size:12px;
    }
    .port-main { min-width:0; display:flex; flex-direction:column; gap:3px; }
    .port-title { font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .port-meta { color:var(--muted); font-size:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .port-badge {
      max-width:190px;
      padding:4px 8px;
      border-radius:5px;
      background:var(--soft);
      border:1px solid var(--border);
      color:var(--accent);
      font-weight:700;
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
    }
    .footer {
      display:flex;
      justify-content:flex-end;
      gap:10px;
      margin-top:14px;
    }
    .btn {
      min-width:82px;
      height:34px;
      border-radius:6px;
      border:1px solid var(--border);
      background:#fff;
      color:#111827;
      font-weight:700;
      cursor:pointer;
    }
    .btn.primary {
      border-color:var(--accent);
      background:var(--accent);
      color:#fff;
    }
  </style>
</head>
<body>
  <div class="titlebar"><span>选择串口</span><button class="close" id="close">×</button></div>
  <div class="content">
    <div class="hint"><span class="hint-icon">i</span><span>请选择要连接的串口设备</span></div>
    <div class="list" id="list">${rows}</div>
    <div class="footer">
      <button class="btn" id="cancel">取消</button>
      <button class="btn primary" id="ok">连接</button>
    </div>
  </div>
  <script>
    let selected = document.querySelector('.port-row.selected')?.dataset.portId || '';
    document.querySelectorAll('.port-row').forEach((row) => {
      row.addEventListener('click', () => {
        document.querySelectorAll('.port-row').forEach((item) => item.classList.remove('selected'));
        row.classList.add('selected');
        selected = row.dataset.portId || '';
      });
      row.addEventListener('dblclick', () => window.serialPicker.choose(row.dataset.portId || ''));
    });
    document.getElementById('ok').addEventListener('click', () => window.serialPicker.choose(selected));
    document.getElementById('cancel').addEventListener('click', () => window.serialPicker.cancel());
    document.getElementById('close').addEventListener('click', () => window.serialPicker.cancel());
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') window.serialPicker.cancel();
      if (event.key === 'Enter') window.serialPicker.choose(selected);
    });
  </script>
</body>
</html>`;
}

function showSerialPicker(parent, portList) {
  return new Promise((resolve) => {
    if (!portList.length) {
      resolve('');
      return;
    }

    const picker = new BrowserWindow({
      width: 760,
      height: 430,
      minWidth: 620,
      minHeight: 340,
      parent,
      modal: !!parent,
      title: '选择串口',
      backgroundColor: '#ffffff',
      autoHideMenuBar: true,
      resizable: true,
      webPreferences: {
        preload: path.join(__dirname, 'serialPickerPreload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    });

    let settled = false;
    const settle = (portId) => {
      if (settled) return;
      settled = true;
      ipcMain.removeListener('serial-picker:choose', chooseHandler);
      ipcMain.removeListener('serial-picker:cancel', cancelHandler);
      if (!picker.isDestroyed()) picker.close();
      resolve(portId || '');
    };
    const chooseHandler = (event, portId) => {
      if (event.sender === picker.webContents) settle(portId);
    };
    const cancelHandler = (event) => {
      if (event.sender === picker.webContents) settle('');
    };
    ipcMain.on('serial-picker:choose', chooseHandler);
    ipcMain.on('serial-picker:cancel', cancelHandler);
    picker.on('closed', () => settle(''));
    picker.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(buildSerialPickerHtml(portList))}`);
  });
}

function configureSerialPermissions() {
  const ses = session.defaultSession;

  ses.setPermissionCheckHandler((_webContents, permission) => {
    if (permission === 'serial') return true;
    return false;
  });

  ses.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'serial');
  });

  if (typeof ses.setDevicePermissionHandler === 'function') {
    ses.setDevicePermissionHandler(({ deviceType }) => deviceType === 'serial');
  }

  ses.on('select-serial-port', (event, portList, webContents, callback) => {
    event.preventDefault();

    if (!portList.length) {
      callback('');
      return;
    }

    if (portList.length === 1 || isSmokeTest) {
      callback(portList[0].portId);
      return;
    }

    const parent = BrowserWindow.fromWebContents(webContents);
    showSerialPicker(parent, portList).then(callback).catch(() => callback(''));
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1180,
    minHeight: 760,
    title: 'MEMS-CMS',
    icon: appIconPath,
    backgroundColor: '#ffffff',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true
    }
  });

  win.once('ready-to-show', () => {
    if (!isSmokeTest) win.show();
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    const current = win.webContents.getURL();
    if (current && url !== current && /^https?:\/\//i.test(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  if (isSmokeTest) {
    win.webContents.once('did-finish-load', async () => {
      try {
        const result = await win.webContents.executeJavaScript(`({
          title: document.title,
          appVersion: window.memsCmsDesktop?.app?.version || '',
          hasApp: !!document.querySelector('#app'),
          hasSerialApi: !!navigator.serial,
          hasToolbarRoot: !!document.querySelector('#toolbar-root'),
          hasDashboardArea: !!document.querySelector('#dashboard-area'),
          hasProjectEditorButton: !!document.querySelector('#btn-project-editor'),
          hasChart: !!window.Chart,
          hasMqtt: !!window.mqtt
        })`);
        const simplifiedSettings = await win.webContents.executeJavaScript(`(async () => {
          document.querySelector('[data-bus="MQTT"]')?.click();
          await new Promise((resolve) => setTimeout(resolve, 50));
          const mqttHasSubscriptionList = !!document.querySelector('#drv-mqtt-subscriptions');
          const sidebarHasHistoryPoints = !!document.querySelector('#cfg-points');
          document.querySelector('#btn-preferences')?.click();
          await new Promise((resolve) => setTimeout(resolve, 50));
          const preferencesHasHistoryPoints = !!document.querySelector('#pref-points');
          document.querySelector('#pref-close')?.click();
          return {
            mqttSingleTopicOnly: !mqttHasSubscriptionList,
            historyPointsHidden: !sidebarHasHistoryPoints && !preferencesHasHistoryPoints
          };
        })()`);
        result.simplifiedSettings = simplifiedSettings;
        const projectJson = await win.webContents.executeJavaScript(`(async () => {
          const { ProjectModel } = await import('./src/core/ProjectModel.js?v=electron-smoke-20260709-1');
          const model = new ProjectModel();
          const ok = model.loadFromJSON({
            title: 'Smoke Project',
            frameStart: '',
            frameEnd: '\\\\n',
            frameDetection: 'EndDelimiterOnly',
            groups: [
              {
                title: 'Sensor Data',
                datasets: [
                  {
                    title: 'Temperature',
                    units: 'degC',
                    index: 0,
                    widget: 'Plot',
                    graph: true,
                    min: 0,
                    max: 100
                  }
                ]
              }
            ]
          });
          return {
            ok,
            title: model.project?.title || '',
            groups: model.project?.groups?.length || 0,
            datasets: model.project?.groups?.[0]?.datasets?.length || 0
          };
        })()`);
        result.projectJson = projectJson;
        const multiSourceProject = await win.webContents.executeJavaScript(`(async () => {
          const { ProjectModel } = await import('./src/core/ProjectModel.js?v=multi-source-smoke-20260729-1');
          const { FrameParser } = await import('./src/core/FrameParser.js?v=multi-source-smoke-20260729-1');
          const model = new ProjectModel();
          const ok = model.loadFromJSON({
            title: 'Multi Source Smoke',
            protocol: 'Binary',
            parsers: {
              short: {
                frameStart: '5A A5',
                frameEnd: 'DD EE',
                hexadecimalDelimiters: true,
                frameParserCode: 'function parse(frame) { return [1468]; }'
              },
              long: {
                frameStart: 'A5 5A',
                frameEnd: 'EE DD',
                hexadecimalDelimiters: true,
                frameParserCode: 'function parse(frame) { return [5732]; }'
              }
            },
            sources: [
              { sourceId: 'node-short', parser: 'short' },
              { sourceId: 'node-long', parser: 'long' }
            ],
            groups: [
              { title: 'Short', sourceId: 'node-short', datasets: [{ title: 'A', sourceId: 'node-short', index: 0 }] },
              { title: 'Long', sourceId: 'node-long', datasets: [{ title: 'B', sourceId: 'node-long', index: 0 }] }
            ]
          });
          const shortParser = new FrameParser({
            operationMode: 'ProjectFile',
            project: model.project,
            source: model.project.sources[0],
            sourceId: 'node-short'
          });
          const longParser = new FrameParser({
            operationMode: 'ProjectFile',
            project: model.project,
            source: model.project.sources[1],
            sourceId: 'node-long'
          });
          const result = {
            ok,
            sources: model.project.sources.length,
            parsers: Object.keys(model.project.parsers || {}).length,
            shortSelected: shortParser._projectFrameParserCode().includes('1468'),
            longSelected: longParser._projectFrameParserCode().includes('5732'),
            duplicateDatasetIndicesPreserved: model.project.groups.every((group) => group.datasets[0]?.index === 0)
          };
          shortParser.destroy();
          longParser.destroy();
          return result;
        })()`);
        result.multiSourceProject = multiSourceProject;
        const gatewayProjectBinding = await win.webContents.executeJavaScript(`(async () => {
          const {
            analyzeGatewayParserProject,
            buildGatewayCombinedProject
          } = await import('./src/ui/gateway/GatewayProjectBinding.js?v=gateway-workflow-smoke-20260729-1');
          const analysis = analyzeGatewayParserProject({
            title: 'Node Parser',
            protocol: 'Binary',
            frameParserCode: 'function parse(frame) { return [frame.length, 42]; }',
            groups: [{
              title: 'Signals',
              widget: 'MultiPlot',
              datasets: [
                { title: 'Length', index: 0, plot: true },
                { title: 'Value', index: 1, plot: true }
              ]
            }]
          }, 'node-parser.json');
          const project = buildGatewayCombinedProject(null, [{
            ip: '192.168.1.251',
            sourceId: 'node-01',
            title: 'Node 01',
            frame: { frameLength: 1468 }
          }], [{
            sourceId: 'node-01',
            analysis,
            selectedKeys: ['0:1']
          }]);
          return {
            ok: project.sources?.[0]?.parser === 'parser-node-01',
            parserFileName: project.sources?.[0]?.parserFileName,
            selectedDatasets: project.groups?.flatMap((group) => group.datasets || []).length,
            selectedTitle: project.groups?.[0]?.datasets?.[0]?.title,
            sourceId: project.groups?.[0]?.datasets?.[0]?.sourceId
          };
        })()`);
        result.gatewayProjectBinding = gatewayProjectBinding;
        const gatewayWorkflowUi = await win.webContents.executeJavaScript(`(async () => {
          const { GatewayConfigDialog } = await import('./src/ui/GatewayConfigDialog.js?v=gateway-workflow-ui-smoke-20260729-1');
          const root = document.querySelector('#modal-root');
          const dialog = new GatewayConfigDialog(root);
          dialog.open();
          dialog._config = {
            udp: { host: '0.0.0.0', port: 4000 },
            websocket: { host: '127.0.0.1', port: 8765 },
            routing: {
              unknownDevices: 'ip',
              devices: [{ ip: '192.168.1.251', sourceId: 'node-01', title: 'Node 01' }]
            },
            aggregation: {
              mode: 'frame',
              frame: { startDelimiter: '5A A5', endDelimiter: 'DD EE', frameLength: 1468 }
            },
            status: { intervalMs: 1000, offlineAfterMs: 5000 }
          };
          dialog._initializeDevices();
          dialog._renderCurrent();
          const modal = root.querySelector('.gateway-config-modal');
          const deviceResult = {
            tabs: root.querySelectorAll('[data-gateway-tab]').length,
            identityFields: root.querySelectorAll('[data-device-field]').length,
            essentialFrameFields: root.querySelectorAll('.gateway-device-frame-fields.essential [data-device-frame-field]').length,
            parserInputs: root.querySelectorAll('[data-parser-file]').length,
            hasOutboundControls: !!root.querySelector('#gateway-outbound-host, #gateway-default-source'),
            fitsViewport: modal ? modal.getBoundingClientRect().width <= window.innerWidth : false
          };
          dialog._lastStatus = {
            type: 'gateway.status',
            gateway: 'Smoke Gateway',
            frames: 12,
            bytes: 4096,
            incompleteFrames: 1,
            lost: 0,
            outOfOrder: 0,
            dropped: 0,
            onlineDevices: 1,
            knownDevices: 1,
            devices: [{
              sourceId: 'node-01',
              title: 'Node 01',
              ip: '192.168.1.251',
              port: 1030,
              online: true,
              frames: 12,
              bufferedBytes: 0,
              incompleteFrames: 1,
              invalidFrames: 0,
              lost: 0
            }]
          };
          dialog._setTab('diagnostics');
          const result = {
            ...deviceResult,
            diagnosticCards: root.querySelectorAll('.gateway-diagnostic-device').length,
            diagnosticMetrics: root.querySelectorAll('.gateway-diagnostic-summary > div').length
          };
          dialog.close();
          return result;
        })()`);
        result.gatewayWorkflowUi = gatewayWorkflowUi;
        const udpGateway = await win.webContents.executeJavaScript(`new Promise((resolve) => {
          let done = false;
          let updateSent = false;
          let saved = false;
          const expectedIp = '192.168.137.250';
          const finish = (value) => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            try { ws?.close(); } catch (_error) {}
            resolve(value);
          };
          let ws = null;
          const timer = setTimeout(() => finish({ ok: false, error: 'timeout' }), 3000);
          try {
            ws = new WebSocket('ws://127.0.0.1:${udpGatewayPort}?client=mems-cms');
            ws.addEventListener('message', (event) => {
              try {
                const message = JSON.parse(event.data);
                if (message.type === 'gateway.hello') {
                  ws.send(JSON.stringify({ type: 'gateway.config.request' }));
                  return;
                }
                if (message.type === 'gateway.config' && !updateSent) {
                  const config = message.config || {};
                  config.routing = config.routing || {};
                  config.routing.devices = Array.isArray(config.routing.devices) ? config.routing.devices : [];
                  if (!config.routing.devices.length) {
                    config.routing.devices.push({ sourceId: 'node-01', title: 'Node 01' });
                  }
                  config.routing.devices[0].ip = expectedIp;
                  updateSent = true;
                  ws.send(JSON.stringify({ type: 'gateway.config.update', config }));
                  return;
                }
                if (message.type === 'gateway.config.saved') {
                  saved = true;
                  ws.send(JSON.stringify({ type: 'gateway.config.request' }));
                  return;
                }
                if (message.type === 'gateway.config' && saved) {
                  finish({
                    ok: message.config?.routing?.devices?.[0]?.ip === expectedIp,
                    type: 'gateway.config.saved',
                    udp: message.config?.udp,
                    persistedIp: message.config?.routing?.devices?.[0]?.ip
                  });
                }
              } catch (_error) {
                // Ignore non-status payloads.
              }
            });
            ws.addEventListener('error', () => finish({ ok: false, error: 'websocket error' }));
          } catch (error) {
            finish({ ok: false, error: error.message || String(error) });
          }
        })`);
        result.udpGateway = udpGateway;
        console.log(JSON.stringify(result, null, 2));
        const smokePassed =
          result.title === 'MEMS-CMS' &&
          result.appVersion === app.getVersion() &&
          result.hasApp &&
          result.hasChart &&
          result.hasMqtt &&
          result.simplifiedSettings?.mqttSingleTopicOnly &&
          projectJson.ok &&
          multiSourceProject.ok &&
          multiSourceProject.shortSelected &&
          multiSourceProject.longSelected &&
          multiSourceProject.duplicateDatasetIndicesPreserved &&
          gatewayProjectBinding.ok &&
          gatewayProjectBinding.parserFileName === 'node-parser.json' &&
          gatewayProjectBinding.selectedDatasets === 1 &&
          gatewayProjectBinding.selectedTitle === 'Value' &&
          gatewayProjectBinding.sourceId === 'node-01' &&
          gatewayWorkflowUi.tabs === 2 &&
          gatewayWorkflowUi.identityFields === 3 &&
          gatewayWorkflowUi.essentialFrameFields === 3 &&
          gatewayWorkflowUi.parserInputs === 1 &&
          !gatewayWorkflowUi.hasOutboundControls &&
          gatewayWorkflowUi.fitsViewport &&
          gatewayWorkflowUi.diagnosticCards === 1 &&
          gatewayWorkflowUi.diagnosticMetrics === 6 &&
          udpGateway.ok;
        app.exit(smokePassed ? 0 : 1);
      } catch (error) {
        console.error(error);
        app.exit(1);
      }
    });
  }

  win.loadFile(path.join(__dirname, '..', 'index.html'));
  return win;
}

app.whenReady().then(async () => {
  if (isSmokeTest) {
    session.defaultSession.webRequest.onBeforeRequest(
      { urls: ['http://*/*', 'https://*/*'] },
      (_details, callback) => callback({ cancel: true })
    );
  }
  setupMqttIpc();
  historyStorage = setupHistoryStorageIpc({
    getWindow: () => mainWindow,
    userDataPath: app.getPath('userData')
  });
  configureSerialPermissions();
  udpGatewayServer = startIntegratedUdpGateway({
    rootDir: path.join(__dirname, '..'),
    port: isSmokeTest ? 0 : udpGatewayPort,
    udpPort: isSmokeTest ? 0 : undefined,
    configPath: isSmokeTest
      ? path.join(app.getPath('temp'), 'mems-cms-gateway-smoke.json')
      : (app.isPackaged ? path.join(app.getPath('userData'), 'multi_udp_gateway.json') : undefined)
  });
  if (isSmokeTest && !udpGatewayServer.address()) {
    await new Promise((resolve, reject) => {
      udpGatewayServer.once('listening', resolve);
      udpGatewayServer.once('error', reject);
    });
  }
  udpGatewayPort = udpGatewayServer.address()?.port || udpGatewayPort;
  Menu.setApplicationMenu(null);
  mainWindow = createWindow();
  updateManager = createUpdateManager({
    app,
    appIconPath,
    getMainWindow: () => mainWindow,
    disabled: isSmokeTest
  });
  updateManager.setup();
  updateManager.checkQuietly();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
      updateManager?.checkQuietly();
    }
  });
});

app.on('window-all-closed', () => {
  if (udpGatewayServer) udpGatewayServer.close();
  mqttSessions.forEach((_session, sessionId) => closeMqttSession(sessionId));
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', (event) => {
  if (historyShutdownComplete) return;
  event.preventDefault();
  if (historyShutdownStarted) return;
  historyShutdownStarted = true;
  Promise.resolve(historyStorage?.shutdown())
    .catch((error) => {
      console.warn('[history-storage] shutdown failed:', error?.message || error);
    })
    .finally(() => {
      historyShutdownComplete = true;
      app.quit();
    });
});
