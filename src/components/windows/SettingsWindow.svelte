<script>
    import { Settings, User, Bell, Lock, Palette } from "lucide-svelte";
    import BaseWindow from "../base/BaseWindow.svelte";
    import { toastStore } from "../../lib/managers/toast.svelte.js";

    let { isOpen = $bindable(false), onClose = () => {} } = $props();

    let activeTab = $state("general");
    
    const tabs = [
        { id: "general", label: "General", icon: Settings },
        { id: "account", label: "Account", icon: User },
        { id: "notifications", label: "Notifications", icon: Bell },
        { id: "privacy", label: "Privacy", icon: Lock },
        { id: "appearance", label: "Appearance", icon: Palette }
    ];

    function handleSave() {
        toastStore.success('Settings saved successfully');
        onClose();
    }
</script>

<BaseWindow
    bind:isOpen
    windowId="settings-window"
    title="Settings"
    subtitle="Manage your preferences"
    width="700px"
    height="500px"
    showCloseButton={true}
    showMinimizeButton={false}
    showMaximizeButton={true}
    onClose={onClose}
>
    {#snippet children()}
        <div class="flex gap-6 h-full">
            <!-- Sidebar -->
            <div class="w-48 shrink-0 border-r border-gray-200 pr-4">
                <nav class="space-y-1">
                    {#each tabs as tab}
                        <button
                            onclick={() => activeTab = tab.id}
                            class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors {activeTab === tab.id 
                                ? 'bg-blue-50 text-blue-600 font-medium' 
                                : 'text-gray-700 hover:bg-gray-100'}"
                        >
                            <tab.icon size={16} />
                            {tab.label}
                        </button>
                    {/each}
                </nav>
            </div>

            <!-- Content -->
            <div class="flex-1 overflow-y-auto">
                {#if activeTab === "general"}
                    <div class="space-y-4">
                        <h3 class="font-semibold text-gray-900">General Settings</h3>
                        
                        <div class="space-y-3">
                            <label class="flex items-center gap-3">
                                <input type="checkbox" class="rounded" checked />
                                <span class="text-sm text-gray-700">Launch on startup</span>
                            </label>
                            
                            <label class="flex items-center gap-3">
                                <input type="checkbox" class="rounded" />
                                <span class="text-sm text-gray-700">Minimize to tray</span>
                            </label>
                            
                            <label class="flex items-center gap-3">
                                <input type="checkbox" class="rounded" checked />
                                <span class="text-sm text-gray-700">Show desktop notifications</span>
                            </label>
                        </div>
                    </div>
                {:else if activeTab === "account"}
                    <div class="space-y-4">
                        <h3 class="font-semibold text-gray-900">Account Settings</h3>
                        <p class="text-sm text-gray-600">Manage your account information</p>
                    </div>
                {:else if activeTab === "notifications"}
                    <div class="space-y-4">
                        <h3 class="font-semibold text-gray-900">Notification Settings</h3>
                        <p class="text-sm text-gray-600">Configure how you receive notifications</p>
                    </div>
                {:else if activeTab === "privacy"}
                    <div class="space-y-4">
                        <h3 class="font-semibold text-gray-900">Privacy Settings</h3>
                        <p class="text-sm text-gray-600">Control your privacy and data</p>
                    </div>
                {:else if activeTab === "appearance"}
                    <div class="space-y-4">
                        <h3 class="font-semibold text-gray-900">Appearance Settings</h3>
                        <p class="text-sm text-gray-600">Customize the look and feel</p>
                    </div>
                {/if}
            </div>
        </div>
    {/snippet}

    {#snippet footerSlot()}
        <div class="flex justify-end gap-2">
            <button
                onclick={onClose}
                class="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
                Cancel
            </button>
            <button
                onclick={handleSave}
                class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
                Save Changes
            </button>
        </div>
    {/snippet}
</BaseWindow>
