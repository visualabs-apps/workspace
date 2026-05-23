// Data Sync Manager - Periodic cookie sync from server + profile refresh
import { getChromeProfile } from '../api/api.js';
import { workspaceStore } from '../stores/workspaces.svelte.js';
import { authStore } from '../stores/auth.svelte.js';

function createDataSyncManager() {
    let syncInterval = null;
    let intervalSeconds = 30;
    let isEnabled = false;
    let indicatorTimeout = null;

    // Reactive state
    let syncStatus = $state('idle'); // 'idle' | 'syncing' | 'error' | 'success'
    let lastSyncTime = $state(null);
    let lastError = $state(null);
    let showIndicator = $state(false); // Only true during syncing + briefly after

    /**
     * Apply cookies to local Electron session (full bidirectional sync)
     * Same logic as WindowCookieManager.applyCookiesToLocalSession
     */
    async function applyCookiesToLocalSession(partition, cookiesToApply) {
        if (!partition || !cookiesToApply?.length) return;

        try {
            // Step 1: Get current local cookies to detect deletions
            let localCookies = [];
            try {
                localCookies = await window.api.db.getCookiesFromPartition(partition) || [];
            } catch (err) {
                console.warn('[DataSync] Failed to read local cookies:', err);
            }

            // Step 2: Build a set of server cookie keys for fast lookup
            const serverCookieKeys = new Set(
                cookiesToApply.map(c => `${c.name}|${c.domain}|${c.path || '/'}`)
            );

            // Step 3: Remove local cookies that no longer exist on server
            for (const localCookie of localCookies) {
                const key = `${localCookie.name}|${localCookie.domain}|${localCookie.path || '/'}`;
                if (!serverCookieKeys.has(key)) {
                    try {
                        await window.api.db.deleteCookieFromPartition(
                            partition,
                            localCookie.name,
                            localCookie.domain,
                            localCookie.path,
                            localCookie.secure
                        );
                    } catch (err) {
                        // Cookie may already be gone, ignore
                    }
                }
            }

            // Step 4: Add/update all server cookies to local session
            for (const cookie of cookiesToApply) {
                if (!cookie.name || !cookie.domain) continue;
                if (cookie.value === undefined || cookie.value === null) cookie.value = '';
                try {
                    await window.api.db.setCookieToPartition(partition, cookie);
                } catch (err) {
                    // Ignore individual cookie errors
                }
            }
        } catch (error) {
            console.error('[DataSync] Apply cookies error:', error);
        }
    }

    /**
     * Sync cookies for a specific workspace from server to local session
     */
    async function syncCookiesForWorkspace(workspace) {
        if (!workspace?.id) return;

        const partition = `persist:workspace-${workspace.id}`;

        try {
            const response = await getChromeProfile(workspace.id);
            if (response.success && response.data) {
                let serverCookies = response.data.cookies;
                if (typeof serverCookies === 'string') {
                    try {
                        serverCookies = JSON.parse(serverCookies);
                    } catch (e) {
                        serverCookies = [];
                    }
                }
                const cookies = Array.isArray(serverCookies) ? serverCookies : [];
                if (cookies.length > 0) {
                    await applyCookiesToLocalSession(partition, cookies);
                }
            }
        } catch (error) {
            console.warn('[DataSync] Cookie sync failed for workspace', workspace.id, error);
        }
    }

    /**
     * Perform a full sync cycle:
     * 1. Sync cookies for active workspace
     * 2. Refresh workspace/profile list from server
     */
    async function performSync() {
        if (!authStore?.isLoggedIn) return;

        // Show indicator and clear previous auto-hide timeout
        syncStatus = 'syncing';
        showIndicator = true;
        lastError = null;
        if (indicatorTimeout) clearTimeout(indicatorTimeout);

        try {
            // 1. Sync cookies for the active workspace
            const activeWorkspace = workspaceStore.activeWorkspace;
            if (activeWorkspace) {
                await syncCookiesForWorkspace(activeWorkspace);
            }

            // 2. Refresh workspace list (detects new/deleted profiles from other users)
            await workspaceStore.refresh();

            syncStatus = 'success';
            lastSyncTime = Date.now();
        } catch (error) {
            console.error('[DataSync] Sync error:', error);
            syncStatus = 'error';
            lastError = error.message;
        }

        // Auto-hide indicator after delay (3s for success, 5s for error)
        const hideDelay = syncStatus === 'error' ? 5000 : 3000;
        indicatorTimeout = setTimeout(() => {
            showIndicator = false;
            syncStatus = 'idle';
        }, hideDelay);
    }

    /**
     * Start the periodic sync interval
     */
    function startSync() {
        stopSync(); // Clear any existing interval

        if (!isEnabled) return;

        console.log(`[DataSync] Starting sync every ${intervalSeconds}s`);

        // Perform initial sync immediately
        performSync();

        syncInterval = setInterval(() => {
            performSync();
        }, intervalSeconds * 1000);
    }

    /**
     * Stop the periodic sync interval
     */
    function stopSync() {
        if (syncInterval) {
            clearInterval(syncInterval);
            syncInterval = null;
        }
        if (indicatorTimeout) {
            clearTimeout(indicatorTimeout);
            indicatorTimeout = null;
        }
        syncStatus = 'idle';
        showIndicator = false;
    }

    /**
     * Load settings and start sync if enabled
     */
    async function init() {
        try {
            const [enabledResult, intervalResult] = await Promise.all([
                window.api.settings.getDataSyncEnabled(),
                window.api.settings.getDataSyncInterval(),
            ]);

            if (enabledResult.success) {
                isEnabled = enabledResult.enabled;
            }
            if (intervalResult.success) {
                intervalSeconds = intervalResult.seconds;
            }

            if (isEnabled && authStore?.isLoggedIn) {
                startSync();
            }
        } catch (error) {
            console.error('[DataSync] Init error:', error);
        }
    }

    /**
     * Update settings and restart sync if needed
     */
    async function updateSettings({ enabled, seconds }) {
        let needsRestart = false;

        if (enabled !== undefined && enabled !== isEnabled) {
            isEnabled = enabled;
            needsRestart = true;
        }
        if (seconds !== undefined && seconds !== intervalSeconds) {
            intervalSeconds = seconds;
            needsRestart = true;
        }

        if (needsRestart) {
            if (isEnabled && authStore?.isLoggedIn) {
                startSync();
            } else {
                stopSync();
            }
        }
    }

    /**
     * Stop and reset everything (for logout)
     */
    function destroy() {
        stopSync();
        isEnabled = false;
        intervalSeconds = 30;
        lastSyncTime = null;
        lastError = null;
        syncStatus = 'idle';
        showIndicator = false;
    }

    return {
        get syncStatus() { return syncStatus; },
        get lastSyncTime() { return lastSyncTime; },
        get lastError() { return lastError; },
        get isEnabled() { return isEnabled; },
        get intervalSeconds() { return intervalSeconds; },
        get showIndicator() { return showIndicator; },

        init,
        startSync,
        stopSync,
        updateSettings,
        performSync,
        destroy,
    };
}

export const dataSyncManager = createDataSyncManager();
