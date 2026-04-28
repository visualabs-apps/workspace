<script>
    import BaseWindow from "../base/BaseWindow.svelte";
    import { Cookie, Trash2, ChevronDown, ChevronRight, Plus, Save, RefreshCw, Search } from "lucide-svelte";
    import { toastStore } from "../../lib/managers/toast.svelte.js";

    let { isOpen = $bindable(false), partition = null } = $props();

    let cookies = $state([]);
    let isLoading = $state(false);
    let searchQuery = $state("");
    let expandedDomains = $state(new Set());
    let expandedCookies = $state(new Set());
    let editingCookie = $state(null);
    let editingJson = $state("");
    let showImportModal = $state(false);
    let importJson = $state("");

    // Filter cookies by search
    let filteredCookies = $derived(() => {
        if (!searchQuery.trim()) return cookies;
        const query = searchQuery.toLowerCase();
        return cookies.filter(cookie => 
            cookie.name.toLowerCase().includes(query) ||
            cookie.domain.toLowerCase().includes(query) ||
            cookie.value.toLowerCase().includes(query)
        );
    });

    // Group filtered cookies by domain
    let cookiesByDomain = $derived(() => {
        const grouped = {};
        filteredCookies().forEach(cookie => {
            const domain = cookie.domain;
            if (!grouped[domain]) {
                grouped[domain] = [];
            }
            grouped[domain].push(cookie);
        });
        return grouped;
    });

    let domains = $derived(Object.keys(cookiesByDomain()).sort());

    $effect(() => {
        if (isOpen && partition) {
            loadCookies();
        }
    });

    async function loadCookies() {
        if (!partition) return;
        
        isLoading = true;
        try {
            const result = await window.api.db.getCookiesFromPartition(partition);
            if (Array.isArray(result)) {
                cookies = result;
            } else {
                console.error('Unexpected cookies format:', result);
                cookies = [];
            }
        } catch (error) {
            console.error('Load cookies error:', error);
            cookies = [];
        } finally {
            isLoading = false;
        }
    }

    function toggleDomain(domain) {
        if (expandedDomains.has(domain)) {
            expandedDomains.delete(domain);
        } else {
            expandedDomains.add(domain);
        }
        expandedDomains = new Set(expandedDomains);
    }

    function toggleCookie(cookieId) {
        if (expandedCookies.has(cookieId)) {
            expandedCookies.delete(cookieId);
        } else {
            expandedCookies.add(cookieId);
        }
        expandedCookies = new Set(expandedCookies);
    }

    function getCookieId(cookie) {
        return `${cookie.domain}-${cookie.name}-${cookie.path}`;
    }

    function startEditCookie(cookie) {
        editingCookie = cookie;
        editingJson = JSON.stringify(cookie, null, 2);
    }

    function cancelEdit() {
        editingCookie = null;
        editingJson = "";
    }

    async function updateCookie() {
        try {
            const updatedCookie = JSON.parse(editingJson);
            
            // Validate required fields
            if (!updatedCookie.name || !updatedCookie.value || !updatedCookie.domain) {
                toastStore.error('Cookie must have name, value, and domain');
                return;
            }

            // Delete old cookie first
            await window.api.db.deleteCookieFromPartition(
                partition, 
                editingCookie.name, 
                editingCookie.domain, 
                editingCookie.path
            );

            // Set new cookie
            const result = await window.api.db.setCookieToPartition(partition, updatedCookie);
            if (result && result.success) {
                toastStore.success('Cookie updated');
                cancelEdit();
                await loadCookies();
            } else {
                toastStore.error('Failed to update cookie');
            }
        } catch (error) {
            console.error('Update cookie error:', error);
            toastStore.error('Invalid JSON or update failed');
        }
    }

    async function deleteCookie(cookie) {
        if (!confirm(`Delete cookie "${cookie.name}"?`)) return;

        try {
            const result = await window.api.db.deleteCookieFromPartition(
                partition, 
                cookie.name, 
                cookie.domain, 
                cookie.path
            );
            if (result && result.success) {
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

    async function importCookie() {
        try {
            const newCookie = JSON.parse(importJson);
            
            // Validate required fields
            if (!newCookie.name || !newCookie.value || !newCookie.domain) {
                toastStore.error('Cookie must have name, value, and domain');
                return;
            }

            const result = await window.api.db.setCookieToPartition(partition, newCookie);
            if (result && result.success) {
                toastStore.success('Cookie imported');
                showImportModal = false;
                importJson = "";
                await loadCookies();
            } else {
                toastStore.error('Failed to import cookie');
            }
        } catch (error) {
            console.error('Import cookie error:', error);
            toastStore.error('Invalid JSON or import failed');
        }
    }

    function handleClose() {
        isOpen = false;
        searchQuery = "";
        expandedDomains.clear();
        expandedCookies.clear();
        cancelEdit();
        showImportModal = false;
        importJson = "";
    }
</script>

<BaseWindow
    bind:isOpen
    windowId="cookie-manager-window"
    title="Cookie Manager"
    subtitle="{cookies.length} cookies in {domains.length} domains"
    width="900px"
    height="700px"
    showCloseButton={true}
    showMaximizeButton={true}
    onClose={handleClose}
>
    {#snippet children()}
        <div class="flex flex-col h-full">
            <!-- Search Bar -->
            <div class="mb-3">
                <div class="relative">
                    <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        bind:value={searchQuery}
                        placeholder="Search cookies by name, domain, or value..."
                        class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>
            </div>

            <!-- Header Actions -->
            <div class="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
                <div class="flex items-center gap-2">
                    <Cookie size={18} class="text-blue-600" />
                    <span class="text-sm font-medium text-gray-700">
                        {domains.length} Domain{domains.length !== 1 ? 's' : ''} • {filteredCookies().length} Cookie{filteredCookies().length !== 1 ? 's' : ''}
                    </span>
                </div>
                <div class="flex items-center gap-2">
                    <button
                        onclick={() => showImportModal = true}
                        class="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
                    >
                        <Plus size={14} />
                        Import Cookie
                    </button>
                    <button
                        onclick={loadCookies}
                        disabled={isLoading}
                        class="px-3 py-1.5 text-sm border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        <RefreshCw size={14} class={isLoading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>
            </div>

            <!-- Cookies List -->
            <div class="flex-1 overflow-y-auto">
                {#if isLoading}
                    <div class="flex items-center justify-center py-12">
                        <div class="text-gray-500">Loading cookies...</div>
                    </div>
                {:else if domains.length === 0}
                    <div class="flex flex-col items-center justify-center py-12 text-gray-500">
                        <Cookie size={48} class="mb-4 text-gray-300" />
                        <p>{searchQuery ? 'No cookies match your search' : 'No cookies found'}</p>
                    </div>
                {:else}
                    <div class="space-y-2">
                        {#each domains as domain}
                            {@const domainCookies = cookiesByDomain()[domain]}
                            {@const isExpanded = expandedDomains.has(domain)}
                            
                            <div class="border border-gray-200 rounded-lg overflow-hidden">
                                <!-- Domain Header -->
                                <button
                                    onclick={() => toggleDomain(domain)}
                                    class="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition-colors"
                                >
                                    <div class="flex items-center gap-2">
                                        <svelte:component 
                                            this={isExpanded ? ChevronDown : ChevronRight} 
                                            size={16} 
                                            class="text-gray-600"
                                        />
                                        <Cookie size={16} class="text-gray-600" />
                                        <span class="font-medium text-gray-900">{domain}</span>
                                        <span class="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">
                                            {domainCookies.length}
                                        </span>
                                    </div>
                                </button>

                                <!-- Domain Cookies -->
                                {#if isExpanded}
                                    <div class="bg-white">
                                        {#each domainCookies as cookie}
                                            {@const cookieId = getCookieId(cookie)}
                                            {@const isCookieExpanded = expandedCookies.has(cookieId)}
                                            
                                            <div class="border-b border-gray-100 last:border-b-0">
                                                <!-- Cookie Name Header -->
                                                <div class="flex items-center justify-between p-3 hover:bg-gray-50 transition-colors">
                                                    <button
                                                        onclick={() => toggleCookie(cookieId)}
                                                        class="flex-1 flex items-center gap-2 text-left"
                                                    >
                                                        <svelte:component 
                                                            this={isCookieExpanded ? ChevronDown : ChevronRight} 
                                                            size={14} 
                                                            class="text-gray-500"
                                                        />
                                                        <div class="flex-1">
                                                            <div class="font-medium text-gray-900 text-sm">{cookie.name}</div>
                                                            <div class="text-xs text-gray-500">
                                                                Path: {cookie.path}
                                                                {#if cookie.expirationDate}
                                                                    • Expires: {new Date(cookie.expirationDate * 1000).toLocaleDateString()}
                                                                {/if}
                                                            </div>
                                                        </div>
                                                    </button>
                                                    <button
                                                        onclick={() => deleteCookie(cookie)}
                                                        class="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>

                                                <!-- JSON View/Edit Accordion -->
                                                {#if isCookieExpanded}
                                                    <div class="px-3 pb-3 bg-gray-50">
                                                        {#if editingCookie === cookie}
                                                            <!-- Edit Mode -->
                                                            <div class="p-3 bg-white rounded-lg border border-gray-200">
                                                                <textarea
                                                                    bind:value={editingJson}
                                                                    class="w-full h-48 p-2 text-xs font-mono bg-gray-50 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                                    placeholder="Edit cookie JSON..."
                                                                ></textarea>
                                                                <div class="flex items-center gap-2 mt-2">
                                                                    <button
                                                                        onclick={updateCookie}
                                                                        class="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                                                                    >
                                                                        Update
                                                                    </button>
                                                                    <button
                                                                        onclick={cancelEdit}
                                                                        class="px-3 py-1.5 text-sm border border-gray-300 hover:bg-gray-50 text-gray-700 rounded transition-colors"
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        {:else}
                                                            <!-- View Mode -->
                                                            <div class="p-3 bg-white rounded-lg border border-gray-200">
                                                                <pre class="text-xs font-mono text-gray-700 whitespace-pre-wrap overflow-x-auto">{JSON.stringify(cookie, null, 2)}</pre>
                                                                <div class="flex items-center gap-2 mt-2">
                                                                    <button
                                                                        onclick={() => startEditCookie(cookie)}
                                                                        class="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors flex items-center gap-1"
                                                                    >
                                                                        <Save size={12} />
                                                                        Edit JSON
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        {/if}
                                                    </div>
                                                {/if}
                                            </div>
                                        {/each}
                                    </div>
                                {/if}
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
        </div>

        <!-- Import Modal -->
        {#if showImportModal}
            <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onclick={() => showImportModal = false}>
                <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4" onclick={(e) => e.stopPropagation()}>
                    <div class="px-6 py-4 border-b border-gray-200">
                        <h3 class="text-lg font-semibold text-gray-900">Import Cookie</h3>
                        <p class="text-sm text-gray-500 mt-1">Paste cookie JSON below</p>
                    </div>
                    <div class="p-6">
                        <textarea
                            bind:value={importJson}
                            class="w-full h-64 p-3 text-sm font-mono bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder={`{\n  "name": "cookie_name",\n  "value": "cookie_value",\n  "domain": ".example.com",\n  "path": "/",\n  "secure": true,\n  "httpOnly": false\n}`}
                        ></textarea>
                    </div>
                    <div class="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-2">
                        <button
                            onclick={() => { showImportModal = false; importJson = ""; }}
                            class="px-4 py-2 text-sm border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onclick={importCookie}
                            class="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                        >
                            Import
                        </button>
                    </div>
                </div>
            </div>
        {/if}
    {/snippet}

    {#snippet footerSlot()}
        <div class="flex justify-end items-center">
            <button
                onclick={handleClose}
                class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors"
            >
                Close
            </button>
        </div>
    {/snippet}
</BaseWindow>
