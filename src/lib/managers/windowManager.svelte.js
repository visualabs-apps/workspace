// Window Manager - manages multiple draggable windows with z-index
// Similar to Windows OS window management

function createWindowManager() {
    let windows = $state([]);
    let nextZIndex = $state(300);
    let highestZIndex = $state(300);

    return {
        get windows() { return windows; },
        get highestZIndex() { return highestZIndex; },

        // Register a new window
        registerWindow(windowId, initialPosition = null) {
            const existingWindow = windows.find(w => w.id === windowId);
            if (existingWindow) {
                // Window already exists, just return it (don't bring to front here)
                return existingWindow;
            }

            const newWindow = {
                id: windowId,
                zIndex: nextZIndex,
                position: initialPosition || { x: 100, y: 100 },
                isMinimized: false,
                isMaximized: false
            };

            windows = [...windows, newWindow];
            highestZIndex = nextZIndex;
            nextZIndex += 1;

            return newWindow;
        },

        // Unregister window when closed
        unregisterWindow(windowId) {
            windows = windows.filter(w => w.id !== windowId);
            
            // Recalculate highest z-index
            if (windows.length > 0) {
                highestZIndex = Math.max(...windows.map(w => w.zIndex));
            } else {
                highestZIndex = 300;
                nextZIndex = 300;
            }
        },

        // Bring window to front
        bringToFront(windowId) {
            const window = windows.find(w => w.id === windowId);
            if (!window) return;

            // If already at front, do nothing
            if (window.zIndex === highestZIndex) return;

            // Set new z-index
            window.zIndex = nextZIndex;
            highestZIndex = nextZIndex;
            nextZIndex += 1;

            // Trigger reactivity
            windows = [...windows];
        },

        // Get window by ID
        getWindow(windowId) {
            return windows.find(w => w.id === windowId);
        },

        // Update window position
        updatePosition(windowId, position) {
            const window = windows.find(w => w.id === windowId);
            if (window) {
                window.position = position;
                windows = [...windows];
            }
        },

        // Minimize window
        minimize(windowId) {
            const window = windows.find(w => w.id === windowId);
            if (window) {
                window.isMinimized = true;
                windows = [...windows];
            }
        },

        // Restore window
        restore(windowId) {
            const window = windows.find(w => w.id === windowId);
            if (window) {
                window.isMinimized = false;
                window.isMaximized = false;
                this.bringToFront(windowId);
                windows = [...windows];
            }
        },

        // Maximize window
        maximize(windowId) {
            const window = windows.find(w => w.id === windowId);
            if (window) {
                window.isMaximized = !window.isMaximized;
                if (window.isMaximized) {
                    this.bringToFront(windowId);
                }
                windows = [...windows];
            }
        },

        // Close all windows
        closeAll() {
            windows = [];
            highestZIndex = 300;
            nextZIndex = 300;
        }
    };
}

export const windowManager = createWindowManager();

// Make it globally accessible
if (typeof window !== 'undefined') {
    window.windowManager = windowManager;
}
