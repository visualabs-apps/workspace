<script>
    import {
        ChevronLeft,
        ChevronRight,
        RotateCw,
        Home,
        Search,
        Square,
        Download,
        CheckSquare,
        Clock,
        Settings,
        Bookmark,
        Download as DownloadIcon,
        HelpCircle,
        Star,
        Target,
        RefreshCw,
        Cloud,
        CloudOff,
        CheckCircle2,
        AlertTriangle,
        Key,
    } from "lucide-svelte";
    import { navigationStore } from "../../lib/managers/navigation.svelte.js";
    import { appStore } from "../../lib/stores/apps.svelte.js";
    import { appStateStore } from "../../lib/stores/appState.svelte.js";
    import { workspaceStore } from "../../lib/stores/workspaces.svelte.js";
    import { bookmarkStore } from "../../lib/stores/bookmarks.svelte.js";
    import { downloadStore } from "../../lib/stores/downloads.svelte.js";
    import { toastStore } from "../../lib/managers/toast.svelte.js";
    import { authStore } from "../../lib/stores/auth.svelte.js";
    import { getClientsForAdmin } from "../../lib/api/api.js";
    import { panelStore } from "../../lib/stores/panels.svelte.js";
    import { openPredefinedWindow } from "../../lib/utils/childWindow.js";
    import { dataSyncManager } from "../../lib/managers/dataSync.svelte.js";
    import WindowControls from "./WindowControls.svelte";
    import AutocompleteDropdown from "../dropdowns/AutocompleteDropdown.svelte";
    import HistoryPanel from "../panels/HistoryPanel.svelte";
    import BookmarkPanel from "../panels/BookmarkPanel.svelte";
    import DownloadManagerPanel from "../panels/DownloadManagerPanel.svelte";
    import ProfileDropdown from "../dropdowns/ProfileDropdown.svelte";
    import { LogOut, User } from "lucide-svelte";
    import Dropdown from "../dropdowns/Dropdown.svelte";
    import { onMount } from "svelte";

    let { app = null } = $props();

    let urlInput = $state("");
    let isUrlFocused = $state(false);
    let isTargetModalOpen = $state(false);
    let isSettingsModalOpen = $state(false);
    let isInjectScriptModalOpen = $state(false);
    let showAutocomplete = $state(false);
    let showBrowserMenu = $state(false);
    let showReloadMenu = $state(false);
    let showUserDropdown = $state(false);
    let useBrowserWindow = $state(true); // Toggle between BrowserWindow and Svelte overlay
    let isBookmarked = $state(false);
    let isEditProfileModalOpen = $state(false);
    let editingProfile = $state(null);
    let clients = $state([]);
    let isLoadingClients = $state(false);
    let defaultSearchEngine = $state("google"); // Default search engine

    // Search engine configurations
    const searchEngines = {
        google: { name: "Google", url: "https://www.google.com/search?q=" },
        bing: { name: "Bing", url: "https://www.bing.com/search?q=" },
        duckduckgo: { name: "DuckDuckGo", url: "https://duckduckgo.com/?q=" },
        yahoo: { name: "Yahoo", url: "https://search.yahoo.com/search?p=" }
    };

    // Update notification state
    let updateInfo = $state(null); // { version, notes, downloadUrl }
    
    // Get active workspace
    let activeWorkspace = $derived(workspaceStore.activeWorkspace);
    
    // Get user from auth store
    let user = $derived(authStore.user);
    
    // Load clients for profile editing
    async function loadClients() {
        if (!user?.id) return;
        
        isLoadingClients = true;
        try {
            clients = await getClientsForAdmin(user.id);
        } catch (error) {
            console.error('Failed to load clients:', error);
            clients = [];
        } finally {
            isLoadingClients = false;
        }
    }
    
    // Load clients when user is available
    $effect(() => {
        if (user?.id && clients.length === 0) {
            loadClients();
        }
    });
    
    // Expose toastStore to window for downloads.svelte.js
    onMount(() => {
        if (typeof window !== 'undefined') {
            window.toastStore = toastStore;
        }
        
        // Load default search engine setting
        loadSearchEngineSetting();
    });
    
    // Load default search engine from settings
    async function loadSearchEngineSetting() {
        try {
            const result = await window.api.settings.getDefaultSearchEngine();
            if (result.success) {
                defaultSearchEngine = result.engine;
            }
        } catch (error) {
            console.error('Failed to load search engine setting:', error);
        }
    }

    // Derived from navigation store
    let canGoBack = $derived(navigationStore.canGoBack);
    let canGoForward = $derived(navigationStore.canGoForward);
    let isLoading = $derived(navigationStore.isLoading);
    let currentUrl = $derived(navigationStore.currentUrl);

    // Get active tab explicitly to rely on its URL state
    let activeTabId = $derived(
        app ? appStateStore.getActiveTabId(app.id) : null,
    );
    let activeTab = $derived(
        app ? appStateStore.getActiveTab(app.id) : null,
    );

    // Single source of truth for the displayed URL
    let displayUrl = $derived(() => {
        // ✅ FIX: Prioritize navigationStore.currentUrl for active tab
        // navigationStore is updated immediately on navigation events
        if (currentUrl && activeTab) {
            return currentUrl;
        }
        if (activeTab) {
            return activeTab.url || "";
        }
        if (app) {
            return app.url || "";
        }
        return "";
    });

    // Update URL input when displayUrl changes
    $effect(() => {
        const url = displayUrl();
        if (!isUrlFocused) {
            urlInput = url;
        }
    });
    
    // Check if current URL is bookmarked
    $effect(() => {
        const url = displayUrl();
        const workspace = activeWorkspace;
        const tabId = activeTabId;
        const currentService = app;
        
        if (workspace && url) {
            bookmarkStore.isBookmarked(workspace.id, url).then(result => {
                isBookmarked = result;
            });
        } else {
            isBookmarked = false;
        }
    });

    // Listen for new version notification from main process
    $effect(() => {
        if (window.api?.onNewVersionAvailable) {
            window.api.onNewVersionAvailable((info) => {
                updateInfo = info;
            });
        }
    });
    
    // Listen for settings changes (reload search engine when settings are saved)
    $effect(() => {
        // Create custom event listener for settings update
        const handleSettingsUpdate = () => {
            loadSearchEngineSetting();
        };
        
        window.addEventListener('settings-updated', handleSettingsUpdate);
        
        return () => {
            window.removeEventListener('settings-updated', handleSettingsUpdate);
        };
    });

    function openDownloadPage() {
        if (updateInfo?.downloadUrl && window.api?.openExternal) {
            window.api.openExternal(updateInfo.downloadUrl);
        }
    }
    
    async function toggleBookmark() {
        if (!activeWorkspace) return;
        
        const url = displayUrl();
        const title = activeTab?.title || app?.name || 'Bookmark';
        const favicon = activeTab?.favicon || app?.icon || '';
        
        // Check current bookmark status from database
        const currentlyBookmarked = await bookmarkStore.isBookmarked(activeWorkspace.id, url);
        
        const success = await bookmarkStore.toggleBookmark(activeWorkspace.id, url, title, favicon);
        
        if (success) {
            if (currentlyBookmarked) {
                toastStore.success('Bookmark removed');
            } else {
                toastStore.success('Bookmark added');
            }
            // Force re-check bookmark status
            const newStatus = await bookmarkStore.isBookmarked(activeWorkspace.id, url);
            isBookmarked = newStatus;
        } else {
            toastStore.error('Failed to update bookmark');
        }
    }

    function handleUrlSubmit(e) {
        // Handle autocomplete navigation
        if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Escape") {
            // Let AutocompleteDropdown handle these
            return;
        }

        if (e.key === "Enter" && urlInput.trim()) {
            showAutocomplete = false;
            navigateToUrl(urlInput.trim());
        }
    }

    function navigateToUrl(input) {
        // Check for internal URLs (chrome://, about:, vbox://)
        const isInternalUrl = 
            input.startsWith("chrome://") ||
            input.startsWith("about:") ||
            input.startsWith("vbox://");
        
        // Check if it's a URL (contains . or starts with http/https)
        const isUrl =
            isInternalUrl ||
            input.includes(".") ||
            input.startsWith("http://") ||
            input.startsWith("https://");

        let url = input;
        if (isInternalUrl) {
            // Keep internal URLs as-is
            url = input;
        } else if (isUrl) {
            if (!url.startsWith("http://") && !url.startsWith("https://")) {
                url = "https://" + url;
            }
        } else {
            // Use default search engine from settings
            const searchEngine = searchEngines[defaultSearchEngine] || searchEngines.google;
            url = `${searchEngine.url}${encodeURIComponent(input)}`;
            console.log(`🔍 Searching with ${searchEngine.name}: ${input}`);
        }

        // Case 1: Tab actively running in current app - navigate it
        if (app && activeTabId) {
            // Eagerly update tab url to prevent visual snap-back
            appStateStore.updateTab(app.id, activeTabId, { url });
            
            // For internal URLs, just update the app URL (no webview navigation needed)
            if (isInternalUrl) {
                appStore.updateApp(app.id, { url });
            } else {
                navigationStore.navigate(url);
            }
        }
        // Case 2: We are inside an empty app (no tabs) - add new tab
        else if (app) {
            appStateStore.addTab(app.id, url, "New Tab");
        }
        // Case 3: We are inside an empty Workspace (no services) - add new app
        else {
            const newApp = appStore.addApp(
                {
                    name: "Browser",
                    url: url,
                    icon: `https://www.google.com/s2/favicons?domain=${url}&sz=128`,
                    color: "#4285f4",
                },
                null,
                null,
                null,
                workspaceStore.activeWorkspaceId,
            );

            if (workspaceStore.activeWorkspace && newApp) {
                workspaceStore.addAppToWorkspace(
                    workspaceStore.activeWorkspace.id,
                    newApp.id,
                    app?.id || null,
                );
            }
        }
    }

    // Autocomplete handlers
    function handleInputFocus() {
        isUrlFocused = true;
        showAutocomplete = true;
    }

    function handleInputBlur() {
        // Delay hiding to allow click on dropdown
        setTimeout(() => {
            isUrlFocused = false;
            showAutocomplete = false;
        }, 150);
    }

    function handleInputChange() {
        showAutocomplete = isUrlFocused && urlInput.length > 0;
    }

    function handleAutocompleteSelect(url) {
        urlInput = url;
        showAutocomplete = false;
        navigateToUrl(url);
    }

    function handleAutocompleteClose() {
        showAutocomplete = false;
    }

    async function handleBrowserMenuClick(action) {
        showBrowserMenu = false;
        
        switch (action) {
            case 'todo-list':
                toastStore.info('To-Do List feature coming soon!');
                break;
            case 'target':
                if (useBrowserWindow) {
                    openPredefinedWindow('TARGET', { profileName: activeWorkspace?.name || '' });
                } else {
                    openPredefinedWindow('TARGET', { profileName: activeWorkspace?.name || '' });
                }
                break;
            case 'history':
                panelStore.openHistory();
                break;
            case 'bookmarks':
                panelStore.openBookmarks();
                break;
            case 'downloads':
                panelStore.openDownloads();
                downloadStore.markAllViewed();
                break;
            case 'reload-app':
                if (window.api?.reloadApp) {
                    toastStore.info('Memuat ulang aplikasi...');
                    await window.api.reloadApp();
                }
                break;
            case 'my-profile':
                // Show user info in toast
                const user = authStore.user;
                const userInfo = `Name: ${user?.name || 'N/A'} | Email: ${user?.email || 'N/A'} | Role: ${user?.role || 'N/A'}`;
                toastStore.info(userInfo);
                break;
            case 'settings':
                if (useBrowserWindow) {
                    openPredefinedWindow('SETTINGS');
                } else {
                    openPredefinedWindow('SETTINGS');
                }
                break;
            case 'passwords':
                openPredefinedWindow('PASSWORD_MANAGER', {
                    profileId: activeWorkspace?.id || null
                });
                break;
            case 'inject-script':
                if (useBrowserWindow) {
                    openPredefinedWindow('INJECT_SCRIPT');
                } else {
                    openPredefinedWindow('INJECT_SCRIPT');
                }
                break;
            case 'help':
                // TODO: Open help
                break;
            case 'logout':
                if (confirm("Are you sure you want to logout?")) {
                    authStore.logout();
                }
                break;
        }
    }

    function toggleBrowserMenu(e) {
        e.stopPropagation();
        showBrowserMenu = !showBrowserMenu;
    }

    function handleEditProfile(workspace) {
        editingProfile = workspace;
        openPredefinedWindow('PROFILE', {
            mode: 'edit',
            editingProfile: JSON.parse(JSON.stringify(workspace)),
            clients: JSON.parse(JSON.stringify(clients)),
            isLoadingClients: isLoadingClients,
        });
    }

    function handleDeleteProfile(workspace) {
        if (confirm(`Hapus profile "${workspace.name}"?`)) {
            workspaceStore.deleteWorkspace(workspace.id);
            toastStore.success('Profile dihapus');
        }
    }

    async function handleProfileUpdateSuccess(updatedProfile, color) {
        // Refresh workspace data
        await workspaceStore.loadWorkspaces();
        toastStore.success('Profile diperbarui');
    }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center shrink-0 h-12 px-1 gap-2 select-none"
    style="-webkit-app-region: drag"
    role="toolbar"
    aria-label="Browser toolbar"
    tabindex="-1"
>
    <!-- Navigation Buttons -->
    <div
        class="flex items-center gap-1 pl-2"
        style="-webkit-app-region: no-drag"
    >
        <button
            class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors {canGoBack
                ? 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                : 'text-gray-400 dark:text-gray-600 cursor-not-allowed'}"
            title="Back"
            onclick={() => navigationStore.goBack()}
            disabled={!canGoBack}
        >
            <ChevronLeft size={18} />
        </button>
        <button
            class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors {canGoForward
                ? 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                : 'text-gray-400 dark:text-gray-600 cursor-not-allowed'}"
            title="Forward"
            onclick={() => navigationStore.goForward()}
            disabled={!canGoForward}
        >
            <ChevronRight size={18} />
        </button>
        <!-- Reload/Stop button — single button, same size to prevent layout shift -->
        {#if isLoading}
            <button
                class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
                style="-webkit-app-region: no-drag"
                title="Stop"
                onclick={() => navigationStore.stop()}
            >
                <Square size={16} />
            </button>
        {:else}
            <Dropdown
                isOpen={showReloadMenu}
                onClose={() => showReloadMenu = false}
                dropdownId="reload-menu"
                width="w-56"
                position="left"
                zIndex="z-[9999]"
            >
                {#snippet trigger()}
                    <button
                        class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                        title="Reload (right-click for Hard Reload)"
                        onclick={() => navigationStore.reload()}
                        oncontextmenu={(e) => { e.preventDefault(); e.stopPropagation(); showReloadMenu = !showReloadMenu; }}
                    >
                        <RotateCw size={16} />
                    </button>
                {/snippet}

                {#snippet children()}
                    <button
                        class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-3 whitespace-nowrap"
                        onclick={() => { showReloadMenu = false; navigationStore.reload(); }}
                    >
                        <RotateCw size={16} />
                        Reload
                        <span class="ml-auto text-xs text-gray-400 dark:text-gray-500">Ctrl+R</span>
                    </button>
                    <button
                        class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-3 whitespace-nowrap"
                        onclick={() => { showReloadMenu = false; navigationStore.hardReload(); }}
                    >
                        <RotateCw size={16} class="text-orange-500" />
                        Hard Reload
                        <span class="ml-auto text-xs text-gray-400 dark:text-gray-500">Clear cache</span>
                    </button>
                {/snippet}
            </Dropdown>
        {/if}
        <button
            class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            title="Home"
            onclick={() => app && navigationStore.goHome(app.url)}
        >
            <Home size={16} />
        </button>
    </div>

    <!-- URL Input -->
    <div
        class="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg min-w-[300px] flex-1 relative {isUrlFocused
            ? 'ring-2 ring-blue-500/50 bg-gray-50 dark:bg-gray-700'
            : ''}"
        style="-webkit-app-region: no-drag"
    >
        <Search size={14} class="text-gray-500 dark:text-gray-400 shrink-0" />
        <input
            type="text"
            bind:value={urlInput}
            onfocus={handleInputFocus}
            onblur={handleInputBlur}
            oninput={handleInputChange}
            onkeydown={handleUrlSubmit}
            placeholder="Search Google or type a URL"
            class="flex-1 bg-transparent text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 outline-none w-full"
        />
        
        <!-- Autocomplete Dropdown -->
        <AutocompleteDropdown 
            query={urlInput}
            isVisible={showAutocomplete}
            onSelect={handleAutocompleteSelect}
            onClose={handleAutocompleteClose}
        />
    </div>
    
    <!-- Bookmark Button -->
    <button
        type="button"
        onclick={toggleBookmark}
        class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors {isBookmarked ? 'text-yellow-500' : 'text-gray-600 dark:text-gray-400'}"
        style="-webkit-app-region: no-drag"
        title={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
    >
        <Star size={18} fill={isBookmarked ? 'currentColor' : 'none'} />
    </button>

    <div class="flex-1"></div>

    <!-- Data Sync Indicator — only visible during/shortly after syncing -->
    {#if dataSyncManager.showIndicator}
        <div
            class="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-all duration-300 cursor-default {dataSyncManager.syncStatus === 'syncing'
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                : dataSyncManager.syncStatus === 'error'
                    ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800'
                    : 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800'}"
            style="-webkit-app-region: no-drag"
            title={dataSyncManager.syncStatus === 'syncing'
                ? 'Syncing data from server...'
                : dataSyncManager.syncStatus === 'error'
                    ? `Sync error: ${dataSyncManager.lastError || 'Unknown'}`
                    : dataSyncManager.lastSyncTime
                        ? `Synced at ${new Date(dataSyncManager.lastSyncTime).toLocaleTimeString()}`
                        : 'Sync complete'}
        >
            {#if dataSyncManager.syncStatus === 'syncing'}
                <RefreshCw size={12} class="animate-spin" />
                <span>Syncing</span>
            {:else if dataSyncManager.syncStatus === 'error'}
                <AlertTriangle size={12} />
                <span>Sync Error</span>
            {:else}
                <CheckCircle2 size={12} />
                <span>Synced</span>
            {/if}
        </div>
    {/if}

    <!-- Update Available Badge -->
    {#if updateInfo}
        <button
            type="button"
            class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-xs font-medium cursor-pointer hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors"
            style="-webkit-app-region: no-drag"
            title={updateInfo.notes || "New version available"}
            onclick={openDownloadPage}
        >
            <Download size={12} />
            <span>v{updateInfo.version} tersedia</span>
        </button>
    {/if}

    <!-- User Name + Logout Dropdown -->
    <Dropdown
        isOpen={showUserDropdown}
        onClose={() => showUserDropdown = false}
        dropdownId="user-dropdown"
        width="w-48"
        zIndex="z-[9999]"
    >
        {#snippet trigger()}
            <button
                onclick={(e) => { e.stopPropagation(); showUserDropdown = !showUserDropdown; }}
                class="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                style="-webkit-app-region: no-drag"
            >
                <User size={16} class="text-gray-500 dark:text-gray-400" />
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300 max-w-[140px] truncate">
                    {authStore.user?.name || authStore.user?.email || 'User'}
                </span>
            </button>
        {/snippet}

        {#snippet children()}
            <button
                onclick={() => { showUserDropdown = false; openPredefinedWindow('ACCOUNT_SETTINGS'); }}
                class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-3"
            >
                <User size={16} />
                Account Settings
            </button>
            <button
                onclick={() => { showUserDropdown = false; handleBrowserMenuClick('logout'); }}
                class="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-3"
            >
                <LogOut size={16} />
                Logout
            </button>
        {/snippet}
    </Dropdown>

    <!-- Download Manager Icon -->
    <div data-download-trigger="download-panel" style="-webkit-app-region: no-drag">
        <button
            type="button"
            onclick={(e) => {
                e.stopPropagation();
                panelStore.toggleDownloads();
                if (panelStore.isDownloadPanelOpen) {
                    downloadStore.markAllViewed();
                }
            }}
            class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors relative"
            title="Unduhan (Ctrl+J)"
        >
            <DownloadIcon size={20} />
            {#if downloadStore.activeDownloads.length > 0}
                <span class="absolute -top-1 -right-1 bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                    {downloadStore.activeDownloads.length}
                </span>
            {/if}
            {#if downloadStore.unviewedCompletedCount > 0}
                <span class="absolute -top-1 -right-1 {downloadStore.activeDownloads.length > 0 ? 'top-3 -right-0.5 w-3 h-3' : 'bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium'} {downloadStore.activeDownloads.length === 0 ? '' : 'bg-green-500'}">
                    {#if downloadStore.activeDownloads.length === 0}
                        {downloadStore.unviewedCompletedCount}
                    {:else}
                        <span class="block w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                    {/if}
                </span>
                <!-- Green glow effect on icon -->
                <span class="absolute inset-0 rounded-lg animate-pulse bg-green-400/20 pointer-events-none"></span>
            {/if}
        </button>
    </div>

    <!-- Browser Menu (Settings) -->
    <Dropdown 
        isOpen={showBrowserMenu} 
        onClose={() => showBrowserMenu = false}
        dropdownId="browser-menu"
        width="w-64"
        zIndex="z-[9999]"
        trigger={browserTrigger}
    >
        {#snippet browserTrigger()}
            <button
                onclick={toggleBrowserMenu}
                class="p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                title="Settings and more"
            >
                <Settings 
                    size={20} 
                    class="transition-transform duration-300 {showBrowserMenu ? 'rotate-90' : 'rotate-0'}"
                />
            </button>
        {/snippet}

        {#snippet children()}
            <!-- Profile-scoped items -->
            <div class="px-4 py-1.5 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                Profil
            </div>
            <button
                onclick={() => handleBrowserMenuClick('target')}
                class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-3"
            >
                <Target size={16} />
                Target Dashboard
            </button>
            <button
                onclick={() => handleBrowserMenuClick('history')}
                class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-3"
            >
                <Clock size={16} />
                Riwayat Penjelajahan
                <span class="ml-auto text-xs text-gray-400 dark:text-gray-500">Ctrl+H</span>
            </button>
            <button
                onclick={() => handleBrowserMenuClick('bookmarks')}
                class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-3"
            >
                <Bookmark size={16} />
                Bookmarks
                <span class="ml-auto text-xs text-gray-400 dark:text-gray-500">Ctrl+Shift+O</span>
            </button>
            <button
                onclick={() => handleBrowserMenuClick('downloads')}
                class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-3"
            >
                <DownloadIcon size={16} />
                Unduhan
                <span class="ml-auto text-xs text-gray-400 dark:text-gray-500">Ctrl+J</span>
            </button>
            <button
                onclick={() => handleBrowserMenuClick('passwords')}
                class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-3"
            >
                <Key size={16} />
                Password Manager
            </button>
            
            <hr class="my-2 border-gray-100 dark:border-gray-800" />
            
            <!-- Global items -->
            <div class="px-4 py-1.5 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                Aplikasi
            </div>
            <button
                onclick={() => handleBrowserMenuClick('reload-app')}
                class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-3"
            >
                <RotateCw size={16} />
                Segarkan Aplikasi
            </button>
            <button
                onclick={() => handleBrowserMenuClick('settings')}
                class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-3"
            >
                <Settings size={16} />
                Pengaturan
            </button>
            <button
                onclick={() => handleBrowserMenuClick('inject-script')}
                class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-3"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
                Script Injector Manager
            </button>
            <button
                onclick={() => handleBrowserMenuClick('help')}
                class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-3"
            >
                <HelpCircle size={16} />
                Bantuan
            </button>

            <hr class="my-2 border-gray-100 dark:border-gray-800" />

            <!-- Logout -->
            <button
                onclick={() => handleBrowserMenuClick('logout')}
                class="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-3"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                Logout
            </button>
        {/snippet}
    </Dropdown>

    <!-- Window Controls -->
    <WindowControls variant="light" />
</div>

<!-- History Panel -->
<HistoryPanel 
    bind:isOpen={panelStore.isHistoryPanelOpen}
    onClose={() => panelStore.closeHistory()}
/>

<!-- Bookmark Panel -->
<BookmarkPanel bind:isOpen={panelStore.isBookmarkPanelOpen} />

<!-- Download Manager Panel -->
<DownloadManagerPanel bind:isOpen={panelStore.isDownloadPanelOpen} />






