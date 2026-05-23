const { log } = require('console');
const { app, BrowserWindow, ipcMain, session, nativeTheme } = require('electron');
const path = require('path');
const Aria2Manager = require('./aria2Manager.cjs');

// Prevent uncaught exceptions from crashing the process with showErrorBox
process.on('uncaughtException', (error) => {
    console.error('[Main] Uncaught Exception:', error);
});
process.on('unhandledRejection', (reason) => {
    console.error('[Main] Unhandled Rejection:', reason);
});

const isDevEnvironment = process.env.DEV_ENV === 'true';

// Set app name BEFORE any other app operations
if (process.platform === 'win32') {
    app.setAppUserModelId(isDevEnvironment ? 'com.visualbox.app.dev' : 'com.visualbox.app');
}
app.setName(isDevEnvironment ? 'VisualBox Dev' : 'VisualBox');

// Initialize aria2
const aria2 = new Aria2Manager();

const { CHROME_UA, VERSION_CHECK_INTERVAL } = require('./config/constants.cjs');
app.userAgentFallback = CHROME_UA;

// Import modules
const { initDatabase, getDatabase } = require('./database/index.cjs');
const { registerDatabaseHandlers } = require('./database/handlers.cjs');
const { registerFaviconHandler } = require('./handlers/favicon.cjs');
const { registerSettingsHandlers } = require('./handlers/settings.cjs');
const { registerHttpHandler } = require('./handlers/http.cjs');
const { registerCookieHandlers } = require('./handlers/cookies.cjs');
const { registerDownloadHandlers, handleAria2Download, startAria2Polling, stopAria2Polling } = require('./handlers/downloads.cjs');
const { registerInjectorRoutes } = require('./handlers/injectorController/routes.cjs');
const { registerChildWindowHandlers } = require('./handlers/childWindows.cjs');
const { createWindow, getMainWindow, setIsQuitting } = require('./window/createWindow.cjs');
const { handlePermissions } = require('./utils/permissions.cjs');
const { checkForNewVersion } = require('./utils/versionCheck.cjs');
const { registerSafeStorageHandlers } = require('./utils/safeStorage.cjs');
const { registerAutoUpdateHandlers } = require('./handlers/autoUpdate.cjs');
const { registerPasswordHandlers } = require('./handlers/passwordHandlers.cjs');
const { passwordService } = require('./services/passwordService.cjs');

// IPC Handlers
ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('get-app-path', () => app.getAppPath());

app.on('ready', async () => {
    // Initialize database first
    initDatabase(app);
    
    // Apply saved theme to Electron's nativeTheme BEFORE creating windows.
    // This controls window background color, prefers-color-scheme in webviews,
    // scrollbars, and other OS-level theme behaviors.
    try {
        const db = getDatabase();
        if (db) {
            const stmt = db.prepare('SELECT value FROM app_settings WHERE key = ?');
            const row = stmt.get('theme');
            let savedTheme = 'system';
            if (row) {
                try { savedTheme = JSON.parse(row.value); } catch { savedTheme = row.value; }
            }
            // 'light' | 'dark' | 'system'
            nativeTheme.themeSource = savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : 'system';
            console.log('[Main] Theme applied:', nativeTheme.themeSource);
        }
    } catch (e) {
        nativeTheme.themeSource = 'system';
    }
    
    // Register all IPC handlers
    registerDatabaseHandlers();
    registerFaviconHandler();
    registerSettingsHandlers(isDevEnvironment);
    registerHttpHandler();
    registerCookieHandlers();
    registerDownloadHandlers(aria2, getMainWindow);
    registerInjectorRoutes(getMainWindow);
    registerSafeStorageHandlers();
    registerChildWindowHandlers(isDevEnvironment, getMainWindow);
    registerAutoUpdateHandlers(getMainWindow);
    registerPasswordHandlers();
    
    // Reload app handler
    ipcMain.handle('reload-app', () => {
        const win = getMainWindow();
        if (win && !win.isDestroyed()) {
            win.reload();

            if (process.platform === 'win32') {
                setTimeout(() => {
                    if (win && !win.isDestroyed()) {
                        win.webContents.invalidate();
                    }
                }, 400); // Wait for page load/render to settle
            }
        }
    });

    ipcMain.handle('clear-session-partitions', async (event) => {
        try {
            const { session } = require('electron');
            
            await session.defaultSession.clearStorageData();
            await session.defaultSession.clearCache();
            await session.defaultSession.clearAuthCache();
            await session.defaultSession.cookies.flushStore();
            
            return { success: true };
        } catch (error) {
            console.error('clear-session-partitions error:', error);
            return { success: false, error: error.message };
        }
    });
    
    
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

            // Forward zoom shortcuts from webviews to main window
            // so the app's custom zoom handler can process them
            if (contents.getType() === 'webview' && (input.control || input.meta)) {
                let zoomAction = null;
                if (input.key === '0') zoomAction = 'reset';
                else if (input.key === '+' || input.key === '=') zoomAction = 'in';
                else if (input.key === '-') zoomAction = 'out';

                if (zoomAction) {
                    event.preventDefault();
                    const mainWindow = getMainWindow();
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('webview-zoom-shortcut', { action: zoomAction });
                    }
                }
            }
        });
    });
    
    const mainWindow = createWindow(isDevEnvironment, aria2);

    const defaultSession = session.defaultSession;

    defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
        details.requestHeaders['User-Agent'] = CHROME_UA;
        
        // Add Chrome Client Hints headers to match Chrome 131 (current stable)
        details.requestHeaders['sec-ch-ua'] = '"Chromium";v="131", "Not_A Brand";v="24", "Google Chrome";v="131"';
        details.requestHeaders['sec-ch-ua-mobile'] = '?0';
        details.requestHeaders['sec-ch-ua-platform'] = '"Windows"';
        
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
        
        // Register aria2 download handler for default session AFTER aria2 is ready
        handleAria2Download(session.defaultSession, aria2, mainWindow);
        
        // Start polling aria2 for download progress/completion
        startAria2Polling(aria2, mainWindow);
    } catch (error) {
        console.error('❌ Failed to start aria2:', error);
        // Fallback: don't register download handler if aria2 fails
    }

    app.on('web-contents-created', (event, contents) => {
        if (contents.getType() === 'webview') {
            // Use setWindowOpenHandler (modern API) to intercept window.open and target="_blank"
            contents.setWindowOpenHandler(({ url }) => {
                // Send IPC to renderer to handle new tab creation
                const mainWindow = getMainWindow();
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('webview-open-new-window', url);
                }
                // Deny the window open request (prevent new Electron window)
                return { action: 'deny' };
            });

            const ses = contents.session;
            if (ses) {
                // Register aria2 download handler for webview session too (only if aria2 is ready)
                if (aria2.isReady) {
                    handleAria2Download(ses, aria2, mainWindow);
                }
                handlePermissions(ses);
            }

            // ── Password Manager: IPC from webview preload ──
            // Two channels:
            //   'password-capture-urgent' — fire-and-forget from submit/click handler.
            //     Must complete before page navigates away. Main process handles
            //     never-save check + capture + save prompt relay.
            //   'password-show-save-prompt' — direct relay (used by vboxPassword bridge).
            contents.on('ipc-message', async (event, channel, ...args) => {
                if (channel === 'password-capture-urgent') {
                    const data = args[0];
                    if (!data) return;

                    try {
                        // Check never-save
                        const isNever = await passwordService.isNeverSave(data.profileId, data.origin);
                        if (isNever) return;

                        // Check if credential already exists with same username AND password
                        const existing = await passwordService.getCredentialByOriginAndUsername(
                            data.profileId, data.origin, data.username
                        );

                        // Only show save prompt if credential doesn't exist OR password changed
                        if (existing && existing.password === data.password) {
                            // Credentials are the same - no need to show popup
                            console.log(`🔐 [Main] Skipping save prompt: same username & password for ${data.origin}`);
                            return;
                        }

                        // Relay save prompt to main window
                        const mainWindow = getMainWindow();
                        if (mainWindow && !mainWindow.isDestroy()) {
                            mainWindow.webContents.send('password-show-save-prompt', {
                                profileId: data.profileId,
                                origin: data.origin,
                                username: data.username,
                                password: data.password,
                                title: data.title || data.origin,
                                url: data.url || data.origin,
                                isUpdate: !!existing // true if updating existing, false if new
                            });
                        }
                    } catch (err) {
                        console.error('🔐 [Main] password-capture-urgent error:', err);
                    }
                }

                if (channel === 'password-show-save-prompt') {
                    const mainWindow = getMainWindow();
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('password-show-save-prompt', ...args);
                    }
                }
            });
        }
    });
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow(isDevEnvironment, aria2);
    } else {
        const mainWindow = getMainWindow();
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.show();
            mainWindow.focus();
        }
    }
});

app.on('window-all-closed', () => {
    // Quit app when all windows are closed (except macOS)
    // This ensures the process is truly killed and the lock is released
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', async () => {
    setIsQuitting(true);
    
    // Stop aria2 polling
    stopAria2Polling();
    
    // Stop aria2 gracefully
    console.log('🛑 Stopping aria2...');
    try {
        await aria2.stop();
    } catch (error) {
        console.error('Failed to stop aria2:', error);
    }
    
    // Also kill any leftover aria2c processes on Windows
    if (process.platform === 'win32') {
        try {
            const { execSync } = require('child_process');
            execSync('taskkill /F /IM aria2c-64.exe 2>nul', { windowsHide: true });
        } catch (e) {
            // No leftover process, ignore
        }
    }
});

app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    event.preventDefault();
    callback(true);
});

// Use separate lock for dev mode so it doesn't conflict with production
const lockKey = isDevEnvironment ? 'com.visualbox.app.dev' : 'com.visualbox.app';
const gotTheLock = app.requestSingleInstanceLock({ path: lockKey });

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        const mainWindow = getMainWindow();
        if (mainWindow && !mainWindow.isDestroyed()) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
}
