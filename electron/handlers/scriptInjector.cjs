const { ipcMain, app } = require('electron');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

// Script storage directory
const SCRIPTS_DIR = path.join(app.getPath('userData'), 'inject-scripts');

// Ensure scripts directory exists
async function ensureScriptsDir() {
    try {
        await fs.mkdir(SCRIPTS_DIR, { recursive: true });
    } catch (error) {
        console.error('Failed to create scripts directory:', error);
    }
}

// Generate unique script ID
function generateScriptId() {
    return `script_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Read VBox API inline version
const VBOX_API_INLINE = fsSync.readFileSync(path.join(__dirname, 'vbox-api-inline.js'), 'utf-8');

function registerScriptInjectorHandlers(getMainWindow) {
    console.log('🔧 Registering Script Injector handlers...');
    ensureScriptsDir();
    
    // Add file to download manager
    ipcMain.handle('script-add-to-downloads', async (event, fileInfo) => {
        try {
            console.log('📥 Adding file to download manager:', fileInfo.filename);
            
            const { getDatabase } = require('../database/index.cjs');
            const db = getDatabase();
            const now = Date.now();
            
            // Check if file exists
            const fsSync = require('fs');
            if (!fsSync.existsSync(fileInfo.filepath)) {
                console.error('❌ File not found:', fileInfo.filepath);
                return { success: false, error: 'File not found' };
            }
            
            // Get file stats
            const stats = fsSync.statSync(fileInfo.filepath);
            const fileSize = stats.size;
            
            // Generate unique ID
            const { v4: uuidv4 } = require('uuid');
            const downloadId = uuidv4();
            
            // Insert into downloads table with correct schema
            db.prepare(`
                INSERT INTO downloads (
                    id, filename, url, save_path, total_bytes, received_bytes,
                    state, start_time, end_time, created_at, file_exists
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                downloadId,
                fileInfo.filename,
                fileInfo.url || 'vbox://script-injector',
                fileInfo.filepath,
                fileSize,
                fileSize,
                'complete',
                now,
                now,
                now,
                1
            );
            
            console.log('✅ File added to download manager');
            
            // Notify renderer to update downloads list
            const mainWindow = typeof getMainWindow === 'function' ? getMainWindow() : getMainWindow;
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('download-added', {
                    id: downloadId,
                    filename: fileInfo.filename,
                    save_path: fileInfo.filepath,
                    total_bytes: fileSize,
                    state: 'complete'
                });
            }
            
            return { success: true, filesize: fileSize, id: downloadId };
        } catch (error) {
            console.error('❌ Failed to add to download manager:', error);
            return { success: false, error: error.message };
        }
    });
    
    // List all scripts
    ipcMain.handle('scripts-list', async () => {
        console.log('📋 scripts-list called');
        try {
            const files = await fs.readdir(SCRIPTS_DIR);
            const scripts = [];
            
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const filePath = path.join(SCRIPTS_DIR, file);
                    const content = await fs.readFile(filePath, 'utf-8');
                    const script = JSON.parse(content);
                    scripts.push(script);
                }
            }
            
            return { success: true, scripts };
        } catch (error) {
            console.error('Failed to list scripts:', error);
            return { success: false, error: error.message, scripts: [] };
        }
    });
    
    // Save script
    ipcMain.handle('scripts-save', async (event, scriptData) => {
        try {
            const scriptId = scriptData.id || generateScriptId();
            const script = {
                id: scriptId,
                name: scriptData.name,
                description: scriptData.description || '',
                code: scriptData.code,
                urlPattern: scriptData.urlPattern || '*',
                autoRun: scriptData.autoRun || false,
                createdAt: scriptData.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            // Save metadata
            const metaPath = path.join(SCRIPTS_DIR, `${scriptId}.json`);
            await fs.writeFile(metaPath, JSON.stringify(script, null, 2));
            
            // Save code file
            const codePath = path.join(SCRIPTS_DIR, `${scriptId}.js`);
            await fs.writeFile(codePath, script.code);
            
            return { success: true, script };
        } catch (error) {
            console.error('Failed to save script:', error);
            return { success: false, error: error.message };
        }
    });
    
    // Load script
    ipcMain.handle('scripts-load', async (event, scriptId) => {
        try {
            const metaPath = path.join(SCRIPTS_DIR, `${scriptId}.json`);
            const content = await fs.readFile(metaPath, 'utf-8');
            const script = JSON.parse(content);
            
            return { success: true, script };
        } catch (error) {
            console.error('Failed to load script:', error);
            return { success: false, error: error.message };
        }
    });
    
    // Delete script
    ipcMain.handle('scripts-delete', async (event, scriptId) => {
        try {
            const metaPath = path.join(SCRIPTS_DIR, `${scriptId}.json`);
            const codePath = path.join(SCRIPTS_DIR, `${scriptId}.js`);
            
            await fs.unlink(metaPath);
            await fs.unlink(codePath).catch(() => {}); // Ignore if code file doesn't exist
            
            return { success: true };
        } catch (error) {
            console.error('Failed to delete script:', error);
            return { success: false, error: error.message };
        }
    });
    
    // Execute script in active webview - DIRECT INJECTION
    ipcMain.handle('scripts-execute', async (event, scriptId) => {
        console.log('▶️ scripts-execute called for:', scriptId);
        try {
            const mainWindow = typeof getMainWindow === 'function' ? getMainWindow() : getMainWindow;
            
            if (!mainWindow) {
                return { success: false, error: 'Main window not found' };
            }
            
            // Load script code
            const codePath = path.join(SCRIPTS_DIR, `${scriptId}.js`);
            const scriptCode = await fs.readFile(codePath, 'utf-8');
            
            console.log('🚀 Executing script in webview...');
            console.log('📝 Script length:', scriptCode.length, 'characters');
            
            // Inject VBox API + execute user script
            // Build the script to inject - avoid nested template literals
            const vboxAPICode = VBOX_API_INLINE;
            const userScriptCode = scriptCode;
            
            const executionResult = await mainWindow.webContents.executeJavaScript(`
                (async function() {
                    try {
                        // Find active webview
                        const activeWebview = document.querySelector('webview:focus') || 
                                             document.querySelector('webview.active') ||
                                             document.querySelector('webview');
                        
                        if (!activeWebview) {
                            console.error('[VBox] No active webview found');
                            return { success: false, error: 'No active webview found. Please click on a tab first.' };
                        }
                        
                        console.log('[VBox] Found webview:', activeWebview.src);
                        
                        // Check if webview is ready
                        if (!activeWebview.src || activeWebview.src === 'about:blank') {
                            return { success: false, error: 'Webview is empty. Please navigate to a website first.' };
                        }
                        
                        console.log('[VBox] Injecting VBox API and executing script...');
                        
                        // Build script with proper escaping
                        const vboxAPICode = ${JSON.stringify(vboxAPICode)};
                        const userScriptCode = ${JSON.stringify(userScriptCode)};
                        
                        // Inject console override + VBox API + user script
                        const fullScript = 
                            '(function() {' +
                            '  if (typeof window.__consoleOverridden === "undefined") {' +
                            '    window.__consoleOverridden = true;' +
                            '    const originalConsole = {' +
                            '      log: console.log.bind(console),' +
                            '      error: console.error.bind(console),' +
                            '      warn: console.warn.bind(console),' +
                            '      info: console.info.bind(console)' +
                            '    };' +
                            '    const serializeArg = (arg) => {' +
                            '      if (typeof arg === "object" && arg !== null) {' +
                            '        try { return JSON.stringify(arg, null, 2); }' +
                            '        catch (e) { return String(arg); }' +
                            '      }' +
                            '      return String(arg);' +
                            '    };' +
                            '    const sendToVBox = (level, args) => {' +
                            '      if (typeof window.vboxConsole !== "undefined") {' +
                            '        try {' +
                            '          const parts = [];' +
                            '          for (let i = 0; i < args.length; i++) {' +
                            '            parts.push(serializeArg(args[i]));' +
                            '          }' +
                            '          const message = parts.join(" ");' +
                            '          window.vboxConsole[level](message);' +
                            '        } catch(e) {' +
                            '          originalConsole.error("[VBox] Console forward error:", e);' +
                            '        }' +
                            '      }' +
                            '    };' +
                            '    console.log = function(...args) {' +
                            '      originalConsole.log(...args);' +
                            '      sendToVBox("log", args);' +
                            '    };' +
                            '    console.error = function(...args) {' +
                            '      originalConsole.error(...args);' +
                            '      sendToVBox("error", args);' +
                            '    };' +
                            '    console.warn = function(...args) {' +
                            '      originalConsole.warn(...args);' +
                            '      sendToVBox("warn", args);' +
                            '    };' +
                            '    console.info = function(...args) {' +
                            '      originalConsole.info(...args);' +
                            '      sendToVBox("info", args);' +
                            '    };' +
                            '    originalConsole.log("[VBox] Console override installed");' +
                            '  }' +
                            '})();' +
                            vboxAPICode + ';' +
                            '(async function() {' +
                            '  try {' +
                            '    if (typeof window.__VBOX_API__ === "undefined") {' +
                            '      return { success: false, error: "Failed to inject VBox API" };' +
                            '    }' +
                            '    const vbox = window.__VBOX_API__;' +
                            '    console.log("[VBox] API available, executing user script...");' +
                            '    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;' +
                            '    const userFunction = new AsyncFunction("vbox", ' + JSON.stringify(userScriptCode) + ');' +
                            '    const result = await userFunction(vbox);' +
                            '    console.log("[VBox] User script executed successfully");' +
                            '    try {' +
                            '      return { success: true, result: JSON.parse(JSON.stringify(result)) };' +
                            '    } catch (e) {' +
                            '      return { success: true, result: String(result) };' +
                            '    }' +
                            '  } catch (error) {' +
                            '    console.error("[VBox] Script error:", error);' +
                            '    return { success: false, error: error.message || "Unknown error", stack: error.stack };' +
                            '  }' +
                            '})()';
                        
                        const webviewResult = await activeWebview.executeJavaScript(fullScript);
                        
                        console.log('[VBox] Script execution result:', webviewResult);
                        return webviewResult;
                        
                    } catch (error) {
                        console.error('[VBox] Execution error:', error);
                        return { 
                            success: false, 
                            error: error.message || 'Unknown error',
                            stack: error.stack
                        };
                    }
                })()
            `);
            
            console.log('✅ Execution completed:', executionResult);
            
            if (!executionResult.success && executionResult.error) {
                console.error('❌ Script failed:', executionResult.error);
                if (executionResult.stack) {
                    console.error('Stack trace:', executionResult.stack);
                }
            }
            
            return executionResult;
            
        } catch (error) {
            console.error('❌ Handler execution failed:', error);
            return { 
                success: false, 
                error: error.message,
                details: 'Error in script execution handler'
            };
        }
    });
    
    // Get scripts directory path
    ipcMain.handle('scripts-get-directory', async () => {
        return { success: true, path: SCRIPTS_DIR };
    });
    
    // Open script input window
    ipcMain.handle('script-open-input', async (event, config) => {
        try {
            console.log('📝 Opening script input window:', config);
            
            const mainWindow = typeof getMainWindow === 'function' ? getMainWindow() : getMainWindow;
            
            if (!mainWindow) {
                console.error('❌ Main window not found');
                return { success: false, message: 'Main window not found', data: null };
            }
            
            console.log('✅ Main window found, executing JavaScript...');
            
            // Encode config as base64 to avoid escaping issues
            const configBase64 = Buffer.from(JSON.stringify(config)).toString('base64');
            
            // Send to renderer to open input window and get the promise
            const executionResult = await mainWindow.webContents.executeJavaScript(`
                (async function() {
                    try {
                        console.log('[Main Window] Checking scriptInputStore...');
                        console.log('[Main Window] window.scriptInputStore:', typeof window.scriptInputStore);
                        
                        if (typeof window.scriptInputStore === 'undefined') {
                            console.error('[Main Window] Store not available!');
                            return { success: false, message: 'Store not available', data: null };
                        }
                        
                        console.log('[Main Window] Store found, checking properties...');
                        console.log('[Main Window] Store.isOpen:', window.scriptInputStore.isOpen);
                        console.log('[Main Window] Store.open:', typeof window.scriptInputStore.open);
                        
                        // Decode config from base64
                        const configJSON = atob('${configBase64}');
                        const config = JSON.parse(configJSON);
                        console.log('[Main Window] Opening input with config:', config);
                        
                        const result = await window.scriptInputStore.open(config);
                        console.log('[Main Window] Input result:', result);
                        
                        // Ensure result is serializable
                        const serializedResult = JSON.parse(JSON.stringify(result));
                        console.log('[Main Window] Serialized result:', serializedResult);
                        
                        return serializedResult;
                    } catch (error) {
                        console.error('[Main Window] Error:', error);
                        console.error('[Main Window] Error stack:', error.stack);
                        return { success: false, message: error.message, data: null };
                    }
                })()
            `);
            
            console.log('📥 Input window result:', executionResult);
            return executionResult;
            
        } catch (error) {
            console.error('❌ Failed to open input window:', error);
            console.error('❌ Error stack:', error.stack);
            return { success: false, message: error.message, data: null };
        }
    });
    
    // Handle webview screenshot
    ipcMain.handle('webview-screenshot', async (event, options) => {
        try {
            console.log('📸 Webview screenshot requested:', options);
            
            const mainWindow = typeof getMainWindow === 'function' ? getMainWindow() : getMainWindow;
            
            if (!mainWindow) {
                console.error('❌ Main window not found');
                return { success: false, error: 'Main window not found' };
            }
            
            // Find the webview and capture screenshot
            const result = await mainWindow.webContents.executeJavaScript(`
                (async function() {
                    try {
                        const activeWebview = document.querySelector('webview:focus') || 
                                             document.querySelector('webview.active') ||
                                             document.querySelector('webview');
                        
                        if (!activeWebview) {
                            return { success: false, error: 'No active webview found' };
                        }
                        
                        // Capture webview screenshot
                        const options = ${JSON.stringify(options)};
                        const image = await activeWebview.capturePage(options.rect);
                        const dataURL = image.toDataURL();
                        
                        return { success: true, dataURL: dataURL };
                    } catch (error) {
                        console.error('[Screenshot] Error:', error);
                        return { success: false, error: error.message };
                    }
                })()
            `);
            
            if (!result.success) {
                return result;
            }
            
            // Save to downloads folder
            const downloadsPath = app.getPath('downloads');
            const outputPath = path.join(downloadsPath, options.filename);
            
            // Convert dataURL to buffer
            const base64Data = result.dataURL.replace(/^data:image\/png;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            
            // Write file
            fs.writeFileSync(outputPath, buffer);
            
            const stats = fs.statSync(outputPath);
            
            console.log('✅ Screenshot saved:', outputPath);
            
            return {
                success: true,
                path: outputPath,
                filename: options.filename,
                size: stats.size
            };
            
        } catch (error) {
            console.error('❌ Screenshot failed:', error);
            return { success: false, error: error.message };
        }
    });
    
    // Handle input response from renderer
    ipcMain.on('script-input-response', (event, data) => {
        console.log('📨 Script input response received:', data);
        // Response is handled by the promise in script-open-input
    });
    
    // Handle console logs from webview
    ipcMain.on('webview-console-log', (event, { level, args }) => {
        const message = args.join(' ');
        console.log('[Webview Console ' + level.toUpperCase() + ']', message);
        
        // Forward to main window renderer for Script Injector console
        const mainWindow = typeof getMainWindow === 'function' ? getMainWindow() : getMainWindow;
        if (mainWindow && !mainWindow.isDestroyed()) {
            console.log('[Script Injector] Forwarding console log to renderer:', { level, message });
            mainWindow.webContents.send('script-console-log', { 
                level, 
                message 
            });
        } else {
            console.warn('[Script Injector] Main window not available to forward console log');
        }
    });
    
    console.log('✅ Script Injector handlers registered');
}

module.exports = { registerScriptInjectorHandlers };
