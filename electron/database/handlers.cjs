const { ipcMain, app } = require('electron');
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
}

module.exports = { registerDatabaseHandlers };
