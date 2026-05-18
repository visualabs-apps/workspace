const { ipcMain, app } = require('electron');
const { getDatabase } = require('../database/index.cjs');

let _isDevEnvironment = false;

function registerSettingsHandlers(isDevEnvironment = false) {
    const db = getDatabase();
    _isDevEnvironment = isDevEnvironment;
    
    // Show Notifications
    ipcMain.handle('settings-show-notifications', async (event, enabled) => {
        try {
            // Save to database
            if (db) {
                const stmt = db.prepare(`
                    INSERT OR REPLACE INTO app_settings (key, value, updated_at)
                    VALUES (?, ?, ?)
                `);
                stmt.run('showNotifications', JSON.stringify(enabled), Date.now());
            }
            
            return { success: true, enabled };
        } catch (error) {
            console.error('settings-show-notifications error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('settings-get-show-notifications', async (event) => {
        try {
            if (!db) return { success: true, enabled: true };
            
            const stmt = db.prepare('SELECT value FROM app_settings WHERE key = ?');
            const row = stmt.get('showNotifications');
            
            if (!row) return { success: true, enabled: true }; // Default to true
            
            try {
                const enabled = JSON.parse(row.value);
                return { success: true, enabled };
            } catch {
                return { success: true, enabled: true };
            }
        } catch (error) {
            console.error('settings-get-show-notifications error:', error);
            return { success: false, error: error.message, enabled: true };
        }
    });

    // Tab Lifetime
    ipcMain.handle('settings-tab-lifetime', async (event, minutes) => {
        try {
            // Save to database
            if (db) {
                const stmt = db.prepare(`
                    INSERT OR REPLACE INTO app_settings (key, value, updated_at)
                    VALUES (?, ?, ?)
                `);
                stmt.run('tabLifetime', JSON.stringify(minutes), Date.now());
            }
            
            return { success: true, minutes };
        } catch (error) {
            console.error('settings-tab-lifetime error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('settings-get-tab-lifetime', async (event) => {
        try {
            if (!db) return { success: true, minutes: '30' }; // Default 30 minutes
            
            const stmt = db.prepare('SELECT value FROM app_settings WHERE key = ?');
            const row = stmt.get('tabLifetime');
            
            if (!row) return { success: true, minutes: '30' }; // Default 30 minutes
            
            try {
                const minutes = JSON.parse(row.value);
                return { success: true, minutes };
            } catch {
                return { success: true, minutes: '30' };
            }
        } catch (error) {
            console.error('settings-get-tab-lifetime error:', error);
            return { success: false, error: error.message, minutes: '30' };
        }
    });

    // Default Search Engine
    ipcMain.handle('settings-default-search-engine', async (event, engine) => {
        try {
            // Save to database
            if (db) {
                const stmt = db.prepare(`
                    INSERT OR REPLACE INTO app_settings (key, value, updated_at)
                    VALUES (?, ?, ?)
                `);
                stmt.run('defaultSearchEngine', JSON.stringify(engine), Date.now());
            }
            
            return { success: true, engine };
        } catch (error) {
            console.error('settings-default-search-engine error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('settings-get-default-search-engine', async (event) => {
        try {
            if (!db) return { success: true, engine: 'google' }; // Default google
            
            const stmt = db.prepare('SELECT value FROM app_settings WHERE key = ?');
            const row = stmt.get('defaultSearchEngine');
            
            if (!row) return { success: true, engine: 'google' }; // Default google
            
            try {
                const engine = JSON.parse(row.value);
                return { success: true, engine };
            } catch {
                return { success: true, engine: 'google' };
            }
        } catch (error) {
            console.error('settings-get-default-search-engine error:', error);
            return { success: false, error: error.message, engine: 'google' };
        }
    });

    // Auto Start (Open at Login)
    ipcMain.handle('settings-set-auto-start', async (event, enabled) => {
        try {
            // Set the app to open at login using Electron's built-in API
            app.setLoginItemSettings({
                openAtLogin: enabled,
                path: app.getPath('exe'),
            });

            // Also persist the setting to database for UI state
            if (db) {
                const stmt = db.prepare(`
                    INSERT OR REPLACE INTO app_settings (key, value, updated_at)
                    VALUES (?, ?, ?)
                `);
                stmt.run('autoStart', JSON.stringify(enabled), Date.now());
            }

            return { success: true, enabled };
        } catch (error) {
            console.error('settings-set-auto-start error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('settings-get-auto-start', async (event) => {
        try {
            // Get the actual system state from Electron
            const loginItemSettings = app.getLoginItemSettings();

            // Also check database for persisted preference
            let dbEnabled = null;
            if (db) {
                const stmt = db.prepare('SELECT value FROM app_settings WHERE key = ?');
                const row = stmt.get('autoStart');
                if (row) {
                    try {
                        dbEnabled = JSON.parse(row.value);
                    } catch {
                        dbEnabled = null;
                    }
                }
            }

            // Use system state as source of truth
            const enabled = loginItemSettings.openAtLogin;

            // Sync database with actual system state if they differ
            if (dbEnabled !== null && dbEnabled !== enabled && db) {
                const stmt = db.prepare(`
                    INSERT OR REPLACE INTO app_settings (key, value, updated_at)
                    VALUES (?, ?, ?)
                `);
                stmt.run('autoStart', JSON.stringify(enabled), Date.now());
            }

            return { success: true, enabled };
        } catch (error) {
            console.error('settings-get-auto-start error:', error);
            return { success: false, error: error.message, enabled: false };
        }
    });
    // Developer Mode
    ipcMain.handle('settings-set-developer-mode', async (event, enabled) => {
        try {
            if (db) {
                const stmt = db.prepare(`
                    INSERT OR REPLACE INTO app_settings (key, value, updated_at)
                    VALUES (?, ?, ?)
                `);
                stmt.run('developerMode', JSON.stringify(enabled), Date.now());
            }
            return { success: true, enabled };
        } catch (error) {
            console.error('settings-set-developer-mode error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('settings-get-developer-mode', async (event) => {
        try {
            const defaultEnabled = _isDevEnvironment;
            if (!db) return { success: true, enabled: defaultEnabled };
            const stmt = db.prepare('SELECT value FROM app_settings WHERE key = ?');
            const row = stmt.get('developerMode');
            if (!row) return { success: true, enabled: defaultEnabled };
            try {
                const enabled = JSON.parse(row.value);
                return { success: true, enabled };
            } catch {
                return { success: true, enabled: defaultEnabled };
            }
        } catch (error) {
            console.error('settings-get-developer-mode error:', error);
            return { success: false, error: error.message, enabled: _isDevEnvironment };
        }
    });
}

module.exports = { registerSettingsHandlers, isDeveloperModeEnabled };

// Check if developer mode is currently enabled (reads from DB)
async function isDeveloperModeEnabled() {
    try {
        const db = getDatabase();
        if (!db) return _isDevEnvironment;
        const stmt = db.prepare('SELECT value FROM app_settings WHERE key = ?');
        const row = stmt.get('developerMode');
        if (!row) return _isDevEnvironment;
        return JSON.parse(row.value);
    } catch {
        return _isDevEnvironment;
    }
}
