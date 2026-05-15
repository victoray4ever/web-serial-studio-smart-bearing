let parseFn = null;

function loadParser(code) {
  const factory = new Function(`
    "use strict";
    ${code}
    return (typeof parse === "function") ? parse : null;
  `);
  parseFn = factory();
  if (typeof parseFn !== 'function') {
    throw new Error('Project frame parser must define function parse(frame) { ... }');
  }
}

function toNumberIfPossible(value) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return value;
  const n = Number(value.trim());
  return Number.isNaN(n) ? value : n;
}

function normalizeDataset(dataset) {
  if (Array.isArray(dataset)) {
    const buffer = dataset.map(toNumberIfPossible);
    return {
      value: buffer.length ? buffer[buffer.length - 1] : 0,
      buffer
    };
  }

  if (dataset && typeof dataset === 'object') {
    const normalized = { ...dataset };
    if (Array.isArray(normalized.buffer)) {
      normalized.buffer = normalized.buffer.map(toNumberIfPossible);
    }
    if (normalized.value === undefined && normalized.buffer?.length) {
      normalized.value = normalized.buffer[normalized.buffer.length - 1];
    }
    if (normalized.value !== undefined) {
      normalized.value = toNumberIfPossible(normalized.value);
    }
    return normalized;
  }

  return { value: toNumberIfPossible(dataset) };
}

function normalizeResult(result) {
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    if (Array.isArray(result.frames)) {
      return {
        frames: result.frames.map((frame) => normalizeResult(frame).frames).flat()
      };
    }

    if (Array.isArray(result.datasets)) {
      return {
        frames: [{
          ...result,
          datasets: result.datasets.map(normalizeDataset)
        }]
      };
    }
  }

  if (!Array.isArray(result)) {
    return { frames: [{ datasets: [normalizeDataset(result)] }] };
  }

  if (result.every((item) => Array.isArray(item))) {
    return {
      frames: result.map((frameValues) => ({
        datasets: frameValues.map(normalizeDataset)
      }))
    };
  }

  return {
    frames: [{
      datasets: result.map(normalizeDataset)
    }]
  };
}

self.onmessage = (event) => {
  const { type, id, code, frame } = event.data || {};

  try {
    if (type === 'load') {
      loadParser(code || '');
      self.postMessage({ type: 'loaded' });
      return;
    }

    if (type === 'parse') {
      if (typeof parseFn !== 'function') {
        loadParser(code || '');
      }

      const result = parseFn(frame);
      self.postMessage({
        type: 'parsed',
        id,
        result: normalizeResult(result)
      });
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      id,
      message: error?.message || String(error)
    });
  }
};
