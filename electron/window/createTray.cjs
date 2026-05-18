const { Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const { getMainWindow, setIsQuitting } = require('./createWindow.cjs');

let tray = null;

function createTray() {
    const iconPath = path.join(__dirname, '..', '..', 'public', 'VBOXICON.png');
    const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });

    tray = new Tray(trayIcon);
    tray.setToolTip('VisualBox Browser');

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Show VisualBox',
            click: () => {
                const mainWindow = getMainWindow();
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.show();
                    mainWindow.focus();
                }
            }
        },
        {
            label: 'Hide VisualBox',
            click: () => {
                const mainWindow = getMainWindow();
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.hide();
                }
            }
        },
        { type: 'separator' },
        {
            label: 'Quit',
            click: () => {
                setIsQuitting(true);
                const { app } = require('electron');
                app.quit();
            }
        }
    ]);

    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => {
        const mainWindow = getMainWindow();
        if (mainWindow && !mainWindow.isDestroyed()) {
            if (mainWindow.isVisible()) {
                mainWindow.hide();
            } else {
                mainWindow.show();
                mainWindow.focus();
            }
        }
    });

    return tray;
}

function getTray() {
    return tray;
}

module.exports = { createTray, getTray };
