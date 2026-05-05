<script>
    import BaseWindow from "../base/BaseWindow.svelte";
    import { Target, TrendingUp, TrendingDown, Minus, RefreshCw, Filter, X } from "lucide-svelte";
    import { targetStore } from "../../lib/stores/targets.svelte.js";
    import { toastStore } from "../../lib/managers/toast.svelte.js";
    import { onMount } from "svelte";

    let { isOpen = $bindable(false), onClose = () => {} } = $props();

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
        if (isOpen) {
            targetStore.loadTargets();
        }
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

<BaseWindow
    bind:isOpen
    windowId="target-window"
    title="Target Dashboard"
    subtitle="Monitor KPI dan Target"
    width="900px"
    height="700px"
    minWidth="700px"
    minHeight="500px"
    showMaximizeButton={true}
    {onClose}
>
    <div class="flex flex-col h-full bg-white">
        <!-- Header Actions -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
            <div class="flex items-center gap-2">
                <Target size={18} class="text-blue-600" />
                <span class="text-sm font-medium text-gray-700">
                    {items.length} Target{items.length !== 1 ? 's' : ''}
                </span>
            </div>
            
            <div class="flex items-center gap-2">
                <button
                    onclick={() => showFilters = !showFilters}
                    class="px-3 py-1.5 text-sm rounded-lg border border-gray-300 hover:bg-gray-100 transition-colors flex items-center gap-2 {showFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white text-gray-700'}"
                >
                    <Filter size={14} />
                    Filter
                </button>
                
                <button
                    onclick={handleRefresh}
                    disabled={isLoading}
                    class="px-3 py-1.5 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <RefreshCw size={14} class={isLoading ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>
        </div>

        <!-- Filters Panel -->
        {#if showFilters}
            <div class="px-4 py-3 border-b border-gray-200 bg-blue-50">
                <div class="flex items-center gap-3 flex-wrap">
                    <span class="text-sm font-medium text-gray-700">Filter:</span>
                    
                    <!-- Category Filter -->
                    <select
                        bind:value={selectedCategory}
                        onchange={(e) => handleCategoryFilter(e.target.value === '' ? undefined : parseInt(e.target.value))}
                        class="px-3 py-1.5 text-sm rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        class="px-3 py-1.5 text-sm rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">All Status</option>
                        {#each THRESHOLD_OPTIONS as thresh}
                            <option value={thresh.value}>{thresh.label}</option>
                        {/each}
                    </select>

                    {#if selectedCategory !== undefined || selectedThreshold !== undefined}
                        <button
                            onclick={handleClearFilters}
                            class="px-3 py-1.5 text-sm rounded-lg border border-gray-300 hover:bg-gray-100 transition-colors flex items-center gap-1 text-gray-700"
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
                        <RefreshCw size={32} class="text-blue-600 animate-spin mx-auto mb-3" />
                        <p class="text-gray-600">Loading targets...</p>
                    </div>
                </div>
            {:else if items.length === 0}
                <!-- Empty State -->
                <div class="flex items-center justify-center h-full">
                    <div class="text-center">
                        <Target size={48} class="text-gray-400 mx-auto mb-3" />
                        <p class="text-gray-600 font-medium">No targets found</p>
                        <p class="text-gray-500 text-sm mt-1">Try adjusting your filters</p>
                    </div>
                </div>
            {:else}
                <!-- Target Cards -->
                <div class="grid grid-cols-1 gap-3">
                    {#each items as item (item.id)}
                        {@const scorecard = item.scorecard}
                        {@const TrendIcon = getTrendIcon(item.trend)}
                        
                        <div class="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                            <!-- Header -->
                            <div class="flex items-start justify-between mb-3">
                                <div class="flex-1">
                                    <h3 class="font-semibold text-gray-900 mb-1">
                                        {scorecard?.title || 'Untitled'}
                                    </h3>
                                    <div class="flex items-center gap-2 text-xs text-gray-600">
                                        <span class="px-2 py-0.5 bg-gray-100 rounded">
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
                                    <p class="text-xs text-gray-500 mb-1">Actual</p>
                                    <p class="text-lg font-bold text-gray-900">
                                        {formatValue(item.actualValue)}
                                    </p>
                                </div>
                                <div>
                                    <p class="text-xs text-gray-500 mb-1">Target</p>
                                    <p class="text-lg font-bold text-gray-900">
                                        {formatValue(item.targetValue)}
                                    </p>
                                </div>
                                <div>
                                    <p class="text-xs text-gray-500 mb-1">Trend</p>
                                    <div class="flex items-center gap-1">
                                        <svelte:component this={TrendIcon} size={20} class={getTrendColor(item.trend)} />
                                    </div>
                                </div>
                            </div>

                            <!-- Footer -->
                            <div class="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-100">
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
                            class="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Loading...' : 'Load More'}
                        </button>
                    </div>
                {/if}
            {/if}
        </div>
    </div>
</BaseWindow>




