// Workspace Store - manages multiple workspaces
// Each workspace has its own services and partition

import { v4 as uuidv4 } from 'uuid';

// Workspace color presets
export const workspaceColors = [
    '#9d8c6b', '#4A90E2', '#E24A4A', '#4AE290',
    '#E2904A', '#904AE2', '#E2E24A', '#4AE2E2'
];

// Workspace icon presets
export const workspaceIcons = [
    '🏠', '💼', '🎮', '📚', '🎨', '🔬', '🏋️', '🎵'
];

function createWorkspaceStore() {
    // Load from localStorage
    let storedWorkspaces = [];
    let storedActiveId = null;
    
    try {
        const item = localStorage.getItem('vleb_workspaces');
        if (item) {
            const data = JSON.parse(item);
            storedWorkspaces = data.workspaces || [];
            storedActiveId = data.activeWorkspaceId;
        }
    } catch (e) {
        console.error('Failed to load workspaces', e);
    }

    // If no workspaces, create default one
    if (storedWorkspaces.length === 0) {
        const defaultWorkspace = {
            id: uuidv4(),
            name: 'Default Workspace',
            icon: '🏠',
            color: '#4A90E2',
            apps: [], // Array of service IDs in this workspace
            createdAt: Date.now()
        };
        storedWorkspaces = [defaultWorkspace];
        storedActiveId = defaultWorkspace.id;
    }

    // State
    let workspaces = $state(storedWorkspaces);
    let activeWorkspaceId = $state(storedActiveId);

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
        
        // Get active workspace object
        get activeWorkspace() {
            return workspaces.find(w => w.id === activeWorkspaceId) || workspaces[0];
        },

        // Set active workspace (switch workspace)
        setActiveWorkspace(id) {
            const workspace = workspaces.find(w => w.id === id);
            if (workspace) {
                activeWorkspaceId = id;
                console.log(`🔄 Switched to workspace: ${workspace.name}`);
            }
        },

        // Add new workspace
        addWorkspace(name, icon = '📁', color = '#4A90E2') {
            const newWorkspace = {
                id: uuidv4(),
                name,
                icon,
                color,
                apps: [], // Empty apps array
                createdAt: Date.now()
            };
            workspaces = [...workspaces, newWorkspace];
            activeWorkspaceId = newWorkspace.id;
            return newWorkspace;
        },

        // Alias for backward compatibility
        createWorkspace(name, icon = '📁', color = '#4A90E2') {
            return this.addWorkspace(name, icon, color);
        },

        // Add app/service to workspace
        addAppToWorkspace(workspaceId, serviceId) {
            const workspace = workspaces.find(w => w.id === workspaceId);
            if (workspace && !workspace.apps.includes(serviceId)) {
                this.updateWorkspace(workspaceId, {
                    apps: [...(workspace.apps || []), serviceId]
                });
            }
        },

        // Remove app/service from workspace
        removeAppFromWorkspace(workspaceId, serviceId) {
            const workspace = workspaces.find(w => w.id === workspaceId);
            if (workspace) {
                this.updateWorkspace(workspaceId, {
                    apps: (workspace.apps || []).filter(id => id !== serviceId)
                });
            }
        },

        // Remove workspace
        removeWorkspace(id) {
            // Don't allow removing last workspace
            if (workspaces.length === 1) {
                console.warn('Cannot remove last workspace');
                return false;
            }

            workspaces = workspaces.filter(w => w.id !== id);

            // If removed active workspace, switch to first one
            if (activeWorkspaceId === id) {
                activeWorkspaceId = workspaces[0].id;
            }

            return true;
        },

        // Update workspace
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

        // Reorder workspaces
        reorderWorkspaces(newOrder) {
            workspaces = newOrder;
        }
    };
}

export const workspaceStore = createWorkspaceStore();
