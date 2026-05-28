<script>
    import { onMount, onDestroy } from "svelte";
    import { navigationStore } from "../../lib/managers/navigation.svelte.js";
    import { appStore } from "../../lib/stores/apps.svelte.js";
    import { workspaceStore } from "../../lib/stores/workspaces.svelte.js";
    import { linkRoutingStore } from "../../lib/utils/linkRouting.svelte.js";
    import { historyStore } from "../../lib/stores/history.svelte.js";
    import { getErrorInfo, getCrashError } from "../../lib/utils/errorPages.js";
    import { generateErrorPage } from "../../lib/utils/generateErrorPage.js";


    /**
     * Detect OAuth / login popup URLs that require the webview's session.
     * These must be navigated within the current webview (not opened in a
     * new window) so that authentication cookies are stored in the correct
     * session partition.
     */
    function isOAuthLoginUrl(url) {
        try {
            const parsed = new URL(url);
            const host = parsed.hostname;
            const pathname = parsed.pathname;

            // Google accounts / login
            if (host === 'accounts.google.com') return true;
            if (host.endsWith('.google.com') && pathname.startsWith('/signin')) return true;
            if (host.endsWith('.google.com') && pathname.startsWith('/login')) return true;
            if (host.endsWith('.google.com') && pathname.includes('ServiceLogin')) return true;

            // Microsoft login
            if (host === 'login.microsoftonline.com') return true;
            if (host === 'login.live.com') return true;

            // Facebook login
            if (host === 'www.facebook.com' && pathname.startsWith('/login')) return true;
            if (host === 'www.facebook.com' && pathname.startsWith('/v')) return true; // OAuth dialog

            // Twitter/X login
            if (host === 'twitter.com' && pathname.startsWith('/oauth')) return true;
            if (host === 'api.twitter.com' && pathname.startsWith('/oauth')) return true;

            // Generic OAuth indicators in URL
            if (parsed.searchParams.has('client_id') && (parsed.searchParams.has('redirect_uri') || parsed.searchParams.has('redirect_url'))) return true;
            if (pathname.includes('/oauth') || pathname.includes('/authorize') || pathname.includes('/auth')) return true;
        } catch (_) {}
        return false;
    }

    let { app, isActive } = $props();

    const webviewRegistry = globalThis.webviewRegistry || (globalThis.webviewRegistry = new Map());
    const reloadTracker = globalThis.reloadTracker || (globalThis.reloadTracker = new Map());

    // Local state
    let container = $state(null);
    let webview = $state(null);
    let loadingState = $state(false);
    let domReadyState = $state(false);
    let showZoomIndicator = $state(false);
    let zoomIndicatorTimeout = null;
    let preloadPath = $state('');
    
    // Destroyed flag — prevents stale/zombie IPC handlers from firing
    // after this component instance has been unmounted
    let isDestroyed = false;
    
    // IPC listener cleanup refs — stored at component scope so onDestroy can access them
    let _removeOpenLinkListener = null;
    let _removeDownloadImageListener = null;
    let _removeReloadWebviewListener = null;
    let _removeWebviewOpenListener = null;

    // Track if webview should be unloaded (removed from DOM)
    let shouldUnload = $derived(app.isUnloaded === true && !isActive);

    function updateNavigationState() {
        if (isActive && webview && domReadyState) {
            try {
                const canGoBack = webview.canGoBack?.() || false;
                const canGoForward = webview.canGoForward?.() || false;
                const currentUrl = webview.getURL?.() || app.url;
                
                navigationStore.updateState({
                    canGoBack,
                    canGoForward,
                    isLoading: loadingState || false,
                    currentUrl,
                });
            } catch (e) {
                // Webview not ready yet, skip update
            }
        } else if (isActive) {
            // If this tab is active but webview not ready, still update loading state
            navigationStore.updateState({
                isLoading: loadingState || false,
            });
        }
    }

    $effect(() => {
        if (isActive && webview) {
            try {
                navigationStore.setActiveWebview(webview);
                updateNavigationState();
            } catch (e) {}
        } else if (!isActive) {
            navigationStore.updateState({ isLoading: false });
        }
    });

    // Separate effect for zoom - applies immediately when webview is available
    $effect(() => {
        const zoomLevel = app.zoomLevel ?? 0;
        if (webview) {
            try {
                if (webview.getWebContentsId) {
                    webview.setZoomLevel(zoomLevel);
                }
            } catch (e) {}
        }
    });

    // Effect for audio mute (still needs domReadyState for other operations)
    $effect(() => {
        const isMuted = app.isMuted || false;
        if (webview && domReadyState) {
            try {
                if (webview.getWebContentsId) {
                    webview.setAudioMuted(isMuted);
                }
            } catch (e) {}
        }
    });

    function handleWheel(e) {
        if (e.ctrlKey) {
            e.preventDefault();
            const currentZoom = app.zoomLevel ?? 0;

            const currentPercent = Math.round(Math.pow(1.2, currentZoom) * 100);

            const delta = e.deltaY > 0 ? -10 : 10;
            let newPercent = currentPercent + delta;

            newPercent = Math.max(25, Math.min(500, newPercent));

            const newZoomLevel = Math.log(newPercent / 100) / Math.log(1.2);

            appStore.updateApp(app.id, {
                zoomLevel: newZoomLevel,
            });

            showZoomIndicator = true;
            if (zoomIndicatorTimeout) clearTimeout(zoomIndicatorTimeout);
            zoomIndicatorTimeout = setTimeout(() => {
                showZoomIndicator = false;
            }, 2000);
        }
    }

    function getZoomPercent() {
        const zoomLevel = app.zoomLevel ?? 0;
        return Math.round(Math.pow(1.2, zoomLevel) * 100);
    }

    function handleWebviewOpenNewWindow(url) {
        // Guard: prevent zombie handlers from closed tabs
        if (isDestroyed) return;
        if (!isActive || !app?.id || !url) return;
        
        // Create new tab in v-box
        const newApp = appStore.addApp(
            { name: "New Tab", url, icon: null, color: "#4285f4" },
            null, null, null,
            workspaceStore.activeWorkspace?.id,
        );
        if (workspaceStore.activeWorkspace && newApp) {
            workspaceStore.addAppToWorkspace(workspaceStore.activeWorkspace.id, newApp.id, app?.id);
        }
    }

    function setupWebviewListeners(webviewElement) {
        const handleDomReady = async () => {
            if (!app?.id) return;
            domReadyState = true;
            loadingState = false;
            if (isActive) updateNavigationState();
            try {
                webviewElement.setZoomLevel(app.zoomLevel ?? 0);
                webviewElement.setAudioMuted(app.isMuted || false);
            } catch (e) {}
        };

        const handleDidStartLoading = () => {
            if (!app?.id) return;
            if (!domReadyState) {
                loadingState = true;
                if (isActive) {
                    navigationStore.updateState({ isLoading: true });
                }
            }
        };

        const handleDidReload = () => {
            if (!app?.id) return;
            const now = Date.now();
            const appId = app.id;
            if (!reloadTracker.has(appId)) {
                reloadTracker.set(appId, { timestamps: [], url: app.url, suppressed: false });
            }
            const tracker = reloadTracker.get(appId);
            tracker.timestamps.push(now);
            tracker.url = webviewElement.getURL?.() || app.url;
            tracker.timestamps = tracker.timestamps.filter(t => now - t < 30000);
        };

        const handleDidStopLoading = () => {
            if (!app?.id) return;
            loadingState = false;
            
            // ✅ FIX: Update URL bar saat loading selesai
            if (isActive) {
                try {
                    const currentUrl = webviewElement.getURL?.();
                    const canGoBack = webviewElement.canGoBack?.() || false;
                    const canGoForward = webviewElement.canGoForward?.() || false;
                    
                    navigationStore.updateState({
                        isLoading: false,
                        currentUrl: currentUrl || app.url,
                        canGoBack,
                        canGoForward
                    });
                } catch (e) {
                    navigationStore.updateState({ isLoading: false });
                }
            }

            // If the page has no <title>, page-title-updated never fires.
            // Fall back to the URL (hostname + path) so the tab isn't stuck on "New Tab".
            if (app.name === 'New Tab' || !app.name) {
                try {
                    const currentUrl = webviewElement.getURL?.();
                    if (currentUrl && !currentUrl.startsWith('data:')) {
                        const urlObj = new URL(currentUrl);
                        const fallbackName = urlObj.hostname +
                            (urlObj.pathname && urlObj.pathname !== '/' ? urlObj.pathname : '');
                        appStore.updateApp(app.id, { name: fallbackName });
                    }
                } catch (e) {}
            }
        };

        const handleDidNavigate = async (e) => {
            if (!app?.id) return;
            let url = null;
            try { url = webviewElement.getURL?.(); } catch (err) {}

            if (url && url.startsWith('data:')) {
                loadingState = false;
                domReadyState = true;
                return;
            }

            domReadyState = false;
            loadingState = true;

            if (url) {
                // Set provisional name from URL hostname immediately.
                // page-title-updated will override this if the page has a <title>.
                // If no <title> exists, the hostname stays as the tab name.
                let provisionalName = url;
                try {
                    const urlObj = new URL(url);
                    provisionalName = urlObj.hostname +
                        (urlObj.pathname && urlObj.pathname !== '/' ? urlObj.pathname : '');
                } catch (_) {}

                appStore.updateApp(app.id, { url, name: provisionalName });

                if (workspaceStore.activeWorkspace) {
                    historyStore.addEntry(workspaceStore.activeWorkspace.id, url, provisionalName, app.icon);
                }
                
                // ✅ FIX: Update navigationStore AFTER appStore update
                if (isActive) {
                    const canGoBack = webviewElement.canGoBack?.() || false;
                    const canGoForward = webviewElement.canGoForward?.() || false;
                    
                    navigationStore.updateState({ 
                        isLoading: true,
                        currentUrl: url,
                        canGoBack,
                        canGoForward
                    });
                }
            } else if (isActive) {
                // No URL but still update loading state
                navigationStore.updateState({ isLoading: true });
            }
        };

        const handlePageTitleUpdated = (e) => {
            if (!app?.id) return;
            try {
                const currentUrl = webviewElement.getURL?.();
                if (currentUrl && currentUrl.startsWith('data:')) return;
            } catch (err) {}

            let title = e.title;
            if (!title || !title.trim()) {
                try {
                    const url = webviewElement.getURL?.();
                    if (url) {
                        const urlObj = new URL(url);
                        title = urlObj.hostname + urlObj.pathname;
                    }
                } catch (err) {}
            }

            if (title) {
                appStore.updateApp(app.id, { name: title });
            }

            if (isActive && title) {
                navigationStore.updateState({ currentTitle: title });
            }

            if (workspaceStore.activeWorkspace) {
                try {
                    const currentUrl = webviewElement.getURL?.();
                    if (currentUrl) {
                        historyStore.addEntry(workspaceStore.activeWorkspace.id, currentUrl, e.title, app.icon);
                    }
                } catch (err) {}
            }

            // Check for unread count in title (e.g., "(3) WhatsApp")
            const match = e.title.match(/^\(?(\d+)\)?\s/);
            if (match) {
                const count = parseInt(match[1], 10);
                appStore.updateApp(app.id, { unreadCount: count });
            } else if (app.unreadCount > 0) {
                appStore.updateApp(app.id, { unreadCount: 0 });
            }
        };

        const handlePageFaviconUpdated = (e) => {
            if (!app?.id) return;
            if (e.favicons?.length > 0) {
                appStore.updateApp(app.id, { icon: e.favicons[0] });
            }
        };

        const handleContextMenu = (e) => {
            if (!app?.id) return;
            e.preventDefault();
            window.api.showContextMenu({
                ...e.params,
                partition: app.partition,
                webContentsId: webviewElement.getWebContentsId?.()
            });
        };
        
        const handleConsoleMessage = (e) => {
            const level = e.level === 0 ? 'log' : e.level === 1 ? 'warn' : e.level === 2 ? 'error' : 'info';
            
            if (window.api?.sendConsoleLog) {
                window.api.sendConsoleLog({ level, message: e.message });
            }
        };

        const handleDidFailLoad = (e) => {
            if (!app?.id) return;
            if (e.errorCode === -3) return;
            if (e.isMainFrame === false) return;

            const errorInfo = getErrorInfo(e.errorCode);
            const failedUrl = e.validatedURL || app.url;

            const html = generateErrorPage({
                icon: errorInfo.icon,
                title: errorInfo.title,
                description: errorInfo.description,
                errorCode: e.errorCode,
                url: failedUrl,
                theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light'
            });

            webviewElement.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html)).catch(() => {});

            loadingState = false;
            domReadyState = false;
            if (isActive) {
                updateNavigationState();
            }
        };

        const handleCrashed = (e) => {
            if (!app?.id) return;
            const crashInfo = getCrashError();
            const failedUrl = webviewElement.getURL?.() || app.url;

            const html = generateErrorPage({
                icon: crashInfo.icon,
                title: crashInfo.title,
                description: crashInfo.description,
                errorCode: 'crashed',
                url: failedUrl,
                theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light'
            });

            webviewElement.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html)).catch(() => {});

            loadingState = false;
        };

        webviewElement.addEventListener("dom-ready", handleDomReady);
        webviewElement.addEventListener("did-start-loading", handleDidStartLoading);
        webviewElement.addEventListener("did-stop-loading", handleDidStopLoading);
        webviewElement.addEventListener("did-navigate", handleDidNavigate);
        webviewElement.addEventListener("did-navigate-in-page", handleDidNavigate);
        webviewElement.addEventListener("page-title-updated", handlePageTitleUpdated);
        webviewElement.addEventListener("page-favicon-updated", handlePageFaviconUpdated);
        webviewElement.addEventListener("did-reload", handleDidReload);
        webviewElement.addEventListener("context-menu", handleContextMenu);
        webviewElement.addEventListener("console-message", handleConsoleMessage);
        webviewElement.addEventListener("did-fail-load", handleDidFailLoad);
        webviewElement.addEventListener("crashed", handleCrashed);

        return () => {
            webviewElement.removeEventListener("dom-ready", handleDomReady);
            webviewElement.removeEventListener("did-start-loading", handleDidStartLoading);
            webviewElement.removeEventListener("did-stop-loading", handleDidStopLoading);
            webviewElement.removeEventListener("did-navigate", handleDidNavigate);
            webviewElement.removeEventListener("did-navigate-in-page", handleDidNavigate);
            webviewElement.removeEventListener("page-title-updated", handlePageTitleUpdated);
            webviewElement.removeEventListener("page-favicon-updated", handlePageFaviconUpdated);
            webviewElement.removeEventListener("did-reload", handleDidReload);
            webviewElement.removeEventListener("context-menu", handleContextMenu);
            webviewElement.removeEventListener("console-message", handleConsoleMessage);
            webviewElement.removeEventListener("did-fail-load", handleDidFailLoad);
            webviewElement.removeEventListener("crashed", handleCrashed);
        };
    }

    onMount(async () => {
        const appPath = await window.api.getAppPath();
        preloadPath = appPath + '/electron/webview-preload.bundle.cjs';

        let webviewElement = webviewRegistry.get(app.id);
        let isNewWebview = false;

        if (!webviewElement) {
            isNewWebview = true;
            webviewElement = document.createElement('webview');
            webviewElement.partition = app.partition;
            webviewElement.allowpopups = true;
            webviewElement.preload = preloadPath;
            // Use Chrome 148 User-Agent — must match constants.cjs CHROME_VERSION
            // Note: onBeforeSendHeaders overrides this per-URL anyway, but the initial
            // webview attribute should match to avoid version mismatch detection
            webviewElement.useragent = app.userAgent ||
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36";
            webviewElement.style.width = '100%';
            webviewElement.style.height = '100%';
            webviewElement.setAttribute('data-webview', 'true');
            // ✅ Enable WebAuthn/Passkeys support
            webviewElement.setAttribute('webpreferences', 'enableWebAuthn=yes');
            webviewRegistry.set(app.id, webviewElement);
            loadingState = true;
            domReadyState = false;
        } else {
            domReadyState = true;
            loadingState = false;
        }

        // Re-setup listeners each mount; clean up old ones first if reusing webview
        if (webviewElement._cleanup) webviewElement._cleanup();
        webviewElement._cleanup = setupWebviewListeners(webviewElement);

        if (container && webviewElement && !shouldUnload) {
            if (webviewElement.parentNode && webviewElement.parentNode !== container) {
                webviewElement.parentNode.removeChild(webviewElement);
            }
            if (webviewElement.parentNode !== container) {
                container.appendChild(webviewElement);
            }
            webview = webviewElement;
        }

        // Set src AFTER listeners and DOM attachment so did-fail-load is caught
        if (isNewWebview && webviewElement) {
            requestAnimationFrame(() => { 
                webviewElement.src = app.url;
            });
        }

        // Listen for tab reload events from TabBar
        const handleTabReload = (event) => {
            const { appId } = event.detail;
            if (appId === app.id && webview) {
                try {
                    webview.reload();
                } catch (e) {
                    console.warn("Failed to reload webview:", e);
                }
            }
        };

        window.addEventListener('reloadTab', handleTabReload);

        // globalThis flag prevents duplicate processing when multiple ServiceView instances
        // all receive the same IPC event simultaneously
        const globalFlagKey = '__ServiceView_tabOpenProcessing';

        const handleOpenLinkNewTab = (url) => {
            // Guard: if this component instance has been destroyed, do nothing
            // This prevents stale/zombie handlers from tab B and C (closed earlier)
            // from firing after the component unmounted
            if (isDestroyed) return;
            
            if (!isActive) { return; }
            if (!app) { return; }
            if (!url) { return; }

            // Skip if already processing (prevent duplicate opens from ALL ServiceView instances)
            if (globalThis[globalFlagKey]) {
                return;
            }
            globalThis[globalFlagKey] = true;

            // Reset flag after a delay to allow future opens
            setTimeout(() => {
                globalThis[globalFlagKey] = false;
            }, 1000);

            try {
                const workspaceId = workspaceStore.activeWorkspace?.id;
                if (!workspaceId) return;

                const currentAppId = app?.id;

                const newApp = appStore.addApp(
                    {
                        name: "New Tab",
                        url: url,
                        icon: null,
                        color: "#4285f4",
                    },
                    null,
                    null,
                    null,
                    workspaceId,
                );

                if (newApp?.id) {
                    workspaceStore.addAppToWorkspace(workspaceId, newApp.id, currentAppId)
                        .catch(err => console.warn('[ServiceView] addAppToWorkspace failed:', err));
                }
            } catch (e) {
                console.warn('[ServiceView] Failed to open link in new tab:', e);
            }
        };

        const handleDownloadImage = (imageUrl) => {
            // Image downloads are handled by the main process; this is a fallback only
            if (!imageUrl) return;
            console.warn('[ServiceView] handleDownloadImage called unexpectedly');
        };

        const handleReloadWebview = () => {
            if (webview) {
                try {
                    webview.reload();
                } catch (e) {
                    console.warn("Failed to reload webview:", e);
                }
            }
        };

        _removeOpenLinkListener    = window.api?.onOpenLinkNewTab?.(handleOpenLinkNewTab);
        _removeDownloadImageListener = window.api?.onDownloadImage?.(handleDownloadImage);
        _removeReloadWebviewListener = window.api?.onReloadWebview?.(handleReloadWebview);

        // Listen for webview window.open / target="_blank" from main process
        _removeWebviewOpenListener = window.api?.onWebviewOpenNewWindow?.(handleWebviewOpenNewWindow);

        return () => {
            window.removeEventListener('reloadTab', handleTabReload);
            if (typeof _removeOpenLinkListener === 'function')    { _removeOpenLinkListener();    _removeOpenLinkListener = null; }
            if (typeof _removeDownloadImageListener === 'function') { _removeDownloadImageListener(); _removeDownloadImageListener = null; }
            if (typeof _removeReloadWebviewListener === 'function') { _removeReloadWebviewListener(); _removeReloadWebviewListener = null; }
            if (typeof _removeWebviewOpenListener === 'function') { _removeWebviewOpenListener(); _removeWebviewOpenListener = null; }
        };
    });
    
    $effect(() => {
        if (!app?.id) return;
        const webviewElement = webviewRegistry.get(app.id);

        if (shouldUnload && webviewElement?.parentNode) {
            try { webviewElement.parentNode.removeChild(webviewElement); webview = null; } catch (e) {}
        } else if (!shouldUnload && webviewElement && container && !webviewElement.parentNode) {
            try {
                container.appendChild(webviewElement);
                webview = webviewElement;
                // Do NOT call reload() — preserves page state and avoids Cloudflare/security loops
            } catch (e) {}
        }
    });

    onDestroy(() => {
        // Prevent any still-queued IPC callbacks from executing on stale state
        isDestroyed = true;

        // Safety net: remove IPC listeners (onMount cleanup does this too,
        // but onDestroy guarantees it even on race conditions)
        if (typeof _removeOpenLinkListener === 'function')    { _removeOpenLinkListener();    _removeOpenLinkListener = null; }
        if (typeof _removeDownloadImageListener === 'function') { _removeDownloadImageListener(); _removeDownloadImageListener = null; }
        if (typeof _removeReloadWebviewListener === 'function') { _removeReloadWebviewListener(); _removeReloadWebviewListener = null; }
        if (typeof _removeWebviewOpenListener === 'function') { _removeWebviewOpenListener(); _removeWebviewOpenListener = null; }

        const webviewElement = webviewRegistry.get(app?.id);
        if (webviewElement?._cleanup) {
            webviewElement._cleanup();
            webviewElement._cleanup = null;
        }

        // Detach from DOM but keep in registry (preserves webview state)
        if (webview && webview.parentNode === container) {
            try { webview.parentNode.removeChild(webview); } catch (e) {}
        }

        if (app?.id) reloadTracker.delete(app.id);

        webview = null;
        loadingState = false;
        domReadyState = false;
    });
</script>

<div
    class="w-full h-full flex flex-col relative"
    style:display={isActive ? "flex" : "none"}
>
    <div class="flex-1 relative bg-gray-50">
        <!-- Webview container - hidden when error overlay is shown (webview renders as native layer on top) -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
            bind:this={container}
            class="w-full h-full"
            data-webview-container="true"
        ></div>
        
        <!-- Unloaded indicator -->
        {#if shouldUnload}
            <div class="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
                <div class="text-center">
                    <div class="text-gray-400 text-sm mb-2">
                        <svg class="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
                        </svg>
                        Tab unloaded to save memory
                    </div>
                    <div class="text-gray-500 text-xs">
                        Click to reload
                    </div>
                </div>
            </div>
        {/if}
        
        </div>

    <!-- Zoom Indicator -->
    {#if showZoomIndicator}
        <div class="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
            <div class="bg-white/95 backdrop-blur-sm rounded-lg shadow-2xl border border-gray-200 px-4 py-2 flex items-center gap-3">
                <button
                    onclick={() => {
                        const currentZoom = app.zoomLevel ?? 0;
                        const currentPercent = Math.round(Math.pow(1.2, currentZoom) * 100);
                        const newPercent = Math.max(25, currentPercent - 10);
                        const newZoomLevel = Math.log(newPercent / 100) / Math.log(1.2);
                        appStore.updateApp(app.id, { zoomLevel: newZoomLevel });
                    }}
                    class="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700 transition-colors"
                    title="Zoom out"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
                <div class="flex flex-col items-center min-w-[60px]">
                    <span class="text-gray-900 font-semibold text-sm">{getZoomPercent()}%</span>
                    <div class="w-full h-1 bg-gray-200 rounded-full mt-1">
                        <div class="h-full bg-blue-500 rounded-full transition-all duration-150" style="width: {Math.min(100, (getZoomPercent() - 25) / (500 - 25) * 100)}%"></div>
                    </div>
                </div>
                <button
                    onclick={() => {
                        const currentZoom = app.zoomLevel ?? 0;
                        const currentPercent = Math.round(Math.pow(1.2, currentZoom) * 100);
                        const newPercent = Math.min(500, currentPercent + 10);
                        const newZoomLevel = Math.log(newPercent / 100) / Math.log(1.2);
                        appStore.updateApp(app.id, { zoomLevel: newZoomLevel });
                    }}
                    class="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700 transition-colors"
                    title="Zoom in"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
                {#if getZoomPercent() !== 100}
                    <button
                        onclick={() => appStore.updateApp(app.id, { zoomLevel: 0 })}
                        class="px-2 py-0.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                        title="Reset to 100% (Ctrl+0)"
                    >
                        Reset
                    </button>
                {/if}
            </div>
        </div>
    {/if}
</div>

