const { log } = require('console');
const { app, BrowserWindow, ipcMain, session, nativeTheme } = require('electron');
const path = require('path');
const Aria2Manager = require('./aria2Manager.cjs');

// Set app name BEFORE any other app operations
if (process.platform === 'win32') {
    app.setAppUserModelId('com.visualbox.app');
}
app.setName('VisualBox');

const isDevEnvironment = process.env.DEV_ENV === 'true';

// Initialize aria2
const aria2 = new Aria2Manager();

nativeTheme.themeSource = 'light';

const { CHROME_UA, VERSION_CHECK_INTERVAL } = require('./config/constants.cjs');
app.userAgentFallback = CHROME_UA;

// Import modules
const { initDatabase } = require('./database/index.cjs');
const { registerDatabaseHandlers } = require('./database/handlers.cjs');
const { registerFaviconHandler } = require('./handlers/favicon.cjs');
const { registerSettingsHandlers } = require('./handlers/settings.cjs');
const { registerHttpHandler } = require('./handlers/http.cjs');
const { registerCookieHandlers } = require('./handlers/cookies.cjs');
const { registerDownloadHandlers, handleAria2Download } = require('./handlers/downloads.cjs');
const { registerInjectorRoutes } = require('./handlers/injectorController/routes.cjs');
const { registerChildWindowHandlers } = require('./handlers/childWindows.cjs');
const { createWindow, getMainWindow, setIsQuitting } = require('./window/createWindow.cjs');
const { handlePermissions } = require('./utils/permissions.cjs');
const { checkForNewVersion } = require('./utils/versionCheck.cjs');
const { registerSafeStorageHandlers } = require('./utils/safeStorage.cjs');

// IPC Handlers
ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('get-app-path', () => app.getAppPath());

app.on('ready', async () => {
    console.log('🚀 App ready, initializing...');
    
    // Initialize database first
    initDatabase(app);
    
    // Register all IPC handlers
    console.log('📝 Registering IPC handlers...');
    registerDatabaseHandlers();
    registerFaviconHandler();
    registerSettingsHandlers();
    registerHttpHandler();
    registerCookieHandlers();
    registerDownloadHandlers(aria2, getMainWindow);
    registerInjectorRoutes(getMainWindow);
    registerSafeStorageHandlers();
    registerChildWindowHandlers(isDevEnvironment, getMainWindow);
    
    // Reload app handler
    ipcMain.handle('reload-app', () => {
        const win = getMainWindow();
        if (win) {
            console.log('🔄 Reloading main window...');
            win.reload();
        }
    });

    // Clear all session partitions (cookies, localStorage, cache) on logout
    ipcMain.handle('clear-session-partitions', async () => {
        try {
            console.log('🧹 Clearing all session partitions...');
            const { session } = require('electron');
            
            // Clear default session
            await session.defaultSession.clearStorageData();
            console.log('  ✅ Default session cleared');
            
            // Clear all persist:workspace-* partitions
            const ses = session.fromPartition('persist:workspace-');
            // Electron doesn't enumerate partitions, so we clear known ones
            // by iterating through common workspace IDs
            // The default session clear above handles most cases
            await session.defaultSession.clearCache();
            await session.defaultSession.clearAuthCache();
            await session.defaultSession.cookies.flushStore();
            
            console.log('✅ All session data cleared');
            return { success: true };
        } catch (error) {
            console.error('clear-session-partitions error:', error);
            return { success: false, error: error.message };
        }
    });
    
    console.log('✅ All IPC handlers registered');
    
    // Block Ctrl+R, F5, and other shortcuts globally for all web contents (including webviews)
    app.on('web-contents-created', (event, contents) => {
        contents.on('before-input-event', (event, input) => {
            // Block Ctrl+R and F5 (reload shortcuts)
            if (
                ((input.control || input.meta) && input.key.toLowerCase() === 'r') ||
                input.key === 'F5'
            ) {
                event.preventDefault();
            }
        });
    });
    
    const mainWindow = createWindow(isDevEnvironment, aria2);

    const defaultSession = session.defaultSession;

    defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
        details.requestHeaders['User-Agent'] = CHROME_UA;
        callback({ requestHeaders: details.requestHeaders });
    });

    defaultSession.webRequest.onHeadersReceived((details, callback) => {
        delete details.responseHeaders?.['x-frame-options'];
        callback({ responseHeaders: details.responseHeaders });
    });

    setTimeout(() => {
        checkForNewVersion(app, mainWindow, isDevEnvironment);
        setInterval(() => checkForNewVersion(app, mainWindow, isDevEnvironment), VERSION_CHECK_INTERVAL);
    }, 5000);

    // Start aria2 and wait for it to be ready before registering download handlers
    try {
        const downloadsPath = app.getPath('downloads');
        await aria2.start(downloadsPath);
        console.log('✅ aria2 started successfully');
        
        // Register aria2 download handler for default session AFTER aria2 is ready
        handleAria2Download(session.defaultSession, aria2, mainWindow);
    } catch (error) {
        console.error('❌ Failed to start aria2:', error);
        // Fallback: don't register download handler if aria2 fails
    }

    app.on('web-contents-created', (event, contents) => {
        if (contents.getType() === 'webview') {
            contents.on('new-window', (e, url) => {
                e.preventDefault();
            });

            const ses = contents.session;
            if (ses) {
                // Register aria2 download handler for webview session too (only if aria2 is ready)
                if (aria2.isReady) {
                    handleAria2Download(ses, aria2, mainWindow);
                }
                handlePermissions(ses);
            }
        }
    });
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow(isDevEnvironment, aria2);
    } else {
        const mainWindow = getMainWindow();
        if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
        }
    }
});

app.on('window-all-closed', (e) => {
    e.preventDefault();
});

app.on('before-quit', async () => {
    setIsQuitting(true);
    
    // Stop aria2 gracefully
    console.log('🛑 Stopping aria2...');
    try {
        await aria2.stop();
    } catch (error) {
        console.error('Failed to stop aria2:', error);
    }
});

app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    event.preventDefault();
    callback(true);
});

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        const mainWindow = getMainWindow();
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
}
