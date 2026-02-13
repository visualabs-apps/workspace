<script>
    import { serviceStore, predefinedServices } from "../lib/services.svelte.js";
    import { workspaceStore } from "../lib/workspaces.svelte.js";
    import { X, Search } from "lucide-svelte";

    // Props
    let { onClose = null } = $props();

    // Derived state
    let activeWorkspace = $derived(workspaceStore.activeWorkspace);

    let searchQuery = $state("");
    let filteredServices = $derived(predefinedServices.filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase())));

    function close() {
        serviceStore.setAddModalOpen(false);
        if (onClose) onClose();
    }

    function add(service) {
        let newService = null;
        
        // Always ask for group name
        const groupName = prompt("Enter Group Name:", service.name === "Custom" ? "My Group" : service.name);
        if (!groupName) return; // User cancelled
        
        if (service.name === "Custom") {
            // Logic for custom service
            let url = prompt("Enter URL for custom service:", "https://");
            const name = prompt("Enter App Name:", "My App");
            if (url && name) {
                // Normalize URL
                url = url.trim();
                if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    url = 'https://' + url;
                }
                newService = serviceStore.addService(service, url, name, groupName);
            }
        } else {
            newService = serviceStore.addService(service, null, null, groupName);
        }

        // Add to active workspace
        if (newService && activeWorkspace) {
            workspaceStore.addAppToWorkspace(activeWorkspace.id, newService.id);
        }
        
        close();
    }
</script>

<!-- Backdrop -->
<div class="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" on:click={close}>
    <!-- Modal Content -->
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden border border-gray-200" on:click|stopPropagation>
        <!-- Header -->
        <div class="p-6 border-b border-gray-100 flex items-center justify-between">
            <h2 class="text-2xl font-bold text-gray-800">Add App</h2>
            <button on:click={close} class="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
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

        <!-- Grid -->
        <div class="flex-1 overflow-y-auto p-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {#each filteredServices as service}
                <button class="flex flex-col items-center justify-center p-6 rounded-xl bg-gray-50 hover:bg-indigo-50 transition-all group border border-gray-100 hover:border-indigo-300 hover:shadow-md" on:click={() => add(service)}>
                    <div class="w-16 h-16 mb-4 rounded-2xl p-2 bg-white flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow border border-gray-100">
                        <img src={service.icon} alt={service.name} class="w-full h-full object-contain" />
                    </div>
                    <span class="font-medium text-gray-700 group-hover:text-indigo-600">{service.name}</span>
                </button>
            {/each}
        </div>
    </div>
</div>
