/**
 * Centralized Click Outside Detection Helper
 * 
 * Handles click detection outside of elements including:
 * - Regular DOM elements
 * - Webview areas
 * - Window events (blur, resize, move)
 * 
 * Usage:
 * import { useClickOutside } from './lib/clickOutside.svelte.js';
 * 
 * const cleanup = useClickOutside({
 *   elementSelector: '[data-my-element]',
 *   onClickOutside: () => { console.log('clicked outside!') },
 *   enabled: true
 * });
 * 
 * // Later: cleanup();
 */

export function useClickOutside(options) {
    const {
        elementSelector,      // CSS selector for the element (e.g., '[data-dropdown-id="123"]')
        onClickOutside,       // Callback when click outside is detected
        enabled = true,       // Enable/disable detection
        includeEscape = true, // Close on ESC key
        includeBlur = true,   // Close on window blur
        includeResize = true, // Close on window resize
    } = options;

    if (!enabled) return () => {};

    const handlers = [];

    // 1. Click outside detection (DOM + Webview)
    const handleClick = (e) => {
        const element = document.querySelector(elementSelector);
        if (!element) return;

        // Check if click is inside the element
        const isInside = element.contains(e.target);
        
        if (!isInside) {
            onClickOutside();
        }
    };

    document.addEventListener('click', handleClick, true);
    handlers.push(() => document.removeEventListener('click', handleClick, true));

    // 2. ESC key
    if (includeEscape) {
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                onClickOutside();
            }
        };
        document.addEventListener('keydown', handleEscape);
        handlers.push(() => document.removeEventListener('keydown', handleEscape));
    }

    // 3. Window blur
    if (includeBlur) {
        const handleBlur = () => {
            onClickOutside();
        };
        window.addEventListener('blur', handleBlur);
        handlers.push(() => window.removeEventListener('blur', handleBlur));
    }

    // 4. Window resize
    if (includeResize) {
        const handleResize = () => {
            onClickOutside();
        };
        window.addEventListener('resize', handleResize);
        handlers.push(() => window.removeEventListener('resize', handleResize));
    }

    // 5. IPC from main process (window move, maximize, etc)
    if (window.api?.onForceCloseDropdown) {
        const handleIPC = () => {
            onClickOutside();
        };
        window.api.onForceCloseDropdown(handleIPC);
        // Note: IPC cleanup is handled by Electron automatically
    }

    // Return cleanup function
    return () => {
        handlers.forEach(cleanup => cleanup());
    };
}

/**
 * Svelte Action for Click Outside
 * 
 * Usage in Svelte components:
 * <div use:clickOutside={{ onClickOutside: handleClose }}>
 *   Content
 * </div>
 */
export function clickOutside(node, options) {
    let cleanup;

    function update(newOptions) {
        if (cleanup) cleanup();
        
        cleanup = useClickOutside({
            elementSelector: `[data-click-outside-id="${node.dataset.clickOutsideId}"]`,
            ...newOptions
        });
    }

    // Generate unique ID for this element
    if (!node.dataset.clickOutsideId) {
        node.dataset.clickOutsideId = Math.random().toString(36).substr(2, 9);
    }

    update(options);

    return {
        update,
        destroy() {
            if (cleanup) cleanup();
        }
    };
}
