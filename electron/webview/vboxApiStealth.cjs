/**
 * VBox API Stealth Wrapper
 * 
 * This module provides a way to access VBox APIs without exposing them
 * as obvious global variables that can be detected by anti-bot systems.
 * 
 * Instead of window.__VBOX_API__, we use a hidden Symbol-based approach
 * that's much harder to detect.
 */

function initVBoxApiStealth() {
    // Create a hidden symbol for VBox API access
    const VBOX_SYMBOL = Symbol.for('__vbox_internal__');
    
    // Store the original VBox API under the symbol
    if (typeof window.__VBOX_API__ !== 'undefined') {
        // Move the API to symbol-based storage
        window[VBOX_SYMBOL] = window.__VBOX_API__;
        
        // Delete the obvious global
        try {
            delete window.__VBOX_API__;
        } catch (_) {
            window.__VBOX_API__ = undefined;
        }
    }
    
    // Provide a safe accessor function that scripts can use
    // This is less obvious than a direct global variable
    Object.defineProperty(window, 'getVBoxAPI', {
        value: function() {
            return window[VBOX_SYMBOL];
        },
        writable: false,
        enumerable: false, // Hidden from Object.keys()
        configurable: false
    });
    
    // Also hide all vbox* globals by making them non-enumerable
    const vboxGlobals = [
        'vboxConsole', 'vboxPowerPoint', 'vboxDownloads', 'vboxInput',
        'vboxScreenshot', 'vboxFile', 'vboxContext', 'vboxNavigation',
        'vboxCookies', 'vboxDialog', 'vboxTabs', 'vboxPassword'
    ];
    
    vboxGlobals.forEach(key => {
        if (typeof window[key] !== 'undefined') {
            const descriptor = Object.getOwnPropertyDescriptor(window, key);
            if (descriptor && descriptor.configurable) {
                Object.defineProperty(window, key, {
                    ...descriptor,
                    enumerable: false // Hide from Object.keys() and for...in loops
                });
            }
        }
    });
}

module.exports = { init: initVBoxApiStealth };
