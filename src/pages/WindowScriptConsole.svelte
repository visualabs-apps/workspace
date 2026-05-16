<script>
    import ChildWindowControls from "../components/layout/ChildWindowControls.svelte";
    import { Terminal } from "lucide-svelte";
    import ScriptConsolePanel from "../components/panels/ScriptConsolePanel.svelte";

    const WINDOW_ID = 'script-console-window';
</script>

<div class="w-full h-screen flex flex-col bg-white">
    <!-- Custom Title Bar -->
    <div class="h-10 bg-gray-50 border-b border-gray-200 flex items-center justify-between px-4" style="-webkit-app-region: drag">
        <div class="flex items-center gap-2">
            <Terminal size={16} class="text-blue-600" />
            <span class="text-sm font-medium text-gray-700">Script Console</span>
        </div>
        <div style="-webkit-app-region: no-drag">
            <ChildWindowControls variant="light" windowId={WINDOW_ID} />
        </div>
    </div>
    
    <!-- Content — uses shared ScriptConsolePanel -->
    <div class="flex-1 overflow-hidden">
        <ScriptConsolePanel showHeader={true} />
    </div>
</div>
