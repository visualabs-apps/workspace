// Child Window Helper - Open windows as native BrowserWindow instead of Svelte overlays

/**
 * Open a child window as BrowserWindow
 * @param {Object} options - Window options
 * @param {string} options.id - Unique window ID
 * @param {string} options.title - Window title
 * @param {number} options.width - Window width (default: 800)
 * @param {number} options.height - Window height (default: 600)
 * @param {string} options.route - Route to load (e.g., 'settings', 'profile')
 * @param {Object} options.data - Data to pass to window
 * @returns {Promise<{success: boolean, windowId?: string, error?: string}>}
 */
export async function openChildWindow(options) {
    if (!window.api?.childWindow?.open) {
        console.error('Child window API not available');
        return { success: false, error: 'API not available' };
    }

    const {
        id,
        title = 'Window',
        width = 800,
        height = 600,
        route = '',
        data = {},
    } = options;

    try {
        const result = await window.api.childWindow.open({
            id,
            title,
            width,
            height,
            route,
            data,
        });

        return result;
    } catch (error) {
        console.error('Failed to open child window:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Close a child window
 * @param {string} windowId - Window ID to close
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function closeChildWindow(windowId) {
    if (!window.api?.childWindow?.close) {
        console.error('Child window API not available');
        return { success: false, error: 'API not available' };
    }

    try {
        const result = await window.api.childWindow.close(windowId);
        return result;
    } catch (error) {
        console.error('Failed to close child window:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Close all child windows
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function closeAllChildWindows() {
    if (!window.api?.childWindow?.closeAll) {
        console.error('Child window API not available');
        return { success: false, error: 'API not available' };
    }

    try {
        const result = await window.api.childWindow.closeAll();
        return result;
    } catch (error) {
        console.error('Failed to close all child windows:', error);
        return { success: false, error: error.message };
    }
}

// Predefined window configurations
export const WINDOW_CONFIGS = {
    SETTINGS: {
        id: 'settings-window',
        title: 'Settings',
        width: 900,
        height: 700,
        route: 'window/settings',
    },
    TARGET: {
        id: 'target-window',
        title: 'Target Manager',
        width: 800,
        height: 600,
        route: 'window/target',
    },
    INJECT_SCRIPT: {
        id: 'inject-script-window',
        title: 'Script Injector',
        width: 1000,
        height: 800,
        route: 'window/inject-script',
    },
    PROFILE: {
        id: 'profile-window',
        title: 'Profile',
        width: 600,
        height: 700,
        route: 'window/profile',
    },
    COOKIE_MANAGER: {
        id: 'cookie-manager-window',
        title: 'Cookie Manager',
        width: 900,
        height: 700,
        route: 'window/cookie-manager',
    },
    SCRIPT_CONSOLE: {
        id: 'script-console-window',
        title: 'Script Console',
        width: 800,
        height: 600,
        route: 'window/script-console',
    },
    VBOX_API_DOCS: {
        id: 'vbox-api-docs-window',
        title: 'VBox API Documentation',
        width: 900,
        height: 700,
        route: 'window/vbox-api-docs',
    },
    ADD_SERVICE: {
        id: 'add-service-window',
        title: 'Add Service',
        width: 600,
        height: 500,
        route: 'window/add-service',
    },
    SCRIPT_INPUT: {
        id: 'script-input-window',
        title: 'Script Input',
        width: 500,
        height: 400,
        route: 'window/script-input',
    },
};

/**
 * Open a predefined window
 * @param {string} windowType - Window type from WINDOW_CONFIGS
 * @param {Object} data - Data to pass to window
 * @returns {Promise<{success: boolean, windowId?: string, error?: string}>}
 */
export async function openPredefinedWindow(windowType, data = {}) {
    const config = WINDOW_CONFIGS[windowType];
    if (!config) {
        console.error(`Unknown window type: ${windowType}`);
        return { success: false, error: 'Unknown window type' };
    }

    return openChildWindow({
        ...config,
        data,
    });
}
