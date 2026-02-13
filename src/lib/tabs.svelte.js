// Tab Store - manages tabs within each service/app
// Each service can have multiple tabs

import { v4 as uuidv4 } from 'uuid';

function createTabStore() {
    // Structure: { serviceId: { tabs: [], activeTabId: string } }
    let storedTabs = {};
    try {
        const item = localStorage.getItem('vleb_tabs');
        if (item) storedTabs = JSON.parse(item);
    } catch (e) {
        console.error('Failed to load tabs', e);
    }

    // State
    let serviceTabs = $state(storedTabs);

    // Auto-save to localStorage
    $effect.root(() => {
        $effect(() => {
            localStorage.setItem('vleb_tabs', JSON.stringify(serviceTabs));
        });
    });

    return {
        get serviceTabs() { return serviceTabs; },

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

        // Initialize tabs for a service (called when service is created)
        initServiceTabs(serviceId, initialUrl, serviceName) {
            if (!serviceTabs[serviceId]) {
                const firstTab = {
                    id: uuidv4(),
                    title: serviceName,
                    url: initialUrl,
                    favicon: null,
                    isLoading: false,
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
            }
        },

        // Update tab properties (title, url, favicon, etc.)
        updateTab(serviceId, tabId, updates) {
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
