<script>
    import { Clock, Search, Trash2, ExternalLink, Star, Calendar } from "lucide-svelte";
    import { slide } from 'svelte/transition';
    import { onMount, onDestroy } from 'svelte';
    import { historyStore } from "../../lib/stores/history.svelte.js";
    import { workspaceStore } from "../../lib/stores/workspaces.svelte.js";
    import { appStore } from "../../lib/stores/apps.svelte.js";
    import { useClickOutside } from "../../lib/utils/clickOutside.svelte.js";

    let { isOpen = false, onClose = () => {} } = $props();

    let searchQuery = $state("");
    let viewMode = $state("date"); // 'date' or 'group'
    let currentWorkspace = $derived(workspaceStore.activeWorkspace);
    let filteredHistory = $state([]);
    let groupedHistory = $state([]);
    let groupedByDomain = $state([]);
    let clickOutsideCleanup;
    
    // Load history from backend when panel opens
    $effect(() => {
        if (isOpen && currentWorkspace) {
            loadHistory();
        }
    });

    // Setup click outside detection
    $effect(() => {
        if (isOpen) {
            clickOutsideCleanup = useClickOutside({
                elementSelector: '[data-history-panel]',
                onClickOutside: onClose,
                enabled: true,
                includeEscape: true,
                includeBlur: true,
                includeResize: true
            });
        } else {
            if (clickOutsideCleanup) {
                clickOutsideCleanup();
                clickOutsideCleanup = null;
            }
        }
    });

    onDestroy(() => {
        if (clickOutsideCleanup) {
            clickOutsideCleanup();
        }
    });

    async function loadHistory() {
        if (!currentWorkspace) {
            filteredHistory = [];
            groupedHistory = [];
            groupedByDomain = [];
            return;
        }

        // Load from backend (max 100 per backend limit)
        await historyStore.loadHistory(currentWorkspace.id, 100);
        updateHistory();
    }

    function updateHistory() {
        if (!currentWorkspace) {
            filteredHistory = [];
            groupedHistory = [];
            groupedByDomain = [];
            return;
        }

        // Get history from store cache (already limited to 100 from backend)
        let history = historyStore.getHistory(currentWorkspace.id, 100);
        
        if (history.length === 0) {
            filteredHistory = [];
            groupedHistory = [];
            groupedByDomain = [];
            return;
        }

        // Transform backend format to UI format with favicon
        history = history.map(h => {
            let favicon = null;
            try {
                const urlObj = new URL(h.url);
                // Use Google's favicon service as fallback
                favicon = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
            } catch (e) {
                // Invalid URL, no favicon
            }
            
            return {
                id: h.id,
                url: h.url,
                title: h.dataJson?.title || (h.url ? new URL(h.url).hostname : 'Untitled'),
                favicon: favicon,
                timestamp: new Date(h.updatedAt).getTime(),
                visitCount: h.count
            };
        });

        // Filter by search
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            history = history.filter(entry => 
                entry.title?.toLowerCase().includes(query) ||
                entry.url?.toLowerCase().includes(query)
            );
        }

        filteredHistory = history;

        // Group by date
        const groups = {};
        history.forEach(entry => {
            const date = new Date(entry.timestamp);
            const dateKey = date.toDateString();
            if (!groups[dateKey]) {
                groups[dateKey] = [];
            }
            groups[dateKey].push(entry);
        });

        groupedHistory = Object.entries(groups).sort((a, b) => 
            new Date(b[0]).getTime() - new Date(a[0]).getTime()
        );

        // Group by domain
        const domainGroups = {};
        history.forEach(entry => {
            try {
                const domain = new URL(entry.url).hostname;
                if (!domainGroups[domain]) {
                    domainGroups[domain] = {
                        domain,
                        entries: [],
                        visitCount: 0,
                        lastVisit: 0,
                        favicon: null
                    };
                }
                domainGroups[domain].entries.push(entry);
                domainGroups[domain].visitCount += (entry.visitCount || 1);
                domainGroups[domain].lastVisit = Math.max(domainGroups[domain].lastVisit, entry.timestamp);
                if (entry.favicon) {
                    domainGroups[domain].favicon = entry.favicon;
                }
            } catch (e) {
                // Skip invalid URLs
            }
        });

        groupedByDomain = Object.values(domainGroups)
            .sort((a, b) => b.visitCount - a.visitCount);
    }

    function handleEntryClick(entry) {
        const newApp = appStore.addApp(
            {
                name: entry.title,
                url: entry.url,
                icon: entry.favicon,
                color: "#4285f4",
            },
            null,
            null,
            null,
            currentWorkspace?.id,
        );

        if (currentWorkspace && newApp) {
            workspaceStore.addAppToWorkspace(currentWorkspace.id, newApp.id, appStore.activeAppId);
            appStore.setActive(newApp.id);
        }

        onClose();
    }

    async function handleRemoveEntry(entry, e) {
        e.stopPropagation();
        await historyStore.removeEntry(currentWorkspace.id, entry.id);
        await loadHistory(); // Refresh after removal
    }

    async function handleClearHistory() {
        if (confirm('Are you sure you want to clear all browsing history for this profile?')) {
            await historyStore.clearHistory(currentWorkspace.id);
            await loadHistory(); // Refresh after clear
        }
    }

    function handleSearchChange() {
        updateHistory();
    }

    function handleViewModeChange(mode) {
        viewMode = mode;
    }

    function formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function formatDate(dateString) {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return 'Today';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString([], { 
                weekday: 'long', 
                month: 'short', 
                day: 'numeric' 
            });
        }
    }

    function formatUrl(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname;
        } catch (e) {
            return url;
        }
    }
</script>

{#if isOpen}
    <!-- Panel - No backdrop, just the panel with slide animation -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
        class="fixed right-0 top-0 h-full w-96 bg-white dark:bg-gray-900 shadow-2xl border-l border-gray-200 dark:border-gray-700 flex flex-col z-50"
        data-history-panel
        transition:slide={{ duration: 300, axis: 'x' }}
        onclick={(e) => e.stopPropagation()}
    >
            <!-- Header -->
            <div class="p-4 border-b border-gray-200 dark:border-gray-700">
                <div class="flex items-center justify-between mb-4">
                    <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <Clock size={20} />
                        Browsing History
                    </h2>
                    <button
                        onclick={onClose}
                        class="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    >
                        ✕
                    </button>
                </div>

                <!-- Search -->
                <div class="relative mb-3">
                    <Search size={16} class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                    <input
                        type="text"
                        bind:value={searchQuery}
                        oninput={handleSearchChange}
                        placeholder="Search history..."
                        class="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                    />
                </div>

                <!-- View Mode Tabs -->
                <div class="flex gap-1 border-b border-gray-200 dark:border-gray-700">
                    <button
                        onclick={() => handleViewModeChange('date')}
                        class="px-4 py-2 text-sm font-medium transition-colors border-b-2 {viewMode === 'date'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}"
                    >
                        By Date
                    </button>
                    <button
                        onclick={() => handleViewModeChange('group')}
                        class="px-4 py-2 text-sm font-medium transition-colors border-b-2 {viewMode === 'group'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}"
                    >
                        By Group
                    </button>
                </div>
            </div>

            <!-- Content -->
            <div class="flex-1 overflow-y-auto">
                {#if !currentWorkspace}
                    <div class="p-8 text-center text-gray-500 dark:text-gray-400">
                        <Clock size={48} class="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                        <p>No profile selected</p>
                    </div>
                {:else if filteredHistory.length === 0}
                    <div class="p-8 text-center text-gray-500 dark:text-gray-400">
                        <Clock size={48} class="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                        <p class="mb-2">No browsing history</p>
                        <p class="text-sm">Start browsing to see your history here</p>
                    </div>
                {:else}
                    {#if viewMode === 'date'}
                        <!-- By Date View -->
                        {#each groupedHistory as [dateString, entries]}
                            <div class="border-b border-gray-100 dark:border-gray-800 last:border-b-0">
                                <div class="sticky top-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm px-4 py-2 border-b border-gray-100 dark:border-gray-800">
                                    <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                        <Calendar size={14} />
                                        {formatDate(dateString)}
                                    </h3>
                                </div>

                                {#each entries as entry}
                                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                                    <div
                                        class="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer border-b border-gray-50 dark:border-gray-800 last:border-b-0 group"
                                        onclick={() => handleEntryClick(entry)}
                                    >
                                        <div class="flex items-start gap-3">
                                            {#if entry.favicon}
                                                <img
                                                    src={entry.favicon}
                                                    alt=""
                                                    class="w-4 h-4 mt-0.5 object-contain shrink-0"
                                                    onerror={(e) => e.target.style.display = 'none'}
                                                />
                                            {:else}
                                                <div class="w-4 h-4 mt-0.5 bg-gray-300 dark:bg-gray-600 rounded shrink-0"></div>
                                            {/if}

                                            <div class="flex-1 min-w-0">
                                                <div class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                                    {entry.title || 'Untitled'}
                                                </div>
                                                <div class="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                                    {entry.url}
                                                </div>
                                                <div class="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                                    {formatTime(entry.timestamp)}
                                                    {#if entry.visitCount > 1}
                                                        • {entry.visitCount} visits
                                                    {/if}
                                                </div>
                                            </div>

                                            {#if false}
                                            <button
                                                onclick={(e) => handleRemoveEntry(entry, e)}
                                                class="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-all shrink-0"
                                                title="Remove from history"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                            {/if}
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        {/each}
                    {:else}
                        <!-- By Group View (Domain) -->
                        {#each groupedByDomain as group}
                            <div class="border-b border-gray-100 dark:border-gray-800 last:border-b-0">
                                <div class="sticky top-0 bg-blue-50/95 dark:bg-blue-900/30 backdrop-blur-sm px-4 py-3 border-b border-blue-100 dark:border-blue-900">
                                    <div class="flex items-center gap-3">
                                        {#if group.favicon}
                                            <img
                                                src={group.favicon}
                                                alt=""
                                                class="w-5 h-5 object-contain"
                                                onerror={(e) => e.target.style.display = 'none'}
                                            />
                                        {:else}
                                            <div class="w-5 h-5 bg-blue-300 dark:bg-blue-700 rounded"></div>
                                        {/if}
                                        <div class="flex-1">
                                            <h3 class="text-sm font-medium text-blue-900 dark:text-blue-300">
                                                {group.domain}
                                            </h3>
                                            <p class="text-xs text-blue-600 dark:text-blue-400">
                                                {group.visitCount} visits • {group.entries.length} pages
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {#each group.entries as entry}
                                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                                    <div
                                        class="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer border-b border-gray-50 dark:border-gray-800 last:border-b-0 group"
                                        onclick={() => handleEntryClick(entry)}
                                    >
                                        <div class="flex items-start gap-3 pl-8">
                                            <div class="flex-1 min-w-0">
                                                <div class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                                    {entry.title || 'Untitled'}
                                                </div>
                                                <div class="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                                    {entry.url}
                                                </div>
                                                <div class="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                                    {formatTime(entry.timestamp)}
                                                    {#if entry.visitCount > 1}
                                                        • {entry.visitCount} visits
                                                    {/if}
                                                </div>
                                            </div>

                                            {#if false}
                                            <button
                                                onclick={(e) => handleRemoveEntry(entry, e)}
                                                class="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-all shrink-0"
                                                title="Remove from history"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                            {/if}
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        {/each}
                    {/if}
                {/if}
            </div>

            <!-- Footer with Clear History - Temporarily Hidden -->
            {#if false && filteredHistory.length > 0}
                <div class="p-4 border-t border-gray-200">
                    <button
                        onclick={handleClearHistory}
                        class="w-full px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        <Trash2 size={16} />
                        Clear All History
                    </button>
                </div>
            {/if}
        </div>
{/if}

<style>
    /* Custom scrollbar */
    div::-webkit-scrollbar {
        width: 6px;
    }
    
    div::-webkit-scrollbar-track {
        background: #f1f1f1;
    }
    
    div::-webkit-scrollbar-thumb {
        background: #c1c1c1;
        border-radius: 3px;
    }
    
    div::-webkit-scrollbar-thumb:hover {
        background: #a8a8a8;
    }

    /* Slide animations */
    @keyframes fade-in {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }

    @keyframes slide-in-right {
        from {
            transform: translateX(100%);
        }
        to {
            transform: translateX(0);
        }
    }
</style>





