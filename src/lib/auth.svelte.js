// Auth Store using Svelte 5 Runes
import { login as apiLogin, logout as apiLogout, checkToken, isAuthenticated, getStoredUser, clearAuth } from './nativeApi.js';
import { secureStorage } from './secureStorage.js';
import { emailSuggestionsStore } from './emailSuggestions.svelte.js';

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
            } finally {
                user = null;
                isLoggedIn = false;
                isLoading = false;
                error = null;
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
