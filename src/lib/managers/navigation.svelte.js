// Navigation Store - controls webview navigation
// Uses events to communicate between TopToolbar and ServiceView

function createNavigationStore() {
    let canGoBack = $state(false);
    let canGoForward = $state(false);
    let isLoading = $state(false);
    let currentUrl = $state('');
    let currentTitle = $state('');

    // Webview reference (set by ServiceView)
    let activeWebview = null;

    return {
        get canGoBack() { return canGoBack; },
        get canGoForward() { return canGoForward; },
        get isLoading() { return isLoading; },
        get currentUrl() { return currentUrl; },
        get currentTitle() { return currentTitle; },
        get hasActiveWebview() { return activeWebview !== null; },

        // Called by ServiceView to register its webview
        setActiveWebview(webview) {
            activeWebview = webview;
            if (webview) {
                try {
                    canGoBack = webview.canGoBack?.() || false;
                    canGoForward = webview.canGoForward?.() || false;
                } catch (e) {
                    // Webview not ready yet
                    canGoBack = false;
                    canGoForward = false;
                }
            }
        },

        // Update navigation state
        updateState(state) {
            if (state.canGoBack !== undefined) canGoBack = state.canGoBack;
            if (state.canGoForward !== undefined) canGoForward = state.canGoForward;
            if (state.isLoading !== undefined) isLoading = state.isLoading;
            if (state.currentUrl !== undefined) currentUrl = state.currentUrl;
            if (state.currentTitle !== undefined) currentTitle = state.currentTitle;
        },

        // Navigation actions
        goBack() {
            if (activeWebview?.canGoBack?.()) {
                activeWebview.goBack();
            }
        },

        goForward() {
            if (activeWebview?.canGoForward?.()) {
                activeWebview.goForward();
            }
        },

        reload() {
            activeWebview?.reload?.();
        },

        hardReload() {
            if (activeWebview) {
                const url = activeWebview.getURL?.();
                if (!url) return;

                // If on a login/auth page, navigate to the target URL instead
                try {
                    const urlObj = new URL(url);
                    const isLoginPage = /login|signin|auth|accounts\./i.test(urlObj.hostname + urlObj.pathname);
                    
                    if (isLoginPage) {
                        // Check for redirect parameter (e.g. ?next=, ?redirect=, ?return_to=)
                        const redirectUrl = urlObj.searchParams.get('next') 
                            || urlObj.searchParams.get('redirect') 
                            || urlObj.searchParams.get('return_to')
                            || urlObj.searchParams.get('continue');
                        
                        if (redirectUrl) {
                            activeWebview.loadURL(redirectUrl).catch(() => {});
                            return;
                        }

                        const parts = urlObj.hostname.split('.');
                        if (parts.length > 2 && parts[0] !== 'www') {
                            const rootDomain = parts.slice(1).join('.');
                            activeWebview.loadURL(`https://${rootDomain}`).catch(() => {});
                            return;
                        }
                    }
                } catch (e) {
                    // URL parse failed, fall through to normal reload
                }

                // Not a login page — do a proper hard reload (bypass cache)
                activeWebview.reloadIgnoringCache?.();
            }
        },

        goHome(url) {
            if (activeWebview && url) {
                activeWebview.loadURL(url).catch(() => {});
            }
        },

        navigate(url) {
            if (activeWebview && url) {
                if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    url = 'https://' + url;
                }
                activeWebview.loadURL(url).catch(() => {});
            }
        },

        stop() {
            activeWebview?.stop?.();
        }
    };
}

export const navigationStore = createNavigationStore();
