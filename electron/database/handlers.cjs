const { ipcMain, app, nativeTheme } = require('electron');
const { getDatabase } = require('./index.cjs');

function registerDatabaseHandlers() {
    const db = getDatabase();
    
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

            // When theme setting changes, update Electron's nativeTheme immediately.
            // This ensures window backgrounds, prefers-color-scheme, and scrollbars
            // update across ALL windows (main + children + webviews).
            if (key === 'theme') {
                const themeValue = value === 'light' || value === 'dark' ? value : 'system';
                nativeTheme.themeSource = themeValue;

                // Broadcast to all running webContents (includes webviews) so they can
                // live-update their prefers-color-scheme override without a reload.
                const { webContents } = require('electron');
                webContents.getAllWebContents().forEach(wc => {
                    try { wc.send('webview-theme-changed', themeValue); } catch (_) {}
                });
            }

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

    // Synchronous theme getter — used by webview preload to override
    // prefers-color-scheme BEFORE the page's CSS is evaluated.
    ipcMain.on('get-theme-sync', (event) => {
        try {
            if (!db) { event.returnValue = 'light'; return; }
            const stmt = db.prepare('SELECT value FROM app_settings WHERE key = ?');
            const row = stmt.get('theme');
            if (!row) { event.returnValue = 'light'; return; }
            try {
                event.returnValue = JSON.parse(row.value);
            } catch {
                event.returnValue = row.value;
            }
        } catch (error) {
            event.returnValue = 'light';
        }
    });

    // Synchronous helper to determine if resolved theme is dark (handles 'system' setting automatically)
    ipcMain.on('get-resolved-theme-is-dark', (event) => {
        try {
            if (!db) { event.returnValue = false; return; }
            const stmt = db.prepare('SELECT value FROM app_settings WHERE key = ?');
            const row = stmt.get('theme');
            let themeValue = 'light';
            if (row) {
                try {
                    themeValue = JSON.parse(row.value);
                } catch {
                    themeValue = row.value;
                }
            }
            if (themeValue === 'dark') {
                event.returnValue = true;
            } else if (themeValue === 'system') {
                event.returnValue = nativeTheme.shouldUseDarkColors;
            } else {
                event.returnValue = false;
            }
        } catch (error) {
            event.returnValue = false;
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
                (id, gid, profile_id, filename, url, save_path, total_bytes, received_bytes, download_speed, state, start_time, end_time, mime_type, file_exists, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            stmt.run(
                download.id,
                download.gid || null,
                download.profileId || null,
                download.filename,
                download.url,
                download.savePath,
                download.totalBytes || 0,
                download.receivedBytes || 0,
                download.downloadSpeed || 0,
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
                // Get all downloads (exclude orphans without profile_id)
                stmt = db.prepare(`
                    SELECT * FROM downloads
                    WHERE profile_id IS NOT NULL
                    ORDER BY start_time DESC
                    LIMIT 1000
                `);
                downloads = stmt.all();
            } else {
                // Get downloads for specific profile only
                stmt = db.prepare(`
                    SELECT * FROM downloads
                    WHERE profile_id = ?
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

    // Clear ALL local data on logout (multi-user safety)
    // NOTE: 'app_settings' is EXCLUDED from cleanup — device-level settings
    // (hardware acceleration, theme, notifications, etc.) persist across user logins.
    ipcMain.handle('clear-all-local-data', async () => {
        try {
            if (!db) return { success: false, error: 'Database not initialized' };
            
            const tables = ['downloads', 'tabs', 'bookmarks', 'profile_colors', 'ai_chat_messages'];
            for (const table of tables) {
                try {
                    db.exec(`DELETE FROM ${table}`);
                } catch (e) {
                    // Table might not exist, skip
                }
            }
            return { success: true };
        } catch (error) {
            console.error('clear-all-local-data error:', error);
            return { success: false, error: error.message };
        }
    });

    // Cleanup orphaned downloads (no profile_id) - called on app start
    ipcMain.handle('cleanup-orphan-downloads', async () => {
        try {
            if (!db) return { success: false, error: 'Database not initialized' };

            const stmt = db.prepare('DELETE FROM downloads WHERE profile_id IS NULL');
            const result = stmt.run();

            return { success: true, removed: result.changes };
        } catch (error) {
            console.error('cleanup-orphan-downloads error:', error);
            return { success: false, error: error.message };
        }
    });

    // Passwords - stored per profile
    ipcMain.handle('db-get-passwords', async (event, profileId) => {
        try {
            if (!db) return { success: false, error: 'Database not initialized', passwords: [] };
            const stmt = db.prepare(`
                SELECT id, profile_id, title, url, username, password_encrypted, notes, favicon,
                       created_at as createdAt, updated_at as updatedAt
                FROM passwords
                WHERE profile_id = ?
                ORDER BY title ASC
            `);
            const passwords = stmt.all(profileId);
            return { success: true, passwords };
        } catch (error) {
            console.error('db-get-passwords error:', error);
            return { success: false, error: error.message, passwords: [] };
        }
    });

    ipcMain.handle('db-get-password', async (event, id) => {
        try {
            if (!db) return { success: false, error: 'Database not initialized', password: null };
            const stmt = db.prepare(`
                SELECT id, profile_id, title, url, username, password_encrypted, notes, favicon,
                       created_at as createdAt, updated_at as updatedAt
                FROM passwords WHERE id = ?
            `);
            const row = stmt.get(id);
            return { success: true, password: row || null };
        } catch (error) {
            console.error('db-get-password error:', error);
            return { success: false, error: error.message, password: null };
        }
    });

    ipcMain.handle('db-save-password', async (event, passwordData) => {
        try {
            if (!db) return { success: false, error: 'Database not initialized' };
            const {
                id = null, profile_id, title, url = '', username = '',
                password_encrypted, notes = '', favicon = ''
            } = passwordData;

            if (id) {
                // Update existing
                const stmt = db.prepare(`
                    UPDATE passwords
                    SET title = ?, url = ?, username = ?, password_encrypted = ?, notes = ?, favicon = ?, updated_at = ?
                    WHERE id = ? AND profile_id = ?
                `);
                stmt.run(title, url, username, password_encrypted, notes, favicon, Date.now(), id, profile_id);
            } else {
                // Insert new
                const crypto = require('crypto');
                const newId = crypto.randomUUID();
                const now = Date.now();
                const stmt = db.prepare(`
                    INSERT INTO passwords (id, profile_id, title, url, username, password_encrypted, notes, favicon, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);
                stmt.run(newId, profile_id, title, url, username, password_encrypted, notes, favicon, now, now);
            }
            return { success: true };
        } catch (error) {
            console.error('db-save-password error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('db-delete-password', async (event, id) => {
        try {
            if (!db) return { success: false, error: 'Database not initialized' };
            const stmt = db.prepare('DELETE FROM passwords WHERE id = ?');
            stmt.run(id);
            return { success: true };
        } catch (error) {
            console.error('db-delete-password error:', error);
            return { success: false, error: error.message };
        }
    });

    // AI Chat Messages
    ipcMain.handle('db-save-ai-message', async (event, profileId, message) => {
        try {
            if (!db) return { success: false, error: 'Database not initialized' };
            const stmt = db.prepare(`
                INSERT OR REPLACE INTO ai_chat_messages (id, profile_id, role, content, model, pricing_json, is_error, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            // Convert timestamp to milliseconds if it's a Date object or string
            let timestamp;
            if (message.timestamp instanceof Date) {
                timestamp = message.timestamp.getTime();
            } else if (typeof message.timestamp === 'string') {
                timestamp = new Date(message.timestamp).getTime();
            } else if (typeof message.timestamp === 'number') {
                timestamp = message.timestamp;
            } else {
                timestamp = Date.now();
            }
            
            stmt.run(
                message.id,
                profileId,
                message.role,
                message.content,
                message.model || null,
                message.pricing ? JSON.stringify(message.pricing) : null,
                message.isError ? 1 : 0,
                timestamp
            );
            return { success: true };
        } catch (error) {
            console.error('db-save-ai-message error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('db-get-ai-messages', async (event, profileId) => {
        try {
            if (!db) return { success: false, error: 'Database not initialized', messages: [] };
            const stmt = db.prepare(`
                SELECT id, role, content, model, pricing_json, is_error as isError, created_at as timestamp
                FROM ai_chat_messages
                WHERE profile_id = ?
                ORDER BY created_at ASC
            `);
            const messages = stmt.all(profileId);
            
            // Parse pricing JSON
            const parsedMessages = messages.map(msg => ({
                ...msg,
                pricing: msg.pricing_json ? JSON.parse(msg.pricing_json) : null,
                isError: msg.isError === 1,
                timestamp: new Date(msg.timestamp)
            }));
            
            return { success: true, messages: parsedMessages };
        } catch (error) {
            console.error('db-get-ai-messages error:', error);
            return { success: false, error: error.message, messages: [] };
        }
    });

    ipcMain.handle('db-clear-ai-messages', async (event, profileId) => {
        try {
            if (!db) return { success: false, error: 'Database not initialized' };
            const stmt = db.prepare('DELETE FROM ai_chat_messages WHERE profile_id = ?');
            stmt.run(profileId);
            return { success: true };
        } catch (error) {
            console.error('db-clear-ai-messages error:', error);
            return { success: false, error: error.message };
        }
    });
}

module.exports = { registerDatabaseHandlers };
