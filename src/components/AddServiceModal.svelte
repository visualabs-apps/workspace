<script>
    import { serviceStore, predefinedServices } from "../lib/services.svelte.js";
    import { X, Search } from "lucide-svelte";

    let searchQuery = $state("");
    let filteredServices = $derived(predefinedServices.filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase())));

    function close() {
        serviceStore.setAddModalOpen(false);
    }

    function add(service) {
        if (service.name === "Custom") {
            // Logic for custom service later. For now add google as placeholder or prompt
            const url = prompt("Enter URL for custom service:", "https://");
            const name = prompt("Enter Name:", "My App");
            if (url && name) {
                serviceStore.addService(service, url, name);
            }
        } else {
            serviceStore.addService(service);
        }
        close();
    }
</script>

<!-- Backdrop -->
<div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" on:click={close}>
    <!-- Modal Content -->
    <div class="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden border border-gray-800" on:click|stopPropagation>
        <!-- Header -->
        <div class="p-6 border-b border-gray-800 flex items-center justify-between">
            <h2 class="text-2xl font-bold dark:text-white">Add Service</h2>
            <button on:click={close} class="p-2 hover:bg-gray-800 rounded-full dark:text-gray-400 dark:hover:text-white transition-colors">
                <X size={24} />
            </button>
        </div>

        <!-- Search -->
        <div class="p-6 pb-2">
            <div class="relative">
                <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                <input type="text" bind:value={searchQuery} placeholder="Search for a service..." class="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
        </div>

        <!-- Grid -->
        <div class="flex-1 overflow-y-auto p-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {#each filteredServices as service}
                <button class="flex flex-col items-center justify-center p-6 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all group border border-transparent hover:border-indigo-500" on:click={() => add(service)}>
                    <div class="w-16 h-16 mb-4 rounded-2xl p-2 bg-white flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                        <img src={service.icon} alt={service.name} class="w-full h-full object-contain" />
                    </div>
                    <span class="font-medium dark:text-white">{service.name}</span>
                </button>
            {/each}
        </div>
    </div>
</div>
