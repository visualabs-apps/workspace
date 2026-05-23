<script>
    /**
     * Password Manager Window - Chrome-like Password Manager UI
     *
     * Features:
     *   - Search / filter passwords
     *   - Add / Edit / Delete passwords
     *   - Password generator with strength indicator
     *   - Copy username / password to clipboard
     *   - Password strength badges
     *   - Statistics
     */
    import ChildWindowControls from "../components/layout/ChildWindowControls.svelte";
    import {
        Key, Plus, Trash2, Search, Eye, EyeOff, Copy, Check,
        Shield, RefreshCw, X, Pencil, AlertTriangle, Zap, Settings
    } from "lucide-svelte";
    import { toastStore } from "../lib/managers/toast.svelte.js";
    import { workspaceStore } from "../lib/stores/workspaces.svelte.js";
    import { onMount } from "svelte";
    import { initTheme } from "../lib/utils/theme.js";

    const WINDOW_ID = 'password-manager-window';

    let profileId = $state(null);
    let passwords = $state([]);
    let filteredPasswords = $state([]);
    let isLoading = $state(false);
    let searchQuery = $state("");
    let showModal = $state(false);
    let editingPassword = $state(null);
    let loadError = $state('');
    let stats = $state(null);

    // Modal form state
    let formTitle = $state("");
    let formUrl = $state("");
    let formUsername = $state("");
    let formPassword = $state("");
    let formNotes = $state("");
    let formFavicon = $state("");
    let isSaving = $state(false);
    let showPassword = $state(false);
    let copiedField = $state(null);

    // Password generator state
    let generatorLength = $state(16);
    let generatorUpper = $state(true);
    let generatorNumbers = $state(true);
    let generatorSymbols = $state(true);
    let generatorLower = $state(true);

    // Password strength
    let passwordStrength = $state(null);

    let activeWorkspace = $derived(workspaceStore.activeWorkspace);

    // Watch for password changes to update strength
    $effect(() => {
        if (formPassword) {
            checkPasswordStrength(formPassword);
        } else {
            passwordStrength = null;
        }
    });

    // Load passwords when profileId is set
    $effect(() => {
        if (profileId) {
            loadPasswords();
            loadStats();
        }
    });

    // Filter passwords when search or list changes
    $effect(() => {
        filterPasswords();
    });

    // Receive data from parent window via IPC
    onMount(() => {
        const handleWindowData = (data) => {
            if (data.profileId) profileId = data.profileId;
        };
        if (window.api?.onWindowData) {
            window.api.onWindowData(handleWindowData);
        }
        
        const cleanupTheme = initTheme();
        return () => { cleanupTheme?.then(fn => fn?.()); };
    });

    // ── Data Loading ───────────────────────────────────

    async function loadPasswords() {
        if (!profileId) return;
        isLoading = true;
        loadError = '';
        try {
            const result = await window.api.passwordManager.getAll(profileId);
            if (result.success) {
                passwords = result.passwords || [];
                filterPasswords();
            } else {
                loadError = result.error || 'Failed to load passwords';
            }
        } catch (e) {
            loadError = e.message;
        } finally {
            isLoading = false;
        }
    }

    async function loadStats() {
        if (!profileId) return;
        try {
            const result = await window.api.passwordManager.getStats(profileId);
            if (result.success) {
                stats = result.stats;
            }
        } catch { /* ignore */ }
    }

    function filterPasswords() {
        const q = searchQuery.toLowerCase().trim();
        if (!q) {
            filteredPasswords = passwords;
        } else {
            filteredPasswords = passwords.filter(p =>
                p.title?.toLowerCase().includes(q) ||
                p.url?.toLowerCase().includes(q) ||
                p.origin?.toLowerCase().includes(q) ||
                p.username?.toLowerCase().includes(q)
            );
        }
    }

    // ── Modal ──────────────────────────────────────────

    function openAddModal() {
        editingPassword = null;
        formTitle = '';
        formUrl = '';
        formUsername = '';
        formPassword = '';
        formNotes = '';
        formFavicon = '';
        showPassword = false;
        passwordStrength = null;
        showModal = true;
    }

    async function openEditModal(p) {
        editingPassword = p;
        formTitle = p.title || '';
        formUrl = p.url || p.origin || '';
        formUsername = p.username || '';
        formPassword = '';
        formNotes = p.notes || '';
        formFavicon = p.favicon || '';
        showPassword = false;
        passwordStrength = null;
        showModal = true;
    }

    function closeModal() {
        showModal = false;
        editingPassword = null;
        showPassword = false;
        passwordStrength = null;
    }

    // ── Password Generator ─────────────────────────────

    async function generatePassword() {
        try {
            const result = await window.api.passwordManager.generate({
                length: generatorLength,
                uppercase: generatorUpper,
                numbers: generatorNumbers,
                symbols: generatorSymbols,
                lowercase: generatorLower
            });
            if (result.success) {
                formPassword = result.password;
                passwordStrength = result.strength;
                showPassword = true;
            }
        } catch (e) {
            // Fallback: generate locally
            let chars = 'abcdefghijklmnopqrstuvwxyz';
            if (generatorUpper) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            if (generatorNumbers) chars += '0123456789';
            if (generatorSymbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';
            let pass = '';
            for (let i = 0; i < generatorLength; i++) {
                pass += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            formPassword = pass;
            showPassword = true;
        }
    }

    // ── Password Strength ──────────────────────────────

    async function checkPasswordStrength(pwd) {
        if (!pwd) { passwordStrength = null; return; }
        try {
            const result = await window.api.passwordManager.checkStrength(pwd);
            if (result.success) {
                passwordStrength = result.strength;
            }
        } catch { /* ignore */ }
    }

    function getStrengthWidth(score) {
        return ((score || 0) + 1) * 20;
    }

    // ── Save ───────────────────────────────────────────

    async function savePassword() {
        if (!formTitle.trim()) {
            toastStore.warning('Title is required');
            return;
        }
        if (!formPassword.trim() && !editingPassword) {
            toastStore.warning('Password is required');
            return;
        }
        isSaving = true;
        try {
            if (editingPassword) {
                // Update existing credential
                const updateData = {
                    title: formTitle.trim(),
                    url: formUrl.trim(),
                    username: formUsername.trim(),
                    notes: formNotes.trim()
                };
                if (formPassword.trim()) {
                    updateData.password = formPassword.trim();
                }
                const result = await window.api.passwordManager.update(editingPassword.id, updateData);
                if (result.success) {
                    toastStore.success('Password updated');
                    closeModal();
                    await loadPasswords();
                    await loadStats();
                } else {
                    toastStore.error(result.error || 'Failed to update');
                }
            } else {
                // Save new credential via Chrome-like password manager API
                const result = await window.api.passwordManager.save({
                    profileId,
                    origin: formUrl.trim() || formTitle.trim(),
                    username: formUsername.trim(),
                    password: formPassword.trim(),
                    title: formTitle.trim(),
                    url: formUrl.trim(),
                    notes: formNotes.trim()
                });
                if (result.success) {
                    toastStore.success('Password saved');
                    closeModal();
                    await loadPasswords();
                    await loadStats();
                } else {
                    toastStore.error(result.error || 'Failed to save');
                }
            }
        } catch (e) {
            toastStore.error(e.message);
        } finally {
            isSaving = false;
        }
    }

    // ── Delete ─────────────────────────────────────────

    async function deletePassword(p) {
        if (!confirm(`Delete "${p.title}"?`)) return;
        try {
            const result = await window.api.passwordManager.delete(p.id);
            if (result.success) {
                toastStore.success('Password deleted');
                await loadPasswords();
                await loadStats();
            } else {
                toastStore.error(result.error || 'Failed to delete');
            }
        } catch (e) {
            toastStore.error(e.message);
        }
    }

    // ── Copy / Reveal ──────────────────────────────────

    async function copyField(value, field) {
        if (!value) return;
        try {
            await navigator.clipboard.writeText(value);
            copiedField = field;
            setTimeout(() => { copiedField = null; }, 1500);
            toastStore.success('Copied!');
        } catch (e) {
            toastStore.error('Copy failed');
        }
    }

    async function revealPassword(p) {
        try {
            // Get decrypted credential
            const result = await window.api.passwordManager.getCredential(p.id);
            if (result.success && result.credential?.password) {
                await navigator.clipboard.writeText(result.credential.password);
                toastStore.success('Password copied!');
            } else {
                toastStore.error('Failed to decrypt password');
            }
        } catch (e) {
            toastStore.error('Failed to copy password');
        }
    }

    function getDomain(url) {
        if (!url) return '';
        try {
            return new URL(url).hostname;
        } catch {
            return url;
        }
    }
</script>

<div class="w-full h-screen flex flex-col bg-white dark:bg-gray-900">
    <!-- Custom Title Bar -->
    <div class="h-10 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4" style="-webkit-app-region: drag">
        <div class="flex items-center gap-2">
            <Key size={16} class="text-blue-600 dark:text-blue-400" />
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Password Manager</span>
            {#if activeWorkspace}
                <span class="text-xs text-gray-400 dark:text-gray-500">•</span>
                <span class="text-xs text-gray-500 dark:text-gray-400">{activeWorkspace.name}</span>
            {/if}
        </div>
        <div style="-webkit-app-region: no-drag">
            <ChildWindowControls variant="dark" windowId={WINDOW_ID} />
        </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-6">
        <!-- Stats Bar -->
        {#if stats}
            <div class="flex items-center gap-4 mb-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                <div class="flex items-center gap-2 text-sm">
                    <Shield size={14} class="text-blue-500" />
                    <span class="text-gray-600 dark:text-gray-400">{stats.total} saved</span>
                </div>
                {#if stats.weakPasswords > 0}
                    <div class="flex items-center gap-2 text-sm">
                        <AlertTriangle size={14} class="text-amber-500" />
                        <span class="text-amber-600 dark:text-amber-400">{stats.weakPasswords} weak</span>
                    </div>
                {/if}
                {#if stats.neverSave > 0}
                    <div class="flex items-center gap-2 text-sm">
                        <Settings size={14} class="text-gray-400" />
                        <span class="text-gray-500 dark:text-gray-400">{stats.neverSave} never saved</span>
                    </div>
                {/if}
            </div>
        {/if}

        <!-- Search + Add -->
        <div class="flex items-center gap-3 mb-4">
            <div class="relative flex-1">
                <Search size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                <input
                    type="text"
                    bind:value={searchQuery}
                    placeholder="Search passwords..."
                    class="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
            </div>
            <button
                onclick={openAddModal}
                class="flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-500 transition-colors text-sm font-medium shrink-0"
            >
                <Plus size={16} />
                Add Password
            </button>
        </div>

        <!-- Error -->
        {#if loadError}
            <div class="mb-3 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
                {loadError}
            </div>
        {/if}

        <!-- List -->
        {#if isLoading}
            <div class="flex items-center justify-center py-12">
                <RefreshCw size={24} class="text-gray-400 dark:text-gray-500 animate-spin" />
            </div>
        {:else if filteredPasswords.length === 0}
            <div class="text-center py-16">
                <Key size={48} class="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                <p class="text-gray-500 dark:text-gray-400 font-medium">No passwords saved</p>
                <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">
                    {searchQuery ? 'No results found' : 'Passwords will be saved automatically when you log in to websites'}
                </p>
            </div>
        {:else}
            <div class="space-y-2">
                {#each filteredPasswords as p (p.id)}
                    <div class="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-sm transition-shadow">
                        <!-- Icon + Info -->
                        <div class="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
                            {#if p.favicon}
                                <img src={p.favicon} alt="" class="w-6 h-6 object-contain" />
                            {:else}
                                <Key size={18} class="text-gray-400 dark:text-gray-500" />
                            {/if}
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2">
                                <span class="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{p.title}</span>
                                {#if p.stored_in_keytar}
                                    <Shield size={12} class="text-green-500" title="Stored in OS vault" />
                                {/if}
                            </div>
                            <div class="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {getDomain(p.url || p.origin)}
                            </div>
                            {#if p.username}
                                <div class="text-xs text-gray-400 dark:text-gray-500 truncate">{p.username}</div>
                            {/if}
                        </div>
                        <!-- Actions -->
                        <div class="flex items-center gap-1 shrink-0">
                            <button onclick={() => copyField(p.username, 'u' + p.id)} title="Copy username" class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 dark:hover:text-gray-200 transition-colors">
                                {#if copiedField === 'u' + p.id}
                                    <Check size={14} class="text-green-500" />
                                {:else}
                                    <Copy size={14} />
                                {/if}
                            </button>
                            <button onclick={() => revealPassword(p)} title="Copy password" class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 dark:hover:text-gray-200 transition-colors">
                                <Key size={14} />
                            </button>
                            <button onclick={() => openEditModal(p)} class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 dark:hover:text-gray-200 transition-colors">
                                <Pencil size={14} />
                            </button>
                            <button onclick={() => deletePassword(p)} class="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors">
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>

<!-- Add/Edit Modal -->
{#if showModal}
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onclick={closeModal}>
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4" onclick={(e) => e.stopPropagation()}>
            <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 class="font-semibold text-gray-900 dark:text-gray-100">{editingPassword ? 'Edit Password' : 'Add Password'}</h2>
                <button onclick={closeModal} class="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                    <X size={18} class="text-gray-500" />
                </button>
            </div>
            <div class="p-4 space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title <span class="text-red-500">*</span></label>
                    <input type="text" bind:value={formTitle} placeholder="e.g. Gmail, Twitter" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">URL</label>
                    <input type="url" bind:value={formUrl} placeholder="https://..." class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username / Email</label>
                    <input type="text" bind:value={formUsername} placeholder="user@example.com" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {editingPassword ? 'New Password' : 'Password'}
                        {#if editingPassword}
                            <span class="text-gray-400 font-normal"> (leave blank to keep current)</span>
                        {/if}
                    </label>
                    <div class="relative">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            bind:value={formPassword}
                            placeholder="••••••••"
                            class="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <button type="button" onclick={() => showPassword = !showPassword} class="absolute right-2 top-1/2 -translate-y-1/2 p-1">
                            {#if showPassword}
                                <EyeOff size={16} class="text-gray-400" />
                            {:else}
                                <Eye size={16} class="text-gray-400" />
                            {/if}
                        </button>
                    </div>
                    <!-- Password Strength Indicator -->
                    {#if passwordStrength && formPassword}
                        <div class="mt-2">
                            <div class="flex items-center gap-2">
                                <div class="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                        class="h-full rounded-full transition-all duration-300"
                                        style="width: {getStrengthWidth(passwordStrength.score)}%; background-color: {passwordStrength.color};"
                                    ></div>
                                </div>
                                <span class="text-xs font-medium" style="color: {passwordStrength.color}">
                                    {passwordStrength.label}
                                </span>
                            </div>
                            {#if passwordStrength.feedback?.length > 0 && passwordStrength.score < 3}
                                <p class="text-xs text-gray-400 mt-1">{passwordStrength.feedback[0]}</p>
                            {/if}
                        </div>
                    {/if}
                </div>

                <!-- Password Generator -->
                <div class="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-800">
                    <div class="flex items-center gap-2 mb-2">
                        <Zap size={14} class="text-blue-500" />
                        <span class="text-xs font-medium text-gray-500 dark:text-gray-400">Password Generator</span>
                    </div>
                    <div class="flex items-center gap-2 mb-2">
                        <input type="range" min="8" max="64" bind:value={generatorLength} class="flex-1" />
                        <span class="text-xs text-gray-500 dark:text-gray-400 w-8 text-right">{generatorLength}</span>
                    </div>
                    <div class="flex items-center gap-4 mb-2 flex-wrap">
                        <label class="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                            <input type="checkbox" bind:checked={generatorLower} class="rounded" /> a-z
                        </label>
                        <label class="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                            <input type="checkbox" bind:checked={generatorUpper} class="rounded" /> A-Z
                        </label>
                        <label class="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                            <input type="checkbox" bind:checked={generatorNumbers} class="rounded" /> 0-9
                        </label>
                        <label class="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                            <input type="checkbox" bind:checked={generatorSymbols} class="rounded" /> !@#
                        </label>
                    </div>
                    <button onclick={generatePassword} class="w-full py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors">
                        <RefreshCw size={12} class="inline mr-1" />Generate Strong Password
                    </button>
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                    <textarea bind:value={formNotes} rows="2" placeholder="Optional notes..." class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 resize-none focus:ring-2 focus:ring-blue-500 outline-none"></textarea>
                </div>
                <div class="flex gap-2 pt-2">
                    <button onclick={closeModal} class="flex-1 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancel</button>
                    <button onclick={savePassword} disabled={isSaving} class="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                        {isSaving ? 'Saving...' : (editingPassword ? 'Update' : 'Save')}
                    </button>
                </div>
            </div>
        </div>
    </div>
{/if}

<style>
    input[type="range"] {
        accent-color: #3b82f6;
    }

    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }

    .animate-spin {
        animation: spin 1s linear infinite;
    }
</style>
