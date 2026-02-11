
// This will be a Svelte 5 Runes store
// We'll manage the services array and the active service ID here.

import { v4 as uuidv4 } from 'uuid';

export const predefinedServices = [
    { name: 'WhatsApp', url: 'https://web.whatsapp.com', icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/WhatsApp.svg/1024px-WhatsApp.svg.png', color: '#25D366' },
    { name: 'Telegram', url: 'https://web.telegram.org/k/', icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Telegram_logo.svg/1024px-Telegram_logo.svg.png', color: '#0088cc' },
    { name: 'Discord', url: 'https://discord.com/app', icon: 'https://assets-global.website-files.com/6257adef93867e56f84d3092/636e0a6a49cf127bf92de1e2_icon_clyde_blurple_RGB.png', color: '#5865F2' },
    { name: 'Slack', url: 'https://app.slack.com/client', icon: 'https://cdn-icons-png.flaticon.com/512/2111/2111615.png', color: '#4A154B' },
    { name: 'Gmail', url: 'https://mail.google.com', icon: 'https://upload.wikimedia.org/wikipedia/commons/7/7e/Gmail_icon_%282020%29.svg', color: '#EA4335' },
    { name: 'Notion', url: 'https://www.notion.so', icon: 'https://upload.wikimedia.org/wikipedia/commons/4/45/Notion_app_logo.png', color: '#000000' },
    { name: 'ChatGPT', url: 'https://chat.openai.com', icon: 'https://upload.wikimedia.org/wikipedia/commons/0/04/ChatGPT_logo.svg', color: '#10A37F' },
    { name: 'Custom', url: 'https://google.com', icon: 'https://cdn-icons-png.flaticon.com/512/1006/1006771.png', color: '#666666' }
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
    let activeServiceId = $state(storedServices.length > 0 ? storedServices[0].id : null);
    let isSideBarCollapsed = $state(false);
    let isAddModalOpen = $state(false);

    // Save to localStorage effect (simple approach for now)
    $effect.root(() => {
        $effect(() => {
            localStorage.setItem('rambox_services', JSON.stringify(services));
        });
    });

    return {
        get services() { return services },
        get activeServiceId() { return activeServiceId },
        get isSideBarCollapsed() { return isSideBarCollapsed },
        get isAddModalOpen() { return isAddModalOpen },

        setActive: (id) => { activeServiceId = id },

        toggleSidebar: () => { isSideBarCollapsed = !isSideBarCollapsed },
        setAddModalOpen: (val) => { isAddModalOpen = val },

        addService: (template, customUrl = null, customName = null) => {
            const id = uuidv4();
            const service = {
                id,
                name: customName || template.name,
                url: customUrl || template.url,
                icon: template.icon,
                color: template.color || '#333',
                partition: `persist:service-${id}`, // Isolated session!
                isMuted: false,
                userAgent: '', // Default
                zoom: 1.0,
                unreadCount: 0,
                isLoading: true // initially loading
            };
            services = [...services, service];
            activeServiceId = id;
            return service;
        },

        removeService: (id) => {
            services = services.filter(s => s.id !== id);
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
            // newOrder is array of service objects
            services = newOrder;
        }
    };
}

export const serviceStore = createServiceStore();
