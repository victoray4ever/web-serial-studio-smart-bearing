const fs = require('fs');
const path = require('path');
const { BrowserWindow, dialog, ipcMain, shell } = require('electron');
const { autoUpdater } = require('electron-updater');

function createUpdateManager({ app, appIconPath, getMainWindow, disabled = false }) {
  let updateCheckInProgress = false;
  let updateProgressWindow = null;
  let configured = false;

  function canUseAutoUpdater() {
    if (disabled || !app.isPackaged) return false;
    return fs.existsSync(path.join(process.resourcesPath, 'app-update.yml'));
  }

  function closeProgressWindow() {
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setProgressBar(-1);
    if (updateProgressWindow && !updateProgressWindow.isDestroyed()) updateProgressWindow.close();
    updateProgressWindow = null;
  }

  function showProgressWindow(version = '') {
    if (updateProgressWindow && !updateProgressWindow.isDestroyed()) return;
    const mainWindow = getMainWindow();
    updateProgressWindow = new BrowserWindow({
      width: 460,
      height: 190,
      parent: mainWindow || undefined,
      modal: false,
      resizable: false,
      maximizable: false,
      minimizable: false,
      title: '下载更新',
      icon: appIconPath,
      backgroundColor: '#ffffff',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    updateProgressWindow.setMenuBarVisibility(false);
    updateProgressWindow.on('closed', () => { updateProgressWindow = null; });
    const safeVersion = String(version || '').replace(/[<>&"']/g, '');
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      *{box-sizing:border-box}body{margin:0;padding:26px 28px;font-family:"Segoe UI","Microsoft YaHei",sans-serif;color:#111827;background:#fff}
      h1{margin:0 0 8px;font-size:18px}p{margin:0 0 18px;color:#64748b;font-size:13px}.track{height:14px;border:1px solid #cbd5e1;background:#eef2f6;overflow:hidden}.bar{height:100%;width:0;background:#004769;transition:width .18s ease}.meta{display:flex;justify-content:space-between;margin-top:9px;font-size:12px;color:#475569}
    </style></head><body><h1>正在下载 MEMS-CMS ${safeVersion}</h1><p>下载完成后可打开安装向导并选择安装位置。</p><div class="track"><div class="bar" id="bar"></div></div><div class="meta"><span id="detail">准备下载...</span><strong id="percent">0%</strong></div></body></html>`;
    updateProgressWindow.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(html)}`);
  }

  function updateProgress(progress = {}) {
    const percent = Math.max(0, Math.min(100, Number(progress.percent) || 0));
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setProgressBar(percent / 100);
    if (!updateProgressWindow || updateProgressWindow.isDestroyed()) return;
    const transferred = Number(progress.transferred) || 0;
    const total = Number(progress.total) || 0;
    const speed = Number(progress.bytesPerSecond) || 0;
    const mb = (value) => (value / 1024 / 1024).toFixed(1);
    const detail = total > 0
      ? `${mb(transferred)} MB / ${mb(total)} MB  ${mb(speed)} MB/s`
      : `${mb(transferred)} MB`;
    updateProgressWindow.webContents.executeJavaScript(`
      document.getElementById('bar').style.width = ${JSON.stringify(`${percent.toFixed(1)}%`)};
      document.getElementById('percent').textContent = ${JSON.stringify(`${Math.round(percent)}%`)};
      document.getElementById('detail').textContent = ${JSON.stringify(detail)};
    `).catch(() => {});
  }

  function setup() {
    if (configured) return;
    configured = true;

    ipcMain.handle('app:update:check', async () => {
      if (!canUseAutoUpdater()) return { ok: false, skipped: true };
      updateCheckInProgress = true;
      await autoUpdater.checkForUpdates();
      return { ok: true };
    });
    if (!canUseAutoUpdater()) return;

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;

    autoUpdater.on('update-available', async (info) => {
      updateCheckInProgress = false;
      const mainWindow = getMainWindow();
      if (!mainWindow || mainWindow.isDestroyed()) return;
      const version = info?.version ? ` v${info.version}` : '';
      const result = await dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: '发现新版本',
        message: `发现 MEMS-CMS${version}，是否现在下载更新？`,
        detail: '下载完成后会再次询问是否立即重启并安装。当前采集任务不会被自动中断。',
        buttons: ['下载更新', '稍后再说'],
        defaultId: 0,
        cancelId: 1,
        noLink: true
      });
      if (result.response !== 0) return;
      showProgressWindow(version.trim());
      autoUpdater.downloadUpdate().catch((error) => {
        closeProgressWindow();
        dialog.showErrorBox('更新下载失败', error?.message || String(error));
      });
    });

    autoUpdater.on('download-progress', updateProgress);

    autoUpdater.on('update-not-available', () => {
      const wasManual = updateCheckInProgress;
      updateCheckInProgress = false;
      const mainWindow = getMainWindow();
      if (!wasManual || !mainWindow || mainWindow.isDestroyed()) return;
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: '已是最新版本',
        message: '当前 MEMS-CMS 已经是最新版本。',
        buttons: ['确定'],
        noLink: true
      });
    });

    autoUpdater.on('update-downloaded', async (info) => {
      closeProgressWindow();
      const mainWindow = getMainWindow();
      if (!mainWindow || mainWindow.isDestroyed()) return;
      const version = info?.version ? ` v${info.version}` : '';
      const result = await dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: '更新已下载',
        message: `MEMS-CMS${version} 已下载完成，是否立即重启并安装？`,
        detail: '如果正在采集或保存数据，请先保存当前工作，再选择重启安装。',
        buttons: ['立即重启安装', '下次启动再安装'],
        defaultId: 0,
        cancelId: 1,
        noLink: true
      });
      if (result.response !== 0) return;
      const installer = String(info?.downloadedFile || '');
      if (installer && fs.existsSync(installer)) {
        const openError = await shell.openPath(installer);
        if (openError) {
          dialog.showErrorBox('无法打开安装程序', openError);
          return;
        }
        setTimeout(() => app.quit(), 800);
        return;
      }
      autoUpdater.quitAndInstall(false, true);
    });

    autoUpdater.on('error', (error) => {
      closeProgressWindow();
      const wasManual = updateCheckInProgress;
      updateCheckInProgress = false;
      if (!wasManual) {
        console.warn('[auto-update] check skipped or failed:', error?.message || error);
        return;
      }
      dialog.showErrorBox('更新检查失败', error?.message || String(error));
    });
  }

  function checkQuietly() {
    if (!canUseAutoUpdater()) return;
    setTimeout(() => {
      updateCheckInProgress = false;
      autoUpdater.checkForUpdates().catch(() => {
        updateCheckInProgress = false;
      });
    }, 5000);
  }

  return { setup, checkQuietly };
}

module.exports = { createUpdateManager };
