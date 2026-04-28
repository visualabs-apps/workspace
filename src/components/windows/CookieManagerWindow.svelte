<script>
    import BaseWindow from "../base/BaseWindow.svelte";
    import { Cookie, Trash2, Search } from "lucide-svelte";
    import { toastStore } from "../../lib/managers/toast.svelte.js";

    let { isOpen = $bindable(false), partition = null } = $props();

    let cookies = $state([]);
    let searchQuery = $state("");
    let isLoading = $state(false);

    let filteredCookies = $derived(
        cookies.filter(cookie => 
            cookie.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            cookie.domain.toLowerCase().includes(searchQuery.toLowerCase())
        )
    );

    $effect(() => {
        if (isOpen && partition) {
            loadCookies();
        }
    });

    async function loadCookies() {
        if (!partition) return;
        
        isLoading = true;
        try {
            const result = await window.api.cookies.getCookies(partition);
            if (result.success) {
                cookies = result.cookies || [];
            } else {
                toastStore.error('Failed to load cookies');
            }
        } catch (error) {
            console.error('Load cookies error:', error);
            toastStore.error('Failed to load cookies');
        } finally {
            isLoading = false;
        }
    }

    async function deleteCookie(cookie) {
        if (!confirm(`Delete cookie "${cookie.name}"?`)) return;

        try {
            const result = await window.api.cookies.deleteCookie(partition, cookie.name, cookie.domain, cookie.path);
            if (result.success) {
                toastStore.success('Cookie deleted');
                await loadCookies();
            } else {
                toastStore.error('Failed to delete cookie');
            }
        } catch (error) {
            console.error('Delete cookie error:', error);
            toastStore.error('Failed to delete cookie');
        }
    }

    async function clearAllCookies() {
        if (!confirm('Delete all cookies? This cannot be undone.')) return;

        try {
            const result = await window.api.cookies.clearCookies(partition);
            if (result.success) {
                toastStore.success('All cookies cleared');
                await loadCookies();
            } else {
                toastStore.error('Failed to clear cookies');
            }
        } catch (error) {
            console.error('Clear cookies error:', error);
            toastStore.error('Failed to clear cookies');
        }
    }

    function handleClose() {
        isOpen = false;
        searchQuery = "";
    }
</script>

<BaseWindow
    bind:isOpen
    windowId="cookie-manager-window"
    title="Cookie Manager"
    subtitle="{cookies.length} cookies"
    width="800px"
    height="600px"
    showCloseButton={true}
    showMaximizeButton={true}
    onClose={handleClose}
>
    {#snippet children()}
        <!-- Search -->
        <div class="mb-4">
            <div class="relative">
                <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                    type="text"
                    bind:value={searchQuery}
                    placeholder="Search cookies..."
                    class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
            </div>
        </div>

        <!-- Cookies List -->
        {#if isLoading}
            <div class="flex items-center justify-center py-12">
                <div class="text-gray-500">Loading cookies...</div>
            </div>
        {:else if filteredCookies.length === 0}
            <div class="flex flex-col items-center justify-center py-12 text-gray-500">
                <Cookie size={48} class="mb-4 text-gray-300" />
                <p>{searchQuery ? 'No cookies match your search' : 'No cookies found'}</p>
            </div>
        {:else}
            <div class="space-y-2 overflow-y-auto" style="max-height: 400px;">
                {#each filteredCookies as cookie}
                    <div class="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group">
                        <div class="flex items-start justify-between gap-3">
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2 mb-1">
                                    <Cookie size={14} class="text-gray-400 shrink-0" />
                                    <span class="font-medium text-gray-900 truncate">{cookie.name}</span>
                                </div>
                                <div class="text-xs text-gray-500 space-y-0.5">
                                    <div class="truncate">Domain: {cookie.domain}</div>
                                    <div class="truncate">Path: {cookie.path}</div>
                                    {#if cookie.expirationDate}
                                        <div>Expires: {new Date(cookie.expirationDate * 1000).toLocaleDateString()}</div>
                                    {/if}
                                </div>
                            </div>
                            <button
                                onclick={() => deleteCookie(cookie)}
                                class="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                                title="Delete cookie"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    {/snippet}

    {#snippet footerSlot()}
        <div class="flex justify-between items-center">
            <button
                onclick={clearAllCookies}
                class="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                disabled={cookies.length === 0}
            >
                Clear All Cookies
            </button>
            <button
                onclick={handleClose}
                class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors"
            >
                Close
            </button>
        </div>
    {/snippet}
</BaseWindow>
