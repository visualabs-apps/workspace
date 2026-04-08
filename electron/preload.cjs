const { contextBridge, ipcRenderer } = require('electron')

// ✅ SAFE: No need to load external stealth script
// The real stealth comes from proper Electron configuration:
// - nodeIntegration: false
// - contextIsolation: true
// - sandbox: true
// - disableBlinkFeatures: 'Automation'

const api = {
    node: () => process.versions.node,
    chrome: () => process.versions.chrome,
    electron: () => process.versions.electron,

    // Download handlers
    onDownloadStarted: (callback) => ipcRenderer.on('download-started', (event, data) => callback(data)),
    onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (event, data) => callback(data)),
    onDownloadCompleted: (callback) => ipcRenderer.on('download-completed', (event, data) => callback(data)),
    onDownloadFailed: (callback) => ipcRenderer.on('download-failed', (event, data) => callback(data)),

    // Notification handlers
    showNotification: (data) => ipcRenderer.send('show-notification', data),
    updateBadgeCount: (count) => ipcRenderer.send('update-badge-count', count),

    // Window Controls
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),

    // External URL opener (for deep link auth)
    openExternal: (url) => ipcRenderer.send('open-external', url),

    // Deep Link Auth handlers
    onAuthSuccess: (callback) => ipcRenderer.on('auth-success', (event, data) => callback(data)),
    onAuthError: (callback) => ipcRenderer.on('auth-error', (event, data) => callback(data)),

    // Version check (manual, no auto-download)
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    onNewVersionAvailable: (callback) => ipcRenderer.on('new-version-available', (event, info) => callback(info)),
}

contextBridge.exposeInMainWorld('api', api)