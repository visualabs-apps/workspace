// API Service for V-LEB Laravel Backend
import { secureStorage } from './secureStorage.js';

// Base URL untuk API Laravel
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://app.v-leb.local/api';

/**
 * Wrapper untuk fetch dengan JWT token
 */
async function fetchWithAuth(endpoint, options = {}) {
    const token = await secureStorage.getAuthToken();
    
    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
    });

    // Handle 401 Unauthorized - token expired/invalid
    if (response.status === 401) {
        // Try to refresh token
        const refreshed = await refreshToken();
        if (refreshed) {
            // Retry original request with new token
            const newToken = await secureStorage.getAuthToken();
            headers['Authorization'] = `Bearer ${newToken}`;
            return fetch(`${API_BASE_URL}${endpoint}`, {
                ...options,
                headers,
            });
        } else {
            // Refresh failed, clear auth
            await clearAuth();
            throw new Error('Session expired. Please login again.');
        }
    }

    return response;
}

/**
 * Clear authentication data
 */
async function clearAuth() {
    await secureStorage.clearAuth();
}

/**
 * Refresh JWT token
 */
async function refreshToken() {
    const token = await secureStorage.getAuthToken();
    if (!token) return false;

    try {
        const response = await fetch(`${API_BASE_URL}/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
        });

        if (response.ok) {
            const data = await response.json();
            await secureStorage.setAuthToken(data.token);
            localStorage.setItem('token_expires_at', Date.now() + (data.expires_in * 1000));
            return true;
        }
        return false;
    } catch (error) {
        console.error('Token refresh failed:', error);
        return false;
    }
}

// ==================== Auth API ====================

/**
 * Login user
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<{success: boolean, user?: object, error?: string}>}
 */
export async function login(email, password) {
    try {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (response.ok) {
            // Store token securely using keytar
            await secureStorage.setAuthToken(data.token);
            
            // Store user data in localStorage (not sensitive)
            localStorage.setItem('auth_user', JSON.stringify(data.user));
            localStorage.setItem('token_expires_at', Date.now() + (data.expires_in * 1000));
            
            return { success: true, user: data.user };
        } else {
            return { 
                success: false, 
                error: data.message || 'Invalid credentials' 
            };
        }
    } catch (error) {
        console.error('Login error:', error);
        return { 
            success: false, 
            error: 'Network error. Please check your connection.' 
        };
    }
}

/**
 * Logout user
 */
export async function logout() {
    try {
        await fetchWithAuth('/logout', { method: 'POST' });
    } catch (error) {
        console.error('Logout error:', error);
    } finally {
        clearAuth();
    }
}

/**
 * Get current user info
 */
export async function getCurrentUser() {
    try {
        const response = await fetchWithAuth('/user');
        if (response.ok) {
            const data = await response.json();
            return { success: true, user: data.user };
        }
        return { success: false, error: 'Failed to get user' };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Check if token is valid
 */
export async function checkToken() {
    try {
        const response = await fetchWithAuth('/check-token');
        const data = await response.json();
        return { success: data.valid, user: data.user };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Check if user is authenticated (local check)
 */
export async function isAuthenticated() {
    const token = await secureStorage.getAuthToken();
    const expiresAt = localStorage.getItem('token_expires_at');
    
    if (!token) return false;
    
    // Check if token is expired
    if (expiresAt && Date.now() > parseInt(expiresAt)) {
        return false;
    }
    
    return true;
}

/**
 * Get stored user data
 */
export function getStoredUser() {
    try {
        const userStr = localStorage.getItem('auth_user');
        return userStr ? JSON.parse(userStr) : null;
    } catch {
        return null;
    }
}

// ==================== Video Editor API ====================

/**
 * Get user credits
 */
export async function getCredits() {
    const response = await fetchWithAuth('/video-editor/credits');
    return response.json();
}

/**
 * Generate AI story
 */
export async function generateStory(productData) {
    const response = await fetchWithAuth('/video-editor/generate-story', {
        method: 'POST',
        body: JSON.stringify(productData),
    });
    return response.json();
}

/**
 * Generate B-roll suggestions
 */
export async function generateBRoll(data) {
    const response = await fetchWithAuth('/video-editor/generate-broll', {
        method: 'POST',
        body: JSON.stringify(data),
    });
    return response.json();
}

/**
 * Generate target markets
 */
export async function generateTargetMarkets(data) {
    const response = await fetchWithAuth('/video-editor/generate-target-markets', {
        method: 'POST',
        body: JSON.stringify(data),
    });
    return response.json();
}

/**
 * Check AI request status
 */
export async function checkAIStatus(requestId) {
    const response = await fetchWithAuth(`/video-editor/ai-status/${requestId}`);
    return response.json();
}

/**
 * Cancel AI request
 */
export async function cancelAIRequest(requestId) {
    const response = await fetchWithAuth(`/video-editor/ai-cancel/${requestId}`, {
        method: 'DELETE',
    });
    return response.json();
}

/**
 * Generate voiceover
 */
export async function generateVoiceOver(data) {
    const response = await fetchWithAuth('/video-editor/generate-voiceover', {
        method: 'POST',
        body: JSON.stringify(data),
    });
    return response.json();
}

/**
 * Get available voices
 */
export async function getAvailableVoices() {
    const response = await fetchWithAuth('/video-editor/available-voices');
    return response.json();
}

/**
 * Log error to backend
 */
export async function logError(level, message, context = {}) {
    try {
        await fetchWithAuth('/video-editor/log-error', {
            method: 'POST',
            body: JSON.stringify({ level, message, context }),
        });
    } catch (error) {
        console.error('Failed to log error to backend:', error);
    }
}

// ==================== Profile API ====================

/**
 * Update user profile
 * @param {object} data - Profile data to update
 * @returns {Promise<{success: boolean, user?: object, error?: string}>}
 */
export async function updateProfile(data) {
    try {
        const response = await fetchWithAuth('/user/profile', {
            method: 'PUT',
            body: JSON.stringify(data),
        });

        const result = await response.json();

        if (response.ok) {
            return { success: true, user: result.user };
        } else {
            return { success: false, error: result.message || 'Failed to update profile' };
        }
    } catch (error) {
        console.error('Profile update error:', error);
        return { success: false, error: 'Network error. Please try again.' };
    }
}

// ==================== Google OAuth API ====================

/**
 * Get Google OAuth redirect URL
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
export async function getGoogleOAuthUrl() {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/google/redirect`, {
            headers: {
                'Accept': 'application/json',
            },
        });

        const data = await response.json();

        if (response.ok) {
            return { success: true, url: data.url };
        } else {
            return { success: false, error: data.message || 'Failed to get OAuth URL' };
        }
    } catch (error) {
        console.error('Google OAuth error:', error);
        return { success: false, error: 'Network error. Please try again.' };
    }
}

/**
 * Handle Google OAuth callback
 * @param {string} code - OAuth authorization code
 * @returns {Promise<{success: boolean, user?: object, token?: string, error?: string}>}
 */
export async function handleGoogleCallback(code) {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/google/callback?code=${encodeURIComponent(code)}`, {
            headers: {
                'Accept': 'application/json',
            },
        });

        const data = await response.json();

        if (response.ok) {
            // Store token and user data
            localStorage.setItem('auth_token', data.token);
            localStorage.setItem('auth_user', JSON.stringify(data.user));
            localStorage.setItem('token_expires_at', Date.now() + (data.expires_in * 1000));

            return { 
                success: true, 
                user: data.user, 
                token: data.token,
                expiresIn: data.expires_in 
            };
        } else {
            return { success: false, error: data.message || 'Google authentication failed' };
        }
    } catch (error) {
        console.error('Google callback error:', error);
        return { success: false, error: 'Network error. Please try again.' };
    }
}

/**
 * Handle Google OAuth callback with PKCE
 * Exchange authorization code for app JWT token via backend
 * @param {string} code - Authorization code from Google
 * @param {string} codeVerifier - PKCE code verifier
 * @param {string} redirectUri - Redirect URI used in authorization
 * @returns {Promise<{success: boolean, user?: object, token?: string, error?: string}>}
 */
export async function exchangeGoogleCode(code, codeVerifier, redirectUri) {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/google/exchange`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                code: code,
                code_verifier: codeVerifier,
                redirect_uri: redirectUri
            }),
        });

        const data = await response.json();

        if (response.ok) {
            // Store token and user data
            localStorage.setItem('auth_token', data.token);
            localStorage.setItem('auth_user', JSON.stringify(data.user));
            localStorage.setItem('token_expires_at', Date.now() + (data.expires_in * 1000));

            return { 
                success: true, 
                user: data.user, 
                token: data.token,
                expiresIn: data.expires_in 
            };
        } else {
            return { success: false, error: data.message || 'Token exchange failed' };
        }
    } catch (error) {
        console.error('Token exchange error:', error);
        return { success: false, error: 'Network error. Please try again.' };
    }
}

export { API_BASE_URL, fetchWithAuth, clearAuth };
