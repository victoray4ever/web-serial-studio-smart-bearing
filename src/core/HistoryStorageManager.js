import { eventBus } from './EventBus.js';
import { appState, ConnectionState } from './AppState.js';

class HistoryStorageManager {
  constructor() {
    this._api = window.memsCmsDesktop?.historyStorage || null;
    this._directoryPath = '';
    this._sessionPath = '';
    this._active = false;
    this._initialized = false;
    this._initializing = null;
    this._starting = null;
    this._lastErrorMessage = '';
    this._errorMessage = '';

    this._unsubscribeStatus = this._api?.onStatus?.((status) => this._handleStatus(status));
    eventBus.on('state:connectionStateChanged', (state) => {
      if (state === ConnectionState.Connected) {
        this.start().catch((error) => this._showError(error?.message || error));
      } else if (state === ConnectionState.Disconnected || state === ConnectionState.Error) {
        this.stop(state.toLowerCase()).catch(() => {});
      }
    });
    eventBus.on('state:historyStorageChanged', (enabled) => {
      if (enabled && appState.isConnected) {
        this.start().catch((error) => this._showError(error?.message || error));
      } else if (!enabled) {
        this._errorMessage = '';
        this._lastErrorMessage = '';
        this.stop('disabled').catch(() => {});
      }
      this._emitStatus();
    });
    eventBus.on('frame:received', (frame) => this._appendFrame(frame));
    this.initialize().catch(() => {});
  }

  get supported() { return !!this._api; }
  get enabled() { return appState.historyStorageEnabled; }
  get directoryPath() { return this._directoryPath; }
  get sessionPath() { return this._sessionPath; }
  get active() { return this._active; }
  get errorMessage() { return this._errorMessage; }

  async initialize() {
    if (this._initialized) return this.status;
    if (this._initializing) return this._initializing;
    this._initializing = (async () => {
      if (this._api) {
        const config = await this._api.getConfig();
        this._directoryPath = config?.directoryPath || '';
        this._sessionPath = config?.sessionPath || '';
        this._active = !!config?.active;
      }
      this._initialized = true;
      this._emitStatus();
      return this.status;
    })().finally(() => {
      this._initializing = null;
    });
    return this._initializing;
  }

  get status() {
    return {
      supported: this.supported,
      enabled: this.enabled,
      active: this.active,
      directoryPath: this.directoryPath,
      sessionPath: this.sessionPath,
      errorMessage: this.errorMessage
    };
  }

  async chooseDirectory() {
    if (!this._api) throw new Error('\u5386\u53f2\u6570\u636e\u5b58\u50a8\u4ec5\u5728\u684c\u9762\u7248\u4e2d\u53ef\u7528');
    await this.initialize();
    const wasActive = this._active;
    const result = await this._api.chooseDirectory();
    if (result?.canceled) return false;
    this._directoryPath = result?.directoryPath || '';
    this._errorMessage = '';
    this._lastErrorMessage = '';
    if (wasActive) {
      await this.stop('directory-changed');
      if (appState.historyStorageEnabled && appState.isConnected) await this.start();
    }
    this._emitStatus();
    return true;
  }

  async start() {
    if (!appState.historyStorageEnabled || !appState.isConnected || this._active) return false;
    if (this._starting) return this._starting;
    this._starting = (async () => {
      await this.initialize();
      if (!this._api) {
        this._showError('\u5386\u53f2\u6570\u636e\u5b58\u50a8\u4ec5\u5728\u684c\u9762\u7248\u4e2d\u53ef\u7528');
        return false;
      }
      const result = await this._api.start({
        projectTitle: appState.projectFileName || appState.project?.title || '',
        busType: appState.busType,
        operationMode: appState.operationMode,
        sourceCount: Array.isArray(appState.project?.sources) ? appState.project.sources.length : 0
      });
      this._active = !!result?.ok;
      this._sessionPath = result?.sessionPath || '';
      if (result?.ok) this._errorMessage = '';
      if (!result?.ok && result?.message) this._showError(result.message);
      this._emitStatus();
      return this._active;
    })().finally(() => {
      this._starting = null;
    });
    return this._starting;
  }

  async stop(reason = 'disconnected') {
    if (this._starting) await this._starting.catch(() => {});
    if (!this._api || !this._active) return false;
    this._active = false;
    await this._api.stop(reason);
    this._sessionPath = '';
    this._emitStatus();
    return true;
  }

  _appendFrame(frame) {
    if (!this._active || !this._api || !frame?.rawBytes?.length) return;
    this._api.append({
      timestamp: Number(frame.timestamp) || Date.now(),
      sourceId: frame.sourceId ?? '',
      topic: frame.topic || '',
      rawBytes: frame.rawBytes
    });
  }

  _handleStatus(status = {}) {
    if (status.directoryPath) this._directoryPath = status.directoryPath;
    if (status.type === 'started') {
      this._active = true;
      this._sessionPath = status.directoryPath || '';
      this._lastErrorMessage = '';
      this._errorMessage = '';
      eventBus.emit('toast', {
        type: 'success',
        message: status.message || '\u5386\u53f2\u6570\u636e\u5b58\u50a8\u5df2\u542f\u52a8'
      });
    } else if (status.type === 'stopped') {
      this._active = false;
      this._sessionPath = '';
    } else if (status.type === 'error') {
      this._active = false;
      this._sessionPath = '';
      this._errorMessage = status.message || status.error || '\u5386\u53f2\u6570\u636e\u5199\u5165\u5931\u8d25';
      this._showError(status.message || status.error || '\u5386\u53f2\u6570\u636e\u5199\u5165\u5931\u8d25');
    }
    this._emitStatus();
  }

  _showError(message) {
    const text = String(message || '');
    if (!text || text === this._lastErrorMessage) return;
    this._lastErrorMessage = text;
    this._errorMessage = text;
    eventBus.emit('toast', { type: 'error', message: text, duration: 12000 });
  }

  _emitStatus() {
    eventBus.emit('history-storage:statusChanged', this.status);
  }
}

export const historyStorageManager = new HistoryStorageManager();
