<script>
    import ChildWindowControls from "../components/layout/ChildWindowControls.svelte";
    import { Target, TrendingUp, TrendingDown, Minus, RefreshCw, Filter, X } from "lucide-svelte";
    import { targetStore } from "../lib/stores/targets.svelte.js";
    import { toastStore } from "../lib/managers/toast.svelte.js";
    import { onMount } from "svelte";
    import { initTheme } from "../lib/utils/theme.js";

    const WINDOW_ID = 'target-window';

    let profileName = $state('');

    // Initialize theme
    onMount(() => { initTheme(); });

    // Receive data from parent window via IPC
    $effect(() => {
        const handleWindowData = (data) => {
            console.log('[WindowTarget] Received data:', data);
            if (data.profileName) profileName = data.profileName;
        };

        if (window.api?.onWindowData) {
            window.api.onWindowData(handleWindowData);
        }
    });

    let items = $derived(targetStore.items);
    let isLoading = $derived(targetStore.isLoading);
    let hasMore = $derived(targetStore.hasMore);
    
    let showFilters = $state(false);
    let selectedCategory = $state(undefined);
    let selectedThreshold = $state(undefined);

    const CATEGORY_OPTIONS = [
        { value: 0, label: 'Goal / Target' },
        { value: 1, label: 'Indikator' },
        { value: 2, label: 'Aktifitas' }
    ];

    const THRESHOLD_OPTIONS = [
        { value: 0, label: 'Green', color: 'bg-green-500' },
        { value: 1, label: 'Yellow', color: 'bg-yellow-500' },
        { value: 2, label: 'Red', color: 'bg-red-500' }
    ];

    // Load targets when window opens
    $effect(() => {
        targetStore.loadTargets();
    });

    async function handleRefresh() {
        const success = await targetStore.loadTargets(1);
        if (success) {
            toastStore.success('Data refreshed');
        } else {
            toastStore.error('Failed to refresh data');
        }
    }

    async function handleLoadMore() {
        await targetStore.loadMore();
    }

    function handleCategoryFilter(value) {
        selectedCategory = value;
        targetStore.setFilter('category', value);
    }

    function handleThresholdFilter(value) {
        selectedThreshold = value;
        targetStore.setFilter('threshold', value);
    }

    function handleClearFilters() {
        selectedCategory = undefined;
        selectedThreshold = undefined;
        targetStore.clearFilters();
    }

    function getThresholdColor(threshold) {
        if (threshold === 0) return 'bg-green-500';
        if (threshold === 1) return 'bg-yellow-500';
        if (threshold === 2) return 'bg-red-500';
        return 'bg-gray-500';
    }

    function getThresholdLabel(threshold) {
        if (threshold === 0) return 'Green';
        if (threshold === 1) return 'Yellow';
        if (threshold === 2) return 'Red';
        return 'Unknown';
    }

    function getTrendIcon(trend) {
        if (trend === 3) return TrendingUp;
        if (trend === 1) return TrendingDown;
        return Minus;
    }

    function getTrendColor(trend) {
        if (trend === 3) return 'text-green-600';
        if (trend === 1) return 'text-red-600';
        return 'text-gray-600';
    }

    function getCategoryLabel(category) {
        const cat = CATEGORY_OPTIONS.find(c => c.value === category);
        return cat ? cat.label : 'Unknown';
    }

    function formatValue(value) {
        if (!value) return '-';
        const num = parseFloat(value);
        return isNaN(num) ? value : num.toLocaleString('id-ID');
    }
</script>

<div class="w-full h-screen flex flex-col bg-white dark:bg-gray-900">
    <!-- Custom Title Bar -->
    <div class="h-10 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4" style="-webkit-app-region: drag">
        <div class="flex items-center gap-2">
            <Target size={16} class="text-blue-600 dark:text-blue-400" />
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
                Target Manager{profileName ? ` dari ${profileName}` : ''}
            </span>
        </div>
        <div style="-webkit-app-region: no-drag">
            <ChildWindowControls windowId={WINDOW_ID} />
        </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-hidden">
<div class="flex flex-col h-full bg-white dark:bg-gray-900">
        <!-- Header Actions -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <div class="flex items-center gap-2">
                <Target size={18} class="text-blue-600 dark:text-blue-400" />
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {items.length} Target{items.length !== 1 ? 's' : ''}
                </span>
            </div>

            <div class="flex items-center gap-2">
                <button
                    onclick={() => showFilters = !showFilters}
                    class="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 {showFilters ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300'}"
                >
                    <Filter size={14} />
                    Filter
                </button>

                <button
                    onclick={handleRefresh}
                    disabled={isLoading}
                    class="px-3 py-1.5 text-sm rounded-lg bg-blue-600 dark:bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-500 text-white transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <RefreshCw size={14} class={isLoading ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>
        </div>

        <!-- Filters Panel -->
        {#if showFilters}
            <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20">
                <div class="flex items-center gap-3 flex-wrap">
                    <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Filter:</span>

                    <!-- Category Filter -->
                    <select
                        bind:value={selectedCategory}
                        onchange={(e) => handleCategoryFilter(e.target.value === '' ? undefined : parseInt(e.target.value))}
                        class="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
                    >
                        <option value="">All Categories</option>
                        {#each CATEGORY_OPTIONS as cat}
                            <option value={cat.value}>{cat.label}</option>
                        {/each}
                    </select>

                    <!-- Threshold Filter -->
                    <select
                        bind:value={selectedThreshold}
                        onchange={(e) => handleThresholdFilter(e.target.value === '' ? undefined : parseInt(e.target.value))}
                        class="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
                    >
                        <option value="">All Status</option>
                        {#each THRESHOLD_OPTIONS as thresh}
                            <option value={thresh.value}>{thresh.label}</option>
                        {/each}
                    </select>

                    {#if selectedCategory !== undefined || selectedThreshold !== undefined}
                        <button
                            onclick={handleClearFilters}
                            class="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-1 text-gray-700 dark:text-gray-300"
                        >
                            <X size={14} />
                            Clear
                        </button>
                    {/if}
                </div>
            </div>
        {/if}

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-4">
            {#if isLoading && items.length === 0}
                <!-- Loading State -->
                <div class="flex items-center justify-center h-full">
                    <div class="text-center">
                        <RefreshCw size={32} class="text-blue-600 dark:text-blue-400 animate-spin mx-auto mb-3" />
                        <p class="text-gray-600 dark:text-gray-400">Loading targets...</p>
                    </div>
                </div>
            {:else if items.length === 0}
                <!-- Empty State -->
                <div class="flex items-center justify-center h-full">
                    <div class="text-center">
                        <Target size={48} class="text-gray-400 dark:text-gray-500 mx-auto mb-3" />
                        <p class="text-gray-600 dark:text-gray-400 font-medium">No targets found</p>
                        <p class="text-gray-500 dark:text-gray-500 text-sm mt-1">Try adjusting your filters</p>
                    </div>
                </div>
            {:else}
                <!-- Target Cards -->
                <div class="grid grid-cols-1 gap-3">
                    {#each items as item (item.id)}
                        {@const scorecard = item.scorecard}
                        {@const TrendIcon = getTrendIcon(item.trend)}

                        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md dark:hover:shadow-lg transition-shadow">
                            <!-- Header -->
                            <div class="flex items-start justify-between mb-3">
                                <div class="flex-1">
                                    <h3 class="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                                        {scorecard?.title || 'Untitled'}
                                    </h3>
                                    <div class="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                                        <span class="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
                                            {getCategoryLabel(scorecard?.category)}
                                        </span>
                                        {#if scorecard?.customerProfile?.name}
                                            <span>• {scorecard.customerProfile.name}</span>
                                        {/if}
                                        {#if scorecard?.subscription?.brand}
                                            <span>• {scorecard.subscription.brand}</span>
                                        {/if}
                                    </div>
                                </div>
                                
                                <!-- Status Badge -->
                                <div class="flex items-center gap-2">
                                    <span class="px-2 py-1 rounded text-xs font-medium text-white {getThresholdColor(item.threshold)}">
                                        {getThresholdLabel(item.threshold)}
                                    </span>
                                </div>
                            </div>

                            <!-- Values -->
                            <div class="grid grid-cols-3 gap-4 mb-3">
                                <div>
                                    <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Actual</p>
                                    <p class="text-lg font-bold text-gray-900 dark:text-gray-100">
                                        {formatValue(item.actualValue)}
                                    </p>
                                </div>
                                <div>
                                    <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Target</p>
                                    <p class="text-lg font-bold text-gray-900 dark:text-gray-100">
                                        {formatValue(item.targetValue)}
                                    </p>
                                </div>
                                <div>
                                    <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Trend</p>
                                    <div class="flex items-center gap-1">
                                        <TrendIcon size={20} class={getTrendColor(item.trend)} />
                                    </div>
                                </div>
                            </div>

                            <!-- Footer -->
                            <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-3 border-t border-gray-100 dark:border-gray-700">
                                <span>
                                    Period: {item.year}{item.month ? `/${item.month}` : ''}{item.week ? `/W${item.week}` : ''}
                                </span>
                                {#if scorecard?.assigneeProfile?.name}
                                    <span>PIC: {scorecard.assigneeProfile.name}</span>
                                {/if}
                            </div>
                        </div>
                    {/each}
                </div>

                <!-- Load More -->
                {#if hasMore}
                    <div class="flex justify-center mt-4">
                        <button
                            onclick={handleLoadMore}
                            disabled={isLoading}
                            class="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300"
                        >
                            {isLoading ? 'Loading...' : 'Load More'}
                        </button>
                    </div>
                {/if}
            {/if}
        </div>
    </div>
    </div>
</div>
