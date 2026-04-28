<script>
    import { clickOutside } from "../lib/clickOutside.svelte.js";
    import { X, Plus, ChevronDown, Save, Trash2 } from "lucide-svelte";
    import { toastStore } from "../lib/toast.svelte.js";

    // Props
    let {
        isOpen = $bindable(false),
        partition = null
    } = $props();

    // State
    let cookies = $state([]);
    let isLoading = $state(false);
    let showAddForm = $state(false);
    let searchQuery = $state('');
    let expandedDomains = $state(new Set());
    let editingDomains = $state({}); // { domain: jsonString }
    let newCookieJson = $state('');

    // Filtered cookies based on search
    let filteredCookies = $derived(
        cookies.filter(cookie => {
            if (!searchQuery) return true;
            const query = searchQuery.toLowerCase();
            return (
                cookie.name.toLowerCase().includes(query) ||
                cookie.value.toLowerCase().includes(query) ||
                cookie.domain.toLowerCase().includes(query)
            );
        })
    );

    // Group cookies by domain for better readability
    let cookiesByDomain = $derived(() => {
        const grouped = {};
        filteredCookies.forEach(cookie => {
            const domain = cookie.domain;
            if (!grouped[domain]) {
                grouped[domain] = [];
            }
            grouped[domain].push(cookie);
        });
        return grouped;
    });

    // Load cookies when modal opens
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
            cookies = result || [];
        } catch (error) {
            console.error('Failed to load cookies:', error);
            toastStore.error('Gagal memuat cookies');
        } finally {
            isLoading = false;
        }
    }

    function toggleDomain(domain) {
        if (expandedDomains.has(domain)) {
            expandedDomains.delete(domain);
            expandedDomains = new Set(expandedDomains);
        } else {
            expandedDomains.add(domain);
            expandedDomains = new Set(expandedDomains);
            // Initialize editing state with current cookies
            if (!editingDomains[domain]) {
                const domainCookies = cookiesByDomain()[domain];
                editingDomains[domain] = JSON.stringify(domainCookies, null, 2);
            }
        }
    }

    async function updateDomainCookies(domain) {
        try {
            // Parse JSON
            const updatedCookies = JSON.parse(editingDomains[domain]);
            
            if (!Array.isArray(updatedCookies)) {
                toastStore.error('Format harus berupa array');
                return;
            }

            // Delete old cookies for this domain
            const oldCookies = cookiesByDomain()[domain];
            for (const cookie of oldCookies) {
                await window.api.db.deleteCookieFromPartition(partition, cookie.name, cookie.domain, cookie.path);
            }

            // Add new cookies
            for (const cookie of updatedCookies) {
                await window.api.db.setCookieToPartition(partition, cookie);
            }

            await loadCookies();
            toastStore.success(`Cookies untuk ${domain} diperbarui`);
            
            // Collapse domain after update
            expandedDomains.delete(domain);
            expandedDomains = new Set(expandedDomains);
        } catch (error) {
            console.error('Failed to update cookies:', error);
            toastStore.error('Gagal update cookies: ' + error.message);
        }
    }

    async function removeDomainCookies(domain) {
        if (!confirm(`Hapus semua cookies untuk domain "${domain}"?`)) return;

        try {
            const domainCookies = cookiesByDomain()[domain];
            
            // Delete all cookies for this domain
            for (const cookie of domainCookies) {
                await window.api.db.deleteCookieFromPartition(partition, cookie.name, cookie.domain, cookie.path);
            }

            await loadCookies();
            toastStore.success(`Cookies untuk ${domain} dihapus`);
            
            // Remove from expanded domains
            expandedDomains.delete(domain);
            expandedDomains = new Set(expandedDomains);
        } catch (error) {
            console.error('Failed to remove cookies:', error);
            toastStore.error('Gagal menghapus cookies: ' + error.message);
        }
    }

    async function addCookiesFromJson() {
        if (!newCookieJson.trim()) {
            toastStore.error('JSON tidak boleh kosong');
            return;
        }

        try {
            const newCookies = JSON.parse(newCookieJson);
            
            if (!Array.isArray(newCookies)) {
                toastStore.error('Format harus berupa array');
                return;
            }

            // Validate required fields
            for (const cookie of newCookies) {
                if (!cookie.name || !cookie.value || !cookie.domain) {
                    toastStore.error('Setiap cookie harus memiliki name, value, dan domain');
                    return;
                }
            }

            // Add cookies
            for (const cookie of newCookies) {
                await window.api.db.setCookieToPartition(partition, {
                    name: cookie.name,
                    value: cookie.value,
                    domain: cookie.domain,
                    path: cookie.path || '/',
                    expirationDate: cookie.expirationDate,
                    secure: cookie.secure || false,
                    httpOnly: cookie.httpOnly || false,
                    sameSite: cookie.sameSite || 'unspecified'
                });
            }

            await loadCookies();
            showAddForm = false;
            newCookieJson = '';
            toastStore.success(`${newCookies.length} cookies ditambahkan`);
        } catch (error) {
            console.error('Failed to add cookies:', error);
            toastStore.error('Gagal menambahkan cookies: ' + error.message);
        }
    }

    function handleClose() {
        isOpen = false;
        showAddForm = false;
        searchQuery = '';
        expandedDomains = new Set();
        editingDomains = {};
        newCookieJson = '';
    }

    function copyAllCookiesAsJson() {
        const cookiesJson = JSON.stringify(filteredCookies, null, 2);
        navigator.clipboard.writeText(cookiesJson);
        toastStore.success('Cookies disalin ke clipboard');
    }

</script>

{#if isOpen}
    <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-[300] flex items-center justify-center">
        <div
            use:clickOutside={{ 
                onClickOutside: handleClose,
                includeEscape: true
            }}
            class="bg-white rounded-2xl shadow-2xl border border-gray-200 w-[90vw] max-w-5xl max-h-[85vh] flex flex-col"
            onclick={(e) => e.stopPropagation()}
        >
            <!-- Header -->
            <div class="flex items-center justify-between p-6 border-b border-gray-200">
                <div>
                    <h3 class="font-bold text-lg text-gray-900">Cookie Manager</h3>
                    <p class="text-xs text-gray-500 mt-1">Kelola cookies untuk profil ini</p>
                </div>
                <div class="flex items-center gap-2">
                    <button
                        type="button"
                        onclick={copyAllCookiesAsJson}
                        class="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm"
                        title="Copy all as JSON"
                    >
                        Copy JSON
                    </button>
                    <button
                        type="button"
                        onclick={() => showAddForm = !showAddForm}
                        class="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center gap-2 text-sm"
                    >
                        <Plus size={16} />
                        Add Cookies
                    </button>
                    <button
                        type="button"
                        onclick={handleClose}
                        class="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X size={18} class="text-gray-600" />
                    </button>
                </div>
            </div>

            <!-- Search Bar -->
            <div class="px-6 pt-4 pb-2 border-b border-gray-200">
                <input
                    type="text"
                    bind:value={searchQuery}
                    placeholder="Search cookies by name, value, or domain..."
                    class="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                />
            </div>

            <!-- Content -->
            <div class="flex-1 overflow-y-auto p-6">
                {#if isLoading}
                    <div class="text-center py-12 text-gray-500">
                        Loading cookies...
                    </div>
                {:else if showAddForm}
                    <!-- Add Cookies Form - JSON Input -->
                    <div class="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-200">
                        <h4 class="font-medium text-sm text-gray-900 mb-3">Add Cookies (JSON Format)</h4>
                        <textarea
                            bind:value={newCookieJson}
                            placeholder={`[\n  {\n    "name": "session",\n    "value": "abc123",\n    "domain": ".example.com",\n    "path": "/",\n    "secure": true,\n    "httpOnly": true\n  }\n]`}
                            rows="12"
                            class="w-full px-3 py-2 bg-gray-900 text-green-400 border border-gray-700 rounded-lg text-xs font-mono focus:outline-none focus:border-blue-500 resize-none"
                        ></textarea>
                        <div class="flex items-center gap-2 mt-3">
                            <button
                                type="button"
                                onclick={addCookiesFromJson}
                                class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm transition-colors"
                            >
                                Add Cookies
                            </button>
                            <button
                                type="button"
                                onclick={() => {
                                    showAddForm = false;
                                    newCookieJson = '';
                                }}
                                class="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                {/if}

                {#if Object.keys(cookiesByDomain()).length === 0 && !showAddForm}
                    <div class="text-center py-12 text-gray-500">
                        {searchQuery ? 'No cookies match your search' : 'No cookies found'}
                    </div>
                {:else}
                    <!-- Domain Accordions -->
                    <div class="space-y-3">
                        {#each Object.entries(cookiesByDomain()) as [domain, domainCookies]}
                            <div class="border border-gray-200 rounded-xl overflow-hidden">
                                <!-- Domain Header -->
                                <div class="px-4 py-3 bg-gray-50 flex items-center justify-between">
                                    <button
                                        type="button"
                                        onclick={() => toggleDomain(domain)}
                                        class="flex-1 flex items-center gap-3 hover:opacity-80 transition-opacity"
                                    >
                                        <ChevronDown 
                                            size={18} 
                                            class="text-gray-500 transition-transform {expandedDomains.has(domain) ? 'rotate-180' : ''}"
                                        />
                                        <div class="text-left">
                                            <h4 class="text-sm font-semibold text-gray-900">{domain}</h4>
                                            <p class="text-xs text-gray-500">{domainCookies.length} cookie{domainCookies.length > 1 ? 's' : ''}</p>
                                        </div>
                                    </button>
                                    <button
                                        type="button"
                                        onclick={(e) => {
                                            e.stopPropagation();
                                            removeDomainCookies(domain);
                                        }}
                                        class="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Remove all cookies for this domain"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                                <!-- Domain Content (Editable JSON) -->
                                {#if expandedDomains.has(domain)}
                                    <div class="p-4 bg-white border-t border-gray-200">
                                        <textarea
                                            bind:value={editingDomains[domain]}
                                            rows="15"
                                            class="w-full px-3 py-2 bg-gray-900 text-green-400 border border-gray-700 rounded-lg text-xs font-mono focus:outline-none focus:border-blue-500 resize-none"
                                        ></textarea>
                                        <div class="flex items-center gap-2 mt-3">
                                            <button
                                                type="button"
                                                onclick={() => updateDomainCookies(domain)}
                                                class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm transition-colors flex items-center gap-2"
                                            >
                                                <Save size={16} />
                                                Update Cookies
                                            </button>
                                            <button
                                                type="button"
                                                onclick={() => {
                                                    expandedDomains.delete(domain);
                                                    expandedDomains = new Set(expandedDomains);
                                                }}
                                                class="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                {/if}
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
        </div>
    </div>
{/if}
