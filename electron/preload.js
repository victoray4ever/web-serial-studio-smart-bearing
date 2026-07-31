const { contextBridge, ipcRenderer } = require('electron');
const { productName, version } = require('../package.json');

function subscribe(channel, callback) {
  const handler = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld('memsCmsDesktop', {
  platform: process.platform,
  app: {
    name: productName,
    version
  },
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node
  },
  update: {
    check: () => ipcRenderer.invoke('app:update:check')
  },
  historyStorage: {
    getConfig: () => ipcRenderer.invoke('history-storage:get-config'),
    chooseDirectory: () => ipcRenderer.invoke('history-storage:choose-directory'),
    start: (metadata) => ipcRenderer.invoke('history-storage:start', metadata),
    append: (record) => ipcRenderer.send('history-storage:append', record),
    stop: (reason) => ipcRenderer.invoke('history-storage:stop', reason),
    onStatus: (callback) => subscribe('history-storage:status', callback)
  },
  mqtt: {
    connect: (options) => ipcRenderer.invoke('mqtt-tcp:connect', options),
    publish: (options) => ipcRenderer.invoke('mqtt-tcp:publish', options),
    disconnect: (sessionId) => ipcRenderer.invoke('mqtt-tcp:disconnect', sessionId),
    onData: (callback) => subscribe('mqtt-tcp:data', callback),
    onError: (callback) => subscribe('mqtt-tcp:error', callback),
    onClose: (callback) => subscribe('mqtt-tcp:close', callback)
  }
});
