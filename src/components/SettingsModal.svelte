<script>
    import { authStore } from "../lib/auth.svelte.js";
    import { updateProfile } from "../lib/nativeApi.js";
    import { X, User, Mail, Save, Loader2 } from "lucide-svelte";

    let { onClose } = $props();

    // User state
    let user = $derived(authStore.user);

    // Form state
    let name = $state("");
    $effect(() => {
        name = user?.name || "";
    });
    let isSaving = $state(false);
    let error = $state("");
    let success = $state("");

    async function handleSave() {
        if (!name.trim()) {
            error = "Name is required";
            return;
        }

        isSaving = true;
        error = "";
        success = "";

        try {
            const result = await updateProfile({ name: name.trim() });
            if (result.success) {
                // Update the auth store with new user data
                authStore.updateUser(result.user);
                success = "Profile updated successfully";
                setTimeout(() => {
                    success = "";
                }, 2000);
            } else {
                error = result.error || "Failed to update profile";
            }
        } catch (err) {
            error = "Network error. Please try again.";
        } finally {
            isSaving = false;
        }
    }

    function handleBackdropClick(e) {
        if (e.target === e.currentTarget) {
            onClose();
        }
    }
</script>

<!-- Backdrop -->
<div 
    class="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" 
    onclick={handleBackdropClick}
    onkeydown={(e) => e.key === 'Escape' && onClose()}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
>
    <!-- Modal Content -->
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden border border-gray-200">
        <!-- Header -->
        <div class="p-6 border-b border-gray-100 flex items-center justify-between">
            <h2 class="text-xl font-bold text-gray-800">Settings</h2>
            <button 
                onclick={onClose} 
                class="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
            >
                <X size={20} />
            </button>
        </div>

        <!-- Content -->
        <div class="p-6 space-y-6">
            <!-- Profile Section -->
            <div>
                <h3 class="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">Profile</h3>
                
                <!-- Avatar -->
                <div class="flex items-center gap-4 mb-6">
                    <div class="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg">
                        <User size={32} />
                    </div>
                    <div>
                        <p class="text-gray-800 font-medium">{user?.name || 'User'}</p>
                        <p class="text-gray-500 text-sm">{user?.email || ''}</p>
                    </div>
                </div>

                <!-- Name Input -->
                <div class="space-y-2">
                    <label for="name" class="block text-sm font-medium text-gray-700">
                        Display Name
                    </label>
                    <div class="relative">
                        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                            <User class="w-5 h-5" />
                        </div>
                        <input
                            type="text"
                            id="name"
                            bind:value={name}
                            placeholder="Your name"
                            disabled={isSaving}
                            class="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 placeholder-gray-400 
                                   focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white
                                   disabled:opacity-50 disabled:cursor-not-allowed
                                   transition-all"
                        />
                    </div>
                </div>

                <!-- Email (Read-only) -->
                <div class="space-y-2 mt-4">
                    <label for="email" class="block text-sm font-medium text-gray-700">
                        Email Address
                    </label>
                    <div class="relative">
                        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                            <Mail class="w-5 h-5" />
                        </div>
                        <input
                            type="email"
                            id="email"
                            value={user?.email || ''}
                            disabled
                            class="w-full pl-10 pr-4 py-3 bg-gray-100 border border-gray-200 rounded-lg text-gray-500 
                                   cursor-not-allowed"
                        />
                    </div>
                    <p class="text-xs text-gray-400">Email cannot be changed</p>
                </div>
            </div>

            <!-- Error/Success Messages -->
            {#if error}
                <div class="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                    {error}
                </div>
            {/if}

            {#if success}
                <div class="p-3 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm">
                    {success}
                </div>
            {/if}
        </div>

        <!-- Footer -->
        <div class="p-6 border-t border-gray-100 flex justify-end gap-3">
            <button 
                onclick={onClose}
                class="px-4 py-2 text-gray-500 hover:text-gray-700 transition-colors"
            >
                Cancel
            </button>
            <button 
                onclick={handleSave}
                disabled={isSaving || !name.trim()}
                class="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 
                       disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed
                       text-white rounded-lg transition-all shadow-md"
            >
                {#if isSaving}
                    <Loader2 class="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                {:else}
                    <Save class="w-4 h-4" />
                    <span>Save Changes</span>
                {/if}
            </button>
        </div>
    </div>
</div>
