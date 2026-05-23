<script>
    import ChildWindowControls from "../components/layout/ChildWindowControls.svelte";
    import { BookOpen } from "lucide-svelte";
    import VBoxApiDocsPanel from "../components/panels/VBoxApiDocsPanel.svelte";
    import { onMount } from "svelte";
    import { initTheme } from "../lib/utils/theme.js";

    const WINDOW_ID = 'vbox-api-docs-window';

    // Initialize theme
    onMount(() => { initTheme(); });
</script>

<div class="w-full h-screen flex flex-col bg-white dark:bg-gray-900">
    <!-- Custom Title Bar -->
    <div class="h-10 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4" style="-webkit-app-region: drag">
        <div class="flex items-center gap-2">
            <BookOpen size={16} class="text-blue-600 dark:text-blue-400" />
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">VBox API Documentation</span>
        </div>
        <div style="-webkit-app-region: no-drag">
            <ChildWindowControls variant="dark" windowId={WINDOW_ID} />
        </div>
    </div>

    <!-- Content — uses shared VBoxApiDocsPanel -->
    <div class="flex-1 overflow-hidden">
        <VBoxApiDocsPanel />
    </div>
</div>
