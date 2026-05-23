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
import WindowAccountSettings from "./pages/WindowAccountSettings.svelte";
import WindowStaffMonitoring from "./pages/WindowStaffMonitoring.svelte";
import WindowPasswordManager from "./pages/WindowPasswordManager.svelte";
import { mount } from "svelte";

// Wait for DOM to be ready
function initRouter() {
    // Simple hash-based router for child windows
    const hash = window.location.hash.slice(1); // Remove #

    let component;
    const target = document.getElementById("app");
    
    if (!target) {
        console.error('[Router] Target element #app not found!');
        return;
    }

    try {
        if (hash.startsWith('#/window/') || hash.startsWith('/window/')) {
            const route = hash.replace('#/window/', '').replace('/window/', '');
            
            switch (route) {
                case 'settings':
                    component = mount(WindowSettings, { target });
                    break;
                case 'target':
                    component = mount(WindowTarget, { target });
                    break;
                case 'inject-script':
                    component = mount(WindowInjectScript, { target });
                    break;
                case 'profile':
                    component = mount(WindowProfile, { target });
                    break;
                case 'cookie-manager':
                    component = mount(WindowCookieManager, { target });
                    break;
                case 'script-console':
                    component = mount(WindowScriptConsole, { target });
                    break;
                case 'vbox-api-docs':
                    component = mount(WindowVBoxApiDocumentation, { target });
                    break;
                case 'add-service':
                    component = mount(WindowAddService, { target });
                    break;
                case 'script-input':
                    component = mount(WindowScriptInput, { target });
                    break;
                case 'account-settings':
                    component = mount(WindowAccountSettings, { target });
                    break;
                case 'staff-monitoring':
                    component = mount(WindowStaffMonitoring, { target });
                    break;
                case 'password-manager':
                    component = mount(WindowPasswordManager, { target });
                    break;
                default:
                    component = mount(App, { target });
            }
        } else {
            // Main app
            component = mount(App, { target });
        }
        
        return component;
    } catch (error) {
        console.error('[Router] Error mounting component:', error);
        throw error;
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRouter);
} else {
    initRouter();
}

export default null;
