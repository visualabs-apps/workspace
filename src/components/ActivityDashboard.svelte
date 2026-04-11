<script>
    import { onMount } from "svelte";
    import { activityTracker } from "../lib/activityTracker.js";
    import { workspaceStore } from "../lib/workspaces.svelte.js";
    import { 
        BarChart3, 
        Clock, 
        Globe, 
        FileText, 
        TrendingUp,
        Calendar,
        X,
        RefreshCw
    } from "lucide-svelte";

    let { onClose } = $props();

    let analytics = $state(null);
    let isLoading = $state(true);
    let error = $state(null);
    let dateRange = $state('7'); // 7, 30, 90 days

    // Load analytics data
    async function loadAnalytics() {
        isLoading = true;
        error = null;
        
        try {
            const days = parseInt(dateRange);
            const dateFrom = new Date();
            dateFrom.setDate(dateFrom.getDate() - days);
            
            const result = await activityTracker.getAnalytics(
                dateFrom.toISOString().split('T')[0],
                new Date().toISOString().split('T')[0]
            );
            
            if (result.success) {
                analytics = result.data;
            } else {
                throw new Error(result.message || 'Failed to load analytics');
            }
        } catch (err) {
            error = err.message;
            console.error('Failed to load activity analytics:', err);
        } finally {
            isLoading = false;
        }
    }

    // Format duration
    function formatDuration(seconds) {
        if (!seconds) return '0m';
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    }

    // Format percentage
    function formatPercentage(value, total) {
        if (!total) return '0%';
        return `${Math.round((value / total) * 100)}%`;
    }

    // Get top domains
    function getTopDomains() {
        if (!analytics?.top_domains) return [];
        return analytics.top_domains.slice(0, 5);
    }

    // Get space usage summary
    function getSpaceUsage() {
        if (!analytics?.space_usage) return [];
        return analytics.space_usage.slice(0, 5);
    }

    // Get note activity summary
    function getNoteActivity() {
        if (!analytics?.note_activity) return [];
        return analytics.note_activity;
    }

    // Load data on mount and when date range changes
    onMount(loadAnalytics);
    
    $effect(() => {
        loadAnalytics();
    });
</script>

<!-- Activity Dashboard Modal -->
<div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
    <div class="bg-gray-900 rounded-xl shadow-2xl border border-gray-700 w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <!-- Header -->
        <div class="flex items-center justify-between p-6 border-b border-gray-700">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <BarChart3 size={20} class="text-white" />
                </div>
                <div>
                    <h2 class="text-xl font-semibold text-white">Activity Analytics</h2>
                    <p class="text-sm text-gray-400">Your workspace usage insights</p>
                </div>
            </div>
            
            <div class="flex items-center gap-3">
                <!-- Date Range Selector -->
                <select 
                    bind:value={dateRange}
                    class="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="7">Last 7 days</option>
                    <option value="30">Last 30 days</option>
                    <option value="90">Last 90 days</option>
                </select>
                
                <!-- Refresh Button -->
                <button
                    onclick={loadAnalytics}
                    disabled={isLoading}
                    class="w-9 h-9 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-300 hover:text-white transition-colors disabled:opacity-50"
                    title="Refresh"
                >
                    <RefreshCw size={16} class={isLoading ? 'animate-spin' : ''} />
                </button>
                
                <!-- Close Button -->
                <button
                    onclick={onClose}
                    class="w-9 h-9 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-300 hover:text-white transition-colors"
                    title="Close"
                >
                    <X size={16} />
                </button>
            </div>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-6">
            {#if isLoading}
                <!-- Loading State -->
                <div class="flex items-center justify-center h-64">
                    <div class="text-center">
                        <RefreshCw size={32} class="text-blue-500 animate-spin mx-auto mb-4" />
                        <p class="text-gray-400">Loading analytics...</p>
                    </div>
                </div>
            {:else if error}
                <!-- Error State -->
                <div class="flex items-center justify-center h-64">
                    <div class="text-center">
                        <div class="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                            <X size={24} class="text-red-400" />
                        </div>
                        <p class="text-red-400 mb-2">Failed to load analytics</p>
                        <p class="text-gray-500 text-sm">{error}</p>
                        <button
                            onclick={loadAnalytics}
                            class="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            {:else if analytics}
                <!-- Analytics Content -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <!-- Space Usage -->
                    <div class="bg-gray-800 rounded-lg p-6">
                        <div class="flex items-center gap-3 mb-4">
                            <Clock size={20} class="text-blue-400" />
                            <h3 class="text-lg font-semibold text-white">Space Usage</h3>
                        </div>
                        
                        {#if getSpaceUsage().length > 0}
                            <div class="space-y-3">
                                {#each getSpaceUsage() as space}
                                    <div class="flex items-center justify-between">
                                        <div class="flex-1">
                                            <p class="text-sm font-medium text-gray-200 truncate">
                                                {space.space_name || space.space_id}
                                            </p>
                                            <p class="text-xs text-gray-400">
                                                {space.switch_count} switches
                                            </p>
                                        </div>
                                        <div class="text-right">
                                            <p class="text-sm font-medium text-blue-400">
                                                {formatDuration(space.total_seconds)}
                                            </p>
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        {:else}
                            <p class="text-gray-500 text-sm">No space usage data available</p>
                        {/if}
                    </div>

                    <!-- Top Websites -->
                    <div class="bg-gray-800 rounded-lg p-6">
                        <div class="flex items-center gap-3 mb-4">
                            <Globe size={20} class="text-green-400" />
                            <h3 class="text-lg font-semibold text-white">Top Websites</h3>
                        </div>
                        
                        {#if getTopDomains().length > 0}
                            <div class="space-y-3">
                                {#each getTopDomains() as domain}
                                    <div class="flex items-center justify-between">
                                        <div class="flex-1">
                                            <p class="text-sm font-medium text-gray-200 truncate">
                                                {domain.url_domain}
                                            </p>
                                            <p class="text-xs text-gray-400">
                                                {formatDuration(domain.total_seconds)}
                                            </p>
                                        </div>
                                        <div class="text-right">
                                            <p class="text-sm font-medium text-green-400">
                                                {domain.visit_count} visits
                                            </p>
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        {:else}
                            <p class="text-gray-500 text-sm">No website data available</p>
                        {/if}
                    </div>

                    <!-- Note Activity -->
                    <div class="bg-gray-800 rounded-lg p-6">
                        <div class="flex items-center gap-3 mb-4">
                            <FileText size={20} class="text-yellow-400" />
                            <h3 class="text-lg font-semibold text-white">Note Activity</h3>
                        </div>
                        
                        {#if getNoteActivity().length > 0}
                            <div class="grid grid-cols-2 gap-4">
                                {#each getNoteActivity() as activity}
                                    <div class="text-center">
                                        <p class="text-2xl font-bold text-yellow-400">
                                            {activity.count}
                                        </p>
                                        <p class="text-xs text-gray-400 capitalize">
                                            {activity.action}s
                                        </p>
                                    </div>
                                {/each}
                            </div>
                        {:else}
                            <p class="text-gray-500 text-sm">No note activity data available</p>
                        {/if}
                    </div>

                    <!-- Daily Activity Chart -->
                    <div class="bg-gray-800 rounded-lg p-6">
                        <div class="flex items-center gap-3 mb-4">
                            <TrendingUp size={20} class="text-purple-400" />
                            <h3 class="text-lg font-semibold text-white">Daily Activity</h3>
                        </div>
                        
                        {#if analytics.daily_activity && analytics.daily_activity.length > 0}
                            <div class="space-y-2">
                                {#each analytics.daily_activity.slice(0, 7) as day}
                                    <div class="flex items-center justify-between text-sm">
                                        <span class="text-gray-300">
                                            {new Date(day.date).toLocaleDateString('en-US', { 
                                                month: 'short', 
                                                day: 'numeric' 
                                            })}
                                        </span>
                                        <div class="flex items-center gap-2">
                                            <span class="text-purple-400 capitalize">
                                                {day.activity_type.replace('_', ' ')}
                                            </span>
                                            <span class="text-gray-400">
                                                {day.count}
                                            </span>
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        {:else}
                            <p class="text-gray-500 text-sm">No daily activity data available</p>
                        {/if}
                    </div>
                </div>

                <!-- Summary Stats -->
                <div class="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div class="bg-gray-800 rounded-lg p-4 text-center">
                        <p class="text-2xl font-bold text-blue-400">
                            {analytics.space_usage?.length || 0}
                        </p>
                        <p class="text-xs text-gray-400">Active Spaces</p>
                    </div>
                    
                    <div class="bg-gray-800 rounded-lg p-4 text-center">
                        <p class="text-2xl font-bold text-green-400">
                            {analytics.top_domains?.length || 0}
                        </p>
                        <p class="text-xs text-gray-400">Websites Visited</p>
                    </div>
                    
                    <div class="bg-gray-800 rounded-lg p-4 text-center">
                        <p class="text-2xl font-bold text-yellow-400">
                            {analytics.note_activity?.reduce((sum, item) => sum + item.count, 0) || 0}
                        </p>
                        <p class="text-xs text-gray-400">Note Actions</p>
                    </div>
                    
                    <div class="bg-gray-800 rounded-lg p-4 text-center">
                        <p class="text-2xl font-bold text-purple-400">
                            {analytics.daily_activity?.reduce((sum, item) => sum + item.count, 0) || 0}
                        </p>
                        <p class="text-xs text-gray-400">Total Activities</p>
                    </div>
                </div>
            {/if}
        </div>
    </div>
</div>

<style>
    /* Custom scrollbar for the content area */
    .overflow-y-auto::-webkit-scrollbar {
        width: 6px;
    }
    
    .overflow-y-auto::-webkit-scrollbar-track {
        background: #374151;
        border-radius: 3px;
    }
    
    .overflow-y-auto::-webkit-scrollbar-thumb {
        background: #6b7280;
        border-radius: 3px;
    }
    
    .overflow-y-auto::-webkit-scrollbar-thumb:hover {
        background: #9ca3af;
    }
</style>