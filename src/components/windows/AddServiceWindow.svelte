<script>
    import BaseWindow from "../base/BaseWindow.svelte";
    import { appStore, predefinedApps } from "../../lib/stores/apps.svelte.js";
    import { workspaceStore } from "../../lib/stores/workspaces.svelte.js";
    import { Search, Globe } from "lucide-svelte";

    let { isOpen = $bindable(false), onClose = () => {} } = $props();

    let activeWorkspace = $derived(workspaceStore.activeWorkspace);
    let searchQuery = $state("");
    let filteredServices = $derived(predefinedApps.filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase())));

    let showCustomForm = $state(false);
    let customName = $state("");
    let customUrl = $state("https://");
    let customUrlError = $state("");

    function handleClose() {
        isOpen = false;
        showCustomForm = false;
        customName = "";
        customUrl = "https://";
        customUrlError = "";
        searchQuery = "";
        onClose();
    }

    function add(app) {
        if (app.name === "Custom") {
            showCustomForm = true;
            return;
        }

        const newApp = appStore.addApp(
            app, 
            null, 
            null, 
            app.name,
            activeWorkspace?.id
        );

        if (newApp && activeWorkspace) {
            workspaceStore.addAppToWorkspace(activeWorkspace.id, newApp.id);
        }
        
        handleClose();
    }

    function handleCustomSubmit() {
        customUrlError = "";
        let url = customUrl.trim();
        if (!url || url === "https://") {
            customUrlError = "Please enter a valid URL.";
            return;
        }
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            url = "https://" + url;
        }
        const name = customName.trim() || "My App";
        
        const customService = predefinedApps.find(s => s.name === "Custom");
        const newApp = appStore.addApp(
            customService, 
            url, 
            name, 
            name,
            activeWorkspace?.id
        );

        if (newApp && activeWorkspace) {
            workspaceStore.addAppToWorkspace(activeWorkspace.id, newApp.id);
        }

        handleClose();
    }

    function cancelCustom() {
        showCustomForm = false;
        customName = "";
        customUrl = "https://";
        customUrlError = "";
    }
</script>

<BaseWindow
    bind:isOpen
    windowId="add-app-window"
    title="Add App"
    subtitle="Choose an app to add"
    width="900px"
    height="700px"
    showCloseButton={true}
    showMaximizeButton={true}
    onClose={handleClose}
>
    {#snippet children()}
        <!-- Search -->
        <div class="mb-4">
            <div class="relative">
                <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input 
                    type="text" 
                    bind:value={searchQuery} 
                    placeholder="Search for an app..." 
                    class="w-full bg-gray-50 text-gray-900 pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                />
            </div>
        </div>

        <!-- Custom app form -->
        {#if showCustomForm}
            <div class="mb-4 p-4 rounded-xl border-2 border-blue-400 bg-blue-50">
                <p class="text-sm font-semibold text-blue-700 flex items-center gap-2 mb-3">
                    <Globe size={16} /> Add Custom App
                </p>
                <div class="space-y-3">
                    <input
                        type="text"
                        bind:value={customName}
                        placeholder="App name (e.g. My Dashboard)"
                        class="w-full bg-white text-gray-900 px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    <input
                        type="text"
                        bind:value={customUrl}
                        placeholder="https://yourapp.com"
                        class="w-full bg-white text-gray-900 px-3 py-2 rounded-lg border {customUrlError ? 'border-red-400' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    {#if customUrlError}
                        <p class="text-xs text-red-500">{customUrlError}</p>
                    {/if}
                    <div class="flex gap-2">
                        <button
                            onclick={handleCustomSubmit}
                            class="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            Add App
                        </button>
                        <button
                            onclick={cancelCustom}
                            class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        {/if}

        <!-- Grid -->
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto" style="max-height: 450px;">
            {#each filteredServices as app}
                <button 
                    class="flex flex-col items-center justify-center p-6 rounded-xl transition-all group border {app.name === 'Custom' && showCustomForm ? 'bg-blue-100 border-blue-300' : 'bg-gray-50 hover:bg-blue-50 border-gray-100 hover:border-blue-300 hover:shadow-md'}" 
                    onclick={() => add(app)}
                >
                    <div class="w-16 h-16 mb-4 rounded-2xl p-2 bg-white flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow border border-gray-100">
                        <img src={app.icon} alt={app.name} class="w-full h-full object-contain" />
                    </div>
                    <span class="font-medium {app.name === 'Custom' && showCustomForm ? 'text-blue-600' : 'text-gray-700 group-hover:text-blue-600'}">{app.name}</span>
                    {#if app.name === "Custom"}
                        <span class="text-xs text-gray-400 mt-1">Enter your URL</span>
                    {/if}
                </button>
            {/each}
        </div>
    {/snippet}
</BaseWindow>






