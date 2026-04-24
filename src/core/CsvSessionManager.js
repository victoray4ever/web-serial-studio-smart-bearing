import { eventBus } from './EventBus.js';
import { appState, ConnectionState } from './AppState.js';
import { modeLabel, t } from './i18n.js?v=csv-autosave-20260424-1';

function escapeCsvCell(value) {
  const text = value == null ? '' : String(value);
  if (!/[",\r\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(headers, rows) {
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(','))
  ];
  return lines.join('\n');
}

function timestampForFile(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}-${String(date.getMilliseconds()).padStart(3, '0')}`;
}

async function ensureDirectoryPermission(handle) {
  if (!handle) return false;
  const opts = { mode: 'readwrite' };
  if (await handle.queryPermission(opts) === 'granted') return true;
  return (await handle.requestPermission(opts)) === 'granted';
}

class CsvSessionManager {
  constructor() {
    this._activeSession = null;
    this._lastCompletedSession = null;
    this._directoryHandle = null;
    this._lastKnownState = appState.connectionState;

    eventBus.on('frame:received', (frame) => this._onFrame(frame));
    eventBus.on('state:connectionStateChanged', (state) => {
      this._handleConnectionStateChange(state).catch((error) => {
        console.error('CSV auto-save failed:', error);
        eventBus.emit('toast', { type: 'error', message: t('messages.csvSaveFailed', { error: error.message || error }) });
      });
    });
  }

  get hasData() {
    return !!(this._activeSession?.rows.length || this._lastCompletedSession?.rows.length);
  }

  get targetLabel() {
    return this._directoryHandle?.name || '';
  }

  get targetSummary() {
    if (this._directoryHandle?.name) {
      return t('sidebar.csvTargetFolder', { name: this._directoryHandle.name });
    }
    return t('sidebar.csvTargetDownloads');
  }

  async pickSaveDirectory() {
    if (typeof window.showDirectoryPicker !== 'function') {
      eventBus.emit('toast', { type: 'warning', message: t('messages.csvDirectoryUnsupported') });
      return false;
    }

    const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    if (!handle) return false;

    const granted = await ensureDirectoryPermission(handle);
    if (!granted) {
      eventBus.emit('toast', { type: 'warning', message: t('messages.csvDirectoryPermissionDenied') });
      return false;
    }

    this._directoryHandle = handle;
    eventBus.emit('csv:targetChanged', { type: 'directory', label: this.targetSummary });
    eventBus.emit('toast', { type: 'success', message: t('messages.csvPathSelected', { name: handle.name }) });
    return true;
  }

  async exportLatest(options = {}) {
    const { promptIfNeeded = true } = options;
    const session = this._activeSession?.rows.length ? this._cloneSession(this._activeSession) : this._lastCompletedSession;

    if (!session?.rows.length) {
      eventBus.emit('toast', { type: 'warning', message: t('messages.csvNoData') });
      return false;
    }

    const result = await this._persistSession(session, { promptIfNeeded, reason: 'manual' });
    return result.ok;
  }

  _onFrame(frame) {
    if (!appState.csvExportEnabled || !frame?.datasets?.length) return;

    if (!this._activeSession) {
      const headers = ['Timestamp', ...frame.datasets.map((d) => d.title || `Ch${d.index + 1}`)];
      this._activeSession = {
        startedAt: new Date(),
        headers,
        rows: [],
        bus: appState.busType,
        mode: appState.operationMode,
        project: appState.projectFileName || appState.project?.title || ''
      };
    }

    this._activeSession.rows.push([
      new Date().toISOString(),
      ...frame.datasets.map((d) => d.value)
    ]);
  }

  async _handleConnectionStateChange(state) {
    const previous = this._lastKnownState;
    this._lastKnownState = state;

    if (state === ConnectionState.Disconnected && previous !== ConnectionState.Disconnected) {
      await this._finalizeActiveSession();
    }
  }

  async _finalizeActiveSession() {
    if (!this._activeSession?.rows.length) {
      this._activeSession = null;
      return;
    }

    const session = {
      ...this._activeSession,
      endedAt: new Date()
    };

    this._lastCompletedSession = session;
    this._activeSession = null;

    await this._persistSession(session, { promptIfNeeded: false, reason: 'disconnect' });
  }

  async _persistSession(session, options = {}) {
    const { promptIfNeeded = false, reason = 'manual' } = options;
    const csv = toCsv(session.headers, session.rows);
    const filename = this._buildFileName(session);

    if (this._directoryHandle) {
      try {
        const granted = await ensureDirectoryPermission(this._directoryHandle);
        if (!granted) {
          eventBus.emit('toast', { type: 'warning', message: t('messages.csvDirectoryPermissionDenied') });
        } else {
          const fileHandle = await this._directoryHandle.getFileHandle(filename, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(csv);
          await writable.close();
          eventBus.emit('toast', {
            type: 'success',
            message: reason === 'disconnect'
              ? t('messages.csvAutoSaved', { file: filename })
              : t('messages.csvSavedTo', { file: filename })
          });
          return { ok: true, method: 'directory', filename };
        }
      } catch (error) {
        console.warn('CSV directory save failed, falling back to download:', error);
      }
    }

    if (promptIfNeeded && typeof window.showSaveFilePicker === 'function') {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{
            description: 'CSV Files',
            accept: { 'text/csv': ['.csv'] }
          }]
        });
        const writable = await handle.createWritable();
        await writable.write(csv);
        await writable.close();
        eventBus.emit('toast', { type: 'success', message: t('messages.csvSavedTo', { file: filename }) });
        return { ok: true, method: 'save-picker', filename };
      } catch (error) {
        if (error?.name === 'AbortError') return { ok: false, method: 'cancelled' };
        console.warn('CSV save picker failed, falling back to download:', error);
      }
    }

    this._downloadCsv(csv, filename);
    eventBus.emit('toast', {
      type: 'success',
      message: reason === 'disconnect'
        ? t('messages.csvAutoDownloaded', { file: filename })
        : t('messages.csvExported')
    });
    return { ok: true, method: 'download', filename };
  }

  _downloadCsv(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  _buildFileName(session) {
    const parts = [
      'serial-studio',
      session.project || modeLabel(session.mode, 'en').replace(/\s+/g, '-').toLowerCase(),
      String(session.bus || 'bus').toLowerCase(),
      timestampForFile(session.endedAt || session.startedAt || new Date())
    ];
    return `${parts.filter(Boolean).join('_')}.csv`;
  }

  _cloneSession(session) {
    return {
      ...session,
      headers: [...session.headers],
      rows: session.rows.map((row) => [...row]),
      endedAt: new Date()
    };
  }
}

export const csvSessionManager = new CsvSessionManager();
