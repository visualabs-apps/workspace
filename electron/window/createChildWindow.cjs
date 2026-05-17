const { BrowserWindow } = require('electron');
const path = require('path');

// Store child windows with metadata
const childWindows = new Map();

/**
 * Create a child window (BrowserWindow)
 * @param {Object} options - Window options
 * @param {string} options.id - Unique window ID
 * @param {string} options.title - Window title
 * @param {number} options.width - Window width
 * @param {number} options.height - Window height
 * @param {string} options.route - Route to load (e.g., 'settings', 'profile')
 * @param {Object} options.data - Data to pass to window
 * @param {boolean} options.isDevEnvironment - Dev mode flag
 * @returns {BrowserWindow} - Created window
 */
function createChildWindow(options) {
    const {
        id,
        title = 'Window',
        width = 800,
        height = 600,
        route = '',
        data = {},
        isDevEnvironment = false,
        parent = null
    } = options;

    // Check if window already exists
    if (childWindows.has(id)) {
        const existingData = childWindows.get(id);
        const existingWindow = existingData.window;
        if (!existingWindow.isDestroyed()) {
            existingWindow.show();
            existingWindow.focus();
            return existingWindow;
        } else {
            childWindows.delete(id);
        }
    }

    // Extract window type from route (e.g., 'window/settings' -> 'SETTINGS')
    const windowType = route.split('/').pop()?.toUpperCase().replace(/-/g, '_') || 'UNKNOWN';

    // Create new window
    const childWindow = new BrowserWindow({
        width,
        height,
        title,
        parent: parent,
        modal: false,
        webPreferences: {
            preload: path.join(__dirname, '..', 'preload.cjs'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            backgroundThrottling: false, // Prevent throttling when minimized
        },
        frame: false, // Custom title bar
        show: false,
        backgroundColor: '#ffffff',
        paintWhenInitiallyHidden: true, // Paint even when hidden
        hasShadow: true,
    });

    // Show when ready
    childWindow.once('ready-to-show', () => {
        childWindow.show();
    });

    // Load content
    if (isDevEnvironment) {
        // Ensure route starts with /
        const formattedRoute = route.startsWith('/') ? route : `/${route}`;
        const url = `http://localhost:5184/#${formattedRoute}`;
        
        childWindow.loadURL(url).catch((e) => {
            console.error('Failed to load child window:', e);
        });
        
        // Open DevTools in dev mode
        childWindow.webContents.openDevTools();
    } else {
        const htmlPath = path.join(__dirname, '..', 'build', 'index.html');
        const formattedRoute = route.startsWith('/') ? route : `/${route}`;
        childWindow.loadFile(htmlPath, { hash: formattedRoute }).catch((e) => {
            console.error('Failed to load child window:', e);
        });
    }

    // Store window reference with metadata
    childWindows.set(id, {
        window: childWindow,
        windowType: windowType,
        isMinimized: false,
    });

    // Clean up on close — also show/focus parent window
    childWindow.on('closed', () => {
        childWindows.delete(id);
        // Show and focus parent (main) window when child closes
        if (parent && !parent.isDestroyed()) {
            parent.show();
            parent.focus();
        }
    });

    // Pass data to window when ready
    if (Object.keys(data).length > 0) {
        childWindow.webContents.once('dom-ready', () => {
            childWindow.webContents.send('window-data', { id, data });
        });
    }

    return childWindow;
}

/**
 * Get child window by ID
 * @param {string} id - Window ID
 * @returns {BrowserWindow|null}
 */
function getChildWindow(id) {
    const data = childWindows.get(id);
    return data ? data.window : null;
}

/**
 * Minimize child window (hide it)
 * @param {string} id - Window ID
 * @returns {Object} - Result with success flag
 */
function minimizeChildWindow(id) {
    const data = childWindows.get(id);
    if (data && !data.window.isDestroyed()) {
        data.window.hide();
        data.isMinimized = true;
        return { 
            success: true,
            windowType: data.windowType,
        };
    }
    return { success: false, error: 'Window not found' };
}

/**
 * Restore child window (show it)
 * @param {string} id - Window ID
 * @returns {Object} - Result with success flag
 */
function restoreChildWindow(id) {
    const data = childWindows.get(id);
    
    if (!data) {
        return { success: false, error: 'Window not found' };
    }
    
    if (data.window.isDestroyed()) {
        return { success: false, error: 'Window is destroyed' };
    }
    
    data.window.show();
    data.window.focus();
    data.isMinimized = false;
    return { success: true };
}

/**
 * Close child window by ID
 * @param {string} id - Window ID
 */
function closeChildWindow(id) {
    const data = childWindows.get(id);
    if (data && !data.window.isDestroyed()) {
        data.window.close();
    }
    childWindows.delete(id);
}

/**
 * Close all child windows
 */
function closeAllChildWindows() {
    childWindows.forEach((data) => {
        if (!data.window.isDestroyed()) {
            data.window.close();
        }
    });
    childWindows.clear();
}

module.exports = {
    createChildWindow,
    getChildWindow,
    minimizeChildWindow,
    restoreChildWindow,
    closeChildWindow,
    closeAllChildWindows,
};
