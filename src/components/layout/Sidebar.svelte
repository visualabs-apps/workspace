<script>
    import { authStore } from "../../lib/stores/auth.svelte.js";
    import { workspaceStore } from "../../lib/stores/workspaces.svelte.js";
    import { getClientsForAdmin } from "../../lib/api/api.js";
    import { toastStore } from "../../lib/managers/toast.svelte.js";
    import { Plus, Trash2, Pencil, PanelLeftClose, PanelLeftOpen } from "lucide-svelte";
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

    // Toggle state
    let isExpanded = $state(false);

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
    class="h-full bg-white border-r border-gray-200 text-gray-900 flex flex-col py-4 shrink-0 relative z-[100] select-none transition-all duration-200 ease-in-out"
    style="width: {isExpanded ? '220px' : '64px'}; -webkit-app-region: drag;"
>
    <!-- Add Workspace Button -->
    <div class="w-full px-2.5 mb-3" style="-webkit-app-region: no-drag">
        <button
            onclick={(e) => toggleAddModal(e)}
            class="w-full h-11 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all group"
            title="Add Profile"
        >
            <Plus size={16} class="text-gray-600 group-hover:text-gray-900 group-hover:rotate-90 transition-all" />
        </button>
    </div>

    <!-- Workspace List -->
    <div class="flex-1 w-full px-2.5 py-1 custom-scrollbar overflow-y-auto overflow-x-hidden" style="-webkit-app-region: no-drag">
        {#if isLoadingWorkspaces}
            <!-- Skeleton Loading -->
            <div class="flex flex-col gap-2">
                {#each Array(3) as _, i}
                    <div class="flex items-center gap-3 px-1 py-2">
                        <div class="w-10 h-10 rounded-full bg-gray-200 animate-pulse shrink-0"></div>
                        {#if isExpanded}
                            <div class="flex-1 space-y-2">
                                <div class="h-3 bg-gray-200 rounded animate-pulse w-3/4"></div>
                                <div class="h-2 bg-gray-100 rounded animate-pulse w-1/2"></div>
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>
        {:else}
            <!-- Profile List -->
            <div class="flex flex-col gap-1">
                {#each workspaces as workspace (workspace.id)}
                    <button
                        onclick={() => handleWorkspaceSwitch(workspace.id)}
                        oncontextmenu={(e) => handleWorkspaceContextMenu(e, workspace.id)}
                        class="w-full flex items-center gap-3 px-1.5 py-2 rounded-xl transition-all hover:bg-gray-50"
                    >
                        <!-- Avatar -->
                        <div class="relative shrink-0">
                            {#if workspace.id === activeWorkspace?.id}
                                <!-- Active indicator ring -->
                                <div class="absolute -inset-1 rounded-full bg-gradient-to-tr from-blue-400 to-blue-500 active-ring"></div>
                            {/if}
                            <div
                                class="w-10 h-10 rounded-full flex items-center justify-center relative transition-all {workspace.id === activeWorkspace?.id ? 'scale-110 shadow-lg z-10' : 'shadow-sm hover:shadow-md hover:scale-105'}"
                                style="background: linear-gradient(135deg, {workspace.color?.hex || workspace.color?.value || workspace.color || '#6366f1'}, {workspace.color?.hex || workspace.color?.value || workspace.color || '#6366f1'}dd);"
                            >
                                <span class="text-sm font-bold text-white">
                                    {getWorkspaceInitials(workspace.name)}
                                </span>
                            </div>
                        </div>

                        <!-- Profile Info (visible when expanded) -->
                        {#if isExpanded}
                            <div class="flex-1 min-w-0 text-left">
                                <p class="text-sm font-medium {workspace.id === activeWorkspace?.id ? 'text-gray-900' : 'text-gray-700'} truncate">{workspace.name}</p>
                                {#if workspace.customerName}
                                    <p class="text-xs text-gray-400 truncate">{workspace.customerName}</p>
                                {/if}
                            </div>
                        {/if}
                    </button>
                {/each}
            </div>
        {/if}
    </div>

    <!-- Toggle Button (always at bottom) -->
    <div class="w-full px-2.5 mt-2" style="-webkit-app-region: no-drag">
        <button
            onclick={() => isExpanded = !isExpanded}
            class="w-full h-9 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center gap-2 text-xs text-gray-400 hover:text-gray-600 transition-all"
            title={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
        >
            {#if isExpanded}
                <PanelLeftClose size={14} />
                <span>Tutup</span>
            {:else}
                <PanelLeftOpen size={16} />
            {/if}
        </button>
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

    /* Active profile shadow pulse */
    @keyframes ring-pulse {
        0%, 100% {
            box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.25);
        }
        50% {
            box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.4);
        }
    }

    .active-profile {
        animation: ring-pulse 2.5s ease-in-out infinite;
    }

    /* Active indicator ring pulse */
    @keyframes active-ring-pulse {
        0%, 100% {
            opacity: 1;
            transform: scale(1);
        }
        50% {
            opacity: 0.5;
            transform: scale(1.08);
        }
    }

    .active-ring {
        animation: active-ring-pulse 2s ease-in-out infinite;
    }
</style>




