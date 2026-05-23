// App State Store - manages internal state for each app
// Stores URL, zoom level, and other state for each app

import { v4 as uuidv4 } from 'uuid';

function createAppStateStore() {
    // Structure: { appId: { tabs: [], activeTabId: string } }
    let appTabs = $state({});
    let globalIsDragging = $state(false);

    function updateTab(appId, tabId, updates) {
        const currentData = appTabs[appId];
        if (!currentData) return;

        const tabIndex = currentData.tabs.findIndex(t => t.id === tabId);
        if (tabIndex === -1) return;

        const updatedTabs = [
            ...currentData.tabs.slice(0, tabIndex),
            { ...currentData.tabs[tabIndex], ...updates },
            ...currentData.tabs.slice(tabIndex + 1)
        ];

        appTabs = {
            ...appTabs,
            [appId]: {
                ...currentData,
                tabs: updatedTabs
            }
        };
    }

    return {
        get appTabs() { return appTabs; },

        get isAnyTabDragging() { return globalIsDragging; },
        setDragging(state) { globalIsDragging = state; },

        // Get tabs for a specific app
        getAppTabs(appId) {
            return appTabs[appId]?.tabs || [];
        },

        // Get active tab ID for an app
        getActiveTabId(appId) {
            return appTabs[appId]?.activeTabId || null;
        },

        // Get active tab object for an app
        getActiveTab(appId) {
            const tabs = this.getAppTabs(appId);
            const activeTabId = this.getActiveTabId(appId);
            return tabs.find(t => t.id === activeTabId) || tabs[0] || null;
        },

        // Get specific tab by ID
        getTab(appId, tabId) {
            const tabs = this.getAppTabs(appId);
            return tabs.find(t => t.id === tabId) || null;
        },

        // Initialize tabs for an app (called when app is created)
        initAppTabs(appId, initialUrl, appName) {
            if (!appTabs[appId]) {
                const firstTab = {
                    id: uuidv4(),
                    title: appName,
                    url: initialUrl,
                    favicon: null,
                    isLoading: false,
                    isUnloaded: false,
                    createdAt: Date.now()
                };
                appTabs = {
                    ...appTabs,
                    [appId]: {
                        tabs: [firstTab],
                        activeTabId: firstTab.id
                    }
                };
            }
        },

        // Add a new tab to an app
        addTab(appId, url = 'https://www.google.com', title = 'New Tab') {
            const newTab = {
                id: uuidv4(),
                title,
                url,
                favicon: null,
                isLoading: true,
                isUnloaded: false,
                createdAt: Date.now()
            };

            const currentData = appTabs[appId] || { tabs: [], activeTabId: null };
            appTabs = {
                ...appTabs,
                [appId]: {
                    tabs: [...currentData.tabs, newTab],
                    activeTabId: newTab.id
                }
            };
            
            return newTab;
        },

        // Close a tab
        closeTab(appId, tabId) {
            const currentData = appTabs[appId];
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

            appTabs = {
                ...appTabs,
                [appId]: {
                    tabs,
                    activeTabId
                }
            };
            
            return true;
        },

        // Set active tab for an app
        setActiveTab(appId, tabId) {
            const currentData = appTabs[appId];
            if (currentData && currentData.tabs.find(t => t.id === tabId)) {
                appTabs = {
                    ...appTabs,
                    [appId]: {
                        ...currentData,
                        activeTabId: tabId
                    }
                };
                
                // If tab was unloaded, mark it as loaded again
                const tab = currentData.tabs.find(t => t.id === tabId);
                if (tab?.isUnloaded) {
                    updateTab(appId, tabId, { isUnloaded: false, isLoading: true });
                }
            }
        },

        // Update tab properties (title, url, favicon, etc.)
        updateTab(appId, tabId, updates) {
            updateTab(appId, tabId, updates);
        },

        // Remove all tabs for an app (when app is deleted)
        removeAppTabs(appId) {
            const { [appId]: removed, ...rest } = appTabs;
            appTabs = rest;
        },

        // Clear all tabs for all apps (used on logout for multi-user safety)
        clearAll() {
            appTabs = {};
            globalIsDragging = false;
        },

        // Reorder tabs
        reorderTabs(appId, newTabOrder) {
            const currentData = appTabs[appId];
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

            appTabs = {
                ...appTabs,
                [appId]: {
                    ...currentData,
                    tabs: newTabOrder
                }
            };
        }
    };
}

export const appStateStore = createAppStateStore();
