// Download Manager Store
// Manages all downloads across all services

import { v4 as uuidv4 } from 'uuid';

function createDownloadStore() {
    // Load from localStorage
    let storedDownloads = [];
    try {
        const item = localStorage.getItem('vleb_downloads');
        if (item) {
            storedDownloads = JSON.parse(item);
            // Filter out completed downloads older than 7 days
            const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
            storedDownloads = storedDownloads.filter(d =>
                d.state !== 'completed' || d.endTime > weekAgo
            );
        }
    } catch (e) {
        console.error('Failed to load downloads', e);
    }

    // State
    let downloads = $state(storedDownloads);
    let isDownloadPanelOpen = $state(false);

    // Initial listener setup
    if (typeof window !== 'undefined' && window.api) {
        window.api.onDownloadStarted((data) => {
            const id = uuidv4();
            // Store the filename -> id mapping temporarily if needed, 
            // but here we just create a new entry since 'filename' + 'startTime' is unique enough
            // Or better, we can assume 'data' is fresh.

            // Check if we already have this download (by url and close start time)
            const existing = downloads.find(d => d.url === data.url && Math.abs(d.startTime - data.startTime) < 1000);
            if (!existing) {
                const download = {
                    id: id,
                    filename: data.filename,
                    url: data.url,
                    savePath: '',
                    totalBytes: data.totalBytes,
                    receivedBytes: 0,
                    state: 'progressing',
                    startTime: data.startTime || Date.now(),
                    endTime: null,
                    speed: 0,
                    serviceId: null, // Hard to map back to serviceId without more IPC context
                    serviceName: 'Download',
                    mimeType: '',
                    canResume: true
                };
                downloads = [download, ...downloads];
                isDownloadPanelOpen = true; // Auto open panel
            }
        });

        window.api.onDownloadProgress((data) => {
            // Find download by filename (simplest approx for now)
            const download = downloads.find(d => d.filename === data.filename && d.state === 'progressing');
            if (download) {
                // Calculate speed
                const now = Date.now();
                // Simple speed calc could go here

                const index = downloads.indexOf(download);
                downloads = [
                    ...downloads.slice(0, index),
                    {
                        ...download,
                        receivedBytes: data.receivedBytes,
                        totalBytes: data.totalBytes,
                        state: data.state
                    },
                    ...downloads.slice(index + 1)
                ];
            }
        });

        window.api.onDownloadCompleted((data) => {
            const download = downloads.find(d => d.filename === data.filename && d.state === 'progressing');
            if (download) {
                const index = downloads.indexOf(download);
                downloads = [
                    ...downloads.slice(0, index),
                    {
                        ...download,
                        state: 'completed',
                        savePath: data.savePath,
                        endTime: Date.now(),
                        receivedBytes: download.totalBytes // Ensure full bar
                    },
                    ...downloads.slice(index + 1)
                ];

                // Notify user
                if (window.api.showNotification) {
                    window.api.showNotification({
                        title: 'Download Completed',
                        body: `${data.filename} has finished downloading.`
                    });
                }
            }
        });

        window.api.onDownloadFailed((data) => {
            const download = downloads.find(d => d.filename === data.filename && d.state === 'progressing');
            if (download) {
                const index = downloads.indexOf(download);
                downloads = [
                    ...downloads.slice(0, index),
                    {
                        ...download,
                        state: 'failed' // or 'interrupted'
                    },
                    ...downloads.slice(index + 1)
                ];
            }
        });
    }

    // Auto-save to localStorage
    $effect.root(() => {
        $effect(() => {
            localStorage.setItem('vleb_downloads', JSON.stringify(downloads));
        });
    });

    return {
        get downloads() { return downloads; },
        get activeDownloads() {
            return downloads.filter(d => d.state === 'progressing' || d.state === 'paused');
        },
        get completedDownloads() {
            return downloads.filter(d => d.state === 'completed');
        },
        get isDownloadPanelOpen() { return isDownloadPanelOpen; },

        toggleDownloadPanel() {
            isDownloadPanelOpen = !isDownloadPanelOpen;
        },

        openDownloadPanel() {
            isDownloadPanelOpen = true;
        },

        closeDownloadPanel() {
            isDownloadPanelOpen = false;
        },

        // Add a new download
        addDownload(item) {
            const download = {
                id: uuidv4(),
                filename: item.filename || 'Unknown',
                url: item.url,
                savePath: item.savePath,
                totalBytes: item.totalBytes || 0,
                receivedBytes: 0,
                state: 'progressing', // progressing, paused, completed, cancelled, interrupted
                startTime: Date.now(),
                endTime: null,
                speed: 0,
                serviceId: item.serviceId || null,
                serviceName: item.serviceName || 'Unknown',
                mimeType: item.mimeType || '',
                canResume: true
            };
            downloads = [download, ...downloads];
            return download;
        },

        // Update download progress
        updateDownload(id, updates) {
            const index = downloads.findIndex(d => d.id === id);
            if (index !== -1) {
                downloads = [
                    ...downloads.slice(0, index),
                    { ...downloads[index], ...updates },
                    ...downloads.slice(index + 1)
                ];
            }
        },

        // Complete download
        completeDownload(id) {
            this.updateDownload(id, {
                state: 'completed',
                endTime: Date.now(),
                receivedBytes: downloads.find(d => d.id === id)?.totalBytes || 0
            });
        },

        // Pause download
        pauseDownload(id) {
            this.updateDownload(id, { state: 'paused' });
        },

        // Resume download
        resumeDownload(id) {
            this.updateDownload(id, { state: 'progressing' });
        },

        // Cancel download
        cancelDownload(id) {
            this.updateDownload(id, {
                state: 'cancelled',
                endTime: Date.now()
            });
        },

        // Remove download from list
        removeDownload(id) {
            downloads = downloads.filter(d => d.id !== id);
        },

        // Clear completed downloads
        clearCompleted() {
            downloads = downloads.filter(d => d.state !== 'completed');
        },

        // Clear all downloads
        clearAll() {
            downloads = [];
        },

        // Get download by ID
        getDownload(id) {
            return downloads.find(d => d.id === id);
        }
    };
}

export const downloadStore = createDownloadStore();
