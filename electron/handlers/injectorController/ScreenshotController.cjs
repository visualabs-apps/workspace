const { app } = require('electron');
const fs = require('fs');
const path = require('path');

class ScreenshotController {
    static async capture(event, options, getMainWindow) {
        try {
            
            const mainWindow = typeof getMainWindow === 'function' ? getMainWindow() : getMainWindow;
            
            if (!mainWindow) {
                console.error('❌ Main window not found');
                return { success: false, error: 'Main window not found' };
            }
            
            const result = await mainWindow.webContents.executeJavaScript(`
                (async function() {
                    try {
                        // Get active app ID
                        let activeAppId = null;
                        if (typeof window.appStore !== 'undefined') {
                            activeAppId = window.appStore.activeAppId;
                        }
                        
                        console.log('[Screenshot] Active app ID:', activeAppId);
                        
                        // Try to find webview by active app ID first
                        let activeWebview = null;
                        
                        if (activeAppId) {
                            activeWebview = document.querySelector(\`webview[data-app-id="\${activeAppId}"]\`);
                            if (activeWebview) {
                                console.log('[Screenshot] Found webview by app ID:', activeAppId);
                            }
                        }
                        
                        // Fallback to focus/active/first webview
                        if (!activeWebview) {
                            activeWebview = document.querySelector('webview:focus') || 
                                           document.querySelector('webview.active') ||
                                           document.querySelector('webview');
                            console.log('[Screenshot] Using fallback webview selection');
                        }
                        
                        if (!activeWebview) {
                            return { success: false, error: 'No active webview found' };
                        }
                        
                        console.log('[Screenshot] Capturing from webview:', activeWebview.src);
                        
                        const options = ${JSON.stringify(options)};
                        const image = await activeWebview.capturePage(options.rect);
                        const dataURL = image.toDataURL();
                        
                        console.log('[Screenshot] Capture successful, data URL length:', dataURL.length);
                        
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
            
            const downloadsPath = app.getPath('downloads');
            let outputPath = path.join(downloadsPath, options.filename);
            
            // Handle file collision — append timestamp if file exists
            if (fs.existsSync(outputPath)) {
                const ext = path.extname(options.filename);
                const baseName = path.basename(options.filename, ext);
                const timestamp = Date.now();
                const newFilename = `${baseName}_${timestamp}${ext}`;
                outputPath = path.join(downloadsPath, newFilename);
            }
            
            const base64Data = result.dataURL.replace(/^data:image\/png;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            
            fs.writeFileSync(outputPath, buffer);
            
            const stats = fs.statSync(outputPath);
            const finalFilename = path.basename(outputPath);
            
            
            return {
                success: true,
                path: outputPath,
                filename: finalFilename,
                size: stats.size
            };
            
        } catch (error) {
            console.error('❌ Screenshot failed:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = { ScreenshotController };
