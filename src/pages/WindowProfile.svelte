<script>
    import ChildWindowControls from "../components/layout/ChildWindowControls.svelte";
    import { User, ChevronDown, Cookie } from "lucide-svelte";
    import { createChromeProfile, updateChromeProfile } from "../lib/api/api.js";
    import { toastStore } from "../lib/managers/toast.svelte.js";
    import { openPredefinedWindow } from "../lib/utils/childWindow.js";
    import { onMount } from "svelte";
    import { initTheme } from "../lib/utils/theme.js";

    const WINDOW_ID = 'profile-window';

    // Initialize theme
    onMount(() => { initTheme(); });

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
    let showClientDropdown = $state(false);
    let nameError = $state(false);
    let isSubmitting = $state(false);

    $effect(() => {
        if (mode === 'edit' && editingProfile) {
            profileName = editingProfile.name;
            userAgent = editingProfile.userAgent || "";
            selectedClient = clients.find(c => c.id === editingProfile.customerId) || null;
        }
    });

    function resetForm() {
        profileName = "";
        selectedClient = null;
        userAgent = "";
        showClientDropdown = false;
        nameError = false;
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
                        profile: result.data
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

<div class="w-full h-screen flex flex-col bg-white dark:bg-gray-900">
    <!-- Custom Title Bar -->
    <div class="h-10 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4" style="-webkit-app-region: drag">
        <div class="flex items-center gap-2">
            <User size={16} class="text-gray-600 dark:text-gray-400" />
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Profile</span>
        </div>
        <div style="-webkit-app-region: no-drag">
            <ChildWindowControls variant="dark" windowId={WINDOW_ID} />
        </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-6">
        <div class="space-y-4">
            <!-- Profile Name -->
            <div>
                <label class="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Profile Name <span class="text-gray-500 dark:text-gray-400">*</span>
                </label>
                <input
                    type="text"
                    bind:value={profileName}
                    placeholder="Enter profile name"
                    class="w-full px-4 py-2 border {nameError ? 'border-gray-400 dark:border-gray-500' : 'border-gray-300 dark:border-gray-600'} rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500"
                />
                {#if nameError}
                    <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">Profile name is required</p>
                {/if}
            </div>

            <!-- Client Selection -->
            <div>
                <label class="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Client (Optional)
                </label>
                <div class="relative">
                    <button
                        type="button"
                        onclick={() => showClientDropdown = !showClientDropdown}
                        class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-left flex items-center justify-between hover:border-gray-400 dark:hover:border-gray-500 transition-colors bg-white dark:bg-gray-800"
                    >
                        <span class="text-gray-700 dark:text-gray-300">
                            {selectedClient ? selectedClient.name : 'Select a client'}
                        </span>
                        <ChevronDown size={16} class="text-gray-400 dark:text-gray-500" />
                    </button>

                    {#if showClientDropdown}
                        <div class="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                            <button
                                type="button"
                                onclick={() => selectClient(null)}
                                class="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
                            >
                                No client
                            </button>
                            {#each clients as client}
                                <button
                                    type="button"
                                    onclick={() => selectClient(client)}
                                    class="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 {selectedClient?.id === client.id ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200' : 'text-gray-700 dark:text-gray-300'}"
                                >
                                    {client.name}
                                </button>
                            {/each}
                        </div>
                    {/if}
                </div>
            </div>

            <!-- User Agent (Optional) -->
            <div>
                <label class="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    User Agent (Optional)
                </label>
                <input
                    type="text"
                    bind:value={userAgent}
                    placeholder="Leave empty for default"
                    class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500"
                />
            </div>

            <!-- Cookie Manager Button (Edit mode only) -->
            {#if mode === 'edit' && editingProfile}
                <button
                    type="button"
                    onclick={openCookieManager}
                    class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 text-gray-700 dark:text-gray-300"
                >
                    <Cookie size={16} />
                    Manage Cookies
                </button>
            {/if}
        </div>
    </div>

    <!-- Footer -->
    <div class="border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800">
        <div class="flex justify-end gap-2">
            <button
                onclick={() => window.api.close()}
                class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                disabled={isSubmitting}
            >
                Cancel
            </button>
            <button
                onclick={handleSubmit}
                class="px-4 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmitting}
            >
                {isSubmitting ? 'Saving...' : (mode === 'edit' ? 'Update' : 'Create')}
            </button>
        </div>
    </div>
</div>
