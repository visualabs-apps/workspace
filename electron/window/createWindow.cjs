const { BrowserWindow, ipcMain, shell, Menu, session, dialog, app } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const { log } = require('console');
const { getDatabase } = require('../database/index.cjs');
const { handlePermissions } = require('../utils/permissions.cjs');
const { handleAria2Download, getAria2Downloads, getAria2Instance } = require('../handlers/downloads.cjs');
const { isDeveloperModeEnabled } = require('../handlers/settings.cjs');
const { CHROME_UA } = require('../config/constants.cjs');

let mainWindow = null;
let isQuitting = false;

function createWindow(isDevEnvironment, aria2) {
    if (isDevEnvironment) {
        app.commandLine.appendSwitch('disable-http-cache');
        app.commandLine.appendSwitch('disk-cache-size', '0');
    }

    // ✅ Cache disabling — only in dev environment to avoid detection
    // Production: these flags are unusual and create a unique fingerprint
    if (isDevEnvironment) {
        app.commandLine.appendSwitch('disable-http-cache');
        app.commandLine.appendSwitch('disable-cache');
        app.commandLine.appendSwitch('disable-application-cache');
    }
    
    // ✅ STEALTH: Disable automation detection
    app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');

    // ✅ STEALTH: Additional switches to make Electron appear more like a regular Chrome browser.
    // These prevent Google and other sites from detecting the Electron environment.
    app.commandLine.appendSwitch('disable-features', 'AutomationControlled,InterestFeedContentSuggestions,CalculateNativeWinOcclusion');
    
    // ✅ STEALTH: Prevent "headless" detection via navigator.plugins / mimeTypes
    app.commandLine.removeSwitch('headless');
    
    // Hardware acceleration — controlled by user setting (default: enabled)
    // Read from database before window creation
    let hwAccelEnabled = true; // default
    try {
        const { getDatabase } = require('../database/index.cjs');
        const db = getDatabase();
        if (db) {
            const stmt = db.prepare('SELECT value FROM app_settings WHERE key = ?');
            const row = stmt.get('hardwareAcceleration');
            if (row) {
                hwAccelEnabled = JSON.parse(row.value);
            }
        }
    } catch (e) {
        // Database not ready yet, use default
    }

    if (hwAccelEnabled) {
        // ✅ STEALTH: Enable WebGL (required for proper fingerprinting)
        app.commandLine.appendSwitch('enable-webgl');
        app.commandLine.appendSwitch('enable-accelerated-2d-canvas');
    }
    
    // ✅ STEALTH: Disable automation-related features
    app.commandLine.appendSwitch('disable-dev-shm-usage');
    app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');
    
    // ✅ STEALTH: Set proper window size to avoid headless detection
    app.commandLine.appendSwitch('window-size', '1920,1080');

    // nativeTheme.themeSource is already set in main.cjs before this runs.
    // Use it to determine the window background color and prevent white flash.
    // Color must match app.css --bg-primary: dark=#1f2937, light=#ffffff
    const { nativeTheme } = require('electron');
    const mainWindowBgColor = nativeTheme.shouldUseDarkColors ? '#1f2937' : '#ffffff';

    mainWindow = new BrowserWindow({
        width: 1300,
        height: 600,
        icon: path.join(__dirname, '..', '..', 'public', 'VBOXICON.png'),
        webPreferences: {
            preload: path.join(__dirname, '..', 'preload.cjs'),
            webviewTag: true,
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true, // ✅ CHANGED: Enable sandbox for better stealth
            disableBlinkFeatures: 'Automation',
            enableRemoteModule: false,
        },
        frame: false, // Custom title bar
        show: false,
        backgroundColor: mainWindowBgColor,
    });

    mainWindow.once('ready-to-show', () => {
        mainWindow.maximize();
        mainWindow.show();
        mainWindow.focus(); // Force focus the window when shown
    });

    // Ensure webContents has focus when window gains focus
    mainWindow.on('focus', () => {
        if (mainWindow && mainWindow.webContents && !mainWindow.webContents.isFocused()) {
            mainWindow.webContents.focus();
        }
    });

    // Close dropdowns when window is resized or moved
    mainWindow.on('resize', () => {
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('force-close-dropdown');
        }
    });

    mainWindow.on('move', () => {
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('force-close-dropdown');
        }
    });

    mainWindow.on('maximize', () => {
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('force-close-dropdown');
        }
    });

    mainWindow.on('unmaximize', () => {
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('force-close-dropdown');
        }
    });

    // Window controls - use event.sender to get the correct window
    ipcMain.on('window-minimize', (event) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (window) window.minimize();
    });

    // Fix: Force OS to re-evaluate window drag regions and focus by invalidating webContents.
    // Useful after SPA logout to fix unclickable inputs without visual window flashing.
    ipcMain.on('reset-window-hit-test', (event) => {
        console.log('[Main] Received reset-window-hit-test request');
        const window = BrowserWindow.fromWebContents(event.sender);
        if (window && !window.isDestroyed() && process.platform === 'win32') {
            try {
                // Toggling resizable changes WS_THICKFRAME style, forcing OS to clear drag region cache
                const resizable = window.isResizable();
                window.setResizable(!resizable);
                window.setResizable(resizable);
                
                // Refresh window focus to force Chromium to re-bind keyboard input hooks
                window.blur();
                window.focus();
                
                window.webContents.invalidate();
                console.log('[Main] Completed hit-test reset via resizable toggle and focus refresh');
            } catch (err) {
                console.error('[Main] Hit-test reset error:', err);
            }
        }
    });

    ipcMain.on('window-maximize', (event) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (window) {
            if (window.isMaximized()) {
                window.unmaximize();
            } else {
                window.maximize();
            }
        }
    });

    ipcMain.on('window-close', (event) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (window) window.close();
    });

    ipcMain.on('open-external', (event, url) => {
        shell.openExternal(url);
    });

    // Request window focus from renderer
    ipcMain.handle('request-window-focus', async (event) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (window && !window.isDestroyed()) {
            window.focus();
            if (window.webContents) {
                window.webContents.focus();
            }
            return { success: true };
        } else {
            return { success: false, error: 'Window not found' };
        }
    });

    // Context Menu Handler for webview
    ipcMain.on('context-menu', (event, params) => {
        const template = [];

        // Link context
        if (params.linkURL) {
            template.push({
                label: 'Buka Link di Tab Baru',
                click: () => {
                    event.sender.send('open-link-new-tab', params.linkURL);
                }
            });
            template.push({
                label: 'Salin Alamat Link',
                click: () => {
                    require('electron').clipboard.writeText(params.linkURL);
                }
            });
            template.push({ type: 'separator' });
        }

        // Image context
        if (params.hasImageContents || params.srcURL) {
            template.push({
                label: 'Simpan Gambar Sebagai...',
                click: async () => {
                    const imageUrl = params.srcURL;
                    if (!imageUrl) return;

                    try {
                        // Get the partition session for cookies
                        let targetSession = session.defaultSession;
                        if (params.partition) {
                            targetSession = session.fromPartition(params.partition);
                        }

                        // Extract filename from URL
                        let fileName = 'image.png';
                        const isDataOrBlob = imageUrl.startsWith('data:') || imageUrl.startsWith('blob:');
                        if (!isDataOrBlob) {
                            try {
                                const urlPath = new URL(imageUrl).pathname;
                                const baseName = path.basename(decodeURIComponent(urlPath));
                                if (baseName && baseName.length > 0 && baseName.includes('.')) {
                                    fileName = baseName;
                                }
                            } catch (e) {
                                // Use default filename
                            }
                        } else if (imageUrl.startsWith('data:image/')) {
                            // Extract format from data URI (e.g., data:image/jpeg → .jpg)
                            const match = imageUrl.match(/^data:image\/(\w+)/);
                            if (match) {
                                const fmt = match[1] === 'jpeg' ? 'jpg' : match[1];
                                fileName = `image.${fmt}`;
                            }
                        }

                        // Show save dialog directly (no webview.downloadURL — avoids double dialog)
                        const downloadsPath = app.getPath('downloads');
                        const { filePath: savePath, canceled } = await dialog.showSaveDialog(mainWindow, {
                            title: 'Save Image',
                            defaultPath: path.join(downloadsPath, fileName),
                            buttonLabel: 'Save'
                        });

                        if (canceled || !savePath) return;

                        const saveDir = path.dirname(savePath);
                        const actualFilename = path.basename(savePath);

                        // Get cookies from the session for authenticated downloads
                        let cookieHeader = '';
                        let referer = '';
                        if (!isDataOrBlob) {
                            try {
                                const urlObj = new URL(imageUrl);
                                const cookies = await targetSession.cookies.get({ url: urlObj.origin });
                                if (cookies.length > 0) {
                                    cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
                                }
                                referer = urlObj.origin + '/';
                            } catch (e) { }
                        }

                        const userAgent = CHROME_UA; // Platform-aware UA from constants

                        // Delete existing file if user chose to replace
                        if (fs.existsSync(savePath)) {
                            await fs.remove(savePath);
                        }

                        // Get aria2 instance from the module-level reference
                        const aria2Downloads = getAria2Downloads();
                        const aria2 = getAria2Instance();
                        const isHttpUrl = imageUrl.startsWith('http://') || imageUrl.startsWith('https://');

                        // data/blob URIs cannot be downloaded by aria2 — handle directly
                        if (!isHttpUrl) {
                            let buffer;

                            if (imageUrl.startsWith('data:')) {
                                // Parse data URI directly: data:image/png;base64,<data>
                                const matches = imageUrl.match(/^data:[^;]+;base64,(.+)$/);
                                if (!matches) throw new Error('Invalid data URI');
                                buffer = Buffer.from(matches[1], 'base64');
                            } else if (imageUrl.startsWith('blob:')) {
                                // blob URIs only exist in the renderer process — fetch there and send back
                                const result = await event.sender.executeJavaScript(`
                                    fetch('${imageUrl.replace(/'/g, "\\'")}')
                                        .then(r => r.blob())
                                        .then(b => new Promise(resolve => {
                                            const reader = new FileReader();
                                            reader.onload = () => resolve(reader.result);
                                            reader.readAsDataURL(b);
                                        }))
                                `);
                                const matches = result.match(/^data:[^;]+;base64,(.+)$/);
                                if (!matches) throw new Error('Failed to read blob data');
                                buffer = Buffer.from(matches[1], 'base64');
                            } else {
                                throw new Error('Unsupported URL scheme');
                            }

                            await fs.writeFile(savePath, buffer);

                            const db = getDatabase();
                            const downloadId = uuidv4();
                            const now = Date.now();
                            if (db) {
                                db.prepare(`
                                    INSERT INTO downloads (id, filename, url, save_path, total_bytes, received_bytes, state, start_time, end_time, created_at, file_exists)
                                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                                `).run(downloadId, actualFilename, imageUrl, savePath, buffer.byteLength, buffer.byteLength, 'complete', now, now, now, 1);
                            }

                            if (mainWindow && !mainWindow.isDestroyed()) {
                                mainWindow.webContents.send('download-completed', {
                                    gid: null,
                                    id: downloadId,
                                    filename: actualFilename,
                                    savePath: savePath,
                                    totalBytes: buffer.byteLength,
                                    url: imageUrl
                                });
                            }
                            return;
                        }

                        // HTTP/HTTPS URLs — ALWAYS use aria2
                        if (!aria2 || !aria2.isReady) {
                            throw new Error('Download manager is not ready. Please try again.');
                        }

                        const downloadId = uuidv4();
                        const aria2Options = {
                            filename: actualFilename,
                            dir: saveDir
                        };
                        if (cookieHeader) {
                            aria2Options.headers = { 'Cookie': cookieHeader };
                        }
                        if (userAgent) {
                            aria2Options.headers = aria2Options.headers || {};
                            aria2Options.headers['User-Agent'] = userAgent;
                        }
                        if (referer) {
                            aria2Options.headers = aria2Options.headers || {};
                            aria2Options.headers['Referer'] = referer;
                        }

                        const gid = await aria2.addDownload(imageUrl, aria2Options);

                        aria2Downloads.set(gid, {
                            id: downloadId,
                            gid: gid,
                            filename: actualFilename,
                            url: imageUrl,
                            savePath: savePath,
                            startTime: Date.now()
                        });

                        if (mainWindow && !mainWindow.isDestroyed()) {
                            mainWindow.webContents.send('download-started', {
                                id: downloadId,
                                gid: gid,
                                filename: actualFilename,
                                url: imageUrl,
                                startTime: Date.now(),
                                totalBytes: 0,
                                savePath: savePath,
                                mimeType: ''
                            });
                        }

                    } catch (error) {
                        console.error('Failed to save image:', error);
                        if (mainWindow && !mainWindow.isDestroyed()) {
                            mainWindow.webContents.send('download-failed', {
                                gid: null,
                                id: null,
                                filename: 'image',
                                error: error.message,
                                state: 'failed'
                            });
                        }
                    }
                }
            });
            template.push({
                label: 'Salin Alamat Gambar',
                click: () => {
                    require('electron').clipboard.writeText(params.srcURL);
                }
            });
            template.push({ type: 'separator' });
        }

        // Text selection
        if (params.selectionText) {
            template.push({
                label: 'Salin',
                role: 'copy'
            });
            template.push({ type: 'separator' });
        }

        // Editable field
        if (params.isEditable) {
            if (!params.selectionText) {
                template.push({
                    label: 'Tempel',
                    role: 'paste'
                });
            } else {
                template.push({
                    label: 'Potong',
                    role: 'cut'
                });
                template.push({
                    label: 'Salin',
                    role: 'copy'
                });
                template.push({
                    label: 'Tempel',
                    role: 'paste'
                });
            }
            template.push({ type: 'separator' });
        }

        // Standard actions
        template.push({
            label: 'Muat Ulang',
            click: () => {
                event.sender.send('reload-webview');
            }
        });

        // Inspect Element (only in developer mode)
        isDeveloperModeEnabled().then(enabled => {
            if (enabled) {
                template.push({
                    label: 'Inspect Element',
                    click: () => {
                        if (params.webContentsId) {
                            const { webContents } = require('electron');
                            const wc = webContents.fromId(params.webContentsId);
                            if (wc) {
                                wc.openDevTools();
                            }
                        }
                    }
                });
            }

            const menu = Menu.buildFromTemplate(template);
            menu.popup();
        });
    });

    mainWindow.on('close', async (event) => {
        if (!isQuitting) {
            event.preventDefault();
            isQuitting = true;

            // Force exit after 5 seconds if graceful shutdown hangs
            // This prevents ghost processes in Task Manager
            const forceExitTimer = setTimeout(() => {
                console.warn('⚠️ Force exiting app (graceful shutdown timed out)');
                app.exit(0);
            }, 5000);

            try {
                app.quit();
            } catch (err) {
                console.error('Error during quit:', err);
                clearTimeout(forceExitTimer);
                app.exit(0);
            }
        }
        return false;
    });

    // Block DevTools unless developer mode is enabled
    mainWindow.webContents.on('before-input-event', (event, input) => {
        const isDevToolsShortcut = (input.key === 'I' && (input.control || input.meta) && input.shift) || input.key === 'F12';
        if (isDevToolsShortcut) {
            isDeveloperModeEnabled().then(enabled => {
                if (!enabled) {
                    event.preventDefault();
                }
            });
        }
    });
    // Also close DevTools if opened via other means (right-click, etc.)
    mainWindow.webContents.on('devtools-opened', () => {
        isDeveloperModeEnabled().then(enabled => {
            if (!enabled) {
                mainWindow.webContents.closeDevTools();
            }
        });
    });

    if (isDevEnvironment) {
        app.commandLine.appendSwitch('disable-http-cache');
        app.commandLine.appendSwitch('disk-cache-size', '0');

        const loadVite = () => {
            mainWindow.loadURL('http://localhost:5184/').catch((e) => {
                log('Vite server not ready, retrying in 1s...');
                setTimeout(loadVite, 1000);
            });
        };

        setTimeout(loadVite, 2000);

        // Only auto-open DevTools if developer mode is enabled
        isDeveloperModeEnabled().then(enabled => {
            if (enabled) {
                mainWindow.webContents.on("did-frame-finish-load", () => {
                    mainWindow.webContents.openDevTools();
                });
            }
        });

        log('Electron running in dev mode: 🧪');

    } else {
        mainWindow.loadFile(path.join(__dirname, '..', 'build', 'index.html'));
        log('Electron running in prod mode: 🚀');
    }

    return mainWindow;
}

function getMainWindow() {
    return mainWindow;
}

function setIsQuitting(value) {
    isQuitting = value;
}


module.exports = {
    createWindow,
    getMainWindow,
    setIsQuitting
};
