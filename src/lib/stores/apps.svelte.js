
// This will be a Svelte 5 Runes store
// We'll manage the apps array and the active app ID here.

import { v4 as uuidv4 } from 'uuid';
import { appStateStore } from './appState.svelte.js';
import { workspaceStore } from './workspaces.svelte.js';
import { tabLifetimeManager } from '../managers/tabLifetime.svelte.js';

export const predefinedApps = [
    { name: 'WhatsApp', url: 'https://web.whatsapp.com', icon: 'https://icon.horse/icon/web.whatsapp.com', color: '#25D366' },
    { name: 'Telegram', url: 'https://web.telegram.org/k/', icon: 'https://icon.horse/icon/telegram.org', color: '#0088cc' },
    { name: 'Discord', url: 'https://discord.com/app', icon: 'https://icon.horse/icon/discord.com', color: '#5865F2' },
    { name: 'Slack', url: 'https://app.slack.com/client', icon: 'https://icon.horse/icon/slack.com', color: '#4A154B' },
    { name: 'Gmail', url: 'https://mail.google.com', icon: 'https://icon.horse/icon/mail.google.com', color: '#EA4335' },
    { name: 'Notion', url: 'https://www.notion.so', icon: 'https://icon.horse/icon/notion.so', color: '#000000' },
    { name: 'ChatGPT', url: 'https://chat.openai.com', icon: 'https://icon.horse/icon/chat.openai.com', color: '#10A37F' },
    { name: 'YouTube', url: 'https://youtube.com', icon: 'https://icon.horse/icon/youtube.com', color: '#FF0000' },
    { name: 'GitHub', url: 'https://github.com', icon: 'https://icon.horse/icon/github.com', color: '#181717' },
    { name: 'Figma', url: 'https://figma.com', icon: 'https://icon.horse/icon/figma.com', color: '#F24E1E' },
    { name: 'Trello', url: 'https://trello.com', icon: 'https://icon.horse/icon/trello.com', color: '#0052CC' },
    { name: 'Linear', url: 'https://linear.app', icon: 'https://icon.horse/icon/linear.app', color: '#5E6AD2' },
    { name: 'Custom', url: 'https://google.com', icon: 'https://icon.horse/icon/google.com', color: '#666666' },
];



function createAppStore() {
    // Initial state from localStorage if available
    let storedApps = [];
    try {
        const item = localStorage.getItem('rambox_services');
        if (item) storedApps = JSON.parse(item);
    } catch (e) {
        console.error('Failed to load apps', e);
    }

    // Core state using runes
    let apps = $state(storedApps);
    let appsMap = $state(new Map(storedApps.map(s => [s.id, s])));
    let activeAppId = $state(storedApps.length > 0 ? storedApps[0].id : null);
    let isSideBarCollapsed = $state(false);
    let isAddModalOpen = $state(false);

    // Migrate: ensure every app with a workspaceId has the correct partition
    // This fixes any data saved with an old/wrong partition value
    let needsMigration = false;
    storedApps = storedApps.map(app => {
        if (app.workspaceId) {
            const correctPartition = `persist:workspace-${app.workspaceId}`;
            if (app.partition !== correctPartition) {
                needsMigration = true;
                return { ...app, partition: correctPartition };
            }
        }
        return app;
    });
    if (needsMigration) {
        try {
            localStorage.setItem('rambox_services', JSON.stringify(storedApps));
        } catch (e) { }
    }

    // Initialize tabs for existing apps
    storedApps.forEach(app => {
        appStateStore.initAppTabs(app.id, app.url, app.name);
        // Track app in lifetime manager
        tabLifetimeManager.markActive(app.id);
    });

    // Initialize lifetime manager
    tabLifetimeManager.init();
    
    // Set callback for when app should be unloaded
    tabLifetimeManager.onUnload((appId) => {
        // Find the app
        const app = appsMap.get(appId);
        if (!app) {
            tabLifetimeManager.removeService(appId);
            return;
        }
        
        // Only unload if not active
        if (activeAppId !== appId) {
            // Mark app as unloaded
            const index = apps.findIndex(s => s.id === appId);
            if (index !== -1) {
                apps = [
                    ...apps.slice(0, index),
                    { ...apps[index], isUnloaded: true },
                    ...apps.slice(index + 1)
                ];
            }
        }
    });

    // Save to localStorage effect and sync appsMap
    $effect.root(() => {
        $effect(() => {
            localStorage.setItem('rambox_services', JSON.stringify(apps));
            // Keep appsMap in sync with apps array
            appsMap = new Map(apps.map(s => [s.id, s]));
        });
    });

    return {
        get apps() { return apps },
        get appsMap() { return appsMap },
        get activeAppId() { return activeAppId },
        get isSideBarCollapsed() { return isSideBarCollapsed },
        get isAddModalOpen() { return isAddModalOpen },

        // Get apps for current workspace only
        get workspaceApps() {
            const currentWorkspaceId = workspaceStore.activeWorkspaceId;
            return apps.filter(s => s.workspaceId === currentWorkspaceId);
        },

        setActive: (id) => { 
            activeAppId = id;
            // Mark app as active in lifetime manager
            tabLifetimeManager.markActive(id);
            
            // If app was unloaded, mark it as loaded again
            const app = appsMap.get(id);
            if (app?.isUnloaded) {
                const index = apps.findIndex(s => s.id === id);
                if (index !== -1) {
                    apps = [
                        ...apps.slice(0, index),
                        { ...apps[index], isUnloaded: false, isLoading: true },
                        ...apps.slice(index + 1)
                    ];
                }
            }
        },

        toggleSidebar: () => { isSideBarCollapsed = !isSideBarCollapsed },
        setAddModalOpen: (val) => { isAddModalOpen = val },

        addApp: (template, customUrl = null, customName = null, groupName = null, workspaceId = null) => {
            const id = uuidv4();
            const app = {
                id,
                name: customName || template.name,
                url: customUrl || template.url,
                icon: template.icon,
                color: template.color || '#333',
                groupName: groupName || customName || template.name,
                partition: workspaceId ? `persist:workspace-${workspaceId}` : `persist:service-${id}`,
                workspaceId: workspaceId,
                isMuted: false,
                userAgent: '',
                zoom: 1.0,
                unreadCount: 0,
                isLoading: true,
                isUnloaded: false
            };

            apps = [...apps, app];
            activeAppId = id;

            appStateStore.initAppTabs(id, app.url, app.name);
            tabLifetimeManager.markActive(id);

            return app;
        },

        removeApp: (id) => {
            apps = apps.filter(s => s.id !== id);

            // Remove tabs for this app
            appStateStore.removeAppTabs(id);
            
            // Remove app from lifetime manager
            tabLifetimeManager.removeService(id);

            if (activeAppId === id && apps.length > 0) {
                activeAppId = apps[0].id;
            } else if (apps.length === 0) {
                activeAppId = null;
            }
        },

        updateApp: (id, updates) => {
            const index = apps.findIndex(s => s.id === id);
            if (index !== -1) {
                apps = [
                    ...apps.slice(0, index),
                    { ...apps[index], ...updates },
                    ...apps.slice(index + 1)
                ];
            }
        },

        reorderApps: (newOrder) => {
            // Only update if the order actually changed
            const currentIds = apps.map(s => s.id);
            const newIds = newOrder.map(s => s.id);
            
            // Check if order is actually different
            const orderChanged = !currentIds.every((id, index) => id === newIds[index]);
            
            if (orderChanged) {
                // Use the exact same app objects, just reordered
                apps = newOrder;
            }
        },

        // Clear all apps (used on logout for multi-user safety)
        clearAll() {
            apps = [];
            appsMap = new Map();
            activeAppId = null;
            localStorage.removeItem('rambox_services');
        }
    };
}

export const appStore = createAppStore();

