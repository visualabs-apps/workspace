// Modules to control application life and create native browser window
const { log } = require('console')
const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, shell, session } = require('electron')
const path = require('path')
const https = require('https')

const isDevEnvironment = process.env.DEV_ENV === 'true'

// ========================================
// STEALTH: Override user-agent at process level
// Real Chrome UA — removes 'Electron' from the UA string so sites
// cannot detect the app is running inside Electron.
// ========================================
const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
app.userAgentFallback = CHROME_UA;

// ========================================
// MANUAL VERSION CHECK
// ========================================
const VERSION_CHECK_URL = 'https://leb.visualabs.id/downloads/workspace/version.json';
const VERSION_CHECK_INTERVAL = 30 * 60 * 1000; // 30 minutes

function compareVersions(v1, v2) {
    const a = v1.split('.').map(Number);
    const b = v2.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        if ((a[i] || 0) < (b[i] || 0)) return -1;
        if ((a[i] || 0) > (b[i] || 0)) return 1;
    }
    return 0;
}

function checkForNewVersion() {
    if (isDevEnvironment) return;
    const currentVersion = app.getVersion();
    https.get(VERSION_CHECK_URL, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            try {
                const info = JSON.parse(data);
                if (compareVersions(currentVersion, info.version) < 0) {
                    log(`New version available: ${info.version} (current: ${currentVersion})`);
                    if (mainWindow) {
                        mainWindow.webContents.send('new-version-available', {
                            version: info.version,
                            notes: info.notes || '',
                            downloadUrl: info.windows?.setup?.url || VERSION_CHECK_URL,
                        });
                    }
                }
            } catch (e) {
                log('Version check parse error:', e.message);
            }
        });
    }).on('error', (e) => {
        log('Version check failed:', e.message);
    });
}

ipcMain.handle('get-app-version', () => app.getVersion());

// ========================================
// DEEP LINK PROTOCOL REGISTRATION
// ========================================
// Register custom protocol 'vleb://' for deep linking
if (process.defaultApp) {
    if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient('vleb', process.execPath, [path.resolve(process.argv[1])]);
    }
} else {
    app.setAsDefaultProtocolClient('vleb');
}

let mainWindow;
let tray = null;
let isQuitting = false;

const createTray = () => {
    // Create tray icon
    const iconPath = path.join(__dirname, '..', 'public', 'icon.png');
    const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });

    tray = new Tray(trayIcon);
    tray.setToolTip('V-LEB Workspace Browser');

    // Create context menu
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Show V-LEB',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                }
            }
        },
        {
            label: 'Hide V-LEB',
            click: () => {
                if (mainWindow) {
                    mainWindow.hide();
                }
            }
        },
        { type: 'separator' },
        {
            label: 'Quit',
            click: () => {
                isQuitting = true;
                app.quit();
            }
        }
    ]);

    tray.setContextMenu(contextMenu);

    // Double click to show/hide
    tray.on('double-click', () => {
        if (mainWindow) {
            if (mainWindow.isVisible()) {
                mainWindow.hide();
            } else {
                mainWindow.show();
                mainWindow.focus();
            }
        }
    });
}

const createWindow = () => {

    // Disable cache in dev mode to avoid permission errors
    if (isDevEnvironment) {
        app.commandLine.appendSwitch('disable-http-cache');
        app.commandLine.appendSwitch('disk-cache-size', '0');
    }

    // ✅ STEALTH: Disable automation flags at the Blink level
    app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');

    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 1300,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            webviewTag: true,
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            disableBlinkFeatures: 'Automation',
            enableRemoteModule: false,
        },
        titleBarStyle: 'hidden',
    })

    // Window Control IPC Handlers
    ipcMain.on('window-minimize', () => {
        if (mainWindow) mainWindow.minimize();
    });

    ipcMain.on('window-maximize', () => {
        if (mainWindow) {
            if (mainWindow.isMaximized()) {
                mainWindow.unmaximize();
            } else {
                mainWindow.maximize();
            }
        }
    });

    ipcMain.on('window-close', () => {
        if (mainWindow) mainWindow.close();
    });

    // OAuth Handler - Open URL in external browser
    ipcMain.on('open-external', (event, url) => {
        shell.openExternal(url);
    });

    // Handle window close - minimize to tray instead
    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow.hide();

            // Show notification on first minimize
            if (process.platform === 'win32') {
                try {
                    tray.displayBalloon({
                        title: 'V-LEB',
                        content: 'V-LEB is still running in the background. Click the tray icon to open.',
                        icon: path.join(__dirname, '..', 'public', 'icon.ico')
                    });
                } catch (e) {
                    // Ignore balloon errors (icon missing, etc.)
                }
            }
        }
        return false;
    });

    // define how electron will load the app
    if (isDevEnvironment) {

        // Disable cache in dev mode to avoid permission errors
        app.commandLine.appendSwitch('disable-http-cache');
        app.commandLine.appendSwitch('disk-cache-size', '0');

        // if your vite app is running on a different port, change it here
        const loadVite = () => {
            mainWindow.loadURL('http://localhost:5173/').catch((e) => {
                log('Vite server not ready, retrying in 1s...');
                setTimeout(loadVite, 1000);
            });
        };

        // Wait a bit before trying to load (give Vite time to start)
        setTimeout(loadVite, 2000);

        // Open the DevTools.
        mainWindow.webContents.on("did-frame-finish-load", () => {
            mainWindow.webContents.openDevTools();
        });

        log('Electron running in dev mode: 🧪')

    } else {

        // when not in dev mode, load the build file instead
        mainWindow.loadFile(path.join(__dirname, 'build', 'index.html'));

        log('Electron running in prod mode: 🚀')
    }
}

// IPC handlers for tray
ipcMain.on('update-badge-count', (event, count) => {
    if (tray) {
        if (count > 0) {
            // Update tray tooltip with badge count
            tray.setToolTip(`V-LEB (${count} unread)`);

            // On Windows, you can overlay a badge
            if (process.platform === 'win32' && mainWindow) {
                mainWindow.setOverlayIcon(
                    nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='),
                    count.toString()
                );
            }
        } else {
            tray.setToolTip('V-LEB Workspace Browser');
            if (process.platform === 'win32' && mainWindow) {
                mainWindow.setOverlayIcon(null, '');
            }
        }
    }
});

ipcMain.on('show-notification', (event, { title, body }) => {
    if (tray && !mainWindow.isVisible()) {
        if (process.platform === 'win32') {
            tray.displayBalloon({
                title: title || 'V-LEB',
                content: body || '',
                icon: path.join(__dirname, '..', 'public', 'icon.png')
            });
        }
    }
});

// ========================================
// DEEP LINK HANDLER
// ========================================
const keytar = require('keytar');

/**
 * Handle deep link authentication
 * Called when browser redirects to vleb://auth?token=xxx&workspace=yyy
 */
async function handleDeepLink(url) {
    try {
        console.log('Deep link received:', url);

        // Parse URL
        const urlObj = new URL(url);

        // Check if it's auth callback
        if (urlObj.protocol === 'vleb:' && urlObj.hostname === 'auth') {
            const token = urlObj.searchParams.get('token');
            const workspace = urlObj.searchParams.get('workspace') || 'default';

            if (token) {
                // Store token securely in keytar (per workspace)
                await keytar.setPassword('v-leb-workspace', workspace, token);

                console.log(`Token stored for workspace: ${workspace}`);

                // Send token to renderer process
                if (mainWindow) {
                    mainWindow.webContents.send('auth-success', {
                        token,
                        workspace
                    });

                    // Show and focus window
                    mainWindow.show();
                    mainWindow.focus();
                }
            } else {
                console.error('No token in deep link');
                if (mainWindow) {
                    mainWindow.webContents.send('auth-error', {
                        error: 'No token received'
                    });
                }
            }
        }
    } catch (error) {
        console.error('Deep link handling error:', error);
        if (mainWindow) {
            mainWindow.webContents.send('auth-error', {
                error: error.message
            });
        }
    }
}

// Helper to handle downloads
function handleDownload(session) {
    session.on('will-download', (event, item, webContents) => {
        // Send download info to renderer
        const fileName = item.getFilename();
        const url = item.getURL();
        const startTime = item.getStartTime();

        // Notify renderer about start
        mainWindow.webContents.send('download-started', {
            filename: fileName,
            url: url,
            startTime: startTime,
            totalBytes: item.getTotalBytes()
        });

        item.on('updated', (event, state) => {
            if (state === 'interrupted') {
                log('Download is interrupted but can be resumed')
            } else if (state === 'progressing') {
                if (item.isPaused()) {
                    log('Download is paused')
                } else {
                    mainWindow.webContents.send('download-progress', {
                        filename: fileName,
                        receivedBytes: item.getReceivedBytes(),
                        totalBytes: item.getTotalBytes(),
                        state: 'progressing'
                    });
                }
            }
        })
        item.once('done', (event, state) => {
            if (state === 'completed') {
                log('Download successfully')
                mainWindow.webContents.send('download-completed', {
                    filename: fileName,
                    state: 'completed',
                    savePath: item.getSavePath()
                });
            } else {
                log(`Download failed: ${state}`)
                mainWindow.webContents.send('download-failed', {
                    filename: fileName,
                    state: state
                });
            }
        })
    });
}

// Handler for permission requests (Camera, Mic, Notifications)
function handlePermissions(session) {
    session.setPermissionRequestHandler((webContents, permission, callback) => {
        const url = webContents.getURL();

        // By default, approve common permissions for known apps
        // In a real app, you might want to ask the user via IPC
        const allowedPermissions = ['media', 'geolocation', 'notifications', 'fullscreen'];

        if (allowedPermissions.includes(permission)) {
            callback(true); // Approve
        } else {
            console.log(`Permission denied: ${permission} for ${url}`);
            callback(false); // Deny others
        }
    });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on('ready', () => {
    createTray();
    createWindow();

    // ========================================
    // STEALTH: Session-level patches
    // Applied after ready so session is available.
    // ========================================
    const defaultSession = session.defaultSession;

    // 1. Override UA for ALL requests (including webview partitioned sessions)
    //    This ensures no request ever leaks the Electron UA.
    defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
        details.requestHeaders['User-Agent'] = CHROME_UA;
        callback({ requestHeaders: details.requestHeaders });
    });

    // 2. Patch response headers to remove any server-set automation hints
    defaultSession.webRequest.onHeadersReceived((details, callback) => {
        // Remove headers that expose automation
        delete details.responseHeaders?.['x-frame-options'];
        callback({ responseHeaders: details.responseHeaders });
    });

    // Check for new version after 5 seconds, then every 30 minutes
    setTimeout(() => {
        checkForNewVersion();
        setInterval(checkForNewVersion, VERSION_CHECK_INTERVAL);
    }, 5000);

    // Setup session handlers for default session
    // For partitioned sessions, we need to do this when they are created/accessed
    // Or we can interception via 'session' module if we knew the partitions ahead of time.
    // However, since partitions are dynamic, we usually handle this by listening to 'web-contents-created'

    app.on('web-contents-created', (event, contents) => {
        if (contents.getType() === 'webview') {
            // Listen for new window events from webviews
            contents.on('new-window', (e, url) => {
                e.preventDefault();
                // Send to renderer to decide functionality
                // Usually the 'new-window' event in renderer <webview> tag handles this too
                // But this is a fallback or for native controls
            });

            // Handle downloads and permissions for this webview's session
            // Note: contents.session might be null roughly here for webview, 
            // but we can try to attach to the webview's attached event in renderer generally.
            // A better way in main process:
            const ses = contents.session;
            if (ses) {
                handleDownload(ses);
                handlePermissions(ses);
            }
        }
    });
});

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    } else if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
    }
})

// Prevent quit on window close
app.on('window-all-closed', (e) => {
    // Keep app running in tray
    e.preventDefault();
});

// Before quit, set flag
app.on('before-quit', () => {
    isQuitting = true;
});

// Workaround for SSL/Certificate errors in some network environments
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    // On certificate error we disable default behaviour (stop loading the page)
    // and we say "it is all fine - true" to the callback
    event.preventDefault();
    callback(true);
});

// ========================================
// DEEP LINK EVENT LISTENERS
// ========================================

// Handle deep link on macOS
app.on('open-url', (event, url) => {
    event.preventDefault();
    handleDeepLink(url);
});

// Handle deep link on Windows/Linux
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Someone tried to run a second instance, we should focus our window.
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }

        // The commandLine is array of strings in which last element is deep link url
        // Handle deep link for Windows/Linux
        const url = commandLine.find((arg) => arg.startsWith('vleb://'));
        if (url) {
            handleDeepLink(url);
        }
    });
}

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.