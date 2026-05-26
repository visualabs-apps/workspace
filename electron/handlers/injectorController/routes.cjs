const { ipcMain } = require('electron');
const { ScriptController } = require('./ScriptController.cjs');
const { ExecutionController } = require('./ExecutionController.cjs');
const { InputController } = require('./InputController.cjs');
const { ScreenshotController } = require('./ScreenshotController.cjs');
const { PowerPointController } = require('./PowerPointController.cjs');
const { DownloadController } = require('./DownloadController.cjs');
const { ConsoleController } = require('./ConsoleController.cjs');
const { FileController } = require('./FileController.cjs');
const { ContextController } = require('./ContextController.cjs');
const { WebviewController } = require('./WebviewController.cjs');

/**
 * @param {Function} getMainWindow - Function to get main window instance
 */
function registerInjectorRoutes(getMainWindow) {
    
    // ─── Script CRUD ─────────────────────────────────────────────
    
    ipcMain.handle('scripts-list', ScriptController.list);
    ipcMain.handle('scripts-save', ScriptController.save);
    ipcMain.handle('scripts-load', ScriptController.load);
    ipcMain.handle('scripts-delete', ScriptController.delete);
    ipcMain.handle('scripts-get-directory', ScriptController.getDirectory);
    
    // ─── Script Execution ────────────────────────────────────────
    
    ipcMain.handle('scripts-execute', (event, scriptId) => {
        return ExecutionController.execute(event, scriptId, getMainWindow);
    });
    
    // ─── Dynamic Input ───────────────────────────────────────────
    
    ipcMain.handle('script-open-input', (event, config) => {
        return InputController.open(event, config, getMainWindow);
    });
    
    ipcMain.on('script-input-response', InputController.handleResponse);
    
    // ─── Screenshots ─────────────────────────────────────────────
    
    ipcMain.handle('webview-screenshot', (event, options) => {
        return ScreenshotController.capture(event, options, getMainWindow);
    });
    
    // ─── PowerPoint ──────────────────────────────────────────────
    
    ipcMain.handle('generate-powerpoint', PowerPointController.generate);
    ipcMain.handle('ppt-process-template', PowerPointController.processTemplate);
    ipcMain.handle('ppt-list-templates', PowerPointController.listTemplates);
    ipcMain.handle('ppt-get-templates-dir', PowerPointController.getTemplatesDir);
    
    // ─── Downloads ───────────────────────────────────────────────
    
    ipcMain.handle('script-add-to-downloads', (event, fileInfo) => {
        return DownloadController.addToDownloads(event, fileInfo, getMainWindow);
    });
    
    // ─── File Save ───────────────────────────────────────────────
    
    ipcMain.handle('save-file', FileController.saveFile);
    
    // ─── Console Forwarding ──────────────────────────────────────
    
    ipcMain.on('webview-console-log', (event, data) => {
        ConsoleController.handleLog(event, data, getMainWindow);
    });
    
    // ─── Workspace Context ───────────────────────────────────────
    
    ipcMain.handle('get-workspace-context', (event) => {
        return ContextController.getWorkspaceContext(event, getMainWindow);
    });

    // Sync version for password capture (must complete before page unloads)
    ipcMain.on('get-workspace-context-sync', async (event) => {
        try {
            const ctx = await ContextController.getWorkspaceContext(event, getMainWindow);
            // Must serialize to plain object for event.returnValue (structured clone)
            event.returnValue = ctx ? JSON.parse(JSON.stringify(ctx)) : null;
        } catch (e) {
            console.error('❌ [Routes] get-workspace-context-sync error:', e);
            event.returnValue = null;
        }
    });
    
    // ─── Navigation (webview → main process) ─────────────────────
    
    ipcMain.handle('webview-navigate', (event, url) => {
        return WebviewController.navigate(event, url);
    });
    
    ipcMain.handle('webview-go-back', (event) => {
        return WebviewController.goBack(event);
    });
    
    ipcMain.handle('webview-go-forward', (event) => {
        return WebviewController.goForward(event);
    });
    
    ipcMain.handle('webview-reload', (event) => {
        return WebviewController.reload(event);
    });
    
    // ─── Cookies (webview session) ───────────────────────────────
    
    ipcMain.handle('webview-get-cookies', (event, filter) => {
        return WebviewController.getCookies(event, filter);
    });
    
    ipcMain.handle('webview-set-cookie', (event, cookie) => {
        return WebviewController.setCookie(event, cookie);
    });
    
    // ─── Dialog Handling ─────────────────────────────────────────
    
    ipcMain.handle('webview-handle-dialog', (event, options) => {
        return WebviewController.handleDialog(event, options);
    });
    
    ipcMain.handle('webview-clear-dialog-handler', (event) => {
        return WebviewController.clearDialogHandler(event);
    });
    
    // ─── Profile / Tab Management (MCP-ready) ────────────────────
    
    ipcMain.handle('webview-list-profiles', (event) => {
        return WebviewController.listProfiles(event, getMainWindow);
    });
    
    ipcMain.handle('webview-list-tabs', (event) => {
        return WebviewController.listTabs(event, getMainWindow);
    });
    
    ipcMain.handle('webview-switch-tab', (event, tabId) => {
        return WebviewController.switchTab(event, tabId, getMainWindow);
    });
    
    ipcMain.handle('webview-get-page-info', (event, tabId) => {
        return WebviewController.getPageInfo(event, tabId, getMainWindow);
    });
    
    ipcMain.handle('webview-create-tab', (event, params) => {
        return WebviewController.createTab(event, params, getMainWindow);
    });
    
    // ─── MCP-level Navigation (main window → specific webview) ───
    
    ipcMain.handle('mcp-navigate-and-wait', (event, params) => {
        return WebviewController.navigateAndWait(event, params, getMainWindow);
    });
    
    // ─── VBox API Execution (MCP → webview) ──────────────────────
    
    ipcMain.handle('vbox-api-execute', (event, params) => {
        return WebviewController.executeVBoxAPI(event, params, getMainWindow);
    });
    
}


module.exports = { registerInjectorRoutes };
