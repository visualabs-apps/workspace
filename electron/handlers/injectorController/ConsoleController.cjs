const { BrowserWindow } = require('electron');

class ConsoleController {
    static handleLog(event, { level, args }, getMainWindow) {
        const message = args.join(' ');
        console.log('[Webview Console ' + level.toUpperCase() + ']', message);
        
        // Broadcast to all windows (main + children) so Script Injector window receives it
        const allWindows = BrowserWindow.getAllWindows();
        
        allWindows.forEach(window => {
            if (window && !window.isDestroyed()) {
                window.webContents.send('script-console-log', { level, message });
            }
        });
    }
}

module.exports = { ConsoleController };
