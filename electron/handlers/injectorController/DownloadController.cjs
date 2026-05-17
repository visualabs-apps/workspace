const fsSync = require('fs');
const { v4: uuidv4 } = require('uuid');

class DownloadController {
    static async addToDownloads(event, fileInfo, getMainWindow) {
        try {
            
            const { getDatabase } = require('../../database/index.cjs');
            const db = getDatabase();
            const now = Date.now();
            
            if (!fsSync.existsSync(fileInfo.filepath)) {
                console.error('❌ File not found:', fileInfo.filepath);
                return { success: false, error: 'File not found' };
            }
            
            const stats = fsSync.statSync(fileInfo.filepath);
            const fileSize = stats.size;
            
            const downloadId = uuidv4();
            
            // Try to get profile_id from fileInfo or workspace context
            const profileId = fileInfo.profile_id || fileInfo.workspaceId || null;
            
            if (profileId) {
                db.prepare(`
                    INSERT INTO downloads (
                        id, profile_id, filename, url, save_path, total_bytes, received_bytes,
                        state, start_time, end_time, created_at, file_exists
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                    downloadId,
                    profileId,
                    fileInfo.filename,
                    fileInfo.url || 'vbox://script-injector',
                    fileInfo.filepath,
                    fileSize,
                    fileSize,
                    'complete',
                    now,
                    now,
                    now,
                    1
                );
            } else {
                // Insert without profile_id (backward compatible)
                db.prepare(`
                    INSERT INTO downloads (
                        id, filename, url, save_path, total_bytes, received_bytes,
                        state, start_time, end_time, created_at, file_exists
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                    downloadId,
                    fileInfo.filename,
                    fileInfo.url || 'vbox://script-injector',
                    fileInfo.filepath,
                    fileSize,
                    fileSize,
                    'complete',
                    now,
                    now,
                    now,
                    1
                );
            }
            
            
            const mainWindow = typeof getMainWindow === 'function' ? getMainWindow() : getMainWindow;
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('download-added', {
                    id: downloadId,
                    filename: fileInfo.filename,
                    save_path: fileInfo.filepath,
                    total_bytes: fileSize,
                    state: 'complete'
                });
            }
            
            return { success: true, filesize: fileSize, id: downloadId };
        } catch (error) {
            console.error('❌ Failed to add to download manager:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = { DownloadController };
