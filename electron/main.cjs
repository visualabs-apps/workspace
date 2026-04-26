const { log } = require('console')
const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, shell, session, nativeTheme, safeStorage } = require('electron')
const path = require('path')
const https = require('https')
const http = require('http')
const { URL } = require('url')
const Database = require('better-sqlite3')

const isDevEnvironment = process.env.DEV_ENV === 'true'

nativeTheme.themeSource = 'light';

const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
app.userAgentFallback = CHROME_UA;

const VERSION_CHECK_URL = 'https://visualbox.app/downloads/version.json';
const VERSION_CHECK_INTERVAL = 30 * 60 * 1000;

// Initialize electron-store (lazy load to avoid issues)
let Store;
let secureStore;

function getSecureStore() {
    if (!secureStore) {
        if (!Store) {
            Store = require('electron-store');
        }
        secureStore = new Store({ name: 'secure-storage' });
    }
    return secureStore;
}

// SQLite Database
let db = null;

function initDatabase() {
    try {
        const userDataPath = app.getPath('userData');
        const dbPath = path.join(userDataPath, 'vbox.db');
        
        console.log('📦 Initializing SQLite database at:', dbPath);
        
        fs.mkdirSync(userDataPath, { recursive: true });
        
        db = new Database(dbPath);
        db.pragma('journal_mode = WAL');
        
        // Create tables
        db.exec(`
            CREATE TABLE IF NOT EXISTS profile_colors (
                profile_id INTEGER PRIMARY KEY,
                color TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            )
        `);
        
        db.exec(`
            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            )
        `);
        
        db.exec(`
            CREATE TABLE IF NOT EXISTS tabs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                profile_id INTEGER NOT NULL,
                url TEXT NOT NULL,
                title TEXT,
                favicon TEXT,
                position INTEGER NOT NULL DEFAULT 0,
                is_active INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
        `);
        
        db.exec(`
            CREATE TABLE IF NOT EXISTS bookmarks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                profile_id INTEGER NOT NULL,
                url TEXT NOT NULL,
                title TEXT NOT NULL,
                favicon TEXT,
                created_at INTEGER NOT NULL,
                UNIQUE(profile_id, url)
            )
        `);
        
        db.exec(`
            CREATE TABLE IF NOT EXISTS downloads (
                id TEXT PRIMARY KEY,
                profile_id INTEGER,
                filename TEXT NOT NULL,
                url TEXT NOT NULL,
                save_path TEXT NOT NULL,
                total_bytes INTEGER NOT NULL DEFAULT 0,
                received_bytes INTEGER NOT NULL DEFAULT 0,
                state TEXT NOT NULL,
                start_time INTEGER NOT NULL,
                end_time INTEGER,
                mime_type TEXT,
                file_exists INTEGER NOT NULL DEFAULT 1,
                created_at INTEGER NOT NULL
            )
        `);
        
        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_tabs_profile_id ON tabs(profile_id);
            CREATE INDEX IF NOT EXISTS idx_tabs_position ON tabs(profile_id, position);
            CREATE INDEX IF NOT EXISTS idx_bookmarks_profile_id ON bookmarks(profile_id);
            CREATE INDEX IF NOT EXISTS idx_downloads_profile_id ON downloads(profile_id);
            CREATE INDEX IF NOT EXISTS idx_downloads_state ON downloads(state);
        `);
        
        // Cleanup orphaned downloads (downloads that were interrupted by app close)
        console.log('🧹 Cleaning up orphaned downloads...');
        const orphanedDownloads = db.prepare(`
            SELECT * FROM downloads 
            WHERE state IN ('progressing', 'paused') 
            AND (julianday('now') - julianday(start_time/1000, 'unixepoch')) > 1
        `).all();
        
        if (orphanedDownloads.length > 0) {
            console.log(`Found ${orphanedDownloads.length} orphaned downloads`);
            
            // Mark as failed or keep as paused for manual resume
            const updateStmt = db.prepare(`
                UPDATE downloads 
                SET state = 'interrupted', end_time = ? 
                WHERE state IN ('progressing', 'paused')
                AND (julianday('now') - julianday(start_time/1000, 'unixepoch')) > 1
            `);
            updateStmt.run(Date.now());
            
            console.log('✅ Orphaned downloads marked as interrupted');
        }
        
        console.log('✅ Database initialized successfully');
        return db;
    } catch (error) {
        console.error('❌ Failed to initialize database:', error);
        throw error;
    }
}

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
ipcMain.handle('http-request', async (event, options) => {
    return new Promise((resolve, reject) => {
        try {
            const {
                method = 'GET',
                url,
                data,
                headers = {},
                timeout = 10000,
                withCredentials = true
            } = options;

            const urlObj = new URL(url);
            const isHttps = urlObj.protocol === 'https:';
            const httpModule = isHttps ? https : http;

            const defaultHeaders = {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'User-Agent': 'VisualBox/1.0 (Electron)'
            };

            const requestHeaders = { ...defaultHeaders, ...headers };

            let requestBody = '';
            if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
                if (typeof data === 'object') {
                    requestBody = JSON.stringify(data);
                } else {
                    requestBody = data;
                }
                requestHeaders['Content-Length'] = Buffer.byteLength(requestBody);
            }

            const requestOptions = {
                hostname: urlObj.hostname,
                port: urlObj.port || (isHttps ? 443 : 80),
                path: urlObj.pathname + urlObj.search,
                method: method.toUpperCase(),
                headers: requestHeaders,
                timeout: timeout
            };

            const req = httpModule.request(requestOptions, (res) => {
                let responseData = '';

                res.on('data', (chunk) => {
                    responseData += chunk;
                });

                res.on('end', () => {
                    try {
                        let parsedData;
                        try {
                            parsedData = JSON.parse(responseData);
                        } catch (e) {
                            parsedData = responseData;
                        }

                        const response = {
                            data: parsedData,
                            status: res.statusCode,
                            statusText: res.statusMessage,
                            headers: res.headers,
                            config: options
                        };

                        if (res.statusCode >= 400) {
                            const error = new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`);
                            error.response = response;
                            error.status = res.statusCode;
                            error.statusCode = res.statusCode;
                            error.statusText = res.statusMessage;
                            reject(error);
                        } else {
                            resolve(response);
                        }
                    } catch (parseError) {
                        reject(parseError);
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            if (requestBody) {
                req.write(requestBody);
            }

            req.end();

        } catch (error) {
            reject(error);
        }
    });
});

if (process.defaultApp) {
    if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient('visualbox', process.execPath, [path.resolve(process.argv[1])]);
    }
} else {
    app.setAsDefaultProtocolClient('visualbox');
}

let mainWindow;
let tray = null;
let isQuitting = false;

const createTray = () => {
    const iconPath = path.join(__dirname, '..', 'public', 'icon.png');
    const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });

    tray = new Tray(trayIcon);
    tray.setToolTip('VisualBox Browser');

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Show VisualBox',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                }
            }
        },
        {
            label: 'Hide VisualBox',
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
    if (isDevEnvironment) {
        app.commandLine.appendSwitch('disable-http-cache');
        app.commandLine.appendSwitch('disk-cache-size', '0');
    }

    app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');

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
        frame: false, // Custom title bar
        show: false,
    })

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
            label: 'Muat Ulang',
            click: () => {
                event.sender.send('reload-webview');
            }
        });

        const menu = Menu.buildFromTemplate(template);
        menu.popup();
    });

    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow.hide();

            if (process.platform === 'win32') {
                try {
                    tray.displayBalloon({
                        title: 'VisualBox',
                        content: 'VisualBox is still running in the background. Click the tray icon to open.',
                        icon: path.join(__dirname, '..', 'public', 'icon.ico')
                    });
                } catch (e) {
                    // Ignore balloon errors
                }
            }
        }
        return false;
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

        mainWindow.webContents.on("did-frame-finish-load", () => {
            mainWindow.webContents.openDevTools();
        });

        log('Electron running in dev mode: 🧪')

    } else {
        mainWindow.loadFile(path.join(__dirname, 'build', 'index.html'));
        log('Electron running in prod mode: 🚀')
    }
}

ipcMain.on('update-badge-count', (event, count) => {
    if (tray) {
        if (count > 0) {
            tray.setToolTip(`VisualBox (${count} unread)`);

            if (process.platform === 'win32' && mainWindow) {
                mainWindow.setOverlayIcon(
                    nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='),
                    count.toString()
                );
            }
        } else {
            tray.setToolTip('VisualBox Browser');
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
                title: title || 'VisualBox',
                content: body || '',
                icon: path.join(__dirname, '..', 'public', 'icon.png')
            });
        }
    }
});

// ============================================================================
// DATABASE API - SQLite operations for local data
// ============================================================================

// Profile Colors
ipcMain.handle('db-save-profile-color', async (event, profileId, color) => {
    try {
        if (!db) return { success: false, error: 'Database not initialized' };
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO profile_colors (profile_id, color, updated_at)
            VALUES (?, ?, ?)
        `);
        stmt.run(profileId, color, Date.now());
        return { success: true };
    } catch (error) {
        console.error('db-save-profile-color error:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db-get-profile-color', async (event, profileId) => {
    try {
        if (!db) return { success: false, error: 'Database not initialized', color: null };
        const stmt = db.prepare('SELECT color FROM profile_colors WHERE profile_id = ?');
        const row = stmt.get(profileId);
        return { success: true, color: row ? row.color : null };
    } catch (error) {
        console.error('db-get-profile-color error:', error);
        return { success: false, error: error.message, color: null };
    }
});

ipcMain.handle('db-delete-profile-color', async (event, profileId) => {
    try {
        if (!db) return { success: false, error: 'Database not initialized' };
        const stmt = db.prepare('DELETE FROM profile_colors WHERE profile_id = ?');
        stmt.run(profileId);
        return { success: true };
    } catch (error) {
        console.error('db-delete-profile-color error:', error);
        return { success: false, error: error.message };
    }
});

// App Settings
ipcMain.handle('db-save-setting', async (event, key, value) => {
    try {
        if (!db) return { success: false, error: 'Database not initialized' };
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO app_settings (key, value, updated_at)
            VALUES (?, ?, ?)
        `);
        stmt.run(key, JSON.stringify(value), Date.now());
        return { success: true };
    } catch (error) {
        console.error('db-save-setting error:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db-get-setting', async (event, key) => {
    try {
        if (!db) return { success: false, error: 'Database not initialized', value: null };
        const stmt = db.prepare('SELECT value FROM app_settings WHERE key = ?');
        const row = stmt.get(key);
        if (!row) return { success: true, value: null };
        try {
            return { success: true, value: JSON.parse(row.value) };
        } catch {
            return { success: true, value: row.value };
        }
    } catch (error) {
        console.error('db-get-setting error:', error);
        return { success: false, error: error.message, value: null };
    }
});

ipcMain.handle('db-delete-setting', async (event, key) => {
    try {
        if (!db) return { success: false, error: 'Database not initialized' };
        const stmt = db.prepare('DELETE FROM app_settings WHERE key = ?');
        stmt.run(key);
        return { success: true };
    } catch (error) {
        console.error('db-delete-setting error:', error);
        return { success: false, error: error.message };
    }
});

// Tabs
ipcMain.handle('db-save-tabs', async (event, profileId, tabs) => {
    try {
        if (!db) return { success: false, error: 'Database not initialized' };
        
        const deleteStmt = db.prepare('DELETE FROM tabs WHERE profile_id = ?');
        const insertStmt = db.prepare(`
            INSERT INTO tabs (profile_id, url, title, favicon, position, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        // Use transaction for better performance
        const saveAll = db.transaction((profileId, tabs) => {
            deleteStmt.run(profileId);
            tabs.forEach((tab, index) => {
                insertStmt.run(
                    profileId,
                    tab.url,
                    tab.title || '',
                    tab.favicon || '',
                    index,
                    tab.isActive ? 1 : 0,
                    tab.createdAt || Date.now(),
                    Date.now()
                );
            });
        });
        
        saveAll(profileId, tabs);
        return { success: true };
    } catch (error) {
        console.error('db-save-tabs error:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db-get-tabs', async (event, profileId) => {
    try {
        if (!db) return { success: false, error: 'Database not initialized', tabs: [] };
        const stmt = db.prepare(`
            SELECT id, url, title, favicon, position, is_active as isActive, created_at as createdAt
            FROM tabs
            WHERE profile_id = ?
            ORDER BY position ASC
        `);
        const tabs = stmt.all(profileId);
        return { success: true, tabs };
    } catch (error) {
        console.error('db-get-tabs error:', error);
        return { success: false, error: error.message, tabs: [] };
    }
});

// Bookmarks
ipcMain.handle('db-add-bookmark', async (event, profileId, url, title, favicon) => {
    try {
        if (!db) return { success: false, error: 'Database not initialized' };
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO bookmarks (profile_id, url, title, favicon, created_at)
            VALUES (?, ?, ?, ?, ?)
        `);
        const result = stmt.run(profileId, url, title, favicon || '', Date.now());
        return { success: true, id: result.lastInsertRowid };
    } catch (error) {
        console.error('db-add-bookmark error:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db-remove-bookmark', async (event, profileId, url) => {
    try {
        if (!db) return { success: false, error: 'Database not initialized' };
        const stmt = db.prepare('DELETE FROM bookmarks WHERE profile_id = ? AND url = ?');
        stmt.run(profileId, url);
        return { success: true };
    } catch (error) {
        console.error('db-remove-bookmark error:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db-get-bookmarks', async (event, profileId) => {
    try {
        if (!db) return { success: false, error: 'Database not initialized', bookmarks: [] };
        const stmt = db.prepare(`
            SELECT id, url, title, favicon, created_at as createdAt
            FROM bookmarks
            WHERE profile_id = ?
            ORDER BY created_at DESC
        `);
        const bookmarks = stmt.all(profileId);
        return { success: true, bookmarks };
    } catch (error) {
        console.error('db-get-bookmarks error:', error);
        return { success: false, error: error.message, bookmarks: [] };
    }
});

ipcMain.handle('db-is-bookmarked', async (event, profileId, url) => {
    try {
        if (!db) return { success: false, error: 'Database not initialized', isBookmarked: false };
        const stmt = db.prepare('SELECT id FROM bookmarks WHERE profile_id = ? AND url = ?');
        const row = stmt.get(profileId, url);
        return { success: true, isBookmarked: !!row };
    } catch (error) {
        console.error('db-is-bookmarked error:', error);
        return { success: false, error: error.message, isBookmarked: false };
    }
});

// Downloads
ipcMain.handle('db-save-download', async (event, download) => {
    try {
        if (!db) return { success: false, error: 'Database not initialized' };
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO downloads 
            (id, profile_id, filename, url, save_path, total_bytes, received_bytes, state, start_time, end_time, mime_type, file_exists, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
            download.id,
            download.profileId || null,
            download.filename,
            download.url,
            download.savePath,
            download.totalBytes || 0,
            download.receivedBytes || 0,
            download.state,
            download.startTime,
            download.endTime || null,
            download.mimeType || '',
            download.fileExists !== false ? 1 : 0,
            download.createdAt || Date.now()
        );
        return { success: true };
    } catch (error) {
        console.error('db-save-download error:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db-get-downloads', async (event, profileId) => {
    try {
        if (!db) return { success: false, error: 'Database not initialized', downloads: [] };
        let stmt;
        let downloads;
        
        if (profileId === null || profileId === 'all') {
            // Get all downloads
            stmt = db.prepare(`
                SELECT * FROM downloads
                ORDER BY start_time DESC
                LIMIT 1000
            `);
            downloads = stmt.all();
        } else {
            // Get downloads for specific profile
            stmt = db.prepare(`
                SELECT * FROM downloads
                WHERE profile_id = ? OR profile_id IS NULL
                ORDER BY start_time DESC
                LIMIT 1000
            `);
            downloads = stmt.all(profileId);
        }
        
        return { success: true, downloads };
    } catch (error) {
        console.error('db-get-downloads error:', error);
        return { success: false, error: error.message, downloads: [] };
    }
});

ipcMain.handle('db-delete-download', async (event, id) => {
    try {
        if (!db) return { success: false, error: 'Database not initialized' };
        const stmt = db.prepare('DELETE FROM downloads WHERE id = ?');
        stmt.run(id);
        return { success: true };
    } catch (error) {
        console.error('db-delete-download error:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db-clear-downloads', async (event, profileId) => {
    try {
        if (!db) return { success: false, error: 'Database not initialized' };
        let stmt;
        
        if (profileId === null || profileId === 'all') {
            stmt = db.prepare('DELETE FROM downloads');
            stmt.run();
        } else {
            stmt = db.prepare('DELETE FROM downloads WHERE profile_id = ?');
            stmt.run(profileId);
        }
        
        return { success: true };
    } catch (error) {
        console.error('db-clear-downloads error:', error);
        return { success: false, error: error.message };
    }
});

// File operations
ipcMain.handle('file-exists', async (event, filePath) => {
    try {
        return { success: true, exists: fs.existsSync(filePath) };
    } catch (error) {
        console.error('file-exists error:', error);
        return { success: false, exists: false, error: error.message };
    }
});

ipcMain.handle('open-file-location', async (event, filePath) => {
    try {
        shell.showItemInFolder(filePath);
        return { success: true };
    } catch (error) {
        console.error('open-file-location error:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('open-file', async (event, filePath) => {
    try {
        await shell.openPath(filePath);
        return { success: true };
    } catch (error) {
        console.error('open-file error:', error);
        return { success: false, error: error.message };
    }
});

// ============================================================================
// SAFE STORAGE API - Secure token storage using Electron's built-in encryption
// ============================================================================

ipcMain.handle('safe-storage-set', async (event, key, value) => {
    try {
        if (!safeStorage.isEncryptionAvailable()) {
            throw new Error('Encryption not available');
        }
        const encrypted = safeStorage.encryptString(value);
        const store = getSecureStore();
        store.set(key, encrypted.toString('base64'));
        return { success: true };
    } catch (error) {
        console.error('safeStorage set error:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('safe-storage-get', async (event, key) => {
    try {
        if (!safeStorage.isEncryptionAvailable()) {
            throw new Error('Encryption not available');
        }
        const store = getSecureStore();
        const encrypted = store.get(key);
        if (!encrypted) return { success: true, value: null };
        
        const buffer = Buffer.from(encrypted, 'base64');
        const decrypted = safeStorage.decryptString(buffer);
        return { success: true, value: decrypted };
    } catch (error) {
        console.error('safeStorage get error:', error);
        return { success: false, error: error.message, value: null };
    }
});

ipcMain.handle('safe-storage-remove', async (event, key) => {
    try {
        const store = getSecureStore();
        store.delete(key);
        return { success: true };
    } catch (error) {
        console.error('safeStorage remove error:', error);
        return { success: false, error: error.message };
    }
});

// ============================================================================
// DEEP LINK HANDLER - OAuth callback
// ============================================================================

async function handleDeepLink(url) {
    try {
        const urlObj = new URL(url);

        if (urlObj.protocol === 'visualbox:' && urlObj.hostname === 'auth') {
            const token = urlObj.searchParams.get('token');
            const workspace = urlObj.searchParams.get('workspace') || 'default';

            if (token) {
                // Store token using safeStorage
                if (safeStorage.isEncryptionAvailable()) {
                    const store = getSecureStore();
                    const encrypted = safeStorage.encryptString(token);
                    store.set(`auth_token_${workspace}`, encrypted.toString('base64'));
                }

                if (mainWindow) {
                    mainWindow.webContents.send('auth-success', {
                        token,
                        workspace
                    });

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

const { download } = require('electron-dl');
const fs = require('fs-extra');

// Store active download items for cancellation
const activeDownloads = new Map(); // filename -> downloadItem
const downloadHandlerRegistered = new WeakSet(); // Track which sessions already have handlers

function handleDownload(session) {
    // Prevent duplicate registration on same session
    if (downloadHandlerRegistered.has(session)) {
        return;
    }
    downloadHandlerRegistered.add(session);
    
    session.on('will-download', (event, item, webContents) => {
        const fileName = item.getFilename();
        const url = item.getURL();
        const startTime = item.getStartTime();
        
        // Get default downloads folder
        const downloadsPath = app.getPath('downloads');
        
        // Ensure downloads folder exists (sync)
        fs.ensureDirSync(downloadsPath);
        
        let savePath = path.join(downloadsPath, fileName);
        
        // Check if file exists and auto-rename (sync)
        if (fs.existsSync(savePath)) {
            const ext = path.extname(fileName);
            const nameWithoutExt = path.basename(fileName, ext);
            
            let counter = 1;
            while (fs.existsSync(savePath)) {
                const newFileName = `${nameWithoutExt} (${counter})${ext}`;
                savePath = path.join(downloadsPath, newFileName);
                counter++;
            }
        }
        
        // Set save path IMMEDIATELY (must be sync to prevent dialog)
        item.setSavePath(savePath);
        
        const finalFileName = path.basename(savePath);
        
        // Store download item for potential cancellation
        activeDownloads.set(finalFileName, item);
        
        // Send download started event
        mainWindow.webContents.send('download-started', {
            filename: finalFileName,
            url: url,
            startTime: startTime,
            totalBytes: item.getTotalBytes(),
            savePath: savePath
        });

        item.on('updated', (event, state) => {
            if (state === 'interrupted') {
                log('Download is interrupted but can be resumed')
            } else if (state === 'progressing') {
                if (item.isPaused()) {
                    log('Download is paused')
                    mainWindow.webContents.send('download-paused', {
                        filename: finalFileName,
                        state: 'paused'
                    });
                } else {
                    mainWindow.webContents.send('download-progress', {
                        filename: finalFileName,
                        receivedBytes: item.getReceivedBytes(),
                        totalBytes: item.getTotalBytes(),
                        state: 'progressing'
                    });
                }
            }
        })
        
        item.once('done', (event, state) => {
            // Remove from active downloads when done
            activeDownloads.delete(finalFileName);
            
            if (state === 'completed') {
                log('Download successfully')
                mainWindow.webContents.send('download-completed', {
                    filename: finalFileName,
                    state: 'completed',
                    savePath: item.getSavePath()
                });
            } else if (state === 'cancelled') {
                log('Download cancelled by user')
                // Clean up partial file if exists (async is ok here)
                fs.remove(savePath).catch(err => {
                    console.error('Failed to remove cancelled download:', err);
                });
                mainWindow.webContents.send('download-cancelled', {
                    filename: finalFileName,
                    state: 'cancelled'
                });
            } else {
                log(`Download failed: ${state}`)
                mainWindow.webContents.send('download-failed', {
                    filename: finalFileName,
                    state: state
                });
            }
        })
    });
}

// IPC handler to cancel download
ipcMain.handle('cancel-download', async (event, filename) => {
    try {
        console.log('🔴 Cancel request for:', filename);
        const downloadItem = activeDownloads.get(filename);
        
        if (!downloadItem) {
            console.log('❌ Download item not found in activeDownloads');
            console.log('📋 Active downloads:', Array.from(activeDownloads.keys()));
            return { success: false, error: 'Download not found' };
        }
        
        console.log('📊 Download state:', {
            isPaused: downloadItem.isPaused(),
            state: downloadItem.getState()
        });
        
        downloadItem.cancel();
        activeDownloads.delete(filename);
        console.log('✅ Download cancelled successfully');
        return { success: true };
    } catch (error) {
        console.error('❌ cancel-download error:', error);
        return { success: false, error: error.message };
    }
});

// IPC handler to pause download
ipcMain.handle('pause-download', async (event, filename) => {
    try {
        console.log('🔵 Pause request for:', filename);
        const downloadItem = activeDownloads.get(filename);
        
        if (!downloadItem) {
            console.log('❌ Download item not found in activeDownloads');
            console.log('📋 Active downloads:', Array.from(activeDownloads.keys()));
            return { success: false, error: 'Download not found' };
        }
        
        console.log('📊 Download state:', {
            isPaused: downloadItem.isPaused(),
            canResume: downloadItem.canResume(),
            state: downloadItem.getState()
        });
        
        if (downloadItem.isPaused()) {
            console.log('⚠️ Download already paused');
            return { success: false, error: 'Download already paused' };
        }
        
        downloadItem.pause();
        console.log('✅ Download paused successfully');
        return { success: true };
    } catch (error) {
        console.error('❌ pause-download error:', error);
        return { success: false, error: error.message };
    }
});

// IPC handler to resume download
ipcMain.handle('resume-download', async (event, filename) => {
    try {
        console.log('🟢 Resume request for:', filename);
        const downloadItem = activeDownloads.get(filename);
        
        if (!downloadItem) {
            console.log('❌ Download item not found in activeDownloads');
            console.log('📋 Active downloads:', Array.from(activeDownloads.keys()));
            return { success: false, error: 'Download not found' };
        }
        
        console.log('📊 Download state:', {
            isPaused: downloadItem.isPaused(),
            canResume: downloadItem.canResume(),
            state: downloadItem.getState()
        });
        
        if (!downloadItem.isPaused()) {
            console.log('⚠️ Download is not paused');
            return { success: false, error: 'Download is not paused' };
        }
        
        if (!downloadItem.canResume()) {
            console.log('⚠️ Download cannot be resumed (server may not support resume)');
            return { success: false, error: 'Download cannot be resumed - server does not support resume' };
        }
        
        downloadItem.resume();
        console.log('✅ Download resumed successfully');
        return { success: true };
    } catch (error) {
        console.error('❌ resume-download error:', error);
        return { success: false, error: error.message };
    }
});

function handlePermissions(session) {
    session.setPermissionRequestHandler((webContents, permission, callback) => {
        const url = webContents.getURL();

        const allowedPermissions = ['media', 'geolocation', 'notifications', 'fullscreen'];

        if (allowedPermissions.includes(permission)) {
            callback(true);
        } else {
            console.log(`Permission denied: ${permission} for ${url}`);
            callback(false);
        }
    });
}

app.on('ready', () => {
    // Initialize database first
    initDatabase();
    
    createTray();
    createWindow();

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
        checkForNewVersion();
        setInterval(checkForNewVersion, VERSION_CHECK_INTERVAL);
    }, 5000);

    // Register download handler for default session
    handleDownload(session.defaultSession);

    app.on('web-contents-created', (event, contents) => {
        if (contents.getType() === 'webview') {
            contents.on('new-window', (e, url) => {
                e.preventDefault();
            });

            const ses = contents.session;
            if (ses) {
                // Register download handler for webview session too
                handleDownload(ses);
                handlePermissions(ses);
            }
        }
    });
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    } else if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
    }
})

app.on('window-all-closed', (e) => {
    e.preventDefault();
});

app.on('before-quit', () => {
    isQuitting = true;
    
    // Save all active downloads state before quit
    console.log('💾 Saving active downloads before quit...');
    activeDownloads.forEach((item, filename) => {
        if (!item.isPaused() && item.getState() === 'progressing') {
            // Pause download before quit so it can be resumed later
            try {
                item.pause();
                console.log(`⏸️ Paused download: ${filename}`);
            } catch (err) {
                console.error(`Failed to pause ${filename}:`, err);
            }
        }
    });
});

app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    event.preventDefault();
    callback(true);
});

app.on('open-url', (event, url) => {
    event.preventDefault();
    handleDeepLink(url);
});

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }

        const url = commandLine.find((arg) => arg.startsWith('visualbox://'));
        if (url) {
            handleDeepLink(url);
        }
    });
}