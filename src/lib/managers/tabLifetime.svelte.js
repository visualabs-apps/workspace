/**
 * Tab Lifetime Manager
 * Manages automatic unloading of inactive services/tabs to save memory
 * Note: In this app, "tabs" are actually services with webviews
 */

class TabLifetimeManager {
    constructor() {
        this.serviceLastActive = new Map(); // serviceId -> timestamp
        this.checkInterval = null;
        this.lifetimeMinutes = 30; // Default 30 minutes
        this.enabled = true;
        this.onUnloadCallback = null;
    }

    /**
     * Initialize the manager with settings
     */
    async init() {
        try {
            // Load tab lifetime setting from database
            const result = await window.api.settings.getTabLifetime();
            if (result.success) {
                this.setLifetime(result.minutes);
            }
        } catch (error) {
            console.error('Failed to load tab lifetime setting:', error);
        }

        // Start checking every minute
        this.startChecking();
    }

    /**
     * Set tab lifetime in minutes
     * @param {string|number} minutes - Minutes or "forever"
     */
    setLifetime(minutes) {
        if (minutes === 'forever') {
            this.enabled = false;
        } else {
            this.enabled = true;
            const numMinutes = parseFloat(minutes);
            this.lifetimeMinutes = numMinutes;
        }
        
        // Restart checking with new interval
        this.startChecking();
    }

    /**
     * Mark service as active (reset its timer)
     * @param {string} serviceId - Service ID
     */
    markActive(serviceId) {
        const now = Date.now();
        this.serviceLastActive.set(serviceId, now);
    }

    /**
     * Remove service from tracking
     * @param {string} serviceId - Service ID
     */
    removeService(serviceId) {
        this.serviceLastActive.delete(serviceId);
    }

    /**
     * Check all services and unload inactive ones
     */
    checkServices() {
        if (!this.enabled) {
            return;
        }

        const now = Date.now();
        const lifetimeMs = this.lifetimeMinutes * 60 * 1000;

        for (const [serviceId, lastActive] of this.serviceLastActive.entries()) {
            const inactiveTime = now - lastActive;
            
            if (inactiveTime >= lifetimeMs) {
                // Call unload callback
                if (this.onUnloadCallback) {
                    this.onUnloadCallback(serviceId);
                }
                
                // Keep tracking but don't unload again
                this.serviceLastActive.set(serviceId, now);
            }
        }
    }

    /**
     * Start periodic checking
     */
    startChecking() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }

        // Check interval based on lifetime setting
        let checkIntervalMs;
        if (this.lifetimeMinutes < 5) {
            // Less than 5 minutes: check every 30 seconds
            checkIntervalMs = 30 * 1000;
        } else {
            // 5 minutes or more: check every minute
            checkIntervalMs = 60 * 1000;
        }

        this.checkInterval = setInterval(() => {
            this.checkServices();
        }, checkIntervalMs);
    }

    /**
     * Stop periodic checking
     */
    stopChecking() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    /**
     * Set callback for when service should be unloaded
     * @param {Function} callback - Callback function(serviceId)
     */
    onUnload(callback) {
        this.onUnloadCallback = callback;
    }

    /**
     * Get inactive time for a service in seconds
     * @param {string} serviceId - Service ID
     * @returns {number} - Seconds inactive
     */
    getInactiveTime(serviceId) {
        const lastActive = this.serviceLastActive.get(serviceId);
        if (!lastActive) return 0;
        
        const now = Date.now();
        return Math.round((now - lastActive) / 1000); // Return in seconds
    }

    /**
     * Check if service should be unloaded
     * @param {string} serviceId - Service ID
     * @returns {boolean}
     */
    shouldUnload(serviceId) {
        if (!this.enabled) return false;
        
        const inactiveSeconds = this.getInactiveTime(serviceId);
        const lifetimeSeconds = this.lifetimeMinutes * 60;
        return inactiveSeconds >= lifetimeSeconds;
    }
    
    /**
     * Get debug status
     * @returns {object} - Debug information
     */
    getDebugStatus() {
        return {
            enabled: this.enabled,
            lifetimeMinutes: this.lifetimeMinutes,
            trackedServices: this.serviceLastActive.size,
            services: Array.from(this.serviceLastActive.entries()).map(([serviceId, lastActive]) => ({
                serviceId,
                lastActive: new Date(lastActive).toLocaleTimeString(),
                inactiveSeconds: this.getInactiveTime(serviceId),
                shouldUnload: this.shouldUnload(serviceId)
            }))
        };
    }
}

// Create singleton instance
export const tabLifetimeManager = new TabLifetimeManager();

// Expose to window for debugging
if (typeof window !== 'undefined') {
    window.tabLifetimeManager = tabLifetimeManager;
}
