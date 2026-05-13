// Workspace Store - manages multiple workspaces
// Full backend integration - fetch profiles from API

import { getChromeProfiles, deleteChromeProfile } from '../api/api.js';
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
    if (window.api?.db?.getProfileColor) {
        try {
            const result = await window.api.db.getProfileColor(profile.id);
            if (result.success && result.color) {
                finalColor = result.color;
            }
        } catch (error) {
            console.error('Failed to load profile color:', error);
        }
    }
    
    // Load apps from SQLite
    let apps = [];
    if (window.api?.db?.getSetting) {
        try {
            const result = await window.api.db.getSetting(`workspace_apps_${profile.id}`);
            if (result.success && result.value && Array.isArray(result.value)) {
                apps = result.value;
            }
        } catch (error) {
            console.error('Failed to load workspace apps:', error);
        }
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
            const workspaceList = Array.isArray(workspaces) ? workspaces : [];
            if (workspaceList.length === 0) return null;
            return workspaceList.find(w => w.id === activeWorkspaceId) || workspaceList[0];
        },

        // Initialize workspaces from backend
        async init() {
            if (isInitialized) return Promise.resolve(this);
            
            isLoading = true;

            try {
                // Get user from auth store (use mock if available for testing)
                const user = (globalThis._mockAuthStore || authStore)?.user;
                if (!user?.id) {
                    console.warn('No user logged in, skipping workspace init');
                    workspaces = [];
                    activeWorkspaceId = null;
                    isInitialized = true;
                    isLoading = false;
                    return Promise.resolve(this);
                }

                // Fetch profiles from backend (use mock if available for testing)
                const response = await (globalThis._mockGetChromeProfiles || getChromeProfiles)({ 
                    userId: user.id,
                    limit: 100 
                });

                if (response && response.success) {
                    // Transform profiles with colors from SQLite
                    const profiles = response.data || [];
                    workspaces = await Promise.all(profiles.map(profileToWorkspace));
                    
                    // Set active workspace to the first one
                    if (workspaces.length > 0) {
                        // Try to restore last active from SQLite
                        try {
                            if (window.api?.db?.getSetting) {
                                const result = await window.api.db.getSetting('active_workspace_id');
                                if (result.success && result.value) {
                                    const lastActive = workspaces.find(w => w.id === result.value);
                                    activeWorkspaceId = lastActive ? lastActive.id : workspaces[0]?.id || null;
                                } else {
                                    activeWorkspaceId = workspaces[0]?.id || null;
                                }
                            } else {
                                activeWorkspaceId = workspaces[0]?.id || null;
                            }
                        } catch (error) {
                            console.error('Failed to load active workspace:', error);
                            activeWorkspaceId = workspaces[0]?.id || null;
                        }
                    } else {
                        activeWorkspaceId = null;
                    }
                } else {
                    console.error('Failed to fetch profiles:', response?.error);
                    workspaces = [];
                    activeWorkspaceId = null;
                }

                isInitialized = true;
                return Promise.resolve(this);
            } catch (error) {
                console.error('❌ Failed to initialize workspace store:', error);
                workspaces = [];
                activeWorkspaceId = null;
                isInitialized = true;
                return Promise.resolve(this);
            } finally {
                isLoading = false;
            }
        },

        // Refresh workspaces from backend
        async refresh() {
            isLoading = true;
            try {
                const user = (globalThis._mockAuthStore || authStore)?.user;
                if (!user?.id) {
                    workspaces = [];
                    isLoading = false;
                    return Promise.resolve(this);
                }

                const response = await (globalThis._mockGetChromeProfiles || getChromeProfiles)({ 
                    userId: user.id,
                    limit: 100 
                });

                if (response && response.success) {
                    const currentActiveId = activeWorkspaceId;
                    // Transform profiles with colors from SQLite
                    const profiles = response.data || [];
                    const newWorkspaces = await Promise.all(profiles.map(profileToWorkspace));
                    workspaces = newWorkspaces;
                    
                    // Restore active workspace if it still exists
                    const workspaceList = Array.isArray(workspaces) ? workspaces : [];
                    if (currentActiveId) {
                        const stillExists = workspaceList.find(w => w.id === currentActiveId);
                        if (!stillExists && workspaceList.length > 0) {
                            activeWorkspaceId = workspaceList[0].id;
                        }
                    } else if (workspaceList.length > 0) {
                        activeWorkspaceId = workspaceList[0].id;
                    }
                }
            } catch (error) {
                console.error('❌ Failed to refresh workspaces:', error);
            } finally {
                isLoading = false;
            }
            
            return Promise.resolve(this);
        },

        // Set active workspace (switch workspace)
        async setActiveWorkspace(id) {
            const workspaceList = Array.isArray(workspaces) ? workspaces : [];
            const workspace = workspaceList.find(w => w.id === id);
            if (workspace) {
                activeWorkspaceId = id;
                // Save to SQLite for persistence
                try {
                    if (window.api?.db?.saveSetting) {
                        await window.api.db.saveSetting('active_workspace_id', id);
                    }
                } catch (error) {
                    console.error('Failed to save active workspace:', error);
                }
                return true;
            }
            return false;
        },

        // Add app/service to workspace
        async addAppToWorkspace(workspaceId, serviceId) {
            const workspaceList = Array.isArray(workspaces) ? workspaces : [];
            const workspace = workspaceList.find(w => w.id === workspaceId);
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
                        return true;
                    } catch (error) {
                        console.error('Failed to save workspace apps:', error);
                        return false;
                    }
                }
                return true;
            }
            return false;
        },

        // Remove app/service from workspace
        async removeAppFromWorkspace(workspaceId, serviceId) {
            const workspaceList = Array.isArray(workspaces) ? workspaces : [];
            const workspace = workspaceList.find(w => w.id === workspaceId);
            if (workspace && workspace.apps) {
                workspace.apps = workspace.apps.filter(id => id !== serviceId);
                
                // Save to SQLite - convert to plain array
                try {
                    const plainApps = [...workspace.apps]; // Convert reactive array to plain array
                    await window.api.db.saveSetting(`workspace_apps_${workspaceId}`, plainApps);
                    return true;
                } catch (error) {
                    console.error('Failed to save workspace apps:', error);
                    return false;
                }
            }
            return false;
        },

        // Delete workspace (profile)
        async deleteWorkspace(id) {
            try {
                const response = await (globalThis._mockDeleteChromeProfile || deleteChromeProfile)(id);
                
                if (response && response.success) {
                    // Remove color from SQLite
                    try {
                        if (window.api?.db?.deleteProfileColor) {
                            await window.api.db.deleteProfileColor(id);
                        }
                    } catch (error) {
                        console.error('Failed to delete profile color:', error);
                    }
                    
                    // Remove workspace apps from SQLite
                    try {
                        if (window.api?.db?.deleteSetting) {
                            await window.api.db.deleteSetting(`workspace_apps_${id}`);
                        }
                    } catch (error) {
                        console.error('Failed to delete workspace apps:', error);
                    }
                    
                    // Remove from local state
                    const workspaceList = Array.isArray(workspaces) ? workspaces : [];
                    const currentWorkspaces = workspaceList.filter(w => w.id !== id);
                    workspaces = currentWorkspaces;
                    
                    // If removed active workspace, switch to first remaining one
                    if (activeWorkspaceId === id) {
                        if (workspaces.length > 0) {
                            activeWorkspaceId = workspaces[0].id;
                            try {
                                if (window.api?.db?.saveSetting) {
                                    await window.api.db.saveSetting('active_workspace_id', workspaces[0].id);
                                }
                            } catch (error) {
                                console.error('Failed to save active workspace:', error);
                            }
                        } else {
                            activeWorkspaceId = null;
                        }
                    }
                    
                    return true;
                } else {
                    console.error('Failed to delete profile:', response?.error);
                    return false;
                }
            } catch (error) {
                console.error('❌ Failed to delete workspace:', error);
                return false;
            }
        },

        // Reset store state (for testing)
        reset() {
            workspaces = [];
            activeWorkspaceId = null;
            isLoading = false;
            isInitialized = false;
        },

        // Test helper - inject mocks for testing
        _testInjectMocks(mocks) {
            if (mocks.getChromeProfiles) {
                globalThis._mockGetChromeProfiles = mocks.getChromeProfiles;
            }
            if (mocks.deleteChromeProfile) {
                globalThis._mockDeleteChromeProfile = mocks.deleteChromeProfile;
            }
            if (mocks.authStore) {
                globalThis._mockAuthStore = mocks.authStore;
            }
        },

        // Alias for backward compatibility
        async removeWorkspace(id) {
            return await this.deleteWorkspace(id);
        }
    };

}

export const workspaceStore = createWorkspaceStore();
