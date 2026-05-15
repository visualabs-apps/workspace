<script>
    import ChildWindowControls from "../components/layout/ChildWindowControls.svelte";
    import { Cookie, Trash2, ChevronDown, ChevronRight, Plus, Save, RefreshCw, Search } from "lucide-svelte";
    import { toastStore } from "../lib/managers/toast.svelte.js";

    const WINDOW_ID = 'cookie-manager-window';

    let partition = $state('');
    let isOpen = $state(false);

    // Receive data from parent window via IPC
    $effect(() => {
        const handleWindowData = (data) => {
            console.log('[CookieManager] Received data:', data);
            if (data.partition) partition = data.partition;
            isOpen = true;
        };

        if (window.api?.onWindowData) {
            window.api.onWindowData(handleWindowData);
        }
    });

    let cookies = $state([]);
    let isLoading = $state(false);
    let searchQuery = $state("");
    let expandedDomains = $state(new Set());
    let expandedCookies = $state(new Set());
    let editingCookie = $state(null);
    let editingJson = $state("");
    let showImportModal = $state(false);
    let importJson = $state("");
    let isEncryptedImport = $state(false);
    let importPassword = $state("");
    let isImporting = $state(false);

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

    // Detect if JSON is Cookie-Editor encrypted format
    function detectEncryptedFormat(parsed) {
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            && parsed.url && parsed.version && parsed.data && typeof parsed.data === 'string';
    }

    async function importCookie() {
        if (isImporting) return;
        isImporting = true;
        
        try {
            const parsedData = JSON.parse(importJson);
            let cookiesToImport;
            
            // Check if it's Cookie-Editor encrypted format: {url, version, data}
            if (detectEncryptedFormat(parsedData)) {
                if (!importPassword.trim()) {
                    toastStore.error('Password is required to decrypt this cookie export');
                    isImporting = false;
                    return;
                }
                
                try {
                    const result = await window.api.db.decryptCookieExport(parsedData.data, importPassword);
                    if (!result.success) {
                        toastStore.error(result.error || 'Decryption failed');
                        isImporting = false;
                        return;
                    }
                    cookiesToImport = Array.isArray(result.cookies) ? result.cookies : [result.cookies];
                } catch (error) {
                    console.error('Decryption error:', error);
                    toastStore.error('Failed to decrypt: wrong password or corrupted data');
                    isImporting = false;
                    return;
                }
            } else {
                // Plain cookie array or single cookie
                cookiesToImport = Array.isArray(parsedData) ? parsedData : [parsedData];
            }
            
            let successCount = 0;
            let failCount = 0;
            
            for (const newCookie of cookiesToImport) {
                // Validate required fields
                if (!newCookie.name || !newCookie.domain) {
                    console.warn('⚠️ Skipping invalid cookie:', newCookie.name || 'unnamed');
                    failCount++;
                    continue;
                }
                
                // Ensure value exists (can be empty string)
                if (newCookie.value === undefined || newCookie.value === null) {
                    newCookie.value = '';
                }
                
                try {
                    const result = await window.api.db.setCookieToPartition(partition, newCookie);
                    if (result && result.success) {
                        successCount++;
                    } else {
                        console.error('Failed to import cookie:', newCookie.name, result?.error);
                        failCount++;
                    }
                } catch (error) {
                    console.error('Error importing cookie:', newCookie.name, error);
                    failCount++;
                }
            }
            
            // Show result
            if (successCount > 0) {
                toastStore.success(`${successCount} cookie(s) imported successfully`);
                showImportModal = false;
                importJson = "";
                importPassword = "";
                isEncryptedImport = false;
                await loadCookies();
            }
            
            if (failCount > 0) {
                toastStore.warning(`${failCount} cookie(s) failed to import`);
            }
            
            if (successCount === 0 && failCount === 0) {
                toastStore.error('No valid cookies found');
            }
        } catch (error) {
            console.error('Import cookie error:', error);
            toastStore.error('Invalid JSON format');
        } finally {
            isImporting = false;
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

<div class="w-full h-screen flex flex-col bg-white">
    <!-- Custom Title Bar -->
    <div class="h-10 bg-gray-50 border-b border-gray-200 flex items-center justify-between px-4" style="-webkit-app-region: drag">
        <div class="flex items-center gap-2">
            <Cookie size={16} class="text-blue-600" />
            <span class="text-sm font-medium text-gray-700">Cookie Manager</span>
        </div>
        <div style="-webkit-app-region: no-drag">
            <ChildWindowControls variant="light" windowId={WINDOW_ID} />
        </div>
    </div>
    
    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-6">
        <div class="flex flex-col h-full">
            <!-- Search Bar -->
            <div class="mb-3">
                <div class="relative">
                    <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        bind:value={searchQuery}
                        placeholder="Search cookies by name, domain, or value..."
                        class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
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
                                                                    class="w-full h-48 p-2 text-xs font-mono bg-gray-50 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
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
                        <p class="text-sm text-gray-500 mt-1">
                            {#if isEncryptedImport}
                                🔒 Cookie-Editor encrypted format detected — enter password to decrypt
                            {:else}
                                Paste cookie JSON below (plain array or Cookie-Editor format)
                            {/if}
                        </p>
                    </div>
                    <div class="p-6 space-y-4">
                        <textarea
                            bind:value={importJson}
                            oninput={() => {
                                try {
                                    const parsed = JSON.parse(importJson);
                                    isEncryptedImport = detectEncryptedFormat(parsed);
                                } catch {
                                    isEncryptedImport = false;
                                }
                            }}
                            class="w-full h-48 p-3 text-sm font-mono bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                            placeholder={`Paste cookie JSON here...\n\nSupported formats:\n• Array: [{name, value, domain, ...}, ...]\n• Cookie-Editor encrypted: {url, version, data}\n• Single cookie: {name, value, domain, ...}`}
                        ></textarea>
                        {#if isEncryptedImport}
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Decryption Password</label>
                                <input
                                    type="password"
                                    bind:value={importPassword}
                                    class="w-full p-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                                    placeholder="Enter password used when exporting cookies"
                                    onkeydown={(e) => { if (e.key === 'Enter') importCookie(); }}
                                />
                            </div>
                        {/if}
                    </div>
                    <div class="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-2">
                        <button
                            onclick={() => { showImportModal = false; importJson = ""; importPassword = ""; isEncryptedImport = false; }}
                            class="px-4 py-2 text-sm border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onclick={importCookie}
                            disabled={isImporting || (isEncryptedImport && !importPassword.trim())}
                            class="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isImporting ? 'Importing...' : isEncryptedImport ? 'Decrypt & Import' : 'Import'}
                        </button>
                    </div>
                </div>
            </div>
        {/if}
    </div>

    <!-- Footer -->
    <div class="border-t border-gray-200 px-6 py-4 bg-gray-50">
        <div class="flex justify-end items-center">
            <button
                onclick={() => window.api.close()}
                class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors"
            >
                Close
            </button>
        </div>
    </div>
</div>
