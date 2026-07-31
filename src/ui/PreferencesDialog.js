/**
 * PreferencesDialog - Application preferences modal
 */
import { eventBus } from '../core/EventBus.js';
import { appState } from '../core/AppState.js';
import { applyTheme, t } from '../core/i18n.js?v=mems-cms-brand-20260525-2';
import { csvSessionManager } from '../core/CsvSessionManager.js';
import { historyStorageManager } from '../core/HistoryStorageManager.js';

export class PreferencesDialog {
  constructor(modalRoot) {
    this._root = modalRoot;
    this._el = null;
    eventBus.on('ui:openPreferences', () => this.open());
    eventBus.on('history-storage:statusChanged', () => this._refreshHistoryStorageUi());
  }

  open() {
    if (this._el) this.close();
    const zh = appState.locale === 'zh-CN';
    const isDesktop = !!window.memsCmsDesktop?.update;
    const historySupported = historyStorageManager.supported;
    const historyTitle = zh ? '\u5386\u53f2\u6570\u636e\u5b58\u50a8' : 'Historical Data Storage';
    const historyEnable = zh ? '\u542f\u7528\u5386\u53f2\u6570\u636e\u5b58\u50a8' : 'Enable historical data storage';
    const historyChoose = zh ? '\u9009\u62e9\u4fdd\u5b58\u76ee\u5f55' : 'Choose Storage Folder';
    const checkUpdateText = zh ? '\u68c0\u67e5\u66f4\u65b0' : 'Check for Updates';
    const checkingUpdateText = zh ? '\u6b63\u5728\u68c0\u67e5\u66f4\u65b0...' : 'Checking for updates...';
    const appVersion = window.memsCmsDesktop?.app?.version || (zh ? '开发版' : 'Development');

    this._el = document.createElement('div');
    this._el.className = 'modal-overlay animate-fadeIn';
    this._el.innerHTML = `
      <div class="modal" style="max-width:620px">
        <div class="modal-header">
          <div class="modal-title">${t('preferences.title')}</div>
          <button class="btn btn-icon" id="pref-close" style="font-size:18px">X</button>
        </div>
        <div class="modal-body">
          <div class="editor-form-section" style="margin-bottom:20px">
            <div class="editor-form-section-title">${t('preferences.display')}</div>
            <div class="editor-form-grid">
              <div class="form-row">
                <div class="form-label">${t('common.language')}</div>
                <select class="form-select" id="pref-language">
                  <option value="zh-CN" ${appState.locale === 'zh-CN' ? 'selected' : ''}>${t('common.chinese')}</option>
                  <option value="en" ${appState.locale === 'en' ? 'selected' : ''}>${t('common.english')}</option>
                </select>
              </div>
              <div class="form-row">
                <div class="form-label">${t('common.theme')}</div>
                <select class="form-select" id="pref-theme">
                  <option value="light" ${appState.theme === 'light' ? 'selected' : ''}>${t('common.lightTheme')}</option>
                  <option value="dark" ${appState.theme === 'dark' ? 'selected' : ''}>${t('common.darkTheme')}</option>
                </select>
              </div>
            </div>
          </div>

          <div class="editor-form-section" style="margin-bottom:20px">
            <div class="editor-form-section-title">${t('preferences.dataExport')}</div>
            <div style="display:flex;flex-direction:column;gap:8px">
              <label class="checkbox-wrap">
                <input type="checkbox" id="pref-csv" ${appState.csvExportEnabled ? 'checked' : ''}>
                <span>${t('preferences.autoExportCsv')}</span>
              </label>
              <label class="checkbox-wrap">
                <input type="checkbox" id="pref-console-log" ${appState.consoleExportEnabled ? 'checked' : ''}>
                <span>${t('preferences.exportConsoleLog')}</span>
              </label>
              <button class="btn" id="pref-csv-path">${t('preferences.chooseCsvPath')}</button>
              <div style="font-size:12px;color:var(--text-muted)" id="pref-csv-target">${csvSessionManager.targetSummary}</div>
            </div>
          </div>

          <div class="editor-form-section" style="margin-bottom:20px">
            <div class="editor-form-section-title">${historyTitle}</div>
            <div style="display:flex;flex-direction:column;gap:9px">
              <label class="checkbox-wrap">
                <input type="checkbox" id="pref-history-enabled" ${appState.historyStorageEnabled ? 'checked' : ''} ${historySupported ? '' : 'disabled'}>
                <span>${historyEnable}</span>
              </label>
              <div style="display:flex;gap:8px;align-items:center">
                <button class="btn" id="pref-history-path" ${historySupported ? '' : 'disabled'}>${historyChoose}</button>
                <span id="pref-history-state" style="font-size:12px;color:var(--text-muted)"></span>
              </div>
              <div id="pref-history-target" style="font-size:12px;color:var(--text-muted);word-break:break-all"></div>
              <div style="font-size:12px;color:var(--text-muted);line-height:1.55">
                ${zh
                  ? '\u52fe\u9009\u540e\uff0c\u6bcf\u6b21\u8fde\u63a5\u4f1a\u81ea\u52a8\u521b\u5efa\u72ec\u7acb\u5b50\u76ee\u5f55\u5e76\u6301\u7eed\u5199\u5165\u539f\u59cb\u5e27\u3002\u8def\u5f84\u5931\u6548\u6216\u7a7a\u95f4\u4e0d\u8db3\u65f6\u53ea\u505c\u6b62\u5199\u76d8\uff0c\u4e0d\u4e2d\u65ad\u5b9e\u65f6\u63a5\u6536\u3002'
                  : 'When enabled, each connection creates its own folder and continuously writes raw frames. A missing drive or low disk space stops storage without interrupting live reception.'}
              </div>
            </div>
          </div>

          <div class="editor-form-section">
            <div class="editor-form-section-title">${t('preferences.about')}</div>
            <div style="font-size:13px;color:var(--text-muted);line-height:1.75">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
                <img src="src/assets/cms-icon.png" alt="MEMS-CMS" style="width:42px;height:42px;border-radius:10px;box-shadow:0 4px 14px rgba(15,23,42,.12)">
                <div>
                  <div><strong style="color:var(--text-primary);font-size:15px">MEMS-CMS</strong> <span style="color:var(--text-muted)">v${appVersion}</span></div>
                  <div>${zh ? 'MEMS 实验室状态监测上位机系统' : 'MEMS Condition Monitoring System desktop application'}</div>
                </div>
              </div>
              <div>${zh ? '用于轴承、轴瓦、齿轮箱等实验设备的数据接入、协议解析、实时绘图、FFT 分析和数据导出。' : 'A desktop monitoring system for device data acquisition, protocol parsing, real-time plotting, FFT analysis and data export.'}</div>
              <div style="margin-top:8px">${zh ? '通信方式：串口、WebSocket、MQTT、UDP。' : 'Interfaces: Serial, WebSocket, MQTT and UDP.'}</div>
              <div>${zh ? '解析方式：快速绘图、设备 JSON、项目 JSON、完整帧协议字段解析。' : 'Parsing modes: Quick Plot, Device JSON, Project JSON and full-frame protocol field parsing.'}</div>
              <div>${zh ? '显示控件：折线图、仪表、柱状图、FFT、数据表格及命令交互。' : 'Widgets: Plot, Gauge, Bar, FFT, DataGrid and command interaction.'}</div>
              <div style="margin-top:8px;color:var(--text-muted)">
                <strong>${zh ? 'UDP 网关：' : 'UDP Gateway: '}</strong>${zh ? '桌面版内置 Node.js UDP 网关，无需额外 Python 环境。' : 'The desktop build includes a Node.js UDP gateway and does not require Python.'}<br>
                <strong>${zh ? '项目文件：' : 'Project Files: '}</strong>${zh ? '加载 .json 文件即可定义解析字段、换算公式和仪表盘布局。' : 'Load .json files to define fields, formulas and dashboard layouts.'}
              </div>
            </div>
          </div>
        </div>
        ${isDesktop ? `<div class="editor-form-section" style="margin:0 24px 16px"><button class="btn" id="pref-check-update">${checkUpdateText}</button></div>` : ''}
        <div class="modal-footer">
          <button class="btn" id="pref-reset">${t('common.reset')}</button>
          <button class="btn btn-primary" id="pref-save">${t('preferences.saveClose')}</button>
        </div>
      </div>`;

    this._root.appendChild(this._el);
    historyStorageManager.initialize()
      .then(() => this._refreshHistoryStorageUi())
      .catch(() => this._refreshHistoryStorageUi());
    this._refreshHistoryStorageUi();

    this._el.addEventListener('click', (e) => { if (e.target === this._el) this.close(); });
    this._el.querySelector('#pref-close').addEventListener('click', () => this.close());
    this._el.querySelector('#pref-csv-path')?.addEventListener('click', async () => {
      try {
        const changed = await csvSessionManager.pickSaveDirectory();
        if (changed) {
          const target = this._el?.querySelector('#pref-csv-target');
          if (target) target.textContent = csvSessionManager.targetSummary;
        }
      } catch (error) {
        if (error?.name !== 'AbortError') {
          eventBus.emit('toast', { type: 'error', message: t('messages.csvSaveFailed', { error: error.message || error }) });
        }
      }
    });
    this._el.querySelector('#pref-history-path')?.addEventListener('click', async () => {
      try {
        await historyStorageManager.chooseDirectory();
        this._refreshHistoryStorageUi();
      } catch (error) {
        if (error?.name !== 'AbortError') {
          eventBus.emit('toast', {
            type: 'error',
            message: `${zh ? '\u65e0\u6cd5\u8bbe\u7f6e\u5386\u53f2\u6570\u636e\u76ee\u5f55' : 'Could not set historical data folder'}: ${error?.message || error}`
          });
        }
      }
    });

    this._el.querySelector('#pref-check-update')?.addEventListener('click', async (event) => {
      const button = event.currentTarget;
      const oldText = button.textContent;
      button.disabled = true;
      button.textContent = checkingUpdateText;
      try {
        await window.memsCmsDesktop.update.check();
      } catch (error) {
        eventBus.emit('toast', { type: 'error', message: error?.message || String(error) });
      } finally {
        button.disabled = false;
        button.textContent = oldText;
      }
    });

    this._el.querySelector('#pref-reset').addEventListener('click', () => {
      appState.locale = 'zh-CN';
      appState.theme = 'light';
      appState.csvExportEnabled = true;
      appState.consoleExportEnabled = false;
      appState.historyStorageEnabled = false;
      applyTheme();
      this.close();
      eventBus.emit('toast', { type: 'info', message: t('preferences.resetSuccess') });
      window.location.reload();
    });

    this._el.querySelector('#pref-save').addEventListener('click', () => {
      const nextLocale = this._el.querySelector('#pref-language')?.value || 'zh-CN';
      const nextTheme = this._el.querySelector('#pref-theme')?.value || 'light';
      const requiresReload = nextLocale !== appState.locale || nextTheme !== appState.theme;

      appState.locale = nextLocale;
      appState.theme = nextTheme;

      appState.csvExportEnabled = this._el.querySelector('#pref-csv')?.checked ?? true;
      appState.consoleExportEnabled = this._el.querySelector('#pref-console-log')?.checked ?? false;
      appState.historyStorageEnabled = this._el.querySelector('#pref-history-enabled')?.checked ?? false;
      if (appState.historyStorageEnabled && !historyStorageManager.directoryPath) {
        eventBus.emit('toast', {
          type: 'warning',
          message: nextLocale === 'zh-CN'
            ? '\u5df2\u542f\u7528\u5386\u53f2\u6570\u636e\u5b58\u50a8\uff0c\u8bf7\u5148\u9009\u62e9\u4fdd\u5b58\u76ee\u5f55'
            : 'Historical data storage is enabled; choose a storage folder before connecting.'
        });
      }

      applyTheme();
      eventBus.emit('toast', { type: 'success', message: requiresReload ? t('preferences.reloadNotice') : t('preferences.saveSuccess') });
      this.close();

      if (requiresReload) {
        setTimeout(() => window.location.reload(), 250);
      }
    });
  }

  close() {
    if (this._el) {
      this._el.remove();
      this._el = null;
    }
  }

  _refreshHistoryStorageUi() {
    if (!this._el) return;
    const zh = appState.locale === 'zh-CN';
    const target = this._el.querySelector('#pref-history-target');
    const state = this._el.querySelector('#pref-history-state');
    if (target) {
      target.textContent = historyStorageManager.directoryPath
        ? `${zh ? '\u4fdd\u5b58\u8def\u5f84' : 'Storage path'}: ${historyStorageManager.directoryPath}`
        : (zh ? '\u5c1a\u672a\u9009\u62e9\u4fdd\u5b58\u76ee\u5f55' : 'No storage folder selected');
    }
    if (state) {
      if (!historyStorageManager.supported) {
        state.textContent = zh ? '\u4ec5\u684c\u9762\u7248\u53ef\u7528' : 'Desktop app only';
        state.style.color = 'var(--color-warning, #f59e0b)';
      } else if (historyStorageManager.active) {
        state.textContent = zh ? '\u6b63\u5728\u5199\u5165' : 'Writing';
        state.style.color = 'var(--color-success, #10b981)';
      } else if (appState.historyStorageEnabled && historyStorageManager.errorMessage) {
        state.textContent = `${zh ? '\u5199\u5165\u5df2\u505c\u6b62' : 'Storage stopped'}: ${historyStorageManager.errorMessage}`;
        state.style.color = 'var(--color-danger, #ef4444)';
      } else if (appState.historyStorageEnabled) {
        state.textContent = zh ? '\u5df2\u542f\u7528\uff0c\u7b49\u5f85\u8fde\u63a5' : 'Enabled, waiting for connection';
        state.style.color = 'var(--text-muted)';
      } else {
        state.textContent = zh ? '\u672a\u542f\u7528' : 'Disabled';
        state.style.color = 'var(--text-muted)';
      }
    }
  }
}
