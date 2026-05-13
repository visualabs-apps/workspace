import "./app.css";
import App from "./App.svelte";
import WindowSettings from "./pages/WindowSettings.svelte";
import WindowTarget from "./pages/WindowTarget.svelte";
import WindowInjectScript from "./pages/WindowInjectScript.svelte";
import WindowProfile from "./pages/WindowProfile.svelte";
import WindowCookieManager from "./pages/WindowCookieManager.svelte";
import WindowScriptConsole from "./pages/WindowScriptConsole.svelte";
import WindowVBoxApiDocumentation from "./pages/WindowVBoxApiDocumentation.svelte";
import WindowAddService from "./pages/WindowAddService.svelte";
import WindowScriptInput from "./pages/WindowScriptInput.svelte";
import { mount } from "svelte";

console.log('[main.js] ========== ROUTER START ==========');
console.log('[main.js] window.location:', {
    href: window.location.href,
    hash: window.location.hash,
    pathname: window.location.pathname,
    search: window.location.search
});

// Wait for DOM to be ready
function initRouter() {
    console.log('[main.js] initRouter() called');
    
    // Simple hash-based router for child windows
    const hash = window.location.hash.slice(1); // Remove #
    console.log('[main.js] Parsed hash:', hash);

    let component;
    const target = document.getElementById("app");
    
    if (!target) {
        console.error('[main.js] ERROR: Target element #app not found!');
        return;
    }
    
    console.log('[main.js] Target element found:', target);

    try {
        if (hash.startsWith('/window/')) {
            const route = hash.replace('/window/', '');
            console.log('[main.js] Detected window route:', route);
            
            switch (route) {
                case 'settings':
                    console.log('[main.js] Mounting WindowSettings');
                    component = mount(WindowSettings, { target });
                    break;
                case 'target':
                    console.log('[main.js] Mounting WindowTarget');
                    component = mount(WindowTarget, { target });
                    break;
                case 'inject-script':
                    console.log('[main.js] Mounting WindowInjectScript');
                    component = mount(WindowInjectScript, { target });
                    break;
                case 'profile':
                    console.log('[main.js] Mounting WindowProfile');
                    component = mount(WindowProfile, { target });
                    break;
                case 'cookie-manager':
                    console.log('[main.js] Mounting WindowCookieManager');
                    component = mount(WindowCookieManager, { target });
                    break;
                case 'script-console':
                    console.log('[main.js] Mounting WindowScriptConsole');
                    component = mount(WindowScriptConsole, { target });
                    break;
                case 'vbox-api-docs':
                    console.log('[main.js] Mounting WindowVBoxApiDocumentation');
                    component = mount(WindowVBoxApiDocumentation, { target });
                    break;
                case 'add-service':
                    console.log('[main.js] Mounting WindowAddService');
                    component = mount(WindowAddService, { target });
                    break;
                case 'script-input':
                    console.log('[main.js] Mounting WindowScriptInput');
                    component = mount(WindowScriptInput, { target });
                    break;
                default:
                    console.log('[main.js] Unknown window route, mounting App');
                    component = mount(App, { target });
            }
        } else {
            // Main app
            console.log('[main.js] No window route, mounting main App');
            component = mount(App, { target });
        }

        console.log('[main.js] ✅ Component mounted successfully:', component);
        console.log('[main.js] ========== ROUTER END ==========');
        
        return component;
    } catch (error) {
        console.error('[main.js] ❌ ERROR mounting component:', error);
        console.error('[main.js] Error stack:', error.stack);
        throw error;
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    console.log('[main.js] DOM still loading, waiting for DOMContentLoaded...');
    document.addEventListener('DOMContentLoaded', initRouter);
} else {
    console.log('[main.js] DOM already loaded, initializing immediately');
    initRouter();
}

export default null;
