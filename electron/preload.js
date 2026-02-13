const { contextBridge, ipcRenderer } = require('electron')

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

    // OAuth handlers
    openExternal: (url) => ipcRenderer.send('open-external', url),
    onOAuthCallback: (callback) => ipcRenderer.on('oauth-callback', (event, data) => callback(data))
}

contextBridge.exposeInMainWorld('api', api)