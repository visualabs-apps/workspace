const { ipcMain } = require('electron');
const { createChildWindow, closeChildWindow, closeAllChildWindows, getChildWindow, minimizeChildWindow, restoreChildWindow } = require('../window/createChildWindow.cjs');

function registerChildWindowHandlers(isDevEnvironment, getMainWindow) {
    // Open child window
    ipcMain.handle('open-child-window', (event, options) => {
        try {
            const mainWindow = getMainWindow();
            const window = createChildWindow({
                ...options,
                isDevEnvironment,
                parent: mainWindow,
            });
            
            // Send initial data to child window if provided
            if (options.data && window) {
                window.webContents.once('did-finish-load', () => {
                    window.webContents.send('window-data', options.data);
                });
            }
            
            return {
                success: true,
                windowId: options.id,
            };
        } catch (error) {
            console.error('Failed to open child window:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    // Send data to child window
    ipcMain.handle('send-to-child-window', (event, windowId, data) => {
        try {
            const window = getChildWindow(windowId);
            if (window && !window.isDestroyed()) {
                window.webContents.send('window-data', data);
                return { success: true };
            }
            return { success: false, error: 'Window not found' };
        } catch (error) {
            console.error('Failed to send data to child window:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    // Send data from child to parent
    ipcMain.on('send-to-parent', (event, channel, data) => {
        try {
            const mainWindow = getMainWindow();
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send(channel, data);
            }
        } catch (error) {
            console.error('Failed to send data to parent:', error);
        }
    });

    // Minimize child window
    ipcMain.handle('minimize-child-window', (event, windowId) => {
        try {
            const result = minimizeChildWindow(windowId);
            if (result.success) {
                // Notify main window to add to taskbar
                const mainWindow = getMainWindow();
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('window-minimized', {
                        windowId: windowId,
                        windowType: result.windowType,
                    });
                }
            }
            return result;
        } catch (error) {
            console.error('Failed to minimize child window:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    // Restore child window
    ipcMain.handle('restore-child-window', (event, windowId) => {
        try {
            const result = restoreChildWindow(windowId);
            if (result.success) {
                // Notify main window to remove from taskbar
                const mainWindow = getMainWindow();
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('window-restored', {
                        windowId: windowId,
                    });
                }
            }
            return result;
        } catch (error) {
            console.error('Failed to restore child window:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    // Close child window
    ipcMain.handle('close-child-window', (event, windowId) => {
        try {
            closeChildWindow(windowId);
            return { success: true };
        } catch (error) {
            console.error('Failed to close child window:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    // Close all child windows
    ipcMain.handle('close-all-child-windows', () => {
        try {
            closeAllChildWindows();
            return { success: true };
        } catch (error) {
            console.error('Failed to close all child windows:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    });
}

module.exports = { registerChildWindowHandlers };
