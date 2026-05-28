/**
 * VBox API Stealth Wrapper
 *
 * This module hides VBox API globals from anti-bot detection systems
 * while keeping them fully functional for internal tools (MCP, scripts, etc.).
 *
 * Strategy:
 * - Make all vbox* globals non-enumerable (invisible to Object.keys(), for...in)
 * - Keep __VBOX_API__ accessible but non-enumerable
 * - Provide Symbol-based fallback accessor for extra safety
 * - MCP tools and scripts still work because they access by direct reference
 */

function initVBoxApiStealth() {
    // Create a hidden symbol for VBox API access (fallback for scripts)
    const VBOX_SYMBOL = Symbol.for('__vbox_internal__');
    
    // Store the VBox API under the symbol as a backup
    if (typeof window.__VBOX_API__ !== 'undefined') {
        window[VBOX_SYMBOL] = window.__VBOX_API__;
        
        // Make __VBOX_API__ non-enumerable instead of deleting it
        // This keeps MCP tools working while hiding from detection
        try {
            const descriptor = Object.getOwnPropertyDescriptor(window, '__VBOX_API__');
            if (descriptor && descriptor.configurable) {
                Object.defineProperty(window, '__VBOX_API__', {
                    ...descriptor,
                    enumerable: false, // Hidden from Object.keys() and for...in
                    configurable: true
                });
            }
        } catch (_) {}
    }
    
    // Provide a safe accessor function that scripts can use
    // This is less obvious than a direct global variable
    Object.defineProperty(window, 'getVBoxAPI', {
        value: function() {
            return window[VBOX_SYMBOL] || window.__VBOX_API__;
        },
        writable: false,
        enumerable: false, // Hidden from Object.keys()
        configurable: false
    });
    
    // Hide all vbox* globals by making them non-enumerable
    // They still work when accessed directly — just invisible to enumeration
    const vboxGlobals = [
        '__VBOX_API__', 'vboxConsole', 'vboxPowerPoint', 'vboxDownloads', 'vboxInput',
        'vboxScreenshot', 'vboxFile', 'vboxContext', 'vboxNavigation',
        'vboxCookies', 'vboxDialog', 'vboxTabs', 'vboxPassword',
        'runVBoxScript'
    ];
    
    vboxGlobals.forEach(key => {
        try {
            if (typeof window[key] !== 'undefined') {
                const descriptor = Object.getOwnPropertyDescriptor(window, key);
                if (descriptor && descriptor.configurable) {
                    Object.defineProperty(window, key, {
                        ...descriptor,
                        enumerable: false // Hide from Object.keys() and for...in loops
                    });
                }
            }
        } catch (_) {}
    });
}

module.exports = { init: initVBoxApiStealth };
