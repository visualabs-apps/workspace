const { ipcMain, app, shell, dialog } = require('electron');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../database/index.cjs');

// Store active aria2 downloads
const aria2Downloads = new Map(); // gid -> download info
const downloadHandlerRegistered = new WeakSet(); // Track which sessions already have handlers
let aria2Instance = null; // Reference to aria2 manager

function registerDownloadHandlers(aria2, mainWindow) {
    aria2Instance = aria2; // Store reference
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

    ipcMain.handle('read-text-file', async (event, filePath) => {
        try {
            if (!fs.existsSync(filePath)) {
                return { success: false, error: 'File not found' };
            }
            const content = await fs.readFile(filePath, 'utf-8');
            return { success: true, content };
        } catch (error) {
            console.error('read-text-file error:', error);
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
            
            return { success: true };
        } catch (error) {
            console.error('❌ cancel-download error:', error);
            return { success: false, error: error.message };
        }
    });

    // Pause download (aria2)
    ipcMain.handle('pause-download', async (event, gid) => {
        try {
            
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
            
            return { success: true };
        } catch (error) {
            console.error('❌ pause-download error:', error);
            return { success: false, error: error.message };
        }
    });

    // Resume download (aria2)
    ipcMain.handle('resume-download', async (event, gid) => {
        try {
            
            if (!aria2.isReady) {
                return { success: false, error: 'aria2 is not ready' };
            }
            
            await aria2.resume(gid);
            return { success: true };
        } catch (error) {
            console.error('❌ resume-download error:', error);
            return { success: false, error: error.message };
        }
    });

    // Remove download file
    ipcMain.handle('remove-download-file', async (event, filePath) => {
        try {
            
            if (!filePath || !fs.existsSync(filePath)) {
                return { success: false, error: 'File not found' };
            }
            
            await fs.remove(filePath);
            return { success: true };
        } catch (error) {
            console.error('❌ remove-download-file error:', error);
            return { success: false, error: error.message };
        }
    });
}

function handleAria2Download(ses, aria2, mainWindow) {
    if (downloadHandlerRegistered.has(ses)) {
        return;
    }
    
    downloadHandlerRegistered.add(ses);
    
    const db = getDatabase();
    
    ses.on('will-download', async (event, item, webContents) => {
        try {
            const url = item.getURL();
            const totalBytes = item.getTotalBytes();
            const fileName = item.getFilename();
            const mimeType = item.getMimeType();
            
            
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
                return;
            }
            
            const saveDir = path.dirname(savePath);
            const actualFilename = path.basename(savePath);
            
            // Get cookies from the session for authenticated downloads
            let cookieHeader = '';
            let referer = '';
            try {
                const urlObj = new URL(url);
                const cookies = await ses.cookies.get({ url: urlObj.origin });
                if (cookies.length > 0) {
                    cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
                }
                // Set referer to the page origin for hotlink protection
                referer = urlObj.origin + '/';
            } catch (e) {
                // Ignore cookie extraction errors
            }
            
            // Get User-Agent from the session's web request
            const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
            
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
                        
                        // Cancel old aria2 download if still active
                        if (existingDownload.gid && aria2Downloads.has(existingDownload.gid)) {
                            try {
                                await aria2.cancel(existingDownload.gid);
                                aria2Downloads.delete(existingDownload.gid);
                            } catch (e) {
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
            const aria2Options = {
                filename: actualFilename,
                dir: saveDir
            };
            
            // Pass cookies for authenticated downloads
            if (cookieHeader) {
                aria2Options.headers = {
                    'Cookie': cookieHeader
                };
            }
            if (userAgent) {
                aria2Options.headers = aria2Options.headers || {};
                aria2Options.headers['User-Agent'] = userAgent;
            }
            if (referer) {
                aria2Options.headers = aria2Options.headers || {};
                aria2Options.headers['Referer'] = referer;
            }
            
            const gid = await aria2.addDownload(url, aria2Options);
            
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
                savePath: savePath,
                mimeType: mimeType || ''
            });
            
            
        } catch (error) {
            console.error('Failed to start download:', error);
            
            // Send failure event
            if (mainWindow) {
                mainWindow.webContents.send('download-failed', {
                    gid: null,
                    id: null,
                    filename: fileName,
                    error: error.message,
                    state: 'failed'
                });
            }
        }
    });
    
}

// Poll aria2 for download progress and completion
let pollInterval = null;

function startAria2Polling(aria2, mainWindow) {
    if (pollInterval) return; // Already polling
    
    pollInterval = setInterval(async () => {
        if (!aria2.isReady || aria2Downloads.size === 0) return;
        if (!mainWindow || mainWindow.isDestroyed()) {
            stopAria2Polling();
            return;
        }
        
        const completedGids = [];
        
        for (const [gid, info] of aria2Downloads) {
            try {
                const status = await aria2.getStatus(gid);
                
                if (!status) {
                    completedGids.push(gid);
                    continue;
                }
                
                const state = status.status; // 'active', 'waiting', 'paused', 'error', 'complete', 'removed'
                
                if (state === 'active' || state === 'waiting') {
                    // Send progress event
                    const completedLength = parseInt(status.completedLength) || 0;
                    const totalLength = parseInt(status.totalLength) || 0;
                    const downloadSpeed = parseInt(status.downloadSpeed) || 0;
                    
                    mainWindow.webContents.send('download-progress', {
                        gid: gid,
                        id: info.id,
                        receivedBytes: completedLength,
                        totalBytes: totalLength,
                        downloadSpeed: downloadSpeed,
                        state: 'progressing',
                        filename: info.filename
                    });
                } else if (state === 'complete') {
                    // Download completed
                    const completedLength = parseInt(status.completedLength) || 0;
                    const filePath = status.files && status.files[0] 
                        ? (status.files[0].path || info.savePath) 
                        : info.savePath;
                    
                    mainWindow.webContents.send('download-completed', {
                        gid: gid,
                        id: info.id,
                        filename: info.filename,
                        savePath: filePath,
                        totalBytes: completedLength,
                        url: info.url
                    });
                    
                    completedGids.push(gid);
                } else if (state === 'error') {
                    // Download failed
                    const errorCode = status.errorCode || 'unknown';
                    const errorMessage = status.errorMessage || 'Download failed';
                    
                    mainWindow.webContents.send('download-failed', {
                        gid: gid,
                        id: info.id,
                        filename: info.filename,
                        error: `Error ${errorCode}: ${errorMessage}`,
                        state: 'failed'
                    });
                    
                    completedGids.push(gid);
                } else if (state === 'removed') {
                    // Download was removed
                    completedGids.push(gid);
                }
            } catch (err) {
                // If we can't get status, the download may have been cleaned up from aria2
                completedGids.push(gid);
            }
        }
        
        // Clean up completed downloads from tracking map
        for (const gid of completedGids) {
            aria2Downloads.delete(gid);
            // Also remove from aria2's internal result list to prevent memory leak
            try {
                await aria2.removeResult(gid);
            } catch (e) {
                // Ignore - result may already be removed
            }
        }
    }, 1000); // Poll every second
}

function stopAria2Polling() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
}

function getAria2Downloads() {
    return aria2Downloads;
}

module.exports = { 
    registerDownloadHandlers, 
    handleAria2Download,
    startAria2Polling,
    stopAria2Polling,
    getAria2Downloads,
    getAria2Instance: () => aria2Instance
};
