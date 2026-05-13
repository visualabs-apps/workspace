<script>
    import { authStore } from "../../lib/stores/auth.svelte.js";
    import { workspaceStore } from "../../lib/stores/workspaces.svelte.js";
    import { getClientsForAdmin } from "../../lib/api/api.js";
    import { toastStore } from "../../lib/managers/toast.svelte.js";
    import { Plus, Trash2, Pencil } from "lucide-svelte";
    import { openPredefinedWindow } from "../../lib/utils/childWindow.js";

    // Auth state
    let user = $derived(authStore.user);

    // Workspace state
    let workspaces = $derived(workspaceStore.workspaces);
    let activeWorkspace = $derived(workspaceStore.activeWorkspace);
    let isLoadingWorkspaces = $derived(workspaceStore.isLoading);
    
    // Modal state
    let isAddModalOpen = $state(false);
    let isEditModalOpen = $state(false);
    let editingWorkspace = $state(null);
    let profileColor = $state("#9d8c6b");
    
    // Client state
    let clients = $state([]);
    let isLoadingClients = $state(false);

    // Context menu state
    let workspaceContextMenu = $state({ show: false, x: 0, y: 0, workspaceId: null });

    function closeContextMenu() {
        workspaceContextMenu = { show: false, x: 0, y: 0, workspaceId: null };
    }
    
    function handleWorkspaceContextMenu(e, workspaceId) {
        e.preventDefault();
        e.stopPropagation();
        workspaceContextMenu = { show: true, x: e.clientX, y: e.clientY, workspaceId };
    }

    // Load clients assigned to the logged-in admin
    async function loadClients() {
        if (!user?.id) {
            console.warn('No user ID available');
            return;
        }
        
        isLoadingClients = true;
        try {
            clients = await getClientsForAdmin(user.id);
        } catch (error) {
            console.error('Failed to load clients:', error);
            clients = [];
        } finally {
            isLoadingClients = false;
        }
    }
    
    // Load clients on component mount
    $effect(() => {
        if (user?.id && clients.length === 0) {
            loadClients();
        }
    });
    
    // Listen for profile success from child window
    $effect(() => {
        if (window.api?.onParentMessage) {
            const cleanup = window.api.onParentMessage('profile-success', (data) => {
                console.log('[Sidebar] Profile success:', data);
                if (data.profile) {
                    handleProfileSuccess(data.profile, data.color);
                }
            });
            
            return cleanup;
        }
    });

    function toggleAddModal(e) {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        openPredefinedWindow('PROFILE', {
            mode: 'add',
            clients: JSON.parse(JSON.stringify(clients)),
            isLoadingClients: isLoadingClients,
        });
    }
    
    function openEditModal(workspace) {
        editingWorkspace = workspace;
        openPredefinedWindow('PROFILE', {
            mode: 'edit',
            editingProfile: JSON.parse(JSON.stringify(workspace)),
            clients: JSON.parse(JSON.stringify(clients)),
            isLoadingClients: isLoadingClients,
        });
        closeContextMenu();
    }

    async function handleProfileSuccess(profileData, color) {
        // Save color to SQLite
        if (color && profileData.id) {
            try {
                await window.api.db.saveProfileColor(profileData.id, color);
            } catch (error) {
                console.error('Failed to save profile color:', error);
            }
        }
        
        // Refresh workspaces from backend
        await workspaceStore.refresh();
        
        // Set the new/updated profile as active
        if (profileData.id) {
            await workspaceStore.setActiveWorkspace(profileData.id);
        }
    }
    
    function handleColorChange(color) {
        profileColor = color;
    }

    async function handleDeleteWorkspace(workspaceId) {
        if (confirm("Delete this profile?")) {
            try {
                const success = await workspaceStore.deleteWorkspace(workspaceId);
                if (success) {
                    toastStore.success('Profile deleted');
                } else {
                    toastStore.error('Failed to delete profile');
                }
            } catch (error) {
                console.error('Error deleting workspace:', error);
                toastStore.error('Failed to delete profile');
            }
        }
        closeContextMenu();
    }

    function handleWorkspaceSwitch(workspaceId) {
        workspaceStore.setActiveWorkspace(workspaceId);
    }

    // Get workspace initials for display
    function getWorkspaceInitials(name) {
        if (!name) return "W";
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .substring(0, 2)
            .toUpperCase();
    }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="w-16 h-full bg-white border-r border-gray-200 text-gray-900 flex flex-col items-center py-4 shrink-0 shadow-lg relative z-[100] select-none"
    style="-webkit-app-region: drag"
>
    <!-- Add Workspace Button -->
    <div class="w-full px-2.5 mb-3" style="-webkit-app-region: no-drag">
        <button
            onclick={(e) => toggleAddModal(e)}
            class="popup-trigger-button w-full h-11 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all group relative"
            title="Add Profilex"
        >
            <Plus size={16} class="text-gray-600 group-hover:text-gray-900 group-hover:rotate-90 transition-all" />
        </button>
    </div>

    <!-- Workspace List -->
    <div class="flex-1 w-full px-3 py-1 custom-scrollbar" style="-webkit-app-region: no-drag; overflow-x: visible;">
        <div class="flex flex-col gap-3">
            {#if isLoadingWorkspaces}
                <!-- Skeleton Loading -->
                {#each Array(3) as _, i}
                    <div class="relative group flex items-center justify-center">
                        <div class="w-10 h-10 rounded-full bg-gray-200 animate-pulse"></div>
                    </div>
                {/each}
            {:else}
                <!-- Profile List -->
                {#each workspaces as workspace (workspace.id)}
                <div class="relative group flex items-center justify-center">
                    <button
                        onclick={() => handleWorkspaceSwitch(workspace.id)}
                        oncontextmenu={(e) => handleWorkspaceContextMenu(e, workspace.id)}
                        class="w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-md hover:shadow-xl relative {workspace.id === activeWorkspace?.id ? 'opacity-100 ring-[3px] ring-blue-400 scale-110 active-profile' : 'opacity-70 hover:opacity-100 hover:scale-105'}"
                        style="background: linear-gradient(135deg, {workspace.color?.hex || workspace.color?.value || workspace.color || '#6366f1'}, {workspace.color?.hex || workspace.color?.value || workspace.color || '#6366f1'}dd);"
                    >
                        <!-- Display client initials -->
                        <span class="text-sm font-bold text-white">
                            {getWorkspaceInitials(workspace.name)}
                        </span>
                    </button>

                    <!-- Hover Tooltip -->
                    <div class="absolute left-full ml-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[99999] delay-300">
                        <div class="bg-gray-900 text-white rounded-lg shadow-xl px-3 py-2 min-w-[180px] max-w-[250px]">
                            <p class="font-medium text-sm break-words">{workspace.name}</p>
                            {#if workspace.customerName}
                                <p class="text-xs text-gray-300 mt-0.5">{workspace.customerName}</p>
                            {/if}
                            <div class="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-4 border-t-transparent border-b-4 border-b-transparent border-r-4 border-r-gray-900"></div>
                        </div>
                    </div>
                </div>
            {/each}
            {/if}
        </div>
    </div>
</div>

<!-- Workspace Context Menu -->
{#if workspaceContextMenu.show}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="fixed inset-0 z-[200]"
        onclick={closeContextMenu}
    >
        <div
            class="absolute bg-white backdrop-blur-xl rounded-xl shadow-2xl border border-gray-200 p-2 min-w-[150px] popup-container"
            style="left: {workspaceContextMenu.x}px; top: {workspaceContextMenu.y}px;"
            onclick={(e) => e.stopPropagation()}
        >
            <button
                onclick={() => {
                    const workspace = workspaces.find(w => w.id === workspaceContextMenu.workspaceId);
                    if (workspace) openEditModal(workspace);
                }}
                class="w-full px-3 py-2 text-left text-gray-700 hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-2"
                type="button"
            >
                <Pencil size={14} />
                Edit Profile
            </button>
            <button
                onclick={() => {
                    handleDeleteWorkspace(workspaceContextMenu.workspaceId);
                }}
                class="w-full px-3 py-2 text-left text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
                type="button"
            >
                <Trash2 size={14} />
                Delete Profile
            </button>
        </div>
    </div>
{/if}

<style>
    .custom-scrollbar::-webkit-scrollbar {
        width: 3px;
    }
    
    .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
    }
    
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background: rgba(156, 163, 175, 0.3);
        border-radius: 2px;
    }
    
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: rgba(156, 163, 175, 0.5);
    }

    /* Tooltip delay */
    .group:hover .delay-300 {
        transition-delay: 300ms;
    }

    /* Skeleton animation */
    @keyframes pulse {
        0%, 100% {
            opacity: 1;
        }
        50% {
            opacity: 0.5;
        }
    }

    .animate-pulse {
        animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }

    /* Active profile ring animation */
    @keyframes ring-pulse {
        0%, 100% {
            box-shadow: 0 0 0 0 rgba(96, 165, 250, 0.7);
        }
        50% {
            box-shadow: 0 0 0 6px rgba(96, 165, 250, 0);
        }
    }

    .active-profile {
        animation: ring-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
</style>




