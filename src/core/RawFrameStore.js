const DEFAULT_MAX_BYTES = 64 * 1024 * 1024;
const DEFAULT_MAX_FRAMES = 5000;

function isByteArray(value) {
  return value instanceof Uint8Array || ArrayBuffer.isView(value);
}

function hexStringToBytes(value) {
  const text = String(value || '').trim();
  if (!text) return null;

  const withoutPrefixes = text.replace(/0x/gi, '');
  if (!/^[0-9a-fA-F\s,;:_-]+$/.test(withoutPrefixes)) return null;
  const clean = withoutPrefixes.replace(/[^0-9a-fA-F]/g, '');
  if (!clean || clean.length % 2 !== 0) return null;

  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = Number.parseInt(clean.slice(i, i + 2), 16);
  }
  return bytes;
}

export function rawValueToBytes(value) {
  if (value == null || value === '') return new Uint8Array(0);
  if (value instanceof Uint8Array) return value;
  if (isByteArray(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (Array.isArray(value)) return Uint8Array.from(value, (item) => Number(item) & 0xFF);

  const hexBytes = hexStringToBytes(value);
  return hexBytes || new TextEncoder().encode(String(value));
}

export function bytesToHex(bytes) {
  if (!bytes?.length) return '';
  const parts = new Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) {
    parts[i] = bytes[i].toString(16).padStart(2, '0').toUpperCase();
  }
  return parts.join(' ');
}

function datasetKey(dataset, fallbackIndex) {
  const index = Number.isInteger(Number(dataset?.index)) ? Number(dataset.index) : fallbackIndex;
  return String(index);
}

export class RawFrameStore {
  constructor({ maxBytes = DEFAULT_MAX_BYTES, maxFrames = DEFAULT_MAX_FRAMES } = {}) {
    this.maxBytes = Math.max(1024 * 1024, Number(maxBytes) || DEFAULT_MAX_BYTES);
    this.maxFrames = Math.max(100, Number(maxFrames) || DEFAULT_MAX_FRAMES);
    this._entries = new Map();
    this._order = [];
    this._orderHead = 0;
    this._nextId = 0;
    this._totalBytes = 0;
    this._frameIds = new WeakMap();
  }

  ensureFrame(frame = {}) {
    if (!frame || typeof frame !== 'object') return null;
    const existingId = frame.rawFrameId ?? this._frameIds.get(frame);
    if (existingId != null && this._entries.has(existingId)) return existingId;

    const bytes = rawValueToBytes(frame.rawBytes ?? frame.raw);
    if (!bytes.length) return existingId ?? null;

    const id = ++this._nextId;
    const fields = new Map();
    let fieldBytes = 0;
    (frame.datasets || []).forEach((dataset, index) => {
      if (!dataset) return;
      const key = datasetKey(dataset, index);
      const range = dataset.rawRange;
      if (range && Number.isFinite(Number(range.offset)) && Number.isFinite(Number(range.length))) {
        fields.set(key, {
          offset: Math.max(0, Number(range.offset) || 0),
          length: Math.max(0, Number(range.length) || 0)
        });
      } else {
        const value = dataset.rawBytes ?? dataset.rawHex ?? dataset.raw;
        const datasetBytes = rawValueToBytes(value);
        if (datasetBytes.length) {
          fields.set(key, { bytes: datasetBytes });
          fieldBytes += datasetBytes.byteLength;
        }
      }
      const storedField = fields.get(key);
      if (dataset.sourceField && storedField) {
        fields.set(`field:${dataset.sourceField}`, storedField);
      }
    });

    const entry = {
      id,
      timestamp: Number(frame.timestamp) || Date.now(),
      sourceId: frame.sourceId || '',
      topic: frame.topic || '',
      bytes,
      fields,
      byteLength: bytes.byteLength + fieldBytes
    };
    this._entries.set(id, entry);
    this._order.push(id);
    this._totalBytes += entry.byteLength;
    this._frameIds.set(frame, id);
    frame.rawFrameId = id;
    this._evict();
    return id;
  }

  get(id) {
    return this._entries.get(id) || null;
  }

  getDatasetBytes(id, datasetIndex, sourceField = '') {
    const entry = this.get(id);
    if (!entry) return null;
    const field = entry.fields.get(String(datasetIndex))
      || (sourceField ? entry.fields.get(`field:${sourceField}`) : null);
    if (!field) return entry.bytes;
    if (field.bytes) return field.bytes;
    const start = Math.min(entry.bytes.length, field.offset);
    const end = Math.min(entry.bytes.length, start + field.length);
    return entry.bytes.subarray(start, end);
  }

  toHex(id, datasetIndex, sourceField = '') {
    return bytesToHex(this.getDatasetBytes(id, datasetIndex, sourceField));
  }

  clear() {
    this._entries.clear();
    this._order.length = 0;
    this._orderHead = 0;
    this._totalBytes = 0;
    this._frameIds = new WeakMap();
  }

  get stats() {
    return { frames: this._entries.size, bytes: this._totalBytes };
  }

  _evict() {
    while (this._entries.size > this.maxFrames || this._totalBytes > this.maxBytes) {
      const id = this._order[this._orderHead];
      this._orderHead += 1;
      const entry = this._entries.get(id);
      if (!entry) continue;
      this._entries.delete(id);
      this._totalBytes -= entry.byteLength;
    }

    if (this._orderHead > 1024 && this._orderHead * 2 > this._order.length) {
      this._order = this._order.slice(this._orderHead);
      this._orderHead = 0;
    }
  }
}

export const rawFrameStore = new RawFrameStore();
