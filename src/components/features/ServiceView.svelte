<script>
    import { onMount, onDestroy } from "svelte";
    import { navigationStore } from "../../lib/managers/navigation.svelte.js";
    import { appStore } from "../../lib/stores/apps.svelte.js";
    import { workspaceStore } from "../../lib/stores/workspaces.svelte.js";
    import { linkRoutingStore } from "../../lib/utils/linkRouting.svelte.js";
    import { historyStore } from "../../lib/stores/history.svelte.js";
    import { Rocket, Plus } from "lucide-svelte";

    let { app, isActive } = $props();

    // Global webview registry - persistent across component lifecycle
    const webviewRegistry = globalThis.webviewRegistry || (globalThis.webviewRegistry = new Map());

    // Reload tracking - detect unwanted rapid reloads
    const reloadTracker = globalThis.reloadTracker || (globalThis.reloadTracker = new Map());

    // Local state
    let container = $state(null);
    let webview = $state(null);
    let loadingState = $state(false);
    let domReadyState = $state(false);
    let showZoomIndicator = $state(false);
    let zoomIndicatorTimeout = null;
    let preloadPath = $state('');
    
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
        if (isActive && webview && domReadyState) {
            try {
                navigationStore.setActiveWebview(webview);
                updateNavigationState();
            } catch (e) {
                // Ignore errors
            }
        } else if (!isActive) {
            // When tab becomes inactive, clear loading state from navigation store
            // This ensures loading indicator disappears when switching to non-loading tabs
            navigationStore.updateState({ isLoading: false });
        }
    });

    $effect(() => {
        if (webview && domReadyState) {
            const zoomLevel = app.zoomLevel ?? 0;

            try {
                if (webview.getWebContentsId) {
                    webview.setZoomLevel(zoomLevel);
                    webview.setAudioMuted(app.isMuted || false);
                }
            } catch (e) {
                // Webview not ready yet, will retry on next effect
            }
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
            }, 1000);
        }
    }

    function getZoomPercent() {
        const zoomLevel = app.zoomLevel ?? 0;
        return Math.round(Math.pow(1.2, zoomLevel) * 100);
    }

    function setupWebviewListeners(webviewElement) {
        const handleDomReady = async () => {
            domReadyState = true;
            loadingState = false;
            if (isActive) {
                updateNavigationState();
            }

            // Apply zoom level after webview is ready
            const zoomLevel = app.zoomLevel ?? 0;
            try {
                webviewElement.setZoomLevel(zoomLevel);
                webviewElement.setAudioMuted(app.isMuted || false);
            } catch (e) {
                // Ignore errors
            }
        };

        const handleDidStartLoading = () => {
            loadingState = true;
            if (isActive) {
                navigationStore.updateState({ isLoading: true });
            }
        };

        const handleDidReload = () => {
            // Track reload events to detect unwanted rapid reloads
            const now = Date.now();
            const appId = app.id;
            
            if (!reloadTracker.has(appId)) {
                reloadTracker.set(appId, { timestamps: [], url: app.url, suppressed: false });
            }
            
            const tracker = reloadTracker.get(appId);
            tracker.timestamps.push(now);
            tracker.url = webviewElement.getURL?.() || app.url;
            
            // Keep only last 30 seconds of data
            tracker.timestamps = tracker.timestamps.filter(t => now - t < 30000);
            
            // Count reloads in last 10 seconds
            const recentReloads = tracker.timestamps.filter(t => now - t < 10000);
            
            if (recentReloads.length >= 5) {
                console.error(
                    `[RELOAD-DETECT] ⚠️ EXCESSIVE RELOADS detected on "${app.name}" (id: ${appId})\n` +
                    `  URL: ${tracker.url}\n` +
                    `  ${recentReloads.length} reloads in last 10 seconds\n` +
                    `  This may indicate an infinite reload loop. Check for:\n` +
                    `  - Security verification pages (Cloudflare, etc.)\n` +
                    `  - JavaScript redirects that trigger on load\n` +
                    `  - Service workers or meta refresh tags`
                );
                tracker.suppressed = true;
            } else if (recentReloads.length >= 3) {
                console.warn(
                    `[RELOAD-DETECT] Frequent reloads on "${app.name}" (id: ${appId}): ` +
                    `${recentReloads.length} reloads in 10s — URL: ${tracker.url}`
                );
            }
        };

        const handleDidStopLoading = () => {
            loadingState = false;
            if (isActive) {
                updateNavigationState();
            }
        };

        const handleDidNavigate = (e) => {
            let url = null;
            try {
                url = webviewElement.getURL?.();
            } catch (err) {
                // Webview not ready yet
            }
            if (url) {
                appStore.updateApp(app.id, { url });
                
                // Track navigation for redirect loop detection
                const now = Date.now();
                const appId = app.id;
                if (!reloadTracker.has(appId)) {
                    reloadTracker.set(appId, { timestamps: [], navigations: [], url: app.url, suppressed: false });
                }
                const tracker = reloadTracker.get(appId);
                if (!tracker.navigations) tracker.navigations = [];
                tracker.navigations.push({ url, time: now });
                // Keep only last 30 seconds
                tracker.navigations = tracker.navigations.filter(n => now - n.time < 30000);
                
                // Detect rapid navigation to same URL (redirect loop)
                const recentNavs = tracker.navigations.filter(n => now - n.time < 10000);
                const sameUrlNavs = recentNavs.filter(n => n.url === url);
                if (sameUrlNavs.length >= 5) {
                    console.error(
                        `[NAV-LOOP] ⚠️ REDIRECT LOOP detected on "${app.name}" (id: ${appId})\n` +
                        `  URL: ${url}\n` +
                        `  ${sameUrlNavs.length} navigations to same URL in 10 seconds\n` +
                        `  This suggests the page is redirecting to itself`
                    );
                }
                
                // Add to history when navigation completes
                if (workspaceStore.activeWorkspace) {
                    historyStore.addEntry(
                        workspaceStore.activeWorkspace.id,
                        url,
                        app.name,
                        app.icon
                    );
                }
            }
            updateNavigationState();
        };

        const handlePageTitleUpdated = (e) => {
            // Update app name so it shows in sidebar and TabBar
            appStore.updateApp(app.id, { name: e.title });

            if (isActive) {
                navigationStore.updateState({ currentTitle: e.title });
            }

            // Update history with new title
            if (workspaceStore.activeWorkspace) {
                try {
                    const currentUrl = webviewElement.getURL?.();
                    if (currentUrl) {
                        historyStore.addEntry(
                            workspaceStore.activeWorkspace.id,
                            currentUrl,
                            e.title,
                            app.icon
                        );
                    }
                } catch (err) {
                    // Ignore errors
                }
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
            // Update app icon so it shows in sidebar
            if (e.favicons && e.favicons.length > 0) {
                appStore.updateApp(app.id, {
                    icon: e.favicons[0]
                });
            }
        };

        const handleNewWindow = (e) => {
            e.preventDefault();
            const url = e.url;

            // Use smart link routing
            const routing = linkRoutingStore.getRoutingAction(url);

            if (routing.action === "external") {
                window.open(url, "_blank");
            } else if (routing.action === "new-tab") {
                // Create new app/app
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
                    workspaceStore.activeWorkspace?.id,
                );

                if (workspaceStore.activeWorkspace && newApp) {
                    workspaceStore.addAppToWorkspace(workspaceStore.activeWorkspace.id, newApp.id);
                }
            } else {
                window.open(url, "_blank", "width=1000,height=800");
            }
        };

        const handleContextMenu = (e) => {
            e.preventDefault();
            // Include partition information for cookie export
            window.api.showContextMenu({
                ...e.params,
                partition: app.partition
            });
        };
        
        const handleConsoleMessage = (e) => {
            const level = e.level === 0 ? 'log' : e.level === 1 ? 'warn' : e.level === 2 ? 'error' : 'info';
            
            if (window.api?.sendConsoleLog) {
                window.api.sendConsoleLog({ level, message: e.message });
            }
        };

        webviewElement.addEventListener("dom-ready", handleDomReady);
        webviewElement.addEventListener("did-start-loading", handleDidStartLoading);
        webviewElement.addEventListener("did-stop-loading", handleDidStopLoading);
        webviewElement.addEventListener("did-navigate", handleDidNavigate);
        webviewElement.addEventListener("did-navigate-in-page", handleDidNavigate);
        webviewElement.addEventListener("page-title-updated", handlePageTitleUpdated);
        webviewElement.addEventListener("page-favicon-updated", handlePageFaviconUpdated);
        webviewElement.addEventListener("new-window", handleNewWindow);
        webviewElement.addEventListener("did-reload", handleDidReload);
        webviewElement.addEventListener("context-menu", handleContextMenu);
        webviewElement.addEventListener("console-message", handleConsoleMessage);

        return () => {
            webviewElement.removeEventListener("dom-ready", handleDomReady);
            webviewElement.removeEventListener("did-start-loading", handleDidStartLoading);
            webviewElement.removeEventListener("did-stop-loading", handleDidStopLoading);
            webviewElement.removeEventListener("did-navigate", handleDidNavigate);
            webviewElement.removeEventListener("did-navigate-in-page", handleDidNavigate);
            webviewElement.removeEventListener("page-title-updated", handlePageTitleUpdated);
            webviewElement.removeEventListener("page-favicon-updated", handlePageFaviconUpdated);
            webviewElement.removeEventListener("new-window", handleNewWindow);
            webviewElement.removeEventListener("did-reload", handleDidReload);
            webviewElement.removeEventListener("context-menu", handleContextMenu);
            webviewElement.removeEventListener("console-message", handleConsoleMessage);
            webviewElement.removeEventListener("context-menu", handleContextMenu);
        };
    }

    // Webview Registry Pattern Implementation
    onMount(async () => {
        const appPath = await window.api.getAppPath();
        preloadPath = appPath + '/electron/webview-preload.cjs';
        
        let webviewElement = webviewRegistry.get(app.id);
        
        if (!webviewElement) {
            webviewElement = document.createElement('webview');
            webviewElement.src = app.url;
            webviewElement.partition = app.partition;
            webviewElement.allowpopups = true;
            webviewElement.preload = preloadPath;
            webviewElement.useragent = app.userAgent || 
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0";
            webviewElement.style.width = '100%';
            webviewElement.style.height = '100%';
            webviewElement.setAttribute('data-webview', 'true');
            
            // Store in registry
            webviewRegistry.set(app.id, webviewElement);
            
            // Setup listeners
            const cleanup = setupWebviewListeners(webviewElement);
            webviewElement._cleanup = cleanup;
            
            loadingState = true;
            domReadyState = false;
        } else {
            domReadyState = true;
            loadingState = false;
        }
        
        // Attach to container if not unloaded
        if (container && webviewElement && !shouldUnload) {
            // Check if webview is already attached somewhere else
            if (webviewElement.parentNode && webviewElement.parentNode !== container) {
                webviewElement.parentNode.removeChild(webviewElement);
            }
            
            // Only attach if not already attached to this container
            if (webviewElement.parentNode !== container) {
                container.appendChild(webviewElement);
            }
            
            webview = webviewElement;
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

        // IPC handlers for context menu actions
        const handleOpenLinkNewTab = (url) => {
            if (!url) return;
            
            // Create new app/app
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
                workspaceStore.activeWorkspace?.id,
            );

            if (workspaceStore.activeWorkspace && newApp) {
                workspaceStore.addAppToWorkspace(workspaceStore.activeWorkspace.id, newApp.id);
            }
        };

        const handleDownloadImage = (imageUrl) => {
            if (!imageUrl) return;
            
            // Trigger download by opening in external browser
            // Or you can implement custom download logic here
            if (webview) {
                try {
                    webview.downloadURL(imageUrl);
                } catch (e) {
                    console.warn("Failed to download image:", e);
                }
            }
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

        // Register IPC listeners
        const removeOpenLinkListener = window.api?.onOpenLinkNewTab?.(handleOpenLinkNewTab);
        const removeDownloadImageListener = window.api?.onDownloadImage?.(handleDownloadImage);
        const removeReloadWebviewListener = window.api?.onReloadWebview?.(handleReloadWebview);

        return () => {
            window.removeEventListener('reloadTab', handleTabReload);
            
            // Cleanup IPC listeners if they exist
            if (typeof removeOpenLinkListener === 'function') removeOpenLinkListener();
            if (typeof removeDownloadImageListener === 'function') removeDownloadImageListener();
            if (typeof removeReloadWebviewListener === 'function') removeReloadWebviewListener();
        };
    });
    
    // Effect to handle unloading/reloading webview based on shouldUnload flag
    $effect(() => {
        const webviewElement = webviewRegistry.get(app.id);
        
        if (shouldUnload && webviewElement && webviewElement.parentNode) {
            // Unload: remove webview from DOM to free memory
            try {
                webviewElement.parentNode.removeChild(webviewElement);
                webview = null;
            } catch (e) {
                // Ignore errors
            }
        } else if (!shouldUnload && webviewElement && container && !webviewElement.parentNode) {
            // Re-attach webview back to DOM (without reloading - preserves page state)
            try {
                container.appendChild(webviewElement);
                webview = webviewElement;
                // NOTE: Do NOT call reload() here!
                // Reloading causes issues with Cloudflare/Security verification pages
                // and creates infinite reload loops. The webview preserves its state
                // when removed from DOM and will continue where it left off.
            } catch (e) {
                // Ignore errors
            }
        }
    });

    onDestroy(() => {
        // Detach webview from container but DON'T destroy it
        if (webview && webview.parentNode === container) {
            try {
                webview.parentNode.removeChild(webview);
            } catch (e) {
                // Ignore errors
            }
        }
        
        // Clean up reload tracker for this app to prevent memory leaks
        reloadTracker.delete(app.id);
        
        // Reset local state but keep webview in registry
        webview = null;
        loadingState = false;
        domReadyState = false;
    });
</script>

<div
    class="w-full h-full flex flex-col relative"
    style:display={isActive ? "flex" : "none"}
    onwheel={handleWheel}
>
    <div class="flex-1 relative bg-gray-50">
        <!-- Webview container - managed by registry pattern -->
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
        
        <!-- Chrome-style loading progress bar (top of webview) -->
        {#if loadingState && isActive}
            <div class="absolute top-0 left-0 right-0 h-0.5 bg-blue-500 z-20">
                <div class="h-full bg-blue-600 animate-pulse" style="width: 70%; animation: loading-progress 2s ease-in-out infinite;"></div>
            </div>
        {/if}
    </div>

    <!-- Zoom Indicator -->
    {#if showZoomIndicator}
        <div class="absolute top-4 right-4 z-50 pointer-events-none">
            <div
                class="bg-white backdrop-blur-sm rounded-lg shadow-2xl border border-gray-200 px-4 py-2"
            >
                <div class="text-gray-900 font-medium text-sm">
                    {getZoomPercent()}%
                </div>
            </div>
        </div>
    {/if}
</div>

<style>
    @keyframes loading-progress {
        0% {
            width: 0%;
            opacity: 1;
        }
        50% {
            width: 70%;
            opacity: 0.8;
        }
        100% {
            width: 100%;
            opacity: 0;
        }
    }
</style>







