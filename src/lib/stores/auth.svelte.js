// Auth Store using Svelte 5 Runes
import { login as apiLogin, logout as apiLogout, checkToken, isAuthenticated, getStoredUser, clearAuth } from '../api/nativeApi.js';
import { secureStorage } from '../api/secureStorage.js';
import { emailSuggestionsStore } from '../utils/emailSuggestions.svelte.js';
import { workspaceStore } from './workspaces.svelte.js';
import { appStore } from './apps.svelte.js';
import { appStateStore } from './appState.svelte.js';

function createAuthStore() {
    // Initialize state
    let user = $state(null);
    let isLoggedIn = $state(false);
    let isLoading = $state(false);
    let error = $state(null);
    let isInitialized = $state(false);

    return {
        // Getters
        get user() { return user; },
        get isLoggedIn() { return isLoggedIn; },
        get isLoading() { return isLoading; },
        get error() { return error; },
        get isInitialized() { return isInitialized; },

        /**
         * Initialize auth state - verify token on app start
         * FIXED: Never auto-logout user due to transient network errors
         */
        async init() {
            if (isInitialized) return;

            // After logout + page reload, skip all API calls to prevent
            // IPC-induced focus corruption. The logout flow sets this flag
            // before reloading so we go directly to the login page.
            if (sessionStorage.getItem('post_logout_reload') === 'true') {
                sessionStorage.removeItem('post_logout_reload');
                user = null;
                isLoggedIn = false;
                isLoading = false;
                isInitialized = true;
                return;
            }

            isLoading = true;
            error = null;

            try {
                const authenticated = await isAuthenticated();
                if (authenticated) {
                    // Verify token with server
                    const result = await checkToken();
                    if (result.success) {
                        user = result.user;
                        isLoggedIn = true;
                    } else {
                        // Token invalid from server (not just network error)
                        // Only logout if it's a real auth failure, not network issue
                        const storedUser = getStoredUser();
                        if (storedUser) {
                            // Keep user logged in, try to refresh session later
                            user = storedUser;
                            isLoggedIn = true;
                            console.log('[Auth] Token invalid but keeping session (will retry on next action)');
                        }
                    }
                } else {
                    // No valid token found
                    user = null;
                    isLoggedIn = false;
                }
            } catch (err) {
                console.error('[Auth] Init error (keeping user logged in):', err);
                // CRITICAL: On ANY network error, keep the user logged in if they have a stored session
                // This prevents unwanted auto-logout due to server being temporarily down
                const storedUser = getStoredUser();
                if (storedUser) {
                    user = storedUser;
                    isLoggedIn = true;
                    console.log('[Auth] Network error but keeping user logged in from local storage');
                } else {
                    user = null;
                    isLoggedIn = false;
                }
            } finally {
                isLoading = false;
                isInitialized = true;
            }
        },

        /**
         * Login user
         */
        async login(email, password) {
            isLoading = true;
            error = null;

            try {
                const result = await apiLogin(email, password);

                if (result.success) {
                    user = result.user;
                    isLoggedIn = true;
                    
                    // Save email to suggestions for future logins
                    emailSuggestionsStore.addEmail(email);
                    
                    return { success: true };
                } else {
                    // Provide more user-friendly error messages
                    let friendlyError = result.error;
                    
                    if (result.error?.includes('Kredensial salah')) {
                        friendlyError = 'Invalid email or password. Please check your credentials.';
                    } else if (result.error?.includes('network') || result.error?.includes('ECONNREFUSED')) {
                        friendlyError = 'Unable to connect to server. Please check your connection.';
                    } else if (result.error?.includes('timeout')) {
                        friendlyError = 'Request timed out. Please try again.';
                    } else if (result.error?.includes('401')) {
                        friendlyError = 'Authentication failed. Please check your credentials.';
                    } else if (result.error?.includes('500')) {
                        friendlyError = 'Server error. Please try again later.';
                    }
                    
                    error = friendlyError;
                    return { success: false, error: friendlyError };
                }
            } catch (err) {
                console.error('Login error:', err);
                let friendlyError = 'An unexpected error occurred. Please try again.';
                
                if (err.message?.includes('network') || err.message?.includes('fetch')) {
                    friendlyError = 'Network error. Please check your internet connection.';
                } else if (err.message?.includes('timeout')) {
                    friendlyError = 'Request timed out. Please try again.';
                }
                
                error = friendlyError;
                return { success: false, error: friendlyError };
            } finally {
                isLoading = false;
            }
        },

        /**
         * Logout user
         */
        async logout() {
            isLoading = true;

            try {
                await apiLogout();
                
                // Clear all local data for multi-user safety
                if (window.api?.clearAllLocalData) {
                    await window.api.clearAllLocalData();
                }
                if (window.api?.clearSessionPartitions) {
                    await window.api.clearSessionPartitions();
                }
                
                // Reset all stores to prevent stale data from previous user
                workspaceStore.reset();
                appStore.clearAll();
                appStateStore.clearAll();
                
                // Clear localStorage
                localStorage.clear();
            } catch (err) {
                console.error('Logout cleanup error:', err);
            } finally {
                user = null;
                isLoggedIn = false;
                isLoading = false;
                error = null;

                // Clear storage
                localStorage.clear();
                sessionStorage.clear();

                // SPA Transition: Just update states (user, isLoggedIn, isLoading, error)
                // and let Svelte render LoginPage dynamically. We will trigger the window
                // minimize/restore sequence inside LoginPage's onMount.
            }
        },

        /**
         * Fetch user data specifically (useful after deep link login)
         */
        async fetchUser() {
            try {
                const result = await checkToken();
                if (result.success) {
                    user = result.user;
                    isLoggedIn = true;
                    localStorage.setItem('auth_user', JSON.stringify(result.user));
                    return true;
                } else {
                    return false;
                }
            } catch (err) {
                console.error('Fetch user error:', err);
                return false;
            }
        },

        /**
         * Update user data
         */
        updateUser(newUserData) {
            user = newUserData;
            localStorage.setItem('auth_user', JSON.stringify(newUserData));
        },

        /**
         * Clear error
         */
        clearError() {
            error = null;
        }
    };
}

export const authStore = createAuthStore();
