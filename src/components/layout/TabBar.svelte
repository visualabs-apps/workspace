<script>
    import {
        Plus,
        X,
        RotateCw,
        Copy,
        Files,
        Pin,
    } from "lucide-svelte";
    import { slide, fade } from 'svelte/transition';
    import { tabStore } from "../../lib/stores/tabs.svelte.js";
    import { serviceStore } from "../../lib/stores/services.svelte.js";
    import { workspaceStore } from "../../lib/stores/workspaces.svelte.js";
    import { navigationStore } from "../../lib/managers/navigation.svelte.js";
    import Favicon from "../ui/Favicon.svelte";

    let { service = null } = $props();

    // Get all apps from current workspace as tabs
    let workspaceApps = $derived(
        serviceStore.services.filter(app => 
            workspaceStore.activeWorkspace?.apps?.includes(app.id)
        )
    );

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

    let activeTabId = $derived(serviceStore.activeServiceId);

    // Drag and drop state
    let draggedTabId = $state(null);
    let dragOverTabId = $state(null);

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
                            serviceStore.setActive(workspaceApps[newActiveIndex].id);
                        }
                    }
                    
                    // Close the tab after switching
                    setTimeout(() => {
                        workspaceStore.removeAppFromWorkspace(workspaceStore.activeWorkspace.id, tabToClose);
                        serviceStore.removeService(tabToClose);
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
            serviceStore.setActive(contextMenu.tabId);
            
            // Trigger reload event that ServiceView can listen to
            const reloadEvent = new CustomEvent('reloadTab', { 
                detail: { serviceId: contextMenu.tabId } 
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
                const newService = serviceStore.addService(
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

                if (workspaceStore.activeWorkspace && newService) {
                    workspaceStore.addAppToWorkspace(workspaceStore.activeWorkspace.id, newService.id);
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
                serviceStore.removeService(app.id);
            });
            serviceStore.setActive(contextMenu.tabId);
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
                    serviceStore.removeService(app.id);
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
                serviceStore.updateService(contextMenu.tabId, {
                    isPinned: newPinnedState
                });

                // Reorder: pinned tabs should be at the left
                setTimeout(() => {
                    const updatedApps = serviceStore.services.filter(s => 
                        workspaceStore.activeWorkspace?.apps?.includes(s.id)
                    );
                    
                    // Separate pinned and unpinned
                    const pinnedApps = updatedApps.filter(a => a.isPinned);
                    const unpinnedApps = updatedApps.filter(a => !a.isPinned);
                    
                    // Reorder: pinned first, then unpinned
                    const reorderedApps = [...pinnedApps, ...unpinnedApps];
                    
                    // Update the services order
                    const otherServices = serviceStore.services.filter(s => 
                        !workspaceStore.activeWorkspace?.apps?.includes(s.id)
                    );
                    
                    serviceStore.reorderServices([...reorderedApps, ...otherServices]);
                }, 50);
            }
        }
        closeContextMenu();
    }

    function handleAddTab() {
        // Create a new service/app in sidebar (1 app = 1 tab)
        const newService = serviceStore.addService(
            {
                name: "Browser",
                url: "https://www.google.com",
                icon: "https://www.google.com/favicon.ico",
                color: "#4285f4",
            },
            null,
            null,
            null,
            workspaceStore.activeWorkspace?.id,
        );

        // Add to active workspace
        if (workspaceStore.activeWorkspace && newService) {
            workspaceStore.addAppToWorkspace(workspaceStore.activeWorkspace.id, newService.id);
        }

        // Switch to the new service/app
        if (newService) {
            serviceStore.setActive(newService.id);
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
                serviceStore.setActive(workspaceApps[newActiveIndex].id);
            }
        }
        
        // Remove app from service store and workspace
        serviceStore.removeService(tabId);
        if (workspaceStore.activeWorkspace) {
            workspaceStore.removeAppFromWorkspace(workspaceStore.activeWorkspace.id, tabId);
        }
    }

    function handleTabClick(tabId) {
        // Switch to the app/service
        serviceStore.setActive(tabId);
    }

    // Native HTML5 Drag and Drop functions
    function handleDragStart(e, tabId) {
        draggedTabId = tabId;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', tabId);
        
        // Add visual feedback
        e.target.style.opacity = '0.5';
        
        // Set global drag state to prevent webview interactions
        tabStore.setDragging(true);
    }

    function handleDragEnd(e) {
        // Reset visual feedback
        e.target.style.opacity = '1';
        draggedTabId = null;
        dragOverTabId = null;
        tabStore.setDragging(false);
    }

    function handleDragOver(e, tabId) {
        e.preventDefault();
        
        if (draggedTabId && draggedTabId !== tabId) {
            // Check if both tabs have the same pinned status
            const draggedTab = tabsData.find(t => t.id === draggedTabId);
            const targetTab = tabsData.find(t => t.id === tabId);
            
            // Only allow drag over if both are pinned or both are unpinned
            if (draggedTab && targetTab && draggedTab.isPinned === targetTab.isPinned) {
                e.dataTransfer.dropEffect = 'move';
                dragOverTabId = tabId;
            } else {
                e.dataTransfer.dropEffect = 'none';
                dragOverTabId = null;
            }
        }
    }

    function handleDragLeave(e) {
        // Only clear dragOverTabId if we're actually leaving the tab area
        if (!e.currentTarget.contains(e.relatedTarget)) {
            dragOverTabId = null;
        }
    }

    function handleDrop(e, dropTabId) {
        e.preventDefault();
        
        if (draggedTabId && draggedTabId !== dropTabId) {
            // Check if both tabs have the same pinned status
            const draggedTab = tabsData.find(t => t.id === draggedTabId);
            const targetTab = tabsData.find(t => t.id === dropTabId);
            
            // Only allow drop if both are pinned or both are unpinned
            if (!draggedTab || !targetTab || draggedTab.isPinned !== targetTab.isPinned) {
                dragOverTabId = null;
                return;
            }
            
            // Work directly with serviceStore.services
            const currentServices = [...serviceStore.services];
            const draggedIndex = currentServices.findIndex(s => s.id === draggedTabId);
            const dropIndex = currentServices.findIndex(s => s.id === dropTabId);
            
            if (draggedIndex !== -1 && dropIndex !== -1) {
                // Remove dragged service
                const [draggedService] = currentServices.splice(draggedIndex, 1);
                
                // Insert at correct position
                let insertIndex;
                if (draggedIndex < dropIndex) {
                    // Moving right - after removal, dropIndex shifts left by 1
                    insertIndex = dropIndex;
                } else {
                    // Moving left - dropIndex unchanged
                    insertIndex = dropIndex;
                }
                
                currentServices.splice(insertIndex, 0, draggedService);
                
                // Update service store
                serviceStore.reorderServices(currentServices);
            }
        }
        
        dragOverTabId = null;
    }
</script>

<div
    class="bg-white border-b border-gray-200 inline-flex items-center px-1.5 py-1.5 gap-1 overflow-x-auto overflow-y-hidden w-full"
>
    {#if tabsData.length > 0}
        {@const tabCount = tabsData.length}
        {@const availableWidth = 1200}
        {@const buttonWidth = 40}
        {@const usableWidth = availableWidth - buttonWidth - 20}
        {@const idealTabWidth = Math.max(
            80,
            Math.min(200, Math.floor(usableWidth / tabCount)),
        )}

        <div class="flex items-center gap-1">
            {#each tabsData as tab (tab.id)}
                {@const isActive = activeTabId === tab.id}
                {@const isPinned = tab.isPinned || false}
                {@const isMuted = tab.isMuted || false}
                {@const isDraggedOver = dragOverTabId === tab.id}

                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <div
                    class="group flex items-center gap-2 px-3 py-1.5 transition-all shrink-0 cursor-pointer rounded-t-lg
                        {isActive
                        ? 'bg-white text-gray-900 border-t-2 border-blue-500 shadow-sm'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-800 border-t-2 border-transparent'}
                        {isDraggedOver ? 'border-l-2 border-blue-500' : ''}
                        {isPinned && !isActive ? 'border-l-2 border-blue-500' : ''}"
                    style="max-width: {isPinned
                        ? '60px'
                        : idealTabWidth + 'px'}; min-width: {isPinned
                        ? '60px'
                        : '100px'};"
                    draggable="true"
                    ondragstart={(e) => handleDragStart(e, tab.id)}
                    ondragend={handleDragEnd}
                    ondragover={(e) => handleDragOver(e, tab.id)}
                    ondragleave={handleDragLeave}
                    ondrop={(e) => handleDrop(e, tab.id)}
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
                                <div class="w-3 h-3 border border-gray-400 border-t-blue-500 rounded-full animate-spin"></div>
                            {:else if tab.favicon || tab.url}
                                <Favicon 
                                    url={tab.url || tab.favicon}
                                    size={16}
                                    class="object-contain {isActive ? 'ring-1 ring-blue-200 rounded-sm' : ''}"
                                    alt={tab.title}
                                />
                            {:else}
                                <div
                                    class="w-4 h-4 rounded {isActive ? 'bg-blue-600' : 'bg-gray-600'}"
                                ></div>
                            {/if}
                        </div>

                        {#if !isPinned}
                            <span
                                class="text-sm truncate flex-1 min-w-0 font-medium
                                    {isActive ? 'text-gray-900 font-semibold' : ''}"
                            >
                                {tab.title || "New Tab"}
                            </span>
                        {/if}

                        {#if isMuted}
                            <VolumeX size={12} class="text-gray-500 shrink-0" />
                        {/if}

                        {#if isPinned}
                            <Pin size={10} class="text-blue-600 shrink-0" />
                        {/if}
                    </div>

                    <!-- Close Button (right side) - clicking this won't trigger tab switch -->
                    {#if !isPinned}
                        <button
                            class="p-0.5 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-all shrink-0 opacity-0 group-hover:opacity-100"
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
            class="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800 transition-all shrink-0 flex items-center justify-center"
            onclick={handleAddTab}
            title="New Tab"
        >
            <Plus size={14} strokeWidth={2.5} />
        </button>
    {:else}
        <!-- No tabs - show add button -->
        <button
            class="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800 transition-all shrink-0 flex items-center justify-center"
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
            class="absolute bg-white backdrop-blur-sm rounded-lg shadow-2xl border border-gray-200 py-1 min-w-[220px] text-sm"
            style="left: {contextMenu.x}px; top: {contextMenu.y}px;"
            onclick={(e) => e.stopPropagation()}
        >
            <!-- Reload -->
            <button
                class="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100 flex items-center justify-between"
                onclick={handleReloadTab}
            >
                <div class="flex items-center gap-3">
                    <RotateCw size={16} />
                    Reload
                </div>
                <span class="text-xs text-gray-500">Ctrl+R</span>
            </button>

            <!-- Duplicate -->
            <button
                class="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100 flex items-center gap-3"
                onclick={handleDuplicateTab}
            >
                <Files size={16} />
                Duplicate
            </button>

            <!-- Pin -->
            <button
                class="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100 flex items-center gap-3"
                onclick={handlePinTab}
            >
                <Pin size={16} />
                {currentTab?.isPinned ? "Unpin" : "Pin"}
            </button>

            <div class="h-px bg-gray-200 my-1"></div>

            {#if tabsData.length > 1}
                <!-- Close other tabs -->
                <button
                    class="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100 flex items-center gap-3"
                    onclick={handleCloseOtherTabs}
                >
                    <X size={16} />
                    Close other tabs
                </button>

                <!-- Close tabs to the right -->
                {#if currentIndex < tabsData.length - 1}
                    <button
                        class="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100 flex items-center gap-3"
                        onclick={handleCloseTabsToRight}
                    >
                        <X size={16} />
                        Close tabs to the right
                    </button>
                {/if}

                <div class="h-px bg-gray-200 my-1"></div>
            {/if}

            <!-- Close -->
            <button
                class="w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 flex items-center justify-between"
                onclick={(e) => {
                    handleCloseTab(e, contextMenu.tabId);
                    closeContextMenu();
                }}
            >
                <div class="flex items-center gap-3">
                    <X size={16} />
                    Close
                </div>
                <span class="text-xs text-red-500">Ctrl+W</span>
            </button>
        </div>
    </div>
{/if}



<style>
    /* Drag and drop visual feedback */
    .group[draggable="true"]:hover {
        cursor: grab;
    }
    
    .group[draggable="true"]:active {
        cursor: grabbing;
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