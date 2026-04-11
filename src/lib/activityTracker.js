/**
 * ═══════════════════════════════════════════════════════════════════════
 * WORKSPACE ACTIVITY TRACKER
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * Tracks user activities in V-LEB Workspace and sends to backend
 * 
 * Features:
 * - Space switching tracking with duration
 * - Website visit history per space
 * - Note activity tracking per space
 * - App usage analytics
 * - Automatic session tracking
 * 
 * @author V-LEB Team
 */

import { API_BASE_URL } from './api.js';
import { secureStorage } from './secureStorage.js';

class ActivityTracker {
    constructor() {
        this.isEnabled = true;
        this.currentSpace = null;
        this.spaceStartTime = null;
        this.currentApp = null;
        this.appStartTime = null;
        this.visitStartTime = null;
        this.currentUrl = null;
        this.batchQueue = [];
        this.batchTimer = null;
        this.isOnline = navigator.onLine;
        
        // Setup online/offline listeners
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.flushBatch();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
        });

        // Setup beforeunload to track final activities
        window.addEventListener('beforeunload', () => {
            this.trackSpaceEnd();
            this.trackAppEnd();
            this.trackWebsiteEnd();
            this.flushBatch(true); // Synchronous flush
        });

        console.log('🔍 Activity Tracker initialized');
    }

    /**
     * Enable/disable activity tracking
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
        console.log(`🔍 Activity Tracker ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Track space switching
     */
    trackSpaceSwitch(fromSpaceId, fromSpaceName, toSpaceId, toSpaceName) {
        if (!this.isEnabled) return;

        // Calculate duration in previous space
        const duration = this.spaceStartTime ? 
            Math.floor((Date.now() - this.spaceStartTime) / 1000) : 0;

        if (fromSpaceId && duration > 0) {
            this.queueActivity({
                endpoint: '/activity/space-switch',
                data: {
                    from_space_id: fromSpaceId,
                    from_space_name: fromSpaceName,
                    to_space_id: toSpaceId,
                    to_space_name: toSpaceName,
                    duration_seconds: duration
                }
            });
        }

        // Update current space tracking
        this.currentSpace = {
            id: toSpaceId,
            name: toSpaceName
        };
        this.spaceStartTime = Date.now();

        console.log(`🔍 Space switch: ${fromSpaceName || fromSpaceId} → ${toSpaceName || toSpaceId} (${duration}s)`);
    }

    /**
     * Track space end (when closing app or switching)
     */
    trackSpaceEnd() {
        if (!this.isEnabled || !this.currentSpace || !this.spaceStartTime) return;

        const duration = Math.floor((Date.now() - this.spaceStartTime) / 1000);
        
        if (duration > 0) {
            this.queueActivity({
                endpoint: '/activity/space-switch',
                data: {
                    from_space_id: this.currentSpace.id,
                    from_space_name: this.currentSpace.name,
                    to_space_id: 'app_closed',
                    to_space_name: 'Application Closed',
                    duration_seconds: duration
                }
            });
        }

        this.currentSpace = null;
        this.spaceStartTime = null;
    }

    /**
     * Track website visits
     */
    trackWebsiteVisit(spaceId, spaceName, appId, appName, url, pageTitle) {
        if (!this.isEnabled) return;

        // End previous website visit
        this.trackWebsiteEnd();

        // Start new website visit tracking
        this.currentUrl = {
            url,
            pageTitle,
            spaceId,
            spaceName,
            appId,
            appName
        };
        this.visitStartTime = Date.now();

        console.log(`🔍 Website visit: ${url} in ${spaceName || spaceId}`);
    }

    /**
     * Track website visit end
     */
    trackWebsiteEnd() {
        if (!this.isEnabled || !this.currentUrl || !this.visitStartTime) return;

        const duration = Math.floor((Date.now() - this.visitStartTime) / 1000);
        
        // Only track if user spent at least 5 seconds on the page
        if (duration >= 5) {
            this.queueActivity({
                endpoint: '/activity/website-visit',
                data: {
                    space_id: this.currentUrl.spaceId,
                    space_name: this.currentUrl.spaceName,
                    app_id: this.currentUrl.appId,
                    app_name: this.currentUrl.appName,
                    url: this.currentUrl.url,
                    page_title: this.currentUrl.pageTitle,
                    duration_seconds: duration
                }
            });
        }

        this.currentUrl = null;
        this.visitStartTime = null;
    }

    /**
     * Track note actions
     */
    trackNoteAction(spaceId, spaceName, action, noteCount = null, noteTitle = null) {
        if (!this.isEnabled) return;

        this.queueActivity({
            endpoint: '/activity/note-action',
            data: {
                space_id: spaceId,
                space_name: spaceName,
                action: action, // 'create', 'edit', 'delete', 'pin', 'unpin', 'open', 'close'
                note_count: noteCount,
                note_title: noteTitle
            }
        });

        console.log(`🔍 Note action: ${action} in ${spaceName || spaceId}`);
    }

    /**
     * Track app actions
     */
    trackAppAction(spaceId, spaceName, appId, appName, action) {
        if (!this.isEnabled) return;

        let duration = null;

        // Calculate duration for close/blur actions
        if ((action === 'close' || action === 'blur') && this.appStartTime) {
            duration = Math.floor((Date.now() - this.appStartTime) / 1000);
        }

        // Update app tracking state
        if (action === 'open' || action === 'focus') {
            this.currentApp = { id: appId, name: appName };
            this.appStartTime = Date.now();
        } else if (action === 'close' || action === 'remove') {
            this.currentApp = null;
            this.appStartTime = null;
        }

        this.queueActivity({
            endpoint: '/activity/app-action',
            data: {
                space_id: spaceId,
                space_name: spaceName,
                app_id: appId,
                app_name: appName,
                action: action, // 'open', 'close', 'focus', 'blur', 'add', 'remove'
                duration_seconds: duration
            }
        });

        console.log(`🔍 App action: ${action} - ${appName || appId} in ${spaceName || spaceId}`);
    }

    /**
     * Track app end (when switching or closing)
     */
    trackAppEnd() {
        if (!this.isEnabled || !this.currentApp || !this.appStartTime) return;

        const duration = Math.floor((Date.now() - this.appStartTime) / 1000);
        
        if (duration > 0 && this.currentSpace) {
            this.queueActivity({
                endpoint: '/activity/app-action',
                data: {
                    space_id: this.currentSpace.id,
                    space_name: this.currentSpace.name,
                    app_id: this.currentApp.id,
                    app_name: this.currentApp.name,
                    action: 'close',
                    duration_seconds: duration
                }
            });
        }

        this.currentApp = null;
        this.appStartTime = null;
    }

    /**
     * Queue activity for batch sending
     */
    queueActivity(activity) {
        this.batchQueue.push({
            ...activity,
            timestamp: new Date().toISOString()
        });

        // Auto-flush batch every 10 seconds or when queue reaches 10 items
        if (this.batchQueue.length >= 10) {
            this.flushBatch();
        } else if (!this.batchTimer) {
            this.batchTimer = setTimeout(() => {
                this.flushBatch();
            }, 10000);
        }
    }

    /**
     * Flush batch queue to backend
     */
    async flushBatch(synchronous = false) {
        if (this.batchQueue.length === 0 || !this.isOnline) return;

        const activities = [...this.batchQueue];
        this.batchQueue = [];
        
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
        }

        try {
            const token = await secureStorage.getAuthToken();
            if (!token) {
                console.warn('🔍 No auth token, skipping activity tracking');
                return;
            }

            // Send each activity individually (could be optimized with batch endpoint)
            const promises = activities.map(activity => 
                this.sendActivity(activity, token, synchronous)
            );

            if (synchronous) {
                // Use sendBeacon for synchronous sending during page unload
                activities.forEach(activity => {
                    const data = new FormData();
                    data.append('data', JSON.stringify(activity.data));
                    
                    navigator.sendBeacon(
                        `${API_BASE_URL}${activity.endpoint}`,
                        data
                    );
                });
            } else {
                await Promise.allSettled(promises);
            }

            console.log(`🔍 Sent ${activities.length} activities to backend`);

        } catch (error) {
            console.error('🔍 Failed to send activities:', error);
            // Re-queue failed activities
            this.batchQueue.unshift(...activities);
        }
    }

    /**
     * Send individual activity to backend
     */
    async sendActivity(activity, token, synchronous = false) {
        if (synchronous) return; // Handled in flushBatch

        const response = await fetch(`${API_BASE_URL}${activity.endpoint}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(activity.data)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response.json();
    }

    /**
     * Get activity history from backend
     */
    async getHistory(filters = {}) {
        try {
            const token = await secureStorage.getAuthToken();
            if (!token) throw new Error('No auth token');

            const params = new URLSearchParams(filters);
            const response = await fetch(`${API_BASE_URL}/activity/history?${params}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return response.json();

        } catch (error) {
            console.error('🔍 Failed to get activity history:', error);
            throw error;
        }
    }

    /**
     * Get activity analytics from backend
     */
    async getAnalytics(dateFrom = null, dateTo = null) {
        try {
            const token = await secureStorage.getAuthToken();
            if (!token) throw new Error('No auth token');

            const params = new URLSearchParams();
            if (dateFrom) params.append('date_from', dateFrom);
            if (dateTo) params.append('date_to', dateTo);

            const response = await fetch(`${API_BASE_URL}/activity/analytics?${params}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return response.json();

        } catch (error) {
            console.error('🔍 Failed to get activity analytics:', error);
            throw error;
        }
    }
}

// Create singleton instance
export const activityTracker = new ActivityTracker();

// Export for manual control
export default activityTracker;