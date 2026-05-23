<script>
    import ChildWindowControls from "../components/layout/ChildWindowControls.svelte";
    import { User, Shield, Key, Check, Eye, EyeOff, Loader2 } from "lucide-svelte";
    import { toastStore } from "../lib/managers/toast.svelte.js";
    import { updateCurrentUser, changePassword, getCurrentUser } from "../lib/api/api.js";
    import { onMount } from "svelte";
    import { initTheme } from "../lib/utils/theme.js";

    const WINDOW_ID = 'account-settings-window';

    let activeTab = $state('profile');
    let isLoading = $state(true);
    let isSaving = $state(false);

    // User data state
    let userData = $state({
        name: '',
        email: '',
        phone: '',
        telegramUsername: '',
        username: '',
        role: ''
    });

    // Password change state
    let showCurrentPassword = $state(false);
    let showNewPassword = $state(false);
    let showConfirmPassword = $state(false);
    let passwordData = $state({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    let passwordError = $state('');

    const tabs = [
        { id: 'profile', label: 'Profil', icon: User },
        { id: 'security', label: 'Keamanan', icon: Shield },
    ];

    // Helper to convert role number to label
    function getRoleLabel(role) {
        const roleLabels = {
            0: 'Super Admin',
            1: 'Admin',
            2: 'Manager',
            3: 'Staff',
            4: 'User',
            5: 'Guest',
            6: 'Customer'
        };
        return roleLabels[role] !== undefined ? roleLabels[role] : 'Admin';
    }

    // Initialize theme
    onMount(() => { initTheme(); });

    // Load user data on mount
    $effect(() => {
        loadUserData();
    });

    async function loadUserData() {
        isLoading = true;
        try {
            // Try API first
            const result = await getCurrentUser();
            if (result.success && result.data) {
                const user = result.data;
                userData = {
                    name: user.name || '',
                    email: user.email || '',
                    phone: user.phone || '',
                    telegramUsername: user.telegramUsername || '',
                    username: user.username || '',
                    role: getRoleLabel(user.role)
                };
            } else {
                // Fallback to localStorage
                const storedUser = localStorage.getItem('auth_user');
                if (storedUser) {
                    const user = JSON.parse(storedUser);
                    userData = {
                        name: user.name || '',
                        email: user.email || '',
                        phone: user.phone || '',
                        telegramUsername: user.telegramUsername || '',
                        username: user.username || '',
                        role: getRoleLabel(user.role)
                    };
                }
            }
        } catch (error) {
            console.error('Failed to load user data:', error);
            // Fallback to localStorage
            const storedUser = localStorage.getItem('auth_user');
            if (storedUser) {
                const user = JSON.parse(storedUser);
                userData = {
                    name: user.name || '',
                    email: user.email || '',
                    phone: user.phone || '',
                    telegramUsername: user.telegramUsername || '',
                    username: user.username || '',
                    role: getRoleLabel(user.role)
                };
            }
        } finally {
            isLoading = false;
        }
    }

    async function saveProfile() {
        isSaving = true;
        try {
            const result = await updateCurrentUser({
                name: userData.name,
                phone: userData.phone,
                telegramUsername: userData.telegramUsername
            });

            if (result.success) {
                toastStore.success('Profil berhasil diperbarui');
                if (result.data) {
                    userData = {
                        ...userData,
                        name: result.data.name || userData.name,
                        phone: result.data.phone || userData.phone,
                        telegramUsername: result.data.telegramUsername || userData.telegramUsername
                    };
                }
            } else {
                toastStore.error(result.error || 'Gagal memperbarui profil');
            }
        } catch (error) {
            console.error('Failed to save profile:', error);
            toastStore.error('Gagal menyimpan perubahan');
        } finally {
            isSaving = false;
        }
    }

    async function handleChangePassword() {
        passwordError = '';

        if (!passwordData.currentPassword) {
            passwordError = 'Password saat ini wajib diisi';
            return;
        }

        if (!passwordData.newPassword) {
            passwordError = 'Password baru wajib diisi';
            return;
        }

        if (passwordData.newPassword.length < 8) {
            passwordError = 'Password baru minimal 8 karakter';
            return;
        }

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            passwordError = 'Password baru tidak cocok';
            return;
        }

        isSaving = true;
        try {
            const result = await changePassword({
                currentPassword: passwordData.currentPassword,
                newPassword: passwordData.newPassword
            });

            if (result.success) {
                toastStore.success('Password berhasil diubah');
                passwordData = { currentPassword: '', newPassword: '', confirmPassword: '' };
            } else {
                passwordError = result.error || 'Gagal mengubah password';
            }
        } catch (error) {
            console.error('Failed to change password:', error);
            passwordError = 'Gagal mengubah password';
        } finally {
            isSaving = false;
        }
    }
</script>

<div class="w-full h-screen flex flex-col bg-white dark:bg-gray-900">
    <!-- Custom Title Bar -->
    <div class="h-10 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4" style="-webkit-app-region: drag">
        <div class="flex items-center gap-2">
            <User size={16} class="text-blue-600 dark:text-blue-400" />
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Account Settings</span>
        </div>
        <div style="-webkit-app-region: no-drag">
            <ChildWindowControls variant="dark" windowId={WINDOW_ID} />
        </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-hidden flex flex-col">
        {#if isLoading}
            <div class="flex-1 flex items-center justify-center">
                <Loader2 size={32} class="text-gray-400 dark:text-gray-500 animate-spin" />
            </div>
        {:else}
            <div class="flex gap-6 h-full flex-1 overflow-hidden p-6">
                <!-- Sidebar -->
                <div class="w-52 shrink-0 border-r border-gray-200 dark:border-gray-700 pr-4">
                    <nav class="space-y-1">
                        {#each tabs as tab}
                            {@const Icon = tab.icon}
                            <button
                                onclick={() => activeTab = tab.id}
                                class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors {activeTab === tab.id ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}"
                            >
                                <Icon size={18} />
                                {tab.label}
                            </button>
                        {/each}
                    </nav>
                </div>

                <!-- Content -->
                <div class="flex-1 overflow-y-auto pr-4">
                    {#if activeTab === 'profile'}
                        <div class="space-y-6">
                            <div>
                                <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                                    Profil
                                </h3>
                                <p class="text-sm text-gray-500 dark:text-gray-400">
                                    Kelola informasi profil Anda
                                </p>
                            </div>

                            <!-- Role (Read-only) -->
                            <div>
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                                <div class="px-4 py-2 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-600 dark:text-blue-400 font-medium">
                                    {userData.role}
                                </div>
                            </div>

                            <div class="space-y-4">
                                <!-- Name -->
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama</label>
                                    <input
                                        type="text"
                                        bind:value={userData.name}
                                        class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
                                        placeholder="Masukkan nama"
                                    />
                                </div>

                                <!-- Username (Read-only) -->
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
                                    <input
                                        type="text"
                                        value={userData.username}
                                        disabled
                                        class="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                                    />
                                    <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">Username tidak dapat diubah</p>
                                </div>

                                <!-- Email (Read-only) -->
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                                    <input
                                        type="email"
                                        value={userData.email}
                                        disabled
                                        class="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                                    />
                                    <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">Hubungi admin untuk mengubah email</p>
                                </div>

                                <!-- Phone -->
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nomor Telepon</label>
                                    <input
                                        type="tel"
                                        bind:value={userData.phone}
                                        class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
                                        placeholder="Masukkan nomor telepon"
                                    />
                                </div>

                                <!-- Telegram Username -->
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username Telegram</label>
                                    <div class="relative">
                                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">@</span>
                                        <input
                                            type="text"
                                            bind:value={userData.telegramUsername}
                                            class="w-full pl-8 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
                                            placeholder="username"
                                        />
                                    </div>
                                </div>
                            </div>

                            <!-- Save Button -->
                            <div class="pt-4">
                                <button
                                    onclick={saveProfile}
                                    disabled={isSaving}
                                    class="flex items-center gap-2 px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {#if isSaving}
                                        <Loader2 size={16} class="animate-spin" />
                                        <span>Menyimpan...</span>
                                    {:else}
                                        <Check size={16} />
                                        <span>Simpan</span>
                                    {/if}
                                </button>
                            </div>
                        </div>
                    {:else if activeTab === 'security'}
                        <div class="space-y-6">
                            <div>
                                <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                                    Keamanan
                                </h3>
                                <p class="text-sm text-gray-500 dark:text-gray-400">
                                    Ubah password akun Anda
                                </p>
                            </div>

                            {#if passwordError}
                                <div class="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                                    {passwordError}
                                </div>
                            {/if}

                            <div class="space-y-4">
                                <!-- Current Password -->
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Password Saat Ini</label>
                                    <div class="relative">
                                        <input
                                            type={showCurrentPassword ? 'text' : 'password'}
                                            bind:value={passwordData.currentPassword}
                                            class="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                                            placeholder="Masukkan password saat ini"
                                        />
                                        <button
                                            type="button"
                                            onclick={() => showCurrentPassword = !showCurrentPassword}
                                            class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            {#if showCurrentPassword}
                                                <EyeOff size={16} />
                                            {:else}
                                                <Eye size={16} />
                                            {/if}
                                        </button>
                                    </div>
                                </div>

                                <!-- New Password -->
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Password Baru</label>
                                    <div class="relative">
                                        <input
                                            type={showNewPassword ? 'text' : 'password'}
                                            bind:value={passwordData.newPassword}
                                            class="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                                            placeholder="Minimal 8 karakter"
                                        />
                                        <button
                                            type="button"
                                            onclick={() => showNewPassword = !showNewPassword}
                                            class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            {#if showNewPassword}
                                                <EyeOff size={16} />
                                            {:else}
                                                <Eye size={16} />
                                            {/if}
                                        </button>
                                    </div>
                                </div>

                                <!-- Confirm Password -->
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Konfirmasi Password Baru</label>
                                    <div class="relative">
                                        <input
                                            type={showConfirmPassword ? 'text' : 'password'}
                                            bind:value={passwordData.confirmPassword}
                                            class="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                                            placeholder="Ulangi password baru"
                                        />
                                        <button
                                            type="button"
                                            onclick={() => showConfirmPassword = !showConfirmPassword}
                                            class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            {#if showConfirmPassword}
                                                <EyeOff size={16} />
                                            {:else}
                                                <Eye size={16} />
                                            {/if}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <!-- Change Password Button -->
                            <div class="pt-4">
                                <button
                                    onclick={handleChangePassword}
                                    disabled={isSaving}
                                    class="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {#if isSaving}
                                        <Loader2 size={16} class="animate-spin" />
                                        <span>Mengubah...</span>
                                    {:else}
                                        <Key size={16} />
                                        <span>Ubah Password</span>
                                    {/if}
                                </button>
                            </div>
                        </div>
                    {/if}
                </div>
            </div>
        {/if}
    </div>
</div>