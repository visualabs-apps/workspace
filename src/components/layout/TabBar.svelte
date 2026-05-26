<script>
    import {
        Plus,
        X,
        RotateCw,
        Copy,
        Files,
        Pin,
        Share2,
        Cookie,
        VolumeX,
    } from "lucide-svelte";
    import { slide, fade } from 'svelte/transition';
    import { appStateStore } from "../../lib/stores/appState.svelte.js";
    import { appStore } from "../../lib/stores/apps.svelte.js";
    import { workspaceStore } from "../../lib/stores/workspaces.svelte.js";
    import { navigationStore } from "../../lib/managers/navigation.svelte.js";
    import { toastStore } from "../../lib/managers/toast.svelte.js";
    import Favicon from "../ui/Favicon.svelte";
    import { onMount, onDestroy } from "svelte";
    import Draggabilly from "draggabilly";

    let { app = null } = $props();
    
    // Search engine configurations
    const searchEngines = {
        google: { name: "Google", url: "https://www.google.com", icon: "https://www.google.com/favicon.ico", color: "#4285f4" },
        bing: { name: "Bing", url: "https://www.bing.com", icon: "https://www.bing.com/favicon.ico", color: "#008373" },
        duckduckgo: { name: "DuckDuckGo", url: "https://duckduckgo.com", icon: "https://duckduckgo.com/favicon.ico", color: "#de5833" },
        yahoo: { name: "Yahoo", url: "https://search.yahoo.com", icon: "https://www.yahoo.com/favicon.ico", color: "#5f01d1" }
    };
    
    let defaultSearchEngine = $state("google");
    
    // Load default search engine setting
    onMount(async () => {
        try {
            const result = await window.api.settings.getDefaultSearchEngine();
            if (result.success && result.engine) {
                defaultSearchEngine = result.engine;
            }
        } catch (error) {
            console.error('Failed to load search engine setting:', error);
        }
        
        // Listen for settings updates
        const handleSettingsUpdate = async () => {
            try {
                const result = await window.api.settings.getDefaultSearchEngine();
                if (result.success && result.engine) {
                    defaultSearchEngine = result.engine;
                }
            } catch (error) {
                console.error('Failed to reload search engine setting:', error);
            }
        };
        
        window.addEventListener('settings-updated', handleSettingsUpdate);
        
        return () => {
            window.removeEventListener('settings-updated', handleSettingsUpdate);
        };
    });

    // Get all apps from current workspace as tabs, in workspace-defined order
    let workspaceApps = $derived.by(() => {
        const workspace = workspaceStore.activeWorkspace;
        if (!workspace?.apps) return [];
        const appMap = new Map(appStore.apps.map(a => [a.id, a]));
        return workspace.apps.map(id => appMap.get(id)).filter(Boolean);
    });

    // Convert apps to tab format
    let tabsData = $derived(
        workspaceApps.map(app => ({
            id: app.id,
            title: app.name,
            url: app.url,
            favicon: app.icon,
            isLoading: app.id === activeTabId && navigationStore.isLoading,
            isPinned: app.isPinned || false,
            createdAt: app.createdAt || Date.now()
        }))
    );

    let activeTabId = $derived(appStore.activeAppId);

    // Draggabilly instances
    let draggabillies = [];
    let draggedTabId = null;

    // Context menu state
    let contextMenu = $state({ show: false, x: 0, y: 0, tabId: null });

    // Close context menu when clicking outside
    $effect(() => {
        if (contextMenu.show) {
            const handleClickOutside = () => closeContextMenu();
            setTimeout(() => {
                document.addEventListener("click", handleClickOutside, {
                    once: true,
                });
            }, 0);
        }
    });
    
    // Setup Draggabilly for tabs
    function setupDraggabilly() {
        // Cleanup old instances
        draggabillies.forEach(d => d.destroy());
        draggabillies = [];
        
        // Query all tab elements by data attribute
        const tabElements = document.querySelectorAll('[data-tab-id]');
        
        tabElements.forEach((element) => {
            const tabId = element.getAttribute('data-tab-id');
            if (!tabId) return;
            
            const tab = tabsData.find(t => t.id === tabId);
            if (!tab) return;
            
            const draggabilly = new Draggabilly(element, {
                axis: 'x'
            });
            
            draggabillies.push(draggabilly);
            
            let originalIndex = -1;
            let currentHoverIndex = -1;
            
            draggabilly.on('dragStart', () => {
                draggedTabId = tabId;
                appStateStore.setDragging(true);
                element.style.zIndex = '1000';
                element.style.opacity = '0.7';
                element.style.cursor = 'grabbing';
                element.style.transition = 'none'; // Disable transition during drag
                
                // Store original index
                const allTabs = Array.from(tabElements);
                originalIndex = allTabs.findIndex((el) => el.getAttribute('data-tab-id') === tabId);
                currentHoverIndex = originalIndex;
            });
            
            draggabilly.on('dragMove', () => {
                // Visual feedback during drag
                const currentRect = element.getBoundingClientRect();
                const currentCenter = currentRect.left + currentRect.width / 2;
                
                const allTabs = Array.from(tabElements);
                let newHoverIndex = originalIndex;
                let closestDistance = Infinity;
                
                // Find which tab we're hovering over
                allTabs.forEach((el, index) => {
                    const id = el.getAttribute('data-tab-id');
                    if (id === tabId || !el) return;
                    
                    const targetTab = tabsData.find(t => t.id === id);
                    const draggedTab = tabsData.find(t => t.id === draggedTabId);
                    
                    // Only consider tabs with same pinned status
                    if (targetTab && draggedTab && targetTab.isPinned === draggedTab.isPinned) {
                        const rect = el.getBoundingClientRect();
                        const center = rect.left + rect.width / 2;
                        const distance = Math.abs(currentCenter - center);
                        
                        if (distance < closestDistance) {
                            closestDistance = distance;
                            newHoverIndex = index;
                        }
                    }
                });
                
                // If hover index changed, animate other tabs
                if (newHoverIndex !== currentHoverIndex) {
                    currentHoverIndex = newHoverIndex;
                    
                    // Animate all tabs except the dragged one
                    allTabs.forEach((el, index) => {
                        const id = el.getAttribute('data-tab-id');
                        if (id === tabId) return;
                        
                        const targetTab = tabsData.find(t => t.id === id);
                        const draggedTab = tabsData.find(t => t.id === draggedTabId);
                        
                        // Only animate tabs with same pinned status
                        if (targetTab && draggedTab && targetTab.isPinned === draggedTab.isPinned) {
                            // Calculate shift amount
                            let shift = 0;
                            
                            if (originalIndex < currentHoverIndex) {
                                // Dragging right
                                if (index > originalIndex && index <= currentHoverIndex) {
                                    shift = -element.offsetWidth - 4; // Shift left (gap included)
                                }
                            } else if (originalIndex > currentHoverIndex) {
                                // Dragging left
                                if (index < originalIndex && index >= currentHoverIndex) {
                                    shift = element.offsetWidth + 4; // Shift right (gap included)
                                }
                            }
                            
                            el.style.transition = 'transform 0.2s ease';
                            el.style.transform = shift !== 0 ? `translateX(${shift}px)` : '';
                        }
                    });
                }
            });
            
            draggabilly.on('dragEnd', () => {
                appStateStore.setDragging(false);
                
                // Immediately disable transition and reset position
                element.style.transition = 'none';
                element.style.transform = '';
                element.style.left = '';
                element.style.zIndex = '';
                element.style.opacity = '';
                element.style.cursor = '';
                
                // Reset all tab transforms immediately
                const allTabs = Array.from(tabElements);
                allTabs.forEach((el) => {
                    el.style.transition = 'none';
                    el.style.transform = '';
                });
                
                // Calculate new position based on visual order
                const currentIndex = allTabs.findIndex((el) => el.getAttribute('data-tab-id') === tabId);
                
                if (currentIndex === -1) {
                    draggedTabId = null;
                    return;
                }
                
                const closestIndex = currentHoverIndex;
                
                // Reorder if position changed
                if (closestIndex !== currentIndex && workspaceStore.activeWorkspace) {
                    // Get the IDs in current visual order
                    const visualOrder = allTabs.map(el => el.getAttribute('data-tab-id'));
                    
                    // Remove dragged tab from its current position
                    visualOrder.splice(currentIndex, 1);
                    
                    // Insert at new position
                    visualOrder.splice(closestIndex, 0, tabId);
                    
                    // Update workspace apps order directly - use untrack to prevent reactivity
                    const workspace = workspaceStore.activeWorkspace;
                    
                    // Directly mutate the array without triggering Svelte reactivity
                    workspace.apps.length = 0;
                    workspace.apps.push(...visualOrder);
                    
                    // Save to SQLite asynchronously
                    (async () => {
                        try {
                            const plainApps = [...visualOrder];
                            await window.api.db.saveSetting(`workspace_apps_${workspace.id}`, plainApps);
                        } catch (error) {
                            console.error('Failed to save workspace apps order:', error);
                        }
                    })();
                }
                
                // Re-enable transitions after a short delay
                setTimeout(() => {
                    allTabs.forEach((el) => {
                        el.style.transition = '';
                    });
                }, 50);
                
                draggedTabId = null;
            });
        });
    }
    
    // Watch for tab changes and setup draggabilly
    $effect(() => {
        if (tabsData.length > 0) {
            // Small delay to ensure DOM is updated
            setTimeout(() => {
                setupDraggabilly();
            }, 50);
        }
        
        return () => {
            draggabillies.forEach(d => d.destroy());
            draggabillies = [];
        };
    });
    
    onDestroy(() => {
        draggabillies.forEach(d => d.destroy());
    });

    // Keyboard shortcuts
    $effect(() => {
        const handleKeyDown = (e) => {
            // Ctrl+W or Cmd+W to close active tab
            if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
                e.preventDefault();
                if (activeTabId && workspaceStore.activeWorkspace && workspaceApps.length > 0) {
                    const tabToClose = activeTabId; // Save the tab ID to close
                    
                    // Find the index of the active tab
                    const closingIndex = workspaceApps.findIndex(app => app.id === tabToClose);
                    
                    // If there are other tabs, switch to the appropriate one first
                    if (workspaceApps.length > 1 && closingIndex !== -1) {
                        let newActiveIndex;
                        
                        // If closing the last tab, switch to the one before it
                        if (closingIndex === workspaceApps.length - 1) {
                            newActiveIndex = closingIndex - 1;
                        } else {
                            // Otherwise, switch to the tab after it
                            newActiveIndex = closingIndex + 1;
                        }
                        
                        if (newActiveIndex >= 0 && newActiveIndex < workspaceApps.length) {
                            appStore.setActive(workspaceApps[newActiveIndex].id);
                        }
                    }
                    
                    // Close the tab after switching
                    setTimeout(() => {
                        workspaceStore.removeAppFromWorkspace(workspaceStore.activeWorkspace.id, tabToClose);
                        appStore.removeApp(tabToClose);
                    }, 10);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    });

    function closeContextMenu() {
        contextMenu = { show: false, x: 0, y: 0, tabId: null };
    }

    function handleContextMenu(e, tabId) {
        e.preventDefault();
        e.stopPropagation();
        contextMenu = {
            show: true,
            x: e.clientX,
            y: e.clientY,
            tabId,
        };
    }

    function handleReloadTab() {
        if (contextMenu.tabId) {
            // Switch to the app first
            appStore.setActive(contextMenu.tabId);
            
            // Trigger reload event that ServiceView can listen to
            const reloadEvent = new CustomEvent('reloadTab', { 
                detail: { appId: contextMenu.tabId } 
            });
            window.dispatchEvent(reloadEvent);
        }
        closeContextMenu();
    }

    function handleCopyUrl() {
        if (contextMenu.tabId) {
            const app = workspaceApps.find((a) => a.id === contextMenu.tabId);
            if (app && app.url) {
                navigator.clipboard.writeText(app.url);
            }
        }
        closeContextMenu();
    }

    function handleDuplicateTab() {
        if (contextMenu.tabId) {
            const app = workspaceApps.find((a) => a.id === contextMenu.tabId);
            if (app) {
                // Create new app with same properties
                const newApp = appStore.addApp(
                    {
                        name: app.name,
                        url: app.url,
                        icon: app.icon,
                        color: app.color,
                    },
                    null,
                    null,
                    null,
                    workspaceStore.activeWorkspace?.id,
                );

                if (workspaceStore.activeWorkspace && newApp) {
                    workspaceStore.addAppToWorkspace(workspaceStore.activeWorkspace.id, newApp.id, contextMenu.tabId);
                }
            }
        }
        closeContextMenu();
    }

    function handleCloseOtherTabs() {
        if (contextMenu.tabId && workspaceStore.activeWorkspace) {
            const appsToClose = workspaceApps.filter(
                (app) => app.id !== contextMenu.tabId,
            );
            appsToClose.forEach((app) => {
                workspaceStore.removeAppFromWorkspace(workspaceStore.activeWorkspace.id, app.id);
                appStore.removeApp(app.id);
            });
            appStore.setActive(contextMenu.tabId);
        }
        closeContextMenu();
    }

    function handleCloseTabsToRight() {
        if (contextMenu.tabId && workspaceStore.activeWorkspace) {
            const currentIndex = workspaceApps.findIndex(
                (app) => app.id === contextMenu.tabId,
            );
            if (currentIndex !== -1) {
                const appsToClose = workspaceApps.slice(currentIndex + 1);
                appsToClose.forEach((app) => {
                    workspaceStore.removeAppFromWorkspace(workspaceStore.activeWorkspace.id, app.id);
                    appStore.removeApp(app.id);
                });
            }
        }
        closeContextMenu();
    }

    function handlePinTab() {
        if (contextMenu.tabId && workspaceStore.activeWorkspace) {
            const app = workspaceApps.find((a) => a.id === contextMenu.tabId);
            if (app) {
                const newPinnedState = !app.isPinned;
                
                // Update the isPinned status
                appStore.updateApp(contextMenu.tabId, {
                    isPinned: newPinnedState
                });

                // Reorder: pinned tabs should be at the left
                setTimeout(() => {
                    const updatedApps = appStore.apps.filter(s => 
                        workspaceStore.activeWorkspace?.apps?.includes(s.id)
                    );
                    
                    // Separate pinned and unpinned
                    const pinnedApps = updatedApps.filter(a => a.isPinned);
                    const unpinnedApps = updatedApps.filter(a => !a.isPinned);
                    
                    // Reorder: pinned first, then unpinned
                    const reorderedApps = [...pinnedApps, ...unpinnedApps];
                    
                    // Update the apps order
                    const otherServices = appStore.apps.filter(s => 
                        !workspaceStore.activeWorkspace?.apps?.includes(s.id)
                    );
                    
                    appStore.reorderApps([...reorderedApps, ...otherServices]);
                }, 50);
            }
        }
        closeContextMenu();
    }

    async function handleExportCookies() {
        if (contextMenu.tabId) {
            const app = workspaceApps.find((a) => a.id === contextMenu.tabId);
            if (app && app.partition) {
                try {
                    // Get cookies from the app's partition via IPC
                    const allCookies = await window.api.db.getCookiesFromPartition(app.partition);

                    if (allCookies && allCookies.length > 0) {
                        // Extract domain from the tab's URL
                        let targetDomain = null;
                        try {
                            const url = new URL(app.url);
                            targetDomain = url.hostname;
                        } catch (e) {
                            console.warn('Invalid URL:', app.url);
                        }

                        // Filter cookies by matching domain
                        let filteredCookies = allCookies;
                        if (targetDomain) {
                            filteredCookies = allCookies.filter(cookie => {
                                const cookieDomain = cookie.domain.startsWith('.')
                                    ? cookie.domain.substring(1)
                                    : cookie.domain;
                                // Match exact domain or subdomains
                                return targetDomain === cookieDomain ||
                                       targetDomain.endsWith('.' + cookieDomain) ||
                                       cookieDomain.endsWith('.' + targetDomain);
                            });
                        }

                        if (filteredCookies.length > 0) {
                            // Format cookies as JSON (same format as export in WindowCookieManager)
                            const cookiesJson = JSON.stringify(filteredCookies, null, 2);

                            // Copy to clipboard
                            await navigator.clipboard.writeText(cookiesJson);

                            toastStore.success(`Copied ${filteredCookies.length} cookies for ${targetDomain || 'all domains'}`);
                        } else {
                            toastStore.error(`No cookies found for ${targetDomain}`);
                        }
                    } else {
                        toastStore.error('No cookies found for this tab');
                    }
                } catch (error) {
                    console.error('Failed to export cookies:', error);
                    toastStore.error('Failed to export cookies');
                }
            } else {
                toastStore.error('This tab has no associated cookies');
            }
        }
        closeContextMenu();
    }

    function handleAddTab() {
        // Get search engine config based on user setting
        const searchEngine = searchEngines[defaultSearchEngine] || searchEngines.google;
        
        // Create a new app/app in sidebar (1 app = 1 tab)
        const newApp = appStore.addApp(
            {
                name: searchEngine.name,
                url: searchEngine.url,
                icon: searchEngine.icon,
                color: searchEngine.color,
            },
            null,
            null,
            null,
            workspaceStore.activeWorkspace?.id,
        );

        // Add to active workspace — insert after the currently active tab
        const activeTabAppId = appStore.activeAppId;
        if (workspaceStore.activeWorkspace && newApp) {
            workspaceStore.addAppToWorkspace(workspaceStore.activeWorkspace.id, newApp.id, activeTabAppId);
        }

        // Switch to the new app/app
        if (newApp) {
            appStore.setActive(newApp.id);
        }
    }

    function handleCloseTab(e, tabId) {
        e.stopPropagation();
        
        // Find the index of the tab being closed
        const closingIndex = workspaceApps.findIndex(app => app.id === tabId);
        
        // If this is the active tab, switch to another tab first
        if (activeTabId === tabId && workspaceApps.length > 1) {
            let newActiveIndex;
            
            // If closing the last tab, switch to the one before it
            if (closingIndex === workspaceApps.length - 1) {
                newActiveIndex = closingIndex - 1;
            } else {
                // Otherwise, switch to the tab after it (which will become the same index after deletion)
                newActiveIndex = closingIndex + 1;
            }
            
            if (newActiveIndex >= 0 && newActiveIndex < workspaceApps.length) {
                appStore.setActive(workspaceApps[newActiveIndex].id);
            }
        }
        
        // Remove app from app store and workspace
        appStore.removeApp(tabId);
        if (workspaceStore.activeWorkspace) {
            workspaceStore.removeAppFromWorkspace(workspaceStore.activeWorkspace.id, tabId);
        }
    }

    function handleTabClick(tabId) {
        // Switch to the app/app
        appStore.setActive(tabId);
    }


</script>

<div
    class="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 inline-flex items-center px-1.5 py-1.5 gap-1 overflow-x-auto overflow-y-hidden w-full select-none"
>
    {#if tabsData.length > 0}
        {@const pinnedTabs = tabsData.filter(t => t.isPinned)}
        {@const unpinnedTabs = tabsData.filter(t => !t.isPinned)}
        {@const pinnedCount = pinnedTabs.length}
        {@const unpinnedCount = unpinnedTabs.length}
        
        <!-- Calculate available width for tabs -->
        {@const containerWidth = typeof window !== 'undefined' ? window.innerWidth : 1200}
        {@const sidebarWidth = 220}
        {@const buttonWidth = 40}
        {@const padding = 20}
        {@const availableWidth = containerWidth - sidebarWidth - buttonWidth - padding}
        
        <!-- Calculate tab widths -->
        {@const pinnedTabWidth = 60}
        {@const totalPinnedWidth = pinnedCount * (pinnedTabWidth + 4)}
        {@const remainingWidth = availableWidth - totalPinnedWidth}
        
        <!-- Unpinned tabs share remaining width equally -->
        {@const unpinnedTabWidth = unpinnedCount > 0 
            ? Math.max(100, Math.min(240, Math.floor(remainingWidth / unpinnedCount) - 4))
            : 240}

        <div class="flex items-center gap-1">
            {#each tabsData as tab (tab.id)}
                {@const isActive = activeTabId === tab.id}
                {@const isPinned = tab.isPinned || false}
                {@const isMuted = tab.isMuted || false}
                {@const tabWidth = isPinned ? pinnedTabWidth : unpinnedTabWidth}

                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <div
                    data-tab-id={tab.id}
                    class="group flex items-center gap-2 px-3 py-1.5 transition-all shrink-0 cursor-grab active:cursor-grabbing rounded-t-lg
                        {isActive
                        ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-t-2 border-blue-500 shadow-sm'
                        : 'bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200 border-t-2 border-transparent'}
                        {isPinned && !isActive ? 'border-l-2 border-blue-500' : ''}"
                    style="width: {tabWidth}px; min-width: {tabWidth}px; max-width: {tabWidth}px;"
                    onclick={(e) => {
                        // Don't trigger if clicking close button
                        if (!e.target.closest("button")) {
                            handleTabClick(tab.id);
                        }
                    }}
                    oncontextmenu={(e) => handleContextMenu(e, tab.id)}
                    transition:slide={{ duration: 200, axis: 'x' }}
                >
                    <!-- Tab Content -->
                    <div class="flex items-center gap-2 flex-1 min-w-0">
                        <!-- Favicon with loading state -->
                        <div class="w-4 h-4 shrink-0 relative flex items-center justify-center">
                            {#if tab.isLoading}
                                <!-- Chrome-style loading spinner -->
                                <div class="absolute w-4 h-4 rounded-full border-2 border-gray-200 dark:border-gray-700"></div>
                                <div class="absolute w-4 h-4 rounded-full border-2 border-blue-500 dark:border-blue-400 border-t-transparent animate-spin" style="animation: spin 0.65s cubic-bezier(0.4, 0, 0.2, 1) infinite;"></div>
                            {:else if tab.favicon || tab.url}
                                <Favicon
                                    url={tab.url}
                                    exactIconUrl={tab.favicon}
                                    size={16}
                                    class=""
                                    alt={tab.title}
                                />
                            {:else}
                                <div
                                    class="w-4 h-4 rounded {isActive ? 'bg-blue-600 dark:bg-blue-500' : 'bg-gray-600 dark:bg-gray-500'}"
                                ></div>
                            {/if}
                        </div>

                        {#if !isPinned}
                            <span
                                class="text-sm truncate flex-1 min-w-0 font-medium
                                    {isActive ? 'text-gray-900 dark:text-gray-100 font-semibold' : ''}"
                            >
                                {tab.title || "New Tab"}
                            </span>
                        {/if}

                        {#if isMuted}
                            <VolumeX size={12} class="text-gray-500 dark:text-gray-400 shrink-0" />
                        {/if}

                        {#if isPinned}
                            <Pin size={10} class="text-blue-600 dark:text-blue-400 shrink-0" />
                        {/if}
                    </div>

                    <!-- Close Button (right side) - clicking this won't trigger tab switch -->
                    {#if !isPinned}
                        <button
                            class="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-all shrink-0 opacity-0 group-hover:opacity-100"
                            onclick={(e) => handleCloseTab(e, tab.id)}
                            title="Close tab"
                        >
                            <X size={14} strokeWidth={2} />
                        </button>
                    {/if}
                </div>
            {/each}
        </div>

        <!-- New Tab Button -->
        <button
            class="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-all shrink-0 flex items-center justify-center"
            onclick={handleAddTab}
            title="New Tab"
        >
            <Plus size={14} strokeWidth={2.5} />
        </button>
    {:else}
        <!-- No tabs - show add button -->
        <button
            class="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-all shrink-0 flex items-center justify-center"
            onclick={handleAddTab}
            title="New Tab"
        >
            <Plus size={14} strokeWidth={2.5} />
        </button>
    {/if}
</div>

<!-- Context Menu -->
{#if contextMenu.show}
    {@const currentTab = tabsData.find((t) => t.id === contextMenu.tabId)}
    {@const currentIndex = tabsData.findIndex(
        (t) => t.id === contextMenu.tabId,
    )}

    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
        class="fixed inset-0 z-50"
        onclick={closeContextMenu}
        oncontextmenu={(e) => e.preventDefault()}
    >
        <div
            class="absolute bg-white dark:bg-gray-800 backdrop-blur-sm rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 py-1 min-w-[220px] text-sm"
            style="left: {contextMenu.x}px; top: {contextMenu.y}px;"
            onclick={(e) => e.stopPropagation()}
        >
            <!-- Reload -->
            <button
                class="w-full px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between"
                onclick={handleReloadTab}
            >
                <div class="flex items-center gap-3">
                    <RotateCw size={16} />
                    Reload
                </div>
                <span class="text-xs text-gray-500 dark:text-gray-400">Ctrl+R</span>
            </button>

            <!-- Duplicate -->
            <button
                class="w-full px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
                onclick={handleDuplicateTab}
            >
                <Files size={16} />
                Duplicate
            </button>

            <!-- Pin -->
            <button
                class="w-full px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
                onclick={handlePinTab}
            >
                <Pin size={16} />
                {currentTab?.isPinned ? "Unpin" : "Pin"}
            </button>

            <!-- Export Cookies -->
            <button
                class="w-full px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
                onclick={handleExportCookies}
            >
                <Cookie size={16} />
                Export Cookies
            </button>

            <div class="h-px bg-gray-200 dark:bg-gray-700 my-1"></div>

            {#if tabsData.length > 1}
                <!-- Close other tabs -->
                <button
                    class="w-full px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
                    onclick={handleCloseOtherTabs}
                >
                    <X size={16} />
                    Close other tabs
                </button>

                <!-- Close tabs to the right -->
                {#if currentIndex < tabsData.length - 1}
                    <button
                        class="w-full px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
                        onclick={handleCloseTabsToRight}
                    >
                        <X size={16} />
                        Close tabs to the right
                    </button>
                {/if}

                <div class="h-px bg-gray-200 dark:bg-gray-700 my-1"></div>
            {/if}

            <!-- Close -->
            <button
                class="w-full px-4 py-2 text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center justify-between"
                onclick={(e) => {
                    handleCloseTab(e, contextMenu.tabId);
                    closeContextMenu();
                }}
            >
                <div class="flex items-center gap-3">
                    <X size={16} />
                    Close
                </div>
                <span class="text-xs text-red-500 dark:text-red-400">Ctrl+W</span>
            </button>
        </div>
    </div>
{/if}



<style>
    /* Custom smooth spin animation */
    @keyframes spin {
        0% {
            transform: rotate(0deg);
        }
        100% {
            transform: rotate(360deg);
        }
    }

    /* Smooth transitions for drag feedback */
    .group {
        transition: all 0.2s ease;
    }

    /* Active tab gets a subtle elevation */
    .bg-white.border-t-2.border-blue-500 {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        transform: translateY(-1px);
    }

    /* Inactive tabs have subtle shadow */
    .bg-gray-50 {
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }

    /* Hover effect for inactive tabs */
    .bg-gray-50:hover {
        transform: translateY(-0.5px);
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
    }
</style>





