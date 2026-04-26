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

    // HTTP Request API - Native Electron
    http: {
        request: (options) => ipcRenderer.invoke('http-request', options),
        get: (url, options = {}) => ipcRenderer.invoke('http-request', { ...options, method: 'GET', url }),
        post: (url, data, options = {}) => ipcRenderer.invoke('http-request', { ...options, method: 'POST', url, data }),
        put: (url, data, options = {}) => ipcRenderer.invoke('http-request', { ...options, method: 'PUT', url, data }),
        delete: (url, options = {}) => ipcRenderer.invoke('http-request', { ...options, method: 'DELETE', url }),
    },

    // Safe Storage API - Secure token storage using Electron's built-in encryption
    safeStorage: {
        setItem: (key, value) => ipcRenderer.invoke('safe-storage-set', key, value),
        getItem: (key) => ipcRenderer.invoke('safe-storage-get', key),
        removeItem: (key) => ipcRenderer.invoke('safe-storage-remove', key),
    },

    // Database API - SQLite operations for local data
    db: {
        // Profile Colors
        saveProfileColor: (profileId, color) => ipcRenderer.invoke('db-save-profile-color', profileId, color),
        getProfileColor: (profileId) => ipcRenderer.invoke('db-get-profile-color', profileId),
        deleteProfileColor: (profileId) => ipcRenderer.invoke('db-delete-profile-color', profileId),
        
        // App Settings
        saveSetting: (key, value) => ipcRenderer.invoke('db-save-setting', key, value),
        getSetting: (key) => ipcRenderer.invoke('db-get-setting', key),
        deleteSetting: (key) => ipcRenderer.invoke('db-delete-setting', key),
        
        // Tabs
        saveTabs: (profileId, tabs) => ipcRenderer.invoke('db-save-tabs', profileId, tabs),
        getTabs: (profileId) => ipcRenderer.invoke('db-get-tabs', profileId),
        
        // Bookmarks
        addBookmark: (profileId, url, title, favicon) => ipcRenderer.invoke('db-add-bookmark', profileId, url, title, favicon),
        removeBookmark: (profileId, url) => ipcRenderer.invoke('db-remove-bookmark', profileId, url),
        getBookmarks: (profileId) => ipcRenderer.invoke('db-get-bookmarks', profileId),
        isBookmarked: (profileId, url) => ipcRenderer.invoke('db-is-bookmarked', profileId, url),
        
        // Downloads
        saveDownload: (download) => ipcRenderer.invoke('db-save-download', download),
        getDownloads: (profileId) => ipcRenderer.invoke('db-get-downloads', profileId),
        deleteDownload: (id) => ipcRenderer.invoke('db-delete-download', id),
        clearDownloads: (profileId) => ipcRenderer.invoke('db-clear-downloads', profileId),
        cancelDownload: (filename) => ipcRenderer.invoke('cancel-download', filename),
        pauseDownload: (filename) => ipcRenderer.invoke('pause-download', filename),
        resumeDownload: (filename) => ipcRenderer.invoke('resume-download', filename),
        
        // File operations
        fileExists: (filePath) => ipcRenderer.invoke('file-exists', filePath),
        openFileLocation: (filePath) => ipcRenderer.invoke('open-file-location', filePath),
        openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
    },

    // Download handlers
    onDownloadStarted: (callback) => ipcRenderer.on('download-started', (event, data) => callback(data)),
    onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (event, data) => callback(data)),
    onDownloadPaused: (callback) => ipcRenderer.on('download-paused', (event, data) => callback(data)),
    onDownloadCompleted: (callback) => ipcRenderer.on('download-completed', (event, data) => callback(data)),
    onDownloadCancelled: (callback) => ipcRenderer.on('download-cancelled', (event, data) => callback(data)),
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

    // Dropdown control - force close on window events
    onForceCloseDropdown: (callback) => ipcRenderer.on('force-close-dropdown', () => callback()),

    // Context Menu for webview
    showContextMenu: (params) => ipcRenderer.send('context-menu', params),
    
    // Context menu action handlers
    onOpenLinkNewTab: (callback) => {
        const handler = (event, url) => callback(url);
        ipcRenderer.on('open-link-new-tab', handler);
        return () => ipcRenderer.removeListener('open-link-new-tab', handler);
    },
    onDownloadImage: (callback) => {
        const handler = (event, url) => callback(url);
        ipcRenderer.on('download-image', handler);
        return () => ipcRenderer.removeListener('download-image', handler);
    },
    onReloadWebview: (callback) => {
        const handler = () => callback();
        ipcRenderer.on('reload-webview', handler);
        return () => ipcRenderer.removeListener('reload-webview', handler);
    },
}

contextBridge.exposeInMainWorld('api', api)