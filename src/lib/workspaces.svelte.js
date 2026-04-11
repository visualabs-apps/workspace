// Workspace Store - manages multiple workspaces
// Pure backend integration - NO localStorage fallback
// All workspaces use initials from workspace names

import { v4 as uuidv4 } from 'uuid';
import { workspaceService } from './workspaceService.js';
import { authStore } from './auth.svelte.js';

// Workspace color presets
export const workspaceColors = [
    '#9d8c6b', '#4A90E2', '#E24A4A', '#4AE290',
    '#E2904A', '#904AE2', '#E2E24A', '#4AE2E2'
];

// Generate initials from workspace name
function getWorkspaceInitials(name) {
    if (!name) return "W";
    return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase();
}

function createWorkspaceStore() {

    // State - NO localStorage, pure backend
    let workspaces = $state([]);
    let activeWorkspaceId = $state(null);
    let isLoading = $state(false);
    let isInitialized = $state(false);

    return {
        get workspaces() { 
            console.log(`📊 Getting workspaces, count: ${workspaces.length}`);
            return workspaces; 
        },
        get activeWorkspaceId() { return activeWorkspaceId; },
        get isLoading() { return isLoading; },
        get isInitialized() { return isInitialized; },

        // Get active workspace object
        get activeWorkspace() {
            if (workspaces.length === 0) return null;
            return workspaces.find(w => w.id === activeWorkspaceId) || workspaces[0];
        },

        // Initialize workspaces from backend ONLY
        async init() {
            if (isInitialized) return;
            
            console.log('🔄 Initializing workspace store from backend...');
            console.log('🔐 Auth status:', authStore.isLoggedIn);
            isLoading = true;

            try {
                if (!authStore.isLoggedIn) {
                    console.log('🔒 User not logged in, starting with empty workspace list');
                    workspaces = [];
                    activeWorkspaceId = null;
                    isInitialized = true;
                    return;
                }

                // Load workspaces from backend
                console.log('🌐 Loading workspaces from backend...');
                const backendWorkspaces = await workspaceService.initialize();
                console.log('📥 Backend workspaces received:', backendWorkspaces);
                
                if (backendWorkspaces && backendWorkspaces.length > 0) {
                    // Convert backend workspaces to frontend format
                    workspaces = backendWorkspaces.map(ws => {
                        const converted = workspaceService.convertBackendWorkspace(ws);
                        converted.source = 'backend';
                        return converted;
                    });
                    
                    console.log('🔄 Converted workspaces:', workspaces);
                    
                    // Set active workspace to the most recently accessed one
                    const mostRecent = workspaces.reduce((latest, current) => {
                        if (!latest.lastAccessed) return current;
                        if (!current.lastAccessed) return latest;
                        return new Date(current.lastAccessed) > new Date(latest.lastAccessed) ? current : latest;
                    });
                    
                    activeWorkspaceId = mostRecent.id;
                    console.log(`✅ Loaded ${workspaces.length} workspaces from backend`);
                } else {
                    // No workspaces in backend, leave empty
                    console.log('📝 No workspaces in backend, starting with empty workspace list');
                    workspaces = [];
                    activeWorkspaceId = null;
                }

                isInitialized = true;
            } catch (error) {
                console.error('❌ Failed to initialize workspace store:', error);
                
                // Fallback: start with empty workspace list
                console.log('🆘 Starting with empty workspace list due to error');
                workspaces = [];
                activeWorkspaceId = null;
                isInitialized = true;
            } finally {
                isLoading = false;
            }
        },

        // Refresh workspaces from backend
        async refresh() {
            if (!authStore.isLoggedIn) return;
            
            isLoading = true;
            try {
                const backendWorkspaces = await workspaceService.getWorkspaces();
                workspaces = backendWorkspaces.map(ws => 
                    workspaceService.convertBackendWorkspace(ws)
                );
                console.log(`🔄 Refreshed ${workspaces.length} workspaces from backend`);
            } catch (error) {
                console.error('❌ Failed to refresh workspaces:', error);
            } finally {
                isLoading = false;
            }
        },

        // Set active workspace (switch workspace)
        async setActiveWorkspace(id) {
            const workspace = workspaces.find(w => w.id === id);
            if (workspace) {
                activeWorkspaceId = id;
                console.log(`🔄 Switched to workspace: ${workspace.name}`);
                
                // Update access time in backend
                if (authStore.isLoggedIn) {
                    await workspaceService.updateWorkspaceAccess(id);
                }
            }
        },

        // Add new workspace
        async addWorkspace(name, icon = null, color = '#4A90E2') {
            // Always use initials from workspace name
            const workspaceInitials = getWorkspaceInitials(name);
            
            const newWorkspace = {
                id: uuidv4(),
                name,
                icon: workspaceInitials,
                color,
                apps: [],
                createdAt: Date.now()
            };
            
            try {
                // Store to backend first
                if (authStore.isLoggedIn) {
                    await workspaceService.storeWorkspace(newWorkspace);
                }
                
                // Add to local state
                workspaces = [...workspaces, newWorkspace];
                activeWorkspaceId = newWorkspace.id;
                
                console.log(`✅ Created workspace: ${name}`);
                return newWorkspace;
            } catch (error) {
                console.error('❌ Failed to create workspace:', error);
                throw error;
            }
        },

        // Alias for backward compatibility
        async createWorkspace(name, icon = null, color = '#4A90E2') {
            return await this.addWorkspace(name, icon, color);
        },

        // Update workspace
        async updateWorkspace(id, updates) {
            const index = workspaces.findIndex(w => w.id === id);
            if (index !== -1) {
                const updatedWorkspace = { ...workspaces[index], ...updates };
                
                try {
                    // Update in backend first
                    if (authStore.isLoggedIn) {
                        await workspaceService.storeWorkspace(updatedWorkspace);
                    }
                    
                    // Update local state
                    workspaces = [
                        ...workspaces.slice(0, index),
                        updatedWorkspace,
                        ...workspaces.slice(index + 1)
                    ];
                    
                    console.log(`✅ Updated workspace: ${updatedWorkspace.name}`);
                } catch (error) {
                    console.error('❌ Failed to update workspace:', error);
                    throw error;
                }
            }
        },

        // Add app/service to workspace
        async addAppToWorkspace(workspaceId, serviceId) {
            const workspace = workspaces.find(w => w.id === workspaceId);
            if (workspace && !workspace.apps.includes(serviceId)) {
                await this.updateWorkspace(workspaceId, {
                    apps: [...(workspace.apps || []), serviceId]
                });
            }
        },

        // Remove app/service from workspace
        async removeAppFromWorkspace(workspaceId, serviceId) {
            const workspace = workspaces.find(w => w.id === workspaceId);
            if (workspace) {
                await this.updateWorkspace(workspaceId, {
                    apps: (workspace.apps || []).filter(id => id !== serviceId)
                });
            }
        },

        // Remove workspace
        async removeWorkspace(id) {
            console.log(`🗑️ Attempting to delete workspace: ${id}`);
            
            // Find workspace to delete
            const workspaceToDelete = workspaces.find(w => w.id === id);
            if (!workspaceToDelete) {
                console.warn(`❌ Workspace not found: ${id}`);
                return false;
            }

            try {
                console.log(`🗑️ Deleting workspace: "${workspaceToDelete.name}"`);
                
                // Delete from backend first (if user is logged in)
                if (authStore.isLoggedIn) {
                    console.log(`🌐 Deleting workspace from backend...`);
                    await workspaceService.deleteWorkspace(id);
                    console.log(`✅ Workspace deleted from backend`);
                }
                
                // Remove from local state
                const oldLength = workspaces.length;
                workspaces = workspaces.filter(w => w.id !== id);
                
                // Verify deletion
                if (workspaces.length === oldLength) {
                    console.error('❌ Workspace was not removed from array');
                    return false;
                }

                // If removed active workspace, switch to first remaining one (if any)
                if (activeWorkspaceId === id) {
                    if (workspaces.length > 0) {
                        activeWorkspaceId = workspaces[0].id;
                        console.log(`🔄 Switched to workspace: "${workspaces[0].name}"`);
                    } else {
                        activeWorkspaceId = null;
                        console.log(`� No workspaces remaining, activeWorkspaceId set to null`);
                    }
                }

                console.log(`✅ Successfully removed workspace: "${workspaceToDelete.name}"`);
                console.log(`📊 Remaining workspaces: ${workspaces.length}`);
                return true;
            } catch (error) {
                console.error('❌ Failed to remove workspace:', error);
                return false;
            }
        },

        // Alias for backward compatibility with Sidebar.svelte
        async deleteWorkspace(id) {
            return await this.removeWorkspace(id);
        },

        // Reorder workspaces
        reorderWorkspaces(newOrder) {
            workspaces = newOrder;
            // Note: Backend doesn't support ordering yet
        }
    };
}

export const workspaceStore = createWorkspaceStore();
