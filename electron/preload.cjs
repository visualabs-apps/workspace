const { contextBridge, ipcRenderer } = require('electron')

// Early theme injection to prevent FOUC (flash of white screen)
try {
    const isDark = ipcRenderer.sendSync('get-resolved-theme-is-dark');
    if (isDark && typeof document !== 'undefined' && document.documentElement) {
        document.documentElement.classList.add('dark');
    }
} catch (e) {
    console.error('[Preload] Failed to apply early theme:', e);
}

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

        // Synchronous theme getter — used by index.html to prevent FOUC (flash of light mode)
        getThemeSync: () => ipcRenderer.sendSync('get-theme-sync'),

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
        readTextFile: (filePath) => ipcRenderer.invoke('read-text-file', filePath),

        // Cookie operations
        getCookiesFromPartition: (partition) => ipcRenderer.invoke('get-cookies-from-partition', partition),
        setCookieToPartition: (partition, cookie) => ipcRenderer.invoke('set-cookie-to-partition', partition, cookie),
        deleteCookieFromPartition: (partition, name, domain, path, secure) => ipcRenderer.invoke('delete-cookie-from-partition', partition, name, domain, path, secure),

        // Password operations (encrypted with safeStorage)
        getPasswords: (profileId) => ipcRenderer.invoke('db-get-passwords', profileId),
        getPassword: (id) => ipcRenderer.invoke('db-get-password', id),
        savePassword: (passwordData) => ipcRenderer.invoke('db-save-password', passwordData),
        deletePassword: (id) => ipcRenderer.invoke('db-delete-password', id),

        // AI Chat Messages
        saveAiMessage: (profileId, message) => ipcRenderer.invoke('db-save-ai-message', profileId, message),
        getAiMessages: (profileId) => ipcRenderer.invoke('db-get-ai-messages', profileId),
        clearAiMessages: (profileId) => ipcRenderer.invoke('db-clear-ai-messages', profileId),
    },

    // Password Manager API (Chrome-like)
    passwordManager: {
        // Save a credential (auto-detect from form submit)
        save: (credential) => ipcRenderer.invoke('password-save', credential),

        // Get credentials for a specific domain (for auto-fill)
        getForDomain: (profileId, origin) => ipcRenderer.invoke('password-get-for-domain', { profileId, origin }),

        // Get all passwords for a profile (metadata only, no decrypted passwords)
        getAll: (profileId) => ipcRenderer.invoke('password-get-all', profileId),

        // Get single credential (decrypted)
        getCredential: (credentialId) => ipcRenderer.invoke('password-get-credential', credentialId),

        // Delete a credential
        delete: (credentialId) => ipcRenderer.invoke('password-delete', credentialId),

        // Update password for existing credential
        updatePassword: (credentialId, newPassword) => ipcRenderer.invoke('password-update-password', { credentialId, newPassword }),

        // Full credential update
        update: (credentialId, data) => ipcRenderer.invoke('password-update', { credentialId, data }),

        // Check if credential exists for origin
        exists: (profileId, origin, username) => ipcRenderer.invoke('password-exists', { profileId, origin, username }),

        // Get password statistics
        getStats: (profileId) => ipcRenderer.invoke('password-stats', profileId),

        // Password generator
        generate: (options) => ipcRenderer.invoke('password-generate', options || {}),

        // Password strength check
        checkStrength: (password) => ipcRenderer.invoke('password-strength', password),

        // Never save list
        neverSave: (profileId, origin) => ipcRenderer.invoke('password-never-save', { profileId, origin }),
        isNeverSave: (profileId, origin) => ipcRenderer.invoke('password-is-never-save', { profileId, origin }),
        removeNeverSave: (profileId, origin) => ipcRenderer.invoke('password-remove-never-save', { profileId, origin }),

        // Auto-fill orchestration
        autofillLookup: (profileId, origin) => ipcRenderer.invoke('password-autofill-lookup', { profileId, origin }),
        captureSubmit: (data) => ipcRenderer.invoke('password-capture-submit', data),
    },

    // Listen for save prompt from webview (shown in main window)
    onPasswordSavePrompt: (callback) => {
        const handler = (event, data) => callback(data);
        ipcRenderer.on('password-show-save-prompt', handler);
        return () => ipcRenderer.removeListener('password-show-save-prompt', handler);
    },

    // Download dialog helpers
    getDownloadsPath: () => ipcRenderer.invoke('get-downloads-path'),
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    listDirectory: (path) => ipcRenderer.invoke('list-directory', path),
    createFolder: (parentPath, folderName) => ipcRenderer.invoke('create-folder', parentPath, folderName),

    // App Settings
    settings: {
        setShowNotifications: (enabled) => ipcRenderer.invoke('settings-show-notifications', enabled),
        getShowNotifications: () => ipcRenderer.invoke('settings-get-show-notifications'),
        setTabLifetime: (minutes) => ipcRenderer.invoke('settings-tab-lifetime', minutes),
        getTabLifetime: () => ipcRenderer.invoke('settings-get-tab-lifetime'),
        setDefaultSearchEngine: (engine) => ipcRenderer.invoke('settings-default-search-engine', engine),
        getDefaultSearchEngine: () => ipcRenderer.invoke('settings-get-default-search-engine'),
        setAutoStart: (enabled) => ipcRenderer.invoke('settings-set-auto-start', enabled),
        getAutoStart: () => ipcRenderer.invoke('settings-get-auto-start'),
        setDeveloperMode: (enabled) => ipcRenderer.invoke('settings-set-developer-mode', enabled),
        getDeveloperMode: () => ipcRenderer.invoke('settings-get-developer-mode'),
        setDataSyncInterval: (seconds) => ipcRenderer.invoke('settings-data-sync-interval', seconds),
        getDataSyncInterval: () => ipcRenderer.invoke('settings-get-data-sync-interval'),
        setDataSyncEnabled: (enabled) => ipcRenderer.invoke('settings-data-sync-enabled', enabled),
        getDataSyncEnabled: () => ipcRenderer.invoke('settings-get-data-sync-enabled'),
        setHardwareAcceleration: (enabled) => ipcRenderer.invoke('settings-hardware-acceleration', enabled),
        getHardwareAcceleration: () => ipcRenderer.invoke('settings-get-hardware-acceleration'),
    },

    // Favicon fetching (main process handles CORS)
    getFavicon: (url, exactIconUrl) => ipcRenderer.invoke('get-favicon', { url, exactIconUrl }),

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
    resetWindowHitTest: () => ipcRenderer.send('reset-window-hit-test'),

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

    // Zoom shortcut forwarded from webview (main process intercepts Ctrl+0/+/-
    // in webview webContents and relays here so the renderer can handle it)
    onWebviewZoomShortcut: (callback) => {
        const handler = (event, data) => callback(data);
        ipcRenderer.on('webview-zoom-shortcut', handler);
        return () => ipcRenderer.removeListener('webview-zoom-shortcut', handler);
    },

    // External URL opener (for deep link auth)
    openExternal: (url) => ipcRenderer.send('open-external', url),

    // Deep Link Auth handlers
    onAuthSuccess: (callback) => ipcRenderer.on('auth-success', (event, data) => callback(data)),
    onAuthError: (callback) => ipcRenderer.on('auth-error', (event, data) => callback(data)),

    // Version check (manual, no auto-download)
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    onNewVersionAvailable: (callback) => {
        const handler = (event, info) => callback(info);
        ipcRenderer.on('new-version-available', handler);
        return () => ipcRenderer.removeListener('new-version-available', handler);
    },

    // Auto-Update API
    update: {
        checkNow: () => ipcRenderer.invoke('check-for-updates-now'),
        startDownload: (opts) => ipcRenderer.invoke('start-auto-update', opts),
        installAndQuit: (opts) => ipcRenderer.invoke('install-and-quit', opts),
        onProgress: (callback) => {
            const handler = (_, data) => callback(data);
            ipcRenderer.on('update-download-progress', handler);
            return () => ipcRenderer.removeListener('update-download-progress', handler);
        },
        onComplete: (callback) => {
            const handler = (_, data) => callback(data);
            ipcRenderer.on('update-download-complete', handler);
            return () => ipcRenderer.removeListener('update-download-complete', handler);
        },
        onError: (callback) => {
            const handler = (_, data) => callback(data);
            ipcRenderer.on('update-download-error', handler);
            return () => ipcRenderer.removeListener('update-download-error', handler);
        },
    },

    // Dropdown control - force close on window events
    onForceCloseDropdown: (callback) => ipcRenderer.on('force-close-dropdown', () => callback()),

    // Context Menu for webview
    showContextMenu: (params) => ipcRenderer.send('context-menu', params),

    // Context menu action handlers
    onOpenLinkNewTab: (callback) => {
        const handler = (event, url) => {
            try {
                callback(url);
            } catch (err) {
                console.error('[preload] onOpenLinkNewTab error:', err);
            }
        };
        ipcRenderer.on('open-link-new-tab', handler);
        return () => ipcRenderer.removeListener('open-link-new-tab', handler);
    },

    // Request window focus from renderer process
    requestFocus: () => {
        ipcRenderer.invoke('request-window-focus').catch(err => {
            console.error('[preload] requestFocus error:', err);
        });
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
    
    // Listen for webview window.open / target="_blank" from main process
    onWebviewOpenNewWindow: (callback) => {
        const handler = (event, url) => callback(url);
        ipcRenderer.on('webview-open-new-window', handler);
        return () => ipcRenderer.removeListener('webview-open-new-window', handler);
    },
    
    onShowToast: (callback) => {
        const handler = (event, data) => callback(data);
        ipcRenderer.on('show-toast', handler);
        return () => ipcRenderer.removeListener('show-toast', handler);
    },

    // Script input window
    onScriptInputOpen: (callback) => {
        const handler = (event, config) => {
            callback(config);
        };
        ipcRenderer.on('open-script-input', handler);
        return () => ipcRenderer.removeListener('open-script-input', handler);
    },
    sendScriptInputResponse: (data) => {
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

    // Reload the entire app (main window)
    reloadApp: () => ipcRenderer.invoke('reload-app'),

    // Clear all local data on logout (multi-user safety)
    clearAllLocalData: () => ipcRenderer.invoke('clear-all-local-data'),
    clearSessionPartitions: () => ipcRenderer.invoke('clear-session-partitions'),
    cleanupOrphanDownloads: () => ipcRenderer.invoke('cleanup-orphan-downloads'),

    // MCP-level Tab/Profile management (renderer → main → webview)
    mcp: {
        listProfiles: () => ipcRenderer.invoke('webview-list-profiles'),
        listTabs: () => ipcRenderer.invoke('webview-list-tabs'),
        switchTab: (tabId) => ipcRenderer.invoke('webview-switch-tab', tabId),
        getPageInfo: (tabId) => ipcRenderer.invoke('webview-get-page-info', tabId || null),
        createTab: (url, title) => ipcRenderer.invoke('webview-create-tab', { url, title }),
        navigateAndWait: (params) => ipcRenderer.invoke('mcp-navigate-and-wait', params),
        executeVBoxAPI: (params) => ipcRenderer.invoke('vbox-api-execute', params),
    },

    // Listen for API logs from main process (available on demand, not auto-forwarded to reduce console noise)
}

contextBridge.exposeInMainWorld('api', api)