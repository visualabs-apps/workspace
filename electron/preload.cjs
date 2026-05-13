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
        cancelDownload: (gid) => ipcRenderer.invoke('cancel-download', gid),
        pauseDownload: (gid) => ipcRenderer.invoke('pause-download', gid),
        resumeDownload: (gid) => ipcRenderer.invoke('resume-download', gid),
        removeDownloadFile: (filePath) => ipcRenderer.invoke('remove-download-file', filePath),
        
        // File operations
        fileExists: (filePath) => ipcRenderer.invoke('file-exists', filePath),
        openFileLocation: (filePath) => ipcRenderer.invoke('open-file-location', filePath),
        openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
        
        // Cookie operations
        getCookiesFromPartition: (partition) => ipcRenderer.invoke('get-cookies-from-partition', partition),
        setCookieToPartition: (partition, cookie) => ipcRenderer.invoke('set-cookie-to-partition', partition, cookie),
        deleteCookieFromPartition: (partition, name, domain, path) => ipcRenderer.invoke('delete-cookie-from-partition', partition, name, domain, path),
    },

    // Download dialog helpers
    getDownloadsPath: () => ipcRenderer.invoke('get-downloads-path'),
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    listDirectory: (path) => ipcRenderer.invoke('list-directory', path),
    createFolder: (parentPath, folderName) => ipcRenderer.invoke('create-folder', parentPath, folderName),

    // App Settings
    settings: {
        setLaunchOnStartup: (enabled) => ipcRenderer.invoke('settings-launch-on-startup', enabled),
        getLaunchOnStartup: () => ipcRenderer.invoke('settings-get-launch-on-startup'),
        setMinimizeToTray: (enabled) => ipcRenderer.invoke('settings-minimize-to-tray', enabled),
        getMinimizeToTray: () => ipcRenderer.invoke('settings-get-minimize-to-tray'),
        setShowNotifications: (enabled) => ipcRenderer.invoke('settings-show-notifications', enabled),
        getShowNotifications: () => ipcRenderer.invoke('settings-get-show-notifications'),
        setTabLifetime: (minutes) => ipcRenderer.invoke('settings-tab-lifetime', minutes),
        getTabLifetime: () => ipcRenderer.invoke('settings-get-tab-lifetime'),
        setDefaultSearchEngine: (engine) => ipcRenderer.invoke('settings-default-search-engine', engine),
        getDefaultSearchEngine: () => ipcRenderer.invoke('settings-get-default-search-engine'),
    },
    
    // Favicon fetching (main process handles CORS)
    getFavicon: (url) => ipcRenderer.invoke('get-favicon', url),

    // Download handlers
    onDownloadStarted: (callback) => ipcRenderer.on('download-started', (event, data) => callback(data)),
    onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (event, data) => callback(data)),
    onDownloadPaused: (callback) => ipcRenderer.on('download-paused', (event, data) => callback(data)),
    onDownloadCompleted: (callback) => ipcRenderer.on('download-completed', (event, data) => callback(data)),
    onDownloadCancelled: (callback) => ipcRenderer.on('download-cancelled', (event, data) => callback(data)),
    onDownloadFailed: (callback) => ipcRenderer.on('download-failed', (event, data) => callback(data)),
    onDownloadRemoved: (callback) => ipcRenderer.on('download-removed', (event, data) => callback(data)),
    onShowDownloadDialog: (callback) => ipcRenderer.on('show-download-dialog', (event, data) => callback(data)),
    startDownload: (options) => ipcRenderer.invoke('start-download', options),

    // Notification handlers
    showNotification: (data) => ipcRenderer.send('show-notification', data),
    updateBadgeCount: (count) => ipcRenderer.send('update-badge-count', count),

    // Window Controls
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),
    
    // Child Windows (BrowserWindow)
    childWindow: {
        open: (options) => ipcRenderer.invoke('open-child-window', options),
        close: (windowId) => ipcRenderer.invoke('close-child-window', windowId),
        closeAll: () => ipcRenderer.invoke('close-all-child-windows'),
        sendData: (windowId, data) => ipcRenderer.invoke('send-to-child-window', windowId, data),
        minimize: (windowId) => ipcRenderer.invoke('minimize-child-window', windowId),
        restore: (windowId) => ipcRenderer.invoke('restore-child-window', windowId),
    },
    
    // Window data communication
    onWindowData: (callback) => {
        const handler = (event, data) => callback(data);
        ipcRenderer.on('window-data', handler);
        return () => ipcRenderer.removeListener('window-data', handler);
    },
    sendToParent: (channel, data) => ipcRenderer.send('send-to-parent', channel, data),
    onParentMessage: (channel, callback) => {
        const handler = (event, data) => callback(data);
        ipcRenderer.on(channel, handler);
        return () => ipcRenderer.removeListener(channel, handler);
    },
    
    // Taskbar events
    onWindowMinimized: (callback) => {
        const handler = (event, data) => callback(data);
        ipcRenderer.on('window-minimized', handler);
        return () => ipcRenderer.removeListener('window-minimized', handler);
    },
    onWindowRestored: (callback) => {
        const handler = (event, data) => callback(data);
        ipcRenderer.on('window-restored', handler);
        return () => ipcRenderer.removeListener('window-restored', handler);
    },

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
    onShowToast: (callback) => {
        const handler = (event, data) => callback(data);
        ipcRenderer.on('show-toast', handler);
        return () => ipcRenderer.removeListener('show-toast', handler);
    },
    
    // Script input window
    onScriptInputOpen: (callback) => {
        const handler = (event, config) => {
            console.log('[Preload] Script input open event:', config);
            callback(config);
        };
        ipcRenderer.on('open-script-input', handler);
        return () => ipcRenderer.removeListener('open-script-input', handler);
    },
    sendScriptInputResponse: (data) => {
        console.log('[Preload] Sending input response:', data);
        ipcRenderer.send('script-input-response', data);
    },
    
    // Webview console logs
    onWebviewConsoleLog: (callback) => {
        const handler = (event, data) => callback(data);
        ipcRenderer.on('webview-console-log', handler);
        return () => ipcRenderer.removeListener('webview-console-log', handler);
    },
    
    // Execute script in active webview
    executeScript: (code) => ipcRenderer.invoke('execute-script', code),
    
    // Generate PowerPoint
    generatePowerPoint: (pptData) => ipcRenderer.invoke('generate-powerpoint', pptData),
    
    // Script Injector API
    scripts: {
        list: () => ipcRenderer.invoke('scripts-list'),
        save: (scriptData) => ipcRenderer.invoke('scripts-save', scriptData),
        load: (scriptId) => ipcRenderer.invoke('scripts-load', scriptId),
        delete: (scriptId) => ipcRenderer.invoke('scripts-delete', scriptId),
        execute: (scriptId) => ipcRenderer.invoke('scripts-execute', scriptId),
        getDirectory: () => ipcRenderer.invoke('scripts-get-directory'),
        addToDownloads: (fileInfo) => ipcRenderer.invoke('script-add-to-downloads', fileInfo),
        
        // Script input window
        openInput: (config) => ipcRenderer.invoke('script-open-input', config),
    },
    
    // Listen for script console logs
    onScriptConsole: (callback) => {
        const listener = (event, data) => callback(data);
        ipcRenderer.on('script-console-log', listener);
        return () => ipcRenderer.removeListener('script-console-log', listener);
    },
    
    // Send console log from renderer to main process
    sendConsoleLog: (data) => {
        ipcRenderer.send('webview-console-log', { level: data.level, args: [data.message] });
    },
    
    // PowerPoint generation
    powerpoint: {
        generate: (pptData) => ipcRenderer.invoke('generate-powerpoint', pptData),
        
        // Template processing
        processTemplate: (templateName, variables, outputFilename) => 
            ipcRenderer.invoke('ppt-process-template', { templateName, variables, outputFilename }),
        listTemplates: () => ipcRenderer.invoke('ppt-list-templates'),
        getTemplatesDir: () => ipcRenderer.invoke('ppt-get-templates-dir'),
    },
    
    // Get app path for preload script
    getAppPath: () => ipcRenderer.invoke('get-app-path'),
}

contextBridge.exposeInMainWorld('api', api)