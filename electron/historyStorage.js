const fs = require('fs');
const path = require('path');
const { dialog, ipcMain } = require('electron');

const FILE_MAGIC = Buffer.from('MEMSHIST');
const FILE_VERSION = 1;
const DEFAULT_MIN_FREE_BYTES = 1024 * 1024 * 1024;
const DEFAULT_MAX_FILE_BYTES = 512 * 1024 * 1024;
const MAX_PENDING_BYTES = 64 * 1024 * 1024;
const FLUSH_INTERVAL_MS = 500;
const SPACE_CHECK_INTERVAL_MS = 10000;

function safeName(value, fallback = 'session') {
  const cleaned = String(value || '')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/[. ]+$/g, '')
    .slice(0, 80);
  return cleaned || fallback;
}

function timestampName(date = new Date()) {
  const pad = (value, size = 2) => String(value).padStart(size, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '_',
    pad(date.getHours()),
    '-',
    pad(date.getMinutes()),
    '-',
    pad(date.getSeconds()),
    '-',
    pad(date.getMilliseconds(), 3)
  ].join('');
}

function headerBuffer() {
  const header = Buffer.alloc(FILE_MAGIC.length + 4);
  FILE_MAGIC.copy(header, 0);
  header.writeUInt16LE(FILE_VERSION, FILE_MAGIC.length);
  header.writeUInt16LE(0, FILE_MAGIC.length + 2);
  return header;
}

function payloadToBuffer(value) {
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (value instanceof ArrayBuffer) return Buffer.from(new Uint8Array(value));
  if (ArrayBuffer.isView(value)) return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  if (Array.isArray(value)) return Buffer.from(value);
  return Buffer.alloc(0);
}

function encodeRecord(record = {}) {
  const raw = payloadToBuffer(record.rawBytes);
  if (!raw.length) return null;

  const sourceId = Buffer.from(String(record.sourceId ?? ''), 'utf8').subarray(0, 0xFFFF);
  const topic = Buffer.from(String(record.topic ?? ''), 'utf8').subarray(0, 0xFFFF);
  const bodyLength = 16 + sourceId.length + topic.length + raw.length;
  const output = Buffer.allocUnsafe(4 + bodyLength);
  let offset = 0;

  output.writeUInt32LE(bodyLength, offset);
  offset += 4;
  output.writeBigInt64LE(BigInt(Math.max(0, Number(record.timestamp) || Date.now())), offset);
  offset += 8;
  output.writeUInt16LE(sourceId.length, offset);
  offset += 2;
  output.writeUInt16LE(topic.length, offset);
  offset += 2;
  output.writeUInt32LE(raw.length, offset);
  offset += 4;
  sourceId.copy(output, offset);
  offset += sourceId.length;
  topic.copy(output, offset);
  offset += topic.length;
  raw.copy(output, offset);
  return output;
}

class HistoryStorage {
  constructor({ getWindow, userDataPath }) {
    this._getWindow = getWindow;
    this._configPath = path.join(userDataPath, 'history-storage.json');
    this._config = {
      directoryPath: '',
      minFreeBytes: DEFAULT_MIN_FREE_BYTES,
      maxFileBytes: DEFAULT_MAX_FILE_BYTES
    };
    this._session = null;
    this._queue = [];
    this._pendingBytes = 0;
    this._flushTimer = null;
    this._flushPromise = Promise.resolve();
    this._lastSpaceCheckAt = 0;
    this._loadConfig();
  }

  getConfig() {
    return {
      ...this._config,
      active: !!this._session,
      sessionPath: this._session?.directoryPath || ''
    };
  }

  async chooseDirectory() {
    const parent = this._getWindow?.();
    const result = await dialog.showOpenDialog(parent && !parent.isDestroyed() ? parent : undefined, {
      title: '\u9009\u62e9\u5386\u53f2\u6570\u636e\u4fdd\u5b58\u76ee\u5f55',
      defaultPath: this._config.directoryPath || undefined,
      properties: ['openDirectory', 'createDirectory']
    });
    if (result.canceled || !result.filePaths?.[0]) return { canceled: true, ...this.getConfig() };

    const directoryPath = path.resolve(result.filePaths[0]);
    await this._validateDirectory(directoryPath);
    this._config.directoryPath = directoryPath;
    await this._saveConfig();
    this._notify({ type: 'config', directoryPath });
    return { canceled: false, ...this.getConfig() };
  }

  async startSession(metadata = {}) {
    await this.stopSession('replaced');
    const rootPath = this._config.directoryPath;
    if (!rootPath) {
      return this._reportStartError('\u672a\u9009\u62e9\u5386\u53f2\u6570\u636e\u4fdd\u5b58\u76ee\u5f55');
    }

    try {
      await this._validateDirectory(rootPath);
      await this._ensureFreeSpace(rootPath);

      const baseName = `${timestampName()}_${safeName(metadata.projectTitle || metadata.busType, 'acquisition')}`;
      let directoryPath = path.join(rootPath, baseName);
      let suffix = 1;
      while (fs.existsSync(directoryPath)) {
        directoryPath = path.join(rootPath, `${baseName}_${suffix}`);
        suffix += 1;
      }
      await fs.promises.mkdir(directoryPath, { recursive: false });

      this._session = {
        directoryPath,
        metadataPath: path.join(directoryPath, 'session.json'),
        metadata: {
          format: 'MEMS-CMS raw frame history',
          formatVersion: FILE_VERSION,
          recordLayout: 'uint32LE bodyLength, int64LE timestampMs, uint16LE sourceIdBytes, uint16LE topicBytes, uint32LE rawBytes, UTF-8 sourceId, UTF-8 topic, raw frame',
          status: 'active',
          startedAt: new Date().toISOString(),
          endedAt: null,
          reason: '',
          frameCount: 0,
          rawBytes: 0,
          fileCount: 0,
          ...metadata
        },
        fileHandle: null,
        fileIndex: 0,
        fileBytes: 0
      };
      await this._writeMetadata();
      await this._openNextFile();
      this._flushTimer = setInterval(() => this._scheduleFlush(), FLUSH_INTERVAL_MS);
      this._notify({
        type: 'started',
        directoryPath,
        message: `\u5386\u53f2\u6570\u636e\u6b63\u5728\u5199\u5165\uff1a${directoryPath}`
      });
      return { ok: true, ...this.getConfig() };
    } catch (error) {
      await this._closeFile();
      this._session = null;
      return this._reportStartError(error?.message || String(error));
    }
  }

  append(record) {
    if (!this._session) return;
    const encoded = encodeRecord(record);
    if (!encoded) return;
    this._queue.push(encoded);
    this._pendingBytes += encoded.length;

    if (this._pendingBytes > MAX_PENDING_BYTES) {
      this._failSession('\u78c1\u76d8\u5199\u5165\u901f\u5ea6\u4e0d\u8db3\uff0c\u5f85\u5199\u961f\u5217\u5df2\u8d85\u8fc764 MB');
    } else if (this._pendingBytes >= 1024 * 1024) {
      this._scheduleFlush();
    }
  }

  async stopSession(reason = 'disconnected') {
    if (!this._session) return { ok: true, active: false };
    if (this._flushTimer) clearInterval(this._flushTimer);
    this._flushTimer = null;

    await this._scheduleFlush();
    await this._flushPromise.catch(() => {});
    const session = this._session;
    await this._closeFile();
    if (session) {
      session.metadata.status = reason === 'storage-error' ? 'error' : 'completed';
      session.metadata.endedAt = new Date().toISOString();
      session.metadata.reason = reason;
      await this._writeMetadata(session).catch(() => {});
    }
    this._session = null;
    this._notify({ type: 'stopped', reason, directoryPath: session?.directoryPath || '' });
    return { ok: true, active: false };
  }

  async shutdown() {
    await this.stopSession('app-quit');
  }

  _loadConfig() {
    try {
      const parsed = JSON.parse(fs.readFileSync(this._configPath, 'utf8'));
      if (typeof parsed.directoryPath === 'string') this._config.directoryPath = parsed.directoryPath;
      if (Number.isFinite(parsed.minFreeBytes)) this._config.minFreeBytes = Math.max(64 * 1024 * 1024, parsed.minFreeBytes);
      if (Number.isFinite(parsed.maxFileBytes)) this._config.maxFileBytes = Math.max(16 * 1024 * 1024, parsed.maxFileBytes);
    } catch (_error) {
      // First run or an unreadable legacy configuration uses safe defaults.
    }
  }

  async _saveConfig() {
    await fs.promises.mkdir(path.dirname(this._configPath), { recursive: true });
    await fs.promises.writeFile(this._configPath, `${JSON.stringify(this._config, null, 2)}\n`, 'utf8');
  }

  async _validateDirectory(directoryPath) {
    const stat = await fs.promises.stat(directoryPath);
    if (!stat.isDirectory()) throw new Error('\u5386\u53f2\u6570\u636e\u4fdd\u5b58\u8def\u5f84\u4e0d\u662f\u6587\u4ef6\u5939');
    await fs.promises.access(directoryPath, fs.constants.W_OK);
  }

  async _ensureFreeSpace(directoryPath) {
    if (typeof fs.promises.statfs !== 'function') return;
    const stats = await fs.promises.statfs(directoryPath);
    const freeBytes = Number(stats.bavail) * Number(stats.bsize);
    if (freeBytes < this._config.minFreeBytes) {
      const freeMb = Math.max(0, freeBytes / 1024 / 1024).toFixed(0);
      throw new Error(`\u78c1\u76d8\u5269\u4f59\u7a7a\u95f4\u4e0d\u8db3\uff08${freeMb} MB\uff09\uff0c\u5df2\u505c\u6b62\u5386\u53f2\u6570\u636e\u5199\u5165`);
    }
    this._lastSpaceCheckAt = Date.now();
  }

  async _openNextFile() {
    if (!this._session) return;
    await this._closeFile();
    this._session.fileIndex += 1;
    const filename = `frames_${String(this._session.fileIndex).padStart(4, '0')}.bin`;
    this._session.fileHandle = await fs.promises.open(path.join(this._session.directoryPath, filename), 'wx');
    const header = headerBuffer();
    await this._session.fileHandle.write(header);
    this._session.fileBytes = header.length;
    this._session.metadata.fileCount = this._session.fileIndex;
  }

  async _closeFile() {
    const handle = this._session?.fileHandle;
    if (!handle) return;
    this._session.fileHandle = null;
    await handle.sync().catch(() => {});
    await handle.close().catch(() => {});
  }

  _scheduleFlush() {
    this._flushPromise = this._flushPromise
      .then(() => this._flush())
      .catch((error) => this._failSession(error?.message || String(error)));
    return this._flushPromise;
  }

  async _flush() {
    const session = this._session;
    if (!session || !this._queue.length) return;
    const records = this._queue.splice(0);
    const batchBytes = records.reduce((sum, item) => sum + item.length, 0);
    this._pendingBytes = Math.max(0, this._pendingBytes - batchBytes);
    const batch = Buffer.concat(records, batchBytes);

    if (Date.now() - this._lastSpaceCheckAt >= SPACE_CHECK_INTERVAL_MS) {
      await this._ensureFreeSpace(session.directoryPath);
    }
    if (session.fileBytes > headerBuffer().length
        && session.fileBytes + batch.length > this._config.maxFileBytes) {
      await this._openNextFile();
    }
    if (!session.fileHandle) throw new Error('\u5386\u53f2\u6570\u636e\u6587\u4ef6\u672a\u6253\u5f00');
    await session.fileHandle.write(batch);
    session.fileBytes += batch.length;
    session.metadata.frameCount += records.length;
    session.metadata.rawBytes += records.reduce((sum, item) => sum + item.readUInt32LE(16), 0);
    await this._writeMetadata();
  }

  async _writeMetadata(targetSession = this._session) {
    if (!targetSession) return;
    await fs.promises.writeFile(
      targetSession.metadataPath,
      `${JSON.stringify(targetSession.metadata, null, 2)}\n`,
      'utf8'
    );
  }

  _failSession(message) {
    if (!this._session) return;
    const session = this._session;
    if (this._flushTimer) clearInterval(this._flushTimer);
    this._flushTimer = null;
    this._queue.length = 0;
    this._pendingBytes = 0;
    this._session = null;
    session.metadata.status = 'error';
    session.metadata.endedAt = new Date().toISOString();
    session.metadata.reason = message;
    session.fileHandle?.close().catch(() => {});
    fs.promises.writeFile(session.metadataPath, `${JSON.stringify(session.metadata, null, 2)}\n`, 'utf8').catch(() => {});
    this._notify({
      type: 'error',
      code: 'storage-error',
      message: `${message}\u3002\u5b9e\u65f6\u6570\u636e\u63a5\u6536\u4e0d\u53d7\u5f71\u54cd\u3002`,
      directoryPath: session.directoryPath
    });
  }

  _reportStartError(message) {
    const payload = {
      ok: false,
      active: false,
      error: message,
      message: `${message}\u3002\u672c\u6b21\u4e0d\u4fdd\u5b58\u5386\u53f2\u6570\u636e\uff0c\u5b9e\u65f6\u63a5\u6536\u7ee7\u7eed\u8fd0\u884c\u3002`
    };
    this._notify({ type: 'error', code: 'start-error', ...payload });
    return payload;
  }

  _notify(payload) {
    const win = this._getWindow?.();
    if (win && !win.isDestroyed()) win.webContents.send('history-storage:status', payload);
  }
}

function setupHistoryStorageIpc(options) {
  const storage = new HistoryStorage(options);
  ipcMain.handle('history-storage:get-config', () => storage.getConfig());
  ipcMain.handle('history-storage:choose-directory', () => storage.chooseDirectory());
  ipcMain.handle('history-storage:start', (_event, metadata) => storage.startSession(metadata));
  ipcMain.handle('history-storage:stop', (_event, reason) => storage.stopSession(reason));
  ipcMain.on('history-storage:append', (_event, record) => storage.append(record));
  return storage;
}

module.exports = { HistoryStorage, setupHistoryStorageIpc };
