const { ipcMain, app, shell, dialog } = require('electron');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../database/index.cjs');

// Store active aria2 downloads
const aria2Downloads = new Map(); // gid -> download info
const downloadHandlerRegistered = new WeakSet(); // Track which sessions already have handlers

function registerDownloadHandlers(aria2, mainWindow) {
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

    ipcMain.handle('get-downloads-path', async () => {
        try {
            return { success: true, path: app.getPath('downloads') };
        } catch (error) {
            console.error('get-downloads-path error:', error);
            return { success: false, error: error.message, path: '' };
        }
    });

    // Cancel download (aria2)
    ipcMain.handle('cancel-download', async (event, gid) => {
        try {
            console.log('🔴 Cancel request for gid:', gid);
            
            if (!aria2.isReady) {
                return { success: false, error: 'aria2 is not ready' };
            }
            
            await aria2.cancel(gid);
            
            // Send cancelled event
            const info = aria2Downloads.get(gid);
            if (info && mainWindow) {
                mainWindow.webContents.send('download-cancelled', {
                    id: info.id,
                    gid: gid,
                    filename: info.filename,
                    state: 'cancelled'
                });
            }
            
            console.log('✅ Download cancelled successfully');
            return { success: true };
        } catch (error) {
            console.error('❌ cancel-download error:', error);
            return { success: false, error: error.message };
        }
    });

    // Pause download (aria2)
    ipcMain.handle('pause-download', async (event, gid) => {
        try {
            console.log('🔵 Pause request for gid:', gid);
            
            if (!aria2.isReady) {
                return { success: false, error: 'aria2 is not ready' };
            }
            
            await aria2.pause(gid);
            
            // Send paused event
            const info = aria2Downloads.get(gid);
            if (info && mainWindow) {
                mainWindow.webContents.send('download-paused', {
                    id: info.id,
                    gid: gid,
                    filename: info.filename,
                    state: 'paused'
                });
            }
            
            console.log('✅ Download paused successfully');
            return { success: true };
        } catch (error) {
            console.error('❌ pause-download error:', error);
            return { success: false, error: error.message };
        }
    });

    // Resume download (aria2)
    ipcMain.handle('resume-download', async (event, gid) => {
        try {
            console.log('🟢 Resume request for gid:', gid);
            
            if (!aria2.isReady) {
                return { success: false, error: 'aria2 is not ready' };
            }
            
            await aria2.resume(gid);
            console.log('✅ Download resumed successfully');
            return { success: true };
        } catch (error) {
            console.error('❌ resume-download error:', error);
            return { success: false, error: error.message };
        }
    });

    // Remove download file
    ipcMain.handle('remove-download-file', async (event, filePath) => {
        try {
            console.log('🗑️ Remove file request:', filePath);
            
            if (!filePath || !fs.existsSync(filePath)) {
                return { success: false, error: 'File not found' };
            }
            
            await fs.remove(filePath);
            console.log('✅ File removed successfully');
            return { success: true };
        } catch (error) {
            console.error('❌ remove-download-file error:', error);
            return { success: false, error: error.message };
        }
    });
}

function handleAria2Download(ses, aria2, mainWindow) {
    if (downloadHandlerRegistered.has(ses)) {
        console.log('⚠️ Download handler already registered for this session');
        return;
    }
    
    downloadHandlerRegistered.add(ses);
    
    const db = getDatabase();
    
    ses.on('will-download', async (event, item, webContents) => {
        try {
            const url = item.getURL();
            const totalBytes = item.getTotalBytes();
            const fileName = item.getFilename();
            
            console.log(`📥 Download intercepted: ${fileName} (${totalBytes} bytes)`);
            
            // Cancel Electron's default download
            event.preventDefault();
            
            // Show save dialog
            const downloadsPath = app.getPath('downloads');
            const { filePath: savePath, canceled } = await dialog.showSaveDialog({
                title: 'Save File',
                defaultPath: path.join(downloadsPath, fileName),
                buttonLabel: 'Save'
            });
            
            if (canceled || !savePath) {
                console.log('❌ Download cancelled by user');
                return;
            }
            
            const saveDir = path.dirname(savePath);
            const actualFilename = path.basename(savePath);
            
            // Check if file already exists and has a download entry
            if (db) {
                try {
                    const existingDownload = db.prepare(`
                        SELECT * FROM downloads 
                        WHERE save_path = ? 
                        ORDER BY start_time DESC 
                        LIMIT 1
                    `).get(savePath);
                    
                    if (existingDownload) {
                        console.log('🔄 Found existing download for this path, removing old entry');
                        
                        // Cancel old aria2 download if still active
                        if (existingDownload.gid && aria2Downloads.has(existingDownload.gid)) {
                            try {
                                await aria2.cancel(existingDownload.gid);
                                aria2Downloads.delete(existingDownload.gid);
                            } catch (e) {
                                console.log('Old download already completed or cancelled');
                            }
                        }
                        
                        // Delete old entry from database
                        db.prepare('DELETE FROM downloads WHERE id = ?').run(existingDownload.id);
                        
                        // Notify renderer to remove from UI
                        if (mainWindow) {
                            mainWindow.webContents.send('download-removed', {
                                id: existingDownload.id
                            });
                        }
                    }
                } catch (error) {
                    console.error('Error checking existing download:', error);
                }
            }
            
            // Delete existing file if it exists (user chose to replace)
            if (fs.existsSync(savePath)) {
                console.log('🗑️ Removing existing file:', savePath);
                await fs.remove(savePath);
                
                // Also remove .aria2 control file if exists
                const aria2File = savePath + '.aria2';
                if (fs.existsSync(aria2File)) {
                    await fs.remove(aria2File);
                }
            }
            
            // Generate unique ID for tracking
            const downloadId = uuidv4();
            
            // Add download to aria2
            const gid = await aria2.addDownload(url, {
                filename: actualFilename,
                dir: saveDir
            });
            
            // Store download info
            aria2Downloads.set(gid, {
                id: downloadId,
                gid: gid,
                filename: actualFilename,
                url: url,
                savePath: savePath,
                startTime: Date.now()
            });
            
            // Send download started event
            mainWindow.webContents.send('download-started', {
                id: downloadId,
                gid: gid,
                filename: actualFilename,
                url: url,
                startTime: Date.now(),
                totalBytes: totalBytes,
                savePath: savePath
            });
            
            console.log(`📥 Download started via aria2: ${actualFilename} (gid: ${gid})`);
            
        } catch (error) {
            console.error('Failed to start download:', error);
            
            // Send failure event
            if (mainWindow) {
                mainWindow.webContents.send('download-failed', {
                    filename: fileName,
                    error: error.message,
                    state: 'failed'
                });
            }
        }
    });
    
    console.log('✅ Download handler registered successfully');
}

function getAria2Downloads() {
    return aria2Downloads;
}

module.exports = { 
    registerDownloadHandlers, 
    handleAria2Download,
    getAria2Downloads
};
