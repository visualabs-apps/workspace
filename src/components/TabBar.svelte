<script>
    import { Plus, X, RotateCw, Copy, Files, Pin, Volume2, VolumeX } from "lucide-svelte";
    import { tabStore } from "../lib/tabs.svelte.js";
    import { dndzone } from "svelte-dnd-action";
    import { flip } from "svelte/animate";

    let { service = null } = $props();

    // Tab state
    let tabsData = $state([]);
    let activeTabId = $derived(
        service ? tabStore.getActiveTabId(service.id) : null,
    );

    // Sync tabs from store
    $effect(() => {
        if (service) {
            tabsData = tabStore.getServiceTabs(service.id);
        }
    });

    // Drag and drop state
    let dragDisabled = $state(false);
    const flipDurationMs = 200;
    let isDragging = $state(false);
    let dragStartX = 0;
    let dragStartY = 0;
    const dragThreshold = 5;

    // Context menu state
    let contextMenu = $state({ show: false, x: 0, y: 0, tabId: null });

    // Close context menu when clicking outside
    $effect(() => {
        if (contextMenu.show) {
            const handleClickOutside = () => closeContextMenu();
            setTimeout(() => {
                document.addEventListener('click', handleClickOutside, { once: true });
            }, 0);
        }
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
            tabId
        };
    }

    function handleReloadTab() {
        if (service && contextMenu.tabId) {
            tabStore.setActiveTab(service.id, contextMenu.tabId);
            setTimeout(() => window.location.reload(), 100);
        }
        closeContextMenu();
    }

    function handleCopyUrl() {
        if (service && contextMenu.tabId) {
            const tab = tabsData.find(t => t.id === contextMenu.tabId);
            if (tab && tab.url) {
                navigator.clipboard.writeText(tab.url);
            }
        }
        closeContextMenu();
    }

    function handleDuplicateTab() {
        if (service && contextMenu.tabId) {
            const tab = tabsData.find(t => t.id === contextMenu.tabId);
            if (tab) {
                tabStore.addTab(service.id, tab.url, tab.title);
            }
        }
        closeContextMenu();
    }

    function handleCloseOtherTabs() {
        if (service && contextMenu.tabId) {
            const tabsToClose = tabsData.filter(t => t.id !== contextMenu.tabId);
            tabsToClose.forEach(tab => {
                tabStore.closeTab(service.id, tab.id);
            });
            tabStore.setActiveTab(service.id, contextMenu.tabId);
        }
        closeContextMenu();
    }

    function handleCloseTabsToRight() {
        if (service && contextMenu.tabId) {
            const currentIndex = tabsData.findIndex(t => t.id === contextMenu.tabId);
            if (currentIndex !== -1) {
                const tabsToClose = tabsData.slice(currentIndex + 1);
                tabsToClose.forEach(tab => {
                    tabStore.closeTab(service.id, tab.id);
                });
            }
        }
        closeContextMenu();
    }

    function handleNewTabToRight() {
        if (service && contextMenu.tabId) {
            const currentIndex = tabsData.findIndex(t => t.id === contextMenu.tabId);
            
            // Add new tab
            const newTab = tabStore.addTab(service.id);
            
            // Wait for state update, then reorder
            setTimeout(() => {
                const updatedTabs = tabStore.getServiceTabs(service.id);
                const newTabIndex = updatedTabs.findIndex(t => t.id === newTab.id);
                
                if (currentIndex !== -1 && newTabIndex !== -1) {
                    const reorderedTabs = [...updatedTabs];
                    // Remove new tab from its current position
                    reorderedTabs.splice(newTabIndex, 1);
                    // Insert it to the right of the context menu tab
                    reorderedTabs.splice(currentIndex + 1, 0, newTab);
                    tabStore.reorderTabs(service.id, reorderedTabs);
                }
            }, 50);
        }
        closeContextMenu();
    }

    function handlePinTab() {
        if (service && contextMenu.tabId) {
            const tab = tabsData.find(t => t.id === contextMenu.tabId);
            if (tab) {
                tabStore.updateTab(service.id, contextMenu.tabId, {
                    isPinned: !tab.isPinned
                });
            }
        }
        closeContextMenu();
    }

    function handleMuteTab() {
        if (service && contextMenu.tabId) {
            const tab = tabsData.find(t => t.id === contextMenu.tabId);
            if (tab) {
                tabStore.updateTab(service.id, contextMenu.tabId, {
                    isMuted: !tab.isMuted
                });
            }
        }
        closeContextMenu();
    }

    function handleAddTab() {
        if (service) {
            tabStore.addTab(service.id);
        }
    }

    function handleCloseTab(e, tabId) {
        e.stopPropagation();
        if (service) {
            tabStore.closeTab(service.id, tabId);
        }
    }

    function handleTabClick(tabId) {
        if (isDragging) {
            return;
        }
        if (service) {
            tabStore.setActiveTab(service.id, tabId);
        }
    }

    function handleDndConsider(e) {
        tabsData = e.detail.items;
        isDragging = true;
    }

    function handleDndFinalize(e) {
        tabsData = e.detail.items;
        if (service) {
            tabStore.reorderTabs(service.id, e.detail.items);
        }
        setTimeout(() => {
            isDragging = false;
        }, 100);
    }

    function handleMouseDown(e, tabId) {
        // Don't interfere with right-click
        if (e.button === 2) return;
        
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        let hasMoved = false;
        
        const handleMouseMove = (moveEvent) => {
            const deltaX = Math.abs(moveEvent.clientX - dragStartX);
            const deltaY = Math.abs(moveEvent.clientY - dragStartY);
            
            if (deltaX > dragThreshold || deltaY > dragThreshold) {
                hasMoved = true;
                isDragging = true;
            }
        };
        
        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            
            // Only trigger click if mouse didn't move much
            if (!hasMoved) {
                handleTabClick(tabId);
            }
        };
        
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }
</script>

<div class="bg-[#2c4a4a] border-b border-white/5 inline-flex items-center px-1.5 py-1.5 gap-1 overflow-x-auto overflow-y-hidden w-full">
    {#if service && tabsData.length > 0}
        {@const tabCount = tabsData.length}
        {@const availableWidth = 1200}
        {@const buttonWidth = 40}
        {@const usableWidth = availableWidth - buttonWidth - 20}
        {@const idealTabWidth = Math.max(80, Math.min(200, Math.floor(usableWidth / tabCount)))}
        
        <div
            class="flex items-center gap-1"
            use:dndzone={{
                items: tabsData,
                flipDurationMs,
                dragDisabled,
                dropTargetStyle: {},
                type: 'tabs'
            }}
            onconsider={handleDndConsider}
            onfinalize={handleDndFinalize}
        >
            {#each tabsData as tab (tab.id)}
                {@const isActive = activeTabId === tab.id}
                {@const isPinned = tab.isPinned || false}
                {@const isMuted = tab.isMuted || false}
                
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <div
                    class="group flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-all shrink-0
                        {isActive
                        ? 'bg-[#3d5e5e] text-white'
                        : 'bg-[#2c4a4a]/50 text-gray-400 hover:bg-[#3d5e5e]/70 hover:text-gray-300'}
                        {isDragging ? 'opacity-50' : ''}
                        {isPinned ? 'border-l-2 border-blue-500' : ''}"
                    style="max-width: {isPinned ? '60px' : idealTabWidth + 'px'}; min-width: {isPinned ? '60px' : '100px'};"
                    onmousedown={(e) => handleMouseDown(e, tab.id)}
                    oncontextmenu={(e) => handleContextMenu(e, tab.id)}
                    animate:flip={{ duration: flipDurationMs }}
                >
                    {#if tab.favicon}
                        <img
                            src={tab.favicon}
                            alt=""
                            class="w-4 h-4 object-contain shrink-0"
                            onerror={(e) => e.target.style.display = 'none'}
                        />
                    {:else if service.icon}
                        <img
                            src={service.icon}
                            alt=""
                            class="w-4 h-4 object-contain shrink-0"
                        />
                    {:else}
                        <div class="w-4 h-4 rounded bg-gray-600 shrink-0"></div>
                    {/if}
                    
                    {#if !isPinned}
                        <span class="text-sm truncate flex-1 min-w-0 font-medium">
                            {tab.title || "New Tab"}
                        </span>
                    {/if}
                    
                    {#if isMuted}
                        <VolumeX size={12} class="text-gray-500 shrink-0" />
                    {/if}
                    
                    {#if isPinned}
                        <Pin size={10} class="text-blue-400 shrink-0" />
                    {:else}
                        <button
                            class="p-0.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-all shrink-0 opacity-0 group-hover:opacity-100"
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
            class="w-7 h-7 rounded-full bg-[#3d5e5e]/50 hover:bg-[#4d6e6e]/70 text-gray-400 hover:text-white transition-all shrink-0 flex items-center justify-center"
            onclick={handleAddTab}
            title="New Tab"
        >
            <Plus size={14} strokeWidth={2.5} />
        </button>
    {:else}
        <!-- No tabs - show add button -->
        <button
            class="w-7 h-7 rounded-full bg-[#3d5e5e]/50 hover:bg-[#4d6e6e]/70 text-gray-400 hover:text-white transition-all shrink-0 flex items-center justify-center"
            onclick={handleAddTab}
            title="New Tab"
        >
            <Plus size={14} strokeWidth={2.5} />
        </button>
    {/if}
</div>


<!-- Context Menu -->
{#if contextMenu.show}
    {@const currentTab = tabsData.find(t => t.id === contextMenu.tabId)}
    {@const currentIndex = tabsData.findIndex(t => t.id === contextMenu.tabId)}
    
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
        class="fixed inset-0 z-50"
        onclick={closeContextMenu}
        oncontextmenu={(e) => e.preventDefault()}
    >
        <div
            class="absolute bg-gray-800/95 backdrop-blur-sm rounded-lg shadow-2xl border border-gray-700 py-1 min-w-[220px] text-sm"
            style="left: {contextMenu.x}px; top: {contextMenu.y}px;"
            onclick={(e) => e.stopPropagation()}
        >
            <!-- New tab to the right -->
            <button
                class="w-full px-4 py-2 text-left text-gray-300 hover:bg-gray-700 flex items-center gap-3"
                onclick={handleNewTabToRight}
            >
                <Plus size={16} />
                New tab to the right
            </button>

            <div class="h-px bg-gray-700 my-1"></div>
            
            <!-- Reload -->
            <button
                class="w-full px-4 py-2 text-left text-gray-300 hover:bg-gray-700 flex items-center justify-between"
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
                class="w-full px-4 py-2 text-left text-gray-300 hover:bg-gray-700 flex items-center gap-3"
                onclick={handleDuplicateTab}
            >
                <Files size={16} />
                Duplicate
            </button>

            <!-- Pin -->
            <button
                class="w-full px-4 py-2 text-left text-gray-300 hover:bg-gray-700 flex items-center gap-3"
                onclick={handlePinTab}
            >
                <Pin size={16} />
                {currentTab?.isPinned ? 'Unpin' : 'Pin'}
            </button>

            <!-- Mute site -->
            <button
                class="w-full px-4 py-2 text-left text-gray-300 hover:bg-gray-700 flex items-center gap-3"
                onclick={handleMuteTab}
            >
                {#if currentTab?.isMuted}
                    <Volume2 size={16} />
                    Unmute site
                {:else}
                    <VolumeX size={16} />
                    Mute site
                {/if}
            </button>

            <div class="h-px bg-gray-700 my-1"></div>

            {#if tabsData.length > 1}
                <!-- Close other tabs -->
                <button
                    class="w-full px-4 py-2 text-left text-gray-300 hover:bg-gray-700 flex items-center gap-3"
                    onclick={handleCloseOtherTabs}
                >
                    <X size={16} />
                    Close other tabs
                </button>

                <!-- Close tabs to the right -->
                {#if currentIndex < tabsData.length - 1}
                    <button
                        class="w-full px-4 py-2 text-left text-gray-300 hover:bg-gray-700 flex items-center gap-3"
                        onclick={handleCloseTabsToRight}
                    >
                        <X size={16} />
                        Close tabs to the right
                    </button>
                {/if}

                <div class="h-px bg-gray-700 my-1"></div>
            {/if}

            <!-- Close -->
            <button
                class="w-full px-4 py-2 text-left text-red-400 hover:bg-red-500/20 flex items-center justify-between"
                onclick={(e) => {
                    handleCloseTab(e, contextMenu.tabId);
                    closeContextMenu();
                }}
            >
                <div class="flex items-center gap-3">
                    <X size={16} />
                    Close
                </div>
                <span class="text-xs text-red-400/70">Ctrl+W</span>
            </button>
        </div>
    </div>
{/if}
