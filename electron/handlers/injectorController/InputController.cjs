class InputController {
    static async open(event, config, getMainWindow) {
        try {
            console.log('📝 Opening script input window:', config);
            
            const mainWindow = typeof getMainWindow === 'function' ? getMainWindow() : getMainWindow;
            
            if (!mainWindow) {
                console.error('❌ Main window not found');
                return { success: false, message: 'Main window not found', data: null };
            }
            
            console.log('✅ Main window found, executing JavaScript...');
            
            const configBase64 = Buffer.from(JSON.stringify(config)).toString('base64');
            
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
                        
                        const configJSON = atob('${configBase64}');
                        const config = JSON.parse(configJSON);
                        console.log('[Main Window] Opening input with config:', config);
                        
                        const result = await window.scriptInputStore.open(config);
                        console.log('[Main Window] Input result:', result);
                        
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
    }

    /**
     * Handle script input response from renderer.
     * Note: This is intentionally a no-op handler. The actual response flow
     * is handled through the script-open-input → executeJavaScript → promise chain.
     * This handler exists only for debugging/logging purposes.
     */
    static handleResponse(event, data) {
        console.log('📨 Script input response received (debug):', data);
    }
}

module.exports = { InputController };
