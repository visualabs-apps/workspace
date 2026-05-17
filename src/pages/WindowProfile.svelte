<script>
    import ChildWindowControls from "../components/layout/ChildWindowControls.svelte";
    import { User, ChevronDown, Cookie } from "lucide-svelte";
    import { createChromeProfile, updateChromeProfile } from "../lib/api/api.js";
    import { toastStore } from "../lib/managers/toast.svelte.js";
    import { openPredefinedWindow } from "../lib/utils/childWindow.js";

    const WINDOW_ID = 'profile-window';

    // Receive data from parent window via IPC
    let mode = $state('add');
    let editingProfile = $state(null);
    let clients = $state([]);
    let isLoadingClients = $state(false);

    // Listen for window data from parent
    $effect(() => {
        const handleWindowData = (data) => {
            console.log('[WindowProfile] Received data:', data);
            if (data.mode) mode = data.mode;
            if (data.editingProfile) editingProfile = data.editingProfile;
            if (data.clients) clients = data.clients;
            if (data.isLoadingClients !== undefined) isLoadingClients = data.isLoadingClients;
        };

        // Check if window.api has the data listener
        if (window.api?.onWindowData) {
            window.api.onWindowData(handleWindowData);
        }
    });

    let profileName = $state("");
    let selectedClient = $state(null);
    let userAgent = $state("");
    let profileColor = $state("#9d8c6b");
    let showClientDropdown = $state(false);
    let nameError = $state(false);
    let isSubmitting = $state(false);

    const presetColors = [
        '#6B21A8', '#4F46E5', '#2563EB', '#0EA5E9', '#06B6D4', '#14B8A6', '#10B981', '#EAB308',
        '#F97316', '#EF4444', '#EC4899', '#A855F7', '#8B5CF6', '#60A5FA', '#38BDF8', '#22D3EE',
        '#5EEAD4', '#FDE047', '#FCD34D', '#FCA5A5'
    ];

    $effect(() => {
        if (mode === 'edit' && editingProfile) {
            profileName = editingProfile.name;
            profileColor = editingProfile.color?.hex || editingProfile.color?.value || editingProfile.color || '#9d8c6b';
            userAgent = editingProfile.userAgent || "";
            selectedClient = clients.find(c => c.id === editingProfile.customerId) || null;
        }
    });

    function resetForm() {
        profileName = "";
        selectedClient = null;
        userAgent = "";
        profileColor = getRandomColor();
        showClientDropdown = false;
        nameError = false;
    }

    function getRandomColor() {
        return presetColors[Math.floor(Math.random() * presetColors.length)];
    }

    function selectClient(client) {
        selectedClient = client;
        showClientDropdown = false;
        
        // Notify parent window of client selection (send only serializable data)
        if (window.api?.sendToParent && client) {
            const { id, name, email } = client;
            window.api.sendToParent('client-selected', { id, name, email: email || '' });
        } else if (window.api?.sendToParent) {
            window.api.sendToParent('client-selected', null);
        }
        
        if (!profileName && client) {
            profileName = client.name;
        }
    }

    async function handleSubmit() {
        nameError = false;
        if (!profileName.trim()) {
            nameError = true;
            return;
        }

        isSubmitting = true;
        try {
            let result;
            if (mode === 'edit' && editingProfile) {
                result = await updateChromeProfile(editingProfile.id, {
                    name: profileName.trim(),
                    customerId: selectedClient?.id || null,
                    userAgent: userAgent.trim() || null
                });
            } else {
                result = await createChromeProfile({
                    name: profileName.trim(),
                    ...(selectedClient?.id ? { customerId: selectedClient.id } : {}),
                    userAgent: userAgent.trim() || undefined
                });
            }

            if (result.success) {
                toastStore.success(mode === 'edit' ? 'Profile updated!' : 'Profile created!');
                
                // Notify parent window of success
                if (window.api?.sendToParent) {
                    window.api.sendToParent('profile-success', {
                        profile: result.data,
                        color: profileColor
                    });
                }
                
                handleClose();
            } else {
                toastStore.error(result.error || 'Failed to save profile');
            }
        } catch (error) {
            console.error('Profile save error:', error);
            toastStore.error('Failed to save profile');
        } finally {
            isSubmitting = false;
        }
    }

    function handleClose() {
        resetForm();
        window.api.close();
    }

    async function openCookieManager() {
        if (editingProfile) {
            const partition = `persist:workspace-${editingProfile.id}`;
            await openPredefinedWindow('COOKIE_MANAGER', { partition, profileId: editingProfile.id });
        }
    }
</script>

<div class="w-full h-screen flex flex-col bg-white">
    <!-- Custom Title Bar -->
    <div class="h-10 bg-gray-50 border-b border-gray-200 flex items-center justify-between px-4" style="-webkit-app-region: drag">
        <div class="flex items-center gap-2">
            <User size={16} class="text-blue-600" />
            <span class="text-sm font-medium text-gray-700">Profile</span>
        </div>
        <div style="-webkit-app-region: no-drag">
            <ChildWindowControls variant="light" windowId={WINDOW_ID} />
        </div>
    </div>
    
    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-6">
        <div class="space-y-4">
            <!-- Profile Name -->
            <div>
                <label class="block text-sm font-semibold text-gray-900 mb-2">
                    Profile Name <span class="text-red-500">*</span>
                </label>
                <input
                    type="text"
                    bind:value={profileName}
                    placeholder="Enter profile name"
                    class="w-full px-4 py-2 border {nameError ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                />
                {#if nameError}
                    <p class="text-xs text-red-500 mt-1">Profile name is required</p>
                {/if}
            </div>

            <!-- Client Selection -->
            <div>
                <label class="block text-sm font-semibold text-gray-900 mb-2">
                    Client (Optional)
                </label>
                <div class="relative">
                    <button
                        type="button"
                        onclick={() => showClientDropdown = !showClientDropdown}
                        class="w-full px-4 py-2 border border-gray-300 rounded-lg text-left flex items-center justify-between hover:border-gray-400 transition-colors"
                    >
                        <span class="text-gray-700">
                            {selectedClient ? selectedClient.name : 'Select a client'}
                        </span>
                        <ChevronDown size={16} class="text-gray-400" />
                    </button>

                    {#if showClientDropdown}
                        <div class="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                            <button
                                type="button"
                                onclick={() => selectClient(null)}
                                class="w-full px-4 py-2 text-left hover:bg-gray-50 text-gray-500"
                            >
                                No client
                            </button>
                            {#each clients as client}
                                <button
                                    type="button"
                                    onclick={() => selectClient(client)}
                                    class="w-full px-4 py-2 text-left hover:bg-gray-50 {selectedClient?.id === client.id ? 'bg-blue-50 text-blue-600' : 'text-gray-700'}"
                                >
                                    {client.name}
                                </button>
                            {/each}
                        </div>
                    {/if}
                </div>
            </div>

            <!-- Color Picker -->
            <div>
                <label class="block text-sm font-semibold text-gray-900 mb-2">
                    Profile Color
                </label>
                <div class="flex gap-2 flex-wrap">
                    {#each presetColors as color}
                        <button
                            type="button"
                            onclick={() => profileColor = color}
                            class="w-10 h-10 rounded-lg border-2 {profileColor === color ? 'border-gray-900 scale-110' : 'border-gray-200'} transition-all hover:scale-110"
                            style="background-color: {color}"
                            aria-label="Select color {color}"
                        ></button>
                    {/each}
                </div>
            </div>

            <!-- User Agent (Optional) -->
            <div>
                <label class="block text-sm font-semibold text-gray-900 mb-2">
                    User Agent (Optional)
                </label>
                <input
                    type="text"
                    bind:value={userAgent}
                    placeholder="Leave empty for default"
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900"
                />
            </div>

            <!-- Cookie Manager Button (Edit mode only) -->
            {#if mode === 'edit' && editingProfile}
                <button
                    type="button"
                    onclick={openCookieManager}
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 text-gray-700"
                >
                    <Cookie size={16} />
                    Manage Cookies
                </button>
            {/if}
        </div>
    </div>

    <!-- Footer -->
    <div class="border-t border-gray-200 px-6 py-4 bg-gray-50">
        <div class="flex justify-end gap-2">
            <button
                onclick={() => window.api.close()}
                class="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={isSubmitting}
            >
                Cancel
            </button>
            <button
                onclick={handleSubmit}
                class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmitting}
            >
                {isSubmitting ? 'Saving...' : (mode === 'edit' ? 'Update' : 'Create')}
            </button>
        </div>
    </div>
</div>
