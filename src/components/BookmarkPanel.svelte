<script>
    import { X, Star, Trash2, ExternalLink } from "lucide-svelte";
    import { bookmarkStore } from "../lib/bookmarks.svelte.js";
    import { workspaceStore } from "../lib/workspaces.svelte.js";
    import { navigationStore } from "../lib/navigation.svelte.js";
    import { clickOutside } from "../lib/clickOutside.svelte.js";

    let { isOpen = $bindable(false) } = $props();

    let activeWorkspace = $derived(workspaceStore.activeWorkspace);
    let bookmarks = $derived(
        activeWorkspace ? bookmarkStore.getProfileBookmarks(activeWorkspace.id) : []
    );

    // Load bookmarks when panel opens
    $effect(() => {
        if (isOpen && activeWorkspace) {
            bookmarkStore.loadBookmarks(activeWorkspace.id);
        }
    });

    function handleClose() {
        isOpen = false;
    }

    function handleBookmarkClick(bookmark) {
        navigationStore.navigate(bookmark.url);
        handleClose();
    }

    async function handleDeleteBookmark(bookmark, event) {
        event.stopPropagation();
        if (activeWorkspace) {
            await bookmarkStore.removeBookmark(activeWorkspace.id, bookmark.url);
        }
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

    function formatDate(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        
        if (days === 0) return 'Today';
        if (days === 1) return 'Yesterday';
        if (days < 7) return `${days} days ago`;
        if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
        if (days < 365) return `${Math.floor(days / 30)} months ago`;
        return `${Math.floor(days / 365)} years ago`;
    }
</script>

{#if isOpen}
    <div
        use:clickOutside={{ onClickOutside: handleClose, includeEscape: true }}
        class="fixed right-4 top-16 w-96 max-h-[600px] bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col z-50"
        onclick={(e) => e.stopPropagation()}
    >
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b border-gray-200">
            <div class="flex items-center gap-2">
                <Star size={18} class="text-yellow-500" fill="currentColor" />
                <h3 class="font-semibold text-gray-900">Bookmarks</h3>
                <span class="text-xs text-gray-500">({bookmarks.length})</span>
            </div>
            <button
                onclick={handleClose}
                class="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                title="Close"
            >
                <X size={18} class="text-gray-600" />
            </button>
        </div>

        <!-- Bookmarks List -->
        <div class="flex-1 overflow-y-auto">
            {#if bookmarks.length === 0}
                <div class="flex flex-col items-center justify-center py-12 px-4 text-center">
                    <Star size={48} class="text-gray-300 mb-3" />
                    <p class="text-gray-600 font-medium mb-1">No bookmarks yet</p>
                    <p class="text-sm text-gray-500">
                        Click the star icon in the address bar to save bookmarks
                    </p>
                </div>
            {:else}
                <div class="divide-y divide-gray-100">
                    {#each bookmarks as bookmark (bookmark.id)}
                        <div class="relative group">
                            <button
                                onclick={() => handleBookmarkClick(bookmark)}
                                class="w-full px-4 py-3 hover:bg-gray-50 transition-colors flex items-start gap-3 text-left"
                            >
                                <!-- Favicon -->
                                <div class="w-8 h-8 rounded flex items-center justify-center bg-gray-100 shrink-0 mt-0.5">
                                    {#if bookmark.favicon || getFaviconUrl(bookmark)}
                                        <img
                                            src={getFaviconUrl(bookmark)}
                                            alt=""
                                            class="w-5 h-5"
                                            onerror={(e) => {
                                                e.target.style.display = 'none';
                                                e.target.parentElement.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-400"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>';
                                            }}
                                        />
                                    {:else}
                                        <ExternalLink size={16} class="text-gray-400" />
                                    {/if}
                                </div>

                                <!-- Content -->
                                <div class="flex-1 min-w-0">
                                    <p class="font-medium text-gray-900 text-sm truncate mb-0.5">
                                        {bookmark.title}
                                    </p>
                                    <p class="text-xs text-gray-500 truncate mb-1">
                                        {bookmark.url}
                                    </p>
                                    <p class="text-xs text-gray-400">
                                        {formatDate(bookmark.createdAt)}
                                    </p>
                                </div>
                            </button>

                            <!-- Delete Button (absolute positioned outside the main button) -->
                            <button
                                onclick={(e) => handleDeleteBookmark(bookmark, e)}
                                class="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 rounded transition-all z-10"
                                title="Delete bookmark"
                            >
                                <Trash2 size={14} class="text-red-600" />
                            </button>
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    </div>
{/if}

<style>
    /* Custom scrollbar */
    .overflow-y-auto::-webkit-scrollbar {
        width: 6px;
    }

    .overflow-y-auto::-webkit-scrollbar-track {
        background: transparent;
    }

    .overflow-y-auto::-webkit-scrollbar-thumb {
        background: rgba(156, 163, 175, 0.3);
        border-radius: 3px;
    }

    .overflow-y-auto::-webkit-scrollbar-thumb:hover {
        background: rgba(156, 163, 175, 0.5);
    }
</style>
