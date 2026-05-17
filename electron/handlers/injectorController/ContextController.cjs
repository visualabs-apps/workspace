// Context Controller - Get workspace/profile context information

class ContextController {
    /**
     * Get workspace context for active webview
     * @param {Electron.IpcMainInvokeEvent} event 
     * @param {Function} getMainWindow 
     */
    static async getWorkspaceContext(event, getMainWindow) {
        try {
            
            const mainWindow = typeof getMainWindow === 'function' ? getMainWindow() : getMainWindow;
            
            if (!mainWindow) {
                console.error('❌ Main window not found');
                return { success: false, error: 'Main window not found' };
            }
            
            // Get workspace info from main window (uses appStore.activeAppId for correct webview)
            const result = await mainWindow.webContents.executeJavaScript(`
                (function() {
                    try {
                        // Get active app ID for precise webview selection
                        let activeAppId = null;
                        if (typeof window.appStore !== 'undefined') {
                            activeAppId = window.appStore.activeAppId;
                        }
                        
                        // Try to find webview by active app ID first
                        let activeWebview = null;
                        
                        if (activeAppId) {
                            activeWebview = document.querySelector('webview[data-app-id="' + activeAppId + '"]');
                        }
                        
                        // Fallback to focus/active/first webview
                        if (!activeWebview) {
                            activeWebview = document.querySelector('webview:focus') || 
                                                 document.querySelector('webview.active') ||
                                                 document.querySelector('webview');
                        }
                        
                        if (!activeWebview) {
                            return { success: false, error: 'No active webview found' };
                        }
                        
                        // Get workspace info from workspaceStore
                        if (typeof window.workspaceStore !== 'undefined' && window.workspaceStore.activeWorkspace) {
                            const workspace = window.workspaceStore.activeWorkspace;
                            return {
                                success: true,
                                id: workspace.id,
                                name: workspace.name,
                                url: activeWebview.src,
                                title: activeWebview.getTitle ? activeWebview.getTitle() : 'Unknown'
                            };
                        }
                        
                        return {
                            success: false,
                            error: 'Workspace store not available',
                            url: activeWebview.src
                        };
                    } catch (error) {
                        return { success: false, error: error.message };
                    }
                })()
            `);
            
            return result;
            
        } catch (error) {
            console.error('❌ Failed to get workspace context:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = { ContextController };
