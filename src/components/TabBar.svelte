<script>
    import {
        Plus,
        X,
        RotateCw,
        Copy,
        Files,
        Pin,
        Volume2,
        VolumeX,
    } from "lucide-svelte";
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
            try {
                const tabs = tabStore.getServiceTabs(service.id);
                // Validate tabs before assigning
                const uniqueIds = new Set(tabs.map((t) => t.id));
                if (uniqueIds.size === tabs.length) {
                    tabsData = tabs;
                } else {
                    console.error(
                        "Duplicate tabs detected in store, cleaning up",
                    );
                    // Remove duplicates by keeping first occurrence
                    const seen = new Set();
                    const cleanTabs = tabs.filter((tab) => {
                        if (seen.has(tab.id)) {
                            return false;
                        }
                        seen.add(tab.id);
                        return true;
                    });
                    tabsData = cleanTabs;
                    // Update store with clean data
                    tabStore.reorderTabs(service.id, cleanTabs);
                }
            } catch (error) {
                console.error("Error syncing tabs:", error);
                tabsData = [];
            }
        }
    });

    // Drag and drop state
    const flipDurationMs = 200;
    let isDragging = $state(false);
    let draggedItemId = $state(null);

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
        if (service && contextMenu.tabId) {
            tabStore.setActiveTab(service.id, contextMenu.tabId);
            setTimeout(() => window.location.reload(), 100);
        }
        closeContextMenu();
    }

    function handleCopyUrl() {
        if (service && contextMenu.tabId) {
            const tab = tabsData.find((t) => t.id === contextMenu.tabId);
            if (tab && tab.url) {
                navigator.clipboard.writeText(tab.url);
            }
        }
        closeContextMenu();
    }

    function handleDuplicateTab() {
        if (service && contextMenu.tabId) {
            const tab = tabsData.find((t) => t.id === contextMenu.tabId);
            if (tab) {
                tabStore.addTab(service.id, tab.url, tab.title);
            }
        }
        closeContextMenu();
    }

    function handleCloseOtherTabs() {
        if (service && contextMenu.tabId) {
            const tabsToClose = tabsData.filter(
                (t) => t.id !== contextMenu.tabId,
            );
            tabsToClose.forEach((tab) => {
                tabStore.closeTab(service.id, tab.id);
            });
            tabStore.setActiveTab(service.id, contextMenu.tabId);
        }
        closeContextMenu();
    }

    function handleCloseTabsToRight() {
        if (service && contextMenu.tabId) {
            const currentIndex = tabsData.findIndex(
                (t) => t.id === contextMenu.tabId,
            );
            if (currentIndex !== -1) {
                const tabsToClose = tabsData.slice(currentIndex + 1);
                tabsToClose.forEach((tab) => {
                    tabStore.closeTab(service.id, tab.id);
                });
            }
        }
        closeContextMenu();
    }

    function handleNewTabToRight() {
        if (service && contextMenu.tabId) {
            const currentIndex = tabsData.findIndex(
                (t) => t.id === contextMenu.tabId,
            );

            // Add new tab
            const newTab = tabStore.addTab(service.id);

            // Wait for state update, then reorder
            setTimeout(() => {
                const updatedTabs = tabStore.getServiceTabs(service.id);
                const newTabIndex = updatedTabs.findIndex(
                    (t) => t.id === newTab.id,
                );

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
            const tab = tabsData.find((t) => t.id === contextMenu.tabId);
            if (tab) {
                tabStore.updateTab(service.id, contextMenu.tabId, {
                    isPinned: !tab.isPinned,
                });
            }
        }
        closeContextMenu();
    }

    function handleMuteTab() {
        if (service && contextMenu.tabId) {
            const tab = tabsData.find((t) => t.id === contextMenu.tabId);
            if (tab) {
                tabStore.updateTab(service.id, contextMenu.tabId, {
                    isMuted: !tab.isMuted,
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
        if (service && !isDragging) {
            tabStore.setActiveTab(service.id, tabId);
        }
    }

    function handleDndConsider(e) {
        // Only update if items are valid and unique
        const items = e.detail.items;
        const uniqueIds = new Set(items.map((item) => item.id));

        if (uniqueIds.size === items.length) {
            tabsData = items;
            isDragging = true;
            tabStore.setDragging(true);
        }
    }

    function handleDndFinalize(e) {
        const items = e.detail.items;
        const uniqueIds = new Set(items.map((item) => item.id));

        // Only update if items are valid and unique
        if (uniqueIds.size === items.length) {
            tabsData = items;
            if (service) {
                tabStore.reorderTabs(service.id, items);
            }
        } else {
            // If duplicates detected, reload from store
            console.warn("Duplicate tabs detected, reloading from store");
            if (service) {
                tabsData = tabStore.getServiceTabs(service.id);
            }
        }

        // Reset drag state after animation completes
        setTimeout(() => {
            isDragging = false;
            tabStore.setDragging(false);
            draggedItemId = null;
        }, flipDurationMs + 50);
    }
</script>

<div
    class="bg-[#2c4a4a] border-b border-white/5 inline-flex items-center px-1.5 py-1.5 gap-1 overflow-x-auto overflow-y-hidden w-full"
>
    {#if service && tabsData.length > 0}
        {@const tabCount = tabsData.length}
        {@const availableWidth = 1200}
        {@const buttonWidth = 40}
        {@const usableWidth = availableWidth - buttonWidth - 20}
        {@const idealTabWidth = Math.max(
            80,
            Math.min(200, Math.floor(usableWidth / tabCount)),
        )}

        <div
            class="flex items-center gap-1"
            use:dndzone={{
                items: tabsData,
                flipDurationMs,
                dropTargetStyle: {},
                type: "tabs",
                dragDisabled: false,
                // Only allow drag from .drag-handle class
                morphDisabled: true,
                centreDraggedOnCursor: true,
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
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <div
                    class="group flex items-center gap-2 px-3 py-1.5 transition-colors shrink-0 cursor-pointer
                        {isActive
                        ? 'bg-[#3d5e5e] text-white'
                        : 'bg-[#2c4a4a]/50 text-gray-400 hover:bg-[#3d5e5e]/70 hover:text-gray-300'}
                        {isDragging && draggedItemId === tab.id
                        ? 'opacity-50'
                        : ''}
                        {isPinned ? 'border-l-2 border-blue-500' : ''}"
                    style="max-width: {isPinned
                        ? '60px'
                        : idealTabWidth + 'px'}; min-width: {isPinned
                        ? '60px'
                        : '100px'};"
                    onclick={(e) => {
                        // Don't trigger if clicking close button
                        if (!e.target.closest("button")) {
                            handleTabClick(tab.id);
                        }
                    }}
                    oncontextmenu={(e) => handleContextMenu(e, tab.id)}
                    animate:flip={{ duration: flipDurationMs }}
                >
                    <!-- Drag Handle Area (icon + text) - DND library will handle drag from here -->
                    <div
                        class="drag-handle flex items-center gap-2 flex-1 min-w-0"
                        onpointerdown={(e) => {
                            if (e.button === 0) {
                                tabStore.setDragging(true);
                                const handlePointerUp = () => {
                                    if (!isDragging) {
                                        tabStore.setDragging(false);
                                    }
                                    window.removeEventListener(
                                        "pointerup",
                                        handlePointerUp,
                                    );
                                };
                                window.addEventListener(
                                    "pointerup",
                                    handlePointerUp,
                                );
                            }
                        }}
                    >
                        {#if tab.favicon}
                            <img
                                src={tab.favicon}
                                alt=""
                                class="w-4 h-4 object-contain shrink-0"
                                onerror={(e) =>
                                    (e.target.style.display = "none")}
                            />
                        {:else if service.icon}
                            <img
                                src={service.icon}
                                alt=""
                                class="w-4 h-4 object-contain shrink-0"
                            />
                        {:else}
                            <div
                                class="w-4 h-4 rounded bg-gray-600 shrink-0"
                            ></div>
                        {/if}

                        {#if !isPinned}
                            <span
                                class="text-sm truncate flex-1 min-w-0 font-medium"
                            >
                                {tab.title || "New Tab"}
                            </span>
                        {/if}

                        {#if isMuted}
                            <VolumeX size={12} class="text-gray-500 shrink-0" />
                        {/if}

                        {#if isPinned}
                            <Pin size={10} class="text-blue-400 shrink-0" />
                        {/if}
                    </div>

                    <!-- Close Button (right side) - clicking this won't trigger tab switch -->
                    {#if !isPinned}
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
                {currentTab?.isPinned ? "Unpin" : "Pin"}
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

<style>
    /* Override DND library cursor styles - keep pointer cursor */
    :global(.drag-handle) {
        cursor: pointer !important;
    }

    :global(.drag-handle:active) {
        cursor: pointer !important;
    }

    /* Override any grab cursor from DND library */
    :global([draggable="true"]) {
        cursor: pointer !important;
        will-change: transform;
    }
</style>
