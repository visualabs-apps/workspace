<script>
    import { clickOutside } from "../lib/clickOutside.svelte.js";
    import { Plus, ChevronDown, X } from "lucide-svelte";
    import { createChromeProfile, updateChromeProfile } from "../lib/api.js";
    import { toastStore } from "../lib/toast.svelte.js";

    // Props
    let {
        isOpen = $bindable(false),
        mode = 'add', // 'add' or 'edit'
        editingProfile = null,
        clients = [],
        isLoadingClients = false,
        onSuccess = () => {},
        onSelectClient = () => {},
        onColorChange = () => {}
    } = $props();

    // Form state
    let profileName = $state("");
    let selectedClient = $state(null);
    let userAgent = $state("");
    let cookiesText = $state("");
    let profileColor = $state("#9d8c6b");
    let showClientDropdown = $state(false);
    let showColorPicker = $state(false);
    let nameError = $state(false);
    let isSubmitting = $state(false);

    // Color picker state
    let colorRgb = $state({ r: 157, g: 140, b: 107 });
    let colorPickerButton = $state(null);
    let pickerPosition = $state('bottom');

    const presetColors = [
        '#6B21A8', '#4F46E5', '#2563EB', '#0EA5E9', '#06B6D4', '#14B8A6', '#10B981', '#EAB308',
        '#F97316', '#EF4444', '#EC4899', '#A855F7', '#8B5CF6', '#60A5FA', '#38BDF8', '#22D3EE',
        '#5EEAD4', '#FDE047', '#FCD34D', '#FCA5A5'
    ];

    // Watch for editingProfile changes
    $effect(() => {
        if (isOpen && mode === 'edit' && editingProfile) {
            profileName = editingProfile.name;
            profileColor = editingProfile.color?.hex || editingProfile.color?.value || editingProfile.color || '#9d8c6b';
            userAgent = editingProfile.userAgent || "";
            cookiesText = editingProfile.cookies ? JSON.stringify(editingProfile.cookies, null, 2) : "";
            selectedClient = clients.find(c => c.id === editingProfile.customerId) || null;
        } else if (isOpen && mode === 'add') {
            resetForm();
        }
    });

    function resetForm() {
        profileName = "";
        selectedClient = null;
        userAgent = "";
        cookiesText = "";
        profileColor = getRandomColor();
        showClientDropdown = false;
        showColorPicker = false;
        nameError = false;
    }

    function getRandomColor() {
        const colors = [
            "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e", "#10b981", "#14b8a6",
            "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899", "#f43f5e"
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    function selectClient(client) {
        selectedClient = client;
        showClientDropdown = false;
        onSelectClient(client);
        if (!profileName && client) {
            profileName = client.name;
        }
    }

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

    function updateColorFromRgb() {
        profileColor = rgbToHex(colorRgb.r, colorRgb.g, colorRgb.b);
        onColorChange(profileColor);
    }

    $effect(() => {
        if (profileColor) {
            onColorChange(profileColor);
        }
    });

    function detectPickerPosition(buttonElement) {
        if (!buttonElement) return 'bottom';
        const rect = buttonElement.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        return (viewportHeight - rect.bottom < 300) ? 'top' : 'bottom';
    }

    $effect(() => {
        if (showColorPicker && colorPickerButton) {
            pickerPosition = detectPickerPosition(colorPickerButton);
        }
    });

    $effect(() => {
        if (profileColor && /^#[0-9A-F]{6}$/i.test(profileColor)) {
            const rgb = hexToRgb(profileColor);
            colorRgb = rgb;
        }
    });

    async function handleSubmit() {
        if (!profileName || !profileName.trim()) {
            nameError = true;
            setTimeout(() => {
                nameError = false;
            }, 3000);
            return;
        }

        nameError = false;
        isSubmitting = true;

        try {
            // Check if only color changed (for edit mode)
            if (mode === 'edit' && editingProfile) {
                const nameChanged = profileName.trim() !== editingProfile.name;
                const clientChanged = selectedClient?.id !== editingProfile.customerId;
                const userAgentChanged = (userAgent.trim() || '') !== (editingProfile.userAgent || '');
                const cookiesChanged = cookiesText.trim() !== (editingProfile.cookies ? JSON.stringify(editingProfile.cookies, null, 2) : '');
                
                // If only color changed, just save to SQLite and refresh
                if (!nameChanged && !clientChanged && !userAgentChanged && !cookiesChanged) {
                    if (profileColor && editingProfile.id) {
                        try {
                            await window.api.db.saveProfileColor(editingProfile.id, profileColor);
                        } catch (error) {
                            console.error('Failed to save profile color:', error);
                        }
                    }
                    
                    isOpen = false;
                    resetForm();
                    onSuccess(editingProfile, profileColor);
                    isSubmitting = false;
                    return;
                }
            }

            // Parse cookies if provided
            let parsedCookies = null;
            if (cookiesText && cookiesText.trim()) {
                try {
                    parsedCookies = JSON.parse(cookiesText.trim());
                    if (!Array.isArray(parsedCookies)) {
                        throw new Error('Cookies must be an array');
                    }
                } catch (error) {
                    console.error('Invalid cookies JSON:', error);
                    alert('Invalid cookies format. Please provide a valid JSON array.');
                    isSubmitting = false;
                    return;
                }
            }

            // Prepare payload
            const payload = {
                name: profileName.trim(),
                customerId: selectedClient?.id || undefined,
                userAgent: userAgent.trim() || undefined,
                cookies: parsedCookies
            };

            let response;
            if (mode === 'edit' && editingProfile) {
                response = await updateChromeProfile(editingProfile.id, payload);
            } else {
                payload.proxy = undefined;
                payload.status = 0;
                response = await createChromeProfile(payload);
            }

            if (!response.success) {
                console.error(`Failed to ${mode} profile:`, response.error);
                toastStore.error(`Failed to ${mode} profile: ${response.error}`);
                isSubmitting = false;
                return;
            }

            // Close modal and call success callback with color
            isOpen = false;
            resetForm();
            onSuccess(response.data, profileColor);
            toastStore.success(mode === 'edit' ? 'Profile updated' : 'Profile created');
        } catch (error) {
            console.error(`❌ Failed to ${mode} profile:`, error);
            toastStore.error(`Failed to ${mode} profile. Please try again.`);
        } finally {
            isSubmitting = false;
        }
    }

    function handleClose() {
        isOpen = false;
        showClientDropdown = false;
        showColorPicker = false;
    }
</script>

{#if isOpen}
    <div
        use:clickOutside={{ 
            onClickOutside: handleClose,
            includeEscape: true
        }}
        class="popup-container fixed left-20 top-12 w-[600px] bg-white backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200 p-6 z-50 text-gray-900 max-h-[calc(100vh-100px)] overflow-y-auto"
        onclick={(e) => {
            e.stopPropagation();
        }}
    >
        <div class="flex items-center justify-between mb-1">
            <div class="flex items-center gap-2">
                <Plus size={18} class="text-gray-900 {mode === 'edit' ? 'rotate-45' : ''}" />
                <h3 class="font-bold text-lg">{mode === 'edit' ? 'Edit' : 'Tambah'} Profil</h3>
            </div>
            <button
                type="button"
                onclick={handleClose}
                class="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                title="Tutup"
            >
                <X size={18} class="text-gray-600" />
            </button>
        </div>
        <p class="text-xs text-gray-400 mb-4">
            {mode === 'edit' ? 'Perbarui pengaturan profil' : 'Buat profil baru untuk klien'}
        </p>

        <!-- 2 Column Layout -->
        <div class="grid grid-cols-2 gap-4">
            <!-- Left Column -->
            <div class="space-y-4">
                <!-- Client Dropdown -->
                <div>
                    <label class="text-xs font-medium text-gray-600 mb-2 block">Pilih Klien</label>
                    <div class="relative">
                        <button
                            type="button"
                            onclick={(e) => {
                                e.stopPropagation();
                                showClientDropdown = !showClientDropdown;
                            }}
                            class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-left flex items-center justify-between hover:border-gray-400 transition-colors focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        >
                            <span class="text-gray-900 text-sm truncate">
                                {#if isLoadingClients}
                                    Memuat...
                                {:else if selectedClient}
                                    {selectedClient.name}
                                {:else}
                                    Pilih klien
                                {/if}
                            </span>
                            <ChevronDown size={16} class="text-gray-500 {showClientDropdown ? 'rotate-180' : ''} transition-transform flex-shrink-0" />
                        </button>
                        
                        {#if showClientDropdown}
                            <!-- svelte-ignore a11y_click_events_have_key_events -->
                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                            <div 
                                class="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto z-50"
                                onclick={(e) => e.stopPropagation()}
                            >
                                {#if clients.length === 0}
                                    <div class="px-4 py-3 text-sm text-gray-500 text-center">
                                        {isLoadingClients ? 'Memuat...' : 'Tidak ada klien'}
                                    </div>
                                {:else}
                                    {#each clients as client}
                                        <button
                                            type="button"
                                            onclick={() => selectClient(client)}
                                            class="w-full px-4 py-2.5 text-left hover:bg-gray-50 transition-colors flex flex-col gap-0.5 border-b border-gray-100 last:border-b-0"
                                        >
                                            <span class="text-sm font-medium text-gray-900">{client.name}</span>
                                            {#if client.brand || client.platform}
                                                <span class="text-xs text-gray-500">
                                                    {client.brand || ''}{client.brand && client.platform ? ' • ' : ''}{client.platform || ''}
                                                </span>
                                            {/if}
                                        </button>
                                    {/each}
                                {/if}
                            </div>
                        {/if}
                    </div>
                </div>

                <!-- Profile Name -->
                <div>
                    <label class="text-xs font-medium text-gray-600 mb-2 block">Nama Profil</label>
                    <input
                        type="text"
                        bind:value={profileName}
                        placeholder="Nama profil"
                        class="w-full px-4 py-3 bg-gray-50 border rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none transition-colors {nameError ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500 animate-shake' : 'border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'}"
                        onkeydown={(e) => {
                            e.stopPropagation();
                            if (e.key === "Enter") handleSubmit();
                        }}
                        oninput={() => {
                            if (nameError) nameError = false;
                        }}
                    />
                    {#if nameError}
                        <p class="text-red-400 text-xs mt-1 ml-1">Nama profil wajib diisi</p>
                    {/if}
                </div>

                <!-- User Agent -->
                <div>
                    <label class="text-xs font-medium text-gray-600 mb-2 block">User Agent (Opsional)</label>
                    <input
                        type="text"
                        bind:value={userAgent}
                        placeholder="Mozilla/5.0..."
                        class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-sm"
                    />
                </div>
            </div>

            <!-- Right Column -->
            <div class="space-y-4">
                <!-- Cookies -->
                <div>
                    <label class="text-xs font-medium text-gray-600 mb-2 block">Cookies (Optional)</label>
                    <textarea
                        bind:value={cookiesText}
                        placeholder={'[{"name":"session","value":"abc123","domain":".example.com"}]'}
                        rows="8"
                        class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-xs font-mono resize-none"
                    ></textarea>
                    <p class="text-xs text-gray-500 mt-1">JSON array format</p>
                </div>

                <!-- Color Picker -->
                <div>
                    <span class="text-xs font-medium text-gray-600 mb-2 block">Profile Color</span>
                    <div class="relative">
                        <button
                            type="button"
                            bind:this={colorPickerButton}
                            onclick={(e) => {
                                e.stopPropagation();
                                showColorPicker = !showColorPicker;
                            }}
                            class="popup-trigger-button w-full h-12 rounded-xl border-2 border-gray-200 hover:border-gray-300 transition-colors flex items-center gap-3 px-3"
                            style="background-color: {profileColor}"
                        >
                            <div class="w-8 h-8 rounded-lg border-2 border-white/30" style="background-color: {profileColor}"></div>
                            <span class="text-sm font-mono text-white drop-shadow">{profileColor.toUpperCase()}</span>
                        </button>

                        {#if showColorPicker}
                            <!-- svelte-ignore a11y_click_events_have_key_events -->
                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                            <div 
                                class="popup-container absolute left-0 z-[60] bg-white rounded-xl p-3 shadow-2xl border border-gray-200 w-[280px] {pickerPosition === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'}"
                                onclick={(e) => e.stopPropagation()}
                            >
                                <!-- Color Preview -->
                                <div class="mb-3">
                                    <div 
                                        class="w-full h-32 rounded-lg border-2 border-gray-200"
                                        style="background-color: {profileColor}"
                                    ></div>
                                </div>

                                <!-- Color Values -->
                                <div class="grid grid-cols-4 gap-1.5 mb-3">
                                    <div>
                                        <label class="text-[10px] text-gray-600 mb-0.5 block text-center font-medium">Hex
                                        <input
                                            type="text"
                                            bind:value={profileColor}
                                            class="w-full px-1.5 py-1.5 bg-gray-50 border border-gray-200 rounded text-center text-xs font-mono text-gray-900 focus:outline-none focus:border-blue-500"
                                            maxlength="7"
                                        /></label>
                                    </div>
                                    <div>
                                        <label class="text-[10px] text-gray-600 mb-0.5 block text-center font-medium">R
                                        <input
                                            type="number"
                                            bind:value={colorRgb.r}
                                            oninput={updateColorFromRgb}
                                            min="0"
                                            max="255"
                                            class="w-full px-1.5 py-1.5 bg-gray-50 border border-gray-200 rounded text-center text-xs text-gray-900 focus:outline-none focus:border-blue-500"
                                        /></label>
                                    </div>
                                    <div>
                                        <label class="text-[10px] text-gray-600 mb-0.5 block text-center font-medium">G
                                        <input
                                            type="number"
                                            bind:value={colorRgb.g}
                                            oninput={updateColorFromRgb}
                                            min="0"
                                            max="255"
                                            class="w-full px-1.5 py-1.5 bg-gray-50 border border-gray-200 rounded text-center text-xs text-gray-900 focus:outline-none focus:border-blue-500"
                                        /></label>
                                    </div>
                                    <div>
                                        <label class="text-[10px] text-gray-600 mb-0.5 block text-center font-medium">B
                                        <input
                                            type="number"
                                            bind:value={colorRgb.b}
                                            oninput={updateColorFromRgb}
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
                                                profileColor = color;
                                                colorRgb = hexToRgb(color);
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
            </div>
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-3 mt-6 pt-4 border-t border-gray-200">
            <button
                class="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-medium py-2.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onclick={handleSubmit}
                disabled={isSubmitting}
            >
                {isSubmitting ? (mode === 'edit' ? 'Updating...' : 'Creating...') : (mode === 'edit' ? 'Update Profile' : 'Create Profile')}
            </button>
            <button
                class="px-4 py-2.5 text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50"
                onclick={handleClose}
                disabled={isSubmitting}
            >
                Cancel
            </button>
        </div>
    </div>
{/if}

<style>
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
    }
    
    .animate-shake {
        animation: shake 0.5s ease-in-out;
    }
    
    /* Client dropdown scrollbar */
    .max-h-60 {
        scrollbar-width: thin;
        scrollbar-color: rgba(156, 163, 175, 0.5) transparent;
    }
    
    .max-h-60::-webkit-scrollbar {
        width: 6px;
    }
    
    .max-h-60::-webkit-scrollbar-track {
        background: transparent;
    }
    
    .max-h-60::-webkit-scrollbar-thumb {
        background: rgba(156, 163, 175, 0.5);
        border-radius: 3px;
    }
    
    .max-h-60::-webkit-scrollbar-thumb:hover {
        background: rgba(156, 163, 175, 0.7);
    }
</style>
