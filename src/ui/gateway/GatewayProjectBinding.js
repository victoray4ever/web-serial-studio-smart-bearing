function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function safeParserId(sourceId) {
  const safe = String(sourceId || 'source').replace(/[^A-Za-z0-9_-]+/g, '-');
  return `parser-${safe || 'source'}`;
}

function parserCodeFrom(project, source, parser) {
  return String(
    source?.frameParserCode ||
    source?.frameParser ||
    parser?.frameParserCode ||
    parser?.frameParser ||
    parser?.code ||
    project?.frameParserCode ||
    project?.frameParser ||
    ''
  ).trim();
}

function parserDefinitionFrom(project, source = {}) {
  const parserKey = source.parser || source.parserId || source.frameParserId;
  const parser = parserKey && project.parsers && typeof project.parsers === 'object'
    ? project.parsers[parserKey]
    : null;
  const frameParserCode = parserCodeFrom(project, source, parser);
  if (!frameParserCode) {
    throw new Error('解析文件中没有可用的 frameParser。');
  }
  return {
    title: parser?.title || project.title || 'UDP Parser',
    protocol: source.protocol || parser?.protocol || project.protocol || 'Binary',
    frameStart: source.frameStart ?? parser?.frameStart ?? project.frameStart ?? '',
    frameEnd: source.frameEnd ?? parser?.frameEnd ?? project.frameEnd ?? '',
    frameDetection: source.frameDetection ?? parser?.frameDetection ?? project.frameDetection ?? 'StartAndEndDelimiter',
    hexadecimalDelimiters: source.hexadecimalDelimiters ?? parser?.hexadecimalDelimiters ?? project.hexadecimalDelimiters ?? true,
    frameParserLanguage: source.frameParserLanguage ?? parser?.frameParserLanguage ?? project.frameParserLanguage ?? 0,
    frameParserCode
  };
}

function datasetEntries(groups = []) {
  const entries = [];
  groups.forEach((group, groupIndex) => {
    (group.datasets || []).forEach((dataset, datasetIndex) => {
      entries.push({
        key: `${groupIndex}:${datasetIndex}`,
        groupIndex,
        datasetIndex,
        title: dataset.title || `Dataset ${datasetIndex + 1}`,
        units: dataset.units || ''
      });
    });
  });
  return entries;
}

export function analyzeGatewayParserProject(project, fileName = '') {
  if (!project || typeof project !== 'object') {
    throw new Error('解析文件不是有效的项目 JSON。');
  }
  const source = Array.isArray(project.sources) ? (project.sources[0] || {}) : {};
  const groups = Array.isArray(project.groups) ? clone(project.groups) : [];
  const datasets = datasetEntries(groups);
  if (!datasets.length) {
    throw new Error('解析文件中没有可用于仪表盘的数据集。');
  }
  return {
    fileName,
    parser: parserDefinitionFrom(project, source),
    groups,
    datasets
  };
}

export function boundGatewaySource(project, sourceId) {
  if (!project || !sourceId) return null;
  const source = (project.sources || []).find((item) => String(item.sourceId) === String(sourceId));
  if (!source) return null;
  const groups = (project.groups || [])
    .map((group) => ({
      ...clone(group),
      datasets: (group.datasets || []).filter((dataset) => String(dataset.sourceId ?? group.sourceId ?? '') === String(sourceId))
    }))
    .filter((group) => group.datasets.length > 0);
  if (!groups.length) return null;
  try {
    return {
      fileName: source.parserFileName || '',
      parser: parserDefinitionFrom(project, source),
      groups,
      datasets: datasetEntries(groups)
    };
  } catch (_error) {
    return null;
  }
}

function emptyCombinedProject() {
  return {
    title: 'UDP 联合仪表盘',
    protocol: 'Binary',
    separator: ',',
    frameStart: '',
    frameEnd: '',
    frameDetection: 'StartAndEndDelimiter',
    hexadecimalDelimiters: true,
    frameParser: '',
    frameParserCode: '',
    parsers: {},
    sources: [],
    sourceIdMap: [],
    groups: []
  };
}

function updateBySourceId(items, sourceId, value) {
  const index = items.findIndex((item) => String(item.sourceId) === String(sourceId));
  if (index >= 0) items[index] = { ...items[index], ...value };
  else items.push(value);
}

export function buildGatewayCombinedProject(baseProject, devices, bindings) {
  const project = baseProject ? clone(baseProject) : emptyCombinedProject();
  project.title = project.title || 'UDP 联合仪表盘';
  project.protocol = project.protocol || 'Binary';
  project.parsers = project.parsers && typeof project.parsers === 'object' ? project.parsers : {};
  project.sources = Array.isArray(project.sources) ? project.sources : [];
  project.sourceIdMap = Array.isArray(project.sourceIdMap) ? project.sourceIdMap : [];
  project.groups = Array.isArray(project.groups) ? project.groups : [];

  const bindingBySource = new Map(bindings.map((binding) => [String(binding.sourceId), binding]));
  devices.forEach((device) => {
    const sourceId = String(device.sourceId || '');
    if (!sourceId) return;
    const binding = bindingBySource.get(sourceId);
    const existing = project.sources.find((source) => String(source.sourceId) === sourceId) || {};
    const parserId = binding ? safeParserId(sourceId) : (existing.parser || existing.parserId || device.parserId || '');
    const parserFileName = binding?.analysis.fileName || existing.parserFileName || device.parserFileName || '';

    if (binding) project.parsers[parserId] = clone(binding.analysis.parser);
    updateBySourceId(project.sources, sourceId, {
      ...existing,
      sourceId,
      title: device.title || sourceId,
      ip: device.ip || '',
      udpPort: Number(device.port) || 0,
      ...(parserId ? { parser: parserId, parserId } : {}),
      parserFileName
    });
    updateBySourceId(project.sourceIdMap, sourceId, {
      sourceId,
      title: device.title || sourceId,
      ip: device.ip || '',
      udpPort: Number(device.port) || 0,
      parserId,
      parserFileName
    });

    if (!binding) return;
    project.groups = project.groups.filter((group) => String(group.importedSourceId || '') !== sourceId);
    const selected = new Set(binding.selectedKeys || []);
    binding.analysis.groups.forEach((group, groupIndex) => {
      const datasets = (group.datasets || []).flatMap((dataset, datasetIndex) => {
        if (!selected.has(`${groupIndex}:${datasetIndex}`)) return [];
        return [{
          ...clone(dataset),
          index: Number.isInteger(Number(dataset.index)) ? Number(dataset.index) : datasetIndex,
          sourceId,
          importedSourceId: sourceId,
          plot: true,
          graph: true,
          protocolGenerated: false
        }];
      });
      if (!datasets.length) return;
      project.groups.push({
        ...clone(group),
        title: `${device.title || sourceId} - ${group.title || `Group ${groupIndex + 1}`}`,
        sourceId,
        importedSourceId: sourceId,
        datasets
      });
    });
  });
  return project;
}
