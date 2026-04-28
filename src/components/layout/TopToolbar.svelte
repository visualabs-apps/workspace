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
    } from "lucide-svelte";
    import { navigationStore } from "../../lib/managers/navigation.svelte.js";
    import { serviceStore } from "../../lib/stores/services.svelte.js";
    import { tabStore } from "../../lib/stores/tabs.svelte.js";
    import { workspaceStore } from "../../lib/stores/workspaces.svelte.js";
    import { bookmarkStore } from "../../lib/stores/bookmarks.svelte.js";
    import { downloadStore } from "../../lib/stores/downloads.svelte.js";
    import { toastStore } from "../../lib/managers/toast.svelte.js";
    import { authStore } from "../../lib/stores/auth.svelte.js";
    import { getClientsForAdmin } from "../../lib/api/api.js";
    import { panelStore } from "../../lib/stores/panels.svelte.js";
    import WindowControls from "./WindowControls.svelte";
    import AutocompleteDropdown from "../dropdowns/AutocompleteDropdown.svelte";
    import HistoryPanel from "../panels/HistoryPanel.svelte";
    import TodoWindow from "../windows/TodoWindow.svelte";
    import BookmarkPanel from "../panels/BookmarkPanel.svelte";
    import DownloadManagerPanel from "../panels/DownloadManagerPanel.svelte";
    import ProfileDropdown from "../dropdowns/ProfileDropdown.svelte";
    import ProfileWindow from "../windows/ProfileWindow.svelte";
    import Dropdown from "../dropdowns/Dropdown.svelte";
    import { onMount } from "svelte";

    let { service = null } = $props();

    let urlInput = $state("");
    let isUrlFocused = $state(false);
    let isTodoModalOpen = $state(false);
    let showAutocomplete = $state(false);
    let showBrowserMenu = $state(false);
    let isBookmarked = $state(false);
    let isEditProfileModalOpen = $state(false);
    let editingProfile = $state(null);
    let clients = $state([]);
    let isLoadingClients = $state(false);

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
    
    // Get active downloads count from database
    let activeDownloadsCount = $state(0);
    
    // Update active downloads count periodically
    let countInterval;
    $effect(() => {
        async function updateCount() {
            try {
                const result = await window.api.db.getDownloads(activeWorkspace?.id);
                if (result.success) {
                    const activeCount = result.downloads.filter(d => 
                        d.state === 'progressing' || d.state === 'paused'
                    ).length;
                    activeDownloadsCount = activeCount;
                }
            } catch (error) {
                console.error('Failed to get active downloads count:', error);
            }
        }
        
        updateCount();
        countInterval = setInterval(updateCount, 2000); // Update every 2 seconds
        
        return () => {
            if (countInterval) clearInterval(countInterval);
        };
    });
    
    // Expose toastStore to window for downloads.svelte.js
    onMount(() => {
        if (typeof window !== 'undefined') {
            window.toastStore = toastStore;
        }
    });

    // Derived from navigation store
    let canGoBack = $derived(navigationStore.canGoBack);
    let canGoForward = $derived(navigationStore.canGoForward);
    let isLoading = $derived(navigationStore.isLoading);
    let currentUrl = $derived(navigationStore.currentUrl);

    // Get active tab explicitly to rely on its URL state
    let activeTabId = $derived(
        service ? tabStore.getActiveTabId(service.id) : null,
    );
    let activeTab = $derived(
        service ? tabStore.getActiveTab(service.id) : null,
    );

    // Single source of truth for the displayed URL
    let displayUrl = $derived(() => {
        if (activeTab) {
            // Priority: the tab's current URL, falling back to navigationStore, or empty
            return activeTab.url || currentUrl || "";
        }
        if (service) {
            return service.url || "";
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
        const currentService = service;
        
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

    function openDownloadPage() {
        if (updateInfo?.downloadUrl && window.api?.openExternal) {
            window.api.openExternal(updateInfo.downloadUrl);
        }
    }
    
    async function toggleBookmark() {
        if (!activeWorkspace) return;
        
        const url = displayUrl();
        const title = activeTab?.title || service?.name || 'Bookmark';
        const favicon = activeTab?.favicon || service?.icon || '';
        
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
        // Check if it's a URL (contains . or starts with http/https)
        const isUrl =
            input.includes(".") ||
            input.startsWith("http://") ||
            input.startsWith("https://");

        let url = input;
        if (isUrl) {
            if (!url.startsWith("http://") && !url.startsWith("https://")) {
                url = "https://" + url;
            }
        } else {
            url = `https://www.google.com/search?q=${encodeURIComponent(input)}`;
        }

        // Case 1: Tab actively running in current service - navigate it
        if (service && activeTabId) {
            // Eagerly update tab url to prevent visual snap-back
            tabStore.updateTab(service.id, activeTabId, { url });
            navigationStore.navigate(url);
        }
        // Case 2: We are inside an empty Service (no tabs) - add new tab
        else if (service) {
            tabStore.addTab(service.id, url, "New Tab");
        }
        // Case 3: We are inside an empty Workspace (no services) - add new service
        else {
            const newService = serviceStore.addService(
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

            if (workspaceStore.activeWorkspace && newService) {
                workspaceStore.addAppToWorkspace(
                    workspaceStore.activeWorkspace.id,
                    newService.id,
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

    function handleBrowserMenuClick(action) {
        showBrowserMenu = false;
        
        switch (action) {
            case 'todo-list':
                isTodoModalOpen = true;
                break;
            case 'history':
                panelStore.openHistory();
                break;
            case 'bookmarks':
                panelStore.openBookmarks();
                break;
            case 'downloads':
                panelStore.openDownloads();
                break;
            case 'my-profile':
                // Show user info in toast
                const user = authStore.user;
                const userInfo = `Name: ${user?.name || 'N/A'} | Email: ${user?.email || 'N/A'} | Role: ${user?.role || 'N/A'}`;
                toastStore.info(userInfo);
                break;
            case 'settings':
                // TODO: Open settings
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
        isEditProfileModalOpen = true;
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
    class="bg-white border-b border-gray-200 flex items-center shrink-0 h-12 px-1 gap-2"
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
            class="p-1.5 rounded-lg hover:bg-gray-100 transition-colors {canGoBack
                ? 'text-gray-700 hover:text-gray-900'
                : 'text-gray-400 cursor-not-allowed'}"
            title="Back"
            onclick={() => navigationStore.goBack()}
            disabled={!canGoBack}
        >
            <ChevronLeft size={18} />
        </button>
        <button
            class="p-1.5 rounded-lg hover:bg-gray-100 transition-colors {canGoForward
                ? 'text-gray-700 hover:text-gray-900'
                : 'text-gray-400 cursor-not-allowed'}"
            title="Forward"
            onclick={() => navigationStore.goForward()}
            disabled={!canGoForward}
        >
            <ChevronRight size={18} />
        </button>
        {#if isLoading}
            <button
                class="p-1.5 rounded-lg hover:bg-gray-100 text-red-600 hover:text-red-700 transition-colors"
                title="Stop"
                onclick={() => navigationStore.stop()}
            >
                <Square size={14} />
            </button>
        {:else}
            <button
                class="p-1.5 rounded-lg hover:bg-gray-100 text-gray-700 hover:text-gray-900 transition-colors"
                title="Reload"
                onclick={() => navigationStore.reload()}
            >
                <RotateCw size={16} />
            </button>
        {/if}
        <button
            class="p-1.5 rounded-lg hover:bg-gray-100 text-gray-700 hover:text-gray-900 transition-colors"
            title="Home"
            onclick={() => service && navigationStore.goHome(service.url)}
        >
            <Home size={16} />
        </button>
    </div>

    <!-- URL Input -->
    <div
        class="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg min-w-[300px] flex-1 relative {isUrlFocused
            ? 'ring-2 ring-blue-500/50 bg-gray-50'
            : ''}"
        style="-webkit-app-region: no-drag"
    >
        {#if isLoading}
            <div
                class="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0"
            ></div>
        {:else}
            <Search size={14} class="text-gray-500 shrink-0" />
        {/if}
        <input
            type="text"
            bind:value={urlInput}
            onfocus={handleInputFocus}
            onblur={handleInputBlur}
            oninput={handleInputChange}
            onkeydown={handleUrlSubmit}
            placeholder="Search Google or type a URL"
            class="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-500 outline-none w-full"
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
        class="p-2 rounded-lg hover:bg-gray-100 transition-colors {isBookmarked ? 'text-yellow-500' : 'text-gray-600'}"
        style="-webkit-app-region: no-drag"
        title={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
    >
        <Star size={18} fill={isBookmarked ? 'currentColor' : 'none'} />
    </button>

    <div class="flex-1"></div>

    <!-- Update Available Badge -->
    {#if updateInfo}
        <button
            type="button"
            class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-700 text-xs font-medium cursor-pointer hover:bg-emerald-200 transition-colors"
            style="-webkit-app-region: no-drag"
            title={updateInfo.notes || "New version available"}
            onclick={openDownloadPage}
        >
            <Download size={12} />
            <span>v{updateInfo.version} tersedia</span>
        </button>
    {/if}

    <!-- Profile Dropdown -->
    <ProfileDropdown 
        onEditProfile={handleEditProfile}
        onDeleteProfile={handleDeleteProfile}
    />

    <!-- Download Manager Icon -->
    <div data-download-trigger="download-panel" style="-webkit-app-region: no-drag">
        <button
            type="button"
            onclick={(e) => {
                e.stopPropagation();
                panelStore.toggleDownloads();
            }}
            class="p-2 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-gray-800 transition-colors relative"
            title="Unduhan (Ctrl+J)"
        >
            <DownloadIcon size={20} />
            {#if activeDownloadsCount > 0}
                <span class="absolute -top-1 -right-1 bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                    {activeDownloadsCount}
                </span>
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
                class="p-2.5 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-gray-800 transition-colors"
                title="Settings and more"
            >
                <Settings 
                    size={20} 
                    class="transition-transform duration-300 {showBrowserMenu ? 'rotate-90' : 'rotate-0'}"
                />
            </button>
        {/snippet}

        {#snippet children()}
            <!-- Browser Features -->
            <button
                onclick={() => handleBrowserMenuClick('todo-list')}
                class="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
            >
                <CheckSquare size={16} />
                To-Do List
            </button>
            <button
                onclick={() => handleBrowserMenuClick('history')}
                class="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
            >
                <Clock size={16} />
                Riwayat Penjelajahan
                <span class="ml-auto text-xs text-gray-400">Ctrl+H</span>
            </button>
            <button
                onclick={() => handleBrowserMenuClick('bookmarks')}
                class="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
            >
                <Bookmark size={16} />
                Bookmarks
                <span class="ml-auto text-xs text-gray-400">Ctrl+Shift+O</span>
            </button>
            <button
                onclick={() => handleBrowserMenuClick('downloads')}
                class="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
            >
                <DownloadIcon size={16} />
                Unduhan
                <span class="ml-auto text-xs text-gray-400">Ctrl+J</span>
            </button>
            
            <hr class="my-2 border-gray-100" />
            
            <!-- Settings & Help -->
            <button
                onclick={() => handleBrowserMenuClick('my-profile')}
                class="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                Profil Saya
            </button>
            <button
                onclick={() => handleBrowserMenuClick('settings')}
                class="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
            >
                <Settings size={16} />
                Pengaturan
            </button>
            <button
                onclick={() => handleBrowserMenuClick('help')}
                class="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
            >
                <HelpCircle size={16} />
                Bantuan
            </button>
            
            <hr class="my-2 border-gray-100" />
            
            <!-- Logout -->
            <button
                onclick={() => handleBrowserMenuClick('logout')}
                class="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                Logout
            </button>
        {/snippet}
    </Dropdown>

    <!-- Window Controls -->
    <WindowControls variant="light" />
</div>

<!-- Todo Window -->
<TodoWindow 
    bind:isOpen={isTodoModalOpen}
    onClose={() => isTodoModalOpen = false}
/>

<!-- History Panel -->
<HistoryPanel 
    bind:isOpen={panelStore.isHistoryPanelOpen}
    onClose={() => panelStore.closeHistory()}
/>


<!-- Bookmark Panel -->
<BookmarkPanel bind:isOpen={panelStore.isBookmarkPanelOpen} />

<!-- Download Manager Panel -->
<DownloadManagerPanel bind:isOpen={panelStore.isDownloadPanelOpen} />

<!-- Edit Profile Window -->
<ProfileWindow
    bind:isOpen={isEditProfileModalOpen}
    mode="edit"
    editingProfile={editingProfile}
    clients={clients}
    isLoadingClients={isLoadingClients}
    onSuccess={handleProfileUpdateSuccess}
    onSelectClient={() => {}}
    onColorChange={() => {}}
/>
