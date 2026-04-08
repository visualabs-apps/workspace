<script>
    import { serviceStore } from "../lib/services.svelte.js";
    import { tabStore } from "../lib/tabs.svelte.js";
    import { authStore } from "../lib/auth.svelte.js";
    import {
        workspaceStore,
        workspaceColors,
        workspaceIcons,
    } from "../lib/workspaces.svelte.js";
    import {
        Plus,
        Settings,
        LogOut,
        ChevronDown,
        Trash2,
        X,
    } from "lucide-svelte";
    import SettingsModal from "./SettingsModal.svelte";
    import AppSelectionModal from "./AppSelectionModal.svelte";
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
    let workspaceNameError = $state(false); // Error state for validation

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

    // Filter groups based on active workspace
    let workspaceGroups = $derived(
        serviceStore.services.filter(service => 
            activeWorkspace?.apps?.includes(service.id)
        )
    );

    // Add Group/App Popup state
    let isAddGroupPopupOpen = $state(false);
    let newGroupName = $state("");
    let newGroupColor = $state("#9d8c6b"); // Hex color for picker
    let showAppColorPicker = $state(false);
    let groupNameError = $state(false); // Error state for validation
    
    // Show app selection modal after group is created
    let showAppSelectionModal = $state(false);
    let pendingGroupName = $state("");
    let pendingGroupColor = $state("#9d8c6b");

    // Settings modal state
    let isSettingsOpen = $state(false);

    // Context menu state
    let contextMenu = $state({ show: false, x: 0, y: 0, serviceId: null });
    let workspaceContextMenu = $state({ show: false, x: 0, y: 0, workspaceId: null });
    
    // Edit service state
    let isEditServicePopupOpen = $state(false);
    let editServiceId = $state(null);
    let editServiceName = $state("");
    let editServiceUrl = $state("");
    let editServiceColor = $state("#9d8c6b");
    let showEditColorPicker = $state(false);

    function handleServiceClick(id) {
        serviceStore.setActive(id);
    }

    function toggleAddGroupPopup(e) {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        isAddGroupPopupOpen = !isAddGroupPopupOpen;
        isAddWorkspacePopupOpen = false; // Close other popups

        // Reset form
        if (isAddGroupPopupOpen) {
            newGroupName = "";
            newGroupColor = "#9d8c6b";
            showAppColorPicker = false;
            groupNameError = false; // Reset error state
        }
    }

    function handleCreateGroup() {
        console.log('handleCreateGroup called, newGroupName:', newGroupName);
        
        if (!newGroupName || !newGroupName.trim()) {
            console.log('Group name is empty, showing error');
            groupNameError = true; // Set error state
            // Remove error after 3 seconds
            setTimeout(() => {
                groupNameError = false;
            }, 3000);
            return;
        }

        console.log('Creating group:', newGroupName, newGroupColor);
        
        // Reset error state
        groupNameError = false;
        
        // Store group info
        pendingGroupName = newGroupName.trim();
        pendingGroupColor = newGroupColor;
        
        // Close popup first
        isAddGroupPopupOpen = false;
        
        // Reset form
        newGroupName = "";
        newGroupColor = "#9d8c6b";
        
        // Show modal after a small delay to ensure popup is closed
        setTimeout(() => {
            showAppSelectionModal = true;
            console.log('Modal should show:', showAppSelectionModal, pendingGroupName);
        }, 150);
    }
    
    function handleAppsSelected(selectedApps) {
        if (selectedApps.length === 0) return;
        
        // Create ONE service/group for all selected apps
        // Use the first app's info as the base, but with the group name
        const firstApp = selectedApps[0];
        const url = firstApp.customUrl || firstApp.url;
        const name = firstApp.customName || firstApp.name;
        
        // Create the group (service) with workspace partition
        const newService = serviceStore.addService(
            firstApp,
            url,
            name,
            pendingGroupName, // Group name
            activeWorkspace?.id // Pass workspace ID for shared partition
        );
        
        if (newService) {
            // Update the color
            serviceStore.updateService(newService.id, {
                color: pendingGroupColor
            });
            
            // Add to active workspace
            if (activeWorkspace) {
                workspaceStore.addAppToWorkspace(activeWorkspace.id, newService.id);
            }
            
            // Add additional apps as tabs (skip the first one since it's already created)
            for (let i = 1; i < selectedApps.length; i++) {
                const app = selectedApps[i];
                const appUrl = app.customUrl || app.url;
                const appName = app.customName || app.name;
                
                // Add as a new tab to this service
                tabStore.addTab(newService.id, appUrl, appName);
            }
            
            // Set this group as active
            serviceStore.setActive(newService.id);
        }
        
        // Close modal and reset
        handleAppSelectionClose();
    }
    
    function handleAppSelectionClose() {
        showAppSelectionModal = false;
        pendingGroupName = "";
        pendingGroupColor = "#9d8c6b";
    }

    function handleOpenSettings() {
        isSettingsOpen = true;
    }

    function handleCloseSettings() {
        isSettingsOpen = false;
    }

    function handleContextMenu(e, groupId) {
        e.preventDefault();
        e.stopPropagation();
        contextMenu = { show: true, x: e.clientX, y: e.clientY, serviceId: groupId };
    }
    
    function handleEditGroup(groupId) {
        const group = serviceStore.services.find(s => s.id === groupId);
        if (group) {
            editServiceId = groupId;
            editServiceName = group.groupName || group.name;
            editServiceUrl = group.url;
            editServiceColor = group.color || "#9d8c6b";
            isEditServicePopupOpen = true;
            closeContextMenu();
        }
    }
    
    function handleUpdateGroup() {
        if (!editServiceName.trim() || !editServiceId) return;
        
        // Normalize URL
        let urlToUse = editServiceUrl.trim() || "https://google.com";
        if (!urlToUse.startsWith('http://') && !urlToUse.startsWith('https://')) {
            urlToUse = 'https://' + urlToUse;
        }
        
        const iconToUse = `https://www.google.com/s2/favicons?domain=${urlToUse}&sz=128`;
        
        serviceStore.updateService(editServiceId, {
            groupName: editServiceName,
            name: editServiceName,
            url: urlToUse,
            icon: iconToUse,
            color: editServiceColor
        });
        
        isEditServicePopupOpen = false;
        editServiceId = null;
        editServiceName = "";
        editServiceUrl = "";
    }

    function handleWorkspaceContextMenu(e, workspaceId) {
        e.preventDefault();
        e.stopPropagation();
        workspaceContextMenu = { show: true, x: e.clientX, y: e.clientY, workspaceId };
    }

    function closeContextMenu() {
        contextMenu = { show: false, x: 0, y: 0, serviceId: null };
        workspaceContextMenu = { show: false, x: 0, y: 0, workspaceId: null };
    }
    
    function closeAllMenus() {
        isAddWorkspacePopupOpen = false;
        isAddGroupPopupOpen = false;
        isEditServicePopupOpen = false;
        showWorkspaceColorPicker = false;
        showAppColorPicker = false;
        showEditColorPicker = false;
        closeContextMenu();
    }

    function handleRemoveGroup(id) {
        // Direct remove without confirmation as requested
        serviceStore.removeService(id);
        workspaceStore.removeAppFromWorkspace(activeWorkspace.id, id);
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
        isAddGroupPopupOpen = false; // Close other popups

        // Reset form
        if (isAddWorkspacePopupOpen) {
            newWorkspaceName = "";
            newWorkspaceColor = "#9d8c6b";
            showWorkspaceColorPicker = false;
            workspaceNameError = false; // Reset error state
        }
    }

    function handleCreateWorkspace() {
        if (!newWorkspaceName || !newWorkspaceName.trim()) {
            workspaceNameError = true; // Set error state
            // Remove error after 3 seconds
            setTimeout(() => {
                workspaceNameError = false;
            }, 3000);
            return;
        }

        // Reset error state
        workspaceNameError = false;

        // Use SVG icon instead of emoji
        const svgIcon = `<svg viewBox="0 0 299.049 299.049" fill="currentColor"><path d="M289.181,206.929c-13.5-12.186-18.511-31.366-12.453-48.699c1.453-4.159-0.94-8.686-5.203-9.82 c-27.77-7.387-41.757-38.568-28.893-64.201c2.254-4.492-0.419-9.898-5.348-10.837c-26.521-5.069-42.914-32.288-34.734-58.251 c1.284-4.074-1.059-8.414-5.178-9.57C184.243,1.867,170.626,0,156.893,0C74.445,0,7.368,67.076,7.368,149.524 s67.076,149.524,149.524,149.524c57.835,0,109.142-33.056,133.998-83.129C292.4,212.879,291.701,209.204,289.181,206.929z M156.893,283.899c-74.095,0-134.374-60.281-134.374-134.374S82.799,15.15,156.893,15.15c9.897,0,19.726,1.078,29.311,3.21 c-5.123,29.433,11.948,57.781,39.41,67.502c-9.727,29.867,5.251,62.735,34.745,74.752c-4.104,19.27,1.49,39.104,14.46,53.365 C251.758,256.098,207.229,283.899,156.893,283.899z"/><path d="M76.388,154.997c-13.068,0-23.7,10.631-23.7,23.701c0,13.067,10.631,23.7,23.7,23.7c13.067,0,23.7-10.631,23.7-23.7 C100.087,165.628,89.456,154.997,76.388,154.997z M76.388,187.247c-4.715,0-8.55-3.835-8.55-8.55s3.835-8.551,8.55-8.551 c4.714,0,8.55,3.836,8.55,8.551S81.102,187.247,76.388,187.247z"/><path d="M173.224,90.655c0-14.9-12.121-27.021-27.02-27.021s-27.021,12.121-27.021,27.021c0,14.898,12.121,27.02,27.021,27.02 C161.104,117.674,173.224,105.553,173.224,90.655z M134.334,90.655c0-6.545,5.325-11.871,11.871-11.871 c6.546,0,11.87,5.325,11.87,11.871s-5.325,11.87-11.87,11.87S134.334,97.199,134.334,90.655z"/><path d="M169.638,187.247c-19.634,0-35.609,15.974-35.609,35.61c0,19.635,15.974,35.61,35.609,35.61 c19.635,0,35.61-15.974,35.61-35.61C205.247,203.221,189.273,187.247,169.638,187.247z M169.638,243.315 c-11.281,0-20.458-9.178-20.458-20.46s9.178-20.46,20.458-20.46c11.281,0,20.46,9.178,20.46,20.46 S180.92,243.315,169.638,243.315z"/></svg>`;

        workspaceStore.createWorkspace(
            newWorkspaceName.trim(),
            svgIcon,
            { name: 'custom', value: newWorkspaceColor, hex: newWorkspaceColor }
        );

        isAddWorkspacePopupOpen = false;
        newWorkspaceName = "";
    }

    function handleDeleteWorkspace(workspaceId) {
        if (workspaces.length > 1 && confirm("Delete this workspace?")) {
            // Get the workspace to be deleted
            const workspaceToDelete = workspaces.find(w => w.id === workspaceId);
            
            // Remove all apps that belong to this workspace
            if (workspaceToDelete && workspaceToDelete.apps) {
                workspaceToDelete.apps.forEach(appId => {
                    serviceStore.removeService(appId);
                });
            }
            
            // Delete the workspace
            workspaceStore.deleteWorkspace(workspaceId);
        }
        closeContextMenu();
    }

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

    // Color picker helpers
    const presetColors = [
        '#6B21A8', '#4F46E5', '#2563EB', '#0EA5E9', '#06B6D4', '#14B8A6', '#10B981', '#EAB308',
        '#F97316', '#EF4444', '#EC4899', '#A855F7', '#8B5CF6', '#60A5FA', '#38BDF8', '#22D3EE',
        '#5EEAD4', '#FDE047', '#FCD34D', '#FCA5A5'
    ];

    // Hue slider state
    let workspaceHue = $state(0);
    let appHue = $state(0);
    let editHue = $state(0);

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

    function hueToRgb(hue) {
        const h = hue / 60;
        const c = 255;
        const x = c * (1 - Math.abs((h % 2) - 1));
        
        let r = 0, g = 0, b = 0;
        if (h >= 0 && h < 1) { r = c; g = x; b = 0; }
        else if (h >= 1 && h < 2) { r = x; g = c; b = 0; }
        else if (h >= 2 && h < 3) { r = 0; g = c; b = x; }
        else if (h >= 3 && h < 4) { r = 0; g = x; b = c; }
        else if (h >= 4 && h < 5) { r = x; g = 0; b = c; }
        else if (h >= 5 && h < 6) { r = c; g = 0; b = x; }
        
        return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
    }

    function updateWorkspaceColorFromHue() {
        const rgb = hueToRgb(workspaceHue);
        workspaceRgb = rgb;
        newWorkspaceColor = rgbToHex(rgb.r, rgb.g, rgb.b);
    }

    function updateAppColorFromHue() {
        const rgb = hueToRgb(appHue);
        appRgb = rgb;
        newGroupColor = rgbToHex(rgb.r, rgb.g, rgb.b);
    }
    
    function updateEditColorFromHue() {
        const rgb = hueToRgb(editHue);
        editRgb = rgb;
        editServiceColor = rgbToHex(rgb.r, rgb.g, rgb.b);
    }

    $effect(() => {
        // Sync RGB values when hex changes for workspace
        if (newWorkspaceColor && /^#[0-9A-F]{6}$/i.test(newWorkspaceColor)) {
            const rgb = hexToRgb(newWorkspaceColor);
            workspaceRgb = rgb;
        }
    });

    $effect(() => {
        // Sync RGB values when hex changes for app
        if (newGroupColor && /^#[0-9A-F]{6}$/i.test(newGroupColor)) {
            const rgb = hexToRgb(newGroupColor);
            appRgb = rgb;
        }
    });
    
    $effect(() => {
        // Sync RGB values when hex changes for edit
        if (editServiceColor && /^#[0-9A-F]{6}$/i.test(editServiceColor)) {
            const rgb = hexToRgb(editServiceColor);
            editRgb = rgb;
        }
    });

    let workspaceRgb = $state({ r: 157, g: 140, b: 107 });
    let appRgb = $state({ r: 157, g: 140, b: 107 });
    let editRgb = $state({ r: 157, g: 140, b: 107 });
    let editPickerPosition = $state('bottom');

    // Color picker position detection
    let workspaceColorPickerButton = $state(null);
    let appColorPickerButton = $state(null);
    let workspacePickerPosition = $state('bottom'); // 'top' or 'bottom'
    let appPickerPosition = $state('bottom'); // 'top' or 'bottom'

    function detectPickerPosition(buttonElement) {
        if (!buttonElement) return 'bottom';
        
        const rect = buttonElement.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const spaceBelow = viewportHeight - rect.bottom;
        const spaceAbove = rect.top;
        const pickerHeight = 380; // Approximate height of color picker
        
        // If not enough space below but enough space above, show on top
        if (spaceBelow < pickerHeight && spaceAbove > pickerHeight) {
            return 'top';
        }
        
        return 'bottom';
    }

    $effect(() => {
        if (showWorkspaceColorPicker && workspaceColorPickerButton) {
            workspacePickerPosition = detectPickerPosition(workspaceColorPickerButton);
        }
    });

    $effect(() => {
        if (showAppColorPicker && appColorPickerButton) {
            appPickerPosition = detectPickerPosition(appColorPickerButton);
        }
    });

    // Close popups when clicking outside
    $effect(() => {
        function handleClickOutside(event) {
            const target = event.target;
            
            // Find if click is inside any popup or button that opens popup
            const isInsidePopup = target.closest('.popup-container');
            const isPopupButton = target.closest('.popup-trigger-button');
            const isOverlay = target.classList.contains('popup-overlay');
            
            if ((!isInsidePopup && !isPopupButton) || isOverlay) {
                closeAllMenus();
            }
        }

        // Only add handler if any popup is open
        if (isAddWorkspacePopupOpen || isAddGroupPopupOpen || isEditServicePopupOpen || showAppSelectionModal || showWorkspaceColorPicker || showAppColorPicker || showEditColorPicker || contextMenu.show || workspaceContextMenu.show) {
            // Add with a small delay to avoid immediate closure
            const timeoutId = setTimeout(() => {
                window.addEventListener('mousedown', handleClickOutside, true);
            }, 100);

            // Cleanup
            return () => {
                clearTimeout(timeoutId);
                window.removeEventListener('mousedown', handleClickOutside, true);
            };
        }
    });

    function updateWorkspaceColorFromRgb() {
        newWorkspaceColor = rgbToHex(workspaceRgb.r, workspaceRgb.g, workspaceRgb.b);
    }

    function updateAppColorFromRgb() {
        newGroupColor = rgbToHex(appRgb.r, appRgb.g, appRgb.b);
    }
    
    function updateEditColorFromRgb() {
        editServiceColor = rgbToHex(editRgb.r, editRgb.g, editRgb.b);
    }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="w-18 h-full bg-[#2c4a4a] text-white flex flex-col items-center py-3 shrink-0 shadow-xl relative z-50 select-none"
    style="-webkit-app-region: drag"
>
    <!-- Add Workspace Button (Small Plus) -->
    <div class="w-full px-2 mb-2" style="-webkit-app-region: no-drag">
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
                    // Close color picker when clicking inside popup but outside color picker
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
                    Create a new workspace to organize your apps
                </p>

                <!-- Workspace Name Input -->
                <input
                    type="text"
                    bind:value={newWorkspaceName}
                    placeholder="Workspace name (e.g., Work, Personal)"
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
                    <p class="text-red-400 text-xs mb-3 ml-1">Workspace name is required</p>
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

                                <!-- Hue Slider -->
                                <div class="mb-3">
                                    <input
                                        type="range"
                                        bind:value={workspaceHue}
                                        oninput={updateWorkspaceColorFromHue}
                                        min="0"
                                        max="360"
                                        class="w-full h-6 rounded cursor-pointer appearance-none"
                                        style="background: linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%);"
                                    />
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

    <!-- Workspace Section - 2 Column Grid -->
    <div class="w-full px-2 mb-3" style="-webkit-app-region: no-drag">
        <div class="grid grid-cols-2 gap-2">
            {#each workspaces as workspace (workspace.id)}
                <div class="relative group">
                    <button
                        onclick={() => handleWorkspaceSwitch(workspace.id)}
                        oncontextmenu={(e) => handleWorkspaceContextMenu(e, workspace.id)}
                        class="w-full aspect-square rounded-xl hover:scale-105 flex items-center justify-center transition-all shadow-lg relative {workspace.id === activeWorkspace?.id ? 'opacity-100' : 'opacity-40'}"
                        style="background: linear-gradient(135deg, {workspace.color?.hex || workspace.color?.value || '#6366f1'}, {workspace.color?.hex || workspace.color?.value || '#6366f1'}dd);"
                        title={workspace.name}
                    >
                        <!-- SVG Icon in white -->
                        {#if workspace.icon.startsWith('<svg')}
                            <div class="w-6 h-6 text-white">
                                {@html workspace.icon}
                            </div>
                        {:else}
                            <span class="text-2xl text-white">{workspace.icon}</span>
                        {/if}
                    </button>

                    <!-- Hover Popup - Hidden when context menu is open -->
                    {#if !workspaceContextMenu.show}
                        <div class="absolute left-full ml-3 top-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                            <div class="bg-gray-900/95 backdrop-blur-xl rounded-xl shadow-2xl border border-white/20 p-4 min-w-[200px]">
                                <p class="text-white font-medium mb-1">{workspace.name}</p>
                                <p class="text-gray-500 text-xs">Right-click to edit</p>
                            </div>
                        </div>
                    {/if}
                </div>
            {/each}
        </div>
    </div>

    <!-- Divider between Workspace and Apps -->
    <div class="w-14 h-0.5 bg-white/30 mb-3 rounded-full"></div>

    <!-- Apps Section - 1 Column -->
    <div
        class="flex-1 w-full overflow-y-auto overflow-x-hidden custom-scrollbar px-2"
        style="-webkit-app-region: no-drag"
    >
        <!-- Group List (1 column) -->
        <div class="flex flex-col gap-2">
            {#each workspaceGroups as group (group.id)}
                {@const groupTabs = tabStore.getServiceTabs(group.id)}
                {@const activeTabId = tabStore.getActiveTabId(group.id)}
                {@const activeTab = tabStore.getActiveTab(group.id)}
                {@const hasMultipleTabs = groupTabs.length > 1}
                {@const hasNoTabs = groupTabs.length === 0}
                {@const displayIcon = activeTab?.favicon || groupTabs[0]?.favicon || group.icon}
                
                <div class="relative group flex justify-center">
                    <!-- Active Indicator - Left Border -->
                    {#if serviceStore.activeServiceId === group.id}
                        <div 
                            class="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full shadow-lg"
                            style="background: {group.color || '#f59e0b'};"
                        ></div>
                    {/if}
                    
                    <!-- Unread Badge -->
                    {#if group.unreadCount > 0}
                        <div
                            class="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 bg-red-500 rounded-full text-[9px] flex items-center justify-center border-2 border-gray-900 z-10 font-bold shadow-lg"
                        >
                            {group.unreadCount > 99 ? "99+" : group.unreadCount}
                        </div>
                    {/if}

                    <button
                        class="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 overflow-hidden relative bg-white/10 hover:bg-white/15 hover:scale-105"
                        onclick={(e) => {
                            e.stopPropagation();
                            handleServiceClick(group.id);
                        }}
                        oncontextmenu={(e) => handleContextMenu(e, group.id)}
                        title={group.groupName || group.name}
                    >
                        {#if hasNoTabs}
                            <!-- No tabs: Show default icon -->
                            <svg class="w-6 h-6 text-white/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                <line x1="12" y1="8" x2="12" y2="16"></line>
                                <line x1="8" y1="12" x2="16" y2="12"></line>
                            </svg>
                        {:else if hasMultipleTabs}
                            <!-- Multiple Tabs: Show 2x2 grid -->
                            <div class="w-full h-full p-2">
                                <div class="grid grid-cols-2 gap-1.5 w-full h-full">
                                    {#each groupTabs.slice(0, 4) as tab}
                                        <div class="flex items-center justify-center overflow-hidden">
                                            {#if tab.favicon}
                                                <img
                                                    src={tab.favicon}
                                                    alt={tab.title}
                                                    class="w-5 h-5 object-contain"
                                                />
                                            {:else if displayIcon}
                                                <img
                                                    src={displayIcon}
                                                    alt={group.name}
                                                    class="w-5 h-5 object-contain"
                                                />
                                            {:else}
                                                <span class="text-[9px] font-bold text-white">
                                                    {(tab.title || group.name).substring(0, 1).toUpperCase()}
                                                </span>
                                            {/if}
                                        </div>
                                    {/each}
                                    <!-- Fill empty slots to complete 2x2 grid -->
                                    {#each Array(4 - Math.min(4, groupTabs.length)) as _}
                                        <div class="bg-transparent"></div>
                                    {/each}
                                </div>
                            </div>
                        {:else}
                            <!-- Single Tab: Show single icon from active tab favicon -->
                            {#if displayIcon}
                                <img
                                    src={displayIcon}
                                    alt={activeTab?.title || group.name}
                                    class="w-6 h-6 object-contain pointer-events-none"
                                />
                            {:else}
                                <span
                                    class="text-xs font-bold {serviceStore.activeServiceId ===
                                    group.id
                                        ? 'text-pink-600'
                                        : 'text-white'}"
                                >
                                    {(activeTab?.title || group.name).substring(0, 2).toUpperCase()}
                                </span>
                            {/if}
                        {/if}
                    </button>

                    <!-- Tooltip -->
                    <div
                        class="absolute left-full ml-3 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl"
                    >
                        {group.groupName || group.name}
                        {#if hasMultipleTabs}
                            <span class="ml-2 text-gray-400">({groupTabs.length} tabs)</span>
                        {/if}
                        {#if group.unreadCount > 0}
                            <span class="ml-2 text-red-400"
                                >({group.unreadCount})</span
                            >
                        {/if}
                    </div>
                </div>
            {/each}
        </div>
    </div>

    <!-- Bottom Actions -->
    <div
        class="w-full px-2 pt-3 space-y-2 border-t border-white/10 mt-3 relative"
        style="-webkit-app-region: no-drag"
    >
        <!-- Add Button (Dashed Border) -->
        <div class="flex justify-center relative">
            <button
                class="popup-trigger-button w-12 h-12 rounded-xl border-2 border-dashed border-white/20 hover:border-white/40 text-white/40 hover:text-white/60 flex items-center justify-center transition-all hover:scale-105 group bg-transparent"
                onclick={(e) => toggleAddGroupPopup(e)}
                title="Add Group"
            >
                <Plus
                    size={20}
                    class="group-hover:rotate-90 transition-transform duration-300"
                />
            </button>

            <!-- Add App Popup -->
            {#if isAddGroupPopupOpen}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                    class="popup-container absolute left-full bottom-0 ml-3 w-80 bg-black/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-4 z-50 text-white"
                    onclick={(e) => {
                        e.stopPropagation();
                        // Close color picker when clicking inside popup but outside color picker
                        const isColorPickerButton = e.target.closest('.popup-trigger-button');
                        const isColorPickerPopup = e.target.closest('.popup-container.absolute.left-0');
                        if (!isColorPickerButton && !isColorPickerPopup) {
                            showAppColorPicker = false;
                        }
                    }}
                >
                    <div class="flex items-center gap-2 mb-1">
                        <Plus size={18} class="text-white" />
                        <h3 class="font-bold text-lg">Add Group</h3>
                    </div>
                    <p class="text-xs text-gray-400 mb-4">
                        Create a new group for your apps
                    </p>

                    <!-- Group Name Input -->
                    <input
                        type="text"
                        bind:value={newGroupName}
                        placeholder="Group name (e.g., Work, Personal)"
                        class="w-full px-4 py-3 bg-black/30 border rounded-xl mb-1 text-white placeholder-gray-500 focus:outline-none transition-colors {groupNameError ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500 animate-shake' : 'border-white/20 focus:border-pink-500 focus:ring-1 focus:ring-pink-500'}"
                        onkeydown={(e) => {
                            e.stopPropagation();
                            if (e.key === "Enter") handleCreateGroup();
                        }}
                        oninput={() => {
                            if (groupNameError) groupNameError = false;
                        }}
                    />
                    {#if groupNameError}
                        <p class="text-red-400 text-xs mb-3 ml-1">Group name is required</p>
                    {:else}
                        <div class="mb-3"></div>
                    {/if}

                    <!-- Color Picker -->
                    <div class="mb-4">
                        <span class="text-xs font-medium text-gray-300 mb-2 block">Group Color</span>
                        <div class="relative">
                            <button
                                type="button"
                                bind:this={appColorPickerButton}
                                onclick={(e) => {
                                    e.stopPropagation();
                                    showAppColorPicker = !showAppColorPicker;
                                }}
                                class="popup-trigger-button w-full h-12 rounded-xl border-2 border-white/20 hover:border-white/40 transition-colors flex items-center gap-3 px-3"
                                style="background-color: {newGroupColor}"
                            >
                                <div class="w-8 h-8 rounded-lg border-2 border-white/30" style="background-color: {newGroupColor}"></div>
                                <span class="text-sm font-mono text-white">{newGroupColor.toUpperCase()}</span>
                            </button>

                            {#if showAppColorPicker}
                                <!-- svelte-ignore a11y_click_events_have_key_events -->
                                <!-- svelte-ignore a11y_no_static_element_interactions -->
                                <div 
                                    class="popup-container absolute left-0 z-[60] bg-white rounded-xl p-3 shadow-2xl border border-gray-200 w-[280px] {appPickerPosition === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'}"
                                    onclick={(e) => e.stopPropagation()}
                                >
                                    <!-- Color Preview -->
                                    <div class="mb-3">
                                        <div 
                                            class="w-full h-32 rounded-lg border-2 border-gray-200"
                                            style="background-color: {newGroupColor}"
                                        ></div>
                                    </div>

                                    <!-- Hue Slider -->
                                    <div class="mb-3">
                                        <input
                                            type="range"
                                            bind:value={appHue}
                                            oninput={updateAppColorFromHue}
                                            min="0"
                                            max="360"
                                            class="w-full h-6 rounded cursor-pointer appearance-none"
                                            style="background: linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%);"
                                        />
                                    </div>

                                    <!-- Color Values -->
                                    <div class="grid grid-cols-4 gap-1.5 mb-3">
                                        <div>
                                            <label class="text-[10px] text-gray-600 mb-0.5 block text-center font-medium">Hex
                                            <input
                                                type="text"
                                                bind:value={newGroupColor}
                                                class="w-full px-1.5 py-1.5 bg-gray-50 border border-gray-200 rounded text-center text-xs font-mono text-gray-900 focus:outline-none focus:border-blue-500"
                                                maxlength="7"
                                            /></label>
                                        </div>
                                        <div>
                                            <label class="text-[10px] text-gray-600 mb-0.5 block text-center font-medium">R
                                            <input
                                                type="number"
                                                bind:value={appRgb.r}
                                                oninput={updateAppColorFromRgb}
                                                min="0"
                                                max="255"
                                                class="w-full px-1.5 py-1.5 bg-gray-50 border border-gray-200 rounded text-center text-xs text-gray-900 focus:outline-none focus:border-blue-500"
                                            /></label>
                                        </div>
                                        <div>
                                            <label class="text-[10px] text-gray-600 mb-0.5 block text-center font-medium">G
                                            <input
                                                type="number"
                                                bind:value={appRgb.g}
                                                oninput={updateAppColorFromRgb}
                                                min="0"
                                                max="255"
                                                class="w-full px-1.5 py-1.5 bg-gray-50 border border-gray-200 rounded text-center text-xs text-gray-900 focus:outline-none focus:border-blue-500"
                                            /></label>
                                        </div>
                                        <div>
                                            <label class="text-[10px] text-gray-600 mb-0.5 block text-center font-medium">B
                                            <input
                                                type="number"
                                                bind:value={appRgb.b}
                                                oninput={updateAppColorFromRgb}
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
                                                    newGroupColor = color;
                                                    appRgb = hexToRgb(color);
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
                            onclick={(e) => {
                                console.log('Button clicked!', e);
                                e.stopPropagation();
                                e.preventDefault();
                                handleCreateGroup();
                            }}
                        >
                            Continue Select Apps
                        </button>
                        <button
                            class="px-4 py-2.5 text-gray-400 hover:text-white transition-colors"
                            onclick={(e) => {
                                console.log('Cancel clicked!');
                                e.stopPropagation();
                                isAddGroupPopupOpen = false;
                            }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            {/if}
        </div>
        
        <!-- Edit Service Popup -->
        {#if isEditServicePopupOpen}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
                class="popup-container absolute left-full bottom-0 ml-3 w-80 bg-black/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-4 z-50 text-white"
                onclick={(e) => {
                    e.stopPropagation();
                }}
            >
                <div class="flex items-center gap-2 mb-1">
                    <Settings size={18} class="text-white" />
                    <h3 class="font-bold text-lg">Edit Group</h3>
                </div>
                <p class="text-xs text-gray-400 mb-4">
                    Update group settings
                </p>

                <!-- Group Name Input -->
                <input
                    type="text"
                    bind:value={editServiceName}
                    placeholder="Group name"
                    class="w-full px-4 py-3 bg-black/30 border border-white/20 rounded-xl mb-3 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-colors"
                    onkeydown={(e) => {
                        e.stopPropagation();
                    }}
                />

                <!-- URL Input -->
                <input
                    type="text"
                    bind:value={editServiceUrl}
                    placeholder="URL"
                    class="w-full px-4 py-3 bg-black/30 border border-white/20 rounded-xl mb-4 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-colors text-sm"
                    onkeydown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter") handleUpdateService();
                    }}
                />

                <!-- Color Picker -->
                <div class="mb-4">
                    <span class="text-xs font-medium text-gray-300 mb-2 block">Group Color</span>
                    <button
                        type="button"
                        onclick={(e) => {
                            e.stopPropagation();
                            showEditColorPicker = !showEditColorPicker;
                        }}
                        class="popup-trigger-button w-full h-12 rounded-xl border-2 border-white/20 hover:border-white/40 transition-colors flex items-center gap-3 px-3"
                        style="background-color: {editServiceColor}"
                    >
                        <div class="w-8 h-8 rounded-lg border-2 border-white/30" style="background-color: {editServiceColor}"></div>
                        <span class="text-sm font-mono text-white">{editServiceColor.toUpperCase()}</span>
                    </button>
                </div>

                <div class="flex items-center gap-3">
                    <button
                        class="flex-1 bg-gradient-to-r from-[#9d8c6b] to-[#8b4a6b] hover:from-[#b09a7a] hover:to-[#9d5a7a] text-white font-medium py-2.5 rounded-xl transition-colors shadow-lg shadow-black/50"
                        onclick={handleUpdateGroup}
                    >
                        Update
                    </button>
                    <button
                        class="px-4 py-2.5 text-gray-400 hover:text-white transition-colors"
                        onclick={() => isEditServicePopupOpen = false}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        {/if}

        <!-- Settings & Logout Row -->
        <div class="flex items-center justify-center gap-3 pb-1">
            <!-- Settings -->
            <button
                onclick={handleOpenSettings}
                class="w-9 h-9 rounded-lg bg-transparent hover:bg-white/10 text-white/50 hover:text-white transition-all flex items-center justify-center"
                title="Settings"
            >
                <Settings size={18} />
            </button>

            <!-- Logout -->
            <button
                onclick={handleLogout}
                class="w-9 h-9 rounded-lg bg-transparent hover:bg-red-500/20 text-white/50 hover:text-red-400 transition-all flex items-center justify-center"
                title="Logout"
            >
                <LogOut size={18} />
            </button>
        </div>
    </div>
</div>

<!-- Context Menu -->
{#if contextMenu.show}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
        class="popup-container fixed z-50 bg-gray-900/95 backdrop-blur-xl rounded-xl shadow-2xl border border-white/20 py-1 min-w-[160px]"
        style="left: {contextMenu.x}px; top: {contextMenu.y}px;"
        onclick={(e) => e.stopPropagation()}
    >
        <button
            class="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/10 flex items-center gap-2"
            onclick={() => handleEditGroup(contextMenu.serviceId)}
        >
            <Settings size={16} />
            Edit Group
        </button>
        <button
            class="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"
            onclick={() => handleRemoveGroup(contextMenu.serviceId)}
        >
            <Trash2 size={16} />
            Remove Group
        </button>
    </div>
{/if}

<!-- Workspace Context Menu -->
{#if workspaceContextMenu.show}
    {@const selectedWorkspace = workspaces.find(w => w.id === workspaceContextMenu.workspaceId)}
    
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
        class="popup-container fixed z-50 bg-gray-900/95 backdrop-blur-xl rounded-xl shadow-2xl border border-white/20 py-2 min-w-[200px]"
        style="left: {workspaceContextMenu.x}px; top: {workspaceContextMenu.y}px;"
        onclick={(e) => e.stopPropagation()}
    >
        {#if selectedWorkspace}
            <!-- Workspace Name Header -->
            <div class="px-4 py-2 border-b border-white/10">
                <div class="flex items-center gap-2">
                    {#if selectedWorkspace.icon.startsWith('<svg')}
                        <div class="w-5 h-5 text-white">
                            {@html selectedWorkspace.icon}
                        </div>
                    {:else}
                        <span class="text-xl">{selectedWorkspace.icon}</span>
                    {/if}
                    <span class="text-white font-medium text-sm">{selectedWorkspace.name}</span>
                </div>
            </div>

            <!-- Color Picker -->
            <div class="px-4 py-3 border-b border-white/10">
                <div class="flex gap-2 flex-wrap">
                    {#each workspaceColors.slice(0, 8) as color}
                        <button
                            class="w-6 h-6 rounded-lg bg-gradient-to-br {color.value} hover:scale-110 transition-all"
                            title={color.label ?? color.value}
                            aria-label="Set color {color.label ?? color.value}"
                            onclick={() => {
                                workspaceStore.updateWorkspace(selectedWorkspace.id, { color });
                                closeContextMenu();
                            }}
                        ></button>
                    {/each}
                </div>
            </div>

            <!-- Actions -->
            {#if workspaces.length > 1}
                <div class="h-px bg-white/10 my-1"></div>
                <button
                    class="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                    onclick={() => handleDeleteWorkspace(selectedWorkspace.id)}
                >
                    <Trash2 size={16} />
                    Delete Space
                </button>
            {/if}
        {/if}
    </div>
{/if}

{#if isSettingsOpen}
    <SettingsModal onClose={handleCloseSettings} />
{/if}

{#if showAppSelectionModal}
    <AppSelectionModal 
        groupName={pendingGroupName}
        onAppsSelect={handleAppsSelected}
        onClose={handleAppSelectionClose}
    />
{/if}

<!-- Overlay to catch clicks outside popup -->
{#if isAddWorkspacePopupOpen || isAddGroupPopupOpen || isEditServicePopupOpen || showWorkspaceColorPicker || showAppColorPicker || showEditColorPicker || contextMenu.show || workspaceContextMenu.show}
    <div class="popup-overlay fixed inset-0 z-40" style="background: transparent;"></div>
{/if}

<style>
    .custom-scrollbar::-webkit-scrollbar {
        width: 4px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.15);
        border-radius: 4px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.25);
    }

    .custom-scrollbar-light::-webkit-scrollbar {
        width: 6px;
    }
    .custom-scrollbar-light::-webkit-scrollbar-track {
        background: transparent;
    }
    .custom-scrollbar-light::-webkit-scrollbar-thumb {
        background: rgba(0, 0, 0, 0.1);
        border-radius: 6px;
    }
    .custom-scrollbar-light::-webkit-scrollbar-thumb:hover {
        background: rgba(0, 0, 0, 0.2);
    }
    
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
        20%, 40%, 60%, 80% { transform: translateX(5px); }
    }
    
    .animate-shake {
        animation: shake 0.5s ease-in-out;
    }
</style>

