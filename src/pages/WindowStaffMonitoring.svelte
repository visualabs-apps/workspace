<script>
    import ChildWindowControls from '../components/layout/ChildWindowControls.svelte';
    import { getUsers, getChromeProfiles } from '../lib/api/api.js';
    import { workspaceStore } from '../lib/stores/workspaces.svelte.js';
    import { Eye, Users, Loader2, Search, X } from 'lucide-svelte';
    import { onMount } from "svelte";
    import { initTheme } from "../lib/utils/theme.js";

    const WINDOW_ID = 'staff-monitoring-window';

    let users = $state([]);
    let usersWithProfiles = $state([]);
    let isLoading = $state(false);
    let error = $state(null);
    let searchQuery = $state('');

    // Filtered users based on search
    let filteredUsers = $derived(
        searchQuery.trim() === '' 
            ? usersWithProfiles 
            : usersWithProfiles.filter(user => {
                const query = searchQuery.toLowerCase();
                const name = (user.profile?.name || user.username || '').toLowerCase();
                const email = (user.email || '').toLowerCase();
                return name.includes(query) || email.includes(query);
            })
    );

    // Load users and their profile counts
    async function loadUsersWithProfiles() {
        isLoading = true;
        error = null;
        
        try {
            // Fetch all users
            const usersResponse = await getUsers({ limit: 100 });
            
            if (!usersResponse.success) {
                error = usersResponse.error || 'Failed to load users';
                return;
            }
            
            users = usersResponse.data || [];
            
            // Fetch profile counts for each user
            const usersWithCounts = await Promise.all(
                users.map(async (user) => {
                    try {
                        const profilesResponse = await getChromeProfiles({ 
                            userId: user.id,
                            limit: 100 
                        });
                        
                        let profileCount = 0;
                        if (profilesResponse.success) {
                            profileCount = profilesResponse.data?.length || 0;
                        }
                        
                        return {
                            ...user,
                            profileCount
                        };
                    } catch (err) {
                        console.error(`Failed to fetch profiles for user ${user.id}:`, err);
                        return {
                            ...user,
                            profileCount: 0
                        };
                    }
                })
            );
            
            usersWithProfiles = usersWithCounts;
        } catch (err) {
            console.error('Failed to load users:', err);
            error = err.message || 'Failed to load users';
        } finally {
            isLoading = false;
        }
    }

    // View profiles for a specific user
    async function viewUserProfiles(userId, userName) {
        try {
            await workspaceStore.startMonitoring(userId);
            
            // Send message to parent to show notification
            if (window.api?.sendToParent) {
                window.api.sendToParent('monitoring-started', { 
                    userId, 
                    userName 
                });
            }
            
            // Close this window
            if (window.api?.close) {
                window.api.close();
            }
        } catch (err) {
            console.error('Failed to start monitoring:', err);
            error = 'Failed to view user profiles';
        }
    }

    function clearSearch() {
        searchQuery = '';
    }

    // Initialize theme
    onMount(() => { initTheme(); });

    // Load data on mount
    $effect(() => {
        loadUsersWithProfiles();
    });
</script>

<div class="w-full h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
    <!-- Custom Title Bar -->
    <div
        class="h-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4"
        style="-webkit-app-region: drag"
    >
        <div class="flex items-center gap-2">
            <Users size={16} class="text-blue-600 dark:text-blue-400" />
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Staff Profile Monitoring</span>
        </div>
        <div style="-webkit-app-region: no-drag">
            <ChildWindowControls variant="dark" windowId={WINDOW_ID} />
        </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-hidden flex flex-col">
        <!-- Header Section -->
        <div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
            <div class="flex items-center justify-between mb-4">
                <div>
                    <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Staff Members</h2>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">View and monitor profiles from all staff members</p>
                </div>
                {#if !isLoading && usersWithProfiles.length > 0}
                    <div class="text-sm text-gray-500 dark:text-gray-400">
                        <span class="font-medium text-gray-900 dark:text-gray-100">{filteredUsers.length}</span> of <span class="font-medium text-gray-900 dark:text-gray-100">{usersWithProfiles.length}</span> staff
                    </div>
                {/if}
            </div>

            <!-- Search Bar -->
            {#if !isLoading && usersWithProfiles.length > 0}
                <div class="relative">
                    <Search size={18} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                    <input
                        type="text"
                        bind:value={searchQuery}
                        placeholder="Search by name or email..."
                        class="w-full pl-10 pr-10 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                    />
                    {#if searchQuery}
                        <button
                            onclick={clearSearch}
                            class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        >
                            <X size={18} />
                        </button>
                    {/if}
                </div>
            {/if}
        </div>

        <!-- Staff List -->
        <div class="flex-1 overflow-auto p-6">
            {#if isLoading}
                <div class="flex items-center justify-center h-64">
                    <div class="text-center">
                        <Loader2 size={32} class="text-blue-600 dark:text-blue-400 animate-spin mx-auto mb-3" />
                        <p class="text-gray-600 dark:text-gray-400">Loading staff data...</p>
                    </div>
                </div>
            {:else if error}
                <div class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-4 text-center">
                    <p class="text-red-600 dark:text-red-400">{error}</p>
                    <button
                        onclick={loadUsersWithProfiles}
                        class="mt-3 px-4 py-2 bg-red-600 dark:bg-red-600 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-500 transition-colors"
                    >
                        Retry
                    </button>
                </div>
            {:else if usersWithProfiles.length === 0}
                <div class="text-center py-12">
                    <Users size={48} class="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p class="text-gray-500 dark:text-gray-400">No staff members found</p>
                </div>
            {:else if filteredUsers.length === 0}
                <div class="text-center py-12">
                    <Search size={48} class="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p class="text-gray-500 dark:text-gray-400">No staff members match your search</p>
                    <button
                        onclick={clearSearch}
                        class="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                    >
                        Clear search
                    </button>
                </div>
            {:else}
                <!-- Card Grid -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {#each filteredUsers as user (user.id)}
                        <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md dark:hover:shadow-lg transition-all">
                            <!-- User Info -->
                            <div class="flex items-start gap-4 mb-4">
                                <div class="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-lg font-semibold shrink-0">
                                    {(user.profile?.name || user.username || user.email || 'U').charAt(0).toUpperCase()}
                                </div>
                                <div class="flex-1 min-w-0">
                                    <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
                                        {user.profile?.name || user.username || 'Unknown'}
                                    </h3>
                                    <p class="text-sm text-gray-500 dark:text-gray-400 truncate">{user.email || '-'}</p>
                                    <div class="mt-2">
                                        <span class="inline-flex px-2 py-1 text-xs font-medium rounded-full {
                                            user.role === 1 ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' :
                                            user.role === 2 ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                                            user.role === 3 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                                            user.role === 4 ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300' :
                                            'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                        }">
                                            {user.role === 1 ? 'Admin' : user.role === 2 ? 'Manager' : user.role === 3 ? 'Staff' : user.role === 4 ? 'Viewer' : `Role ${user.role}`}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <!-- Profile Count & Action -->
                            <div class="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
                                <div class="flex items-center gap-2">
                                    <div class="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                        <span class="text-sm font-semibold text-blue-700 dark:text-blue-300">{user.profileCount}</span>
                                    </div>
                                    <span class="text-sm text-gray-600 dark:text-gray-400">
                                        {user.profileCount === 1 ? 'Profile' : 'Profiles'}
                                    </span>
                                </div>
                                <button
                                    onclick={() => viewUserProfiles(user.id, user.profile?.name || user.username || user.email)}
                                    class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 dark:hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={user.profileCount === 0}
                                >
                                    <Eye size={16} />
                                    View
                                </button>
                            </div>
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    </div>
</div>
