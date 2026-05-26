<script>
    import { Target, Cookie, Bookmark, ChevronLeft, Sparkles } from "lucide-svelte";
    import { workspaceStore } from "../../lib/stores/workspaces.svelte.js";
    import { openPredefinedWindow } from "../../lib/utils/childWindow.js";
    import { panelStore } from "../../lib/stores/panels.svelte.js";
    import { aiChatStore } from "../../lib/stores/aiChatStore.svelte.js";
    
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

    function handleAIChat() {
        aiChatStore.toggle();
    }
    
    // Computed classes
    let containerClass = $derived(isActive ? 'right-0' : '-right-20');
    let buttonClass = $derived(isActive 
        ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-md hover:bg-blue-50 dark:hover:bg-blue-900/30' 
        : 'bg-gradient-to-br from-blue-600 to-blue-500 dark:from-blue-700 dark:to-blue-600 border-blue-500 dark:border-blue-600 shadow-lg'
    );
    let chevronClass = $derived(isActive 
        ? 'rotate-180 text-gray-600 dark:text-gray-300' 
        : 'rotate-0 text-white'
    );
</script>

<!-- Fixed Sidebar Right -->
<div 
    class="fixed z-[200] top-1/2 -translate-y-1/2 flex flex-col justify-center items-center w-20 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-tl-2xl rounded-bl-2xl border border-gray-200 dark:border-gray-700 backdrop-blur-sm transition-all duration-300 ease-in-out select-none {containerClass}"
    style="box-shadow: 0 10px 40px -10px rgba(0,0,0,0.15);"
>
    
    <!-- Sidebar Item - AI Chat -->
    <button
        onclick={handleAIChat}
        class="sidebarItem relative flex flex-col items-center justify-center w-full py-3 px-2 border-b border-gray-200/50 dark:border-gray-700/50 transition-all duration-300 group hover:bg-gradient-to-br hover:from-blue-50 hover:to-purple-50 dark:hover:from-blue-900/30 dark:hover:to-purple-900/30 rounded-tl-2xl"
    >
        <div class="p-2 rounded-xl bg-white dark:bg-gray-700 group-hover:bg-gradient-to-br group-hover:from-blue-500 group-hover:to-purple-500 transition-all duration-300 shadow-sm group-hover:shadow-md group-hover:scale-110">
            <Sparkles size={22} class="text-gray-600 dark:text-gray-300 group-hover:text-white transition-all duration-300" strokeWidth={2} />
        </div>
        <span class="text-[10px] text-gray-500 dark:text-gray-400 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-purple-600 dark:group-hover:from-blue-400 dark:group-hover:to-purple-400 font-medium mt-1 transition-colors">AI Agent</span>
    </button>

    <!-- Sidebar Item - Target -->
    <button
        onclick={onOpenTarget}
        class="sidebarItem relative flex flex-col items-center justify-center w-full py-3 px-2 border-b border-gray-200/50 dark:border-gray-700/50 transition-all duration-300 group hover:bg-blue-50/80 dark:hover:bg-blue-900/30"
    >
        <div class="p-2 rounded-xl bg-white dark:bg-gray-700 group-hover:bg-blue-500 transition-all duration-300 shadow-sm group-hover:shadow-md group-hover:scale-110">
            <Target size={22} class="text-gray-600 dark:text-gray-300 group-hover:text-white transition-all duration-300" strokeWidth={2} />
        </div>
        <span class="text-[10px] text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 font-medium mt-1 transition-colors">Target</span>
    </button>

    <!-- Sidebar Item - Bookmarks -->
    <button
        onclick={handleBookmarks}
        class="sidebarItem relative flex flex-col items-center justify-center w-full py-3 px-2 border-b border-gray-200/50 dark:border-gray-700/50 transition-all duration-300 group hover:bg-purple-50/80 dark:hover:bg-purple-900/30"
    >
        <div class="p-2 rounded-xl bg-white dark:bg-gray-700 group-hover:bg-purple-500 transition-all duration-300 shadow-sm group-hover:shadow-md group-hover:scale-110">
            <Bookmark size={22} class="text-gray-600 dark:text-gray-300 group-hover:text-white transition-all duration-300" strokeWidth={2} />
        </div>
        <span class="text-[10px] text-gray-500 dark:text-gray-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 font-medium mt-1 transition-colors">Bookmarks</span>
    </button>

    <!-- Sidebar Item - Manage Cookies -->
    <button
        onclick={handleManageCookies}
        class="sidebarItem relative flex flex-col items-center justify-center w-full py-3 px-2 transition-all duration-300 group hover:bg-amber-50/80 dark:hover:bg-amber-900/30 rounded-bl-2xl"
    >
        <div class="p-2 rounded-xl bg-white dark:bg-gray-700 group-hover:bg-amber-500 transition-all duration-300 shadow-sm group-hover:shadow-md group-hover:scale-110">
            <Cookie size={22} class="text-gray-600 dark:text-gray-300 group-hover:text-white transition-all duration-300" strokeWidth={2} />
        </div>
        <span class="text-[10px] text-gray-500 dark:text-gray-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 font-medium mt-1 transition-colors">Cookies</span>
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




