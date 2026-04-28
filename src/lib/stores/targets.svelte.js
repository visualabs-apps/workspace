// Target Store - manages EOS dashboard target data
import nativeApi from '../api/nativeApi.js';

function createTargetStore() {
    let items = $state([]);
    let isLoading = $state(false);
    let hasMore = $state(false);
    let currentPage = $state(1);
    
    // Filters
    let customerId = $state(undefined);
    let subscriptionId = $state(undefined);
    let category = $state(undefined);
    let assignedTo = $state(undefined);
    let threshold = $state(undefined);

    return {
        get items() { return items; },
        get isLoading() { return isLoading; },
        get hasMore() { return hasMore; },
        get currentPage() { return currentPage; },
        get customerId() { return customerId; },
        get subscriptionId() { return subscriptionId; },
        get category() { return category; },
        get assignedTo() { return assignedTo; },
        get threshold() { return threshold; },

        async loadTargets(page = 1) {
            try {
                isLoading = true;
                const params = new URLSearchParams({
                    page: page.toString(),
                    limit: '50',
                    sortBy: 'createdAt',
                    sortOrder: 'desc'
                });

                if (customerId !== undefined) params.append('customerId', customerId.toString());
                if (subscriptionId !== undefined) params.append('subscriptionId', subscriptionId.toString());
                if (category !== undefined) params.append('category', category.toString());
                if (assignedTo !== undefined) params.append('assignedTo', assignedTo.toString());
                if (threshold !== undefined) params.append('threshold', threshold.toString());

                const response = await nativeApi.get(`/scorecard-data/dashboard?${params.toString()}`);
                
                if (response.data.success) {
                    if (page === 1) {
                        items = response.data.data || [];
                    } else {
                        items = [...items, ...(response.data.data || [])];
                    }
                    currentPage = page;
                    hasMore = response.data.page?.hasNext || false;
                    return true;
                }
                return false;
            } catch (error) {
                console.error('Failed to load targets:', error);
                return false;
            } finally {
                isLoading = false;
            }
        },

        async loadMore() {
            if (!hasMore || isLoading) return;
            await this.loadTargets(currentPage + 1);
        },

        setFilter(filterName, value) {
            if (filterName === 'customerId') customerId = value;
            else if (filterName === 'subscriptionId') subscriptionId = value;
            else if (filterName === 'category') category = value;
            else if (filterName === 'assignedTo') assignedTo = value;
            else if (filterName === 'threshold') threshold = value;
            
            // Reload with new filter
            this.loadTargets(1);
        },

        clearFilters() {
            customerId = undefined;
            subscriptionId = undefined;
            category = undefined;
            assignedTo = undefined;
            threshold = undefined;
            this.loadTargets(1);
        },

        reset() {
            items = [];
            isLoading = false;
            hasMore = false;
            currentPage = 1;
            customerId = undefined;
            subscriptionId = undefined;
            category = undefined;
            assignedTo = undefined;
            threshold = undefined;
        }
    };
}

export const targetStore = createTargetStore();
