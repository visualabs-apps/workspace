<script>
    import { serviceStore } from "../lib/services.svelte.js";
    import { authStore } from "../lib/auth.svelte.js";
    import { workspaceStore } from "../lib/workspaces.svelte.js";
    import { Plus, Settings, LogOut, Trash2 } from "lucide-svelte";
    import SettingsModal from "./SettingsModal.svelte";
    import { onMount } from 'svelte';

    // Auth state
    let user = $derived(authStore.user);

    // Workspace state
    let workspaces = $derived(workspaceStore.workspaces);
    let activeWorkspace = $derived(workspaceStore.activeWorkspace);
    let isAddWorkspacePopupOpen = $state(false);
    let newWorkspaceName = $state("");
    let newWorkspaceColor = $state("#9d8c6b");
    let showWorkspaceColorPicker = $state(false);
    let workspaceNameError = $state(false);

    // Migration: Add existing services to active workspace if they're not in any workspace
    onMount(() => {
        if (activeWorkspace && serviceStore.services.length > 0) {
            const allWorkspaceApps = workspaces.flatMap(w => w.apps || []);
            const orphanedServices = serviceStore.services.filter(
                service => !allWorkspaceApps.includes(service.id)
            );
            
            // Add orphaned services to the active workspace
            orphanedServices.forEach(service => {
                workspaceStore.addAppToWorkspace(activeWorkspace.id, service.id);
            });
        }
    });

    // Filter apps based on active workspace (no groups, just direct apps)
    let workspaceApps = $derived(
        serviceStore.services.filter(service => 
            activeWorkspace?.apps?.includes(service.id)
        )
    );

    // Settings modal state
    let isSettingsOpen = $state(false);

    // Context menu state
    let contextMenu = $state({ show: false, x: 0, y: 0, serviceId: null });
    let workspaceContextMenu = $state({ show: false, x: 0, y: 0, workspaceId: null });

    function handleServiceClick(id) {
        serviceStore.setActive(id);
    }

    function handleOpenSettings() {
        isSettingsOpen = true;
    }

    function handleCloseSettings() {
        isSettingsOpen = false;
    }

    function handleContextMenu(e, serviceId) {
        e.preventDefault();
        e.stopPropagation();
        contextMenu = { show: true, x: e.clientX, y: e.clientY, serviceId };
    }

    function handleWorkspaceContextMenu(e, workspaceId) {
        e.preventDefault();
        e.stopPropagation();
        console.log(`🖱️ Right-click on workspace: ${workspaceId}`);
        console.log(`📊 Workspaces count: ${workspaces.length}`);
        workspaceContextMenu = { show: true, x: e.clientX, y: e.clientY, workspaceId };
        console.log(`📋 Context menu state:`, workspaceContextMenu);
    }

    function closeContextMenu() {
        console.log(`❌ Closing context menu`);
        contextMenu = { show: false, x: 0, y: 0, serviceId: null };
        workspaceContextMenu = { show: false, x: 0, y: 0, workspaceId: null };
    }
    
    function closeAllMenus() {
        isAddWorkspacePopupOpen = false;
        showWorkspaceColorPicker = false;
        closeContextMenu();
    }

    function handleRemoveApp(id) {
        // Remove app from service store and workspace
        serviceStore.removeService(id);
        if (activeWorkspace) {
            workspaceStore.removeAppFromWorkspace(activeWorkspace.id, id);
        }
        closeContextMenu();
    }

    async function handleLogout() {
        if (confirm("Are you sure you want to logout?")) {
            await authStore.logout();
        }
    }

    // Get user initials
    function getInitials(name) {
        if (!name) return "U";
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .substring(0, 2)
            .toUpperCase();
    }

    // Workspace functions
    function toggleAddWorkspacePopup(e) {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        isAddWorkspacePopupOpen = !isAddWorkspacePopupOpen;

        // Reset form
        if (isAddWorkspacePopupOpen) {
            newWorkspaceName = "";
            newWorkspaceColor = "#9d8c6b";
            showWorkspaceColorPicker = false;
            workspaceNameError = false;
        }
    }

    function handleCreateWorkspace() {
        if (!newWorkspaceName || !newWorkspaceName.trim()) {
            workspaceNameError = true;
            setTimeout(() => {
                workspaceNameError = false;
            }, 3000);
            return;
        }

        workspaceNameError = false;

        console.log(`➕ Creating new workspace: "${newWorkspaceName.trim()}"`);
        console.log(`🎨 Workspace color: ${newWorkspaceColor}`);

        // Create workspace with client initials as icon
        const initials = getWorkspaceInitials(newWorkspaceName.trim());
        console.log(`🔤 Generated initials: ${initials}`);
        
        workspaceStore.createWorkspace(
            newWorkspaceName.trim(),
            initials, // Use initials instead of SVG
            { name: 'custom', value: newWorkspaceColor, hex: newWorkspaceColor }
        ).then(() => {
            console.log(`✅ Workspace created successfully`);
            console.log(`📊 Total workspaces now: ${workspaces.length + 1}`);
        }).catch(error => {
            console.error(`❌ Failed to create workspace:`, error);
        });

        isAddWorkspacePopupOpen = false;
        newWorkspaceName = "";
    }

    async function handleDeleteWorkspace(workspaceId) {
        console.log(`🚀 handleDeleteWorkspace called with ID: ${workspaceId}`);
        console.log(`📊 Current workspaces count: ${workspaces.length}`);
        console.log(`📋 All workspaces:`, workspaces);
        console.log(`🎯 Active workspace ID: ${activeWorkspace?.id}`);
        
        if (confirm("Delete this workspace?")) {
            console.log(`✅ User confirmed deletion`);
            try {
                const success = await workspaceStore.deleteWorkspace(workspaceId);
                if (success) {
                    console.log('✅ Workspace deleted successfully');
                } else {
                    console.warn('⚠️ Failed to delete workspace');
                }
            } catch (error) {
                console.error('❌ Error deleting workspace:', error);
            }
        } else {
            console.log(`❌ Delete cancelled by user`);
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

    // Color picker helpers
    const presetColors = [
        '#6B21A8', '#4F46E5', '#2563EB', '#0EA5E9', '#06B6D4', '#14B8A6', '#10B981', '#EAB308',
        '#F97316', '#EF4444', '#EC4899', '#A855F7', '#8B5CF6', '#60A5FA', '#38BDF8', '#22D3EE',
        '#5EEAD4', '#FDE047', '#FCD34D', '#FCA5A5'
    ];

    let workspaceRgb = $state({ r: 157, g: 140, b: 107 });
    let workspaceColorPickerButton = $state(null);
    let workspacePickerPosition = $state('bottom');

    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    }

    function rgbToHex(r, g, b) {
        return "#" + [r, g, b].map(x => {
            const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
            return hex.length === 1 ? "0" + hex : hex;
        }).join("");
    }

    function updateWorkspaceColorFromRgb() {
        newWorkspaceColor = rgbToHex(workspaceRgb.r, workspaceRgb.g, workspaceRgb.b);
    }

    function detectPickerPosition(buttonElement) {
        if (!buttonElement) return 'bottom';
        const rect = buttonElement.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        return (viewportHeight - rect.bottom < 300) ? 'top' : 'bottom';
    }

    $effect(() => {
        if (showWorkspaceColorPicker && workspaceColorPickerButton) {
            workspacePickerPosition = detectPickerPosition(workspaceColorPickerButton);
        }
    });

    $effect(() => {
        if (newWorkspaceColor && /^#[0-9A-F]{6}$/i.test(newWorkspaceColor)) {
            const rgb = hexToRgb(newWorkspaceColor);
            workspaceRgb = rgb;
        }
    });

    // Close popups when clicking outside
    $effect(() => {
        function handleClickOutside(event) {
            const target = event.target;
            const isInsidePopup = target.closest('.popup-container');
            const isPopupButton = target.closest('.popup-trigger-button');
            const isOverlay = target.classList.contains('popup-overlay');
            
            console.log(`🖱️ Click outside check:`, {
                isInsidePopup: !!isInsidePopup,
                isPopupButton: !!isPopupButton,
                isOverlay,
                targetClass: target.className,
                workspaceContextMenuShow: workspaceContextMenu.show
            });
            
            if ((!isInsidePopup && !isPopupButton) || isOverlay) {
                console.log(`🚫 Closing menus due to outside click`);
                closeAllMenus();
            }
        }

        if (isAddWorkspacePopupOpen || showWorkspaceColorPicker || workspaceContextMenu.show) {
            const timeoutId = setTimeout(() => {
                window.addEventListener('mousedown', handleClickOutside, true);
            }, 100);

            return () => {
                clearTimeout(timeoutId);
                window.removeEventListener('mousedown', handleClickOutside, true);
            };
        }
    });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="w-18 h-full bg-[#2c4a4a] text-white flex flex-col items-center py-3 shrink-0 shadow-xl relative z-50 select-none"
    style="-webkit-app-region: drag"
>
    <!-- Add Workspace Button -->
    <div class="w-full px-2 mb-4" style="-webkit-app-region: no-drag">
        <button
            onclick={(e) => toggleAddWorkspacePopup(e)}
            class="popup-trigger-button w-full h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all group relative"
            title="Add Workspace"
        >
            <Plus size={14} class="text-white/60 group-hover:text-white group-hover:rotate-90 transition-all" />
        </button>

        <!-- Add Workspace Popup -->
        {#if isAddWorkspacePopupOpen}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
                class="popup-container absolute left-full top-12 ml-3 w-80 bg-black/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-4 z-50 text-white"
                onclick={(e) => {
                    e.stopPropagation();
                    const isColorPickerButton = e.target.closest('.popup-trigger-button');
                    const isColorPickerPopup = e.target.closest('.popup-container.absolute.left-0');
                    if (!isColorPickerButton && !isColorPickerPopup) {
                        showWorkspaceColorPicker = false;
                    }
                }}
            >
                <div class="flex items-center gap-2 mb-1">
                    <Plus size={18} class="text-white" />
                    <h3 class="font-bold text-lg">Add Workspace</h3>
                </div>
                <p class="text-xs text-gray-400 mb-4">
                    Create a new workspace for a client
                </p>

                <!-- Workspace Name Input -->
                <input
                    type="text"
                    bind:value={newWorkspaceName}
                    placeholder="Client name (e.g., Acme Corp, John Doe)"
                    class="w-full px-4 py-3 bg-black/30 border rounded-xl mb-1 text-white placeholder-gray-500 focus:outline-none transition-colors {workspaceNameError ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500 animate-shake' : 'border-white/20 focus:border-pink-500 focus:ring-1 focus:ring-pink-500'}"
                    onkeydown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter") handleCreateWorkspace();
                    }}
                    oninput={() => {
                        if (workspaceNameError) workspaceNameError = false;
                    }}
                />
                {#if workspaceNameError}
                    <p class="text-red-400 text-xs mb-3 ml-1">Client name is required</p>
                {:else}
                    <div class="mb-3"></div>
                {/if}

                <!-- Color Picker -->
                <div class="mb-4">
                    <span class="text-xs font-medium text-gray-300 mb-2 block">Workspace Color</span>
                    <div class="relative">
                        <button
                            type="button"
                            bind:this={workspaceColorPickerButton}
                            onclick={(e) => {
                                e.stopPropagation();
                                showWorkspaceColorPicker = !showWorkspaceColorPicker;
                            }}
                            class="popup-trigger-button w-full h-12 rounded-xl border-2 border-white/20 hover:border-white/40 transition-colors flex items-center gap-3 px-3"
                            style="background-color: {newWorkspaceColor}"
                        >
                            <div class="w-8 h-8 rounded-lg border-2 border-white/30" style="background-color: {newWorkspaceColor}"></div>
                            <span class="text-sm font-mono text-white">{newWorkspaceColor.toUpperCase()}</span>
                        </button>

                        {#if showWorkspaceColorPicker}
                            <!-- svelte-ignore a11y_click_events_have_key_events -->
                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                            <div 
                                class="popup-container absolute left-0 z-[60] bg-white rounded-xl p-3 shadow-2xl border border-gray-200 w-[280px] {workspacePickerPosition === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'}"
                                onclick={(e) => e.stopPropagation()}
                            >
                                <!-- Color Preview -->
                                <div class="mb-3">
                                    <div 
                                        class="w-full h-32 rounded-lg border-2 border-gray-200"
                                        style="background-color: {newWorkspaceColor}"
                                    ></div>
                                </div>

                                <!-- Color Values -->
                                <div class="grid grid-cols-4 gap-1.5 mb-3">
                                    <div>
                                        <label class="text-[10px] text-gray-600 mb-0.5 block text-center font-medium">Hex
                                        <input
                                            type="text"
                                            bind:value={newWorkspaceColor}
                                            class="w-full px-1.5 py-1.5 bg-gray-50 border border-gray-200 rounded text-center text-xs font-mono text-gray-900 focus:outline-none focus:border-blue-500"
                                            maxlength="7"
                                        /></label>
                                    </div>
                                    <div>
                                        <label class="text-[10px] text-gray-600 mb-0.5 block text-center font-medium">R
                                        <input
                                            type="number"
                                            bind:value={workspaceRgb.r}
                                            oninput={updateWorkspaceColorFromRgb}
                                            min="0"
                                            max="255"
                                            class="w-full px-1.5 py-1.5 bg-gray-50 border border-gray-200 rounded text-center text-xs text-gray-900 focus:outline-none focus:border-blue-500"
                                        /></label>
                                    </div>
                                    <div>
                                        <label class="text-[10px] text-gray-600 mb-0.5 block text-center font-medium">G
                                        <input
                                            type="number"
                                            bind:value={workspaceRgb.g}
                                            oninput={updateWorkspaceColorFromRgb}
                                            min="0"
                                            max="255"
                                            class="w-full px-1.5 py-1.5 bg-gray-50 border border-gray-200 rounded text-center text-xs text-gray-900 focus:outline-none focus:border-blue-500"
                                        /></label>
                                    </div>
                                    <div>
                                        <label class="text-[10px] text-gray-600 mb-0.5 block text-center font-medium">B
                                        <input
                                            type="number"
                                            bind:value={workspaceRgb.b}
                                            oninput={updateWorkspaceColorFromRgb}
                                            min="0"
                                            max="255"
                                            class="w-full px-1.5 py-1.5 bg-gray-50 border border-gray-200 rounded text-center text-xs text-gray-900 focus:outline-none focus:border-blue-500"
                                        /></label>
                                    </div>
                                </div>

                                <!-- Preset Colors -->
                                <div class="grid grid-cols-8 gap-1.5">
                                    {#each presetColors as color}
                                        <button
                                            type="button"
                                            onclick={() => {
                                                newWorkspaceColor = color;
                                                workspaceRgb = hexToRgb(color);
                                            }}
                                            class="w-full aspect-square rounded hover:scale-110 transition-transform border border-gray-200 hover:border-gray-400"
                                            style="background-color: {color}"
                                            title={color}
                                        ></button>
                                    {/each}
                                </div>
                            </div>
                        {/if}
                    </div>
                </div>

                <div class="flex items-center gap-3">
                    <button
                        class="flex-1 bg-gradient-to-r from-[#9d8c6b] to-[#8b4a6b] hover:from-[#b09a7a] hover:to-[#9d5a7a] text-white font-medium py-2.5 rounded-xl transition-colors shadow-lg shadow-black/50"
                        onclick={handleCreateWorkspace}
                    >
                        Create Workspace
                    </button>
                    <button
                        class="px-4 py-2.5 text-gray-400 hover:text-white transition-colors"
                        onclick={() => isAddWorkspacePopupOpen = false}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        {/if}
    </div>

    <!-- Workspace List -->
    <div class="flex-1 w-full px-2 overflow-y-auto overflow-x-hidden custom-scrollbar" style="-webkit-app-region: no-drag">
        <div class="flex flex-col gap-2">
            {#each workspaces as workspace (workspace.id)}
                <div class="relative group">
                    <button
                        onclick={() => handleWorkspaceSwitch(workspace.id)}
                        oncontextmenu={(e) => handleWorkspaceContextMenu(e, workspace.id)}
                        class="w-full h-12 rounded-xl hover:scale-105 flex items-center justify-center transition-all shadow-lg relative {workspace.id === activeWorkspace?.id ? 'opacity-100 ring-2 ring-white/30' : 'opacity-60 hover:opacity-80'}"
                        style="background: linear-gradient(135deg, {workspace.color?.hex || workspace.color?.value || '#6366f1'}, {workspace.color?.hex || workspace.color?.value || '#6366f1'}dd);"
                        title={workspace.name}
                    >
                        <!-- Display client initials -->
                        <span class="text-lg font-bold text-white">
                            {getWorkspaceInitials(workspace.name)}
                        </span>
                    </button>

                    <!-- Hover Popup -->
                    {#if !workspaceContextMenu.show}
                        <div class="absolute left-full ml-3 top-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                            <div class="bg-gray-900/95 backdrop-blur-xl rounded-xl shadow-2xl border border-white/20 p-4 min-w-[200px]">
                                <p class="text-white font-medium mb-1">{workspace.name}</p>
                                <p class="text-gray-500 text-xs">Right-click to delete</p>
                            </div>
                        </div>
                    {/if}
                </div>
            {/each}
        </div>
    </div>

    <!-- Apps Section -->
    <div class="w-full px-2 mb-4" style="-webkit-app-region: no-drag">
        <div class="border-t border-white/10 pt-4">
            <div class="flex flex-col gap-2">
                {#each workspaceApps as app (app.id)}
                    <div class="relative group">
                        <button
                            onclick={() => handleServiceClick(app.id)}
                            oncontextmenu={(e) => handleContextMenu(e, app.id)}
                            class="w-full h-12 rounded-xl hover:scale-105 flex items-center justify-center transition-all shadow-lg relative {serviceStore.activeServiceId === app.id ? 'opacity-100 ring-2 ring-white/30' : 'opacity-60 hover:opacity-80'}"
                            style="background: linear-gradient(135deg, {app.color || '#6366f1'}, {app.color || '#6366f1'}dd);"
                            title={app.name}
                        >
                            {#if app.icon}
                                <img
                                    src={app.icon}
                                    alt={app.name}
                                    class="w-6 h-6 object-contain"
                                    onerror={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.nextElementSibling.style.display = 'flex';
                                    }}
                                />
                            {/if}
                            <!-- Fallback letter avatar -->
                            <div
                                class="w-6 h-6 items-center justify-center text-white font-bold text-sm rounded"
                                style="display: {app.icon ? 'none' : 'flex'}; background-color: {app.color || '#6366f1'};"
                            >
                                {app.name[0]}
                            </div>
                        </button>

                        <!-- Hover Popup -->
                        {#if !contextMenu.show}
                            <div class="absolute left-full ml-3 top-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                <div class="bg-gray-900/95 backdrop-blur-xl rounded-xl shadow-2xl border border-white/20 p-4 min-w-[200px]">
                                    <p class="text-white font-medium mb-1">{app.name}</p>
                                    <p class="text-gray-500 text-xs">Right-click to remove</p>
                                </div>
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>
        </div>
    </div>

    <!-- Bottom Actions -->
    <div class="w-full px-2 mt-4 space-y-2" style="-webkit-app-region: no-drag">
        <!-- Settings Button -->
        <button
            onclick={handleOpenSettings}
            class="w-full h-10 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all group"
            title="Settings"
        >
            <Settings size={16} class="text-white/60 group-hover:text-white transition-colors" />
        </button>

        <!-- Logout Button -->
        <button
            onclick={handleLogout}
            class="w-full h-10 rounded-lg bg-white/5 hover:bg-red-500/20 flex items-center justify-center transition-all group"
            title="Logout"
        >
            <LogOut size={16} class="text-white/60 group-hover:text-red-400 transition-colors" />
        </button>
    </div>
</div>

<!-- Workspace Context Menu -->
{#if workspaceContextMenu.show}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="fixed inset-0 z-[100]"
        onclick={closeContextMenu}
    >
        <div
            class="absolute bg-gray-900/95 backdrop-blur-xl rounded-xl shadow-2xl border border-white/20 p-2 min-w-[150px] popup-container"
            style="left: {workspaceContextMenu.x}px; top: {workspaceContextMenu.y}px;"
            onclick={(e) => e.stopPropagation()}
        >
            <button
                onclick={() => {
                    console.log(`🗑️ Delete button clicked for workspace: ${workspaceContextMenu.workspaceId}`);
                    console.log(`📊 Current workspaces count: ${workspaces.length}`);
                    handleDeleteWorkspace(workspaceContextMenu.workspaceId);
                }}
                class="w-full px-3 py-2 text-left text-red-400 hover:bg-red-500/20 rounded-lg transition-colors flex items-center gap-2"
                type="button"
            >
                <Trash2 size={14} />
                Delete Workspace
            </button>
        </div>
    </div>
{:else}
    <!-- Debug: Context menu state -->
    <div style="display: none;">
        Context menu hidden: {JSON.stringify(workspaceContextMenu)}
    </div>
{/if}

<!-- App Context Menu -->
{#if contextMenu.show}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="fixed inset-0 z-[100]"
        onclick={closeContextMenu}
    >
        <div
            class="absolute bg-gray-900/95 backdrop-blur-xl rounded-xl shadow-2xl border border-white/20 p-2 min-w-[150px] popup-container"
            style="left: {contextMenu.x}px; top: {contextMenu.y}px;"
            onclick={(e) => e.stopPropagation()}
        >
            <button
                onclick={() => handleRemoveApp(contextMenu.serviceId)}
                class="w-full px-3 py-2 text-left text-red-400 hover:bg-red-500/20 rounded-lg transition-colors flex items-center gap-2"
            >
                <Trash2 size={14} />
                Remove App
            </button>
        </div>
    </div>
{/if}

<!-- Settings Modal -->
{#if isSettingsOpen}
    <SettingsModal onClose={handleCloseSettings} />
{/if}

<style>
    .custom-scrollbar::-webkit-scrollbar {
        width: 4px;
    }
    
    .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
    }
    
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 2px;
    }
    
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.3);
    }

    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
    }
    
    .animate-shake {
        animation: shake 0.5s ease-in-out;
    }
</style>