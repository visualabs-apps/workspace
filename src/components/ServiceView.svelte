<script>
    import { onMount } from "svelte";
    import { navigationStore } from "../lib/navigation.svelte.js";
    import { serviceStore } from "../lib/services.svelte.js";
    import { tabStore } from "../lib/tabs.svelte.js";
    import { linkRoutingStore } from "../lib/linkRouting.svelte.js";
    import { dndStore } from "../lib/dnd.svelte.js";
    import { scraperService } from "../lib/scraperService.js";
    import { Rocket, Plus } from "lucide-svelte";

    let { service, isActive } = $props();

    // Get tabs for this service
    let tabs = $derived(tabStore.getServiceTabs(service.id));
    let activeTabId = $derived(tabStore.getActiveTabId(service.id));
    let activeTab = $derived(tabStore.getActiveTab(service.id));

    // Store webview references for each tab
    let webviews = $state({});
    let loadingStates = $state({});
    let domReadyStates = $state({});
    let showZoomIndicator = $state(false);
    let zoomIndicatorTimeout = null;

    // Function to update navigation state
    function updateNavigationState(tabId) {
        const webview = webviews[tabId];
        if (
            isActive &&
            activeTabId === tabId &&
            webview &&
            domReadyStates[tabId]
        ) {
            const tab = tabs.find((t) => t.id === tabId);
            try {
                navigationStore.updateState({
                    canGoBack: webview.canGoBack?.() || false,
                    canGoForward: webview.canGoForward?.() || false,
                    isLoading: loadingStates[tabId] || false,
                    currentUrl: webview.getURL?.() || tab?.url || service.url,
                });
            } catch (e) {
                // Webview not ready yet, skip update
                console.warn("Webview not ready for navigation state update");
            }
        }
    }

    // Register active webview with navigation store
    $effect(() => {
        if (
            isActive &&
            activeTabId &&
            webviews[activeTabId] &&
            domReadyStates[activeTabId]
        ) {
            try {
                navigationStore.setActiveWebview(webviews[activeTabId]);
                updateNavigationState(activeTabId);
            } catch (e) {
                console.warn("Failed to set active webview:", e);
            }
        }
    });

    // Handle zoom and mute for active webview
    $effect(() => {
        if (
            activeTabId &&
            webviews[activeTabId] &&
            domReadyStates[activeTabId]
        ) {
            const webview = webviews[activeTabId];
            const tab = tabs.find((t) => t.id === activeTabId);
            const zoomLevel = tab?.zoomLevel ?? 0;

            try {
                // Only set zoom if webview is ready
                if (webview.getWebContentsId) {
                    webview.setZoomLevel(zoomLevel);
                    webview.setAudioMuted(tab?.isMuted || false);
                }
            } catch (e) {
                // Webview not ready yet, will retry on next effect
                console.warn("Webview not ready for zoom/mute:", e.message);
            }
        }
    });

    // Handle Ctrl+Scroll for zoom
    function handleWheel(e) {
        if (e.ctrlKey && activeTabId) {
            e.preventDefault();
            const tab = tabs.find((t) => t.id === activeTabId);
            const currentZoom = tab?.zoomLevel ?? 0;

            // Calculate zoom percentage (0 = 100%, -1 = 75%, 1 = 125%, etc.)
            const currentPercent = Math.round(Math.pow(1.2, currentZoom) * 100);

            // Determine zoom direction
            const delta = e.deltaY > 0 ? -10 : 10; // Zoom out or in by 10%
            let newPercent = currentPercent + delta;

            // Clamp between 25% and 500%
            newPercent = Math.max(25, Math.min(500, newPercent));

            // Convert back to zoom level
            const newZoomLevel = Math.log(newPercent / 100) / Math.log(1.2);

            // Update tab zoom level
            tabStore.updateTab(service.id, activeTabId, {
                zoomLevel: newZoomLevel,
            });

            // Show zoom indicator
            showZoomIndicator = true;
            if (zoomIndicatorTimeout) clearTimeout(zoomIndicatorTimeout);
            zoomIndicatorTimeout = setTimeout(() => {
                showZoomIndicator = false;
            }, 1000);
        }
    }

    // Get current zoom percentage for display
    function getZoomPercent() {
        const tab = tabs.find((t) => t.id === activeTabId);
        const zoomLevel = tab?.zoomLevel ?? 0;
        return Math.round(Math.pow(1.2, zoomLevel) * 100);
    }

    function setupWebviewListeners(webview, tabId) {
        const handleDomReady = async () => {
            domReadyStates = { ...domReadyStates, [tabId]: true };
            loadingStates = { ...loadingStates, [tabId]: false };
            updateNavigationState(tabId);

            // Apply zoom level after webview is ready
            const tab = tabs.find((t) => t.id === tabId);
            const zoomLevel = tab?.zoomLevel ?? 0;
            try {
                webview.setZoomLevel(zoomLevel);
                webview.setAudioMuted(tab?.isMuted || false);
            } catch (e) {
                console.warn("Failed to set initial zoom:", e.message);
            }

            // ✅ SAFE: Minimal stealth - only what's necessary
            // We rely on proper Electron configuration (contextIsolation, etc)
            // instead of aggressive property deletion
            try {
                const safeStealthScript = `
                    (function() {
                        // ✅ SAFE: Just log for debugging
                        console.log('🛡️ Webview loaded with safe configuration');
                        
                        // ❌ DO NOT delete window.process - breaks libraries
                        // ❌ DO NOT fake window.chrome - too complex
                        // ❌ DO NOT override navigator.plugins - type mismatch
                        // ❌ DO NOT modify Error.prepareStackTrace - breaks debugging
                        
                        // The real stealth comes from proper Electron config:
                        // - contextIsolation: true
                        // - nodeIntegration: false
                        // - sandbox: true
                        // - disableBlinkFeatures: 'Automation'
                    })();
                `;
                webview.executeJavaScript(safeStealthScript);
            } catch (e) {
                console.warn(
                    "Failed to inject safe stealth script:",
                    e.message,
                );
            }

            // Inject scraper scripts if available
            try {
                const url = webview.getURL?.();
                if (url) {
                    await scraperService.injectScript(webview, url);
                }
            } catch (e) {
                console.warn("Failed to inject scraper script:", e.message);
            }
        };

        const handleDidStartLoading = () => {
            loadingStates = { ...loadingStates, [tabId]: true };
            if (isActive && activeTabId === tabId) {
                navigationStore.updateState({ isLoading: true });
            }
        };

        const handleDidStopLoading = () => {
            loadingStates = { ...loadingStates, [tabId]: false };
            updateNavigationState(tabId);
        };

        const handleDidNavigate = (e) => {
            const url = webview.getURL?.();
            if (url) {
                tabStore.updateTab(service.id, tabId, { url });
            }
            updateNavigationState(tabId);
        };

        const handlePageTitleUpdated = (e) => {
            // Update tab title
            tabStore.updateTab(service.id, tabId, { title: e.title });

            if (isActive && activeTabId === tabId) {
                navigationStore.updateState({ currentTitle: e.title });
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
            // Update tab favicon
            if (e.favicons && e.favicons.length > 0) {
                tabStore.updateTab(service.id, tabId, {
                    favicon: e.favicons[0],
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
                // Create new tab in this service
                tabStore.addTab(service.id, url, "New Tab");
            } else {
                window.open(url, "_blank", "width=1000,height=800");
            }
        };

        webview.addEventListener("dom-ready", handleDomReady);
        webview.addEventListener("did-start-loading", handleDidStartLoading);
        webview.addEventListener("did-stop-loading", handleDidStopLoading);
        webview.addEventListener("did-navigate", handleDidNavigate);
        webview.addEventListener("did-navigate-in-page", handleDidNavigate);
        webview.addEventListener("page-title-updated", handlePageTitleUpdated);
        webview.addEventListener(
            "page-favicon-updated",
            handlePageFaviconUpdated,
        );
        webview.addEventListener("new-window", handleNewWindow);

        return () => {
            webview.removeEventListener("dom-ready", handleDomReady);
            webview.removeEventListener(
                "did-start-loading",
                handleDidStartLoading,
            );
            webview.removeEventListener(
                "did-stop-loading",
                handleDidStopLoading,
            );
            webview.removeEventListener("did-navigate", handleDidNavigate);
            webview.removeEventListener(
                "did-navigate-in-page",
                handleDidNavigate,
            );
            webview.removeEventListener(
                "page-title-updated",
                handlePageTitleUpdated,
            );
            webview.removeEventListener(
                "page-favicon-updated",
                handlePageFaviconUpdated,
            );
            webview.removeEventListener("new-window", handleNewWindow);
        };
    }

    function handleWebviewMount(element, tab) {
        if (element) {
            // Set initial src ONCE programmatically, rather than reactively through HTML attribute.
            // This prevents Svelte's view re-renders from intercepting Electron's URL logic
            // and throwing ERR_ABORTED (-3) on websites that perform HTTP redirects.
            if (tab.url) {
                element.src = tab.url;
            }

            webviews = { ...webviews, [tab.id]: element };
            loadingStates = { ...loadingStates, [tab.id]: true };
            domReadyStates = { ...domReadyStates, [tab.id]: false };

            const cleanup = setupWebviewListeners(element, tab.id);

            return {
                destroy() {
                    cleanup();
                    const { [tab.id]: removed, ...rest } = webviews;
                    webviews = rest;
                },
            };
        }
    }
</script>

<div
    class="w-full h-full flex flex-col relative"
    style:display={isActive ? "flex" : "none"}
    onwheel={handleWheel}
>
    <div class="flex-1 relative bg-gray-900">
        {#if tabs.length === 0}
            <!-- Empty state when no tabs -->
            <div class="absolute inset-0 flex items-center justify-center p-8">
                <div class="text-center w-full max-w-md">
                    <!-- Icon -->
                    <div class="mb-4 flex justify-center">
                        <div
                            class="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center"
                        >
                            <svg
                                class="w-10 h-10 text-purple-400"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="1.5"
                            >
                                <circle cx="12" cy="12" r="10"></circle>
                                <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                                <line x1="9" y1="9" x2="9.01" y2="9"></line>
                                <line x1="15" y1="9" x2="15.01" y2="9"></line>
                            </svg>
                        </div>
                    </div>

                    <!-- Text -->
                    <h2 class="text-xl font-semibold text-white mb-6">
                        There's nothing here, yet.
                    </h2>

                    <!-- Buttons -->
                    <div class="flex gap-3 justify-center">
                        <button
                            onclick={() => serviceStore.setAddModalOpen(true)}
                            class="group flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-sm rounded-lg font-medium transition-all shadow-lg hover:shadow-xl hover:scale-105"
                        >
                            <Rocket
                                size={16}
                                class="group-hover:translate-y-[-2px] transition-transform"
                            />
                            Start with an app
                        </button>
                        <button
                            onclick={() => tabStore.addTab(service.id)}
                            class="group flex items-center gap-2 px-5 py-2.5 bg-purple-500/80 hover:bg-purple-600/80 text-white text-sm rounded-lg font-medium transition-all hover:scale-105"
                        >
                            <Plus
                                size={16}
                                class="group-hover:rotate-90 transition-transform"
                            />
                            Start with a tab
                        </button>
                    </div>
                </div>
            </div>
        {:else}
            {#each tabs as tab (tab.id)}
                {@const isTabActive = activeTabId === tab.id}
                {@const isTabLoading = loadingStates[tab.id]}

                <div
                    class="absolute inset-0 w-full h-full"
                    style:z-index={isTabActive ? 10 : 0}
                    style:visibility={isTabActive ? "visible" : "hidden"}
                    style:pointer-events={isTabActive ? "auto" : "none"}
                >
                    {#if isTabLoading && isTabActive}
                        <div
                            class="absolute inset-0 flex items-center justify-center bg-gradient-to-r from-[#9d8c6b] via-black to-[#8b4a6b] z-10 pointer-events-none"
                        >
                            <div class="flex flex-col items-center gap-3">
                                <div
                                    class="w-10 h-10 rounded-xl bg-gradient-to-br from-[#9d8c6b] to-[#8b4a6b] flex items-center justify-center shadow-lg animate-pulse"
                                >
                                    {#if service.icon}
                                        <img
                                            src={service.icon}
                                            alt=""
                                            class="w-6 h-6 object-contain"
                                        />
                                    {/if}
                                </div>
                                <div
                                    class="w-6 h-6 border-2 border-pink-400 border-t-transparent rounded-full animate-spin"
                                ></div>
                            </div>
                        </div>
                    {/if}

                    <webview
                        use:handleWebviewMount={tab}
                        partition={service.partition}
                        allowpopups="true"
                        class="w-full h-full"
                        useragent={service.userAgent ||
                            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0"}
                    ></webview>
                </div>
            {/each}
        {/if}
    </div>

    <!-- Zoom Indicator -->
    {#if showZoomIndicator}
        <div class="absolute top-4 right-4 z-50 pointer-events-none">
            <div
                class="bg-gray-800/95 backdrop-blur-sm rounded-lg shadow-2xl border border-gray-700 px-4 py-2"
            >
                <div class="text-white font-medium text-sm">
                    {getZoomPercent()}%
                </div>
            </div>
        </div>
    {/if}
</div>
