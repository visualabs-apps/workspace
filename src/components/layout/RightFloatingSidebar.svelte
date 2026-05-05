<script>
    import { Target, Bell, ChevronLeft } from "lucide-svelte";
    import { toastStore } from "../../lib/managers/toast.svelte.js";
    
    let { 
        onOpenTarget = () => {}
    } = $props();

    let isActive = $state(false);

    function toggleSidebar(e) {
        e.preventDefault();
        isActive = !isActive;
    }
    
    // Computed classes
    let containerClass = $derived(isActive ? 'right-0' : '-right-20');
    let buttonClass = $derived(isActive 
        ? 'bg-white border-gray-200 shadow-md hover:bg-blue-50' 
        : 'bg-gradient-to-br from-blue-600 to-blue-500 border-blue-500 shadow-lg'
    );
    let chevronClass = $derived(isActive 
        ? 'rotate-180 text-gray-600' 
        : 'rotate-0 text-white'
    );
</script>

<!-- Fixed Sidebar Right -->
<div 
    class="fixed z-[200] top-1/2 -translate-y-1/2 flex flex-col justify-center items-center w-20 bg-gradient-to-br from-white to-gray-50 rounded-tl-2xl rounded-bl-2xl border border-gray-200 backdrop-blur-sm transition-all duration-300 ease-in-out {containerClass}"
    style="box-shadow: 0 10px 40px -10px rgba(0,0,0,0.15);"
>
    
    <!-- Sidebar Item - Target -->
    <button
        onclick={onOpenTarget}
        class="sidebarItem relative flex flex-col items-center justify-center w-full py-4 px-2 border-b border-gray-200/50 transition-all duration-300 group hover:bg-blue-50/80 rounded-tl-2xl"
    >
        <div class="p-2 rounded-xl bg-white group-hover:bg-blue-500 transition-all duration-300 shadow-sm group-hover:shadow-md group-hover:scale-110">
            <Target size={24} class="text-gray-600 group-hover:text-white transition-all duration-300" strokeWidth={2} />
        </div>
        
        <!-- Tooltip - Only show when panel is active -->
        {#if isActive}
            <div class="absolute top-1/2 left-full -translate-y-1/2 ml-3 px-3 py-2 text-sm font-medium whitespace-nowrap text-white rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 opacity-0 invisible pointer-events-none transition-all duration-200 group-hover:opacity-100 group-hover:visible group-hover:ml-4 shadow-lg z-[300]">
                Target Dashboard
                <div class="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-r-[6px] border-r-blue-600"></div>
            </div>
        {/if}
    </button>

    <!-- Sidebar Item - Notification -->
    <button
        onclick={() => toastStore.info('Notification feature coming soon!')}
        class="sidebarItem relative flex flex-col items-center justify-center w-full py-4 px-2 transition-all duration-300 group hover:bg-purple-50/80 rounded-bl-2xl"
    >
        <div class="p-2 rounded-xl bg-white group-hover:bg-purple-500 transition-all duration-300 shadow-sm group-hover:shadow-md group-hover:scale-110">
            <Bell size={24} class="text-gray-600 group-hover:text-white transition-all duration-300" strokeWidth={2} />
        </div>
        
        <!-- Tooltip - Only show when panel is active -->
        {#if isActive}
            <div class="absolute top-1/2 left-full -translate-y-1/2 ml-3 px-3 py-2 text-sm font-medium whitespace-nowrap text-white rounded-lg bg-gradient-to-r from-purple-600 to-purple-500 opacity-0 invisible pointer-events-none transition-all duration-200 group-hover:opacity-100 group-hover:visible group-hover:ml-4 shadow-lg z-[300]">
                Notifications (Coming Soon)
                <div class="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-r-[6px] border-r-purple-600"></div>
            </div>
        {/if}
    </button>

    <!-- Button Trigger -->
    <button
        onclick={toggleSidebar}
        class="buttonTrigger absolute top-1/2 right-full -translate-y-1/2 -mr-px py-5 px-1.5 rounded-tl-lg rounded-bl-lg border border-r-0 transition-all duration-300 ease-in-out hover:scale-105 active:scale-95 {buttonClass}"
    >
        <ChevronLeft 
            size={18} 
            class="transition-all duration-300 {chevronClass}"
            strokeWidth={2.5}
        />
    </button>
</div>




