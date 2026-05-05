const { ipcMain, app } = require('electron');
const { getDatabase } = require('../database/index.cjs');

function registerSettingsHandlers() {
    const db = getDatabase();
    
    // Launch on Startup
    ipcMain.handle('settings-launch-on-startup', async (event, enabled) => {
        try {
            app.setLoginItemSettings({
                openAtLogin: enabled,
                openAsHidden: false
            });
            
            // Save to database for persistence
            if (db) {
                const stmt = db.prepare(`
                    INSERT OR REPLACE INTO app_settings (key, value, updated_at)
                    VALUES (?, ?, ?)
                `);
                stmt.run('launchOnStartup', JSON.stringify(enabled), Date.now());
            }
            
            return { success: true, enabled };
        } catch (error) {
            console.error('settings-launch-on-startup error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('settings-get-launch-on-startup', async (event) => {
        try {
            const loginSettings = app.getLoginItemSettings();
            return { success: true, enabled: loginSettings.openAtLogin };
        } catch (error) {
            console.error('settings-get-launch-on-startup error:', error);
            return { success: false, error: error.message, enabled: false };
        }
    });

    // Minimize to Tray
    ipcMain.handle('settings-minimize-to-tray', async (event, enabled) => {
        try {
            // Save to database
            if (db) {
                const stmt = db.prepare(`
                    INSERT OR REPLACE INTO app_settings (key, value, updated_at)
                    VALUES (?, ?, ?)
                `);
                stmt.run('minimizeToTray', JSON.stringify(enabled), Date.now());
            }
            
            return { success: true, enabled };
        } catch (error) {
            console.error('settings-minimize-to-tray error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('settings-get-minimize-to-tray', async (event) => {
        try {
            if (!db) return { success: true, enabled: false };
            
            const stmt = db.prepare('SELECT value FROM app_settings WHERE key = ?');
            const row = stmt.get('minimizeToTray');
            
            if (!row) return { success: true, enabled: false };
            
            try {
                const enabled = JSON.parse(row.value);
                return { success: true, enabled };
            } catch {
                return { success: true, enabled: false };
            }
        } catch (error) {
            console.error('settings-get-minimize-to-tray error:', error);
            return { success: false, error: error.message, enabled: false };
        }
    });

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
}

module.exports = { registerSettingsHandlers };
