// Workspace Store - manages multiple workspaces
// Each workspace contains a collection of apps

import { v4 as uuidv4 } from 'uuid';

// Predefined workspace colors
export const workspaceColors = [
    { name: 'Purple', value: 'from-purple-500 to-indigo-600', bg: 'bg-purple-500' },
    { name: 'Blue', value: 'from-blue-500 to-cyan-600', bg: 'bg-blue-500' },
    { name: 'Green', value: 'from-green-500 to-emerald-600', bg: 'bg-green-500' },
    { name: 'Orange', value: 'from-orange-500 to-red-600', bg: 'bg-orange-500' },
    { name: 'Pink', value: 'from-pink-500 to-rose-600', bg: 'bg-pink-500' },
    { name: 'Teal', value: 'from-teal-500 to-cyan-600', bg: 'bg-teal-500' },
];

// Predefined workspace icons
export const workspaceIcons = ['💼', '🏠', '🎮', '📚', '🎨', '💻', '🛒', '✈️', '🎵', '📱'];

function createWorkspaceStore() {
    // Load from localStorage
    let storedData = { workspaces: [], activeWorkspaceId: null };
    try {
        const item = localStorage.getItem('vleb_workspaces');
        if (item) {
            storedData = JSON.parse(item);
        }
    } catch (e) {
        console.error('Failed to load workspaces', e);
    }

    // Create default workspace if none exist
    if (storedData.workspaces.length === 0) {
        const defaultWorkspace = {
            id: uuidv4(),
            name: 'Personal',
            icon: '🏠',
            color: workspaceColors[0],
            apps: [], // App IDs that belong to this workspace
            createdAt: Date.now()
        };
        storedData.workspaces = [defaultWorkspace];
        storedData.activeWorkspaceId = defaultWorkspace.id;
    }

    // State
    let workspaces = $state(storedData.workspaces);
    let activeWorkspaceId = $state(storedData.activeWorkspaceId || storedData.workspaces[0]?.id);
    let isWorkspaceSelectorOpen = $state(false);

    // Auto-save to localStorage
    $effect.root(() => {
        $effect(() => {
            localStorage.setItem('vleb_workspaces', JSON.stringify({
                workspaces,
                activeWorkspaceId
            }));
        });
    });

    return {
        get workspaces() { return workspaces; },
        get activeWorkspaceId() { return activeWorkspaceId; },
        get activeWorkspace() { 
            return workspaces.find(w => w.id === activeWorkspaceId) || workspaces[0]; 
        },
        get isWorkspaceSelectorOpen() { return isWorkspaceSelectorOpen; },

        setActiveWorkspace(id) {
            activeWorkspaceId = id;
        },

        toggleWorkspaceSelector() {
            isWorkspaceSelectorOpen = !isWorkspaceSelectorOpen;
        },

        closeWorkspaceSelector() {
            isWorkspaceSelectorOpen = false;
        },

        createWorkspace(name, icon = '💼', color = workspaceColors[0]) {
            const workspace = {
                id: uuidv4(),
                name,
                icon,
                color,
                apps: [],
                createdAt: Date.now()
            };
            workspaces = [...workspaces, workspace];
            activeWorkspaceId = workspace.id;
            return workspace;
        },

        updateWorkspace(id, updates) {
            const index = workspaces.findIndex(w => w.id === id);
            if (index !== -1) {
                workspaces = [
                    ...workspaces.slice(0, index),
                    { ...workspaces[index], ...updates },
                    ...workspaces.slice(index + 1)
                ];
            }
        },

        deleteWorkspace(id) {
            if (workspaces.length <= 1) {
                console.warn('Cannot delete the last workspace');
                return false;
            }
            workspaces = workspaces.filter(w => w.id !== id);
            if (activeWorkspaceId === id) {
                activeWorkspaceId = workspaces[0].id;
            }
            return true;
        },

        // Add an app to a workspace
        addAppToWorkspace(workspaceId, appId) {
            const index = workspaces.findIndex(w => w.id === workspaceId);
            if (index !== -1 && !workspaces[index].apps.includes(appId)) {
                workspaces = [
                    ...workspaces.slice(0, index),
                    { ...workspaces[index], apps: [...workspaces[index].apps, appId] },
                    ...workspaces.slice(index + 1)
                ];
            }
        },

        // Remove an app from a workspace
        removeAppFromWorkspace(workspaceId, appId) {
            const index = workspaces.findIndex(w => w.id === workspaceId);
            if (index !== -1) {
                workspaces = [
                    ...workspaces.slice(0, index),
                    { ...workspaces[index], apps: workspaces[index].apps.filter(id => id !== appId) },
                    ...workspaces.slice(index + 1)
                ];
            }
        },

        // Move app to different workspace
        moveAppToWorkspace(appId, fromWorkspaceId, toWorkspaceId) {
            this.removeAppFromWorkspace(fromWorkspaceId, appId);
            this.addAppToWorkspace(toWorkspaceId, appId);
        },

        // Get apps for active workspace
        getActiveWorkspaceApps() {
            const workspace = workspaces.find(w => w.id === activeWorkspaceId);
            return workspace?.apps || [];
        },

        // Check if app belongs to active workspace
        isAppInActiveWorkspace(appId) {
            const workspace = workspaces.find(w => w.id === activeWorkspaceId);
            return workspace?.apps.includes(appId) || false;
        }
    };
}

export const workspaceStore = createWorkspaceStore();
