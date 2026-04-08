<script>
    import {
        ChevronLeft,
        ChevronRight,
        RotateCw,
        Home,
        Search,
        Square,
        Download,
        StickyNote,
    } from "lucide-svelte";
    import { navigationStore } from "../lib/navigation.svelte.js";
    import { serviceStore } from "../lib/services.svelte.js";
    import { tabStore } from "../lib/tabs.svelte.js";
    import { workspaceStore } from "../lib/workspaces.svelte.js";
    import { notesStore } from "../lib/notes.svelte.js";
    import WindowControls from "./WindowControls.svelte";

    let { service = null } = $props();

    let urlInput = $state("");
    let isUrlFocused = $state(false);

    // Update notification state
    let updateInfo = $state(null); // { version, notes, downloadUrl }

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

    function handleUrlSubmit(e) {
        if (e.key === "Enter" && urlInput.trim()) {
            const input = urlInput.trim();
            console.log("[DEBUG] User pressed Enter. Raw Input:", input);

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
            console.log("[DEBUG] Parsed URL to navigate to:", url);

            // Case 1: Tab actively running in current service - navigate it
            if (service && activeTabId) {
                console.log(
                    "[DEBUG] Case 1: Active tab found. Tab ID:",
                    activeTabId,
                );
                // Eagerly update tab url to prevent visual snap-back
                tabStore.updateTab(service.id, activeTabId, { url });
                navigationStore.navigate(url);
            }
            // Case 2: We are inside an empty Service (no tabs) - add new tab
            else if (service) {
                console.log(
                    "[DEBUG] Case 2: Service exists but no tabs. Adding new tab...",
                );
                tabStore.addTab(service.id, url, "New Tab");
            }
            // Case 3: We are inside an empty Workspace (no services) - add new service
            else {
                console.log(
                    "[DEBUG] Case 3: Completely empty workspace. Initializing new service...",
                );
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

            e.target.blur();
        }
    }
</script>

<div
    class="bg-[#2c4a4a] flex items-center shrink-0 h-12 px-1 gap-2"
    style="-webkit-app-region: drag"
>
    <!-- Navigation Buttons -->
    <div
        class="flex items-center gap-1 pl-2"
        style="-webkit-app-region: no-drag"
    >
        <button
            class="p-1.5 rounded-lg hover:bg-white/10 transition-colors {canGoBack
                ? 'text-white hover:text-gray-100'
                : 'text-gray-500 cursor-not-allowed'}"
            title="Back"
            onclick={() => navigationStore.goBack()}
            disabled={!canGoBack}
        >
            <ChevronLeft size={18} />
        </button>
        <button
            class="p-1.5 rounded-lg hover:bg-white/10 transition-colors {canGoForward
                ? 'text-white hover:text-gray-100'
                : 'text-gray-500 cursor-not-allowed'}"
            title="Forward"
            onclick={() => navigationStore.goForward()}
            disabled={!canGoForward}
        >
            <ChevronRight size={18} />
        </button>
        {#if isLoading}
            <button
                class="p-1.5 rounded-lg hover:bg-white/10 text-red-400 hover:text-red-300 transition-colors"
                title="Stop"
                onclick={() => navigationStore.stop()}
            >
                <Square size={14} />
            </button>
        {:else}
            <button
                class="p-1.5 rounded-lg hover:bg-white/10 text-white hover:text-gray-100 transition-colors"
                title="Reload"
                onclick={() => navigationStore.reload()}
            >
                <RotateCw size={16} />
            </button>
        {/if}
        <button
            class="p-1.5 rounded-lg hover:bg-white/10 text-white hover:text-gray-100 transition-colors"
            title="Home"
            onclick={() => service && navigationStore.goHome(service.url)}
        >
            <Home size={16} />
        </button>
    </div>

    <!-- URL Input -->
    <div
        class="flex items-center gap-2 px-3 py-1.5 bg-black/30 rounded-lg min-w-[200px] max-w-[500px] flex-1 {isUrlFocused
            ? 'ring-2 ring-pink-500/50 bg-black/40'
            : ''}"
        style="-webkit-app-region: no-drag"
    >
        {#if isLoading}
            <div
                class="w-3.5 h-3.5 border-2 border-pink-400 border-t-transparent rounded-full animate-spin shrink-0"
            ></div>
        {:else}
            <Search size={14} class="text-gray-400 shrink-0" />
        {/if}
        <input
            type="text"
            bind:value={urlInput}
            onfocus={() => (isUrlFocused = true)}
            onblur={() => (isUrlFocused = false)}
            onkeydown={handleUrlSubmit}
            placeholder="Search Google or type a URL"
            class="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-500 outline-none w-full"
        />
    </div>

    <div class="flex-1"></div>

    <!-- Sticky Notes Button -->
    <div style="-webkit-app-region: no-drag" class="mr-2">
        <button
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-500 hover:text-yellow-400 text-sm font-medium transition-colors"
            title="Tambah Catatan"
            onclick={() => {
                if (workspaceStore.activeWorkspaceId) {
                    notesStore.addNote(
                        workspaceStore.activeWorkspaceId,
                        window.innerWidth / 2 - 125,
                        window.innerHeight / 2 - 125,
                    );
                }
            }}
        >
            <StickyNote size={16} />
            <span>Add Note</span>
        </button>
    </div>

    <!-- Update Available Badge -->
    {#if updateInfo}
        <button
            type="button"
            class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-medium cursor-pointer hover:bg-emerald-500/30 transition-colors"
            style="-webkit-app-region: no-drag"
            title={updateInfo.notes || "New version available"}
            onclick={openDownloadPage}
        >
            <Download size={12} />
            <span>v{updateInfo.version} tersedia</span>
        </button>
    {/if}

    <!-- Window Controls -->
    <WindowControls variant="dark" />
</div>
