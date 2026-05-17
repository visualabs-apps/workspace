const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { SCRIPTS_DIR } = require('./ScriptController.cjs');

// Lazy-load VBox API inline code with error handling
let VBOX_API_INLINE = null;

function getVboxApiInline() {
    if (VBOX_API_INLINE === null) {
        try {
            VBOX_API_INLINE = fsSync.readFileSync(
                path.join(__dirname, '../vbox-api-inline.js'), 
                'utf-8'
            );
        } catch (error) {
            console.error('❌ Failed to read vbox-api-inline.js:', error.message);
            VBOX_API_INLINE = ''; // Fallback to empty — scripts will run without API
        }
    }
    return VBOX_API_INLINE;
}

class ExecutionController {
    static async execute(event, scriptId, getMainWindow) {
        try {
            const mainWindow = typeof getMainWindow === 'function' ? getMainWindow() : getMainWindow;
            
            if (!mainWindow) {
                return { success: false, error: 'Main window not found' };
            }
            
            const codePath = path.join(SCRIPTS_DIR, `${scriptId}.js`);
            const scriptCode = await fs.readFile(codePath, 'utf-8');
            
            
            const vboxAPICode = getVboxApiInline();
            const userScriptCode = scriptCode;
            
            const executionResult = await mainWindow.webContents.executeJavaScript(`
                (async function() {
                    try {
                        // Get active workspace and app
                        let activeAppId = null;
                        let activeWorkspace = null;
                        
                        if (typeof window.workspaceStore !== 'undefined') {
                            activeWorkspace = window.workspaceStore.activeWorkspace;
                        }
                        
                        if (typeof window.appStore !== 'undefined') {
                            activeAppId = window.appStore.activeAppId;
                        }
                        
                        console.log('[VBox] Active workspace:', activeWorkspace?.name);
                        console.log('[VBox] Active app ID:', activeAppId);
                        
                        // Try to find webview by active app ID first
                        let activeWebview = null;
                        
                        if (activeAppId) {
                            activeWebview = document.querySelector(\`webview[data-app-id="\${activeAppId}"]\`);
                            if (activeWebview) {
                                console.log('[VBox] Found webview by app ID:', activeAppId);
                            }
                        }
                        
                        // Fallback to focus/active/first webview
                        if (!activeWebview) {
                            activeWebview = document.querySelector('webview:focus') || 
                                           document.querySelector('webview.active') ||
                                           document.querySelector('webview');
                            console.log('[VBox] Using fallback webview selection');
                        }
                        
                        if (!activeWebview) {
                            console.error('[VBox] No active webview found');
                            return { success: false, error: 'No active webview found. Please click on a tab first.' };
                        }
                        
                        console.log('[VBox] Found webview:', activeWebview.src);
                        
                        if (!activeWebview.src || activeWebview.src === 'about:blank') {
                            return { success: false, error: 'Webview is empty. Please navigate to a website first.' };
                        }
                        
                        console.log('[VBox] Injecting VBox API and executing script...');
                        
                        const vboxAPICode = ${JSON.stringify(vboxAPICode)};
                        const userScriptCode = ${JSON.stringify(userScriptCode)};
                        
                        const fullScript = vboxAPICode + ';' +
                            '(async function() {' +
                            '  try {' +
                            '    if (typeof window.__VBOX_API__ === "undefined") {' +
                            '      return { success: false, error: "Failed to inject VBox API" };' +
                            '    }' +
                            '    const vbox = window.__VBOX_API__;' +
                            '    console.log("[VBox] API available, executing user script...");' +
                            '    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;' +
                            '    const userFunction = new AsyncFunction("vbox", userScriptCode);' +
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
    }
}

module.exports = { ExecutionController };
