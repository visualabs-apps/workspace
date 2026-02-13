// Auth Store using Svelte 5 Runes
import { login as apiLogin, logout as apiLogout, checkToken, isAuthenticated, getStoredUser, clearAuth } from './api.js';

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
         */
        async init() {
            if (isInitialized) return;
            
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
                        // Token invalid, clear auth
                        await clearAuth();
                        user = null;
                        isLoggedIn = false;
                    }
                } else {
                    user = null;
                    isLoggedIn = false;
                }
            } catch (err) {
                console.error('Auth init error:', err);
                // On network error, keep local state if exists
                user = getStoredUser();
                isLoggedIn = await isAuthenticated();
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
                    return { success: true };
                } else {
                    error = result.error;
                    return { success: false, error: result.error };
                }
            } catch (err) {
                error = err.message;
                return { success: false, error: err.message };
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
            } finally {
                user = null;
                isLoggedIn = false;
                isLoading = false;
                error = null;
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
         * Set login state (for OAuth callback)
         */
        setLoggedIn(userData, token, expiresIn) {
            localStorage.setItem('auth_token', token);
            localStorage.setItem('auth_user', JSON.stringify(userData));
            localStorage.setItem('token_expires_at', Date.now() + (expiresIn * 1000));
            user = userData;
            isLoggedIn = true;
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
