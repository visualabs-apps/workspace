/**
 * Theme Utility
 *
 * Shared theme initialization for all child windows.
 * Each Electron BrowserWindow has its own document, so the `dark` class
 * must be applied independently in every window.
 *
 * Usage (inside onMount):
 *   import { initTheme } from '../lib/utils/theme.js';
 *   onMount(() => initTheme());
 */

/**
 * Apply a theme value to the current document.
 * @param {'light'|'dark'|'system'} selectedTheme
 */
export function applyTheme(selectedTheme) {
    const root = document.documentElement;

    if (selectedTheme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.classList.toggle('dark', prefersDark);
    } else {
        root.classList.toggle('dark', selectedTheme === 'dark');
    }
}

/**
 * Initialize theme for a child window.
 *
 * 1. Loads the saved theme from the database.
 * 2. Applies the `dark` class to `document.documentElement`.
 * 3. Listens for theme changes broadcast from the parent window via IPC.
 * 4. Listens for system theme changes (when theme is set to 'system').
 *
 * @returns {Function} Cleanup function to remove listeners.
 */
export async function initTheme() {
    // ── 1. Load saved theme ────────────────────────────────────────────
    try {
        const themeResult = await window.api?.db?.getSetting('theme');
        if (themeResult?.success && themeResult.value) {
            applyTheme(themeResult.value);
        }
    } catch (error) {
        console.error('[theme] Failed to load theme:', error);
    }

    // ── 2. Listen for theme changes from parent window (IPC) ──────────
    const handleParentThemeChange = (data) => {
        if (data?.theme) {
            applyTheme(data.theme);
        }
    };

    const removeParentListener = window.api?.onParentMessage?.('theme-changed', handleParentThemeChange);

    // ── 3. Listen for local theme-changed events ──────────────────────
    const handleLocalThemeChange = (event) => {
        if (event.detail?.theme) {
            applyTheme(event.detail.theme);
        }
    };

    window.addEventListener('theme-changed', handleLocalThemeChange);

    // ── 4. Listen for system theme changes (for 'system' mode) ────────
    const systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = async () => {
        try {
            const themeResult = await window.api?.db?.getSetting('theme');
            if (themeResult?.success && themeResult.value === 'system') {
                applyTheme('system');
            }
        } catch (error) {
            console.error('[theme] Failed to handle system theme change:', error);
        }
    };

    systemThemeQuery.addEventListener('change', handleSystemThemeChange);

    // ── Return cleanup ─────────────────────────────────────────────────
    return () => {
        window.removeEventListener('theme-changed', handleLocalThemeChange);
        systemThemeQuery.removeEventListener('change', handleSystemThemeChange);
        if (typeof removeParentListener === 'function') removeParentListener();
    };
}
