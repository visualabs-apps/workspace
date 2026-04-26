// Workspace Store - manages multiple workspaces
// Full backend integration - fetch profiles from API

import { getChromeProfiles, deleteChromeProfile } from './api.js';
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

// Transform backend profile to workspace format
async function profileToWorkspace(profile) {
    // Load color from SQLite
    let finalColor = workspaceColors[0];
    try {
        const result = await window.api.db.getProfileColor(profile.id);
        if (result.success && result.color) {
            finalColor = result.color;
        }
    } catch (error) {
        console.error('Failed to load profile color:', error);
    }
    
    // Load apps from SQLite
    let apps = [];
    try {
        const result = await window.api.db.getSetting(`workspace_apps_${profile.id}`);
        if (result.success && result.value && Array.isArray(result.value)) {
            apps = result.value;
        }
    } catch (error) {
        console.error('Failed to load workspace apps:', error);
    }
    
    return {
        id: profile.id,
        name: profile.name,
        icon: getWorkspaceInitials(profile.name),
        color: finalColor,
        apps: apps,
        customerId: profile.customerId,
        customerName: profile.customer?.profile?.name || profile.customer?.username,
        userId: profile.userId,
        userAgent: profile.userAgent,
        proxy: profile.proxy,
        cookies: profile.cookies,
        fingerprint: profile.fingerprint,
        status: profile.status,
        uuid: profile.uuid,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt
    };
}

function createWorkspaceStore() {

    // State - pure backend
    let workspaces = $state([]);
    let activeWorkspaceId = $state(null);
    let isLoading = $state(false);
    let isInitialized = $state(false);

    return {
        get workspaces() { 
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

        // Initialize workspaces from backend
        async init() {
            if (isInitialized) return;
            
            isLoading = true;

            try {
                // Get user from auth store
                const user = authStore.user;
                if (!user?.id) {
                    console.warn('No user logged in, skipping workspace init');
                    workspaces = [];
                    activeWorkspaceId = null;
                    isInitialized = true;
                    isLoading = false;
                    return;
                }

                // Fetch profiles from backend
                const response = await getChromeProfiles({ 
                    userId: user.id,
                    limit: 100 
                });

                if (response.success) {
                    // Transform profiles with colors from SQLite
                    workspaces = await Promise.all(response.data.map(profileToWorkspace));
                    
                    // Set active workspace to the first one
                    if (workspaces.length > 0) {
                        // Try to restore last active from SQLite
                        try {
                            const result = await window.api.db.getSetting('active_workspace_id');
                            if (result.success && result.value) {
                                const lastActive = workspaces.find(w => w.id === result.value);
                                activeWorkspaceId = lastActive ? lastActive.id : workspaces[0].id;
                            } else {
                                activeWorkspaceId = workspaces[0].id;
                            }
                        } catch (error) {
                            console.error('Failed to load active workspace:', error);
                            activeWorkspaceId = workspaces[0].id;
                        }
                    } else {
                        activeWorkspaceId = null;
                    }
                } else {
                    console.error('Failed to fetch profiles:', response.error);
                    workspaces = [];
                    activeWorkspaceId = null;
                }

                isInitialized = true;
            } catch (error) {
                console.error('❌ Failed to initialize workspace store:', error);
                workspaces = [];
                activeWorkspaceId = null;
                isInitialized = true;
            } finally {
                isLoading = false;
            }
        },

        // Refresh workspaces from backend
        async refresh() {
            isLoading = true;
            try {
                const user = authStore.user;
                if (!user?.id) {
                    workspaces = [];
                    return;
                }

                const response = await getChromeProfiles({ 
                    userId: user.id,
                    limit: 100 
                });

                if (response.success) {
                    const currentActiveId = activeWorkspaceId;
                    // Transform profiles with colors from SQLite
                    workspaces = await Promise.all(response.data.map(profileToWorkspace));
                    
                    // Restore active workspace if it still exists
                    if (currentActiveId) {
                        const stillExists = workspaces.find(w => w.id === currentActiveId);
                        if (!stillExists && workspaces.length > 0) {
                            activeWorkspaceId = workspaces[0].id;
                        }
                    } else if (workspaces.length > 0) {
                        activeWorkspaceId = workspaces[0].id;
                    }
                }
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
                // Save to SQLite for persistence
                try {
                    await window.api.db.saveSetting('active_workspace_id', id);
                } catch (error) {
                    console.error('Failed to save active workspace:', error);
                }
            }
        },

        // Add app/service to workspace
        async addAppToWorkspace(workspaceId, serviceId) {
            const workspace = workspaces.find(w => w.id === workspaceId);
            if (workspace) {
                if (!workspace.apps) {
                    workspace.apps = [];
                }
                if (!workspace.apps.includes(serviceId)) {
                    workspace.apps = [...workspace.apps, serviceId];
                    
                    // Save to SQLite - convert to plain array
                    try {
                        const plainApps = [...workspace.apps]; // Convert reactive array to plain array
                        await window.api.db.saveSetting(`workspace_apps_${workspaceId}`, plainApps);
                    } catch (error) {
                        console.error('Failed to save workspace apps:', error);
                    }
                }
            }
        },

        // Remove app/service from workspace
        async removeAppFromWorkspace(workspaceId, serviceId) {
            const workspace = workspaces.find(w => w.id === workspaceId);
            if (workspace && workspace.apps) {
                workspace.apps = workspace.apps.filter(id => id !== serviceId);
                
                // Save to SQLite - convert to plain array
                try {
                    const plainApps = [...workspace.apps]; // Convert reactive array to plain array
                    await window.api.db.saveSetting(`workspace_apps_${workspaceId}`, plainApps);
                } catch (error) {
                    console.error('Failed to save workspace apps:', error);
                }
            }
        },

        // Delete workspace (profile)
        async deleteWorkspace(id) {
            try {
                const response = await deleteChromeProfile(id);
                
                if (response.success) {
                    // Remove color from SQLite
                    try {
                        await window.api.db.deleteProfileColor(id);
                    } catch (error) {
                        console.error('Failed to delete profile color:', error);
                    }
                    
                    // Remove workspace apps from SQLite
                    try {
                        await window.api.db.deleteSetting(`workspace_apps_${id}`);
                    } catch (error) {
                        console.error('Failed to delete workspace apps:', error);
                    }
                    
                    // Remove from local state
                    workspaces = workspaces.filter(w => w.id !== id);
                    
                    // If removed active workspace, switch to first remaining one
                    if (activeWorkspaceId === id) {
                        if (workspaces.length > 0) {
                            activeWorkspaceId = workspaces[0].id;
                            try {
                                await window.api.db.saveSetting('active_workspace_id', workspaces[0].id);
                            } catch (error) {
                                console.error('Failed to save active workspace:', error);
                            }
                        } else {
                            activeWorkspaceId = null;
                        }
                    }
                    
                    return true;
                } else {
                    console.error('Failed to delete profile:', response.error);
                    return false;
                }
            } catch (error) {
                console.error('❌ Failed to delete workspace:', error);
                return false;
            }
        },

        // Alias for backward compatibility
        async removeWorkspace(id) {
            return await this.deleteWorkspace(id);
        }
    };
}

export const workspaceStore = createWorkspaceStore();
