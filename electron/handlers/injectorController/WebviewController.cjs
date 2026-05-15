// WebviewController.cjs — Navigation, cookies, dialogs, tab/profile management
// All methods receive the webview's webContents via event.sender

class WebviewController {
    // ─── Navigation ────────────────────────────────────────────────

    /**
     * Navigate webview to a URL
     * Note: This destroys the current JS context. The calling script will not
     * continue after navigation. Use MCP-level `navigate-and-wait` for sequential flows.
     */
    static async navigate(event, url) {
        try {
            if (!url || typeof url !== 'string') {
                return { success: false, error: 'URL is required' };
            }
            // Validate URL format
            let parsedUrl;
            try {
                parsedUrl = new URL(url);
            } catch {
                // Try adding protocol
                try {
                    parsedUrl = new URL('https://' + url);
                    url = parsedUrl.href;
                } catch {
                    return { success: false, error: 'Invalid URL: ' + url };
                }
            }

            const webContents = event.sender;
            await webContents.loadURL(url);
            return { success: true, url };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Go back in webview history
     */
    static async goBack(event) {
        try {
            const webContents = event.sender;
            if (!webContents.canGoBack()) {
                return { success: false, error: 'Cannot go back — no history' };
            }
            webContents.goBack();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Go forward in webview history
     */
    static async goForward(event) {
        try {
            const webContents = event.sender;
            if (!webContents.canGoForward()) {
                return { success: false, error: 'Cannot go forward — no history' };
            }
            webContents.goForward();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Reload current page
     */
    static async reload(event) {
        try {
            const webContents = event.sender;
            webContents.reload();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Navigate and wait for page load (MCP-ready)
     * Called from main window renderer, targets a specific webview by tab ID
     */
    static async navigateAndWait(event, { tabId, url, timeout = 30000 }, getMainWindow) {
        try {
            const mainWindow = typeof getMainWindow === 'function' ? getMainWindow() : getMainWindow;
            if (!mainWindow) return { success: false, error: 'Main window not found' };

            // Find webview element and get its webContents ID
            const webContentsId = await mainWindow.webContents.executeJavaScript(`
                (function() {
                    const selector = ${tabId} ? 'webview[data-app-id="${tabId}"]' : 'webview:focus, webview.active, webview';
                    const wv = document.querySelector(selector);
                    if (!wv) return null;
                    return wv.getWebContentsId ? wv.getWebContentsId() : null;
                })()
            `);

            if (!webContentsId) {
                // Fallback: use executeJavaScript to navigate the webview element directly
                const result = await mainWindow.webContents.executeJavaScript(`
                    (function() {
                        const selector = ${tabId} ? 'webview[data-app-id="${tabId}"]' : 'webview:focus, webview.active, webview';
                        const wv = document.querySelector(selector);
                        if (!wv) return { success: false, error: 'Webview not found' };
                        return new Promise((resolve) => {
                            const onNavigate = () => {
                                wv.removeEventListener('did-navigate', onNavigate);
                                wv.removeEventListener('did-fail-load', onFail);
                                resolve({ success: true, url: wv.src, title: wv.getTitle() ? wv.getTitle() : '' });
                            };
                            const onFail = (e, code, desc) => {
                                wv.removeEventListener('did-navigate', onNavigate);
                                wv.removeEventListener('did-fail-load', onFail);
                                resolve({ success: false, error: desc || 'Navigation failed' });
                            };
                            wv.addEventListener('did-navigate', onNavigate);
                            wv.addEventListener('did-fail-load', onFail);
                            wv.loadURL(${JSON.stringify(url)});
                            setTimeout(() => {
                                wv.removeEventListener('did-navigate', onNavigate);
                                wv.removeEventListener('did-fail-load', onFail);
                                resolve({ success: false, error: 'Navigation timeout' });
                            }, ${timeout});
                        });
                    })()
                `);
                return result;
            }

            // Use Electron's webContents to navigate
            const { webContents } = require('electron');
            const wc = webContents.fromId(webContentsId);
            if (!wc) return { success: false, error: 'WebContents not found for tab' };

            return new Promise((resolve) => {
                const timer = setTimeout(() => {
                    wc.removeListener('did-finish-load', onLoad);
                    resolve({ success: false, error: 'Navigation timeout' });
                }, timeout);

                const onLoad = () => {
                    clearTimeout(timer);
                    resolve({ success: true, url: wc.getURL(), title: wc.getTitle() });
                };

                wc.once('did-finish-load', onLoad);
                wc.loadURL(url);
            });
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // ─── Cookies ────────────────────────────────────────────────────

    /**
     * Get cookies from webview's session
     */
    static async getCookies(event, filter = {}) {
        try {
            const webContents = event.sender;
            const ses = webContents.session;
            const cookies = await ses.cookies.get(filter);
            return { success: true, cookies };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Set cookie in webview's session
     */
    static async setCookie(event, cookie) {
        try {
            if (!cookie || !cookie.name || !cookie.domain) {
                return { success: false, error: 'Cookie must have name and domain' };
            }

            const webContents = event.sender;
            const ses = webContents.session;

            const protocol = cookie.secure ? 'https://' : 'http://';
            const domain = cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain;

            await ses.cookies.set({
                url: protocol + domain + (cookie.path || '/'),
                name: cookie.name,
                value: String(cookie.value || ''),
                domain: cookie.domain,
                path: cookie.path || '/',
                secure: cookie.secure || false,
                httpOnly: cookie.httpOnly || false,
                sameSite: cookie.sameSite || 'unspecified',
                expirationDate: cookie.expirationDate || undefined
            });

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // ─── Dialog Handling ────────────────────────────────────────────

    /**
     * Register auto-response for browser dialogs (alert, confirm, prompt)
     */
    static async handleDialog(event, options = {}) {
        try {
            const webContents = event.sender;
            const { accept = true, text = '' } = options;

            // Remove any existing handler to prevent duplicates
            webContents.removeAllListeners('dialog');

            webContents.on('dialog', (event, dialogType, message, buttons) => {
                event.preventDefault();
                if (dialogType === 'prompt') {
                    event.returnValue = accept ? text : null;
                } else if (dialogType === 'confirm') {
                    event.returnValue = accept;
                } else if (dialogType === 'alert') {
                    event.returnValue = 0;
                } else {
                    // beforeunload
                    event.returnValue = accept ? 0 : 1;
                }
            });

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Remove dialog handler (restore default behavior)
     */
    static async clearDialogHandler(event) {
        try {
            const webContents = event.sender;
            webContents.removeAllListeners('dialog');
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // ─── Profile / Tab Management (MCP-ready) ─────────────────────

    /**
     * List all workspace profiles
     */
    static async listProfiles(event, getMainWindow) {
        try {
            const mainWindow = typeof getMainWindow === 'function' ? getMainWindow() : getMainWindow;
            if (!mainWindow) return { success: false, error: 'Main window not found' };

            const result = await mainWindow.webContents.executeJavaScript(`
                (function() {
                    try {
                        if (typeof window.workspaceStore === 'undefined') {
                            return { success: false, error: 'Workspace store not available' };
                        }
                        const workspaces = window.workspaceStore.workspaces || [];
                        const activeId = window.workspaceStore.activeWorkspace?.id;
                        return {
                            success: true,
                            profiles: workspaces.map(function(w) {
                                return {
                                    id: w.id,
                                    name: w.name || 'Unnamed',
                                    url: w.url || '',
                                    active: w.id === activeId
                                };
                            })
                        };
                    } catch (e) {
                        return { success: false, error: e.message };
                    }
                })()
            `);
            return result;
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * List all open tabs (webviews)
     */
    static async listTabs(event, getMainWindow) {
        try {
            const mainWindow = typeof getMainWindow === 'function' ? getMainWindow() : getMainWindow;
            if (!mainWindow) return { success: false, error: 'Main window not found' };

            const result = await mainWindow.webContents.executeJavaScript(`
                (function() {
                    try {
                        var webviews = document.querySelectorAll('webview[data-app-id]');
                        var tabs = [];
                        var activeId = (typeof window.appStore !== 'undefined') ? window.appStore.activeAppId : null;
                        
                        webviews.forEach(function(wv) {
                            var appId = wv.getAttribute('data-app-id');
                            tabs.push({
                                id: appId,
                                url: wv.src || '',
                                title: (wv.getTitle && typeof wv.getTitle === 'function') ? wv.getTitle() : '',
                                active: appId === activeId
                            });
                        });
                        
                        return { success: true, tabs: tabs };
                    } catch (e) {
                        return { success: false, error: e.message };
                    }
                })()
            `);
            return result;
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Switch to a specific tab by ID
     */
    static async switchTab(event, tabId, getMainWindow) {
        try {
            if (!tabId || typeof tabId !== 'string') {
                return { success: false, error: 'Tab ID is required' };
            }

            const mainWindow = typeof getMainWindow === 'function' ? getMainWindow() : getMainWindow;
            if (!mainWindow) return { success: false, error: 'Main window not found' };

            const result = await mainWindow.webContents.executeJavaScript(`
                (function() {
                    try {
                        var webview = document.querySelector('webview[data-app-id="${tabId}"]');
                        if (!webview) return { success: false, error: 'Tab not found: ${tabId}' };
                        
                        if (typeof window.appStore !== 'undefined' && window.appStore.setActiveApp) {
                            window.appStore.setActiveApp('${tabId}');
                        }
                        
                        return { success: true };
                    } catch (e) {
                        return { success: false, error: e.message };
                    }
                })()
            `);
            return result;
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Get current page info from a specific tab (or active tab)
     */
    static async getPageInfo(event, tabId, getMainWindow) {
        try {
            const mainWindow = typeof getMainWindow === 'function' ? getMainWindow() : getMainWindow;
            if (!mainWindow) return { success: false, error: 'Main window not found' };

            const selector = tabId
                ? 'webview[data-app-id="' + tabId + '"]'
                : 'webview:focus, webview.active, webview';

            const result = await mainWindow.webContents.executeJavaScript(`
                (function() {
                    try {
                        var wv = document.querySelector('${selector}');
                        if (!wv) return { success: false, error: 'No webview found' };
                        return {
                            success: true,
                            id: wv.getAttribute('data-app-id'),
                            url: wv.src || '',
                            title: (wv.getTitle && typeof wv.getTitle === 'function') ? wv.getTitle() : '',
                            canGoBack: wv.canGoBack ? wv.canGoBack() : false,
                            canGoForward: wv.canGoForward ? wv.canGoForward() : false
                        };
                    } catch (e) {
                        return { success: false, error: e.message };
                    }
                })()
            `);
            return result;
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = { WebviewController };
