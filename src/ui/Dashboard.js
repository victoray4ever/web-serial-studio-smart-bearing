/**
 * Dashboard - Dashboard layout manager with free-form drag/resize
 */
import { eventBus } from '../core/EventBus.js';
import { appState } from '../core/AppState.js';
import { t } from '../core/i18n.js';
import { PlotWidget } from '../widgets/PlotWidget.js?v=widget-export-20260708-1';
import { GaugeWidget } from '../widgets/GaugeWidget.js?v=widget-export-20260708-1';
import { BarWidget } from '../widgets/BarWidget.js?v=multi-mqtt-20260618-1';
import { CompassWidget } from '../widgets/CompassWidget.js?v=multi-mqtt-20260618-1';
import { LedWidget } from '../widgets/LedWidget.js?v=multi-mqtt-20260618-1';
import { FftWidget } from '../widgets/FftWidget.js?v=widget-export-20260708-1';
import { DataGridWidget } from '../widgets/DataGridWidget.js?v=multi-mqtt-20260618-1';
import { AccelWidget } from '../widgets/AccelWidget.js?v=multi-mqtt-20260618-1';
import { sourceIdForDataset } from '../widgets/datasetSource.js';
import { rawFrameStore } from '../core/RawFrameStore.js';

function finiteValues(values) {
  return values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
}

function plotRangeForDatasets(datasets) {
  const mins = finiteValues(datasets.map((dataset) => dataset.min ?? dataset.plotMin));
  const maxs = finiteValues(datasets.map((dataset) => dataset.max ?? dataset.plotMax));
  return {
    yMin: mins.length ? Math.min(...mins) : undefined,
    yMax: maxs.length ? Math.max(...maxs) : undefined
  };
}

function datasetLabel(dataset) {
  return dataset.title + (dataset.units ? ` (${dataset.units})` : '');
}

function isEnabled(value) {
  return value !== false;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildDefaultLayout(width) {
  const col = Math.floor(width / 3);
  const col2 = col * 2;
  return [
    {
      type: 'MultiPlot',
      config: {
        title: 'Temperature & Humidity',
        icon: 'PLOT',
        datasetIndices: [0, 1],
        datasetLabels: ['Temperature (°C)', 'Humidity (%)'],
        datasetUnits: ['°C', '%'],
        colorOffset: 0,
        x: 0, y: 0, w: col2, h: 280
      }
    },
    {
      type: 'Accel',
      config: {
        title: 'Accelerometer',
        icon: 'ACC',
        axes: [
          { index: 3, label: 'X', color: '#3b82f6', min: -10, max: 10 },
          { index: 4, label: 'Y', color: '#10b981', min: -10, max: 10 },
          { index: 5, label: 'Z', color: '#f59e0b', min: 0, max: 20 }
        ],
        x: col2, y: 0, w: col, h: 280
      }
    },
    {
      type: 'Gauge',
      config: {
        title: 'Temperature',
        icon: 'TMP',
        datasetIndex: 0, min: -20, max: 80, units: '°C', colorIdx: 0,
        x: 0, y: 288, w: col, h: 260
      }
    },
    {
      type: 'Gauge',
      config: {
        title: 'Humidity',
        icon: 'HUM',
        datasetIndex: 1, min: 0, max: 100, units: '%', colorIdx: 1,
        x: col, y: 288, w: col, h: 260
      }
    },
    {
      type: 'Gauge',
      config: {
        title: 'Pressure',
        icon: 'PRS',
        datasetIndex: 2, min: 900, max: 1100, units: 'hPa', colorIdx: 2,
        x: col2, y: 288, w: col, h: 260
      }
    },
    {
      type: 'Compass',
      config: {
        title: 'Heading',
        icon: 'HDG',
        datasetIndex: 6,
        x: 0, y: 556, w: col, h: 280
      }
    },
    {
      type: 'Bar',
      config: {
        title: 'Voltage',
        icon: 'BAR',
        datasets: [{ index: 7, title: 'Battery', min: 0, max: 5, units: 'V' }],
        colorOffset: 7,
        x: col, y: 556, w: col, h: 280
      }
    },
    {
      type: 'Plot',
      config: {
        title: 'Pressure History',
        icon: 'PLOT',
        datasetIndices: [2],
        datasetLabels: ['Pressure (hPa)'],
        datasetUnits: ['hPa'],
        colorOffset: 2,
        x: col2, y: 556, w: col, h: 280
      }
    },
    {
      type: 'DataGrid',
      config: {
        title: t('dashboard.allData'),
        icon: 'GRID',
        datasets: [
          { index: 0, title: 'Temperature', units: '°C' },
          { index: 1, title: 'Humidity', units: '%' },
          { index: 2, title: 'Pressure', units: 'hPa' },
          { index: 3, title: 'Accel X', units: 'm/s2' },
          { index: 4, title: 'Accel Y', units: 'm/s2' },
          { index: 5, title: 'Accel Z', units: 'm/s2' },
          { index: 6, title: 'Heading', units: 'deg' },
          { index: 7, title: 'Voltage', units: 'V' }
        ],
        x: 0, y: 844, w: width - 4, h: 260
      }
    }
  ];
}

export class Dashboard {
  constructor(container) {
    this._container = container;
    this._grid = null;
    this._canvas = null;
    this._widgets = [];
    this._hasData = false;
    this._emptyEl = null;
    this._interlockEl = null;
    this._plcStatusEl = null;
    this._interlockLogEl = null;
    this._interlockRecords = [];
    this._wheelHandler = (e) => this._handleWheelScroll(e);

    this._frameHandler = () => {
      if (!this._hasData) {
        this._hasData = true;
        this._showGrid();
      }
    };

    this._render();
    eventBus.on('frame:received', this._frameHandler);
    eventBus.on('interlock:status', (status) => this._updateInterlockStatus(status));
    eventBus.on('interlock:alarm-record', (record) => this._appendInterlockRecord(record));
    eventBus.on('plc:status', (status) => this._updatePlcStatus(status));
    eventBus.on('state:connectionStateChanged', (state) => {
      if (state === 'Disconnected') {
        this._hasData = false;
        this._showEmpty();
        this._widgets.forEach((w) => w.reset?.());
        rawFrameStore.clear();
      }
    });
  }

  _render() {
    this._container.innerHTML = `
      <div class="dashboard-header">
        <div class="dashboard-header-title">
          <span class="dashboard-header-badge" aria-hidden="true"></span>
          <span id="dashboard-title">${t('dashboard.title')}</span>
        </div>
        <div class="dashboard-header-actions">
          <button class="btn btn-icon dashboard-header-btn" id="btn-auto-layout" title="${t('dashboard.autoLayout')}">${t('dashboard.autoLayout')}</button>
          <button class="btn btn-icon dashboard-header-btn" id="btn-reset-data" title="${t('dashboard.reset')}">${t('dashboard.reset')}</button>
          <button class="btn btn-icon dashboard-header-btn" id="btn-fullscreen" title="${t('dashboard.fullscreen')}">${t('dashboard.fullscreen')}</button>
        </div>
      </div>
      <div class="plc-connection-status is-disabled" id="plc-connection-status">
        <div class="plc-connection-main">
          <span class="plc-connection-dot" aria-hidden="true"></span>
          <strong class="plc-connection-title">PLC 未检测</strong>
          <span class="plc-connection-detail">尚未进行 Modbus TCP 通信</span>
        </div>
        <time class="plc-connection-time">--</time>
      </div>
      <div class="interlock-status is-disabled" id="interlock-status">
        <div class="interlock-status-main">
          <span class="interlock-status-dot" aria-hidden="true"></span>
          <span class="interlock-status-title">联锁未启用</span>
          <span class="interlock-status-detail">可在项目编辑器中配置 RMS 阈值与 PLC 输出。</span>
        </div>
        <button class="btn interlock-reset-btn" id="interlock-reset" type="button">复位</button>
      </div>
      <div class="interlock-alarm-log is-disabled" id="interlock-alarm-log">
        <div class="interlock-alarm-log-head">
          <strong>报警记录</strong>
          <button class="btn interlock-log-clear" id="interlock-log-clear" type="button">清空记录</button>
        </div>
        <div class="interlock-alarm-log-list" id="interlock-alarm-log-list">
          <div class="interlock-alarm-log-empty">暂无报警记录</div>
        </div>
      </div>
      <div class="dashboard-empty" id="dashboard-empty">
        <div class="dashboard-empty-title">${t('dashboard.realTimeTitle')}</div>
        <div class="dashboard-empty-desc">${t('dashboard.realTimeDesc')}</div>
        <div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin-top:16px;max-width:680px">
          ${[
            [t('dashboard.featureQuickPlot'), t('dashboard.featureQuickPlotDesc')],
            [t('dashboard.featureProjectFile'), t('dashboard.featureProjectFileDesc')],
            [t('dashboard.featureJson'), t('dashboard.featureJsonDesc')],
            [t('dashboard.featureProtocols'), t('dashboard.featureProtocolsDesc')],
            [t('dashboard.featureExport'), t('dashboard.featureExportDesc')],
            [t('dashboard.featureActions'), t('dashboard.featureActionsDesc')]
          ].map(([title, desc]) => `
            <div style="background:var(--dashboard-empty-card-bg);border:1px solid var(--dashboard-empty-card-border);border-radius:12px;padding:14px 16px;max-width:220px;text-align:left;box-shadow:var(--shadow-sm)">
              <div style="font-size:var(--font-size-sm);font-weight:600;color:var(--text-secondary);margin-bottom:4px">${title}</div>
              <div style="font-size:var(--font-size-xs);color:var(--text-muted);line-height:1.4">${desc}</div>
            </div>`).join('')}
        </div>
        <div style="margin-top:20px;display:flex;gap:8px">
          <button class="btn btn-primary" id="btn-start-sim-empty" style="font-size:13px;padding:8px 20px">${t('dashboard.startDemo')}</button>
          <button class="btn" id="btn-open-project-empty" style="font-size:13px;padding:8px 20px">${t('dashboard.openProject')}</button>
        </div>
      </div>
      <div class="dashboard-grid hidden" id="dashboard-grid">
        <div class="dashboard-grid-canvas" id="dashboard-grid-canvas"></div>
      </div>`;

    this._emptyEl = this._container.querySelector('#dashboard-empty');
    this._interlockEl = this._container.querySelector('#interlock-status');
    this._plcStatusEl = this._container.querySelector('#plc-connection-status');
    this._interlockLogEl = this._container.querySelector('#interlock-alarm-log');
    this._grid = this._container.querySelector('#dashboard-grid');
    this._canvas = this._container.querySelector('#dashboard-grid-canvas');
    this._container?.addEventListener('wheel', this._wheelHandler, { passive: false });

    this._container.querySelector('#btn-reset-data').addEventListener('click', () => this._resetAll());
    this._container.querySelector('#btn-auto-layout').addEventListener('click', () => this._autoLayout());
    this._container.querySelector('#btn-fullscreen').addEventListener('click', () => {
      if (!document.fullscreenElement) this._container.requestFullscreen?.();
      else document.exitFullscreen?.();
    });
    this._container.querySelector('#interlock-reset')?.addEventListener('click', () => eventBus.emit('interlock:reset'));
    this._container.querySelector('#interlock-log-clear')?.addEventListener('click', () => {
      this._interlockRecords = [];
      this._renderInterlockRecords();
    });
    this._container.querySelector('#btn-start-sim-empty')?.addEventListener('click', () => eventBus.emit('ui:startSimulator'));
    this._container.querySelector('#btn-open-project-empty')?.addEventListener('click', () => eventBus.emit('project:openFile'));

    this._buildDefaultWidgets();
  }

  _buildDefaultWidgets() {
    this._widgets.forEach((w) => w.destroy?.());
    this._widgets = [];
    requestAnimationFrame(() => {
      const width = (this._grid.clientWidth || 1100) - 8;
      const layout = buildDefaultLayout(width);
      layout.forEach((def) => {
        const widget = this._createWidget(def.type, def.config);
        if (widget) {
          widget.mount(this._canvas);
          this._widgets.push(widget);
        }
      });
      this._updateCanvasHeight();
    });
  }

  _updateCanvasHeight() {
    let maxBottom = 600;
    this._widgets.forEach((w) => {
      if (!w._el) return;
      const bottom = (parseInt(w._el.style.top, 10) || 0) + (parseInt(w._el.style.height, 10) || 260);
      if (bottom > maxBottom) maxBottom = bottom;
    });
    if (this._canvas) {
      const nextHeight = `${maxBottom + 40}px`;
      this._canvas.style.height = nextHeight;
      this._canvas.style.minHeight = nextHeight;
    }
  }

  _autoLayout() {
    const width = (this._grid.clientWidth || 1100) - 8;
    let x = 0;
    let y = 0;
    let rowH = 0;
    const gap = 8;
    this._widgets.forEach((w) => {
      if (!w._el) return;
      const widgetW = Math.min(width, parseInt(w._el.style.width, 10) || w.config.w || 360);
      const widgetH = parseInt(w._el.style.height, 10) || w.config.h || 260;
      if (x > 0 && x + widgetW > width) {
        x = 0;
        y += rowH + gap;
        rowH = 0;
      }
      w._el.style.left = `${x}px`;
      w._el.style.top = `${y}px`;
      w._el.style.width = `${widgetW}px`;
      w._el.style.height = `${widgetH}px`;
      w.config.x = x;
      w.config.y = y;
      w.config.w = widgetW;
      w.config.h = widgetH;
      w._onResize?.();
      x += widgetW + gap;
      rowH = Math.max(rowH, widgetH);
    });
    this._updateCanvasHeight();
  }

  buildFromProject(project) {
    this._widgets.forEach((w) => w.destroy?.());
    this._widgets = [];
    rawFrameStore.clear();
    const modbusOutput = (project.outputs || []).find((output) => output.type === 'modbusTcp');
    if (this._plcStatusEl) {
      this._plcStatusEl.classList.toggle('is-disabled', !modbusOutput);
      if (modbusOutput) {
        this._updatePlcStatus({
          status: 'idle', name: modbusOutput.name || modbusOutput.id,
          host: modbusOutput.host, port: Number(modbusOutput.port) || 502,
          unitId: Number(modbusOutput.unitId) || 1
        });
      }
    }

    const groups = project.groups || [];
    const datasets = [];
    groups.forEach((g) => g.datasets.forEach((d) => datasets.push(d)));
    const isTemperatureDataset = (d) => {
      const title = String(d.title || '').toLowerCase();
      const units = String(d.units || '').toLowerCase();
      return title.includes('temp') || units.includes('°c') || units === 'c';
    };
    const wantsPlot = (d) => isEnabled(d.plot);
    const isMainPlotDataset = (d) => {
      const widget = String(d.widget || '').toLowerCase();
      const isGaugeLike = widget === 'gauge' || widget === 'gauges';
      const isTemperature = isTemperatureDataset(d);
      return wantsPlot(d) && !isGaugeLike && !isTemperature;
    };
    const plotGroups = groups
      .map((group) => ({
        title: group.title || project.title,
        datasets: (group.datasets || []).filter(isMainPlotDataset)
      }))
      .filter((group) => group.datasets.length > 0);
    const temperatureDatasets = datasets.filter((d) => wantsPlot(d) && isTemperatureDataset(d));
    const gaugeDatasets = datasets.filter((d) => d.gauge);
    const barDatasets = datasets.filter((d) => d.bar);
    const compassDatasets = datasets.filter((d) => d.compass);
    const ledDatasets = datasets.filter((d) => d.led);
    const fftDatasets = datasets.filter((d) => d.fft);
    const sourceTitleById = new Map(
      (project.sources || []).map((source) => [String(source.sourceId ?? ''), source.title || String(source.sourceId ?? '')])
    );
    const groupDatasetsBySource = (items) => {
      const grouped = new Map();
      items.forEach((dataset) => {
        const sourceId = String(sourceIdForDataset(dataset) ?? '');
        if (!grouped.has(sourceId)) grouped.set(sourceId, []);
        grouped.get(sourceId).push(dataset);
      });
      return Array.from(grouped, ([sourceId, sourceDatasets]) => ({
        sourceId,
        title: sourceTitleById.get(sourceId) || sourceId || project.title,
        datasets: sourceDatasets
      }));
    };

    const width = (this._grid?.clientWidth || 1100) - 8;
    let y = 0;
    const gap = 8;

    const mountWidget = (widget) => {
      widget.mount(this._canvas);
      this._widgets.push(widget);
      return widget;
    };

    if (plotGroups.length > 0 || temperatureDatasets.length > 0) {
      const hasMainPlot = plotGroups.length > 0;
      const hasTempPlot = temperatureDatasets.length > 0;
      const plotHeight = 280;
      const chartDefs = plotGroups.map((plotGroup) => ({
        title: plotGroups.length === 1 ? `${project.title} - ${t('dashboard.overview')}` : plotGroup.title,
        datasets: plotGroup.datasets
      }));
      if (hasTempPlot) {
        chartDefs.push({ title: 'Temperature Trend', datasets: temperatureDatasets, colorOffset: 3 });
      }

      if (plotGroups.length <= 1 && chartDefs.length <= 2) {
        const mainWidth = hasMainPlot && hasTempPlot ? Math.floor(width * 0.66) : width;
        const tempX = hasMainPlot ? mainWidth + gap : 0;
        chartDefs.forEach((chart, index) => {
          const isTempChart = hasTempPlot && index === chartDefs.length - 1 && chart.title === 'Temperature Trend';
          const range = plotRangeForDatasets(chart.datasets);
          mountWidget(new PlotWidget({
            title: chart.title,
            icon: 'PLOT',
            datasetIndices: chart.datasets.map((d) => d.index),
            datasetSourceIds: chart.datasets.map(sourceIdForDataset),
            datasetRefs: chart.datasets.map((d) => ({ index: d.index, sourceId: sourceIdForDataset(d) })),
            datasetLabels: chart.datasets.map(datasetLabel),
            datasetUnits: chart.datasets.map((d) => d.units || ''),
            datasetDecimals: chart.datasets.map((d) => Number.isInteger(d.decimals) ? d.decimals : d.precision),
            colorOffset: chart.colorOffset,
            yMin: range.yMin,
            yMax: range.yMax,
            x: isTempChart ? tempX : 0,
            y,
            w: isTempChart ? Math.max(280, width - tempX) : mainWidth,
            h: plotHeight
          }));
        });
        y += plotHeight + gap;
      } else {
        const chartWidth = Math.floor((width - gap) / 2);
        chartDefs.forEach((chart, index) => {
          const range = plotRangeForDatasets(chart.datasets);
          const row = Math.floor(index / 2);
          const column = index % 2;
          mountWidget(new PlotWidget({
            title: chart.title,
            icon: 'PLOT',
            datasetIndices: chart.datasets.map((d) => d.index),
            datasetSourceIds: chart.datasets.map(sourceIdForDataset),
            datasetRefs: chart.datasets.map((d) => ({ index: d.index, sourceId: sourceIdForDataset(d) })),
            datasetLabels: chart.datasets.map(datasetLabel),
            datasetUnits: chart.datasets.map((d) => d.units || ''),
            datasetDecimals: chart.datasets.map((d) => Number.isInteger(d.decimals) ? d.decimals : d.precision),
            colorOffset: chart.colorOffset ?? chart.datasets[0]?.index ?? 0,
            yMin: range.yMin,
            yMax: range.yMax,
            x: column * (chartWidth + gap),
            y: y + row * (plotHeight + gap),
            w: chartWidth,
            h: plotHeight
          }));
        });
        y += Math.ceil(chartDefs.length / 2) * (plotHeight + gap);
      }
    }

    let cursorX = 0;
    let cursorY = y;
    let rowH = 0;
    const addFlowWidget = (factory, preferredWidth, height) => {
      const w = Math.min(width, preferredWidth);
      if (cursorX > 0 && cursorX + w > width) {
        cursorX = 0;
        cursorY += rowH + gap;
        rowH = 0;
      }
      mountWidget(factory({ x: cursorX, y: cursorY, w, h: height }));
      cursorX += w + gap;
      rowH = Math.max(rowH, height);
    };
    const finishFlow = () => {
      if (rowH > 0) {
        y = cursorY + rowH + gap;
        cursorX = 0;
        cursorY = y;
        rowH = 0;
      }
    };

    const gaugeWidth = Math.max(260, Math.floor((width - gap * 2) / 3));
    const interlockRules = (project.interlock?.enabled ? project.interlock.rules : [])
      .filter((rule) => rule.showOnDashboard !== false);
    interlockRules.forEach((rule, index) => {
      const widgetType = ['Plot', 'Gauge', 'Bar'].includes(rule.displayWidget) ? rule.displayWidget : 'Plot';
      const threshold = Number(rule.threshold) || 0;
      const min = Number.isFinite(Number(rule.displayMin)) ? Number(rule.displayMin) : 0;
      const max = Number.isFinite(Number(rule.displayMax)) && Number(rule.displayMax) > min
        ? Number(rule.displayMax)
        : Math.max(threshold * 1.5, 1);
      const title = `${rule.name || `RMS ${index + 1}`} - 实时值`;
      if (widgetType === 'Gauge') {
        addFlowWidget(({ x, y: widgetY, w, h }) => new GaugeWidget({
          title, eventName: 'interlock:metrics', datasetIndex: index, min, max,
          units: rule.unit || '', colorIdx: index, x, y: widgetY, w, h
        }), gaugeWidth, 260);
      } else if (widgetType === 'Bar') {
        addFlowWidget(({ x, y: widgetY, w, h }) => new BarWidget({
          title, eventName: 'interlock:metrics',
          datasets: [{ index, title: rule.name || `RMS ${index + 1}`, min, max, units: rule.unit || '' }],
          x, y: widgetY, w, h
        }), Math.max(320, Math.floor((width - gap) / 2)), 220);
      } else {
        addFlowWidget(({ x, y: widgetY, w, h }) => new PlotWidget({
          title, eventName: 'interlock:metrics', datasetIndices: [index],
          datasetLabels: [rule.name || `RMS ${index + 1}`], datasetUnits: [rule.unit || ''],
          colorOffset: index, x, y: widgetY, w, h
        }), Math.max(360, Math.floor((width - gap) / 2)), 260);
      }
    });

    gaugeDatasets.forEach((ds, i) => {
      addFlowWidget(({ x, y: widgetY, w, h }) => new GaugeWidget({
        title: ds.title,
        datasetIndex: ds.index,
        sourceId: sourceIdForDataset(ds),
        min: ds.min,
        max: ds.max,
        units: ds.units,
        colorIdx: i,
        x,
        y: widgetY,
        w,
        h
      }), gaugeWidth, 260);
    });

    if (barDatasets.length > 0) {
      addFlowWidget(({ x, y: widgetY, w, h }) => new BarWidget({
        title: 'Bar Indicators',
        icon: 'BAR',
        datasets: barDatasets,
        x,
        y: widgetY,
        w,
        h
      }), Math.max(320, Math.floor((width - gap) / 2)), 260);
    }

    compassDatasets.forEach((ds) => {
      addFlowWidget(({ x, y: widgetY, w, h }) => new CompassWidget({
        title: ds.title,
        datasetIndex: ds.index,
        sourceId: sourceIdForDataset(ds),
        units: ds.units,
        x,
        y: widgetY,
        w,
        h
      }), Math.max(260, Math.floor((width - gap * 2) / 3)), 260);
    });

    if (ledDatasets.length > 0) {
      addFlowWidget(({ x, y: widgetY, w, h }) => new LedWidget({
        title: 'LED Indicators',
        icon: 'LED',
        datasets: ledDatasets,
        x,
        y: widgetY,
        w,
        h
      }), Math.max(320, Math.floor((width - gap) / 2)), 220);
    }

    if (fftDatasets.length > 0) {
      groupDatasetsBySource(fftDatasets).forEach((sourceGroup) => {
        addFlowWidget(({ x, y: widgetY, w, h }) => new FftWidget({
          title: sourceGroup.sourceId ? `${sourceGroup.title} - FFT` : 'FFT',
          icon: 'FFT',
          datasets: sourceGroup.datasets,
          x,
          y: widgetY,
          w,
          h
        }), width, 280);
      });
    }

    finishFlow();

    if (datasets.length > 0) {
      groupDatasetsBySource(datasets).forEach((sourceGroup) => {
        const dg = new DataGridWidget({
          title: sourceGroup.sourceId ? `${sourceGroup.title} - ${t('dashboard.allData')}` : t('dashboard.allData'),
          icon: 'GRID',
          datasets: sourceGroup.datasets,
          x: 0,
          y,
          w: width,
          h: 260
        });
        dg.mount(this._canvas);
        this._widgets.push(dg);
        y += 260 + gap;
      });
    }

    this._updateCanvasHeight();
  }

  _createWidget(type, config) {
    switch (type) {
      case 'Plot':
      case 'MultiPlot':
        return new PlotWidget(config);
      case 'Gauge':
        return new GaugeWidget(config);
      case 'Bar':
        return new BarWidget(config);
      case 'Compass':
        return new CompassWidget(config);
      case 'LED':
        return new LedWidget(config);
      case 'FFT':
        return new FftWidget(config);
      case 'DataGrid':
        return new DataGridWidget(config);
      case 'Accel':
        return new AccelWidget(config);
      default:
        return null;
    }
  }

  _showGrid() {
    this._emptyEl?.classList.add('hidden');
    this._grid?.classList.remove('hidden');
  }

  _showEmpty() {
    this._emptyEl?.classList.remove('hidden');
    this._grid?.classList.add('hidden');
  }

  _resetAll() {
    this._widgets.forEach((w) => w.reset?.());
    rawFrameStore.clear();
    eventBus.emit('interlock:reset');
  }

  _updatePlcStatus(status = {}) {
    if (!this._plcStatusEl) return;
    const state = status.status || 'idle';
    const labels = {
      idle: 'PLC 未检测', testing: 'PLC 检测中', connecting: 'PLC 连接中',
      online: 'PLC 通信正常', error: 'PLC 通信异常'
    };
    const endpoint = status.host ? `${status.host}:${status.port || 502}` : 'PLC 地址未设置';
    const operation = status.operation
      ? `；${status.operation}${status.address !== undefined ? ` 地址 ${status.address}` : ''}${status.value !== undefined ? ` ← ${String(status.value)}` : ''}`
      : '';
    const detail = status.message || `${endpoint}；Unit ID ${status.unitId || 1}${operation}`;
    this._plcStatusEl.className = `plc-connection-status is-${state}`;
    this._plcStatusEl.querySelector('.plc-connection-title').textContent = labels[state] || 'PLC 状态';
    this._plcStatusEl.querySelector('.plc-connection-detail').textContent = detail;
    this._plcStatusEl.querySelector('.plc-connection-time').textContent = status.timestamp
      ? `最近通信：${new Date(status.timestamp).toLocaleTimeString()}`
      : endpoint;
  }

  _updateInterlockStatus(status = {}) {
    if (!this._interlockEl) return;
    const enabled = !!status.enabled;
    const alarm = enabled && status.state === 'alarm';
    const rules = Array.isArray(status.rules) ? status.rules : [];
    const detail = rules.length
      ? rules.slice(0, 3).map((rule) => {
        const value = Number(rule.value);
        const valueText = Number.isFinite(value) ? value.toFixed(4) : '--';
        const threshold = Number(rule.threshold);
        const thresholdText = Number.isFinite(threshold) ? threshold.toFixed(4) : '--';
        return `${rule.name}: ${valueText}/${thresholdText}${rule.unit || ''}`;
      }).join(' | ')
      : (enabled ? '等待联锁数据...' : '可在项目编辑器中配置 RMS 阈值与 PLC 输出。');

    this._interlockEl.classList.toggle('is-disabled', !enabled);
    this._interlockLogEl?.classList.toggle('is-disabled', !enabled);
    this._interlockEl.classList.toggle('is-normal', enabled && !alarm);
    this._interlockEl.classList.toggle('is-alarm', alarm);
    this._interlockEl.querySelector('.interlock-status-title').textContent = !enabled
      ? '联锁未启用'
      : (alarm ? '联锁报警' : '联锁正常');
    this._interlockEl.querySelector('.interlock-status-detail').textContent = detail;
  }

  _appendInterlockRecord(record = {}) {
    this._interlockRecords.unshift(record);
    if (this._interlockRecords.length > 100) this._interlockRecords.length = 100;
    this._renderInterlockRecords();
  }

  _renderInterlockRecords() {
    const list = this._interlockLogEl?.querySelector('#interlock-alarm-log-list');
    if (!list) return;
    if (!this._interlockRecords.length) {
      list.innerHTML = '<div class="interlock-alarm-log-empty">暂无报警记录</div>';
      return;
    }
    const labels = { alarm: '报警触发', recovered: '自动恢复', reset: '手动复位' };
    list.innerHTML = this._interlockRecords.map((record) => {
      const ruleText = (record.rules || []).map((rule) => {
        const value = Number(rule.value);
        return `${rule.name || rule.sourceField}: ${Number.isFinite(value) ? value.toFixed(6) : '--'} ${rule.unit || ''}`;
      }).join('；') || '--';
      return `<div class="interlock-alarm-log-row is-${escapeHtml(record.type || 'alarm')}">
        <time>${new Date(record.timestamp || Date.now()).toLocaleString()}</time>
        <strong>${escapeHtml(labels[record.type] || '状态变化')}</strong>
        <span title="${escapeHtml(ruleText)}">${escapeHtml(ruleText)}</span>
      </div>`;
    }).join('');
  }

  _handleWheelScroll(e) {
    if (!this._container || e.ctrlKey || e.metaKey) return;
    if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;

    const target = this._findScrollableTarget(e.target);
    if (!target) return;

    target.scrollTop += e.deltaY;
    e.preventDefault();
  }

  _findScrollableTarget(startEl) {
    let el = startEl instanceof HTMLElement ? startEl : null;
    while (el && el !== this._container) {
      const style = window.getComputedStyle(el);
      const overflowY = style.overflowY;
      const canScroll = (overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight;
      if (canScroll) return el;
      el = el.parentElement;
    }
    return this._container.scrollHeight > this._container.clientHeight ? this._container : null;
  }

  destroy() {
    this._container?.removeEventListener('wheel', this._wheelHandler);
    this._widgets.forEach((w) => w.destroy?.());
    this._widgets = [];
  }
}
