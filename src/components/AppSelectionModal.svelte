<script>
    import { predefinedServices } from "../lib/services.svelte.js";
    import { X, Search, Check } from "lucide-svelte";

    // Props
    let { onAppsSelect = null, onClose = null, groupName = "" } = $props();

    let searchQuery = $state("");
    let selectedApps = $state([]); // Array of selected services
    let filteredServices = $derived(predefinedServices.filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase())));

    function close() {
        if (onClose) onClose();
    }

    function toggleApp(service) {
        const index = selectedApps.findIndex(s => s.name === service.name);
        if (index > -1) {
            // Remove from selection
            selectedApps = selectedApps.filter(s => s.name !== service.name);
        } else {
            // Add to selection
            if (service.name === "Custom") {
                // For custom, ask for URL and name immediately
                let url = prompt("Enter URL for custom service:", "https://");
                const name = prompt("Enter App Name:", "My App");
                if (url && name) {
                    // Normalize URL
                    url = url.trim();
                    if (!url.startsWith('http://') && !url.startsWith('https://')) {
                        url = 'https://' + url;
                    }
                    selectedApps = [...selectedApps, { ...service, customUrl: url, customName: name }];
                }
            } else {
                selectedApps = [...selectedApps, service];
            }
        }
    }

    function isSelected(service) {
        return selectedApps.some(s => s.name === service.name);
    }

    function handleConfirm() {
        if (selectedApps.length > 0 && onAppsSelect) {
            onAppsSelect(selectedApps);
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
            <div>
                <h2 class="text-2xl font-bold text-gray-800">Select Apps for "{groupName}"</h2>
                <p class="text-sm text-gray-500 mt-1">
                    {#if selectedApps.length > 0}
                        {selectedApps.length} app{selectedApps.length > 1 ? 's' : ''} selected
                    {:else}
                        Choose apps to add to this group
                    {/if}
                </p>
            </div>
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
                {@const selected = isSelected(service)}
                <button 
                    class="relative flex flex-col items-center justify-center p-6 rounded-xl transition-all group border-2 {selected ? 'bg-indigo-50 border-indigo-500 shadow-md' : 'bg-gray-50 border-gray-100 hover:border-indigo-300 hover:shadow-md hover:bg-indigo-50'}" 
                    on:click={() => toggleApp(service)}
                >
                    <!-- Checkmark -->
                    {#if selected}
                        <div class="absolute top-2 right-2 w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center">
                            <Check size={16} class="text-white" />
                        </div>
                    {/if}
                    
                    <div class="w-16 h-16 mb-4 rounded-2xl p-2 bg-white flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow border border-gray-100">
                        <img src={service.icon} alt={service.name} class="w-full h-full object-contain" />
                    </div>
                    <span class="font-medium {selected ? 'text-indigo-600' : 'text-gray-700 group-hover:text-indigo-600'}">{service.name}</span>
                </button>
            {/each}
        </div>
        
        <!-- Footer -->
        <div class="p-6 border-t border-gray-100 flex justify-between items-center">
            <button 
                on:click={close}
                class="px-6 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-xl transition-colors"
            >
                Cancel
            </button>
            <button 
                on:click={handleConfirm}
                disabled={selectedApps.length === 0}
                class="px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium rounded-xl transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Add {selectedApps.length > 0 ? `${selectedApps.length} App${selectedApps.length > 1 ? 's' : ''}` : 'Apps'}
            </button>
        </div>
    </div>
</div>
