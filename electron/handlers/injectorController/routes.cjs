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

/**
 * @param {Function} getMainWindow - Function to get main window instance
 */
function registerInjectorRoutes(getMainWindow) {
    console.log('🔧 Registering Script Injector routes...');
    
    // CRUD for scripts
    
    ipcMain.handle('scripts-list', ScriptController.list);
    ipcMain.handle('scripts-save', ScriptController.save);
    ipcMain.handle('scripts-load', ScriptController.load);
    ipcMain.handle('scripts-delete', ScriptController.delete);
    ipcMain.handle('scripts-get-directory', ScriptController.getDirectory);
    
    // Execute scripts in webview
    
    ipcMain.handle('scripts-execute', (event, scriptId) => {
        return ExecutionController.execute(event, scriptId, getMainWindow);
    });
    
    // Dynamic input window for collecting user data
    
    ipcMain.handle('script-open-input', (event, config) => {
        return InputController.open(event, config, getMainWindow);
    });
    
    ipcMain.on('script-input-response', InputController.handleResponse);
    
    // Capture element screenshots
    
    ipcMain.handle('webview-screenshot', (event, options) => {
        return ScreenshotController.capture(event, options, getMainWindow);
    });
    
    // Template-based and from-scratch PowerPoint generation
    
    ipcMain.handle('generate-powerpoint', PowerPointController.generate);
    ipcMain.handle('ppt-process-template', PowerPointController.processTemplate);
    ipcMain.handle('ppt-list-templates', PowerPointController.listTemplates);
    ipcMain.handle('ppt-get-templates-dir', PowerPointController.getTemplatesDir);
    
    // Add generated files to download manager
    
    ipcMain.handle('script-add-to-downloads', (event, fileInfo) => {
        return DownloadController.addToDownloads(event, fileInfo, getMainWindow);
    });
    
    // Save file to Downloads folder
    
    ipcMain.handle('save-file', FileController.saveFile);
    
    // Forward webview console logs to main window
    
    ipcMain.on('webview-console-log', (event, data) => {
        ConsoleController.handleLog(event, data, getMainWindow);
    });
    
    // Get workspace/profile context
    
    ipcMain.handle('get-workspace-context', (event) => {
        return ContextController.getWorkspaceContext(event, getMainWindow);
    });
    
    console.log('✅ Script Injector routes registered');
    console.log('📋 Available routes:');
    console.log('   - scripts-list, scripts-save, scripts-load, scripts-delete');
    console.log('   - scripts-execute, scripts-get-directory');
    console.log('   - script-open-input, script-input-response');
    console.log('   - webview-screenshot');
    console.log('   - generate-powerpoint, ppt-process-template, ppt-list-templates, ppt-get-templates-dir');
    console.log('   - script-add-to-downloads, save-file');
    console.log('   - webview-console-log, get-workspace-context');
}


module.exports = { registerInjectorRoutes };
