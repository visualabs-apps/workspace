<script>
    import { taskbarStore } from "../../lib/stores/taskbar.svelte.js";
    import { X } from "lucide-svelte";

    let minimizedWindows = $derived(taskbarStore.minimizedWindows);

    async function restoreWindow(windowItem) {
        try {
            console.log('[Taskbar] Restoring window:', windowItem);
            
            // Access global window.api (from browser window, not the parameter)
            const api = globalThis.window?.api;
            
            // Check if API is available
            if (!api?.childWindow?.restore) {
                console.error('[Taskbar] API not available. window.api:', globalThis.window?.api);
                taskbarStore.removeWindow(windowItem.id);
                return;
            }
            
            // Send restore command to main process
            const result = await api.childWindow.restore(windowItem.id);
            console.log('[Taskbar] Restore result:', result);
            
            if (!result?.success) {
                console.error('[Taskbar] Failed to restore window:', result?.error);
                // If restore failed, remove from taskbar anyway
                taskbarStore.removeWindow(windowItem.id);
            }
        } catch (error) {
            console.error('[Taskbar] Failed to restore window:', error);
            // If error, remove from taskbar anyway
            taskbarStore.removeWindow(windowItem.id);
        }
    }
    
    async function closeWindow(windowItem, event) {
        event.stopPropagation();
        try {
            console.log('[Taskbar] Closing window:', windowItem);
            
            const api = globalThis.window?.api;
            
            // Close the window
            if (api?.childWindow?.close) {
                await api.childWindow.close(windowItem.id);
            }
            
            // Remove from taskbar
            taskbarStore.removeWindow(windowItem.id);
        } catch (error) {
            console.error('[Taskbar] Failed to close window:', error);
        }
    }
</script>

{#if minimizedWindows.length > 0}
    <div class="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2">
        {#each minimizedWindows as windowItem}
            <div
                class="group relative h-10 px-4 pr-10 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-750 shadow-md hover:shadow-lg flex items-center gap-2 text-gray-700 dark:text-gray-200 font-medium text-sm transition-all cursor-pointer"
                onclick={() => restoreWindow(windowItem)}
                role="button"
                tabindex="0"
                onkeydown={(e) => e.key === 'Enter' && restoreWindow(windowItem)}
                title="Click to restore {windowItem.title}"
            >
                <span class="max-w-[150px] truncate">{windowItem.title}</span>
                
                <!-- Close button -->
                <button
                    onclick={(e) => closeWindow(windowItem, e)}
                    class="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    title="Close window"
                >
                    <X size={14} />
                </button>
            </div>
        {/each}
    </div>
{/if}
