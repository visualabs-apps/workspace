<script>
    import ChildWindowControls from "../components/layout/ChildWindowControls.svelte";
    import { Cookie, Trash2, ChevronDown, ChevronRight, Save, RefreshCw, Search, Cloud, CloudOff, Edit3, Upload } from "lucide-svelte";
    import { toastStore } from "../lib/managers/toast.svelte.js";
    import Toast from "../components/ui/Toast.svelte";
    import { getChromeProfile, updateChromeProfile } from "../lib/api/api.js";

    const WINDOW_ID = 'cookie-manager-window';

    let partition = $state('');
    let profileId = $state(null);
    let isOpen = $state(false);

    // Receive data from parent window via IPC
    $effect(() => {
        const handleWindowData = (data) => {
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
    let loadError = $state('');
    let searchQuery = $state("");
    let expandedDomains = $state(new Set());
    let expandedCookies = $state(new Set());
    let editingCookieIndex = $state(null); // Index in cookies array
    let editingJson = $state("");
    let showImportModal = $state(false);
    let importJson = $state("");
    let isImporting = $state(false);
    let isDragOver = $state(false);

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
            loadError = 'No profile linked';
            return;
        }

        isLoading = true;
        loadError = '';
        try {
            const response = await getChromeProfile(profileId);
            if (response.success && response.data) {
                const serverCookies = response.data.cookies;
                cookies = Array.isArray(serverCookies) ? serverCookies : [];
            } else {
                cookies = [];
                loadError = response.error || 'Failed to load cookies';
            }
        } catch (error) {
            cookies = [];
            loadError = error.message || 'Failed to connect to server';
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
            // Deep-clone via JSON to strip undefined values and non-cloneable objects
            // before sending through IPC (prevents DataCloneError)
            const safeCookies = JSON.parse(JSON.stringify(updatedCookies));
            const result = await updateChromeProfile(profileId, {
                cookies: safeCookies,
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
            if (!updatedCookie.name || updatedCookie.value === undefined || !updatedCookie.domain) {
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
     * Import cookies — merge into backend cookies array
     */
    async function importCookie() {
        if (isImporting) return;
        isImporting = true;

        try {
            const parsedData = JSON.parse(importJson);
            let cookiesToImport = Array.isArray(parsedData) ? parsedData : [parsedData];

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
                toastStore.success(`${validCookies.length} cookie(s) imported to server`);
                showImportModal = false;
                importJson = "";
            }
        } catch (error) {
            console.error('Import cookie error:', error);
            toastStore.error('Invalid JSON format');
        } finally {
            isImporting = false;
        }
    }

    // Prevent Electron from navigating when files are dragged onto the window
    // Must use both preventDefault AND stopPropagation to prevent Chromium
    // from opening the file in its built-in text editor
    $effect(() => {
        const preventDrag = (e) => {
            e.preventDefault();
            e.stopPropagation();
        };
        // Only prevent on the document body, NOT on the drop zone element
        // The drop zone has its own handlers
        document.body.addEventListener('dragover', preventDrag);
        document.body.addEventListener('drop', preventDrag);
        return () => {
            document.body.removeEventListener('dragover', preventDrag);
            document.body.removeEventListener('drop', preventDrag);
        };
    });

    // Use a drag counter to prevent flickering when hovering over child elements
    let dragCounter = $state(0);

    function handleDragEnter(e) {
        e.preventDefault();
        e.stopPropagation();
        dragCounter++;
        isDragOver = true;
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        // Keep isDragOver true while dragging over the zone
        isDragOver = true;
    }

    function handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        dragCounter--;
        if (dragCounter <= 0) {
            dragCounter = 0;
            isDragOver = false;
        }
    }

    async function handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        dragCounter = 0;
        isDragOver = false;

        const files = e.dataTransfer?.files;
        if (!files || files.length === 0) return;

        const file = files[0];
        if (!file.name.endsWith('.json') && file.type !== 'application/json') {
            toastStore.error('Please drop a .json file');
            return;
        }

        // In Electron, File objects have a `path` property with the full filesystem path
        // Use IPC to read the file instead of FileReader to avoid DataCloneError
        const filePath = file.path;
        if (filePath && window.api?.db?.readTextFile) {
            try {
                const result = await window.api.db.readTextFile(filePath);
                if (result.success) {
                    importJson = result.content;
                    toastStore.success(`File loaded: ${file.name}`);
                } else {
                    toastStore.error(result.error || 'Failed to read file');
                }
            } catch (err) {
                toastStore.error('Failed to read file');
            }
        } else {
            // Fallback: use FileReader (for non-Electron environments)
            const reader = new FileReader();
            reader.onload = (event) => {
                importJson = event.target.result;
                toastStore.success(`File loaded: ${file.name}`);
            };
            reader.onerror = () => toastStore.error('Failed to read file');
            reader.readAsText(file);
        }
    }

    async function handleFileSelect(e) {
        const file = e.target.files?.[0];
        if (!file) return;

        // In Electron, File objects have a `path` property
        const filePath = file.path;
        if (filePath && window.api?.db?.readTextFile) {
            try {
                const result = await window.api.db.readTextFile(filePath);
                if (result.success) {
                    importJson = result.content;
                    toastStore.success(`File loaded: ${file.name}`);
                } else {
                    toastStore.error(result.error || 'Failed to read file');
                }
            } catch (err) {
                toastStore.error('Failed to read file');
            }
        } else {
            // Fallback: use FileReader
            const reader = new FileReader();
            reader.onload = (event) => {
                importJson = event.target.result;
                toastStore.success(`File loaded: ${file.name}`);
            };
            reader.readAsText(file);
        }
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
                        onclick={() => showImportModal = true}
                        class="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
                    >
                        <Upload size={14} />
                        Import Cookie
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

            <!-- Error banner (only shown when data fails to fetch) -->
            {#if loadError}
                <div class="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                    <CloudOff size={14} />
                    <span>Failed to fetch data from server. {loadError}</span>
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
                        <p class="text-xs mt-1">Click "Import Cookie" to add cookies</p>
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
                                                                        Save
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

        <!-- Import Modal -->
        {#if showImportModal}
            <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onclick={() => showImportModal = false}>
                <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4" onclick={(e) => e.stopPropagation()}>
                    <div class="px-6 py-4 border-b border-gray-200">
                        <h3 class="text-lg font-semibold text-gray-900">Import Cookies</h3>
                        <p class="text-sm text-gray-500 mt-1">Cookies will be merged and saved directly to server</p>
                    </div>
                    <div class="p-6 space-y-4">
                        <!-- Drop Zone -->
                        <div
                            class="relative rounded-lg border-2 border-dashed transition-colors {isDragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}"
                            ondragenter={handleDragEnter}
                            ondragover={handleDragOver}
                            ondragleave={handleDragLeave}
                            ondrop={handleDrop}
                        >
                            {#if isDragOver}
                                <div class="absolute inset-0 flex items-center justify-center bg-blue-50/80 rounded-lg z-10 pointer-events-none">
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
                            disabled={isImporting}
                            class="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isImporting ? 'Importing...' : 'Import to Server'}
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

<!-- Toast notifications for child window -->
<Toast />
