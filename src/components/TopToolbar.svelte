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
    import { navigationStore } from "../lib/navigation.svelte.js";
    import { serviceStore } from "../lib/services.svelte.js";
    import { tabStore } from "../lib/tabs.svelte.js";
    import { workspaceStore } from "../lib/workspaces.svelte.js";
    import { bookmarkStore } from "../lib/bookmarks.svelte.js";
    import { toastStore } from "../lib/toast.svelte.js";
    import WindowControls from "./WindowControls.svelte";
    import AutocompleteDropdown from "./AutocompleteDropdown.svelte";
    import HistoryPanel from "./HistoryPanel.svelte";
    import TodoModal from "./TodoModal.svelte";
    import BookmarkPanel from "./BookmarkPanel.svelte";
    import DownloadManagerPanel from "./DownloadManagerPanel.svelte";
    import ProfileDropdown from "./ProfileDropdown.svelte";
    import Dropdown from "./Dropdown.svelte";

    let { service = null } = $props();

    let urlInput = $state("");
    let isUrlFocused = $state(false);
    let isTodoModalOpen = $state(false);
    let showAutocomplete = $state(false);
    let isHistoryPanelOpen = $state(false);
    let isBookmarkPanelOpen = $state(false);
    let isDownloadPanelOpen = $state(false);
    let showBrowserMenu = $state(false);
    let isBookmarked = $state(false);

    // Update notification state
    let updateInfo = $state(null); // { version, notes, downloadUrl }
    
    // Get active workspace
    let activeWorkspace = $derived(workspaceStore.activeWorkspace);

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
            case 'new-tab':
                // Create new service/tab
                const newService = serviceStore.addService(
                    {
                        name: "New Tab",
                        url: "https://www.google.com",
                        icon: null,
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
                break;
            case 'todo-list':
                isTodoModalOpen = true;
                break;
            case 'history':
                isHistoryPanelOpen = true;
                break;
            case 'bookmarks':
                isBookmarkPanelOpen = true;
                break;
            case 'downloads':
                isDownloadPanelOpen = true;
                break;
            case 'settings':
                // TODO: Open settings
                break;
            case 'help':
                // TODO: Open help
                break;
        }
    }

    function toggleBrowserMenu(e) {
        e.stopPropagation();
        showBrowserMenu = !showBrowserMenu;
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
    <ProfileDropdown />

    <!-- Download Manager Icon -->
    <button
        type="button"
        onclick={() => isDownloadPanelOpen = true}
        class="p-2 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-gray-800 transition-colors"
        style="-webkit-app-region: no-drag"
        title="Downloads (Ctrl+J)"
    >
        <DownloadIcon size={20} />
    </button>

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
            <!-- New Tab -->
            <button
                onclick={() => handleBrowserMenuClick('new-tab')}
                class="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
            >
                <Square size={16} />
                New tab
                <span class="ml-auto text-xs text-gray-400">Ctrl+T</span>
            </button>
            
            <hr class="my-2 border-gray-100" />
            
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
                History
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
                Downloads
                <span class="ml-auto text-xs text-gray-400">Ctrl+J</span>
            </button>
            
            <hr class="my-2 border-gray-100" />
            
            <!-- Settings & Help -->
            <button
                onclick={() => handleBrowserMenuClick('settings')}
                class="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
            >
                <Settings size={16} />
                Settings
            </button>
            <button
                onclick={() => handleBrowserMenuClick('help')}
                class="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
            >
                <HelpCircle size={16} />
                Help
            </button>
        {/snippet}
    </Dropdown>

    <!-- Window Controls -->
    <WindowControls variant="light" />
</div>

<!-- Todo Modal -->
<TodoModal 
    isOpen={isTodoModalOpen}
    onClose={() => isTodoModalOpen = false}
/>

<!-- History Panel -->
<HistoryPanel 
    isOpen={isHistoryPanelOpen}
    onClose={() => isHistoryPanelOpen = false}
/>


<!-- Bookmark Panel -->
<BookmarkPanel bind:isOpen={isBookmarkPanelOpen} />

<!-- Download Manager Panel -->
<DownloadManagerPanel bind:isOpen={isDownloadPanelOpen} />
