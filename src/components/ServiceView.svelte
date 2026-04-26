<script>
    import { onMount, onDestroy } from "svelte";
    import { navigationStore } from "../lib/navigation.svelte.js";
    import { serviceStore } from "../lib/services.svelte.js";
    import { workspaceStore } from "../lib/workspaces.svelte.js";
    import { linkRoutingStore } from "../lib/linkRouting.svelte.js";
    import { historyStore } from "../lib/history.svelte.js";
    import { Rocket, Plus } from "lucide-svelte";

    let { service, isActive } = $props();

    // Global webview registry - persistent across component lifecycle
    const webviewRegistry = globalThis.webviewRegistry || (globalThis.webviewRegistry = new Map());

    // Local state
    let container = $state(null);
    let webview = $state(null);
    let loadingState = $state(false);
    let domReadyState = $state(false);
    let showZoomIndicator = $state(false);
    let zoomIndicatorTimeout = null;

    function updateNavigationState() {
        if (isActive && webview && domReadyState) {
            try {
                const canGoBack = webview.canGoBack?.() || false;
                const canGoForward = webview.canGoForward?.() || false;
                const currentUrl = webview.getURL?.() || service.url;
                
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
            const zoomLevel = service.zoomLevel ?? 0;

            try {
                if (webview.getWebContentsId) {
                    webview.setZoomLevel(zoomLevel);
                    webview.setAudioMuted(service.isMuted || false);
                }
            } catch (e) {
                // Webview not ready yet, will retry on next effect
            }
        }
    });

    function handleWheel(e) {
        if (e.ctrlKey) {
            e.preventDefault();
            const currentZoom = service.zoomLevel ?? 0;

            const currentPercent = Math.round(Math.pow(1.2, currentZoom) * 100);

            const delta = e.deltaY > 0 ? -10 : 10;
            let newPercent = currentPercent + delta;

            newPercent = Math.max(25, Math.min(500, newPercent));

            const newZoomLevel = Math.log(newPercent / 100) / Math.log(1.2);

            serviceStore.updateService(service.id, {
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
        const zoomLevel = service.zoomLevel ?? 0;
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
            const zoomLevel = service.zoomLevel ?? 0;
            try {
                webviewElement.setZoomLevel(zoomLevel);
                webviewElement.setAudioMuted(service.isMuted || false);
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
            } catch (e) {
                // Webview not ready yet
            }
            if (url) {
                serviceStore.updateService(service.id, { url });
                
                // Add to history when navigation completes
                if (workspaceStore.activeWorkspace) {
                    historyStore.addEntry(
                        workspaceStore.activeWorkspace.id,
                        url,
                        service.name,
                        service.icon
                    );
                }
            }
            updateNavigationState();
        };

        const handlePageTitleUpdated = (e) => {
            // Update service name so it shows in sidebar and TabBar
            serviceStore.updateService(service.id, { name: e.title });

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
                            service.icon
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
                serviceStore.updateService(service.id, { unreadCount: count });
            } else if (service.unreadCount > 0) {
                serviceStore.updateService(service.id, { unreadCount: 0 });
            }
        };

        const handlePageFaviconUpdated = (e) => {
            // Update service icon so it shows in sidebar
            if (e.favicons && e.favicons.length > 0) {
                serviceStore.updateService(service.id, {
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
                // Create new service/app
                const newService = serviceStore.addService(
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

                if (workspaceStore.activeWorkspace && newService) {
                    workspaceStore.addAppToWorkspace(workspaceStore.activeWorkspace.id, newService.id);
                }
            } else {
                window.open(url, "_blank", "width=1000,height=800");
            }
        };

        const handleContextMenu = (e) => {
            e.preventDefault();
            window.api.showContextMenu(e.params);
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
        };
    }

    // Webview Registry Pattern Implementation
    onMount(() => {
        // Get or create webview from registry
        let webviewElement = webviewRegistry.get(service.id);
        
        if (!webviewElement) {
            // Create new webview
            webviewElement = document.createElement('webview');
            webviewElement.src = service.url;
            webviewElement.partition = service.partition;
            webviewElement.allowpopups = true;
            webviewElement.useragent = service.userAgent || 
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0";
            webviewElement.style.width = '100%';
            webviewElement.style.height = '100%';
            webviewElement.setAttribute('data-webview', 'true'); // Add identifier for dropdown detection
            
            // Store in registry
            webviewRegistry.set(service.id, webviewElement);
            
            // Setup listeners
            const cleanup = setupWebviewListeners(webviewElement);
            webviewElement._cleanup = cleanup;
            
            loadingState = true;
            domReadyState = false;
        } else {
            // Webview already exists and has listeners
            domReadyState = true;
            loadingState = false;
        }
        
        // Attach to container
        if (container && webviewElement) {
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
            const { serviceId } = event.detail;
            if (serviceId === service.id && webview) {
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
            
            // Create new service/app
            const newService = serviceStore.addService(
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

            if (workspaceStore.activeWorkspace && newService) {
                workspaceStore.addAppToWorkspace(workspaceStore.activeWorkspace.id, newService.id);
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

    onDestroy(() => {
        // Detach webview from container but DON'T destroy it
        if (webview && webview.parentNode === container) {
            try {
                webview.parentNode.removeChild(webview);
            } catch (e) {
                // Ignore errors
            }
        }
        
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