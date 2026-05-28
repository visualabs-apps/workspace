const { contextBridge, ipcRenderer } = require('electron');
const { init: initThemeOverride } = require('./webview/theme.cjs');
const { init: initContextBridge } = require('./webview/contextBridge.cjs');
const { init: initConsoleOverride } = require('./webview/consoleOverride.cjs');
const { init: initVBoxApi } = require('./webview/vboxApi.cjs');
const { init: initPasswordCapture } = require('./webview/passwordCapture.cjs');
const { init: initStealthEvasion } = require('./webview/stealthEvasion.cjs');
const { init: initVBoxApiStealth } = require('./webview/vboxApiStealth.cjs');
const { init: initScrollbarStyles } = require('./webview/scrollbar.cjs');

// ✅ STEALTH: Initialize evasion BEFORE anything else
// This runs before page scripts, spoofing fingerprints
initStealthEvasion();

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

// ✅ STEALTH: Hide VBox API globals after initialization
// This makes vbox* globals non-enumerable so anti-bot scripts can't detect them
// MCP tools still work because they access via Symbol or direct reference
initVBoxApiStealth();
