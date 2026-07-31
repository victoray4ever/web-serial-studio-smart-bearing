/** Simplified workflow for multi-device UDP framing, parser binding and diagnostics. */
import { eventBus } from '../core/EventBus.js';
import { appState } from '../core/AppState.js';
import {
  analyzeGatewayParserProject,
  boundGatewaySource,
  buildGatewayCombinedProject
} from './gateway/GatewayProjectBinding.js';

export class GatewayConfigDialog {
  constructor(modalRoot, projectModel = null, { onApply } = {}) {
    this._root = modalRoot;
    this._projectModel = projectModel;
    this._onApply = onApply;
    this._el = null;
    this._config = null;
    this._lastStatus = null;
    this._activeTab = 'devices';
    this._deviceKeys = [];
    this._bindings = new Map();
    this._openDashboardAfterSave = false;
    eventBus.on('ui:openGatewayConfig', () => this.open());
    eventBus.on('gateway:status', (message) => this._handleGatewayMessage(message));
  }

  _text(zh, en) {
    return appState.locale === 'zh-CN' ? zh : en;
  }

  _escape(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  _newDeviceKey() {
    return `device-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  open() {
    if (this._el) this.close();
    this._activeTab = 'devices';
    this._deviceKeys = [];
    this._bindings.clear();
    this._el = document.createElement('div');
    this._el.className = 'modal-overlay animate-fadeIn';
    this._el.innerHTML = `
      <div class="modal gateway-config-modal">
        <div class="modal-header">
          <div class="modal-title">${this._text('UDP 多设备接入', 'UDP Multi-device Setup')}</div>
          <button class="btn btn-icon" id="gateway-config-close" aria-label="${this._text('关闭', 'Close')}">X</button>
        </div>
        <div class="gateway-config-tabs">
          <button class="gateway-config-tab active" data-gateway-tab="devices">${this._text('设备与仪表盘', 'Devices & Dashboard')}</button>
          <button class="gateway-config-tab" data-gateway-tab="diagnostics">${this._text('诊断', 'Diagnostics')}</button>
        </div>
        <div class="modal-body" id="gateway-config-body">
          <div class="gateway-config-loading">${this._text('正在读取网关配置...', 'Loading gateway configuration...')}</div>
        </div>
        <div class="modal-footer gateway-config-footer">
          <button class="btn" id="gateway-config-cancel">${this._text('取消', 'Cancel')}</button>
          <button class="btn" id="gateway-config-save" disabled>${this._text('保存', 'Save')}</button>
          <button class="btn btn-primary" id="gateway-config-dashboard" disabled>${this._text('保存并打开联合仪表盘', 'Save & Open Dashboard')}</button>
        </div>
      </div>`;
    this._root.appendChild(this._el);
    this._el.addEventListener('click', (event) => {
      if (event.target === this._el) this.close();
    });
    this._el.querySelector('#gateway-config-close')?.addEventListener('click', () => this.close());
    this._el.querySelector('#gateway-config-cancel')?.addEventListener('click', () => this.close());
    this._el.querySelector('#gateway-config-save')?.addEventListener('click', () => this._save(false));
    this._el.querySelector('#gateway-config-dashboard')?.addEventListener('click', () => this._save(true));
    this._el.querySelectorAll('[data-gateway-tab]').forEach((button) => {
      button.addEventListener('click', () => this._setTab(button.dataset.gatewayTab));
    });
    eventBus.emit('gateway:command', { type: 'gateway.config.request' });
  }

  _setTab(tab) {
    this._activeTab = tab === 'diagnostics' ? 'diagnostics' : 'devices';
    this._el?.querySelectorAll('[data-gateway-tab]').forEach((button) => {
      button.classList.toggle('active', button.dataset.gatewayTab === this._activeTab);
    });
    this._renderCurrent();
    if (this._activeTab === 'diagnostics') {
      eventBus.emit('gateway:command', { type: 'gateway.status.request' });
    }
  }

  _handleGatewayMessage(message) {
    if (!message) return;
    if (message.type === 'gateway.config' || message.type === 'gateway.config.saved') {
      const firstLoad = !this._config;
      this._config = message.config || {};
      if (firstLoad) this._initializeDevices();
      if (this._el) this._renderCurrent(message.restartRequired === true);
      if (message.type === 'gateway.config.saved') {
        eventBus.emit('toast', {
          type: 'success',
          message: this._text('设备配置和联合仪表盘已更新。', 'Device configuration and combined dashboard updated.')
        });
        if (this._openDashboardAfterSave) {
          this.close();
          eventBus.emit('ui:switchWorkspace', 'dashboard');
        }
      }
      return;
    }

    if (['gateway.status', 'gateway.hello', 'gateway.error', 'gateway.disconnected'].includes(message.type)) {
      this._lastStatus = message;
      if (this._el && this._activeTab === 'diagnostics') this._renderDiagnostics();
    }
  }

  _initializeDevices() {
    const devices = Array.isArray(this._config?.routing?.devices) ? this._config.routing.devices : [];
    this._deviceKeys = devices.map(() => this._newDeviceKey());
    devices.forEach((device, index) => {
      const analysis = boundGatewaySource(appState.project, device.sourceId);
      if (analysis) {
        this._bindings.set(this._deviceKeys[index], {
          analysis,
          selectedKeys: analysis.datasets.map((dataset) => dataset.key)
        });
      }
    });
  }

  _renderCurrent(restartRequired = false) {
    if (!this._el || !this._config) return;
    if (this._activeTab === 'diagnostics') this._renderDiagnostics();
    else this._renderDevices(restartRequired);
    const canSave = this._activeTab === 'devices';
    const save = this._el.querySelector('#gateway-config-save');
    const dashboard = this._el.querySelector('#gateway-config-dashboard');
    if (save) save.disabled = !canSave;
    if (dashboard) dashboard.disabled = !canSave;
  }

  _renderDevices(restartRequired = false) {
    const cfg = this._config || {};
    const udp = cfg.udp || {};
    const ws = cfg.websocket || {};
    const routing = cfg.routing || {};
    const status = cfg.status || {};
    const devices = Array.isArray(routing.devices) ? routing.devices : [];
    while (this._deviceKeys.length < devices.length) this._deviceKeys.push(this._newDeviceKey());
    const body = this._el.querySelector('#gateway-config-body');
    body.innerHTML = `
      ${restartRequired ? `<div class="gateway-config-alert">${this._text('监听端口已变化，重启软件后生效。', 'The listen endpoint changed and will apply after restart.')}</div>` : ''}
      <section class="gateway-primary-settings">
        ${this._field('gateway-udp-port', this._text('UDP 监听端口', 'UDP Listen Port'), udp.port || 4000, 'number', '1', '65535')}
        <div class="gateway-config-hint">${this._text('所有设备向该端口发送 UDP 数据；每台设备使用自己的帧结构和解析文件。', 'All devices send UDP data to this port. Each device uses its own frame and parser.')}</div>
      </section>

      <div class="gateway-device-config-list" id="gateway-device-config-list">
        ${devices.map((device, index) => this._deviceConfigRow(device, index)).join('')}
      </div>
      <button class="btn gateway-add-device" id="gateway-add-device" type="button">+ ${this._text('添加设备', 'Add Device')}</button>

      <details class="gateway-global-advanced">
        <summary>${this._text('高级设置', 'Advanced Settings')}</summary>
        <div class="editor-form-grid gateway-config-grid">
          ${this._field('gateway-udp-host', this._text('UDP 监听地址', 'UDP Listen Host'), udp.host || '0.0.0.0')}
          ${this._field('gateway-ws-host', this._text('WebSocket 地址', 'WebSocket Host'), ws.host || '127.0.0.1')}
          ${this._field('gateway-ws-port', this._text('WebSocket 端口', 'WebSocket Port'), ws.port || 8765, 'number', '1', '65535')}
          <label class="form-row">
            <span class="form-label">${this._text('未知设备', 'Unknown Devices')}</span>
            <select class="form-select" id="gateway-unknown-policy">
              <option value="ip" ${routing.unknownDevices !== 'drop' ? 'selected' : ''}>${this._text('按 IP 自动接入', 'Auto-register by IP')}</option>
              <option value="drop" ${routing.unknownDevices === 'drop' ? 'selected' : ''}>${this._text('忽略', 'Ignore')}</option>
            </select>
          </label>
          ${this._field('gateway-status-interval', this._text('诊断刷新间隔 ms', 'Diagnostic Interval (ms)'), status.intervalMs || 1000, 'number', '200')}
          ${this._field('gateway-offline-timeout', this._text('离线判定时间 ms', 'Offline Timeout (ms)'), status.offlineAfterMs || 5000, 'number', '1000')}
        </div>
      </details>`;

    body.querySelector('#gateway-add-device')?.addEventListener('click', () => this._addDevice());
    body.querySelectorAll('.gateway-device-config-row').forEach((row) => this._bindDeviceRow(row));
  }

  _deviceConfigRow(device = {}, index = 0) {
    const key = this._deviceKeys[index] || this._newDeviceKey();
    this._deviceKeys[index] = key;
    const globalFrame = this._config?.aggregation?.frame || {};
    const frame = device.frame || {};
    const sequence = device.sequence || {};
    const binding = this._bindings.get(key);
    return `<article class="gateway-device-config-row" data-device-index="${index}" data-device-key="${this._escape(key)}" data-original-source-id="${this._escape(device.sourceId || '')}">
      <div class="gateway-device-card-header">
        <strong>${this._escape(device.title || device.sourceId || this._text(`设备 ${index + 1}`, `Device ${index + 1}`))}</strong>
        <button class="btn btn-icon gateway-remove-device" type="button" data-remove-device title="${this._text('删除设备', 'Remove device')}">X</button>
      </div>
      <div class="gateway-device-config-fields compact">
        ${this._deviceField('ip', this._text('设备 IP', 'Device IP'), device.ip || '', '192.168.1.251')}
        ${this._deviceField('sourceId', 'sourceId', device.sourceId || '', 'node-01')}
        ${this._deviceField('title', this._text('显示名称', 'Display Name'), device.title || '', this._text('轴承 01', 'Bearing 01'))}
      </div>

      <div class="gateway-device-stage-title"><span>1</span>${this._text('独立分帧', 'Per-device Framing')}</div>
      <div class="gateway-device-frame-fields essential">
        ${this._deviceFrameField('startDelimiter', this._text('帧头', 'Start Delimiter'), frame.startDelimiter ?? globalFrame.startDelimiter ?? '5A A5', '5A A5')}
        ${this._deviceFrameField('endDelimiter', this._text('帧尾', 'End Delimiter'), frame.endDelimiter ?? globalFrame.endDelimiter ?? 'DD EE', 'DD EE')}
        ${this._deviceFrameField('frameLength', this._text('完整帧字节数', 'Frame Length'), frame.frameLength ?? globalFrame.frameLength ?? 0, '1468', 'number')}
      </div>

      <div class="gateway-device-stage-title"><span>2</span>${this._text('解析文件与仪表盘数据', 'Parser & Dashboard Data')}</div>
      <div class="gateway-parser-binding">
        <label class="btn gateway-parser-file-button">
          ${binding ? this._text('更换解析 JSON', 'Replace Parser JSON') : this._text('导入解析 JSON', 'Import Parser JSON')}
          <input type="file" accept=".json,application/json" data-parser-file hidden>
        </label>
        <div class="gateway-parser-content" data-parser-content>
          ${this._renderParserContent(binding)}
        </div>
      </div>

      <details class="gateway-device-advanced">
        <summary>${this._text('分帧诊断高级项', 'Advanced Framing Diagnostics')}</summary>
        <div class="gateway-device-frame-fields advanced">
          ${this._deviceFrameField('timeoutMs', this._text('残帧超时 ms', 'Incomplete Timeout (ms)'), frame.timeoutMs ?? globalFrame.timeoutMs ?? 2000, '2000', 'number')}
          ${this._deviceFrameField('maxBufferBytes', this._text('最大缓存 byte', 'Max Buffer (bytes)'), frame.maxBufferBytes ?? globalFrame.maxBufferBytes ?? 65536, '65536', 'number')}
          <label class="form-row gateway-sequence-toggle">
            <span class="form-label">${this._text('设备序号诊断', 'Device Sequence')}</span>
            <input type="checkbox" data-device-sequence-enabled ${sequence.enabled ? 'checked' : ''}>
          </label>
          ${this._deviceSequenceField('offset', this._text('序号偏移', 'Sequence Offset'), sequence.offset ?? 0, '0')}
          ${this._deviceSequenceField('size', this._text('序号字节数', 'Sequence Bytes'), sequence.size ?? 4, '4')}
          <label class="form-row">
            <span class="form-label">${this._text('序号字节序', 'Sequence Byte Order')}</span>
            <select class="form-select" data-device-sequence-order>
              <option value="little" ${sequence.byteOrder !== 'big' ? 'selected' : ''}>Little Endian</option>
              <option value="big" ${sequence.byteOrder === 'big' ? 'selected' : ''}>Big Endian</option>
            </select>
          </label>
        </div>
      </details>
    </article>`;
  }

  _renderParserContent(binding) {
    if (!binding?.analysis) {
      return `<span class="gateway-parser-empty">${this._text('尚未绑定解析文件', 'No parser bound')}</span>`;
    }
    const selected = new Set(binding.selectedKeys || binding.analysis.datasets.map((dataset) => dataset.key));
    return `
      <div class="gateway-parser-summary">
        <strong>${this._escape(binding.analysis.fileName || this._text('已绑定解析器', 'Parser bound'))}</strong>
        <span>${binding.analysis.datasets.length} ${this._text('个数据集', 'datasets')}</span>
      </div>
      <div class="gateway-dataset-picker">
        ${binding.analysis.datasets.map((dataset) => `
          <label>
            <input type="checkbox" data-dataset-key="${this._escape(dataset.key)}" ${selected.has(dataset.key) ? 'checked' : ''}>
            <span>${this._escape(dataset.title)}${dataset.units ? ` (${this._escape(dataset.units)})` : ''}</span>
          </label>`).join('')}
      </div>`;
  }

  _bindDeviceRow(row) {
    const key = row.dataset.deviceKey;
    row.querySelector('[data-remove-device]')?.addEventListener('click', () => {
      this._bindings.delete(key);
      const index = Number(row.dataset.deviceIndex);
      this._deviceKeys.splice(index, 1);
      row.remove();
      this._renumberDeviceRows();
    });
    row.querySelector('[data-parser-file]')?.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const project = JSON.parse(await file.text());
        const analysis = analyzeGatewayParserProject(project, file.name);
        const binding = {
          analysis,
          selectedKeys: analysis.datasets.map((dataset) => dataset.key)
        };
        this._bindings.set(key, binding);
        const content = row.querySelector('[data-parser-content]');
        if (content) content.innerHTML = this._renderParserContent(binding);
        eventBus.emit('toast', {
          type: 'success',
          message: this._text(`已读取 ${analysis.datasets.length} 个数据集`, `Loaded ${analysis.datasets.length} datasets`)
        });
      } catch (error) {
        eventBus.emit('toast', {
          type: 'error',
          message: `${this._text('解析文件导入失败', 'Parser import failed')}: ${error.message || error}`
        });
      }
    });
  }

  _addDevice() {
    const list = this._el?.querySelector('#gateway-device-config-list');
    if (!list) return;
    const index = list.querySelectorAll('.gateway-device-config-row').length;
    this._deviceKeys.push(this._newDeviceKey());
    const wrapper = document.createElement('div');
    wrapper.innerHTML = this._deviceConfigRow({}, index);
    const row = wrapper.firstElementChild;
    list.appendChild(row);
    this._bindDeviceRow(row);
    row.querySelector('[data-device-field="ip"]')?.focus();
  }

  _renumberDeviceRows() {
    this._el?.querySelectorAll('.gateway-device-config-row').forEach((row, index) => {
      row.dataset.deviceIndex = String(index);
    });
  }

  _collectDevices(requireComplete = true) {
    const previousDevices = this._config?.routing?.devices || [];
    const devices = Array.from(this._el.querySelectorAll('.gateway-device-config-row')).map((row) => {
      const field = (name) => row.querySelector(`[data-device-field="${name}"]`)?.value?.trim() || '';
      const frameField = (name) => row.querySelector(`[data-device-frame-field="${name}"]`)?.value?.trim() || '';
      const sequenceField = (name) => row.querySelector(`[data-device-sequence-field="${name}"]`)?.value?.trim() || '';
      const previous = previousDevices.find((device) =>
        String(device.sourceId || '') === String(row.dataset.originalSourceId || '')
      ) || {};
      const key = row.dataset.deviceKey;
      const binding = this._bindings.get(key);
      const sourceId = field('sourceId');
      return {
        ...previous,
        ip: field('ip'),
        sourceId,
        title: field('title') || sourceId,
        frame: {
          startDelimiter: frameField('startDelimiter'),
          endDelimiter: frameField('endDelimiter'),
          frameLength: Math.max(0, Number(frameField('frameLength')) || 0),
          timeoutMs: Math.max(100, Number(frameField('timeoutMs')) || 2000),
          maxBufferBytes: Math.max(1024, Number(frameField('maxBufferBytes')) || 65536)
        },
        sequence: {
          enabled: !!row.querySelector('[data-device-sequence-enabled]')?.checked,
          offset: Math.max(0, Number(sequenceField('offset')) || 0),
          size: Math.max(1, Number(sequenceField('size')) || 4),
          byteOrder: row.querySelector('[data-device-sequence-order]')?.value || 'little'
        },
        ...(binding ? {
          parserId: `parser-${sourceId.replace(/[^A-Za-z0-9_-]+/g, '-') || 'source'}`,
          parserFileName: binding.analysis.fileName || ''
        } : {})
      };
    });
    if (requireComplete && devices.some((device) => !device.ip || !device.sourceId)) {
      throw new Error(this._text('每台设备都必须填写 IP 和 sourceId。', 'Every device requires an IP and sourceId.'));
    }
    if (requireComplete && new Set(devices.map((device) => device.sourceId)).size !== devices.length) {
      throw new Error(this._text('sourceId 不能重复。', 'sourceId values must be unique.'));
    }
    return devices;
  }

  _collectBindings() {
    return Array.from(this._el.querySelectorAll('.gateway-device-config-row')).flatMap((row) => {
      const binding = this._bindings.get(row.dataset.deviceKey);
      if (!binding) return [];
      const sourceId = row.querySelector('[data-device-field="sourceId"]')?.value?.trim() || '';
      const selectedKeys = Array.from(row.querySelectorAll('[data-dataset-key]:checked')).map((node) => node.dataset.datasetKey);
      return [{ sourceId, analysis: binding.analysis, selectedKeys }];
    });
  }

  _renderDiagnostics() {
    const body = this._el?.querySelector('#gateway-config-body');
    if (!body) return;
    const status = this._lastStatus;
    if (!status || status.type === 'gateway.disconnected') {
      body.innerHTML = `
        <div class="gateway-diagnostics-empty">
          <strong>${this._text('网关未连接', 'Gateway Disconnected')}</strong>
          <span>${this._text('连接 UDP 网关后显示设备诊断。', 'Connect the UDP gateway to view device diagnostics.')}</span>
        </div>`;
      return;
    }
    if (status.type === 'gateway.error') {
      body.innerHTML = `<div class="gateway-config-alert error">${this._escape(status.message || '')}</div>`;
      return;
    }
    if (status.type === 'gateway.hello') {
      body.innerHTML = `<div class="gateway-diagnostics-empty"><strong>${this._text('网关已连接', 'Gateway Connected')}</strong><span>${this._text('正在等待设备数据...', 'Waiting for device data...')}</span></div>`;
      return;
    }

    const devices = Array.isArray(status.devices) ? status.devices : [];
    body.innerHTML = `
      <div class="gateway-diagnostic-header">
        <div>
          <strong>${this._escape(status.gateway || this._text('UDP 网关', 'UDP Gateway'))}</strong>
          <span>${status.onlineDevices || 0}/${status.knownDevices || devices.length} ${this._text('台在线', 'online')}</span>
        </div>
        <button class="btn" id="gateway-diagnostics-refresh">${this._text('刷新', 'Refresh')}</button>
      </div>
      <div class="gateway-diagnostic-summary">
        ${this._diagnosticMetric(this._text('完整帧', 'Frames'), status.frames)}
        ${this._diagnosticMetric(this._text('接收字节', 'Bytes'), this._formatBytes(status.bytes))}
        ${this._diagnosticMetric(this._text('残帧', 'Incomplete'), status.incompleteFrames)}
        ${this._diagnosticMetric(this._text('丢序', 'Lost'), status.lost)}
        ${this._diagnosticMetric(this._text('乱序', 'Out of Order'), status.outOfOrder)}
        ${this._diagnosticMetric(this._text('丢弃', 'Dropped'), status.dropped)}
      </div>
      <div class="gateway-diagnostic-devices">
        ${devices.length ? devices.map((device) => this._diagnosticDevice(device)).join('') : `
          <div class="gateway-diagnostics-empty">${this._text('等待 UDP 设备数据...', 'Waiting for UDP device data...')}</div>`}
      </div>`;
    body.querySelector('#gateway-diagnostics-refresh')?.addEventListener('click', () => {
      eventBus.emit('gateway:command', { type: 'gateway.status.request' });
    });
  }

  _diagnosticMetric(label, value) {
    return `<div><strong>${this._escape(value ?? 0)}</strong><span>${label}</span></div>`;
  }

  _diagnosticDevice(device) {
    const configured = (this._config?.routing?.devices || []).find((item) => String(item.sourceId) === String(device.sourceId)) || {};
    const frame = configured.frame || this._config?.aggregation?.frame || {};
    return `<article class="gateway-diagnostic-device ${device.online ? 'online' : 'offline'}">
      <div class="gateway-diagnostic-device-title">
        <span class="gateway-health-dot ${device.online ? 'online' : ''}"></span>
        <strong>${this._escape(device.title || device.sourceId)}</strong>
        <span>${device.online ? this._text('在线', 'Online') : this._text('离线', 'Offline')}</span>
      </div>
      <div class="gateway-diagnostic-device-meta">${this._escape(device.sourceId)} · ${this._escape(device.ip || '')}:${Number(device.port) || 0}</div>
      <div class="gateway-diagnostic-device-grid">
        ${this._diagnosticMetric(this._text('完整帧', 'Frames'), device.frames)}
        ${this._diagnosticMetric(this._text('当前缓存', 'Buffer'), `${Number(device.bufferedBytes) || 0} B`)}
        ${this._diagnosticMetric(this._text('残帧', 'Incomplete'), device.incompleteFrames)}
        ${this._diagnosticMetric(this._text('无效帧', 'Invalid'), device.invalidFrames)}
        ${this._diagnosticMetric(this._text('丢序', 'Lost'), device.lost)}
        ${this._diagnosticMetric(this._text('帧长度', 'Frame Length'), frame.frameLength || 0)}
      </div>
      <div class="gateway-diagnostic-binding">${this._text('解析文件', 'Parser')}: ${this._escape(configured.parserFileName || this._text('未绑定', 'Not bound'))}</div>
    </article>`;
  }

  _formatBytes(value) {
    const bytes = Number(value) || 0;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  _field(id, label, value, type = 'text', min = '', max = '') {
    return `<label class="form-row"><span class="form-label">${label}</span>
      <input class="form-input" id="${id}" type="${type}" value="${this._escape(value)}" ${min !== '' ? `min="${min}"` : ''} ${max !== '' ? `max="${max}"` : ''}></label>`;
  }

  _deviceField(name, label, value, placeholder) {
    return `<label class="form-row"><span class="form-label">${label}</span><input class="form-input" data-device-field="${name}" value="${this._escape(value)}" placeholder="${this._escape(placeholder)}"></label>`;
  }

  _deviceFrameField(name, label, value, placeholder, type = 'text') {
    return `<label class="form-row"><span class="form-label">${label}</span><input class="form-input" type="${type}" data-device-frame-field="${name}" value="${this._escape(value)}" placeholder="${this._escape(placeholder)}" ${type === 'number' ? 'min="0"' : ''}></label>`;
  }

  _deviceSequenceField(name, label, value, placeholder) {
    return `<label class="form-row"><span class="form-label">${label}</span><input class="form-input" type="number" min="0" data-device-sequence-field="${name}" value="${this._escape(value)}" placeholder="${this._escape(placeholder)}"></label>`;
  }

  _number(id, fallback) {
    const value = Number(this._el.querySelector(`#${id}`)?.value);
    return Number.isFinite(value) ? value : fallback;
  }

  _save(openDashboard) {
    try {
      const devices = this._collectDevices();
      const bindings = this._collectBindings();
      const previous = this._config || {};
      const config = {
        ...previous,
        udp: {
          host: this._el.querySelector('#gateway-udp-host')?.value?.trim() || previous.udp?.host || '0.0.0.0',
          port: this._number('gateway-udp-port', 4000)
        },
        websocket: {
          host: this._el.querySelector('#gateway-ws-host')?.value?.trim() || previous.websocket?.host || '127.0.0.1',
          port: this._number('gateway-ws-port', previous.websocket?.port || 8765)
        },
        routing: {
          ...(previous.routing || {}),
          unknownDevices: this._el.querySelector('#gateway-unknown-policy')?.value || previous.routing?.unknownDevices || 'ip',
          frameNumbering: {
            ...(previous.routing?.frameNumbering || {}),
            enabled: true
          },
          devices
        },
        aggregation: {
          ...(previous.aggregation || {}),
          mode: 'frame'
        },
        status: {
          intervalMs: this._number('gateway-status-interval', previous.status?.intervalMs || 1000),
          offlineAfterMs: this._number('gateway-offline-timeout', previous.status?.offlineAfterMs || 5000)
        }
      };

      const currentProject = appState.project || this._projectModel?.project || null;
      if (bindings.length || currentProject) {
        const combined = buildGatewayCombinedProject(currentProject, devices, bindings);
        this._onApply?.(combined);
      }

      this._config = config;
      this._openDashboardAfterSave = !!openDashboard;
      this._el.querySelector('#gateway-config-save').disabled = true;
      this._el.querySelector('#gateway-config-dashboard').disabled = true;
      eventBus.emit('gateway:command', { type: 'gateway.config.update', config });
    } catch (error) {
      eventBus.emit('toast', { type: 'error', message: error.message || String(error) });
    }
  }

  close() {
    this._el?.remove();
    this._el = null;
    this._config = null;
    this._deviceKeys = [];
    this._bindings.clear();
    this._openDashboardAfterSave = false;
  }
}
