<script>
    import Sidebar from "./components/Sidebar.svelte";
    import ServiceView from "./components/ServiceView.svelte";
    import AddServiceModal from "./components/AddServiceModal.svelte";
    import { serviceStore } from "./lib/services.svelte.js";
    import { onMount } from "svelte";

    // No need for top level state, everything is in store
    // But we need to subscribe to show modal
    // Direct usage of serviceStore in template is preferred for Svelte 5 Runes when object is global state
    // aliases for cleaner template
    let services = $derived(serviceStore.services);
    let activeServiceId = $derived(serviceStore.activeServiceId);
    let isAddModalOpen = $derived(serviceStore.isAddModalOpen);
</script>

<div class="flex h-screen w-screen overflow-hidden bg-gray-950 text-white font-sans selection:bg-indigo-500 selection:text-white">
    <!-- Sidebar -->
    <Sidebar />

    <!-- Main Content Area -->
    <div class="flex-1 flex flex-col relative h-full w-full bg-white dark:bg-gray-900">
        {#if services.length === 0}
            <div class="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center select-none">
                <div class="mb-6 opacity-20">
                    <svg width="120" height="120" viewBox="0 0 24 24" fill="none" class="stroke-current" stroke-width="1">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                        <line x1="8" y1="21" x2="16" y2="21"></line>
                        <line x1="12" y1="17" x2="12" y2="21"></line>
                    </svg>
                </div>
                <h2 class="text-2xl font-semibold mb-2 text-gray-600 dark:text-gray-300">No Services Added</h2>
                <p class="max-w-md mb-8 text-gray-500">Add your favorite apps to get started with your workspace.</p>
                <button class="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2" on:click={() => serviceStore.setAddModalOpen(true)}> Add First Service </button>
            </div>
        {:else}
            <!-- Render ALL active services but hide inactive ones (keep alive) -->
            {#each services as service (service.id)}
                <div class="absolute inset-0 w-full h-full" style:z-index={activeServiceId === service.id ? 10 : 0} style:visibility={activeServiceId === service.id ? "visible" : "hidden"}>
                    <ServiceView {service} isActive={activeServiceId === service.id} />
                </div>
            {/each}
        {/if}
    </div>

    <!-- Modals -->
    {#if isAddModalOpen}
        <AddServiceModal />
    {/if}
</div>

<style>
    :global(body) {
        @apply bg-gray-950 text-white overflow-hidden m-0 p-0;
    }
</style>
