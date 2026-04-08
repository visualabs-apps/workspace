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

        goHome(url) {
            if (activeWebview && url) {
                activeWebview.src = url;
            }
        },

        navigate(url) {
            if (activeWebview && url) {
                // Add protocol if missing
                if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    url = 'https://' + url;
                }
                activeWebview.src = url;
            }
        },

        stop() {
            activeWebview?.stop?.();
        }
    };
}

export const navigationStore = createNavigationStore();
