<script>
    import ChildWindowControls from "../components/layout/ChildWindowControls.svelte";
    import { Cookie, Trash2, ChevronDown, ChevronRight, Plus, Save, RefreshCw, Search, Cloud, CloudOff, CircleCheck, Edit3 } from "lucide-svelte";
    import { toastStore } from "../lib/managers/toast.svelte.js";
    import { getChromeProfile, updateChromeProfile } from "../lib/api/api.js";

    const WINDOW_ID = 'cookie-manager-window';

    let partition = $state('');
    let profileId = $state(null);
    let isOpen = $state(false);

    // Receive data from parent window via IPC
    $effect(() => {
        const handleWindowData = (data) => {
            console.log('[CookieManager] Received data:', data);
            if (data.partition) partition = data.partition;
            if (data.profileId) profileId = data.profileId;
            isOpen = true;
        };

        if (window.api?.onWindowData) {
            window.api.onWindowData(handleWindowData);
        }
    });

    // All cookies come from backend
    let cookies = $state([]);
    let isLoading = $state(false);
    let searchQuery = $state("");
    let expandedDomains = $state(new Set());
    let expandedCookies = $state(new Set());
    let editingCookieIndex = $state(null); // Index in cookies array
    let editingJson = $state("");
    let showImportModal = $state(false);
    let importJson = $state("");
    let isEncryptedImport = $state(false);
    let importPassword = $state("");
    let isImporting = $state(false);
    let isDragOver = $state(false);
    let showAddModal = $state(false);
    let newCookieJson = $state('');

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
        if (isOpen && profileId) {
            loadCookiesFromServer();
        }
    });

    /**
     * Load cookies from backend server (source of truth)
     */
    async function loadCookiesFromServer() {
        if (!profileId) {
            cookies = [];
            return;
        }

        isLoading = true;
        try {
            const response = await getChromeProfile(profileId);
            if (response.success && response.data) {
                const serverCookies = response.data.cookies;
                cookies = Array.isArray(serverCookies) ? serverCookies : [];
            } else {
                console.error('[CookieManager] Failed to load from server:', response.error);
                cookies = [];
            }
        } catch (error) {
            console.error('[CookieManager] Load error:', error);
            cookies = [];
        } finally {
            isLoading = false;
        }
    }

    /**
     * Save entire cookies array to backend server
     */
    async function saveCookiesToServer(updatedCookies) {
        if (!profileId) {
            toastStore.error('No profile ID — cannot save to server');
            return false;
        }

        try {
            const result = await updateChromeProfile(profileId, {
                cookies: updatedCookies,
            });

            if (result.success) {
                cookies = updatedCookies;
                return true;
            } else {
                toastStore.error(result.error || 'Failed to save cookies to server');
                return false;
            }
        } catch (error) {
            console.error('[CookieManager] Save to server error:', error);
            toastStore.error('Failed to save cookies to server');
            return false;
        }
    }

    /**
     * Apply cookies to local Electron session (so webview can use them)
     */
    async function applyCookiesToLocalSession() {
        if (!partition || cookies.length === 0) return;

        try {
            for (const cookie of cookies) {
                if (!cookie.name || !cookie.domain) continue;
                if (cookie.value === undefined || cookie.value === null) cookie.value = '';
                try {
                    await window.api.db.setCookieToPartition(partition, cookie);
                } catch (err) {
                    console.warn('[CookieManager] Failed to apply cookie:', cookie.name, err);
                }
            }
            console.log(`[CookieManager] Applied ${cookies.length} cookies to local session`);
        } catch (error) {
            console.error('[CookieManager] Apply to local session error:', error);
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

    function findCookieIndex(cookie) {
        return cookies.findIndex(c =>
            c.name === cookie.name &&
            c.domain === cookie.domain &&
            c.path === cookie.path
        );
    }

    function startEditCookie(cookie) {
        const idx = findCookieIndex(cookie);
        if (idx === -1) return;
        editingCookieIndex = idx;
        editingJson = JSON.stringify(cookie, null, 2);
    }

    function cancelEdit() {
        editingCookieIndex = null;
        editingJson = "";
    }

    /**
     * Update a single cookie on the backend
     */
    async function updateCookie() {
        try {
            const updatedCookie = JSON.parse(editingJson);

            // Validate required fields
            if (!updatedCookie.name || !updatedCookie.value === undefined || !updatedCookie.domain) {
                toastStore.error('Cookie must have name, value, and domain');
                return;
            }

            // Ensure defaults
            if (!updatedCookie.path) updatedCookie.path = '/';
            if (updatedCookie.secure === undefined) updatedCookie.secure = false;
            if (updatedCookie.httpOnly === undefined) updatedCookie.httpOnly = false;

            // Replace the old cookie in the array
            const updatedCookies = [...cookies];
            if (editingCookieIndex !== null && editingCookieIndex >= 0 && editingCookieIndex < updatedCookies.length) {
                updatedCookies[editingCookieIndex] = updatedCookie;
            }

            const success = await saveCookiesToServer(updatedCookies);
            if (success) {
                toastStore.success('Cookie updated on server');
                cancelEdit();
            }
        } catch (error) {
            console.error('Update cookie error:', error);
            toastStore.error('Invalid JSON or update failed');
        }
    }

    /**
     * Delete a single cookie from the backend
     */
    async function deleteCookie(cookie) {
        if (!confirm(`Delete cookie "${cookie.name}"?`)) return;

        const idx = findCookieIndex(cookie);
        if (idx === -1) {
            toastStore.error('Cookie not found');
            return;
        }

        const updatedCookies = cookies.filter((_, i) => i !== idx);
        const success = await saveCookiesToServer(updatedCookies);
        if (success) {
            toastStore.success('Cookie deleted from server');
        }
    }

    /**
     * Add a new cookie
     */
    async function addNewCookie() {
        try {
            let newCookie;
            if (newCookieJson.trim()) {
                newCookie = JSON.parse(newCookieJson);
            } else {
                // Create a minimal empty cookie
                newCookie = {
                    name: 'new_cookie',
                    value: '',
                    domain: '.example.com',
                    path: '/',
                    secure: false,
                    httpOnly: false,
                };
            }

            // Validate
            if (!newCookie.name || !newCookie.domain) {
                toastStore.error('Cookie must have at least name and domain');
                return;
            }

            // Ensure defaults
            if (newCookie.value === undefined || newCookie.value === null) newCookie.value = '';
            if (!newCookie.path) newCookie.path = '/';
            if (newCookie.secure === undefined) newCookie.secure = false;
            if (newCookie.httpOnly === undefined) newCookie.httpOnly = false;

            const updatedCookies = [...cookies, newCookie];
            const success = await saveCookiesToServer(updatedCookies);
            if (success) {
                toastStore.success('Cookie added to server');
                showAddModal = false;
                newCookieJson = '';
            }
        } catch (error) {
            console.error('Add cookie error:', error);
            toastStore.error('Invalid JSON or add failed');
        }
    }

    // Detect if JSON is Cookie-Editor encrypted format
    function detectEncryptedFormat(parsed) {
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            && parsed.url && parsed.version && parsed.data && typeof parsed.data === 'string';
    }

    /**
     * Import cookies — merge into backend cookies array
     */
    async function importCookie() {
        if (isImporting) return;
        isImporting = true;

        try {
            const parsedData = JSON.parse(importJson);
            let cookiesToImport;

            // Check if it's Cookie-Editor encrypted format
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
                cookiesToImport = Array.isArray(parsedData) ? parsedData : [parsedData];
            }

            // Validate and normalize
            const validCookies = [];
            for (const c of cookiesToImport) {
                if (!c.name || !c.domain) {
                    console.warn('⚠️ Skipping invalid cookie:', c.name || 'unnamed');
                    continue;
                }
                if (c.value === undefined || c.value === null) c.value = '';
                if (!c.path) c.path = '/';
                if (c.secure === undefined) c.secure = false;
                if (c.httpOnly === undefined) c.httpOnly = false;
                validCookies.push(c);
            }

            if (validCookies.length === 0) {
                toastStore.error('No valid cookies found');
                isImporting = false;
                return;
            }

            // Merge: replace existing cookies with same name+domain+path, add new ones
            const mergedCookies = [...cookies];
            for (const newCookie of validCookies) {
                const existingIdx = mergedCookies.findIndex(c =>
                    c.name === newCookie.name &&
                    c.domain === newCookie.domain &&
                    c.path === newCookie.path
                );
                if (existingIdx !== -1) {
                    mergedCookies[existingIdx] = newCookie; // Replace
                } else {
                    mergedCookies.push(newCookie); // Add
                }
            }

            const success = await saveCookiesToServer(mergedCookies);
            if (success) {
                toastStore.success(`✅ ${validCookies.length} cookie(s) imported to server`);
                showImportModal = false;
                importJson = "";
                importPassword = "";
                isEncryptedImport = false;
            }
        } catch (error) {
            console.error('Import cookie error:', error);
            toastStore.error('Invalid JSON format');
        } finally {
            isImporting = false;
        }
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        isDragOver = true;
    }

    function handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        isDragOver = false;
    }

    function handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        isDragOver = false;

        const files = e.dataTransfer?.files;
        if (!files || files.length === 0) return;

        const file = files[0];
        if (!file.name.endsWith('.json') && file.type !== 'application/json') {
            toastStore.error('Please drop a .json file');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target.result;
            importJson = content;
            try {
                const parsed = JSON.parse(content);
                isEncryptedImport = detectEncryptedFormat(parsed);
            } catch {
                isEncryptedImport = false;
            }
            toastStore.success(`File loaded: ${file.name}`);
        };
        reader.onerror = () => toastStore.error('Failed to read file');
        reader.readAsText(file);
    }

    function handleFileSelect(e) {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target.result;
            importJson = content;
            try {
                const parsed = JSON.parse(content);
                isEncryptedImport = detectEncryptedFormat(parsed);
            } catch {
                isEncryptedImport = false;
            }
            toastStore.success(`File loaded: ${file.name}`);
        };
        reader.readAsText(file);
        e.target.value = '';
    }

    function handleClose() {
        isOpen = false;
        searchQuery = "";
        expandedDomains.clear();
        expandedCookies.clear();
        cancelEdit();
        showImportModal = false;
        importJson = "";
        showAddModal = false;
        newCookieJson = '';
    }
</script>

<div class="w-full h-screen flex flex-col bg-white">
    <!-- Custom Title Bar -->
    <div class="h-10 bg-gray-50 border-b border-gray-200 flex items-center justify-between px-4" style="-webkit-app-region: drag">
        <div class="flex items-center gap-2">
            <Cookie size={16} class="text-blue-600" />
            <span class="text-sm font-medium text-gray-700">Cookie Manager</span>
            {#if profileId}
                <span class="text-xs text-gray-400">•</span>
                <Cloud size={14} class="text-green-500" />
                <span class="text-xs text-gray-500">Server: {cookies.length} cookies</span>
            {/if}
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
                    <Cloud size={18} class="text-blue-600" />
                    <span class="text-sm font-medium text-gray-700">
                        {domains.length} Domain{domains.length !== 1 ? 's' : ''} • {filteredCookies().length} Cookie{filteredCookies().length !== 1 ? 's' : ''}
                    </span>
                    <span class="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">Server</span>
                </div>
                <div class="flex items-center gap-2">
                    <button
                        onclick={() => { showAddModal = true; newCookieJson = ''; }}
                        class="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2"
                    >
                        <Plus size={14} />
                        New Cookie
                    </button>
                    <button
                        onclick={() => showImportModal = true}
                        class="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
                    >
                        <Plus size={14} />
                        Import
                    </button>
                    <button
                        onclick={loadCookiesFromServer}
                        disabled={isLoading}
                        class="px-3 py-1.5 text-sm border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        <RefreshCw size={14} class={isLoading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>
            </div>

            <!-- Backend status banner -->
            {#if !profileId}
                <div class="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                    <CloudOff size={14} />
                    <span>No profile linked — open cookie manager from a profile to enable server sync.</span>
                </div>
            {:else}
                <div class="mb-3 p-2.5 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700 flex items-center gap-2">
                    <CircleCheck size={14} />
                    <span>Connected to server — all changes are saved directly to backend (Profile #{profileId})</span>
                </div>
            {/if}

            <!-- Cookies List -->
            <div class="flex-1 overflow-y-auto">
                {#if isLoading}
                    <div class="flex items-center justify-center py-12">
                        <div class="flex items-center gap-2 text-gray-500">
                            <RefreshCw size={18} class="animate-spin" />
                            <span>Loading cookies from server...</span>
                        </div>
                    </div>
                {:else if !profileId}
                    <div class="flex flex-col items-center justify-center py-12 text-gray-500">
                        <CloudOff size={48} class="mb-4 text-gray-300" />
                        <p>No profile selected</p>
                    </div>
                {:else if domains.length === 0}
                    <div class="flex flex-col items-center justify-center py-12 text-gray-500">
                        <Cookie size={48} class="mb-4 text-gray-300" />
                        <p>{searchQuery ? 'No cookies match your search' : 'No cookies on server yet'}</p>
                        <p class="text-xs mt-1">Click "New Cookie" or "Import" to add cookies</p>
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
                                            {@const cookieIdx = findCookieIndex(cookie)}

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
                                                                Path: {cookie.path || '/'}
                                                                {#if cookie.expirationDate}
                                                                    • Expires: {new Date(cookie.expirationDate * 1000).toLocaleDateString()}
                                                                {/if}
                                                                {#if cookie.secure}
                                                                    • 🔒 Secure
                                                                {/if}
                                                                {#if cookie.httpOnly}
                                                                    • 🛡 HttpOnly
                                                                {/if}
                                                            </div>
                                                        </div>
                                                    </button>
                                                    <button
                                                        onclick={() => startEditCookie(cookie)}
                                                        class="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
                                                        title="Edit"
                                                    >
                                                        <Edit3 size={14} />
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
                                                        {#if editingCookieIndex === cookieIdx}
                                                            <!-- Edit Mode -->
                                                            <div class="p-3 bg-white rounded-lg border border-blue-200">
                                                                <label class="block text-xs font-medium text-gray-600 mb-1">Edit Cookie JSON</label>
                                                                <textarea
                                                                    bind:value={editingJson}
                                                                    class="w-full h-48 p-2 text-xs font-mono bg-gray-50 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                                                                    placeholder="Edit cookie JSON..."
                                                                ></textarea>
                                                                <div class="flex items-center gap-2 mt-2">
                                                                    <button
                                                                        onclick={updateCookie}
                                                                        class="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors flex items-center gap-1"
                                                                    >
                                                                        <Save size={12} />
                                                                        Save to Server
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

        <!-- Add Cookie Modal -->
        {#if showAddModal}
            <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onclick={() => { showAddModal = false; newCookieJson = ''; }}>
                <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4" onclick={(e) => e.stopPropagation()}>
                    <div class="px-6 py-4 border-b border-gray-200">
                        <h3 class="text-lg font-semibold text-gray-900">Add New Cookie</h3>
                        <p class="text-sm text-gray-500 mt-1">Cookie will be saved directly to server</p>
                    </div>
                    <div class="p-6">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Cookie JSON</label>
                        <textarea
                            bind:value={newCookieJson}
                            class="w-full h-48 p-3 text-sm font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                            placeholder={"{\n  \"name\": \"session_id\",\n  \"value\": \"abc123\",\n  \"domain\": \".example.com\",\n  \"path\": \"/\",\n  \"secure\": true,\n  \"httpOnly\": true\n}"}
                        ></textarea>
                        <p class="text-xs text-gray-400 mt-2">Required fields: name, domain. Optional: value, path, secure, httpOnly, sameSite, expirationDate</p>
                    </div>
                    <div class="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-2">
                        <button
                            onclick={() => { showAddModal = false; newCookieJson = ''; }}
                            class="px-4 py-2 text-sm border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onclick={addNewCookie}
                            class="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                        >
                            Save to Server
                        </button>
                    </div>
                </div>
            </div>
        {/if}

        <!-- Import Modal -->
        {#if showImportModal}
            <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onclick={() => showImportModal = false}>
                <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4" onclick={(e) => e.stopPropagation()}>
                    <div class="px-6 py-4 border-b border-gray-200">
                        <h3 class="text-lg font-semibold text-gray-900">Import Cookies</h3>
                        <p class="text-sm text-gray-500 mt-1">
                            {#if isEncryptedImport}
                                🔒 Cookie-Editor encrypted format detected — enter password to decrypt
                            {:else}
                                Cookies will be merged and saved directly to server
                            {/if}
                        </p>
                    </div>
                    <div class="p-6 space-y-4">
                        <!-- Drop Zone -->
                        <div
                            class="relative rounded-lg border-2 border-dashed transition-colors {isDragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}"
                            ondragover={handleDragOver}
                            ondragleave={handleDragLeave}
                            ondrop={handleDrop}
                        >
                            {#if isDragOver}
                                <div class="absolute inset-0 flex items-center justify-center bg-blue-50/80 rounded-lg z-10">
                                    <div class="text-center">
                                        <svg class="mx-auto h-10 w-10 text-blue-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                        </svg>
                                        <p class="text-sm font-medium text-blue-700">Drop JSON file here</p>
                                    </div>
                                </div>
                            {/if}
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
                                class="w-full h-48 p-3 text-sm font-mono bg-transparent border-0 focus:ring-0 focus:outline-none text-gray-900 resize-none"
                                placeholder="Paste cookie JSON or drag & drop a .json file here..."
                            ></textarea>
                            <div class="absolute bottom-2 right-2 flex gap-2">
                                <label class="px-2.5 py-1 text-xs bg-white border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer text-gray-600 shadow-sm">
                                    📁 Browse file
                                    <input type="file" accept=".json,application/json" onchange={handleFileSelect} class="hidden" />
                                </label>
                            </div>
                        </div>
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
                            {isImporting ? 'Importing...' : isEncryptedImport ? 'Decrypt & Import to Server' : 'Import to Server'}
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
