const { contextBridge, ipcRenderer } = require('electron');
const { init: initThemeOverride } = require('./webview/theme.cjs');
const { init: initContextBridge } = require('./webview/contextBridge.cjs');
const { init: initConsoleOverride } = require('./webview/consoleOverride.cjs');
const { init: initVBoxApi } = require('./webview/vboxApi.cjs');
const { init: initPasswordCapture } = require('./webview/passwordCapture.cjs');
const { init: initVBoxApiStealth } = require('./webview/vboxApiStealth.cjs');

initThemeOverride(ipcRenderer);
initContextBridge(contextBridge, ipcRenderer);
initConsoleOverride(ipcRenderer);
initVBoxApi();
initPasswordCapture(ipcRenderer);

// Hide VBox API globals after initialization
initVBoxApiStealth();
