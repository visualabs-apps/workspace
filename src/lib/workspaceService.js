/**
 * Workspace Service - Integration with Backend API
 * Handles workspace and notes synchronization with Laravel backend
 */

import { authStore } from './auth.svelte.js';
import api from './api.js';

class WorkspaceService {
    constructor() {
        this.initialized = false;
    }

    /**
     * Initialize workspace service - load workspaces from backend
     */
    async initialize() {
        if (!authStore.isLoggedIn) {
            console.log('🔒 User not logged in, skipping workspace sync');
            return [];
        }

        try {
            console.log('🔄 Loading workspaces from backend...');
            const workspaces = await this.getWorkspaces();
            
            if (workspaces && workspaces.length > 0) {
                console.log(`✅ Loaded ${workspaces.length} workspaces from backend`);
                return workspaces;
            } else {
                console.log('📝 No workspaces found in backend');
                return [];
            }
        } catch (error) {
            console.error('❌ Failed to initialize workspace service:', error);
            return [];
        }
    }

    /**
     * Get user's workspaces from backend
     */
    async getWorkspaces() {
        try {
            const response = await api.get('/workspace/list');
            
            if (response.data.success) {
                return response.data.data;
            } else {
                throw new Error(response.data.message || 'Failed to get workspaces');
            }
        } catch (error) {
            console.error('❌ Failed to get workspaces:', error);
            throw error;
        }
    }

    /**
     * Store/update workspace in backend
     */
    async storeWorkspace(workspace) {
        try {
            const payload = {
                workspace_id: workspace.id,
                name: workspace.name,
                description: workspace.description || '',
                settings: {
                    icon: workspace.icon,
                    color: workspace.color,
                    apps: workspace.apps || [],
                    createdAt: workspace.createdAt
                }
            };

            const response = await api.post('/workspace/store', payload);
            
            if (response.data.success) {
                console.log(`✅ Workspace "${workspace.name}" synced to backend`);
                return response.data;
            } else {
                throw new Error(response.data.message || 'Failed to store workspace');
            }
        } catch (error) {
            console.error('❌ Failed to store workspace:', error);
            throw error;
        }
    }

    /**
     * Update workspace access time
     */
    async updateWorkspaceAccess(workspaceId) {
        try {
            const response = await api.post('/workspace/access', {
                workspace_id: workspaceId
            });
            
            if (response.data.success) {
                console.log(`✅ Workspace access updated for: ${workspaceId}`);
                return response.data;
            } else {
                throw new Error(response.data.message || 'Failed to update workspace access');
            }
        } catch (error) {
            console.error('❌ Failed to update workspace access:', error);
            // Don't throw error for access updates - it's not critical
        }
    }

    /**
     * Delete workspace from backend
     */
    async deleteWorkspace(workspaceId) {
        console.log(`🌐 Calling backend API to delete workspace: ${workspaceId}`);
        
        try {
            const response = await api.post('/workspace/delete', {
                workspace_id: workspaceId
            });
            
            console.log(`📡 Backend delete response:`, response.data);
            
            if (response.data.success) {
                console.log(`✅ Workspace deleted from backend: ${workspaceId}`);
                return response.data;
            } else {
                throw new Error(response.data.message || 'Failed to delete workspace');
            }
        } catch (error) {
            console.error('❌ Failed to delete workspace from backend:', error);
            console.error('❌ Error details:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status
            });
            throw error;
        }
    }

    /**
     * Get notes for a workspace
     */
    async getNotes(workspaceId) {
        try {
            const response = await api.get(`/notes/list?workspace_id=${workspaceId}`);
            
            if (response.data.success) {
                return response.data.data;
            } else {
                throw new Error(response.data.message || 'Failed to get notes');
            }
        } catch (error) {
            console.error('❌ Failed to get notes:', error);
            throw error;
        }
    }

    /**
     * Store/update note in backend
     */
    async storeNote(note) {
        try {
            const payload = {
                workspace_id: note.workspaceId,
                note_id: note.id,
                title: note.title,
                content: note.content || '',
                type: note.type || 'text',
                metadata: note.metadata || {}
            };

            console.log(`📤 Sending note payload to backend:`, payload);

            const response = await api.post('/notes/store', payload);
            
            if (response.data.success) {
                console.log(`✅ Note "${note.title}" synced to backend`);
                return response.data;
            } else {
                throw new Error(response.data.message || 'Failed to store note');
            }
        } catch (error) {
            console.error('❌ Failed to store note:', error);
            console.error('❌ Error details:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status
            });
            throw error;
        }
    }

    /**
     * Delete note from backend
     */
    async deleteNote(noteId) {
        try {
            const response = await api.post('/notes/delete', {
                note_id: noteId
            });
            
            if (response.data.success) {
                console.log(`✅ Note deleted from backend: ${noteId}`);
                return response.data;
            } else {
                throw new Error(response.data.message || 'Failed to delete note');
            }
        } catch (error) {
            console.error('❌ Failed to delete note:', error);
            throw error;
        }
    }

    /**
     * Convert backend workspace to frontend format
     */
    convertBackendWorkspace(backendWorkspace) {
        const settings = backendWorkspace.settings || {};
        
        // Generate initials from workspace name
        const getWorkspaceInitials = (name) => {
            if (!name) return "W";
            return name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .substring(0, 2)
                .toUpperCase();
        };
        
        return {
            id: backendWorkspace.workspace_id,
            name: backendWorkspace.name,
            description: backendWorkspace.description,
            icon: settings.icon || getWorkspaceInitials(backendWorkspace.name),
            color: settings.color || '#4A90E2',
            apps: settings.apps || [],
            createdAt: settings.createdAt || Date.now(),
            lastAccessed: backendWorkspace.last_accessed_at,
            syncedAt: Date.now()
        };
    }

    /**
     * Convert backend note to frontend format
     */
    convertBackendNote(backendNote) {
        return {
            id: backendNote.note_id,
            workspaceId: backendNote.workspace_id,
            title: backendNote.title,
            content: backendNote.content,
            type: backendNote.type,
            metadata: backendNote.metadata || {},
            createdAt: new Date(backendNote.created_at).getTime(),
            lastModified: new Date(backendNote.last_modified_at).getTime(),
            syncedAt: Date.now()
        };
    }
}

export const workspaceService = new WorkspaceService();