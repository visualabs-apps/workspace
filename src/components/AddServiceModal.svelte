<script>
    import { serviceStore, predefinedServices } from "../lib/services.svelte.js";
    import { workspaceStore } from "../lib/workspaces.svelte.js";
    import { X, Search, Plus, Globe } from "lucide-svelte";

    // Props
    let { onClose = null } = $props();

    // Derived state
    let activeWorkspace = $derived(workspaceStore.activeWorkspace);

    let searchQuery = $state("");
    let filteredServices = $derived(predefinedServices.filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase())));

    // Form state for custom app
    let showCustomForm = $state(false);
    let customName = $state("");
    let customUrl = $state("https://");
    let customUrlError = $state("");

    function close() {
        serviceStore.setAddModalOpen(false);
        if (onClose) onClose();
    }

    function add(service) {
        if (service.name === "Custom") {
            showCustomForm = true;
            return;
        }

        // Create service directly without group name prompt
        const newService = serviceStore.addService(
            service, 
            null, 
            null, 
            service.name, // Use service name as group name
            activeWorkspace?.id
        );

        // Add to active workspace
        if (newService && activeWorkspace) {
            workspaceStore.addAppToWorkspace(activeWorkspace.id, newService.id);
        }
        
        close();
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
        
        const customService = predefinedServices.find(s => s.name === "Custom");
        const newService = serviceStore.addService(
            customService, 
            url, 
            name, 
            name, // Use app name as group name
            activeWorkspace?.id
        );

        // Add to active workspace
        if (newService && activeWorkspace) {
            workspaceStore.addAppToWorkspace(activeWorkspace.id, newService.id);
        }

        close();
    }

    function cancelCustom() {
        showCustomForm = false;
        customName = "";
        customUrl = "https://";
        customUrlError = "";
    }
</script>

<!-- Backdrop -->
<div class="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" role="presentation" onclick={close}>
    <!-- Modal Content -->
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden border border-gray-200" role="presentation" onclick={(e) => e.stopPropagation()}>
        <!-- Header -->
        <div class="p-6 border-b border-gray-100 flex items-center justify-between">
            <h2 class="text-2xl font-bold text-gray-800">Add App</h2>
            <button onclick={close} class="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
                <X size={24} />
            </button>
        </div>

        <!-- Search -->
        <div class="p-6 pb-2">
            <div class="relative">
                <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input type="text" bind:value={searchQuery} placeholder="Search for an app..." class="w-full bg-gray-50 text-gray-900 pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
            </div>
        </div>

        <!-- Custom app form -->
        {#if showCustomForm}
            <div class="mx-6 mb-4 p-4 rounded-xl border-2 border-indigo-400 bg-indigo-50">
                <p class="text-sm font-semibold text-indigo-700 flex items-center gap-2 mb-3">
                    <Globe size={16} /> Add Custom App
                </p>
                <div class="space-y-3">
                    <div>
                        <input
                            type="text"
                            bind:value={customName}
                            placeholder="App name (e.g. My Dashboard)"
                            class="w-full bg-white text-gray-900 px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        />
                    </div>
                    <div>
                        <input
                            type="text"
                            bind:value={customUrl}
                            placeholder="https://yourapp.com"
                            class="w-full bg-white text-gray-900 px-3 py-2 rounded-lg border {customUrlError ? 'border-red-400' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        />
                        {#if customUrlError}
                            <p class="text-xs text-red-500 mt-1">{customUrlError}</p>
                        {/if}
                    </div>
                    <div class="flex gap-2">
                        <button
                            onclick={handleCustomSubmit}
                            class="flex-1 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium transition-colors"
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
        <div class="flex-1 overflow-y-auto p-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {#each filteredServices as service}
                <button 
                    class="flex flex-col items-center justify-center p-6 rounded-xl transition-all group border {service.name === 'Custom' && showCustomForm ? 'bg-indigo-100 border-indigo-300' : 'bg-gray-50 hover:bg-indigo-50 border-gray-100 hover:border-indigo-300 hover:shadow-md'}" 
                    onclick={() => add(service)}
                >
                    <div class="w-16 h-16 mb-4 rounded-2xl p-2 bg-white flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow border border-gray-100">
                        <img src={service.icon} alt={service.name} class="w-full h-full object-contain" />
                    </div>
                    <span class="font-medium {service.name === 'Custom' && showCustomForm ? 'text-indigo-600' : 'text-gray-700 group-hover:text-indigo-600'}">{service.name}</span>
                    {#if service.name === "Custom"}
                        <span class="text-xs text-gray-400 mt-1">Enter your URL</span>
                    {/if}
                </button>
            {/each}
        </div>
    </div>
</div>
