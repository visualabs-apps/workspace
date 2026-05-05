
// This will be a Svelte 5 Runes store
// We'll manage the services array and the active service ID here.

import { v4 as uuidv4 } from 'uuid';
import { tabStore } from './tabs.svelte.js';
import { workspaceStore } from './workspaces.svelte.js';
import { tabLifetimeManager } from '../managers/tabLifetime.svelte.js';

export const predefinedServices = [
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



function createServiceStore() {
    // Initial state from localStorage if available
    let storedServices = [];
    try {
        const item = localStorage.getItem('rambox_services');
        if (item) storedServices = JSON.parse(item);
    } catch (e) {
        console.error('Failed to load services', e);
    }

    // Core state using runes
    let services = $state(storedServices);
    let servicesMap = $state(new Map(storedServices.map(s => [s.id, s])));
    let activeServiceId = $state(storedServices.length > 0 ? storedServices[0].id : null);
    let isSideBarCollapsed = $state(false);
    let isAddModalOpen = $state(false);

    // Migrate: ensure every service with a workspaceId has the correct partition
    // This fixes any data saved with an old/wrong partition value
    let needsMigration = false;
    storedServices = storedServices.map(service => {
        if (service.workspaceId) {
            const correctPartition = `persist:workspace-${service.workspaceId}`;
            if (service.partition !== correctPartition) {
                needsMigration = true;
                return { ...service, partition: correctPartition };
            }
        }
        return service;
    });
    if (needsMigration) {
        try {
            localStorage.setItem('rambox_services', JSON.stringify(storedServices));
        } catch (e) { }
    }

    // Initialize tabs for existing services
    storedServices.forEach(service => {
        tabStore.initServiceTabs(service.id, service.url, service.name);
        // Track service in lifetime manager
        tabLifetimeManager.markActive(service.id);
    });

    // Initialize lifetime manager
    tabLifetimeManager.init();
    
    // Set callback for when service should be unloaded
    tabLifetimeManager.onUnload((serviceId) => {
        // Find the service
        const service = servicesMap.get(serviceId);
        if (!service) {
            tabLifetimeManager.removeService(serviceId);
            return;
        }
        
        // Only unload if not active
        if (activeServiceId !== serviceId) {
            // Mark service as unloaded
            const index = services.findIndex(s => s.id === serviceId);
            if (index !== -1) {
                services = [
                    ...services.slice(0, index),
                    { ...services[index], isUnloaded: true },
                    ...services.slice(index + 1)
                ];
            }
        }
    });

    // Save to localStorage effect and sync servicesMap
    $effect.root(() => {
        $effect(() => {
            localStorage.setItem('rambox_services', JSON.stringify(services));
            // Keep servicesMap in sync with services array
            servicesMap = new Map(services.map(s => [s.id, s]));
        });
    });

    return {
        get services() { return services },
        get servicesMap() { return servicesMap },
        get activeServiceId() { return activeServiceId },
        get isSideBarCollapsed() { return isSideBarCollapsed },
        get isAddModalOpen() { return isAddModalOpen },

        // Get services for current workspace only
        get workspaceServices() {
            const currentWorkspaceId = workspaceStore.activeWorkspaceId;
            return services.filter(s => s.workspaceId === currentWorkspaceId);
        },

        setActive: (id) => { 
            activeServiceId = id;
            // Mark service as active in lifetime manager
            tabLifetimeManager.markActive(id);
            
            // If service was unloaded, mark it as loaded again
            const service = servicesMap.get(id);
            if (service?.isUnloaded) {
                const index = services.findIndex(s => s.id === id);
                if (index !== -1) {
                    services = [
                        ...services.slice(0, index),
                        { ...services[index], isUnloaded: false, isLoading: true },
                        ...services.slice(index + 1)
                    ];
                }
            }
        },

        toggleSidebar: () => { isSideBarCollapsed = !isSideBarCollapsed },
        setAddModalOpen: (val) => { isAddModalOpen = val },

        addService: (template, customUrl = null, customName = null, groupName = null, workspaceId = null) => {
            const id = uuidv4();
            const service = {
                id,
                name: customName || template.name,
                url: customUrl || template.url,
                icon: template.icon,
                color: template.color || '#333',
                groupName: groupName || customName || template.name, // Group name for display
                partition: workspaceId ? `persist:workspace-${workspaceId}` : `persist:service-${id}`, // Workspace-level partition!
                workspaceId: workspaceId, // Track which workspace this belongs to
                isMuted: false,
                userAgent: '', // Default
                zoom: 1.0,
                unreadCount: 0,
                isLoading: true, // initially loading
                isUnloaded: false // not unloaded initially
            };
            services = [...services, service];
            activeServiceId = id;

            // Initialize tabs for this service
            tabStore.initServiceTabs(id, service.url, service.name);
            
            // Mark service as active in lifetime manager
            tabLifetimeManager.markActive(id);

            return service;
        },

        removeService: (id) => {
            services = services.filter(s => s.id !== id);

            // Remove tabs for this service
            tabStore.removeServiceTabs(id);
            
            // Remove service from lifetime manager
            tabLifetimeManager.removeService(id);

            if (activeServiceId === id && services.length > 0) {
                activeServiceId = services[0].id;
            } else if (services.length === 0) {
                activeServiceId = null;
            }
        },

        updateService: (id, updates) => {
            const index = services.findIndex(s => s.id === id);
            if (index !== -1) {
                services = [
                    ...services.slice(0, index),
                    { ...services[index], ...updates },
                    ...services.slice(index + 1)
                ];
            }
        },

        reorderServices: (newOrder) => {
            // Only update if the order actually changed
            const currentIds = services.map(s => s.id);
            const newIds = newOrder.map(s => s.id);
            
            // Check if order is actually different
            const orderChanged = !currentIds.every((id, index) => id === newIds[index]);
            
            if (orderChanged) {
                // Use the exact same service objects, just reordered
                services = newOrder;
            }
        }
    };
}

export const serviceStore = createServiceStore();

