// API Service using Axios
import axios from 'axios';
import { secureStorage } from './secureStorage.js';

// Base URL configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://app.v-leb.local/api';

// Create Axios instance
const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest', // Help with CORS
    },
    withCredentials: true, // Important for cookies/session if needed
    timeout: 10000 // 10 second timeout
});

// Request Interceptor: Attach Auth Token
api.interceptors.request.use(
    async (config) => {
        const token = await secureStorage.getAuthToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response Interceptor: Handle 401 Unauthorized (Auto Logout/Refresh)
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // If 401 Unauthorized and not already retrying
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                // Try to refresh token
                const token = await secureStorage.getAuthToken();
                if (!token) throw new Error('No token to refresh');

                const response = await axios.post(`${API_BASE_URL}/refresh`, {}, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                const { token: newToken, expires_in } = response.data;

                // Save new token
                await secureStorage.setAuthToken(newToken);
                localStorage.setItem('token_expires_at', Date.now() + (expires_in * 1000));

                // Retry original request with new token
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
                return api(originalRequest);
            } catch (refreshError) {
                // Refresh failed -> Logout
                await clearAuth();
                window.dispatchEvent(new CustomEvent('auth:logout')); // Notify app to logout
                return Promise.reject(refreshError);
            }
        }
        return Promise.reject(error);
    }
);

// ==================== Auth Methods ====================

export const clearAuth = async () => {
    await secureStorage.clearAuth();
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_token'); // Clear legacy
    localStorage.removeItem('token_expires_at');
};

export const login = async (email, password) => {
    try {
        const response = await api.post('/login', { email, password });
        const { token, user, expires_in } = response.data;

        await secureStorage.setAuthToken(token);
        localStorage.setItem('auth_user', JSON.stringify(user));
        localStorage.setItem('token_expires_at', Date.now() + (expires_in * 1000));

        return { success: true, user };
    } catch (error) {
        return { success: false, error: error.response?.data?.message || 'Login failed' };
    }
};

export const logout = async () => {
    try {
        await api.post('/logout');
    } finally {
        await clearAuth();
    }
};

export const checkToken = async () => {
    try {
        const response = await api.get('/check-token');
        return { success: response.data.valid, user: response.data.user };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

export const getCurrentUser = async () => {
    try {
        const response = await api.get('/user');
        return { success: true, user: response.data.user };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

export const isAuthenticated = async () => {
    const token = await secureStorage.getAuthToken();
    const expiresAt = localStorage.getItem('token_expires_at');
    if (!token) return false;
    if (expiresAt && Date.now() > parseInt(expiresAt)) return false;
    return true;
};

export const getStoredUser = () => {
    try {
        const userStr = localStorage.getItem('auth_user');
        return userStr ? JSON.parse(userStr) : null;
    } catch {
        return null;
    }
};

// ==================== API Resources ====================

// Video Editor
export const getCredits = () => api.get('/video-editor/credits').then(res => res.data);
export const generateStory = (data) => api.post('/video-editor/generate-story', data).then(res => res.data);
export const generateBRoll = (data) => api.post('/video-editor/generate-broll', data).then(res => res.data);
export const generateTargetMarkets = (data) => api.post('/video-editor/generate-target-markets', data).then(res => res.data);
export const checkAIStatus = (id) => api.get(`/video-editor/ai-status/${id}`).then(res => res.data);
export const cancelAIRequest = (id) => api.delete(`/video-editor/ai-cancel/${id}`).then(res => res.data);
export const generateVoiceOver = (data) => api.post('/video-editor/generate-voiceover', data).then(res => res.data);
export const getAvailableVoices = () => api.get('/video-editor/available-voices').then(res => res.data);
export const logError = (level, message, context = {}) => api.post('/video-editor/log-error', { level, message, context }).catch(() => { });

// Profile
export const updateProfile = async (data) => {
    try {
        const response = await api.put('/user/profile', data);
        return { success: true, user: response.data.user };
    } catch (error) {
        return { success: false, error: error.response?.data?.message || 'Update failed' };
    }
};

// Google OAuth
export const getGoogleOAuthUrl = async () => {
    try {
        const response = await api.get('/auth/google/redirect'); // Note: This redirects 302 usually, handled by browser/electron
        // If API returns URL string instead of redirect
        return { success: true, url: response.data.url };
    } catch (error) {
        return { success: false, error: 'Failed to get OAuth URL' };
    }
};

export const handleGoogleCallback = async (code) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/auth/google/callback?code=${encodeURIComponent(code)}`);
        const { token, user, expires_in } = response.data;

        await secureStorage.setAuthToken(token);
        localStorage.setItem('auth_user', JSON.stringify(user));
        localStorage.setItem('token_expires_at', Date.now() + (expires_in * 1000));

        return { success: true, user, token, expiresIn: expires_in };
    } catch (error) {
        return { success: false, error: error.response?.data?.message || 'Google Auth Failed' };
    }
};

export { API_BASE_URL };
export default api;
