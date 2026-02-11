<script>
    import { serviceStore } from "../lib/services.svelte.js";
    import { Plus, Settings, MessageSquare, Menu } from "lucide-svelte";

    // We bind to the global store
    let { services, activeServiceId, activeService } = $derived(serviceStore); // activeService doesn't exist on store yet, need helper

    function handleServiceClick(id) {
        serviceStore.setActive(id);
    }

    function handleAddService() {
        // Open modal (handled by parent or global state)
        // For now console log
        console.log("Add service clicked");
        // Actually we need a way to invoke the modal.
        // Let's use a custom event dispatch or a new store state `isModalOpen`
        // Since we are using a global store, adding `isAddModalOpen` to it is easy.
        serviceStore.toggleAddModal(true); // Need to add this method to store
    }
</script>

<div class="w-16 h-full bg-gray-900 text-white flex flex-col items-center py-4 space-y-4 shrink-0 overflow-y-auto custom-scrollbar border-r border-gray-800">
    <!-- Optional: App Icon / Home -->
    <button class="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center hover:bg-indigo-500 transition-colors mb-2">
        <MessageSquare size={20} />
    </button>

    <div class="w-8 h-px bg-gray-700 my-2"></div>

    <!-- Service List -->
    {#each serviceStore.services as service (service.id)}
        <div class="relative group">
            <!-- Active Indicator -->
            {#if serviceStore.activeServiceId === service.id}
                <div class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-r-lg"></div>
            {/if}

            <!-- Unread Badge -->
            {#if service.unreadCount > 0}
                <div class="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full text-[10px] flex items-center justify-center border-2 border-gray-900 z-10 font-bold">
                    {service.unreadCount > 99 ? "99+" : service.unreadCount}
                </div>
            {/if}

            <button
                class="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 overflow-hidden relative
                    {serviceStore.activeServiceId === service.id ? 'bg-indigo-500 rounded-xl shadow-lg shadow-indigo-500/30' : 'bg-gray-800 hover:bg-gray-700 hover:rounded-xl text-gray-400 hover:text-white'}"
                on:click={() => handleServiceClick(service.id)}
                title={service.name}>
                {#if service.icon}
                    <img src={service.icon} alt={service.name} class="w-6 h-6 object-contain pointer-events-none" />
                {:else}
                    <span class="text-xs font-bold">{service.name.substring(0, 2).toUpperCase()}</span>
                {/if}
            </button>

            <!-- Tooltip on hover (simple native title for now, or custom) -->
        </div>
    {/each}

    <div class="flex-1"></div>

    <!-- Add Button -->
    <button class="w-10 h-10 rounded-full bg-gray-800 hover:bg-green-600 text-green-500 hover:text-white transition-colors flex items-center justify-center group" on:click={handleAddService} title="Add New Service">
        <Plus size={20} />
    </button>

    <!-- Settings -->
    <button class="w-10 h-10 rounded-full bg-transparent hover:bg-gray-800 text-gray-400 hover:text-white transition-colors flex items-center justify-center mt-2">
        <Settings size={20} />
    </button>
</div>

<style>
    /* Hide scrollbar but keep functionality */
    .custom-scrollbar::-webkit-scrollbar {
        width: 0px;
        background: transparent;
    }
</style>
