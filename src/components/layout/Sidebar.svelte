<script>
    import { authStore } from "../../lib/stores/auth.svelte.js";
    import { workspaceStore } from "../../lib/stores/workspaces.svelte.js";
    import { getClientsForAdmin } from "../../lib/api/api.js";
    import { toastStore } from "../../lib/managers/toast.svelte.js";
    import { Plus, Trash2, Pencil, PanelLeftClose, PanelLeftOpen, Eye, ArrowLeft, Users } from "lucide-svelte";
    import { openPredefinedWindow } from "../../lib/utils/childWindow.js";

    // Auth state
    let user = $derived(authStore.user);
    // Check if user is admin - based on backend: ROLE_ADMIN = 1
    let isAdmin = $derived(user?.role === 1 || user?.role === "1");

    // Workspace state
    let workspaces = $derived(workspaceStore.workspaces);
    let activeWorkspace = $derived(workspaceStore.activeWorkspace);
    let isLoadingWorkspaces = $derived(workspaceStore.isLoading);
    let isMonitoring = $derived(workspaceStore.isMonitoring);
    
    // Modal state
    let isAddModalOpen = $state(false);
    let isEditModalOpen = $state(false);
    let editingWorkspace = $state(null);
    
    // Curated highly-distinct profile colors palette
    const profileColors = [
        { hex: '#ef4444', rgb: '239, 68, 68' },   // Red
        { hex: '#22c55e', rgb: '34, 197, 94' },   // Green
        { hex: '#a855f7', rgb: '168, 85, 247' },  // Purple
        { hex: '#d97706', rgb: '217, 119, 6' },   // Amber/Dark Yellow
        { hex: '#3b82f6', rgb: '59, 130, 246' },  // Blue
        { hex: '#db2777', rgb: '219, 39, 119' },  // Pink
        { hex: '#84cc16', rgb: '132, 204, 22' },  // Lime
        { hex: '#0f766e', rgb: '15, 118, 110' }   // Teal
    ];
    
    // Client state
    let clients = $state([]);
    let isLoadingClients = $state(false);

    // Context menu state
    let workspaceContextMenu = $state({ show: false, x: 0, y: 0, workspaceId: null });

    // Toggle state
    let isExpanded = $state(false);
    let hoveredProfile = $state(null);
    let tooltipPosition = $state({ left: 0, top: 0 });
    let tooltipElement = $state(null);
    let currentHoveredButton = $state(null);

    // Update tooltip position when tooltip element is rendered
    $effect(() => {
        if (tooltipElement && currentHoveredButton) {
            // Wait for next frame to ensure tooltip is fully rendered
            requestAnimationFrame(() => {
                updateTooltipPosition(currentHoveredButton);
            });
        }
    });

    // Update tooltip position with proper centering
    function updateTooltipPosition(buttonElement) {
        if (!buttonElement) return;
        
        const avatar = buttonElement.querySelector('.avatar-wrapper');
        if (!avatar) return;
        
        const avatarRect = avatar.getBoundingClientRect();
        
        // Calculate left position (to the right of avatar with offset)
        const left = avatarRect.right + 8;
        
        // Calculate top position (centered vertically with avatar)
        let top;
        
        // If tooltip element exists, center it properly
        if (tooltipElement) {
            const tooltipRect = tooltipElement.getBoundingClientRect();
            top = avatarRect.top + (avatarRect.height / 2) - (tooltipRect.height / 2);
            
            // Prevent tooltip from going off-screen
            const viewportHeight = window.innerHeight;
            if (top + tooltipRect.height > viewportHeight - 8) {
                top = viewportHeight - tooltipRect.height - 8;
            }
            if (top < 8) {
                top = 8;
            }
        } else {
            // Fallback: approximate center (will be corrected when tooltip renders)
            top = avatarRect.top + (avatarRect.height / 2) - 30;
        }
        
        tooltipPosition = { left, top };
    }

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
            const cleanup = window.api.onParentMessage('profile-success', async (data) => {
                console.log('[Sidebar] Profile success:', data);
                // Refresh workspaces to show new/updated profile
                await workspaceStore.refresh();
                // Set the new/updated profile as active if available
                if (data.profile?.id) {
                    await workspaceStore.setActiveWorkspace(data.profile.id);
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

    async function handleProfileSuccess(profileData) {
        // Refresh workspaces from backend
        await workspaceStore.refresh();
        
        // Set the new/updated profile as active
        if (profileData.id) {
            await workspaceStore.setActiveWorkspace(profileData.id);
        }
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

    // Open staff monitoring window
    function openStaffMonitoring(e) {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        openPredefinedWindow('STAFF_MONITORING', {});
    }

    // Stop monitoring and return to own profiles
    async function stopMonitoring() {
        await workspaceStore.stopMonitoring();
        toastStore.success('Returned to your profiles');
    }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 flex flex-col py-4 shrink-0 relative z-[100] select-none transition-all duration-200 ease-in-out"
    style="width: {isExpanded ? '220px' : '64px'}; -webkit-app-region: drag;"
>
    <!-- Monitoring Mode Indicator -->
    {#if isMonitoring}
        <div class="w-full px-2.5 mb-3" style="-webkit-app-region: no-drag">
            <div class="bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-xl p-2 text-center">
                <div class="flex items-center justify-center gap-2 text-orange-700 dark:text-orange-400">
                    <Eye size={14} />
                    {#if isExpanded}
                        <span class="text-xs font-medium">Monitoring Mode</span>
                    {/if}
                </div>
            </div>
        </div>
    {/if}

    <!-- Return to Own Profiles Button (when monitoring) -->
    {#if isMonitoring}
        <div class="w-full px-2.5 mb-3" style="-webkit-app-region: no-drag">
            <button
                onclick={stopMonitoring}
                class="w-full h-11 rounded-xl bg-orange-100 dark:bg-orange-900/50 hover:bg-orange-200 dark:hover:bg-orange-900/70 flex items-center justify-center gap-2 transition-all group"
                title="Return to My Profiles"
            >
                <ArrowLeft size={16} class="text-orange-600 dark:text-orange-400 group-hover:text-orange-900 dark:group-hover:text-orange-300 transition-all" />
                {#if isExpanded}
                    <span class="text-sm font-medium text-orange-600 dark:text-orange-400 group-hover:text-orange-900 dark:group-hover:text-orange-300">Back</span>
                {/if}
            </button>
        </div>
    {/if}

    <!-- Add Profile Button -->
    {#if !isMonitoring}
        <div class="w-full px-2.5 mb-3" style="-webkit-app-region: no-drag">
            <button
                onclick={(e) => toggleAddModal(e)}
                class="w-full h-11 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center transition-all group"
                title="Add Profile"
            >
                <Plus size={16} class="text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200 group-hover:rotate-90 transition-all" />
            </button>
        </div>
    {/if}

    <!-- Staff Monitoring Button (Admin Only) -->
    {#if isAdmin && !isMonitoring}
        <div class="w-full px-2.5 mb-3" style="-webkit-app-region: no-drag">
            <button
                onclick={(e) => openStaffMonitoring(e)}
                class="w-full h-11 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center transition-all group"
                title="Monitor Staff Profiles"
            >
                <Users size={16} class="text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200 transition-all" />
            </button>
        </div>
    {/if}

    <!-- Workspace List -->
    <div class="flex-1 w-full px-2.5 py-1 custom-scrollbar overflow-y-auto overflow-x-hidden" style="-webkit-app-region: no-drag">
        {#if isLoadingWorkspaces}
            <!-- Skeleton Loading -->
            <div class="flex flex-col gap-2">
                {#each Array(3) as _, i}
                    <div class="flex items-center gap-3 px-1 py-2">
                        <div class="w-10 h-10 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse shrink-0"></div>
                        {#if isExpanded}
                            <div class="flex-1 space-y-2">
                                <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4"></div>
                                <div class="h-2 bg-gray-100 dark:bg-gray-800 rounded animate-pulse w-1/2"></div>
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>
        {:else}
            <!-- Profile List -->
             <div class="flex flex-col gap-0.5">
                {#each workspaces as workspace, i (workspace.id)}
                    {@const color = profileColors[i % profileColors.length]}
                    <button
                        onclick={() => handleWorkspaceSwitch(workspace.id)}
                        oncontextmenu={(e) => handleWorkspaceContextMenu(e, workspace.id)}
                        onmouseenter={(e) => {
                            if (!isExpanded) {
                                hoveredProfile = workspace.id;
                                currentHoveredButton = e.currentTarget;
                                updateTooltipPosition(e.currentTarget);
                            }
                        }}
                        onmouseleave={() => {
                            if (!isExpanded) {
                                hoveredProfile = null;
                                currentHoveredButton = null;
                                tooltipElement = null;
                            }
                        }}
                        style="--profile-color: {color.hex}; --profile-color-rgb: {color.rgb};"
                        class="w-full flex items-center py-0.5 rounded-xl transition-all hover:bg-sky-50/50 dark:hover:bg-sky-900/20 group relative overflow-visible {workspace.id === activeWorkspace?.id ? 'active-profile-item' : ''}"
                    >
                        <!-- Avatar Wrapper - Always centered -->
                        <div class="relative shrink-0 avatar-wrapper" style="width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
                            <!-- Active indicator line (left side) - inside avatar wrapper -->
                            {#if workspace.id === activeWorkspace?.id}
                                <div class="absolute -left-1.5 top-1/2 -translate-y-1/2 w-1 h-9 bg-[var(--profile-color)] rounded-full active-line"></div>
                            {/if}

                            <!-- Outer border (active only) - Transparent -->
                            <div
                                class="absolute inset-0 rounded-xl {workspace.id === activeWorkspace?.id ? 'active-pulse-ring' : ''}"
                            ></div>

                            <!-- Avatar -->
                            <div
                                class="w-10 h-10 rounded-xl flex items-center justify-center relative transition-all duration-300 avatar-bg-color text-white {workspace.id === activeWorkspace?.id ? 'shadow-lg shadow-[var(--profile-color)]/50 font-bold' : 'font-medium'}"
                                style="background-color: {workspace.id === activeWorkspace?.id ? 'var(--profile-color)' : 'rgba(var(--profile-color-rgb), 0.8)'};"
                            >
                                <span class="text-sm text-white select-none">
                                    {getWorkspaceInitials(workspace.name)}
                                </span>
                            </div>
                        </div>

                        {#if isExpanded}
                            <!-- Text content - separated from avatar -->
                            <div class="flex-1 min-w-0 text-left pr-3 pl-2">
                                <p class="text-sm font-medium {workspace.id === activeWorkspace?.id ? 'text-[var(--profile-color)] font-semibold' : 'text-gray-600 dark:text-gray-400'} truncate group-hover:text-[var(--profile-color)] transition-colors">{workspace.name}</p>
                                {#if workspace.customerName}
                                    <p class="text-xs text-gray-400 dark:text-gray-500 truncate">{workspace.customerName}</p>
                                {/if}
                            </div>
                        {:else if hoveredProfile === workspace.id}
                            <!-- Tooltip for collapsed sidebar - speech bubble style -->
                            <div
                                bind:this={tooltipElement}
                                class="fixed bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 px-3 py-2 min-w-[160px] text-left tooltip-bubble z-[9999]"
                                style="left: {tooltipPosition.left}px; top: {tooltipPosition.top}px;"
                            >
                                <!-- Arrow pointing to avatar -->
                                <div class="tooltip-arrow"></div>

                                {#if workspace.customerName}
                                    <p class="text-sm text-gray-800 dark:text-gray-200">
                                        <span class="font-semibold text-[var(--profile-color)]">Profil</span>
                                        <span>{workspace.name}</span>
                                    </p>
                                    <p class="text-xs mt-0.5">
                                        <span class="font-medium text-gray-500 dark:text-gray-400">dengan</span>
                                        <span class="font-semibold text-[var(--profile-color)]/70">{workspace.customerName}</span>
                                    </p>
                                {:else}
                                    <p class="text-sm text-gray-800 dark:text-gray-200">
                                        <span class="font-semibold text-[var(--profile-color)]">Profil</span>
                                        <span>{workspace.name}</span>
                                    </p>
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
            class="w-full h-9 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center gap-2 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-all"
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
            class="absolute bg-white dark:bg-gray-800 backdrop-blur-xl rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-2 min-w-[150px] popup-container"
            style="left: {workspaceContextMenu.x}px; top: {workspaceContextMenu.y}px;"
            onclick={(e) => e.stopPropagation()}
        >
            <button
                onclick={() => {
                    const workspace = workspaces.find(w => w.id === workspaceContextMenu.workspaceId);
                    if (workspace) openEditModal(workspace);
                }}
                class="w-full px-3 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-2"
                type="button"
            >
                <Pencil size={14} />
                Edit Profile
            </button>
            <button
                onclick={() => {
                    handleDeleteWorkspace(workspaceContextMenu.workspaceId);
                }}
                class="w-full px-3 py-2 text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors flex items-center gap-2"
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

    /* Active profile item background */
    .active-profile-item {
        position: relative;
    }

    .active-profile-item::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: 12px;
        background: linear-gradient(135deg, rgba(var(--profile-color-rgb), 0.08) 0%, rgba(var(--profile-color-rgb), 0.02) 100%);
        opacity: 0;
        transition: opacity 0.3s ease;
    }

    .active-profile-item:hover::before {
        opacity: 1;
    }

    .group:hover .avatar-bg-color {
        background-color: var(--profile-color) !important;
        box-shadow: 0 4px 12px rgba(var(--profile-color-rgb), 0.3);
    }

    /* Pulse ring animation - subtle radiating effect */
    @keyframes pulse-ring {
        0% {
            opacity: 0.6;
            box-shadow: 0 0 0 0 rgba(var(--profile-color-rgb), 0.3);
        }
        50% {
            opacity: 0.3;
            box-shadow: 0 0 0 3px rgba(var(--profile-color-rgb), 0.1);
        }
        100% {
            opacity: 0.6;
            box-shadow: 0 0 0 0 rgba(var(--profile-color-rgb), 0);
        }
    }

    .active-pulse-ring {
        animation: pulse-ring 2.5s ease-in-out infinite;
        border: 2px solid rgba(var(--profile-color-rgb), 0.3);
    }

    /* Active profile line animation */
    @keyframes line-glow {
        0%, 100% {
            opacity: 1;
            box-shadow: 0 0 4px rgba(var(--profile-color-rgb), 0.5);
        }
        50% {
            opacity: 0.7;
            box-shadow: 0 0 8px rgba(var(--profile-color-rgb), 0.3);
        }
    }

    .active-line {
        animation: line-glow 2.5s ease-in-out infinite;
    }

    /* Tooltip popup animation */
    @keyframes tooltip-appear {
        0% {
            opacity: 0;
            transform: translateX(-8px) scale(0.95);
        }
        100% {
            opacity: 1;
            transform: translateX(0) scale(1);
        }
    }

    .tooltip-popup {
        animation: tooltip-appear 0.2s ease-out forwards;
        pointer-events: none;
    }

    /* Speech bubble tooltip styles */
    .tooltip-bubble {
        animation: tooltip-appear 0.2s ease-out forwards;
        pointer-events: none;
    }

    /* Arrow for speech bubble pointing to the left (toward avatar) */
    .tooltip-arrow {
        position: absolute;
        left: -8px;
        top: 50%;
        transform: translateY(-50%);
        width: 0;
        height: 0;
        border-top: 8px solid transparent;
        border-bottom: 8px solid transparent;
        border-right: 8px solid white;
        filter: drop-shadow(-2px 0 2px rgba(0, 0, 0, 0.05));
    }

    :global(.dark) .tooltip-arrow {
        border-right-color: #1f2937;
    }

    .tooltip-arrow::before {
        content: '';
        position: absolute;
        left: 2px;
        top: -7px;
        width: 0;
        height: 0;
        border-top: 7px solid transparent;
        border-bottom: 7px solid transparent;
        border-right: 7px solid rgba(209, 213, 219, 0.5);
    }

    :global(.dark) .tooltip-arrow::before {
        border-right-color: rgba(75, 85, 99, 0.5);
    }
</style>