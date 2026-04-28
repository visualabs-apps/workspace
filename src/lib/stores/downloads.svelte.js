// Download Manager Store
// Manages all downloads across all services using SQLite

import { v4 as uuidv4 } from 'uuid';
import { workspaceStore } from './workspaces.svelte.js';

function createDownloadStore() {
    // State
    let downloads = $state([]);
    let isDownloadPanelOpen = $state(false);
    let isLoaded = $state(false);

    // Load downloads from SQLite on init
    if (typeof window !== 'undefined' && window.api) {
        // Load downloads when workspace changes
        $effect.root(() => {
            $effect(() => {
                const workspace = workspaceStore.activeWorkspace;
                if (workspace && !isLoaded) {
                    loadDownloads(workspace.id);
                }
            });
        });
    }

    // Load downloads from SQLite
    async function loadDownloads(profileId = null) {
        try {
            const result = await window.api.db.getDownloads(profileId);
            if (result.success) {
                downloads = result.downloads.map(d => ({
                    id: d.id,
                    profileId: d.profile_id,
                    filename: d.filename,
                    url: d.url,
                    savePath: d.save_path,
                    totalBytes: d.total_bytes,
                    receivedBytes: d.received_bytes,
                    state: d.state,
                    startTime: d.start_time,
                    endTime: d.end_time,
                    mimeType: d.mime_type,
                    fileExists: d.file_exists === 1,
                    createdAt: d.created_at
                }));
                isLoaded = true;
            }
        } catch (error) {
            console.error('Failed to load downloads:', error);
        }
    }

    // Save download to SQLite
    async function saveDownload(download) {
        try {
            const result = await window.api.db.saveDownload({
                id: download.id,
                gid: download.gid || null,
                profileId: download.profileId || null,
                filename: download.filename,
                url: download.url,
                savePath: download.savePath || '',
                totalBytes: download.totalBytes || 0,
                receivedBytes: download.receivedBytes || 0,
                downloadSpeed: download.downloadSpeed || 0,
                state: download.state,
                startTime: download.startTime,
                endTime: download.endTime || null,
                mimeType: download.mimeType || '',
                fileExists: download.fileExists !== false,
                createdAt: download.createdAt || Date.now()
            });
            return result.success;
        } catch (error) {
            console.error('Failed to save download:', error);
            return false;
        }
    }

    // Initial listener setup
    if (typeof window !== 'undefined' && window.api) {
        window.api.onDownloadStarted((data) => {
            const profileId = workspaceStore.activeWorkspace?.id || null;
            
            const download = {
                id: data.id,
                gid: data.gid,
                profileId: profileId,
                filename: data.filename,
                url: data.url,
                savePath: data.savePath || '',
                totalBytes: data.totalBytes || 0,
                receivedBytes: 0,
                downloadSpeed: 0,
                state: 'progressing',
                startTime: data.startTime || Date.now(),
                endTime: null,
                mimeType: '',
                fileExists: true,
                createdAt: Date.now()
            };
            
            // Add to memory
            downloads = [download, ...downloads];
            
            // Save to SQLite
            saveDownload(download);
            
            // Show toast notification
            const profileName = workspaceStore.activeWorkspace?.name || 'Unknown Profile';
            if (typeof window !== 'undefined' && window.toastStore) {
                window.toastStore.info(`Download started: ${data.filename}`);
            }
        });

        window.api.onDownloadProgress((data) => {
            // Find download by gid
            const download = downloads.find(d => d.gid === data.gid && (d.state === 'progressing' || d.state === 'paused'));
            if (download) {
                const index = downloads.indexOf(download);
                const updated = {
                    ...download,
                    receivedBytes: data.receivedBytes,
                    totalBytes: data.totalBytes,
                    downloadSpeed: data.downloadSpeed || 0,
                    state: data.state
                };
                
                downloads = [
                    ...downloads.slice(0, index),
                    updated,
                    ...downloads.slice(index + 1)
                ];
                
                // Save to SQLite periodically (every 2 seconds to avoid too many writes)
                if (!download._lastSave || Date.now() - download._lastSave > 2000) {
                    updated._lastSave = Date.now();
                    saveDownload(updated);
                }
            }
        });

        window.api.onDownloadPaused((data) => {
            const download = downloads.find(d => d.gid === data.gid && d.state === 'progressing');
            if (download) {
                const index = downloads.indexOf(download);
                const updated = {
                    ...download,
                    state: 'paused'
                };
                
                downloads = [
                    ...downloads.slice(0, index),
                    updated,
                    ...downloads.slice(index + 1)
                ];
                
                // Save to SQLite
                saveDownload(updated);
            }
        });

        window.api.onDownloadCompleted((data) => {
            const download = downloads.find(d => d.gid === data.gid);
            if (download) {
                const index = downloads.indexOf(download);
                const updated = {
                    ...download,
                    state: 'completed',
                    savePath: data.savePath,
                    endTime: Date.now(),
                    receivedBytes: download.totalBytes, // Ensure full bar
                    fileExists: true
                };
                
                downloads = [
                    ...downloads.slice(0, index),
                    updated,
                    ...downloads.slice(index + 1)
                ];
                
                // Save to SQLite
                saveDownload(updated);

                // Get profile name for notification
                const profileName = workspaceStore.activeWorkspace?.name || 'Unknown Profile';
                
                // Show toast notification
                if (typeof window !== 'undefined' && window.toastStore) {
                    window.toastStore.success(`Download completed from profile "${profileName}": ${data.filename}`);
                }
                
                // Notify user with profile info
                if (window.api.showNotification) {
                    window.api.showNotification({
                        title: 'Download Completed',
                        body: `${data.filename} from profile "${profileName}" has finished downloading.`
                    });
                }
            }
        });

        window.api.onDownloadCancelled((data) => {
            const download = downloads.find(d => d.gid === data.gid);
            if (download) {
                const index = downloads.indexOf(download);
                const updated = {
                    ...download,
                    state: 'cancelled',
                    endTime: Date.now()
                };
                
                downloads = [
                    ...downloads.slice(0, index),
                    updated,
                    ...downloads.slice(index + 1)
                ];
                
                // Save to SQLite
                saveDownload(updated);
            }
        });

        window.api.onDownloadFailed((data) => {
            const download = downloads.find(d => d.gid === data.gid);
            if (download) {
                const index = downloads.indexOf(download);
                const updated = {
                    ...download,
                    state: 'failed',
                    endTime: Date.now()
                };
                
                downloads = [
                    ...downloads.slice(0, index),
                    updated,
                    ...downloads.slice(index + 1)
                ];
                
                // Save to SQLite
                saveDownload(updated);
                
                // Show toast notification
                const profileName = workspaceStore.activeWorkspace?.name || 'Unknown Profile';
                if (typeof window !== 'undefined' && window.toastStore) {
                    window.toastStore.error(`Download failed from profile "${profileName}": ${data.filename}`);
                }
            }
        });

        // Listen for download removed event (when replacing existing download)
        window.api.onDownloadRemoved?.((data) => {
            console.log('🗑️ Removing download from UI:', data.id);
            downloads = downloads.filter(d => d.id !== data.id);
        });
    }

    return {
        get downloads() { return downloads; },
        get activeDownloads() {
            return downloads.filter(d => d.state === 'progressing' || d.state === 'paused');
        },
        get completedDownloads() {
            return downloads.filter(d => d.state === 'completed');
        },
        get isDownloadPanelOpen() { return isDownloadPanelOpen; },
        get isLoaded() { return isLoaded; },

        // Load downloads from SQLite
        loadDownloads,

        toggleDownloadPanel() {
            isDownloadPanelOpen = !isDownloadPanelOpen;
        },

        openDownloadPanel() {
            isDownloadPanelOpen = true;
        },

        closeDownloadPanel() {
            isDownloadPanelOpen = false;
        },

        // Update download
        async updateDownload(id, updates) {
            const index = downloads.findIndex(d => d.id === id);
            if (index !== -1) {
                const updated = { ...downloads[index], ...updates };
                downloads = [
                    ...downloads.slice(0, index),
                    updated,
                    ...downloads.slice(index + 1)
                ];
                await saveDownload(updated);
            }
        },

        // Remove download from list
        async removeDownload(id) {
            try {
                const result = await window.api.db.deleteDownload(id);
                if (result.success) {
                    downloads = downloads.filter(d => d.id !== id);
                }
                return result.success;
            } catch (error) {
                console.error('Failed to remove download:', error);
                return false;
            }
        },

        // Clear completed downloads
        async clearCompleted(profileId = null) {
            try {
                const toRemove = downloads.filter(d => 
                    d.state === 'completed' && 
                    (profileId === null || d.profileId === profileId)
                );
                
                for (const download of toRemove) {
                    await window.api.db.deleteDownload(download.id);
                }
                
                downloads = downloads.filter(d => 
                    d.state !== 'completed' || 
                    (profileId !== null && d.profileId !== profileId)
                );
                
                return true;
            } catch (error) {
                console.error('Failed to clear completed downloads:', error);
                return false;
            }
        },

        // Clear all downloads
        async clearAll(profileId = null) {
            try {
                const result = await window.api.db.clearDownloads(profileId);
                if (result.success) {
                    if (profileId === null || profileId === 'all') {
                        downloads = [];
                    } else {
                        downloads = downloads.filter(d => d.profileId !== profileId);
                    }
                }
                return result.success;
            } catch (error) {
                console.error('Failed to clear downloads:', error);
                return false;
            }
        },

        // Get download by ID
        getDownload(id) {
            return downloads.find(d => d.id === id);
        },

        // Check if file exists
        async checkFileExists(id) {
            const download = downloads.find(d => d.id === id);
            if (!download || !download.savePath) return false;
            
            try {
                const result = await window.api.db.fileExists(download.savePath);
                if (result.success) {
                    // Update file exists status
                    await this.updateDownload(id, { fileExists: result.exists });
                    return result.exists;
                }
                return false;
            } catch (error) {
                console.error('Failed to check file exists:', error);
                return false;
            }
        }
    };
}

export const downloadStore = createDownloadStore();
