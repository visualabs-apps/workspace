// Tab Store - manages tabs within each service/app
// Each service can have multiple tabs (browser tabs)

import { v4 as uuidv4 } from 'uuid';

function createTabStore() {
    // Structure: { serviceId: { tabs: [], activeTabId: string } }
    let serviceTabs = $state({});
    let globalIsDragging = $state(false);

    function updateTab(serviceId, tabId, updates) {
        const currentData = serviceTabs[serviceId];
        if (!currentData) return;

        const tabIndex = currentData.tabs.findIndex(t => t.id === tabId);
        if (tabIndex === -1) return;

        const updatedTabs = [
            ...currentData.tabs.slice(0, tabIndex),
            { ...currentData.tabs[tabIndex], ...updates },
            ...currentData.tabs.slice(tabIndex + 1)
        ];

        serviceTabs = {
            ...serviceTabs,
            [serviceId]: {
                ...currentData,
                tabs: updatedTabs
            }
        };
    }

    return {
        get serviceTabs() { return serviceTabs; },

        get isAnyTabDragging() { return globalIsDragging; },
        setDragging(state) { globalIsDragging = state; },

        // Get tabs for a specific service
        getServiceTabs(serviceId) {
            return serviceTabs[serviceId]?.tabs || [];
        },

        // Get active tab ID for a service
        getActiveTabId(serviceId) {
            return serviceTabs[serviceId]?.activeTabId || null;
        },

        // Get active tab object for a service
        getActiveTab(serviceId) {
            const tabs = this.getServiceTabs(serviceId);
            const activeTabId = this.getActiveTabId(serviceId);
            return tabs.find(t => t.id === activeTabId) || tabs[0] || null;
        },

        // Get specific tab by ID
        getTab(serviceId, tabId) {
            const tabs = this.getServiceTabs(serviceId);
            return tabs.find(t => t.id === tabId) || null;
        },

        // Initialize tabs for a service (called when service is created)
        initServiceTabs(serviceId, initialUrl, serviceName) {
            if (!serviceTabs[serviceId]) {
                const firstTab = {
                    id: uuidv4(),
                    title: serviceName,
                    url: initialUrl,
                    favicon: null,
                    isLoading: false,
                    isUnloaded: false,
                    createdAt: Date.now()
                };
                serviceTabs = {
                    ...serviceTabs,
                    [serviceId]: {
                        tabs: [firstTab],
                        activeTabId: firstTab.id
                    }
                };
            }
        },

        // Add a new tab to a service
        addTab(serviceId, url = 'https://www.google.com', title = 'New Tab') {
            const newTab = {
                id: uuidv4(),
                title,
                url,
                favicon: null,
                isLoading: true,
                isUnloaded: false,
                createdAt: Date.now()
            };

            const currentData = serviceTabs[serviceId] || { tabs: [], activeTabId: null };
            serviceTabs = {
                ...serviceTabs,
                [serviceId]: {
                    tabs: [...currentData.tabs, newTab],
                    activeTabId: newTab.id
                }
            };
            
            return newTab;
        },

        // Close a tab
        closeTab(serviceId, tabId) {
            const currentData = serviceTabs[serviceId];
            if (!currentData) {
                return false;
            }

            const tabs = currentData.tabs.filter(t => t.id !== tabId);
            let activeTabId = currentData.activeTabId;

            // If we closed the active tab, switch to another
            if (activeTabId === tabId && tabs.length > 0) {
                const closedIndex = currentData.tabs.findIndex(t => t.id === tabId);
                const newIndex = Math.max(0, closedIndex - 1);
                activeTabId = tabs[newIndex]?.id || tabs[0]?.id;
            } else if (tabs.length === 0) {
                // No tabs left, set activeTabId to null
                activeTabId = null;
            }

            serviceTabs = {
                ...serviceTabs,
                [serviceId]: {
                    tabs,
                    activeTabId
                }
            };
            
            return true;
        },

        // Set active tab for a service
        setActiveTab(serviceId, tabId) {
            const currentData = serviceTabs[serviceId];
            if (currentData && currentData.tabs.find(t => t.id === tabId)) {
                serviceTabs = {
                    ...serviceTabs,
                    [serviceId]: {
                        ...currentData,
                        activeTabId: tabId
                    }
                };
                
                // If tab was unloaded, mark it as loaded again
                const tab = currentData.tabs.find(t => t.id === tabId);
                if (tab?.isUnloaded) {
                    updateTab(serviceId, tabId, { isUnloaded: false, isLoading: true });
                }
            }
        },

        // Update tab properties (title, url, favicon, etc.)
        updateTab(serviceId, tabId, updates) {
            updateTab(serviceId, tabId, updates);
        },

        // Remove all tabs for a service (when service is deleted)
        removeServiceTabs(serviceId) {
            const { [serviceId]: removed, ...rest } = serviceTabs;
            serviceTabs = rest;
        },

        // Reorder tabs
        reorderTabs(serviceId, newTabOrder) {
            const currentData = serviceTabs[serviceId];
            if (!currentData) return;

            // Validate: ensure no duplicates and all tabs exist
            const uniqueIds = new Set(newTabOrder.map(t => t.id));
            if (uniqueIds.size !== newTabOrder.length) {
                console.error('Duplicate tab IDs detected in reorder, skipping');
                return;
            }

            // Validate: ensure all tabs in newTabOrder exist in current tabs
            const currentIds = new Set(currentData.tabs.map(t => t.id));
            const allValid = newTabOrder.every(t => currentIds.has(t.id));
            if (!allValid) {
                console.error('Invalid tab IDs in reorder, skipping');
                return;
            }

            serviceTabs = {
                ...serviceTabs,
                [serviceId]: {
                    ...currentData,
                    tabs: newTabOrder
                }
            };
        }
    };
}

export const tabStore = createTabStore();
