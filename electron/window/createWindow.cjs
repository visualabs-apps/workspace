const { BrowserWindow, ipcMain, shell, Menu, session } = require('electron');
const path = require('path');
const { log } = require('console');
const { getDatabase } = require('../database/index.cjs');
const { handlePermissions } = require('../utils/permissions.cjs');
const { handleAria2Download } = require('../handlers/downloads.cjs');

let mainWindow = null;
let isQuitting = false;

function createWindow(isDevEnvironment, aria2) {
    if (isDevEnvironment) {
        const { app } = require('electron');
        app.commandLine.appendSwitch('disable-http-cache');
        app.commandLine.appendSwitch('disk-cache-size', '0');
    }

    const { app } = require('electron');
    app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');

    mainWindow = new BrowserWindow({
        width: 1300,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, '..', 'preload.cjs'),
            webviewTag: true,
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            disableBlinkFeatures: 'Automation',
            enableRemoteModule: false,
        },
        frame: false, // Custom title bar
        show: false,
    });

    mainWindow.once('ready-to-show', () => {
        mainWindow.maximize();
        mainWindow.show();
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
                click: () => {
                    event.sender.send('download-image', params.srcURL);
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
            label: 'Import Cookies',
            click: async () => {
                try {
                    // Get cookies from clipboard
                    const clipboardText = require('electron').clipboard.readText();
                    
                    if (!clipboardText) {
                        event.sender.send('show-toast', {
                            type: 'error',
                            message: 'Clipboard kosong'
                        });
                        return;
                    }
                    
                    // Parse JSON
                    let cookies;
                    try {
                        cookies = JSON.parse(clipboardText);
                    } catch (e) {
                        event.sender.send('show-toast', {
                            type: 'error',
                            message: 'Format cookies tidak valid (harus JSON)'
                        });
                        return;
                    }
                    
                    if (!Array.isArray(cookies)) {
                        event.sender.send('show-toast', {
                            type: 'error',
                            message: 'Format cookies harus berupa array'
                        });
                        return;
                    }
                    
                    console.log('🍪 Importing', cookies.length, 'cookies');
                    console.log('🍪 Partition:', params.partition);
                    
                    // Helper function to generate proper cookie URL
                    const getCookieUrl = (cookie) => {
                        const protocol = cookie.secure ? 'https://' : 'http://';
                        const domain = cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain;
                        return protocol + domain;
                    };
                    
                    // Get session based on partition
                    let targetSession;
                    if (params.partition) {
                        targetSession = session.fromPartition(params.partition);
                        console.log('🍪 Using partition session:', params.partition);
                    } else {
                        targetSession = session.defaultSession;
                        console.log('🍪 Using default session');
                    }
                    
                    // Import cookies
                    let successCount = 0;
                    let failCount = 0;
                    
                    for (const cookie of cookies) {
                        try {
                            const cookieUrl = getCookieUrl(cookie);
                            console.log('🍪 Setting cookie:', cookie.name, 'for', cookieUrl);
                            
                            await targetSession.cookies.set({
                                url: cookieUrl,
                                name: cookie.name,
                                value: cookie.value,
                                domain: cookie.domain,
                                path: cookie.path || '/',
                                expirationDate: cookie.expirationDate,
                                secure: cookie.secure || false,
                                httpOnly: cookie.httpOnly || false,
                                sameSite: cookie.sameSite || 'unspecified'
                            });
                            
                            successCount++;
                        } catch (err) {
                            console.error('🍪 Failed to set cookie:', cookie.name, err.message);
                            failCount++;
                        }
                    }
                    
                    // Flush cookie store to ensure cookies are saved
                    await targetSession.cookies.flushStore();
                    console.log('🍪 Cookie store flushed');
                    
                    // Reload webview to apply cookies
                    event.sender.send('reload-webview');
                    
                    // Send success message
                    event.sender.send('show-toast', {
                        type: 'success',
                        message: `${successCount} cookies berhasil diimport${failCount > 0 ? `, ${failCount} gagal` : ''}`
                    });
                    
                    console.log(`✅ Imported ${successCount} cookies, ${failCount} failed`);
                } catch (error) {
                    console.error('Failed to import cookies:', error);
                    event.sender.send('show-toast', {
                        type: 'error',
                        message: 'Gagal import cookies: ' + error.message
                    });
                }
            }
        });
        
        template.push({
            label: 'Export Cookies',
            click: async () => {
                try {
                    // Get the URL from params
                    const url = params.pageURL || params.frameURL;
                    
                    if (!url) {
                        console.error('No URL available for cookie export');
                        event.sender.send('show-toast', {
                            type: 'error',
                            message: 'Tidak ada URL untuk export cookies'
                        });
                        return;
                    }
                    
                    console.log('🍪 Exporting cookies for URL:', url);
                    
                    // Parse URL to get domain
                    const urlObj = new URL(url);
                    const domain = urlObj.hostname;
                    
                    console.log('🍪 Domain:', domain);
                    console.log('🍪 Partition:', params.partition);
                    
                    // Get session based on partition
                    let targetSession;
                    if (params.partition) {
                        targetSession = session.fromPartition(params.partition);
                        console.log('🍪 Using partition session:', params.partition);
                    } else {
                        targetSession = session.defaultSession;
                        console.log('🍪 Using default session');
                    }
                    
                    // Get ALL cookies from the session first (for debugging)
                    const allSessionCookies = await targetSession.cookies.get({});
                    console.log('🍪 Total cookies in session:', allSessionCookies.length);
                    
                    // Filter cookies that match the domain (including subdomains)
                    const allCookies = allSessionCookies.filter(c => {
                        // Match exact domain or parent domain (e.g., .roblox.com matches www.roblox.com)
                        const cookieDomain = c.domain.startsWith('.') ? c.domain.substring(1) : c.domain;
                        return domain === cookieDomain || domain.endsWith('.' + cookieDomain) || cookieDomain.endsWith('.' + domain);
                    });
                    console.log('🍪 Cookies matching domain:', allCookies.length);
                    
                    // Filter out session-only and expired cookies
                    const now = Date.now() / 1000;
                    const validCookies = allCookies.filter(c => {
                        // Remove session-only cookies
                        if (c.session) {
                            console.log('🍪 Skipping session-only cookie:', c.name);
                            return false;
                        }
                        // Remove expired cookies
                        if (c.expirationDate && c.expirationDate < now) {
                            console.log('🍪 Skipping expired cookie:', c.name);
                            return false;
                        }
                        return true;
                    });
                    
                    console.log('🍪 Valid cookies after filtering:', validCookies.length);
                    
                    if (validCookies.length === 0) {
                        event.sender.send('show-toast', {
                            type: 'info',
                            message: `Tidak ada cookies untuk ${domain}`
                        });
                        return;
                    }
                    
                    // Format cookies with all required fields
                    const formattedCookies = validCookies.map(c => ({
                        name: c.name,
                        value: c.value,
                        domain: c.domain,
                        path: c.path,
                        expirationDate: c.expirationDate,
                        secure: c.secure,
                        httpOnly: c.httpOnly,
                        sameSite: c.sameSite || 'unspecified'
                    }));
                    
                    // Format cookies as JSON
                    const cookiesJson = JSON.stringify(formattedCookies, null, 2);
                    
                    // Copy to clipboard
                    require('electron').clipboard.writeText(cookiesJson);
                    
                    // Send success message
                    event.sender.send('show-toast', {
                        type: 'success',
                        message: `${validCookies.length} cookies dari ${domain} disalin ke clipboard`
                    });
                    
                    console.log(`✅ Exported ${validCookies.length} cookies from ${domain}`);
                } catch (error) {
                    console.error('Failed to export cookies:', error);
                    event.sender.send('show-toast', {
                        type: 'error',
                        message: 'Gagal export cookies: ' + error.message
                    });
                }
            }
        });
        
        template.push({ type: 'separator' });
        
        template.push({
            label: 'Muat Ulang',
            click: () => {
                event.sender.send('reload-webview');
            }
        });

        const menu = Menu.buildFromTemplate(template);
        menu.popup();
    });

    mainWindow.on('close', async (event) => {
        if (!isQuitting) {
            event.preventDefault();
            
            // Check minimize to tray setting
            let minimizeToTray = false;
            try {
                const db = getDatabase();
                if (db) {
                    const stmt = db.prepare('SELECT value FROM app_settings WHERE key = ?');
                    const row = stmt.get('minimizeToTray');
                    if (row) {
                        minimizeToTray = JSON.parse(row.value);
                    }
                }
            } catch (error) {
                console.error('Error reading minimizeToTray setting:', error);
            }
            
            if (minimizeToTray) {
                mainWindow.hide();

                if (process.platform === 'win32') {
                    const tray = getTray();
                    if (tray) {
                        try {
                            tray.displayBalloon({
                                title: 'VisualBox',
                                content: 'VisualBox is still running in the background. Click the tray icon to open.',
                                icon: path.join(__dirname, '..', '..', 'public', 'icon.ico')
                            });
                        } catch (e) {
                            // Ignore balloon errors
                        }
                    }
                }
            } else {
                // If minimize to tray is disabled, quit the app
                isQuitting = true;
                const { app } = require('electron');
                app.quit();
            }
        }
        return false;
    });

    if (isDevEnvironment) {
        const { app } = require('electron');
        app.commandLine.appendSwitch('disable-http-cache');
        app.commandLine.appendSwitch('disk-cache-size', '0');

        const loadVite = () => {
            mainWindow.loadURL('http://localhost:5184/').catch((e) => {
                log('Vite server not ready, retrying in 1s...');
                setTimeout(loadVite, 1000);
            });
        };

        setTimeout(loadVite, 2000);

        mainWindow.webContents.on("did-frame-finish-load", () => {
            mainWindow.webContents.openDevTools();
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

// Placeholder for tray reference (will be set from createTray)
let trayRef = null;
function setTray(tray) {
    trayRef = tray;
}
function getTray() {
    return trayRef;
}

module.exports = { 
    createWindow, 
    getMainWindow, 
    setIsQuitting,
    setTray,
    getTray
};
