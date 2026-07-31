function cloneProject(project) {
  if (typeof structuredClone === 'function') return structuredClone(project);
  return JSON.parse(JSON.stringify(project));
}

function getLabels(locale) {
  const fixedZhLabels = {
    title: '项目编辑器',
    addGroup: '添加分组',
    addDataset: '添加数据集',
    removeSelection: '删除当前项',
    loadDefault: '载入默认项目',
    apply: '应用到仪表盘',
    projectNode: '项目',
    groups: '分组',
    projectSettings: '项目设置',
    groupSettings: '分组设置',
    datasetSettings: '数据集设置',
    titleField: '标题',
    protocol: '协议',
    separator: '分隔符',
    frameStart: '帧起始',
    frameEnd: '帧结束',
    frameDetection: '帧检测',
    widget: '控件',
    index: '索引',
    units: '单位',
    min: '最小值',
    max: '最大值',
    alarm: '报警值',
    features: '启用功能',
    plot: '曲线',
    bar: '柱状图',
    gauge: '仪表',
    led: 'LED',
    fft: 'FFT',
    compass: '罗盘',
    selectionHint: '左侧选择项目、分组或数据集后即可编辑属性。',
    noGroupHint: '当前还没有分组，先添加一个分组。',
    noDatasetHint: '当前分组还没有数据集，可以先添加一个。',
    projectApplied: '项目编辑器内容已应用到仪表盘',
    invalidProject: '项目结构无效，无法应用',
    confirmDeleteGroup: '删除这个分组以及其下所有数据集？',
    confirmDeleteDataset: '删除这个数据集？'
  };

  const zhLabels = {
    title: '\u9879\u76ee\u7f16\u8f91\u5668',
    addGroup: '\u6dfb\u52a0\u5206\u7ec4',
    addDataset: '\u6dfb\u52a0\u6570\u636e\u96c6',
    removeSelection: '\u5220\u9664\u5f53\u524d\u9879',
    loadDefault: '\u8f7d\u5165\u9ed8\u8ba4\u9879\u76ee',
    apply: '\u5e94\u7528\u5230\u4eea\u8868\u76d8',
    projectNode: '\u9879\u76ee',
    groups: '\u5206\u7ec4',
    projectSettings: '\u9879\u76ee\u8bbe\u7f6e',
    groupSettings: '\u5206\u7ec4\u8bbe\u7f6e',
    datasetSettings: '\u6570\u636e\u96c6\u8bbe\u7f6e',
    titleField: '\u6807\u9898',
    protocol: '\u534f\u8bae',
    separator: '\u5206\u9694\u7b26',
    frameStart: '\u5e27\u8d77\u59cb',
    frameEnd: '\u5e27\u7ed3\u675f',
    frameDetection: '\u5e27\u68c0\u6d4b',
    widget: '\u63a7\u4ef6',
    index: '\u7d22\u5f15',
    units: '\u5355\u4f4d',
    min: '\u6700\u5c0f\u503c',
    max: '\u6700\u5927\u503c',
    alarm: '\u62a5\u8b66\u503c',
    features: '\u542f\u7528\u529f\u80fd',
    plot: '\u66f2\u7ebf',
    bar: '\u67f1\u72b6\u56fe',
    gauge: '\u4eea\u8868',
    led: 'LED',
    fft: 'FFT',
    compass: '\u7f57\u76d8',
    selectionHint: '\u5de6\u4fa7\u9009\u62e9\u9879\u76ee\u3001\u5206\u7ec4\u6216\u6570\u636e\u96c6\u540e\u5373\u53ef\u7f16\u8f91\u5c5e\u6027\u3002',
    noGroupHint: '\u5f53\u524d\u8fd8\u6ca1\u6709\u5206\u7ec4\uff0c\u5148\u6dfb\u52a0\u4e00\u4e2a\u5206\u7ec4\u3002',
    noDatasetHint: '\u5f53\u524d\u5206\u7ec4\u8fd8\u6ca1\u6709\u6570\u636e\u96c6\uff0c\u53ef\u4ee5\u5148\u6dfb\u52a0\u4e00\u4e2a\u3002',
    projectApplied: '\u9879\u76ee\u7f16\u8f91\u5668\u5185\u5bb9\u5df2\u5e94\u7528\u5230\u4eea\u8868\u76d8',
    invalidProject: '\u9879\u76ee\u7ed3\u6784\u65e0\u6548\uff0c\u65e0\u6cd5\u5e94\u7528',
    confirmDeleteGroup: '\u5220\u9664\u8fd9\u4e2a\u5206\u7ec4\u4ee5\u53ca\u5176\u4e0b\u6240\u6709\u6570\u636e\u96c6\uff1f',
    confirmDeleteDataset: '\u5220\u9664\u8fd9\u4e2a\u6570\u636e\u96c6\uff1f'
  };

  if (locale === 'zh-CN') return zhLabels;

  if (locale === 'zh-CN') {
    return {
      title: '项目编辑器',
      addGroup: '添加分组',
      addDataset: '添加数据集',
      removeSelection: '删除当前项',
      loadDefault: '载入默认项目',
      apply: '应用到仪表盘',
      projectNode: '项目',
      groups: '分组',
      projectSettings: '项目设置',
      groupSettings: '分组设置',
      datasetSettings: '数据集设置',
      titleField: '标题',
      protocol: '协议',
      separator: '分隔符',
      frameStart: '帧起始',
      frameEnd: '帧结束',
      frameDetection: '帧检测',
      widget: '控件',
      index: '索引',
      units: '单位',
      min: '最小值',
      max: '最大值',
      alarm: '报警值',
      features: '启用功能',
      plot: '曲线',
      bar: '柱状图',
      gauge: '仪表',
      led: 'LED',
      fft: 'FFT',
      compass: '罗盘',
      selectionHint: '左侧选择项目、分组或数据集后即可编辑属性。',
      noGroupHint: '当前还没有分组，先添加一个分组。',
      noDatasetHint: '当前分组还没有数据集，可以先添加一个。',
      projectApplied: '项目编辑器内容已应用到仪表盘',
      invalidProject: '项目结构无效，无法应用',
      confirmDeleteGroup: '删除这个分组以及其下所有数据集？',
      confirmDeleteDataset: '删除这个数据集？'
    };
  }

  if (locale === 'zh-CN') {
    return {
      title: '项目编辑器',
      addGroup: '添加分组',
      addDataset: '添加数据集',
      removeSelection: '删除当前项',
      loadDefault: '载入默认项目',
      apply: '应用到仪表盘',
      projectNode: '项目',
      groups: '分组',
      projectSettings: '项目设置',
      groupSettings: '分组设置',
      datasetSettings: '数据集设置',
      titleField: '标题',
      protocol: '协议',
      separator: '分隔符',
      frameStart: '帧起始',
      frameEnd: '帧结束',
      frameDetection: '帧检测',
      widget: '控件',
      index: '索引',
      units: '单位',
      min: '最小值',
      max: '最大值',
      alarm: '报警值',
      features: '启用功能',
      plot: '曲线',
      bar: '柱状图',
      gauge: '仪表',
      led: 'LED',
      fft: 'FFT',
      compass: '罗盘',
      selectionHint: '左侧选择项目、分组或数据集后即可编辑属性。',
      noGroupHint: '当前还没有分组，先添加一个分组。',
      noDatasetHint: '当前分组还没有数据集，可以先添加一个。',
      projectApplied: '项目编辑器内容已应用到仪表盘',
      invalidProject: '项目结构无效，无法应用',
      confirmDeleteGroup: '删除这个分组以及其下所有数据集？',
      confirmDeleteDataset: '删除这个数据集？'
    };
  }

  return {
    title: 'Project Editor',
    addGroup: 'Add Group',
    addDataset: 'Add Dataset',
    removeSelection: 'Delete Selection',
    loadDefault: 'Load Default',
    apply: 'Apply to Dashboard',
    projectNode: 'Project',
    groups: 'Groups',
    projectSettings: 'Project Settings',
    groupSettings: 'Group Settings',
    datasetSettings: 'Dataset Settings',
    titleField: 'Title',
    protocol: 'Protocol',
    separator: 'Separator',
    frameStart: 'Frame Start',
    frameEnd: 'Frame End',
    frameDetection: 'Frame Detection',
    widget: 'Widget',
    index: 'Index',
    units: 'Units',
    min: 'Min',
    max: 'Max',
    alarm: 'Alarm',
    features: 'Features',
    plot: 'Plot',
    bar: 'Bar',
    gauge: 'Gauge',
    led: 'LED',
    fft: 'FFT',
    compass: 'Compass',
    selectionHint: 'Select the project, a group, or a dataset on the left to edit its properties.',
    noGroupHint: 'No groups yet. Add a group to start building the project.',
    noDatasetHint: 'This group has no datasets yet. Add one to continue.',
    projectApplied: 'Project editor changes applied to the dashboard',
    invalidProject: 'The project structure is invalid and could not be applied',
    confirmDeleteGroup: 'Delete this group and all of its datasets?',
    confirmDeleteDataset: 'Delete this dataset?'
  };
}

const GROUP_WIDGETS = ['DataGrid', 'MultiPlot', 'Plot', 'Bar', 'Gauge', 'Gauges', 'Compass', 'Accelerometer'];
const DATASET_WIDGETS = ['Bar', 'Gauge', 'Plot', 'Compass', 'DataGrid'];
const OPTION_LABELS_ZH = {
  DataGrid: '数据表格',
  MultiPlot: '多曲线图',
  Plot: '折线图',
  Bar: '柱状图',
  Gauge: '仪表盘',
  Gauges: '多仪表盘',
  Compass: '罗盘',
  Accelerometer: '加速度计',
  EndDelimiterOnly: '仅帧尾',
  StartAndEndDelimiter: '帧头 + 帧尾',
  NoDelimiters: '无帧分隔',
  Hann: 'Hann 窗',
  None: '无',
  linear: '线性幅值',
  db: 'dB 幅值'
};
const FRAME_DETECTIONS = ['EndDelimiterOnly', 'StartAndEndDelimiter', 'NoDelimiters'];
const PROTOCOL_FIELD_KINDS = ['byte', 'frameHeader', 'frameTail', 'frameSequence', 'frameId', 'frameLength', 'fixedArray', 'variableArray', 'checksum'];
const FIELD_TYPES = ['uint8', 'int8', 'uint16', 'int16', 'uint24', 'int24', 'uint32', 'int32', 'float32', 'float64'];
const COMMAND_FIELD_TYPES = [...FIELD_TYPES, 'hex', 'ascii'];
const BYTE_ORDERS = ['LE', 'BE'];
const ARRAY_ORDERS = ['channelFirst', 'interleaved'];
const CHECKSUM_TYPES = ['none', 'sum8', 'sum16', 'xor8', 'crc8', 'crc16modbus', 'crc16ccitt'];
const FRAME_LENGTH_SIZES = ['1', '2', '4'];
const FFT_POINTS = ['128', '256', '512', '1024'];
const FFT_WINDOWS = ['Hann', 'None'];
const FFT_MAGNITUDE_MODES = ['linear', 'db'];
const FORMULA_TEMPLATES = {
  raw: 'raw',
  linear: 'raw * (fields.scale ?? 1) + (fields.offset ?? 0)',
  adc24Voltage: 'raw * 2.5 / 8388608',
  adc24Bipolar: 'raw * 5 / 16777216',
  milliVolt: 'raw / 1000',
  pt100: '(() => {\n  const A = 3.9083e-3;\n  const B = -5.775e-7;\n  const r0 = 100;\n  const resistance = Math.abs(raw) * 0.0002980232;\n  const d = A * A - 4 * B * (1 - resistance / r0);\n  return d < 0 ? NaN : (-A + Math.sqrt(d)) / (2 * B);\n})()',
  arrayOffset: 'raw - fields.zero_offset',
  custom: ''
};

const CALIBRATION_PRESETS = [
  { key: 'adc24_2v5', nameZh: '24bit ADC 2.5V', nameEn: '24-bit ADC 2.5V', formula: 'raw * 2.5 / 8388608.0', unit: 'V' },
  { key: 'pt100_code', nameZh: 'PT100 Code 温度', nameEn: 'PT100 Code Temperature', formula: '(() => {\n  const A = 3.9083e-3;\n  const B = -5.775e-7;\n  const r0 = 100;\n  const resistance = Math.abs(raw) * 0.0002980232;\n  const d = A * A - 4 * B * (1 - resistance / r0);\n  return d < 0 ? NaN : (-A + Math.sqrt(d)) / (2 * B);\n})()', unit: '°C' },
  { key: 'raw_offset_scale', nameZh: '零点与比例标定', nameEn: 'Offset / Scale Calibration', formula: '(raw - (params.zero ?? 0)) * (params.scale ?? 1)', unit: '' }
];

const PROJECT_TEMPLATES = [
  {
    id: 'binary-basic',
    nameZh: '\u56fa\u5b9a\u4e8c\u8fdb\u5236\u5e27',
    nameEn: 'Fixed Binary Frame',
    descriptionZh: '\u9002\u5408\u5e27\u5934+\u5e27\u5c3e+\u56fa\u5b9a\u5b57\u6bb5\u7684\u4e8c\u8fdb\u5236\u534f\u8bae\u3002',
    descriptionEn: 'For binary protocols with fixed fields, start delimiter and end delimiter.',
    project: () => ({
      title: '\u56fa\u5b9a\u4e8c\u8fdb\u5236\u5e27',
      protocol: 'Delimited',
      separator: ',',
      frameStart: '5A A5',
      frameEnd: 'DD EE',
      frameDetection: 'StartAndEndDelimiter',
      hexadecimalDelimiters: true,
      protocolFields: [
        { name: 'frameId', type: 'uint32', offset: 0, count: 1, endian: 'LE' },
        { name: 'value1_raw', type: 'int24', offset: 4, count: 1, endian: 'BE' }
      ],
      groups: [
        {
          title: '\u6570\u636e',
          widget: 'MultiPlot',
          datasets: [
            { title: 'Value 1', index: 0, sourceField: 'value1_raw', formula: 'raw', units: '', min: -100, max: 100, plot: true, graph: true }
          ]
        }
      ],
      sources: []
    })
  },
  {
    id: 'three-strain-no-vibration',
    nameZh: '\u4e09\u5e94\u53d8\u65e0\u632f\u52a8',
    nameEn: 'Three Strain, No Vibration',
    descriptionZh: '3\u8def int24 \u5e94\u53d8\u6570\u7ec4 + PT100 + TMP117\uff0c\u9002\u5408\u8f74\u74e6\u8282\u70b9\u3002',
    descriptionEn: 'Three int24 strain arrays with PT100 and TMP117 temperatures.',
    project: () => ({
      title: '\u8f74\u74e6\uff08\u4e09\u5e94\u53d8\u65e0\u632f\u52a8\uff09',
      protocol: 'Delimited',
      separator: ',',
      frameStart: '5A A5 02 B5 0A 02 DD 80 02',
      frameEnd: 'DD EE',
      frameDetection: 'StartAndEndDelimiter',
      hexadecimalDelimiters: true,
      protocolFields: [
        { name: 'frameId', type: 'uint32', offset: 0, count: 1, endian: 'LE' },
        { name: 'strain1', type: 'int24', offset: 4, count: 160, endian: 'BE' },
        { name: 'strain2', type: 'int24', offset: 484, count: 160, endian: 'BE' },
        { name: 'strain3', type: 'int24', offset: 964, count: 160, endian: 'BE' },
        { name: 'pt100Temperature', type: 'int24', offset: 1444, count: 1, endian: 'BE' },
        { name: 'tmp117Temperature', type: 'int16', offset: 1447, count: 1, endian: 'BE' },
        { name: 'reserved', type: 'uint8', offset: 1449, count: 8, endian: 'BE' },
        { name: 'checksum', type: 'uint8', offset: 1457, count: 1, endian: 'BE' }
      ],
      groups: [
        {
          title: '\u4e09\u5e94\u53d8',
          widget: 'MultiPlot',
          datasets: [
            { title: '\u5e94\u53d81', index: 0, sourceField: 'strain1', formula: 'raw * 2.5 / 8388608.0', units: '', min: -3, max: 3, plot: true, graph: true },
            { title: '\u5e94\u53d82', index: 1, sourceField: 'strain2', formula: 'raw * 2.5 / 8388608.0', units: '', min: -3, max: 3, plot: true, graph: true },
            { title: '\u5e94\u53d83', index: 2, sourceField: 'strain3', formula: 'raw * 2.5 / 8388608.0', units: '', min: -3, max: 3, plot: true, graph: true }
          ]
        },
        {
          title: '\u6e29\u5ea6',
          widget: 'Gauges',
          datasets: [
            {
              title: 'PT100\u6e29\u5ea6',
              index: 3,
              sourceField: 'pt100Temperature',
              formula: '(() => { const A = 3.9083e-3; const B = -5.775e-7; const d = A * A - 4 * B * (1 - ((raw * 0.0002980232) / 100)); return d < 0 ? NaN : (-A + Math.sqrt(d)) / (2 * B); })()',
              units: '\u00b0C',
              min: -50,
              max: 150,
              gauge: true,
              graph: false
            },
            { title: 'TMP117\u6e29\u5ea6', index: 4, sourceField: 'tmp117Temperature', formula: 'raw * 0.0078125', units: '\u00b0C', min: -50, max: 150, gauge: true, graph: false }
          ]
        }
      ],
      sources: []
    })
  },
  {
    id: 'csv-quick',
    nameZh: 'CSV \u5feb\u901f\u7ed8\u56fe',
    nameEn: 'CSV Quick Plot',
    descriptionZh: '\u9002\u5408\u9017\u53f7\u5206\u9694\u7684\u6587\u672c\u6570\u636e\uff0c\u5982 1.2,3.4,5.6\\n\u3002',
    descriptionEn: 'For comma-separated text frames, e.g. 1.2,3.4,5.6\\n.',
    project: () => ({
      title: 'CSV Quick Plot',
      protocol: 'Delimited',
      separator: ',',
      frameStart: '',
      frameEnd: '\\n',
      frameDetection: 'EndDelimiterOnly',
      hexadecimalDelimiters: false,
      protocolFields: [],
      groups: [
        {
          title: 'CSV Data',
          widget: 'MultiPlot',
          datasets: [
            { title: 'Ch 1', index: 0, units: '', min: -100, max: 100, plot: true, graph: true },
            { title: 'Ch 2', index: 1, units: '', min: -100, max: 100, plot: true, graph: true },
            { title: 'Ch 3', index: 2, units: '', min: -100, max: 100, plot: true, graph: true }
          ]
        }
      ],
      sources: [],
      frameParser: '',
      frameParserCode: ''
    })
  },
  {
    id: 'multi-udp-nodes',
    nameZh: '\u591a UDP \u8282\u70b9\u6a21\u677f',
    nameEn: 'Multi UDP Nodes',
    descriptionZh: '\u9884\u7f6e node-01/node-02/node-03 sourceId\uff0c\u4fbf\u4e8e\u7f51\u5173\u56fa\u5b9a\u6620\u5c04\u548c\u591a\u8282\u70b9\u7ed8\u56fe\u3002',
    descriptionEn: 'Predefines node-01/node-02/node-03 sourceIds for gateway mapping and multi-node charts.',
    project: () => ({
      title: '\u591a UDP \u8282\u70b9\u76d1\u6d4b',
      protocol: 'Delimited',
      separator: ',',
      frameStart: '5A A5',
      frameEnd: 'DD EE',
      frameDetection: 'StartAndEndDelimiter',
      hexadecimalDelimiters: true,
      protocolValidation: {
        frameLength: { enabled: false, offset: 0, size: 2, endian: 'BE', adjustment: 0 },
        checksum: { type: 'none', offset: -1, length: 1, endian: 'BE', rangeStart: 0, rangeLength: 0 }
      },
      sourceIdMap: [
        { sourceId: 'node-01', title: '\u8282\u70b901', ip: '192.168.1.251', udpPort: 1030 },
        { sourceId: 'node-02', title: '\u8282\u70b902', ip: '192.168.1.253', udpPort: 1030 },
        { sourceId: 'node-03', title: '\u8282\u70b903', ip: '192.168.1.255', udpPort: 1030 }
      ],
      calibrationParameters: [
        { name: 'scale', value: 1, unit: '' },
        { name: 'zero', value: 0, unit: '' }
      ],
      protocolFields: [
        { name: 'value_raw', type: 'int24', offset: 0, count: 1, endian: 'BE' }
      ],
      groups: [
        {
          title: '\u8282\u70b9\u6570\u636e',
          widget: 'MultiPlot',
          datasets: [
            { title: '\u8282\u70b901', index: 0, sourceId: 'node-01', sourceField: 'value_raw', formula: 'raw', units: '', min: -100, max: 100, plot: true, graph: true },
            { title: '\u8282\u70b902', index: 1, sourceId: 'node-02', sourceField: 'value_raw', formula: 'raw', units: '', min: -100, max: 100, plot: true, graph: true },
            { title: '\u8282\u70b903', index: 2, sourceId: 'node-03', sourceField: 'value_raw', formula: 'raw', units: '', min: -100, max: 100, plot: true, graph: true }
          ]
        }
      ],
      sources: []
    })
  }
];

function byteLengthForType(type) {
  const normalized = String(type || '').toLowerCase();
  if (normalized.endsWith('8')) return 1;
  if (normalized.endsWith('16')) return 2;
  if (normalized.endsWith('24')) return 3;
  if (normalized.endsWith('32')) return 4;
  if (normalized.endsWith('64')) return 8;
  return 1;
}

function hexByteLength(hexText) {
  const clean = String(hexText || '').replace(/0x/gi, '').replace(/[^0-9a-f]/gi, '');
  return clean.length >= 2 && clean.length % 2 === 0 ? clean.length / 2 : 0;
}

function fieldByteSize(field) {
  const kind = String(field?.kind || 'byte');
  if (kind === 'frameHeader' || kind === 'frameTail') {
    const fixedLength = hexByteLength(field?.fixedValue || field?.value || '');
    if (fixedLength > 0) return fixedLength;
  }
  if (kind === 'fixedArray' || kind === 'variableArray') {
    const explicitLength = Math.max(0, Number(field?.byteLength) || 0);
    if (explicitLength > 0) return explicitLength;
  }
  const samples = Math.max(1, Number(field?.count) || 1);
  const channels = (kind === 'fixedArray' || kind === 'variableArray') ? Math.max(1, Number(field?.channels) || 1) : 1;
  return byteLengthForType(field?.type) * samples * channels;
}

function fieldEndOffset(field) {
  return Math.max(0, Number(field?.offset) || 0) + fieldByteSize(field);
}

function extendProtocolLabels(labels, locale) {
  const zh = locale === 'zh-CN';
  return {
    ...labels,
    fieldEditor: zh ? '\u5b57\u6bb5\u7f16\u8f91\u5668' : 'Field Editor',
    formulaEditor: zh ? '\u516c\u5f0f\u7f16\u8f91\u5668' : 'Formula Editor',
    displayEditor: zh ? '\u663e\u793a\u7f16\u8f91\u5668' : 'Display Editor',
    sourceField: zh ? '\u6765\u6e90\u5b57\u6bb5' : 'Source Field',
    formula: zh ? '\u6362\u7b97\u516c\u5f0f' : 'Formula',
    formulaHelp: zh
      ? '\u53ef\u4f7f\u7528 raw\u3001fields\u3001bytes\u3001Math\u3001index\u3001params\u3002\u793a\u4f8b\uff1araw * 2.5 / 8388608\u3002'
      : 'Use raw, fields, bytes, Math, index and params. Example: raw * 2.5 / 8388608.',
    fieldHelp: zh
      ? '\u6309 JCom \u98ce\u683c\u5b9a\u4e49\u5e27\u5934\u3001\u5e27\u5c3e\u3001\u5e27\u5e8f\u53f7\u3001\u5e27ID\u3001\u5e27\u957f\u5ea6\u548c BYTE \u5b57\u6bb5\uff0c\u5e94\u7528\u65f6\u4f1a\u4fdd\u5b58\u4e3a\u7ed3\u6784\u5316 JSON \u5e76\u81ea\u52a8\u751f\u6210 parser\u3002'
      : 'Define header, tail, sequence, frame ID, frame length and byte fields. The editor saves structured JSON and generates the parser automatically.',
    addField: zh ? '\u6dfb\u52a0\u5b57\u6bb5' : 'Add Field',
    autoOffset: zh ? '\u81ea\u52a8\u504f\u79fb' : 'Auto Offset',
    sortByOffset: zh ? '\u6309\u504f\u79fb\u6392\u5e8f' : 'Sort by Offset',
    generateParser: zh ? '\u751f\u6210\u89e3\u6790\u5668' : 'Generate Parser',
    moveUp: zh ? '\u4e0a\u79fb' : 'Move Up',
    moveDown: zh ? '\u4e0b\u79fb' : 'Move Down',
    duplicate: zh ? '\u590d\u5236' : 'Duplicate',
    openProject: zh ? '\u6253\u5f00\u9879\u76ee' : 'Open Project',
    saveProject: zh ? '\u4fdd\u5b58\u9879\u76ee' : 'Save Project',
    projectLoaded: zh ? '\u9879\u76ee\u5df2\u8f7d\u5165\u7f16\u8f91\u5668' : 'Project loaded into editor',
    projectSaved: zh ? '\u9879\u76ee\u5df2\u4fdd\u5b58' : 'Project saved',
    hexDelimiters: zh ? '\u5341\u516d\u8fdb\u5236\u5e27\u5934/\u5e27\u5c3e' : 'Hex Delimiters',
    fieldName: zh ? '\u540d\u79f0' : 'Name',
    fieldKind: zh ? '\u5b57\u6bb5\u7c7b\u578b' : 'Field Kind',
    fieldType: zh ? '\u7c7b\u578b' : 'Type',
    fieldOffset: zh ? '\u504f\u79fb' : 'Offset',
    fieldCount: zh ? '\u6570\u91cf' : 'Count',
    fieldEndian: zh ? '\u5b57\u8282\u5e8f' : 'Endian',
    fieldFixedValue: zh ? '\u56fa\u5b9a\u503c/HEX' : 'Fixed Value / HEX',
    fieldFormula: zh ? '\u5b57\u6bb5\u516c\u5f0f' : 'Field Formula',
    arrayChannels: zh ? '\u901a\u9053' : 'Channels',
    arrayOrder: zh ? '\u6570\u7ec4\u6392\u5217' : 'Array Order',
    arrayLengthField: zh ? '\u957f\u5ea6\u5b57\u6bb5' : 'Length Field',
    fieldBytes: zh ? '\u5b57\u8282' : 'Bytes',
    fieldRange: zh ? '\u8303\u56f4' : 'Range',
    noFields: zh ? '\u5c1a\u672a\u5b9a\u4e49\u5b57\u6bb5' : 'No fields defined yet.',
    none: zh ? '\u65e0' : 'None',
    sourceId: zh ? '\u6570\u636e\u6e90 sourceId' : 'Source ID',
    formulaTemplate: zh ? '\u516c\u5f0f\u6a21\u677f' : 'Formula Template',
    applyTemplate: zh ? '\u5957\u7528\u6a21\u677f' : 'Apply Template',
    testFormula: zh ? '\u6d4b\u8bd5\u516c\u5f0f' : 'Test Formula',
    testRaw: zh ? '\u6d4b\u8bd5 raw' : 'Test raw',
    testIndex: zh ? '\u6d4b\u8bd5 index' : 'Test index',
    formulaResult: zh ? '\u8ba1\u7b97\u7ed3\u679c' : 'Formula result',
    recognizedParser: zh ? '\u5df2\u4ece\u89e3\u6790\u5668\u8bc6\u522b\u5b57\u6bb5/\u6570\u636e\u96c6' : 'Recognized fields/datasets from parser',
    parserGenerated: zh ? '\u89e3\u6790\u5668\u5df2\u6839\u636e\u5b57\u6bb5\u8868\u751f\u6210' : 'Parser generated from field table',
    parserNeedsFields: zh ? '\u9700\u8981\u81f3\u5c11\u4e00\u4e2a\u5b57\u6bb5\u548c\u4e00\u4e2a\u5df2\u7ed1\u5b9a\u6765\u6e90\u5b57\u6bb5\u7684\u6570\u636e\u96c6' : 'At least one field and one dataset with source field are required',
    projectWizard: zh ? '\u65b0\u5efa\u89e3\u6790\u6587\u4ef6\u5411\u5bfc' : 'New Parser Wizard',
    templateLibrary: zh ? '\u6a21\u677f\u5e93' : 'Template Library',
    templateHelp: zh ? '\u9009\u62e9\u6a21\u677f\u540e\u53ef\u5feb\u901f\u751f\u6210\u5b57\u6bb5\u3001\u6570\u636e\u96c6\u548c\u57fa\u7840\u5e27\u914d\u7f6e\u3002' : 'Select a template to quickly create fields, datasets and frame settings.',
    createFromTemplate: zh ? '\u4ece\u6a21\u677f\u65b0\u5efa' : 'Create from Template',
    batchGenerator: zh ? '\u6279\u91cf\u751f\u6210\u5b57\u6bb5\u548c\u6570\u636e\u96c6' : 'Batch Generate Fields & Datasets',
    batchPrefix: zh ? '\u540d\u79f0\u524d\u7f00' : 'Name Prefix',
    batchCount: zh ? '\u901a\u9053\u6570' : 'Channels',
    batchStartOffset: zh ? '\u8d77\u59cb\u504f\u79fb' : 'Start Offset',
    batchSamples: zh ? '\u6bcf\u901a\u9053\u91c7\u6837\u70b9' : 'Samples / Channel',
    batchFormula: zh ? '\u6279\u91cf\u516c\u5f0f' : 'Batch Formula',
    batchUnits: zh ? '\u6279\u91cf\u5355\u4f4d' : 'Batch Units',
    batchWidget: zh ? '\u5206\u7ec4\u63a7\u4ef6' : 'Group Widget',
    batchApply: zh ? '\u6279\u91cf\u751f\u6210' : 'Generate Batch',
    sampleTester: zh ? '\u6837\u4f8b HEX \u89e3\u6790\u6d4b\u8bd5' : 'Sample HEX Parser Test',
    sampleHex: zh ? '\u6837\u4f8b HEX \u6570\u636e' : 'Sample HEX',
    runSampleTest: zh ? '\u89e3\u6790\u6d4b\u8bd5' : 'Run Test',
    sampleResult: zh ? '\u89e3\u6790\u7ed3\u679c' : 'Parse Result',
    layoutView: zh ? '\u5b57\u8282\u5e03\u5c40\u89c6\u56fe' : 'Byte Layout View',
    layoutEmpty: zh ? '\u6682\u65e0\u5b57\u6bb5\uff0c\u6dfb\u52a0\u5b57\u6bb5\u540e\u663e\u793a\u5b57\u8282\u5e03\u5c40\u3002' : 'No fields yet. Add fields to show the byte layout.',
    batchCreated: zh ? '\u6279\u91cf\u5b57\u6bb5\u548c\u6570\u636e\u96c6\u5df2\u751f\u6210' : 'Batch fields and datasets generated',
    templateApplied: zh ? '\u6a21\u677f\u5df2\u5e94\u7528\u5230\u7f16\u8f91\u5668' : 'Template applied to editor',
    parserTestPassed: zh ? '\u6837\u4f8b\u89e3\u6790\u6210\u529f' : 'Sample parsed successfully',
    parserTestFailed: zh ? '\u6837\u4f8b\u89e3\u6790\u5931\u8d25' : 'Sample parse failed',
    professionalSettings: zh ? '\u4e13\u4e1a\u534f\u8bae\u914d\u7f6e' : 'Professional Protocol Settings',
    checksumConfig: zh ? '\u6821\u9a8c\u7801\u914d\u7f6e' : 'Checksum Configuration',
    checksumType: zh ? '\u6821\u9a8c\u7c7b\u578b' : 'Checksum Type',
    checksumOffset: zh ? '\u6821\u9a8c\u504f\u79fb' : 'Checksum Offset',
    checksumLength: zh ? '\u6821\u9a8c\u5b57\u8282' : 'Checksum Bytes',
    checksumRangeStart: zh ? '\u6821\u9a8c\u8d77\u59cb' : 'Checksum Range Start',
    checksumRangeLength: zh ? '\u6821\u9a8c\u957f\u5ea6' : 'Checksum Range Length',
    frameLengthConfig: zh ? '\u5e27\u957f\u5ea6\u5b57\u6bb5\u914d\u7f6e' : 'Frame Length Field',
    frameLengthEnabled: zh ? '\u542f\u7528\u5e27\u957f\u5ea6\u6821\u9a8c' : 'Enable frame length check',
    frameLengthOffset: zh ? '\u957f\u5ea6\u5b57\u6bb5\u504f\u79fb' : 'Length Field Offset',
    frameLengthSize: zh ? '\u957f\u5ea6\u5b57\u8282' : 'Length Bytes',
    frameLengthEndian: zh ? '\u957f\u5ea6\u5b57\u8282\u5e8f' : 'Length Endian',
    frameLengthAdjustment: zh ? '\u957f\u5ea6\u4fee\u6b63\u503c' : 'Length Adjustment',
    sourceIdEditor: zh ? '\u591a sourceId \u7f16\u8f91' : 'Multi Source ID Editor',
    sourceTitle: zh ? '\u663e\u793a\u540d\u79f0' : 'Display Name',
    sourceIp: zh ? '\u8bbe\u5907 IP' : 'Device IP',
    sourceUdpPort: zh ? 'UDP \u7aef\u53e3' : 'UDP Port',
    addSource: zh ? '\u6dfb\u52a0 sourceId' : 'Add Source ID',
    calibrationLibrary: zh ? '\u516c\u5f0f\u5e93\u548c\u6807\u5b9a\u53c2\u6570\u5e93' : 'Formula & Calibration Library',
    calibrationPreset: zh ? '\u516c\u5f0f\u9884\u8bbe' : 'Formula Preset',
    applyCalibrationPreset: zh ? '\u5957\u7528\u5230\u5f53\u524d\u6570\u636e\u96c6' : 'Apply to Current Dataset',
    calibrationName: zh ? '\u53c2\u6570\u540d' : 'Parameter',
    calibrationValue: zh ? '\u53c2\u6570\u503c' : 'Value',
    calibrationUnit: zh ? '\u5355\u4f4d' : 'Unit',
    addCalibration: zh ? '\u6dfb\u52a0\u6807\u5b9a\u53c2\u6570' : 'Add Calibration',
    protocolImport: zh ? '\u5bfc\u5165\u534f\u8bae\u8868\u683c' : 'Import Protocol Table',
    importHelp: zh ? '\u53ef\u7c98\u8d34 Excel/Word \u8868\u683c\uff0c\u6216\u5bfc\u5165 CSV/TSV/TXT\u3002\u8868\u5934\u5efa\u8bae\uff1aname,type,offset,count,endian,title,units,formula,widget\u3002' : 'Paste an Excel/Word table or import CSV/TSV/TXT. Suggested headers: name,type,offset,count,endian,title,units,formula,widget.',
    importTable: zh ? '\u7c98\u8d34\u8868\u683c' : 'Paste Table',
    importFile: zh ? '\u5bfc\u5165\u6587\u4ef6' : 'Import File',
    importApply: zh ? '\u751f\u6210\u5b57\u6bb5/\u6570\u636e\u96c6' : 'Generate Fields/Datasets',
    importUnsupported: zh ? '\u5f53\u524d\u6d4f\u89c8\u5668\u7aef\u6682\u4e0d\u76f4\u63a5\u89e3\u6790 xlsx/docx\uff0c\u8bf7\u4ece Excel/Word \u590d\u5236\u8868\u683c\u540e\u7c98\u8d34\u3002' : 'Direct xlsx/docx parsing is not enabled in this browser build. Copy the table from Excel/Word and paste it here.',
    importCreated: zh ? '\u8868\u683c\u5b57\u6bb5\u548c\u6570\u636e\u96c6\u5df2\u751f\u6210' : 'Imported fields and datasets generated',
    sendFrameEditor: zh ? '\u53d1\u9001\u5e27\u7f16\u8f91\u5668' : 'Send Frame Editor',
    commandFrame: zh ? '\u547d\u4ee4\u5e27' : 'Command Frame',
    addCommand: zh ? '\u6dfb\u52a0\u547d\u4ee4' : 'Add Command',
    deleteCommand: zh ? '\u5220\u9664\u547d\u4ee4' : 'Delete Command',
    commandName: zh ? '\u547d\u4ee4\u540d\u79f0' : 'Command Name',
    autoLength: zh ? '\u81ea\u52a8\u957f\u5ea6' : 'Auto Length',
    autoChecksum: zh ? '\u81ea\u52a8\u6821\u9a8c' : 'Auto Checksum',
    checksumAppend: zh ? '\u504f\u79fb -1 \u8868\u793a\u81ea\u52a8\u8ffd\u52a0\u5230\u5e27\u5c3e\u524d' : 'Offset -1 appends before frame tail',
    commandParameters: zh ? '\u547d\u4ee4\u53c2\u6570' : 'Command Parameters',
    addParameter: zh ? '\u6dfb\u52a0\u53c2\u6570' : 'Add Parameter',
    paramName: zh ? '\u53c2\u6570\u540d' : 'Param Name',
    paramLabel: zh ? '\u63a7\u4ef6\u540d\u79f0' : 'Control Label',
    paramType: zh ? '\u53c2\u6570\u7c7b\u578b' : 'Param Type',
    paramValue: zh ? '\u9ed8\u8ba4\u503c' : 'Default Value',
    commandPreview: zh ? '\u7ec4\u5305 HEX \u9884\u89c8' : 'Packet HEX Preview',
    sendCommand: zh ? '\u4e00\u952e\u53d1\u9001\u547d\u4ee4' : 'Send Command',
    commandSent: zh ? '\u547d\u4ee4\u5e27\u5df2\u53d1\u9001' : 'Command frame sent',
    commandSendNeedsConnection: zh ? '\u8bf7\u5148\u8fde\u63a5\u8bbe\u5907\u6216\u7f51\u5173\u540e\u518d\u53d1\u9001' : 'Connect a device or gateway before sending',
    commandFrameHelp: zh
      ? '\u6309 JCom \u601d\u8def\u7ec4\u5305\uff1a\u5e27\u5934 + \u53c2\u6570\u63a7\u4ef6 + \u81ea\u52a8\u957f\u5ea6 + \u81ea\u52a8 CRC/SUM/XOR + \u5e27\u5c3e\u3002\u4fdd\u5b58\u540e\u5199\u5165 JSON \u7684 commandFrames\u3002'
      : 'JCom-style packet builder: header + parameter controls + auto length + auto CRC/SUM/XOR + tail. Saved into commandFrames.',
    receiveFormatEditor: zh ? '\u63a5\u6536\u89e3\u6790\u683c\u5f0f' : 'Receive Parser Format',
    receiveFormatHelp: zh
      ? '\u6309 JCom \u65b9\u5f0f\u6dfb\u52a0\u5b57\u6bb5\uff1a\u5de6\u4fa7\u662f\u5e27\u5b57\u6bb5\u987a\u5e8f\uff0c\u53f3\u4fa7\u7f16\u8f91\u5f53\u524d\u5b57\u6bb5\u7684\u5b57\u8282\u6570\u3001\u8f6c\u6362\u65b9\u5f0f\u3001\u540d\u79f0\u548c FIFO \u901a\u9053\u3002'
      : 'JCom-style receive format editor: add fields on top, edit field order on the left and byte/count/FIFO channel settings on the right.',
    byteCountSetting: zh ? '\u5b57\u8282\u6570\u8bbe\u7f6e' : 'Byte Count',
    dataTransform: zh ? '\u6570\u636e\u8f6c\u6362' : 'Data Transform',
    dataName: zh ? '\u6570\u636e\u540d\u79f0' : 'Data Name',
    fifoChannels: zh ? 'FIFO\u901a\u9053\u5b9a\u4e49' : 'FIFO Channels',
    channelName: zh ? '\u901a\u9053\u540d' : 'Channel',
    highByteFirst: zh ? '\u9ad8\u5728\u524d' : 'High First',
    calculateFormula: zh ? '\u8ba1\u7b97\u516c\u5f0f' : 'Formula',
    panelDisplay: zh ? '\u9762\u677f\u663e\u793a' : 'Panel Display',
    showPanel: zh ? '\u663e\u793a\u5230\u9762\u677f' : 'Show on Panel',
    fixedValueHex: zh ? '\u56fa\u5b9a\u503c/HEX' : 'Fixed / HEX',
    loadField: zh ? '\u52a0\u8f7d' : 'Load',
    channelArrange: zh ? 'FIFO/\u901a\u9053\u6392\u5217\u65b9\u5f0f' : 'FIFO / Channel Order',
    arrangeByChannel: zh ? '\u6309\u901a\u9053\u6392\u5217' : 'By Channel',
    arrangeByIndex: zh ? '\u6309\u7d22\u5f15\u6392\u5217' : 'By Index',
    arrangeHelp: zh ? '\u6392\u5217\u8bf4\u660e' : 'Order Help',
    generateParserAndApply: zh ? '\u751f\u6210\u89e3\u6790\u5668' : 'Generate Parser',
    addSendField: zh ? '\u6dfb\u52a0\u5b57\u6bb5' : 'Add Field',
    controlArea: zh ? '\u63a7\u4ef6\u533a' : 'Control Area',
    triggerSend: zh ? '\u63a7\u4ef6\u89e6\u53d1\u53d1\u9001' : 'Control Trigger Send',
    packetFieldList: zh ? '\u7ec4\u5305\u5b57\u6bb5' : 'Packet Fields',
    fieldValueHex: zh ? '\u5b57\u6bb5\u503c' : 'Field Value',
    checksumNames: {
      none: zh ? '\u65e0' : 'None',
      sum8: 'SUM8',
      sum16: 'SUM16',
      xor8: 'XOR8',
      crc8: 'CRC8',
      crc16modbus: 'CRC16 Modbus',
      crc16ccitt: 'CRC16 CCITT'
    },
    fieldKindNames: {
      byte: zh ? '\u666e\u901a BYTE \u5b57\u6bb5' : 'Byte Field',
      frameHeader: zh ? '\u5e27\u5934' : 'Frame Header',
      frameTail: zh ? '\u5e27\u5c3e' : 'Frame Tail',
      frameSequence: zh ? '\u5e27\u5e8f\u53f7' : 'Frame Sequence',
      frameId: zh ? '\u5e27 ID' : 'Frame ID',
      frameLength: zh ? '\u5e27\u957f\u5ea6' : 'Frame Length',
      fixedArray: zh ? '\u5b9a\u957f\u6570\u7ec4' : 'Fixed Array',
      variableArray: zh ? '\u53d8\u957f\u6570\u7ec4' : 'Variable Array',
      checksum: zh ? '\u6821\u9a8c' : 'Checksum'
    },
    arrayOrderNames: {
      channelFirst: zh ? '\u6309\u901a\u9053\u6392\u5217' : 'Channel First',
      interleaved: zh ? '\u6309\u91c7\u6837\u70b9\u4ea4\u9519' : 'Interleaved'
    },
    formulaTemplateNames: {
      raw: zh ? '\u539f\u59cb\u503c raw' : 'Raw value',
      linear: zh ? '\u7ebf\u6027\u6362\u7b97 raw * scale + offset' : 'Linear scale',
      adc24Voltage: zh ? '24bit ADC \u7535\u538b 2.5V' : '24-bit ADC voltage 2.5V',
      adc24Bipolar: zh ? '24bit ADC \u53cc\u6781\u6027 5V' : '24-bit ADC bipolar 5V',
      milliVolt: zh ? '\u6beb\u4f0f\u8f6c\u4f0f' : 'mV to V',
      pt100: zh ? 'PT100 \u6e29\u5ea6' : 'PT100 temperature',
      arrayOffset: zh ? '\u6570\u7ec4\u6263\u96f6\u70b9' : 'Array minus zero offset',
      custom: zh ? '\u4e0d\u5957\u7528' : 'Do not apply'
    },
    fftSettings: zh ? 'FFT \u8bbe\u7f6e' : 'FFT Settings',
    fftSampleRate: zh ? '\u56fa\u5b9a\u91c7\u6837\u7387 (Hz)' : 'Fixed Sample Rate (Hz)',
    fftSampleRateField: zh ? '\u91c7\u6837\u7387\u5b57\u6bb5' : 'Sample Rate Field',
    fftPoints: zh ? 'FFT \u70b9\u6570' : 'FFT Points',
    fftWindow: zh ? '\u7a97\u51fd\u6570' : 'Window',
    fftMagnitudeMode: zh ? '\u5e45\u503c\u663e\u793a' : 'Magnitude Display',
    fftAmplitudeUnit: zh ? '\u5e45\u503c\u5355\u4f4d' : 'Amplitude Unit',
    fftHelp: zh
      ? '\u91c7\u6837\u7387\u5b57\u6bb5\u4f18\u5148\u4e8e\u56fa\u5b9a\u91c7\u6837\u7387\uff1b\u586b\u5199\u540e FFT \u6a2a\u8f74\u5c06\u4ee5 Hz \u663e\u793a\u3002dB \u4e3a\u76f8\u5bf9 1 \u5355\u4f4d\u7684\u5e45\u503c\u3002'
      : 'Sample rate field overrides the fixed rate. With a rate, the FFT axis displays Hz. dB is relative to 1 amplitude unit.'
  };
}

export {
  cloneProject,
  getLabels,
  GROUP_WIDGETS,
  DATASET_WIDGETS,
  OPTION_LABELS_ZH,
  FRAME_DETECTIONS,
  PROTOCOL_FIELD_KINDS,
  FIELD_TYPES,
  COMMAND_FIELD_TYPES,
  BYTE_ORDERS,
  ARRAY_ORDERS,
  CHECKSUM_TYPES,
  FRAME_LENGTH_SIZES,
  FFT_POINTS,
  FFT_WINDOWS,
  FFT_MAGNITUDE_MODES,
  FORMULA_TEMPLATES,
  CALIBRATION_PRESETS,
  PROJECT_TEMPLATES,
  byteLengthForType,
  hexByteLength,
  fieldByteSize,
  fieldEndOffset,
  extendProtocolLabels
};
