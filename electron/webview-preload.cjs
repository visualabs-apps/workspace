const { contextBridge, ipcRenderer } = require('electron');
const { init: initThemeOverride } = require('./webview/theme.cjs');
const { init: initContextBridge } = require('./webview/contextBridge.cjs');
const { init: initConsoleOverride } = require('./webview/consoleOverride.cjs');
const { init: initVBoxApi } = require('./webview/vboxApi.cjs');
const { init: initPasswordCapture } = require('./webview/passwordCapture.cjs');
// const { init: initVBoxApiStealth } = require('./webview/vboxApiStealth.cjs'); // DISABLED: Breaks MCP tool execution
const { init: initScrollbarStyles } = require('./webview/scrollbar.cjs');

initThemeOverride(ipcRenderer);
initContextBridge(contextBridge, ipcRenderer);
initConsoleOverride(ipcRenderer);
initVBoxApi();
initPasswordCapture(ipcRenderer);
initScrollbarStyles();

// Expose __VBOX_API__ to main world after initialization
if (typeof window.__VBOX_API__ !== 'undefined') {
    contextBridge.exposeInMainWorld('__VBOX_API__', window.__VBOX_API__);
}

// Hide VBox API globals after initialization
// initVBoxApiStealth(); // DISABLED: Breaks MCP tool execution - __VBOX_API__ needs to be accessible
