/**
 * ProjectModel — Project file data model (JSON schema)
 */

export const defaultProject = () => ({
  title: 'Untitled Project',
  protocol: 'Delimited',
  separator: ',',
  frameStart: '',
  frameEnd: '\\n',
  frameDetection: 'EndDelimiterOnly',
  protocolFields: [],
  interlock: {
    enabled: false,
    mode: 'any',
    windowSize: 1024,
    confirmWindows: 3,
    resetMode: 'manual',
    rules: [],
    onAlarm: { outputId: '' }
  },
  outputs: [],
  frameParser: "function parse(frame) {\n  return frame.split(',').map(Number);\n}\n",
  groups: [
    {
      title: 'Sensor Data',
      widget: 'MultiPlot',
      datasets: []
    }
  ]
});

function normalizeInterlock(input) {
  const data = input && typeof input === 'object' ? input : {};
  const rules = Array.isArray(data.rules) ? data.rules : [];
  return {
    enabled: !!data.enabled,
    mode: data.mode === 'all' ? 'all' : 'any',
    windowSize: Math.max(1, Number(data.windowSize) || 1024),
    confirmWindows: Math.max(1, Number(data.confirmWindows) || 3),
    resetMode: data.resetMode === 'auto' ? 'auto' : 'manual',
    rules: rules.map((rule, index) => ({
      id: String(rule?.id || `rule_${index + 1}`),
      name: String(rule?.name || rule?.title || `Rule ${index + 1}`),
      sourceField: String(rule?.sourceField || ''),
      sourceId: String(rule?.sourceId || ''),
      index: Number.isInteger(Number(rule?.index)) ? Number(rule.index) : undefined,
      method: ['rms', 'max', 'min', 'avg'].includes(rule?.method) ? rule.method : 'rms',
      threshold: Number(rule?.threshold) || 0,
      windowSize: Math.max(0, Number(rule?.windowSize) || 0),
      confirmWindows: Math.max(0, Number(rule?.confirmWindows) || 0),
      unit: String(rule?.unit || rule?.units || ''),
      showOnDashboard: rule?.showOnDashboard !== false,
      displayWidget: ['Plot', 'Gauge', 'Bar'].includes(rule?.displayWidget) ? rule.displayWidget : 'Plot',
      displayMin: Number.isFinite(Number(rule?.displayMin)) ? Number(rule.displayMin) : 0,
      displayMax: Number.isFinite(Number(rule?.displayMax)) ? Number(rule.displayMax) : Math.max(Number(rule?.threshold) * 1.5 || 1, 1)
    })),
    onAlarm: {
      outputId: String(data.onAlarm?.outputId || data.outputId || '')
    }
  };
}

function normalizeOutputs(input) {
  const outputs = Array.isArray(input) ? input : [];
  return outputs.map((output, index) => ({
    id: String(output?.id || `output_${index + 1}`),
    name: String(output?.name || output?.title || `Output ${index + 1}`),
    type: ['none', 'udp', 'tcp', 'serial', 'modbusTcp', 'modbusRtu'].includes(output?.type) ? output.type : 'none',
    host: String(output?.host || ''),
    port: Number(output?.port) || 0,
    serialPort: String(output?.serialPort || output?.portName || ''),
    baudRate: Number(output?.baudRate) || 9600,
    commandHex: String(output?.commandHex || ''),
    target: String(output?.target || ''),
    address: Number(output?.address) || 0,
    activeValue: output?.activeValue ?? true,
    inactiveValue: output?.inactiveValue ?? false,
    unitId: Math.max(0, Math.min(255, Number(output?.unitId) || 1)),
    modbusOperation: output?.modbusOperation === 'writeRegister' ? 'writeRegister' : 'writeCoil',
    timeout: Math.max(500, Number(output?.timeout) || 3000)
  }));
}

export class ProjectModel {
  constructor() {
    this._project = null;
  }

  get project() { return this._project; }
  get hasProject() { return this._project !== null; }
  get title() { return this._project?.title || 'Untitled'; }
  get groups() { return this._project?.groups || []; }

  loadFromJSON(json) {
    try {
      const data = typeof json === 'string' ? JSON.parse(json) : json;
      this._project = this._validateProject(data);
      return true;
    } catch (e) {
      console.error('ProjectModel: Failed to load project', e);
      return false;
    }
  }

  loadDefault() {
    this._project = defaultProject();
    return true;
  }

  exportJSON() {
    return JSON.stringify(this._project, null, 2);
  }

  addGroup(title = 'New Group') {
    if (!this._project) this._project = defaultProject();
    this._project.groups.push({
      title,
      widget: 'DataGrid',
      datasets: []
    });
  }

  removeGroup(index) {
    if (!this._project) return;
    this._project.groups.splice(index, 1);
  }

  addDataset(groupIndex, title = 'New Dataset') {
    if (!this._project) return;
    const group = this._project.groups[groupIndex];
    if (!group) return;
    const idx = group.datasets.length;
    group.datasets.push({
      title,
      index: idx,
      units: '',
      widget: 'Bar',
      sourceField: '',
      formula: 'raw',
      min: 0,
      max: 100,
      alarm: 0,
      led: false,
      fft: false,
      fftSampleRate: 0,
      fftSampleRateField: '',
      fftPoints: 128,
      fftWindow: 'Hann',
      fftMagnitudeMode: 'linear',
      fftAmplitudeUnit: '',
      plot: true,
      bar: true,
      gauge: false,
      compass: false
    });
  }

  removeDataset(groupIndex, datasetIndex) {
    if (!this._project) return;
    const group = this._project.groups[groupIndex];
    if (!group) return;
    group.datasets.splice(datasetIndex, 1);
  }

  _validateProject(data) {
    const sources = Array.isArray(data.sources) ? data.sources.map((source, index) => ({
      ...source,
      title: source.title || `Source ${index + 1}`,
      sourceId: source.sourceId ?? index,
      frameParserCode: source.frameParserCode || source.frameParser || '',
      frameParserLanguage: source.frameParserLanguage ?? 0
    })) : [];
    const parsers = data.parsers && typeof data.parsers === 'object' ? data.parsers : {};
    const frameParserCode = data.frameParserCode ||
      data.frameParser ||
      sources[0]?.frameParserCode ||
      '';

    return {
      title: data.title || 'Untitled',
      protocol: data.protocol || 'Delimited',
      separator: data.separator || ',',
      frameStart: data.frameStart || '',
      frameEnd: data.frameEnd || '\\n',
      frameDetection: data.frameDetection || 'EndDelimiterOnly',
      hexadecimalDelimiters: data.hexadecimalDelimiters ?? false,
      protocolFields: Array.isArray(data.protocolFields) ? data.protocolFields : [],
      protocolSchema: data.protocolSchema && typeof data.protocolSchema === 'object' ? data.protocolSchema : {},
      parsers,
      frameParser: data.frameParser || frameParserCode,
      frameParserCode,
      frameParserLanguage: data.frameParserLanguage ?? sources[0]?.frameParserLanguage ?? 0,
      protocolValidation: data.protocolValidation && typeof data.protocolValidation === 'object' ? data.protocolValidation : {},
      interlock: normalizeInterlock(data.interlock),
      outputs: normalizeOutputs(data.outputs),
      sourceIdMap: Array.isArray(data.sourceIdMap) ? data.sourceIdMap : [],
      calibrationParameters: Array.isArray(data.calibrationParameters) ? data.calibrationParameters : [],
      sources,
      groups: (data.groups || []).map(g => {
        const groupWidget = g.widget || 'DataGrid';
        return {
          title: g.title || 'Group',
          widget: groupWidget,
          datasets: (g.datasets || []).map((d, i) => {
            const min = d.min ?? d.widgetMin ?? d.plotMin ?? d.fftMin ?? 0;
            const max = d.max ?? d.widgetMax ?? d.plotMax ?? d.fftMax ?? 100;
            const defaultPlot = ['Plot', 'MultiPlot'].includes(groupWidget);
            const plot = d.plot ?? d.graph ?? defaultPlot;
            return {
              title: d.title || `Dataset ${i + 1}`,
              index: d.index ?? i,
              sourceId: d.sourceId ?? d.source ?? g.sourceId ?? g.source ?? '',
              units: d.units || '',
              widget: d.widget || groupWidget || 'Bar',
              min,
              max,
              alarm: d.alarm ?? d.alarmHigh ?? 0,
              led: d.led ?? false,
              fft: d.fft ?? false,
              fftSampleRate: Number(d.fftSampleRate) > 0 ? Number(d.fftSampleRate) : 0,
              fftSampleRateField: d.fftSampleRateField || '',
              fftPoints: [128, 256, 512, 1024].includes(Number(d.fftPoints)) ? Number(d.fftPoints) : 128,
              fftWindow: d.fftWindow === 'None' ? 'None' : 'Hann',
              fftMagnitudeMode: d.fftMagnitudeMode === 'db' ? 'db' : 'linear',
              fftAmplitudeUnit: d.fftAmplitudeUnit || d.units || '',
              plot,
              graph: d.graph ?? plot,
              bar: d.bar ?? groupWidget === 'Bar',
              gauge: d.gauge ?? groupWidget === 'Gauges',
              compass: d.compass ?? groupWidget === 'Compass',
              sourceField: d.sourceField || '',
              formula: d.formula || '',
              protocolGenerated: !!d.protocolGenerated,
              protocolSyncIndex: Number.isInteger(Number(d.protocolSyncIndex)) ? Number(d.protocolSyncIndex) : undefined
            };
          })
        };
      })
    };
  }
}
