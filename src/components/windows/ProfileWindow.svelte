<script>
    import BaseWindow from "../base/BaseWindow.svelte";
    import { ChevronDown, Cookie } from "lucide-svelte";
    import { createChromeProfile, updateChromeProfile } from "../../lib/api/api.js";
    import { toastStore } from "../../lib/managers/toast.svelte.js";
    import CookieManagerWindow from "./CookieManagerWindow.svelte";

    let {
        isOpen = $bindable(false),
        mode = 'add',
        editingProfile = null,
        clients = [],
        isLoadingClients = false,
        onSuccess = () => {},
        onSelectClient = () => {},
        onColorChange = () => {}
    } = $props();

    let profileName = $state("");
    let selectedClient = $state(null);
    let userAgent = $state("");
    let profileColor = $state("#9d8c6b");
    let showClientDropdown = $state(false);
    let nameError = $state(false);
    let isSubmitting = $state(false);
    
    let showCookieManager = $state(false);
    let currentPartition = $state(null);

    const presetColors = [
        '#6B21A8', '#4F46E5', '#2563EB', '#0EA5E9', '#06B6D4', '#14B8A6', '#10B981', '#EAB308',
        '#F97316', '#EF4444', '#EC4899', '#A855F7', '#8B5CF6', '#60A5FA', '#38BDF8', '#22D3EE',
        '#5EEAD4', '#FDE047', '#FCD34D', '#FCA5A5'
    ];

    $effect(() => {
        if (isOpen && mode === 'edit' && editingProfile) {
            profileName = editingProfile.name;
            profileColor = editingProfile.color?.hex || editingProfile.color?.value || editingProfile.color || '#9d8c6b';
            userAgent = editingProfile.userAgent || "";
            selectedClient = clients.find(c => c.id === editingProfile.customerId) || null;
        } else if (isOpen && mode === 'add') {
            resetForm();
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
        onSelectClient(client);
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
                    customerId: selectedClient?.id || null,
                    userAgent: userAgent.trim() || null
                });
            }

            if (result.success) {
                toastStore.success(mode === 'edit' ? 'Profile updated!' : 'Profile created!');
                onColorChange(profileColor);
                onSuccess(result.profile);
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
        isOpen = false;
        resetForm();
    }

    function openCookieManager() {
        if (editingProfile) {
            currentPartition = `persist:workspace-${editingProfile.id}`;
            showCookieManager = true;
        }
    }
</script>

<BaseWindow
    bind:isOpen
    windowId="profile-window"
    title={mode === 'edit' ? 'Edit Profile' : 'Add Profile'}
    subtitle={mode === 'edit' ? 'Update profile settings' : 'Create a new profile'}
    width="600px"
    height="auto"
    showCloseButton={true}
    showMaximizeButton={true}
    onClose={handleClose}
>
    {#snippet children()}
        <div class="space-y-4">
            <!-- Profile Name -->
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">
                    Profile Name <span class="text-red-500">*</span>
                </label>
                <input
                    type="text"
                    bind:value={profileName}
                    placeholder="Enter profile name"
                    class="w-full px-4 py-2 border {nameError ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {#if nameError}
                    <p class="text-xs text-red-500 mt-1">Profile name is required</p>
                {/if}
            </div>

            <!-- Client Selection -->
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">
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
                <label class="block text-sm font-medium text-gray-700 mb-2">
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
                <label class="block text-sm font-medium text-gray-700 mb-2">
                    User Agent (Optional)
                </label>
                <input
                    type="text"
                    bind:value={userAgent}
                    placeholder="Leave empty for default"
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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
    {/snippet}

    {#snippet footerSlot()}
        <div class="flex justify-end gap-2">
            <button
                onclick={handleClose}
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
    {/snippet}
</BaseWindow>

<!-- Cookie Manager Window -->
{#if showCookieManager}
    <CookieManagerWindow 
        bind:isOpen={showCookieManager} 
        partition={currentPartition} 
    />
{/if}
