<script>
    import { Star, Trash2, ExternalLink, Search, Calendar } from "lucide-svelte";
    import { slide } from 'svelte/transition';
    import { onDestroy } from 'svelte';
    import { bookmarkStore } from "../../lib/stores/bookmarks.svelte.js";
    import { workspaceStore } from "../../lib/stores/workspaces.svelte.js";
    import { appStore } from "../../lib/stores/apps.svelte.js";
    import { useClickOutside } from "../../lib/utils/clickOutside.svelte.js";

    let { isOpen = $bindable(false), onClose = () => {} } = $props();

    let searchQuery = $state("");
    let viewMode = $state("date"); // 'date' or 'domain'
    let activeWorkspace = $derived(workspaceStore.activeWorkspace);
    let allBookmarks = $state([]);
    let filteredBookmarks = $state([]);
    let groupedByDate = $state([]);
    let groupedByDomain = $state([]);
    let clickOutsideCleanup;

    // Load bookmarks when panel opens
    $effect(() => {
        if (isOpen && activeWorkspace) {
            loadBookmarks();
        }
    });

    // Setup click outside detection
    $effect(() => {
        if (isOpen) {
            clickOutsideCleanup = useClickOutside({
                elementSelector: '[data-bookmark-panel]',
                onClickOutside: () => isOpen = false,
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

    async function loadBookmarks() {
        if (!activeWorkspace) {
            allBookmarks = [];
            filteredBookmarks = [];
            groupedByDate = [];
            groupedByDomain = [];
            return;
        }

        await bookmarkStore.loadBookmarks(activeWorkspace.id);
        const bookmarks = bookmarkStore.getProfileBookmarks(activeWorkspace.id);
        allBookmarks = bookmarks;
        updateBookmarks();
    }

    function updateBookmarks() {
        if (!activeWorkspace) {
            filteredBookmarks = [];
            groupedByDate = [];
            groupedByDomain = [];
            return;
        }

        let bookmarks = [...allBookmarks];

        // Filter by search
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            bookmarks = bookmarks.filter(bookmark => 
                bookmark.title?.toLowerCase().includes(query) ||
                bookmark.url?.toLowerCase().includes(query)
            );
        }

        filteredBookmarks = bookmarks;

        // Group by date
        const dateGroups = {};
        bookmarks.forEach(bookmark => {
            const date = new Date(bookmark.createdAt);
            const dateKey = date.toDateString();
            if (!dateGroups[dateKey]) {
                dateGroups[dateKey] = [];
            }
            dateGroups[dateKey].push(bookmark);
        });

        groupedByDate = Object.entries(dateGroups).sort((a, b) => 
            new Date(b[0]).getTime() - new Date(a[0]).getTime()
        );

        // Group by domain
        const domainGroups = {};
        bookmarks.forEach(bookmark => {
            try {
                const domain = new URL(bookmark.url).hostname;
                if (!domainGroups[domain]) {
                    domainGroups[domain] = {
                        domain,
                        bookmarks: [],
                        count: 0,
                        favicon: null
                    };
                }
                domainGroups[domain].bookmarks.push(bookmark);
                domainGroups[domain].count++;
                if (bookmark.favicon) {
                    domainGroups[domain].favicon = bookmark.favicon;
                }
            } catch (e) {
                // Skip invalid URLs
            }
        });

        groupedByDomain = Object.values(domainGroups)
            .sort((a, b) => b.count - a.count);
    }

    function handleBookmarkClick(bookmark) {
        const newApp = appStore.addApp(
            {
                name: bookmark.title,
                url: bookmark.url,
                icon: bookmark.favicon,
                color: "#4285f4",
            },
            null,
            null,
            null,
            activeWorkspace?.id,
        );

        if (activeWorkspace && newApp) {
            workspaceStore.addAppToWorkspace(activeWorkspace.id, newApp.id, appStore.activeAppId);
            appStore.setActive(newApp.id);
        }

        handleClose();
    }

    async function handleDeleteBookmark(bookmark, event) {
        event.stopPropagation();
        if (activeWorkspace) {
            await bookmarkStore.removeBookmark(activeWorkspace.id, bookmark.url);
            await loadBookmarks();
        }
    }

    function handleClose() {
        isOpen = false;
        onClose();
    }

    function handleSearchChange() {
        updateBookmarks();
    }

    function handleViewModeChange(mode) {
        viewMode = mode;
    }

    function getFaviconUrl(bookmark) {
        if (bookmark.favicon) return bookmark.favicon;
        try {
            const url = new URL(bookmark.url);
            return `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=32`;
        } catch {
            return '';
        }
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

    function formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
</script>

{#if isOpen}
    <!-- Panel - Full height side panel with slide animation -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
        class="fixed right-0 top-0 h-full w-96 bg-white dark:bg-gray-900 shadow-2xl border-l border-gray-200 dark:border-gray-700 flex flex-col z-50"
        data-bookmark-panel
        transition:slide={{ duration: 300, axis: 'x' }}
        onclick={(e) => e.stopPropagation()}
    >
        <!-- Header -->
        <div class="p-4 border-b border-gray-200 dark:border-gray-700">
            <div class="flex items-center justify-between mb-4">
                <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <Star size={20} class="text-yellow-500" fill="currentColor" />
                    Bookmarks
                </h2>
                <button
                    onclick={handleClose}
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
                    placeholder="Search bookmarks..."
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
                    onclick={() => handleViewModeChange('domain')}
                    class="px-4 py-2 text-sm font-medium transition-colors border-b-2 {viewMode === 'domain'
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}"
                >
                    By Domain
                </button>
            </div>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto">
            {#if !activeWorkspace}
                <div class="p-8 text-center text-gray-500 dark:text-gray-400">
                    <Star size={48} class="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                    <p>No profile selected</p>
                </div>
            {:else if filteredBookmarks.length === 0}
                <div class="p-8 text-center text-gray-500 dark:text-gray-400">
                    <Star size={48} class="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                    <p class="mb-2">No bookmarks</p>
                    <p class="text-sm">
                        {searchQuery ? 'No bookmarks match your search' : 'Click the star icon in the address bar to save bookmarks'}
                    </p>
                </div>
            {:else}
                {#if viewMode === 'date'}
                    <!-- By Date View -->
                    {#each groupedByDate as [dateString, bookmarks]}
                        <div class="border-b border-gray-100 dark:border-gray-800 last:border-b-0">
                            <div class="sticky top-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm px-4 py-2 border-b border-gray-100 dark:border-gray-800">
                                <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                    <Calendar size={14} />
                                    {formatDate(dateString)}
                                </h3>
                            </div>

                            {#each bookmarks as bookmark}
                                <!-- svelte-ignore a11y_no_static_element_interactions -->
                                <!-- svelte-ignore a11y_click_events_have_key_events -->
                                <div
                                    class="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer border-b border-gray-50 dark:border-gray-800 last:border-b-0 group"
                                    onclick={() => handleBookmarkClick(bookmark)}
                                >
                                    <div class="flex items-start gap-3">
                                        {#if bookmark.favicon || getFaviconUrl(bookmark)}
                                            <img
                                                src={getFaviconUrl(bookmark)}
                                                alt=""
                                                class="w-4 h-4 mt-0.5 object-contain shrink-0"
                                                onerror={(e) => e.target.style.display = 'none'}
                                            />
                                        {:else}
                                            <div class="w-4 h-4 mt-0.5 bg-gray-300 dark:bg-gray-600 rounded shrink-0"></div>
                                        {/if}

                                        <div class="flex-1 min-w-0">
                                            <div class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                                {bookmark.title || 'Untitled'}
                                            </div>
                                            <div class="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                                {bookmark.url}
                                            </div>
                                            <div class="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                                {formatTime(bookmark.createdAt)}
                                            </div>
                                        </div>

                                        <button
                                            onclick={(e) => handleDeleteBookmark(bookmark, e)}
                                            class="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-all shrink-0"
                                            title="Remove bookmark"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {/each}
                {:else}
                    <!-- By Domain View -->
                    {#each groupedByDomain as group}
                        <div class="border-b border-gray-100 dark:border-gray-800 last:border-b-0">
                            <div class="sticky top-0 bg-yellow-50/95 dark:bg-yellow-900/30 backdrop-blur-sm px-4 py-3 border-b border-yellow-100 dark:border-yellow-900">
                                <div class="flex items-center gap-3">
                                    {#if group.favicon}
                                        <img
                                            src={group.favicon}
                                            alt=""
                                            class="w-5 h-5 object-contain"
                                            onerror={(e) => e.target.style.display = 'none'}
                                        />
                                    {:else}
                                        <div class="w-5 h-5 bg-yellow-300 dark:bg-yellow-700 rounded"></div>
                                    {/if}
                                    <div class="flex-1">
                                        <h3 class="text-sm font-medium text-yellow-900 dark:text-yellow-300">
                                            {group.domain}
                                        </h3>
                                        <p class="text-xs text-yellow-600 dark:text-yellow-500">
                                            {group.count} bookmark{group.count > 1 ? 's' : ''}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {#each group.bookmarks as bookmark}
                                <!-- svelte-ignore a11y_no_static_element_interactions -->
                                <!-- svelte-ignore a11y_click_events_have_key_events -->
                                <div
                                    class="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer border-b border-gray-50 dark:border-gray-800 last:border-b-0 group"
                                    onclick={() => handleBookmarkClick(bookmark)}
                                >
                                    <div class="flex items-start gap-3 pl-8">
                                        <div class="flex-1 min-w-0">
                                            <div class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                                {bookmark.title || 'Untitled'}
                                            </div>
                                            <div class="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                                {bookmark.url}
                                            </div>
                                            <div class="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                                {formatTime(bookmark.createdAt)}
                                            </div>
                                        </div>

                                        <button
                                            onclick={(e) => handleDeleteBookmark(bookmark, e)}
                                            class="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-all shrink-0"
                                            title="Remove bookmark"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {/each}
                {/if}
            {/if}
        </div>
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
</style>






