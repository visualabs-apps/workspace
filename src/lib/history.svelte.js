// History Store - Full Backend Integration
// Syncs with v-auto-backend chrome_histories table

import nativeApi from './nativeApi.js';
import { workspaceStore } from './workspaces.svelte.js';

function createHistoryStore() {
    // Cache for fast search/autocomplete
    let historyCache = $state([]);
    let isLoading = $state(false);
    let lastUpdate = $state(Date.now());
    
    // Debounce timer for tracking
    let trackingTimer = null;
    let pendingTrack = null;

    return {
        get history() { return historyCache; },
        get isLoading() { return isLoading; },
        get lastUpdate() { return lastUpdate },

        // Add new history entry (POST to backend)
        async addEntry(workspaceId, url, title, favicon = null) {
            if (!workspaceId || !url || url === 'about:blank') {
                return;
            }

            // Clean URL
            const cleanUrl = this.cleanUrl(url);
            
            // Don't track internal URLs
            if (cleanUrl.startsWith('chrome://') || 
                cleanUrl.startsWith('electron://') ||
                cleanUrl.startsWith('file://') ||
                cleanUrl.startsWith('about:')) {
                return;
            }

            // Get workspace to find browserUuid
            const workspace = workspaceStore.workspaces.find(w => w.id === workspaceId);
            if (!workspace?.uuid) {
                console.warn('No workspace UUID found for history tracking');
                return;
            }

            // Debounce tracking (avoid too many requests)
            pendingTrack = {
                browserUuid: workspace.uuid,
                url: cleanUrl,
                title: title || this.extractDomain(cleanUrl)
            };

            if (trackingTimer) {
                clearTimeout(trackingTimer);
            }

            trackingTimer = setTimeout(async () => {
                if (!pendingTrack) return;
                
                try {
                    await nativeApi.post('/chrome-histories/track', pendingTrack);
                    
                    // Update cache optimistically
                    const existingIndex = historyCache.findIndex(h => 
                        h.url === pendingTrack.url && h.profileId === workspaceId
                    );
                    
                    if (existingIndex !== -1) {
                        // Update existing entry
                        historyCache[existingIndex] = {
                            ...historyCache[existingIndex],
                            count: historyCache[existingIndex].count + 1,
                            dataJson: { title: pendingTrack.title },
                            updatedAt: new Date().toISOString()
                        };
                    } else {
                        // Add new entry to cache
                        historyCache.unshift({
                            id: Date.now(), // Temporary ID
                            profileId: workspaceId,
                            url: pendingTrack.url,
                            count: 1,
                            dataJson: { title: pendingTrack.title },
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        });
                        
                        // Keep cache size reasonable
                        if (historyCache.length > 200) {
                            historyCache = historyCache.slice(0, 200);
                        }
                    }
                    
                    lastUpdate = Date.now();
                } catch (error) {
                    console.error('Failed to track history:', error);
                }
                
                pendingTrack = null;
            }, 2000); // Debounce 2 seconds
        },

        // Load history from backend
        async loadHistory(workspaceId = null, limit = 100) {
            const workspace = workspaceId 
                ? workspaceStore.workspaces.find(w => w.id === workspaceId)
                : workspaceStore.activeWorkspace;
                
            if (!workspace?.id) {
                console.warn('No workspace found for loading history');
                return;
            }

            isLoading = true;
            try {
                // Build query params - ensure limit doesn't exceed backend max (100)
                const params = new URLSearchParams();
                params.append('profileId', workspace.id.toString());
                params.append('limit', Math.min(limit, 100).toString()); // Backend max is 100
                params.append('page', '1');
                
                const response = await nativeApi.get(
                    `/chrome-histories?${params.toString()}`
                );
                
                if (response.data.success) {
                    historyCache = response.data.data;
                    lastUpdate = Date.now();
                }
            } catch (error) {
                console.error('Failed to load history:', error);
            } finally {
                isLoading = false;
            }
        },

        // Get history for workspace (from cache)
        getHistory(workspaceId, limit = 100) {
            if (!workspaceId) return [];
            
            return historyCache
                .filter(h => h.profileId === workspaceId)
                .slice(0, limit);
        },

        // Search history with suggestions (from cache)
        searchHistory(workspaceId, query, limit = 8) {
            if (!workspaceId || !query || query.length < 1) {
                return [];
            }

            const lowerQuery = query.toLowerCase();
            
            // Score and filter entries
            const scored = historyCache
                .filter(h => h.profileId === workspaceId)
                .map(entry => {
                    let score = 0;
                    const title = entry.dataJson?.title || '';
                    const lowerTitle = title.toLowerCase();
                    const lowerUrl = entry.url.toLowerCase();

                    // Exact matches get highest score
                    if (lowerTitle.includes(lowerQuery)) score += 100;
                    if (lowerUrl.includes(lowerQuery)) score += 80;
                    
                    // Domain matches
                    if (this.extractDomain(entry.url).toLowerCase().includes(lowerQuery)) {
                        score += 60;
                    }

                    // Boost frequently visited
                    score += Math.min(entry.count * 5, 50);
                    
                    // Boost recent visits
                    const daysSince = (Date.now() - new Date(entry.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
                    if (daysSince < 1) score += 30;
                    else if (daysSince < 7) score += 15;

                    return { 
                        ...entry, 
                        score,
                        title: title || this.extractDomain(entry.url),
                        timestamp: new Date(entry.updatedAt).getTime(),
                        visitCount: entry.count
                    };
                })
                .filter(entry => entry.score > 0)
                .sort((a, b) => b.score - a.score)
                .slice(0, limit);

            return scored;
        },

        // Get popular sites for workspace
        getPopularSites(workspaceId, limit = 5) {
            if (!workspaceId) return [];

            const entries = historyCache.filter(h => h.profileId === workspaceId);
            
            // Group by domain and sum visit counts
            const domainStats = {};
            entries.forEach(entry => {
                const domain = this.extractDomain(entry.url);
                if (!domainStats[domain]) {
                    domainStats[domain] = {
                        domain,
                        visitCount: 0,
                        lastVisit: 0,
                        favicon: null,
                        sampleUrl: entry.url
                    };
                }
                domainStats[domain].visitCount += entry.count;
                const visitTime = new Date(entry.updatedAt).getTime();
                domainStats[domain].lastVisit = Math.max(domainStats[domain].lastVisit, visitTime);
            });

            return Object.values(domainStats)
                .sort((a, b) => b.visitCount - a.visitCount)
                .slice(0, limit);
        },

        // Clear history for workspace (delete from backend)
        async clearHistory(workspaceId) {
            if (!workspaceId) return;

            try {
                // Get all history entries for this workspace
                const toDelete = historyCache.filter(h => h.profileId === workspaceId);
                
                // Delete from backend
                for (const entry of toDelete) {
                    try {
                        await nativeApi.delete(`/chrome-histories/${entry.id}`);
                    } catch (error) {
                        console.error(`Failed to delete history ${entry.id}:`, error);
                    }
                }
                
                // Remove from cache
                historyCache = historyCache.filter(h => h.profileId !== workspaceId);
                lastUpdate = Date.now();
            } catch (error) {
                console.error('Failed to clear history:', error);
            }
        },

        // Clear all history
        async clearAllHistory() {
            try {
                // Delete all from backend
                for (const entry of historyCache) {
                    try {
                        await nativeApi.delete(`/chrome-histories/${entry.id}`);
                    } catch (error) {
                        console.error(`Failed to delete history ${entry.id}:`, error);
                    }
                }
                
                historyCache = [];
                lastUpdate = Date.now();
            } catch (error) {
                console.error('Failed to clear all history:', error);
            }
        },

        // Remove specific entry (delete from backend)
        async removeEntry(workspaceId, entryId) {
            if (!workspaceId) return;
            
            try {
                await nativeApi.delete(`/chrome-histories/${entryId}`);
                
                // Remove from cache
                historyCache = historyCache.filter(h => h.id !== entryId);
                lastUpdate = Date.now();
            } catch (error) {
                console.error('Failed to remove history entry:', error);
            }
        },

        // Refresh cache from backend
        async refresh() {
            const workspace = workspaceStore.activeWorkspace;
            if (workspace?.id) {
                await this.loadHistory(workspace.id);
            }
        },

        // Utility functions
        cleanUrl(url) {
            try {
                const urlObj = new URL(url);
                // Remove fragments and some tracking params
                urlObj.hash = '';
                
                // Remove common tracking parameters
                const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid'];
                trackingParams.forEach(param => {
                    urlObj.searchParams.delete(param);
                });
                
                return urlObj.toString();
            } catch (e) {
                return url;
            }
        },

        extractDomain(url) {
            try {
                return new URL(url).hostname;
            } catch (e) {
                return url;
            }
        }
    };
}

export const historyStore = createHistoryStore();