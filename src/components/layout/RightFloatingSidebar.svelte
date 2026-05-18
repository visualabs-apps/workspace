<script>
    import { Target, Cookie, Bookmark, ChevronLeft } from "lucide-svelte";
    import { workspaceStore } from "../../lib/stores/workspaces.svelte.js";
    import { openPredefinedWindow } from "../../lib/utils/childWindow.js";
    import { panelStore } from "../../lib/stores/panels.svelte.js";
    
    let { 
        onOpenTarget = () => {}
    } = $props();

    let isActive = $state(false);

    function toggleSidebar(e) {
        e.preventDefault();
        isActive = !isActive;
    }

    function handleManageCookies() {
        const workspace = workspaceStore.activeWorkspace;
        if (workspace) {
            const partition = `persist:workspace-${workspace.id}`;
            openPredefinedWindow('COOKIE_MANAGER', { partition, profileId: workspace.id });
        } else {
            openPredefinedWindow('COOKIE_MANAGER');
        }
    }

    function handleBookmarks() {
        panelStore.openBookmarks();
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
        class="sidebarItem relative flex flex-col items-center justify-center w-full py-3 px-2 border-b border-gray-200/50 transition-all duration-300 group hover:bg-blue-50/80 rounded-tl-2xl"
    >
        <div class="p-2 rounded-xl bg-white group-hover:bg-blue-500 transition-all duration-300 shadow-sm group-hover:shadow-md group-hover:scale-110">
            <Target size={22} class="text-gray-600 group-hover:text-white transition-all duration-300" strokeWidth={2} />
        </div>
        <span class="text-[10px] text-gray-500 group-hover:text-blue-600 font-medium mt-1 transition-colors">Target</span>
    </button>

    <!-- Sidebar Item - Bookmarks -->
    <button
        onclick={handleBookmarks}
        class="sidebarItem relative flex flex-col items-center justify-center w-full py-3 px-2 border-b border-gray-200/50 transition-all duration-300 group hover:bg-purple-50/80"
    >
        <div class="p-2 rounded-xl bg-white group-hover:bg-purple-500 transition-all duration-300 shadow-sm group-hover:shadow-md group-hover:scale-110">
            <Bookmark size={22} class="text-gray-600 group-hover:text-white transition-all duration-300" strokeWidth={2} />
        </div>
        <span class="text-[10px] text-gray-500 group-hover:text-purple-600 font-medium mt-1 transition-colors">Bookmarks</span>
    </button>

    <!-- Sidebar Item - Manage Cookies -->
    <button
        onclick={handleManageCookies}
        class="sidebarItem relative flex flex-col items-center justify-center w-full py-3 px-2 transition-all duration-300 group hover:bg-amber-50/80 rounded-bl-2xl"
    >
        <div class="p-2 rounded-xl bg-white group-hover:bg-amber-500 transition-all duration-300 shadow-sm group-hover:shadow-md group-hover:scale-110">
            <Cookie size={22} class="text-gray-600 group-hover:text-white transition-all duration-300" strokeWidth={2} />
        </div>
        <span class="text-[10px] text-gray-500 group-hover:text-amber-600 font-medium mt-1 transition-colors">Cookies</span>
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




