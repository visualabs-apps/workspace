<script>
    import { workspaceStore } from "../../lib/stores/workspaces.svelte.js";
    import { serviceStore } from "../../lib/stores/services.svelte.js";
    import { Plus } from "lucide-svelte";

    // Workspace state
    let workspaces = $derived(workspaceStore.workspaces);
    let activeWorkspace = $derived(workspaceStore.activeWorkspace);

    function handleWorkspaceSwitch(workspaceId) {
        // Switch to the workspace
        workspaceStore.setActiveWorkspace(workspaceId);
        
        // Get the first app in the new workspace
        const newWorkspace = workspaces.find(w => w.id === workspaceId);
        if (newWorkspace && newWorkspace.apps && newWorkspace.apps.length > 0) {
            // Set the first app as active
            serviceStore.setActive(newWorkspace.apps[0]);
        } else {
            // No apps in this workspace, set active to null
            serviceStore.setActive(null);
        }
    }

    function handleAddWorkspace() {
        const newWorkspace = workspaceStore.addWorkspace(`Workspace ${workspaces.length + 1}`, '#9d8c6b');
        if (newWorkspace) {
            workspaceStore.setActiveWorkspace(newWorkspace.id);
        }
    }
</script>

<div class="flex items-center gap-1 px-2 shrink-0">
    <!-- Workspace Icons -->
    {#each workspaces as workspace (workspace.id)}
        {@const isActive = activeWorkspace?.id === workspace.id}
        <button
            onclick={() => handleWorkspaceSwitch(workspace.id)}
            class="w-8 h-8 rounded-lg flex items-center justify-center transition-all shrink-0
                {isActive
                ? 'bg-white/20 scale-110'
                : 'bg-white/5 hover:bg-white/10 opacity-60 hover:opacity-100'}"
            title={workspace.name}
            style="background-color: {isActive ? workspace.color + '40' : 'transparent'}"
        >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
        </button>
    {/each}

    <!-- Add Workspace Button -->
    <button
        onclick={handleAddWorkspace}
        class="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all shrink-0 opacity-60 hover:opacity-100"
        title="Add Profile"
    >
        <Plus size={16} strokeWidth={2.5} />
    </button>
</div>
