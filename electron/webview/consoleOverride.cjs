function initConsoleOverride(ipcRenderer) {
    const originalConsole = {
        log: console.log.bind(console),
        error: console.error.bind(console),
        warn: console.warn.bind(console),
        info: console.info.bind(console)
    };

    const serializeArgs = (args) => {
        return args.map(arg => {
            if (typeof arg === 'object' && arg !== null) {
                try {
                    return JSON.stringify(arg, null, 2);
                } catch (e) {
                    return String(arg);
                }
            }
            return String(arg);
        });
    };

    console.log = function(...args) {
        originalConsole.log(...args);
        ipcRenderer.send('webview-console-log', { level: 'log', args: serializeArgs(args) });
    };

    console.error = function(...args) {
        originalConsole.error(...args);
        ipcRenderer.send('webview-console-log', { level: 'error', args: serializeArgs(args) });
    };

    console.warn = function(...args) {
        originalConsole.warn(...args);
        ipcRenderer.send('webview-console-log', { level: 'warn', args: serializeArgs(args) });
    };

    console.info = function(...args) {
        originalConsole.info(...args);
        ipcRenderer.send('webview-console-log', { level: 'info', args: serializeArgs(args) });
    };
}

module.exports = { init: initConsoleOverride };
