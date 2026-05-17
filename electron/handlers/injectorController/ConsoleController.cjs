const { BrowserWindow } = require('electron');

class ConsoleController {
    static handleLog(event, { level, args }, getMainWindow) {
        // Only log errors to main terminal, skip info/warn/log noise
        if (level === 'error') {
            const message = args.join(' ');
            console.error('[Webview]', message);
        }
        
        // Broadcast to all windows (main + children) so Script Console receives it
        const allWindows = BrowserWindow.getAllWindows();
        const message = args.join(' ');
        allWindows.forEach(window => {
            if (window && !window.isDestroyed()) {
                window.webContents.send('script-console-log', { level, message });
            }
        });
    }
}

module.exports = { ConsoleController };
