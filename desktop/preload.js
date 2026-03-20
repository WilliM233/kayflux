const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kayflux', {
  // Main → Renderer
  onStatus: (callback) => {
    ipcRenderer.on('server:status', (_event, payload) => callback(payload));
  },

  // Renderer → Main
  restartServer: () => ipcRenderer.send('server:restart'),
  openBrowser: () => ipcRenderer.send('app:open-browser'),
  openLogs: () => ipcRenderer.send('logs:open'),
  openSettings: () => ipcRenderer.send('settings:open'),

  // Settings
  getSettings: () => ipcRenderer.send('settings:get'),
  onSettingsReply: (callback) => {
    ipcRenderer.on('settings:get:reply', (_event, settings) => callback(settings));
  },
  saveSettings: (settings) => ipcRenderer.send('settings:save', settings)
});
